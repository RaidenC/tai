# Panel Review of Sprint 4 (Revised): Resilience, Accessibility, and E2E Polish

**Executive summary:** 2 critical, 19 significant, 12 minor, 14 questions.

**Previous critical finding resolved:** The build infrastructure gap (webpack DefinePlugin on esbuild project) has been corrected. The revised spec now uses Angular environment file replacement, which is the correct approach for `@nx/angular:application`.

---

## Critical Findings

### 1. Force Retry Throttle Has No User-Visible Failure State [architect]
- **Severity:** CRITICAL
- **Confidence:** 9
- **Evidence:** Spec section 1 states: "`isRetryThrottled`... Used by panel retry button when normal `retry()` is called, not `forceRetry()`." When force retry quota (10/60s) is exhausted, spec only says "logs a non-sensitive warning" but provides no user-facing message or UI state.
- **Impact:** Users experience silent rehydration failure during rapid reconnect cycles. Panel shows stale cached content indefinitely with no user recourse visible.
- **Recommendation:** Define user-facing behavior: (a) throttled banner "Updates paused briefly", (b) fall back to normal retry button, or (c) explicit UI copy for quota exhaustion.

### 2. Toggle Connection Indicator Lacks Visual Specification [design]
- **Severity:** CRITICAL
- **Confidence:** 9
- **Evidence:** Spec says "small status dot/ring on the notification toggle when reconnecting or disconnected" but provides no size, color, placement, or interaction with badge.
- **Impact:** Toggle is primary closed-panel indicator. Implementer must invent: dot vs ring, position relative to badge, color differentiation, size proportions. Risk of visual inconsistency.
- **Recommendation:** Specify exact treatment: size (e.g., 8px), color per state, position (e.g., "bottom-right corner of bell icon, outside badge"), behavior when badge present.

---

## Significant Findings

### Build and Environment

### 3. Environment Directory Does Not Exist [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 10
- **Evidence:** `apps/portal-web/src/environments/` directory does not exist. Task 1 assumes creation but doesn't explicitly state "create directory."
- **Impact:** Task 1 blocked. Angular file replacement requires directory and files before project.json can reference them.
- **Recommendation:** Task 1 should explicitly state: "Create `apps/portal-web/src/environments/` directory, then create four environment files."

### 4. project.json Missing Test Configuration [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Current project.json has only `production` and `development` configurations. No `test` configuration exists for build or serve targets.
- **Impact:** E2E command `npx nx serve portal-web --configuration=test` will fail.
- **Recommendation:** Task 1 should explicitly list adding both `build.configurations.test` AND `serve.configurations.test`.

### 5. fileReplacements JSON Structure Not Provided [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec says "add fileReplacements" but doesn't show exact JSON syntax for `@nx/angular:application` esbuild builder.
- **Impact:** Incorrect configuration could cause test hook to leak into dev builds or be absent from test builds.
- **Recommendation:** Provide explicit JSON snippet:
  ```json
  "fileReplacements": [
    { "replace": "apps/portal-web/src/environments/environment.ts",
      "with": "apps/portal-web/src/environments/environment.test.ts" }
  ]
  ```

### Focus and Scroll Behavior

### 6. Rehydration Scroll Position Not Specified [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Spec tracks focus by `focusedNotificationId` but doesn't specify scroll position when new items prepend during rehydration.
- **Impact:** Keyboard user scrolled to item 30, rehydration adds 5 items at top, focused item shifts down visually, may no longer be in view. User stranded.
- **Recommendation:** Specify: (a) scroll to top when new items arrive, (b) preserve scroll offset relative to focused item, or (c) accept current behavior with documented limitation.

### 7. Focus Clamp Algorithm Under-Specified [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec says "move to next visible item by previous index, then previous item, then close button" but doesn't specify the derivation or edge cases.
- **Impact:** Implementation could strand focus during rapid mutation. Unit test exists but exact algorithm missing.
- **Recommendation:** Add pseudocode decision tree for clamp logic (see architect finding 4 for example).

### 8. "Mark All Read" Focus Destination Missing [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Spec specifies focus after individual Mark Read but not after Mark All Read button in header.
- **Impact:** Keyboard users pressing Mark All Read experience unpredictable focus behavior.
- **Recommendation:** Specify: "After Mark All Read, if items remain, focus stays on button with aria-disabled. If list empty, focus moves to close button."

### 9. Focus Destination When Error Appears Mid-Session Undefined [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec covers error focus when panel opens with error, but not when error appears while panel is open and user is focused elsewhere.
- **Impact:** User navigating items, rehydration fails, error banner appears—does focus jump or stay?
- **Recommendation:** Specify: (a) focus does not move (aria-live announcement only), or (b) focus moves to retry if user was in list.

### Connection State UI

### 10. Rehydration Error Banner Placement Unspecified [frontend, design]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec says "inline error banner in the panel" but doesn't specify WHERE. Also unclear if banner scrolls into view when user is scrolled down.
- **Impact:** User at bottom of list, rehydration fails, banner at top not visible. User unaware of failure.
- **Recommendation:** Specify placement (e.g., "above event list after filters") and scroll behavior.

### 11. Connection Banner Layout and Visual Hierarchy Unspecified [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Banner colors and icons specified, but no padding, font size, icon spacing, border radius, or margin from adjacent elements.
- **Impact:** Implementer must invent visual treatment, creating inconsistency with panel's visual language.
- **Recommendation:** Add layout spec: "Full-width, 8px padding, 14px font, 16px icon left of text, 8px margin above search."

### 12. Search Query Persistence During Reconnect Ambiguous [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec says "Search only applies to cached data until hydrate" but doesn't specify if query persists/re-applies after hydrate.
- **Impact:** User searches while disconnected, reconnect happens—does filter remain active? Confusion between input and displayed results.
- **Recommendation:** Specify: (a) query persists and re-applies, (b) query shows "cached only" indicator, or (c) search clears on reconnect.

### Retry and Throttle Logic

### 13. forceRetry() and retry() Interaction Not Tested [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec describes two retry mechanisms but never clarifies concurrent invocation. What if user clicks Retry while forceRetry in-flight?
- **Impact:** Edge case could cause request flood or confusing UI state.
- **Recommendation:** Add unit test for: (1) user retry while forceRetry in-flight, (2) forceRetry throttled but user retry allowed.

### 14. Server-Side Rate Limiting Not Documented [security]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Client-side forceRetry limit is 10/60s, but no mention of server-side rate limiting on `/api/AuditLogs/recent`.
- **Impact:** Malicious client can bypass client-side limits and flood backend.
- **Recommendation:** Document that `/api/AuditLogs/recent` has server-side rate limiting, or add deferred hardening note.

### 15. Timer Cleanup on Component Destruction Missing [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Connected banner auto-dismiss timer (5s) and skeleton delay timer (300ms) need cleanup on ngOnDestroy or panel close.
- **Impact:** Timer leaks if user closes panel before timer fires. Previous timer may interfere with new banner state.
- **Recommendation:** Add explicit cleanup in ngOnDestroy and panel close handler.

### Testing

### 16. Connection Banner Auto-Dismiss Timer Cancellation Not Tested [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** E2E Edge States tests skeleton timing but not banner timing. No test for timer cancellation on state change.
- **Impact:** Banner could auto-dismiss while state already changed to reconnecting.
- **Recommendation:** Add E2E test: Connected banner appears, wait 2s, transition to Reconnecting, verify banner dismissed immediately.

### 17. Focus Clamp After Acknowledge with Filter Removal Not Tested [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Accessibility test covers Mark Read but not Acknowledge when filter removes item.
- **Impact:** Critical notifications acknowledged while severity filter active—focus could strand.
- **Recommendation:** Add E2E test: Set critical filter, acknowledge critical notification, verify focus moves to next item.

### 18. Reconnect Debounce Edge Cases Insufficiently Tested [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Only one debounce test specified. Missing: Disconnected→Connected (should NOT trigger), Reconnecting→Disconnected→Connected (should NOT trigger).
- **Impact:** Incorrect forceRetry triggering on edge transitions.
- **Recommendation:** Add unit tests for edge transition cases that should NOT trigger forceRetry.

### 19. DOM Restructuring Regression Risk for Existing Tests [testing]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Existing panel spec uses `.panel-overlay` and `.notification-panel` selectors. DOM restructuring breaks these.
- **Impact:** Existing tests fail after Task 7 implementation.
- **Recommendation:** Add explicit note in Task 7: "Update existing notification-panel.spec.ts selectors before Task 8."

---

## Minor Findings

- **Connected banner auto-dismiss timer cleanup** (architect): Specify timer reference storage and `ngOnDestroy` cleanup.
- **Reconnection debounce for sustained instability** (architect): Add test for 15 reconnects over 60s to verify quota exhaustion.
- **Idempotency eviction duplicate indicator** (architect): Decide if duplicates need visual indicator or accept as POC limitation.
- **Playwright config for test configuration** (architect): Specify webServer.command update in Task 11/14.
- **Rehydration banner state flash** (frontend): Consider brief display threshold for Connected banner during flicker.
- **Roving tabindex implementation complexity** (frontend): Task 8 has many edge cases—consider subtasks.
- **Dynamic toggle aria-label format** (frontend): Specify exact template for each state.
- **Error state differentiation unclear** (design): Clarify initial load error vs rehydration error placement.
- **Throttle helper text placement** (design): Specify where "Try again shortly" appears.
- **Empty state typography/layout** (design): Add font sizes, spacing, centered layout spec.
- **Skeleton proportions/spacing** (design): Specify widths matching actual items.
- **Mobile touch targets** (design): Verify 44x44px minimum for action buttons.
- **forceRetry upper bound counter reset not tested** (testing): Add test verifying reset after hydrate.
- **Item without action buttons Tab behavior not tested** (testing): Add unit test for Tab from readonly info items.
- **aria-live content verification vague** (testing): Clarify test approach with toHaveAccessibleName.
- **Skeleton min-display needs unit test** (testing): Move timing logic to unit test with fake timers.
- **isRetryThrottled signal relationship to canRetry()** (integration): Clarify if new signal replaces or coexists with existing method.
- **Deprecated NotificationPanelService methods** (integration): Clarify if Sprint 4 Task 7 removes Sprint 3 deprecated methods.
- **aria-disabled vs disabled button change** (frontend): Existing Mark All Read uses `[disabled]`, spec wants `[attr.aria-disabled]`—breaking change.
- **SignalR session expiration deferred without risk note** (security): Add brief risk note to Deferred Hardening section.
- **Server-side tenant authorization note** (security): Add note: "/api/AuditLogs/recent must enforce tenant-scoped auth; client-side is defense-in-depth."

---

## Questions For Human

1. **Force retry quota exhaustion:** Should user see throttled message "Updates paused briefly", or silently log with no UI change?
2. **Duplicate notifications:** Should idempotency eviction duplicates have visual indicator, or accept as POC limitation without UI acknowledgment?
3. **Scroll position during rehydration:** Should scroll move to top when new items arrive, or preserve position relative to focused item?
4. **Search query after reconnect:** Should search query persist and re-apply to new data, or reset/clear?
5. **Error banner placement:** Should rehydration error banner scroll into view automatically, or rely on aria-live announcement?
6. **Focus when error appears mid-session:** Should focus move to retry button, or stay where it was?
7. **Mark All Read focus:** Where should focus go after Mark All Read when list becomes empty?
8. **Banner debounce:** Should Connected banner only appear after connection stays stable for 2-3s (avoid flicker), or accept current behavior?
9. **isRetryThrottled vs canRetry():** Does new signal replace existing private method, or coexist?
10. **Deprecated methods:** Does Sprint 4 Task 7 correspond to Sprint 3 deprecation removal target for setUnreadCount/decrementUnread/markAllAsRead?
11. **injectAuthSession helper:** Is this existing in project or new utility to create for E2E tests?
12. **Retry counters:** Is isRetryThrottled (normal retry) the same quota as forceRetry (10/60s), or separate counters?
13. **Acknowledge filter behavior:** Does panel have severity/category filter that removes acknowledged items from view?
14. **Server-side rate limit:** Does `/api/AuditLogs/recent` have server-side rate limiting, and what are limits?

---

## Conflicts

None identified. Reviewers generally aligned on findings.

---

## Recommended Decision

**REVISE_PLAN**

The two critical findings require resolution:
1. Force retry throttle exhaustion has no user-visible state—users could see stale content indefinitely with no feedback.
2. Toggle closed-panel indicator lacks visual specification—the primary status indicator before opening panel has no design spec.

Additionally, 3 significant findings around environment directory creation, test configuration addition, and scroll position behavior should be clarified before implementation begins.

**Required revisions:**
1. Define user-visible behavior when force retry quota exhausted (banner/message/fallback)
2. Specify toggle indicator visual treatment (size, color, position)
3. Update Task 1 to explicitly state "create environments directory"
4. Specify scroll position behavior during rehydration
5. Specify search query behavior after reconnect
6. Add focus behavior for Mark All Read and mid-session error appearance