# Track: User Onboarding - Phase 5 Knowledge Note

## The Enterprise Challenge: Secure Frontend Lifecycle Management
In a Zero-Trust Fintech environment, the frontend cannot be trusted with any persistent identity secrets (JWTs). This phase solves the challenge of implementing a complex, multi-stage onboarding workflow (Registration -> OTP Verification -> Administrative Approval) while maintaining strict **Content Security Policy (CSP)** compliance and ensuring that every sensitive request is cryptographically bound to the client instance via **DPoP (Demonstrating Proof-of-Possession)**.

## Knowledge Hierarchy

### Junior Level (The "What")
- **Signals-Based State:** Using Angular 21 `signal()`, `computed()`, and `effect()` to manage UI state without the overhead of `Zone.js`.
- **Standalone Components:** Building modular, reusable UI pieces (forms, tiles) that declare their own dependencies.
- **Reactive Forms:** Using `FormGroup` and `FormControl` for robust, typed input validation.

### Mid Level (The "How")
- **Headless CDK:** Utilizing Angular CDK's unstyled primitives to build accessible, secure forms while maintaining full control over the CSS (Tailwind 4.0).
- **Service-Based Store Pattern:** Implementing a centralized `OnboardingStore` that encapsulates API logic and exposes read-only signals to the UI, preventing "state leakage."
- **Storybook Interaction Testing:** Using `play` functions to programmatically simulate user interactions, proving that validation rules are active and security attributes (like `autocomplete="new-password"`) are correctly set.

### Senior/Principal Level (The "Why")
- **DPoP & BFF Synchronization:** Why we use an Interceptor to automatically attach DPoP proofs to all `/api` calls. This ensures that even if an XSS attack occurs, the stolen session cookie cannot be replayed from another device.
- **Zoneless Optimization:** Moving towards a Signal-based architecture allows the application to run in "Zoneless" mode, reducing the footprint of the framework and improving performance in high-security environments.
- **CSP Integrity:** By avoiding inline styles and scripts (and enforcing this via Tailwind 4.0 and SCSS isolation), we significantly reduce the attack surface for injection-based vulnerabilities.

## Deep-Dive Mechanics: The Onboarding State Machine
The implementation mirrors the backend state machine:
1. **`RegisterPage`** triggers `OnboardingStore.register()`.
2. Upon `Success`, an `effect()` redirects the user to **`/verify`**.
3. **`VerifyPage`** triggers `OnboardingStore.verify()`.
4. Upon final `Success`, the user is routed to the **Passkey Setup** flow.
This "One-Way Ticket" routing ensures the user cannot easily bypass security checkpoints by manually manipulating the URL.

## Interview Talking Points (Tiered)
- **Junior:** "I used Angular Signals to build a reactive onboarding store that tracks the registration status and handles errors gracefully."
- **Mid:** "I implemented Storybook Interaction Tests to verify that our registration form enforces PCI-compliant password complexity before the submit button is even enabled."
- **Senior:** "I integrated a global DPoP Interceptor with our onboarding service to ensure that every registration and approval request is cryptographically signed, mitigating the risk of token-replay attacks."

## March 2026 Market Context
By March 2026, the industry has shifted away from "JWT-in-LocalStorage." The **BFF (Backend-for-Frontend)** pattern combined with **DPoP-constrained cookies** is the established gold standard for secure Fintech applications. Using Angular Signals with Tailwind 4.0 provides a lightweight, performant UI that satisfies both the SOC 2 security auditor and the performance-conscious end-user.
