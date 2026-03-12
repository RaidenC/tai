# Track: User DataTable & Approval Workflow - Phase 1 Knowledge Note

## The Enterprise Challenge: Data Integrity & Multi-Tenant Isolation
In an enterprise portal serving multiple financial institutions, the "Domain & Persistence" layer must do more than just store data. It must enforce **Zero-Trust isolation** (preventing Tenant A from seeing Tenant B's data), provide a **tamper-proof audit trail** for compliance, and handle **concurrent operations** gracefully. Phase 1 establishes these foundational "Guardrails" at the deepest level of the system.

## Knowledge Hierarchy

### Junior Level (The "What")
- **Global Query Filters:** A feature in EF Core that automatically appends a `WHERE TenantId = ...` clause to every database query. This ensures developers don't have to remember to filter by tenant manually.
- **Audit Fields:** Standard properties like `CreatedAt` and `LastModifiedBy` that track the lifecycle of a record.
- **Value Objects:** Using types like `TenantId` instead of raw `Guid` to prevent "Primitive Obsession" and ensure type safety (e.g., you can't accidentally pass a `UserId` where a `TenantId` is expected).

### Mid Level (The "How")
- **Automatic Audit Population:** Overriding `SaveChangesAsync` in the `DbContext` to intercept entities implementing `IAuditableEntity`. This ensures audit data is populated consistently without polluting business logic.
- **Domain Events:** Decoupling side effects (like logging an approval to the audit table) from the main action. When a user is approved, the entity raises a `UserApprovedEvent`, which is dispatched and handled by a separate infrastructure service.
- **Shadow Properties / Concurrency Tokens:** Mapping PostgreSQL's `xmin` (system column) to a `RowVersion` property in EF Core to detect if a record was changed by another process between the time it was read and the time it was saved.

### Senior/Principal Level (The "Why")
- **Persistence Ignorance vs. Practicality:** While the Domain layer shouldn't know about EF Core, we use **Advisory Locks** and **Global Query Filters** in the Infrastructure layer to solve complex distributed systems problems (like race conditions during seeding or accidental data leakage) without leaking that complexity into the business logic.
- **Transactional Integrity for Side Effects:** By dispatching Domain Events *inside* the `SaveChangesAsync` transaction, we ensure that if the user update fails, the audit log entry is also rolled back. This maintains a "Single Source of Truth."
- **Performance-First Indexing:** We don't just add filters; we add composite indexes (e.g., `{ TenantId, Timestamp }`) to ensure that as the database grows, the multi-tenant isolation doesn't become a performance bottleneck.

## Deep-Dive Mechanics: The Audit Lifecycle
1. **Request:** A `Tenant Admin` approves a user.
2. **Domain:** The `ApplicationUser` entity updates its state and adds a `UserApprovedEvent` to its internal collection.
3. **Infrastructure:** `PortalDbContext.SaveChangesAsync` is called.
4. **Step 1 (Audit):** `PopulateAuditFields()` sets `LastModifiedBy` to the current admin's ID.
5. **Step 2 (Events):** `DispatchDomainEventsAsync()` finds the `UserApprovedEvent` and publishes it via MediatR.
6. **Step 3 (Log):** An `AuditLogHandler` receives the event and adds a new `AuditEntry` to the Change Tracker.
7. **Commit:** `base.SaveChangesAsync()` executes, saving both the `ApplicationUser` and the `AuditEntry` in a single atomic database transaction.

## Interview Talking Points

### Junior/Mid Responses
- "I implemented a multi-tenant isolation strategy using EF Core Global Query Filters, which provides a centralized safety net against cross-tenant data leakage."
- "I used an interceptor-based approach for audit logging to ensure that every change is tracked automatically without bloating the application service logic."

### Senior/Lead Responses
- "We established a robust concurrency strategy leveraging PostgreSQL system columns, integrated directly into our Clean Architecture persistence layer. This allows us to maintain optimistic locking across the entire application with minimal developer overhead."
- "By using MediatR to dispatch Domain Events within the DbContext transaction lifecycle, we achieved strong eventual consistency for our compliance audit trails while keeping our Domain models pure and focused on business rules."

## March 2026 Market Context
The use of **Strongly Typed Identifiers (Value Objects)** and **Internal Domain Event Dispatching** is the current industry benchmark for "Highly Regulated" software. It moves security and compliance from a "Policy" to a "Compiler/Framework Constraint," which is essential for SOC 2 and PCI DSS compliance in modern fintech.
