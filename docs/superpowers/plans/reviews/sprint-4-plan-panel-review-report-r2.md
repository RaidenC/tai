# Panel Review of Sprint 4 Implementation Plan (R2)

**Executive summary:** 1 critical, 14 significant, 18 minor, 2 questions.

**Review round:** R2 — second broad adversarial review after R1 revision. Checking prior critical findings and allowing broad current-phase findings.

---

## Critical Findings

### 1. Task 7 May Overwrite Task 3 app.html Changes [integration]
- **Confidence:** 9
- **Evidence:** Task 3 Step 4 (lines 553-569) shows full notification-panel template block with new inputs `[connectionState]`, `[isRetryThrottled]`, `[recoveryNotice]`, `[hasHydrated]`. Task 7 Step 5 (lines 1389-1398) shows ONLY the notification-toggle template block. Task 7 commit (line 1413) says `git add apps/portal-web/src/app/app.html` which implies modifying the file. No explicit statement that Task 7 must preserve Task 3's panel changes.
- **Impact:** If Task 7 implementer replaces app.html with the toggle snippet, the notification-panel inputs added in Task 3 are lost. Resilience wiring breaks, forcing rework.
- **Recommendation:** Add to Task 7 Step 5: "Preserve the notification-panel template block from Task 3; add toggle inputs to the existing notification-toggle element." Or show the merged app.html result.

---

## R1 Critical Findings Verification

All 5 R1 critical findings are **RESOLVED**:

| Finding | Status | Evidence |
|---------|--------|----------|
| E2E hook argument type mismatch | RESOLVED | `coerceHubConnectionState()` (Task 3 Step 3, lines 473-484) accepts enum values and member names; unit test at lines 419-428 |
| Backend fixture class missing | RESOLVED | Task 4 uses `IClassFixture<WebApplicationFactory<Program>>` (line 629) |
| Backend test auth headers unrecognized | RESOLVED | Task 4 uses `TestAuthHandler` + `TestUserContext` via `ConfigureTestServices` (lines 700-716) |
| Roving tabindex starts with no tabbable item | RESOLVED | `firstVisibleNotificationId()` and `rovingNotificationId()` (lines 1121-1123); template uses conditional tabindex |
| Production grep path mismatch | RESOLVED | All grep commands target `dist/apps/portal-web/browser` (Task 3 Step 6, Task 9 Step 1, Task 10 Step 4) |

---

## Significant Findings

### Focus/Accessibility (frontend, architect, testing)

**2. Mark All Read focus destination unspecified [frontend]**
- **Confidence:** 9
- **Evidence:** Task 6 Step 4 has `<button (click)="onMarkAllRead()">` but no implementation, no focus destination specified, no test. R1 finding not addressed.
- **Impact:** Keyboard workflow breaks after marking all read; focus goes to unpredictable location.
- **Recommendation:** Add `onMarkAllRead()` implementation specifying focus destination: first notification if any remain, close button if empty.

**3. Focus trap behavioral verification missing [frontend, testing]**
- **Confidence:** 8
- **Evidence:** Task 6 imports `cdkTrapFocus` but no test verifies Tab cycles within dialog or that focus cannot escape. E2E accessibility test (Task 8) doesn't verify trap containment.
- **Impact:** Focus trap bugs go undetected; keyboard users could Tab out of modal.
- **Recommendation:** Add E2E test: open panel, press Tab 10+ times, verify focus stays within dialog.

**4. Close/overlay click focus destinations unspecified [frontend]**
- **Confidence:** 7
- **Evidence:** Escape E2E test verifies focus returns to toggle. Overlay click and close button click have no focus verification.
- **Impact:** Focus may not return to toggle after click-close; keyboard workflow breaks.
- **Recommendation:** Add unit/E2E tests verifying focus destination after overlay click and close button click.

**5. Focus resolution after mutation incomplete [architect]**
- **Confidence:** 9
- **Evidence:** Spec lines 359-378 define `resolveFocusAfterMutation()` decision tree. Task 6 Step 4 has simplified `onFilterClick()` that only sets `focusedNotificationId = first?.id`. Missing: hydration mutation focus recovery, previous item fallback, close button fallback.
- **Impact:** Focus jumps to wrong item or strands on removed element during list mutations.
- **Recommendation:** Add full clamp decision tree tracking `previousIndex`; apply after filteredNotifications changes.

**6. Scroll preservation during prepend missing [architect]**
- **Confidence:** 9
- **Evidence:** Spec lines 385-413 define `preserveScrollDuringPrepend()` with `afterNextRender()` timing. Plan modifies scroll container structure but no scroll preservation logic.
- **Impact:** Rehydration prepends cause scroll position jumps; focused notification scrolls out of view.
- **Recommendation:** Add scroll preservation to Task 5 or Task 6 using spec's decision tree.

### Testing Coverage Gaps (testing, security)

**7. forceRetry auth boundary test missing [testing]**
- **Confidence:** 9
- **Evidence:** Task 2 tests throttling but no test verifies `forceRetry` skips when user context is null/undefined (implementation at lines 292-307 checks this).
- **Impact:** Auth boundary regression could trigger unexpected HTTP calls.
- **Recommendation:** Add unit test: `it('forceRetry skips when user context is missing', ...)`

**8. Backend negative tests incomplete [testing, security]**
- **Confidence:** 9
- **Evidence:** Task 4 has one negative test (bypass headers). Missing: unauthenticated request → 401, non-admin role → 403, wrong gateway secret.
- **Impact:** Authorization regression could allow unauthorized access without test detection.
- **Recommendation:** Add tests: `Recent_Returns401WhenUnauthenticated`, `Recent_Returns403ForNonAdminRole`.

**9. Simultaneous recovery/throttle state test missing [testing]**
- **Confidence:** 8
- **Evidence:** Plan specifies `forceRetryNotice` and `isRetryThrottled` may coexist. No test covers simultaneous activation or aria-disabled UI behavior.
- **Impact:** Simultaneous state rendering could regress.
- **Recommendation:** Add unit/E2E test for simultaneous recovery/throttle state.

### Spec Requirements Missing from Plan (architect)

**10. Search-to-empty transition missing [architect]**
- **Confidence:** 9
- **Evidence:** Spec line 233 requires `wasSearchMatchBeforeHydrate` state for search-specific empty copy. Plan has no implementation.
- **Impact:** Generic empty state shown instead of informative search-specific message after reconnect.
- **Recommendation:** Add `wasSearchMatchBeforeHydrate` state tracking; update empty state template.

**11. Skeleton timing missing [architect]**
- **Confidence:** 9
- **Evidence:** Spec lines 609-610 require 300ms threshold before showing skeleton and 300ms min-display. Plan has skeleton markup but no timing logic.
- **Impact:** Skeleton flashes for fast loads; disappears prematurely for medium-speed loads.
- **Recommendation:** Add threshold/min-display timers to Task 5.

### Integration/Operations (integration, operations)

**12. project.json merge guidance incomplete [integration]**
- **Confidence:** 8
- **Evidence:** Task 1 Step 2 says "Keep existing build options" but snippet shows fileReplacements without merged result. Production has budgets/outputHashing; development has sourceMap/optimization.
- **Impact:** Implementer could lose existing config options.
- **Recommendation:** Show merged configurations explicitly with preserved options.

**13. No rollback documentation [operations]**
- **Confidence:** 9
- **Evidence:** Plan introduces environment files, fileReplacements, test hook, panel connection state, force retry. No revert procedure documented.
- **Impact:** Operators must improvise rollback if Sprint 4 introduces production bug.
- **Recommendation:** Add rollback section: revert commit series, remove fileReplacements if problematic, grep check fails CI so revert is path.

**14. fileReplacements silent failure risk [operations]**
- **Confidence:** 8
- **Evidence:** Angular fileReplacements use base file if replacement path is wrong, without error. Plan has no verification that environment values are correct in output.
- **Impact:** Production could silently get `enableE2eConnectionHook: true` from base file if replacement fails.
- **Recommendation:** Add verification: `rg "enableE2eConnectionHook:\s*false" dist/apps/portal-web/browser` for production.

**15. Force retry throttle lacks observability [operations]**
- **Confidence:** 7
- **Evidence:** Task 2 has `console.warn` when limit hit (browser console only). No metric/log/alerting.
- **Impact:** Operators have no signal when users repeatedly hit limit; first signal is user tickets.
- **Recommendation:** Accept as non-blocking; document that observability for this throttle is deferred.

---

## Minor Findings

### Architect
- Test hook cleanup on destroy missing (single App instance assumed)
- forceRetry subscription not tracked in DestroyRef
- SignalR initial state briefly shows disconnected

### Frontend
- Arrow key navigation not tested
- cdkFocusInitial conditional intent unclear

### Testing
- Simultaneous state UI unit test missing
- Test hook override clearing behavior unclear
- Resilience E2E doesn't verify notification content

### Integration
- Constructor/ngOnInit timing note missing (minor confusion)
- TestAuthHandler/TestUserContext assumption verified (no issue)
- Barrel export for types verified (no issue)

### Security
- console.warn leaks rate limit threshold
- Force retry limit higher than normal retry (document rationale)
- E2E route header injection is test-only (note in docs)
- Test hook global exposure is properly gated (no issue)

### Operations
- CI-only hook verification allows local bypass (repo deploy uses CI artifacts)
- Tenant isolation uses mock auth (acceptable for integration-level)
- Connection subscription persists across auth boundary (correct design)

---

## Questions For Human

1. **Skeleton timing complexity:** Should skeleton threshold/min-display be deferred to implementation polish, or is it blocking for Sprint 4 UX quality?

2. **Search-to-empty transition:** Is `wasSearchMatchBeforeHydrate` a blocking requirement or acceptable UX gap for this sprint?

---

## Conflicts

None identified. Reviewers converged on similar concerns (focus management gaps, testing coverage, spec requirements) without disagreement.

---

## Accepted Risks And Deferred Concerns

| Concern | Disposition | Reason |
|---------|-------------|--------|
| Skeleton timing | DEFERRED_TO_IMPLEMENTATION | UX polish; not blocking core functionality |
| Search-to-empty transition | ADVISORY | UX edge case; recommend but not blocking |
| Focus trap behavioral E2E | DEFERRED_TO_IMPLEMENTATION | CDK directive is reliable; implementer should add |
| Mark All Read focus destination | SIGNIFICANT | Needs resolution before implementation |
| Scroll preservation | SIGNIFICANT | Needs resolution before implementation |
| Focus mutation clamp | SIGNIFICANT | Needs resolution before implementation |
| Force retry observability | ACCEPTED_RISK | Browser-console-only is acceptable for POC scope |
| fileReplacements silent failure | SIGNIFICANT | Needs verification step |
| Rollback documentation | SIGNIFICANT | Recommend adding but not blocking |

---

## Recommended Decision

**REVISE_PLAN**

1 critical blocker and 14 significant findings require resolution before implementation:

### Critical (must fix):
1. Task 7 Step 5 app.html overwrite risk — add explicit preservation instruction

### Significant (recommend fixing):
- Focus management: Mark All Read focus, close/overlay focus verification, focus mutation clamp, scroll preservation
- Testing: forceRetry auth boundary test, backend negative tests, focus trap E2E, simultaneous state test
- Spec requirements: Skeleton timing, search-to-empty transition
- Integration/Operations: project.json merge guidance, rollback documentation, fileReplacements verification

After critical fix, the plan is implementation-ready. Significant findings provide valuable guidance — incorporate as implementation notes or address where feasible.

---

## Implementation Guidance for Critical Fix

### Fix 1: Task 7 app.html Overwrite Prevention
Add to Task 7 Step 5:
```markdown
Preserve the notification-panel template block from Task 3. Modify ONLY the notification-toggle element:

<tai-notification-toggle
  [unreadCount]="notificationStore.unreadCount()"
  [isOpen]="notificationPanelService.isOpen()()"
  [connectionState]="notificationPanelConnectionState()"
  (toggled)="notificationPanelService.toggle()">
</tai-notification-toggle>

<tai-notification-panel ...existing inputs from Task 3...>
</tai-notification-panel>
```

Or show merged app.html after both Task 3 and Task 7 changes.