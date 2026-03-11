# Research Report: Phase 5 - User Onboarding Frontend (UI Components & Integration)

## 1. Core Objectives
*   **Self-Service Registration:** Implement the public-facing onboarding form for End Customers.
*   **Administrative Approvals:** Implement the "Pending Approvals" dashboard tile for Tenant Admins to verify and approve staff/admin accounts.
*   **State Integration:** Connect the UI to the backend Minimal API endpoints (Phase 4) using Angular Signal Stores and Secure Cookie-based BFF patterns.

## 2. Technical Requirements & Mandates
*   **Framework:** Angular 21 (Zoneless optimization where possible).
*   **Styling:** Tailwind CSS 4.0 using **Vanilla CSS Variables** for multi-tenant branding.
*   **Component Strategy:** Utilize **Angular Headless CDK** to ensure maximum flexibility and adherence to strict CSP (No inline styles/scripts).
*   **Security:** 
    *   **BFF Pattern:** No JWT storage in the browser; all state is managed via `Secure; HttpOnly; SameSite=Strict` cookies.
    *   **DPoP:** The frontend must utilize the `DPoPInterceptor` and `DPoPService` (already present in `apps/portal-web`) for all onboarding API calls.
*   **Verification:** 
    *   **Storybook:** Every new component MUST have a `.stories.ts` file with `play` functions for interaction testing (the "Living Specification").
    *   **Vitest:** Unit tests for services and signal stores.

## 3. Architectural Mapping
*   **`libs/ui/design-system`**: 
    *   Host the "Dumb" UI components (e.g., `registration-form`, `approval-tile`).
    *   Implement Storybook interaction tests here to mathematically prove security invariants.
*   **`apps/portal-web`**:
    *   Host the "Smart" components/route handlers.
    *   Configure Signal Stores (using `component-store` or standard Signals) to manage the onboarding state machine (`Created` -> `PendingVerification`).
    *   Implement routing logic to the Passkey Registration flow upon OTP verification.

## 4. API Integration Points
*   `POST /api/onboarding/register`: Self-service customer registration.
*   `GET /api/onboarding/pending`: Fetch users awaiting approval (Tenant Admin only).
*   `POST /api/onboarding/approve`: Second-pair-of-eyes approval for staff/admin.
*   `POST /api/onboarding/verify`: 6-digit OTP verification to transition to `Active`.

## 5. Implementation Strategy
1.  **Develop registration/approval components in isolation** using Storybook in `libs/ui/design-system`.
2.  **Integrate components into `portal-web` routes.**
3.  **Wire up the Signal Stores** to the existing `DPoPService` and backend endpoints.
4.  **Verify with Vitest and Storybook interactions.**
