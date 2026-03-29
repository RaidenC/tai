# Implementation Plan: Real-Time Security Notifications & Audit Dashboard

## Phase 1: Domain Models & Event Abstraction (Pure C#) [checkpoint: dad0be1]
*Objective: Define the data structures and interfaces.*
- [x] Task: Define `SecurityEventBase` and specific domain events (LoginAnomaly, PrivilegeChange) in `libs/core/domain`. dad0be1
- [x] Task: Define `IEventBus` interface in `libs/core/application`. dad0be1
- [x] Task: Write xUnit TDD tests verifying domain event instantiation. dad0be1
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) dad0be1

## Phase 2: Database Schema, Partitioning & Indexing (Infrastructure) [checkpoint: 8fe67ba]
*Objective: Prepare the high-performance storage layer with optimized read paths.*
- [x] Task: Implement the Audit Log Entity in `libs/core/infrastructure`. 8fe67ba
- [x] Task: Create EF Core Migration with raw SQL for PostgreSQL Table Partitioning by date. 8fe67ba
- [x] Task: Implement a composite index on `(TenantId, UserId, Date)` to support rapid dashboard querying. 8fe67ba
- [x] Task: Ensure the `Id` field is indexed globally across partitions to support the fast "Claim Check" lookups. 8fe67ba
- [x] Task: Write Integration Test (using TestContainers) to verify bulk inserts and query execution plans. 8fe67ba
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md) 8fe67ba

## Phase 3: The Event Consumer & API Endpoint (Backend Logic)
*Objective: Build the background processor and the secure "Claim Check" retrieval endpoint.*
- [ ] Task: Implement `SecurityEventConsumer` as an `IHostedService` in `apps/portal-api`.
- [ ] Task: Create a secure REST endpoint (`GET /api/audit-logs/{id}`) to fetch event details (The Claim Check).
- [ ] Task: Write Integration Tests verifying the HostedService and the GET endpoint with tenant isolation.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: SignalR Hub & Gateway Configuration (API & BFF)
*Objective: Expose the secure WebSocket endpoint and proxy it through YARP.*
- [ ] Task: Create `SecurityNotificationHub` in `apps/portal-api`.
- [ ] Task: Implement Tenant Group mapping in the Hub to ensure isolated broadcast channels.
- [ ] Task: Update `apps/portal-gateway` (YARP configuration) to support WebSocket upgrade requests for the Hub route.
- [ ] Task: Write Integration Test verifying authenticated WebSocket connections through the Gateway.
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5: Angular SignalR (Zoneless Performance) & Claim Check
*Objective: Establish the client connection without causing Change Detection thrashing.*
- [ ] Task: Implement Angular `SignalRService` with automatic reconnection.
- [ ] Task: **Front-End Mandate:** Wrap the SignalR connection and event listeners in `NgZone.runOutsideAngular()` to prevent macro-task freezing.
- [ ] Task: Implement logic: On receiving an Event ID, trigger an HTTP GET to fetch the full details via the BFF.
- [ ] Task: Write Vitest chaos tests simulating connection drops and verifying the Claim Check flow.
- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

## Phase 6: Angular SignalStore & Idempotency (Frontend State)
*Objective: Manage the incoming stream of events efficiently using Signals.*
- [ ] Task: Create `NotificationSignalStore` (using `@ngrx/signals`).
- [ ] Task: Implement idempotency logic (preventing duplicate event processing).
- [ ] Task: Write Vitest tests verifying the store's state transitions.
- [ ] Task: Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)

## Phase 7: The Data Table & Toast UX (Frontend Components)
*Objective: Build the visual layer with performance and UX in mind.*
- [ ] Task: Build the high-performance, virtualized Audit Log Data Table in `libs/ui/design-system`.
- [ ] Task: Add subtle CSS animations to highlight newly inserted rows (UX Polish).
- [ ] Task: Build a non-blocking "Toast" notification component for critical security alerts.
- [ ] Task: Write Storybook Interaction Test (`play` function) verifying rendering, virtualization performance, and accessibility (Axe).
- [ ] Task: Conductor - User Manual Verification 'Phase 7' (Protocol in workflow.md)

## Phase 8: Integration & E2E Validation (The Steel Thread)
*Objective: Tie the UI to the State and prove the system works end-to-end without flake.*
- [ ] Task: Integrate the Data Table and Toast system into the User and Tenant Management views.
- [ ] Task: Write Playwright E2E Test: Trigger an event in Context A, verify toast/table updates in an authenticated browser Context B using web-first assertions.
- [ ] Task: Conductor - User Manual Verification 'Phase 8' (Protocol in workflow.md)