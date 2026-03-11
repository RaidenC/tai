# Implementation Plan: User DataTable and Approval Workflow

## Phase 1: Backend Domain & Persistence
- [ ] Task: Update `ApplicationUser` Domain Entity
    - [ ] Write failing unit test for `Approve` method (validates pending state, raises event).
    - [ ] Implement `Approve(TenantAdminId approvedBy)` method in `ApplicationUser`.
    - [ ] Define `UserApprovedEvent`.
- [ ] Task: Implement Optimistic Concurrency Token
    - [ ] Update `ApplicationUser` configuration in EF Core to include `RowVersion` / `ETag`.
    - [ ] Generate and apply EF Core Migration.
- [ ] Task: Audit Logging Infrastructure
    - [ ] Write failing integration test for handling `UserApprovedEvent`.
    - [ ] Implement Infrastructure event handler to listen for `UserApprovedEvent` and write to Audit Log table.
- [ ] Task: Conductor - User Manual Verification 'Backend Domain & Persistence' (Protocol in workflow.md)

## Phase 2: Backend Application & API
- [ ] Task: Update Pagination API Contract
    - [ ] Ensure the Users Query UseCase supports Offset-based pagination (PageNumber, PageSize).
- [ ] Task: Implement Concurrency in Users Controller
    - [ ] Write failing integration test for `GET /users/:id` returning `ETag` header.
    - [ ] Update `GET /users/:id` endpoint to return `ETag`.
    - [ ] Write failing integration test for `PUT/PATCH` actions handling `If-Match` header.
    - [ ] Update approval and edit endpoints to validate `If-Match` and return `409/412` on conflict.
- [ ] Task: Conductor - User Manual Verification 'Backend Application & API' (Protocol in workflow.md)

## Phase 3: Frontend Design System (CDK Table & Modal)
- [ ] Task: Generic Confirmation Modal
    - [ ] Check `libs/ui/design-system` for existing confirmation modal.
    - [ ] If missing, build `<tai-confirmation-dialog>` using `@angular/cdk/dialog` and Tailwind CSS 4.0.
    - [ ] Add Storybook stories and interaction tests (Axe-core validation).
- [ ] Task: Headless DataTable Component
    - [ ] Create `DataTableComponent` using `@angular/cdk/table` in `libs/ui/design-system`.
    - [ ] Implement generic columns, data binding, sorting, and pagination inputs/outputs.
    - [ ] Implement Declarative Row Actions (`TableActionDef<T>`) emitting `actionTriggered`.
    - [ ] Add Empty State and Loading State UI.
    - [ ] Add Storybook stories with Axe-core validation.
    - [ ] Ensure `data-testid` attributes exist on all interactive elements.
- [ ] Task: Conductor - User Manual Verification 'Frontend Design System' (Protocol in workflow.md)

## Phase 4: Frontend Users Feature (Integration)
- [ ] Task: Regenerate API Client
    - [ ] Run the workspace API client generation script to sync frontend types with the new Phase 2 API contracts (Offset pagination, ETag headers).
- [ ] Task: URL-Driven State Management
    - [ ] Write failing Vitest tests for Signal Store deriving state from Router query params (page, sort, filters).
    - [ ] Implement Signal Store logic for URL syncing.
    - [ ] Implement rule: Changing Filter or Sort resets pagination to `page=1`.
- [ ] Task: Integrate DataTable into Users Page
    - [ ] Replace existing list UI with `<tai-data-table>`.
    - [ ] Bind server-side pagination, sorting, and filtering state.
- [ ] Task: Implement Approval Workflow Orchestration
    - [ ] Listen to `actionTriggered` for "Approve".
    - [ ] Open `<tai-confirmation-dialog>` and handle confirmation.
    - [ ] Dispatch API call passing `If-Match` ETag.
    - [ ] Implement Conflict UI Handling (catch 409/412, show Error Toast, auto-refresh table).
- [ ] Task: Conductor - User Manual Verification 'Frontend Users Feature' (Protocol in workflow.md)

## Phase 5: Frontend User Detail Feature
- [ ] Task: User Detail Read-Only View
    - [ ] Implement `/users/:id` route in `libs/features/users`.
    - [ ] Display basic info (Name, Email, Institution) and placeholders for Roles/Privileges/Groups.
- [ ] Task: User Detail Edit View
    - [ ] Implement `/users/:id/edit` route.
    - [ ] Implement form for editing Name and Email.
    - [ ] Enforce UI constraint: Institution field is Read-Only for Tenant Admins (verify privilege before rendering as editable).
    - [ ] Dispatch update API call with `If-Match` header and handle conflicts.
- [ ] Task: Conductor - User Manual Verification 'Frontend User Detail Feature' (Protocol in workflow.md)

## Phase 6: E2E Playwright Testing
- [ ] Task: URL State and Navigation E2E
    - [ ] Write Playwright test in `apps/portal-web-e2e` for navigating pages, filtering, and refreshing the browser to ensure state restoration.
- [ ] Task: Approval Workflow E2E
    - [ ] Write Playwright test validating the complete approval flow (click Approve -> modal -> confirm -> API verify -> UI update).
- [ ] Task: Conductor - User Manual Verification 'E2E Playwright Testing' (Protocol in workflow.md)