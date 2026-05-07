# Notification Center Sprint 2 Durable Recent Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add refresh recovery to the notification center by hydrating recent tenant-scoped audit events and idempotently merging them with live SignalR notifications.

**Architecture:** The backend exposes a bounded, admin-only `/api/AuditLogs/recent` endpoint backed by tenant-filtered audit logs. Portal-web adds a dedicated `NotificationHistoryService` that hydrates history after auth/tenant readiness, maps audit rows into `NotificationItem`, and delegates all merge/dedupe state to `NotificationSignalStore`. The design-system panel renders modeled notifications plus loading, empty, error, and retry states with accessible live-region semantics.

**Tech Stack:** ASP.NET Core, EF Core, xUnit/FluentAssertions, Angular standalone components, Angular signals, RxJS, Nx Angular unit tests, Storybook.

---

## Implementation Notes

- Sprint 2 spec: `docs/superpowers/specs/2026-05-06-notification-center-sprint-2-durable-recent-events-design.md`.
- Run commands with `CI=true` and `--skip-nx-cache` for Nx tests/builds.
- Backend endpoint is current-tenant only for both `Admin` and `SystemAdmin`.
- Non-admin authenticated users get `403 Forbidden`, not `404`.
- The recent endpoint must add an explicit `TenantId == currentTenantId` predicate even though EF query filters already exist.
- No new audit table, notification table, read/unread persistence, or backend rate limiting is part of this sprint.
- No new code should use deprecated `eventBuffer`, `latestEvent`, `addEvent`, `removeEvent`, or `clearBuffer`.

## File Structure

Backend:

- Modify `apps/portal-api/Controllers/AuditLogsController.cs`: inject `ITenantService`, add `GET /api/AuditLogs/recent`.
- Modify `libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs`: controller tests for recent endpoint behavior.
- Modify or add tests in `apps/portal-api.integration-tests`: authenticated role/tenant integration coverage if existing helpers support it.

Portal-web:

- Modify `apps/portal-web/src/app/store/notification-signal.store.ts`: hydration state, batch add, tenant-scoped FIFO idempotency keys.
- Modify `apps/portal-web/src/app/store/notification-signal.store.spec.ts`: store merge/cache/hydration state tests.
- Create `apps/portal-web/src/app/notifications/notification-history.service.ts`: auth-ready recent audit hydration.
- Create `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`: hydration, retry, race, and error tests.
- Modify `apps/portal-web/src/app/notifications/notification.mapper.ts`: token/segment taxonomy matching if current mapper still uses raw substring matching.
- Modify `apps/portal-web/src/app/notifications/notification.mapper.spec.ts`: taxonomy tests including `forewarning`.
- Modify `apps/portal-web/src/app/app.ts`: inject history service and expose it to template.
- Modify `apps/portal-web/src/app/app.html`: pass hydration state and retry to panel.

Design-system:

- Modify `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`: `OnPush`, `isLoading`, `error`, `retry`.
- Modify `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`: loading/error/empty states with ARIA.
- Modify `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`: compact loading/error styling.
- Modify `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`: state, accessibility, retry tests.
- Modify `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`: Storybook examples for loading/empty/error.

Verification:

```bash
dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj
dotnet test apps/portal-api.integration-tests/portal-api.integration-tests.csproj
CI=true npx nx test portal-web --skip-nx-cache
CI=true npx nx test design-system --skip-nx-cache
CI=true npx nx build-storybook design-system --skip-nx-cache
```

---

### Task 1: Backend Recent Audit Endpoint

**Files:**
- Modify: `apps/portal-api/Controllers/AuditLogsController.cs`
- Modify: `libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs`

- [ ] **Step 1: Add failing controller tests for recent audit logs**

In `libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs`, add tests like these. Use existing fixture setup and controller construction style from the file.

```csharp
[Fact]
public async Task GetRecentAuditLogs_ReturnsNewestSameTenantRowsOnly() {
  var currentTenant = _tenantService.TenantId;
  var otherTenant = new TenantId(Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"));

  var older = new AuditEntry(currentTenant, "admin-user", "PrivilegeModified", "resource-old", "corr-old", "10.0.0.1", "older same tenant");
  var newer = new AuditEntry(currentTenant, "admin-user", "LoginAnomaly", "resource-new", "corr-new", "10.0.0.2", "newer same tenant");
  var otherTenantRow = new AuditEntry(otherTenant, "admin-user", "PrivilegeModified", "resource-other", "corr-other", "10.0.0.3", "other tenant");

  _context.AuditLogs.AddRange(older, newer, otherTenantRow);
  await _context.SaveChangesAsync();

  var controller = new AuditLogsController(_context, _tenantService) {
    ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
  };

  var result = await controller.GetRecentAuditLogs(50);

  var ok = result.Should().BeOfType<OkObjectResult>().Subject;
  var rows = ok.Value.Should().BeAssignableTo<IEnumerable<object>>().Subject.ToList();
  rows.Should().HaveCount(2);
  rows[0].Should().BeEquivalentTo(new { Id = newer.Id }, options => options.ExcludingMissingMembers());
  rows[1].Should().BeEquivalentTo(new { Id = older.Id }, options => options.ExcludingMissingMembers());
}

[Theory]
[InlineData(null, 50)]
[InlineData(0, 50)]
[InlineData(-1, 50)]
[InlineData(1, 1)]
[InlineData(250, 100)]
public async Task GetRecentAuditLogs_ClampsLimit(int? requestedLimit, int expectedCountLimit) {
  var currentTenant = _tenantService.TenantId;
  for (var i = 0; i < 120; i++) {
    _context.AuditLogs.Add(new AuditEntry(currentTenant, "admin-user", "PrivilegeModified", $"resource-{i}", $"corr-{i}", null, $"row {i}"));
  }
  await _context.SaveChangesAsync();

  var controller = new AuditLogsController(_context, _tenantService) {
    ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
  };

  var result = await controller.GetRecentAuditLogs(requestedLimit);

  var ok = result.Should().BeOfType<OkObjectResult>().Subject;
  var rows = ok.Value.Should().BeAssignableTo<IEnumerable<object>>().Subject.ToList();
  rows.Should().HaveCount(expectedCountLimit);
}

[Fact]
public async Task AuditEntryModel_HasTenantQueryFilterAndRecentIndex() {
  var entityType = _context.Model.FindEntityType(typeof(AuditEntry));

  entityType.Should().NotBeNull();
  entityType!.GetQueryFilter().Should().NotBeNull();

  var index = entityType.GetIndexes()
    .SingleOrDefault(i => i.GetDatabaseName() == "IX_AuditLogs_TenantId_TimestampDesc");

  index.Should().NotBeNull();
}
```

Also update existing controller construction in this test file from:

```csharp
new AuditLogsController(_context)
```

to:

```csharp
new AuditLogsController(_context, _tenantService)
```

- [ ] **Step 2: Run backend controller tests and verify failure**

Run:

```bash
dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj --filter AuditLogsControllerTests
```

Expected: FAIL because `AuditLogsController` does not accept `ITenantService` and `GetRecentAuditLogs` does not exist.

- [ ] **Step 3: Implement endpoint and constructor injection**

In `apps/portal-api/Controllers/AuditLogsController.cs`, add `ITenantService` and update the constructor:

```csharp
private readonly PortalDbContext _dbContext;
private readonly ITenantService _tenantService;

public AuditLogsController(PortalDbContext dbContext, ITenantService tenantService) {
  _dbContext = dbContext;
  _tenantService = tenantService;
}
```

Add the recent endpoint:

```csharp
[HttpGet("recent")]
[Authorize(Roles = "Admin,SystemAdmin")]
public async Task<IActionResult> GetRecentAuditLogs([FromQuery] int? limit) {
  var currentTenantId = _tenantService.TenantId;
  if (currentTenantId.Value == Guid.Empty) {
    return Forbid();
  }

  var take = limit.GetValueOrDefault(50);
  if (take <= 0) take = 50;
  if (take > 100) take = 100;

  var rows = await _dbContext.AuditLogs
    .Where(a => a.TenantId == currentTenantId)
    .OrderByDescending(a => a.Timestamp)
    .Take(take)
    .Select(a => new {
      a.Id,
      a.TenantId,
      a.UserId,
      a.Action,
      a.ResourceId,
      a.CorrelationId,
      a.Timestamp,
      a.IpAddress,
      a.Details
    })
    .ToListAsync();

  return Ok(rows);
}
```

Keep the existing `GetAuditLog(Guid id)` behavior intact, but use the injected tenant service only for the new endpoint.

- [ ] **Step 4: Run backend controller tests**

Run:

```bash
dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj --filter AuditLogsControllerTests
```

Expected: PASS.

- [ ] **Step 5: Commit backend endpoint**

Run:

```bash
git add apps/portal-api/Controllers/AuditLogsController.cs libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs
git commit -m "feat: add recent audit log endpoint"
```

Expected: commit succeeds.

---

### Task 2: Store Hydration State and Tenant-Scoped Idempotency

**Files:**
- Modify: `apps/portal-web/src/app/store/notification-signal.store.ts`
- Modify: `apps/portal-web/src/app/store/notification-signal.store.spec.ts`

- [ ] **Step 1: Add failing store tests**

In `apps/portal-web/src/app/store/notification-signal.store.spec.ts`, add tests for the new state and merge behavior:

```typescript
it('builds tenant-scoped idempotency keys in exact format', () => {
  expect(getNotificationIdempotencyKey({ tenantId: 'tenant-1', id: 'evt-1' }))
    .toBe('tenant-1:evt-1');
});

it('adds notification batches newest first and dedupes inside the batch', () => {
  store.addNotifications([
    { ...mockNotification, id: 'evt-1', timestamp: '2026-05-03T10:00:00.000Z', source: 'history' },
    { ...mockNotification, id: 'evt-2', timestamp: '2026-05-03T10:02:00.000Z', source: 'history' },
    { ...mockNotification, id: 'evt-1', timestamp: '2026-05-03T10:01:00.000Z', source: 'history' },
  ]);

  expect(store.notifications().map(n => n.id)).toEqual(['evt-2', 'evt-1']);
});

it('dedupes history and SignalR events by tenant-scoped key', () => {
  store.addNotification({ ...mockNotification, id: 'evt-1', tenantId: 'tenant-1', source: 'history' });
  store.addNotification({ ...mockNotification, id: 'evt-1', tenantId: 'tenant-1', source: 'signalr' });
  store.addNotification({ ...mockNotification, id: 'evt-1', tenantId: 'tenant-2', source: 'history' });

  expect(store.notifications()).toHaveLength(2);
  expect(store.notifications().map(n => `${n.tenantId}:${n.id}`)).toContain('tenant-1:evt-1');
  expect(store.notifications().map(n => `${n.tenantId}:${n.id}`)).toContain('tenant-2:evt-1');
});

it('evicts idempotency keys FIFO and allows evicted keys to be re-added', () => {
  store.addNotification({ ...mockNotification, id: 'evt-0000', tenantId: 'tenant-1' });

  for (let i = 1; i <= 1000; i++) {
    store.addNotification({ ...mockNotification, id: `evt-${i.toString().padStart(4, '0')}`, tenantId: 'tenant-1' });
  }

  store.addNotification({ ...mockNotification, id: 'evt-0000', tenantId: 'tenant-1', summary: 're-added after FIFO eviction' });
  store.addNotification({ ...mockNotification, id: 'evt-1000', tenantId: 'tenant-1', summary: 'should remain deduped' });

  expect(store.notifications()[0].summary).toBe('re-added after FIFO eviction');
  expect(store.notifications().filter(n => n.id === 'evt-1000')).toHaveLength(1);
});

it('tracks hydration state and empty state', () => {
  expect(store.isHydrating()).toBe(false);
  expect(store.hasHydrated()).toBe(false);
  expect(store.isEmpty()).toBe(false);

  store.setHydrating(true);
  expect(store.isHydrating()).toBe(true);
  expect(store.isEmpty()).toBe(false);

  store.setHydrating(false);
  store.markHydrated();
  expect(store.hasHydrated()).toBe(true);
  expect(store.isEmpty()).toBe(true);

  store.setHydrationError('Unable to load recent notifications');
  expect(store.hydrationError()).toBe('Unable to load recent notifications');
  expect(store.isEmpty()).toBe(false);
});

it('clearForAuthBoundaryChange clears notifications, idempotency, and hydration state', () => {
  store.addNotification(mockNotification);
  store.setHydrationError('Unable to load recent notifications');
  store.markHydrated();

  store.clearForAuthBoundaryChange();
  store.addNotification({ ...mockNotification, summary: 'allowed after clear' });

  expect(store.notifications()).toHaveLength(1);
  expect(store.notifications()[0].summary).toBe('allowed after clear');
  expect(store.hydrationError()).toBeNull();
  expect(store.hasHydrated()).toBe(false);
  expect(store.isHydrating()).toBe(false);
});
```

Update imports:

```typescript
import { getNotificationIdempotencyKey, NotificationSignalStore } from './notification-signal.store';
```

- [ ] **Step 2: Run store tests and verify failure**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache
```

Expected: FAIL because `getNotificationIdempotencyKey`, hydration signals, and `addNotifications` do not exist.

- [ ] **Step 3: Implement store state and FIFO idempotency**

In `apps/portal-web/src/app/store/notification-signal.store.ts`, add the exported helper:

```typescript
export function getNotificationIdempotencyKey(notification: Pick<NotificationItem, 'tenantId' | 'id'>): string {
  return `${notification.tenantId}:${notification.id}`;
}
```

Replace the current `seenEventIds` set with:

```typescript
private readonly seenNotificationKeys = new Set<string>();
private readonly seenNotificationKeyQueue: string[] = [];
private readonly _isHydrating = signal(false);
private readonly _hydrationError = signal<string | null>(null);
private readonly _hasHydrated = signal(false);

readonly isHydrating = this._isHydrating.asReadonly();
readonly hydrationError = this._hydrationError.asReadonly();
readonly hasHydrated = this._hasHydrated.asReadonly();
readonly isEmpty = computed(() =>
  !this._isHydrating() &&
  this._hasHydrated() &&
  this._hydrationError() === null &&
  this._notifications().length === 0
);
```

Update add/merge methods:

```typescript
addNotification(notification: NotificationItem): void {
  this.addNotifications([notification]);
}

addNotifications(notifications: NotificationItem[]): void {
  const uniqueNotifications: NotificationItem[] = [];

  for (const notification of notifications) {
    const key = getNotificationIdempotencyKey(notification);
    if (this.seenNotificationKeys.has(key)) {
      continue;
    }

    this.trackSeenKey(key);
    uniqueNotifications.push(notification);
  }

  if (uniqueNotifications.length === 0) {
    return;
  }

  this._notifications.update(buffer =>
    [...uniqueNotifications, ...buffer]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_BUFFER_SIZE)
  );
}

setHydrating(isHydrating: boolean): void {
  this._isHydrating.set(isHydrating);
}

setHydrationError(message: string | null): void {
  this._hydrationError.set(message);
}

markHydrated(): void {
  this._hasHydrated.set(true);
}

clearNotifications(): void {
  this._notifications.set([]);
  this.seenNotificationKeys.clear();
  this.seenNotificationKeyQueue.length = 0;
}

clearForAuthBoundaryChange(): void {
  this.clearNotifications();
  this._isHydrating.set(false);
  this._hydrationError.set(null);
  this._hasHydrated.set(false);
}

private trackSeenKey(key: string): void {
  this.seenNotificationKeys.add(key);
  this.seenNotificationKeyQueue.push(key);

  while (this.seenNotificationKeyQueue.length > MAX_IDEMPOTENCY_CACHE) {
    const evicted = this.seenNotificationKeyQueue.shift();
    if (evicted) {
      this.seenNotificationKeys.delete(evicted);
    }
  }
}
```

Remove production `console.log` duplicate tracing from store paths.

- [ ] **Step 4: Run store tests**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache
```

Expected: PASS for store tests. Other portal-web failures should be unrelated to this task and addressed later.

- [ ] **Step 5: Commit store changes**

Run:

```bash
git add apps/portal-web/src/app/store/notification-signal.store.ts apps/portal-web/src/app/store/notification-signal.store.spec.ts
git commit -m "feat: add notification hydration store state"
```

Expected: commit succeeds.

---

### Task 3: Mapper Token Classification

**Files:**
- Modify: `apps/portal-web/src/app/notifications/notification.mapper.ts`
- Modify: `apps/portal-web/src/app/notifications/notification.mapper.spec.ts`

- [ ] **Step 1: Add failing taxonomy tests**

In `notification.mapper.spec.ts`, add:

```typescript
it('matches warning token across PascalCase, hyphen, and whitespace', () => {
  for (const action of ['SecurityWarning', 'security-warning', 'security warning']) {
    const notification = mapAuditLogToNotification({
      ...baseAudit,
      id: `evt-${action}`,
      action,
      eventType: null,
      details: null,
    }, { source: 'history', expectedEventId: `evt-${action}`, expectedTenantId: 'tenant-1' });

    expect(notification?.severity).toBe('warning');
    expect(notification?.category).toBe('security');
  }
});

it('does not match warning inside unrelated larger words', () => {
  const notification = mapAuditLogToNotification({
    ...baseAudit,
    id: 'evt-forewarning',
    action: 'ForewarningReportExported',
    eventType: null,
    details: null,
  }, { source: 'history', expectedEventId: 'evt-forewarning', expectedTenantId: 'tenant-1' });

  expect(notification?.severity).toBe('info');
  expect(notification?.category).toBe('system');
});
```

- [ ] **Step 2: Run portal-web tests and verify failure**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache
```

Expected: FAIL if current mapper uses raw substring matching and classifies `ForewarningReportExported` as warning.

- [ ] **Step 3: Implement token/segment matching**

In `notification.mapper.ts`, add a tokenizer:

```typescript
function tokenizeAuditText(...values: Array<string | null | undefined>): Set<string> {
  const text = values
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();

  return new Set(
    text
      .split(/[\s_\-.,:;()[\]{}\\/]+/)
      .map(token => token.trim())
      .filter(Boolean)
  );
}
```

Update classification to use token membership:

```typescript
const tokens = tokenizeAuditText(eventType, action, details);

if (tokens.has('privilege')) { ... }
if (tokens.has('loginanomaly') || tokens.has('anomaly')) { ... }
if (tokens.has('warning') || tokens.has('failed')) { ... }
```

Keep all display strings routed through existing plain-text normalization.

- [ ] **Step 4: Run portal-web tests**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache
```

Expected: PASS for mapper tests.

- [ ] **Step 5: Commit mapper change**

Run:

```bash
git add apps/portal-web/src/app/notifications/notification.mapper.ts apps/portal-web/src/app/notifications/notification.mapper.spec.ts
git commit -m "fix: classify notification actions by normalized tokens"
```

Expected: commit succeeds.

---

### Task 4: Notification History Hydration Service

**Files:**
- Create: `apps/portal-web/src/app/notifications/notification-history.service.ts`
- Create: `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`

- [ ] **Step 1: Write failing history service tests**

Create `notification-history.service.spec.ts` with tests covering success, null tenant, errors, retry, tenant switch, and stale responses. Use this setup shape:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, User } from '../auth.service';
import { AuditLogDetails } from '../models/security-event.model';
import { NotificationSignalStore } from '../store/notification-signal.store';
import { NotificationHistoryService } from './notification-history.service';

describe('NotificationHistoryService', () => {
  let user$: BehaviorSubject<User | null>;
  let http: { get: ReturnType<typeof vi.fn> };
  let store: NotificationSignalStore;
  let service: NotificationHistoryService;

  const adminUser: User = {
    id: 'user-1',
    name: 'Admin',
    email: 'admin@tai.com',
    tenantId: 'tenant-1',
    roles: ['Admin'],
    privileges: [],
  };

  const auditRow: AuditLogDetails = {
    id: 'evt-1',
    tenantId: 'tenant-1',
    userId: 'admin@tai.com',
    action: 'PrivilegeModified',
    resourceId: 'priv-1',
    correlationId: null,
    timestamp: '2026-05-06T10:00:00.000Z',
    ipAddress: '10.0.0.1',
    details: 'Privilege changed',
  };

  beforeEach(() => {
    user$ = new BehaviorSubject<User | null>(null);
    http = { get: vi.fn(() => of([auditRow])) };

    TestBed.configureTestingModule({
      providers: [
        NotificationHistoryService,
        NotificationSignalStore,
        { provide: AuthService, useValue: { user$: user$.asObservable(), checkAuth: vi.fn(() => of({ isAuthenticated: true })) } },
        { provide: HttpClient, useValue: http },
      ],
    });

    store = TestBed.inject(NotificationSignalStore);
    service = TestBed.inject(NotificationHistoryService);
  });

  it('hydrates recent audit rows after user tenant is available', () => {
    user$.next(adminUser);

    expect(http.get).toHaveBeenCalledWith('/api/AuditLogs/recent?limit=50', { withCredentials: true });
    expect(store.notifications()).toHaveLength(1);
    expect(store.notifications()[0]).toMatchObject({ id: 'evt-1', source: 'history', severity: 'critical' });
    expect(store.hasHydrated()).toBe(true);
    expect(store.isHydrating()).toBe(false);
  });

  it('fails closed when tenant id is null', () => {
    user$.next({ ...adminUser, tenantId: null });

    expect(http.get).not.toHaveBeenCalled();
    expect(store.hydrationError()).toBe('Unable to verify notification tenant.');
    expect(store.isHydrating()).toBe(false);
  });

  it('keeps existing SignalR notifications when empty history returns', () => {
    store.addNotification({ ...storeNotification(), id: 'signalr-1', source: 'signalr' });
    http.get.mockReturnValue(of([]));

    user$.next(adminUser);

    expect(store.notifications().map(n => n.id)).toEqual(['signalr-1']);
    expect(store.isEmpty()).toBe(false);
  });

  it('adds valid rows and skips malformed rows in partial mapping failure', () => {
    http.get.mockReturnValue(of([auditRow, { ...auditRow, id: '', action: '' }]));

    user$.next(adminUser);

    expect(store.notifications()).toHaveLength(1);
    expect(store.hydrationError()).toBeNull();
  });

  it('sets hydration error when all rows fail mapping', () => {
    http.get.mockReturnValue(of([{ ...auditRow, id: '', action: '' }]));

    user$.next(adminUser);

    expect(store.notifications()).toHaveLength(0);
    expect(store.hydrationError()).toBe('Unable to load recent notifications');
    expect(store.hasHydrated()).toBe(false);
  });

  it('maps 403, 404, 429, and network failures to panel errors', () => {
    const cases = [
      [{ status: 403 }, 'You do not have access to recent notifications.'],
      [{ status: 404 }, 'Unable to load recent notifications'],
      [{ status: 429 }, 'Recent notifications are temporarily rate limited.'],
      [{ status: 0 }, 'Unable to load recent notifications'],
    ] as const;

    for (const [error, message] of cases) {
      store.clearForAuthBoundaryChange();
      http.get.mockReturnValueOnce(throwError(() => error));
      user$.next({ ...adminUser, id: `user-${message}` });
      expect(store.hydrationError()).toBe(message);
    }
  });

  it('cancels stale tenant response on tenant switch', () => {
    const firstResponse = new Subject<AuditLogDetails[]>();
    http.get.mockReturnValueOnce(firstResponse.asObservable());
    http.get.mockReturnValueOnce(of([{ ...auditRow, id: 'evt-tenant-2', tenantId: 'tenant-2' }]));

    user$.next(adminUser);
    user$.next({ ...adminUser, tenantId: 'tenant-2' });
    firstResponse.next([auditRow]);
    firstResponse.complete();

    expect(store.notifications().map(n => n.id)).toEqual(['evt-tenant-2']);
  });
});

function storeNotification() {
  return {
    id: 'evt-store',
    tenantId: 'tenant-1',
    eventType: 'PrivilegeModified',
    severity: 'critical' as const,
    category: 'privilege' as const,
    title: 'Privilege modified',
    summary: 'Privilege changed',
    timestamp: '2026-05-06T10:00:00.000Z',
    actor: 'admin@tai.com',
    userId: 'admin@tai.com',
    ipAddress: null,
    resourceId: 'priv-1',
    correlationId: null,
    readAt: null,
    acknowledgedAt: null,
    source: 'signalr' as const,
  };
}
```

- [ ] **Step 2: Run portal-web tests and verify failure**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache
```

Expected: FAIL because `NotificationHistoryService` does not exist.

- [ ] **Step 3: Implement history service**

Create `apps/portal-web/src/app/notifications/notification-history.service.ts`:

```typescript
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, take, tap, timeout } from 'rxjs';
import { AuthService, User } from '../auth.service';
import { AuditLogDetails } from '../models/security-event.model';
import { NotificationSignalStore } from '../store/notification-signal.store';
import { mapAuditLogToNotification } from './notification.mapper';

const RECENT_LIMIT = 50;
const HYDRATION_TIMEOUT_MS = 10_000;
const RETRY_DEBOUNCE_MS = 1_000;
const RETRY_WINDOW_MS = 30_000;
const MAX_RETRIES_PER_WINDOW = 3;

@Injectable({ providedIn: 'root' })
export class NotificationHistoryService {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly store = inject(NotificationSignalStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retryRequests$ = new Subject<void>();
  private readonly hydratedTenants = new Set<string>();
  private readonly retryAttemptsByTenant = new Map<string, number[]>();
  private currentTenantId: string | null = null;

  constructor() {
    this.authService.user$.pipe(
      takeUntilDestroyed(this.destroyRef),
      map(user => user?.tenantId ?? null),
      distinctUntilChanged(),
      tap(tenantId => this.handleTenantBoundary(tenantId)),
      filter((tenantId): tenantId is string => !!tenantId),
      filter(tenantId => !this.hydratedTenants.has(tenantId)),
      switchMap(tenantId => this.hydrateTenant(tenantId))
    ).subscribe();

    this.retryRequests$.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(RETRY_DEBOUNCE_MS),
      switchMap(() => {
        if (!this.currentTenantId) {
          this.store.setHydrating(false);
          this.store.setHydrationError('Unable to verify notification tenant.');
          return EMPTY;
        }
        if (!this.canRetry(this.currentTenantId)) {
          this.store.setHydrationError('Retry limit reached. Try again shortly.');
          return EMPTY;
        }
        this.hydratedTenants.delete(this.currentTenantId);
        return this.hydrateTenant(this.currentTenantId);
      })
    ).subscribe();
  }

  retry(): void {
    this.retryRequests$.next();
  }

  private handleTenantBoundary(tenantId: string | null): void {
    if (this.currentTenantId !== tenantId) {
      this.store.clearForAuthBoundaryChange();
      this.currentTenantId = tenantId;
    }

    if (!tenantId) {
      this.store.setHydrating(false);
      this.store.setHydrationError('Unable to verify notification tenant.');
    }
  }

  private hydrateTenant(tenantId: string) {
    this.store.setHydrating(true);
    this.store.setHydrationError(null);

    return this.http.get<AuditLogDetails[]>(`/api/AuditLogs/recent?limit=${RECENT_LIMIT}`, { withCredentials: true }).pipe(
      timeout(HYDRATION_TIMEOUT_MS),
      tap(rows => this.applyHydrationRows(rows, tenantId)),
      catchError(error => {
        this.store.setHydrationError(this.mapHydrationError(error));
        this.store.setHydrating(false);
        return EMPTY;
      })
    );
  }

  private applyHydrationRows(rows: AuditLogDetails[], expectedTenantId: string): void {
    if (this.currentTenantId !== expectedTenantId) {
      return;
    }

    const mapped = rows
      .map(row => mapAuditLogToNotification(row, {
        source: 'history',
        expectedEventId: row.id,
        expectedTenantId,
      }))
      .filter(notification => notification !== null);

    if (rows.length > 0 && mapped.length === 0) {
      this.store.setHydrationError('Unable to load recent notifications');
      this.store.setHydrating(false);
      return;
    }

    this.store.addNotifications(mapped);
    this.store.markHydrated();
    this.store.setHydrationError(null);
    this.store.setHydrating(false);
    this.hydratedTenants.add(expectedTenantId);
  }

  private mapHydrationError(error: { status?: number }): string {
    if (error?.status === 403) return 'You do not have access to recent notifications.';
    if (error?.status === 429) return 'Recent notifications are temporarily rate limited.';
    return 'Unable to load recent notifications';
  }

  private canRetry(tenantId: string): boolean {
    const now = Date.now();
    const attempts = (this.retryAttemptsByTenant.get(tenantId) ?? [])
      .filter(timestamp => now - timestamp < RETRY_WINDOW_MS);

    if (attempts.length >= MAX_RETRIES_PER_WINDOW) {
      this.retryAttemptsByTenant.set(tenantId, attempts);
      return false;
    }

    attempts.push(now);
    this.retryAttemptsByTenant.set(tenantId, attempts);
    return true;
  }
}
```

- [ ] **Step 4: Run portal-web tests**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache
```

Expected: PASS for history service tests.

- [ ] **Step 5: Commit history service**

Run:

```bash
git add apps/portal-web/src/app/notifications/notification-history.service.ts apps/portal-web/src/app/notifications/notification-history.service.spec.ts
git commit -m "feat: hydrate recent notifications from audit history"
```

Expected: commit succeeds.

---

### Task 5: App Wiring

**Files:**
- Modify: `apps/portal-web/src/app/app.ts`
- Modify: `apps/portal-web/src/app/app.html`

- [ ] **Step 1: Wire `NotificationHistoryService` into App**

In `apps/portal-web/src/app/app.ts`, add import:

```typescript
import { NotificationHistoryService } from './notifications/notification-history.service';
```

Add protected injection:

```typescript
protected readonly notificationHistoryService = inject(NotificationHistoryService);
```

Update `notificationPanelItems` mapping to include fields already expected by the panel where available:

```typescript
protected get notificationPanelItems(): NotificationPanelItem[] {
  return this.notificationStore.notifications().map(item => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    severity: item.severity,
    category: item.category,
    actor: item.actor,
    timestamp: item.timestamp,
    userId: item.userId,
  }));
}
```

- [ ] **Step 2: Wire panel state and retry in template**

In `apps/portal-web/src/app/app.html`, update the notification panel invocation:

```html
<tai-notification-panel
  [notifications]="notificationPanelItems"
  [isLoading]="notificationStore.isHydrating()"
  [error]="notificationStore.hydrationError()"
  (retry)="notificationHistoryService.retry()">
</tai-notification-panel>
```

- [ ] **Step 3: Run portal-web tests**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache
```

Expected: FAIL until design-system panel inputs/outputs exist. If Task 6 is already done, expected PASS.

- [ ] **Step 4: Commit app wiring after Task 6 passes**

Run after design-system Task 6 is complete:

```bash
git add apps/portal-web/src/app/app.ts apps/portal-web/src/app/app.html
git commit -m "feat: wire notification history hydration into app"
```

Expected: commit succeeds.

---

### Task 6: Design-System Panel States and Accessibility

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`

- [ ] **Step 1: Add failing component tests**

In `notification-panel.component.spec.ts`, add tests for loading, empty, error, retry, and ARIA:

```typescript
it('renders loading state with polite status live region while keeping notifications visible', () => {
  component.isLoading = true;
  component.notifications = [mockNotification];
  fixture.detectChanges();

  const status = fixture.nativeElement.querySelector('[role="status"][aria-live="polite"]');
  expect(status?.textContent).toContain('Loading recent notifications');
  expect(fixture.nativeElement.textContent).toContain(mockNotification.title);
});

it('renders empty state with polite status live region', () => {
  component.isLoading = false;
  component.error = null;
  component.notifications = [];
  fixture.detectChanges();

  const status = fixture.nativeElement.querySelector('[role="status"][aria-live="polite"]');
  expect(status?.textContent).toContain('No recent notifications');
});

it('renders error state with assertive alert and retry button', () => {
  const retrySpy = vi.spyOn(component.retry, 'emit');
  component.error = 'Unable to load recent notifications';
  fixture.detectChanges();

  const alert = fixture.nativeElement.querySelector('[role="alert"][aria-live="assertive"]');
  const button = fixture.nativeElement.querySelector('button[type="button"].retry-btn');

  expect(alert?.textContent).toContain('Unable to load recent notifications');
  button.click();
  expect(retrySpy).toHaveBeenCalled();
});

it('disables retry while loading or throttled', () => {
  component.error = 'Retry limit reached. Try again shortly.';
  component.isLoading = true;
  fixture.detectChanges();

  const button = fixture.nativeElement.querySelector('button[type="button"].retry-btn') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
});
```

- [ ] **Step 2: Run design-system tests and verify failure**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache
```

Expected: FAIL because component lacks `isLoading`, `error`, `retry`, `OnPush`, and state markup.

- [ ] **Step 3: Implement component inputs, output, and OnPush**

In `notification-panel.component.ts`, update imports and decorator:

```typescript
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';

@Component({
  selector: 'tai-notification-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanelComponent {
  @Input() notifications: NotificationPanelItem[] = [];
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Output() retry = new EventEmitter<void>();

  onRetry(): void {
    if (this.isLoading || this.isRetryThrottled()) {
      return;
    }
    this.retry.emit();
  }

  isRetryThrottled(): boolean {
    return this.error === 'Retry limit reached. Try again shortly.';
  }
}
```

Keep existing filtering and formatting behavior unless tests require small adjustments.

- [ ] **Step 4: Implement accessible state markup**

In `notification-panel.component.html`, add state blocks above the list:

```html
@if (isLoading) {
  <div class="panel-status panel-status-loading" role="status" aria-live="polite">
    Loading recent notifications...
  </div>
}

@if (error) {
  <div class="panel-status panel-status-error" role="alert" aria-live="assertive">
    <span>{{ error }}</span>
    <button
      type="button"
      class="retry-btn"
      [disabled]="isLoading || isRetryThrottled()"
      (click)="onRetry()">
      Retry
    </button>
  </div>
}
```

Update empty state:

```html
@empty {
  @if (!isLoading && !error) {
    <div class="empty-state" role="status" aria-live="polite">No recent notifications</div>
  }
}
```

- [ ] **Step 5: Add minimal styles**

In `notification-panel.component.scss`, add:

```scss
.panel-status {
  margin: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.panel-status-loading {
  background: #eef2ff;
  color: #3730a3;
}

.panel-status-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: #fef2f2;
  color: #991b1b;
}

.retry-btn {
  border: 1px solid currentColor;
  border-radius: 0.25rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
}

.retry-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
```

- [ ] **Step 6: Update stories**

In `notification-panel.stories.ts`, add stories named `Loading`, `EmptyAfterHydration`, and `ErrorWithRetry` using args:

```typescript
args: {
  notifications: [],
  isLoading: true,
  error: null,
}
```

and:

```typescript
args: {
  notifications: [],
  isLoading: false,
  error: 'Unable to load recent notifications',
}
```

- [ ] **Step 7: Run design-system tests and Storybook build**

Run:

```bash
CI=true npx nx test design-system --skip-nx-cache
CI=true npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 8: Commit panel states**

Run:

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel
git commit -m "feat: add notification panel hydration states"
```

Expected: commit succeeds.

---

### Task 7: Backend Authorization Metadata Tests

**Files:**
- Modify: `libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs`

- [ ] **Step 1: Add authorization metadata tests**

In `AuditLogsControllerTests.cs`, add `using Microsoft.AspNetCore.Authorization;` and `using System.Reflection;`.

Add tests that prove the endpoint is role-restricted and uses the expected route:

```csharp
[Fact]
public void GetRecentAuditLogs_RequiresAdminOrSystemAdminRole() {
  var method = typeof(AuditLogsController).GetMethod(nameof(AuditLogsController.GetRecentAuditLogs));

  method.Should().NotBeNull();
  var authorize = method!.GetCustomAttribute<AuthorizeAttribute>();

  authorize.Should().NotBeNull();
  authorize!.Roles.Should().Be("Admin,SystemAdmin");
}

[Fact]
public void GetRecentAuditLogs_UsesRecentRoute() {
  var method = typeof(AuditLogsController).GetMethod(nameof(AuditLogsController.GetRecentAuditLogs));

  method.Should().NotBeNull();
  var httpGet = method!.GetCustomAttribute<HttpGetAttribute>();

  httpGet.Should().NotBeNull();
  httpGet!.Template.Should().Be("recent");
}
```

- [ ] **Step 2: Run controller tests**

Run:

```bash
dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj --filter AuditLogsControllerTests
```

Expected: PASS.

- [ ] **Step 3: Commit authorization tests**

Run:

```bash
git add libs/core/infrastructure.tests/Persistence/AuditLogsControllerTests.cs
git commit -m "test: cover recent audit log authorization"
```

Expected: commit succeeds.

---

### Task 8: Final Verification and Manual Demo

**Files:**
- Review all changed files.

- [ ] **Step 1: Search for deprecated notification APIs in new code**

Run:

```bash
rg -n "eventBuffer|latestEvent|addEvent\\(|removeEvent\\(|clearBuffer\\(" apps/portal-web/src/app libs/ui/design-system/src/lib/organisms/notification-panel
```

Expected: deprecated names appear only in compatibility sections of `NotificationSignalStore` and existing compatibility tests, not in new history service or app/panel wiring.

- [ ] **Step 2: Run backend tests**

Run:

```bash
dotnet test libs/core/infrastructure.tests/Tai.Portal.Core.Infrastructure.Tests.csproj
dotnet test apps/portal-api.integration-tests/portal-api.integration-tests.csproj
```

Expected: PASS.

- [ ] **Step 3: Run frontend tests and Storybook build**

Run:

```bash
CI=true npx nx test portal-web --skip-nx-cache
CI=true npx nx test design-system --skip-nx-cache
CI=true npx nx build-storybook design-system --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 4: Manual verification**

Start the app:

```bash
npx nx serve portal-web
```

Verify:

1. Log in as `admin@tai.com`.
2. Modify a privilege.
3. Confirm one live critical notification appears.
4. Refresh the browser.
5. Open the notification panel.
6. Confirm the recent privilege notification repopulates from `/api/AuditLogs/recent?limit=50`.
7. Confirm no duplicate appears if SignalR reconnect also delivers the same event.
8. Temporarily force the recent endpoint to fail and confirm the panel shows `Unable to load recent notifications` with a keyboard-accessible retry button.
9. Confirm loading and error states are announced by screen reader tooling or DOM inspection through `role`/`aria-live` attributes.

- [ ] **Step 5: Commit final cleanup**

Run:

```bash
git status --short
git add apps/portal-api libs/core/infrastructure.tests apps/portal-web/src/app libs/ui/design-system/src/lib/organisms/notification-panel docs/superpowers/specs/2026-05-06-notification-center-sprint-2-durable-recent-events-design.md docs/superpowers/plans/2026-05-06-notification-center-sprint-2-durable-recent-events-plan.md
git commit -m "docs: add notification center sprint 2 plan"
```

Expected: commit succeeds if docs or cleanup changes remain. Skip this commit if all implementation tasks already committed everything intentionally.

---

## Self-Review Checklist

- [ ] Backend endpoint is current-tenant only for Admin and SystemAdmin.
- [ ] Non-admin gets `403`, not `404`.
- [ ] Recent endpoint explicitly filters by current tenant and relies on EF query filter as additional protection.
- [ ] Recent endpoint uses newest-first ordering and bounded limit.
- [ ] Store idempotency key is exactly `${tenantId}:${eventId}`.
- [ ] Store FIFO cache eviction allows evicted keys to be re-added.
- [ ] Store clears notifications, idempotency cache, hydration error, hydrating state, and `hasHydrated` on auth boundary changes.
- [ ] Hydration service owns HTTP/retry behavior; store owns state only.
- [ ] Retry is debounced, throttled, disabled while loading, and fail-closed for null tenant.
- [ ] SignalR notifications can appear while hydration is loading.
- [ ] Panel states have ARIA live-region semantics and retry is keyboard-accessible.
- [ ] `ChangeDetectionStrategy.OnPush` is set on the panel.
- [ ] No new code depends on deprecated raw audit notification APIs.
