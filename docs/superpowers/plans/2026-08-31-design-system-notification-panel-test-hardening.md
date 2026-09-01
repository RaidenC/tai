# Design-System NotificationPanel Test Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move NotificationPanel consumer-visible behavior into Storybook and retain only service and deterministic timer mechanics in Vitest.

**Architecture:** Keep `NotificationPanelComponent` and its public API unchanged. Use isolated Storybook provider state plus `fn()` output spies to exercise the panel through its rendered DOM. Keep `NotificationPanelService` state transitions in a focused service spec and retain only the component’s deterministic skeleton timer test in the component spec.

**Tech Stack:** Angular 21, Storybook 8.6, `@storybook/angular`, `@storybook/test`, `@storybook/test-runner`, Angular CDK A11y, Vitest, Nx, Tailwind CSS.

---

### Task 1: Add NotificationPanelService unit coverage

**Files:**

- Create: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.spec.ts`
- Test: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.spec.ts`

- [ ] **Step 1: Write the service tests**

Cover the non-rendered signal contract with a fresh service per test:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { NotificationPanelService } from './notification-panel.service';

describe('NotificationPanelService', () => {
  let service: NotificationPanelService;

  beforeEach(() => {
    service = new NotificationPanelService();
  });

  it('starts closed with default filters and no unread count', () => {
    expect(service.isOpen()).toBe(false);
    expect(service.unreadCount()).toBe(0);
    expect(service.severityFilter()).toBe('all');
    expect(service.searchText()).toBe('');
  });

  it('opens, closes, and toggles the panel', () => {
    service.open();
    expect(service.isOpen()).toBe(true);

    service.toggle();
    expect(service.isOpen()).toBe(false);

    service.toggle();
    expect(service.isOpen()).toBe(true);

    service.close();
    expect(service.isOpen()).toBe(false);
  });

  it('stores severity and search state', () => {
    service.setSeverityFilter('critical');
    service.setSearchText('permission');

    expect(service.severityFilter()).toBe('critical');
    expect(service.searchText()).toBe('permission');
  });

  it('preserves deprecated unread-count compatibility behavior', () => {
    service.setUnreadCount(4);
    expect(service.unreadCount()).toBe(0);

    service.decrementUnread();
    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the focused service spec**

Run: `npx vitest run libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.spec.ts`

Expected: all service tests pass.

- [ ] **Step 3: Commit the focused service coverage**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.spec.ts
git commit -m "test: cover notification panel service state"
```

### Task 2: Wire Storybook output spies and strengthen the open-panel story

**Files:**

- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts:1-155`

- [ ] **Step 1: Add Storybook test imports and output spy types**

Import `expect`, `fn`, `userEvent`, `waitFor`, and `within` from `@storybook/test`. Define a reusable `NotificationEventSpies` type with `retry`, `markRead`, `markAllRead`, and `acknowledge` mocks, and a `createSpies()` factory that returns fresh `fn()` mocks.

- [ ] **Step 2: Bind outputs in the custom story render**

Change the render template so every story exercises the real public outputs:

```ts
render: (args) => ({
  props: args,
  imports: [CommonModule],
  template: `
    <tai-notification-panel
      [notifications]="notifications"
      [isLoading]="isLoading"
      [hasHydrated]="hasHydrated"
      [error]="error"
      [isRetryThrottled]="isRetryThrottled"
      [connectionState]="connectionState"
      [recoveryNotice]="recoveryNotice"
      (retry)="retry()"
      (markRead)="markRead($event)"
      (markAllRead)="markAllRead()"
      (acknowledge)="acknowledge($event)">
    </tai-notification-panel>
  `,
}),
```

Pass fresh spies through each interactive story’s `props`, or use a render helper that merges `args` and the story’s spies. Do not share mutable mock call history across stories.

- [ ] **Step 3: Replace the `PanelOpen` console log with semantic assertions**

Use `within(canvasElement)` and assert the dialog, heading, search field, filter group, four filter buttons, and initial focus. The story must not use `console.log` or direct component access.

- [ ] **Step 4: Run the focused Storybook story tests**

Build/serve Storybook as described in Task 7, then run the runner filtered to the notification panel story if the local runner supports the project’s existing filter options. Expected: `PanelOpen` passes without console output being used as an assertion.

- [ ] **Step 5: Commit the Storybook output wiring**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts
git commit -m "test: wire notification panel story outputs"
```

### Task 3: Add Storybook assertions for filtering, search, and empty states

**Files:**

- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts:160-213`

- [ ] **Step 1: Strengthen `FilteredByCritical`**

Assert that the notification list contains only critical items, the warning item is absent, the critical filter has `aria-pressed="true"`, and the other filter buttons are not selected.

- [ ] **Step 2: Strengthen `WithSearchFilter`**

Assert that the matching `Privilege Modified` notification is present and unrelated notification titles are absent. Assert the search input has the configured value.

- [ ] **Step 3: Strengthen `EmptyState` and `EmptyAfterHydration`**

Assert the empty-state status text and polite live-region semantics. Assert that a notification list role is absent when there are no visible notifications.

- [ ] **Step 4: Add an interactive filter/search story**

Extend `PanelOpen` or create a focused `FilterAndSearch` story that clicks the critical filter, types into the search input, verifies the visible result, then presses Escape and verifies the search is cleared while the panel remains open. Use `userEvent` and semantic queries.

- [ ] **Step 5: Commit the filter/search/empty coverage**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts
git commit -m "test: cover notification panel filtering and search"
```

### Task 4: Add Storybook assertions for loading, connection, error, and retry states

**Files:**

- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts:181-206,259-285`

- [ ] **Step 1: Strengthen `Loading` and `Reconnecting`**

Assert the loading story’s initial state and the reconnecting story’s `Syncing notifications...` polite status. Keep timer-dependent initial skeleton timing in Vitest rather than making the Storybook suite wait on real timeouts.

- [ ] **Step 2: Strengthen `Disconnected`**

Assert the offline status, retry button, retry accessibility state, and visible notification content. Bind a fresh `retry` spy and click the retry button to assert it was called once.

- [ ] **Step 3: Strengthen `ErrorWithRetry`**

Assert the assertive alert contains the error text, click retry, and verify the `retry` spy. Add a throttled variant if needed to cover `aria-disabled="true"` and the helper text.

- [ ] **Step 4: Strengthen the connected state**

Assert the healthy connected banner when visible notifications exist, and assert the healthy empty state does not show the connected banner.

- [ ] **Step 5: Commit the state and retry coverage**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts
git commit -m "test: cover notification panel connection states"
```

### Task 5: Add Storybook lifecycle and output interaction coverage

**Files:**

- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts:215-257`

- [ ] **Step 1: Strengthen `LifecycleStates` with semantic lifecycle assertions**

Assert read and unread labels, the unread marker, acknowledgement-required text, acknowledged text, and the expected presence/absence of action controls.

- [ ] **Step 2: Assert mark-read and acknowledge outputs**

Click the unread notification’s `Mark notification as read` button and assert `markRead` was called with `evt-unread`. Click the critical acknowledgement control and assert `acknowledge` was called with the relevant critical notification ID.

- [ ] **Step 3: Assert mark-all-read behavior**

Use a dedicated lifecycle story with unread notifications, click `Mark all notifications as read`, and assert the `markAllRead` spy. Add a read-only lifecycle story or state assertion that the control is disabled when all notifications are read.

- [ ] **Step 4: Add keyboard and focus behavior through the rendered DOM**

Use a focused story with at least two notifications. Assert search receives initial focus, use ArrowDown/ArrowUp/Home/End on the notification list, verify the intended item receives focus, press Escape to clear non-empty search before closing, and press Escape again to close the dialog. Verify close-button focus when the visible list becomes empty after a mutation where the behavior is observable.

- [ ] **Step 5: Commit the lifecycle and keyboard coverage**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts
git commit -m "test: cover notification panel lifecycle interactions"
```

### Task 6: Reduce the component spec to timer-only ownership

**Files:**

- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- Review: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts`

- [ ] **Step 1: Identify duplicate rendered tests**

Map the existing panel visibility, filter, search, empty, error, lifecycle, focus, helper-formatting, signal-shape, and direct output tests to the new Storybook coverage. Do not delete the timer test until its equivalent Storybook state is present.

- [ ] **Step 2: Keep only deterministic timer mechanics**

Retain a focused TestBed spec for the 300ms initial skeleton delay and 300ms minimum display duration using Vitest fake timers. Remove tests that assert DOM behavior, output behavior, implementation-specific class names, signal implementation details, or direct helper calls.

- [ ] **Step 3: Remove test-only component APIs if no longer needed**

After migrating focus behavior to Storybook, remove `focusedNotificationIdForTest`, `focusNotificationForTest`, `applyFocusAfterMutationForTest`, and `preserveScrollDuringPrependForTest` only if production code and remaining tests no longer reference them. Keep production focus behavior unchanged.

- [ ] **Step 4: Run the focused Vitest specs**

Run: `npx nx run design-system:test --skip-nx-cache`

Expected: the remaining component timer spec and new service spec pass, with no references to removed test-only methods.

- [ ] **Step 5: Commit the unit-test ownership cleanup**

```bash
git add libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.ts
git commit -m "test: move notification panel behavior to stories"
```

### Task 7: Run full verification and audit the final ownership boundary

**Files:**

- Review: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts`
- Review: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts`
- Review: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.spec.ts`

- [ ] **Step 1: Run formatting and static checks**

Run:

```bash
git diff --check
pnpm exec prettier --check libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.stories.ts libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.service.spec.ts
npx nx run design-system:lint --skip-nx-cache
```

Expected: no formatting errors, no lint errors, and only pre-existing warnings if any.

- [ ] **Step 2: Run all Vitest tests**

Run: `npx nx run design-system:test --skip-nx-cache`

Expected: all design-system unit test files pass.

- [ ] **Step 3: Build Storybook**

Run: `npx nx run design-system:build-storybook --skip-nx-cache`

Expected: the design-system Storybook static build completes successfully.

- [ ] **Step 4: Run the Storybook test runner against the built artifact**

Serve `dist/storybook/design-system` on port `6008` (use another available port if `6008` is occupied), then run:

```bash
npx http-server dist/storybook/design-system -p 6008 -c-1
npx test-storybook --url http://127.0.0.1:6008 --config-dir libs/ui/design-system/.storybook --testTimeout 30000
```

Expected: all discovered suites pass, including NotificationPanel, with no accessibility violations.

- [ ] **Step 5: Perform the final ownership audit**

Confirm that every public NotificationPanel behavior listed in the design spec has a Storybook assertion, service state has Vitest coverage, timer mechanics remain deterministic, no story relies on console logging, and no duplicate rendered tests remain in the component spec.

- [ ] **Step 6: Commit verification-only changes if needed**

```bash
git status --short
git diff --check
```

Commit only source/test changes from Tasks 1-6; do not commit generated `dist` output.
