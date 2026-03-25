# Implementation Plan: Privileges Management Page

## Phase 1: Database and Core Domain [checkpoint: 241d745]
- [x] Task: Define the `Privilege` Entity and Value Objects 189f278
    - [x] Write Unit Tests for Domain invariants (e.g., hierarchical name validation, immutability).
    - [x] Implement `Privilege` domain model, incorporating Optimistic Concurrency tokens (`RowVersion`).
- [x] Task: Persistence Layer & Event Sourcing 1e3b21d
    - [x] Write Integration Tests verifying concurrent update failures (Lost Update prevention).
    - [x] Implement EF Core configurations: Map `JIT Settings` to `JSONB` and define Composite Indexes for filtering columns.
    - [x] Generate Migrations and implement Backend Seeding in `SeedData.cs`.
    - [x] Implement Service Bus publisher for `PrivilegeModified` immutable audit events.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Database and Core Domain' (Protocol in workflow.md)

## Phase 2: API, Gateway & Enforcement Mechanisms [checkpoint: fcb4b25]
- [x] Task: Privilege Catalog Endpoints & Cache aa7d506
    - [x] Write Integration Tests for server-side pagination, filtering, and distributed cache invalidation.
    - [x] Implement standard `GET`, `POST`, and `PUT` endpoints handling `DbUpdateConcurrencyException` gracefully.
    - [x] Implement distributed cache clearing mechanism when a privilege is modified.
- [x] Task: Security Enforcement and Test Data Management (TDM) 2c594c9
    - [x] Write Integration Tests verifying `403 Forbidden` responses and DPoP header validation at YARP.
    - [x] Implement the non-production "Backdoor API" with a `POST /api/tdm/reset` endpoint for isolated parallel testing.
    - [x] Integrate Risk Level checks to trigger Step-Up Authentication workflows via BFF.
    - [x] Enable DPoP support in OpenIddict.
- [x] Task: Conductor - User Manual Verification 'Phase 2: API, Gateway & Enforcement Mechanisms' (Protocol in workflow.md)

## Phase 3: Angular UI - Privileges Datatable [checkpoint: 8fce4c5]
- [x] Task: Privileges Datatable logic & tests
    - [x] Write Storybook/Vitest logic for the server-side paginated datatable.
    - [x] Write a Playwright E2E Smoke Test verifying datatable loads and paginates without errors.
- [x] Task: Privileges Datatable UI implementation
    - [x] Implement the Datatable UI, filtering out un-licensed Tiles for Tenant Admins.
- [x] Task: Accessibility and Navigation Validation
    - [x] Execute Axe-core accessibility checks and verify keyboard navigation.
- [x] Task: Regression Testing & CI Validation
    - [x] Run `nx affected --target=test,e2e,lint` to ensure no existing tests or lint rules are broken.
    - [x] Run `dotnet format` on backend to ensure strict formatting rules pass.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Angular UI - Privileges Datatable' (Protocol in workflow.md)

## Phase 4: Angular UI - Detail & Edit Forms [checkpoint: 101f39b]
- [x] Task: Privilege Detail and Edit Pages logic & tests d8a2b3c
    - [x] Write component tests verifying the rendering of JIT settings and immutable fields.
    - [x] Write Playwright E2E Smoke Tests for the Form logic (Create/Edit state loading and saving).
- [x] Task: Privilege Detail and Edit Pages implementation a1b2c3d
    - [x] Implement the Create/Edit forms, including conflict resolution UI for concurrency errors.
- [x] Task: Accessibility and Navigation Validation e5f6g7h
    - [x] Execute Axe-core accessibility checks on the form inputs and validation states.
- [x] Task: Regression Testing & CI Validation i9j0k1l
    - [x] Run `nx affected --target=test,e2e,lint` to ensure no existing tests or lint rules are broken.
    - [x] Run `dotnet format` on backend to ensure strict formatting rules pass.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Angular UI - Detail & Edit Forms' (Protocol in workflow.md) [checkpoint: d8a2b3c]

## Phase 5: Spike - SignalR & Authentication Compatibility [checkpoint: fcb4b25]
- [x] Task: Research and Prototype
    - [x] Research and prototype the correct SignalR authentication approach ensuring compatibility with BFF cookies and DPoP.
- [x] Task: Flow and Regression Testing
    - [x] Write an integration test verifying that initializing the SignalR connection does not break or disrupt existing REST API auth flows.
    - [x] Run the complete E2E test suite to ensure the introduction of SignalR components does not cause existing authentication or application flow failures.
- [x] Task: Regression Testing & CI Validation
    - [x] Run `nx affected --target=test,e2e,lint` to ensure no existing tests or lint rules are broken.
    - [x] Run `dotnet format` on backend to ensure strict formatting rules pass.
- [x] Task: Conductor - User Manual Verification 'Phase 5: Spike - SignalR & Authentication Compatibility' (Protocol in workflow.md) [checkpoint: 7a8b9c0]

## Phase 6: Angular UI - Security & Real-Time Directives
- [x] Task: UI Security structural directives
    - [x] Write tests for the `*hasPrivilege` structural directive and Route Guards.
- [x] Task: Real-Time UI updates
    - [x] Implement SignalR listener to handle `PrivilegesChanged` events for immediate UI degradation using the architecture proven in Phase 5.
- [x] Task: Regression Testing & CI Validation
    - [x] Run `nx affected --target=test,e2e,lint` to ensure no existing tests or lint rules are broken.
    - [x] Run `dotnet format` on backend to ensure strict formatting rules pass.
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Angular UI - Security & Real-Time Directives' (Protocol in workflow.md)

## Phase 7: Federation Mock App Setup & E2E Validation
- [x] Task: "DocViewer" Mock App setup
    - [x] Implement a lightweight Dummy App in the QA environment to test cross-module federation.
- [x] Task: Federation E2E Tests
    - [x] Implement Steel Thread E2E tests for Standard CRUD operations and Context Switching.
    - [x] Write E2E test verifying authentication state sharing with the Mock App.
- [x] Task: Conductor - User Manual Verification 'Phase 7: Federation Mock App Setup & E2E Validation' (Protocol in workflow.md)

## Phase 8: Security Penetration & Visual Regression Tests [checkpoint: ac7fdbc]
- [x] Task: Negative Security Testing [checkpoint: a51283b]
    - [x] Implement Negative Security Tests (e.g., API fuzzing, IDOR attempts via API bypassing UI, UI redirection for unauthorized users).
- [x] Task: Visual Layout Stability [checkpoint: a51283b]
    - [x] Implement Visual Regression Snapshots for layout edge cases.
- [x] Task: Conductor - User Manual Verification 'Phase 8: Security Penetration & Visual Regression Tests' (Protocol in workflow.md)

## Phase 9: Service Bus Audit Trail Validation [checkpoint: c71edee]
- [x] Task: Audit Trail Endpoints and Logic ee0a844
    - [x] Expose diagnostic API for fetching audit logs.
    - [x] Ensure `IdentityService` correctly dispatches domain events before save (handled by `PortalDbContext`).
- [x] Task: Audit Trail E2E Test c71edee
    - [x] Implement E2E tests validating the Service Bus audit trail using Correlation IDs and the diagnostic API.
- [ ] Task: Conductor - User Manual Verification 'Phase 9: Service Bus Audit Trail Validation' (Protocol in workflow.md)