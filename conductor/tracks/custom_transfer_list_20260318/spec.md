# Specification: Custom Transfer List Component

## 1. Overview
Implement a highly reusable, accessible (WCAG 2.1 AA) "Transfer List" component in the Angular UI. The component will allow users to efficiently move items between an "Available" list and an "Assigned" list. It will also be integrated into the "Edit User" page to manage user privileges.

## 2. Functional Requirements
- **Reusable Generic Component:** A pure presentation component utilizing Angular Signals and Generic Typing (`<T>`). 
- **Content Projection:** Supports custom `<ng-template>` inputs for rendering rich item layouts.
- **Form Integration:** Implements `ControlValueAccessor` (CVA) to seamlessly plug into Angular Reactive Forms.
- **Strict Disabled State:** Fully implements `setDisabledState` to logically block all drag-and-drop, click, and keyboard interactions when the user lacks edit permissions.
- **Advanced Selection:** Supports single-click, "Select All/None" checkboxes, and `Shift+Click` for rapid range selection.
- **Smart Move Buttons:** Distinct buttons for moving selected items (`>`, `<`) and moving all items (`>>`, `<<`).
- **Drag-and-Drop & Reordering:** 
  - Full drag-and-drop transfer between panes using `@angular/cdk/drag-drop`.
  - The "Assigned" pane supports internal drag-and-drop reordering.
- **Double-Click Transfer:** Double-clicking an item instantly transfers it to the opposite pane.
- **Debounced Search:** Both lists feature client-side search bars with a 300ms debounce to ensure smooth typing.
- **Dirty State & Reset (Undo):** Tracks unsaved changes (`isDirty` Signal) and exposes a `reset()` method to revert lists to their initial state.
- **Edit User Integration:** Embedded within the "Edit User" page. Save behavior is **Explicit Save** (changes sent to backend on form submission).

## 3. Non-Functional, Security & Performance Requirements
- **Anti-XSS Enforcement:** Strict prohibition of `[innerHTML]`. All dynamic data must be rendered via Angular's safe interpolation to prevent Stored XSS.
- **Zero-Violation CSP:** No inline `style="..."` attributes used for drag-and-drop positioning; must rely on safe CDK properties and Tailwind utility classes.
- **Storybook-Compatible OnPush:** Built with `ChangeDetectionStrategy.OnPush` and Signals to prevent global re-renders while maintaining Storybook compatibility.
- **Memoized Filtering & DOM Recycling:** Uses `computed()` for search logic and `@for` with strict `track` identity to guarantee peak performance during UI thrashing.
- **Virtual Scrolling:** Utilizes `@angular/cdk/scrolling` to render items, ensuring 60fps performance with datasets up to 1000 items.
- **Accessibility (WCAG 2.1 AA):** Fully navigable via keyboard. Clear visual focus indicators and ARIA roles.

## 4. SQA Acceptance Criteria
- [ ] Component accepts generic data, integrates via `formControlName`, and implements a secure `disabled` state.
- [ ] Users can drag-and-drop between panes and reorder items within the Assigned pane.
- [ ] Double-click instantly transfers an item.
- [ ] Arrow buttons, Shift+Click multi-selection, and debounced client-side search function correctly.
- [ ] `reset()` method correctly reverts the component to its initial state, and `isDirty` accurately reflects unsaved changes.
- [ ] **Negative Testing:** Vitest logic tests explicitly handle boundary conditions (null inputs, duplicate keys, transferring disabled items).
- [ ] **Automated Accessibility:** Storybook interaction tests include Axe-core assertions that fail the build on WCAG violations.
- [ ] **Visual Regression:** Playwright visual snapshots implemented for Empty, Loading, and Populated states.
- [ ] Zero-Violation CSP compliant (no `[innerHTML]` or inline styles).
- [ ] Edit User page correctly includes the component and saves on form submission.

## 5. Out of Scope
- Server-side filtering and pagination within the Transfer List itself.
- Real-time/auto-save behavior upon item transfer.