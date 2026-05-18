# Panel Review of Sprint 4 (R3): Resilience, Accessibility, and E2E Polish

**Executive summary:** 4 critical, 14 significant, 10 minor, 10 questions.

**Previous findings resolved:** R2 critical findings (force retry quota UX, toggle indicator visual spec, environment directory) have been addressed. Build infrastructure, scroll/focus/search behaviors now specified.

---

## Critical Findings

### 1. Scroll Preservation Incorrect for Non-Focused Prepend [frontend]
- **Severity:** CRITICAL
- **Confidence:** 10
- **Evidence:** Spec line 202: "If there is no focused item, preserve raw scrollTop and do not auto-scroll to top." Decision tree (lines 322-335) shows `list.scrollTop = beforeScrollTop` for non-focused case. When items prepend, preserving raw scrollTop shifts viewport to show different content (400px upward if 10 items prepended).
- **Impact:** User viewing items at position 2000px, rehydration prepends 400px of content, viewport now shows items at position 2400px — completely different notifications than what was visible. Breaks spec's goal "preserve the user's visual position."
- **Recommendation:** When no focused element, adjust scrollTop by prepended content height:
  ```typescript
  const prependedHeight = measurePrependedHeight(mutate);
  list.scrollTop = beforeScrollTop + prependedHeight;
  ```

### 2. Banner Auto-Dismiss Cuts Off Screen Reader Announcement [design]
- **Severity:** CRITICAL
- **Confidence:** 9
- **Evidence:** Spec states "Auto-dismiss after 5s; timer cancels immediately if state changes" (line 175). Screen reader users with slow speech rates or who navigate away from live region won't hear "Notifications are live" before banner disappears.
- **Impact:** Violates WCAG 2.1 Guideline 4.1.3 (Status Messages) — status should remain long enough to be perceivable. Users miss critical connection state announcement.
- **Recommendation:** Either (a) remove auto-dismiss entirely (Connected banner stays until state changes), or (b) increase to 10s minimum, or (c) defer auto-dismiss until accessibility API signals announcement complete (not reliably implementable). Recommended: keep Connected banner persistent until state changes.

### 3. Force Retry Upper Bound Has No Unit Test [testing]
- **Severity:** CRITICAL
- **Confidence:** 10
- **Evidence:** Spec lists required test (line 478): "call forceRetry() 11 times in 60 seconds and verify only 10 attempts are accepted." Current `notification-history.service.spec.ts` has no tests for `forceRetry()` at all. Rate limiting is security defense-in-depth.
- **Impact:** If quota misconfigured or reset logic fails, reconnect storms could overwhelm `/api/AuditLogs/recent`. Quota behavior unverified.
- **Recommendation:** Add three spec-mandated tests for force retry: in-flight skip, upper bound, reset after hydrate/window. Use fake timers and mock HTTP.

### 4. Focus Clamp on Mutation Untested [testing]
- **Severity:** CRITICAL
- **Confidence:** 10
- **Evidence:** Spec line 481: "set focus to last visible notification, replace with shorter list, verify focus clamps." Current panel spec tests specific items but not mutation scenarios where focused ID disappears. Spec's `resolveFocusAfterMutation` decision tree (lines 303-318) specified but untested.
- **Impact:** Mutation focus clamping failure strands keyboard users when filters change or hydrated items prepend. Breaks WCAG keyboard operability.
- **Recommendation:** Add unit test: set `focusedNotificationId`, trigger notification replacement that removes that ID, verify focus moves to valid target per decision tree.

---

## Significant Findings

### Connection State and Mapping

### 5. HubConnectionState Mapping Function Not Defined [architect, integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 8-9
- **Evidence:** Spec shows `mapToNotificationPanelConnectionState()` call (line 66) but provides no implementation. SignalR has 5 states (`Connecting`, `Disconnecting` are intermediate). UI-local type has 3 states.
- **Impact:** Implementer must guess mapping for `Connecting` and `Disconnecting`. Could show `disconnected` (too severe) or `reconnecting` (implies failure).
- **Recommendation:** Add explicit mapping table:
  - Connected → 'connected'
  - Reconnecting → 'reconnecting'
  - Connecting → 'reconnecting' (initial attempt)
  - Disconnected → 'disconnected'
  - Disconnecting → 'reconnecting' (graceful shutdown)

### 6. Force Retry Throttle Window Semantics Undefined [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Spec says "max 10 per 60 seconds" but doesn't specify sliding vs fixed window. Existing `canRetry()` uses sliding window (30s). Edge cases at boundaries behave differently.
- **Impact:** Rapid reconnect cycles could exhaust quota unpredictably at window boundaries.
- **Recommendation:** Specify sliding-window pattern with timestamps per tenant/user key. Clarify: "Reset retry counters on successful hydrate" applies to both normal and force retry?

### Focus and Keyboard

### 7. Focus Order Within Panel Not Explicitly Defined [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** `cdkTrapFocusAutoCapture` lands on "first focusable" (line 266) but DOM order not specified. What's first: search input, filter buttons, Mark All Read, close button, or items?
- **Impact:** If close button placed before search input in refactored HTML, keyboard users land on close button first — unusual pattern making navigation harder.
- **Recommendation:** Specify focus order: (1) search input, (2) filter buttons, (3) Mark All Read, (4) list items, (5) close button as last Tab stop.

### 8. Focus Restoration Race Condition During Rapid Mutations [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** `preserveScrollDuringPrepend` uses `queueMicrotask` (line 327). If mutations happen rapidly, scroll adjustment could execute after subsequent mutation changed list. `focusedElement` reference may not exist.
- **Impact:** Scroll position jumps unexpectedly. `document.contains(focusedElement)` check fails, falls back to raw scrollTop (wrong behavior).
- **Recommendation:** Track `focusedNotificationId` instead of DOM element. Re-query element by ID inside microtask.

### 9. Empty State Focus Destination Inconsistency [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Panel opens empty → focus on search input (line 338). Filters to empty → focus on close button (line 339). Same visual result, different focus destinations.
- **Impact:** Screen reader users experience unpredictable focus behavior. Violates expectation consistency.
- **Recommendation:** Standardize: always land on close button when list empty (search is low-value with no content, close is primary action needed).

### Retry and Throttle

### 10. Combined Throttle States for Retry UI Unclear [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Force retry quota (10/60s) exhausted AND normal retry quota (3/30s) exhausted simultaneously — what UI shows? Spec describes each independently but not intersection.
- **Impact:** User hitting both limits could see conflicting states or be unable to retry despite spec stating "manual retry remains available."
- **Recommendation:** Add precedence rule: `forceRetryNotice` is informational overlay, does not disable Retry button. Retry button's `aria-disabled` reflects only normal retry throttle (3/30s).

### 11. NotificationHistoryService Doesn't Expose isRetryThrottled Signal [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 10
- **Evidence:** Current service has internal `canRetry()` (lines 144-157) but no public signal. Panel input exists (`@Input() isRetryThrottled = false`), but app.html never passes it. Spec correctly identifies gap but "Files to Modify" should explicitly list signal as public API.
- **Impact:** Panel's `isRetryThrottled` input is dead code (never receives true value).
- **Recommendation:** Task 2 should explicitly: "Expose readonly `isRetryThrottled` signal computed from internal retry attempt count."

### 12. Search-to-Empty Transition During Reconnect Unspecified [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 6
- **Evidence:** Search query matches cached items while disconnected. Reconnect hydrates, query matches NOTHING. Transition from "cached results visible" to "empty state" abrupt and confusing.
- **Impact:** "Searching cached notifications" text becomes stale. No visual transition or explanation.
- **Recommendation:** When query matches nothing in hydrated set: remove "Searching cached notifications" text, show empty state with copy: "No results for '[query]' among recent notifications."

### Visual and Status Indicators

### 13. Multiple Simultaneous Status Indicators Create Confusion [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** During reconnect: amber banner + search helper "Searching cached notifications" + "Syncing notifications..." above list. Three status messages simultaneously.
- **Impact:** Cognitive overload. User wonders: "Am I connected or not? Can I trust these results?"
- **Recommendation:** Consolidate: keep amber banner for coarse state. Remove search helper during reconnecting (search already works on cached content). Only show "Syncing..." when actual hydration in-flight. Never show more than two at once.

### DOM and Integration

### 14. DOM Restructuring Wrapper Affects FocusTrap Placement [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec shows wrapper with `cdkTrapFocus` (line 249) but doesn't explicitly show conditional rendering guard. Wrapper must be inside `@if (isOpen()())` or FocusTrap active when panel closed.
- **Impact:** FocusTrap would be active on hidden wrapper, causing unexpected focus behavior.
- **Recommendation:** Task 7 must clarify: wrapper inside existing `@if (isOpen()())` block.

### 15. Connection Banner Timer Cleanup Untested [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Spec line 483 lists timer cleanup test. Existing panel spec has loading/error tests but no timer cleanup. Connected banner 5s auto-dismiss, skeleton 300ms threshold/min-display — timers can leak.
- **Impact:** Timer leaks cause memory leaks, unexpected behavior after panel close/destroy.
- **Recommendation:** Add tests with `vi.useFakeTimers()` for: (1) Connected banner timer cancels on state change, (2) skeleton timers cancel on panel close/destroy.

### Security

### 16. Notification Content Sanitization Not Specified [security]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** `NotificationMapper` transforms `AuditLogDetails` with title/summary. No mention: user-generated content? Server sanitization? Angular interpolation vs `[innerHTML]`? CSP presence?
- **Impact:** If notifications contain user-generated content rendered via `[innerHTML]`, XSS possible. Angular interpolation is safe but must be confirmed.
- **Recommendation:** Add explicit confirmation: notification content never user-generated OR server sanitizes OR all content uses Angular interpolation (no `[innerHTML]`). Add Task 14 audit step.

### 17. Authorization for /api/AuditLogs/recent Not Verified [security]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec says endpoint "must enforce tenant-scoped authorization server-side" (line 218) but provides no verification. Endpoint added in Sprint 2, authorization assumed.
- **Impact:** If tenant isolation not implemented, malicious user could access other tenants' notification history.
- **Recommendation:** Add backend authorization verification: code review confirming tenant isolation, or automated test verifying cross-tenant access returns 403/404.

---

## Minor Findings

- **HubConnectionState mapping for Connecting/Disconnecting** (integration): Clarify these intermediate states map to 'reconnecting' or document as transient
- **app.ts missing toSignal import** (integration): Must import from `@angular/core/rxjs-interop`
- **Storybook render template missing connectionState** (integration): Add binding in Task 4
- **Connected banner timer cleanup on destroy** (architect): Add DestroyRef cleanup
- **Test hook window lifecycle** (architect): Clarify E2E uses page reload between tests
- **mark-read touch target ambiguity** (frontend): Clarify both per-item and header buttons need 44px
- **Connected banner behavior on panel close** (frontend): Document banner doesn't reappear after timer elapsed
- **Toggle accessible label omits unread count** (design): Include count in label when >0
- **Retry button aria-disabled support** (design): Consider native disabled with live region announcement
- **Toggle indicator placement** (design): Clarify dot at button corner, not bell corner
- **Force retry throttle scope** (security): Clarify client-side only (documented limitation)
- **Test hook CI enforcement** (security): Add grep verification to CI pipeline, not just Task 14 manual
- **E2E test files don't exist** (testing): Spec correctly identifies; ensure Tasks 11-13 executed
- **App reconnect debounce negative edges** (testing): Add tests for D→C and R→D→C transitions
- **Toggle ARIA attributes** (testing): Minor gap — spec adequately describes changes

---

## Questions For Human

1. **Connected banner persistence:** Should Connected banner remain visible until state changes (no auto-dismiss), or is 5-10s auto-dismiss acceptable with explicit acknowledgment that slow speech users may miss it?
2. **Scroll preservation:** Should non-focused scroll preservation adjust by prepended height, or is accepting visual shift acceptable for non-focused users?
3. **HubConnectionState intermediate states:** Should `Connecting` and `Disconnecting` map to 'reconnecting', or be collapsed into 'disconnected'/'connected'?
4. **Force retry window:** Sliding window (timestamps in last 60s) or fixed window (calendar intervals)?
5. **Empty state focus:** Always close button, or search input for consistency with open-empty?
6. **Search empty transition:** Show "No results for '[query]'" or clear search query on empty hydration?
7. **Status indicator hierarchy:** Keep only banner + syncing text during reconnect (remove search helper)?
8. **Retry button throttle precedence:** Force retry quota exhaustion informational only (button stays enabled)?
9. **Notification content source:** Are titles/summaries user-generated or system-generated only?
10. **Backend authorization verification:** Is tenant isolation for `/api/AuditLogs/recent` already verified/tested?

---

## Conflicts

### Empty State Focus Destination
- **Design reviewer:** Standardize to close button (primary action, search low-value)
- **Spec:** Open empty → search input, filter empty → close button
- **Resolution needed:** Choose one consistent destination or document rationale for difference.

---

## Recommended Decision

**REVISE_PLAN**

The four critical findings require resolution:
1. Scroll preservation for non-focused case is mathematically wrong — preserving raw scrollTop shifts viewport
2. Banner auto-dismiss at 5s cuts off screen reader announcements for slow speech users
3. Force retry upper bound lacks unit test coverage for a security defense mechanism
4. Focus clamp on mutation lacks unit test for a core accessibility feature

Additionally, 5 significant findings around connection state mapping, focus order, throttle state interaction, authorization verification, and content sanitization should be clarified.

**Required revisions:**
1. Fix scroll preservation: adjust scrollTop by prepended height when no focused element
2. Increase Connected banner auto-dismiss to 10s minimum, or remove auto-dismiss entirely
3. Add explicit HubConnectionState → NotificationPanelConnectionState mapping table
4. Define focus order within panel: search → filters → Mark All Read → items → close
5. Clarify retry throttle precedence: force retry quota informational, normal retry controls button disabled state
6. Add authorization verification step for `/api/AuditLogs/recent` tenant isolation
7. Add content sanitization confirmation or audit step