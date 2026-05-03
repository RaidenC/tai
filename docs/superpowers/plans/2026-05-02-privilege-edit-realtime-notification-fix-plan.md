# Privilege Edit Real-Time Notification Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore portal notification panel updates when an admin edits a privilege without weakening tenant isolation.

**Architecture:** Keep RabbitMQ/outbox for cross-app integration events and use `PortalDbContext.RegisterPostCommitAction(...)` for API-local SignalR wake-up notifications. `PrivilegeModifiedEventHandler` writes the audit row under the current request tenant, sends SignalR only to that tenant group, and the frontend claim-check fetch uses normal tenant filtering without `X-Bypass-Tenant`.

**Tech Stack:** .NET 10, EF Core 10, MediatR, SignalR, Angular, xUnit, Moq, FluentAssertions, Testcontainers PostgreSQL

---

## File Structure

**Modify:**
- `libs/core/infrastructure/Persistence/Handlers/PrivilegeModifiedEventHandler.cs`  
  Add `IRealTimeNotifier`, write audit entries under `PortalDbContext.CurrentTenantId`, and register a post-commit tenant-scoped `PrivilegeChange` SignalR notification.
- `apps/portal-api/Services/SignalRRealTimeNotifier.cs`  
  Remove the unconditional `Clients.All` security-event broadcast.
- `apps/portal-api/Controllers/AuditLogsController.cs`  
  Remove browser-controlled `X-Bypass-Tenant` behavior and use normal tenant query filtering.
- `apps/portal-web/src/app/real-time.service.ts`  
  Stop sending `X-Bypass-Tenant` on claim-check requests.
- `libs/core/infrastructure.tests/Persistence/PrivilegePersistenceTests.cs`  
  Cover audit tenant, outbox, and post-commit SignalR behavior.

**Create:**
- `libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs`  
  Cover tenant-isolated claim-check behavior and prove `X-Bypass-Tenant` is ignored.
- `libs/core/infrastructure.tests/Services/SignalRRealTimeNotifierTests.cs`  
  Cover tenant-group-only `SecurityEvent` delivery.

---

## Task 1: Add Privilege Edit SignalR Regression Test

**Files:**
- Modify: `libs/core/infrastructure.tests/Persistence/PrivilegePersistenceTests.cs`

- [ ] **Step 1: Update imports**

Add this import if missing:

```csharp
using System.Threading;
```

- [ ] **Step 2: Replace the existing privilege modification test**

Replace `Privilege_Modification_ShouldPublishEventAndAudit` with:

```csharp
[Fact]
public async Task Privilege_Modification_ShouldPublishTenantAuditOutboxAndSignalRAfterCommit() {
  var options = CreateOptions();
  var tenantId = new TenantId(Guid.Parse("11111111-1111-1111-1111-111111111111"));

  var tenantServiceMock = new Mock<ITenantService>();
  tenantServiceMock.Setup(s => s.TenantId).Returns(tenantId);
  tenantServiceMock.Setup(s => s.IsGlobalAccess).Returns(false);

  var currentUserServiceMock = new Mock<ICurrentUserService>();
  currentUserServiceMock.Setup(s => s.UserId).Returns("admin-user");
  currentUserServiceMock.Setup(s => s.CorrelationId).Returns("corr-privilege-edit");

  var messageBusMock = new Mock<IMessageBus>();
  var realTimeNotifierMock = new Mock<IRealTimeNotifier>();
  var serviceProviderMock = new Mock<IServiceProvider>();
  serviceProviderMock.Setup(s => s.GetService(typeof(ICurrentUserService))).Returns(currentUserServiceMock.Object);

  using (var context = new PortalDbContext(options, tenantServiceMock.Object, serviceProviderMock.Object)) {
    await context.Database.EnsureCreatedAsync();

    var privilege = new Privilege("Event.Test", "Description", "System", RiskLevel.Low, new JitSettings());
    context.Privileges.Add(privilege);
    await context.SaveChangesAsync();

    privilege.SetRiskLevel(RiskLevel.High);

    var handler = new PrivilegeModifiedEventHandler(
      context,
      messageBusMock.Object,
      currentUserServiceMock.Object,
      realTimeNotifierMock.Object);

    var publisherMock = new Mock<IPublisher>();
    publisherMock.Setup(p => p.Publish(It.IsAny<object>(), It.IsAny<CancellationToken>()))
      .Callback<object, CancellationToken>(async (notif, ct) => {
        if (notif is DomainEventNotification<PrivilegeModifiedEvent> pNotif) {
          await handler.Handle(pNotif, ct);
        }
      });
    serviceProviderMock.Setup(s => s.GetService(typeof(IPublisher))).Returns(publisherMock.Object);

    realTimeNotifierMock.Invocations.Should().BeEmpty(
      "SignalR must not fire before SaveChangesAsync commits the transaction");

    await context.SaveChangesAsync();

    var auditLog = await context.AuditLogs
      .IgnoreQueryFilters()
      .FirstOrDefaultAsync(l => l.Action == "PrivilegeModified" && l.ResourceId == privilege.Id.ToString());

    auditLog.Should().NotBeNull();
    auditLog!.TenantId.Should().Be(tenantId);
    auditLog.UserId.Should().Be("admin-user");

    messageBusMock.Verify(m => m.PublishAsync(It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);

    var signalRInvocation = realTimeNotifierMock.Invocations
      .Single(i => i.Method.Name == nameof(IRealTimeNotifier.SendSecurityEventAsync));

    signalRInvocation.Arguments[0].Should().Be(tenantId.Value.ToString());
    signalRInvocation.Arguments[1].Should().Be("PrivilegeChange");

    var payloadJson = System.Text.Json.JsonSerializer.Serialize(signalRInvocation.Arguments[2]);
    payloadJson.Should().Contain(auditLog.Id.ToString());
    payloadJson.Should().Contain("privilege_modified");
  }
}
```

- [ ] **Step 3: Run the focused test to verify it fails**

Run:

```bash
dotnet test libs/core/infrastructure.tests --filter "Privilege_Modification_ShouldPublishTenantAuditOutboxAndSignalRAfterCommit" --no-restore
```

Expected: fail at compile time because `PrivilegeModifiedEventHandler` does not accept `IRealTimeNotifier`, or fail at runtime because no SignalR invocation is made and the audit row still uses the system tenant.

- [ ] **Step 4: Commit the failing test**

```bash
git add libs/core/infrastructure.tests/Persistence/PrivilegePersistenceTests.cs
git commit -m "test: cover privilege edit tenant-scoped notification regression"
```

---

## Task 2: Send Tenant-Scoped Post-Commit SignalR From PrivilegeModifiedEventHandler

**Files:**
- Modify: `libs/core/infrastructure/Persistence/Handlers/PrivilegeModifiedEventHandler.cs`

- [ ] **Step 1: Add `IRealTimeNotifier` dependency**

Change the fields and constructor to this shape:

```csharp
public class PrivilegeModifiedEventHandler : INotificationHandler<DomainEventNotification<PrivilegeModifiedEvent>> {
  private readonly PortalDbContext _dbContext;
  private readonly IMessageBus _messageBus;
  private readonly ICurrentUserService _currentUserService;
  private readonly IRealTimeNotifier _realTimeNotifier;

  public PrivilegeModifiedEventHandler(
      PortalDbContext dbContext,
      IMessageBus messageBus,
      ICurrentUserService currentUserService,
      IRealTimeNotifier realTimeNotifier) {
    _dbContext = dbContext;
    _messageBus = messageBus;
    _currentUserService = currentUserService;
    _realTimeNotifier = realTimeNotifier;
  }
```

Remove the `SystemTenantId` field from this handler.

- [ ] **Step 2: Write the audit entry under the current tenant**

Replace the first `AuditEntry` constructor argument:

```csharp
        SystemTenantId,
```

With:

```csharp
        _dbContext.CurrentTenantId,
```

- [ ] **Step 3: Register the post-commit SignalR action**

After `_messageBus.PublishAsync(...)`, add:

```csharp
    var tenantId = _dbContext.CurrentTenantId.Value.ToString();

    _dbContext.RegisterPostCommitAction(ct =>
      _realTimeNotifier.SendSecurityEventAsync(
        tenantId,
        "PrivilegeChange",
        new {
          EventId = auditEntry.Id,
          Timestamp = auditEntry.Timestamp,
          Action = "privilege_modified"
        },
        ct));
```

Keep the payload minimal. The frontend uses `EventId` to claim-check full details through `/api/AuditLogs/{eventId}`.

- [ ] **Step 4: Run the focused privilege test**

Run:

```bash
dotnet test libs/core/infrastructure.tests --filter "Privilege_Modification_ShouldPublishTenantAuditOutboxAndSignalRAfterCommit" --no-restore
```

Expected: pass.

- [ ] **Step 5: Run handler invariant test**

Run:

```bash
dotnet test libs/core/infrastructure.tests --filter "NoHandler_CallsDbContextSaveChangesAsync" --no-restore
```

Expected: pass.

- [ ] **Step 6: Commit the handler fix**

```bash
git add libs/core/infrastructure/Persistence/Handlers/PrivilegeModifiedEventHandler.cs libs/core/infrastructure.tests/Persistence/PrivilegePersistenceTests.cs
git commit -m "fix: send tenant-scoped privilege edit notification after commit"
```

---

## Task 3: Add Audit Claim-Check Tenant Isolation Tests

**Files:**
- Create: `libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs`

- [ ] **Step 1: Create failing controller tests**

Create `libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs`:

```csharp
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using System;
using System.Threading.Tasks;
using Tai.Portal.Api.Controllers;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Persistence;

public class AuditLogsControllerTests {
  private static PortalDbContext NewContext(TenantId currentTenantId) {
    var options = new DbContextOptionsBuilder<PortalDbContext>()
      .UseInMemoryDatabase($"audit-logs-{Guid.NewGuid()}")
      .Options;

    var tenantServiceMock = new Mock<ITenantService>();
    tenantServiceMock.Setup(s => s.TenantId).Returns(currentTenantId);
    tenantServiceMock.Setup(s => s.IsGlobalAccess).Returns(false);

    return new PortalDbContext(options, tenantServiceMock.Object, new Mock<IServiceProvider>().Object);
  }

  [Fact]
  public async Task GetAuditLog_ReturnsSameTenantAuditEntry() {
    var tenantId = new TenantId(Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));

    await using var context = NewContext(tenantId);
    var auditEntry = new AuditEntry(
      tenantId,
      "admin-user",
      "PrivilegeModified",
      "resource-1",
      "corr-1",
      null,
      "same tenant event");

    context.AuditLogs.Add(auditEntry);
    await context.SaveChangesAsync();

    var controller = new AuditLogsController(context) {
      ControllerContext = new ControllerContext {
        HttpContext = new DefaultHttpContext()
      }
    };

    var result = await controller.GetAuditLog(auditEntry.Id);

    result.Should().BeOfType<OkObjectResult>();
  }

  [Fact]
  public async Task GetAuditLog_WithoutBypassHeader_DoesNotReturnOtherTenantAuditEntry() {
    var tenantA = new TenantId(Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
    var tenantB = new TenantId(Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));

    await using var context = NewContext(tenantA);
    var otherTenantAuditEntry = new AuditEntry(
      tenantB,
      "admin-user",
      "PrivilegeModified",
      "resource-1",
      "corr-1",
      null,
      "other tenant event");

    context.AuditLogs.Add(otherTenantAuditEntry);
    await context.SaveChangesAsync();

    var controller = new AuditLogsController(context) {
      ControllerContext = new ControllerContext {
        HttpContext = new DefaultHttpContext()
      }
    };

    var result = await controller.GetAuditLog(otherTenantAuditEntry.Id);

    result.Should().BeOfType<NotFoundObjectResult>();
  }

  [Fact]
  public async Task GetAuditLog_BypassHeader_DoesNotReturnOtherTenantAuditEntry() {
    var tenantA = new TenantId(Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
    var tenantB = new TenantId(Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));

    await using var context = NewContext(tenantA);
    var otherTenantAuditEntry = new AuditEntry(
      tenantB,
      "admin-user",
      "PrivilegeModified",
      "resource-1",
      "corr-1",
      null,
      "other tenant event");

    context.AuditLogs.Add(otherTenantAuditEntry);
    await context.SaveChangesAsync();

    var httpContext = new DefaultHttpContext();
    httpContext.Request.Headers["X-Bypass-Tenant"] = "true";

    var controller = new AuditLogsController(context) {
      ControllerContext = new ControllerContext {
        HttpContext = httpContext
      }
    };

    var result = await controller.GetAuditLog(otherTenantAuditEntry.Id);

    result.Should().BeOfType<NotFoundObjectResult>(
      "browser-controlled X-Bypass-Tenant must not bypass audit tenant isolation");
  }
}
```

- [ ] **Step 2: Run the focused controller tests to verify they fail**

Run:

```bash
dotnet test libs/core/infrastructure.tests --filter "AuditLogsControllerTests" --no-restore
```

Expected: at least the two cross-tenant tests fail because the current controller calls `IgnoreQueryFilters()` when the bypass header is absent.

- [ ] **Step 3: Commit the failing tests**

```bash
git add libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs
git commit -m "test: cover tenant-isolated audit claim check"
```

---

## Task 4: Remove Browser-Controlled Audit Bypass

**Files:**
- Modify: `apps/portal-api/Controllers/AuditLogsController.cs`

- [ ] **Step 1: Remove bypass header logic**

Replace this block:

```csharp
    // For testing: allow bypassing tenant filter via header
    var bypassTenant = Request.Headers["X-Bypass-Tenant"].FirstOrDefault() == "true";

    IQueryable<AuditEntry> query = _dbContext.AuditLogs;

    if (!bypassTenant) {
      // Apply global query filter (default behavior)
      query = query.IgnoreQueryFilters();
    }
```

With:

```csharp
    IQueryable<AuditEntry> query = _dbContext.AuditLogs;
```

- [ ] **Step 2: Remove unused import**

Remove this import if it becomes unused:

```csharp
using System.Linq;
```

- [ ] **Step 3: Run the focused controller tests**

Run:

```bash
dotnet test libs/core/infrastructure.tests --filter "AuditLogsControllerTests" --no-restore
```

Expected: pass.

- [ ] **Step 4: Commit the controller fix**

```bash
git add apps/portal-api/Controllers/AuditLogsController.cs libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs
git commit -m "fix: enforce tenant filtering on audit claim check"
```

---

## Task 5: Remove Frontend Bypass Header

**Files:**
- Modify: `apps/portal-web/src/app/real-time.service.ts`

- [ ] **Step 1: Remove the claim-check bypass header**

Replace:

```typescript
    return this.http.get<AuditLogDetails>(apiUrl, {
      withCredentials: true,
      headers: { 'X-Bypass-Tenant': 'true' }
    });
```

With:

```typescript
    return this.http.get<AuditLogDetails>(apiUrl, {
      withCredentials: true
    });
```

- [ ] **Step 2: Run the relevant frontend test**

Run:

```bash
npx nx test portal-web --testFile=real-time.service.spec.ts
```

Expected: pass. If this project does not support `--testFile`, run:

```bash
npx nx test portal-web
```

Expected: pass.

- [ ] **Step 3: Commit the frontend claim-check fix**

```bash
git add apps/portal-web/src/app/real-time.service.ts
git commit -m "fix: remove audit claim-check tenant bypass header"
```

---

## Task 6: Add SignalR Tenant-Only Delivery Test

**Files:**
- Create: `libs/core/infrastructure.tests/Services/SignalRRealTimeNotifierTests.cs`

- [ ] **Step 1: Create the failing test**

Create `libs/core/infrastructure.tests/Services/SignalRRealTimeNotifierTests.cs`:

```csharp
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Moq;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Api.Hubs;
using Tai.Portal.Api.Services;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Services;

public class SignalRRealTimeNotifierTests {
  [Fact]
  public async Task SendSecurityEventAsync_SendsOnlyToTenantGroup() {
    var groupClientProxyMock = new Mock<IClientProxy>();
    groupClientProxyMock
      .Setup(p => p.SendCoreAsync(
        "SecurityEvent",
        It.IsAny<object?[]>(),
        It.IsAny<CancellationToken>()))
      .Returns(Task.CompletedTask);

    var allClientProxyMock = new Mock<IClientProxy>();
    allClientProxyMock
      .Setup(p => p.SendCoreAsync(
        It.IsAny<string>(),
        It.IsAny<object?[]>(),
        It.IsAny<CancellationToken>()))
      .Returns(Task.CompletedTask);

    var clientsMock = new Mock<IHubClients>();
    clientsMock.Setup(c => c.Group("tenant-1")).Returns(groupClientProxyMock.Object);
    clientsMock.Setup(c => c.All).Returns(allClientProxyMock.Object);

    var hubContextMock = new Mock<IHubContext<NotificationHub>>();
    hubContextMock.Setup(c => c.Clients).Returns(clientsMock.Object);

    var notifier = new SignalRRealTimeNotifier(hubContextMock.Object);

    await notifier.SendSecurityEventAsync(
      "tenant-1",
      "PrivilegeChange",
      new { EventId = "event-1" });

    clientsMock.Verify(c => c.Group("tenant-1"), Times.Once);
    groupClientProxyMock.Verify(p => p.SendCoreAsync(
      "SecurityEvent",
      It.IsAny<object?[]>(),
      It.IsAny<CancellationToken>()), Times.Once);

    allClientProxyMock.Invocations.Should().BeEmpty(
      "security events must not be broadcast to every tenant");
  }
}
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
dotnet test libs/core/infrastructure.tests --filter "SendSecurityEventAsync_SendsOnlyToTenantGroup" --no-restore
```

Expected: fail because `SignalRRealTimeNotifier` currently sends `SecurityEvent` to `Clients.All`.

- [ ] **Step 3: Commit the failing test**

```bash
git add libs/core/infrastructure.tests/Services/SignalRRealTimeNotifierTests.cs
git commit -m "test: cover tenant-only SignalR security events"
```

---

## Task 7: Remove SignalR Clients.All Security Broadcast

**Files:**
- Modify: `apps/portal-api/Services/SignalRRealTimeNotifier.cs`

- [ ] **Step 1: Remove the `Clients.All` block**

Delete this block:

```csharp
    // ALSO broadcast to "All" for testing/dev purposes
    await _hubContext.Clients.All
        .SendAsync("SecurityEvent", new {
          EventType = eventType,
          Payload = payload
        }, cancellationToken);
```

The method should only send to `_hubContext.Clients.Group(tenantId)`.

- [ ] **Step 2: Run the SignalR notifier test**

Run:

```bash
dotnet test libs/core/infrastructure.tests --filter "SendSecurityEventAsync_SendsOnlyToTenantGroup" --no-restore
```

Expected: pass.

- [ ] **Step 3: Commit the SignalR fix**

```bash
git add apps/portal-api/Services/SignalRRealTimeNotifier.cs libs/core/infrastructure.tests/Services/SignalRRealTimeNotifierTests.cs
git commit -m "fix: restrict security SignalR events to tenant group"
```

---

## Task 8: Full Verification

**Files:**
- No source edits unless verification reveals a real issue.

- [ ] **Step 1: Run infrastructure tests**

Run:

```bash
dotnet test libs/core/infrastructure.tests --no-restore
```

Expected: pass.

- [ ] **Step 2: Run portal API integration tests**

Run:

```bash
dotnet test apps/portal-api.integration-tests --no-restore
```

Expected: pass. If Docker/Testcontainers is unavailable in the execution environment, the command should fail with a container startup error; record that exact failure in the final verification notes.

- [ ] **Step 3: Run portal-web tests**

Run:

```bash
npx nx test portal-web
```

Expected: pass.

- [ ] **Step 4: Run a static handler check**

Run:

```bash
rg -n "_dbContext\\.SaveChangesAsync|SaveChangesAsync\\(" libs/core/infrastructure/Persistence/Handlers
```

Expected: no handler calls `_dbContext.SaveChangesAsync(...)`.

- [ ] **Step 5: Run a static bypass-header check**

Run:

```bash
rg -n "X-Bypass-Tenant" apps libs
```

Expected: no usage in `AuditLogsController`, `real-time.service.ts`, or notification claim-check code. Remaining documentation references are acceptable if they describe removed behavior.

---

## Manual Verification

After automated tests pass:

1. Start PostgreSQL, RabbitMQ, Portal API, gateway, and portal-web with the normal local workflow.
2. Sign in as an admin.
3. Open the browser devtools console and the notification panel.
4. Edit a privilege through the UI.
5. Confirm the console logs `RealTimeService: Received SecurityEvent`.
6. Confirm the event type is `PrivilegeChange`.
7. Confirm the claim-check request to `/api/AuditLogs/{eventId}` has no `X-Bypass-Tenant` header and returns `200`.
8. Confirm the notification panel shows the new audit event.
9. Sign in as a user from a different tenant in another browser profile if local data supports it, edit a privilege, and confirm only the matching tenant receives the notification.

---

## Plan Self-Review

- Spec coverage: The plan restores privilege edit notifications, keeps outbox/RabbitMQ unchanged, preserves post-commit SignalR semantics, and fixes the claim-check path without tenant bypass.
- Security coverage: The plan removes browser-controlled audit bypass and removes cross-tenant SignalR broadcast.
- Placeholder scan: No implementation steps are left as undefined work.
- Type consistency: The plan uses existing `IRealTimeNotifier.SendSecurityEventAsync<T>`, `PortalDbContext.RegisterPostCommitAction(...)`, `PortalDbContext.CurrentTenantId`, `PrivilegeModifiedEventHandler`, `SignalRRealTimeNotifier`, and `AuditLogsController` APIs.
