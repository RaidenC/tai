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

// Effect to trigger rehydration on reconnect
constructor() {
  effect(() => {
    const prevStatus = this.previousConnectionState;
    const currentStatus = this.connectionState();
    if (prevStatus === HubConnectionState.Reconnecting && currentStatus === HubConnectionState.Connected) {
      this.notificationHistoryService.retry();
    }
    this.previousConnectionState = currentStatus;
  });
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
- App calls `NotificationHistoryService.retry()` on reconnect (see architecture above)
- `retry()` currently has rate limiting (1s debounce, 3 retries/30s)
- Add `forceRetry()` method that bypasses rate limiting for reconnect scenarios (Significant Finding)
- Retry rate limit counter resets on successful hydrate (Minor Finding)
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
- `apps/portal-web/src/app/app.ts` — add connection state signal adapter, effect for rehydration trigger
- `apps/portal-web/src/app/app.html` — pass `connectionState` to panel
- `apps/portal-web/src/app/notifications/notification-history.service.ts` — add `forceRetry()` method
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — add `connectionState` input (optional, default 'connected' for Storybook)
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — add connection banner
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — banner styling with reduced-motion support

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
- **Tab/Shift+Tab** — moves focus between buttons inside focused item (mark read, acknowledge) then to next item
- **Home/End** — moves focus to first/last item
- **Enter/Space on list item** — does nothing (items are containers, not actionable)
- **Enter/Space on buttons** — triggers button action (mark read, acknowledge)

Implementation:
- Roving tabindex: only one `.event-item` has `tabindex="0"` at a time
- `focusedItemIndex` signal in component tracks which item is focusable
- Arrow key handlers update `focusedItemIndex` and update tabindexes
- Buttons inside items are always focusable via Tab from focused item

**Empty Panel Focus Destination (Significant Finding):**
- If list empty, focus goes to close button (always available)
- Mark all read button is disabled but still focusable (has `tabindex`)

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
- Add test-only getter in App component: `window.__testConnectionState__`
- Playwright uses `page.evaluate()` to set connection state signal directly
- This tests rehydration UX without needing true WebSocket drops

**Connection Resilience Test (Corrected from Critical Finding #4):**

Correct test flow order:
1. Setup: Mock connection state to `Disconnected`
2. Trigger event during disconnect: Use backend API to create notification (bypass SignalR)
3. Open panel: Verify disconnected banner shows, cached notifications visible
4. Mock reconnect: Set connection state to `Connected`
5. Verify: Rehydration triggered, new notification appears

```typescript
// E2E test outline
test('reconnect rehydration recovers missed events', async ({ page }) => {
  // 1. Navigate and login
  await page.goto('/admin/privileges');
  
  // 2. Inject test hook to control connection state
  await page.evaluate(() => {
    (window as any).__testConnectionStateOverride__ = 'Disconnected';
  });
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  
  // 3. Verify disconnected banner
  await expect(page.locator('[aria-label="Connection status"]')).toContainText('Offline');
  
  // 4. Create notification via API during disconnect
  const response = await page.request.post('/api/test/create-notification', { ... });
  
  // 5. Simulate reconnect
  await page.evaluate(() => {
    (window as any).__testConnectionStateOverride__ = 'Connected';
  });
  
  // 6. Verify new notification appears (rehydration worked)
  await expect(page.locator('[data-testid="notification-item"]')).toContainText('...');
});
```

**Alternative Approach (no backend manipulation):**
- Use existing privilege edit flow
- Set connection state to Disconnected BEFORE editing
- Edit privilege (notification created)
- Reconnect
- Verify notification appears via rehydration

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
- Auto-dismiss: 5s for Connected (screen reader needs announcement time)
- Dismiss animation: fade out 300ms ease-out (with reduced-motion check)

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
- Add effect to trigger `forceRetry()` on reconnect
- Add test-only getter for E2E

**Task 2: NotificationHistoryService.forceRetry()** (Backend integration)
- Add `forceRetry()` method bypassing rate limit
- Reset retry counter on successful hydrate

**Task 3: Connection Banner UI** (Panel component)
- Add banner HTML with three states
- Add styling (WCAG-compliant colors, reduced-motion)
- Add ARIA live region

**Task 4: Focus Trap Wrapper** (Panel component)
- Refactor DOM: wrap overlay + panel in container
- Add `cdkTrapFocus` directive
- Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Remove overlay Escape handler, single handler on container

**Task 5: Keyboard Navigation** (Panel component)
- Roving tabindex on `.event-item` containers
- Arrow Up/Down, Home/End handlers
- `focusedItemIndex` signal
- Focus visible styles

**Task 6: Toggle ARIA Completeness** (Toggle component)
- `aria-expanded` computed from `NotificationPanelService.isOpen`
- `aria-controls="notification-panel"` (hardcoded ID)

**Task 7: Visual Polish** (Panel styles)
- Connection banner styling
- Skeleton loader (reduced-motion)
- Enhanced empty/error states
- Focus visible styles (reduced-motion)

**Task 8: E2E Connection Resilience** (New test)
- Mock connection state via `page.evaluate()`
- Correct test flow: disconnect → event → reconnect → verify

**Task 9: E2E Edge States** (New test)
- Loading skeleton
- Empty state
- Error state + retry
- Rehydration error during reconnect

**Task 10: E2E Accessibility** (New test)
- Keyboard open/close
- Focus trap verification
- Arrow navigation
- Screen reader announcement content

**Task 11: Unit Tests**
- App: test reconnect → `forceRetry()` called
- Panel: test focus trap initialization, keyboard handlers
- History: test `forceRetry()` bypasses rate limit

**Task 12: Full Verification**
- All unit tests pass
- All e2e tests pass
- Lint passes
- Build passes
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