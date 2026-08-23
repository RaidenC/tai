# Design-System Storybook Failure Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the existing design-system Storybook accessibility and CSP failures while preserving strict browser-test enforcement.

**Architecture:** Diagnose each failure at the rendered DOM boundary, then fix shared component markup/styles or story fixtures at the source. Static visual styling uses Tailwind utilities; keyframes remain in component SCSS; dynamic inline styles are removed or replaced with static classes. The existing Storybook runner remains the acceptance boundary.

**Tech Stack:** Angular 21, Nx 22, Storybook 8.6, Vitest, `@storybook/test-runner`, axe-playwright, Tailwind CSS v4.

---

### Task 1: Remove confirmed inline-style violations

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html`
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.scss`
- Modify: `libs/ui/design-system/src/lib/organisms/transfer-list/transfer-list.html`
- Test: existing component specs and Storybook stories

- [ ] Replace the NotificationPanel inline `animation` attribute with a static class and define the animation declaration in its component stylesheet.
- [ ] Remove the TransferList dynamic `view-transition-name` bindings because their runtime values necessarily create forbidden inline styles.
- [ ] Run the focused unit tests for NotificationPanel and TransferList.
- [ ] Run the Storybook gate and confirm the corresponding CSP failures disappear without changing the CSP runner.
- [ ] Commit the focused source changes.

### Task 2: Fix shared contrast and link semantics

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/user-profile/user-profile.component.html`
- Modify: `libs/ui/design-system/src/lib/organisms/registration-form/registration-form.html`
- Test: existing UserProfile and RegistrationForm specs/stories

- [ ] Replace the insufficient profile-initials color utility with a design-system color pairing that meets axe `color-contrast`.
- [ ] Change the Terms of Service link styling so it is distinguishable without relying on color alone while preserving keyboard focus visibility.
- [ ] Run focused unit tests and the Storybook gate.
- [ ] Commit the component changes.

### Task 3: Diagnose and repair DataTable and PendingApprovalsTile

**Files:**
- Modify only the source or story files identified by the rendered DOM diagnosis.
- Test: the affected component specs/stories

- [ ] Capture the exact inline-style element from the DataTable rendered DOM and identify whether it originates from a child component or CDK behavior.
- [ ] Capture the exact axe rule IDs and nodes for PendingApprovalsTile.
- [ ] Apply the smallest source-level fixes using Tailwind or component styles as appropriate.
- [ ] Run focused tests and the Storybook gate.
- [ ] Commit the fixes with the diagnosis recorded in the commit message.

### Task 4: Repair NotificationPanel accessibility failures

**Files:**
- Modify: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.component.html` and related source only if diagnosis requires it.
- Test: `libs/ui/design-system/src/lib/organisms/notification-panel/notification-panel.spec.ts` if a focused regression assertion is needed.

- [ ] Capture all unique axe rule IDs and nodes for NotificationPanel after the CSP fix.
- [ ] Correct the shared markup or color utilities causing those repeated failures.
- [ ] Run the focused unit suite and Storybook gate.
- [ ] Commit the repair.

### Task 5: Final verification and CI

**Files:**
- No planned source changes.

- [ ] Run `npx prettier --check` on all changed files.
- [ ] Run `npx nx run design-system:test --skip-nx-cache`.
- [ ] Run `npx nx run design-system:test-storybook --skip-nx-cache` and require zero failures.
- [ ] Verify port 6007 is closed after the target exits.
- [ ] Run `git diff --check origin/main...HEAD` and verify the worktree is clean.
- [ ] Push the branch and monitor PR #93 until the CI job completes.
