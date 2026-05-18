# Panel Review of Sprint 4: Resilience, Accessibility, and E2E Polish

**Executive summary:** 3 critical, 24 significant, 15 minor, 13 questions.

---

## Critical Findings

### 1. Build Infrastructure Gap for Test Hook Gating [architect, integration, security, testing]
- **Severity:** CRITICAL
- **Confidence:** 9
- **Evidence:** Plan specifies "webpack DefinePlugin configuration" but `apps/portal-web/` has no `webpack.config.js`. Build uses `@nx/angular:application` executor with Angular CLI's esbuild bundler, not webpack. No `environment*.ts` files exist in portal-web. Testing reviewer notes "no verification command specified for build gate."
- **Impact:** Test hook `window.__testConnectionStateOverride__` cannot be build-gated as described. Without proper gating, hook could leak into production, exposing connection state override to attackers. Implementation will stall when developers discover webpack.config.js doesn't exist.
- **Recommendation:**
  1. Specify correct build-time constant injection: Angular's `fileReplacements` in project.json configurations, or create `environment.ts`/`environment.prod.ts` files in portal-web
  2. Add CI verification command: `grep -r "__testConnectionStateOverride__" dist/portal-web/` must return 0 matches
  3. Update Task 3 and Files to Modify section with concrete path

---

## Significant Findings

### Focus Management

### 2. Focus Trap Escape Handler Conflict Risk [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Current overlay has `(keydown.escape)="close()"` binding. Plan says "Remove overlay Escape handler, single handler on container" but no explicit deletion step in Task 5.
- **Impact:** Double-close race condition if overlay handler remains after DOM restructuring.
- **Recommendation:** Add explicit subtask in Task 5: "DELETE overlay's `(keydown.escape)="close()"` binding."

### 3. Focus Restoration Destination After Actions Unspecified [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Spec says "Focus restoration after actions" but doesn't specify where focus goes after "Mark read" or "Acknowledge" clicks.
- **Impact:** Keyboard users lose orientation after actions, making sequential marking difficult.
- **Recommendation:** Specify: focus stays on same item if still visible, or moves to next unread.

### 4. Roving Tabindex Edge Cases Undefined [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Plan specifies Arrow Up/Down navigation but doesn't define behavior for: empty state (0 items), single item, items without action buttons.
- **Impact:** Focus trap could trap focus or exit unexpectedly in edge cases.
- **Recommendation:** Define: empty → focus on Close button; single item → Arrow keys do nothing; item without buttons → Tab skips to next item.

### 5. Focus Destination When List Becomes Empty Not Tested [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 6
- **Evidence:** Spec says "Empty Panel Focus Destination: focus goes to close button" but no test specified.
- **Impact:** Regression risk if focus behavior breaks during later refactors.
- **Recommendation:** Add e2e test: navigate to last notification, mark all read (if items disappear), verify focus on close button.

### Connection State UI

### 6. Connection Banner Placement Ambiguous [frontend, design]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec says "Banner inside panel header" (line 90). Frontend reviewer asks if banner should be in app shell. Design reviewer notes: after auto-dismiss, no persistent status indicator.
- **Impact:** If banner is panel-only, disconnected user cannot see status without opening panel.
- **Recommendation:** Clarify placement decision: (a) panel-only (user must open panel to see status) or (b) app shell banner (always visible). Document rationale.

### 7. Reconnecting State Interaction Model Undefined [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Plan shows reconnecting banner but doesn't specify whether cached content is interactive during reconnecting. Can users scroll? Mark read? Search?
- **Impact:** Implementer must invent interaction model, risking inconsistent UX.
- **Recommendation:** Specify: cached content is fully interactive during reconnecting. Search works on cached data only (no new results until reconnect).

### 8. Error State Copy and Guidance Missing [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 10
- **Evidence:** Plan shows "Error message in red text" with no actual copy. Retry button label unspecified.
- **Impact:** Implementer must invent messaging, potentially using unclear or blame-shifting copy.
- **Recommendation:** Specify: "Could not load notifications. Check your connection and try again." + button "Retry".

### 9. forceRetry() Bypasses Rate Limit Without Abuse Mitigation [security]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec says forceRetry() "bypasses rate limit counter entirely." Test hook (if leaked) could trigger unlimited calls.
- **Impact:** Connection state manipulation could flood `/api/AuditLogs/recent` endpoint.
- **Recommendation:** Add upper bound on forceRetry() calls per time window (e.g., max 10/min). Log when called (no sensitive data).

### Rehydration and State

### 10. Idempotency Cache Eviction During Disconnect Unclear [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec says "1000+ events during disconnect could show duplicates" but doesn't clarify if localStorage lifecycle state (readAt, acknowledgedAt) survives.
- **Impact:** User marks notification read, reconnect shows duplicate as unread.
- **Recommendation:** Clarify: lifecycle state keys by event ID, survives idempotency cache eviction.

### 11. Connection State Type Definition Ambiguous [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Panel needs ConnectionState input. Should it import HubConnectionState from SignalR (UI lib coupling) or define local enum?
- **Impact:** UI lib would depend on SignalR package, violating lib separation.
- **Recommendation:** Define UI-local ConnectionState enum in `notification-panel.types.ts`. App.ts maps HubConnectionState to this type.

### CSS and Storybook

### 12. CSS Selector Impact from DOM Restructuring [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Focus trap wrapper changes stacking context. Overlay (z-index: 99) and panel (z-index: 100) rely on being direct fixed siblings.
- **Impact:** Stacking could break if container creates implicit z-index from transforms/opacity.
- **Recommendation:** Add explicit CSS: `.notification-panel-container { position: fixed; z-index: 99; inset: 0; }`

### 13. Storybook Missing connectionState Input [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Task 14 says "update stories with connectionState default" but current stories don't have input or argType.
- **Impact:** Storybook build fails after adding connectionState to panel.
- **Recommendation:** Add to Files to Modify: stories.ts — add connectionState argType, binding, default `'Connected'`.

### Test Coverage

### 14. No Unit Test for Debounce Behavior [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec shows 500ms debounce logic but Task 13 only lists test case without code outline.
- **Impact:** Rapid oscillation could trigger multiple hydration calls, defeating debounce.
- **Recommendation:** Add test: simulate Reconnecting→Connected→Reconnecting→Connected within 500ms, verify forceRetry() called exactly once.

### 15. No Unit Test for forceRetry() In-Flight Skip [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Core resilience feature (skip if in-flight) has no test coverage.
- **Impact:** Bug removing in-flight check would allow request flooding.
- **Recommendation:** Add test: mock isHydrating() returning true, call forceRetry(), verify no HTTP request.

### 16. No Unit Test for focusedItemIndex Clamp [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec says "clamp focusedItemIndex on mutation" but no test structure provided.
- **Impact:** Focus could go out of bounds during mutation.
- **Recommendation:** Add test: set focusedItemIndex to last, emit new notifications, verify clamped to valid range.

### 17. Missing isRetryThrottled Signal Source [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 10
- **Evidence:** Panel has `@Input() isRetryThrottled = false` but NotificationHistoryService doesn't expose the signal. App.html doesn't pass it.
- **Impact:** Task 9 blocked by Task 2. If Task 9 attempted before Task 2, throttled state always shows false.
- **Recommendation:** Add dependency notation: "Task 9 blocked by Task 2."

### 18. Test Hook Accepts Arbitrary State Without Validation [security]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Hook accepts any value, bypassing normal SignalR lifecycle.
- **Impact:** Invalid state could cause unexpected behavior even in test builds.
- **Recommendation:** Add runtime validation: `if (!Object.values(HubConnectionState).includes(state)) return;`

### Responsive and Visual

### 19. Responsive Behavior Not Specified [frontend, design]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** No panel width, no viewport constraints, no mobile behavior specified.
- **Impact:** Implementer must decide responsive behavior, risking inconsistent UX.
- **Recommendation:** Specify minimum: "Panel fixed 400px width, full-screen on viewports <480px."

### 20. Skeleton Loader Behavior Not Specified [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** "Skeleton loader with 3 placeholder items" but no min time, no timeout, no reconnect behavior.
- **Impact:** Skeleton flashes on fast loads, shows indefinitely on slow loads.
- **Recommendation:** Specify: show skeleton only if load >300ms. During reconnect, show "Loading..." text instead of skeleton.

---

## Minor Findings

- **Rehydration debounce location unclear** (architect): App-level debounce couples timing to App component. Document rationale for 500ms.
- **Connection banner auto-dismiss timer not cancelled** (architect): Specify RxJS timer with takeUntil or effect cleanup.
- **FocusedItemIndex track by ID not index** (architect): Consider tracking focusedNotificationId instead of index for mutations.
- **Connected banner auto-dismiss race** (frontend): Timer should cancel on state change away from Connected.
- **Unread badge behavior during disconnect** (frontend): Specify whether badge shows stale count or syncing indicator.
- **Empty state mental model** (design): Consider adding sub-caption explaining notification types.
- **Severity visual encoding not specified** (design): Add spec for severity colors with WCAG contrast confirmation.
- **Loading state timing thresholds** (design): Specify min display time and timeout message.
- **Missing Home/End/wrapping test assertions** (testing): Add test for Arrow wrapping and Home/End keys.
- **aria-controls panel ID missing** (integration): Add `id="notification-panel"` to panel div.
- **Test hook RealTimeService interaction** (integration): Clarify if hook affects App.ts state or RealTimeService observable.
- **WebSocket reconnection authentication** (security): Deferred, but should be in Dependency Contract table.
- **Connection banner exposes state** (security): Acceptable for admin workstation, document for future hardening.

---

## Questions For Human

1. **Banner placement:** Should connection banner be panel-only (visible only when panel open) or always visible in app shell?
2. **Focus restoration:** After Mark Read, should focus stay on same item or move to next unread?
3. **Mobile assumption:** Does admin workstation exclude mobile entirely, or should panel degrade gracefully?
4. **Test hook propagation:** Should `__testConnectionStateOverride__` affect RealTimeService observable directly, or only App.ts local state?
5. **Environment injection:** Prefer Angular's standard environment.ts pattern (with fileReplacements) or custom build-time constant injection?
6. **ConnectionState type:** Should UI lib define its own enum, or App.ts pass HubConnectionState values directly?
7. **forceRetry() upper bound:** Is max 10 calls/min acceptable abuse mitigation?

---

## Conflicts

### Banner Placement
- **Design reviewer:** Banner inside panel header, but after auto-dismiss user has no persistent status indicator.
- **Frontend reviewer:** Asks if banner should be in app shell (always visible).
- **Resolution needed:** Clarify whether user must open panel to see connection status, or status is always visible.

---

## Recommended Decision

**REVISE_PLAN**

The critical finding (build infrastructure gap) must be resolved before implementation. The test hook cannot be properly gated using the webpack DefinePlugin approach described—the actual build system uses Angular CLI's esbuild, and no webpack.config.js exists.

Additionally, significant findings around focus management, connection banner placement, and test coverage require plan updates before implementation can proceed safely.

**Required revisions before implementation:**
1. Replace webpack DefinePlugin with correct Angular/Nx build-time injection mechanism
2. Add CI verification command for test hook exclusion from production builds
3. Specify connection banner placement with rationale
4. Specify focus restoration behavior for panel actions
5. Add concrete test outlines for debounce, in-flight skip, and clamp behaviors