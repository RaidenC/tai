# Design: Transactional Outbox + RabbitMQ for Integration Events (Stage 1B)

## Problem

`tai-portal` currently has two distinct event layers wired through `PortalDbContext`:

1. **Domain events** (in-process, via MediatR): raised by aggregates, collected from the `ChangeTracker` in `SaveChangesAsync`, dispatched synchronously to `INotificationHandler<DomainEventNotification<T>>` implementations (e.g., `PrivilegeChangeEventHandler`).
2. **Integration events** (cross-app, via `IMessageBus`): published explicitly from domain-event handlers for downstream consumption by other apps (DocViewer, HR system). Current implementation (`LoggingMessageBus`) is a stub that only writes to the app log — no broker, no delivery guarantee.

This setup has three correctness problems:

**(A) Dual-write hazard in handlers.** In `PrivilegeChangeEventHandler.Handle()`, the handler writes an `AuditEntry` to the database, then calls `_messageBus.PublishAsync(...)`. Today the publish is a no-op (logging), but as soon as the message bus becomes a real broker, this becomes a classic dual-write: the audit commits, then the broker call fails, and the downstream app never learns about the change. No transaction spans a database and a message broker.

**(B) Dispatch-before-save re-entrancy in `PortalDbContext.SaveChangesAsync`.** Domain events are dispatched (line 45) *before* `base.SaveChangesAsync()` (line 47). Handlers call `_dbContext.SaveChangesAsync()` recursively, which is what actually persists both the audit and the parent mutation. Three concrete problems:
- **Wrong semantics.** Domain events mean *"this happened."* Firing them before save means *"this is about to happen, assuming save succeeds."* The event name lies.
- **Hidden save.** A handler's `_dbContext.SaveChangesAsync()` call looks local but commits everything in the ChangeTracker — the aggregate, the audit, and (with the outbox) the outbox row too. Readers think the line saves the audit; it actually saves everything.
- **Handler ordering coupling.** If two handlers fire, the first handler's nested save commits work the second handler hasn't done yet. Handlers become order-dependent in ways nobody can see.

**(C) No real cross-app delivery.** `LoggingMessageBus` has no broker. Integration events go nowhere.

**Problems (A) and (B) share a root cause:** `PortalDbContext` is not orchestrating its own unit of work — it delegates the transaction boundary to whichever handler happens to call `SaveChangesAsync` first. This design fixes **both** with a single **Unit-of-Work pattern** — save → dispatch → save → commit → post-commit actions — and addresses (C) by introducing the **Transactional Outbox Pattern** backed by RabbitMQ.

## Scope

**In scope (Stage 1B):**
- Refactor `PortalDbContext.SaveChangesAsync` to a **Unit-of-Work pattern**: collect events from ChangeTracker → `base.SaveChangesAsync()` → dispatch events → `base.SaveChangesAsync()` again (flush handler-added entries) → commit → fire post-commit actions. Handlers stop calling `SaveChangesAsync` themselves.
- Add a post-commit action registry on `PortalDbContext` so side effects like SignalR pushes fire only after successful commit (and are discarded on rollback).
- Add an `OutboxMessages` table to the primary PostgreSQL database.
- Replace `LoggingMessageBus` with `OutboxMessageBus` — writes to `OutboxMessages` inside the caller's transaction; does **not** call `SaveChangesAsync` itself.
- Update the five existing handlers (`PrivilegeChangeEventHandler`, `PrivilegeModifiedEventHandler`, `SecuritySettingChangeEventHandler`, `LoginAnomalyEventHandler`, `UserApprovedEventHandler`): remove all `_dbContext.SaveChangesAsync(...)` calls; register SignalR pushes (and any other "fire-only-on-commit-success" side effects) via `RegisterPostCommitAction(...)`.
- Implement `OutboxPublisherBackgroundService` that polls the outbox and publishes to RabbitMQ via an `IIntegrationEventPublisher` abstraction.
- Implement `RabbitMqPublisher` (raw `RabbitMQ.Client`, not MassTransit — deliberately, for learning).
- Add RabbitMQ to `docker-compose.yml` with the management UI exposed.
- Integration tests against real PostgreSQL + real RabbitMQ via Testcontainers.
- Knowledge-base case-study document (`conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md` + mindmap).

**Out of scope (Stage 2 or later):**
- Consumers subscribing to RabbitMQ. No queue/binding declared by the producer. Stage 1B delivery is verified via the RabbitMQ management UI and a test-only queue binding.
- Migrating existing `INotificationHandler` handlers to become RabbitMQ consumers. Handlers stay in-process via MediatR.
- Retry/persistence for failed post-commit actions. Stage 1B logs and drops them (audit + outbox already committed — post-commit action failure is a "best-effort" side effect).
- Dead-letter storage for poison messages. Stage 1B retries forever; punted.
- Outbox row archival / cleanup job.
- Per-aggregate message ordering.
- Extracting the worker to a separate .NET Worker project. Stage 1B keeps it in-process as a `BackgroundService`, with a design invariant that makes future extraction cheap.
- Swapping to AWS SNS/SQS or other brokers. Enabled by the `IIntegrationEventPublisher` abstraction but not implemented.

## Architecture

### Two Event Layers (dispatch mechanics refactored; layer separation preserved)

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: DOMAIN EVENTS (in-process, via MediatR)            │
│  - Raised by aggregates: entity.RaiseDomainEvent(...)        │
│  - Collected from ChangeTracker in SaveChangesAsync          │
│  - Dispatched AFTER base.SaveChangesAsync, inside the same   │
│    DbContext-owned transaction (Unit-of-Work pattern)        │
│  - Consumed by INotificationHandler<DomainEventNotification> │
│  - Example: PrivilegeChangeEventHandler                      │
│  - Handlers no longer call SaveChangesAsync themselves;      │
│    they Add() to DbSets and register post-commit actions     │
└──────────────────────────────────────────────────────────────┘
                          │
                          │  Inside each handler, after in-process
                          │  DbSet mutations (audit log, outbox row),
                          │  the handler explicitly publishes an
                          │  integration event for cross-app delivery
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2: INTEGRATION EVENTS (cross-app, via IMessageBus)    │
│  - Explicitly published: await _messageBus.PublishAsync(...) │
│  - Current impl: LoggingMessageBus (stub — logs only)        │
│  - New impl: OutboxMessageBus — Add()s to OutboxMessages     │
│  - Worker polls table, publishes via IIntegrationEventPubl.  │
│  - Stage 1B impl: RabbitMqPublisher (raw RabbitMQ.Client)    │
└──────────────────────────────────────────────────────────────┘
```

### Write-Path Flow — Unit-of-Work Orchestration

```
[HTTP request]
    ↓
[Controller / Application service]
    ↓ mutates aggregate, entity.RaiseDomainEvent(...)
    ↓
PortalDbContext.SaveChangesAsync(ct)   ◄── now an explicit Unit-of-Work orchestrator
    │
    ├─ 1. PopulateAuditFields()
    ├─ 2. events = CollectDomainEvents()                ◄── snapshot + clear from ChangeTracker
    ├─ 3. BEGIN TRANSACTION (skip if caller already has one — nested-tx-aware)
    │
    ├─ 4. base.SaveChangesAsync(ct)                     ◄── FIRST save: aggregate mutations
    │
    ├─ 5. DispatchDomainEventsAsync(events, ct)         ◄── MediatR publishes AFTER save
    │     └─ PrivilegeChangeEventHandler.Handle(...)
    │         ├─ _dbContext.AuditLogs.Add(auditEntry)   ◄── pure DbSet.Add (no SaveChanges)
    │         ├─ await _messageBus.PublishAsync(...)    ◄── OutboxMessageBus.Add (no SaveChanges)
    │         └─ RegisterPostCommitAction(ct =>         ◄── SignalR deferred
    │               _realTimeNotifier.SendSecurityEventAsync(...))
    │
    ├─ 6. base.SaveChangesAsync(ct)                     ◄── SECOND save: audit rows + outbox rows
    │
    ├─ 7. COMMIT
    │
    └─ 8. ExecutePostCommitActionsAsync(ct)             ◄── SignalR fires only on commit success
                                                            (errors here are logged, not thrown)

On any exception in steps 4-6: ROLLBACK + ClearPostCommitActions + rethrow.
Nothing persists; no SignalR fires.
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

1. **`OutboxMessageBus.PublishAsync` must not call `SaveChangesAsync`.** Only `DbSet.Add`. `PortalDbContext` is responsible for the commit.
2. **`OutboxPublisherBackgroundService`, `RabbitMqPublisher`, and all their dependencies must not reference HTTP-specific services** (`IHttpContextAccessor`, `HttpContext`, controller-specific types, middleware). This keeps future extraction to a standalone worker project a cut-and-paste operation.
3. **`INotificationHandler` implementations must NOT call `_dbContext.SaveChangesAsync(...)` directly.** `PortalDbContext` orchestrates its own unit of work. Handler responsibility is limited to: (a) mutating `DbSet`s via `.Add(...)` / `.Update(...)` / `.Remove(...)`, and (b) registering post-commit side effects via `RegisterPostCommitAction(...)`.
4. **Side effects that should only fire if the DB commit succeeds** (SignalR pushes, external API calls, email sends) **must be registered as post-commit actions**, not called directly in the handler. Calling them inline re-introduces the dual-write hazard this pattern is fixing.
5. **Serialize the integration event payload with its concrete runtime type**, not the generic parameter `T`, to avoid losing properties when `T` is `object` or an interface.
6. **`PortalDbContext.SaveChangesAsync` must be nested-transaction-aware.** If the caller already opened a transaction via `Database.BeginTransactionAsync()`, the DbContext must not open a second one (EF Core rejects nesting). The DbContext owns the transaction lifecycle only when it started it.

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

### 1. `PortalDbContext` — Unit-of-Work Refactor

Location: `libs/core/infrastructure/Persistence/PortalDbContext.cs` (existing file).

The existing `SaveChangesAsync` (lines 40-48) and `DispatchDomainEventsAsync` (lines 69-94) are rewritten. The new orchestration:

```csharp
// A list of callbacks to execute AFTER successful commit.
// Cleared on rollback so nothing fires for a failed transaction.
private readonly List<Func<CancellationToken, Task>> _postCommitActions = new();

public void RegisterPostCommitAction(Func<CancellationToken, Task> action) {
  // JUNIOR RATIONALE (Post-commit side effects):
  // Any side effect that should happen "only if the DB write succeeded"
  // (SignalR push, email send, external API call) must be registered here,
  // NOT called inline in a handler. Inline calls happen BEFORE commit, so
  // they fire even when the transaction later fails — same dual-write
  // hazard the outbox pattern exists to fix.
  _postCommitActions.Add(action);
}

public override async Task<int> SaveChangesAsync(CancellationToken ct = default) {
  // Step 1: audit fields (unchanged behavior).
  PopulateAuditFields();

  // Step 2: snapshot domain events from ChangeTracker and clear them off
  // the entities so a later SaveChangesAsync doesn't re-dispatch.
  var events = CollectAndClearDomainEvents();

  // Step 3: open transaction ONLY if the caller hasn't already.
  // EF Core rejects nested BeginTransactionAsync calls.
  var owningTransaction = Database.CurrentTransaction == null;
  var tx = owningTransaction ? await Database.BeginTransactionAsync(ct) : null;

  try {
    // Step 4: save aggregate mutations FIRST.
    // Domain events now fire against persisted state — "this happened" is true.
    var result = await base.SaveChangesAsync(ct);

    // Step 5: dispatch events. Handlers Add() audit/outbox rows to DbSets
    // and register post-commit actions. They do NOT call SaveChangesAsync.
    await DispatchDomainEventsAsync(events, ct);

    // Step 6: flush whatever handlers added (audit entries + outbox rows)
    // inside the same transaction.
    result += await base.SaveChangesAsync(ct);

    // Step 7: commit (only if we opened the transaction).
    if (owningTransaction) {
      await tx!.CommitAsync(ct);
      // Step 8: fire post-commit actions. Errors here are LOGGED, not thrown —
      // the DB work already committed; failing a SignalR push should not
      // appear to the caller as a failed SaveChanges.
      await ExecutePostCommitActionsAsync(ct);
    } else if (_postCommitActions.Count > 0) {
      // Nested-transaction case: the caller owns the transaction. We cannot
      // safely fire post-commit actions here (they would run BEFORE the
      // caller's commit, breaking the "commit-success" guarantee). Surface
      // the misuse as a hard error — Stage 1B does not support post-commit
      // actions inside caller-owned transactions.
      _postCommitActions.Clear();
      throw new InvalidOperationException(
        "Post-commit actions cannot be registered when SaveChangesAsync is " +
        "called inside a caller-owned transaction. Either remove the outer " +
        "BeginTransactionAsync, or execute the actions manually after your commit.");
    }

    return result;
  }
  catch {
    // Rollback + discard post-commit actions. Nothing fires for a failed tx.
    if (owningTransaction && tx != null) await tx.RollbackAsync(ct);
    _postCommitActions.Clear();
    throw;
  }
}

private List<IDomainEvent> CollectAndClearDomainEvents() {
  var entities = ChangeTracker.Entries()
    .Where(e => e.Entity is IHasDomainEvents h && h.DomainEvents.Any())
    .Select(e => (IHasDomainEvents)e.Entity)
    .ToList();
  var events = entities.SelectMany(e => e.DomainEvents).ToList();
  foreach (var entity in entities) entity.ClearDomainEvents();
  return events;
}

private async Task DispatchDomainEventsAsync(
    List<IDomainEvent> events,
    CancellationToken ct) {
  if (events.Count == 0) return;
  var publisher = _serviceProvider.GetService<IPublisher>();
  if (publisher == null) return;
  foreach (var domainEvent in events) {
    var notificationType = typeof(DomainEventNotification<>).MakeGenericType(domainEvent.GetType());
    var notification = Activator.CreateInstance(notificationType, domainEvent);
    if (notification != null) await publisher.Publish(notification, ct);
  }
}

private async Task ExecutePostCommitActionsAsync(CancellationToken ct) {
  // Snapshot + clear first so re-entrant Add() calls during execution
  // don't create an infinite loop.
  var actions = _postCommitActions.ToList();
  _postCommitActions.Clear();
  foreach (var action in actions) {
    try {
      await action(ct);
    }
    catch (Exception ex) {
      // Log and continue. Post-commit failure does NOT fail SaveChangesAsync.
      _logger?.LogError(ex, "Post-commit action failed after successful SaveChangesAsync");
    }
  }
}
```

**Key design points:**
- **`CollectAndClearDomainEvents` runs before save** so events captured reflect the mutation that's about to be persisted; clearing protects against re-dispatch on the second `base.SaveChangesAsync`.
- **Two `base.SaveChangesAsync` calls** — one for aggregates, one for handler-added entries — both inside the same transaction. EF Core is happy with multiple saves on the same DbContext within one transaction.
- **`owningTransaction` flag** makes this safe to call from application code that already opened a transaction (e.g., multi-aggregate operations).
- **Post-commit action errors never propagate.** The DB state is already committed; a failed SignalR push is an observability event, not a caller-visible failure. Logged for ops; Stage 2 could add retry with persistence.

**Logger dependency:** `PortalDbContext` needs `ILogger<PortalDbContext>` injected to log post-commit action failures. Add to constructor signature + DI registration.

### 2. `OutboxMessageBus` — replaces `LoggingMessageBus`

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

### 3. Handler Refactor — Pure Mutators + Post-Commit Actions

Five handlers currently call both `_dbContext.SaveChangesAsync(...)` and `_messageBus.PublishAsync(...)`:
- `PrivilegeChangeEventHandler`
- `PrivilegeModifiedEventHandler`
- `SecuritySettingChangeEventHandler`
- `LoginAnomalyEventHandler`
- `UserApprovedEventHandler`

Each handler gets the same refactor. Example diff for `PrivilegeChangeEventHandler` (lines 49-76):

```diff
  _dbContext.AuditLogs.Add(auditEntry);
- await _dbContext.SaveChangesAsync(cancellationToken);
-
- await _realTimeNotifier.SendSecurityEventAsync(
-     domainEvent.TenantId.Value.ToString(),
-     "PrivilegeChange",
-     new { EventId = auditEntry.Id, Timestamp = auditEntry.Timestamp, ... },
-     cancellationToken);
-
- await _messageBus.PublishAsync(new { EventName = "PrivilegeChange", ... }, cancellationToken);
+
+ // Add outbox row via IMessageBus (no SaveChanges — DbContext orchestrates).
+ await _messageBus.PublishAsync(new { EventName = "PrivilegeChange", ... }, cancellationToken);
+
+ // Defer SignalR to after commit — fires only if the tx actually commits.
+ _dbContext.RegisterPostCommitAction(ct =>
+   _realTimeNotifier.SendSecurityEventAsync(
+     domainEvent.TenantId.Value.ToString(),
+     "PrivilegeChange",
+     new { EventId = auditEntry.Id, Timestamp = auditEntry.Timestamp, ... },
+     ct));
```

**What changed:**
- **Removed `_dbContext.SaveChangesAsync(cancellationToken)`** — `PortalDbContext` orchestrates saves now. Handler's job is purely to stage changes in the ChangeTracker.
- **SignalR push moved from inline call to `RegisterPostCommitAction(...)`** — fires only after the transaction commits successfully, and is discarded on rollback.
- **`_messageBus.PublishAsync(...)` stays** — it now adds an `OutboxMessage` to the ChangeTracker (via `OutboxMessageBus`) instead of logging. No call-site change in the handler beyond removing the surrounding SaveChangesAsync.

**Why this shape wins:**
- Handlers become small and obvious. They stage DB mutations and register "do this after commit" callbacks. No transaction management concerns leak in.
- The entire write path for a domain mutation commits atomically — aggregate + audit + outbox, all inside one transaction.
- If ANY step fails (handler throws, audit constraint violation, broker enqueue fails), **everything rolls back** and no SignalR notification fires. No more ghost notifications.

### 4. `IIntegrationEventPublisher` Abstraction

Location: `libs/core/application/Interfaces/IIntegrationEventPublisher.cs`.

```csharp
public interface IIntegrationEventPublisher {
  Task PublishAsync(OutboxMessage message, CancellationToken cancellationToken);
}
```

This is the **broker swap point**. Stage 1B provides `RabbitMqPublisher`. Future: `SnsPublisher`, `EventBridgePublisher`, `AmazonMqPublisher` — each is a new class and a DI registration change; everything else in the pipeline is unchanged.

### 5. `RabbitMqPublisher` — raw `RabbitMQ.Client`

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

### 6. `OutboxPublisherBackgroundService`

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

### 7. Docker Compose

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
| Handler throws during dispatch (inside transaction) | Transaction rolls back; aggregate + audit + outbox + post-commit actions all discarded. **Handled by UoW.** | |
| Handler throws → outbox insert never happens | Same as above — entire UoW rolls back. **Handled.** | |
| App crashes between commit and worker publishing | Outbox row `ProcessedAt IS NULL` → worker picks up on restart. **Handled (at-least-once).** | |
| RabbitMQ broker down | Publish throws → `RetryCount++`, `Error` set, row stays unprocessed. Next poll retries. **Handled.** | |
| RabbitMQ slow → publish timeout | Same path as above. **Handled.** | |
| Worker publishes, broker confirms, app crashes *before* DB marks `ProcessedAt` | Row is re-published on next poll → **duplicate delivered to consumers.** | Consumer idempotency (Stage 2) |
| Poison message (unserializable / routing failure) | `RetryCount` grows unbounded; row retried forever. | Dead-letter column (Stage 2): row moved to `OutboxDeadLetters` after N retries. |
| Two worker instances running simultaneously | `FOR UPDATE SKIP LOCKED` ensures each row is handled by exactly one worker. **Handled.** Enables horizontal scaling. | |
| Message ordering | Best-effort via `ORDER BY OccurredAt` on fetch. Concurrent workers do not guarantee ordering across aggregates. | Per-aggregate ordering (Stage 2): partition by aggregate ID, dedicated worker per partition. |
| Outbox table grows unbounded | No cleanup in Stage 1B. | Archival job (Stage 2): cron deletes `ProcessedAt < now() - 30 days`. |
| SignalR push fails (post-commit action) | Exception caught by `ExecutePostCommitActionsAsync`, logged, **not re-thrown**. DB state remains committed; the integration-event outbox row is still enqueued. The SignalR notification is dropped for this one attempt. **Handled** — failure does not corrupt DB state or fail the caller. | Retry/persistence for failed post-commit actions (Stage 2). |
| SignalR pushed before commit then commit fails (OLD bug) | Cannot happen — SignalR is now a post-commit action and fires only after `tx.CommitAsync()` succeeds. **Fixed by UoW.** | |
| Caller begins their own transaction (nested case) | `PortalDbContext` detects `Database.CurrentTransaction != null`, skips its own `BeginTransactionAsync` / `CommitAsync`. **Post-commit actions are NOT fired by the nested `SaveChangesAsync`** — they would fire before the caller's commit, which defeats the "commit-success" guarantee. If any are registered, the DbContext throws `InvalidOperationException` to surface the misuse. | Ambient-transaction-aware post-commit actions (Stage 2). Current application code does not open explicit transactions, so this case doesn't arise in practice today. |

**Canonical interview probe:** the "app crashes between publish and mark-processed" row — the unavoidable duplicate-delivery window. RabbitMQ has no 2PC with a database. Consumer idempotency is the only real answer. This is the single most important conceptual point in the whole project.

## Testing Strategy

### Unit Tests — `PortalDbContext` Unit-of-Work

- `SaveChangesAsync` dispatches domain events **after** `base.SaveChangesAsync` (not before). Verified by instrumenting a test handler that asserts the parent aggregate is already persisted when `Handle` runs.
- `SaveChangesAsync` calls `base.SaveChangesAsync` **twice** in the normal path — once for aggregate mutations, once for handler-added entries. Verified by counting `SavingChanges` interceptor invocations.
- Post-commit actions fire **after** `tx.CommitAsync` when `PortalDbContext` owns the transaction. Verified by asserting action side effects are visible in the DB after `SaveChangesAsync` returns.
- Post-commit actions are **cleared on rollback** — a handler that throws results in zero post-commit action invocations.
- **Exception inside a post-commit action is logged, not re-thrown** — `SaveChangesAsync` returns normally; failed action surfaces only in logs.
- **Nested-transaction safeguard** — calling `SaveChangesAsync` inside a caller-opened transaction throws `InvalidOperationException` if any post-commit action was registered.
- **Handler-calls-SaveChangesAsync regression guard (static test)** — a simple test that reads handler source files and asserts `_dbContext.SaveChangesAsync` does not appear. Prevents future regression of the design invariant.

### Unit Tests — `OutboxMessageBus`

- `PublishAsync` adds an `OutboxMessage` to the ChangeTracker with correct `EventType`, `Payload`, `OccurredAt`, and (if available) `CorrelationId`.
- `PublishAsync` does **not** call `SaveChangesAsync` (regression guard for the key design invariant).
- `PublishAsync` serializes the concrete runtime type, not the generic parameter `T` — regression guard against the classic System.Text.Json gotcha. Test writes a concrete subtype via `IMessageBus.PublishAsync<object>(...)` and asserts the payload includes subtype properties.

### Integration Tests — Testcontainers (real PostgreSQL + real RabbitMQ)

- Seed an `OutboxMessage`, start the worker, assert the message lands in a test-bound queue within a timeout.
- Seed 100 messages with two worker instances running in the same process; assert each message is processed exactly once (`SKIP LOCKED` coordination test).
- Break the RabbitMQ container mid-test, seed a message, restart the broker; assert eventual delivery and `RetryCount > 0`.
- End-to-end happy path: POST to a controller that triggers `PrivilegeChangeEvent`; assert (a) the aggregate mutation persisted, (b) the audit row written, (c) the outbox row written with `ProcessedAt` initially null, (d) the SignalR notification fired (mock verified), (e) eventually `ProcessedAt` set and message visible in RabbitMQ.
- End-to-end rollback path: inject a handler that throws; POST to the same controller; assert (a) aggregate mutation NOT persisted, (b) audit row NOT written, (c) outbox row NOT written, (d) SignalR notification did NOT fire. Confirms the Unit-of-Work transaction boundary and the post-commit-on-rollback-discard behavior.

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
   - 4.1 `PortalDbContext` as Unit-of-Work orchestrator — why handlers don't call `SaveChangesAsync`, how post-commit actions avoid SignalR dual-writes, nested-transaction handling.
   - 4.2 `OutboxMessage` entity — fields, JSONB, partial-index rationale.
   - 4.3 `OutboxMessageBus` — why it doesn't `SaveChanges` itself.
   - 4.4 Publisher worker — polling, `SELECT FOR UPDATE SKIP LOCKED`, publisher confirms.
   - 4.5 RabbitMQ primitives actually used — topic exchange, routing keys, channels, `IConnection` lifecycle.
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
   - 7.3 L3: How do you handle the publish/DB-commit race? What does at-least-once + idempotency mean in practice? When would you use `FOR UPDATE SKIP LOCKED` vs PG `LISTEN/NOTIFY`? Why should domain events be dispatched *after* `base.SaveChangesAsync`, not before? Why shouldn't SignalR push happen inline in a handler?
   - 7.4 Staff: How would you evolve this toward multi-region or multi-broker? When would you switch to Kafka? How does this support a modular-monolith → microservices path without rewriting the producer?
8. **What I Punted** (honest scope statement — Stage 2 work list from the Out-of-Scope section of this design).
9. **Cross-References** — back to `message-queues.md` §1.3 (outbox) and §2.1 (RabbitMQ), `design-patterns.md` outbox section, `mediatr-cqrs.md` for the in-process event layer, `distributed-systems.md` for delivery-semantics context.

### Cross-Links in Existing Knowledge Base

Add one sentence each in `message-queues.md` §1.3 and §2.1 pointing to the new case-study doc: *"See `rabbitmq-outbox-case-study.md` for a hands-on walkthrough grounded in this codebase."*

## Summary of Deliverables

**Code:**
1. **`PortalDbContext` Unit-of-Work refactor:** rewrite `SaveChangesAsync` (steps 1-8 as described in §1); extract `CollectAndClearDomainEvents`; rewrite `DispatchDomainEventsAsync` to take a pre-collected list and run post-save; add `RegisterPostCommitAction`, `ExecutePostCommitActionsAsync`, `_postCommitActions` list; add `ILogger<PortalDbContext>` constructor parameter + DI update.
2. **Handler refactor for five handlers** (`PrivilegeChangeEventHandler`, `PrivilegeModifiedEventHandler`, `SecuritySettingChangeEventHandler`, `LoginAnomalyEventHandler`, `UserApprovedEventHandler`): remove `_dbContext.SaveChangesAsync(...)` calls; move SignalR pushes to `_dbContext.RegisterPostCommitAction(...)`.
3. `OutboxMessage` entity + EF configuration + migration (`AddOutboxMessages`).
4. `OutboxMessageBus` class (replaces `LoggingMessageBus` in DI).
5. `IIntegrationEventPublisher` interface.
6. `IRabbitMqConnectionProvider` + `RabbitMqConnectionProvider` (singleton `IConnection`).
7. `RabbitMqPublisher` class (implements `IIntegrationEventPublisher`).
8. `OutboxPublisherBackgroundService` (`IHostedService` registered in `Program.cs`).
9. `OutboxOptions` + configuration binding.
10. `docker-compose.yml` — add RabbitMQ service with management UI.
11. DI registration changes in `Program.cs` (remove `LoggingMessageBus`, add `OutboxMessageBus`, `IRabbitMqConnectionProvider`, `RabbitMqPublisher`, hosted service).
12. Unit tests for `PortalDbContext` Unit-of-Work semantics (dispatch-after-save, two-pass save, post-commit firing, rollback discard, nested-tx guard, no-handler-calls-SaveChanges regression test).
13. Unit tests for `OutboxMessageBus`.
14. Integration tests (Testcontainers: PostgreSQL + RabbitMQ) — happy path and rollback path.

**Knowledge base:**

15. `conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md` (includes Unit-of-Work section 4.1).
16. `conductor/knowledge-base/reference/rabbitmq-outbox-case-study-mindmap.md`.
17. Cross-reference edits in `conductor/knowledge-base/reference/message-queues.md` §1.3 and §2.1.

**Cleanup:**

18. Delete `libs/core/infrastructure/Services/LoggingMessageBus.cs`.
19. Delete the old in-place `DispatchDomainEventsAsync` body on `PortalDbContext` (replaced by the new version that takes a pre-collected event list).

## Success Criteria

1. A POST to an endpoint that mutates a privilege results in:
   - The aggregate mutation persisted.
   - An `AuditEntry` row written.
   - An `OutboxMessage` row written with the integration-event payload, `ProcessedAt IS NULL` at first.
   - SignalR notification fired (observed via mock in tests).
   - Within `PollInterval + 1s`, `ProcessedAt` set on the outbox row.
   - A message visible in the RabbitMQ management UI on the `portal.events` exchange with the correct routing key.
2. A POST where a handler throws mid-dispatch results in:
   - The aggregate mutation NOT persisted.
   - No `AuditEntry` row written.
   - No `OutboxMessage` row written.
   - SignalR notification did NOT fire.
3. Stopping RabbitMQ and repeating the POST results in an `OutboxMessage` row with `RetryCount > 0`; restarting RabbitMQ results in eventual delivery.
4. Running two worker instances simultaneously against a seeded backlog of 100 messages results in exactly 100 successful deliveries (no duplicates within the stopping conditions: no mid-flight crashes during the test).
5. A grep across `libs/core/infrastructure/Persistence/Handlers/` finds zero occurrences of `_dbContext.SaveChangesAsync` (regression guard for the Unit-of-Work invariant).
6. All integration tests pass on CI with Testcontainers.
7. The knowledge-base case-study doc exists and cross-links from `message-queues.md` §1.3 and §2.1 are added.
8. `LoggingMessageBus` is removed from the codebase.

## Estimated Effort

~2 days with Claude Code + active-learning workflow (writing the knowledge-base doc section-by-section as each implementation section is completed). The Unit-of-Work refactor adds ~0.5 day over the outbox-only plan: the DbContext change itself is ~40 lines, but the handler cleanup + new UoW-semantics unit tests + rollback-path integration test add the rest.

## References

- `conductor/tracks/outbox_pattern_rabbitmq_20260406/spec.md` — original track spec.
- `conductor/knowledge-base/reference/message-queues.md` — existing survey doc; this design extends it with a hands-on case study.
- `libs/core/infrastructure/Persistence/PortalDbContext.cs` — existing domain-event dispatch (lines 40-94).
- `libs/core/infrastructure/Persistence/Handlers/PrivilegeChangeEventHandler.cs` — reference handler showing the two-layer event flow.
- `libs/core/application/Interfaces/IMessageBus.cs` — the interface whose implementation is being swapped.
- `libs/core/infrastructure/Services/LoggingMessageBus.cs` — stub being removed.
