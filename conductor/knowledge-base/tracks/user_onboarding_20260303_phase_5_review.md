# Phase 5 Review: Onboarding & Identity Integration

## Status Overview
Phase 5 successfully integrated the onboarding UI into the Portal shell, established the "Clean Root" authority strategy for OIDC, and resolved critical Gateway routing issues for the `/Account` and `/identity` paths.

## Key Achievements
- **BFF Alignment:** Resolved 404 errors by adding `/Account` routes to the Gateway, allowing the API to remain "clean" while the browser transitions seamlessly to the Identity UI.
- **Dynamic Authority:** Configured `app.config.ts` to use the root domain (e.g., `localhost:5217`) as the authority, enabling OpenIddict to dynamically resolve tenant issuers via `X-Forwarded-Host`.
- **Users Directory:** Implemented a new `UsersController` and `GetUsersQuery` to allow Tenant Admins to view their staff/customer directory.
- **Onboarding UX:** Added a "Create New Account" button to the login screen and implemented a dedicated `create-passkey` landing page after activation.

## Identified Testing Gaps (Target for Backfilling)
### Backend
- `GetUsersQueryHandler`: No unit tests for filtering and tenant isolation logic.
- `OnboardingController.Verify`: No integration test for the `/api/onboarding/verify` HTTP endpoint.
- `UsersController`: No integration tests for the `/api/Users` directory endpoint.

### Frontend
- Page Components: `register.page`, `verify.page`, `approvals.page`, `users.page` lack `.spec.ts` unit tests.
- Navigation Guard: `navigation.guard.ts` lacks unit tests.

## Architectural Notes
- **DPoP Implementation:** The `dpop.interceptor.ts` was updated to explicitly set the `Authorization: DPoP <token>` header, ensuring compatibility with strict OpenIddict requirements.
- **Tenant Isolation:** The `UsersController` correctly utilizes the `GetUsersQuery` which is subject to the Global Query Filters in `PortalDbContext`.
