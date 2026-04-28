---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **RabbitMQ + Transactional Outbox (tai-portal)**

## **1. The Problem**

### **1.1 The `IMessageBus` stub**
1. Pre-Stage-1B `LoggingMessageBus` just logged
   - Interface in place, no actual broker
   - Zero cross-app delivery, invisible until needed

### **1.2 Dual-write hazard**
1. "Save then publish" without coordination
   - DB commits, broker fails → lost message
   - Broker commits, DB rollback → phantom event
   - Crash between → indeterminate, can't safely retry
2. Outbox solution: collapse publish into a row insert
   - Same DB transaction as the entity write
   - Worker moves the row to broker independently

### **1.3 Dispatch-before-save re-entrancy**
1. Old `SaveChangesAsync` dispatched BEFORE `base.SaveChangesAsync`
   - Handlers called `_dbContext.SaveChangesAsync` themselves
   - Re-entered orchestrator, re-dispatched, re-saved
2. Inline SignalR push fired before commit
   - Outer rollback → ghost notification
3. Same root cause as dual-write: no save/commit boundary

## **2. Architecture**

### **2.1 Two event layers**
1. Domain events (in-process, MediatR)
   - `IHasDomainEvents` on aggregates
   - `DispatchDomainEventsAsync` wraps each in `DomainEventNotification<T>`
   - Same thread, same transaction, NOT durable
2. Integration events (cross-app, outbox + RabbitMQ)
   - `IMessageBus.PublishAsync` stages an `OutboxMessage`
   - Worker drains to broker
   - Durable, eventually delivered

### **2.2 Why the split matters**
1. Producer code never changes when consumer moves out-of-process
   - Modular monolith → microservices is a deployment change
2. Two abstraction swap points
   - `IMessageBus` = outbox write point (broker-agnostic)
   - `IIntegrationEventPublisher` = broker write point

## **3. Components**

### **3.1 PortalDbContext as Unit-of-Work**
1. 8-step `SaveChangesAsync` orchestration
   - PopulateAuditFields → first save → dispatch domain events
   - → conditional second save → commit → post-commit actions
2. Pre-flight rejects post-commit actions in caller-managed tx
3. In-memory provider escape hatch (no transaction wrap)
4. `_postCommitActions` cleared on rollback (no ghost side-effects)
5. `RegisterPostCommitAction` API for SignalR / outbound calls
6. Static guard: `HandlerInvariantTests` fails build if a handler calls `SaveChangesAsync`

### **3.2 OutboxMessage entity**
1. Lives under Infrastructure (plumbing, not domain)
2. `Id` is `Guid` — stable, also the RabbitMQ `MessageId`
3. `Payload` is `jsonb` — validated + queryable in PG
4. Partial index on `OccurredAt` `WHERE "ProcessedAt" IS NULL`
   - ~99% smaller than full index
   - Index entry deleted when row marked processed

### **3.3 OutboxMessageBus**
1. Does NOT call `SaveChangesAsync` — caller's save commits
2. `message.GetType()` for serialization (avoid `typeof(T)` gotcha)
   - Anonymous types declared as `object` → `typeof(T)` drops all properties
3. Adds `OutboxMessage` to ChangeTracker; that's it

### **3.4 OutboxPublisherBackgroundService**
1. `BackgroundService` singleton + `IServiceScopeFactory`
   - `CreateAsyncScope` per iteration → fresh scoped DbContext
2. `SELECT FOR UPDATE SKIP LOCKED`
   - Multiple replicas safe; PG is the coordinator
   - No leader election, no Redis
3. Loop pacing: poll-interval on idle, immediate on full batch
4. Per-message try/catch — one bad row doesn't poison batch
5. Process-isolation invariant: zero HTTP coupling
   - Future extraction to `.NET Worker` is cut-and-paste

### **3.5 RabbitMqPublisher**
1. Raw `RabbitMQ.Client` (not MassTransit) — for the primitives
2. `IConnection` singleton, `IModel` per publish
3. Topic exchange, durable, delivery-mode-2 messages
4. `ConfirmSelect` + `WaitForConfirmsOrDie`
   - Without confirms, `BasicPublish` is fire-and-forget
5. `AutomaticRecoveryEnabled` + `TopologyRecoveryEnabled`
6. Routing key derivation: `PrivilegeChangeEvent` → `security.privilege-change`

## **4. Failure Modes**

### **4.1 Producer-side**
1. DB commit fails → tx rolls back; outbox + audit + SignalR all undone
2. Broker down → row stays unprocessed, `RetryCount++`, `Error` stamped
3. Broker NACK → same retry path; alert on `RetryCount > N`
4. Worker crash mid-batch → PG releases locks; next iteration drains

### **4.2 Consumer-side (Stage 2 concern)**
1. Duplicate delivery → at-least-once; consumer must be idempotent
2. `MessageId` (= `OutboxMessage.Id`) is the dedup key
3. Out-of-order delivery → no per-aggregate partition key in Stage 1B

### **4.3 Post-commit**
1. SignalR push fails after commit
   - Logged, not re-thrown
   - Better missed notification than rolled-back save

## **5. Comparisons**

### **5.1 Outbox vs direct publish**
1. Direct: silent inconsistency on broker failure
2. Outbox: row durable; worker retries; observable via `WHERE ProcessedAt IS NULL`

### **5.2 Raw client vs MassTransit**
1. Raw: teaches primitives, more code
2. MT: features (retry, scheduling, sagas), less ceremony, broker-agnostic config

### **5.3 Polling vs LISTEN/NOTIFY vs CDC**
1. Polling: simplest; default until measured otherwise
2. LISTEN/NOTIFY: low latency, single-connection bottleneck, needs polling fallback
3. CDC (Debezium / DMS): high throughput, ops-heavy, when you're already on Kafka

### **5.4 Sync vs async batch confirms**
1. Sync: ~1k msg/s, simple
2. Async batch: 10-100×, must reconcile NACK to specific message

### **5.5 Broker swap matrix**
1. RabbitMQ (today) → Amazon MQ (zero code) → SNS+SQS (serverless, $0.40/M) → EventBridge → Kafka
2. Outbox table + worker + `IMessageBus` stay identical for every swap

## **6. Interview Talking Points**

### **6.1 L1**
1. Queue vs exchange — exchanges route, queues hold
2. Pub/sub vs queue — fan-out vs competing consumers

### **6.2 L2**
1. Why outbox: dual-write hazard
2. Publisher confirms: broker-level ACK; without it, fire-and-forget
3. Two transaction guarantees: producer (outbox+entity atomic), consumer (idempotent processing)

### **6.3 L3**
1. `FOR UPDATE SKIP LOCKED` — horizontal scaling, PG as coordinator
2. Domain events AFTER `base.SaveChangesAsync` — keys assigned, no re-entrancy
3. Post-commit actions — never fire on rollback
4. At-least-once + idempotency — producer guarantees once-or-more, consumer dedupes

### **6.4 Staff**
1. Modular-monolith → microservices via the `IMessageBus`/`IIntegrationEventPublisher` split
2. RabbitMQ vs Kafka selection — replay needed?
3. Multi-region: per-region outbox + cross-region bridge consumer
4. What was punted in Stage 1B: DLQ, archival, partition key, separate worker process
