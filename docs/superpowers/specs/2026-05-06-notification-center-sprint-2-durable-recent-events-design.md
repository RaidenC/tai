# Notification Center Sprint 2: Durable Recent Events + Refresh Recovery Design

## Purpose

Sprint 2 makes the notification center resilient to browser refresh. Sprint 1 created an in-memory notification model fed by live SignalR events; refreshing the browser still clears the panel. Sprint 2 adds tenant-scoped recent audit history hydration and merges that history with live SignalR notifications using the same `NotificationItem` model and idempotent event identity rules.

The visible outcome: after a user signs in or refreshes the app, the notification panel repopulates from recent audit events for the current tenant. Live SignalR events still appear immediately after they are claim-checked, and duplicate REST/SignalR copies of the same audit event do not render twice.

## Master Spec Relationship

This branch does not currently contain the earlier umbrella/master notification center architecture spec. Sprint 2 should still follow that architecture direction:

- backend audit logs remain the durable source of truth,
- SignalR remains the live transport,
- portal-web maps raw audit transport data into `NotificationItem`,
- the store owns idempotent merge and derived state,
- design-system components render modeled notification data and do not know audit semantics.

If the umbrella spec is restored to this branch later, this Sprint 2 spec should link to it rather than duplicating architecture context. Until then, this section is the local architectural anchor for implementation.

## Goals

- Add `GET /api/AuditLogs/recent?limit=50`.
- Return recent audit logs for the authenticated user's tenant only.
- Hydrate `NotificationSignalStore` once the authenticated user and tenant ID are available.
- Map hydrated audit rows through the existing notification mapper with `source: 'history'`.
- Merge history and SignalR notifications by audit event ID.
- Prevent duplicates when the same event arrives from REST history and SignalR.
- Add loading, empty, and error states to the notification panel.
- Allow a retry action after history hydration failure.
- Replace the current idempotency cache overflow behavior with deterministic FIFO eviction.
- Keep read/unread and acknowledgement persistence out of scope.

## Non-Goals

Sprint 2 will not implement:

- user-specific notification tables,
- read/unread persistence,
- acknowledgement state,
- localStorage notification persistence,
- pagination or infinite scroll,
- filtering history on the backend by severity/category/search,
- a new notification database table,
- RabbitMQ replay or outbox reprocessing,
- backend rate limiting infrastructure,
- writing audit-log-read access back into the audit table.

Those belong to later sprints if the notification center grows beyond recent audit recovery.

## Current Baseline

The branch already has:

- `NotificationItem` in `apps/portal-web/src/app/models/notification-item.model.ts`.
- `NotificationSignalStore` with `notifications`, `filteredNotifications`, `addNotification`, `clearNotifications`, and id-based dedupe.
- `mapAuditLogToNotification()` in `apps/portal-web/src/app/notifications/notification.mapper.ts`.
- SignalR claim-check handling in `RealTimeService`.
- `AuditLogsController.GetAuditLog(Guid id)` for `/api/AuditLogs/{id}`.
- `App` already injects `RealTimeService`, `NotificationSignalStore`, and maps store items to `NotificationPanelItem`.
- `PortalDbContext.OnModelCreating()` already configures `AuditEntry` with `HasQueryFilter(a => _tenantService.IsGlobalAccess || a.TenantId == _tenantService.TenantId)`.
- `AuditEntry` does not currently store `EventType`; historical rows classify from `Action` and `Details`.

Sprint 2 should build on these pieces rather than introducing a separate notification transport or a parallel store.

## Backend API

### Endpoint

Add:

```http
GET /api/AuditLogs/recent?limit=50
```

The endpoint lives in `apps/portal-api/Controllers/AuditLogsController.cs` next to the existing claim-check endpoint.

### Authorization and Tenant Isolation

The endpoint is an admin/security surface because it returns recent audit activity for the current tenant. Add role authorization on top of normal authentication:

```csharp
[Authorize(
  AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application",
  Roles = "Admin,SystemAdmin")]
```

Tenant isolation must be enforced in two layers:

1. the existing EF Core tenant query filter on `PortalDbContext.AuditLogs`,
2. an explicit endpoint predicate using the current tenant ID.

The query filter is verified in current code: `PortalDbContext` applies `HasQueryFilter(a => _tenantService.IsGlobalAccess || a.TenantId == _tenantService.TenantId)` to `AuditEntry`. Sprint 2 must add tests that fail if this filter is bypassed or removed.

The endpoint should inject `ITenantService` and add an explicit predicate:

```csharp
.Where(a => a.TenantId == currentTenantId)
```

Do this even though the query filter exists. It is defense-in-depth for this audit surface.

Sprint 2 must not reintroduce `X-Bypass-Tenant`.

The recent endpoint is not available to ordinary tenant users in Sprint 2. That avoids exposing other users' audit metadata and IP addresses to every authenticated user in the tenant. If a future product requirement needs non-admin notification history, introduce a narrower notification-specific projection with redacted IP addresses instead of broadening this audit endpoint.

Non-admin authenticated users should receive `403 Forbidden`, not `404 Not Found`. This is a standard authorization failure for an authenticated user. The endpoint route is not a secret, and using `404` would make client auth behavior harder to reason about without materially improving security.

`SystemAdmin` does not get cross-tenant recent audit history from this endpoint in Sprint 2. The endpoint is always scoped to the resolved current tenant. If `ITenantService.TenantId` is empty or unavailable, return `403 Forbidden` rather than querying globally. A future cross-tenant audit console should be a separate endpoint with explicit tenant selector, authorization, and redaction rules.

If no audit entries are visible to the current tenant, return `200 OK` with an empty array.

### Index Strategy

The recent query must use the existing audit index shape:

```csharp
b.HasIndex(a => new { a.TenantId, a.Timestamp })
 .IsDescending(false, true)
 .HasDatabaseName("IX_AuditLogs_TenantId_TimestampDesc");
```

Sprint 2 tests should verify this index exists and that the endpoint query is ordered by `Timestamp` descending. Do not add a new index unless implementation proves the existing one is insufficient.

### Query Parameters

`limit` rules:

- default: `50`,
- minimum: `1`,
- maximum: `100`,
- omitted, zero, or negative values fall back to `50`,
- values above `100` clamp to `100`,
- non-integer values return `400 Bad Request` through normal ASP.NET Core model binding.

Sprint 2 app calls the endpoint with `limit=50`.

### Sort Order

Return newest first:

```csharp
OrderByDescending(a => a.Timestamp)
Take(limit)
```

The frontend store also sorts newest first, so REST hydration and SignalR merge into a consistent display order.

### Response Shape

Return the same transport shape used by the existing claim-check endpoint:

```typescript
interface AuditLogDetails {
  id: string;
  tenantId: string;
  userId?: string | null;
  action: string;
  resourceId: string;
  correlationId: string | null;
  timestamp: string;
  ipAddress: string | null;
  details: string | null;
  eventType?: string | null;
}
```

The backend does not need to invent `eventType` if the audit table does not store it. The mapper already falls back to `action`.

`ipAddress` remains in the response only because the endpoint is admin/security-role restricted. Do not expose this response shape to non-admin users.

### Backend Error Behavior

- `401`/`403`: handled by existing authentication/authorization middleware.
- `200 []`: valid empty state.
- `400`: invalid non-integer `limit`.
- `404`: endpoint should not return this once implemented; treat it as a client-visible hydration error, not an empty state.
- `500`: client shows a non-blocking panel error state and retry action.

Do not audit reads of `/api/AuditLogs/recent` back into `AuditLogs` in Sprint 2. Auditing audit-log reads can create recursive audit noise and needs a broader compliance design.

## Frontend Architecture

### New Hydration Service

Add a dedicated service:

`apps/portal-web/src/app/notifications/notification-history.service.ts`

Responsibilities:

- wait for authenticated `AuthService.user$` with non-null `tenantId`,
- fetch `/api/AuditLogs/recent?limit=50`,
- map rows to `NotificationItem` with `source: 'history'`,
- pass mapped notifications to `NotificationSignalStore`,
- expose or update loading/error state,
- cancel in-flight hydration when tenant changes by using RxJS `switchMap` from the authenticated tenant stream,
- ignore stale responses defensively if a response still arrives after tenant change,
- avoid concurrent retry requests for the same tenant,
- time out hydration requests after 10 seconds,
- throttle retry to at most 3 attempts per 30 seconds per tenant,
- avoid duplicate hydration for the same tenant during a single app session unless retry is requested.

`RealTimeService` should remain focused on SignalR. It should not own startup history hydration.

The root `App` component should inject `NotificationHistoryService` so the service is instantiated on app startup, the same way it currently injects `RealTimeService`.

### Hydration Trigger

Hydration starts when:

1. `AuthService.user$` emits a user,
2. `user.tenantId` is present,
3. the tenant has not already been hydrated in the current browser session.

On logout:

- clear notifications,
- clear hydration state, including `hasHydrated = false`, `hydrationError = null`, and `isHydrating = false`,
- clear the last hydrated tenant ID.

On tenant switch:

- clear notifications,
- cancel or ignore the previous tenant's in-flight request,
- hydrate the new tenant.

If `AuthService.user$` emits an authenticated user with `tenantId: null`, hydration must fail closed:

- do not call `/api/AuditLogs/recent`,
- set loading to false,
- set panel error to `Unable to verify notification tenant.`,
- leave existing notifications cleared for that auth boundary.

This prevents the panel from hanging in loading state.

Retry while `tenantId` is still null repeats the same fail-closed behavior: no endpoint call, loading false, and `Unable to verify notification tenant.` remains visible.

If the same tenant re-emits after a failed hydration, the service may stay in the error state until the user clicks retry. A successful hydration for that tenant should not repeat automatically during the same browser session unless the auth tenant changes or retry is requested.

### In-Flight Tenant Safety

The hydration request captures `expectedTenantId` before calling the API. Use RxJS `switchMap` so changing tenants unsubscribes from the previous HTTP request. Angular `HttpClient` cancels the underlying request when unsubscribed.

When the response returns:

- if the current tenant differs from the captured tenant, discard the response;
- if an individual audit row has a mismatched tenant ID, the mapper returns `null`;
- only mapped notifications for the current tenant enter the store.

This mirrors the SignalR claim-check tenant safety rule.

## Store Changes

Extend `NotificationSignalStore` with hydration state and batch merge helpers.

The store should expose a small deterministic key helper for tests and future maintainers:

```typescript
export function getNotificationIdempotencyKey(notification: Pick<NotificationItem, 'tenantId' | 'id'>): string {
  return `${notification.tenantId}:${notification.id}`;
}
```

All idempotency checks must use this helper.

### New State

Add signals:

```typescript
readonly isHydrating: Signal<boolean>;
readonly hydrationError: Signal<string | null>;
readonly hasHydrated: Signal<boolean>;
readonly isEmpty: Signal<boolean>;
```

Internal writable state:

```typescript
private readonly _isHydrating = signal(false);
private readonly _hydrationError = signal<string | null>(null);
private readonly _hasHydrated = signal(false);
```

`hasHydrated` means the latest hydration attempt for the current tenant succeeded, even if the response had zero rows. Failed hydration should leave `hasHydrated` false and `hydrationError` populated.

`isEmpty` should be true only when:

- not hydrating,
- has hydrated,
- no hydration error,
- `notifications().length === 0`.

`isEmpty` does not depend on SignalR connection state in Sprint 2. Connection health UI belongs to a later resilience sprint.

### New Methods

Add:

```typescript
setHydrating(isHydrating: boolean): void;
setHydrationError(message: string | null): void;
markHydrated(): void;
addNotifications(notifications: NotificationItem[]): void;
```

`addNotifications()` should call the same dedupe path as `addNotification()`. It must not bypass the idempotency cache.

### Merge Order

For single and batch adds, the store must apply this order:

1. compute idempotency key as `${notification.tenantId}:${notification.id}`,
2. filter out duplicate keys already seen,
3. append unique notifications to the internal list,
4. sort by timestamp descending,
5. cap visible notifications to 50,
6. evict idempotency cache entries FIFO if the cache exceeds 1000 keys.

Duplicate IDs inside the same REST response count as duplicates too. The first occurrence in newest-first response order wins; later duplicates from the same batch are skipped.

The cache is tenant-scoped by key and also cleared on logout/tenant switch. Either behavior would prevent cross-tenant duplicate suppression; Sprint 2 requires both because auth-boundary clearing is already part of the store contract and tenant-scoped keys make the idempotency rule locally correct.

### Source Semantics

- History hydration maps rows with `source: 'history'`.
- SignalR maps rows with `source: 'signalr'`.
- If the same ID already exists, the later arrival is skipped.
- Sprint 2 does not replace an existing notification if the duplicate has a different `source`.

Example:

- History loads event `evt-123` with `source: 'history'`.
- SignalR later sends `evt-123`.
- Store skips the SignalR duplicate; the panel still shows one notification.

The reverse order behaves the same:

- SignalR adds `evt-123` first.
- History returns `evt-123`.
- Store skips the history duplicate.

### Buffer Limit

The visible buffer remains 50 notifications. Adding the 51st unique notification evicts the oldest visible notification after sorting newest first.

The idempotency cache must change in Sprint 2 from "clear the whole set after overflow" to deterministic FIFO eviction.

Implementation shape:

```typescript
private readonly seenNotificationKeys = new Set<string>();
private readonly seenNotificationKeyQueue: string[] = [];
```

When tracking a new notification:

1. compute key as `${tenantId}:${id}`,
2. add key to the set,
3. push key onto the queue,
4. while queue length exceeds 1000, shift the oldest key and delete it from the set.

After a key is evicted, the same tenant/event ID can be added again if it arrives later. This is expected cache behavior and must be covered by tests.

The cache is memory-only and resets on page refresh. That is acceptable because Sprint 2 recovers visible notifications from audit history after refresh.

## Mapping Rules

Hydrated rows use the same mapper as SignalR claim-check rows:

```typescript
mapAuditLogToNotification(row, {
  source: 'history',
  expectedEventId: row.id,
  expectedTenantId: currentTenantId
})
```

Rows that map to `null` are skipped and counted for debug/test purposes only. A few malformed rows should not fail the whole hydration request.

If the backend returns a non-empty response and all rows fail mapping:

- leave `hasHydrated` false,
- set `hydrationError` to `Unable to load recent notifications`,
- keep any existing notifications visible.

If the backend returns an empty array:

- set `hasHydrated` to true,
- clear `hydrationError`,
- show empty state if no notifications remain.

`EventType` is intentionally not added to `AuditEntry` in Sprint 2. Historical notifications classify from `Action` and `Details`. Adding an audit taxonomy column is a separate backend schema/migration project.

### Action Taxonomy

Sprint 2 uses the existing Sprint 1 taxonomy. Classification is deterministic and case-insensitive:

| Audit text match | Severity | Category | Title |
| --- | --- | --- | --- |
| `privilege` in action/details/event type | `critical` | `privilege` | `Privilege modified` |
| `loginanomaly` or `anomaly` in action/details/event type | `critical` | `authentication` | `Login anomaly detected` |
| `warning` or `failed` in action/details/event type | `warning` | `security` | `Security warning` |
| no match | `info` | `system` | `System activity` |

Priority is privilege, then login anomaly, then warning, then fallback. Unknown audit actions are not errors; they become `info/system` notifications.

Matching should be implemented as normalized token/segment matching, not raw substring matching. Split audit text on whitespace, punctuation, underscores, hyphens, and PascalCase boundaries. This means `SecurityWarning`, `security-warning`, and `security warning` match `warning`, but unrelated words such as `forewarning` do not match `warning`.

Display fields derived from `Action` and `Details` must continue through the Sprint 1 plain-text normalization path before rendering.

## UI States

Extend the design-system notification panel with explicit state inputs:

```typescript
@Input() isLoading = false;
@Input() error: string | null = null;
@Output() retry = new EventEmitter<void>();
```

These inputs/outputs do not exist in the current `NotificationPanelComponent`; Sprint 2 implementation must add them.

The component should use `ChangeDetectionStrategy.OnPush`. Its inputs are immutable arrays/primitive state flags from Angular signals, and OnPush keeps live SignalR updates from causing avoidable subtree checks.

The `App` template passes:

```html
<tai-notification-panel
  [notifications]="notificationPanelItems"
  [isLoading]="notificationStore.isHydrating()"
  [error]="notificationStore.hydrationError()"
  (retry)="notificationHistoryService.retry()">
</tai-notification-panel>
```

`notificationHistoryService` should be `protected readonly` on `App` so the template can call retry.

Retry is service-owned. `NotificationSignalStore` owns hydration state only; it should not know how to call HTTP endpoints or retry them.

### Loading State

When `isLoading` is true:

- keep existing notifications visible if any exist,
- show a compact loading row or inline status at the top of the panel,
- do not replace the whole list with a spinner.

The loading row should use accessible live-region semantics:

```html
<div role="status" aria-live="polite">Loading recent notifications...</div>
```

This avoids visual churn if refresh recovery is slow but live notifications already exist.

### Empty State

When not loading, no error exists, hydration has completed, and there are no notifications:

```text
No recent notifications
```

This intentionally replaces the current generic `No notifications` copy for the hydrated notification center. Do not show the empty state before the first hydration completes; otherwise users see a misleading empty panel during startup.

The empty state should use:

```html
<div role="status" aria-live="polite">No recent notifications</div>
```

### Error State

When hydration fails:

```text
Unable to load recent notifications
```

Show a retry button that emits `retry`.

If existing notifications are already visible, keep them visible and show the error state as a non-blocking inline banner. If no notifications are visible, the error can occupy the list body.

The error state should use assertive live-region semantics:

```html
<div role="alert" aria-live="assertive">Unable to load recent notifications</div>
```

The retry control must be a native `<button type="button">` so keyboard activation works by default. It must remain reachable by tab order when enabled and expose disabled state with the native `disabled` attribute while loading or throttled.

Retry behavior:

- retry is disabled while hydration is already loading,
- retry calls are debounced by at least 1000 ms,
- retry is throttled to at most 3 attempts per 30 seconds for the current tenant,
- when throttled, show inline copy `Retry limit reached. Try again shortly.` in the same error live region,
- retry clears the current error before starting a new request,
- retry uses the current tenant ID only.

## Error Handling

Frontend hydration error rules:

- `401`: trigger existing auth check flow, do not show panel error if the session is no longer authenticated.
- missing tenant ID: set panel error `Unable to verify notification tenant.` and do not call the endpoint.
- `403`: set panel error `You do not have access to recent notifications.`
- `404`: set panel error `Unable to load recent notifications`.
- `429`: set panel error `Recent notifications are temporarily rate limited.`
- `500` or network error: set panel error `Unable to load recent notifications`.
- request timeout after 10 seconds: set panel error `Unable to load recent notifications`.

Do not show toast for hydration failures in Sprint 2. Hydration is background recovery; panel-local error is less noisy.

SignalR claim-check errors keep their Sprint 1 behavior.

SignalR events received while hydration is loading should still be processed normally. The panel keeps visible notifications rendered and shows the loading row/banner without blocking live updates.

Sprint 2 does not add application-level backend rate limiting. The endpoint is bounded by role authorization and `limit <= 100`; the client still handles `429` because infrastructure, gateway, or future middleware may return it.

## Data Flow

### Refresh Recovery

1. User refreshes browser.
2. `App.ngOnInit()` calls `authService.checkAuth()`.
3. `AuthService.user$` emits authenticated user with `tenantId`.
4. `NotificationHistoryService` starts hydration for that tenant.
5. Client calls `GET /api/AuditLogs/recent?limit=50`.
6. Backend returns newest tenant-scoped audit rows.
7. Client maps rows to `NotificationItem[]` with `source: 'history'`.
8. Store merges notifications by ID.
9. Panel renders newest-first notifications.

### SignalR During Hydration

1. Hydration request is in flight.
2. SignalR claim-check adds event `evt-123`.
3. Hydration response later includes `evt-123`.
4. Store skips the duplicate by ID.
5. Panel still shows one notification.

### Hydration Before SignalR

1. History adds event `evt-123`.
2. SignalR later claim-checks event `evt-123`.
3. Store skips the duplicate by ID.
4. Panel still shows one notification.

## File-Level Design

### Backend

Modify:

- `apps/portal-api/Controllers/AuditLogsController.cs`

Add:

- `GetRecentAuditLogs([FromQuery] int? limit)` action.

Tests should cover this endpoint in the existing API test project or the closest existing integration test project for controllers.

### Portal-Web

Create:

- `apps/portal-web/src/app/notifications/notification-history.service.ts`
- `apps/portal-web/src/app/notifications/notification-history.service.spec.ts`

Modify:

- `apps/portal-web/src/app/store/notification-signal.store.ts`
- `apps/portal-web/src/app/store/notification-signal.store.spec.ts`
- `apps/portal-web/src/app/app.ts`
- `apps/portal-web/src/app/app.html`

### Design-System

Modify:

- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`

## Acceptance Criteria

- `GET /api/AuditLogs/recent?limit=50` exists.
- Recent endpoint returns newest-first audit rows.
- Recent endpoint is authenticated and tenant-scoped.
- Limit defaults to 50 and is clamped to 1-100.
- Non-integer limit returns `400 Bad Request`.
- Recent endpoint is restricted to `Admin`/`SystemAdmin` users.
- Non-admin authenticated users receive `403 Forbidden`, not `404`.
- `SystemAdmin` receives only current-tenant audit rows from this endpoint, not cross-tenant history.
- Empty or unavailable current tenant ID returns `403 Forbidden`.
- Recent endpoint applies an explicit `TenantId == currentTenantId` predicate in addition to EF query filtering.
- Recent endpoint response may include `ipAddress` only because access is admin/security-role restricted.
- Existing `IX_AuditLogs_TenantId_TimestampDesc` index supports the recent query.
- Portal-web hydrates recent notifications after auth user and tenant ID are available.
- Missing tenant ID sets panel error and does not call the endpoint.
- Hydration maps audit rows through `mapAuditLogToNotification()` with `source: 'history'`.
- Hydration passes `expectedEventId` and `expectedTenantId`.
- Hydration skips malformed or mismatched rows without failing the whole request.
- Non-empty history response where every row fails mapping becomes hydration error, not empty state.
- Action taxonomy uses normalized token/segment matching, not raw substring matching.
- Store supports batch add and dedupes by ID across history and SignalR.
- Store idempotency cache keys include tenant ID and event ID.
- Store idempotency key format is exactly `${tenantId}:${eventId}`.
- Store idempotency cache clears on logout and tenant switch.
- Store idempotency cache uses deterministic FIFO eviction at 1000 keys.
- Evicted idempotency keys can be re-added later.
- Duplicate history/SignalR events render only once.
- Duplicate IDs inside the same REST response render once.
- Visible buffer remains capped at 50 newest notifications.
- Logout and tenant switch clear notifications and hydration state, including resetting `hasHydrated` to false.
- In-flight hydration response is discarded if tenant changes before it returns.
- In-flight hydration request is cancelled by tenant stream switching.
- Panel shows loading state during hydration.
- Panel shows empty state only after successful hydration with zero notifications.
- Panel shows error state and retry action after hydration failure.
- Panel uses `ChangeDetectionStrategy.OnPush`.
- Loading and empty states use `role="status"` and `aria-live="polite"`.
- Error state uses `role="alert"` and `aria-live="assertive"`.
- Retry is a native keyboard-accessible button with native disabled state.
- Hydration failures do not show global toasts.
- Retry is disabled during loading and debounced by at least 1000 ms.
- Retry is throttled to at most 3 attempts per 30 seconds per tenant.
- Refreshing the browser repopulates the panel from recent tenant audit rows.

## Test Strategy

### Backend Tests

Cover:

- returns `200 OK` with recent audit rows,
- newest-first ordering,
- `limit=1` returns one row,
- default limit is 50,
- `limit=0` falls back to 50,
- `limit=-1` falls back to 50,
- limit clamps at maximum 100,
- non-integer limit returns `400 Bad Request`,
- no visible rows returns `200 OK` with `[]`,
- endpoint does not return audit rows from another tenant,
- runtime integration test uses two tenant contexts and verifies each tenant sees only its own audit rows,
- SystemAdmin context still returns only current-tenant audit rows,
- empty or unavailable current tenant ID returns `403`,
- EF model contains an `AuditEntry` tenant query filter,
- EF model contains `IX_AuditLogs_TenantId_TimestampDesc`,
- ordinary non-admin tenant users receive `403`,
- admin response includes `ipAddress` when audit row has one,
- non-admin `403` response does not expose audit payload or IP address.

### Store Unit Tests

Cover:

- `addNotifications()` adds a batch newest first,
- batch add dedupes IDs already in the store,
- batch add dedupes duplicate IDs inside the batch,
- history then SignalR duplicate renders once,
- SignalR then history duplicate renders once,
- history batch plus two SignalR updates with overlapping IDs renders each unique event once,
- 51st unique notification evicts oldest visible notification,
- idempotency cache keys include tenant ID,
- idempotency key helper returns exact `${tenantId}:${eventId}` format,
- idempotency cache clears on tenant switch,
- idempotency cache evicts oldest keys FIFO after 1000 keys by proving the first inserted key is evicted while newer keys remain deduped,
- evicted idempotency key can be re-added,
- `setHydrating`, `setHydrationError`, and `markHydrated` update state,
- `isEmpty` is false before hydration completes,
- `isEmpty` is true after successful empty hydration,
- `clearForAuthBoundaryChange()` clears notifications, dedupe cache, hydration error, and hydration completion state.

### History Service Tests

Cover:

- waits for authenticated user with tenant ID,
- handles authenticated user with null tenant ID as fail-closed panel error,
- calls `/api/AuditLogs/recent?limit=50`,
- maps rows with `source: 'history'`,
- passes expected event and tenant IDs,
- skips rows that map to `null`,
- partial mapping failure still adds valid mapped rows,
- non-empty response where all rows map to `null` sets hydration error,
- empty history response with existing SignalR notifications does not show empty state or remove existing notifications,
- sets loading true before request and false after completion,
- marks hydrated after success,
- sets panel error after `500` or network failure,
- handles `429` with rate-limit error copy,
- handles `403` with access-denied error copy,
- handles `404` as a hydration error, not empty state,
- handles request timeout after 10 seconds as hydration error,
- does not show toast on hydration failure,
- retry re-runs hydration for the current tenant,
- retry with null tenant ID does not call endpoint,
- retry is ignored while loading,
- retry is debounced by at least 1000 ms,
- retry is throttled after 3 attempts in 30 seconds,
- throttled retry keeps existing notifications visible and shows `Retry limit reached. Try again shortly.`,
- logout during hydration cancels request, clears notifications, clears error, and resets `hasHydrated` to false,
- tenant switch clears store and hydrates new tenant,
- in-flight old-tenant request is cancelled,
- stale old-tenant response is discarded if it still arrives.

### Panel Component Tests

Cover:

- loading row renders when `isLoading` is true,
- loading row has `role="status"` and `aria-live="polite"`,
- existing notifications remain visible during loading,
- live SignalR notification can appear while loading row remains visible,
- empty state renders only when no notifications and not loading,
- empty state has `role="status"` and `aria-live="polite"`,
- error state renders with retry button,
- error state has `role="alert"` and `aria-live="assertive"`,
- retry button is disabled while loading,
- retry button is a native button and supports keyboard activation,
- throttled retry state shows remaining/error copy and disabled retry state,
- retry button emits `retry`,
- error banner can render while notifications remain visible.

### Integration/E2E Test

Add or update an e2e scenario:

1. Log in as `admin@tai.com`.
2. Modify a privilege to create an audit row.
3. Confirm SignalR notification appears.
4. Refresh the browser.
5. Confirm notification panel repopulates from `/api/AuditLogs/recent?limit=50`.
6. Confirm only one copy appears if SignalR reconnect also delivers the same event.

## Risks and Mitigations

### Risk: Endpoint Becomes a Generic Audit Browser

Mitigation: Sprint 2 only supports `recent` with a bounded limit. No search, arbitrary tenant bypass, date range, pagination, or admin export.

### Risk: Duplicate Notifications Across REST and SignalR

Mitigation: all sources merge through `NotificationSignalStore` and dedupe by stable audit event ID.

### Risk: Hydration Races Tenant Switch

Mitigation: capture tenant ID before request, validate rows through mapper, and discard response if current tenant changed.

### Risk: Panel Shows Empty State Too Early

Mitigation: empty state depends on `hasHydrated`, not just `notifications.length`.

### Risk: Mapper Classification Is Imperfect for Historical Rows

Mitigation: Sprint 2 uses existing mapper behavior. Backend does not need to infer event type. Improvements to audit taxonomy belong in a later mapping sprint.

### Risk: Store Keeps Deprecated Aliases Too Long

Mitigation: Sprint 2 may keep aliases for compatibility, but no new code should use `eventBuffer`, `latestEvent`, `addEvent`, `removeEvent`, or `clearBuffer`.

## Demo Outcome

The demo should show resilience:

1. Edit a privilege and see a live critical notification.
2. Refresh the browser.
3. Open the notification panel.
4. The recent privilege notification is still there, now hydrated from REST history.
5. Trigger another privilege edit and see the live SignalR notification merge into the same newest-first list without duplicates.

Resume language:

> Built refresh-resilient real-time notifications by combining tenant-scoped REST hydration with SignalR claim-check updates, typed notification mapping, idempotent merge semantics, and explicit loading/error/empty UI states.
