# Implementation Plan: User DataTable and Approval Workflow

## Phase 1: Backend Domain & Persistence [checkpoint: f5b5843]
- [x] Task: Update `ApplicationUser` Domain Entity
    - [x] Write failing unit test for `Approve` method (validates pending state, raises event).
    - [x] Implement `Approve(TenantAdminId approvedBy)` method in `ApplicationUser`.
    - [x] Define `UserApprovedEvent`.
- [x] Task: Implement Optimistic Concurrency Token
    - [x] Update `ApplicationUser` configuration in EF Core to include `RowVersion` / `ETag`.
    - [x] Generate and apply EF Core Migration. (Proposed)
- [x] Task: Audit Logging Infrastructure
    - [x] Write failing integration test for handling `UserApprovedEvent`.
    - [x] Implement Infrastructure event handler to listen for `UserApprovedEvent` and write to Audit Log table.
- [x] Task: Implement Change Tracking (Audit Fields)
    - [x] Define `IAuditableEntity` interface.
    - [x] Add `CreatedAt`, `CreatedBy`, `LastModifiedAt`, `LastModifiedBy` to `ApplicationUser` and `Tenant`.
    - [x] Implement automatic population of audit fields in `PortalDbContext.SaveChangesAsync`.
    - [x] Register `ICurrentUserService` and `IHttpContextAccessor` in `Program.cs`.
- [x] Task: Conductor - User Manual Verification 'Backend Domain & Persistence' (Protocol in workflow.md) f5b5843

## Phase 2: Backend Application & API [checkpoint: f5b5843]
- [x] Task: Update Pagination API Contract [c091a91]
    - [x] Ensure the Users Query UseCase supports Offset-based pagination (PageNumber, PageSize).
- [x] Task: Implement Concurrency in Users Controller [c091a91]
    - [x] Write failing integration test for `GET /users/:id` returning `ETag` header.
    - [x] Update `GET /users/:id` endpoint to return `ETag`.
    - [x] Write failing integration test for `PUT/PATCH` actions handling `If-Match` header.
    - [x] Update approval and edit endpoints to validate `If-Match` and return `409/412` on conflict.
- [x] Task: Conductor - User Manual Verification 'Backend Application & API' (Protocol in workflow.md) f5b5843

## Phase 3: Frontend Design System (CDK Table & Modal) [checkpoint: 2141654]
- [x] Task: Generic Confirmation Modal [2a35980]
    - [x] Check `libs/ui/design-system` for existing confirmation modal.
    - [x] If missing, build `<tai-confirmation-dialog>` using `@angular/cdk/dialog` and Tailwind CSS 4.0.
    - [x] Add Storybook stories and interaction tests (Axe-core validation).
- [x] Task: Headless DataTable Component [c4bc409]
    - [x] Create `DataTableComponent` using `@angular/cdk/table` in `libs/ui/design-system`.
    - [x] Implement generic columns, data binding, sorting, and pagination inputs/outputs.
    - [x] Implement Declarative Row Actions (`TableActionDef<T>`) emitting `actionTriggered`.
    - [x] Add Empty State and Loading State UI.
    - [x] Add Storybook stories with Axe-core validation.
    - [x] Ensure `data-testid` attributes exist on all interactive elements.
- [x] Task: Conductor - User Manual Verification 'Frontend Design System' (Protocol in workflow.md) 2141654

## Phase 4: Frontend Users Feature (Integration) [checkpoint: 65d6e1b]
- [x] Task: Implement UsersService and UsersStore
    - [x] Created `UsersService` to handle API communication (Pagination, ETag/xmin).
    - [x] Created `UsersStore` for signal-based state management.
- [x] Task: Integrate DataTable into Users Page
    - [x] Replaced existing list UI with `<tai-data-table>`.
    - [x] Bound server-side pagination, sorting, and filtering state.
- [x] Task: Implement Approval Workflow Orchestration
    - [x] Listened to `actionTriggered` for "Approve".
    - [x] Opened `<tai-confirmation-dialog>` and handled confirmation.
    - [x] Dispatched API call passing `If-Match` ETag.
- [x] Task: Conductor - User Manual Verification 'Frontend Users Feature' (Protocol in workflow.md) 74a6a02

## Phase 5: Frontend User Detail Feature [checkpoint: Phase 5 complete]
- [x] Task: User Detail Read-Only View
    - [x] Implemented `/users/:id` route in `apps/portal-web`.
    - [x] Displayed basic info (FirstName, LastName, Email, Status, Institution).
- [x] Task: User Detail Edit View
    - [x] Implemented toggleable edit mode using signals.
    - [x] Implemented form for editing Name and Email with reactive validation.
    - [x] Enforced UI constraint: Institution field is strictly Read-Only.
    - [x] Dispatched update API call with `If-Match` header and handled optimistic concurrency.
- [x] Task: Conductor - User Manual Verification 'Frontend User Detail Feature' (Protocol in workflow.md)

## Phase 6: E2E Playwright Testing [checkpoint: d297dce]
- [x] Task: URL State and Navigation E2E
    - [x] Write Playwright test in `apps/portal-web-e2e` for navigating pages, filtering, and refreshing the browser to ensure state restoration.
- [x] Task: Approval Workflow E2E
    - [x] Write Playwright test validating the complete approval flow (click Approve -> modal -> confirm -> API verify -> UI update).
- [x] Task: Conductor - User Manual Verification 'E2E Playwright Testing' (Protocol in workflow.md)