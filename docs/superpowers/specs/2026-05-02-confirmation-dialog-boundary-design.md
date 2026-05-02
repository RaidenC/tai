# Confirmation Dialog Boundary Design

## Goal

Redesign the current `ConfirmationDialogComponent` boundary so the design system no longer depends on Angular CDK dialog/overlay primitives and no longer accepts arbitrary confirm-button CSS classes.

The reusable design-system layer should own the confirmation content, structure, semantics, and variants. Feature code should own how the confirmation UI is opened, layered, and wired into application flow.

## Problem

`libs/ui/design-system/src/lib/molecules/confirmation-dialog/confirmation-dialog.ts` currently mixes presentation with modal infrastructure:

- It injects `DialogRef` and `DIALOG_DATA` from `@angular/cdk/dialog`.
- Its template is intended to be opened through CDK dialog.
- It accepts `confirmButtonClass`, which lets callers inject arbitrary styling decisions into the component.
- The current public API encourages feature code to treat the component as both a reusable UI unit and a modal controller.

That creates two boundary problems:

- The design system depends on overlay-backed CDK behavior that is harder to audit under strict CSP.
- Caller-provided button classes make the component less predictable and less reusable across product surfaces.

The `users` approval flow in `apps/portal-web` is the active in-repo consumer and should be the feature that owns modal opening and workflow decisions.

## Scope

This spec includes:

- Introduce a reusable confirmation content component in the design system.
- Remove CDK dialog/overlay dependency from the reusable component.
- Replace `confirmButtonClass` with an explicit variant API.
- Keep `ConfirmationDialogComponent` as a deprecated compatibility wrapper while callers migrate.
- Update feature code to use the new component boundary instead of assuming the design system opens dialogs itself.
- Preserve Storybook and test coverage for confirmation behavior, accessibility, and destructive variants.

This spec does not include:

- Introducing Angular Material dialogs.
- Building a new generic overlay engine in the design system.
- Redesigning unrelated modal, toast, or notification primitives.
- Changing business rules around approval, rejection, or concurrency handling in the users feature.

## Design Direction

Use Approach A: a reusable confirmation content component plus a compatibility wrapper.

The design system should expose a presentational confirmation component with explicit inputs for title, message, labels, tone, and loading/disabled state. It should render normal local DOM and use static class mapping only. It should not inject `DialogRef`, `DIALOG_DATA`, `Overlay`, or any CDK overlay primitive.

`ConfirmationDialogComponent` should remain as a deprecated wrapper for transition purposes. Its role is compatibility, not the long-term API. The wrapper delegates to the new reusable content component and preserves the old selector and test ids while in-repo consumers migrate.

Feature code, such as the users approval flow, should instantiate the new confirmation UI through a feature-owned local modal host and keep the approval workflow local to the feature layer. For `apps/portal-web`, the migration target is a new `UsersConfirmationHostComponent` owned by the users feature. It renders local DOM, composes `tai-confirmation-panel`, and exposes a `confirmed: boolean` result to preserve the current `if (confirmed)` approval flow.

## Alternatives Considered

### Approach A: Reusable Confirmation Content + Compatibility Wrapper

Recommended.

This keeps the security and architecture boundary clean while avoiding a hard break for existing consumers. It also creates a clear migration path for the active users approval flow.

Trade-off: there are two component names during the transition.

### Approach B: Replace `ConfirmationDialogComponent` In Place

Rejected.

This would be simpler short-term, but it would keep the modal/open-close responsibility too close to the design-system component and make the migration harder to stage safely.

### Approach C: Keep CDK Dialog but Remove `confirmButtonClass`

Rejected.

That still leaves the design system depending on overlay-backed dialog infrastructure, which is the boundary problem this change is meant to address.

## Component API

Create a reusable confirmation content component with selector `tai-confirmation-panel`.

Proposed API:

```typescript
export type ConfirmationTone = 'default' | 'danger';
export type ConfirmationActionId = 'confirm' | 'cancel';
export type ConfirmationInitialFocus = 'confirm' | 'cancel';

export interface ConfirmationPanelAction {
  label: string;
  tone?: ConfirmationTone;
  disabled?: boolean;
  loading?: boolean;
}

export interface ConfirmationPanelData {
  title: string;
  message: string;
  confirm: ConfirmationPanelAction;
  cancel: Omit<ConfirmationPanelAction, 'tone' | 'loading'>;
  ariaLabel?: string;
  initialFocus?: ConfirmationInitialFocus;
}
```

The reusable component should:

- Render title, message, and action buttons through interpolation or `[textContent]`.
- Use explicit tone classes for `default` and `danger` actions.
- Avoid accepting arbitrary class strings.
- Avoid CDK dialog injection.
- Emit a single `actionSelected` output with a typed payload: `{ action: ConfirmationActionId }`.
- Treat `confirm.loading` as higher priority than `confirm.disabled`; either state disables the confirm action and suppresses duplicate confirm emissions.
- Fail closed for invalid or missing inputs by falling back to safe defaults rather than rendering broken controls.
- Normalize empty or whitespace-only title/message values to safe fallback text in the component.
- Clamp title and message display strings to a documented maximum length before rendering.
- Keep the existing test ids during migration: `modal-title`, `modal-message`, `modal-cancel-button`, and `modal-confirm-button`.

The wrapper component should:

- Keep the existing `tai-confirmation-dialog` selector for compatibility.
- Be marked deprecated in code comments.
- Delegate to the reusable confirmation component.
- Preserve existing public export surface during transition.
- Continue to support the legacy `ConfirmationDialogData` shape during transition by mapping it to the new content model.
- Ignore `confirmButtonClass` and map destructive or custom legacy styling needs to explicit tones only.

## Visual States

The reusable confirmation UI should support:

- `default`: standard safe confirmation.
- `danger`: destructive confirmation with explicit warning styling.
- `loading`: confirm action in progress and temporarily disabled.
- `disabled`: confirm action unavailable.

The confirm tone should be explicit and finite. `confirmButtonClass` must not be part of the new API.

The component should support:

- Borrower/admin-style compact layouts.
- Destructive workflows that need strong confirm affordance.
- Long titles and messages without layout overlap.
- Clear cancel and confirm action hierarchy.
- Visible, non-color confirmation tone cues for destructive actions.
- Native button keyboard behavior for `Enter` and `Space`.

## Accessibility Requirements

The confirmation component should follow the practical semantics of a confirmation prompt:

- Title and message must be exposed as readable text.
- Primary and secondary actions must be real buttons.
- The confirm action must have an accessible name that reflects the current tone or action if needed.
- The root content should always expose `role="dialog"` and link title and message through `aria-labelledby` and `aria-describedby`.
- Disabled or loading confirm actions must not be activatable.
- Focus states must be visible and sufficient under WCAG 2.2 expectations.
- The design should not depend on overlay-specific semantics inside the design system component.
- Initial focus should default to `confirm` for `default` tone and `cancel` for `danger` tone. The host can override with `initialFocus`.

The feature-owned modal host remains responsible for modal-level focus trapping, Escape-to-close behavior, backdrop click behavior, and focus restoration. The reusable design-system panel does not listen for global Escape events.

## CSP and Security Requirements

The component must follow `libs/ui/design-system/SECURITY.md`:

- No `style=""`.
- No `[style]`.
- No `[innerHTML]`.
- No `DomSanitizer.bypassSecurityTrust*`.
- No runtime-generated Tailwind class names from caller data.
- No Angular Material.
- No CDK overlay-backed dialog behavior in the design-system component.

State-to-class mapping must be explicit and internal to the component. Feature callers provide typed tone and state values, not CSS classes.
Invalid tone values must collapse to the default style rather than generating caller-controlled class names or throwing from template rendering.

Input validation rules:

- Empty or whitespace-only title falls back to `Confirm action`.
- Empty or whitespace-only message falls back to `Please review this action before continuing.`
- Empty or whitespace-only confirm label falls back to `Confirm`.
- Empty or whitespace-only cancel label falls back to `Cancel`.
- Title is clamped to 120 display characters.
- Message is clamped to 500 display characters.

## Feature Migration Boundary

`apps/portal-web/src/app/features/users/users.page.ts` should own the approval workflow and whatever open/close mechanism is used around the confirmation UI.

Responsibilities:

- Instantiate the confirmation UI through `UsersConfirmationHostComponent`, a feature-owned local DOM modal host.
- Pass typed content data to the reusable design-system component.
- Choose `default` tone for user approval and `danger` tone for destructive actions.
- Remove any dependency on `confirmButtonClass`.
- Keep the concurrency-safe approval logic in the feature layer.
- Define how async confirmation failures are handled in the feature layer, including resetting loading state and surfacing a retry or error affordance.

`UsersConfirmationHostComponent` should:

- Render a local fixed-position backdrop and panel inside the users feature tree.
- Compose `tai-confirmation-panel`.
- Own Escape-to-close, backdrop click, manual focus looping, initial focus, and focus restoration.
- Implement focus management manually with local DOM queries and keyboard handling; do not use CDK `FocusTrap`, `A11yModule`, `Overlay`, `Dialog`, or Angular Material.
- Capture `document.activeElement` before opening and restore focus to that element after close when it is still connected to the document.
- Map panel actions explicitly: `{ action: 'confirm' }` becomes `confirmed: true`; `{ action: 'cancel' }`, Escape, and backdrop click become `confirmed: false`.
- Return a `confirmed: boolean` result to the page layer so the current `if (confirmed)` workflow can remain intact.
- Set loading while approval is in progress, ignore duplicate confirm clicks while loading, and clear loading if approval fails.
- Expose the confirmation result through a host-owned `confirmApproval(...): Promise<boolean>` API or equivalent feature service API, not through CDK `DialogRef.closed`.

The design-system component should remain reusable for other high-stakes confirmation flows, but it should not decide how dialogs are opened.

## Compatibility Strategy

Keep `ConfirmationDialogComponent` as a deprecated compatibility wrapper during migration.

The wrapper should:

- Retain the `tai-confirmation-dialog` selector.
- Continue exporting `ConfirmationDialogData` or a compatibility-aligned type only as needed for the transition.
- Delegate rendering to the new reusable confirmation component.
- Avoid reintroducing CDK dialog/overlay dependencies into the reusable layer.
- Be removed in a later major change once in-repo consumers migrate.
- Be mechanically removable once the in-repo users approval flow and any remaining consumers use the new component directly.
- Map legacy `confirmText` to `confirm.label`, `cancelText` to `cancel.label`, `title` and `message` directly, and ignore `confirmButtonClass`.
- Preserve the old `DialogRef.close(true | false)` behavior only inside the deprecated wrapper while CDK-based consumers still exist.

The preferred implementation path is a compatibility wrapper because `apps/portal-web` is the active consumer and the current API is already public.

Removal trigger: once `rg -n "Dialog\\.open<boolean>\\(ConfirmationDialogComponent|tai-confirmation-dialog|ConfirmationDialogData|confirmButtonClass" apps libs` returns no active app consumers outside the deprecated wrapper and tests, remove the wrapper in a follow-up breaking-change PR.

The migrated users approval flow should not render `tai-confirmation-dialog`. That selector remains only for deprecated wrapper consumers. Users E2E coverage should move from `page.locator('tai-confirmation-dialog')` to `getByRole('dialog')` plus the preserved test ids: `modal-title`, `modal-message`, `modal-cancel-button`, and `modal-confirm-button`.

## Storybook Requirements

Add stories under `Molecules/Confirmation` or a similar renamed section:

- `Default`: standard confirmation prompt.
- `Danger`: destructive confirmation tone.
- `LongMessage`: long text and long title handling.
- `Loading`: confirm action disabled while working.
- `Accessibility`: visible labels and focusable actions.

Stories should include interaction checks for:

- Confirm action is selectable when enabled.
- Cancel action is selectable.
- Danger tone uses explicit design-system styling, not caller CSS classes.
- User-provided text renders as text, not HTML.
- Loading state suppresses duplicate confirm actions.
- Focus defaults are demonstrated for default and danger tones.

## Unit Test Requirements

Add design-system unit tests for:

- Component creation.
- Title and message rendering.
- Confirm and cancel button labels.
- Confirm and cancel action outputs.
- Disabled and loading confirm behavior, including the case where both are true.
- Danger tone styling from explicit variant mapping.
- No `[innerHTML]`.
- No `[style]`.
- No CDK dialog or overlay imports in the reusable component.
- Compatibility wrapper still exists for transition consumers.
- Compatibility wrapper ignores `confirmButtonClass`.
- Invalid or empty inputs fall back to safe defaults.
- Title and message length clamping.
- Boundary clamping at exactly 120 title characters and 500 message characters.
- Initial focus behavior for default and danger tones.
- Invalid `initialFocus` values fall back to the tone-based default.
- Rapid confirm clicks during loading emit at most one confirm action.
- Rapid cancel clicks during loading emit at most one cancel action.

Add users feature-host tests for `UsersConfirmationHostComponent`:

- Opens with the expected title, message, and actions.
- Uses manual focus management and does not import CDK `FocusTrap`, `A11yModule`, `DialogModule`, or `OverlayModule`.
- Maps panel confirm action to `confirmed: true`.
- Maps panel cancel action to `confirmed: false`.
- Maps Escape key to `confirmed: false`.
- Maps backdrop click to `confirmed: false`.
- Loops `Tab` and `Shift+Tab` focus inside the host while open.
- Restores focus to the opener after close.
- Applies initial focus to confirm for default tone and cancel for danger tone unless overridden.
- Suppresses duplicate confirms while loading.
- Clears loading and allows retry after an approval failure.

Add users integration tests for `users.page.ts`:

- Approval flow no longer calls `Dialog.open<boolean>(ConfirmationDialogComponent, ...)`.
- `users.page.ts` no longer imports `Dialog`, `DialogModule`, `DialogRef`, `DIALOG_DATA`, or `ConfirmationDialogComponent`.
- Approval invokes the store only when the host resolves `confirmed: true`.
- Approval does not invoke the store when the host resolves `confirmed: false`.
- Users E2E queries the migrated confirmation by `role="dialog"` and preserved test ids, not by `tai-confirmation-dialog`.

## Verification Requirements

Use both tests and static checks to prove the boundary:

- Unit tests cover rendering, variants, and action outputs.
- Storybook cover default, danger, and loading behavior.
- A static scan command must fail if the reusable confirmation component imports `@angular/cdk/dialog`, `OverlayModule`, `MatDialog`, `DialogRef`, `DIALOG_DATA`, or other overlay-backed primitives.
- The static scan must run in CI before merge, either as an Nx target or as part of the repository lint/check workflow.
- The existing `tai-confirmation-dialog` selector must remain available only through the deprecated compatibility wrapper. Migrated users E2E coverage must use `role="dialog"` and stable test ids.

Required static scan:

```bash
rg -n "@angular/cdk/dialog|OverlayModule|MatDialog|DialogRef|DIALOG_DATA|overlay-backed" libs/ui/design-system/src/lib/molecules/confirmation-panel libs/ui/design-system/src/lib/molecules/confirmation-dialog
```

Expected: no matches in `confirmation-panel`. Matches in `confirmation-dialog` are allowed only while the deprecated wrapper still supports legacy CDK consumers.

To avoid false positives from prose comments, the implementation plan should scan TypeScript and Angular template files only, or use a focused import scan such as `rg -n "from '@angular/cdk/dialog'|import .*OverlayModule|import .*MatDialog|DialogRef|DIALOG_DATA" ...`.

## Migration Plan

Implementation should happen in this order:

1. Add the reusable confirmation component and tests.
2. Export the new component and types from `libs/ui/design-system/src/index.ts`.
3. Add `UsersConfirmationHostComponent` in `apps/portal-web/src/app/features/users/`.
4. Update `users.page.ts` to use the users confirmation host and stop passing `confirmButtonClass`.
5. Refactor `ConfirmationDialogComponent` into a deprecated compatibility wrapper.
6. Keep existing data-testid values during migration and update users E2E from `tai-confirmation-dialog` to `role="dialog"` and test-id queries.
7. Add or update static checks that block CDK dialog/overlay imports in the reusable component.
8. Wire the static check into CI through an Nx target or the repository lint/check workflow.
9. Run design-system tests, build checks, Storybook checks, and the users approval flow tests.

## Acceptance Criteria

- The reusable confirmation component does not import `@angular/cdk/dialog`.
- The reusable confirmation component does not import `OverlayModule` or other overlay-backed primitives.
- The reusable confirmation component does not accept arbitrary confirm button classes.
- `ConfirmationDialogComponent` remains available as a deprecated compatibility wrapper during migration.
- The users approval flow uses the new confirmation boundary without relying on caller-provided CSS classes.
- The users approval flow no longer calls `Dialog.open<boolean>(ConfirmationDialogComponent, ...)`.
- `UsersConfirmationHostComponent` preserves the current boolean confirmation workflow while owning modal behavior.
- Storybook demonstrates default and destructive confirmation states.
- Unit tests cover accessibility and variant behavior.
- Users feature-host tests cover Escape-to-close, backdrop click, focus trapping, focus restoration, initial focus, loading retry, and `confirmed: boolean` mapping.
- Users feature-host implementation does not import CDK focus, dialog, overlay, or Angular Material modules.
- Static checks prevent the reusable confirmation component from reintroducing CDK dialog/overlay dependencies.
- The static CDK dialog/overlay check runs in CI before merge.
- The `tai-confirmation-dialog` selector continues to work only for deprecated compatibility wrapper consumers until the wrapper is removed.
- Migrated users approval E2E no longer queries `tai-confirmation-dialog`.

## Open Decisions Resolved

- The design-system component should be reusable confirmation content, not a modal controller.
- The reusable selector is `tai-confirmation-panel`.
- `ConfirmationDialogComponent` remains temporarily for compatibility.
- `confirmButtonClass` is removed in favor of explicit tone-based variants.
- Feature code owns open/close behavior and workflow decisions through `UsersConfirmationHostComponent`.
- The reusable component emits `actionSelected` with `{ action: 'confirm' | 'cancel' }`.
- Escape handling belongs to the feature host, not the reusable design-system panel.
- `UsersConfirmationHostComponent` uses manual focus management instead of CDK focus utilities.
- Migrated users E2E uses `role="dialog"` and stable test ids instead of `tai-confirmation-dialog`.
- CDK dialog/overlay is out of scope for the reusable design-system component.
