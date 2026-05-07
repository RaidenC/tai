# Notification Center Sprint 3: Read/Unread + Acknowledgement Test Spec

## Purpose

Sprint 3 turns hydrated/live notifications into a user-specific lifecycle model. This test spec defines the expected coverage before implementation: read/unread state, mark-one-read, mark-all-read, critical acknowledgement, and local persistence keyed by tenant, user, and notification event ID.

No backend notification tables or APIs are part of this sprint. The durable source of notification events remains audit history plus SignalR. Lifecycle state is browser-local and overlays the existing `NotificationItem` model.

## Test Contract

The implementation must satisfy these behavioral contracts:

- New notifications are unread unless persisted local state says otherwise.
- Read state is represented by `readAt: string | null` on `NotificationItem`.
- Acknowledgement state is represented by `acknowledgedAt: string | null` on `NotificationItem`.
- Read and acknowledgement timestamps are ISO-8601 strings.
- Local lifecycle state is isolated by tenant ID, user ID, and event ID.
- Local lifecycle state survives refresh and rehydration from `/api/AuditLogs/recent`.
- SignalR duplicates and REST hydration duplicates preserve existing read/ack state.
- Marking one notification read updates store state and localStorage.
- Marking all notifications read updates all currently retained notifications and localStorage.
- Only critical notifications expose acknowledgement behavior.
- Acknowledging a critical notification also marks it read.
- Non-critical notifications cannot be acknowledged through the public store API.
- Search and severity filtering continue to operate on notification metadata and must not hide lifecycle state.
- Unread badge count is derived from unread notifications, not manually maintained panel service state.
- Logout or tenant switch clears in-memory notifications, but must not delete persisted lifecycle state for other tenant/user scopes.

## LocalStorage Key Contract

Use a deterministic versioned key with tenant and user scope:

```text
tai.portal.notifications.lifecycle.v1:${tenantId}:${userId}
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

## Fixtures

Use compact fixtures in tests rather than broad production setup:

- tenant: `tenant-1`
- second tenant: `tenant-2`
- user: `admin@tai.com`
- second user: `auditor@tai.com`
- critical event: `evt-critical-1`, severity `critical`, category `privilege`
- warning event: `evt-warning-1`, severity `warning`, category `security`
- info event: `evt-info-1`, severity `info`, category `system`

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

- `addNotification()` adds new notification with `readAt: null` and `acknowledgedAt: null` when no persisted state exists.
- `addNotifications()` overlays persisted read state onto hydrated history rows.
- `addNotifications()` overlays persisted acknowledgement state onto hydrated history rows.
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
- Re-adding a notification after auth boundary clear reapplies persisted lifecycle state for the active tenant/user.

Persistence tests:

- `markRead(eventId)` writes the event record under `tai.portal.notifications.lifecycle.v1:tenant-1:admin@tai.com`.
- `markAllRead()` writes all retained event IDs under the active tenant/user key.
- `acknowledge(eventId)` writes `acknowledgedAt` under the active tenant/user key.
- tenant `tenant-1` state does not apply to tenant `tenant-2`.
- user `admin@tai.com` state does not apply to user `auditor@tai.com`.
- missing tenant or missing user prevents persistence and does not throw.
- malformed localStorage JSON is ignored and replaced only after the next write.
- localStorage quota/security errors are caught and do not prevent in-memory updates.

## Lifecycle Persistence Tests

Preferred target if implementation introduces a dedicated persistence helper:

```text
apps/portal-web/src/app/notifications/notification-lifecycle-storage.service.spec.ts
```

If persistence remains inside `NotificationSignalStore`, add these cases to `notification-signal.store.spec.ts` instead.

Cover:

- builds exact storage key from tenant ID and user ID.
- reads empty state when key is missing.
- reads valid lifecycle records by event ID.
- ignores invalid JSON.
- ignores arrays, strings, numbers, and null root values.
- ignores records with non-string `readAt` or `acknowledgedAt`.
- ignores records with invalid date strings.
- preserves unrelated event records when updating one event.
- removes no records during normal reads.
- handles `localStorage.getItem()` and `setItem()` exceptions without throwing to callers.

## Auth/User Scope Tests

Target file:

```text
apps/portal-web/src/app/notifications/notification-history.service.spec.ts
```

Add tests only where lifecycle scope crosses hydration:

- hydration configures lifecycle scope from authenticated `tenantId` and user identifier before rows are mapped into the store.
- tenant switch clears in-memory notifications and switches lifecycle storage key.
- logout clears in-memory notifications and removes active lifecycle scope.
- retry hydration after logout does not write lifecycle state without an active user and tenant.
- re-login as the same tenant/user reapplies persisted read/ack state to hydrated notifications.
- re-login as a different user does not reuse the previous user's read/ack state.

If lifecycle scope is configured outside `NotificationHistoryService`, place these tests in the owning service spec and keep the same behaviors.

## Panel Component Tests

Target file:

```text
libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts
```

Extend `NotificationPanelItem` test fixtures to include:

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

- badge is hidden when `unreadCount` is `0`.
- badge shows count when unread count is between `1` and `9`.
- badge shows `9+` when unread count is greater than `9`.
- badge updates after marking one notification read.
- badge clears after marking all notifications read.
- badge count does not include read notifications restored from localStorage.

If the toggle remains design-system-only and receives a numeric input instead of injecting the app store, test the input contract there and cover store-to-input wiring in the app shell/root component tests.

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
- notification toggle receives or derives unread count from the notification store.
- hydration loading/error inputs from Sprint 2 still pass through unchanged.

## E2E Test

Target file:

```text
apps/portal-web-e2e/src/notifications-lifecycle.spec.ts
```

Add one focused flow:

1. Log in as `admin@tai.com`.
2. Create or seed a critical privilege notification.
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

Use existing e2e auth and privilege-modification helpers where possible. If SignalR is difficult to make deterministic in e2e, assert duplicate prevention in store unit tests and keep e2e focused on refresh persistence.

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
