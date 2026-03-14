# Specification: User DataTable and Approval Workflow

## 1. Overview
This track focuses on refining the user management experience by introducing a robust, reusable `DataTable` component and implementing an approval workflow for pending users. It also introduces a dedicated "User Detail" page for viewing and editing basic user information, adhering strictly to Domain-Driven Design and Zero-Trust principles.

## 2. Functional Requirements

### 2.1 Reusable DataTable Component (Headless + Tailwind)
- **Location:** Resides in `libs/ui/design-system` as a presentation ("dumb") component.
- **Architecture:** Built using **`@angular/cdk/table`** for structural logic, accessibility primitives, and keyboard navigation. Styled strictly with Tailwind CSS 4.0.
- **Features:**
  - Configurable columns (headers, data binding).
  - Emits events for server-side sorting, filtering, and pagination.
  - **Responsive Layout:** The table must seamlessly fit into different container contexts with gracefully adjustable column widths.
  - **Declarative Row Actions:** Accepts a strict configuration (`TableActionDef<T>`) defining styles and logic. Merely emits an event: `(actionTriggered)="handleAction($event.actionId, $event.row)"`.
  - **Edge States:** 
    - **Loading State:** Must support and define a loading UI (e.g., skeleton rows or spinner).
    - **Empty State:** Must handle cases where `totalCount === 0` (e.g., an illustrative graphic with "No users found").

### 2.2 Generic Confirmation Modal
- **Location:** `libs/ui/design-system`.
- **Architecture:** If not already existing, scaffold a `<tai-confirmation-dialog>` utilizing **`@angular/cdk/dialog`**.
- **Features:** Accessible, reusable confirmation dialog for high-stakes actions like approval.

### 2.3 Users Page Integration & State Management
- **URL-Driven State (Source of Truth):** List parameters (page, sort, filters) MUST be persisted in the URL query parameters. The feature's Signal Store must derive its state from the Router.
- **Pagination & Filter Reset Rule:** Whenever a Filter or Sort parameter changes, the Pagination state must automatically reset to `page=1`.
- **Row Actions Orchestrated by Smart Component:**
  - **View:** Navigates to `/users/:id` in Read-Only mode.
  - **Edit:** Conditionally visible based on `Permissions.Users.Edit`. Navigates to `/users/:id/edit`.
  - **Approve:** Conditionally visible for "Pending" users if the logged-in user possesses `Permissions.Users.Approve`.
- **Approval Workflow (Frontend):** 
  - Smart component orchestrates the process: opens the Confirmation Modal, handles the 'Confirm' event, and dispatches the API call.

### 2.4 User Detail Page
- **Routes:** 
  - Read-Only Mode: `/users/:id`
  - Edit Mode: `/users/:id/edit`
- **Content Sections:**
  - Basic Information: Name, Email, Institution.
    - *Constraint:* "Institution" is Read-Only for Tenant Admins. Modifying a user's institution requires Super Admin privileges.
  - *Note: Sections for Roles, Privileges, and Groups are placeholders for future tracks.*

## 3. Backend & Domain Requirements (DDD & Concurrency)
- **Domain Behavior (Rich Entities):** `ApplicationUser` must manage the approval transition via `public void Approve(TenantAdminId approvedBy)`. This method validates the state and raises a `UserApprovedEvent`.
- **Audit Logging:** An Infrastructure event handler must listen for `UserApprovedEvent` and write an immutable record to the system's Audit Log (TenantAdminId, Timestamp, ApplicationUserId).
- **Optimistic Concurrency Control (HTTP Semantics):** 
  - The API MUST use standard HTTP headers for concurrency.
  - `GET /users/:id` must return an `ETag` header containing the RowVersion.
  - The frontend must capture this and send it back in an `If-Match` header during `PUT` or `PATCH` requests.
  - API returns `409 Conflict` or `412 Precondition Failed` on conflict.
  - **Conflict UI Handling:** When a Concurrency Conflict occurs during an Approval, the UI should display an Error Toast notification (e.g., "This user was modified by another administrator.") AND automatically refresh the table data.
- **Pagination:** API must support **Offset-based pagination** (PageNumber, PageSize).

## 4. Non-Functional Requirements
- **Security:** Ensure all actions are protected by fine-grained RBAC/PBAC checks.
- **Accessibility:** Components must be Axe-core validated via Storybook.
- **Testability (Playwright Hooks):** Require `data-testid` attributes on all interactive elements within the DataTable (rows, column headers for sorting, action dropdowns/buttons, pagination controls) and the Confirmation Modal (confirm/cancel buttons).

## 5. Acceptance Criteria
- [ ] `DataTable` implemented in the design system using `@angular/cdk/table` and Tailwind 4.0.
- [ ] Generic confirmation modal built (if missing) and utilized for Approvals.
- [ ] Users page utilizes the `DataTable` with Offset-based pagination and URL-driven state.
- [ ] Smart component handles the "Approve" action via a Confirmation Modal and API call.
- [ ] API implements Optimistic Concurrency Control using `ETag` and `If-Match` headers.
- [ ] Domain Entity `ApplicationUser` encapsulates approval logic and raises `UserApprovedEvent`.
- [ ] Infrastructure handler logs the approval event to the Audit Log.
- [ ] Clicking "View" navigates to `/users/:id` and "Edit" navigates to `/users/:id/edit`.
- [ ] E2E (Playwright) test added to `apps/portal-web-e2e` validating the URL-driven state (navigating pages, filtering, refreshing the browser, ensuring correct restoration).
- [ ] E2E (Playwright) test added to validate the Approval Workflow (clicking "Approve", modal, API call, UI update).
- [ ] Applying a new filter or sort dynamically resets the URL and table pagination to `page=1`.
- [ ] All interactive elements in the DataTable and Modal contain `data-testid` attributes.

## 6. Out of Scope
- Roles, Privileges, and Group management sections on the User Detail page.