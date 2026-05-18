# Notification Center Sprint 4 — Resilience, Accessibility, and E2E Polish

> **Goal:** Make the notification center senior-level — resilient real-time UI, fully accessible, comprehensive e2e coverage.

**Architecture:** Extend existing sprint 3 foundation. Connection state flows from `RealTimeService.connectionStatus$` to App via `toSignal()`, then App maps SignalR states to a UI-local notification panel state. App triggers rehydration on reconnect and owns the test-only connection override hook so `RealTimeService` remains pure SignalR management. Focus trap uses `@angular/cdk/a11y` FocusTrap directive on a wrapper container. Keyboard navigation uses roving focus on list items, with focus tracked by notification ID so list mutations do not strand keyboard users.

**Tech Stack:** Angular standalone components, Angular signals, RxJS, `@angular/cdk/a11y`, Vitest, Nx, Playwright e2e.

---

## Current State (Sprints 1-3)

**Sprint 1 (PR #89):**
- `NotificationItem` domain model with severity, category, source types
- Claim Check pattern: SignalR minimal payload → REST fetch → notification
- `NotificationMapper` for `AuditLogDetails` → `NotificationItem`
- Tenant isolation validation
- Real-time privilege edit notifications working

**Sprint 2 (PR #90):**
- `GET /api/AuditLogs/recent?limit=50` endpoint (count-based, no time filter)
- Tenant-scoped idempotency keys with FIFO eviction (1000 entry cache)
- Hydration state signals: `isHydrating`, `hydrationError`, `hasHydrated`
- `NotificationHistoryService` with auth-ready hydration, retry (1s debounce, 3 retries/30s)
- Loading/empty/error states in panel with ARIA live regions

**Sprint 3 (PR #91):**
- `NotificationLifecycleStorageService` for localStorage persistence
- Lifecycle scoped by `{ tenantId, userId }`
- `readAt`, `acknowledgedAt` per notification event
- 1500 record LRU eviction per scope, 10 scope LRU index
- `unreadCount`, `hasUnread`, `criticalUnacknowledgedCount` computed signals
- `markRead()`, `markAllRead()`, `acknowledge()` methods
- Toggle converted to signal inputs
- Panel emits lifecycle outputs (`markRead`, `markAllRead`, `acknowledge`)
- NgZone.run() fix for badge updates
- E2E test for persistence across refresh

---

## Sprint 4 Design

### 1. Connection State UI

**Rehydration Trigger Architecture:**

Use **App subscription approach** to avoid circular dependencies:
- `RealTimeService` does NOT inject `NotificationHistoryService`
- `App` component subscribes to a debounced RxJS transition stream derived from connection state
- When status transitions from `Reconnecting` to `Connected`, App calls `notificationHistoryService.forceRetry()`
- This keeps `RealTimeService` as pure SignalR management, unaware of hydration logic
- The UI library does not import SignalR. It defines its own `NotificationPanelConnectionState = 'connected' | 'reconnecting' | 'disconnected'`; App maps `HubConnectionState` to that type before passing it to the panel.
- Do not implement reconnect rehydration as an Angular signal side effect. The reconnect trigger is an explicit RxJS subscription with `distinctUntilChanged()`, `pairwise()`, `debounceTime(500)`, and `takeUntilDestroyed()` so synchronous signal mutations cannot race the previous-state update.

```typescript
// In App component
import { DestroyRef, computed, inject, signal } from '@angular/core';
import { HubConnectionState } from '@microsoft/signalr';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, pairwise, withLatestFrom } from 'rxjs/operators';
import { environment } from '../environments/environment';

private readonly destroyRef = inject(DestroyRef);
private readonly connectionStatus$ = this.realTimeService.connectionStatus$;
private readonly realTimeConnectionState = toSignal(this.connectionStatus$, { initialValue: HubConnectionState.Disconnected });
private readonly connectionStateOverride = signal<HubConnectionState | null>(null);
protected readonly connectionState = computed(() =>
  this.connectionStateOverride() ?? this.realTimeConnectionState()
);
protected readonly notificationPanelConnectionState = computed(() =>
  mapToNotificationPanelConnectionState(this.connectionState())
);
private readonly RECONNECT_DEBOUNCE_MS = 500;
private readonly observedConnectionState$ = toObservable(this.connectionState);

constructor() {
  if (environment.enableE2eConnectionHook) {
    this.installConnectionStateTestHook();
  }

  this.observedConnectionState$
    .pipe(
      distinctUntilChanged(),
      pairwise(),
      filter(([previous, current]) =>
        previous === HubConnectionState.Reconnecting && current === HubConnectionState.Connected
      ),
      debounceTime(this.RECONNECT_DEBOUNCE_MS),
      withLatestFrom(this.observedConnectionState$),
      filter(([, current]) => current === HubConnectionState.Connected),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(() => this.notificationHistoryService.forceRetry());
}

private installConnectionStateTestHook(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.__testConnectionStateOverride__ = (state: HubConnectionState) => {
    if (!Object.values(HubConnectionState).includes(state)) {
      return;
    }
    this.connectionStateOverride.set(state);
  };
}
```

SignalR-to-panel mapping:

| `HubConnectionState` | `NotificationPanelConnectionState` | Rationale |
| --- | --- | --- |
| `Connected` | `'connected'` | Live notification channel is active. |
| `Connecting` | `'reconnecting'` | Initial connection attempt; cached notifications may still be stale. |
| `Reconnecting` | `'reconnecting'` | SignalR is actively recovering. |
| `Disconnecting` | `'reconnecting'` | Transitional non-live state; avoid showing hard offline during graceful shutdown. |
| `Disconnected` | `'disconnected'` | No active notification channel. |

**Build-Gated Test Hook:**
- The project uses `@nx/angular:application` and Angular's esbuild builder. Do not add `webpack.config.js` or DefinePlugin.
- Create `apps/portal-web/src/environments/` before adding environment files; the directory does not exist in the current app.
- Add Angular environment files:
  - `apps/portal-web/src/environments/environment.ts` with `enableE2eConnectionHook: false`
  - `apps/portal-web/src/environments/environment.development.ts` with `enableE2eConnectionHook: false`
  - `apps/portal-web/src/environments/environment.test.ts` with `enableE2eConnectionHook: true`
  - `apps/portal-web/src/environments/environment.prod.ts` with `enableE2eConnectionHook: false`
- Update `apps/portal-web/project.json` with explicit `fileReplacements` on the Angular application builder. Keep the existing optimization/budget settings under `production`; add only the file replacement there.

```json
"build": {
  "configurations": {
    "development": {
      "optimization": false,
      "extractLicenses": false,
      "sourceMap": true,
      "fileReplacements": [
        {
          "replace": "apps/portal-web/src/environments/environment.ts",
          "with": "apps/portal-web/src/environments/environment.development.ts"
        }
      ]
    },
    "test": {
      "optimization": false,
      "extractLicenses": false,
      "sourceMap": true,
      "fileReplacements": [
        {
          "replace": "apps/portal-web/src/environments/environment.ts",
          "with": "apps/portal-web/src/environments/environment.test.ts"
        }
      ]
    },
    "production": {
      "fileReplacements": [
        {
          "replace": "apps/portal-web/src/environments/environment.ts",
          "with": "apps/portal-web/src/environments/environment.prod.ts"
        }
      ]
    }
  }
}
```

- Add `serve.configurations.test.buildTarget: "portal-web:build:test"` next to the existing development and production serve configurations.
- Production verification command:

```bash
npx nx build portal-web --configuration=production
if rg "__testConnectionStateOverride__" dist/apps/portal-web; then exit 1; fi
```

- Test-build verification command:

```bash
npx nx build portal-web --configuration=test
rg "__testConnectionStateOverride__" dist/apps/portal-web
```

**Connection Banner:**
- Primary placement: inside the notification panel header, between the title row and search box.
- Persistent closed-panel indicator: the floating notification toggle shows a compact disconnected/reconnecting visual state when `connectionState !== 'connected'`. This keeps the status discoverable without implying the entire app shell is offline.
- No global app-shell banner in Sprint 4. Rationale: the state describes the notification SignalR channel and hydration freshness, not general app/API availability.
- Three states with WCAG-compliant contrast:
  - **Connected:** Green background (#047857), white text, check icon. Copy: "Notifications are live." Persistent while panel is open and state remains connected.
  - **Reconnecting:** Dark amber background (#B45309), white text, spinner icon. Copy: "Reconnecting to notification updates." Persistent.
  - **Disconnected:** Red background (#B91C1C), white text, X icon. Copy: "Notification updates are offline. Recent items may be stale." Persistent.
- Disconnected banner includes a manual "Retry" action wired to normal `retry()`. The button remains visible and is disabled only when `isRetryThrottled` or `isLoading` is true; when throttled, show helper copy "Try again shortly."
- Uses `role="status"` and `aria-live="polite"` for state announcements
- Any spinner or banner animation is wrapped in `@media (prefers-reduced-motion: no-preference)`
- Banner layout: full width within the panel header stack, `padding: 8px 10px`, `border-radius: 6px`, `font-size: 14px`, `line-height: 20px`, icon size `16px`, icon/text gap `8px`, margin `8px 0 0`. Text wraps; icon does not shrink.
- Connected banner behavior: when the Connected banner is visible, keep it persistent while the panel remains open and state remains connected. Do not auto-dismiss the Connected banner in Sprint 4; screen reader users need the status message to remain perceivable. If the panel closes and later reopens while still connected with a non-empty list, show the Connected banner again.
- Closed-panel toggle indicator:
  - Connected: no indicator; unread badge remains top-right.
  - Reconnecting: 10px amber dot `#B45309`, 2px white border, placed at the bell icon's bottom-right corner inside the circular toggle. If unread badge is visible, badge stays top-right and indicator stays bottom-right.
  - Disconnected: 10px red dot `#B91C1C`, 2px white border, same placement.
  - Indicator has `aria-hidden="true"`; the button `aria-label` carries the state: "Toggle notifications, updates reconnecting" or "Toggle notifications, updates offline".
- Banner visibility priority:
  - Error and recovery notices have priority over the connection banner because they are actionable and use the sticky status area.
  - Hide the reconnecting banner while a rehydration error is visible; show the red error banner and Retry action instead.
  - Hide the Connected banner when the visible list is empty and there is no error, recovery notice, or reconnect syncing state. The empty state communicates that notifications are healthy and current.
  - Reconnecting and Disconnected banners remain visible for non-empty cached lists unless an error/recovery notice suppresses them.

**Rehydration on Reconnect:**
- App calls `NotificationHistoryService.forceRetry()` on reconnect (see architecture above)
- `forceRetry()` behavior:
  - Bypasses the normal user-click retry counter, but has its own upper bound: max 10 force retries per tenant/user per 60-second sliding window
  - Add a separate `forceRetryAttemptsByTenant` `Map<string, number[]>`, independent from the existing normal `retryAttemptsByTenant` map
  - Store force-retry attempt timestamps per tenant/user key in `forceRetryAttemptsByTenant` and drop timestamps older than 60 seconds before deciding whether another force retry is allowed
  - Removes empty timestamp arrays after cleanup and clears the current tenant/user force-retry entry on auth scope changes, logout, or successful hydrate
  - Logs a non-sensitive warning when the force-retry upper bound is hit
  - Sets a user-visible recovery notice when the force-retry upper bound is hit. Copy: "Updates paused briefly. Cached notifications are still available." The notice includes a "Retry" button wired to normal `retry()`.
  - Exposes `forceRetryPausedUntil` and `forceRetryNotice` readonly signals from `NotificationHistoryService`. App passes `forceRetryNotice()` to the panel as `recoveryNotice`.
  - Clears `forceRetryNotice` after the throttle window expires, when normal retry starts, or when any hydrate succeeds.
  - If hydration already in-flight: skips (does not cancel/restart, avoids request flood)
  - Uses `isHydrating` signal to check in-flight state before making request
  - Internal-only visibility (not exposed via public API surface)
- Retry rate limit counter resets on successful hydrate
- Successful hydrate clears both normal retry attempts and force-retry attempt timestamps for the current tenant/user key
- Clear retry counters inside `applyHydrationRows()` after the store update succeeds and before marking the hydrate complete. Do not clear counters before the in-flight guard has accepted the hydrate request.
- `isRetryThrottled` state: `NotificationHistoryService` exposes `isRetryThrottled` signal for UI wiring. Used by panel retry button when normal `retry()` is called, not `forceRetry()`.
- `isRetryThrottled` must be implemented before wiring the panel error/recovery Retry buttons. Tasks that pass retry state to the panel depend on this signal existing and remaining scoped to normal user retry throttling.
- `retry()` and `forceRetry()` share one hydration pipeline. If hydration is in flight, both return without issuing another HTTP request. Force-retry throttling does not disable manual retry; manual retry remains governed by the existing 3 retries per 30 seconds user-click limit.
- Retry UI precedence: `forceRetryNotice` is informational and never disables the Retry button. The Retry button's disabled/`aria-disabled` state reflects only normal retry throttling and `isLoading`.
- Sticky status area message priority: error banner first, then force-retry recovery notice, then retry-throttled helper text directly under the visible Retry button. If both `isLoading` and `isRetryThrottled` are true, the button is disabled because loading is in flight and helper copy remains "Try again shortly." Do not render duplicate Retry buttons for error and recovery at the same time.
- `/api/AuditLogs/recent` lookback: 50 count-based, no time filter. Max recoverable disconnect duration is however long it takes for 50 new events to accumulate.
- Rehydration keeps cached content during fetch. Cached content remains fully interactive during `reconnecting`: users can scroll, search cached items, mark read, and acknowledge. Search query persists and re-applies to the hydrated result set after reconnect.
- Add a `hasHydrated` panel input from `NotificationHistoryService.hasHydrated`. The panel derives:
  - `showInitialSkeleton = isLoading && !hasHydrated`
  - `isReconnectSyncing = isLoading && hasHydrated && connectionState === 'reconnecting'`
  - Show skeleton only for `showInitialSkeleton`; show "Syncing notifications..." only for `isReconnectSyncing`.
- Search empty transition: track `wasSearchMatchBeforeHydrate` when a non-empty query matches cached items immediately before reconnect hydrate starts. After hydrate completes, if the same query remains non-empty, `wasSearchMatchBeforeHydrate` is true, and `filteredNotifications` is empty, show empty search copy: `No results for "[query]" among recent notifications.` Keep the query in the input. Otherwise use the normal empty-state copy.
- Status hierarchy during reconnect: show at most the amber connection banner plus one inline "Syncing notifications..." status while actual hydration is in flight. Do not show a separate cached-search helper text.
- Rehydration scroll behavior: preserve the user's visual position. If a notification item has focus, preserve the focused item's viewport position by notification ID. If no item has focus, preserve the top visible content by increasing `scrollTop` by the measured height of prepended content. Do not reuse the previous `scrollTop` without adjusting for prepends.
- If rehydration fails: keep cached content and show an inline error banner in the panel. Copy: "Could not load notifications. Check your connection and try again." Button label: "Retry". Place the banner in a sticky status area inside `.notification-scroll-region`, before `.event-list`, so it remains visible while the list is scrolled.
- Scroll container structure: `.notification-panel { display: flex; flex-direction: column; max-height: 100vh; }`; `.notification-scroll-region { flex: 1; min-height: 0; overflow-y: auto; }`; `.sticky-status-area { position: sticky; top: 0; z-index: 2; }`; `.event-list` lives inside `.notification-scroll-region` below the sticky status area.

**Idempotency and Lifecycle Conflict Resolution:**
- Server data is source of truth for notification content
- `localStorage` overlays lifecycle state (`readAt`, `acknowledgedAt`)
- Re-fetch returns same notifications with same IDs → idempotency prevents duplicates
- Lifecycle state persists in localStorage and re-applies via `applyLifecycle()`
- Lifecycle state is keyed by event ID and survives idempotency cache eviction. If an event ID reappears after the 1000-entry idempotency FIFO evicts it, `applyLifecycle()` still reapplies the persisted `readAt`/`acknowledgedAt`.
- Edge case: if 1000+ events during disconnect, reconnect could show duplicate content because the idempotency cache evicted old keys. Lifecycle state still overlays by event ID. Accept duplicate-content risk as documented POC limitation.

**Dependency Contract and Deferred Hardening:**
- `RealTimeService` remains the only SignalR-aware service.
- `NotificationHistoryService` remains HTTP/history aware and does not subscribe to SignalR.
- `NotificationPanelComponent` accepts only UI-local connection state.
- Test hook affects App local connection state and the App-owned reconnect subscription only; it does not mutate `RealTimeService.connectionStatus$`.
- WebSocket reconnect authentication/session refresh hardening remains deferred outside Sprint 4.
- `/api/AuditLogs/recent` must enforce tenant-scoped authorization server-side. Client-side tenant checks are defense-in-depth only.
- Add backend integration test coverage in `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs` unless an equivalent test already exists. Required cases:
  - `Recent_ReturnsOnlyCurrentHostTenantAuditLogs`: seed audit logs for TAI (`localhost`) and ACME (`acme.localhost`), authenticate as an Admin, call `GET /api/AuditLogs/recent?limit=50` with `Host: localhost`, and assert every returned row has the TAI tenant ID and no ACME correlation IDs appear.
  - `Recent_ReturnsOnlyAcmeHostTenantAuditLogs`: repeat the request with `Host: acme.localhost`, assert every returned row has the ACME tenant ID and no TAI correlation IDs appear.
  - `Recent_IgnoresBrowserSuppliedTenantBypassHeaders`: send the request with `Host: localhost` plus browser-controlled headers such as `X-Bypass-Tenant: true` and `X-Tenant-Id: <acme tenant id>`. Assert HTTP 200 and TAI-only rows. This repo resolves tenant context from the request host through `TenantResolutionMiddleware`; client-supplied tenant/bypass headers must not affect `/api/AuditLogs/recent`.
- Server-side rate limiting for `/api/AuditLogs/recent` is deferred unless already present. This is a known hardening gap because client-side retry limits can be bypassed by a malicious client.
- Notification content must render through Angular interpolation/text bindings only. Do not use `[innerHTML]` for title, summary, actor, category, or error/recovery copy. If a later design requires rich content, add a sanitizer and CSP-specific test before implementation.
- The connection banner exposes coarse connection state. This is acceptable for the admin workstation POC; future hardening can reduce detail if the notification channel is treated as sensitive operational metadata.

Deferred hardening risk register:

| Item | Sprint 4 decision | Risk | Mitigation in this sprint |
| --- | --- | --- | --- |
| `/api/AuditLogs/recent` server-side rate limiting | Deferred unless existing middleware already covers it | Malicious clients can bypass client retry limits and issue repeated recent-audit requests | Keep client retry and force-retry bounds; log force-retry quota exhaustion; document rate limiting as post-Sprint 4 hardening |
| WebSocket reconnect session refresh | Deferred | Long-lived clients may keep a stale SignalR session until normal auth failure handling occurs | Rehydrate via authenticated HTTP endpoint and preserve tenant-scoped backend authorization tests |

**Files to Modify:**
- `apps/portal-web/src/app/app.ts` — add connection state signal adapter, RxJS reconnect subscription, test hook (build-gated)
- `apps/portal-web/src/app/app.html` — pass `connectionState`, `isRetryThrottled`, and `recoveryNotice` from history service
- `apps/portal-web/src/environments/environment.ts` — default `enableE2eConnectionHook: false`
- `apps/portal-web/src/environments/environment.development.ts` — development `enableE2eConnectionHook: false`
- `apps/portal-web/src/environments/environment.test.ts` — test `enableE2eConnectionHook: true`
- `apps/portal-web/src/environments/environment.prod.ts` — production `enableE2eConnectionHook: false`
- `apps/portal-web/project.json` — add environment file replacements and `test` build/serve configuration
- `apps/portal-web/src/app/notifications/notification-history.service.ts` — add `forceRetry()` method, add `isRetryThrottled`, `forceRetryPausedUntil`, and `forceRetryNotice` signals
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — add `connectionState`, `recoveryNotice`, and `hasHydrated` inputs; derive reconnect-syncing/search-empty states; implement roving focus by notification ID, keyboard handlers, import CDK FocusTrap, clamp focus on mutation
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — wrap in container with cdkTrapFocus, reorder focusable DOM to match documented Tab order, add conditional cdkFocusInitial, role="dialog", aria-modal, aria-labelledby, single Escape handler, connection banner, sticky status area, close button accessible label
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — banner styling, focus-visible styles, skeleton styles, `.notification-scroll-region` sticky status layout, audit selectors for DOM restructuring, reduced-motion media queries for fade-in and fade-out
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.types.ts` — add UI-local `NotificationPanelConnectionState`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts` — add `connectionState` argType, binding, and default `'connected'`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.ts` — add `isOpen` and `connectionState` inputs
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html` — add `aria-expanded`, `aria-controls`, and closed-panel connection indicator
- `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs` — add tenant-isolation tests for `/api/AuditLogs/recent` if equivalent coverage is not already present

---

### 2. Accessibility — Focus Management

**Focus Trap Architecture:**

Refactor DOM to wrap overlay + panel in single container:
```html
<!-- New wrapper with focus trap -->
@if (isOpen()()) {
  <div
    class="notification-panel-container"
    cdkTrapFocus
    cdkTrapFocusAutoCapture
    (keydown.escape)="close()">
    <div class="panel-overlay" (click)="close()" role="presentation" aria-hidden="true"></div>
    <div
      id="notification-panel"
      class="notification-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-heading">
      <!-- panel content -->
    </div>
  </div>
}
```

- Use `@angular/cdk/a11y` FocusTrap directive (`cdkTrapFocus`)
- Keep `.notification-panel-container` inside the existing `@if (isOpen()())` block so the focus trap is not active when the panel is closed.
- `cdkTrapFocusAutoCapture` moves focus on open. Reorder focusable elements in DOM to match the documented keyboard sequence and add conditional `cdkFocusInitial` to the search input when notifications are visible.
- When there are zero visible notifications, do not render `cdkFocusInitial` on the search input; let the close button receive initial focus as the first useful empty-state action.
- Focus trap released when panel closes (CDK handles this automatically)
- Single Escape handler on panel container. Explicitly delete the existing overlay bindings: `(keydown.escape)="close()"`, `(keydown.enter)="close()"`, `tabindex="0"`, and `aria-label="Close panel"` from `.panel-overlay` so the overlay is not keyboard focusable and cannot double-close.
- Add explicit stacking CSS: `.notification-panel-container { position: fixed; inset: 0; z-index: 99; }`, `.panel-overlay { position: absolute; inset: 0; z-index: 0; }`, `.notification-panel { position: absolute; z-index: 1; }`.

**Focus Restoration on Panel Close:**
- CDK FocusTrap automatically restores focus to element that triggered open
- Ensure toggle button has focus before panel opens (click/Enter already does this)
- No additional focus restoration code needed — CDK handles it

**Role Decision:**
- Use **`role="dialog"` + `aria-modal="true"`**
- Rationale: Focus trap makes it modal behavior (can't interact with main content). Escape-to-close matches dialog pattern. Screen reader users expect "dismiss to return" behavior.
- Add `aria-labelledby="notifications-heading"` pointing to panel title

**Keyboard Navigation Model:**

Clarify navigation hierarchy:
- **Initial focus order on open with notifications:** search input → filter buttons → Mark All Read → first roving list item → close button. The close button remains reachable but is not the first Tab stop.
- **Initial focus order on open with no notifications:** close button first, then search/filter controls. This keeps the primary useful action consistent for empty states.
- DOM order must match the notifications-present Tab order: search input, filter group, Mark All Read, list items, close button. The close button may be visually positioned in the header with CSS, but its DOM position stays after the list so Tab order and screen reader order match this contract.
- For the empty state, render or order the close button before search/filter controls so `cdkTrapFocusAutoCapture` and Tab order both start at close.
- **Filter buttons:** one button group labelled "Filter notifications" with text buttons `All`, `Critical`, `Warning`, and `Info`. The active filter has `aria-pressed="true"` and the inactive filters have `aria-pressed="false"`. Filters are ordered before Mark All Read in the Tab sequence.
- **Arrow Up/Down** — moves focus between `.event-item` list item containers (roving tabindex)
  - Wrapping: Down on last → first, Up on first → last
- **Tab/Shift+Tab** — moves focus between buttons inside focused item (mark read, acknowledge) then to next item
- **Home/End** — moves focus to first/last item. Works from any focus location (item container or button inside)
- **Enter/Space on list item** — does nothing (items are containers, not actionable)
- **Enter/Space on buttons** — triggers button action (mark read, acknowledge)
- **Escape behavior:** Escape in the search input clears the query and stops propagation when the query is non-empty. Escape in the search input with an empty query closes the panel. Escape anywhere else inside the panel closes the panel.

Implementation:
- Roving tabindex: only one `.event-item` has `tabindex="0"` at a time
- Wire search Escape through a keydown handler on the search input. When it clears a non-empty query, call `event.stopPropagation()` so the panel-level Escape handler does not also close the panel.
- Track `focusedNotificationId` as the primary state, with a derived visible index for DOM lookup. This prevents item insertions and sorting from moving focus to the wrong notification.
- Arrow key handlers update `focusedNotificationId` and move DOM focus to the target item container.
- Buttons inside items are focusable via Tab from the focused item.
- Empty list: no `.event-item` receives focus; open-panel focus goes to close button first.
- Single item: Arrow Up/Down and Home/End keep focus on that item.
- Item without action buttons: Tab moves to the next visible item if one exists; from the last visible item, Tab exits the list to the next panel control. Shift+Tab mirrors this behavior.
- Filter button click keeps DOM focus on the activated filter button. If the previously focused notification is removed by the filter, update `focusedNotificationId` to the first visible item for the next Arrow/Home/End navigation target, but do not move DOM focus away from the filter button.
- **Clamp on mutation:** When notifications arrive/disappear or filters/search change the visible list, keep focus on `focusedNotificationId` if it remains visible. If not, move to the next visible item by previous index, then previous item, then close button when the list is empty.
- **Focus after action:** After "Mark read", focus moves from the removed button to the same notification's item container because the item remains visible but the button disappears. After "Acknowledge", focus stays on the same item's container unless a future filter removes acknowledged items; if removed, use the mutation fallback above.

Clamp decision tree:
```typescript
function resolveFocusAfterMutation(previousId: string | null, previousIndex: number, visibleItems: NotificationPanelItem[]): FocusTarget {
  if (visibleItems.length === 0) {
    return { kind: 'close-button' };
  }

  if (previousId) {
    const sameItemIndex = visibleItems.findIndex(item => item.id === previousId);
    if (sameItemIndex >= 0) {
      return { kind: 'item', id: previousId, index: sameItemIndex };
    }
  }

  const clampedIndex = Math.min(Math.max(previousIndex, 0), visibleItems.length - 1);
  return { kind: 'item', id: visibleItems[clampedIndex].id, index: clampedIndex };
}
```

Scroll preservation decision tree:
```typescript
import { afterNextRender } from '@angular/core';

function preserveScrollDuringPrepend(list: HTMLElement, focusedNotificationId: string | null, mutate: () => void): void {
  const beforeScrollTop = list.scrollTop;
  const beforeScrollHeight = list.scrollHeight;
  const focusedBefore = focusedNotificationId
    ? list.querySelector<HTMLElement>(`[data-notification-id="${focusedNotificationId}"]`)
    : null;
  const focusedViewportTop = focusedBefore ? focusedBefore.offsetTop - list.scrollTop : null;

  mutate();

  afterNextRender(() => {
    if (focusedNotificationId && focusedViewportTop !== null) {
      const focusedAfter = list.querySelector<HTMLElement>(`[data-notification-id="${focusedNotificationId}"]`);
      if (focusedAfter) {
        list.scrollTop = focusedAfter.offsetTop - focusedViewportTop;
        return;
      }
    }

    const prependedHeight = Math.max(list.scrollHeight - beforeScrollHeight, 0);
    if (prependedHeight > 0) {
      list.scrollTop = beforeScrollTop + prependedHeight;
      return;
    }

    list.scrollTop = beforeScrollTop;
  });
}
```
- Use Angular `afterNextRender()` for the post-mutation measurement so OnPush render timing has completed before reading `scrollHeight` or item offsets. Do not use a microtask callback for this path.

**Empty Panel Focus Destination:**
- If the panel opens with zero visible notifications, focus goes to the close button.
- If the list becomes empty while focus was inside it, focus moves to the close button (accessible label: "Close notifications panel").
- Keep the existing native `disabled` behavior for "Mark all read" when there are no unread notifications; do not switch to `aria-disabled` in Sprint 4. When native `disabled` is true, the button is skipped in Tab order and Tab moves from the filter group to the first visible item, or to the close button when the list is empty.
- When "Mark all read" is enabled and activated, the resulting disabled state must not strand focus on the now-disabled button. Move focus to the first visible notification item if any remain visible; otherwise move focus to the close button.

**Error State Focus Destination:**
- Panel opens with error visible → focus goes to search input (first focusable), can Tab to retry button
- Retry button label is "Retry". When retry is throttled, keep the button visible with `aria-disabled="true"` and helper copy: "Try again shortly."
- Error appears while panel is already open → do not move focus. The sticky status area uses `role="alert"`/`aria-live="assertive"` to announce the error. Users can Tab to Retry from their current location.
- Initial load error uses the main error state in the same sticky status area. Rehydration error uses the same placement and copy while preserving cached list content below it.

**Panel and Toggle ARIA Contract:**
- Panel root has `id="notification-panel"`.
- Panel heading has `id="notifications-heading"`.
- Toggle button sets `[attr.aria-expanded]="isOpen()"` and `aria-controls="notification-panel"`.
- Toggle keeps `aria-label="Toggle notifications"` and exposes unread count through the visible badge text.

**Files to Modify:**
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — implement roving focus, keyboard handlers, import CDK FocusTrap
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — wrap in container with cdkTrapFocus, add role="dialog", aria-modal, aria-labelledby, id, single Escape handler, and delete overlay key handlers
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — focus-visible styles, explicit container stacking, responsive panel dimensions, reduced-motion support
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.types.ts` — add `NotificationPanelConnectionState`
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.ts` — add signal inputs for open state and connection state
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html` — add aria-expanded, aria-controls, and connection status indicator

---

### 3. E2E Coverage

**WebSocket Mock Strategy:**

Cannot mock WebSocket directly with Playwright route interception. Use **mock connection status observable** approach:
- Test hook: `window.__testConnectionStateOverride__(state)` — gated by `environment.test` (dev/test builds only, never production)
- Build gating: Angular/Nx file replacement swaps `environment.ts` for `environment.test.ts` only under `portal-web:build:test` / `portal-web:serve:test`. Production builds exclude this code and are verified by grep.
- Playwright runs against `npx nx serve portal-web --configuration=test` for notification resilience specs.
- This tests rehydration UX without needing true WebSocket drops
- Hook validation rejects any state not present in `Object.values(HubConnectionState)`.

**Connection Resilience Test:**

**Primary approach** (no test-only backend endpoint):
- Use existing privilege edit flow to create notification
- Reuse existing `injectAuthSession` from `apps/portal-web-e2e/src/test-utils`
- Test order: disconnect → create event → reconnect → verify rehydration

```typescript
// E2E test outline
import { type Page, expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

async function createPrivilegeModifiedNotification(page: Page): Promise<string> {
  const correlationId = uuidv4();
  const privilegeName = 'Portal.Users.Read';

  await page.getByPlaceholder(/search privileges/i).fill(privilegeName);
  await page.waitForResponse(res => res.url().includes('/api/privileges') && res.status() === 200);
  await expect(page.getByTestId('table-loading')).toBeHidden();
  await page.locator('[data-testid^="action-menu-"]').first().click();
  await page.getByRole('menuitem', { name: /edit/i }).click({ force: true });
  await page.waitForURL(/.*\/admin\/privileges\/.*/, { timeout: 10000 });
  await expect(page.getByTestId('edit-form')).toBeVisible();
  await page.getByLabel(/description/i).fill(`Reconnect recovery update ${correlationId}`);
  await page.route('**/api/privileges/**', async route => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'X-Correlation-ID': correlationId,
        'X-Step-Up-Verified': 'true',
      },
    });
  });
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByTestId('read-only-view')).toBeVisible();
  return correlationId;
}

test('reconnect rehydration recovers missed events', async ({ page }) => {
  // 1. Navigate and login
  await injectAuthSession(page, 'acme-session.json');
  await page.goto('http://acme.localhost:4200/admin/privileges');

  // 2. Open panel and verify initial connected state
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  const panel = page.locator('.notification-panel');
  await expect(panel).toBeVisible();

  // 3. Mock connection to Disconnected state
  await page.evaluate(() => {
    (window as any).__testConnectionStateOverride__('Disconnected');
  });
  await expect(panel.locator('[aria-label="Connection status"]')).toContainText('Offline');

  // 4. Close panel, create notification via privilege edit (during disconnect)
  await page.getByRole('button', { name: /close/i }).click();
  const correlationId = await createPrivilegeModifiedNotification(page);

  // 5. Reopen panel (still disconnected, cached content visible)
  await page.getByRole('button', { name: /toggle notifications/i }).click();

  // 6. Simulate reconnect
  await page.evaluate(() => {
    (window as any).__testConnectionStateOverride__('Connected');
  });

  // 7. Verify new notification appears via rehydration
  await expect(panel.getByTestId('notification-item').filter({ hasText: correlationId })).toBeVisible({ timeout: 10000 });
});
```

**Note:** This approach avoids creating `/api/test/create-notification` endpoint. The privilege edit flow is production code, making the test more realistic.

**Edge States Test:**
- Initial loading skeleton: intercept `/api/AuditLogs/recent` with >300ms delay, verify skeleton shows only after the 300ms threshold
- Fast load: intercept `/api/AuditLogs/recent` with immediate success, verify skeleton does not flash
- Reconnect loading: while cached items are visible, reconnect shows the amber banner and inline "Syncing notifications..." status text instead of skeleton
- Initial vs reconnect loading: verify `isLoading && !hasHydrated` shows skeleton and `isLoading && hasHydrated && connectionState === 'reconnecting'` shows only "Syncing notifications..."
- Disconnected manual retry: force `Disconnected`, make initial rehydration fail, verify the red banner's "Retry" button calls normal `retry()` and respects `isRetryThrottled`/`isLoading` disabled state.
- Empty state: intercept with `[]`, verify "All caught up! No recent notifications" and sub-caption
- Error state: intercept with 500, verify "Could not load notifications. Check your connection and try again." + "Retry" button
- Retry flow: click retry, intercept with success, verify notifications load
- Rehydration error during reconnect: intercept `/api/AuditLogs/recent` with 500 after reconnect mock, verify error banner (not modal)
- Error hierarchy: during reconnect failure, verify the red error banner suppresses the amber reconnecting banner until retry succeeds or the error clears
- Force retry quota exhaustion: simulate 11 reconnect recoveries in 60s, verify sticky recovery notice copy appears and manual "Retry" remains available when normal retry is not throttled
- Connection banner persistence: show Connected banner with non-empty list, wait 10s, verify it remains visible while state is still connected; transition to Reconnecting and verify Connected banner is replaced immediately
- Healthy empty hierarchy: with zero visible notifications and connected state, verify the Connected banner is suppressed and only the empty state communicates healthy status
- Search persistence: enter a search query while disconnected, reconnect with new hydrated results, verify the query remains in the input and filters the hydrated result set
- Search-to-empty transition: enter a search query that matches cached items, reconnect with hydrated results that do not match, verify empty copy `No results for "[query]" among recent notifications.`

**Accessibility Test:**
- Keyboard open panel: focus toggle → Enter → verify panel opens, focus on search input
- Keyboard close panel: Escape → verify panel closes, focus returns to toggle
- Search Escape: with non-empty search, Escape clears the search and keeps the panel open; with empty search, Escape closes the panel.
- Filter group: verify `All`, `Critical`, `Warning`, and `Info` buttons expose `aria-pressed`, update visible results, and keep the documented Tab order.
- Filter focus: activate a filter that removes the previously focused item, verify focus remains on the filter button and Arrow/Home/End navigation targets the first visible filtered item.
- Focus trap: Tab cycle, verify focus stays in panel, verify focusable elements in order
- Arrow navigation: Arrow Down through items, verify wrapping; Arrow Up from first wraps to last; Home/End jump to first/last
- Action focus: activate "Mark read" from keyboard and verify focus moves to the same item container; mark the final visible item and verify focus moves to close button when list becomes empty
- Mark All Read focus: activate the Mark All Read button from keyboard, verify focus moves to the first visible notification item when items remain and to the close button when no items remain; verify the native-disabled button is skipped in Tab order.
- Acknowledge focus: with critical filter active, acknowledge a critical notification and verify focus moves to the next critical item or close button when none remain
- Mid-session error focus: focus an item, trigger rehydration error, verify focus stays on the item while the alert region announces the error
- Scroll preservation: focus a lower list item, prepend hydrated results, verify the focused item remains in view and focus stays on the same notification ID
- Empty-list focus: start with empty response and verify focus does not enter the list
- Screen reader announcement: assert live-region accessible text with `toHaveAccessibleName()` or `toContainText()` on the live region, not only element existence

**Unit Test Coverage Required by Panel Review:**
- App reconnect debounce: emit `Reconnecting -> Connected -> Reconnecting -> Connected` within 500ms and verify `forceRetry()` is called exactly once.
- App reconnect debounce cancellation: emit `Reconnecting -> Connected -> Disconnected` within 500ms and verify `forceRetry()` is not called because the latest state is no longer `Connected`.
- App reconnect negative edges: `Disconnected -> Connected` does not call `forceRetry()`; `Reconnecting -> Disconnected -> Connected` does not call `forceRetry()`.
- App connection-state mapping: verify `Connected -> connected`, `Connecting -> reconnecting`, `Reconnecting -> reconnecting`, `Disconnecting -> reconnecting`, and `Disconnected -> disconnected`.
- App hook validation: call `__testConnectionStateOverride__('Invalid')` and verify connection state does not change.
- History force retry in-flight skip: make `isHydrating()` return true, call `forceRetry()`, verify no HTTP call is made.
- History force retry upper bound: call `forceRetry()` 11 times in 60 seconds and verify only 10 attempts are accepted.
- History force retry upper bound reset: after a successful hydrate or elapsed window, verify force retry is accepted again and `forceRetryNotice` clears.
- History retry interaction: while force retry hydration is in flight, normal `retry()` issues no second request; when force retry is paused but no hydrate is in flight, normal `retry()` still follows the 3-per-30s user retry limit.
- Panel focus clamp: set focus to the last visible notification, replace notifications with a shorter visible list, verify focus clamps to a valid item or close button.
- Panel roving edge cases: empty list, single item, item without action buttons, Tab from readonly info items, Arrow wrapping, Home/End.
- Panel timers: use fake timers to verify no Connected banner auto-dismiss exists and skeleton delay/min-display cleanup runs on panel close and component destroy.
- Backend authorization: add `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs` with `Recent_ReturnsOnlyCurrentHostTenantAuditLogs`, `Recent_ReturnsOnlyAcmeHostTenantAuditLogs`, and `Recent_IgnoresBrowserSuppliedTenantBypassHeaders`, or reference existing equivalent tests.
- Content rendering audit: add a test or static assertion that notification panel templates use interpolation/text binding and do not render notification content through `[innerHTML]`.

**Files to Modify:**
- `apps/portal-web/src/app/app.ts` — add test-only getter `window.__testConnectionStateOverride__`
- `apps/portal-web/src/app/app.spec.ts` — reconnect debounce and hook validation unit tests
- `apps/portal-web/src/app/notifications/notification-history.service.spec.ts` — force retry skip, throttle, and reset unit tests
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts` — focus clamp, roving edge cases, connection banner state tests
- `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs` — backend tenant isolation and forged tenant context coverage for `/api/AuditLogs/recent`
- `apps/portal-web-e2e/src/notifications-resilience.spec.ts` — new file for connection resilience tests
- `apps/portal-web-e2e/src/notifications-edge-states.spec.ts` — new file for edge state tests
- `apps/portal-web-e2e/src/notifications-accessibility.spec.ts` — new file for accessibility tests

---

### 4. Visual Polish

**Connection Banner Styling:**
- Connected: #047857 green, white text, check icon
- Reconnecting: #B45309 dark amber, white text (WCAG AA compliant), spinner icon with `@media (prefers-reduced-motion: no-preference)` animation
- Disconnected: #B91C1C red, white text, X icon
- Banner inside `.panel-header`, above `.search-box`
- Full-width banner with `padding: 8px 10px`, `border-radius: 6px`, `font-size: 14px`, `line-height: 20px`, `display: flex`, `align-items: flex-start`, `gap: 8px`
- Icon is `16px x 16px`, `flex: 0 0 auto`, with `margin-top: 2px` so wrapped text aligns cleanly
- Connected banner is persistent while visible and the state remains connected. No auto-dismiss timer is used.
- Suppress the Connected banner for a healthy empty state. Suppress reconnecting/disconnected banners while an error or recovery notice is visible.
- Animation: fade-in on appear, fade-out on dismiss (both with `@media (prefers-reduced-motion: no-preference)`)
- Toggle indicator: 10px status dot on the notification toggle when reconnecting or disconnected. Place it bottom-right within the toggle button, with 2px white border. Unread badge remains top-right. Reconnecting uses `#B45309`; disconnected uses `#B91C1C`; connected hides the indicator.
- Toggle accessible label templates:
  - Connected: "Toggle notifications"
  - Reconnecting: "Toggle notifications, updates reconnecting"
  - Disconnected: "Toggle notifications, updates offline"

**Loading State:**
- Initial hydration skeleton loader with 3 placeholder items
- Show skeleton only if initial load exceeds 300ms; keep it visible for at least 300ms once shown to prevent flicker
- After 10s timeout, hide skeleton and show error state copy
- During reconnect with cached items, do not show skeleton; show compact status text "Syncing notifications..." above the list only while hydration is in flight
- Use `hasHydrated` to distinguish initial loading from reconnect syncing; `isLoading` alone is not enough.
- Gray background (#E5E7EB), animated pulse (with reduced-motion check)
- Each skeleton: severity bar (colored strip), title bar (gray), summary bar (gray)
- `aria-live="polite"` and `role="status"` on skeleton container
- `aria-busy="true"` on skeleton items

**Empty State:**
- Decorative bell-with-slash SVG (`aria-hidden="true"`)
- Text: "All caught up! No recent notifications"
- Sub-caption: "Privilege, approval, and security events will appear here."
- Layout: centered block with `padding: 40px 24px`; icon `40px`, title `16px/24px` semibold, caption `14px/20px` muted, `8px` gap between title and caption
- Keep `role="status"` and `aria-live="polite"`

**Error State:**
- Warning icon (triangle SVG)
- Error message text: "Could not load notifications. Check your connection and try again."
- Retry button label: "Retry", with hover/focus states
- Recovery notice text for force-retry quota: "Updates paused briefly. Cached notifications are still available."
- Retry-throttled helper text: "Try again shortly." Place it directly below the Retry button within the sticky status area, `font-size: 12px`.
- `role="alert"` and `aria-live="assertive"`
- Sticky status area sits at the top of `.notification-scroll-region`, which is the panel's single constrained scroll container. Do not make `.event-list` the only scrollable element, or the sticky status will scroll away.

**Severity Visual Encoding:**
- Critical: #B91C1C accent bar and badge text on #FEF2F2
- Warning: #B45309 accent bar and badge text on #FFFBEB
- Info: #1D4ED8 accent bar and badge text on #EFF6FF
- Verify text/background pairs meet WCAG AA 4.5:1 where text is used. Accent-only bars are decorative and must not be the only severity cue; keep severity text or accessible label.

**Focus Visible Styles:**
- Roving tabindex items: `:focus-visible { outline: 2px solid #3B82F6; outline-offset: 2px; }`
- Buttons: existing focus styles, verify `:focus-visible` used
- Animation: `@media (prefers-reduced-motion: no-preference)` for any transitions

**Responsive Behavior:**
- Desktop/tablet: panel is fixed to the right at 400px width and 100vh height.
- Viewports `<480px`: panel becomes full-screen width (`width: 100vw; max-width: none;`) with overlay still present behind the trapped container.
- Constrain panel with `max-width: 100vw` at all sizes so it never overflows narrow viewports.
- Touch targets: close, retry, mark-read, acknowledge, filter, and toggle buttons use at least 44px height on mobile viewports.

**Files to Modify:**
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — skeleton loader, enhanced empty/error states, connection banner
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — banner colors, skeleton styles, severity colors, responsive width, focus-visible, reduced-motion
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — skeleton delay/min-display timing, connection state handling, and persistent banner state handling
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.scss` — disconnected/reconnecting indicator styles

---

## Implementation Order

**Task 1: Angular Environment Build Gate** (Dev tooling)
- Create `apps/portal-web/src/environments/`
- Create `environment.ts`, `environment.development.ts`, `environment.test.ts`, and `environment.prod.ts`
- Add `production`, `development`, and `test` file replacements in `apps/portal-web/project.json` using the exact JSON shape in this spec
- Add `serve.configurations.test` pointing at `portal-web:build:test`
- Verify test hook exclusion from production with the `rg` command in this spec

**Task 2: NotificationHistoryService Resilience API** (Backend integration)
- Add `forceRetry()` with in-flight skip
- Add force retry upper bound of 10 calls per tenant/user per 60 seconds
- Store force retry timestamps in a separate `forceRetryAttemptsByTenant` map, independent from normal retry attempts
- Drop expired force-retry timestamps before every quota check, remove empty timestamp entries after cleanup, and clear the current tenant/user force-retry state on auth scope change, logout, or successful hydrate
- Add `isRetryThrottled` signal for normal retry UI
- Add `forceRetryPausedUntil` and `forceRetryNotice` signals for force retry quota exhaustion UI
- Ensure `retry()` and `forceRetry()` share the same in-flight hydration guard
- Reset retry counters inside `applyHydrationRows()` after the store update succeeds and before marking the hydrate complete
- Add tests for in-flight skip, force upper bound, normal retry throttling, retry interaction, notice clearing, and reset

**Task 3: Connection State Signal Adapter + Rehydration Trigger** (App wiring; depends on Tasks 1-2)
- Add `toSignal()` adapter for `connectionStatus$`
- Add local override signal used only when `environment.enableE2eConnectionHook` is true
- Map every `HubConnectionState` value to UI-local `NotificationPanelConnectionState` using the table in this spec
- Add an RxJS subscription to trigger `forceRetry()` on `Reconnecting -> Connected` with `distinctUntilChanged()`, `pairwise()`, `debounceTime(500)`, `withLatestFrom()`, a latest-state `Connected` recheck, and `takeUntilDestroyed()`
- Install validated `window.__testConnectionStateOverride__` only in test builds
- Add unit tests for mapping, debounce, `Reconnecting -> Connected -> Disconnected` during the debounce window, negative transition edges, and invalid hook state rejection

**Task 4: UI-Local Connection State Types and Storybook Contract**
- Add `NotificationPanelConnectionState` to `notification-panel.types.ts`
- Add `connectionState` input to `NotificationPanelComponent`, default `'connected'`
- Add `hasHydrated` input to `NotificationPanelComponent`, default `false`, so initial loading and reconnect syncing can render differently
- Update `notification-panel.stories.ts` argTypes, render binding, and defaults
- Add Connected, Reconnecting, and Disconnected story variants

**Task 5: App Wiring** (App template; depends on Tasks 2-4)
- Pass `notificationPanelConnectionState()` to the panel
- Pass `notificationHistoryService.isRetryThrottled()` to the panel
- Pass `notificationHistoryService.forceRetryNotice()` to the panel
- Pass `notificationHistoryService.hasHydrated()` to the panel
- Do not start this task until Task 2 exposes `isRetryThrottled`, `forceRetryNotice`, and the shared in-flight guard. Retry UI must not duplicate retry-throttle state locally.

**Task 6: Panel Connection Banner**
- Add panel banner HTML with connected, reconnecting, and disconnected states
- Add ARIA live region for panel connection status
- Keep Connected banner persistent while panel is open and state is connected; do not add a Connected auto-dismiss timer
- Add the disconnected banner manual "Retry" action wired to normal `retry()` and disabled only by `isRetryThrottled` or `isLoading`

**Task 7: Focus Trap Wrapper**
- Refactor DOM to `.notification-panel-container` wrapping overlay and panel
- Add `cdkTrapFocus` and `cdkTrapFocusAutoCapture`
- Add `id="notification-panel"`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby="notifications-heading"`
- Delete overlay `(keydown.escape)`, `(keydown.enter)`, `tabindex`, and keyboard-focused close semantics
- Add explicit stacking CSS for container, overlay, and panel
- Update existing `notification-panel.spec.ts` selectors affected by the wrapper before starting Task 8

**Task 8: Keyboard Navigation and Focus Recovery**
- Track focus by `focusedNotificationId`, not index
- Define panel Tab order as search, filters, Mark All Read, items, close when notifications exist; close first when empty
- Reorder panel focusable DOM to match the documented Tab order. Add conditional `cdkFocusInitial` to the search input when notifications are visible; omit it for empty states so the close button receives initial focus
- Implement the `All`, `Critical`, `Warning`, and `Info` filter button group with `aria-pressed`
- Keep focus on the clicked filter button after filter changes; update `focusedNotificationId` for subsequent roving navigation when the previous item disappears
- Implement Escape behavior for search clear-first semantics and panel close when search is empty
- Implement Arrow Up/Down wrapping plus Home/End
- Implement empty, single-item, no-action-button, Mark All Read, mid-session error, and mutation focus behavior
- Move focus to the same item container after Mark read/Acknowledge when the action button disappears
- After Mark All Read disables the native button, move focus to the first visible item or close button; disabled Mark All Read is skipped in Tab order
- Preserve scroll position relative to focused notification when hydrated items prepend using `afterNextRender()`; when no item is focused, adjust `scrollTop` by measured prepended height
- Add panel unit tests for clamp, edge cases, wrapping, Home/End, Mark All Read focus, scroll preservation, and final-item empty focus

**Task 9: Visual Polish and Responsive Behavior**
- Add skeleton loader threshold/min-display and reconnect syncing status
- Derive `showInitialSkeleton` from `isLoading && !hasHydrated` and `isReconnectSyncing` from `isLoading && hasHydrated && connectionState === 'reconnecting'`
- Add `.notification-scroll-region` as the constrained scroll container; keep `.sticky-status-area` sticky at its top above `.event-list`
- Add sticky status area for error/recovery notices and retry-throttled helper text
- Add enhanced empty and error states with exact copy and layout dimensions
- Suppress Connected banner for healthy empty states; suppress reconnecting banner when an error/recovery notice is visible
- Add severity visual encoding with accessible text cue
- Add responsive full-screen panel behavior below 480px
- Add reduced-motion guards for all transitions and animations
- Add mobile 44px minimum touch targets

**Task 10: Toggle ARIA Completeness**
- Add `isOpen` and `connectionState` inputs to the toggle component
- Add `aria-expanded` and `aria-controls="notification-panel"`
- Add persistent reconnecting/disconnected indicator to the toggle with the exact 10px bottom-right visual treatment and accessible label templates in this spec
- Wire App template to pass panel open state and notification connection state to the toggle after these inputs exist
- Preserve unread badge behavior during disconnect as a stale count plus exact connection status label

**Task 11: E2E Connection Resilience** (New test)
- Run against `portal-web:serve:test`
- Update Playwright webServer command for these specs to `npx nx serve portal-web --configuration=test`
- Mock connection state via validated `page.evaluate()` hook
- Test flow: disconnect -> privilege edit event -> reconnect -> verify rehydration
- Verify rehydration error handling keeps cached content and shows inline error banner
- Verify force retry quota exhaustion shows recovery notice and leaves manual retry available
- Reference the backend tenant-isolation tests added in `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs`: host-scoped TAI rows, host-scoped ACME rows, and ignored browser-supplied tenant/bypass headers

**Task 12: E2E Edge States** (New test)
- Initial skeleton threshold and no-flash fast load
- Empty state copy and sub-caption
- Error state copy + retry flow
- Reconnect syncing state with cached content
- Search query persistence after reconnect
- Search-to-empty copy after reconnect
- Initial skeleton vs reconnect syncing visual differentiation
- Connected banner persistence and immediate replacement on state change

**Task 13: E2E Accessibility** (New test)
- Keyboard open/close with focus restoration
- Search Escape clears non-empty query before closing on a second Escape
- Initial focus target uses search input when notifications exist and close button when empty
- Focus trap tab cycle
- Filter click keeps focus on the activated filter and prepares the first visible item for subsequent arrow navigation
- Arrow navigation with wrapping and Home/End
- Action focus recovery after Mark read
- Mark All Read moves focus to first visible item or close button after native disabled state applies
- Acknowledge focus behavior under critical filter
- Mid-session error focus behavior
- Scroll preservation when hydrated items prepend
- Empty-list focus fallback to close button
- Live region content updates

**Task 14: Full Verification**
- `npx nx test portal-web`
- `npx nx test design-system`
- `npx nx lint portal-web`
- `npx nx lint design-system`
- `npx nx build portal-web --configuration=production`
- `if rg "__testConnectionStateOverride__" dist/apps/portal-web; then exit 1; fi`
- `npx nx build portal-web --configuration=test`
- `rg "__testConnectionStateOverride__" dist/apps/portal-web`
- `npx nx build-storybook portal-web`
- `npx nx e2e portal-web-e2e`
- Verify notification templates do not use `[innerHTML]` for notification content
- Update `.github/workflows/main.yml` to run `npx nx build portal-web --configuration=production` and fail if `rg "__testConnectionStateOverride__" dist/apps/portal-web` finds the hook in the production bundle
- Verify CI includes the production grep check for `__testConnectionStateOverride__`

---

## Success Criteria

**Resume Angle:**
> "Delivered accessible, resilient real-time UI with reconnect recovery and end-to-end coverage."

**Demo-ready Features:**
1. Connection state visible — panel shows detailed state, toggle shows persistent reconnecting/offline state when panel is closed
2. Full keyboard accessible — can open panel, navigate items, mark read, close panel without mouse
3. WCAG AA compliant — contrast ratios met, reduced-motion respected
4. Focus trap works — focus stays in panel, returns to toggle on close
5. E2E coverage — connection resilience, edge states, accessibility, empty-list focus fallback

**Technical Quality:**
- Decoupled architecture: `RealTimeService` unaware of `NotificationHistoryService`
- UI library avoids SignalR dependency through UI-local connection state
- Test hook is Angular environment-gated and absent from production bundles
- CDK FocusTrap for robust focus management
- Roving focus tracks notification ID, not fragile array index
- WCAG AA contrast (4.5:1 minimum)
- Reduced-motion media queries for vestibular accessibility
- Testable design: mock connection state for E2E, observable mocking for unit tests, explicit production bundle verification
