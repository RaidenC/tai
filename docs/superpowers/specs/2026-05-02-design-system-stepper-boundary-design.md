# Design System Stepper Boundary Design

## Goal

Split the current router-aware `WizardComponent` into a generic design-system `StepperComponent` organism, then keep borrower/application wizard routing and workflow decisions in feature-owned code.

The design system should own reusable step progress UI, accessibility semantics, keyboard behavior, visual states, and strict-CSP-safe rendering. Borrower portal feature code should own route integration, route guards, step eligibility, current-step calculation, and workflow-specific content.

## Problem

`libs/ui/design-system/src/lib/organisms/wizard/wizard.component.ts` describes itself as a pure presentation component, but it imports `RouterModule`, injects `ActivatedRoute`, reads route data, and renders `routerLink` in its template. That makes the design-system organism responsible for application routing behavior.

This weakens the architecture boundary:

- The design system depends on Angular router concepts that belong in app or feature layers.
- Step state is implied by router directives instead of being explicit typed input.
- The component cannot be reused for non-router workflows such as account setup, document upload, identity verification, or modal step flows.
- Accessibility and Storybook coverage are harder to prove because the component needs router context to render realistic states.
- Borrower-specific naming and paths can leak into a generic UI primitive.

The borrower portal already has `ClaimWizardComponent`, which is the right place to compose router state, claim step metadata, route guards, and `<router-outlet>` content around a generic stepper.

## Scope

This spec includes:

- Add a generic `StepperComponent` organism under `libs/ui/design-system/src/lib/organisms/stepper/`.
- Define a typed `StepperStep` model that represents step state without route dependencies.
- Add Storybook stories for default, completed, current, blocked, error, long-label, mobile, and security-relevant states.
- Add unit tests for rendering, ARIA attributes, keyboard behavior, and CSP-safe DOM.
- Refactor borrower `ClaimWizardComponent` to compose the generic `tai-stepper` with router-aware feature logic.
- Keep `claimStepGuard` as the source of truth for route access.
- Preserve the borrower portal visible step labels and E2E coverage intent.
- Keep `WizardComponent` as a deprecated compatibility wrapper that composes `StepperComponent`.

This spec does not include:

- Building a full workflow engine.
- Introducing Angular CDK Stepper.
- Moving claim route guards into the design system.
- Moving borrower form pages into the design system.
- Adding persistence, autosave, validation, or API behavior.
- Refactoring unrelated organisms such as notification panel, data table, transfer list, or app shell.

## Design Direction

Use Approach A: a headless-enough visual `tai-stepper` organism with explicit inputs and feature-owned navigation.

The stepper receives a list of steps and a selected step id. `currentStepId` is the single source of truth for the current step. Step status values represent non-current status only: not started, completed, blocked, or error. The stepper renders progress, labels, and state indicators. It emits a `stepSelected` event when a selectable step is activated. It does not know what a route is and does not render `routerLink`.

The borrower feature wrapper maps Angular router state and claim workflow rules into this generic contract:

- Route config defines the claim step paths.
- NgRx selectors and route guards determine whether steps are complete, blocked, or error; `currentStepId` determines the current step.
- `ClaimWizardComponent` passes those states to `tai-stepper`.
- On `stepSelected`, `ClaimWizardComponent` navigates through Angular router.
- `<router-outlet>` remains in the feature wrapper, not inside the design system.

This keeps the design system reusable and testable while preserving router-level enforcement for deep links.

## Alternatives Considered

### Approach A: Generic Stepper, Router-Aware Feature Wrapper

Recommended.

The design system owns only presentation and interaction. Feature code owns routing, eligibility, and business semantics. This matches the established rule that `libs/ui/design-system` must not import feature code and should stay made of reusable dumb components.

Trade-off: the borrower wrapper does a little more mapping work. That is acceptable because the mapping is feature-specific.

### Approach B: Keep `WizardComponent`, Add More Inputs

Rejected.

This would preserve current behavior but keep router dependencies inside the design system. It would also make the component harder to use outside route-driven workflows.

### Approach C: Use Angular CDK Stepper

Rejected for this phase.

CDK Stepper can help with step semantics, but its linear mode is local to the component and does not enforce deep-link access. The borrower portal already uses route guards as the enforcement point. Adding CDK Stepper would create a second source of truth and is not needed for this boundary cleanup.

## Component API

Create `StepperComponent` with selector `tai-stepper`.

```typescript
export type StepperOrientation = 'horizontal' | 'vertical';
export type StepperDensity = 'compact' | 'comfortable';
export type StepperStepStatus =
  | 'not-started'
  | 'completed'
  | 'blocked'
  | 'error';

export interface StepperStep {
  id: string;
  label: string;
  description?: string;
  status: StepperStepStatus;
  disabled?: boolean;
  ariaLabel?: string;
}
```

Inputs:

```typescript
readonly steps = input.required<StepperStep[]>();
readonly currentStepId = input.required<string>();
readonly orientation = input<StepperOrientation>('horizontal');
readonly density = input<StepperDensity>('comfortable');
readonly ariaLabel = input<string>('Progress');
readonly testId = input<string>('stepper');
```

Outputs:

```typescript
readonly stepSelected = output<StepperStep>();
```

Rendering rules:

- Use a semantic `<nav>` with `aria-label`.
- Render steps in an ordered list.
- Use real `button` elements for selectable steps.
- Use `aria-current="step"` on the current step.
- Use `aria-disabled="true"` and disabled button behavior for blocked or disabled steps.
- Derive current visual treatment from `currentStepId`, not from `StepperStep.status`.
- Do not render anchors or router directives.
- Render labels and descriptions with interpolation or `[textContent]`.
- Do not accept caller-provided class strings, inline styles, raw HTML labels, or icon SVG strings.

## Visual States

Each step should support these visual states:

- `not-started`: available future step with neutral treatment.
- `completed`: prior step with completed indicator.
- `blocked`: inaccessible future step with disabled treatment.
- `error`: step requiring attention, with error color and accessible label.

The component should support:

- Horizontal orientation for desktop wizard pages.
- Vertical orientation for narrow layouts or side panels.
- Compact density for dense admin surfaces.
- Comfortable density for borrower-facing forms.
- Reduced-motion support through `prefers-reduced-motion`.
- Stable dimensions for indicators so state changes do not shift layout.
- Long labels without losing all readable context on mobile.
- Visible status text or visible non-color indicators for completed, blocked, and error states. Screen-reader-only status is not sufficient as the only non-color signal.

## Accessibility Requirements

The stepper should follow the practical semantics of a step progress navigation pattern:

- The wrapper is a `<nav>` landmark with configurable `aria-label`.
- The step list is an `<ol>` so screen readers receive ordered progress context.
- Current step uses `aria-current="step"`.
- Disabled or blocked steps are not keyboard-activatable.
- Error steps include an accessible name that communicates the error state.
- Completed, blocked, and error steps include visible and accessible text that communicates state without relying on color alone.
- Buttons have visible focus states with sufficient contrast.
- Touch targets should be at least 44px in comfortable density.
- Keyboard interaction must be covered by tests for `Tab`, `Enter`, and `Space`.
- Arrow-key roving focus is out of scope for this phase; use native button tab order to keep the component predictable and easy to test.

The design should align with WCAG 2.2 expectations around focus appearance, target size, and non-color state communication.

## CSP and Security Requirements

The component must follow `libs/ui/design-system/SECURITY.md`:

- No `style=""`.
- No `[style]`.
- No `[innerHTML]`.
- No `DomSanitizer.bypassSecurityTrust*`.
- No runtime-generated Tailwind class names from caller data.
- No Angular Material.
- No CDK overlay, portal, menu, tooltip, popover, or dialog primitives.

State-to-class mapping must be explicit and internal to the component. Feature callers provide structured status values, not class names.

## Borrower Portal Refactor

`apps/borrower-portal/src/app/claim/claim-wizard.component.ts` should become the router-aware composition layer.

Responsibilities:

- Import `StepperComponent` and `RouterModule`.
- Own the claim step array, including route path and display label.
- Derive `currentStepId` from the current route.
- Map existing claim validity selectors, including `selectStepValidity` or `selectDocumentsValid`, into `completed`, `blocked`, or `error` step statuses.
- Handle `stepSelected` by navigating to `['/claim', step.path]`.
- Reject blocked/future step selections in `onStepSelected()` before calling `router.navigate()`.
- Keep `<router-outlet>` below the stepper.

The feature wrapper should keep a local model that extends the generic step model:

```typescript
interface ClaimWizardStep {
  id: string;
  path: string;
  label: string;
}
```

It should convert that model into `StepperStep[]` before passing data to the design system.

`claimStepGuard` remains the route access source of truth and must continue to redirect invalid deep links to the first incomplete step. The stepper can show blocked state, but it must not be the security or workflow enforcement mechanism. The feature wrapper must still fail closed for manual `onStepSelected()` calls so tests do not rely on disabled button behavior as the only guard.

## Compatibility Strategy

Replace borrower portal usage with `StepperComponent` directly, but keep `WizardComponent` as a deprecated compatibility shim because it is part of the `@tai/ui-design-system` public export surface.

The compatibility `WizardComponent` wrapper should:

- Lives outside the generic `stepper` folder.
- Is marked deprecated in code comments.
- Imports `StepperComponent`.
- Keeps the existing `tai-wizard` selector and `WizardStep` export.
- Preserves current route-aware behavior for downstream consumers during the transition.
- Is not used by borrower portal after this migration.
- Has a removal note for a future major/versioned breaking change.

The preferred implementation path for borrower portal is direct migration because current active app usage shows the borrower claim wrapper as the only in-repo consumer. External package compatibility is handled by keeping the deprecated wrapper.

## Storybook Requirements

Add stories under `Organisms/Stepper`:

- `Default`: four-step horizontal flow.
- `CompletedAndCurrent`: prior completed steps plus current step.
- `BlockedFutureSteps`: inaccessible future steps.
- `ErrorState`: one step marked error.
- `LongLabels`: long labels and descriptions in constrained width.
- `Vertical`: vertical orientation.
- `Compact`: compact density.
- `Mobile`: narrow-width rendering.
- `Security`: untrusted-looking labels rendered as text, not HTML.

Stories should include interaction checks for:

- Current step is exposed with `aria-current="step"`.
- Blocked steps are disabled.
- Selectable steps emit `stepSelected`.
- User-controlled labels do not create HTML nodes.
- Keyboard activation with `Enter` and `Space` emits selection for enabled steps.
- Long labels remain readable enough on mobile and do not overlap other content.

## Unit Test Requirements

Add unit tests for:

- Component creation.
- Ordered list rendering.
- Current step ARIA state.
- Disabled and blocked step behavior.
- Completed and error accessible labels.
- Visible non-color status text for completed, blocked, and error states.
- `stepSelected` emitted for enabled steps.
- No emission for disabled or blocked steps.
- Keyboard activation emits only for enabled steps.
- No `[innerHTML]` usage.
- No inline style attributes.
- No `RouterModule`, `ActivatedRoute`, or router directive imports in `StepperComponent`.

Update borrower feature tests for:

- `ClaimWizardComponent` passes claim steps to `tai-stepper`.
- Selecting a step calls router navigation.
- Selecting a blocked/future step does not call router navigation.
- Current step is derived from route URL.
- Existing route guard behavior still redirects invalid deep links.
- Existing E2E step labels still appear.

## Migration Plan

Implementation should happen in this order:

1. Add `StepperComponent` and its tests/stories without removing `WizardComponent`.
2. Export `StepperComponent` and `StepperStep` from `libs/ui/design-system/src/index.ts`.
3. Refactor `ClaimWizardComponent` to use `tai-stepper` and own router navigation.
4. Update borrower E2E selectors from `.wizard-stepper` to a stable `data-testid` or stepper role query.
5. Refactor `WizardComponent` into a deprecated compatibility shim over `StepperComponent`; keep its public export.
6. Run design-system lint, tests, build, Storybook build, and borrower portal E2E checks.

## Acceptance Criteria

- `StepperComponent` has no dependency on `@angular/router`.
- `StepperComponent` has no dependency on borrower portal types, routes, stores, or selectors.
- Borrower route guards continue to enforce deep-link access.
- Borrower wrapper rejects blocked/future step selections before calling `router.navigate()`.
- Borrower wizard pages still render the four existing steps.
- Storybook demonstrates the stepper without app router providers.
- Storybook a11y and CSP guardrails pass.
- Unit tests prove disabled, blocked, completed, current, and error states.
- Borrower portal no longer imports `WizardComponent`.
- Public exports include both the new `StepperComponent` and the deprecated `WizardComponent` compatibility shim.

## Verification Commands

Run these during implementation:

```bash
npx nx test design-system --skip-nx-cache
npx nx lint design-system --skip-nx-cache
npx nx build design-system --skip-nx-cache
CI=true npx nx build-storybook design-system --skip-nx-cache
npx nx e2e borrower-portal-e2e --skip-nx-cache
```

If Storybook test runner is wired in CI for this project, also run:

```bash
npx nx test-storybook design-system --skip-nx-cache
```

## Open Decisions Resolved

- The new generic design-system component will be called `StepperComponent`.
- `WizardComponent` remains as a deprecated compatibility wrapper for existing public API consumers.
- Router-aware wizard composition remains in borrower/application feature code.
- The design system will emit intent through `stepSelected`; it will not navigate.
- `currentStepId` is the single source of truth for current-step rendering.
- Route guards remain the workflow enforcement layer.
- CDK Stepper is out of scope for this phase.
