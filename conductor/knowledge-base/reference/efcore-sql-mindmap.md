---
markmap:
  initialExpandLevel: 3
  colorFreezeLevel: 3
---
# 1. EF Core & SQL

## **1.1. Core Architecture**
1. ORM Fundamentals
   - Bridges C# objects to relational tables
   - Provides compile-time type safety and SQL injection protection
   - Decouples domain logic from specific database providers
2. Deferred Execution & IQueryable
   - Builds in-memory Expression Trees instead of immediate SQL
   - Queries materialize only at terminal operators (e.g., `ToListAsync`)
   - Enables dynamic query composition without RAM overhead
3. Global Query Filters
   - Enforces zero-trust data isolation (e.g., `TenantId`) at the ORM level
   - Prevents accidental cross-tenant data leaks
   - Automatically injected into every SQL `WHERE` clause
4. Change Tracker & SaveChangesAsync
   - Monitors entity state (Added, Modified, Deleted)
   - Enables the Unit of Work pattern for atomic transactions
   - Overridden in `tai-portal` to automate audit fields and event dispatch
5. Persistence Interceptors
   - Acts as database middleware for cross-cutting concerns
   - `TenantInterceptor` automatically stamps `TenantId` on new records
   - Separates infrastructure plumbing from business logic

## **1.2. Advanced Patterns**
1. Domain Event Dispatch
   - Publishes events *before* database commit
   - Ensures side-effects (auditing) join the same transaction
   - Uses MediatR notifications to bridge Domain and Infrastructure layers
2. Optimistic Concurrency (xmin)
   - Uses PostgreSQL's native `xmin` system column as a row version
   - Prevents "lost updates" without using expensive row locks
   - Throws `DbUpdateConcurrencyException` on conflict
3. Strongly-Typed ID Value Converters
   - Eliminates "primitive obsession" by using record wrappers for IDs
   - Maps rich C# types (e.g., `TenantId`) to raw database primitives
   - Enforces domain integrity at the compiler level
4. Range-Based Table Partitioning
   - Physically splits large tables (Audit Logs) by timestamp
   - Improves query performance via automated partition pruning
   - Managed via raw SQL migrations since EF Core lacks native DSL
5. PostgreSQL-Specific Npgsql Features
   - JSONB storage for semi-structured data (JIT settings)
   - GIN indexes for high-speed searching inside JSON documents
   - Advisory locks for distributed coordination (Safe Seeding)

## **1.3. Implementation Patterns**
1. SaveChangesAsync Pipeline
   - Step 1: `PopulateAuditFields` stamps timestamps and user IDs
   - Step 2: `DispatchDomainEvents` publishes to MediatR handlers
   - Step 3: `base.SaveChangesAsync` flushes all changes in one transaction
2. Concurrency Reload Pattern
   - Compares client-provided `RowVersion` with current DB value
   - Uses `ReloadAsync` after successful saves to refresh the token
   - Returns `409 Conflict` to the UI for handling collisions
3. Dynamic Pagination & Sorting
   - Uses pattern matching to map UI strings to LINQ `OrderBy`
   - Chains `Skip` and `Take` on `IQueryable` for server-side paging
   - Combines with `Select` projection to minimize network payload

## **1.4. Infrastructure & Data Strategy**
1. JSONB Strategy
   - Ideal for heterogeneous data like JIT settings/scopes
   - Indexable via GIN indexes for efficient querying
   - Native AOT compatible via `EnableDynamicJson`
2. Distributed Seeding Locks
   - Uses `pg_advisory_lock` to prevent multi-pod seeding races
   - Session-scoped locks ensure only one pod seeds at a time
   - Automatically releases if the connection drops or fails
3. Testcontainers Integration Testing
   - Runs tests against real PostgreSQL, not in-memory fakes
   - Ensures provider-specific features (xmin, JSONB) are verified
   - Uses `Respawner` for lightning-fast database resets between tests
