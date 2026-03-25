# Knowledge Note: Service Bus & Audit Trail Validation (Phase 9)

## 🏗️ Architectural Hardening: Multi-Layer Event Dispatching

In Phase 9, we implemented a robust, cryptographically verifiable audit trail by integrating Domain Events with our Service Bus logic.

### 1. Immutable Audit Entries with Correlation IDs
We enhanced the `AuditEntry` entity to include a `CorrelationId`. This allows us to map a single user request across multiple layers (Gateway -> API -> Event Handlers -> Service Bus).

- **Implementation:** `ICurrentUserService` was updated to extract the `X-Correlation-ID` header from the HTTP request. This ID is then passed into the `AuditEntry` during creation.
- **Traceability:** Any destructive action (e.g., modifying a privilege) now generates an audit record that can be traced back to the specific UI interaction via the Correlation ID.

### 2. Robust Domain Event Dispatching in EF Core
To ensure audit logs are always written in the same transaction as the data change, we refined the `DispatchDomainEventsAsync` logic in `PortalDbContext`.

- **Proxy Safety:** The dispatcher now uses more robust type checking (`is IHasDomainEvents`) to correctly identify entities even when wrapped by EF Core's change-tracking proxies.
- **MediatR Integration:** Assembly-scanning was updated in `Program.cs` to ensure that handlers located in the `Infrastructure` layer (like `PrivilegeModifiedEventHandler`) are correctly registered and triggered by the `IPublisher`.

### 3. Diagnostic Traceability API
A new diagnostic endpoint `GET /diag/audit-logs/{resourceId}` was exposed. 

- **Purpose:** This endpoint bypasses multi-tenant filters (`IgnoreQueryFilters`) to allow E2E tests to verify the global audit trail.
- **Security:** Like all diagnostic endpoints, it requires a valid `X-Gateway-Secret` to prevent unauthorized access.

### 4. E2E Validation Strategy
The new `privileges-audit.spec.ts` demonstrates the complete validation cycle:
1.  Intercept the outgoing API request and inject a unique `X-Correlation-ID`.
2.  Perform the UI action (e.g., updating a privilege description).
3.  Wait for the redirect back to the catalog.
4.  Query the diagnostic API for the resource's logs.
5.  Assert that a `PrivilegeModified` entry exists with the matching `CorrelationId`.

## 🛡️ Security Lessons Learned
- **Role Consistency:** Discrepancies between seeded roles (`Admin`) and test-seeded roles (`SystemAdmin`) can cause silent authorization failures. Role names should be centralized in constants or strictly synchronized.
- **EF Core Mapping:** Using the `required` keyword on nullable members (`string?`) can sometimes confuse EF Core's internal mapping engine during complex migrations or materialization. Favoring standard properties for optional metadata is often safer.
