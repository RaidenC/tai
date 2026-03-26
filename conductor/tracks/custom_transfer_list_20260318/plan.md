# Implementation Plan: Custom Transfer List Component

## Phase 1: Component Scaffold & CDK Listbox [checkpoint: da3da9d]
- [x] Task: Project Scaffolding [9f4559d]
    - [x] Generate the new `TransferListComponent` in the `libs/ui/design-system` library.
    - [x] Define the Generic Types `<T>` and Signal Inputs (`items`, `assignedIds`, `displayKey`, `trackKey`, `density`).
    - [x] Expose i18n dictionary Inputs for all button labels and ARIA tags.
- [x] Task: Selection & Filtering Logic via CDK (TDD) [9f4559d]
    - [x] Integrate `@angular/cdk/listbox` (`cdkListbox`, `cdkOption`).
    - [x] Write failing Vitest tests for the debounced `computed()` search filtering logic.
    - [x] Implement the logic using Angular Signals to pass the Vitest suite.
- [x] Task: Selection-based Move Buttons (>) and (<) [da3da9d]
    - [x] Track current selection in both panes using Signals.
    - [x] Add `>` and `<` buttons to move only selected items.
    - [x] Ensure Ctrl-click and single-click multi-selection works.
- [x] Task: Continuous Integration Gate [9f4559d]
    - [x] Run `npx nx affected --target=test --coverage` to ensure 90%+ coverage.
    - [x] Run `npx nx affected --target=lint` to ensure no style regressions.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Component Scaffold & CDK Listbox' (Protocol in workflow.md) [da3da9d]

## Phase 2: Responsive UI, Virtual Scroll & Density Control [checkpoint: da3da9d]
- [x] Task: Enterprise UI Construction & View Transitions
    - [x] Implement the layout using Tailwind CSS 4.0, ensuring a robust side-by-side flex layout.
    - [x] Integrate `<cdk-virtual-scroll-viewport>` and apply custom webkit scrollbar styling.
    - [x] Apply CSS View Transitions (`view-transition-name`) and `focus-visible:ring` for premium micro-interactions.
    - [x] Implement Density Control (`compact` vs `comfortable` Tailwind padding) and Content Projection (`<ng-template>`).
- [x] Task: Dynamic Badges & Active Accessibility
    - [x] Implement Contextual Pill Badges that reactively display total vs. filtered counts (e.g., `[ 3 / 10 ]`).
    - [x] Inject `LiveAnnouncer` from `@angular/cdk/a11y`.
    - [x] Create Storybook stories representing all states (Default, Compact, Large Dataset) and implement automated Axe-core checks.
- [x] Task: Continuous Integration Gate [641c093]
    - [x] Run `npx nx affected --target=test --coverage` and `--target=lint`.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Responsive UI, Virtual Scroll & Density Control' (Protocol in workflow.md) [641c093]

## Phase 3: Drag & Drop Architecture Spike
- [ ] Task: Architectural Resolution: Drag-Drop within Virtual Scroll
    - [ ] Research and implement a custom Virtual Scroll strategy/wrapper that allows `cdkDropList` to function without crashing when items scroll out of the DOM buffer.
- [ ] Task: Drag-and-Drop Logic (TDD)
    - [ ] Write failing Vitest tests for drag-and-drop transfers.
    - [ ] Implement the bindings on the virtual scroll containers.
    - [ ] Ensure `cdkDropListDropped` events use `Signal.update()`.
- [ ] Task: Continuous Integration Gate
    - [ ] Run `npx nx affected --target=test --coverage` and `--target=lint`.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Drag & Drop Architecture Spike' (Protocol in workflow.md)

## Phase 4: Complex Interactions, Telemetry & Mutation Testing
- [ ] Task: Double-Click, Reset & Telemetry (TDD)
    - [ ] Write failing Vitest tests for instant double-click transfers, the `reset()` method, and telemetry event emissions.
    - [ ] Implement the double-click logic, `isDirty` state tracking, and `@Output() actionTelemetry`.
- [ ] Task: Mutation Testing (StrykerJS)
    - [ ] Run StrykerJS against the component logic. If the mutation score is below 80%, write stronger Vitest assertions to kill the surviving mutants.
- [ ] Task: Continuous Integration Gate
    - [ ] Run `npx nx affected --target=test --coverage` and `--target=lint`.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Complex Interactions, Telemetry & Mutation Testing' (Protocol in workflow.md)

## Phase 5: Form Integration & Shift-Left E2E Testing
- [ ] Task: ControlValueAccessor Implementation
    - [ ] Write Vitest tests and implement the `ControlValueAccessor` interface.
- [ ] Task: Edit User Page Integration & Concurrency Handling
    - [ ] Embed the Transfer List into the `libs/features/user-management` Edit User page (`formControlName`).
    - [ ] Wire up the "Discard Changes" button to the component's `reset()` method.
    - [ ] Implement Optimistic Concurrency checks (`RowVersion` handling, catching `409 Conflict`).
- [ ] Task: Shift-Left Playwright Smoke Test
    - [ ] Write a basic Playwright test verifying the form successfully loads, accepts a transfer, and submits the `RowVersion`.
- [ ] Task: Continuous Integration Gate
    - [ ] Run `npx nx affected --target=test --coverage` and `--target=lint`.
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Form Integration & Shift-Left E2E Testing' (Protocol in workflow.md)

## Phase 6: E2E Validation & Strict Nx Regression Guard
- [ ] Task: Visual & Functional E2E (Playwright)
    - [ ] Write comprehensive Playwright tests verifying negative/edge cases (e.g., `409 Conflict` recovery flow).
    - [ ] Implement Visual Regression snapshots across multiple screen sizes (including mobile stacking).
- [ ] Task: Strict Regression & Boundary Check
    - [ ] Run `npx nx run-many -t lint` to mathematically guarantee no Nx Workspace boundaries were violated.
    - [ ] Run `npx nx affected --target=test,e2e` to verify the entire system.
- [ ] Task: Conductor - User Manual Verification 'Phase 6: E2E Validation & Strict Nx Regression Guard' (Protocol in workflow.md)

## Phase 7: Product Documentation & Knowledge Base Delivery
- [ ] Task: Masterclass & Release Notes
    - [ ] Draft a comprehensive "Masterclass" document in `conductor/knowledge-base/tracks/` detailing the architectural decisions.
    - [ ] Draft user-facing Release Notes explaining the new power-user features.
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Product Documentation & Knowledge Base Delivery' (Protocol in workflow.md)