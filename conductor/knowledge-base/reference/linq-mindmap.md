---
markmap:
  initialExpandLevel: 3
  colorFreezeLevel: 3
  spacingVertical: 12
---
# **1. LINQ — Language Integrated Query**

## **1.1 Foundations**
1. What LINQ Is & Two Syntaxes
   - Unified query API for collections, databases, XML, JSON
   - Method syntax (fluent chains) — 95% of production code
   - Query syntax (SQL-like) — better for complex joins and `let` bindings
2. IEnumerable vs IQueryable
   - IEnumerable: compiled delegates, executes in CLR memory
   - IQueryable: expression trees, translated to SQL by EF Core
   - Breaking the IQueryable chain silently loads entire tables
3. Deferred Execution & Expression Trees
   - Queries build a plan; execution happens at terminal operators
   - Enables incremental composition (filter → sort → paginate → project)
   - Captured variable trap: references not values are captured
4. Terminal Operators
   - `ToListAsync` / `FirstOrDefaultAsync` / `CountAsync` / `AnyAsync`
   - Each is a database round-trip and an await point
   - `AnyAsync` over `CountAsync() > 0` — short-circuits on first match

## **1.2 Core Operators**
1. Filtering: Where
   - Multiple `.Where()` = AND; `||` inside lambda = OR
   - `Contains()` → `LIKE '%x%'` (no index); `StartsWith()` → `LIKE 'x%'` (index-friendly)
   - Null checks required for nullable columns in EF Core
2. Projection: Select & SelectMany
   - `.Select()` reduces columns in SQL — primary performance optimization
   - `.SelectMany()` flattens nested collections (1:N mapping)
   - tai-portal uses SelectMany to collect domain events from all entities
3. Ordering: OrderBy / ThenBy
   - Deterministic OrderBy is mandatory before Skip/Take
   - Calling OrderBy twice replaces the first sort (use ThenBy instead)
   - Dynamic sorting via switch expressions maps API params safely
4. Aggregation: Count, Any, Sum
   - `AnyAsync` short-circuits; `CountAsync` scans all matches
   - `Aggregate` is LINQ-to-Objects only — no SQL translation
   - `Sum()` on empty nullable sequences throws without null coalescing
5. Set & Grouping: GroupBy, Distinct, Join
   - GroupBy must be followed by aggregate projection in EF Core
   - `DistinctBy()` available in .NET 6+ / EF Core 7+
   - Prefer navigation properties over explicit Join in EF Core

## **1.3 Query Composition Patterns**
1. Conditional Query Building
   - Append `.Where()` inside `if` statements on IQueryable
   - Pipeline: base scope → filters → sort → paginate → project → materialize
   - One SQL query generated regardless of how many conditions are applied
2. Pagination: Skip / Take
   - Translates to SQL `OFFSET` / `LIMIT`
   - Offset pagination degrades on deep pages (page 10,000+)
   - Keyset (cursor) pagination: `.Where(x => x.Id > lastId).Take(n)` — O(1) seek
3. DTO Projection
   - `.Select(e => new Dto(...))` reduces columns and disables tracking
   - Always project at the query boundary (controller/handler)
   - tai-portal: `PrivilegeDto` projection fetches only 8 columns
4. Dynamic Sorting
   - Switch expression maps `(sortColumn, sortDir)` to type-safe OrderBy
   - Discard pattern `_` provides safe default sort
   - Avoids dynamic LINQ injection risks
5. Specification Pattern
   - Encapsulates `Expression<Func<T, bool>>` in reusable objects
   - Introduce when same filter combination appears in 3+ places
   - Libraries: Ardalis.Specification, LinqKit PredicateBuilder

## **1.4 Performance & Pitfalls**
1. Client vs Server Evaluation
   - Untranslatable C# methods in Where() load entire table
   - EF Core 3.0+ throws by default; Select() still allows it
   - Check `ToQueryString()` to verify SQL generation
2. N+1 Query Problem
   - Lazy loading triggers a SQL query per navigation access
   - Fix: `.Include()` for eager loading or `.Select()` projection
   - Disable lazy loading in production APIs
3. Cartesian Explosion & AsSplitQuery
   - Multiple collection Includes create cross-product result sets
   - `AsSplitQuery()` sends separate SQL per Include (3 queries vs 1 huge one)
   - Trade-off: split queries lose snapshot consistency between queries
4. AsNoTracking
   - Eliminates ~2KB per entity overhead for read-only queries
   - Required for all list endpoints, reports, dropdowns
   - Detached entities generate full UPDATE on re-attachment
5. Bulk Operations: ExecuteUpdate / ExecuteDelete
   - Single SQL statement for mass updates/deletes (EF Core 7+)
   - Bypasses Change Tracker, audit fields, domain events, interceptors
   - tai-portal: `ExecuteDeleteAsync` in integration test cleanup

## **1.5 Full-Stack: TypeScript & RxJS**
1. Operator Mapping
   - `.Where()` = `.filter()` | `.Select()` = `.map()` | `.SelectMany()` = `.flatMap()`
   - `.Any()` = `.some()` | `.All()` = `.every()` | `.First()` = `.find()`
   - Key difference: JS `.sort()` mutates; C# `.OrderBy()` is pure
2. RxJS as LINQ-to-Streams
   - `filter()` = Where | `map()` = Select | `switchMap()` ≠ SelectMany
   - `switchMap` cancels previous; `mergeMap` is the true SelectMany
   - tai-portal: menu filtering via `combineLatest` + `map` + `filter`
3. Critical Differences
   - TypeScript arrays have no deferred execution (always immediate)
   - No IQueryable equivalent — all filtering is in-memory
   - Chaining `.filter().map().filter()` allocates 3 intermediate arrays

---


