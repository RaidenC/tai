### Day 3: Authentication UI & Custom Security Components
**Strategic Context: Why Custom Components over Angular Material?**
The login screen is the most attacked surface of any financial application. While libraries like Angular Material accelerate development, they do not meet the strict security requirements of financial institutions governed by PCI DSS and SOC 2. Pre-built UI libraries introduce third-party dependency risks, increase the attack surface, and dictate rigid DOM structures. By building custom components using Angular Aria (headless directives), we maintain 100% control over the HTML. This is critical for enforcing strict Content Security Policies (CSP), mitigating DOM-based XSS via Angular's "Trusted Types" API, and preventing data leakage from browser autofill stealer logs by strictly controlling input attributes. Furthermore, custom components allow us to implement robust anti-clickjacking (overlay attack) defenses at the UI level.

**How Storybook Satisfies Security Audits**
Developing these components in Storybook provides a massive compliance advantage. Storybook isolates the UI from complex application state, creating a sandbox where security and accessibility can be audited independently. It serves as a verifiable "Secure Component Inventory" for SOC 2 auditors, allowing teams to use scripted interaction tests to mathematically prove that sensitive inputs handle validation securely and do not leak data.

**Feature 3.1: Secure Custom Input Components (Storybook)**
*   **Description:** Create a library of custom "Identity Inputs" (Email, Password, MFA Code) that bypass Angular Material to guarantee strict DOM control and security. Unlike pre-built libraries that often inject inline `<style>` tags at runtime and violate strict CSP policies, these custom components will rely on external CSS/SCSS and headless primitives.
*   **Technical Detail:**
    *   **LTS Compatibility:** These components will implement the standard `ControlValueAccessor` interface to integrate seamlessly with Angular's production-ready Reactive Forms API.
    *   **Strict CSP:** By fully owning the HTML and avoiding inline styles, the components ensure compatibility with a strict `Content-Security-Policy: default-src 'self'` and `style-src 'self'` without needing `unsafe-inline` exceptions.
    *   **Trusted Types:** To prevent DOM-based XSS, the application will define a custom `TrustedTypePolicy` (e.g., using DOMPurify). If a component ever needs to render dynamic content, it will only accept a `TrustedHTML` object via the `createHTML` method, preventing arbitrary string injection.
    *   **Clickjacking Mitigation:** While primary defense relies on HTTP headers (`frame-ancestors 'none'`), we will utilize Storybook's `@chromatic-com/storybook` visual testing addon to establish baseline snapshots. This ensures that any UI redress or unintended overlapping layers introduced during development are caught immediately.
    *   **Autofill Stealer Log Defense:** Stealer malware targets browser-stored credentials. Since browsers often ignore `autocomplete="off"` for login fields, the components will employ techniques like using `autocomplete="new-password"` or applying CSS-based masking (`-webkit-text-security: disc`) to prevent the browser from automatically populating sensitive data on the screen.
*   **Acceptance Criteria:**
    *   `SecureInputComponent` implements `ControlValueAccessor` correctly and registers providers via `NG_VALUE_ACCESSOR`.
    *   `SecureInputComponent` restricts injected HTML to Trusted Types only.
    *   Storybook: Stories exist for "Default", "Focused", "Error", and "Disabled" states, acting as interactive documentation for security teams.
    *   Automated interaction tests (using the `play` function) and visual regression tests in Storybook verify component visibility and ensure autocomplete attributes are correctly bound to prevent stealer log extraction.

**Feature 3.2: The Login Form Composition (Reactive Forms)**
*   **Description:** Compose the inputs into a functional Login Form using the stable Reactive Forms API.
*   **Technical Detail:** Use `FormGroup` and `FormControl` to define the form model with strict typing. Implement validators using the standard `Validators.required` and `Validators.email` rules.
*   **Acceptance Criteria:**
    *   The form model is strongly typed using `FormGroup<{ email: FormControl<string>, password: FormControl<string> }>`.
    *   The form submits only when valid.
    *   "Submit" button state is bound to the `loginForm.valid` property.
    *   Error messages appear immediately upon blur if invalid.

> **Gemini Code Assist Prompt (Day 3):**
>
> **Persona:** Frontend Security Architect (Angular/Accessibility).
> **Context:** Building the secure Login UI for TAI Portal using Angular 21. We are explicitly avoiding Angular Material to ensure strict DOM control to meet PCI DSS and SOC 2 compliance requirements.
> **Task:** Implement the `SecureInputComponent`, `LoginFormComponent`, and their isolated Storybook stories with integrated security testing.
> **Constraints:**
> *   **Tech:** Use Reactive Forms (`ReactiveFormsModule`). DO NOT use the experimental Signal Forms. Ensure `SecureInputComponent` properly implements `ControlValueAccessor` and registers the `NG_VALUE_ACCESSOR` provider.
> *   **Security (CSP & Trusted Types):** Do not use inline styles. Ensure strict CSP compatibility. If dynamically rendering HTML (e.g., error messages), you must define a custom `TrustedTypePolicy` and use `createHTML` to prevent DOM-based XSS.
> *   **Security (Data Leakage):** Apply `autocomplete="new-password"` or CSS masking (`-webkit-text-security: disc`) to password inputs to prevent browser autofill stealer logs from extracting credentials.
> *   **Accessibility:** Use Angular Aria headless directives inside the custom inputs.
>
> **Coding Instructions:**
> 1.  Create a `SecureInputComponent` that implements `ControlValueAccessor` to integrate with Reactive Forms.
> 2.  Inside `SecureInputComponent`, implement a `TrustedTypesService` that initializes `window.trustedTypes.createPolicy` to safely sanitize and bind dynamic error messages.
> 3.  Apply CSS-based masking (`-webkit-text-security: disc`) and the correct autocomplete attributes to the input fields to mitigate stealer malware.
> 4.  Create a `LoginComponent` that composes these secure inputs using a strictly typed `FormGroup` and built-in Angular Validators.
> 5.  Generate a `login.stories.ts` file. Configure the `@chromatic-com/storybook` addon in the story metadata to establish visual baselines for clickjacking and overlay attack prevention.
> 6.  Write a `play` function in the story to automate interaction testing. Simulate filling invalid/valid data using `userEvent`, and assert state changes to mathematically prove the component handles validation without leaking data.
