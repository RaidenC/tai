# Knowledge Note: Frontend Users Feature (Integration)
## Track: User DataTable and Approval Workflow - Phase 4

### Overview
Integration of the backend Users API with the frontend Design System components to deliver a fully functional User Directory and Approval Workflow. This phase emphasized state management using Angular Signals and the enforcement of optimistic concurrency using ETag tokens.

### Key Architectural Decisions

#### 1. Signal-Based State Management (Store Pattern)
- **UsersStore:** Implemented a lightweight "Store" using Angular Signals rather than @ngrx/signals to minimize boilerplate while maintaining a clean reactive API.
- **Isolating State:** Segregated user list state from the onboarding flow to ensure clear domain boundaries.
- **Computed Success/Error States:** Used `computed()` signals to derive UI states (`isLoading`, `isError`), ensuring the template remains logic-free.

#### 2. Concurrency Control with ETag (xmin)
- **Backend Sync:** Updated the DTOs to include the PostgreSQL `xmin` (RowVersion) as a `uint`.
- **Precondition Header:** Configured the `UsersService` to pass this version in the `If-Match` header during approval requests.
- **Backend Validation:** The API validates the `If-Match` token against the current database state, returning `409 Conflict` if the record was modified by another administrator.

#### 3. Accessible Action UI (CDK Menu)
- **Dropdown Pattern:** Refactored row actions into an accessible dropdown menu using `@angular/cdk/menu`. This handles overflow better than inline buttons and follows enterprise application patterns.
- **Predicate-Based Visibility:** Actions like "Approve Registration" are dynamically shown only for users with the `PendingApproval` status using the table's `visible` predicate.

### Technical Implementation Details

#### UsersService & Store
- **Paginated API:** Integrated the offset-based pagination (`pageNumber`, `pageSize`) provided by the backend.
- **Optimistic UI:** The store triggers a `loadUsers()` refresh immediately after a successful `204 No Content` approval response to keep the UI in sync.

#### UsersPage Integration
- **Smart Component Logic:** Orchestrates the opening of the `ConfirmationDialogComponent` and dispatches actions to the store.
- **Routing:** Registered the `/users` route with `authGuard` protection.

### Verification Standards (March 2026)
- **Code Coverage Target:** Achieved **82.02%** statement coverage for `portal-web`, exceeding the project's 80% threshold.
- **Unit Testing:** Verified state transitions for:
    - Successful and failed API fetches.
    - Approval confirmation vs. cancellation logic.
    - Pagination boundary conditions (next/prev disabling).
- **Integration Check:** Confirmed `204 No Content` is received upon successful approval and that the `If-Match` header is correctly quoted.

### Common Pitfalls & Solutions
- **Problem:** Mismatch in status strings (e.g., `Pending` vs. `PendingApproval`).
- **Solution:** Always verify frontend visibility logic against the Domain Enum strings from the backend.
- **Problem:** Complex mocks for `CDK Dialog` in unit tests causing `Cannot read properties of undefined (reading 'find')`.
- **Solution:** Use `TestBed.overrideComponent` to remove the `DialogModule` and provide a clean `Dialog` mock at the component level.
