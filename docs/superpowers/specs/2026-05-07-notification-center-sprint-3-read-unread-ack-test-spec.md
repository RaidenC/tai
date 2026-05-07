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

## Architectural Decisions Under Test

The tests should encode these decisions so implementation does not drift:

- User scope uses `AuthService.User.id`, which is normalized from the OIDC `sub` claim. Email is display-only and must not be used in storage keys.
- `NotificationHistoryService` observes `AuthService.user$` and configures the notification store lifecycle scope before hydration rows are mapped or merged.
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
- Existing `NotificationPanelService` remains responsible for panel visibility, severity filter, and search text. Its manual unread count methods become legacy compatibility only and must not be the source of truth for the Sprint 3 badge.
- LocalStorage cleanup is bounded: every successful lifecycle write for the active scope prunes stored records to event IDs currently retained in the notification store. This keeps storage growth tied to the 50-item visible buffer.

## LocalStorage Key Contract

Use a deterministic versioned key with tenant and OIDC subject scope:

```text
tai.portal.notifications.lifecycle.v1:${tenantId}:${oidcSubject}
```

The value should be a JSON object keyed by event ID:

```json
{
  "evt-123": {
    "readAt": "2026-05-07T18:00:00.000Z",
    "acknowledgedAt": "2026-05-07T18:01:00.000Z"
  }
}
```

Tests must treat malformed localStorage data as recoverable. Bad JSON, non-object values, invalid timestamp values, and partial records should not break notification hydration or SignalR processing. Invalid records are ignored.

Persisted records are overlays only. A fabricated localStorage event ID must not render unless the same event exists in the hydrated or SignalR notification buffer.

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

Persistence tests:

- `markRead(eventId)` writes the event record under `tai.portal.notifications.lifecycle.v1:tenant-1:user-sub-1`.
- `markAllRead()` writes all retained event IDs under the active tenant/OIDC subject key.
- `acknowledge(eventId)` writes `acknowledgedAt` under the active tenant/OIDC subject key.
- tenant `tenant-1` state does not apply to tenant `tenant-2`.
- user subject `user-sub-1` state does not apply to user subject `user-sub-2`, even if email is the same.
- changing email while `User.id` stays the same does not change the storage key.
- missing tenant or missing user prevents persistence, still updates in-memory state, and does not throw.
- malformed localStorage JSON is ignored and replaced only after the next write.
- localStorage quota/security errors are caught and do not prevent in-memory updates.
- localStorage failures do not emit lifecycle payloads, event IDs, tenant IDs, OIDC subjects, or emails to console logs.
- lifecycle writes prune records not present in the current retained notification IDs.
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
- preserves unrelated retained event records when updating one event.
- prunes records to the provided retained event ID allow-list during writes.
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
- unread marker has an accessible label or text equivalent.
- clicking the mark-read control emits `markRead` with the notification ID.
- mark-read control is not shown for already-read notifications.
- mark-all-read control is enabled when at least one notification is unread.
- mark-all-read control is disabled when no notifications are unread.
- clicking mark-all-read emits `markAllRead`.
- critical unread/unacknowledged notifications render an acknowledge control.
- acknowledged critical notifications render acknowledged state and no active acknowledge control.
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
