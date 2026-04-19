# Outbox + RabbitMQ Stage 1B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-process `IMessageBus` stub with a real Transactional Outbox + RabbitMQ publisher; refactor `PortalDbContext` to a Unit-of-Work that fixes the dispatch-before-save re-entrancy and the SignalR dual-write hazard.

**Architecture:** Two event layers preserved: domain events (MediatR, in-process) vs integration events (cross-app). `PortalDbContext.SaveChangesAsync` becomes an explicit Unit-of-Work orchestrator (collect → save aggregates → dispatch → save handler-added rows → commit → fire post-commit actions). `OutboxMessageBus` writes integration events to an `OutboxMessages` table inside the caller's transaction. `OutboxPublisherBackgroundService` polls with `SELECT FOR UPDATE SKIP LOCKED` and publishes via `IIntegrationEventPublisher` (Stage 1B impl: `RabbitMqPublisher`, raw `RabbitMQ.Client`).

**Tech Stack:** .NET 10, EF Core 10 (Npgsql), MediatR 14, RabbitMQ.Client 6.8.x (raw, no MassTransit — deliberate for learning), xUnit + Moq + FluentAssertions, Testcontainers (PostgreSQL + RabbitMQ).

**Spec:** `docs/superpowers/specs/2026-04-19-outbox-rabbitmq-poc-design.md`

---

## Planning Notes

**Codebase reality vs spec:**
- The spec lists five handlers needing refactor. Only **three** actually call `_dbContext.SaveChangesAsync(...)` today: `PrivilegeChangeEventHandler` (line 50), `SecuritySettingChangeEventHandler` (line 50), `LoginAnomalyEventHandler` (line 50). `PrivilegeModifiedEventHandler` and `UserApprovedEventHandler` are already pure mutators (no `SaveChangesAsync`, no SignalR call). Plan reflects this — only those three get refactored. The static regression test (Task 14) still covers all five.

**Ordering invariant:** UoW refactor (Task 6) must ship **before** the handler refactor (Tasks 11-13). Otherwise the handler's removed `SaveChangesAsync` calls would leave `AuditEntry` rows un-flushed.

**Backward compatibility window:** After Task 6 (UoW) but before Tasks 11-13 (handler refactor), the system is in an interim state where handlers still call `SaveChangesAsync` re-entrantly. The UoW handles this safely (nested-tx-aware path), so the codebase remains shippable at every commit.

**Package versions:**
- `RabbitMQ.Client` 6.8.1 — last 6.x release, stable sync API (used throughout this plan).
- `Testcontainers.RabbitMq` 4.10.0 — matches existing `Testcontainers.PostgreSql` version.

---

## File Structure

**New files:**
- `libs/core/infrastructure/Persistence/Entities/OutboxMessage.cs` — entity
- `libs/core/infrastructure/Persistence/Migrations/<timestamp>_AddOutboxMessages.cs` — generated
- `libs/core/infrastructure/Messaging/OutboxMessageBus.cs` — IMessageBus impl
- `libs/core/application/Interfaces/IIntegrationEventPublisher.cs` — broker abstraction
- `libs/core/infrastructure/Messaging/RabbitMqOptions.cs` — config record
- `libs/core/infrastructure/Messaging/IRabbitMqConnectionProvider.cs` — singleton connection holder interface
- `libs/core/infrastructure/Messaging/RabbitMqConnectionProvider.cs` — implementation
- `libs/core/infrastructure/Messaging/RabbitMqPublisher.cs` — IIntegrationEventPublisher impl
- `libs/core/infrastructure/Messaging/OutboxOptions.cs` — config record
- `libs/core/infrastructure/Messaging/OutboxPublisherBackgroundService.cs` — `BackgroundService`
- `libs/core/infrastructure.tests/Messaging/OutboxMessageBusTests.cs` — unit tests
- `libs/core/infrastructure.tests/Messaging/UnitOfWorkTests.cs` — UoW unit tests
- `libs/core/infrastructure.tests/Messaging/HandlerInvariantTests.cs` — static regression test
- `apps/portal-api.integration-tests/Outbox/OutboxFixture.cs` — Testcontainers fixture (PG + RabbitMQ)
- `apps/portal-api.integration-tests/Outbox/OutboxIntegrationTests.cs` — E2E
- `conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md` — KB doc
- `conductor/knowledge-base/reference/rabbitmq-outbox-case-study-mindmap.md` — KB mindmap

**Modified files:**
- `docker-compose.yml` — add RabbitMQ service
- `libs/core/infrastructure/Tai.Portal.Core.Infrastructure.csproj` — add RabbitMQ.Client
- `libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj` — add Testcontainers.RabbitMq
- `apps/portal-api.integration-tests/portal-api.integration-tests.csproj` — add Testcontainers.RabbitMq + Testcontainers.PostgreSql + Respawn
- `libs/core/infrastructure/Persistence/PortalDbContext.cs` — UoW refactor + OutboxMessage DbSet + config
- `libs/core/infrastructure/Persistence/Handlers/PrivilegeChangeEventHandler.cs` — pure mutator
- `libs/core/infrastructure/Persistence/Handlers/SecuritySettingChangeEventHandler.cs` — pure mutator
- `libs/core/infrastructure/Persistence/Handlers/LoginAnomalyEventHandler.cs` — pure mutator
- `apps/portal-api/Program.cs` — DI swap + new registrations
- `apps/portal-api/appsettings.json` — RabbitMQ + Outbox config
- `conductor/knowledge-base/reference/message-queues.md` — cross-references

**Deleted files (Task 18):**
- `libs/core/infrastructure/Services/LoggingMessageBus.cs`

---

## Phase 1: Foundation

### Task 1: Add RabbitMQ to docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add RabbitMQ service block**

Replace the file contents with:

```yaml
services:
  postgres:
    image: postgres:17
    container_name: portal-db
    environment:
      POSTGRES_DB: portal
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - portal-data:/var/lib/postgresql/data

  rabbitmq:
    image: rabbitmq:3-management
    container_name: portal-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: portal
      RABBITMQ_DEFAULT_PASS: portal
    ports:
      - "5672:5672"        # AMQP
      - "15672:15672"      # Management UI: http://localhost:15672 (portal/portal)
    volumes:
      - portal-rabbitmq:/var/lib/rabbitmq

volumes:
  portal-data:
  portal-rabbitmq:
```

- [ ] **Step 2: Start the broker and verify**

Run: `docker compose up -d rabbitmq`
Then: `docker compose ps rabbitmq`
Expected: status `healthy` or `running`. Open `http://localhost:15672` in a browser, log in `portal/portal`, confirm management UI loads.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add RabbitMQ service to docker-compose with management UI"
```

---

### Task 2: Add NuGet packages

**Files:**
- Modify: `libs/core/infrastructure/Tai.Portal.Core.Infrastructure.csproj`
- Modify: `libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj`
- Modify: `apps/portal-api.integration-tests/portal-api.integration-tests.csproj`

- [ ] **Step 1: Add `RabbitMQ.Client` to infrastructure**

In `libs/core/infrastructure/Tai.Portal.Core.Infrastructure.csproj`, inside the existing `<ItemGroup>` block with PackageReferences, add:

```xml
    <PackageReference Include="RabbitMQ.Client" Version="6.8.1" />
    <PackageReference Include="Microsoft.Extensions.Hosting.Abstractions" Version="10.0.0" />
    <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="10.0.0" />
    <PackageReference Include="Microsoft.Extensions.Options.ConfigurationExtensions" Version="10.0.0" />
```

(`Microsoft.Extensions.Hosting.Abstractions` is needed for `BackgroundService`. The Logging/Options ones may already be transitive — adding explicitly removes ambiguity.)

- [ ] **Step 2: Add `Testcontainers.RabbitMq` to infrastructure tests**

In `libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj`, add inside `<ItemGroup>`:

```xml
    <PackageReference Include="Testcontainers.RabbitMq" Version="4.10.0" />
    <PackageReference Include="RabbitMQ.Client" Version="6.8.1" />
```

- [ ] **Step 3: Add Testcontainers + Respawn + RabbitMQ to portal-api integration tests**

In `apps/portal-api.integration-tests/portal-api.integration-tests.csproj`, add inside `<ItemGroup>`:

```xml
    <PackageReference Include="Testcontainers.PostgreSql" Version="4.10.0" />
    <PackageReference Include="Testcontainers.RabbitMq" Version="4.10.0" />
    <PackageReference Include="Respawn" Version="7.0.0" />
    <PackageReference Include="RabbitMQ.Client" Version="6.8.1" />
    <PackageReference Include="FluentAssertions" Version="6.12.2" />
    <PackageReference Include="Npgsql" Version="9.0.0" />
```

- [ ] **Step 4: Restore and verify**

Run: `dotnet restore`
Expected: completes with no errors.
Then: `dotnet build`
Expected: builds clean (no behavior change yet).

- [ ] **Step 5: Commit**

```bash
git add libs/core/infrastructure/Tai.Portal.Core.Infrastructure.csproj \
        libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj \
        apps/portal-api.integration-tests/portal-api.integration-tests.csproj
git commit -m "chore: add RabbitMQ.Client + Testcontainers.RabbitMq packages"
```

---

### Task 3: Create OutboxMessage entity + EF config + migration

**Files:**
- Create: `libs/core/infrastructure/Persistence/Entities/OutboxMessage.cs`
- Modify: `libs/core/infrastructure/Persistence/PortalDbContext.cs` (add DbSet + OnModelCreating block)

- [ ] **Step 1: Create the entity**

Create `libs/core/infrastructure/Persistence/Entities/OutboxMessage.cs` with:

```csharp
using System;

namespace Tai.Portal.Core.Infrastructure.Persistence.Entities;

// JUNIOR RATIONALE (Outbox Entity):
// This is an INFRASTRUCTURE concern, not a domain concept — that's why it
// lives under Infrastructure/Persistence/Entities, not Domain/Entities.
// Aggregates have no awareness of "outbox-ness." The pattern is the price
// you pay for atomicity between DB writes and broker publishes.
public class OutboxMessage {
  // PK as Guid, not identity int: stable across DB recovery / dump-restore,
  // and used directly as RabbitMQ MessageId so Stage-2 consumers can dedup.
  public Guid Id { get; set; }

  // Fully-qualified CLR type name (AssemblyQualifiedName preferred).
  // Used by the publisher to derive a routing key, and by future
  // consumers as an envelope hint.
  public string EventType { get; set; } = null!;

  // JSONB column. Queryable in Postgres (e.g. payload->>'userId'),
  // validated as JSON at write time, compact on disk.
  public string Payload { get; set; } = null!;

  // Set when added to the DbSet, INSIDE the originating transaction —
  // so it's the transaction-commit timeline, not the publish timeline.
  public DateTimeOffset OccurredAt { get; set; }

  // null = unprocessed. Set after broker publisher confirm.
  public DateTimeOffset? ProcessedAt { get; set; }

  public int RetryCount { get; set; }

  // Last error message; nulled out after a successful attempt.
  public string? Error { get; set; }

  // Optional, ties back to the originating request/user action for tracing.
  public string? CorrelationId { get; set; }
}
```

- [ ] **Step 2: Add DbSet to `PortalDbContext`**

In `libs/core/infrastructure/Persistence/PortalDbContext.cs`, add the using and DbSet:

After the existing `using Tai.Portal.Core.Infrastructure.Persistence.Interceptors;` line (line 15), add:

```csharp
using Tai.Portal.Core.Infrastructure.Persistence.Entities;
```

After the `public DbSet<UserPrivilege> UserPrivileges { get; set; }` line (line 29), add:

```csharp
  public DbSet<OutboxMessage> OutboxMessages { get; set; }
```

- [ ] **Step 3: Add EF configuration**

In `PortalDbContext.OnModelCreating`, after the `builder.Entity<UserPrivilege>(...)` block (after line 228, before the closing `}` of `OnModelCreating`), add:

```csharp
    // Configure OutboxMessage — Transactional Outbox pattern (Stage 1B).
    builder.Entity<OutboxMessage>(b => {
      b.HasKey(m => m.Id);
      b.Property(m => m.EventType).IsRequired().HasMaxLength(512);
      b.Property(m => m.Payload).HasColumnType("jsonb").IsRequired();
      b.Property(m => m.OccurredAt).IsRequired();
      b.Property(m => m.Error).HasMaxLength(2000);

      // JUNIOR RATIONALE (Partial Index):
      // The publisher worker ONLY queries unprocessed rows
      // (ProcessedAt IS NULL). A partial index is ~99% smaller than a
      // full index on a table that's mostly processed history. Fast
      // lookup on hot rows, tiny write overhead since the index entry
      // only exists while the row is unprocessed and is removed when
      // ProcessedAt transitions null -> timestamp.
      b.HasIndex(m => m.OccurredAt)
       .HasFilter("\"ProcessedAt\" IS NULL")
       .HasDatabaseName("IX_OutboxMessages_Unprocessed");

      // No multi-tenant query filter — outbox is an infrastructure-level
      // table; the worker reads it as System.
    });
```

- [ ] **Step 4: Generate migration**

Run from the repo root:

```bash
dotnet ef migrations add AddOutboxMessages \
  --project libs/core/infrastructure/Tai.Portal.Core.Infrastructure.csproj \
  --startup-project apps/portal-api/portal-api.csproj
```

Expected: a new file `libs/core/infrastructure/Persistence/Migrations/<timestamp>_AddOutboxMessages.cs` with `CreateTable` for `OutboxMessages` and `CreateIndex` for `IX_OutboxMessages_Unprocessed` filtered on `"ProcessedAt" IS NULL`.

- [ ] **Step 5: Apply migration to local dev DB and verify**

Run: `docker compose up -d postgres`
Then: `dotnet ef database update --project libs/core/infrastructure/Tai.Portal.Core.Infrastructure.csproj --startup-project apps/portal-api/portal-api.csproj`
Then verify the table exists:

```bash
docker exec portal-db psql -U postgres -d portal -c '\d "OutboxMessages"'
```

Expected: column listing including `Id (uuid)`, `EventType (varchar)`, `Payload (jsonb)`, `OccurredAt (timestamptz)`, `ProcessedAt (timestamptz, null)`, `RetryCount (int)`, `Error (varchar, null)`, `CorrelationId (text, null)`. Then:

```bash
docker exec portal-db psql -U postgres -d portal -c '\di "IX_OutboxMessages_Unprocessed"'
```

Expected: shows the partial index.

- [ ] **Step 6: Commit**

```bash
git add libs/core/infrastructure/Persistence/Entities/OutboxMessage.cs \
        libs/core/infrastructure/Persistence/PortalDbContext.cs \
        libs/core/infrastructure/Persistence/Migrations/
git commit -m "feat: add OutboxMessage entity + EF config + migration"
```

---

## Phase 2: Unit-of-Work Refactor

### Task 4: Add `ILogger<PortalDbContext>` constructor parameter

**Files:**
- Modify: `libs/core/infrastructure/Persistence/PortalDbContext.cs`

Pure DI plumbing. No behavior change — but required before the SaveChangesAsync rewrite uses `_logger`. Done as its own task so it lands as a clean, focused commit.

- [ ] **Step 1: Add the field, ctor param, and using**

In `libs/core/infrastructure/Persistence/PortalDbContext.cs`:

Add to the using block (after the existing `using Microsoft.EntityFrameworkCore;` line):

```csharp
using Microsoft.Extensions.Logging;
```

In the class body (before the existing `private readonly ITenantService _tenantService;` line ~20), add:

```csharp
  private readonly ILogger<PortalDbContext>? _logger;
```

(Nullable: keeps existing test code that constructs `PortalDbContext(options, tenantService, serviceProvider)` working until those tests are migrated. Production DI always supplies the logger.)

Update the constructor signature (lines 31-38) to:

```csharp
  public PortalDbContext(
      DbContextOptions<PortalDbContext> options,
      ITenantService tenantService,
      IServiceProvider serviceProvider,
      ILogger<PortalDbContext>? logger = null)
      : base(options) {
    _tenantService = tenantService;
    _serviceProvider = serviceProvider;
    _logger = logger;
  }
```

- [ ] **Step 2: Build and run all existing tests**

Run: `dotnet build`
Then: `dotnet test`
Expected: all existing tests pass — DI changes are backward compatible because `logger` is optional.

- [ ] **Step 3: Commit**

```bash
git add libs/core/infrastructure/Persistence/PortalDbContext.cs
git commit -m "refactor(db): add optional ILogger to PortalDbContext for UoW post-commit logging"
```

---

### Task 5: Add `RegisterPostCommitAction` API (no-op until Task 6)

**Files:**
- Modify: `libs/core/infrastructure/Persistence/PortalDbContext.cs`

Adding the public surface area first means handler tests can be written in parallel, and Task 6's diff is purely the SaveChangesAsync rewrite.

- [ ] **Step 1: Add the field and method**

In `PortalDbContext`, after the new `_logger` field, add:

```csharp
  private readonly List<Func<CancellationToken, Task>> _postCommitActions = new();

  /// <summary>
  /// Registers a callback to execute AFTER the current Unit of Work commits successfully.
  /// Cleared automatically on rollback so nothing fires for a failed transaction.
  /// </summary>
  /// <remarks>
  /// JUNIOR RATIONALE (Post-commit side effects):
  /// Any side effect that should happen "only if the DB write succeeded"
  /// (SignalR push, email send, external API call) MUST be registered here,
  /// NOT called inline in a handler. Inline calls happen BEFORE commit, so
  /// they fire even when the transaction later fails — same dual-write
  /// hazard the outbox pattern exists to fix.
  /// </remarks>
  public void RegisterPostCommitAction(Func<CancellationToken, Task> action) {
    _postCommitActions.Add(action);
  }
```

Add the using at the top of the file (if not already present):

```csharp
using System.Collections.Generic;
```

- [ ] **Step 2: Build**

Run: `dotnet build`
Expected: builds clean. No behavior change yet — `_postCommitActions` is added to but never read.

- [ ] **Step 3: Commit**

```bash
git add libs/core/infrastructure/Persistence/PortalDbContext.cs
git commit -m "feat(db): add RegisterPostCommitAction API surface (no-op until UoW lands)"
```

---

### Task 6: TDD — rewrite `SaveChangesAsync` as Unit-of-Work

**Files:**
- Create: `libs/core/infrastructure.tests/Messaging/UnitOfWorkTests.cs`
- Modify: `libs/core/infrastructure/Persistence/PortalDbContext.cs`

This is the highest-risk change in the plan. Write all UoW tests first, watch them fail, then make them pass with the rewrite.

- [ ] **Step 1: Write the failing test file**

Create `libs/core/infrastructure.tests/Messaging/UnitOfWorkTests.cs`:

```csharp
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Application.Services;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Messaging;

public class UnitOfWorkTests : IAsyncLifetime {
  private readonly PostgreSqlContainer _pg = new PostgreSqlBuilder("postgres:17").Build();

  public async Task InitializeAsync() => await _pg.StartAsync();
  public async Task DisposeAsync() => await _pg.StopAsync();

  private DbContextOptions<PortalDbContext> Options() =>
    new DbContextOptionsBuilder<PortalDbContext>()
      .UseNpgsql(_pg.GetConnectionString())
      .Options;

  private (PortalDbContext ctx, Mock<IPublisher> publisher) NewContext(IServiceProvider? sp = null) {
    var tenantSvc = new Mock<ITenantService>();
    tenantSvc.Setup(s => s.TenantId).Returns(new TenantId(Guid.NewGuid()));
    var publisher = new Mock<IPublisher>();
    var spMock = new Mock<IServiceProvider>();
    spMock.Setup(s => s.GetService(typeof(IPublisher))).Returns(publisher.Object);
    spMock.Setup(s => s.GetService(typeof(ICurrentUserService))).Returns(new Mock<ICurrentUserService>().Object);
    var ctx = new PortalDbContext(Options(), tenantSvc.Object, sp ?? spMock.Object, NullLogger<PortalDbContext>.Instance);
    ctx.Database.EnsureCreated();
    return (ctx, publisher);
  }

  [Fact]
  public async Task SaveChangesAsync_DispatchesDomainEvents_AfterFirstBaseSave() {
    var (ctx, publisher) = NewContext();
    var saveCountAtDispatch = -1;
    var saveCount = 0;
    ctx.SavingChanges += (_, _) => saveCount++;

    publisher.Setup(p => p.Publish(It.IsAny<INotification>(), It.IsAny<CancellationToken>()))
      .Callback<object, CancellationToken>((_, _) => saveCountAtDispatch = saveCount);

    var user = new ApplicationUser("uow1@t.com", new TenantId(Guid.NewGuid()));
    user.StartStaffOnboarding();
    ctx.Users.Add(user);
    await ctx.SaveChangesAsync();
    user.Approve((TenantAdminId)"admin");
    await ctx.SaveChangesAsync();

    saveCountAtDispatch.Should().BeGreaterThan(0,
      "domain events must dispatch AFTER base.SaveChangesAsync, not before");
  }

  [Fact]
  public async Task SaveChangesAsync_CallsBaseSaveTwice_WhenHandlersAddEntries() {
    var (ctx, publisher) = NewContext();
    var saveCount = 0;
    ctx.SavingChanges += (_, _) => saveCount++;

    publisher.Setup(p => p.Publish(It.IsAny<INotification>(), It.IsAny<CancellationToken>()))
      .Callback(() => {
        // Simulate a handler adding an audit entry.
        ctx.AuditLogs.Add(new AuditEntry(
          new TenantId(Guid.NewGuid()), "u", "Test", "r", null, null, "d"));
      });

    var user = new ApplicationUser("uow2@t.com", new TenantId(Guid.NewGuid()));
    user.StartStaffOnboarding();
    ctx.Users.Add(user);
    await ctx.SaveChangesAsync();
    user.Approve((TenantAdminId)"admin");
    await ctx.SaveChangesAsync();

    saveCount.Should().BeGreaterThanOrEqualTo(3,
      "two saves for the second SaveChangesAsync (aggregates then audit) plus the first call's save");
  }

  [Fact]
  public async Task PostCommitAction_FiresAfterCommit_OnSuccessfulSave() {
    var (ctx, _) = NewContext();
    var fired = false;
    ctx.RegisterPostCommitAction(_ => { fired = true; return Task.CompletedTask; });

    var user = new ApplicationUser("pca1@t.com", new TenantId(Guid.NewGuid()));
    ctx.Users.Add(user);
    await ctx.SaveChangesAsync();

    fired.Should().BeTrue("post-commit actions must fire after successful commit");
  }

  [Fact]
  public async Task PostCommitAction_DoesNotFire_WhenSaveThrows() {
    var (ctx, publisher) = NewContext();
    var fired = false;
    publisher.Setup(p => p.Publish(It.IsAny<INotification>(), It.IsAny<CancellationToken>()))
      .Callback(() => {
        ctx.RegisterPostCommitAction(_ => { fired = true; return Task.CompletedTask; });
        throw new InvalidOperationException("handler boom");
      });

    var user = new ApplicationUser("pca2@t.com", new TenantId(Guid.NewGuid()));
    user.StartStaffOnboarding();
    ctx.Users.Add(user);
    await ctx.SaveChangesAsync();
    user.Approve((TenantAdminId)"admin");

    var act = async () => await ctx.SaveChangesAsync();
    await act.Should().ThrowAsync<InvalidOperationException>();
    fired.Should().BeFalse("post-commit actions must NOT fire on rollback");
  }

  [Fact]
  public async Task PostCommitAction_ExceptionIsLogged_NotRethrown() {
    var loggerMock = new Mock<ILogger<PortalDbContext>>();
    var tenantSvc = new Mock<ITenantService>();
    tenantSvc.Setup(s => s.TenantId).Returns(new TenantId(Guid.NewGuid()));
    var ctx = new PortalDbContext(Options(), tenantSvc.Object, new Mock<IServiceProvider>().Object, loggerMock.Object);
    ctx.Database.EnsureCreated();

    ctx.RegisterPostCommitAction(_ => throw new InvalidOperationException("post-commit boom"));

    var user = new ApplicationUser("pca3@t.com", new TenantId(Guid.NewGuid()));
    ctx.Users.Add(user);

    var act = async () => await ctx.SaveChangesAsync();
    await act.Should().NotThrowAsync(
      "post-commit failures must be logged, not rethrown — the DB work already committed");

    loggerMock.Invocations.Should().Contain(i =>
      i.Method.Name == "Log" && i.Arguments.OfType<LogLevel>().Any(l => l == LogLevel.Error));
  }

  [Fact]
  public async Task SaveChangesAsync_InsideCallerTransaction_WithPostCommitAction_Throws() {
    var (ctx, _) = NewContext();
    await using var tx = await ctx.Database.BeginTransactionAsync();

    ctx.RegisterPostCommitAction(_ => Task.CompletedTask);
    var user = new ApplicationUser("nest1@t.com", new TenantId(Guid.NewGuid()));
    ctx.Users.Add(user);

    var act = async () => await ctx.SaveChangesAsync();
    await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*post-commit actions*");
  }
}
```

- [ ] **Step 2: Run the failing tests**

Run: `dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj --filter "FullyQualifiedName~UnitOfWorkTests"`
Expected: most tests fail (current `SaveChangesAsync` dispatches before save, has no transaction wrapping, has no post-commit registry behavior).

- [ ] **Step 3: Implement the UoW rewrite**

Open `libs/core/infrastructure/Persistence/PortalDbContext.cs`. Replace the existing `SaveChangesAsync` method (lines 40-48) and `DispatchDomainEventsAsync` method (lines 69-94) with:

```csharp
  public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) {
    // Step 1: audit fields (unchanged behavior).
    PopulateAuditFields();

    // Step 2: snapshot domain events from ChangeTracker and clear them off
    // the entities so the second base.SaveChangesAsync doesn't re-dispatch.
    var events = CollectAndClearDomainEvents();

    // Step 3: open transaction ONLY if the caller hasn't already.
    // EF Core rejects nested BeginTransactionAsync calls.
    var owningTransaction = Database.CurrentTransaction == null;
    var tx = owningTransaction ? await Database.BeginTransactionAsync(cancellationToken) : null;

    try {
      // Step 4: save aggregate mutations FIRST.
      // Domain events now fire against persisted state — "this happened" is true.
      var result = await base.SaveChangesAsync(cancellationToken);

      // Step 5: dispatch events. Handlers Add() audit/outbox rows to DbSets
      // and register post-commit actions. They MUST NOT call SaveChangesAsync.
      await DispatchDomainEventsAsync(events, cancellationToken);

      // Step 6: flush whatever handlers added (audit + outbox) inside the
      // same transaction. Multiple base.SaveChangesAsync calls on one DbContext
      // inside one transaction are fine — EF Core's UpdatePipeline handles it.
      result += await base.SaveChangesAsync(cancellationToken);

      // Step 7: commit (only if we opened the transaction).
      if (owningTransaction) {
        await tx!.CommitAsync(cancellationToken);
        // Step 8: fire post-commit actions. Errors here are LOGGED, not thrown.
        await ExecutePostCommitActionsAsync(cancellationToken);
      } else if (_postCommitActions.Count > 0) {
        // Nested-transaction case: caller owns the transaction. We cannot
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
      if (owningTransaction && tx != null) {
        try { await tx.RollbackAsync(cancellationToken); } catch { /* swallow secondary */ }
      }
      _postCommitActions.Clear();
      throw;
    }
    finally {
      if (owningTransaction && tx != null) await tx.DisposeAsync();
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
      CancellationToken cancellationToken) {
    if (events.Count == 0) return;
    var publisher = _serviceProvider.GetService(typeof(IPublisher)) as IPublisher;
    if (publisher == null) return;

    foreach (var domainEvent in events) {
      var notificationType = typeof(DomainEventNotification<>).MakeGenericType(domainEvent.GetType());
      var notification = Activator.CreateInstance(notificationType, domainEvent);
      if (notification != null) {
        await publisher.Publish(notification, cancellationToken);
      }
    }
  }

  private async Task ExecutePostCommitActionsAsync(CancellationToken cancellationToken) {
    // Snapshot + clear FIRST so re-entrant Register() during execution
    // doesn't create an infinite loop (the new actions fire on the NEXT save).
    var actions = _postCommitActions.ToList();
    _postCommitActions.Clear();
    foreach (var action in actions) {
      try {
        await action(cancellationToken);
      }
      catch (Exception ex) {
        _logger?.LogError(ex,
          "Post-commit action failed after successful SaveChangesAsync; DB state is committed.");
      }
    }
  }
```

Add this using to the top of the file if not already present:

```csharp
using System.Collections.Generic;
```

- [ ] **Step 4: Run UoW tests, ensure pass**

Run: `dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj --filter "FullyQualifiedName~UnitOfWorkTests"`
Expected: all six tests pass.

- [ ] **Step 5: Run the full existing test suite — verify no regressions**

Run: `dotnet test`
Expected: every test in the solution passes. The pre-existing `SaveChangesAsync_ShouldDispatchDomainEvents_AndLogApproval` test in `PortalDbContextTests.cs` still passes because handlers (still calling re-entrant SaveChangesAsync at this point) hit the nested-tx-aware path and audit rows still land in the same outer transaction.

- [ ] **Step 6: Commit**

```bash
git add libs/core/infrastructure/Persistence/PortalDbContext.cs \
        libs/core/infrastructure.tests/Messaging/UnitOfWorkTests.cs
git commit -m "feat(db): rewrite SaveChangesAsync as Unit-of-Work orchestrator

Dispatches domain events AFTER base.SaveChangesAsync, wraps everything in a
DbContext-owned transaction (nested-tx-aware), and runs post-commit actions
only on commit success. Fixes the dispatch-before-save re-entrancy and
prepares the ground for the transactional outbox.

Six new tests cover: dispatch-after-save, two-pass save, post-commit fires
on success, post-commit cleared on rollback, post-commit error logged not
thrown, nested-tx + post-commit-action throws."
```

---

## Phase 3: OutboxMessageBus

### Task 7: TDD — implement `OutboxMessageBus`, swap DI

**Files:**
- Create: `libs/core/infrastructure.tests/Messaging/OutboxMessageBusTests.cs`
- Create: `libs/core/infrastructure/Messaging/OutboxMessageBus.cs`
- Modify: `apps/portal-api/Program.cs`

- [ ] **Step 1: Write the failing tests**

Create `libs/core/infrastructure.tests/Messaging/OutboxMessageBusTests.cs`:

```csharp
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Messaging;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;
using Testcontainers.PostgreSql;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Messaging;

public class OutboxMessageBusTests : IAsyncLifetime {
  private readonly PostgreSqlContainer _pg = new PostgreSqlBuilder("postgres:17").Build();

  public async Task InitializeAsync() => await _pg.StartAsync();
  public async Task DisposeAsync() => await _pg.StopAsync();

  private PortalDbContext NewContext() {
    var opts = new DbContextOptionsBuilder<PortalDbContext>()
      .UseNpgsql(_pg.GetConnectionString())
      .Options;
    var tenantSvc = new Mock<ITenantService>();
    tenantSvc.Setup(s => s.TenantId).Returns(new TenantId(Guid.NewGuid()));
    var ctx = new PortalDbContext(opts, tenantSvc.Object, new Mock<IServiceProvider>().Object);
    ctx.Database.EnsureCreated();
    return ctx;
  }

  private static Mock<ICurrentUserService> Cur(string? correlation = null) {
    var m = new Mock<ICurrentUserService>();
    m.Setup(c => c.CorrelationId).Returns(correlation);
    return m;
  }

  [Fact]
  public async Task PublishAsync_AddsRowToChangeTracker_WithoutSaving() {
    using var ctx = NewContext();
    var bus = new OutboxMessageBus(ctx, Cur("corr-1").Object);

    await bus.PublishAsync(new TestEvent { Name = "abc" });

    ctx.ChangeTracker.Entries<OutboxMessage>().Should().HaveCount(1,
      "PublishAsync must Add but NOT save — the caller's UoW commits");
    var dbCount = await ctx.OutboxMessages.CountAsync();
    dbCount.Should().Be(0, "no SaveChangesAsync was called");
  }

  [Fact]
  public async Task PublishAsync_PersistsCorrectly_WhenCallerSaves() {
    using var ctx = NewContext();
    var bus = new OutboxMessageBus(ctx, Cur("corr-2").Object);

    await bus.PublishAsync(new TestEvent { Name = "persist-me" });
    await ctx.SaveChangesAsync();

    var row = await ctx.OutboxMessages.SingleAsync();
    row.EventType.Should().Contain("TestEvent");
    row.CorrelationId.Should().Be("corr-2");
    row.ProcessedAt.Should().BeNull();
    row.RetryCount.Should().Be(0);

    using var doc = JsonDocument.Parse(row.Payload);
    doc.RootElement.GetProperty("name").GetString().Should().Be("persist-me");
  }

  [Fact]
  public async Task PublishAsync_SerializesConcreteRuntimeType_NotGenericParameter() {
    using var ctx = NewContext();
    var bus = new OutboxMessageBus(ctx, Cur().Object);

    object boxed = new TestEvent { Name = "concrete" };
    await bus.PublishAsync(boxed);
    await ctx.SaveChangesAsync();

    var row = await ctx.OutboxMessages.SingleAsync();
    using var doc = JsonDocument.Parse(row.Payload);
    doc.RootElement.TryGetProperty("name", out var name).Should().BeTrue(
      "must serialize as TestEvent, not as `object` — that classic STJ gotcha drops all properties");
    name.GetString().Should().Be("concrete");
  }

  private class TestEvent {
    public string Name { get; set; } = "";
  }
}
```

- [ ] **Step 2: Run the failing tests**

Run: `dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj --filter "FullyQualifiedName~OutboxMessageBusTests"`
Expected: compilation fails (`OutboxMessageBus` doesn't exist yet).

- [ ] **Step 3: Implement `OutboxMessageBus`**

Create `libs/core/infrastructure/Messaging/OutboxMessageBus.cs`:

```csharp
using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// IMessageBus implementation that writes integration events to the OutboxMessages table
/// inside the caller's transaction, for reliable cross-app delivery via the publisher worker.
/// </summary>
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

  public Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class {
    // JUNIOR RATIONALE (Transactional outbox — the key insight):
    // We do NOT call SaveChangesAsync here. We only Add the outbox row to
    // the ChangeTracker. The caller's surrounding SaveChangesAsync is what
    // commits it — atomically with the caller's other writes (audit entry,
    // domain entity mutation, etc.). This is the entire transactional
    // guarantee of the pattern: all DB work and the "message to be sent"
    // commit together or not at all.

    // JUNIOR RATIONALE (Concrete runtime type for serialization):
    // message.GetType() returns the concrete runtime type. Passing typeof(T)
    // when T is `object` or an interface drops all properties declared on
    // the concrete subtype — classic System.Text.Json gotcha.
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

- [ ] **Step 4: Swap DI registration**

In `apps/portal-api/Program.cs`, line 51:

Replace:

```csharp
builder.Services.AddScoped<IMessageBus, LoggingMessageBus>();
```

with:

```csharp
builder.Services.AddScoped<IMessageBus, Tai.Portal.Core.Infrastructure.Messaging.OutboxMessageBus>();
```

(Keep `LoggingMessageBus` file in place for now — it'll be deleted in Task 18 after end-to-end verification.)

- [ ] **Step 5: Run tests**

Run: `dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj --filter "FullyQualifiedName~OutboxMessageBusTests"`
Expected: all three tests pass.

Then: `dotnet test`
Expected: full suite passes.

- [ ] **Step 6: Commit**

```bash
git add libs/core/infrastructure/Messaging/OutboxMessageBus.cs \
        libs/core/infrastructure.tests/Messaging/OutboxMessageBusTests.cs \
        apps/portal-api/Program.cs
git commit -m "feat(messaging): add OutboxMessageBus and swap from LoggingMessageBus

OutboxMessageBus writes integration events to the OutboxMessages DbSet inside
the caller's transaction (no SaveChangesAsync of its own — caller owns the
commit). Serializes via the concrete runtime type to avoid the typeof(T)
property-loss gotcha when T is object or an interface."
```

---

## Phase 4: Handler Refactor

Three handlers currently call `_dbContext.SaveChangesAsync(...)` and dispatch SignalR inline. Each gets the same shape: remove the `SaveChangesAsync` call; move SignalR to `RegisterPostCommitAction`. Two other handlers (`PrivilegeModifiedEventHandler`, `UserApprovedEventHandler`) already follow the desired pattern — they need no changes, but Task 14's regression guard covers them.

### Task 8: Refactor `PrivilegeChangeEventHandler`

**Files:**
- Modify: `libs/core/infrastructure/Persistence/Handlers/PrivilegeChangeEventHandler.cs`

- [ ] **Step 1: Rewrite the `Handle` method**

Replace the body of `Handle` (lines 35-77) with:

```csharp
  public async Task Handle(DomainEventNotification<PrivilegeChangeEvent> notification, CancellationToken cancellationToken) {
    var domainEvent = notification.DomainEvent;

    // 1. Stage immutable audit entry. NOTE: no SaveChangesAsync — the
    //    PortalDbContext UoW orchestrator commits everything together.
    var auditEntry = new AuditEntry(
        domainEvent.TenantId,
        domainEvent.UserId,
        "PrivilegeChange",
        domainEvent.ResourceId,
        domainEvent.CorrelationId,
        domainEvent.IpAddress,
        $"Privilege change: {domainEvent.Action}. {domainEvent.Details}"
    );
    _dbContext.AuditLogs.Add(auditEntry);

    // 2. Stage outbox row for cross-app delivery (DocViewer, HR System).
    //    OutboxMessageBus.PublishAsync only Add()s — caller commits.
    await _messageBus.PublishAsync(new {
      EventName = "PrivilegeChange",
      EventId = auditEntry.Id,
      TenantId = domainEvent.TenantId.Value,
      UserId = domainEvent.UserId,
      Action = domainEvent.Action,
      Details = domainEvent.Details,
      ResourceId = domainEvent.ResourceId,
      Timestamp = auditEntry.Timestamp,
      CorrelationId = domainEvent.CorrelationId
    }, cancellationToken);

    // 3. Defer SignalR push to AFTER the transaction commits.
    //    Pre-refactor, this fired before commit and could ghost-notify
    //    users about state changes that ultimately rolled back.
    _dbContext.RegisterPostCommitAction(ct =>
      _realTimeNotifier.SendSecurityEventAsync(
        domainEvent.TenantId.Value.ToString(),
        "PrivilegeChange",
        new {
          EventId = auditEntry.Id,
          Timestamp = auditEntry.Timestamp,
          Action = domainEvent.Action,
          ResourceId = domainEvent.ResourceId
        },
        ct));
  }
```

- [ ] **Step 2: Build and run all tests**

Run: `dotnet build`
Then: `dotnet test`
Expected: passes. Pre-existing handler-flow tests now exercise the UoW + post-commit-action pathway end to end.

- [ ] **Step 3: Commit**

```bash
git add libs/core/infrastructure/Persistence/Handlers/PrivilegeChangeEventHandler.cs
git commit -m "refactor(handlers): make PrivilegeChangeEventHandler a pure mutator

Removes the in-handler SaveChangesAsync and moves the SignalR push to a
post-commit action. The handler now stages all DB work in the ChangeTracker
and lets the PortalDbContext UoW orchestrator commit it atomically."
```

---

### Task 9: Refactor `SecuritySettingChangeEventHandler`

**Files:**
- Modify: `libs/core/infrastructure/Persistence/Handlers/SecuritySettingChangeEventHandler.cs`

- [ ] **Step 1: Rewrite the `Handle` method**

Replace the body of `Handle` (lines 35-77) with:

```csharp
  public async Task Handle(DomainEventNotification<SecuritySettingChangeEvent> notification, CancellationToken cancellationToken) {
    var domainEvent = notification.DomainEvent;

    // 1. Stage immutable audit entry — UoW commits.
    var auditEntry = new AuditEntry(
        domainEvent.TenantId,
        domainEvent.UserId,
        "SecuritySettingChange",
        domainEvent.ResourceId,
        domainEvent.CorrelationId,
        domainEvent.IpAddress,
        $"Security setting changed: {domainEvent.SettingName}. {domainEvent.Details}"
    );
    _dbContext.AuditLogs.Add(auditEntry);

    // 2. Stage outbox row for cross-app delivery.
    await _messageBus.PublishAsync(new {
      EventName = "SecuritySettingChange",
      EventId = auditEntry.Id,
      TenantId = domainEvent.TenantId.Value,
      UserId = domainEvent.UserId,
      SettingName = domainEvent.SettingName,
      Details = domainEvent.Details,
      ResourceId = domainEvent.ResourceId,
      Timestamp = auditEntry.Timestamp,
      CorrelationId = domainEvent.CorrelationId
    }, cancellationToken);

    // 3. Defer SignalR push to AFTER commit.
    _dbContext.RegisterPostCommitAction(ct =>
      _realTimeNotifier.SendSecurityEventAsync(
        domainEvent.TenantId.Value.ToString(),
        "SecuritySettingChange",
        new {
          EventId = auditEntry.Id,
          Timestamp = auditEntry.Timestamp,
          SettingName = domainEvent.SettingName,
          ResourceId = domainEvent.ResourceId
        },
        ct));
  }
```

- [ ] **Step 2: Build and test**

Run: `dotnet build && dotnet test`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add libs/core/infrastructure/Persistence/Handlers/SecuritySettingChangeEventHandler.cs
git commit -m "refactor(handlers): make SecuritySettingChangeEventHandler a pure mutator"
```

---

### Task 10: Refactor `LoginAnomalyEventHandler`

**Files:**
- Modify: `libs/core/infrastructure/Persistence/Handlers/LoginAnomalyEventHandler.cs`

- [ ] **Step 1: Rewrite the `Handle` method**

Replace the body of `Handle` (lines 35-76) with:

```csharp
  public async Task Handle(DomainEventNotification<LoginAnomalyEvent> notification, CancellationToken cancellationToken) {
    var domainEvent = notification.DomainEvent;

    // 1. Stage immutable audit entry — UoW commits.
    var auditEntry = new AuditEntry(
        domainEvent.TenantId,
        domainEvent.UserId,
        "LoginAnomaly",
        domainEvent.EventId.ToString(),
        domainEvent.CorrelationId,
        domainEvent.IpAddress,
        $"Login anomaly detected: {domainEvent.Reason}. {domainEvent.Details}"
    );
    _dbContext.AuditLogs.Add(auditEntry);

    // 2. Stage outbox row for cross-app delivery (SIEM, etc.).
    await _messageBus.PublishAsync(new {
      EventName = "LoginAnomaly",
      EventId = auditEntry.Id,
      TenantId = domainEvent.TenantId.Value,
      UserId = domainEvent.UserId,
      Reason = domainEvent.Reason,
      Details = domainEvent.Details,
      IpAddress = domainEvent.IpAddress,
      Timestamp = auditEntry.Timestamp,
      CorrelationId = domainEvent.CorrelationId
    }, cancellationToken);

    // 3. Defer SignalR push to AFTER commit.
    _dbContext.RegisterPostCommitAction(ct =>
      _realTimeNotifier.SendSecurityEventAsync(
        domainEvent.TenantId.Value.ToString(),
        "LoginAnomaly",
        new {
          EventId = auditEntry.Id,
          Timestamp = auditEntry.Timestamp,
          Reason = domainEvent.Reason
        },
        ct));
  }
```

- [ ] **Step 2: Build and test**

Run: `dotnet build && dotnet test`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add libs/core/infrastructure/Persistence/Handlers/LoginAnomalyEventHandler.cs
git commit -m "refactor(handlers): make LoginAnomalyEventHandler a pure mutator"
```

---

### Task 11: Static regression test — handlers must not call `SaveChangesAsync`

**Files:**
- Create: `libs/core/infrastructure.tests/Messaging/HandlerInvariantTests.cs`

- [ ] **Step 1: Write the test**

Create `libs/core/infrastructure.tests/Messaging/HandlerInvariantTests.cs`:

```csharp
using FluentAssertions;
using System;
using System.IO;
using System.Linq;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Messaging;

/// <summary>
/// Static guard against future regressions of the Unit-of-Work invariant:
/// no INotificationHandler implementation may call _dbContext.SaveChangesAsync(...)
/// directly. PortalDbContext orchestrates its own commit. Handlers stage changes.
/// </summary>
public class HandlerInvariantTests {

  [Fact]
  public void NoHandler_CallsDbContextSaveChangesAsync() {
    var handlersDir = LocateHandlersDirectory();
    var offenders = Directory.GetFiles(handlersDir, "*.cs", SearchOption.AllDirectories)
      .Where(path => !path.EndsWith(".g.cs", StringComparison.Ordinal))
      .Select(path => new {
        File = Path.GetFileName(path),
        Lines = File.ReadAllLines(path)
          .Select((line, idx) => new { Line = line, Number = idx + 1 })
          .Where(l => l.Line.Contains("_dbContext.SaveChangesAsync",
            StringComparison.Ordinal))
          .ToList()
      })
      .Where(x => x.Lines.Count > 0)
      .ToList();

    offenders.Should().BeEmpty(
      "handlers must register changes via Add()/Update()/Remove() and " +
      "post-commit side effects via RegisterPostCommitAction(...). The " +
      "PortalDbContext UoW commits the transaction. Offending lines: " +
      string.Join("; ", offenders.SelectMany(o => o.Lines.Select(l =>
        $"{o.File}:{l.Number}"))));
  }

  private static string LocateHandlersDirectory() {
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir != null && !File.Exists(Path.Combine(dir.FullName, "tai-portal.sln"))) {
      dir = dir.Parent;
    }
    if (dir == null) throw new InvalidOperationException("solution root not found");
    return Path.Combine(dir.FullName, "libs", "core", "infrastructure",
      "Persistence", "Handlers");
  }
}
```

(If `tai-portal.sln` isn't the actual solution file name, replace with the real one. Verify with `ls *.sln` from the repo root.)

- [ ] **Step 2: Verify the actual solution filename**

Run: `ls *.sln`
Expected: a single `.sln` file. If the name differs from `tai-portal.sln`, update the `LocateHandlersDirectory` method accordingly.

- [ ] **Step 3: Run the test**

Run: `dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj --filter "FullyQualifiedName~HandlerInvariantTests"`
Expected: passes (no offenders after Tasks 8-10).

- [ ] **Step 4: Sanity-check the guard fires**

Temporarily add `await _dbContext.SaveChangesAsync(cancellationToken);` to one handler, re-run the test, confirm it FAILS with a useful offender message, then revert.

- [ ] **Step 5: Commit**

```bash
git add libs/core/infrastructure.tests/Messaging/HandlerInvariantTests.cs
git commit -m "test: add static regression guard for handler SaveChangesAsync invariant"
```

---

## Phase 5: RabbitMQ Publisher Infrastructure

### Task 12: `IIntegrationEventPublisher` interface + `RabbitMqOptions`

**Files:**
- Create: `libs/core/application/Interfaces/IIntegrationEventPublisher.cs`
- Create: `libs/core/infrastructure/Messaging/RabbitMqOptions.cs`

- [ ] **Step 1: Create the abstraction**

Create `libs/core/application/Interfaces/IIntegrationEventPublisher.cs`:

```csharp
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;

namespace Tai.Portal.Core.Application.Interfaces;

/// <summary>
/// Publishes a single outbox message to a message broker.
/// Implementations are broker-specific (RabbitMQ in Stage 1B; SNS / SQS / EventBridge / Kafka are future Stage-2 swaps).
/// </summary>
/// <remarks>
/// JUNIOR RATIONALE (broker swap point):
/// IMessageBus is the OUTBOX write point — same regardless of broker.
/// IIntegrationEventPublisher is the BROKER point — what changes when we
/// move from RabbitMQ to AWS SNS/SQS or Kafka. Splitting these means a
/// broker swap is a single class + DI registration change; the outbox,
/// worker loop, retry logic, and SKIP-LOCKED machinery all stay the same.
/// </remarks>
public interface IIntegrationEventPublisher {
  Task PublishAsync(OutboxMessage message, CancellationToken cancellationToken);
}
```

(There is a project reference quirk to consider: `application` project does not currently reference `infrastructure`. If the `OutboxMessage` import causes a circular reference, move the entity to a shared location, OR change the interface signature to take primitive args (`string eventType, string payload, string? correlationId, Guid id`). Verify in Step 2.)

- [ ] **Step 2: Verify project reference direction**

Run: `dotnet build libs/core/application/Tai.Portal.Core.Application.csproj`
- If it builds: proceed to Step 3.
- If it fails with a missing reference to `Tai.Portal.Core.Infrastructure`: replace the interface with a primitive-arg signature instead:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Tai.Portal.Core.Application.Interfaces;

public interface IIntegrationEventPublisher {
  Task PublishAsync(
    Guid messageId,
    string eventType,
    string payload,
    string? correlationId,
    CancellationToken cancellationToken);
}
```

…and adjust callers/implementations downstream to pass primitives. Document the chosen signature in a one-line comment at the top of the file so future tasks reference it consistently.

- [ ] **Step 3: Create `RabbitMqOptions`**

Create `libs/core/infrastructure/Messaging/RabbitMqOptions.cs`:

```csharp
namespace Tai.Portal.Core.Infrastructure.Messaging;

public class RabbitMqOptions {
  public const string SectionName = "RabbitMq";

  public string HostName { get; set; } = "localhost";
  public int Port { get; set; } = 5672;
  public string UserName { get; set; } = "portal";
  public string Password { get; set; } = "portal";
  public string VirtualHost { get; set; } = "/";

  /// <summary>Topic exchange name. Created (durable) on connection open.</summary>
  public string ExchangeName { get; set; } = "portal.events";

  /// <summary>Publisher confirm wait timeout, milliseconds.</summary>
  public int ConfirmTimeoutMs { get; set; } = 5000;
}
```

- [ ] **Step 4: Build**

Run: `dotnet build`
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add libs/core/application/Interfaces/IIntegrationEventPublisher.cs \
        libs/core/infrastructure/Messaging/RabbitMqOptions.cs
git commit -m "feat(messaging): add IIntegrationEventPublisher abstraction + RabbitMqOptions"
```

---

### Task 13: `IRabbitMqConnectionProvider` + implementation

**Files:**
- Create: `libs/core/infrastructure/Messaging/IRabbitMqConnectionProvider.cs`
- Create: `libs/core/infrastructure/Messaging/RabbitMqConnectionProvider.cs`

- [ ] **Step 1: Create the interface**

Create `libs/core/infrastructure/Messaging/IRabbitMqConnectionProvider.cs`:

```csharp
using RabbitMQ.Client;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// Holds a singleton AMQP connection for the application instance.
/// </summary>
/// <remarks>
/// JUNIOR RATIONALE (Connection lifecycle):
/// AMQP connections are HEAVY (TLS handshake, AMQP handshake, heartbeats).
/// You open ONE per application instance and reuse it. Channels (IModel) are
/// the cheap thing — open one per logical operation or per worker thread.
/// </remarks>
public interface IRabbitMqConnectionProvider {
  IConnection Connection { get; }
}
```

- [ ] **Step 2: Create the implementation**

Create `libs/core/infrastructure/Messaging/RabbitMqConnectionProvider.cs`:

```csharp
using System;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// Singleton holder for a single IConnection. Created lazily on first access
/// so app startup doesn't fail if the broker isn't up yet.
/// </summary>
public class RabbitMqConnectionProvider : IRabbitMqConnectionProvider, IDisposable {
  private readonly object _lock = new();
  private readonly RabbitMqOptions _options;
  private IConnection? _connection;
  private bool _disposed;

  public RabbitMqConnectionProvider(IOptions<RabbitMqOptions> options) {
    _options = options.Value;
  }

  public IConnection Connection {
    get {
      if (_disposed) throw new ObjectDisposedException(nameof(RabbitMqConnectionProvider));
      if (_connection is { IsOpen: true }) return _connection;
      lock (_lock) {
        if (_connection is { IsOpen: true }) return _connection;
        _connection?.Dispose();
        _connection = CreateConnection();
        return _connection;
      }
    }
  }

  private IConnection CreateConnection() {
    var factory = new ConnectionFactory {
      HostName = _options.HostName,
      Port = _options.Port,
      UserName = _options.UserName,
      Password = _options.Password,
      VirtualHost = _options.VirtualHost,
      // JUNIOR RATIONALE (Automatic recovery):
      // Networks blip, brokers restart, k8s reschedules. AutomaticRecovery
      // tells the client to reconnect transparently. TopologyRecovery
      // re-declares exchanges/queues after reconnect — without it, the
      // connection comes back but publishes target exchanges that no
      // longer exist on the broker.
      AutomaticRecoveryEnabled = true,
      TopologyRecoveryEnabled = true,
      NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
    };
    return factory.CreateConnection("portal-api");
  }

  public void Dispose() {
    if (_disposed) return;
    _disposed = true;
    _connection?.Close();
    _connection?.Dispose();
  }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add libs/core/infrastructure/Messaging/IRabbitMqConnectionProvider.cs \
        libs/core/infrastructure/Messaging/RabbitMqConnectionProvider.cs
git commit -m "feat(messaging): add singleton RabbitMqConnectionProvider"
```

---

### Task 14: `RabbitMqPublisher`

**Files:**
- Create: `libs/core/infrastructure/Messaging/RabbitMqPublisher.cs`

- [ ] **Step 1: Create the publisher**

Create `libs/core/infrastructure/Messaging/RabbitMqPublisher.cs`. This implementation assumes the `OutboxMessage`-typed interface from Task 12 Step 1. If you switched to the primitive-arg signature in Step 2, adapt the method signature and remove the `using ...Entities` import — the body is otherwise unchanged.

```csharp
using System;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// Publishes OutboxMessages to a RabbitMQ topic exchange using raw RabbitMQ.Client.
/// One channel per publish call (simple; production would pool channels).
/// Uses publisher confirms (WaitForConfirmsOrDie) for at-least-once delivery.
/// </summary>
public class RabbitMqPublisher : IIntegrationEventPublisher {
  private readonly IRabbitMqConnectionProvider _connectionProvider;
  private readonly RabbitMqOptions _options;
  private readonly ILogger<RabbitMqPublisher> _logger;
  private readonly object _exchangeLock = new();
  private bool _exchangeDeclared;

  public RabbitMqPublisher(
      IRabbitMqConnectionProvider connectionProvider,
      IOptions<RabbitMqOptions> options,
      ILogger<RabbitMqPublisher> logger) {
    _connectionProvider = connectionProvider;
    _options = options.Value;
    _logger = logger;
  }

  public Task PublishAsync(OutboxMessage message, CancellationToken cancellationToken) {
    cancellationToken.ThrowIfCancellationRequested();

    using var channel = _connectionProvider.Connection.CreateModel();

    // JUNIOR RATIONALE (Publisher confirms):
    // ConfirmSelect puts the channel into "confirm mode" — every basic.publish
    // gets an acknowledgement (or NACK) from the broker. WaitForConfirmsOrDie
    // BLOCKS until all outstanding publishes are acknowledged or throws on
    // NACK / timeout. Without this, basic.publish is fire-and-forget and a
    // crashed broker silently swallows your messages.
    channel.ConfirmSelect();

    EnsureExchangeDeclared(channel);

    var routingKey = DeriveRoutingKey(message.EventType);
    var body = Encoding.UTF8.GetBytes(message.Payload);

    var props = channel.CreateBasicProperties();
    props.MessageId = message.Id.ToString();
    props.ContentType = "application/json";
    props.DeliveryMode = 2;                  // persistent — survives broker restart
    props.Type = message.EventType;
    props.Timestamp = new AmqpTimestamp(message.OccurredAt.ToUnixTimeSeconds());
    if (!string.IsNullOrEmpty(message.CorrelationId)) {
      props.CorrelationId = message.CorrelationId;
    }

    channel.BasicPublish(
      exchange: _options.ExchangeName,
      routingKey: routingKey,
      mandatory: false,
      basicProperties: props,
      body: body);

    // JUNIOR RATIONALE (Synchronous confirm for simplicity):
    // For high throughput you'd batch publishes and use the async confirm
    // callbacks. For Stage 1B (one message per publish call from a polling
    // worker), the synchronous wait is the simpler correct choice.
    channel.WaitForConfirmsOrDie(TimeSpan.FromMilliseconds(_options.ConfirmTimeoutMs));

    _logger.LogDebug(
      "Published outbox message {MessageId} to {Exchange} with routing key {RoutingKey}",
      message.Id, _options.ExchangeName, routingKey);

    return Task.CompletedTask;
  }

  private void EnsureExchangeDeclared(IModel channel) {
    if (_exchangeDeclared) return;
    lock (_exchangeLock) {
      if (_exchangeDeclared) return;
      // Topic exchange — supports wildcard routing-key bindings on consumers.
      // Durable — survives broker restart.
      channel.ExchangeDeclare(
        exchange: _options.ExchangeName,
        type: ExchangeType.Topic,
        durable: true,
        autoDelete: false);
      _exchangeDeclared = true;
    }
  }

  /// <summary>
  /// Derives "security.privilege-changed"-style routing keys from CLR type names
  /// like "Tai.Portal.Core.Domain.Events.PrivilegeChangeEvent".
  /// </summary>
  private static string DeriveRoutingKey(string eventType) {
    // Take only the type name (last segment of the namespace, before `,assembly`).
    var simpleName = eventType.Split(',')[0].Split('.').Last();
    if (simpleName.EndsWith("Event", StringComparison.Ordinal)) {
      simpleName = simpleName[..^"Event".Length];
    }

    // PascalCase -> kebab-case: "PrivilegeChange" -> "privilege-change"
    var sb = new StringBuilder();
    for (int i = 0; i < simpleName.Length; i++) {
      var c = simpleName[i];
      if (i > 0 && char.IsUpper(c)) sb.Append('-');
      sb.Append(char.ToLowerInvariant(c));
    }

    // All Stage 1B events are security-bounded.
    // Future: derive bounded-context prefix from a [BoundedContext] attribute
    // or a registry. For now, hard-code "security." until cross-bounded-context
    // events appear.
    return $"security.{sb}";
  }
}
```

- [ ] **Step 2: Build**

Run: `dotnet build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add libs/core/infrastructure/Messaging/RabbitMqPublisher.cs
git commit -m "feat(messaging): add RabbitMqPublisher (raw RabbitMQ.Client + publisher confirms)"
```

---

## Phase 6: Background Service

### Task 15: `OutboxOptions` + `OutboxPublisherBackgroundService` + DI wiring

**Files:**
- Create: `libs/core/infrastructure/Messaging/OutboxOptions.cs`
- Create: `libs/core/infrastructure/Messaging/OutboxPublisherBackgroundService.cs`
- Modify: `apps/portal-api/Program.cs`
- Modify: `apps/portal-api/appsettings.json`

- [ ] **Step 1: Create `OutboxOptions`**

Create `libs/core/infrastructure/Messaging/OutboxOptions.cs`:

```csharp
using System;

namespace Tai.Portal.Core.Infrastructure.Messaging;

public class OutboxOptions {
  public const string SectionName = "Outbox";

  public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(2);
  public TimeSpan ErrorBackoff { get; set; } = TimeSpan.FromSeconds(10);
  public int BatchSize { get; set; } = 50;
}
```

- [ ] **Step 2: Create the background service**

Create `libs/core/infrastructure/Messaging/OutboxPublisherBackgroundService.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;

namespace Tai.Portal.Core.Infrastructure.Messaging;

/// <summary>
/// Polls the OutboxMessages table and publishes unprocessed rows to RabbitMQ.
/// Uses SELECT FOR UPDATE SKIP LOCKED so multiple instances can run in parallel
/// without duplicate sends or blocking each other.
/// </summary>
/// <remarks>
/// JUNIOR RATIONALE (BackgroundService and scoped DbContext):
/// IHostedService runs as a singleton, but PortalDbContext is scoped. We
/// CreateAsyncScope() per iteration to get a fresh DbContext, do the work,
/// and dispose. This is the canonical pattern for background work that
/// touches scoped services in ASP.NET Core.
///
/// JUNIOR RATIONALE (Process isolation invariant):
/// This class and its dependencies do NOT reference IHttpContextAccessor,
/// HttpContext, or any controller/middleware types. Future extraction to
/// a standalone .NET Worker project becomes a cut-and-paste operation —
/// no untangling of HTTP coupling.
/// </remarks>
public class OutboxPublisherBackgroundService : BackgroundService {
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly IIntegrationEventPublisher _publisher;
  private readonly OutboxOptions _options;
  private readonly ILogger<OutboxPublisherBackgroundService> _logger;

  public OutboxPublisherBackgroundService(
      IServiceScopeFactory scopeFactory,
      IIntegrationEventPublisher publisher,
      IOptions<OutboxOptions> options,
      ILogger<OutboxPublisherBackgroundService> logger) {
    _scopeFactory = scopeFactory;
    _publisher = publisher;
    _options = options.Value;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
    _logger.LogInformation("Outbox publisher started. Poll interval={Interval}, batch={Batch}",
      _options.PollInterval, _options.BatchSize);

    while (!stoppingToken.IsCancellationRequested) {
      try {
        var processed = await ProcessBatchAsync(stoppingToken);
        if (processed == 0) {
          await Task.Delay(_options.PollInterval, stoppingToken);
        }
        // Full batch -> loop immediately to drain backlog.
      }
      catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) {
        break;
      }
      catch (Exception ex) {
        _logger.LogError(ex, "Outbox publisher loop error; backing off");
        await Task.Delay(_options.ErrorBackoff, stoppingToken);
      }
    }

    _logger.LogInformation("Outbox publisher stopping");
  }

  private async Task<int> ProcessBatchAsync(CancellationToken cancellationToken) {
    await using var scope = _scopeFactory.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

    // JUNIOR RATIONALE (SELECT FOR UPDATE SKIP LOCKED):
    // Multiple publisher instances (app replicas, or future extracted workers)
    // can run this loop simultaneously. Without row locking, two workers grab
    // the same row and publish it twice. Without SKIP LOCKED, worker B BLOCKS
    // on worker A's lock until A commits — throughput collapses to single-
    // threaded. SKIP LOCKED tells Postgres: "if someone else holds it, skip
    // and give me the next row." This is THE standard PG pattern for work-
    // queue consumption (same mechanism pgmq and pg_cron's runner use).
    // Postgres is the coordinator — no Redis, no leader election.
    var batch = await db.OutboxMessages
      .FromSqlRaw(@"
        SELECT * FROM ""OutboxMessages""
        WHERE ""ProcessedAt"" IS NULL
        ORDER BY ""OccurredAt""
        LIMIT {0}
        FOR UPDATE SKIP LOCKED", _options.BatchSize)
      .ToListAsync(cancellationToken);

    if (batch.Count == 0) {
      await tx.CommitAsync(cancellationToken);
      return 0;
    }

    foreach (var msg in batch) {
      try {
        await _publisher.PublishAsync(msg, cancellationToken);
        msg.ProcessedAt = DateTimeOffset.UtcNow;
        msg.Error = null;
      }
      catch (Exception ex) {
        msg.RetryCount++;
        msg.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
        // ProcessedAt stays null -> retry on next poll.
        _logger.LogWarning(ex, "Failed to publish outbox message {MessageId} (retry {Retry})",
          msg.Id, msg.RetryCount);
      }
    }

    await db.SaveChangesAsync(cancellationToken);
    await tx.CommitAsync(cancellationToken);
    return batch.Count;
  }
}
```

- [ ] **Step 3: Wire DI in `Program.cs`**

In `apps/portal-api/Program.cs`, after the `builder.Services.AddScoped<IMessageBus, ...OutboxMessageBus>();` line you added in Task 7, add:

```csharp
// Outbox + RabbitMQ wiring (Stage 1B).
builder.Services.Configure<Tai.Portal.Core.Infrastructure.Messaging.RabbitMqOptions>(
  builder.Configuration.GetSection(Tai.Portal.Core.Infrastructure.Messaging.RabbitMqOptions.SectionName));
builder.Services.Configure<Tai.Portal.Core.Infrastructure.Messaging.OutboxOptions>(
  builder.Configuration.GetSection(Tai.Portal.Core.Infrastructure.Messaging.OutboxOptions.SectionName));
builder.Services.AddSingleton<Tai.Portal.Core.Infrastructure.Messaging.IRabbitMqConnectionProvider,
                              Tai.Portal.Core.Infrastructure.Messaging.RabbitMqConnectionProvider>();
builder.Services.AddSingleton<Tai.Portal.Core.Application.Interfaces.IIntegrationEventPublisher,
                              Tai.Portal.Core.Infrastructure.Messaging.RabbitMqPublisher>();
builder.Services.AddHostedService<Tai.Portal.Core.Infrastructure.Messaging.OutboxPublisherBackgroundService>();
```

- [ ] **Step 4: Add config to `appsettings.json`**

In `apps/portal-api/appsettings.json`, add (alongside `ConnectionStrings`, `Logging`, etc.):

```json
  "RabbitMq": {
    "HostName": "localhost",
    "Port": 5672,
    "UserName": "portal",
    "Password": "portal",
    "VirtualHost": "/",
    "ExchangeName": "portal.events",
    "ConfirmTimeoutMs": 5000
  },
  "Outbox": {
    "PollInterval": "00:00:02",
    "ErrorBackoff": "00:00:10",
    "BatchSize": 50
  }
```

(`appsettings.Development.json` may need overrides if it exists — check and update if so.)

- [ ] **Step 5: Build, run app, smoke-test**

Run: `dotnet build`
Then start the app:

```bash
docker compose up -d postgres rabbitmq
dotnet run --project apps/portal-api/portal-api.csproj
```

In the logs, expect: `Outbox publisher started. Poll interval=00:00:02, batch=50` (or similar). Stop the app (Ctrl-C). Check no exceptions in startup or shutdown.

- [ ] **Step 6: Commit**

```bash
git add libs/core/infrastructure/Messaging/OutboxOptions.cs \
        libs/core/infrastructure/Messaging/OutboxPublisherBackgroundService.cs \
        apps/portal-api/Program.cs \
        apps/portal-api/appsettings.json
git commit -m "feat(messaging): add OutboxPublisherBackgroundService + DI + config

Polling worker with SELECT FOR UPDATE SKIP LOCKED for multi-instance safety.
Uses CreateAsyncScope per iteration to honor scoped DbContext lifetime."
```

---

## Phase 7: Integration Tests (Testcontainers)

### Task 16: `OutboxFixture` (PostgreSQL + RabbitMQ) + happy-path E2E test

**Files:**
- Create: `apps/portal-api.integration-tests/Outbox/OutboxFixture.cs`
- Create: `apps/portal-api.integration-tests/Outbox/OutboxIntegrationTests.cs`

- [ ] **Step 1: Create the shared fixture**

Create `apps/portal-api.integration-tests/Outbox/OutboxFixture.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using RabbitMQ.Client;
using Tai.Portal.Core.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Xunit;

namespace portal_api.integration_tests.Outbox;

public class OutboxFixture : IAsyncLifetime {
  public PostgreSqlContainer Postgres { get; } = new PostgreSqlBuilder("postgres:17")
    .WithDatabase("portal_test")
    .WithUsername("postgres")
    .WithPassword("postgres")
    .Build();

  public RabbitMqContainer Rabbit { get; } = new RabbitMqBuilder()
    .WithImage("rabbitmq:3-management")
    .WithUsername("portal")
    .WithPassword("portal")
    .Build();

  public WebApplicationFactory<Program> Factory { get; private set; } = null!;

  public async Task InitializeAsync() {
    await Task.WhenAll(Postgres.StartAsync(), Rabbit.StartAsync());

    Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => {
      builder.ConfigureAppConfiguration((_, cfg) => {
        cfg.AddInMemoryCollection(new Dictionary<string, string?> {
          ["RabbitMq:HostName"] = Rabbit.Hostname,
          ["RabbitMq:Port"]     = Rabbit.GetMappedPublicPort(5672).ToString(),
          ["RabbitMq:UserName"] = "portal",
          ["RabbitMq:Password"] = "portal",
          ["RabbitMq:ExchangeName"] = "portal.events",
          ["Outbox:PollInterval"] = "00:00:00.500",
          ["Outbox:BatchSize"] = "10",
        });
      });
      builder.ConfigureServices(services => {
        var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<PortalDbContext>));
        if (descriptor != null) services.Remove(descriptor);
        services.AddDbContext<PortalDbContext>(options => {
          var npgsql = new NpgsqlDataSourceBuilder(Postgres.GetConnectionString());
          npgsql.EnableDynamicJson();
          options.UseNpgsql(npgsql.Build());
        });
      });
    });

    using var scope = Factory.Services.CreateScope();
    var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    await ctx.Database.MigrateAsync();
  }

  /// <summary>
  /// Declares a temporary queue + binding for tests so the publisher's messages
  /// land somewhere we can read. Returns (channel, queueName) — caller owns disposal.
  /// </summary>
  public (IConnection conn, IModel channel, string queueName) BindTestQueue(string routingKeyPattern) {
    var factory = new ConnectionFactory {
      HostName = Rabbit.Hostname,
      Port = Rabbit.GetMappedPublicPort(5672),
      UserName = "portal",
      Password = "portal",
    };
    var conn = factory.CreateConnection("integration-test");
    var ch = conn.CreateModel();
    ch.ExchangeDeclare("portal.events", ExchangeType.Topic, durable: true);
    var q = ch.QueueDeclare(queue: "", durable: false, exclusive: true, autoDelete: true).QueueName;
    ch.QueueBind(q, "portal.events", routingKeyPattern);
    return (conn, ch, q);
  }

  public async Task DisposeAsync() {
    await Factory.DisposeAsync();
    await Postgres.DisposeAsync();
    await Rabbit.DisposeAsync();
  }
}

[CollectionDefinition("Outbox")]
public class OutboxCollection : ICollectionFixture<OutboxFixture> { }
```

- [ ] **Step 2: Create the happy-path E2E test**

Create `apps/portal-api.integration-tests/Outbox/OutboxIntegrationTests.cs`:

```csharp
using System;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;
using Xunit;

namespace portal_api.integration_tests.Outbox;

[Collection("Outbox")]
public class OutboxIntegrationTests {
  private readonly OutboxFixture _fx;
  public OutboxIntegrationTests(OutboxFixture fx) => _fx = fx;

  [Fact]
  public async Task PublishingViaIMessageBus_LandsInRabbit_AfterCommit() {
    // Arrange — bind a test queue to receive any security.* event.
    var (conn, channel, queueName) = _fx.BindTestQueue("security.#");
    using var _conn = conn;
    using var _ch = channel;

    // Use the running app's DI to write through OutboxMessageBus inside a UoW.
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var bus = scope.ServiceProvider.GetRequiredService<IMessageBus>();
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      await bus.PublishAsync(new {
        EventName = "PrivilegeChange",
        UserId = "u-1",
        At = DateTimeOffset.UtcNow,
      });
      await ctx.SaveChangesAsync();
    }

    // Act — wait for the worker to publish (poll interval 500ms in fixture).
    var deadline = DateTime.UtcNow.AddSeconds(10);
    BasicGetResult? got = null;
    while (DateTime.UtcNow < deadline && got == null) {
      got = channel.BasicGet(queueName, autoAck: true);
      if (got == null) await Task.Delay(100);
    }

    // Assert — message landed.
    got.Should().NotBeNull("publisher worker should have delivered within 10s");
    Encoding.UTF8.GetString(got!.Body.ToArray()).Should().Contain("\"userId\":\"u-1\"");
    got.BasicProperties.ContentType.Should().Be("application/json");
    got.BasicProperties.DeliveryMode.Should().Be(2);

    // And the row was marked processed.
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      var row = await ctx.OutboxMessages.SingleAsync();
      row.ProcessedAt.Should().NotBeNull();
      row.RetryCount.Should().Be(0);
    }
  }
}
```

- [ ] **Step 3: Run the test**

Run: `dotnet test apps/portal-api.integration-tests/portal-api.integration-tests.csproj --filter "FullyQualifiedName~OutboxIntegrationTests"`
Expected: passes (containers start, message lands, row marked processed). May take 30-60s on first run while Docker pulls images.

- [ ] **Step 4: Commit**

```bash
git add apps/portal-api.integration-tests/Outbox/
git commit -m "test(integration): outbox happy-path E2E with Postgres+RabbitMQ Testcontainers"
```

---

### Task 17: Failure-mode integration tests

**Files:**
- Modify: `apps/portal-api.integration-tests/Outbox/OutboxIntegrationTests.cs`

- [ ] **Step 1: Add the SKIP LOCKED concurrency test**

Append to `OutboxIntegrationTests.cs` inside the class:

```csharp
  [Fact]
  public async Task SkipLocked_TwoConcurrentReaders_PartitionRowsExclusively() {
    // Seed 100 rows directly via DbContext.
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      // Wipe any earlier test rows from prior tests in this collection.
      ctx.OutboxMessages.RemoveRange(ctx.OutboxMessages);
      await ctx.SaveChangesAsync();

      for (int i = 0; i < 100; i++) {
        ctx.OutboxMessages.Add(new OutboxMessage {
          Id = Guid.NewGuid(),
          EventType = "test.SkipLockedEvent",
          Payload = $"{{\"i\":{i}}}",
          OccurredAt = DateTimeOffset.UtcNow,
        });
      }
      await ctx.SaveChangesAsync();
    }

    // Two parallel readers each take SKIP LOCKED batches and accumulate IDs.
    async Task<List<Guid>> DrainAsync() {
      var taken = new List<Guid>();
      using var scope = _fx.Factory.Services.CreateScope();
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      while (true) {
        await using var tx = await ctx.Database.BeginTransactionAsync();
        var batch = await ctx.OutboxMessages
          .FromSqlRaw(@"SELECT * FROM ""OutboxMessages""
                        WHERE ""ProcessedAt"" IS NULL
                        ORDER BY ""OccurredAt""
                        LIMIT 10
                        FOR UPDATE SKIP LOCKED")
          .ToListAsync();
        if (batch.Count == 0) { await tx.CommitAsync(); break; }
        foreach (var m in batch) {
          taken.Add(m.Id);
          m.ProcessedAt = DateTimeOffset.UtcNow;
        }
        await ctx.SaveChangesAsync();
        await tx.CommitAsync();
      }
      return taken;
    }

    var readerA = DrainAsync();
    var readerB = DrainAsync();
    var idsA = await readerA;
    var idsB = await readerB;

    var union = idsA.Concat(idsB).ToList();
    union.Should().HaveCount(100, "every row must be claimed exactly once");
    union.Distinct().Should().HaveCount(100, "no duplicate claims across readers");
    idsA.Intersect(idsB).Should().BeEmpty("disjoint partitioning");
  }
```

- [ ] **Step 2: Add the rollback-path test**

Append to the class:

```csharp
  [Fact]
  public async Task UoWRollback_DiscardsAuditAndOutbox_AndDoesNotFireSignalR() {
    var (conn, ch, q) = _fx.BindTestQueue("security.#");
    using var _ = conn; using var __ = ch;

    // Snapshot baseline counts.
    int baselineOutbox, baselineAudit;
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      baselineOutbox = await ctx.OutboxMessages.CountAsync();
      baselineAudit = await ctx.AuditLogs.CountAsync();
    }

    // Run a UoW that registers a post-commit action and then forces a failure
    // BEFORE tx.CommitAsync — the post-commit action MUST NOT fire and rows
    // MUST NOT persist.
    var sigFired = false;
    Func<Task> act = async () => {
      using var scope = _fx.Factory.Services.CreateScope();
      var bus = scope.ServiceProvider.GetRequiredService<IMessageBus>();
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      ctx.RegisterPostCommitAction(_ => { sigFired = true; return Task.CompletedTask; });
      await bus.PublishAsync(new { EventName = "RollbackTest" });
      // Force a unique-constraint or primitive failure mid-save:
      ctx.OutboxMessages.Add(new OutboxMessage {
        Id = Guid.Empty, // OK — but we'll add the same Id twice in this UoW:
        EventType = "x", Payload = "{}", OccurredAt = DateTimeOffset.UtcNow,
      });
      ctx.OutboxMessages.Add(new OutboxMessage {
        Id = Guid.Empty,
        EventType = "x", Payload = "{}", OccurredAt = DateTimeOffset.UtcNow,
      });
      await ctx.SaveChangesAsync();
    };
    await act.Should().ThrowAsync<DbUpdateException>();

    sigFired.Should().BeFalse("post-commit action must not fire on rollback");
    using (var scope = _fx.Factory.Services.CreateScope()) {
      var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      (await ctx.OutboxMessages.CountAsync()).Should().Be(baselineOutbox,
        "rollback must discard the outbox row");
      (await ctx.AuditLogs.CountAsync()).Should().Be(baselineAudit);
    }
  }
```

- [ ] **Step 3: Run the new tests**

Run: `dotnet test apps/portal-api.integration-tests/portal-api.integration-tests.csproj --filter "FullyQualifiedName~OutboxIntegrationTests"`
Expected: all three tests pass (happy-path + SKIP LOCKED + rollback). Allow up to 90s; the SKIP LOCKED test does real concurrent transactions.

- [ ] **Step 4: Commit**

```bash
git add apps/portal-api.integration-tests/Outbox/OutboxIntegrationTests.cs
git commit -m "test(integration): add SKIP LOCKED concurrency + UoW rollback E2E"
```

---

## Phase 8: Cleanup + Knowledge Base

### Task 18: Delete `LoggingMessageBus`

**Files:**
- Delete: `libs/core/infrastructure/Services/LoggingMessageBus.cs`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn LoggingMessageBus libs apps`
Expected: zero matches (Task 7 already swapped the only DI registration).

If matches appear: update each call site before deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm libs/core/infrastructure/Services/LoggingMessageBus.cs
```

- [ ] **Step 3: Build + full test sweep**

Run: `dotnet build`
Then: `dotnet test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove LoggingMessageBus stub (replaced by OutboxMessageBus)"
```

---

### Task 19: Knowledge-base case-study doc

**Files:**
- Create: `conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md`
- Create: `conductor/knowledge-base/reference/rabbitmq-outbox-case-study-mindmap.md`
- Modify: `conductor/knowledge-base/reference/message-queues.md`

The KB doc IS the explain-it test from the spec. Write it section by section, in your own words, referring back to the actual code paths you just shipped.

- [ ] **Step 1: Create the case-study doc skeleton**

Create `conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md` with this skeleton (then fill the prose body for each section, ~500-800 words per main section, citing exact file paths and line numbers from your implementation):

```markdown
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

## TL;DR

[3-5 sentences: what this codebase ships, why outbox + RabbitMQ, what the
Unit-of-Work refactor fixes that's separate from the outbox itself.]

## 1. The Problem

### 1.1 Before: `IMessageBus` stub
[The `LoggingMessageBus` story — integration events logged but not delivered.]

### 1.2 The dual-write hazard
[Why "save then publish" without coordination breaks under broker failure.]

### 1.3 The dispatch-before-save re-entrancy bug
[The handler-calls-SaveChangesAsync pattern, why it was fragile, why it
shares a root cause with the dual-write hazard.]

## 2. Architecture

### 2.1 Two event layers
[Domain events (MediatR, in-process) vs Integration events (cross-app via outbox + RabbitMQ).]

### 2.2 Why this separation matters for modular-monolith evolution
[Bounded contexts can split into services later without rewriting producers.]

## 3. Implementation Deep Dive

### 3.1 `PortalDbContext` as Unit-of-Work orchestrator
[Cite `libs/core/infrastructure/Persistence/PortalDbContext.cs` SaveChangesAsync.
Walk through the 8 steps. Explain why handlers don't call SaveChangesAsync.
Explain the post-commit action registry. Explain nested-transaction handling.]

### 3.2 `OutboxMessage` entity
[Fields, JSONB, partial-index rationale (cite the JUNIOR RATIONALE comment).]

### 3.3 `OutboxMessageBus`
[Why it doesn't SaveChanges. The runtime-type serialization gotcha.]

### 3.4 Publisher worker
[`SELECT FOR UPDATE SKIP LOCKED` — why and how. Publisher confirms.]

### 3.5 RabbitMQ primitives actually used
[Topic exchange, routing key derivation, channels, IConnection lifecycle,
AutomaticRecoveryEnabled.]

## 4. Failure Modes

[Reproduce the table from the spec design doc, then expand each row into
2-4 sentences of prose explaining what actually happens, what gets logged,
what the operator sees.]

## 5. Comparison Tables

### 5.1 Outbox vs direct publish (the dual-write table)
### 5.2 Raw `RabbitMQ.Client` vs MassTransit (line-for-line translation)
### 5.3 Polling vs PG `LISTEN/NOTIFY` vs CDC (Debezium)
### 5.4 Sync vs async batch publisher confirms
### 5.5 Broker swap matrix: RabbitMQ / Amazon MQ / SNS+SQS / EventBridge / Kafka

## 6. Interview Q&A

### L1
- What is a message queue? What is an exchange?

### L2
- Why can't you just publish after `SaveChanges`?
- What is a publisher confirm?

### L3
- How do you handle the publish/DB-commit race?
- What does at-least-once + idempotency mean in practice?
- When `FOR UPDATE SKIP LOCKED` vs PG `LISTEN/NOTIFY`?
- Why dispatch domain events AFTER `base.SaveChangesAsync`?
- Why shouldn't SignalR push happen inline in a handler?

### Staff
- How would you evolve this toward multi-region or multi-broker?
- When would you switch to Kafka?
- Modular-monolith → microservices path without rewriting producers?

## 7. What I Punted

[The Out-of-Scope list from the spec — consumer-side idempotency, dead-letter,
archival, per-aggregate ordering, separate worker process, AWS SNS/SQS swap.]

## 8. Cross-References

- `message-queues.md` §1.3 (outbox), §2.1 (RabbitMQ)
- `design-patterns.md` (outbox section)
- `mediatr-cqrs.md` (in-process event layer)
- `distributed-systems.md` (delivery semantics)
```

- [ ] **Step 2: Fill the prose**

Work section-by-section. Each section should reference real code by `path:line`. The L2/L3 Interview Q&A should be answerable from the prose above; if you can't answer one of the questions from your own doc, you haven't explained it well enough yet — go back and expand.

- [ ] **Step 3: Create the mindmap companion**

Create `conductor/knowledge-base/reference/rabbitmq-outbox-case-study-mindmap.md` matching the format used by `ngrx-state-management-mindmap.md` (peek at that file for the convention). Hierarchy: Problem → Architecture → Components → Failure Modes → Interview talking points.

- [ ] **Step 4: Add cross-references**

In `conductor/knowledge-base/reference/message-queues.md`, find sections §1.3 (outbox pattern) and §2.1 (RabbitMQ) and append to each, on a new line:

> See `rabbitmq-outbox-case-study.md` for a hands-on walkthrough grounded in this codebase.

- [ ] **Step 5: Commit**

```bash
git add conductor/knowledge-base/reference/rabbitmq-outbox-case-study.md \
        conductor/knowledge-base/reference/rabbitmq-outbox-case-study-mindmap.md \
        conductor/knowledge-base/reference/message-queues.md
git commit -m "docs(kb): add RabbitMQ+Outbox case study + mindmap + cross-refs"
```

---

## Final Verification

- [ ] **Step 1: Full build + test**

```bash
dotnet build
dotnet test
```

Expected: zero failures.

- [ ] **Step 2: Manual smoke test against real Docker**

```bash
docker compose up -d
dotnet run --project apps/portal-api/portal-api.csproj
```

In another shell, hit any endpoint that triggers a `PrivilegeChangeEvent` (e.g., a privilege grant via the gateway / API). Then:

1. Open `http://localhost:15672` (RabbitMQ management).
2. Click `Exchanges` → `portal.events`. Verify it exists, type=topic, durable=true.
3. Bind a temporary queue to `security.#` via the UI, retrigger the action, watch a message arrive in the queue with the expected routing key (e.g., `security.privilege-change`).
4. In `psql`: `SELECT "Id", "EventType", "ProcessedAt", "RetryCount" FROM "OutboxMessages" ORDER BY "OccurredAt" DESC LIMIT 5;` — confirm `ProcessedAt` is populated and `RetryCount` is 0.
5. Stop RabbitMQ (`docker compose stop rabbitmq`), trigger another action, observe rows accumulate with `ProcessedAt IS NULL` and `RetryCount > 0`. Restart (`docker compose start rabbitmq`), watch the worker drain them.

- [ ] **Step 3: Self-review against spec success criteria**

Open `docs/superpowers/specs/2026-04-19-outbox-rabbitmq-poc-design.md` Success Criteria section and tick off each of the eight items against the implementation. Any miss → file a follow-up task before declaring done.
