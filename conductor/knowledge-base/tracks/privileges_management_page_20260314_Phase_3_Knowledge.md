# Knowledge Note: Privileges Catalog Implementation - Phase 3 (Angular UI - Privileges Datatable)

## 🎯 Objective
Develop the presentation layer for the Privileges Catalog using Angular 21. The focus was on creating a highly performant, accessible, and reactive data table leveraging Angular Signals and the custom UI design system.

## 🏗️ Architectural Decisions

### 1. Signal-Based State Management
- **RxRx to Signals:** Transitioned from traditional RxJS Observables to Angular's Signal Store for managing the datatable's state (data, pagination, loading, search queries). This provides fine-grained reactivity and eliminates the need for manual `ChangeDetectorRef` triggers or complex `async` pipes in the template.
- **Derived State:** Used computed signals to automatically derive the table's "empty state" or "loading state" based on the primary data signals, ensuring the UI always accurately reflects the store.

### 2. Server-Side Pagination & Filtering
- **Efficient Data Fetching:** Implemented debounced search inputs that trigger server-side filtering. Instead of loading all privileges into memory, the UI only requests the current page, ensuring the application remains lightweight and performant even as the catalog grows.
- **Tenant-Aware Rendering:** The UI dynamically evaluates the logged-in Tenant Admin's licensed "Tiles" and filters out privileges belonging to unlicensed modules, preventing UI clutter and potential confusion.

### 3. Custom Design System Integration
- **Reusable Components:** Leveraged the `libs/ui/design-system` library (buttons, inputs, layouts) to ensure visual consistency across the portal.
- **Action Menus:** Integrated the CDK (Component Dev Kit) based action menus within the datatable rows to provide a clean, accessible way to trigger "View Details" or "Edit" actions without cluttering the UI with buttons.

## 🧪 Verification Evidence

### E2E Testing with Playwright
- **Smoke Tests:** Created `privileges-catalog.spec.ts` to verify the core flows: table loading, searching, and pagination.
- **Resilient Locators:** Encountered race conditions when using generic locators like `.first()` during search debounce. Refactored to use targeted row locators (e.g., `page.locator('tr', { hasText: 'Portal.Users.Read' })`) to ensure Playwright explicitly waits for the DOM to update after a search API call, drastically improving test stability.

### Accessibility (Axe-Core)
- **Keyboard Navigation:** Verified that users can navigate through the datatable headers, search inputs, and action menus using only the keyboard (`Tab`, `Enter`, `ArrowDown`).
- **Axe Audits:** Integrated `axe-playwright` to run automated accessibility audits on the rendered datatable, ensuring compliance with WCAG standards.

## 💡 Lessons Learned
- **E2E Stability:** Asynchronous UI updates (like debounced search filtering) require highly specific Playwright locators. Generic positional selectors (`.first()`) are brittle and often lead to flaky tests in reactive applications.

---
*Created: March 2026*
