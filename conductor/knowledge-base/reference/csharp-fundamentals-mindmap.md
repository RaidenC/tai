---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **C# Fundamentals**

## **1. Type System & Data Modeling**

### **1.1 Value Types vs Reference Types**
1. Value types: stack-allocated (when local), copied by value
   - `struct`, `int`, `record struct` — ≤16 bytes sweet spot
   - Two `TenantId` with same Guid are equal (value semantics)
2. Reference types: heap-allocated, copied by pointer
   - `class`, `record class`, `delegate` — reference equality by default
3. Boxing: value type → object = heap allocation
   - `List<object>` boxes ints; `List<int>` avoids boxing entirely
4. Gotcha: "structs go on the stack" only true for local variables
   - Struct inside a class field lives on the heap with the parent

### **1.2 Records — Modern Default for Data**
1. Compiler generates Equals, GetHashCode, ToString, with-expression
   - Single line replaces ~50 lines of boilerplate class code
2. tai-portal: every Command, Query, and DTO is a record
   - `RegisterStaffCommand`, `GetUsersQuery`, `UserDto`
3. `with` expression for immutable updates
   - `query with { PageNumber = 2 }` — copy with one field changed
4. Use `record class` for heap data, `record struct` for small value objects
   - Records support inheritance but prefer composition

### **1.3 Init-Only & C# 14 `field` Keyword**
1. `init` — set at construction, then read-only forever
   - Enforces immutability for IDs, tenant assignments
2. `field` keyword — access compiler-generated backing field directly
   - No more `private Guid _tenantId;` boilerplate for validation
3. Combine: `init => field = validate(value)` — validated immutability
4. Trade-off: `init` blocks EF Core materialization without parameterless ctor

## **2. Async, LINQ & Data Access**

### **2.1 Async/Await State Machine**
1. Compiler transforms async method into IAsyncStateMachine
   - Each `await` = state transition; thread returns to pool during I/O
2. Enables 1000s of concurrent requests without 1000s of threads
   - Thread pool never exhausted on I/O-bound work
3. Critical mistakes: `.Result` deadlocks, missing `await` loses data
   - Always async all the way; never mix sync and async
4. CancellationToken: only way to cancel in-flight I/O
5. ValueTask for sync-completing hot paths (zero allocation)

### **2.2 LINQ: IQueryable vs IEnumerable**
1. IQueryable builds expression tree → translated to SQL
   - Filtering, sorting, projection all happen in PostgreSQL
2. IEnumerable executes in-memory — loads ALL rows first
   - Early `.ToList()` turns database query into memory scan
3. Deferred execution: Where/Select/OrderBy build query, ToList executes
4. N+1 problem: loop + query = N extra roundtrips
   - Fix with `.Include()` for eager loading (single JOIN)
5. Not all C# translates to SQL — watch for client-side evaluation

### **2.3 IAsyncEnumerable — Streaming**
1. `yield return` + `await foreach` = one item at a time
   - Memory: only ONE row in memory, not entire result set
2. Natural fit for SignalR streaming, gRPC server streaming
3. Trade-off: holds database connection open for entire enumeration
   - For paginated APIs, `ToListAsync` with Skip/Take is better

## **3. DI, Patterns & Runtime**

### **3.1 Dependency Injection Lifetimes**
1. Singleton: one instance, entire app lifetime — must be thread-safe
   - `IRealTimeNotifier` in tai-portal
2. Scoped: one instance per HTTP request — default for most services
   - `DbContext`, `ITenantService`, `IIdentityService`
3. Transient: new instance every injection — rarely needed
4. Captive dependency: Singleton captures Scoped = stale data, crashes
   - Fix: `IServiceScopeFactory` or `ValidateScopes = true`

### **3.2 Pattern Matching (C# 8-14)**
1. Switch expressions: return values directly, compiler checks exhaustiveness
   - Replaces 12-line if-else with 5-line switch
2. Property patterns: `{ Status: UserStatus.Active }` — match on shape
3. Relational + logical: `>= 90 and <= 100`, `< 0 or > 100`
4. `is` pattern for null-safe property access with variable binding
5. Keep patterns shallow — extract complex nesting into helpers

### **3.3 Generics — Type Safety Without Boxing**
1. Compile-time type safety: `DbSet<T>`, `IPipelineBehavior<TReq, TRes>`
   - No `object` casting, no boxing for value types
2. Constraints: `where T : IRequest<TResponse>` expresses requirements
3. Covariance (`out T`) and Contravariance (`in T`)
   - `IEnumerable<Dog>` assignable to `IEnumerable<Animal>`
4. Trade-off: harder to debug, verbose stack traces

### **3.4 NativeAOT & Source Generators**
1. NativeAOT: compile to native code, 10-50ms startup vs ~500ms JIT
   - No runtime reflection — linker trims "unused" types
2. Breaking patterns: `Activator.CreateInstance`, `MakeGenericType`
   - tai-portal's domain event dispatch uses both — breaks under AOT
3. Source generators: compile-time code generation replaces reflection
   - `System.Text.Json` already migrated to `JsonSerializerContext`
4. Not needed for long-running servers (JIT optimizes hot paths)
5. Trade-off: larger binaries, longer compile, harder debugging
