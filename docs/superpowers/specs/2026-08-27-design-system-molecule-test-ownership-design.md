# Design-System Molecule Test Ownership

**Date:** 2026-08-27

## Goal

Make the design-system molecule tests reflect a clear contract: Storybook tests consumer-visible rendered behavior, while Vitest tests retain only non-rendered logic and architectural boundaries.

## Scope

The work covers the molecules under `libs/ui/design-system/src/lib/molecules`:

- confirmation-dialog
- confirmation-panel
- crypto-unavailable
- dropdown-menu
- form-field
- notification-toggle
- pending-approvals-tile
- security-alert
- toast

The existing Angular, Storybook, `@storybook/test`, addon-interactions, test-runner, and Vitest architecture remains unchanged.

## Testing Contract

Storybook owns:

- input and signal-input state rendered in the DOM
- visible text and content
- loading, disabled, empty, error, warning, danger, hidden, and connection states
- user clicks and keyboard interaction
- focus restoration and keyboard focus movement
- output events caused by user interaction
- ARIA roles, labels, relationships, and live-region behavior
- consumer-visible text escaping and other security behavior

Vitest owns:

- services and their state transformations
- pure algorithms or calculations
- non-rendered state transformations
- explicit architectural boundary checks that are not useful through a rendered story

Tests should use semantic queries such as `getByRole` and `getByLabelText` where possible. `data-testid` remains appropriate for stable component hooks that do not have a useful accessible name. Output assertions use Storybook `fn()` spies and verify the payload, not merely that a control remained in the DOM.

## Atom Composition

When a molecule renders a control already represented by a design-system atom, it should use that atom so the story exercises the same public composition used by consumers:

- use `tai-button` for button behavior when the atom supports the required semantics and state
- use `tai-icon` for design-system icons
- use `tai-label` for form labels
- use `tai-input` for form controls in form-field stories and other suitable composed examples

Native elements remain appropriate when the molecule requires semantics or behavior not provided by an atom, such as table structure, dialog structure, or projected content. Atom composition must not weaken the molecule's accessibility or change its public API without a separate design decision.

## Component Design

### ConfirmationPanel

Extend existing stories for default, danger, long text, loading, disabled actions, fallback text, security text, accessibility, initial-focus configuration, and interaction. Assert visible labels, disabled state, loading text, safe text rendering, dialog relationships, and `actionSelected` payloads. Move rendered behavior out of the Vitest spec. Retain only the source-level dependency boundary assertion if it is still valuable.

### ConfirmationDialog

Keep the deprecated compatibility story and add rendered assertions for legacy title/message/button mapping plus `DialogRef.close(true)` and `DialogRef.close(false)` when the corresponding controls are activated. Remove duplicate DOM assertions from Vitest; an adapter-level unit test is only retained if it verifies behavior that cannot be expressed through the story.

### CryptoUnavailable

Strengthen the default and custom-message stories with semantic alert and assertive live-region assertions. Remove the component-only Vitest spec because it contains only rendered behavior.

### DropdownMenu

Extend stories to cover opening and closing, selection payloads, disabled items, text escaping, Escape, outside-click closing, focus restoration, arrow/Home/End navigation, density, placement, and mobile mode. Move these rendered interaction tests out of Vitest. Keep no duplicate component spec unless non-rendered logic is introduced.

### FormField

Extend stories to cover label/control association, required marker, hint and error visibility, error live-region semantics, safe text rendering, empty-state absence, and projected control content. Move the current rendered Vitest coverage into stories. The existing `describedBy` projection/association concern is explicitly a follow-up design item; this work should not silently invent a new projected-control API.

### NotificationToggle

Keep Storybook as the only behavior test location. Preserve coverage for unread counts, open state, connection states, ARIA labels, indicators, user interaction, and placement. Add missing placement cases if all four placement values remain public, and assert the output through the story's spy.

### PendingApprovalsTile

Extend the existing stories with semantic visibility checks, empty-state checks, and an `approved` output assertion containing the selected user ID. Remove the duplicate Vitest rendering and click tests.

### SecurityAlert

Replace the placeholder unit test with Storybook assertions for warning/info rendering, alert semantics, hidden state, dismiss button semantics, and the `dismissed` output. Remove the placeholder Vitest spec.

### Toast

Keep `ToastService` tests in Vitest, including severity defaults, timestamps, replacement, and hide behavior. Move component rendering, severity classes, and dismissal behavior into Storybook, including an empty story. Remove dead `getSeverityClass()` coverage if the method has no consumer after the migration. Add or preserve semantic assertions for the toast message and dismiss control without changing the service architecture.

## Non-Goals

- no Storybook or Vitest upgrade
- no replacement of TestBed, Storybook test-runner, or CI architecture
- no broad redesign of molecule APIs
- no automatic queueing change for `ToastService`
- no implementation of the FormField projected-control `aria-describedby` association in this change
- no unrelated cleanup of existing lint warnings

## Verification

Run from the design-system test-hardening worktree:

```bash
npx nx run design-system:lint --skip-nx-cache
npx nx run design-system:test --skip-nx-cache
npx nx run design-system:test-storybook --skip-nx-cache
git diff --check
```

Acceptance requires zero lint errors, all relevant Vitest tests passing, the Storybook build and runner passing all discovered stories, and no reduction in coverage of the listed public behaviors.
