---
big_plan: notification-center-multi-sprint-roadmap
phase_plan: docs/superpowers/specs/2026-05-13-notification-center-sprint-4-resilience-accessibility-e2e-design.md
phase_id: sprint-4
generated_at: 2026-05-14T00:00:00Z
big_plan_hash: unknown
phase_plan_hash: 2f42a1ac7df9c385ad5e6f28b450da854922f804b7e0529ed9327cb1b9473a2d
---

# Phase Review Packet: sprint-4

## Overall Feature Goal

Build a production-quality notification center for admin workstations:
- Sprint 1: Notification Data Foundation — typed notification domain model, severity/category mapping, SignalR integration
- Sprint 2: Durable Recent Events + Refresh Recovery — REST hydration, idempotent merge, loading/empty/error states
- Sprint 3: Read/Unread + Acknowledgement UX — localStorage lifecycle persistence, badge counts, panel grouping
- Sprint 4: Resilience, Accessibility, and E2E Polish — connection state UI, focus trap, keyboard navigation, full e2e coverage

## Current Phase Goal

Make the notification center senior-level: resilient real-time UI, fully accessible, comprehensive e2e coverage.

## Current Phase Scope

From sprint 4 spec:
- Connection State UI: connection banner with three states, rehydration on reconnect, `forceRetry()` method
- Accessibility Focus Management: CDK FocusTrap, role="dialog", focus restoration, keyboard navigation (roving tabindex)
- E2E Coverage: connection resilience, edge states, accessibility tests with mock connection state
- Visual Polish: connection banner styling, skeleton loader, enhanced empty/error states, focus visible styles
- Test Infrastructure: build-gated test hook (`window.__testConnectionStateOverride__`)

## Explicitly Deferred Work

None stated. Sprint 4 is the final sprint in the roadmap.

## Dependency Contract

| Later Concern | Planned Phase | Current Phase Obligation |
|---|---:|---|
| Production notification persistence | Future | Current localStorage POC is acceptable for admin-workstation assumption; no backend notification tables added |
| Shared-device privacy hardening | Future | Sprint 3 persists tenant/user lifecycle across logout; acceptable for POC scope |
| Notification actions beyond read/ack | Future | Panel item structure should remain extensible for future action buttons |

## Review Rule

Do not flag deferred work as missing from this phase.

Flag deferred work only if the current phase:
1. Blocks it
2. Makes it materially harder
3. Contradicts the big plan
4. Creates current user/security/data/operational risk before it lands
5. Fails to preserve a required extension point or dependency

## Current Phase Plan

**Goal:** Make the notification center senior-level — resilient real-time UI, fully accessible, comprehensive e2e coverage.

**Architecture:** Extend existing sprint 3 foundation. Connection state flows from `RealTimeService.connectionStatus$` to App via `toSignal()`. App subscribes to status changes and triggers rehydration on reconnect (decoupled approach). Focus trap uses `@angular/cdk/a11y` FocusTrap directive on wrapper container. Keyboard navigation uses roving tabindex on list items.

**Tech Stack:** Angular standalone components, Angular signals, RxJS, `@angular/cdk/a11y`, Vitest, Nx, Playwright e2e.

### 1. Connection State UI

**Rehydration Trigger Architecture:**
- Use App subscription approach to avoid circular dependencies
- `RealTimeService` does NOT inject `NotificationHistoryService`
- `App` component subscribes to `connectionStatus$` observable
- When status transitions from `Reconnecting` to `Connected`, App calls `notificationHistoryService.forceRetry()`
- Debounce: 500ms to skip rapid oscillation

**Connection Banner:**
- Three states with WCAG-compliant contrast
- Connected: Green (#10B981), auto-dismiss after 5s
- Reconnecting: Dark amber (#D97706), persistent
- Disconnected: Red (#EF4444), persistent
- Uses role="status" and aria-live="polite"
- Reduced-motion media queries for animations

**Rehydration on Reconnect:**
- App calls `NotificationHistoryService.forceRetry()` on reconnect
- `forceRetry()` bypasses rate limit, skips if in-flight
- `isRetryThrottled` signal exposed for UI wiring
- `/api/AuditLogs/recent` lookback: 50 count-based, no time filter

### 2. Accessibility — Focus Management

**Focus Trap Architecture:**
- Refactor DOM to wrap overlay + panel in single container
- Use `@angular/cdk/a11y` FocusTrap directive
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Single Escape handler on container

**Keyboard Navigation:**
- Arrow Up/Down moves focus between list items (roving tabindex)
- Tab/Shift+Tab moves focus between buttons inside focused item
- Home/End moves focus to first/last item
- `focusedItemIndex` signal with clamp on mutation
- Focus restoration after actions

### 3. E2E Coverage

**WebSocket Mock Strategy:**
- Test hook: `window.__testConnectionStateOverride__(state)` gated by `environment.test`
- Build gating: webpack DefinePlugin in test builds, excluded from production
- Playwright uses page.evaluate() to set window.__TEST_ENV__ = true then call hook

**Connection Resilience Test:**
- Mock connection state via page.evaluate()
- Test flow: disconnect → create event → reconnect → verify rehydration

**Edge States Test:**
- Loading skeleton, empty state, error state + retry

**Accessibility Test:**
- Keyboard open/close, focus trap verification, arrow navigation, screen reader announcements

### 4. Visual Polish

- Connection banner styling (WCAG AA colors, reduced-motion)
- Skeleton loader (reduced-motion)
- Enhanced empty/error states
- Focus visible styles

## Implementation Order

1. Connection State Signal Adapter + Rehydration Trigger (App wiring)
2. NotificationHistoryService.forceRetry()
3. Test Infrastructure Build Gate
4. Connection Banner UI
5. Focus Trap Wrapper
6. Keyboard Navigation
7. Toggle ARIA Completeness
8. Visual Polish
9. App Wiring
10. E2E Connection Resilience
11. E2E Edge States
12. E2E Accessibility
13. Unit Tests
14. Full Verification

## Success Criteria

**Resume Angle:** "Delivered accessible, resilient real-time UI with reconnect recovery and end-to-end coverage."

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