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

## Phase 2: API, Gateway & Enforcement Mechanisms [checkpoint: 2c594c9]
- [x] Task: Privilege Catalog Endpoints & Cache aa7d506
    - [x] Write Integration Tests for server-side pagination, filtering, and distributed cache invalidation.
    - [x] Implement standard `GET`, `POST`, and `PUT` endpoints handling `DbUpdateConcurrencyException` gracefully.
    - [x] Implement distributed cache clearing mechanism when a privilege is modified.
- [x] Task: Security Enforcement and Test Data Management (TDM) 2c594c9
    - [x] Write Integration Tests verifying `403 Forbidden` responses and DPoP header validation at YARP.
    - [x] Implement the non-production "Backdoor API" with a `POST /api/tdm/reset` endpoint for isolated parallel testing.
    - [x] Integrate Risk Level checks to trigger Step-Up Authentication workflows via BFF.
    - [x] Enable DPoP support in OpenIddict.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: API, Gateway & Enforcement Mechanisms' (Protocol in workflow.md)

## Phase 3: Angular UI & Component Development
- [ ] Task: Privileges Datatable implementation
    - [ ] Write Storybook/Vitest logic for the server-side paginated datatable.
    - [ ] Implement the Datatable UI, filtering out un-licensed Tiles for Tenant Admins.
    - [ ] Execute Axe-core accessibility checks and verify keyboard navigation.
- [ ] Task: Privilege Detail and Edit Pages
    - [ ] Write component tests verifying the rendering of JIT settings and immutable fields.
    - [ ] Implement the Create/Edit forms, including conflict resolution UI for concurrency errors.
- [ ] Task: UI Security & Real-Time Directives
    - [ ] Write tests for the `*hasPrivilege` structural directive and Route Guards.
    - [ ] Implement SignalR listener to handle `PrivilegesChanged` events for immediate UI degradation.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Angular UI & Component Development' (Protocol in workflow.md)

## Phase 4: E2E Validation & Mock Test App
- [ ] Task: "DocViewer" Mock App setup
    - [ ] Implement a lightweight Dummy App in the QA environment to test cross-module federation.
- [ ] Task: Comprehensive Playwright Suite & Penetration Tests
    - [ ] Implement Steel Thread E2E tests for Standard CRUD operations and Context Switching.
    - [ ] Implement Negative Security Tests (e.g., API fuzzing, IDOR attempts via API bypassing UI).
    - [ ] Implement Visual Regression Snapshots for layout edge cases.
    - [ ] Implement E2E tests validating the Service Bus audit trail using Correlation IDs.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: E2E Validation & Mock Test App' (Protocol in workflow.md)
