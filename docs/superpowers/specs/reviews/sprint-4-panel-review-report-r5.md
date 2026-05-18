# Panel Review of Sprint 4 (R5): Resilience, Accessibility, and E2E Polish

**Executive summary:** 3 critical, 8 significant, 7 minor, 6 questions.

**Previous findings resolved:** R4 critical findings (effect mutation timing race condition, backend authorization test requirement, scroll preservation timing, force-retry cleanup) have been addressed. Spec now uses RxJS observable chain for reconnect trigger, explicitly requires backend authorization test file, uses `afterNextRender()` for scroll preservation, and documents force-retry timestamp cleanup.

---

## Critical Findings

### 1. Focus Order Does Not Match DOM Order [frontend]
- **Severity:** CRITICAL
- **Confidence:** 9
- **Evidence:** Spec line 319 states: "Initial focus order on open with notifications: search input → filter buttons → Mark All Read → first roving list item → close button." Current DOM template shows header-actions containing Mark All Read and Close button BEFORE the search-box element. DOM order is: Mark All Read → Close → Search → Filters → Items. `cdkTrapFocusAutoCapture` sends focus to the first focusable element by DOM order, which would be Mark All Read (or Close if Mark All Read is disabled).
- **Impact:** Auto-capture will focus Mark All Read or Close button instead of search input. Keyboard users experience incorrect initial focus destination, breaking the documented Tab flow. Screen reader announcements start from wrong element.
- **Recommendation:** Either: (a) restructure DOM to match desired focus order (move header-actions to after event-list), or (b) use `cdkFocusInitial` directive on search input to override auto-capture target, or (c) update spec to match actual DOM order (Mark All Read/Close first).

### 2. Backend Authorization Test Assertion Criteria Ambiguous [testing]
- **Severity:** CRITICAL
- **Confidence:** 10
- **Evidence:** Spec lines 239-241 define `Recent_RejectsForgedTenantContext`: "authenticate as tenant A and attempt to force tenant B through the app's supported tenant-selection mechanism or tenant header, then assert the response is 403/404 or that tenant B rows are not returned if the header is intentionally ignored." Two distinct outcomes are acceptable per the spec: (1) 403/404 rejection, or (2) tenant B rows not returned (header ignored). The spec does not specify which outcome the test should assert or document the actual tenant-selection mechanism.
- **Impact:** Implementer must invent assertion criteria. Could write a test that passes even when tenant isolation fails (if the header is "intentionally ignored" and tenant B rows leak). Security regression could pass CI.
- **Recommendation:** Specify exact expected behavior: "If tenant header is rejected by backend, assert 403/404. If tenant header is ignored but rows filtered by Global Query Filter, assert tenant B rows are not returned." Document the actual tenant-selection mechanism (header, query param, cookie) the test will use.

### 3. Task Ordering Circular Dependency: Task 5 Depends on Task 10 Output [integration]
- **Severity:** CRITICAL
- **Confidence:** 9
- **Evidence:** Spec Task 5 ("App Wiring") line 664-668 states: "Pass panel open state and connection state to the notification toggle." Current `NotificationToggleComponent` only has `unreadCount` input. Task 10 ("Toggle ARIA Completeness") line 707-709 is where `isOpen` and `connectionState` inputs are added to the toggle. Task 5 cannot pass these inputs until Task 10 exposes them.
- **Impact:** Implementer following sequential task order fails at Task 5 because toggle inputs don't exist yet. Either Task 10 must precede Task 5, or Task 5 must be split.
- **Recommendation:** Either: (a) reorder Task 10 before Task 5, or (b) modify Task 5 to only pass panel-related inputs (`connectionState`, `isRetryThrottled`, `recoveryNotice`) and move toggle wiring to Task 10.

---

## Significant Findings

### Retry and Throttle Architecture

### 4. Retry Throttle Maps Separation Unspecified [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec lines 201-203 state: "Stores force-retry attempt timestamps per tenant/user key." Existing `NotificationHistoryService` has `retryAttemptsByTenant` Map for normal retry (3/30s). Spec requires force retry (10/60s) but does not specify whether: (a) separate `forceRetryAttemptsByTenant` Map, (b) composite Map with both attempt arrays, or (c) replacement of existing Map.
- **Impact:** Implementation ambiguity on throttle state management. Cleanup logic location depends on this decision.
- **Recommendation:** Explicitly state: "Add separate `forceRetryAttemptsByTenant` Map with independent lifecycle, mirroring cleanup pattern from `retryAttemptsByTenant`."

### 5. Retry Counter Clearing Location Unspecified [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec line 212 states: "Successful hydrate clears both normal retry attempts and force-retry attempt timestamps." Existing `applyHydrationRows()` method (lines 109-136) does not clear retry counters. Spec does not specify WHERE clearing happens: inside `applyHydrationRows()`, in retry Subject success handler, or in new callback.
- **Impact:** Implementation placement ambiguity. If clearing placed incorrectly (before in-flight guard reset), race conditions could occur.
- **Recommendation:** Add explicit placement: "Clear retry counters inside `applyHydrationRows()` after store update, before marking hydrated."

### Focus and State Management

### 6. Search-to-Empty Detection Logic Missing [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec line 219 states: "if a persisted search query matches cached items but matches no hydrated items after reconnect, show empty search copy." Current implementation has one empty state (`@empty` block). Spec does not specify how panel detects this scenario vs. normal empty search result or genuine empty notification list.
- **Impact:** Implementer must invent detection logic. Could show wrong empty-state copy.
- **Recommendation:** Specify detection logic: "Track `wasSearchMatchBeforeHydrate` boolean. After hydration, if query exists, `filteredNotifications` was non-empty before hydrate, and is empty after hydrate, show search-to-empty copy."

### 7. Reconnect Loading State Differentiation Undefined [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec line 584 states: "During reconnect with cached items, do not show skeleton; show compact status text 'Syncing notifications...' above the list." Current panel uses `isLoading` boolean. Spec requires two different visual treatments for loading depending on initial vs. reconnect scenario.
- **Impact:** `isLoading` alone cannot differentiate scenarios. Implementer must derive state or add new input.
- **Recommendation:** Specify: "Add `isReconnectSyncing` input or compute from `hasHydrated && isLoading && connectionState === 'reconnecting'`. Show skeleton only when `isLoading && !hasHydrated`. Show syncing text only when `isLoading && hasHydrated && connectionState === 'reconnecting'`."

### 8. Sticky Status Area Scrolling Container Unspecified [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec line 222 states error banner "Place in sticky status area after filter buttons and before .event-list, so it remains visible even when the list is scrolled." CSS `position: sticky` only works within scrolling container. Current template has `.event-list` as static div. Spec does not specify which element has `overflow-y: auto` and constrained height.
- **Impact:** Sticky positioning may not work if wrong element is scrollable. Error/recovery banners could scroll out of view.
- **Recommendation:** Specify: ".notification-panel has `display: flex; flex-direction: column; max-height: 100vh`. .event-list has `flex: 1; overflow-y: auto`. Sticky status area has `position: sticky; top: 0` within .event-list's scroll context."

### Visual Hierarchy

### 9. Connection Banner + Empty State Visual Interaction Undefined [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec line 184 defines Connected banner persistent while panel open. Spec lines 590-594 define empty state centered layout. Both could display simultaneously when connected with no notifications. Spec does not clarify whether Connected banner suppressed for empty state.
- **Impact:** User seeing both "Notifications are live" and "All caught up! No recent notifications" experiences visual redundancy. Screen reader users hear overlapping status messages.
- **Recommendation:** Define interaction: "Connected banner suppressed when list empty (empty state alone communicates healthy state)." Or document rationale for coexistence.

### 10. Connection Banner + Error Banner Visual Hierarchy Undefined [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec line 180 places connection banner in panel header. Spec line 222 places error banner in sticky status area before .event-list. During rehydration failure while reconnecting, user could see amber banner + red error banner simultaneously. Spec does not define visual priority.
- **Impact:** Two colored banners visible simultaneously creates cognitive confusion about which status is primary.
- **Recommendation:** Define hierarchy: "Error banner suppresses reconnecting banner during active error (error is more actionable). Error aria-live announcement has precedence over connection banner."

### Testing

### 11. Reconnect Debounce Edge Case: State Change During Debounce Window [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec line 537 requires test for `Reconnecting -> Connected -> Reconnecting -> Connected` within 500ms. Missing edge case: `Reconnecting -> Connected -> Disconnected` within 500ms. The RxJS chain uses filter then debounceTime. State change to Disconnected during debounce won't cancel pending emit because `distinctUntilChanged()` and `pairwise()` are before debounce, not after.
- **Impact:** Race condition: reconnect debounce fires after user already disconnected. forceRetry() called when no longer connected.
- **Recommendation:** Add unit test case: "emit Reconnecting -> Connected -> Disconnected within 500ms, verify forceRetry() behavior." Or add recheck of current state after debounce: `pipe(...debounceTime(500), withLatestFrom(connectionState$), filter(([_, current]) => current === Connected))`.

### 12. Filter Button Focus Behavior After Click Undefined [testing, frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec line 525 requires E2E test for filter buttons. When filter changes, visible results shrink. If focus was on item that becomes invisible, what happens? Spec line 338 defines clamp on mutation for notification changes, but filter button click is user-initiated mutation. No test or spec for this.
- **Impact:** Keyboard user clicks filter, previously-focused item disappears, focus stranded.
- **Recommendation:** Specify: "Filter button click does not move focus from the button; user must Arrow Down into filtered list." Or: "After filter click, if focused item removed, move focus to first visible item."

---

## Minor Findings

- **Retry UI precedence stacking**: clarify that `forceRetryNotice` and `retry-throttled` helper text can stack with defined order
- **Filter buttons aria-pressed**: spec correctly identifies requirement; implementation task should add binding
- **Panel `isRetryThrottled` input already exists**: spec claims to add it in Task 4 but panel already has this input; service signal missing (correctly identified)
- **Overlay keyboard handler deletion**: Task 7 deletes handlers; existing tests need selector update (spec notes this in line 683)
- **pairwise import**: add to Task 3 import checklist
- **Retry button combined disabled state**: clarify `isLoading` vs `isRetryThrottled` precedence when both true
- **Search Escape handler wiring**: spec defines behavior but implementation approach (stopPropagation vs focused element check) unspecified

---

## Questions For Human

1. **Focus order vs. DOM order:** Is desired focus order (search first) intentional and requiring DOM restructuring, or should spec match existing DOM order (Mark All Read/Close first)?
2. **Backend authorization test assertion:** For `Recent_RejectsForgedTenantContext`, should test assert 403/404 (header rejected) or tenant isolation (header ignored)? What tenant-selection mechanism does backend use?
3. **Task ordering:** Should Task 10 (Toggle ARIA) precede Task 5 (App Wiring) to resolve circular dependency?
4. **Retry throttle Maps:** Should `forceRetryAttemptsByTenant` be separate Map or composite with existing `retryAttemptsByTenant`?
5. **Connected banner + empty state:** Should green Connected banner be suppressed when list empty?
6. **Error banner hierarchy:** Should error banner suppress reconnecting banner during active error, or both coexist?

---

## Conflicts

### Backend Authorization Test Assertion
- **Testing reviewer:** Assertion criteria ambiguous (403/404 OR tenant B rows not returned) — could mask security regression
- **Security reviewer:** Requirement correctly identified in spec; test file creation is implementation task
- **Resolution needed:** Specify exact assertion based on actual backend tenant-selection mechanism behavior

---

## Recommended Decision

**REVISE_PLAN**

Three critical findings require resolution:

1. **Focus order vs. DOM order mismatch**: `cdkTrapFocusAutoCapture` will use DOM order (Mark All Read first), not spec's stated order (search first). Either restructure DOM or use `cdkFocusInitial` directive.

2. **Backend authorization test assertion ambiguous**: "403/404 OR tenant B rows not returned" allows either outcome. Must specify exact expected behavior based on backend tenant-selection mechanism.

3. **Task ordering circular dependency**: Task 5 requires passing toggle inputs that Task 10 creates. Must reorder tasks or split Task 5.

Additionally, 4 significant findings around search-to-empty detection, reconnect loading differentiation, sticky status area scroll container, and banner visual hierarchy should be clarified.

**Required revisions:**

1. Resolve focus order: either restructure DOM (header-actions after event-list), use `cdkFocusInitial` on search, or update spec to match DOM order
2. Specify exact assertion for `Recent_RejectsForgedTenantContext` based on backend tenant-selection behavior
3. Reorder Task 10 before Task 5, or split Task 5 into panel wiring (Task 5) and toggle wiring (Task 10)
4. Add detection logic for search-to-empty after reconnect
5. Specify reconnect loading differentiation (computed `isReconnectSyncing` or new input)
6. Define sticky status area scroll container structure
7. Define Connected banner + empty state interaction
8. Define error banner + reconnecting banner hierarchy
9. Add reconnect debounce edge case test for state change during debounce

---

## Prior Findings Verified as Resolved

R4 findings verified as addressed:

- **Effect mutation timing race condition (R4 Critical #1)**: RESOLVED. Spec uses RxJS observable chain with `distinctUntilChanged()`, `pairwise()`, `debounceTime(500)`, `takeUntilDestroyed()` (lines 81-91).

- **Backend authorization test requirement (R4 Critical #2)**: RESOLVED. Spec explicitly requires test file (lines 239-241, 548, 556). File path specified: `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs`.

- **Scroll preservation timing (R4 Significant #4)**: RESOLVED. Spec uses `afterNextRender()` (lines 362-393, explicit rationale at line 393).

- **Force retry timestamp cleanup (R4 Significant #3)**: RESOLVED. Spec lines 202-204 document cleanup on auth/logout/hydrate and timestamp expiry.

- **Mark All Read focus behavior (R4 Significant #5)**: RESOLVED. Spec lines 398-399 document native disabled skipped in Tab order.

- **Escape behavior (R4 Significant #6)**: RESOLVED. Spec line 328 defines search clear-first semantics.

- **Filter buttons specification (R4 Significant #7)**: RESOLVED. Spec line 321 defines `All`, `Critical`, `Warning`, `Info` with `aria-pressed`.

- **Disconnected manual retry (R4 Significant #8)**: RESOLVED. Spec line 187 adds Retry button in disconnected banner.

- **CI grep verification (R4 Significant #10)**: RESOLVED. Spec line 754-755 requires GitHub workflow update.

- **Deferred risk register (R4 Significant #11)**: RESOLVED. Spec lines 246-251 add deferred hardening risk table.

R3 findings verified as resolved:

- **Scroll preservation math**: Adjusts scrollTop by prepended height (lines 383-386)
- **Banner auto-dismiss**: Connected banner persistent, no timer (line 191)
- **Force retry upper bound test**: Required at line 542
- **Focus clamp mutation test**: Required at line 545
- **HubConnectionState mapping**: Explicit table at lines 109-116
- **Focus order defined**: Spec line 319 (though DOM order conflicts — new finding #1)