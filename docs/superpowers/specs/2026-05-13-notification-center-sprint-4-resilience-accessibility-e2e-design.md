# Notification Center Sprint 4 — Resilience, Accessibility, and E2E Polish

> **Goal:** Make the notification center senior-level — resilient real-time UI, fully accessible, comprehensive e2e coverage.

**Architecture:** Extend existing sprint 3 foundation without architectural changes. Connection state flows from `RealTimeService.connectionStatus$` to panel via signal adapter in App. Rehydration uses existing `NotificationHistoryService.retry()`. Accessibility adds focus management service, keyboard navigation, and ARIA completeness. E2E extends existing lifecycle test with connection resilience and edge state coverage.

**Tech Stack:** Angular standalone components, Angular signals, RxJS, Vitest, Nx, Playwright e2e.

---

## Current State (Sprints 1-3)

**Sprint 1 (PR #89):**
- `NotificationItem` domain model with severity, category, source types
- Claim Check pattern: SignalR minimal payload → REST fetch → notification
- `NotificationMapper` for `AuditLogDetails` → `NotificationItem`
- Tenant isolation validation
- Real-time privilege edit notifications working

**Sprint 2 (PR #90):**
- `GET /api/AuditLogs/recent` endpoint with Admin/SystemAdmin role restriction
- Tenant-scoped idempotency keys with FIFO eviction (1000 entry cache)
- Hydration state signals: `isHydrating`, `hydrationError`, `hasHydrated`
- `NotificationHistoryService` with auth-ready hydration, retry, debouncing, rate limiting
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

**SignalR State Tracking:**
- `RealTimeService.connectionStatus$` already emits `HubConnectionState` (Connected, Reconnecting, Disconnected)
- Create signal adapter in `App` component: convert observable to signal using `toSignal()`
- Pass connection state to `NotificationPanelComponent` via new `connectionState` input

**Connection Banner:**
- Display inside panel header, above search/filter controls
- Three states:
  - **Connected:** Green checkmark icon, text "Connected", auto-dismiss after 3s (fade animation)
  - **Reconnecting:** Yellow spinner icon, text "Reconnecting...", persistent
  - **Disconnected:** Red X icon, text "Offline — will retry automatically", persistent
- Uses `role="status"` and `aria-live="polite"` for reconnect announcements
- Dismissible via close button for non-connected states (optional)

**Rehydration on Reconnect:**
- When SignalR `onreconnected()` fires, call `NotificationHistoryService.retry()`
- This fetches `/api/AuditLogs/recent` again, which:
  - Re-hydrates the store with events that arrived during disconnect
  - Deduplicates via existing idempotency cache in `NotificationSignalStore`
  - Overlays lifecycle state via `applyLifecycle()`
- No new queue needed — SignalR buffers during reconnect attempt, delivers on reconnect
- Events that were pushed during full disconnect (not buffered) are covered by recent endpoint re-fetch

**Files to Modify:**
- `apps/portal-web/src/app/app.ts` — add connection state signal adapter
- `apps/portal-web/src/app/app.html` — pass `connectionState` to panel
- `apps/portal-web/src/app/real-time.service.ts` — wire `onreconnected` to trigger rehydration
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — add `connectionState` input
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — add connection banner
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — banner styling

---

### 2. Accessibility — Focus Management

**Focus Trap on Panel Open:**
- When panel opens, focus moves to first interactive element (search input)
- Focus trap keeps focus within panel while open
- Tab cycles through: search → filter buttons → notification items → mark all read → close
- Shift+Tab reverses direction
- Focus trap released when panel closes

**Focus Restoration on Panel Close:**
- When panel closes (via close button, Escape, or overlay click), focus returns to toggle button
- Toggle button receives focus so user can continue keyboard navigation

**Escape Key Handler:**
- Panel already has Escape handler on overlay: `(keydown.escape)="close()"`
- Extend to also work when focus is inside panel content (not just overlay)
- Add Escape handler on panel container element

**Keyboard Navigation in List:**
- Arrow Down / Arrow Up moves focus between notification items
- Home moves focus to first item
- End moves focus to last item
- Enter / Space activates focused item's primary action (mark read, then acknowledge if critical)
- Focus visible style on items (distinct from hover)

**Toggle ARIA Completeness:**
- Add `aria-expanded="true|false"` reflecting panel open state
- Add `aria-controls="notification-panel-id"` pointing to panel
- Add `aria-describedby` pointing to connection status when offline

**Panel ARIA Completeness:**
- Add `aria-modal="true"` on panel container (it's a modal dialog pattern)
- Add `role="dialog"` on panel container
- Add `aria-labelledby` pointing to "Notifications" heading
- Ensure list items have focusable buttons (already have buttons, need to verify tab order)

**Files to Modify:**
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.ts` — track focus state, emit focus events
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — implement focus trap, keyboard nav
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — add role="dialog", aria-modal, aria-labelledby, Escape handler
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — focus-visible styles
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.html` — add aria-expanded, aria-controls
- `libs/ui/design-system/src/lib/molecules/notification-toggle/notification-toggle.component.ts` — add panelOpen input, compute aria-expanded

---

### 3. E2E Coverage

**Existing Test (notifications-lifecycle.spec.ts):**
- modify privilege → toast → panel item → mark read → refresh → item still appears
- Already covers lifecycle persistence across refresh

**New Test: Connection Resilience Flow**
- Modify privilege → disconnect SignalR (simulate network failure) → reconnect → verify missed event appears
- Test setup:
  1. Navigate to privileges page, make an edit
  2. Use Playwright route interception to simulate SignalR disconnect (block `/hubs/notifications`)
  3. Verify offline banner appears in panel
  4. Unblock SignalR route
  5. Verify reconnect banner appears, then disappears
  6. Verify missed notification (from step 1) appears after rehydration
- This demonstrates resilience and rehydration working

**New Test: Edge States**
- Loading skeleton: intercept `/api/AuditLogs/recent` with delay, verify loading state shows before data
- Empty state: intercept with empty array `[]`, verify "No recent notifications" message
- Error state: intercept with 500 error, verify error message and retry button
- Retry flow: click retry button, intercept with success, verify notifications load

**New Test: Accessibility**
- Keyboard open panel: focus toggle → press Enter → verify panel opens and focus moves to search
- Keyboard close panel: press Escape → verify panel closes and focus returns to toggle
- Keyboard navigation: Tab through all elements, verify focus trap
- Arrow key navigation: Arrow Down through items, verify focus moves

**Files to Modify:**
- `apps/portal-web-e2e/src/notifications-lifecycle.spec.ts` — add connection resilience test
- `apps/portal-web-e2e/src/notifications-edge-states.spec.ts` — new file for edge state tests
- `apps/portal-web-e2e/src/notifications-accessibility.spec.ts` — new file for accessibility tests

---

### 4. Visual Polish

**Connection Banner Styling:**
- Connected: green background (#10B981), white text, checkmark SVG
- Reconnecting: yellow background (#F59E0B), white text, animated spinner SVG
- Disconnected: red background (#EF4444), white text, X SVG
- Auto-dismiss animation: fade out after 3s for Connected state
- Transition: 300ms ease-in-out

**Loading State:**
- Replace text "Loading recent notifications..." with skeleton loader
- 3 skeleton items: animated pulse, gray background (#E5E7EB)
- Each skeleton shows severity bar placeholder, title placeholder, summary placeholder
- Uses existing `aria-live="polite"` and `role="status"`

**Empty State:**
- Current: "No recent notifications" text
- Enhanced: illustration (bell icon with slash), text, "All caught up!" message
- Keep existing `role="status"` and `aria-live="polite"`

**Error State:**
- Keep existing error message and retry button
- Enhance: add warning icon, clearer error message styling
- Retry button with hover state

**Focus Visible Styles:**
- When item has focus (via keyboard nav): 2px solid blue ring (#3B82F6)
- Distinct from hover state (which uses background color change)
- Use `:focus-visible` pseudo-class to show only for keyboard focus

**Files to Modify:**
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` — skeleton loader, enhanced empty/error states
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss` — connection banner, skeleton, focus-visible styles
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts` — skeleton logic (show 3 skeletons when loading)

---

## Implementation Order

**Task 1: Connection State Signal Adapter** (App wiring)
- Add `toSignal()` adapter for `connectionStatus$` in App
- Pass to panel via new input
- Wire `onreconnected` to trigger rehydration

**Task 2: Connection Banner UI** (Panel component)
- Add banner HTML with three states
- Add styling (colors, icons, animations)
- Add ARIA live region

**Task 3: Focus Management Service** (Panel service + component)
- Implement focus trap
- Implement focus restoration to toggle
- Add Escape handler on panel container

**Task 4: Keyboard Navigation** (Panel component)
- Arrow Up/Down navigation
- Home/End navigation
- Enter/Space action activation
- Focus visible styles

**Task 5: Toggle ARIA Completeness** (Toggle component)
- aria-expanded, aria-controls, aria-describedby
- Pass panelOpen state from parent

**Task 6: Panel ARIA Completeness** (Panel component)
- role="dialog", aria-modal, aria-labelledby
- Verify tab order

**Task 7: Visual Polish** (Panel styles)
- Connection banner styling
- Skeleton loader
- Enhanced empty/error states
- Focus visible styles

**Task 8: E2E Connection Resilience** (New test)
- Disconnect/reconnect flow
- Verify missed event appears

**Task 9: E2E Edge States** (New test)
- Loading skeleton
- Empty state
- Error state + retry

**Task 10: E2E Accessibility** (New test)
- Keyboard open/close
- Focus trap
- Arrow navigation

**Task 11: Full Verification**
- All unit tests pass
- All e2e tests pass
- Lint passes
- Build passes
- Storybook builds

---

## Success Criteria

**Resume Angle:**
> "Delivered accessible, resilient real-time UI with reconnect recovery and end-to-end coverage."

**Demo-ready Features:**
1. Connection state visible — user knows when offline, sees reconnect attempt, sees recovery
2. Full keyboard accessible — can open panel, navigate items, mark read, close panel without mouse
3. Visual polish — loading skeleton, enhanced empty/error states, connection banner
4. E2E coverage — connection resilience test demonstrates recovery works
5. Accessibility test coverage — automated verification of keyboard navigation

**Technical Quality:**
- Focus trap implemented correctly (focus stays in panel while open)
- Focus restoration works (focus returns to toggle on close)
- Connection state announced via aria-live (screen reader knows state changes)
- Keyboard navigation follows standard patterns (arrow keys, home/end)
- No new architectural complexity — extends sprint 3 foundation cleanly