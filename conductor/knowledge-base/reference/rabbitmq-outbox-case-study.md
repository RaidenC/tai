---
title: RabbitMQ + Transactional Outbox — Case Study (tai-portal)
difficulty: L2 | L3 | Staff
lastUpdated: 2026-04-21
relatedTopics:
  - Message-Queues (survey)
  - Design-Patterns
  - Distributed-Systems
  - EFCore-SQL
  - MediatR-CQRS
stack: backend
---

[🧠 **View Interactive Mindmap**](./rabbitmq-outbox-case-study-mindmap.md)

## TL;DR

`tai-portal` originally published "integration events" through a `LoggingMessageBus` stub — every `IMessageBus.PublishAsync` call just wrote a log line, so cross-app delivery was never actually happening. Stage 1B replaces that stub with a transactional outbox: `OutboxMessageBus` writes a row to `OutboxMessages` (JSONB payload) inside the caller's `SaveChangesAsync`, and a `BackgroundService` polls that table with `SELECT FOR UPDATE SKIP LOCKED` and publishes via raw `RabbitMQ.Client` with publisher confirms to a durable topic exchange. The same change also fixes a separate-but-related dispatch-before-save re-entrancy bug in `PortalDbContext.SaveChangesAsync` by reshaping it into an explicit Unit-of-Work that saves first, dispatches MediatR domain events second, saves again if handlers added entities, then commits, then runs deferred SignalR pushes via a post-commit registry — so handlers never call `SaveChangesAsync` themselves and side effects can't fire ahead of a commit that later fails.

## 1. The Problem

### 1.1 Before: `IMessageBus` stub

The pre-Stage-1B `LoggingMessageBus` (now removed; see commit `d626a7b`) implemented `IMessageBus.PublishAsync<T>` by serializing the message and calling `_logger.LogInformation`. From the application layer's point of view, "integration events were being published." From an operational point of view, no broker existed and no consumer ever received anything. This is a common shape for greenfield projects — the bus interface gets stubbed early so calling code doesn't have to change later, but the actual delivery path is deferred. The hazard is that the stub is invisible: handlers look correct, tests mock the interface, and nobody notices that the system has zero cross-app event delivery until Stage 2 needs it.

### 1.2 The dual-write hazard

Once you replace the stub with a real broker, the naive implementation is "save the entity, then publish the event":

```csharp
await dbContext.SaveChangesAsync();      // commits row
await broker.PublishAsync(integrationEvent); // sends message
```

This is the **dual-write problem**. Two independent systems (Postgres and RabbitMQ) must both succeed for the operation to be consistent, but you have no transaction that spans them. Concrete failure modes:

- DB commits, broker publish throws → row exists, downstream consumers never hear about it. Silent inconsistency; the only way to detect it is reconciliation after the fact.
- DB commits, broker publish succeeds, the process crashes between them → indeterminate. Did the message ship? Re-running won't help (you'd send it twice).
- DB commit succeeds, broker hangs (network partition) → the request thread is blocked waiting on a publish that may eventually succeed or eventually time out. The user sees a 500 on something that actually worked.

The transactional outbox pattern collapses this into a single transaction. The "publish" becomes a row insert into `OutboxMessages` in the same DB transaction as the entity write. Either both rows commit or neither does — the broker is no longer in the critical path. A separate worker is responsible for moving the row to the broker, and that worker can retry safely because the row is durable.

### 1.3 The dispatch-before-save re-entrancy bug

Independently of the dual-write hazard, `PortalDbContext.SaveChangesAsync` had a second, sneakier bug: it dispatched MediatR domain events **before** calling `base.SaveChangesAsync`. Several handlers (e.g. `PrivilegeChangeEventHandler`, `LoginAnomalyEventHandler`) wrote `AuditEntry` rows and then called `_dbContext.SaveChangesAsync(ct)` themselves — which re-entered the orchestrator, re-dispatched, re-saved. The same handlers also called `_realTimeNotifier.SendSecurityEventAsync` inline, so SignalR pushes fired before any commit. If the outer save subsequently rolled back (concurrency exception, validation failure, downstream constraint), the audit row was rolled back too, but the SignalR notification had already gone to clients — they'd see "your privileges changed" when nothing had actually changed.

Both bugs share a root cause: there's no clear boundary between "DB work in progress" and "DB work has committed." The Unit-of-Work refactor in `libs/core/infrastructure/Persistence/PortalDbContext.cs:69-126` makes that boundary explicit, and the `RegisterPostCommitAction` API at line 60 gives handlers a deferral channel for side effects that must wait for commit.

## 2. Architecture

### 2.1 Two event layers

After Stage 1B there are two distinct event mechanisms in the codebase, and conflating them is the most common mistake when reading this code:

- **Domain events (in-process, MediatR).** Aggregates raise events via `IHasDomainEvents`. `PortalDbContext.DispatchDomainEventsAsync` (`PortalDbContext.cs:163-188`) wraps each event in a `DomainEventNotification<T>` and calls `IPublisher.Publish`. Handlers run in-process, in the same transaction, on the same thread. They can mutate the DbContext (`AuditLogs.Add(...)`) and the orchestrator's second save persists those changes. They are NOT durable — a crash mid-handler drops them.
- **Integration events (cross-app, outbox + RabbitMQ).** Application code or domain-event handlers call `IMessageBus.PublishAsync(envelope)`. `OutboxMessageBus` (`libs/core/infrastructure/Messaging/OutboxMessageBus.cs`) adds an `OutboxMessage` row to the ChangeTracker. The orchestrator's `base.SaveChangesAsync` commits it atomically with everything else. The background worker eventually publishes the row to RabbitMQ and marks `ProcessedAt`.

Domain events are for "this aggregate did X, and other parts of the same process should react now while the transaction is still open." Integration events are for "this aggregate did X, and other apps need to know eventually." Both fan out from the same `Handle` method in many cases (see `PrivilegeChangeEventHandler.cs:35-79`), which is why the distinction is easy to miss.

### 2.2 Why this separation matters for modular-monolith evolution

The integration-event abstraction is what lets the modular monolith split into services later without rewriting producers. Today, `PrivilegeChangeEventHandler` calls `_messageBus.PublishAsync(...)` — the underlying implementation is `OutboxMessageBus` writing to a table in the same process. Tomorrow, if the audit / DocViewer concern becomes a separate worker, the producer doesn't change at all: the row still goes to `OutboxMessages`, the worker still reads it, the consumer is just somewhere else. Domain events stay in-process by design — they're a refactoring tool inside a bounded context, not a service-boundary contract.

The separation also gives clean swap points. `IMessageBus` is the **outbox write point** — never changes regardless of broker. `IIntegrationEventPublisher` (`libs/core/application/Interfaces/IIntegrationEventPublisher.cs:18-25`) is the **broker write point** — what changes when RabbitMQ becomes SNS+SQS or Kafka. The outbox table, the polling worker, the `SELECT FOR UPDATE SKIP LOCKED` machinery all stay identical.

## 3. Implementation Deep Dive

### 3.1 `PortalDbContext` as Unit-of-Work orchestrator

`PortalDbContext.SaveChangesAsync` (`PortalDbContext.cs:69-126`) executes eight ordered steps. Read the comments inline; here's the reasoning:

1. **Pre-flight check for caller-managed transactions** (`:71-81`). If `Database.CurrentTransaction` is non-null, somebody upstream called `BeginTransactionAsync` themselves. Wrapping a second transaction would either be ignored (savepoint) or throw, and post-commit actions would have undefined timing. We refuse the post-commit-action case explicitly with `InvalidOperationException` and otherwise fall through to the legacy single-save behavior.
2. **In-memory provider escape hatch** (`:84-95`). EF Core's in-memory provider doesn't support transactions, but unit tests still want orchestration ordering. We run all the steps without the transaction wrapper.
3. **Begin DbContext-owned transaction** (`:97`). `await using` ensures rollback on exception.
4. **Populate audit fields** (`:100`). `CreatedAt`/`CreatedBy`/`LastModifiedAt`/`LastModifiedBy` filled in from `ICurrentUserService`. Done before the save so EF emits the right SQL.
5. **First `base.SaveChangesAsync`** (`:103`). Persists the aggregate-root mutations. After this, the `ChangeTracker` is mostly clean and EF has assigned generated keys (so domain-event handlers can reference `auditEntry.Id`).
6. **Dispatch domain events** (`:106`). MediatR fires; handlers add more entities (typically `AuditEntry` rows and `OutboxMessage` rows via `IMessageBus`). Handlers do NOT call `SaveChangesAsync` themselves — see the static regression guard `HandlerInvariantTests` (commit `e0b1234`) which fails the build if anyone reintroduces it.
7. **Conditional second save** (`:109-111`). If handlers added entities, persist them in the same transaction.
8. **Commit transaction** (`:114`). The DB write is now durable.
9. **Execute post-commit actions** (`:117`). The `RegisterPostCommitAction` API (`:60-62`) lets handlers queue work that must run only on success — typically SignalR pushes and outbound HTTP calls. `ExecutePostCommitActionsAsync` (`:128-142`) snapshots the list, clears it (so retried calls don't double-fire), and runs each callback inside its own try/catch. Failures are **logged but not re-thrown** because the DB has already committed; rolling back at this point would mean undoing DB work for an unrelated SignalR flake.

The catch block at `:120-125` clears `_postCommitActions` on rollback so a failed transaction never fires deferred side effects. That single line is the entire "no ghost notifications" guarantee.

### 3.2 `OutboxMessage` entity

`libs/core/infrastructure/Persistence/Entities/OutboxMessage.cs` is intentionally small and lives under Infrastructure (not Domain) because outbox-ness is plumbing, not a business concept. Field choices worth knowing:

- **`Id` is `Guid`, not identity int** (`:13`). Stable across `pg_dump`/`pg_restore` and used directly as the RabbitMQ `MessageId` so consumers can deduplicate downstream.
- **`EventType` is the CLR type name** (`:18`). `OutboxMessageBus` uses `Type.Name` (commit `399bdf1` — short and readable) and the publisher converts it to a kebab-case routing key.
- **`Payload` is `jsonb`** (configured at `PortalDbContext.cs:328`). Postgres validates it as JSON at write time, queries it with `payload->>'userId'` style operators, and stores it compactly. Plain `text` would skip validation and cost more to query.
- **`ProcessedAt` nullable timestamp** (`:29`). The unprocessed predicate is `ProcessedAt IS NULL`. This drives the partial-index optimization below.
- **`RetryCount` and `Error`** (`:31-34`). The worker increments `RetryCount` on publish failure and stamps the truncated exception message into `Error`. There's no max-retry / DLQ logic in Stage 1B (see "What I Punted") — rows just stay in the table and keep retrying.

The model configuration at `PortalDbContext.cs:325-345` adds a **partial index** filtered on `"ProcessedAt" IS NULL`. This is the most important storage decision in the whole feature. A full index on `OccurredAt` over a table that grows forever would bloat unboundedly; the partial index is ~99% smaller because it only contains entries for rows that are still pending. When `ProcessedAt` flips from null to a timestamp, Postgres removes the index entry — the index entry's lifetime exactly matches the row's "interesting" lifetime. The `IX_OutboxMessages_Unprocessed` name appears in `EXPLAIN` output, which is helpful when verifying the worker's query plan.

### 3.3 `OutboxMessageBus`

`libs/core/infrastructure/Messaging/OutboxMessageBus.cs` is 57 lines and the comments are the documentation. Two non-obvious decisions:

- **It does not call `SaveChangesAsync`** (`:29-35`). It only adds the row to the ChangeTracker. The caller's surrounding `SaveChangesAsync` — typically the orchestrator's first `base.SaveChangesAsync` after the user's command handler completes — is what commits it. That's the entire transactional guarantee of the outbox pattern. If `OutboxMessageBus` saved on its own, you'd be back to two independent commits and the dual-write hazard returns.
- **`message.GetType()` for the runtime type, not `typeof(T)`** (`:37-41`). When `T` is `object` or an interface (it usually is, because callers pass anonymous types), `typeof(T)` is the static type and `JsonSerializer.Serialize(value, typeof(T), ...)` only emits properties declared on that static type. Anonymous types declared as `new { ... }` are reference type `object` at the call site — passing `typeof(T)` would silently emit `{}`. `message.GetType()` returns the concrete runtime type and serializes correctly. This is a classic `System.Text.Json` gotcha and worth remembering for any reflection-heavy serialization code.

### 3.4 Publisher worker

`libs/core/infrastructure/Messaging/OutboxPublisherBackgroundService.cs` extends `BackgroundService`. Key patterns:

- **`IServiceScopeFactory` not direct DbContext injection** (`:33-34`, `:73`). `BackgroundService` is a singleton; `PortalDbContext` is scoped. `CreateAsyncScope` per iteration gives a fresh DbContext bound to a fresh scope, and the `await using` disposes both at the end of the loop. This is the canonical pattern for hosted services that touch scoped services in ASP.NET Core.
- **`SELECT FOR UPDATE SKIP LOCKED` raw SQL** (`:86-93`). The query plan: filter on the partial index, take `BatchSize` rows, lock them at the row level, skip rows other transactions already hold. Multiple replicas can run this loop concurrently — Postgres is the coordinator, no Redis, no Zookeeper, no leader election. Without `FOR UPDATE`, two workers grab the same row and double-publish. Without `SKIP LOCKED`, worker B blocks on worker A's lock until A commits and throughput collapses to single-threaded. This is the same mechanism `pgmq` and `pg_cron`'s job runner use; it's the standard PG work-queue pattern.
- **Loop pacing** (`:54-66`). When `ProcessBatchAsync` returns 0, sleep `PollInterval` (config-driven). When it returns a full batch, loop immediately to drain backlog without sleeping. On any unhandled exception, log and back off `ErrorBackoff` so a crashed broker doesn't tight-loop the logs.
- **Per-message try/catch inside the batch** (`:100-117`). One bad row should not poison the whole batch. On success, set `ProcessedAt` and clear `Error`. On failure, increment `RetryCount`, stamp the truncated error, leave `ProcessedAt` null. The whole batch's state changes commit together at `:119-120`, so rows we couldn't publish stay visible to the next iteration.

### 3.5 RabbitMQ primitives actually used

`libs/core/infrastructure/Messaging/RabbitMqPublisher.cs` deliberately uses raw `RabbitMQ.Client` rather than MassTransit. The point is to know what the primitives actually are:

- **`IConnection` lifetime is process-scoped.** `RabbitMqConnectionProvider` is registered as a singleton in `Program.cs:59-60` and the `IConnection` is constructed once and reused. Connections are expensive (TCP + AMQP handshake + auth). Channels (`IModel`) are cheap and per-publish.
- **Topic exchange, durable** (`:90-99`). Topic exchanges route by glob-style routing keys — consumers can bind queues to `security.#` to receive all security events, or `security.privilege-change` for one specific event. Durable means the exchange survives broker restart; delivery-mode-2 messages (`:60`) persist too.
- **Publisher confirms** (`:50`, `:77`). `ConfirmSelect` puts the channel into "publisher-confirm mode" — every `BasicPublish` gets an ACK or NACK from the broker. `WaitForConfirmsOrDie` blocks until all outstanding publishes are acknowledged or throws on NACK or timeout. Without this, `BasicPublish` is fire-and-forget and a crashed broker silently swallows messages — exactly the failure mode the outbox is supposed to prevent.
- **`AutomaticRecoveryEnabled` and `TopologyRecoveryEnabled`** are set on the `ConnectionFactory` in `RabbitMqConnectionProvider` (lines 30–50). The client transparently reconnects on dropped TCP and re-declares exchanges/queues. The publisher worker doesn't need explicit reconnection logic.
- **Routing key derivation** (`:106-123`). `PrivilegeChangeEvent` → `security.privilege-change`. The `security.` prefix is hardcoded for Stage 1B because every shipped event is in that bounded context; future events from other contexts will need the prefix to come from a strategy class or attribute.

## 4. Failure Modes

| Failure | What happens | What's logged | What the operator sees |
|---|---|---|---|
| DB commit fails | Transaction rolls back. Outbox row never exists. Domain-event handlers that staged audit/outbox rows have those undone. `_postCommitActions` cleared in the catch block (`PortalDbContext.cs:123`), so SignalR push never fires. | The exception bubbles to the controller; standard error middleware logs the stack trace. | The user gets a 500 (or 409 on a concurrency conflict). No phantom notifications, no orphan messages. The system is consistent — nothing happened. |
| Broker down at publish time | `RabbitMqPublisher.PublishAsync` throws on `WaitForConfirmsOrDie`. Worker catches per-row, increments `RetryCount`, stamps `Error`, leaves `ProcessedAt` null. | `LogWarning` per failed message: "Failed to publish outbox message {Id} (retry {N})". `LogError` on whole-loop exception with backoff. | Rows accumulate in `OutboxMessages WHERE ProcessedAt IS NULL`. Once the broker recovers, the next poll drains them. End-to-end latency increases for events queued during the outage but no messages are lost. |
| Broker NACK (e.g. queue full, mandatory routing failure) | `WaitForConfirmsOrDie` throws. Same retry path as broker-down. | Same log line. | Same accumulation; would not auto-resolve unless the underlying broker condition (disk full, consumer offline) is fixed. Worth alerting on `RetryCount > N` as an SLO. |
| Worker process crashes mid-batch | Postgres transaction rolls back automatically (the lock is held by the dead session). Rows that were `FOR UPDATE`-locked become available to the next worker iteration on any replica. | OS / process supervisor logs the crash. | At-most-one-time delivery is preserved by the transaction; rows do not "leak" to a state where they're locked forever. |
| Two workers race on the same row | `SKIP LOCKED` ensures worker B picks a different batch. Worst case a row is published once. | No special log line — this is the happy path of horizontal scaling. | Throughput scales near-linearly with worker count. |
| Post-commit SignalR push fails | `ExecutePostCommitActionsAsync` (`PortalDbContext.cs:134-141`) catches and logs but does not re-throw. The DB write has already committed and the user's request returns success. | `LogError(ex, "Post-commit action failed")`. | The user does not get a real-time notification but the underlying state change is persisted. They'll see it on next page load. This is the correct trade — better a missed notification than a rolled-back save. |
| Consumer receives a duplicate (network retry, redelivery) | Stage 1B has no consumer-side dedup. Stage 2 will use `OutboxMessage.Id` (= RabbitMQ `MessageId`) as the dedup key. | Producer-side: nothing — by the time the broker redelivers, the producer is done. | Currently the system is at-least-once with no idempotency guard. Consumers MUST be idempotent (either by `MessageId` dedup or by the natural keys in the payload). |

## 5. Comparison Tables

### 5.1 Outbox vs direct publish (the dual-write table)

| Scenario | Direct publish | Outbox |
|---|---|---|
| DB commits, broker publish fails | Lost message, silent inconsistency | Row durable, worker retries |
| Broker commits, DB rollback | Phantom event consumers act on | Impossible — same transaction |
| Process crashes between save and publish | Indeterminate; impossible to recover safely | Row durable, worker picks up after restart |
| Broker slow / partitioned | User request blocked on publish | User request returns; worker drains in background |
| Throughput scaling | Bound by broker round-trip in request path | Bound by DB; worker is independently scalable |
| Operational visibility | None — once the publish fails it's gone | `SELECT * FROM "OutboxMessages" WHERE "ProcessedAt" IS NULL` is the dashboard |

### 5.2 Raw `RabbitMQ.Client` vs MassTransit (line-for-line translation)

| Concern | Raw `RabbitMQ.Client` (this repo) | MassTransit |
|---|---|---|
| Connection lifecycle | `RabbitMqConnectionProvider` singleton | `IBusControl` hosted service |
| Channel per publish | `_connection.CreateModel()` in `RabbitMqPublisher:42` | Hidden behind `IPublishEndpoint` |
| Publisher confirms | `ConfirmSelect` + `WaitForConfirmsOrDie` (`:50`, `:77`) | `ConfigurePublishMessageDelivery(...)` config flag |
| Topology declaration | Manual `ExchangeDeclare` (`:92-96`) | Convention-based; auto-declares on bus start |
| Routing key | Manual derivation from CLR type (`:106-123`) | `MessageUrn` attribute or convention |
| Retry / DLQ | Roll your own | First-class with `UseScheduledRedelivery` and `UseMessageRetry` |
| Broker swap (RabbitMQ → SNS+SQS) | Rewrite `RabbitMqPublisher` (~120 lines) | Change `UsingRabbitMq` to `UsingAmazonSqs` config block |

The trade is: raw client teaches you the primitives (which you'll be asked about); MassTransit ships features you'd otherwise build. For an interview-prep POC, raw is the right call. For a production system at scale, MassTransit removes a category of bugs.

### 5.3 Polling vs PG `LISTEN/NOTIFY` vs CDC (Debezium)

| Approach | Latency | Throughput | Complexity | When to pick |
|---|---|---|---|---|
| Polling (this repo) | `PollInterval` (e.g. 500ms idle) | Limited by batch size × loop rate | Lowest — one `BackgroundService`, one query | Everything until you measure a problem |
| `LISTEN/NOTIFY` | Sub-millisecond on commit | Bound by single connection; no multi-replica fan-out | Medium — need a reconnect loop and fall back to polling on missed notifies | When polling latency hurts UX and replica count is low |
| CDC (Debezium / DMS) | Sub-second; reads WAL directly | Very high — separate process, no app-thread contention | High — Kafka Connect / DMS infrastructure to operate | Multi-tenant SaaS where the producer can't afford polling overhead, or when you're already on Kafka |

### 5.4 Sync vs async batch publisher confirms

| Mode | Producer code | Throughput | Failure handling |
|---|---|---|---|
| Sync confirm per publish (this repo, `:77`) | Simple linear flow | One message per round-trip; ~1k msg/s practical | Easy — `WaitForConfirmsOrDie` throws on NACK |
| Async batch confirm | Track outstanding `DeliveryTag`s in a dict; subscribe to `BasicAcks`/`BasicNacks` | 10-100× higher; bound by network not RTT | Harder — must reconcile NACK to specific message and retry |

The Stage 1B worker publishes one message per loop iteration; sync confirm is the simpler correct choice. If the outbox backlog ever grows faster than the worker drains, switch to batch async first, then horizontal-scale workers.

### 5.5 Broker swap matrix: RabbitMQ / Amazon MQ / SNS+SQS / EventBridge / Kafka

| Broker | What changes in this codebase | Cost shape | Best for |
|---|---|---|---|
| RabbitMQ (today) | — | Self-hosted (Docker) or Amazon MQ (~$70/mo provisioned) | Dev, modest scale, complex routing |
| Amazon MQ for RabbitMQ | Connection string only | Hourly EC2 (~$70/mo minimum) | Lift-and-shift to AWS without changing producer code |
| SNS + SQS | New `IIntegrationEventPublisher` impl using `AmazonSimpleNotificationServiceClient` | $0.40 / million msgs | AWS-native, serverless, idle-cost-zero |
| EventBridge | New `IIntegrationEventPublisher` impl using `AmazonEventBridgeClient` | $1.00 / million events | Multi-account event routing, schema registry |
| Kafka | New publisher + topic-per-event-type strategy + consumers track offsets | Operationally expensive but throughput-cheap | Event sourcing, replay, telemetry, > 100k events/s |

The outbox table, worker loop, retry logic, and `IMessageBus` API stay identical for every row in this table. That is the entire payoff of the `IIntegrationEventPublisher` abstraction.

## 6. Interview Q&A

### L1
- **What is a message queue? What is an exchange?** A queue is an ordered buffer that holds messages until a consumer takes them. An exchange (in AMQP / RabbitMQ terms) is the routing layer that decides which queue(s) a published message lands in based on the routing key. Producers publish to exchanges, not directly to queues.

### L2
- **Why can't you just publish after `SaveChanges`?** Because you have no transaction across Postgres and RabbitMQ. Either side can fail or be slow independently. The outbox pattern collapses the publish into a row insert in the same DB transaction so atomicity is preserved; a worker is responsible for moving the row to the broker, and that move is independently retryable.
- **What is a publisher confirm?** A broker-level ACK that a published message was accepted by the broker. Without it, `BasicPublish` is fire-and-forget and you can't tell whether the broker got the message. The C# client's `WaitForConfirmsOrDie` blocks until all outstanding publishes are confirmed and throws on NACK or timeout.

### L3
- **How do you handle the publish/DB-commit race?** Insert an outbox row in the same DB transaction as the entity write, then publish from a separate worker. The worker is allowed to publish, crash, and re-publish — the row stays until the broker confirms. Consumers must be idempotent (use `MessageId` as the dedup key).
- **What does at-least-once + idempotency mean in practice?** "At-least-once" means the broker may deliver a message more than once (network retries, worker restarts, redeliveries on consumer crash). The producer side guarantees at-least-once by retrying until the broker confirms. The consumer side must be idempotent: applying the same message twice produces the same end state. The simplest implementation is a `processed_messages` table keyed on `MessageId`.
- **When `FOR UPDATE SKIP LOCKED` vs PG `LISTEN/NOTIFY`?** `FOR UPDATE SKIP LOCKED` is poll-based but supports horizontal scaling (multiple workers partition the work via row locks). `LISTEN/NOTIFY` is push-based and lower latency but has a single-connection bottleneck and you still need polling as a fallback for missed notifies. Default to SKIP LOCKED; add LISTEN/NOTIFY only when you've measured polling latency as a problem.
- **Why dispatch domain events AFTER `base.SaveChangesAsync`?** Two reasons. First, EF assigns generated keys during save — handlers that reference `auditEntry.Id` need them to be populated. Second, "dispatch then save" lets handlers write their own `SaveChangesAsync` calls (re-entering the orchestrator), which produces undefined ordering and re-entrancy bugs. Dispatching after save means handlers stage entities into the ChangeTracker; the orchestrator's second save persists them in the same transaction.
- **Why shouldn't SignalR push happen inline in a handler?** Inline pushes happen before commit. If the outer transaction rolls back, the push has already left the building — clients see notifications about state that doesn't exist. The fix is `RegisterPostCommitAction` (`PortalDbContext.cs:60`) which queues the push to run only after `CommitAsync` succeeds. The catch block clears the queue on rollback so failed transactions never fire deferred side effects.

### Staff
- **How would you evolve this toward multi-region or multi-broker?** Two regions, each with its own Postgres + outbox + worker. Cross-region delivery is just another consumer on the producer-region broker that re-publishes to the consumer-region broker (or use SNS/EventBridge to do this natively). The outbox guarantees the producer-region commit; the consumer-region's own outbox guarantees idempotent reception. Be explicit about which events are "regionally local" and which are "globally replicated" — the routing-key namespace is the right place to encode that.
- **When would you switch to Kafka?** When you need replay (a new analytics consumer needs to reprocess a year of events), per-partition ordering at high volume (tens of thousands per second), or when the event log itself is a source of truth (event sourcing). RabbitMQ deletes after ack — once consumed, gone. Kafka retains, so a new consumer can start at offset zero. For tai-portal's use case (cross-app notifications, audit fan-out) RabbitMQ is correct.
- **Modular-monolith → microservices path without rewriting producers?** This is what the two-layer (`IMessageBus` outbox vs `IIntegrationEventPublisher` broker) split buys you. Producers always call `IMessageBus.PublishAsync(envelope)`; the message goes to `OutboxMessages` regardless of where the consumer lives. Today the consumer is an in-process MediatR handler (or doesn't exist yet); tomorrow it's a separate worker subscribing to RabbitMQ. The producer code does not change. The split point is where you draw the bounded-context line, not where you draw the process line.

## 7. What I Punted

Out of scope for Stage 1B (intentional, called out explicitly so reviewers and future-me can argue with the choices):

- **Consumer-side idempotency.** No `processed_messages` dedup table. Consumers must be idempotent on their own — for Stage 2, the `MessageId` (= `OutboxMessage.Id`) is the natural dedup key.
- **Dead-letter queue / max-retry.** Failed rows just keep retrying. Production would cap `RetryCount` and route to a DLQ table or RabbitMQ DLX after N failures.
- **Archival / compaction.** Processed rows accumulate forever. Production would archive `WHERE ProcessedAt < now() - interval '30 days'` to cold storage and `DELETE`.
- **Per-aggregate ordering.** No partition key on the producer side. Two events for the same user can be consumed in either order. RabbitMQ guarantees per-queue order, but with multiple workers and multiple consumer instances, that gets relaxed. Adding `OutboxMessage.PartitionKey` and routing same-key messages to the same queue is the standard solution.
- **Separate worker process.** `OutboxPublisherBackgroundService` runs in-process inside `portal-api`. The class is deliberately HTTP-coupling-free (see `RATIONALE` at `OutboxPublisherBackgroundService.cs:27-31`) so extracting it to a `.NET Worker` project is a cut-and-paste change.
- **AWS SNS/SQS swap.** The `IIntegrationEventPublisher` abstraction exists; the alternate implementation is straightforward and explicitly Stage-2 work.
- **Saga / process manager support.** No long-running, multi-step business processes. Each event is independent.

## 8. Cross-References

- `message-queues.md` §1.3 (outbox pattern survey), §2.1 (RabbitMQ broker)
- `design-patterns.md` (outbox section)
- `mediatr-cqrs.md` (in-process domain-event layer)
- `distributed-systems.md` (delivery semantics, idempotency)
- `efcore-sql.md` (Unit-of-Work, change tracker, transactions)
- `signalr-realtime.md` (post-commit deferral pattern)

---

*Last updated: 2026-04-21*
