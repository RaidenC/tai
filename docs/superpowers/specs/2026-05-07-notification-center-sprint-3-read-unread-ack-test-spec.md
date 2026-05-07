# Notification Center Sprint 3: Read/Unread + Acknowledgement Test Spec

## Purpose

Sprint 3 turns hydrated/live notifications into a user-specific lifecycle model. This test spec defines the expected coverage before implementation: read/unread state, mark-one-read, mark-all-read, critical acknowledgement, and local persistence keyed by tenant, OIDC subject, and notification event ID.

No backend notification tables or APIs are part of this sprint. The durable source of notification events remains audit history plus SignalR. Lifecycle state is browser-local and overlays the existing `NotificationItem` model.

## Test Contract

The implementation must satisfy these behavioral contracts:

- `NotificationItem` already contains `readAt` and `acknowledgedAt`; Sprint 3 tests focus on lifecycle overlay, mutation, persistence, and UI wiring.
- New notifications are unread unless persisted local state says otherwise.
- Read state is represented by `readAt: string | null` on `NotificationItem`.
- Acknowledgement state is represented by `acknowledgedAt: string | null` on `NotificationItem`.
- Read and acknowledgement timestamps are ISO-8601 strings.
- Local lifecycle state is isolated by tenant ID, stable OIDC subject, and event ID.
- Local lifecycle state survives refresh and rehydration from `/api/AuditLogs/recent`.
- SignalR duplicates and REST hydration duplicates preserve existing read/ack state.
- Marking one notification read updates store state and localStorage.
- Marking all notifications read updates all currently retained notifications and localStorage.
- Only critical notifications expose acknowledgement behavior.
- Acknowledging a critical notification also marks it read.
- Non-critical notifications cannot be acknowledged through the public store API.
- Search and severity filtering continue to operate on notification metadata and must not hide lifecycle state.
- Unread badge count is derived from unread notifications, not manually maintained panel service state.
- Logout or tenant switch clears in-memory notifications and active lifecycle scope, but does not delete localStorage lifecycle records. Re-login as the same tenant/OIDC subject reapplies persisted read/ack state.
- Existing real-time console logging that prints security payloads, audit details, event IDs, tenant IDs, OIDC subjects, or emails must be removed or sanitized before lifecycle work ships.

## Architectural Decisions Under Test

The tests should encode these decisions so implementation does not drift:

- User scope uses `AuthService.User.id`, which is normalized from the OIDC `sub` claim. Email is display-only and must not be used in storage keys.
- `NotificationHistoryService` observes `AuthService.user$`, extracts both `tenantId` and `User.id`, and calls `setLifecycleScope({ tenantId, userId: user.id })` before `hydrateTenant()` starts.
- `NotificationSignalStore` owns lifecycle overlay and mutation. A small storage helper may be injected into the store, but components must not read localStorage directly.
- Store API shape:

```typescript
setLifecycleScope(scope: { tenantId: string; userId: string } | null): void;
markRead(eventId: string): void;
markAllRead(): void;
acknowledge(eventId: string): void;
readonly unreadCount: Signal<number>;
readonly hasUnread: Signal<boolean>;
readonly criticalUnacknowledgedCount: Signal<number>;
```

- Duplicate REST/SignalR events are still skipped by idempotency key. The existing in-memory item remains authoritative, including any read/ack state.
- Persisted state is overlaid only when a notification is newly admitted into the store. Persistence records never create notifications by themselves.
- Lifecycle writes are synchronous against the active scope at the start of the operation. If scope is missing, the in-memory update still happens, persistence is skipped, and no error is thrown.
- `NotificationPanelItem` must be extended with `readAt` and `acknowledgedAt`. This is an intentional design-system API change and must be covered by app mapping tests.
- `NotificationToggleComponent` remains design-system decoupled. It receives `@Input() unreadCount = 0` from the app shell/root component and must not inject `NotificationSignalStore`.
- Existing `NotificationPanelService` remains responsible for panel visibility, severity filter, and search text. Its manual unread count methods become deprecated compatibility only and must not be called by Sprint 3 code.
- LocalStorage cleanup uses a sliding retention window, not the current 50-item visible buffer. Each scope retains lifecycle records for the most recent 1,500 event IDs seen by that tenant/OIDC subject. This is intentionally larger than the 1,000-entry idempotency cache so a read notification can be re-added after idempotency eviction and still regain its lifecycle state.
- LocalStorage scope cleanup is bounded by an index key. Keep at most 10 tenant/OIDC-subject lifecycle scopes; prune the least-recently-used scope when adding an 11th scope.
- `clearForAuthBoundaryChange()` must call or internally perform `setLifecycleScope(null)` so store state and active persistence scope cannot diverge.
- `App.notificationPanelItems` should be a computed signal, not a plain getter, once lifecycle fields are included.

## LocalStorage Key Contract

Use a deterministic versioned key with tenant and OIDC subject scope:

```text
tai.portal.notifications.lifecycle.v1:${tenantId}:${oidcSubject}
```

Track recently used scopes with:

```text
tai.portal.notifications.lifecycle.scopes.v1
```

The scope index value is an array of storage keys, most recently used first. The per-scope value is a JSON object keyed by event ID:

```json
{
  "evt-123": {
    "readAt": "2026-05-07T18:00:00.000Z",
    "acknowledgedAt": "2026-05-07T18:01:00.000Z"
  }
}
```

Tests must treat malformed localStorage data as recoverable. Bad JSON or a non-object root rejects that scope value and returns empty lifecycle state. Within a valid object root, invalid individual records are ignored while valid sibling records are kept.

Persisted records are overlays only. A fabricated localStorage event ID must not render unless the same event exists in the hydrated or SignalR notification buffer.

Key segments must be encoded before composing the key. Tests should cover tenant and subject values containing `:`, `/`, whitespace, and Unicode-like input so one user's key cannot collide with another user's key.

Schema versioning is key-based. Future `v2` storage must use a new key prefix; Sprint 3 does not migrate between versions, but tests should verify `v1` readers ignore unknown fields inside valid records.

## Fixtures

Use compact fixtures in tests rather than broad production setup:

- tenant: `tenant-1`
- second tenant: `tenant-2`
- user subject: `user-sub-1`
- second user subject: `user-sub-2`
- user email: `admin@tai.com`
- second user email: `auditor@tai.com`
- critical event: `evt-001`, severity `critical`, category `privilege`
- warning event: `evt-002`, severity `warning`, category `security`
- info event: `evt-003`, severity `info`, category `system`

Use deterministic clocks where timestamps matter. In Vitest, prefer fake timers pinned to:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-07T18:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

new Date('2026-05-07T18:00:00.000Z')
```

## Store Unit Tests

Target file:

```text
apps/portal-web/src/app/store/notification-signal.store.spec.ts
```

Add or update tests for:

- `setLifecycleScope({ tenantId, userId })` stores the active scope used by persistence.
- `setLifecycleScope(null)` clears the active scope without deleting localStorage.
- `addNotification()` adds new notification with `readAt: null` and `acknowledgedAt: null` when no persisted state exists.
- `addNotifications()` overlays persisted read state onto hydrated history rows.
- `addNotifications()` overlays persisted acknowledgement state onto hydrated history rows.
- persisted lifecycle records for unknown event IDs do not create notifications.
- persisted lifecycle overlay applies to SignalR notifications that arrive before history hydration completes.
- SignalR notification receives persisted lifecycle state when added after refresh.
- History then SignalR duplicate keeps the existing read/ack state.
- SignalR then history duplicate keeps the existing read/ack state.
- `markRead(eventId)` sets `readAt` for one matching notification.
- `markRead(eventId)` is idempotent and does not replace an existing `readAt`.
- `markRead(eventId)` ignores unknown event IDs.
- `markAllRead()` sets `readAt` for all retained notifications.
- `markAllRead()` does not replace existing `readAt` values.
- `acknowledge(eventId)` sets `acknowledgedAt` for critical notifications.
- `acknowledge(eventId)` also sets `readAt` when the critical notification was unread.
- `acknowledge(eventId)` is idempotent and does not replace an existing `acknowledgedAt`.
- `acknowledge(eventId)` ignores warning/info notifications.
- `acknowledge(eventId)` ignores unknown event IDs.
- `unreadCount` returns the count of notifications with `readAt === null`.
- `criticalUnacknowledgedCount` returns the count of critical notifications with `acknowledgedAt === null`.
- `hasUnread` is false when every retained notification has `readAt`.
- `clearForAuthBoundaryChange()` clears in-memory lifecycle state with notifications.
- `clearForAuthBoundaryChange()` clears active lifecycle scope.
- Re-adding a notification after auth boundary clear reapplies persisted lifecycle state for the active tenant/OIDC subject.
- Re-adding a read notification after it has left the 50-item visible buffer and after its idempotency key has been FIFO-evicted still overlays persisted `readAt` while the event ID remains inside the 1,500-entry lifecycle retention window.
- Re-adding a notification after its event ID has aged out of the 1,500-entry lifecycle retention window treats it as unread.
- The 1,501st lifecycle event for a scope prunes only the oldest lifecycle record, not all records outside the visible buffer.

Persistence tests:

- `markRead(eventId)` writes the event record under `tai.portal.notifications.lifecycle.v1:tenant-1:user-sub-1`.
- `markAllRead()` writes all retained event IDs under the active tenant/OIDC subject key.
- `acknowledge(eventId)` writes `acknowledgedAt` under the active tenant/OIDC subject key.
- tenant `tenant-1` state does not apply to tenant `tenant-2`.
- user subject `user-sub-1` state does not apply to user subject `user-sub-2`, even if email is the same.
- changing email while `User.id` stays the same does not change the storage key.
- missing tenant or missing user prevents persistence, still updates in-memory state, and does not throw.
- malformed localStorage JSON is ignored and replaced only after the next write.
- partial corruption ignores only invalid records while preserving valid sibling records.
- `QuotaExceededError`, `SecurityError`, and generic `DOMException` failures from localStorage are caught and do not prevent in-memory updates.
- localStorage failures do not emit lifecycle payloads, event IDs, tenant IDs, OIDC subjects, or emails to console logs.
- lifecycle writes prune records outside the 1,500-event retention window.
- lifecycle scope index keeps at most 10 scopes and prunes the least-recently-used scope storage key when the 11th scope is written.
- localStorage keys such as `__proto__` and `constructor` are ignored and do not mutate object prototypes.

## Lifecycle Persistence Tests

Preferred target if implementation introduces a dedicated persistence helper:

```text
apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.spec.ts
```

If persistence remains inside `NotificationSignalStore`, add these cases to `notification-signal.store.spec.ts` instead.

Cover:

- builds exact storage key from tenant ID and OIDC subject.
- uses OIDC subject, not email, for the user ID segment.
- reads empty state when key is missing.
- reads valid lifecycle records by event ID.
- ignores invalid JSON.
- ignores arrays, strings, numbers, and null root values.
- ignores dangerous event ID keys such as `__proto__`, `prototype`, and `constructor`.
- ignores records with non-string `readAt` or `acknowledgedAt`.
- ignores records with invalid date strings.
- preserves valid records when a sibling record is invalid.
- preserves unrelated retained event records when updating one event.
- prunes records to the provided 1,500-event retention allow-list during writes.
- maintains the 10-scope least-recently-used scope index.
- encodes tenant and subject key segments so special characters cannot collide across scopes.
- ignores unknown fields inside otherwise valid records.
- handles `localStorage.getItem()` and `setItem()` exceptions without throwing to callers.

## Auth/User Scope Tests

Target file:

```text
apps/portal-web/src/app/notifications/notification-history.service.spec.ts
```

Add tests only where lifecycle scope crosses hydration:

- hydration configures lifecycle scope from authenticated `tenantId` and `User.id` before rows are mapped into the store.
- tenant switch clears in-memory notifications and switches lifecycle storage key.
- logout clears in-memory notifications and removes active lifecycle scope.
- retry hydration after logout does not write lifecycle state without an active user and tenant.
- re-login as the same tenant/OIDC subject reapplies persisted read/ack state to hydrated notifications.
- re-login as the same OIDC subject with a changed email reapplies persisted read/ack state.
- re-login as a different OIDC subject does not reuse the previous user's read/ack state.
- tenant switch-back from `tenant-1` to `tenant-2` to `tenant-1` reapplies `tenant-1` lifecycle state.
- auth boundary change during a pending lifecycle write cannot write to the new tenant/OIDC-subject key.
- SignalR event before hydration still receives persisted lifecycle state once the lifecycle scope is available.

## Real-Time Service Tests

Target file:

```text
apps/portal-web/src/app/real-time.service.spec.ts
```

Cover:

- handling `SecurityEvent` does not call `NotificationPanelService.setUnreadCount()`.
- adding a SignalR notification relies on `NotificationSignalStore.unreadCount`, not total buffer length.
- security event handling does not log raw payloads, audit details, event IDs, tenant IDs, OIDC subjects, emails, or notification objects through `console.log`, `console.warn`, or `console.error`.
- connection lifecycle logs, if retained, contain only static status text and no event payload fields.
- claim-check failure toast behavior from Sprint 1/2 remains unchanged.

## Panel Component Tests

Target file:

```text
libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts
```

Extend `NotificationPanelItem` test fixtures and type contract to include:

```typescript
readAt: string | null;
acknowledgedAt: string | null;
```

Cover:

- unread notifications render with a stable unread visual marker.
- read notifications do not render the unread marker.
- unread marker exposes `aria-label="Unread notification"` or equivalent accessible text.
- read rows expose `aria-label="Read notification"` or equivalent accessible text.
- clicking the mark-read control emits `markRead` with the notification ID.
- mark-read control is not shown for already-read notifications.
- mark-all-read control is enabled when at least one notification is unread.
- mark-all-read control is disabled when no notifications are unread.
- clicking mark-all-read emits `markAllRead`.
- critical unread/unacknowledged notifications render an acknowledge control.
- unacknowledged critical rows expose `aria-label="Acknowledgement required"` or equivalent accessible text.
- acknowledged critical notifications render acknowledged state, expose `aria-label="Acknowledged notification"` or equivalent accessible text, and no active acknowledge control.
- warning/info notifications never render acknowledge controls.
- clicking acknowledge emits `acknowledge` with the notification ID.
- lifecycle controls are native buttons with `type="button"`.
- lifecycle controls remain keyboard reachable.
- lifecycle controls remain usable while Sprint 2 loading or error banners are visible.
- filtering by severity preserves read/ack visual state on rendered rows.
- searching preserves read/ack visual state on rendered rows.
- loading/error banners from Sprint 2 can render while read/ack controls remain usable for visible rows.

Do not test implementation-specific CSS class names except for existing stable hooks. Prefer role, button name, emitted output, and visible text/state assertions.

## Toggle Component Tests

Target file:

```text
libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.spec.ts
```

Update badge tests so the count comes from the notification lifecycle source rather than manual calls to `NotificationPanelService.setUnreadCount()`.

Cover:

- component accepts unread count through `@Input() unreadCount = 0`.
- badge is hidden when `unreadCount` is `0`.
- badge shows count when unread count is between `1` and `9`.
- badge shows `9+` when unread count is greater than `9`.
- badge updates after marking one notification read.
- badge clears after marking all notifications read.
- badge count does not include read notifications restored from localStorage.

Do not make the toggle inject the portal-web notification store. Cover store-to-input wiring in the app shell/root component tests.

NotificationPanelService compatibility tests:

- `NotificationToggleComponent` no longer injects or reads `NotificationPanelService.unreadCount`.
- `NotificationPanelService.setUnreadCount()`, `decrementUnread()`, and `markAllAsRead()` either remain as deprecated no-op/compatibility methods or are removed with corresponding test updates for every consumer.
- no production code in `apps/portal-web` calls those unread methods after Sprint 3.

## App Integration Unit Tests

Target file:

```text
apps/portal-web/src/app/app.spec.ts
```

Cover:

- root app passes notification `readAt` and `acknowledgedAt` into `tai-notification-panel`.
- root app wires panel `markRead` output to the notification store.
- root app wires panel `markAllRead` output to the notification store.
- root app wires panel `acknowledge` output to the notification store.
- notification toggle receives unread count from `notificationStore.unreadCount()`.
- notification panel item mapping is a computed signal and includes lifecycle fields without dropping `readAt` or `acknowledgedAt`.
- app tests provide a `NotificationSignalStore` mock with `notifications`, `unreadCount`, `isHydrating`, `hydrationError`, `markRead`, `markAllRead`, and `acknowledge`.
- hydration loading/error inputs from Sprint 2 still pass through unchanged.

## E2E Test

Target file:

```text
apps/portal-web-e2e/src/notifications-lifecycle.spec.ts
```

Add one focused flow:

1. Log in as `admin@tai.com`.
2. Modify a privilege to create a critical privilege notification through the existing UI/API flow.
3. Open the notification panel.
4. Verify unread badge count includes the notification.
5. Mark the notification read.
6. Verify unread badge count decreases.
7. Acknowledge the critical notification.
8. Refresh the browser.
9. Open the notification panel.
10. Verify the notification still appears from recent audit hydration.
11. Verify it remains read and acknowledged after refresh.
12. Verify no duplicate row appears if SignalR also delivers the same event.

Use existing e2e auth and privilege-modification helpers where possible. Do not introduce a test-only audit seeding API for Sprint 3. If SignalR is difficult to make deterministic in e2e, assert duplicate prevention in store unit tests and keep e2e focused on refresh persistence.

## Accessibility Assertions

Panel tests and e2e should assert:

- mark-read, mark-all-read, and acknowledge controls are buttons.
- controls have accessible names.
- unread state is exposed to assistive technology.
- acknowledged state is exposed to assistive technology.
- keyboard activation works for mark-read and acknowledge controls.
- focus is not lost when a row changes from unread to read.
- unread/read/acknowledged state changes use stable row identity so keyboard focus remains on the row or moves to the next logical control.
- Sprint 2 loading/error live regions remain intact.

## Regression Guardrails

Add tests to prevent regressions:

- search still matches `title`, `summary`, `eventType`, `actor`, and `userId`.
- severity filtering still filters by `severity`.
- read/ack metadata is not included in search text.
- clearing notifications does not erase persisted lifecycle state.
- clearing persisted lifecycle state is not part of Sprint 3 public behavior.
- REST/SignalR idempotency still uses `${tenantId}:${eventId}`.
- visible buffer remains capped at 50 newest notifications.
- lifecycle retention remains capped at 1,500 event IDs per scope and 10 scopes total.
- localStorage lifecycle state is only applied to notifications that exist in the store.
- `NotificationPanelService.setUnreadCount()`, `decrementUnread()`, and `markAllAsRead()` are not used as Sprint 3 source-of-truth APIs.

## Verification Commands

Run these after implementation:

```bash
CI=true npx nx test portal-web --skip-nx-cache
CI=true npx nx test design-system --skip-nx-cache
CI=true npx nx e2e portal-web-e2e --skip-nx-cache
```

If implementation changes shared TypeScript models or app shell wiring, also run:

```bash
CI=true npx nx build portal-web --skip-nx-cache
CI=true npx nx build-storybook design-system --skip-nx-cache
```

## Acceptance Gate

Sprint 3 is test-ready when:

- all applicable unit tests above exist and fail against the current Sprint 2 behavior before implementation,
- implementation makes those tests pass without removing Sprint 2 hydration tests,
- e2e proves read/ack state survives browser refresh,
- no test depends on a real backend notification table,
- localStorage scope isolation is covered for tenant and user boundaries.
