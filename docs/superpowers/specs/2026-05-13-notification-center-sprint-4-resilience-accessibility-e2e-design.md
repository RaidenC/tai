# Notification Center Sprint 4 — Resilience, Accessibility, and E2E Polish

> **Goal:** Make the notification center senior-level — resilient real-time UI, fully accessible, comprehensive e2e coverage.

**Architecture:** Extend existing sprint 3 foundation. Connection state flows from `RealTimeService.connectionStatus$` to App via `toSignal()`. App subscribes to status changes and triggers rehydration on reconnect (decoupled approach). Focus trap uses `@angular/cdk/a11y` FocusTrap directive on wrapper container. Keyboard navigation uses roving tabindex on list items.

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

**Rehydration Trigger Architecture (Critical Finding #1):**

Use **App subscription approach** to avoid circular dependencies:
- `RealTimeService` does NOT inject `NotificationHistoryService`
- `App` component subscribes to `connectionStatus$` observable
- When status transitions from `Reconnecting` to `Connected`, App calls `notificationHistoryService.retry()`
- This keeps `RealTimeService` as pure SignalR management, unaware of hydration logic

```typescript
// In App component
private readonly connectionStatus$ = this.realTimeService.connectionStatus$;
private readonly connectionState = toSignal(this.connectionStatus$, { initialValue: HubConnectionState.Disconnected });
private previousConnectionState: HubConnectionState = HubConnectionState.Disconnected;
private reconnectDebounceTimestamp = 0;
private readonly RECONNECT_DEBOUNCE_MS = 500;

constructor() {
  // Effect to trigger rehydration on reconnect (with debouncing for rapid oscillation)
  effect(() => {
    const prevStatus = this.previousConnectionState;
    const currentStatus = this.connectionState();
    const now = Date.now();

    if (prevStatus === HubConnectionState.Reconnecting && currentStatus === HubConnectionState.Connected) {
      // Debounce: skip if reconnect happened within 500ms of previous
      if (now - this.reconnectDebounceTimestamp >= this.RECONNECT_DEBOUNCE_MS) {
        this.notificationHistoryService.forceRetry();
        this.reconnectDebounceTimestamp = now;
      }
    }
    this.previousConnectionState = currentStatus;
  });
}

// Test-only hook for E2E (build-gated)
// @ts-ignore - environment check
if (typeof window !== 'undefined' && (window as any).__TEST_ENV__) {
  (window as any).__testConnectionStateOverride__ = (state: HubConnectionState) => {
    // This hook is only available in test builds, never production
    // E2E sets __TEST_ENV__ via page.evaluate() before using
  };
}
```

**Connection Banner:**
- Display inside panel header (between title row and search box)
- Three states with WCAG-compliant contrast:
  - **Connected:** Green background (#10B981), white text, checkmark SVG. Auto-dismiss after 5s (screen reader needs time)
  - **Reconnecting:** Dark amber background (#D97706), white text (4.5:1 contrast), animated spinner SVG. Persistent.
  - **Disconnected:** Red background (#EF4444), white text, X SVG. Persistent.
- Uses `role="status"` and `aria-live="polite"` for state announcements
- Skeleton animation wrapped in `@media (prefers-reduced-motion: no-preference)` (Critical Finding for vestibular accessibility)

**Rehydration on Reconnect:**
- App calls `NotificationHistoryService.forceRetry()` on reconnect (see architecture above)
- `forceRetry()` behavior (Significant Finding):
  - Bypasses rate limit counter entirely (no counting, no blocking)
  - If hydration already in-flight: skips (does not cancel/restart, avoids request flood)
  - Uses `isHydrating` signal to check in-flight state before making request
  - Internal-only visibility (not exposed via public API surface)
- Retry rate limit counter resets on successful hydrate (Minor Finding)
- `isRetryThrottled` state: `NotificationHistoryService` exposes `isRetryThrottled` signal for UI wiring (Significant Finding). Used by panel retry button when normal `retry()` is called, not `forceRetry()`.
- `/api/AuditLogs/recent` lookback: 50 count-based, no time filter. Max recoverable disconnect duration is however long it takes for 50 new events to accumulate (Clarifying Question #3)
- Rehydration keeps cached content during fetch, no skeleton loader (Clarifying Question #7)
- If rehydration fails: keep cached content, show error banner in panel (not modal error) (Clarifying Question #6)

**Idempotency and Lifecycle Conflict Resolution (Significant Findings):**
- Server data is source of truth for notification content
- `localStorage` overlays lifecycle state (`readAt`, `acknowledgedAt`)
- Re-fetch returns same notifications with same IDs → idempotency prevents duplicates
- Lifecycle state persists in localStorage and re-applies via `applyLifecycle()`
- Edge case: if 1000+ events during disconnect, reconnect could show duplicates (idempotency cache eviction). Accept as documented limitation for POC.

**Files to Modify:**
- `apps/portal-web/src/app/app.ts` — add connection state signal adapter, effect for rehydration trigger, test hook (build-gated)
- `apps/portal-web/src/app/app.html` — pass `connectionState` to panel, pass `isRetryThrottled` from history service
- `apps/portal-web/src/app/notifications/notification-history.service.ts` — add `forceRetry()` method, add `isRetryThrottled` signal
- `apps/portal-web/webpack.config.js` (or project config) — add `environment.test` DefinePlugin
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — add `connectionState` input (optional, default 'connected' for Storybook), implement roving tabindex, keyboard handlers, import CDK FocusTrap, clamp focusedItemIndex on mutation
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — wrap in container with cdkTrapFocus, add role="dialog", aria-modal, aria-labelledby, single Escape handler, connection banner, close button accessible label
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — banner styling, focus-visible styles, skeleton styles, **audit selectors for DOM restructuring** (Significant Finding), reduced-motion media queries for fade-in and fade-out

---

### 2. Accessibility — Focus Management

**Focus Trap Architecture (Critical Finding #2):**

Refactor DOM to wrap overlay + panel in single container:
```html
<!-- New wrapper with focus trap -->
<div class="notification-panel-container" cdkTrapFocus cdkTrapFocusAutoCapture>
  <div class="panel-overlay" (click)="close()" role="presentation"></div>
  <div class="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notifications-heading">
    <!-- panel content -->
  </div>
</div>
```

- Use `@angular/cdk/a11y` FocusTrap directive (`cdkTrapFocus`)
- `cdkTrapFocusAutoCapture` moves focus to first focusable element on open
- Focus trap released when panel closes (CDK handles this automatically)
- Single Escape handler on panel container (remove overlay handler to avoid double-fire) (Significant Finding)

**Focus Restoration on Panel Close:**
- CDK FocusTrap automatically restores focus to element that triggered open
- Ensure toggle button has focus before panel opens (click/Enter already does this)
- No additional focus restoration code needed — CDK handles it

**Role Decision (CONFLICT Resolution):**
- Use **`role="dialog"` + `aria-modal="true"`**
- Rationale: Focus trap makes it modal behavior (can't interact with main content). Escape-to-close matches dialog pattern. Screen reader users expect "dismiss to return" behavior.
- Add `aria-labelledby="notifications-heading"` pointing to panel title

**Keyboard Navigation Model (Significant Findings):**

Clarify navigation hierarchy:
- **Arrow Up/Down** — moves focus between `.event-item` list item containers (roving tabindex)
  - Wrapping: Down on last → first, Up on first → last (Minor Finding)
- **Tab/Shift+Tab** — moves focus between buttons inside focused item (mark read, acknowledge) then to next item
- **Home/End** — moves focus to first/last item. Works from any focus location (item container or button inside) (Clarifying Question #8)
- **Enter/Space on list item** — does nothing (items are containers, not actionable)
- **Enter/Space on buttons** — triggers button action (mark read, acknowledge)

Implementation:
- Roving tabindex: only one `.event-item` has `tabindex="0"` at a time
- `focusedItemIndex` signal in component tracks which item is focusable
- Arrow key handlers update `focusedItemIndex` and update tabindexes
- Buttons inside items are always focusable via Tab from focused item
- **Clamp on mutation:** When notifications arrive/disappear, clamp `focusedItemIndex` to valid range (0 to length-1). If item removed while focused, focus moves to adjacent item or first item. (Significant Finding)
- **Focus after action:** When "Mark Read" clicked, focus stays on same item (item doesn't disappear immediately, only becomes "read"). If acknowledge removes item (not current behavior), focus moves to next item. (Significant Finding)

**Empty Panel Focus Destination (Significant Finding):**
- If list empty, focus goes to close button (always available, has accessible label "Close")
- Mark all read button is disabled but still focusable (has `tabindex`)

**Error State Focus Destination (Significant Finding):**
- Panel opens with error visible → focus goes to search input (first focusable), can Tab to retry button

**Files to Modify:**
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — implement roving tabindex, keyboard handlers, import CDK FocusTrap
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — wrap in container with cdkTrapFocus, add role="dialog", aria-modal, aria-labelledby, single Escape handler
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — focus-visible styles with reduced-motion support
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.types.ts` — add ConnectionState type
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html` — add aria-expanded (computed from service), aria-controls (hardcoded panel ID)

---

### 3. E2E Coverage

**Critical Finding #5 — WebSocket Mock Strategy:**

Cannot mock WebSocket directly with Playwright route interception. Use **mock connection status observable** approach:
- Test hook: `window.__testConnectionStateOverride__(state)` — gated by `environment.test` (dev/test builds only, never production)
- Build gating: Angular `environment.test` is injected via webpack DefinePlugin in test builds. Production builds exclude this code entirely.
- Playwright uses `page.evaluate()` to set `window.__TEST_ENV__ = true` then call the hook
- This tests rehydration UX without needing true WebSocket drops

**Connection Resilience Test (Corrected from Critical Finding #4):**

**Primary approach** (no test-only backend endpoint):
- Use existing privilege edit flow to create notification
- Test order: disconnect → create event → reconnect → verify rehydration

```typescript
// E2E test outline
test('reconnect rehydration recovers missed events', async ({ page }) => {
  // 1. Navigate and login
  await injectAuthSession(page, 'acme-session.json');
  await page.goto('http://acme.localhost:4200/admin/privileges');

  // 2. Enable test hook (build-gated, only works in test env)
  await page.evaluate(() => {
    (window as any).__TEST_ENV__ = true;
  });

  // 3. Open panel and verify initial connected state
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  const panel = page.locator('.notification-panel');
  await expect(panel).toBeVisible();

  // 4. Mock connection to Disconnected state
  await page.evaluate(() => {
    (window as any).__testConnectionStateOverride__('Disconnected');
  });
  await expect(panel.locator('[aria-label="Connection status"]')).toContainText('Offline');

  // 5. Close panel, create notification via privilege edit (during disconnect)
  await page.getByRole('button', { name: /close/i }).click();
  // ... privilege edit flow to create notification ...

  // 6. Reopen panel (still disconnected, cached content visible)
  await page.getByRole('button', { name: /toggle notifications/i }).click();

  // 7. Simulate reconnect
  await page.evaluate(() => {
    (window as any).__testConnectionStateOverride__('Connected');
  });

  // 8. Verify new notification appears via rehydration
  await expect(panel.locator('[data-testid="notification-item"]').first()).toContainText(/privilege/i, { timeout: 10000 });
});
```

**Note:** This approach avoids creating `/api/test/create-notification` endpoint. The privilege edit flow is production code, making the test more realistic. (Clarifying Question #3, #4)

**Edge States Test:**
- Loading skeleton: intercept `/api/AuditLogs/recent` with delay, verify skeleton shows
- Empty state: intercept with `[]`, verify "No recent notifications" with decorative illustration
- Error state: intercept with 500, verify error message + retry button
- Retry flow: click retry, intercept with success, verify notifications load
- Rehydration error during reconnect: intercept `/api/AuditLogs/recent` with 500 after reconnect mock, verify error banner (not modal)

**Accessibility Test:**
- Keyboard open panel: focus toggle → Enter → verify panel opens, focus on search input
- Keyboard close panel: Escape → verify panel closes, focus returns to toggle
- Focus trap: Tab cycle, verify focus stays in panel, verify focusable elements in order
- Arrow navigation: Arrow Down through items, verify focus moves, verify buttons Tab-navigable
- Screen reader announcement: verify aria-live content updates (not just element existence)

**Files to Modify:**
- `apps/portal-web/src/app/app.ts` — add test-only getter `window.__testConnectionStateOverride__`
- `apps/portal-web-e2e/src/notifications-resilience.spec.ts` — new file for connection resilience tests
- `apps/portal-web-e2e/src/notifications-edge-states.spec.ts` — new file for edge state tests
- `apps/portal-web-e2e/src/notifications-accessibility.spec.ts` — new file for accessibility tests

---

### 4. Visual Polish

**Connection Banner Styling:**
- Connected: #10B981 green, white text, checkmark SVG
- Reconnecting: #D97706 dark amber, white text (WCAG AA compliant), spinner SVG with `@media (prefers-reduced-motion: no-preference)` animation
- Disconnected: #EF4444 red, white text, X SVG
- Banner inside `.panel-header`, above `.search-box`
- Auto-dismiss: 5s for Connected (screen reader needs announcement time). Timer cancelled on state change (Minor Finding).
- Animation: fade-in on appear, fade-out on dismiss (both with `@media (prefers-reduced-motion: no-preference)`)

**Loading State:**
- Skeleton loader with 3 placeholder items
- Gray background (#E5E7EB), animated pulse (with reduced-motion check)
- Each skeleton: severity bar (colored strip), title bar (gray), summary bar (gray)
- `aria-live="polite"` and `role="status"` on skeleton container
- `aria-busy="true"` on skeleton items

**Empty State:**
- Decorative bell-with-slash SVG (`aria-hidden="true"`) (Minor Finding)
- Text: "All caught up! No recent notifications"
- Keep `role="status"` and `aria-live="polite"`

**Error State:**
- Warning icon (triangle SVG)
- Error message in red text
- Retry button with hover/focus states
- `role="alert"` and `aria-live="assertive"`

**Focus Visible Styles:**
- Roving tabindex items: `:focus-visible { outline: 2px solid #3B82F6; outline-offset: 2px; }`
- Buttons: existing focus styles, verify `:focus-visible` used
- Animation: `@media (prefers-reduced-motion: no-preference)` for any transitions

**Files to Modify:**
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — skeleton loader, enhanced empty/error states, connection banner
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — banner colors, skeleton styles, focus-visible, reduced-motion
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — skeleton item count, connection state handling

---

## Implementation Order

**Task 1: Connection State Signal Adapter + Rehydration Trigger** (App wiring)
- Add `toSignal()` adapter for `connectionStatus$`
- Add effect to trigger `forceRetry()` on reconnect (with 500ms debounce)
- Add test hook `window.__testConnectionStateOverride__` (build-gated)
- Initialize `previousConnectionState` field

**Task 2: NotificationHistoryService.forceRetry()** (Backend integration)
- Add `forceRetry()` method bypassing rate limit
- Check `isHydrating` signal before making request (skip if in-flight)
- Add `isRetryThrottled` signal for UI wiring
- Reset retry counter on successful hydrate
- Internal-only visibility (not exposed in public API)

**Task 3: Test Infrastructure Build Gate** (Dev tooling)
- Add `environment.test` webpack DefinePlugin configuration
- Gate test hook with `environment.test` check in App
- E2E setup: inject `window.__TEST_ENV__ = true` before using hook

**Task 4: Connection Banner UI** (Panel component)
- Add banner HTML with three states
- Add styling (WCAG-compliant colors, reduced-motion for fade-in/out)
- Add ARIA live region
- Auto-dismiss timer (cancelled on state change)

**Task 5: Focus Trap Wrapper** (Panel component)
- Refactor DOM: wrap overlay + panel in container
- Add `cdkTrapFocus` directive
- Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Remove overlay Escape handler, single handler on container
- Close button with accessible label "Close notifications panel"
- Audit CSS selectors for DOM restructuring impact

**Task 6: Keyboard Navigation** (Panel component)
- Roving tabindex on `.event-item` containers
- Arrow Up/Down, Home/End handlers (with wrapping)
- `focusedItemIndex` signal with clamp on mutation
- Focus restoration after actions (stay on item)
- Focus visible styles

**Task 7: Toggle ARIA Completeness** (Toggle component)
- `aria-expanded` computed from `NotificationPanelService.isOpen`
- `aria-controls="notification-panel"` (hardcoded ID)

**Task 8: Visual Polish** (Panel styles)
- Connection banner styling (fade-in/out animations with reduced-motion)
- Skeleton loader (reduced-motion)
- Enhanced empty/error states
- Focus visible styles (reduced-motion)
- CSS audit: update selectors targeting old DOM structure

**Task 9: App Wiring** (App.html)
- Pass `connectionState` to panel
- Pass `isRetryThrottled` from history service to panel

**Task 10: E2E Connection Resilience** (New test)
- Mock connection state via `page.evaluate()`
- Correct test flow: disconnect → event → reconnect → verify
- Verify rehydration error handling

**Task 11: E2E Edge States** (New test)
- Loading skeleton
- Empty state
- Error state + retry
- Rehydration error during reconnect

**Task 12: E2E Accessibility** (New test)
- Keyboard open/close
- Focus trap verification
- Arrow navigation (with wrapping)
- Screen reader announcement content

**Task 13: Unit Tests**
- App: test reconnect → `forceRetry()` called, debounce works, test hook gated
- Panel: test focus trap initialization, keyboard handlers, focusedItemIndex clamp
- History: test `forceRetry()` bypasses rate limit, skips when in-flight, `isRetryThrottled` signal

**Task 14: Full Verification**
- All unit tests pass
- All e2e tests pass
- Lint passes
- Build passes (verify test hook excluded from production)
- Storybook builds (update stories with connectionState default)

---

## Success Criteria

**Resume Angle:**
> "Delivered accessible, resilient real-time UI with reconnect recovery and end-to-end coverage."

**Demo-ready Features:**
1. Connection state visible — user knows when offline, sees reconnect attempt, sees recovery
2. Full keyboard accessible — can open panel, navigate items, mark read, close panel without mouse
3. WCAG AA compliant — contrast ratios met, reduced-motion respected
4. Focus trap works — focus stays in panel, returns to toggle on close
5. E2E coverage — connection resilience, edge states, accessibility

**Technical Quality:**
- Decoupled architecture: `RealTimeService` unaware of `NotificationHistoryService`
- CDK FocusTrap for robust focus management
- Roving tabindex for standard keyboard navigation pattern
- WCAG AA contrast (4.5:1 minimum)
- Reduced-motion media queries for vestibular accessibility
- Testable design: mock connection state for E2E, observable mocking for unit tests