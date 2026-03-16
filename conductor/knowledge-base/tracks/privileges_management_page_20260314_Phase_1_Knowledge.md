# Knowledge Note: Privileges Catalog Implementation - Phase 1 (Database & Core Domain)

## The Enterprise Challenge
In a high-security Fintech portal, permissions cannot be simple strings or flat lists. They must be structured, auditable, and adaptive to multi-tenancy licensing. The challenge was to implement a **Global Privilege Catalog** that supports:
1. **Hierarchical Governance:** Enforcing "App.Resource.Action" dot notation to prevent naming collisions.
2. **Zero Trust Integration:** Metadata for Risk Levels and JIT elevation durations.
3. **Multi-Tenancy Filtering:** Capabilities to filter global privileges based on tenant-specific licensed "Tiles".
4. **Immutable Audit Trails:** Every change to a security-critical privilege must be cryptographically immutable and traceable via Correlation IDs.

## Knowledge Hierarchy

### Junior Level (The "What")
- **Strongly-Typed IDs:** Using `PrivilegeId` (a `record struct` wrapping a `Guid`) instead of a raw `Guid` prevents primitive obsession and accidental ID swapping.
- **Enums for Strategy:** Using `RiskLevel` and `PrivilegeScope` enums allows the system to make logic decisions (like triggering MFA) based on metadata.
- **EF Core JSONB Mapping:** Using PostgreSQL's `jsonb` type for `JitSettings` and `SupportedScopes` allows us to store complex objects in a single column while maintaining the ability to query inside them.

### Mid Level (The "How")
- **Domain Invariants:** The `Privilege` constructor and methods (like `SetRiskLevel`) enforce business rules *before* data persistence.
- **Optimistic Concurrency:** We mapped the `RowVersion` to the PostgreSQL system column `xmin` (`xid` type). This ensures that if two admins edit a privilege at the same time, the second one will receive a `DbUpdateConcurrencyException`, preventing "Lost Updates".
- **Idempotent Seeding:** `SeedData.cs` was updated using a PostgreSQL **Advisory Lock** (`pg_advisory_lock(424242)`). This prevents race conditions during parallel CI/CD test runs where multiple processes might try to seed the same database simultaneously.

### Senior/Principal Level (The "Why")
- **Event-Driven Auditing:** Instead of just updating a table, the `Privilege` entity implements `IHasDomainEvents`. When modified, it records a `PrivilegeModifiedEvent`.
- **Decoupled Messaging:** An infrastructure handler bridges these Domain Events to an `IMessageBus`. This allows for side effects (like cache invalidation or SIEM logging) to happen asynchronously and outside the primary transaction boundary.
- **Clean Architecture Boundaries:** By defining `IMessageBus` in the Application layer and `LoggingMessageBus` in Infrastructure, we ensure the core logic remains portable. We can swap console logging for **MassTransit** or **Azure Service Bus** without touching the Domain model.

## Deep-Dive Mechanics
1. **The Save Lifecycle:** `PortalDbContext.SaveChangesAsync` was enhanced to first process auditable fields, then dispatch domain events, and finally commit the transaction.
2. **PostgreSQL JSONB:** Mapping `List<PrivilegeScope>` to `jsonb` in EF Core 10 provides a perfect balance between relational integrity and document-store flexibility.

## Interview Talking Points (Tiered)
- **Junior:** "I used C# 14 record structs for strongly-typed identifiers and ensured that all privilege names follow a strict hierarchical dot notation through domain-level validation."
- **Mid:** "I implemented optimistic concurrency using the PostgreSQL `xmin` hidden column and configured EF Core to handle complex JIT settings as JSONB, ensuring the schema remains flexible yet performant."
- **Senior:** "I architected an event-driven audit system where privilege modifications trigger domain events. These are intercepted by an infrastructure handler that records immutable logs and publishes integration events to a message bus, maintaining strict decoupling between security logic and infrastructure implementation."

## March 2026 Market Context
In the 2026 Fintech landscape, **Zero Standing Privileges (ZSP)** is the gold standard. Our implementation of JIT metadata and Risk-based Step-Up Auth triggers directly aligns with modern compliance mandates (SOC 2 Type II and PCI-DSS 4.0), where standing access is considered a primary attack vector.
