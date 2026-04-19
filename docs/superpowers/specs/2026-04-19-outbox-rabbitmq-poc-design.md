# Design: Transactional Outbox + RabbitMQ for Integration Events (Stage 1B)

## Problem

`tai-portal` currently has two distinct event layers wired through `PortalDbContext`:

1. **Domain events** (in-process, via MediatR): raised by aggregates, collected from the `ChangeTracker` in `SaveChangesAsync`, dispatched synchronously to `INotificationHandler<DomainEventNotification<T>>` implementations (e.g., `PrivilegeChangeEventHandler`).
2. **Integration events** (cross-app, via `IMessageBus`): published explicitly from domain-event handlers for downstream consumption by other apps (DocViewer, HR system). Current implementation (`LoggingMessageBus`) is a stub that only writes to the app log — no broker, no delivery guarantee.

This setup has three correctness problems:

**(A) Dual-write hazard in handlers.** In `PrivilegeChangeEventHandler.Handle()`, the handler writes an `AuditEntry` to the database, then calls `_messageBus.PublishAsync(...)`. Today the publish is a no-op (logging), but as soon as the message bus becomes a real broker, this becomes a classic dual-write: the audit commits, then the broker call fails, and the downstream app never learns about the change. No transaction spans a database and a message broker.

**(B) Dispatch-before-save re-entrancy in `PortalDbContext.SaveChangesAsync`.** Domain events are dispatched (line 45) *before* `base.SaveChangesAsync()` (line 47). Handlers call `_dbContext.SaveChangesAsync()` recursively, which is what actually persists both the audit and the parent mutation. This works but is subtle and fragile. It is **not fixed by this design** — flagged as a known issue for future work.

**(C) No real cross-app delivery.** `LoggingMessageBus` has no broker. Integration events go nowhere.

This design addresses (A) and (C) by introducing the **Transactional Outbox Pattern** backed by RabbitMQ. (B) is documented as a pre-existing issue and deferred.

## Scope

**In scope (Stage 1B):**
- Add an `OutboxMessages` table to the primary PostgreSQL database.
- Replace `LoggingMessageBus` with `OutboxMessageBus` — writes to `OutboxMessages` inside the caller's transaction; does **not** call `SaveChangesAsync` itself.
- Reorder `_messageBus.PublishAsync(...)` calls in existing handlers to occur *before* `_dbContext.SaveChangesAsync(...)` so the outbox insert commits atomically with the audit write.
- Implement `OutboxPublisherBackgroundService` that polls the outbox and publishes to RabbitMQ via an `IIntegrationEventPublisher` abstraction.
- Implement `RabbitMqPublisher` (raw `RabbitMQ.Client`, not MassTransit — deliberately, for learning).
- Add RabbitMQ to `docker-compose.yml` with the management UI exposed.
- Integration tests against real PostgreSQL + real RabbitMQ via Testcontainers.
- Knowledge-base case-study document (`conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md` + mindmap).

**Out of scope (Stage 2 or later):**
- Consumers subscribing to RabbitMQ. No queue/binding declared by the producer. Stage 1B delivery is verified via the RabbitMQ management UI and a test-only queue binding.
- Migrating existing `INotificationHandler` handlers to become RabbitMQ consumers. Handlers stay in-process via MediatR.
- Fixing the dispatch-before-save re-entrancy in `PortalDbContext.SaveChangesAsync`.
- Dead-letter storage for poison messages. Stage 1B retries forever; punted.
- Outbox row archival / cleanup job.
- Per-aggregate message ordering.
- Extracting the worker to a separate .NET Worker project. Stage 1B keeps it in-process as a `BackgroundService`, with a design invariant that makes future extraction cheap.
- Swapping to AWS SNS/SQS or other brokers. Enabled by the `IIntegrationEventPublisher` abstraction but not implemented.

## Architecture

### Two Event Layers (unchanged from current codebase)

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: DOMAIN EVENTS (in-process, via MediatR)            │
│  - Raised by aggregates: entity.RaiseDomainEvent(...)        │
│  - Collected from ChangeTracker in SaveChangesAsync          │
│  - Dispatched synchronously by DispatchDomainEventsAsync     │
│  - Consumed by INotificationHandler<DomainEventNotification> │
│  - Example: PrivilegeChangeEventHandler                      │
│  - UNCHANGED by this design                                  │
└──────────────────────────────────────────────────────────────┘
                          │
                          │  Inside each handler, after in-process
                          │  work (audit log, SignalR, etc.), the
                          │  handler explicitly publishes an
                          │  integration event for cross-app delivery
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2: INTEGRATION EVENTS (cross-app, via IMessageBus)    │
│  - Explicitly published: await _messageBus.PublishAsync(...) │
│  - Current impl: LoggingMessageBus (stub — logs only)        │
│  - New impl: OutboxMessageBus — writes to OutboxMessages     │
│  - Worker polls table, publishes via IIntegrationEventPubl.  │
│  - Stage 1B impl: RabbitMqPublisher (raw RabbitMQ.Client)    │
└──────────────────────────────────────────────────────────────┘
```

### Write-Path Flow

```
[HTTP request]
    ↓
[Controller / Application service]
    ↓ mutates aggregate, entity.RaiseDomainEvent(...)
    ↓
PortalDbContext.SaveChangesAsync(ct)
    ├─ PopulateAuditFields()
    ├─ DispatchDomainEventsAsync(ct)                    ◄── MediatR (unchanged)
    │   └─ PrivilegeChangeEventHandler.Handle(...)
    │       ├─ _dbContext.AuditLogs.Add(auditEntry)
    │       ├─ await _messageBus.PublishAsync(...)       ◄── REORDERED: now BEFORE save
    │       │   └─ OutboxMessageBus.PublishAsync
    │       │       └─ _dbContext.OutboxMessages.Add(...)
    │       ├─ await _dbContext.SaveChangesAsync(ct)     ◄── commits audit + outbox atomically
    │       └─ await _realTimeNotifier.SendSecurityEventAsync(...)  (SignalR after commit)
    └─ base.SaveChangesAsync(ct)                          (already committed via nested save — pre-existing re-entrancy)
```

### Publish-Path Flow (asynchronous, runs in a separate task)

```
[OutboxPublisherBackgroundService: polling loop, every N seconds when idle]
    ↓
CreateAsyncScope → resolve scoped PortalDbContext
    ↓
BEGIN TRANSACTION
    ↓
SELECT * FROM "OutboxMessages"
WHERE "ProcessedAt" IS NULL
ORDER BY "OccurredAt"
LIMIT 50
FOR UPDATE SKIP LOCKED
    ↓
for each row:
    ├─ IIntegrationEventPublisher.PublishAsync(msg, ct)
    │   └─ RabbitMqPublisher: basic.publish + WaitForConfirmsOrDie
    ├─ on success: row.ProcessedAt = now(); row.Error = null
    └─ on failure: row.RetryCount++; row.Error = ex.Message; (ProcessedAt stays null)
    ↓
SaveChangesAsync → COMMIT
    ↓
if batch was full: loop immediately (drain backlog)
if batch was empty or partial: Task.Delay(pollInterval)
```

### Deployment Topology

**Stage 1B (POC):**

```
┌─────────────────────────────────────────┐
│  portal-api (ASP.NET Core host)         │
│  ├─ HTTP request pipeline (controllers) │
│  ├─ SignalR hub                         │
│  └─ OutboxPublisherBackgroundService    │  ◄── BackgroundService, same process
│     (IHostedService, same process)      │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    PostgreSQL            RabbitMQ
```

**Production (Stage 2+, out of scope):**

```
┌─────────────────────────┐   ┌──────────────────────────────┐
│  portal-api             │   │  portal-outbox-worker        │
│  (HTTP + SignalR only)  │   │  (worker host, no HTTP)      │
│  scales on request QPS  │   │  scales on outbox depth      │
│  N replicas             │   │  M replicas                  │
└─────────────────────────┘   └──────────────────────────────┘
         └────────────┬──────────────────┘
                      ▼
                 PostgreSQL  ←  both reference the outbox table
                      │
                      └──► RabbitMQ (worker publishes)
```

### Design Invariants

These are explicit constraints enforced by this design. Violations should fail code review.

1. **`OutboxMessageBus.PublishAsync` must not call `SaveChangesAsync`.** Only `DbSet.Add`. The caller's transaction is responsible for the commit.
2. **`OutboxPublisherBackgroundService`, `RabbitMqPublisher`, and all their dependencies must not reference HTTP-specific services** (`IHttpContextAccessor`, `HttpContext`, controller-specific types, middleware). This keeps future extraction to a standalone worker project a cut-and-paste operation.
3. **Handlers must call `_messageBus.PublishAsync(...)` before `_dbContext.SaveChangesAsync(...)`.** Otherwise the outbox insert is not part of the same transaction as the audit write.
4. **Serialize the integration event payload with its concrete runtime type**, not the generic parameter `T`, to avoid losing properties when `T` is `object` or an interface.

## Data Model

### OutboxMessage Entity

Location: `libs/core/infrastructure/Persistence/Entities/OutboxMessage.cs` (infrastructure concern, not a domain concept).

```csharp
public class OutboxMessage {
  public Guid Id { get; set; }                       // PK; used as RabbitMQ MessageId for consumer dedup
  public string EventType { get; set; } = null!;     // Fully-qualified CLR type name; stable across restarts
  public string Payload { get; set; } = null!;       // JSONB: serialized integration event
  public DateTimeOffset OccurredAt { get; set; }     // Set when added to DbSet, inside the originating transaction
  public DateTimeOffset? ProcessedAt { get; set; }   // Null = unprocessed; set after broker publisher confirm
  public int RetryCount { get; set; }                // Incremented on each publish failure
  public string? Error { get; set; }                 // Last error message; null after a successful attempt
  public string? CorrelationId { get; set; }         // Optional: ties back to originating request/user action
}
```

### EF Core Configuration

In `PortalDbContext.OnModelCreating`:

```csharp
builder.Entity<OutboxMessage>(b => {
  b.HasKey(m => m.Id);
  b.Property(m => m.EventType).IsRequired().HasMaxLength(512);
  b.Property(m => m.Payload).HasColumnType("jsonb").IsRequired();
  b.Property(m => m.OccurredAt).IsRequired();
  b.Property(m => m.Error).HasMaxLength(2000);

  // JUNIOR RATIONALE (Partial Index):
  // The publisher worker ONLY queries unprocessed rows (ProcessedAt IS NULL).
  // A partial index is ~99% smaller than a full index on a table that is
  // mostly processed history. Fast lookup on hot rows, tiny write overhead
  // since the index only updates when ProcessedAt transitions null -> timestamp.
  b.HasIndex(m => m.OccurredAt)
   .HasFilter("\"ProcessedAt\" IS NULL")
   .HasDatabaseName("IX_OutboxMessages_Unprocessed");
});
```

Migration: `dotnet ef migrations add AddOutboxMessages` — standard Add-Migration flow, table lives in the primary `portal` database (same transaction scope as existing writes is the whole point).

### Field Rationale

- **`Id` as `Guid`**, not identity int: stable across database recovery and dump/restore; usable as RabbitMQ `MessageId` so consumers in Stage 2 can dedup on it.
- **`EventType` as string**, not an enum: events evolve; strings don't require a migration when a new event type is introduced.
- **`Payload` as JSONB**, not TEXT: queryable in Postgres (`payload->>'userId' = '...'` for ops), validated as JSON at write time, compact on disk.
- **`RetryCount` and `Error` present from day one**: cheap in storage, enables honest retry behavior in Stage 1B and gives a foundation for a dead-letter column in Stage 2. An interviewer will ask "what happens on failure" — having the fields already in place is better than handwaving.

## Implementation Details

### 1. `OutboxMessageBus` — replaces `LoggingMessageBus`

Location: `libs/core/infrastructure/Messaging/OutboxMessageBus.cs`.

```csharp
public class OutboxMessageBus : IMessageBus {
  private static readonly JsonSerializerOptions _serializerOptions = new() {
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
  };

  private readonly PortalDbContext _dbContext;
  private readonly ICurrentUserService _currentUserService;

  public OutboxMessageBus(PortalDbContext dbContext, ICurrentUserService currentUserService) {
    _dbContext = dbContext;
    _currentUserService = currentUserService;
  }

  public Task PublishAsync<T>(T message, CancellationToken ct = default) where T : class {
    // JUNIOR RATIONALE (Transactional outbox — the key insight):
    // We do NOT call SaveChangesAsync here. We only Add the outbox row to the
    // ChangeTracker. The caller's surrounding SaveChangesAsync is what commits
    // it — atomically with the caller's other writes (audit entry, domain
    // entity mutation, etc.). This is the entire transactional guarantee of
    // the pattern: all DB work and the "message to be sent" commit together
    // or not at all.

    // JUNIOR RATIONALE (Concrete runtime type for serialization):
    // message.GetType() returns the concrete runtime type. Passing typeof(T)
    // when T is object or an interface loses all properties declared on the
    // concrete type — classic System.Text.Json gotcha.
    var runtimeType = message.GetType();

    _dbContext.OutboxMessages.Add(new OutboxMessage {
      Id = Guid.NewGuid(),
      EventType = runtimeType.AssemblyQualifiedName ?? runtimeType.FullName ?? runtimeType.Name,
      Payload = JsonSerializer.Serialize(message, runtimeType, _serializerOptions),
      OccurredAt = DateTimeOffset.UtcNow,
      CorrelationId = _currentUserService.CorrelationId,
    });

    return Task.CompletedTask;
  }
}
```

DI change in `Program.cs`: remove `services.AddScoped<IMessageBus, LoggingMessageBus>()`; add `services.AddScoped<IMessageBus, OutboxMessageBus>()`. `LoggingMessageBus` can be deleted.

### 2. Handler Reorder (per existing handler)

Five handlers currently call `_messageBus.PublishAsync(...)`:
- `PrivilegeChangeEventHandler`
- `PrivilegeModifiedEventHandler`
- `SecuritySettingChangeEventHandler`
- `LoginAnomalyEventHandler`
- `UserApprovedEventHandler`

Each handler gets the same small change: move the `_messageBus.PublishAsync(...)` call to occur **before** `_dbContext.SaveChangesAsync(...)`. Example diff for `PrivilegeChangeEventHandler` (lines 49-76):

```diff
  _dbContext.AuditLogs.Add(auditEntry);
- await _dbContext.SaveChangesAsync(cancellationToken);
-
- await _realTimeNotifier.SendSecurityEventAsync(..., cancellationToken);
-
- await _messageBus.PublishAsync(new { ... }, cancellationToken);
+ await _messageBus.PublishAsync(new { ... }, cancellationToken);
+
+ await _dbContext.SaveChangesAsync(cancellationToken);  // commits audit + outbox atomically
+
+ await _realTimeNotifier.SendSecurityEventAsync(..., cancellationToken);
```

SignalR notification stays *after* the commit: we only want to push a real-time notification if the DB work actually persisted. Pushing before commit introduces a notification-for-a-change-that-didn't-happen bug — the same class of bug this whole design exists to fix.

### 3. `IIntegrationEventPublisher` Abstraction

Location: `libs/core/application/Interfaces/IIntegrationEventPublisher.cs`.

```csharp
public interface IIntegrationEventPublisher {
  Task PublishAsync(OutboxMessage message, CancellationToken cancellationToken);
}
```

This is the **broker swap point**. Stage 1B provides `RabbitMqPublisher`. Future: `SnsPublisher`, `EventBridgePublisher`, `AmazonMqPublisher` — each is a new class and a DI registration change; everything else in the pipeline is unchanged.

### 4. `RabbitMqPublisher` — raw `RabbitMQ.Client`

Location: `libs/core/infrastructure/Messaging/RabbitMqPublisher.cs`.

Responsibilities:
- Hold a reference to a singleton `IConnection` (injected via `IRabbitMqConnectionProvider`).
- Create a channel (`IModel`) per publish call, or reuse a thread-local channel — document the choice in code comments. Stage 1B uses one channel per publish for simplicity; comment notes production would pool channels.
- Declare the target exchange (`portal.events`, topic, durable) once at startup via `IHostedService` or first-publish lazy init.
- Set `ConfirmSelect()` on the channel (enables publisher confirms).
- Build `IBasicProperties` with `MessageId`, `ContentType = application/json`, `Type`, `Timestamp`, `CorrelationId`, `DeliveryMode = 2` (persistent).
- `basic.publish` with routing key derived from the `EventType` (see routing convention below).
- `WaitForConfirmsOrDie(TimeSpan)` — synchronous confirm wait; throws on broker NACK or timeout.

**Routing key convention:** `{bounded-context}.{event-name}`, lowercase, dot-separated. Derived from the last segment of the `EventType` CLR type name via a simple mapping (documented inline). Examples:

| `EventType` (CLR) | Routing key |
|---|---|
| `Tai.Portal.Core.Domain.Events.PrivilegeChangeEvent` | `security.privilege-changed` |
| `Tai.Portal.Core.Domain.Events.UserApprovedEvent` | `security.user-approved` |
| `Tai.Portal.Core.Domain.Events.LoginAnomalyEvent` | `security.login-anomaly` |

**Connection management:** `IRabbitMqConnectionProvider` holds one `IConnection` per app instance, created with:
- `AutomaticRecoveryEnabled = true` (library handles reconnection on broker restart)
- `TopologyRecoveryEnabled = true` (re-declares exchanges after recovery)
- `NetworkRecoveryInterval = TimeSpan.FromSeconds(5)`

### 5. `OutboxPublisherBackgroundService`

Location: `libs/core/infrastructure/Messaging/OutboxPublisherBackgroundService.cs`.

```csharp
public class OutboxPublisherBackgroundService : BackgroundService {
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly IIntegrationEventPublisher _publisher;
  private readonly ILogger<OutboxPublisherBackgroundService> _logger;
  private readonly OutboxOptions _options;

  protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
    while (!stoppingToken.IsCancellationRequested) {
      try {
        var processed = await ProcessBatchAsync(stoppingToken);
        if (processed == 0) {
          await Task.Delay(_options.PollInterval, stoppingToken);
        }
        // If we processed a full batch, loop immediately to drain any backlog.
      }
      catch (OperationCanceledException) { break; }
      catch (Exception ex) {
        _logger.LogError(ex, "Outbox publisher loop error");
        await Task.Delay(_options.ErrorBackoff, stoppingToken);
      }
    }
  }

  private async Task<int> ProcessBatchAsync(CancellationToken ct) {
    await using var scope = _scopeFactory.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    await using var tx = await db.Database.BeginTransactionAsync(ct);

    // JUNIOR RATIONALE (SELECT FOR UPDATE SKIP LOCKED):
    // Multiple publisher instances (app replicas, or future extracted workers)
    // can run this loop simultaneously. Without row locking, two workers grab
    // the same row and publish it twice. Without SKIP LOCKED, worker B BLOCKS
    // on worker A's lock until A commits — throughput collapses to single-
    // threaded. SKIP LOCKED tells Postgres: "if someone else has it, skip it
    // and give me the next row." This is THE standard PostgreSQL pattern for
    // work-queue consumption (same mechanism pgmq and pg_cron's job runner
    // use). Postgres is the coordinator — no Redis, no leader election.
    var batch = await db.OutboxMessages
      .FromSqlRaw(@"
        SELECT * FROM ""OutboxMessages""
        WHERE ""ProcessedAt"" IS NULL
        ORDER BY ""OccurredAt""
        LIMIT {0}
        FOR UPDATE SKIP LOCKED", _options.BatchSize)
      .ToListAsync(ct);

    if (batch.Count == 0) { await tx.CommitAsync(ct); return 0; }

    foreach (var msg in batch) {
      try {
        await _publisher.PublishAsync(msg, ct);
        msg.ProcessedAt = DateTimeOffset.UtcNow;
        msg.Error = null;
      }
      catch (Exception ex) {
        msg.RetryCount++;
        msg.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
        // ProcessedAt stays null → will be retried on next poll.
      }
    }

    await db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);
    return batch.Count;
  }
}
```

**Options (via `IOptions<OutboxOptions>`):**
- `PollInterval`: default 2 seconds.
- `BatchSize`: default 50.
- `ErrorBackoff`: default 10 seconds.

### 6. Docker Compose

Add to `docker-compose.yml`:

```yaml
services:
  # ... existing postgres service ...

  rabbitmq:
    image: rabbitmq:3-management
    container_name: portal-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: portal
      RABBITMQ_DEFAULT_PASS: portal
    ports:
      - "5672:5672"        # AMQP
      - "15672:15672"      # Management UI — http://localhost:15672, portal/portal
    volumes:
      - portal-rabbitmq:/var/lib/rabbitmq

volumes:
  portal-data:
  portal-rabbitmq:
```

## Failure Modes

| Failure mode | Stage 1B behavior | Stage 2+ / Punted |
|---|---|---|
| Handler throws → outbox insert never happens | Transaction rolls back with the domain write. **Handled.** | |
| App crashes between `SaveChangesAsync` and worker publishing | Outbox row still `ProcessedAt IS NULL` → worker picks up on restart. **Handled (at-least-once).** | |
| RabbitMQ broker down | Publish throws → `RetryCount++`, `Error` set, row stays unprocessed. Next poll retries. **Handled.** | |
| RabbitMQ slow → publish timeout | Same path as above. **Handled.** | |
| Worker publishes, broker confirms, app crashes *before* DB marks `ProcessedAt` | Row is re-published on next poll → **duplicate delivered to consumers.** | Consumer idempotency (Stage 2) |
| Poison message (unserializable / routing failure) | `RetryCount` grows unbounded; row retried forever. | Dead-letter column (Stage 2): row moved to `OutboxDeadLetters` after N retries. |
| Two worker instances running simultaneously | `FOR UPDATE SKIP LOCKED` ensures each row is handled by exactly one worker. **Handled.** Enables horizontal scaling. | |
| Message ordering | Best-effort via `ORDER BY OccurredAt` on fetch. Concurrent workers do not guarantee ordering across aggregates. | Per-aggregate ordering (Stage 2): partition by aggregate ID, dedicated worker per partition. |
| Outbox table grows unbounded | No cleanup in Stage 1B. | Archival job (Stage 2): cron deletes `ProcessedAt < now() - 30 days`. |
| SignalR push fails (handler line 54) | Exception bubbles → parent transaction rolls back → outbox insert also rolls back. | **Pre-existing bug.** Domain mutation lost because a notification failed. Document as a known issue; not introduced by this design. |

**Canonical interview probe:** the "app crashes between publish and mark-processed" row — the unavoidable duplicate-delivery window. RabbitMQ has no 2PC with a database. Consumer idempotency is the only real answer. This is the single most important conceptual point in the whole project.

## Testing Strategy

### Unit Tests — `OutboxMessageBus`

- `PublishAsync` adds an `OutboxMessage` to the ChangeTracker with correct `EventType`, `Payload`, `OccurredAt`, and (if available) `CorrelationId`.
- `PublishAsync` does **not** call `SaveChangesAsync` (regression guard for the key design invariant).
- `PublishAsync` serializes the concrete runtime type, not the generic parameter `T` — regression guard against the classic System.Text.Json gotcha. Test writes a concrete subtype via `IMessageBus.PublishAsync<object>(...)` and asserts the payload includes subtype properties.

### Integration Tests — Testcontainers (real PostgreSQL + real RabbitMQ)

- Seed an `OutboxMessage`, start the worker, assert the message lands in a test-bound queue within a timeout.
- Seed 100 messages with two worker instances running in the same process; assert each message is processed exactly once (`SKIP LOCKED` coordination test).
- Break the RabbitMQ container mid-test, seed a message, restart the broker; assert eventual delivery and `RetryCount > 0`.
- End-to-end: POST to a controller that triggers `PrivilegeChangeEvent`; assert both the audit row written **and** the corresponding message arrives on the test queue.

### Explain-it Test (the knowledge-base doc)

Every row in the Failure Modes table above becomes an L2/L3 interview question. Writing the answers **in your own words** in `rabbitmq-outbox-case-study.md` is the final test — if you cannot explain a row, that row is not understood.

### Explicitly Not Tested in Stage 1B

- Consumer-side idempotency (no consumer exists yet).
- Poison-message dead-letter handling (punted to Stage 2).
- Cross-aggregate ordering (known limitation).

## Knowledge-Base Deliverable

New file: `conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md` (+ `-mindmap.md` companion), matching the established NgRx / message-queues knowledge-base format.

### Frontmatter

```yaml
---
title: RabbitMQ + Transactional Outbox — Case Study (tai-portal)
difficulty: L2 | L3 | Staff
lastUpdated: 2026-04-19
relatedTopics:
  - Message-Queues (survey)
  - Design-Patterns
  - Distributed-Systems
  - EFCore-SQL
  - MediatR-CQRS
stack: backend
---
```

### Outline

1. **TL;DR**
2. **The Problem** (the dual-write hazard, in this codebase specifically)
   - 2.1 Before: `IMessageBus` stub, integration events logged but not delivered.
   - 2.2 The hazard: audit committed + message lost = downstream inconsistency.
3. **Architecture**
   - 3.1 Two event layers: domain (MediatR) vs integration (outbox → RabbitMQ).
   - 3.2 Why this separation matters for modular-monolith evolution.
4. **Implementation Deep Dive**
   - 4.1 `OutboxMessage` entity — fields, JSONB, partial-index rationale.
   - 4.2 `OutboxMessageBus` — why it doesn't `SaveChanges` itself.
   - 4.3 Publisher worker — polling, `SELECT FOR UPDATE SKIP LOCKED`, publisher confirms.
   - 4.4 RabbitMQ primitives actually used — topic exchange, routing keys, channels, `IConnection` lifecycle.
5. **Failure Modes** (the table from this design, expanded into prose per row).
6. **Comparison Tables**
   - 6.1 Outbox vs direct publish (the dual-write table).
   - 6.2 Raw `RabbitMQ.Client` vs MassTransit (line-for-line translation).
   - 6.3 Polling vs PG `LISTEN/NOTIFY` vs CDC (Debezium).
   - 6.4 Sync vs async batch publisher confirms.
   - 6.5 Broker swap matrix: RabbitMQ / Amazon MQ / SNS+SQS / EventBridge / Kafka — what changes, what doesn't.
7. **Interview Q&A**
   - 7.1 L1: What is a message queue? What is an exchange?
   - 7.2 L2: Why can't you just publish after `SaveChanges`? What is a publisher confirm?
   - 7.3 L3: How do you handle the publish/DB-commit race? What does at-least-once + idempotency mean in practice? When would you use `FOR UPDATE SKIP LOCKED` vs PG `LISTEN/NOTIFY`?
   - 7.4 Staff: How would you evolve this toward multi-region or multi-broker? When would you switch to Kafka? How does this support a modular-monolith → microservices path without rewriting the producer?
8. **What I Punted** (honest scope statement — Stage 2 work list from the Out-of-Scope section of this design).
9. **Cross-References** — back to `message-queues.md` §1.3 (outbox) and §2.1 (RabbitMQ), `design-patterns.md` outbox section, `mediatr-cqrs.md` for the in-process event layer, `distributed-systems.md` for delivery-semantics context.

### Cross-Links in Existing Knowledge Base

Add one sentence each in `message-queues.md` §1.3 and §2.1 pointing to the new case-study doc: *"See `rabbitmq-outbox-case-study.md` for a hands-on walkthrough grounded in this codebase."*

## Summary of Deliverables

**Code:**
1. `OutboxMessage` entity + EF configuration + migration (`AddOutboxMessages`).
2. `OutboxMessageBus` class (replaces `LoggingMessageBus` in DI).
3. `IIntegrationEventPublisher` interface.
4. `IRabbitMqConnectionProvider` + `RabbitMqConnectionProvider` (singleton `IConnection`).
5. `RabbitMqPublisher` class (implements `IIntegrationEventPublisher`).
6. `OutboxPublisherBackgroundService` (`IHostedService` registered in `Program.cs`).
7. `OutboxOptions` + configuration binding.
8. Handler reorder for five existing handlers (`PrivilegeChangeEventHandler`, `PrivilegeModifiedEventHandler`, `SecuritySettingChangeEventHandler`, `LoginAnomalyEventHandler`, `UserApprovedEventHandler`): move `_messageBus.PublishAsync(...)` before `_dbContext.SaveChangesAsync(...)`.
9. `docker-compose.yml` — add RabbitMQ service with management UI.
10. DI registration changes in `Program.cs` (remove `LoggingMessageBus`, add `OutboxMessageBus`, `IRabbitMqConnectionProvider`, `RabbitMqPublisher`, hosted service).
11. Unit tests for `OutboxMessageBus`.
12. Integration tests (Testcontainers: PostgreSQL + RabbitMQ).

**Knowledge base:**

13. `conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md`.
14. `conductor/knowledge-base/reference/rabbitmq-outbox-case-study-mindmap.md`.
15. Cross-reference edits in `conductor/knowledge-base/reference/message-queues.md` §1.3 and §2.1.

**Cleanup:**

16. Delete `libs/core/infrastructure/Services/LoggingMessageBus.cs`.

## Success Criteria

1. A POST to an endpoint that mutates a privilege results in:
   - An `AuditEntry` row written.
   - An `OutboxMessage` row written with the integration-event payload, `ProcessedAt IS NULL` at first.
   - Within `PollInterval + 1s`, `ProcessedAt` set on that row.
   - A message visible in the RabbitMQ management UI on the `portal.events` exchange with the correct routing key.
2. Stopping RabbitMQ and repeating the POST results in an `OutboxMessage` row with `RetryCount > 0`; restarting RabbitMQ results in eventual delivery.
3. Running two worker instances simultaneously against a seeded backlog of 100 messages results in exactly 100 successful deliveries (no duplicates within the stopping conditions: no mid-flight crashes during the test).
4. All integration tests pass on CI with Testcontainers.
5. The knowledge-base case-study doc exists and cross-links from `message-queues.md` §1.3 and §2.1 are added.
6. `LoggingMessageBus` is removed from the codebase.

## Estimated Effort

~1.5 days with Claude Code + active-learning workflow (writing the knowledge-base doc section-by-section as each implementation section is completed).

## References

- `conductor/tracks/outbox_pattern_rabbitmq_20260406/spec.md` — original track spec.
- `conductor/knowledge-base/reference/message-queues.md` — existing survey doc; this design extends it with a hands-on case study.
- `libs/core/infrastructure/Persistence/PortalDbContext.cs` — existing domain-event dispatch (lines 40-94).
- `libs/core/infrastructure/Persistence/Handlers/PrivilegeChangeEventHandler.cs` — reference handler showing the two-layer event flow.
- `libs/core/application/Interfaces/IMessageBus.cs` — the interface whose implementation is being swapped.
- `libs/core/infrastructure/Services/LoggingMessageBus.cs` — stub being removed.
