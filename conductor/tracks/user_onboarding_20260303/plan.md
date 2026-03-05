# Implementation Plan: User & Identity Management - Onboarding

## Phase 1: Core Domain & State Machine (Backend) [checkpoint: 61d62ec]
- [x] Task: Implement User Aggregate Root and State Machine 8ba1862
    - [ ] Write xUnit tests for User creation and state transitions (Created -> PendingApproval -> PendingVerification -> Active).
    - [ ] Implement `ApplicationUser` aggregate root in `libs/core/domain` with `Status` enum.
    - [ ] Define Domain Events (`UserRegisteredEvent`, `UserApprovedEvent`).
    - [ ] Ensure Domain invariants prevent login (invalid state) when not Active.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Core Domain & State Machine (Backend)' (Protocol in workflow.md) 61d62ec

## Phase 2: Application Layer & Use Cases (Backend) [checkpoint: 7d07659]
- [x] Task: Implement Onboarding CQRS Commands 1513afe
    - [ ] Write xUnit/FluentValidation tests for `RegisterCustomerCommand` and `ApproveStaffCommand`.
    - [ ] Implement `RegisterCustomerCommand` handler.
    - [ ] Implement `ApproveStaffCommand` handler.
- [x] Task: Implement Pending Approvals Queries 2b4aa05
    - [ ] Write xUnit tests for querying pending users.
    - [ ] Implement CQRS Query to fetch users in `PendingApproval` state.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Application Layer & Use Cases (Backend)' (Protocol in workflow.md) 7d07659

## Phase 3: Infrastructure & Persistence (Backend) [checkpoint: 67a5882]
- [x] Task: EF Core Configuration 685f54f
    - [x] Write integration tests using WebApplicationFactory + TestContainers for User persistence and Global Query Filters (`TenantId`).
    - [x] Configure `ApplicationUser` mapping and EF Core persistence in `libs/core/infrastructure`.
    - [x] Generate and apply EF Core migrations.
- [x] Task: Implement Simulated Activation (Completed in Phase 2 via IOtpService)
    - [x] Implement `SimulatedEmailService` in Infrastructure to log OTPs to terminal/outbox.
    - [x] Wire up Domain Event handlers to trigger the simulated email service.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Infrastructure & Persistence (Backend)' (Protocol in workflow.md) 67a5882

## Phase 4: API Endpoints (Backend)
- [ ] Task: Expose Onboarding and Approval Endpoints
    - [ ] Write integration tests for API endpoints.
    - [ ] Implement minimal API endpoints in `apps/portal-api` routing to MediatR handlers for registration, fetching pending approvals, and submitting approvals.
    - [ ] Ensure endpoints enforce DPoP.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: API Endpoints (Backend)' (Protocol in workflow.md)

## Phase 5: UI Components & Integration (Frontend)
- [ ] Task: Build Registration UI
    - [ ] Create Storybook interaction tests for self-service registration form.
    - [ ] Implement Angular components in `apps/portal-web` using Headless CDK and Tailwind CSS.
- [ ] Task: Build Pending Approvals Tile
    - [ ] Create Storybook interaction tests for the Pending Approvals dashboard tile.
    - [ ] Implement the dashboard tile and approval action UI for Tenant Admins.
- [ ] Task: Integrate UI with API
    - [ ] Write Vitest unit tests for Angular services/signal stores calling the onboarding endpoints.
    - [ ] Connect the UI forms and tiles to the minimal API endpoints.
    - [ ] Implement routing to Passkey Registration Flow upon successful activation (OTP entry).
- [ ] Task: Conductor - User Manual Verification 'Phase 5: UI Components & Integration (Frontend)' (Protocol in workflow.md)

## Phase 6: End-to-End Verification
- [ ] Task: Playwright "Steel Thread" Tests
    - [ ] Write and run Playwright E2E tests for the Customer Self-Service workflow.
    - [ ] Write and run Playwright E2E tests for the Staff Approval workflow.
- [ ] Task: Conductor - User Manual Verification 'Phase 6: End-to-End Verification' (Protocol in workflow.md)