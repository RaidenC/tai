# Specification: Privileges Management Page & Validation Suite

## Overview
Implementation of a new "Privileges" page in the Portal to act as a system-wide Privilege Catalog using a datatable. The system employs a hierarchical dot notation for privilege identifiers. In alignment with Zero Trust and multi-tenancy principles, the page adapts its capabilities based on the user's role (System Admin vs. Tenant Admin) and the tenant's licensed modules.

## Functional Requirements
1. **Privileges Datatable (The Catalog):**
   - Display a paginated datatable of available privileges.
   - **Pagination & Filtering:** Must implement server-side pagination and filtering to guarantee accuracy across large datasets.
   - **Columns:** Privilege Name, Description, App/Module, Risk Level, Supported Scopes, and Active Status.
   - **Multi-Tenancy Filtering:** Automatically filter out privileges belonging to Apps/Modules ("Tiles") that are not enabled in the current Tenant's Configuration.
   - **Row Actions:** "View" (available to all authorized users). "Edit" (gated strictly to System Admins).

2. **System Admin Actions (Create/Edit):**
   - **Create Privilege:** Gated strictly to `System Admins`. Allows seeding new privileges (e.g., for testing or new deployments).
   - **Edit Privilege:** Gated strictly to `System Admins`. Allows modification of Risk Level, Active Status, and JIT Settings. Privilege Name remains immutable.

3. **Privilege Detail Page (View Mode):**
   - **Basic Details:** Name, Description, App/Module, Active Status.
   - **Supported Scopes:** Display applicable PBAC scopes (e.g., Global, Tenant, Self).
   - **Assigned Roles:** List of roles that currently grant this privilege.
   - **JIT Settings:** Max Elevation Duration, Approval Requirement, Justification Required.
   - **Audit History:** Cryptographically immutable audit trail showing Who changed What (Previous vs. New Value), including a Correlation ID for E2E trace verification.

## Privilege Enforcement Mechanisms
1. **API Strict Enforcement (Negative Test Target):**
   - The .NET API must be the absolute security boundary. If a user attempts an action without the required privilege, the API MUST return a standard `403 Forbidden` (not 500 or 400).
2. **UI Structural Directives:**
   - The Angular application must strictly enforce privileges via DOM removal (e.g., `*hasPrivilege` directives). Unprivileged routes must be protected by Angular Route Guards.
3. **Context-Switching & Session Revocation:**
   - When privileges change mid-session (e.g., changing Tenants or a JIT privilege expiring), the UI must gracefully degrade (e.g., remove the elevated action button). Any subsequent API calls made immediately after expiration MUST fail cleanly, prompting a token refresh or session termination.
4. **Step-Up Authentication Integration:**
   - "High Risk" privileges MUST automatically trigger the BFF/API to demand Step-Up Authentication (MFA prompt) upon access, irrespective of the current session state.

## Test Data Generation & Validation Strategy
To ensure deterministic, automated QA (Playwright/E2E), data will be generated via:
1. **Backend Seeding:** A static dictionary of system privileges in `.NET` (`SeedData.cs`), seeded on startup in Dev/QA environments.
2. **API Fixtures:** Playwright will utilize a non-production "Backdoor API" to dynamically alter privileges for isolated E2E scenarios before UI interaction.
3. **Mock Test App ("DocViewer" Stub):** A lightweight dummy module/endpoint will be created in the testing environment specifically to validate cross-application privilege enforcement and identity federation boundaries.

**Test Data Matrix:**
- **Standard CRUD:** `Portal.Users.Read`, `Portal.Users.Create`, `Portal.Users.Update`, `Portal.Users.Delete`.
- **Module/Tenant Boundary:** `DocViewer.Fax.Send` (verified against the Mock Test App to test licensed vs unlicensed tenant boundaries).
- **JIT & High-Risk:** `Wires.Transfer.Approve` (15 min, Justification required), `System.Settings.Modify` (1 hour, Manager Approval required).
- **Edge Cases:**
  - `Portal.Users.ReallyLongNameThatMightBreakTheUILayout` (UI truncation tests).
  - `A.B.C.D.E.F.G.H.I.J.K` (extreme DB depth and UI rendering).
  - `LegacyApp.OldFeature.Read` (Inactive status ensures it cannot be assigned or grant access).

## Acceptance Criteria
- Given a Playwright test bypassing the UI, hitting an unauthorized API endpoint returns exactly `403 Forbidden`.
- Given a System Admin, the datatable fetches data via server-side pagination/filtering accurately.
- Given a JIT expiration event mid-session, the user immediately loses UI visibility of the action and API calls fail with `403`.
- Given an audit trail check, automated tests can successfully map UI actions to database records using Correlation IDs.
- Given an interaction with the Mock Test App, permissions are correctly evaluated based on the Portal's centralized identity.