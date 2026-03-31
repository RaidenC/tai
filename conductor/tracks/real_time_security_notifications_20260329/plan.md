# Implementation Plan: Real-Time Security Notifications & Audit Dashboard

## Phase 1: Domain Models & Event Abstraction (Pure C#) [checkpoint: dad0be1]
*Objective: Define the data structures and interfaces.*
- [x] Task: Define `SecurityEventBase` and specific domain events (LoginAnomaly, PrivilegeChange) in `libs/core/domain`. dad0be1
- [x] Task: MediatR is used for internal event dispatch (no separate IEventBus needed - YAGNI). dad0be1
- [x] Task: Write xUnit TDD tests verifying domain event instantiation. dad0be1
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) dad0be1

## Phase 2: Database Schema, Partitioning & Indexing (Infrastructure) [checkpoint: 8fe67ba]
*Objective: Prepare the high-performance storage layer with optimized read paths.*
- [x] Task: Implement the Audit Log Entity in `libs/core/infrastructure`. 8fe67ba
- [x] Task: Create EF Core Migration with raw SQL for PostgreSQL Table Partitioning by date. 8fe67ba
- [x] Task: Implement a composite index on `(TenantId, UserId, Date)` to support rapid dashboard querying. 8fe67ba
- [x] Task: Ensure the `Id` field is indexed globally across partitions to support the fast "Claim Check" lookups. 8fe67ba
- [x] Task: Write Integration Test (using TestContainers) to verify bulk inserts and query execution plans. 8fe67ba
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md) 834d81a

## Phase 3: MediatR Handlers & Claim Check Endpoint (Backend Logic)
*Objective: Extend MediatR handlers to push real-time events to SignalR and provide secure detail retrieval.*
- [x] Task: Create MediatR notification handlers for security events (LoginAnomaly, PrivilegeChange, SecuritySettingChange). 9eb9daf
- [x] Task: Inject `IRealTimeNotifier` into handlers to push privacy-first payload (eventId, timestamp) to SignalR. 9eb9daf
- [x] Task: Ensure handlers also publish to IMessageBus for cross-app communication (DocViewer, HR System). 9eb9daf
- [x] Task: Create REST endpoint (`GET /api/audit-logs/{id}`) to fetch full event details (Claim Check pattern). 9eb9daf
- [x] Task: Ensure Global Query Filter provides tenant isolation on the GET endpoint. 9eb9daf
- [ ] Task: Write Integration Tests verifying the handlers push to SignalR and GET endpoint returns correct data.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: SignalR Hub & Gateway Configuration (API & BFF)
*Objective: Expose the secure WebSocket endpoint and proxy it through YARP.*
- [x] Task: Enhance existing `NotificationHub` in `apps/portal-api` with Tenant Group mapping for isolated broadcast channels. 98535c5
- [x] Task: Implement `OnConnectedAsync` to add user to SignalR group based on their TenantId. 98535c5
- [x] Task: Update `apps/portal-gateway` (YARP configuration) to support WebSocket upgrade requests for the Hub route. 98535c5
- [ ] Task: Write Integration Test verifying authenticated WebSocket connections through the Gateway.
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5: Angular SignalR (Zoneless Performance) & Claim Check
*Objective: Establish the client connection without causing Change Detection thrashing.*
- [x] Task: Implement Angular `SignalRService` with automatic reconnection.
- [x] Task: **Front-End Mandate:** Wrap the SignalR connection and event listeners in `NgZone.runOutsideAngular()` to prevent macro-task freezing.
- [x] Task: Implement logic: On receiving an Event ID, trigger an HTTP GET to fetch the full details via the BFF.
- [x] Task: Write Vitest chaos tests simulating connection drops and verifying the Claim Check flow.
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