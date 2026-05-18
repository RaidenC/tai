# Panel Review of Sprint 4 (R6): Exception Gate — Final Verification

**Executive summary:** 0 critical, 0 unresolved blockers, 0 questions.

**Review round:** R6 exception gate — focused verification of R5 critical findings only. No broad review reopened.

---

## R5 Critical Findings Verification

### 1. Focus Order vs. DOM Order [frontend] — RESOLVED

**R5 Finding:** Spec stated focus order (search → filters → Mark All Read → items → close) but DOM had header-actions (Mark All Read/Close) before search-box. `cdkTrapFocusAutoCapture` would focus wrong element.

**Fix Verification:**

| Criterion | Evidence | Status |
|-----------|----------|--------|
| DOM restructuring required | Line 338: "DOM order must match the notifications-present Tab order: search input, filter group, Mark All Read, list items, close button" | PASS |
| Conditional cdkFocusInitial specified | Line 317: "add conditional `cdkFocusInitial` to the search input when notifications are visible" | PASS |
| Empty state handling | Line 339: "For the empty state, render or order the close button before search/filter controls so `cdkTrapFocusAutoCapture` and Tab order both start at close" | PASS |
| Task scoping explicit | Task 8 line 718: "Reorder panel focusable DOM to match the documented Tab order" | PASS |

**Implementation guidance:** Complete and actionable. No regressions identified.

---

### 2. Backend Authorization Test Assertion [testing, security] — RESOLVED

**R5 Finding:** Test allowed two outcomes: "403/404 OR tenant B rows not returned" — could mask security regression.

**Fix Verification:**

| Criterion | Evidence | Status |
|-----------|----------|--------|
| Single outcome per test | Lines 255-258: three explicit tests, each with one expected outcome | PASS |
| Tenant mechanism documented | Line 257: "This repo resolves tenant context from the request host through `TenantResolutionMiddleware`" | PASS |
| Cross-tenant isolation | Test 1: TAI-only rows via `Host: localhost`; Test 2: ACME-only rows via `Host: acme.localhost` | PASS |
| Bypass header rejection | Test 3: `X-Bypass-Tenant` and `X-Tenant-Id` headers ignored, assert TAI-only rows | PASS |
| Test file path explicit | `apps/portal-api.integration-tests/AuditLogsRecentAuthorizationTests.cs` | PASS |

**Security coverage:** The ambiguous escape hatch is eliminated. If tenant B rows leak via bypass headers, Test 3 fails.

**Implementation guidance:** Complete and actionable. No regressions identified.

---

### 3. Task Ordering Circular Dependency [integration] — RESOLVED

**R5 Finding:** Task 5 required passing toggle inputs (isOpen, connectionState) that Task 10 created. Circular dependency in sequential order.

**Fix Verification:**

| Task | Before (R5) | After (R6) | Status |
|------|-------------|------------|--------|
| Task 5 | "Pass panel open state and connection state to the notification toggle" | "Pass notificationPanelConnectionState() to the panel" (lines 694-700) | PASS |
| Task 10 | Creates toggle inputs | "Add isOpen and connectionState inputs to the toggle component" + "Wire App template to pass panel open state and notification connection state to the toggle after these inputs exist" (lines 741-746) | PASS |

**Dependency analysis:**

- Task 4 creates panel inputs → Task 5 can pass values to panel (correct order)
- Task 10 is self-contained: creates inputs AND wires them (no dependency on earlier tasks)
- No circular dependency remains

**Implementation guidance:** Complete and actionable. No regressions identified.

---

## R5 Significant Findings Status

The R5 report identified 8 significant findings. The revised spec addresses all of them with explicit guidance:

| Finding | Spec Resolution | Status |
|---------|-----------------|--------|
| Retry throttle Maps separation | Line 209: "Add a separate `forceRetryAttemptsByTenant` Map" | RESOLVED |
| Retry counter clearing location | Line 221: "Clear retry counters inside `applyHydrationRows()` after the store update succeeds" | RESOLVED |
| Search-to-empty detection | Line 233: "Track `wasSearchMatchBeforeHydrate` when a non-empty query matches cached items" | RESOLVED |
| Reconnect loading differentiation | Lines 230-232: derive `showInitialSkeleton` and `isReconnectSyncing` | RESOLVED |
| Sticky status area scroll container | Line 237: `.notification-scroll-region` with `flex: 1; overflow-y: auto` | RESOLVED |
| Banner + empty state hierarchy | Line 202: "Hide the Connected banner when the visible list is empty" | RESOLVED |
| Error banner hierarchy | Line 201: "Hide the reconnecting banner while a rehydration error is visible" | RESOLVED |
| Debounce disconnect edge case | Lines 89-90: `withLatestFrom()` + recheck filter for Connected state | RESOLVED |
| Filter focus behavior | Line 358: "Filter button click keeps DOM focus on the activated filter button" | RESOLVED |

All significant findings have explicit implementation guidance in the revised spec.

---

## New Blockers Introduced by Revision

**None identified.** The revision addresses R5 findings without introducing new critical issues.

---

## Accepted Risks And Deferred Concerns

| Concern | Disposition | Reason |
|---------|-------------|--------|
| 1000+ events during disconnect could show duplicates | ACCEPTED_RISK | Documented POC limitation (line 245); idempotency cache FIFO eviction edge case |
| Server-side rate limiting for `/api/AuditLogs/recent` | DEFERRED_POST_SPRINT4 | Deferred hardening (line 258); client-side bounds documented |
| WebSocket reconnect session refresh | DEFERRED_POST_SPRINT4 | Deferred hardening (line 267); authenticated HTTP rehydration documented |
| Native disabled Mark All Read focus behavior | ACCEPTED_RISK | Spec correctly handles disabled state focus (lines 420-421) |

---

## Recommended Decision

**GREENLIGHT**

All R5 critical findings are resolved. No new blockers introduced. All R5 significant findings have explicit implementation guidance. The spec is implementation-ready.

---

## Prior Findings Verified as Resolved

R5 findings verified as resolved in this round:

- **Focus order vs. DOM order mismatch (R5 Critical #1)**: RESOLVED. DOM restructuring required, conditional cdkFocusInitial specified, empty state handling documented (lines 337-339, 718).
- **Backend authorization test assertion ambiguous (R5 Critical #2)**: RESOLVED. Exact host-based assertions, tenant mechanism documented, bypass header test explicit (lines 254-258).
- **Task ordering circular dependency (R5 Critical #3)**: RESOLVED. Task 5 passes to panel only, Task 10 self-contained (lines 694-700, 741-746).

R4 findings verified as resolved in R5 (unchanged):

- Effect mutation timing race condition → RxJS observable chain with debounce (lines 81-91)
- Backend authorization test requirement → explicit test file (lines 254-258)
- Scroll preservation timing → afterNextRender() (lines 382-414)
- Force retry timestamp cleanup → documented (lines 210-216)

---

## Implementation Clearance

The sprint 4 spec is cleared for implementation. Proceed with the 14-task sequence:

1. Task 1: Angular Environment Build Gate
2. Task 2: NotificationHistoryService Resilience API
3. Task 3: Connection State Signal Adapter + Rehydration Trigger
4. Task 4: UI-Local Connection State Types and Storybook Contract
5. Task 5: App Wiring (panel inputs only)
6. Task 6: Panel Connection Banner
7. Task 7: Focus Trap Wrapper
8. Task 8: Keyboard Navigation and Focus Recovery
9. Task 9: Visual Polish and Responsive Behavior
10. Task 10: Toggle ARIA Completeness
11. Task 11: E2E Connection Resilience
12. Task 12: E2E Edge States
13. Task 13: E2E Accessibility
14. Task 14: Full Verification