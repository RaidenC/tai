# Knowledge Note: Frontend Design System (CDK Table & Modal)
## Track: User DataTable and Approval Workflow - Phase 3

### Overview
Implementation of the foundational, reusable UI components for the TAI Portal using Angular 21 (Zoneless/Signals), @angular/cdk, and Tailwind CSS 4.0. The focus was on creating accessible, high-performance "headless" components that separate logic from presentation.

### Key Architectural Decisions

#### 1. Headless Architecture with @angular/cdk
- **DataTable:** Leveraged `CdkTableModule` to handle the complex structural requirements of an HTML table (row rendering, column definitions) while maintaining full control over the DOM and styling.
- **Modal:** Used `CdkDialogModule` instead of standard Material Dialog to avoid heavy UI dependencies and ensure alignment with our custom design system.

#### 2. Signal-Based Component API
- Used the new Angular `input()`, `output()`, and `computed()` APIs.
- Components are designed for **OnPush** change detection and work seamlessly in a **Zoneless** environment.
- **Dynamic Action Visibility:** Implemented a declarative visibility pattern using a predicate function: `visible: (row) => boolean`.

#### 3. Zero-Trust Styling Compliance
- **No Inline Styles:** Strictly adhered to the Zero-Trust CSP by using Tailwind 4.0 classes exclusively.
- **No Dynamic Style Bindings:** Avoided `[style.width]` or similar bindings that trigger CSP violations.

### Technical Implementation Details

#### Confirmation Dialog
- **Accessibility:** Implemented focus management and ARIA roles using CDK primitives.
- **Theming:** Utilized Tailwind 4.0's "modern" aesthetic with backdrop-blur overlays and high-contrast typography.
- **Testing:** Storybook interactions use `play` functions to verify that clicks on "Confirm" or "Cancel" correctly close the dialog with the expected payload.

#### DataTable Component
- **Generic Support:** Uses TypeScript generics `<T>` to allow any data shape.
- **Declarative Actions:** Actions are defined as an array of `TableActionDef<T>`, allowing the parent component to specify logic without touching the table internals.
- **Accessibility:**
    - Sortable headers use `<button>` elements inside `<th>` for keyboard navigability.
    - Explicit `aria-labels` for sorting states (Ascending/Descending).
- **Pagination UI:** Intelligent calculation of ranges (e.g., "Showing 11 to 20 of 25") using `computed` signals.

### Verification Standards (March 2026)
- **Storybook Interactions:** All components include an `InteractionAudit` story with passing `play` functions.
- **Axe-Core:** Verified zero accessibility violations in the Storybook environment.
- **Unit Testing:** 100% logic coverage for calculation signals and event emissions.

### Common Pitfalls & Solutions
- **Problem:** `SB_FRAMEWORK_ANGULAR_0001` error in Storybook v10.
- **Solution:** Excluded `test-runner.ts` from `tsconfig.json` and ensured explicit `buildTarget` configuration in `project.json`.
- **Problem:** Angular `output()` not being captured by Storybook `fn()`.
- **Solution:** Use `argTypes` with explicit `action: 'name'` mapping to bridge the gap between the new output API and Storybook's mocking system.
