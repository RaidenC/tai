# Phase 3: MediatR Handlers & Claim Check Endpoint

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement MediatR notification handlers that push security events to SignalR in real-time, and create a REST endpoint for the Claim Check pattern to fetch full event details.

**Architecture:** Security events flow through MediatR pipeline. Handlers perform three actions: (1) write to AuditEntry, (2) push minimal payload to SignalR (privacy-first), (3) publish to IMessageBus for cross-app communication. REST endpoint fetches full details by ID with tenant isolation via Global Query Filters.

**Tech Stack:** .NET 10, MediatR, SignalR, EF Core, xUnit

---

## File Structure

| File | Purpose |
|------|---------|
| `libs/core/infrastructure/Persistence/Handlers/LoginAnomalyEventHandler.cs` | Handles LoginAnomalyEvent - writes audit, pushes SignalR, publishes IMessageBus |
| `libs/core/infrastructure/Persistence/Handlers/PrivilegeChangeEventHandler.cs` | Handles PrivilegeChangeEvent - same pattern |
| `libs/core/infrastructure/Persistence/Handlers/SecuritySettingChangeEventHandler.cs` | Handles SecuritySettingChangeEvent - same pattern |
| `apps/portal-api/Controllers/AuditLogsController.cs` | REST endpoint GET /api/audit-logs/{id} |
| `apps/portal-api.integration-tests/SecurityEventHandlerTests.cs` | Integration tests for handlers |
| `apps/portal-api.integration-tests/AuditLogsControllerTests.cs` | Integration tests for Claim Check endpoint |

---

## Task 1: Create LoginAnomalyEventHandler

**Files:**
- Create: `libs/core/infrastructure/Persistence/Handlers/LoginAnomalyEventHandler.cs`
- Test: `apps/portal-api.integration-tests/SecurityEventHandlerTests.cs`
- Reference: `libs/core/infrastructure/Persistence/Handlers/PrivilegeModifiedEventHandler.cs` (existing pattern)

- [ ] **Step 1: Write the failing test**

```csharp
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Tai.Portal.Api.IntegrationTests.Fixtures;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

[Collection("Database")]
public class LoginAnomalyEventHandlerTests : IClassFixture<TestDatabaseFixture> {
    private readonly TestDatabaseFixture _fixture;

    public LoginAnomalyEventHandlerTests(TestDatabaseFixture fixture) {
        _fixture = fixture;
    }

    [Fact]
    public async Task Handle_LoginAnomalyEvent_ShouldWriteAuditEntry() {
        // Arrange
        var tenantId = new TenantId(Guid.Parse("00000000-0000-0000-0000-000000000001"));
        var domainEvent = new LoginAnomalyEvent(
            tenantId,
            "user123",
            "FailedMFA",
            "User attempted login from unrecognized device",
            "192.168.1.1",
            "corr-123"
        );

        using var scope = _fixture.Services.CreateScope();
        var handler = scope.ServiceProvider.GetRequiredService<LoginAnomalyEventHandler>();
        var notification = new DomainEventNotification<LoginAnomalyEvent>(domainEvent);

        // Act
        await handler.Handle(notification, CancellationToken.None);

        // Assert - verify audit entry was written
        using var assertScope = _fixture.Services.CreateScope();
        var dbContext = assertScope.ServiceProvider.GetRequiredService<PortalDbContext>();
        var auditEntry = await dbContext.AuditLogs.FirstOrDefaultAsync(a => a.UserId == "user123");
        Assert.NotNull(auditEntry);
        Assert.Equal("LoginAnomaly", auditEntry.Action);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test apps/portal-api.integration-tests --filter "LoginAnomalyEventHandlerTests" --no-restore`
Expected: FAIL - "LoginAnomalyEventHandler" not found

- [ ] **Step 3: Create LoginAnomalyEventHandler**

```csharp
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Core.Infrastructure.Persistence.Handlers;

/// <summary>
/// Handles LoginAnomalyEvent by recording an audit log, pushing real-time notification to SignalR,
/// and publishing to IMessageBus for cross-app communication.
/// </summary>
public class LoginAnomalyEventHandler : INotificationHandler<DomainEventNotification<LoginAnomalyEvent>> {
    private readonly PortalDbContext _dbContext;
    private readonly IMessageBus _messageBus;
    private readonly ICurrentUserService _currentUserService;
    private readonly IHubContext<NotificationHub> _hubContext;

    public LoginAnomalyEventHandler(
        PortalDbContext dbContext,
        IMessageBus messageBus,
        ICurrentUserService currentUserService,
        IHubContext<NotificationHub> hubContext) {
        _dbContext = dbContext;
        _messageBus = messageBus;
        _currentUserService = currentUserService;
        _hubContext = hubContext;
    }

    public async Task Handle(DomainEventNotification<LoginAnomalyEvent> notification, CancellationToken cancellationToken) {
        var domainEvent = notification.DomainEvent;

        // 1. Record immutable audit entry
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
        await _dbContext.SaveChangesAsync(cancellationToken);

        // 2. Push privacy-first payload to SignalR (Claim Check pattern)
        // Only send eventId and timestamp - full details fetched via REST
        await _hubContext.Clients.Group(domainEvent.TenantId.Value.ToString())
            .SendAsync("SecurityEvent", new {
                EventId = auditEntry.Id,
                Timestamp = auditEntry.Timestamp,
                EventType = "LoginAnomaly",
                Reason = domainEvent.Reason
            }, cancellationToken);

        // 3. Publish to IMessageBus for other apps (DocViewer, HR System)
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
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test apps/portal-api.integration-tests --filter "LoginAnomalyEventHandlerTests" --no-restore`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/core/infrastructure/Persistence/Handlers/LoginAnomalyEventHandler.cs apps/portal-api.integration-tests/SecurityEventHandlerTests.cs
git commit -m "feat(phase3): add LoginAnomalyEventHandler with SignalR push and IMessageBus

- Writes audit entry to database
- Pushes privacy-first payload (eventId, timestamp) to SignalR
- Publishes to IMessageBus for cross-app communication

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create PrivilegeChangeEventHandler

**Files:**
- Create: `libs/core/infrastructure/Persistence/Handlers/PrivilegeChangeEventHandler.cs`
- Test: Add to `apps/portal-api.integration-tests/SecurityEventHandlerTests.cs`

- [ ] **Step 1: Write the failing test (add to existing test file)**

```csharp
[Fact]
public async Task Handle_PrivilegeChangeEvent_ShouldWriteAuditEntry() {
    // Arrange
    var tenantId = new TenantId(Guid.Parse("00000000-0000-0000-0000-000000000001"));
    var domainEvent = new PrivilegeChangeEvent(
        tenantId,
        "user123",
        "grant",
        "DocumentViewer",
        "Admin",
        "corr-456"
    );

    using var scope = _fixture.Services.CreateScope();
    var handler = scope.ServiceProvider.GetRequiredService<PrivilegeChangeEventHandler>();
    var notification = new DomainEventNotification<PrivilegeChangeEvent>(domainEvent);

    // Act
    await handler.Handle(notification, CancellationToken.None);

    // Assert
    using var assertScope = _fixture.Services.CreateScope();
    var dbContext = assertScope.ServiceProvider.GetRequiredService<PortalDbContext>();
    var auditEntry = await dbContext.AuditLogs.FirstOrDefaultAsync(a => a.UserId == "user123" && a.Action == "PrivilegeChange");
    Assert.NotNull(auditEntry);
}
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL - "PrivilegeChangeEventHandler" not found

- [ ] **Step 3: Create PrivilegeChangeEventHandler**

```csharp
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Core.Infrastructure.Persistence.Handlers;

/// <summary>
/// Handles PrivilegeChangeEvent by recording an audit log, pushing real-time notification to SignalR,
/// and publishing to IMessageBus for cross-app communication.
/// </summary>
public class PrivilegeChangeEventHandler : INotificationHandler<DomainEventNotification<PrivilegeChangeEvent>> {
    private readonly PortalDbContext _dbContext;
    private readonly IMessageBus _messageBus;
    private readonly ICurrentUserService _currentUserService;
    private readonly IHubContext<NotificationHub> _hubContext;

    public PrivilegeChangeEventHandler(
        PortalDbContext dbContext,
        IMessageBus messageBus,
        ICurrentUserService currentUserService,
        IHubContext<NotificationHub> hubContext) {
        _dbContext = dbContext;
        _messageBus = messageBus;
        _currentUserService = currentUserService;
        _hubContext = hubContext;
    }

    public async Task Handle(DomainEventNotification<PrivilegeChangeEvent> notification, CancellationToken cancellationToken) {
        var domainEvent = notification.DomainEvent;

        var details = $"Privilege {domainEvent.ChangeType}: {domainEvent.PrivilegeName} ({domainEvent.Role})";

        var auditEntry = new AuditEntry(
            domainEvent.TenantId,
            domainEvent.UserId,
            "PrivilegeChange",
            domainEvent.EventId.ToString(),
            domainEvent.CorrelationId,
            domainEvent.IpAddress,
            details
        );

        _dbContext.AuditLogs.Add(auditEntry);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Push to SignalR (privacy-first)
        await _hubContext.Clients.Group(domainEvent.TenantId.Value.ToString())
            .SendAsync("SecurityEvent", new {
                EventId = auditEntry.Id,
                Timestamp = auditEntry.Timestamp,
                EventType = "PrivilegeChange",
                ChangeType = domainEvent.ChangeType,
                PrivilegeName = domainEvent.PrivilegeName
            }, cancellationToken);

        // Publish to IMessageBus
        await _messageBus.PublishAsync(new {
            EventName = "PrivilegeChange",
            EventId = auditEntry.Id,
            TenantId = domainEvent.TenantId.Value,
            UserId = domainEvent.UserId,
            ChangeType = domainEvent.ChangeType,
            PrivilegeName = domainEvent.PrivilegeName,
            Role = domainEvent.Role,
            Timestamp = auditEntry.Timestamp,
            CorrelationId = domainEvent.CorrelationId
        }, cancellationToken);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test apps/portal-api.integration-tests --filter "PrivilegeChangeEventHandlerTests" --no-restore`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/core/infrastructure/Persistence/Handlers/PrivilegeChangeEventHandler.cs
git commit -m "feat(phase3): add PrivilegeChangeEventHandler with SignalR push and IMessageBus

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create SecuritySettingChangeEventHandler

**Files:**
- Create: `libs/core/infrastructure/Persistence/Handlers/SecuritySettingChangeEventHandler.cs`
- Test: Add to `apps/portal-api.integration-tests/SecurityEventHandlerTests.cs`

- [ ] **Step 1: Write the failing test (add to existing test file)**

```csharp
[Fact]
public async Task Handle_SecuritySettingChangeEvent_ShouldWriteAuditEntry() {
    // Arrange
    var tenantId = new TenantId(Guid.Parse("00000000-0000-0000-0000-000000000001"));
    var domainEvent = new SecuritySettingChangeEvent(
        tenantId,
        "admin123",
        "MFARequired",
        true,
        "Enabled multi-factor authentication",
        "corr-789"
    );

    using var scope = _fixture.Services.CreateScope();
    var handler = scope.ServiceProvider.GetRequiredService<SecuritySettingChangeEventHandler>();
    var notification = new DomainEventNotification<SecuritySettingChangeEvent>(domainEvent);

    // Act
    await handler.Handle(notification, CancellationToken.None);

    // Assert
    using var assertScope = _fixture.Services.CreateScope();
    var dbContext = assertScope.ServiceProvider.GetRequiredService<PortalDbContext>();
    var auditEntry = await dbContext.AuditLogs.FirstOrDefaultAsync(a => a.UserId == "admin123" && a.Action == "SecuritySettingChange");
    Assert.NotNull(auditEntry);
}
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL - "SecuritySettingChangeEventHandler" not found

- [ ] **Step 3: Create SecuritySettingChangeEventHandler**

```csharp
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Events;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Core.Infrastructure.Persistence.Handlers;

/// <summary>
/// Handles SecuritySettingChangeEvent by recording an audit log, pushing real-time notification to SignalR,
/// and publishing to IMessageBus for cross-app communication.
/// </summary>
public class SecuritySettingChangeEventHandler : INotificationHandler<DomainEventNotification<SecuritySettingChangeEvent>> {
    private readonly PortalDbContext _dbContext;
    private readonly IMessageBus _messageBus;
    private readonly ICurrentUserService _currentUserService;
    private readonly IHubContext<NotificationHub> _hubContext;

    public SecuritySettingChangeEventHandler(
        PortalDbContext dbContext,
        IMessageBus messageBus,
        ICurrentUserService currentUserService,
        IHubContext<NotificationHub> hubContext) {
        _dbContext = dbContext;
        _messageBus = messageBus;
        _currentUserService = currentUserService;
        _hubContext = hubContext;
    }

    public async Task Handle(DomainEventNotification<SecuritySettingChangeEvent> notification, CancellationToken cancellationToken) {
        var domainEvent = notification.DomainEvent;

        var details = $"Setting '{domainEvent.SettingName}' changed to '{domainEvent.NewValue}'. {domainEvent.Reason}";

        var auditEntry = new AuditEntry(
            domainEvent.TenantId,
            domainEvent.UserId,
            "SecuritySettingChange",
            domainEvent.EventId.ToString(),
            domainEvent.CorrelationId,
            domainEvent.IpAddress,
            details
        );

        _dbContext.AuditLogs.Add(auditEntry);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Push to SignalR (privacy-first)
        await _hubContext.Clients.Group(domainEvent.TenantId.Value.ToString())
            .SendAsync("SecurityEvent", new {
                EventId = auditEntry.Id,
                Timestamp = auditEntry.Timestamp,
                EventType = "SecuritySettingChange",
                SettingName = domainEvent.SettingName,
                NewValue = domainEvent.NewValue
            }, cancellationToken);

        // Publish to IMessageBus
        await _messageBus.PublishAsync(new {
            EventName = "SecuritySettingChange",
            EventId = auditEntry.Id,
            TenantId = domainEvent.TenantId.Value,
            UserId = domainEvent.UserId,
            SettingName = domainEvent.SettingName,
            OldValue = domainEvent.OldValue,
            NewValue = domainEvent.NewValue,
            Reason = domainEvent.Reason,
            Timestamp = auditEntry.Timestamp,
            CorrelationId = domainEvent.CorrelationId
        }, cancellationToken);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test apps/portal-api.integration-tests --filter "SecuritySettingChangeEventHandlerTests" --no-restore`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/core/infrastructure/Persistence/Handlers/SecuritySettingChangeEventHandler.cs
git commit -m "feat(phase3): add SecuritySettingChangeEventHandler with SignalR push and IMessageBus

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create AuditLogsController (Claim Check Endpoint)

**Files:**
- Create: `apps/portal-api/Controllers/AuditLogsController.cs`
- Test: Create `apps/portal-api.integration-tests/AuditLogsControllerTests.cs`

- [ ] **Step 1: Write the failing test**

```csharp
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Tai.Portal.Api.IntegrationTests.Fixtures;
using Xunit;
using Xunit.Abstractions;

namespace Tai.Portal.Api.IntegrationTests;

[Collection("Database")]
public class AuditLogsControllerTests : IClassFixture<TestDatabaseFixture> {
    private readonly TestDatabaseFixture _fixture;
    private readonly HttpClient _client;

    public AuditLogsControllerTests(TestDatabaseFixture fixture, ITestOutputHelper output) {
        _fixture = fixture;
        var application = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => {
                builder.ConfigureServices(services => {
                    // Setup test services
                });
            });
        _client = application.CreateClient();
    }

    [Fact]
    public async Task GetAuditLog_ValidId_ReturnsOkWithAuditEntry() {
        // First, create an audit entry via handler
        var tenantId = new TenantId(Guid.Parse("00000000-0000-0000-0000-000000000001"));
        var auditEntry = new AuditEntry(tenantId, "user123", "LoginAnomaly", Guid.NewGuid().ToString());

        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
        dbContext.AuditLogs.Add(auditEntry);
        await dbContext.SaveChangesAsync();

        // Act
        var response = await _client.GetAsync($"/api/audit-logs/{auditEntry.Id}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetAuditLog_InvalidId_ReturnsNotFound() {
        // Act
        var response = await _client.GetAsync($"/api/audit-logs/{Guid.NewGuid()}");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL - 404 (endpoint not found)

- [ ] **Step 3: Create AuditLogsController**

```csharp
using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Infrastructure.Persistence;

namespace Tai.Portal.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application")]
public class AuditLogsController : ControllerBase {
    private readonly PortalDbContext _dbContext;

    public AuditLogsController(PortalDbContext dbContext) {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Fetches full audit log details by ID (Claim Check pattern).
    /// Returns only the audit entry fields - not the original domain event data.
    /// Global Query Filter provides tenant isolation automatically.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetAuditLog(Guid id) {
        var auditEntry = await _dbContext.AuditLogs.FindAsync(new object[] { id, DateTimeOffset.UtcNow });

        if (auditEntry == null) {
            return NotFound(new { message = "Audit log not found" });
        }

        return Ok(new {
            auditEntry.Id,
            auditEntry.TenantId,
            auditEntry.UserId,
            auditEntry.Action,
            auditEntry.ResourceId,
            auditEntry.CorrelationId,
            auditEntry.Timestamp,
            auditEntry.IpAddress,
            auditEntry.Details
        });
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test apps/portal-api.integration-tests --filter "AuditLogsControllerTests" --no-restore`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/portal-api/Controllers/AuditLogsController.cs apps/portal-api.integration-tests/AuditLogsControllerTests.cs
git commit -m "feat(phase3): add AuditLogsController with Claim Check endpoint

- GET /api/audit-logs/{id} returns full audit entry details
- Global Query Filter provides tenant isolation
- Follows Claim Check pattern from spec

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Register Handlers and Update DI

**Files:**
- Modify: `apps/portal-api/Program.cs`

- [ ] **Step 1: Add handler registrations to Program.cs**

Find the section where MediatR handlers are registered and add:

```csharp
// Security Event Handlers
services.AddTransient<LoginAnomalyEventHandler>();
services.AddTransient<PrivilegeChangeEventHandler>();
services.AddTransient<SecuritySettingChangeEventHandler>();
```

- [ ] **Step 2: Verify build passes**

Run: `dotnet build apps/portal-api --no-restore`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add apps/portal-api/Program.cs
git commit -m "chore(phase3): register security event handlers in DI container

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

- [ ] Spec coverage: All Phase 3 requirements from plan.md implemented
- [ ] No placeholders: All code is complete and runnable
- [ ] Type consistency: Event types match domain event definitions
- [ ] Test coverage: Integration tests for handlers and endpoint

---

## Execution Choice

**Plan complete and saved to `docs/superpowers/plans/2026-03-30-phase3-security-event-handlers.md`. Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**