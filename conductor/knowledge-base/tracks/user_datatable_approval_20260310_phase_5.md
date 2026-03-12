# Knowledge Note: Frontend User Detail Feature
## Track: User DataTable and Approval Workflow - Phase 5

### Overview
Implementation of the User Detail view, supporting both read-only profile display and administrative editing. This phase introduced the `firstName` and `lastName` properties to the `ApplicationUser` domain model and integrated them throughout the stack, from the database to the reactive forms in the UI.

### Key Architectural Decisions

#### 1. Domain Model Expansion
- **Profile Integrity:** Added `FirstName` and `LastName` to the `ApplicationUser` entity. This transition moves the system away from using the email as a primary display name, allowing for a more professional and personalized user directory.
- **Backend Migration:** Added an EF Core migration to synchronize the PostgreSQL schema. Handled a schema drift scenario where columns existed in the environment but not in the migration history by using a "no-op" synchronization migration.

#### 2. Full-Stack Data Mapping
- **DTO Evolution:** Updated `UserDto` and `UserDetailDto` to carry granular name properties.
- **Backend Handlers:** Updated registration and query handlers to correctly map these new domain properties.
- **Frontend Interfaces:** Refactored the `User` and `UserDetail` TypeScript interfaces to reflect the granular backend contracts.

#### 3. Dual-Mode Page Component (`UserDetailPage`)
- **Signal-Based View Logic:** Used an `isEditing` signal to toggle between a polished read-only "Profile Card" and a reactive edit form.
- **Route-Driven State:** Integrated the `ActivatedRoute` to support deep-linking directly into edit mode via query parameters (e.g., `/users/{id}?edit=true`).
- **Reactive Form Integration:** Leveraged `FormBuilder` for validation and the `effect()` API to ensure the form remains in sync with the signal-based store as data is loaded.

#### 4. Concurrency-Safe Updates
- **If-Match Enforcement:** Integrated the `updateUser` workflow with the `xmin` RowVersion token. The UI passes the token in the `If-Match` header, ensuring that an administrator cannot overwrite changes made by another admin simultaneously.

### Technical Implementation Details

#### UserDetailPage
- **Zero-Trust Styling:** Built the profile layout using high-performance Tailwind 4.0 gradients and grid layouts, avoiding any dynamic style bindings.
- **Avatar Generation:** Implemented a simple, declarative initials-based avatar using the new granular name signals.

#### UsersStore
- **Single-Source State:** Added `selectedUser` signal and `loadUser`/`updateUser` methods to the store, centralizing all user-related state logic.

### Verification Standards (March 2026)
- **Code Coverage:** Maintained **80.09%** statement coverage for `portal-web`.
- **Unit Testing:**
    - Verified that navigating with `?edit=true` correctly initializes the edit mode.
    - Verified form validation prevents saving invalid name or email data.
    - Verified that `updateUser` correctly dispatches the `rowVersion` concurrency token.
- **Linting:** Verified 100% compliance with `@angular-eslint` rules, including strict label-control association.

### Common Pitfalls & Solutions
- **Problem:** Database "Column already exists" error during migration.
- **Solution:** If the environment state has drifted, use a no-op migration to update the EF Core Model Snapshot without attempting to execute redundant DDL.
- **Problem:** `name` property usage in legacy tests.
- **Solution:** Refactor all occurrences of `name` to `${firstName} ${lastName}` to maintain data integrity across the test suite.
