### Day 5: The Federated Dashboard Shell (Zero-Trust & Strict CSP)
**Strategic Context:**
The "Portal Dashboard" is the container for all business modules. It must be resilient, accessible, and highly secure. To align with a zero-trust architecture, the shell must treat all loaded modules, state variables, and user inputs as untrusted. Furthermore, the UI must strictly adhere to a Content Security Policy (CSP) that rejects any inline scripts or styles (`unsafe-inline`), enforcing a strict `default-src 'self'` policy. This heavily reinforces our choice to build the layout using the unstyled Angular Aria primitives instead of third-party libraries like Angular Material that inject inline DOM styles. Finally, development of the shell will follow a strict Test-Driven Development (TDD) approach utilizing Storybook interaction tests.

**Feature 5.1: Accessible Sidebar Navigation (TDD Approach)**
*   **Description:** A collapsible sidebar that lists available modules (Collections, Payments).
*   **Technical Detail:** Built using the `CdkMenu` and `CdkMenuItem` directives from `@angular/cdk/menu` (the Angular LTS standard for headless components). These handle complex focus management automatically without injecting disallowed inline styles. Under TDD, the Storybook `play` function must be written before the component logic to define expected keyboard behavior.
*   **Acceptance Criteria:**
    *   Sidebar expands/collapses.
    *   Component relies purely on external CSS Modules/SCSS (CSP Compliant).
    *   Storybook: AppShell story demonstrates responsive behavior, and an automated `play` function verifies that keyboard navigation matches WAI-ARIA Authoring Practices exactly (e.g., asserting focus moves on ArrowDown).

**Feature 5.2: Zero-Trust User Profile Widget**
*   **Description:** A dropdown in the header showing the user's avatar and a secure "Logout" button.
*   **Technical Detail:** Connected to the `AuthService` Observables. It must strictly validate its state and avoid exposing sensitive auth payloads (like access tokens) to the global window object.
*   **Acceptance Criteria:**
    *   Displays user initials securely.
    *   Dropdown opens on Click or Enter key.
    *   Logout definitively clears the session, actively revokes DPoP keys, and redirects to login, leaving zero residual auth data in local memory.

**Feature 5.3: Automated A11y & CSP Guardrails**
*   **Description:** Prevent regression of accessibility features and security policies.
*   **Technical Detail:** Configure the Storybook Test Runner to execute a full accessibility audit (via `axe-core`) and simulate CSP enforcement on the App Shell during the CI pipeline.
*   **Acceptance Criteria:**
    *   CI pipeline fails if any critical accessibility violation is found.
    *   CI pipeline fails if the component attempts to inject inline styles or scripts that violate the strict CSP policy.

> **Gemini Code Assist Prompt (Day 5):**
>
> **Persona:** UI/UX Engineer & Security Architect.
> **Context:** Building the main layout for the Portal dashboard using headless components. We operate under a strict Zero-Trust model and a strict Content Security Policy (CSP) with no `unsafe-inline` permitted.
> **Task:** Implement the `AppShell` and `Sidebar` components using a strict Test-Driven Development (TDD) approach.
> **Constraints:**
> *   **Tech:** Use Angular CDK headless primitives (`import { CdkMenu, CdkMenuItem } from '@angular/cdk/menu'`). DO NOT use Angular Material, to ensure maximum CSP compatibility and custom TAI branding.
> *   **Security:** Ensure the component layout uses CSS Grid via external SCSS files. No inline styles or dynamic style bindings are allowed (Strict CSP).
> *   **TDD Methodology:** You must write the Storybook interaction test FIRST.
>
> **Coding Instructions:**
> 1.  **Test First:** Write a `sidebar.stories.ts` file. Define a `play` function using `@storybook/test` (`userEvent`, `expect`). The test must simulate a screen reader user opening the menu and navigating via ArrowDown, ArrowUp, and Enter, asserting that `document.activeElement` updates correctly.
> 2.  **Implementation:** Create the Angular `SidebarComponent` that satisfies the test. The menu should be data-driven, accepting a standard `@Input()` property `menuItems`.
> 3.  **Security:** Implement the logout action in the User Profile widget to ensure it calls a strict cleanup method, asserting that no authentication tokens remain in the component's state or the browser's global scope.