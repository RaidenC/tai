---
big_plan: inline
phase_plan: docs/superpowers/plans/2026-05-15-notification-center-sprint-4-resilience-accessibility-e2e-plan.md
phase_id: sprint-4
generated_at: 2026-05-14T19:15:00Z
big_plan_hash: inline
phase_plan_hash: a0cdfbd6560a792b4ac2154d0076629302d574005643ea104a03c3c48b0c7cd5
big_picture_source: inline
---

# Phase Review Packet: sprint-4 (Implementation Plan R3)

## Overall Feature Goal

Build a production-quality notification center for admin workstations:
- Sprint 1: Notification Data Foundation
- Sprint 2: Durable Recent Events + Refresh Recovery
- Sprint 3: Read/Unread + Acknowledgement UX
- Sprint 4: Resilience, Accessibility, and E2E Polish

## Big Picture Source

Inline text from user command.

## Current Phase Goal

Deliver resilient reconnect recovery, accessible notification-panel keyboard behavior, production-gated E2E hooks, and end-to-end coverage.

## Current Phase Scope

From sprint 4 implementation plan (R3 revision):
- Angular environment build gate (Task 1)
- NotificationHistoryService force retry API with throttle limits (Task 2)
- App connection adapter with SignalR state mapping and reconnect RxJS stream (Task 3)
- Backend recent audit authorization tests including negative cases (Task 4)
- Panel state, banner, loading with skeleton timing, search-to-empty (Task 5)
- Panel focus trap and keyboard model with mutation clamp, scroll preservation (Task 6)
- Toggle indicator and app wiring preserving Task 3 panel bindings (Task 7)
- E2E notification resilience, edge states, accessibility with focus trap test (Task 8)
- CI production hook verification (Task 9)
- Rollback plan and full verification (Task 10)

## R2 Critical Finding Resolution

**Critical finding #1 (Task 7 app.html overwrite): RESOLVED**
- Task 7 Step 5 now explicitly preserves the `tai-notification-panel` block
- Shows merged app.html with both toggle and panel elements

## R2 Significant Findings Resolution

All 14 R2 significant findings addressed in Panel Review R2 Response section:

| Finding | Resolution |
|---------|------------|
| Mark All Read focus destination | Task 6 Step 4 adds `onMarkAllRead()` with focus movement |
| Focus trap behavioral verification | Task 8 Step 4 adds Tab containment E2E test |
| Close/overlay focus destinations | Task 8 Step 4 tests close button, overlay click, Escape focus restoration |
| Focus mutation clamp | Task 6 Step 4 adds `resolveFocusAfterMutation()` decision tree |
| Scroll preservation | Task 6 Step 4 adds `preserveScrollDuringPrepend()` with `afterNextRender()` |
| forceRetry auth boundary test | Task 2 Step 1 adds missing-user-context skip test |
| Backend negative tests | Task 4 Step 1 adds 401, 403, wrong-secret cases |
| Simultaneous recovery/throttle | Task 5 Step 1 adds one-retry-button aria-disabled test |
| Search-to-empty transition | Task 5 adds `wasSearchMatchBeforeHydrate` state and search-specific empty copy |
| Skeleton timing | Task 5 adds 300ms threshold/min-display timer logic |
| project.json merge guidance | Task 1 Step 2 shows merged configuration preserving existing options |
| Rollback documentation | Added rollback section before Task 10 |
| fileReplacements verification | Task 1 Step 4 and Task 10 Step 4 grep environment values |
| Force retry observability | Accepted as POC scope; console.warn kept, telemetry deferred |

## Explicitly Deferred Work

None stated. Sprint 4 is final sprint.

## Dependency Contract

Same as prior packets — no new obligations.

## Review Rule

R3 is convergence gate: check prior blockers, do not raise new significant findings. Convert remaining non-blockers to accepted/deferred status.

## Current Phase Plan

[Full plan: docs/superpowers/plans/2026-05-15-notification-center-sprint-4-resilience-accessibility-e2e-plan.md]

Panel Review R2 Response section (lines 51-76) documents all significant finding resolutions.