# Panel Review of Sprint 4 Implementation Plan (R3 - Convergence Gate)

**Executive summary:** 0 critical, 0 significant, 0 unresolved blockers. GREENLIGHT.

**Review round:** R3 — convergence gate after R2 revision. Verified named blockers, did not raise new findings.

---

## R2 Critical Finding Verification

| Finding | Status | Evidence |
|---------|--------|----------|
| Task 7 app.html overwrite risk | RESOLVED | Task 7 Step 5 (lines 1766-1790) explicitly preserves Task 3's panel block and shows merged template |

---

## R2 Significant Findings Verification

### Focus/Accessibility (5 findings)

| Finding | Status | Evidence |
|---------|--------|----------|
| Mark All Read focus destination | RESOLVED | Task 6 Step 4 (lines 1447-1461): `onMarkAllRead()` with `afterNextRender()` focus movement |
| Focus trap behavioral verification | RESOLVED | Task 8 Step 4 (lines 1937-1942): 12-iteration Tab containment loop |
| Close/overlay focus destinations | RESOLVED | Task 8 Step 4 (lines 1943-1959): close button, overlay click, Escape focus restoration tests |
| Focus mutation clamp | RESOLVED | Task 6 Step 4 (lines 1486-1500): `resolveFocusAfterMutation()` decision tree |
| Scroll preservation | RESOLVED | Task 6 Step 4 (lines 1522-1544): `preserveScrollDuringPrepend()` with `afterNextRender()` |

### Testing/Spec (5 findings)

| Finding | Status | Evidence |
|---------|--------|----------|
| forceRetry auth boundary test | RESOLVED | Task 2 Step 1 (lines 285-289): missing-user-context skip test |
| Backend negative tests | RESOLVED | Task 4 Step 1: `Recent_Returns401WhenUnauthenticated`, `Recent_Returns403ForNonAdminRole`, `Recent_Returns403WithWrongGatewaySecret` |
| Simultaneous recovery/throttle | RESOLVED | Task 5 Step 1 (lines 926-936): one retry button with aria-disabled test |
| Search-to-empty transition | RESOLVED | Task 5 Step 3: `wasSearchMatchBeforeHydrate` state; Task 5 Step 4: "No results for..." copy |
| Skeleton timing | RESOLVED | Task 5 Step 3 (lines 1049-1085): 300ms threshold/min-display timers |

### Integration/Operations (4 findings)

| Finding | Status | Evidence |
|---------|--------|----------|
| project.json merge guidance | RESOLVED | Task 1 Step 2 (lines 175-234): merged configs preserving existing options |
| Rollback documentation | RESOLVED | Rollback Plan section (lines 2032-2070): revert steps, fileReplacements removal, grep failure handling |
| fileReplacements verification | RESOLVED | Task 1 Step 4 + Task 10 Step 4: diagnostic grep for `enableE2eConnectionHook` values |
| Force retry observability | RESOLVED (ACCEPTED) | Panel Review R2 Response line 71: accepted as POC scope; Task 2 Step 3: non-sensitive console.warn |

---

## Accepted Risks And Deferred Concerns

| Concern | Disposition | Reason |
|---------|-------------|--------|
| Force retry observability | ACCEPTED_RISK | Browser-console-only is acceptable for POC scope; telemetry deferred post-Sprint 4 |
| Test hook global exposure | ACCEPTED_RISK | Properly gated by environment, validated by CI grep check |
| R1/R2 minor findings | ADVISORY | Non-blocking; addressed in implementation where feasible |

---

## Questions For Human

None. All blockers resolved, all prior findings have explicit dispositions.

---

## Conflicts

None. R3 verification converged without disagreement.

---

## Recommended Decision

**GREENLIGHT**

- All 1 R2 critical finding verified RESOLVED
- All 14 R2 significant findings verified RESOLVED (13 implemented, 1 accepted risk)
- No new blockers identified
- No unresolved current-phase concerns remain
- Plan is implementation-ready

---

## Implementation Readiness Checklist

Before implementation:
- [ ] Read the approved spec: `docs/superpowers/specs/2026-05-13-notification-center-sprint-4-resilience-accessibility-e2e-design.md`
- [ ] Read the approved plan: `docs/superpowers/plans/2026-05-15-notification-center-sprint-4-resilience-accessibility-e2e-plan.md`
- [ ] Use superpowers:subagent-driven-development or superpowers:executing-plans
- [ ] Task order: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10

Key implementation notes from panel review:
- Task 7 must preserve Task 3's panel bindings (explicitly documented)
- Skeleton timing uses 300ms threshold/min-display (blocking per spec)
- Search-to-empty transition uses `wasSearchMatchBeforeHydrate` (blocking per spec)
- Focus trap E2E verifies Tab containment (12-iteration loop)
- Backend tests cover 401/403/gateway-secret negative cases