# Specification: User & Identity Management - Onboarding

## Overview
This track implements the user onboarding phase of the User & Identity Management lifecycle for the TAI Portal. It enables the creation and initial provisioning of users across all system personas: Bank Staff, End Customers, Tenant Admins, and System Admins. It establishes the core state machine, REST API, and Angular UI for a secure, passive onboarding and approval flow.

## Functional Requirements
- **Persona-Driven Onboarding Workflows:**
  - **End Customers:** Self-service registration with automated or immediate provisioning workflows.
  - **Bank Staff, Tenant Staff, and System Admins:** Approval-based onboarding utilizing the "Four-Eyes Principle" requiring secondary approval before privileges are granted.

- **Formalized State Machine:**
  - **Customer Flow:** `Created` -> `PendingVerification` (Needs 6-digit OTP) -> `Active`
  - **Staff/Admin Flow:** `Created` -> `PendingApproval` (Needs 2nd pair of eyes) -> `PendingVerification` (Needs 6-digit OTP from user) -> `Active`

- **Mock Email/Simulated Activation:**
  - Implement a simulated activation process (e.g., OTP logged to terminal or an outbox) to ensure the state machine fully exercises the transition from Pending to Active.

## Clean Architecture Implementation
- **`libs/core/domain`**: The User Aggregate Root must encapsulate the state machine (e.g., Status enum) and emit Domain Events (e.g., `UserRegisteredEvent`, `UserApprovedEvent`).
- **`libs/core/application`**: Implement CQRS Commands (e.g., `RegisterCustomerCommand`, `ApproveStaffCommand`), REST API queries for fetching pending users, and validation logic (FluentValidation).
- **`libs/core/infrastructure`**: Implement `SimulatedEmailService` and EF Core configurations.
- **`apps/portal-api`**: Minimal API endpoints that strictly route to MediatR/CQRS handlers.
- **`apps/portal-web`**: UI components (Tiles, Modals, Forms) to initiate and manage onboarding workflows. Build the registration forms and a simple "Pending Approvals" dashboard tile where a Tenant Admin can manually navigate to see and approve users.

## Non-Functional Requirements
- **Security:** Strict adherence to Zero-Trust principles. All API communications must enforce DPoP. No PII leaks in logs.
- **Multi-Tenancy:** Proper `TenantId` isolation using EF Core Global Query Filters must be applied to newly created users and onboarding requests where applicable.
- **Aesthetics & UI:** The frontend must use Headless Angular CDK and Tailwind CSS 4.0, dynamically adapting to multi-tenant styles.

## Acceptance Criteria
- [ ] End Customers can successfully submit a self-service registration request, entering `PendingVerification` state.
- [ ] Administrative creation of Staff or Admin accounts enters a `PendingApproval` state.
- [ ] Tenant Admins can navigate to a "Pending Approvals" dashboard tile to view users awaiting approval.
- [ ] An authorized user (second pair of eyes) can approve the pending Staff/Admin account via the dashboard tile, transitioning it to `PendingVerification`.
- [ ] User registration/approval triggers a simulated "Activation Event" (OTP logged to terminal/outbox).
- [ ] Domain logic prevents login until the activation state is `Active`.
- [ ] Successful activation (entering the 6-digit OTP) immediately transitions the user into the Passkey Registration Flow (routing logic must be present, even if generation is mocked for now).
- [ ] Backend Domain invariants for User and Onboarding state transitions are fully covered by xUnit tests.
- [ ] The Angular UI correctly displays the onboarding forms and "Pending Approvals" tile, adhering to strict CSP constraints.
- [ ] Storybook Interaction Tests (`play` functions) are created and pass for the new onboarding and approval UI components.
- [ ] Playwright E2E "Steel Thread" tests pass for the full onboarding flow.

## Out of Scope
- Full offboarding processes (deactivation and token revocation workflows).
- Granular role assignment modification for existing users (covered in future iterations).
- The actual cryptography of the Passkeys feature (this track only handles the routing *to* the flow).
- Real-time SignalR push notifications for pending approvals (This will be handled in a dedicated "Active Operational Hub" track). The approval flow in this track will be driven by standard REST API calls and UI navigation.