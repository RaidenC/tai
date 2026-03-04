# Implementation Plan: User & Identity Management - Onboarding

## Phase 1: Core Domain & State Machine (Backend)
- [x] Task: Implement User Aggregate Root and State Machine 8ba1862
    - [ ] Write xUnit tests for User creation and state transitions (Created -> PendingApproval -> PendingVerification -> Active).
    - [ ] Implement `ApplicationUser` aggregate root in `libs/core/domain` with `Status` enum.
    - [ ] Define Domain Events (`UserRegisteredEvent`, `UserApprovedEvent`).
    - [ ] Ensure Domain invariants prevent login (invalid state) when not Active.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Core Domain & State Machine (Backend)' (Protocol in workflow.md)

## Phase 2: Application Layer & Use Cases (Backend)
- [ ] Task: Implement Onboarding CQRS Commands
    - [ ] Write xUnit/FluentValidation tests for `RegisterCustomerCommand` and `ApproveStaffCommand`.
    - [ ] Implement `RegisterCustomerCommand` handler.
    - [ ] Implement `ApproveStaffCommand` handler.
- [ ] Task: Implement Pending Approvals Queries
    - [ ] Write xUnit tests for querying pending users.
    - [ ] Implement CQRS Query to fetch users in `PendingApproval` state.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Application Layer & Use Cases (Backend)' (Protocol in workflow.md)

## Phase 3: Infrastructure & Persistence (Backend)
- [ ] Task: EF Core Configuration
    - [ ] Write integration tests using WebApplicationFactory + TestContainers for User persistence and Global Query Filters (`TenantId`).
    - [ ] Configure `ApplicationUser` mapping and EF Core persistence in `libs/core/infrastructure`.
    - [ ] Generate and apply EF Core migrations.
- [ ] Task: Implement Simulated Activation
    - [ ] Implement `SimulatedEmailService` in Infrastructure to log OTPs to terminal/outbox.
    - [ ] Wire up Domain Event handlers to trigger the simulated email service.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Infrastructure & Persistence (Backend)' (Protocol in workflow.md)

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