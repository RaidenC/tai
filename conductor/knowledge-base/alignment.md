# Architectural Alignment: Users API vs. Privileges API

## Overview
During the implementation of the **Privileges Management** track (March 2026), a set of high-concurrency and performance patterns was established for administrative APIs. To ensure system-wide consistency, the **Users API** should be refactored to align with these patterns.

## Identified Alignment Points

### 1. Unified Pagination Model
*   **Current State:** Both APIs now share the `PaginatedList<T>` record in `Tai.Portal.Core.Application.Models`.
*   **Next Step:** Ensure all future list-based endpoints (Audit Logs, Tenants) adopt this structure to allow the Angular frontend to use generic `SignalStore` logic for data tables.

### 2. High-Concurrency Handling (Optimistic Locking)
*   **Established Pattern:** The Privileges API uses the PostgreSQL `xmin` column (mapped as `uint RowVersion` in EF Core) and performs a manual "Fail-Fast" check in the Infrastructure service layer before committing updates.
*   **Requirement for Users API:** 
    *   Transition `IdentityService.cs` from relying solely on `UserManager.UpdateAsync` internal stamps to an explicit `RowVersion` check.
    *   Ensure the `UpdateUserCommand` includes the `RowVersion` and that the controller returns a `409 Conflict` when a mismatch is detected.

### 3. Distributed/Local Caching Strategy
*   **Established Pattern:** `PrivilegeService.cs` uses `IMemoryCache` (for the POC) with reactive invalidation. It caches:
    *   The first page (skip=0, take=10) of the list with no search.
    *   Individual lookups by ID.
*   **Requirement for Users API:** 
    *   Introduce `IMemoryCache` into `IdentityService.cs`.
    *   Implement immediate cache removal/purging in `UpdateUserAsync`, `ActivateUserAsync`, and `DeactivateUserAsync`.
    *   Consider tenant-specific cache keys: `Users_List_{TenantId}`.

### 4. Controller Security Standards
*   **Established Pattern:** Standardized `X-Gateway-Secret` validation and consistent MediatR dispatching.
*   **Requirement for Users API:** Audit existing controllers to ensure they follow the exact same security middleware and dependency injection patterns.

---
*Created March 16, 2026, during Phase 2 of the Privileges Management Track.*
