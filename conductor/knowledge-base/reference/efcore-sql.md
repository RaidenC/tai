---
title: EF Core & SQL
difficulty: L1 | L2 | L3
lastUpdated: 2026-03-31
relatedTopics:
  - CSharp-Fundamentals
  - Data-Structures-Algorithms
  - System-Design
---

## TL;DR

Entity Framework Core (EF Core 10) is the standard Object-Relational Mapper (ORM) for modern .NET applications. It translates C# LINQ queries into optimized SQL. For interviews, you must understand how `IQueryable` builds expression trees (deferred execution), how Global Query Filters enforce multi-tenancy, and how to prevent N+1 query performance disasters using eager loading (`.Include()`) or query splitting (`.AsSplitQuery()`). 

## Deep Dive

### Concept Overview

#### 1. Why use an ORM (Entity Framework Core)?
- **Explanation:** An ORM (Object-Relational Mapper) bridges the gap between Object-Oriented Programming (C# classes) and Relational Databases (SQL tables).
- **Why / When to use:** Instead of writing raw SQL strings (`SELECT * FROM Users WHERE Id = 1`) and manually mapping the returned data to C# objects using a `SqlDataReader`, EF Core allows you to work purely with C# objects and LINQ. 
- **Trade-offs:** 
  - *Pros:* Massive developer velocity, strong compile-time type safety (if you rename a column, the compiler catches errors, whereas raw SQL strings fail at runtime), built-in SQL injection protection, and database agnosticism (easily switch between PostgreSQL and SQL Server).
  - *Cons:* "Leaky abstraction." If you don't understand the SQL EF Core is generating behind the scenes, you can easily create severe performance bottlenecks (like the N+1 problem or pulling millions of rows into memory).

#### 2. Deferred Execution & `IQueryable`
- **Explanation:** When you write a LINQ query against a `DbSet` (like `_dbContext.Users.Where(u => u.IsActive)`), EF Core does *not* execute it immediately. It builds an **Expression Tree** representing the query.
- **How it works:** The query is only translated to SQL and executed when you enumerate the results (e.g., calling `.ToList()`, `.Count()`, or iterating with a `foreach` loop). This is called Deferred Execution.
- **Why it matters:** It allows you to dynamically chain conditions (adding `.Skip()` and `.Take()` for pagination) before sending a single, highly optimized query to the database, preventing massive amounts of data from being loaded into memory unnecessarily.

#### 3. PostgreSQL Optimization & DB Essentials (Npgsql)
- **Explanation:** `tai-portal` uses PostgreSQL. While EF Core abstracts the database, leveraging PostgreSQL-specific features is essential for scale.
- **Essentials:**
  - **Query Splitting (`.AsSplitQuery()`):** When using multiple `.Include()` calls on collections, standard SQL creates a massive Cartesian product (duplicating parent row data for every child row). `.AsSplitQuery()` tells EF Core to execute separate, smaller SQL queries and stitch them together in memory, saving massive network bandwidth.
  - **Sequential GUIDs (v7):** Standard `Guid.NewGuid()` creates random IDs, which heavily fragment PostgreSQL B-Tree indexes, destroying insert performance over time. Npgsql automatically generates **Version 7 GUIDs**, which are sequential (time-based), drastically improving database indexing and write speeds.
  - **JSONB & GIN Indexes:** Storing semi-structured data in PostgreSQL's native `jsonb` columns allows EF Core to query inside the JSON. Applying a GIN (Generalized Inverted Index) makes these queries nearly as fast as querying standard relational columns.
  - **Bulk Operations:** For massive data ingestion (like migrating 1 million users), standard `_dbContext.Add()` is too slow because it tracks every object. You bypass EF Core's tracker and use `ExecuteUpdateAsync`/`ExecuteDeleteAsync` for bulk mutations, or the Npgsql `BinaryImporter` (`COPY` command) for raw ingestion speed.

#### 4. Eager, Explicit, and Lazy Loading
- **Explanation:** How EF Core loads related data (e.g., loading a `User` and their associated `Privileges`).
- **How it works:**
  - **Eager Loading:** Uses `.Include(u => u.Privileges)`. Generates a single SQL `JOIN` to fetch everything at once.
  - **Explicit Loading:** Fetches the main entity first, then explicitly loads the relation later via `_context.Entry(user).Collection(u => u.Privileges).Load()`.
  - **Lazy Loading:** Automatically fetches related data the moment the navigation property is accessed. (Generally considered an anti-pattern in modern web APIs due to the N+1 problem).

#### 3. Global Query Filters
- **Explanation:** LINQ conditions applied automatically to *every* query executed against a specific entity type within the `DbContext`.
- **How it works:** Configured in `OnModelCreating` using `builder.Entity<T>().HasQueryFilter()`. 
- **Why / When to use:** Crucial for **Multi-Tenancy** (ensuring Tenant A can never accidentally query Tenant B's data) and **Soft Deletes** (hiding records where `IsDeleted == true`).

#### 4. EF Core 10 / .NET 10 Features (2025/2026)
- **Native Vector Search:** EF Core 10 natively supports the SQL Server 2025 `vector` data type. You can perform semantic similarity searches directly in LINQ using `EF.Functions.VectorDistance()`.
- **Native JSON Columns:** Automatic mapping to the native `json` type, allowing LINQ queries to project and filter directly inside JSON documents stored in the database.
- **NativeAOT Query Pre-compilation:** EF Core 10 supports compiling LINQ expression trees into SQL at *build time* rather than runtime, dramatically reducing API startup latency and memory usage.

### Real-World Example (from tai-portal)

In the **TAI Portal**, we use Global Query Filters to guarantee zero-trust multi-tenancy. Even if a developer forgets to write `.Where(u => u.TenantId == currentTenant)` in their query, the database context enforces it automatically.

[View PortalDbContext.cs](../../../libs/core/infrastructure/Persistence/PortalDbContext.cs)

```csharp
// Example from libs/core/infrastructure/Persistence/PortalDbContext.cs
protected override void OnModelCreating(ModelBuilder builder) {
    base.OnModelCreating(builder);

    // 1. Configure the Entity shape
    builder.Entity<ApplicationUser>(b => {
        b.ToTable("Users");
        
        // 2. Multi-Tenant Global Query Filter
        // This is automatically appended to EVERY SQL query against the Users table.
        // It injects the TenantId from the scoped ITenantService.
        b.HasQueryFilter(u => _tenantService.IsGlobalAccess || u.TenantId == _tenantService.TenantId);
    });
}
```

When an API controller calls `_dbContext.Users.ToListAsync()`, EF Core actually generates SQL that looks like:
`SELECT * FROM "Users" WHERE "TenantId" = @tenantId`

---

## Interview Q&A

### L1: IQueryable vs IEnumerable
**Difficulty:** L1 (Junior)

**Question:** What is the difference between filtering a collection using `IEnumerable<T>.Where()` vs `IQueryable<T>.Where()` in EF Core?

**Answer:** `IEnumerable<T>` executes the filter in application memory; EF Core will pull *all* rows from the database into RAM, and then filter them locally. `IQueryable<T>` builds an expression tree, which EF Core translates into a SQL `WHERE` clause. This means the filtering happens on the database server, returning only the required rows over the network.

---

### L2: The N+1 Query Problem
**Difficulty:** L2 (Mid-Level)

**Question:** What is the N+1 query problem, and how do you fix it in EF Core?

**Answer:** The N+1 problem occurs when you query a list of entities (1 query) and then iterate over them, accessing a navigation property that triggers a new database query for *each* entity in the list (N queries). If you have 100 users, it generates 101 SQL queries. To fix it, you use **Eager Loading** with `.Include(u => u.Role)` to fetch all related data in a single SQL `JOIN` query upfront.

---

### L2: Tracking vs AsNoTracking
**Difficulty:** L2 (Mid-Level)

**Question:** If you are building a read-only API endpoint to return a list of products, why should you append `.AsNoTracking()` to your EF Core query?

**Answer:** By default, EF Core tracks every entity it returns in a "Change Tracker" dictionary so it knows what to update when you call `SaveChanges()`. This tracking consumes significant CPU and memory. Using `.AsNoTracking()` tells EF Core to skip setting up the tracking objects, making read-only queries much faster and less memory-intensive.

---

### L3: Pagination & Performance (Skip/Take vs Keyset)
**Difficulty:** L3 (Senior)

**Question:** You are building a datatable that needs to paginate through 10 million audit logs. Why does `query.Skip(500000).Take(100)` perform terribly, and what is the architectural alternative?

**Answer:** `Skip/Take` generates a SQL `OFFSET/FETCH` query. The database still has to scan and discard the first 500,000 rows before returning the 100 you want, causing performance to degrade linearly as page numbers increase. The architectural alternative is **Keyset Pagination** (or Cursor Pagination). You pass the ID of the last item seen (`WHERE Id > @lastId`). The database uses the B-Tree index to instantly jump to that ID in $O(\log N)$ time, making deep pagination incredibly fast.

---

### L3: Handling Concurrency Conflicts
**Difficulty:** L3 (Senior)

**Question:** Two tenant admins open the same User Profile edit page. Admin A updates the email and saves. Admin B updates the name and saves. Admin B accidentally overwrites Admin A's email change. How does EF Core solve this "Lost Update" problem natively?

**Answer:** We solve this using **Optimistic Concurrency Control**. In EF Core, we add a `RowVersion` property (configured as `[Timestamp]` or `.IsRowVersion()`). When a record is fetched, the frontend receives this token. When saving, EF Core generates SQL like: `UPDATE Users SET ... WHERE Id = 1 AND RowVersion = @originalVersion`. If Admin A saved first, the database changes the version. When Admin B saves, the `WHERE` clause finds 0 rows, and EF Core throws a `DbUpdateConcurrencyException`. The API can then return a `409 Conflict` to Admin B, forcing them to refresh.

---

### L3: Global Query Filters & "IgnoreQueryFilters"
**Difficulty:** L3 (Senior / Staff)

**Question:** In the `tai-portal`, we use a Global Query Filter to automatically scope all data to the `TenantId`. If you need to write a background worker that cleans up orphaned data across *all* tenants, how do you bypass this security feature safely?

**Answer:** You can chain the `.IgnoreQueryFilters()` method onto your `IQueryable` (e.g., `_dbContext.Users.IgnoreQueryFilters().Where(...)`). This strips the automatic `TenantId` WHERE clause from the generated SQL. Because this is a high-risk operation that bypasses Zero-Trust architecture, it should only be used in tightly scoped, highly audited background services or diagnostic endpoints, never in standard API controllers.

---

### L2: Why use an ORM?
**Difficulty:** L2 (Mid-Level)

**Question:** What are the trade-offs of using EF Core instead of writing raw SQL with Dapper or ADO.NET?

**Answer:** The main advantage of EF Core is developer velocity and compile-time safety; it abstracts away SQL dialects and provides LINQ, catching schema mismatches during the build rather than at runtime. The trade-off is the "leaky abstraction" overhead. EF Core's Change Tracker consumes significant memory, and if a developer writes poorly structured LINQ, EF Core might generate catastrophic SQL (like the N+1 problem or fetching entire tables into RAM). Micro-ORMs like Dapper are closer to the metal and generally faster for raw reads, but require writing raw SQL strings.

---

### L1: SQL Injection & ORMs
**Difficulty:** L1 (Junior)

**Question:** How does Entity Framework Core prevent SQL Injection attacks?

**Answer:** SQL Injection occurs when untrusted user input is directly concatenated into a raw SQL string. EF Core prevents this by using parameterized queries automatically. When you write a LINQ query like `.Where(u => u.Name == userInput)`, EF Core translates the `userInput` variable into a SQL parameter (e.g., `@p0`), ensuring the database treats the input strictly as data and never as executable SQL commands.

---

### L3: Cartesian Explosion & AsSplitQuery
**Difficulty:** L3 (Senior)

**Question:** You have a query: `_context.Users.Include(u => u.Roles).Include(u => u.Orders).ToList()`. What performance issue does this cause in SQL, and how do you fix it?

**Answer:** This causes a "Cartesian Explosion." Because EF Core uses a single SQL `JOIN` to fetch everything, the database duplicates the User data for every Role, and then duplicates all of that for every Order. If a user has 5 roles and 10 orders, it returns 50 rows of data over the network for just 1 user. You fix it by appending `.AsSplitQuery()`. This tells EF Core to execute 3 separate, smaller SQL queries (one for Users, one for Roles, one for Orders) and stitch them together in memory, saving massive network bandwidth.

---

### L3: PostgreSQL Indexing (UUID v7)
**Difficulty:** L3 (Senior)

**Question:** When using PostgreSQL, why is it highly recommended to use Sequential GUIDs (Version 7) instead of standard random GUIDs (`Guid.NewGuid()`) for Primary Keys?

**Answer:** Standard random GUIDs (v4) are evenly distributed across the entire key space. When inserted into a PostgreSQL B-Tree index, they cause massive index fragmentation ("page splits"), resulting in severe disk I/O and terrible insert performance as the table grows. UUIDv7 combines a Unix timestamp with randomness, meaning new IDs are always inserted sequentially at the "end" of the B-Tree index. This keeps the index perfectly packed in memory, operating almost as efficiently as an auto-incrementing integer while maintaining global uniqueness.

---

## Cross-References
- [[Data-Structures-Algorithms]] — Connects Big-O notation to SQL performance (B-Trees vs Full Table Scans).
- [[System-Design]] — Relates the `DbContext` Unit of Work pattern to distributed transaction management (Outbox Pattern).

---

## Further Reading
- [EF Core Query Performance](https://learn.microsoft.com/en-us/ef/core/performance/performance-guidelines)
- [Multi-Tenancy with EF Core](https://learn.microsoft.com/en-us/ef/core/modeling/query-filters)
- [Optimistic Concurrency in EF Core](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)

---

*Last updated: 2026-03-31*