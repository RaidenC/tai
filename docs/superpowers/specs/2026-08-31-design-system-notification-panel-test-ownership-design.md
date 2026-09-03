# Design-System NotificationPanel Test Ownership

**Date:** 2026-08-31

## Goal

Make NotificationPanel tests reflect the public-contract rule: Storybook owns consumer-visible rendered behavior, while Vitest owns service state and non-rendered logic.

## Scope

This slice covers:

- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.ts`
- a new focused service spec next to the service

The existing Angular, Storybook, `@storybook/test`, addon-interactions, test-runner, and Vitest architecture remains unchanged.

## Testing Contract

Storybook owns behavior a consumer can observe through the panel:

- open and closed states, dialog semantics, and focus capture
- severity filtering and search filtering
- loading, reconnecting, disconnected, error, recovery, and empty states
- retry, close, mark-read, mark-all-read, and acknowledge interactions
- output payloads for `retry`, `markRead`, `markAllRead`, and `acknowledge`
- Escape behavior, roving focus, focus restoration, and live-region announcements
- read/unread and acknowledged/unacknowledged lifecycle rendering
- visible timestamp formatting and safe text rendering

Stories should reuse the existing state stories. Add `play()` only where a state needs interaction or assertions. Output assertions must use `fn()` spies and verify the emitted payload.

Vitest owns:

- `NotificationPanelService` signal transitions and deprecated unread-count compatibility behavior
- timer mechanics for the initial skeleton delay and minimum display duration, where deterministic fake-timer testing is more valuable than browser timing
- narrowly scoped non-rendered helpers only when they cannot be tested through a meaningful rendered story

The component spec should remove duplicate rendered DOM and interaction tests after equivalent Storybook coverage exists. It may retain timer-focused tests if the implementation still owns those timers.

## Story Design

Use the existing `withPanelState()` decorator and existing stories as the fixtures. Strengthen them with semantic queries and shared `fn()` output spies:

- `PanelOpen`: assert dialog, heading, search field, filter group, and initial focus.
- `FilteredByCritical`: assert only critical notifications and `aria-pressed` state.
- `WithSearchFilter`: assert matching content and non-matching content absence.
- `EmptyState` and `EmptyAfterHydration`: assert the correct empty copy and polite status semantics.
- `Loading`, `Reconnecting`, `Disconnected`, and `ErrorWithRetry`: assert the visible status, retry availability, and disabled/throttled behavior.
- `LifecycleStates`: interact with mark-read, acknowledge, and mark-all-read controls and verify output payloads and state-visible affordances.
- a focused interaction story, or an extension of `PanelOpen`, should cover filter clicks, search input, Escape, overlay/close behavior, and keyboard focus movement.

Stories must not rely on console logging or direct component method calls. The test should drive the public DOM. The service instance used by a story must be isolated per story so filter/search/open state cannot leak between stories.

## Component Composition

This testing slice does not replace native controls with atoms automatically. `NotificationPanel` uses a dialog, search field, severity filter group, status banners, and lifecycle actions with compact and selected states. Before changing markup, compare those requirements with the current `tai-button`, `tai-input`, and `tai-icon` APIs. A separate composition change is warranted only where the atom preserves the required semantics, ARIA state, sizing, and output behavior.

The current inline close icon remains unchanged unless an existing design-system icon supports the same meaning. No test should assert implementation-specific class names when an accessible role, label, or visible state is available.

## Acceptance Criteria

- Every existing NotificationPanel story has meaningful state assertions or is intentionally a visual-only state story with coverage supplied by a related interaction story.
- No `play()` function succeeds only by logging to the console.
- User-visible filtering, search, lifecycle, retry, close, keyboard, and focus behavior is covered in Storybook.
- Vitest retains only service/timer/non-rendered coverage and has a focused service spec.
- No public behavior is removed and no test is weakened to reduce test count.
- Existing Storybook accessibility checks continue to pass.

## Verification

Run from the design-system organism-test-hardening worktree:

```bash
npx nx run design-system:lint --skip-nx-cache
npx nx run design-system:test --skip-nx-cache
npx nx run design-system:build-storybook --skip-nx-cache
npx test-storybook --url http://127.0.0.1:<port> --config-dir libs/ui/design-system/.storybook --testTimeout 30000
git diff --check
```

Acceptance requires zero new lint errors, all relevant Vitest tests passing, the Storybook build and runner passing all discovered stories, and no accessibility violations.
