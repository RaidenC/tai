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

`ConfirmationDialogComponent` should remain as a deprecated wrapper for transition purposes. Its role is compatibility, not the long-term API. The wrapper can delegate to the new reusable content component, but modal opening and closing behavior should be owned outside the design system by the feature that uses it.

Feature code, such as the users approval flow, should instantiate the new confirmation UI through its own modal host or wrapper and keep the approval workflow local to the feature layer. This spec assumes the feature layer already has, or will add, a local modal host wrapper outside the design system; it does not define a new modal system.

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

Create a reusable confirmation content component with a selector in the design system, likely `tai-confirmation-panel` or `tai-confirmation-card`.

Proposed API:

```typescript
export type ConfirmationTone = 'default' | 'danger';

export interface ConfirmationContentAction {
  label: string;
  tone?: ConfirmationTone;
  disabled?: boolean;
  loading?: boolean;
}

export interface ConfirmationContentData {
  title: string;
  message: string;
  confirm: ConfirmationContentAction;
  cancel: Omit<ConfirmationContentAction, 'tone' | 'loading'>;
  ariaLabel?: string;
}
```

The reusable component should:

- Render title, message, and action buttons through interpolation or `[textContent]`.
- Use explicit tone classes for `default` and `danger` actions.
- Avoid accepting arbitrary class strings.
- Avoid CDK dialog injection.
- Emit a single `actionSelected` output with a typed payload: `confirm` or `cancel`.
- Treat `confirm.disabled`, `confirm.loading`, and component-level loading as confirm-blocking.
- Fail closed for invalid or missing inputs by falling back to safe defaults rather than rendering broken controls.
- Normalize empty or whitespace-only title/message values to safe fallback text in the component.

The wrapper component should:

- Keep the existing `tai-confirmation-dialog` selector for compatibility.
- Be marked deprecated in code comments.
- Delegate to the reusable confirmation component.
- Preserve existing public export surface during transition.
- Continue to support the legacy `ConfirmationDialogData` shape during transition by mapping it to the new content model.

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
- `Escape` key cancellation when the host forwards the event or when the component is used inline.

## Accessibility Requirements

The confirmation component should follow the practical semantics of a confirmation prompt:

- Title and message must be exposed as readable text.
- Primary and secondary actions must be real buttons.
- The confirm action must have an accessible name that reflects the current tone or action if needed.
- The root content should expose `role="dialog"` and link title and message through `aria-labelledby` and `aria-describedby` when used as a dialog body.
- Disabled or loading confirm actions must not be activatable.
- Focus states must be visible and sufficient under WCAG 2.2 expectations.
- The design should not depend on overlay-specific semantics inside the design system component.
- Initial focus should land on the cancel action by default unless the feature host explicitly overrides focus.

The feature-owned modal host remains responsible for modal-level focus trapping and escape handling if it uses a dialog system outside the design system.

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

## Feature Migration Boundary

`apps/portal-web/src/app/features/users/users.page.ts` should own the approval workflow and whatever open/close mechanism is used around the confirmation UI.

Responsibilities:

- Instantiate the confirmation UI through a feature-owned modal host or wrapper.
- Pass typed content data to the reusable design-system component.
- Choose `danger` tone for destructive or high-risk actions.
- Remove any dependency on `confirmButtonClass`.
- Keep the concurrency-safe approval logic in the feature layer.
- Define how async confirmation failures are handled in the feature layer, including resetting loading state and surfacing a retry or error affordance.

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

The preferred implementation path is a compatibility wrapper because `apps/portal-web` is the active consumer and the current API is already public.

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
- Escape key or host-close behavior is covered if the story runs inside a local wrapper.

## Unit Test Requirements

Add unit tests for:

- Component creation.
- Title and message rendering.
- Confirm and cancel button labels.
- Confirm and cancel action outputs.
- Disabled or loading confirm behavior.
- Danger tone styling from explicit variant mapping.
- No `[innerHTML]`.
- No `[style]`.
- No CDK dialog or overlay imports in the reusable component.
- Compatibility wrapper still exists for transition consumers.
- Invalid or empty inputs fall back to safe defaults.

## Verification Requirements

Use both tests and static checks to prove the boundary:

- Unit tests cover rendering, variants, and action outputs.
- Storybook cover default, danger, and loading behavior.
- A static scan or lint rule must fail if the reusable confirmation component imports `@angular/cdk/dialog`, `OverlayModule`, `MatDialog`, or other overlay-backed primitives.
- The existing `tai-confirmation-dialog` selector must remain available during migration so current E2E coverage does not break.

## Migration Plan

Implementation should happen in this order:

1. Add the reusable confirmation component and tests.
2. Export the new component and types from `libs/ui/design-system/src/index.ts`.
3. Update feature code to use the new boundary and stop passing `confirmButtonClass`.
4. Refactor `ConfirmationDialogComponent` into a deprecated compatibility wrapper.
5. Update Storybook and any E2E selectors to match the new API.
6. Add or update static checks that block CDK dialog/overlay imports in the reusable component.
7. Run design-system tests, build checks, Storybook checks, and the users approval flow tests.

## Acceptance Criteria

- The reusable confirmation component does not import `@angular/cdk/dialog`.
- The reusable confirmation component does not import `OverlayModule` or other overlay-backed primitives.
- The reusable confirmation component does not accept arbitrary confirm button classes.
- `ConfirmationDialogComponent` remains available as a deprecated compatibility wrapper during migration.
- The users approval flow uses the new confirmation boundary without relying on caller-provided CSS classes.
- Storybook demonstrates default and destructive confirmation states.
- Unit tests cover accessibility and variant behavior.
- Static checks prevent the reusable confirmation component from reintroducing CDK dialog/overlay dependencies.
- The `tai-confirmation-dialog` selector continues to work until the migration is complete.

## Open Decisions Resolved

- The design-system component should be reusable confirmation content, not a modal controller.
- `ConfirmationDialogComponent` remains temporarily for compatibility.
- `confirmButtonClass` is removed in favor of explicit tone-based variants.
- Feature code owns open/close behavior and workflow decisions.
- CDK dialog/overlay is out of scope for the reusable design-system component.
