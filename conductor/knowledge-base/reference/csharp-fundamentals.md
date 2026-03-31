---
title: C# Fundamentals
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - Design-Patterns
  - EFCore-SQL
  - Security-CSP-DPoP
---

## TL;DR

C# is a strongly-typed, object-oriented language running on .NET 8. Key concepts include **value types vs reference types**, **async/await**, **LINQ**, and **memory management**. For interviews: understand the difference between `class` and `struct`/`record`, how `async/await` works under the hood (state machines), and when to use LINQ query syntax vs method syntax. This note draws real examples from the tai-portal codebase.

---

## Deep Dive

### 1. Value Types vs Reference Types

**The Core Difference:**
- **Value types** (`struct`, `int`, `double`, `record struct`) are stored on the stack (when not boxed) and copied by value.
- **Reference types** (`class`, `delegate`, `interface`) are stored on the heap and copied by reference.

**Real Example from tai-portal** — Value Object as `record struct`:

```csharp
// libs/core/domain/ValueObjects/TenantId.cs
public readonly record struct TenantId {
  public Guid Value { get; }
  
  public TenantId(Guid value) {
    Value = value;
  }
  
  // Explicit conversion enforces type safety
  public static explicit operator TenantId(Guid value) => new(value);
  public static implicit operator Guid(TenantId id) => id.Value;
}
```

**Why `record struct`?**
- Value semantics (two `TenantId` with same `Guid` are equal)
- Immutability via `readonly`
- Stack allocation efficiency
- Pattern: Use for IDs, money amounts, coordinates

**Interview Tip:** If you say "structs go on the stack," clarify that's true for local variables. When used as class fields or in collections, they're heap-allocated.

---

### 2. Init-Only Properties (C# 9+)

Allows setting properties only during object construction, then they're immutable.

**Real Example from tai-portal:**

```csharp
// libs/core/domain/Entities/ApplicationUser.cs
public TenantId TenantId {
  get;
  init => field = (value.Value == Guid.Empty)
    ? throw new ArgumentException("A valid TenantId is required.", nameof(value))
    : value;
}
```

**C# 14 Bonus:** The `field` keyword refers to the compiler-synthesized backing store:

```csharp
// C# 14 syntax - direct field access in accessor
public override string? Email {
  get;
  set => field = value?.Trim().ToLowerInvariant();  // normalization
}
```

---

### 3. Async/Await Under the Hood

`async/await` is syntactic sugar that the compiler transforms into a **state machine**.

**What happens:**
1. Compiler generates a state machine class
2. `await` suspends execution, returns control to caller
3. When the Task completes, continuation runs

**Real Example from tai-portal:**

```csharp
// libs/core/infrastructure/Persistence/Services/PrivilegeService.cs
public async Task<IEnumerable<PrivilegeDto>> GetPrivilegesAsync(
    int skip, int take, string? search, string[]? modules,
    CancellationToken cancellationToken) {
  
  // async/await compiles to state machine
  var query = _context.Privileges.AsNoTracking();
  
  if (!string.IsNullOrWhiteSpace(search)) {
    query = query.Where(p => p.Name.Contains(search));  // deferred execution
  }
  
  return await query
    .OrderBy(p => p.Name)
    .Skip(skip).Take(take)
    .Select(p => new PrivilegeDto(...))
    .ToListAsync(cancellationToken);  // execution happens here
}
```

**Key Concepts:**
- `Task` represents async work
- `await` doesn't block thread—it yields control
- Always use `CancellationToken`
- Don't use `.Result` or `.Wait()` (deadlock risk)

---

### 4. LINQ (Language Integrated Query)

Two syntaxes:
- **Query syntax:** `from x in list where x > 5 select x`
- **Method syntax:** `list.Where(x => x > 5)`

**Real Example from tai-portal:**

```csharp
// Method syntax - common in EF Core
var results = await _context.Privileges
  .Where(p => p.Name.Contains(search) || p.Description.Contains(search))  // IQueryable
  .OrderBy(p => p.Name)
  .Skip(skip).Take(take)
  .Select(p => new PrivilegeDto(p.Id.Value, p.Name, ...))
  .ToListAsync(cancellationToken);
```

**Deferred vs Immediate Execution:**
- `Where`, `Select`, `OrderBy` → **Deferred** (not executed until enumerated)
- `ToList()`, `ToArray()`, `First()`, `Count()` → **Immediate**

---

### 5. Pattern Matching & Switch Expressions (C# 8+)

**Traditional switch:**
```csharp
string result;
if (privilege.RiskLevel == RiskLevel.High) result = "High risk";
else if (privilege.RiskLevel == RiskLevel.Medium) result = "Medium risk";
else result = "Low risk";
```

**Switch expression (C# 8+):**
```csharp
var result = privilege.RiskLevel switch {
  RiskLevel.High => "High risk",
  RiskLevel.Medium => "Medium risk",
  RiskLevel.Low => "Low risk",
  _ => "Unknown"
};
```

**Pattern matching with `is`:**
```csharp
if (obj is ApplicationUser user && user.Status == UserStatus.Active) {
  // use user with compile-time guarantee it's ApplicationUser
}
```

---

### 6. Null Handling

**Null-conditional operator (`?.`):**
```csharp
var name = user?.FirstName ?? "Unknown";  // ?? provides fallback
```

**Null-forgiving operator (`!`):**
```csharp
// Tell compiler "this is not null, trust me"
var list = possibleNullList!;
```

**Pattern matching for null:**
```csharp
if (user is { Status: UserStatus.Active, TenantId: { Value: var tid } }) {
  // Use tid - compiler knows it's not null
}
```

---

### 7. Records (C# 9+)

```csharp
// Traditional class
public class Person {
  public string Name { get; init; }
  public int Age { get; init; }
}

// Record - automatic equality, ToString(), with expression
public record Person(string Name, int Age);

// With expression (immutable update)
var older = person with { Age = person.Age + 1 };
```

**In tai-portal:** `TenantId` uses `readonly record struct` for value semantics + stack efficiency.

---

### 8. Dependency Injection in .NET

**Constructor injection (most common):**

```csharp
// libs/core/infrastructure/Persistence/Services/PrivilegeService.cs
public class PrivilegeService : IPrivilegeService {
  private readonly PortalDbContext _context;
  private readonly IMemoryCache _cache;
  
  public PrivilegeService(PortalDbContext context, IMemoryCache cache) {
    _context = context;
    _cache = cache;
  }
}
```

**Register in DI container (Program.cs):**
```csharp
builder.Services.AddScoped<IPrivilegeService, PrivilegeService>();
builder.Services.AddMemoryCache();
```

**Lifetimes:**
- `AddSingleton` — one instance for app lifetime
- `AddScoped` — one instance per request
- `AddTransient` — new instance each time

---

## Interview Q&A

### L1: What is the difference between `class` and `struct` in C#?

**Difficulty:** L1 (Junior)

**Question:** What's the difference between `class` and `struct` in C#?

**Answer:** 
- `struct` is a value type, stored on the stack (when local) or inline in containing type
- `class` is a reference type, stored on the heap
- Structs are copied by value, classes by reference
- Structs can't inherit, classes can
- Use struct for small, immutable data (e.g., `DateTime`, `Guid`, points, coordinates)
- Use class for objects that need inheritance, large data, or reference semantics

---

### L2: Explain how async/await works in C#

**Difficulty:** L2 (Mid-Level)

**Question:** How does async/await work internally in C#?

**Answer:** 
`async/await` is syntactic sugar that the compiler transforms into a state machine:

1. When you mark a method `async`, the compiler generates a state machine class
2. The method body is split into states based on each `await`
3. When `await` is reached, the method returns a `Task` to the caller
4. When the awaited `Task` completes, the state machine resumes from the correct state

**Key points:**
- `await` does NOT block the thread—it yields control
- The calling method can continue on the same thread (if on thread pool)
- Use `ConfigureAwait(false)` to avoid context capture in library code
- Always pass `CancellationToken` for cancellable operations

**Bad practice:**
```csharp
// DON'T - blocks thread
var result = task.Result;
```

**Good practice:**
```csharp
// DO - properly async
var result = await task;
```

---

### L3: Design a caching layer with thread-safe invalidation

**Difficulty:** L3 (Senior)

**Question:** How would you implement a thread-safe caching layer in C# that handles concurrent reads and writes?

**Answer:** 
Here's a pattern from tai-portal's `PrivilegeService`:

```csharp
public class PrivilegeService : IPrivilegeService {
  private readonly IMemoryCache _cache;
  private const string PrivilegesCacheKey = "Privileges_All";
  
  public async Task<IEnumerable<PrivilegeDto>> GetPrivilegesAsync(...) {
    // Cache hit? Return immediately
    if (skip == 0 && take == 10 && string.IsNullOrWhiteSpace(search)) {
      return await _cache.GetOrCreateAsync(PrivilegesCacheKey, async entry => {
        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
        return await FetchPrivilegesFromDb(0, 10, null, null, cancellationToken);
      }) ?? Enumerable.Empty<PrivilegeDto>();
    }
    // Cache miss? Fetch from DB
    return await FetchPrivilegesFromDb(skip, take, search, modules, cancellationToken);
  }
  
  private void InvalidateCache(Guid id) {
    _cache.Remove(PrivilegesCacheKey);
    _cache.Remove($"Privilege_{id}");
  }
}
```

**Key considerations:**
- `IMemoryCache` is thread-safe by design
- Use cache-aside pattern (check cache, fetch if miss, store)
- Set appropriate expiration (`AbsoluteExpirationRelativeToNow`)
- Invalidate on writes to prevent stale data
- Consider cache stampede with distributed locks for expensive operations
- For multi-tenant: partition by tenant ID (`$"Privileges_{tenantId}"`)

---

### L2: What is the difference between `IEnumerable` and `IQueryable`?

**Difficulty:** L2 (Mid-Level)

**Question:** When would you use `IEnumerable<T>` vs `IQueryable<T>`?

**Answer:**
- `IEnumerable<T>` — in-memory collection, operations execute locally
- `IQueryable<T>` — expression tree, operations translate to database queries (SQL)

```csharp
// IEnumerable - executes in memory
var list = new List<Privilege>();
var filtered = list.Where(p => p.Name.Contains("admin"));  // filters in memory

// IQueryable - builds expression, executes in DB
IQueryable<Privilege> query = _context.Privileges;
var filtered = query.Where(p => p.Name.Contains("admin"));  // builds SQL WHERE
await filtered.ToListAsync();  // executes as SQL
```

**Rule:** Use `IEnumerable` for in-memory filtering, `IQueryable` for database queries.

---

### L3: Explain the Liskov Substitution Principle in C# context

**Difficulty:** L3 (Senior)

**Question:** What is the Liskov Substitution Principle and how does it apply to C#?

**Answer:** 
Liskov Substitution Principle (LSP): Objects of a superclass should be replaceable with objects of its subclasses without breaking the application.

**In C# terms:**
```csharp
// Base class
public abstract class Notification {
  public abstract void Send(string message);
}

// Derived class
public class EmailNotification : Notification {
  public override void Send(string message) { /* send email */ }
}

// If caller expects Notification, EmailNotification should work
void NotifyUser(Notification notification) {
  notification.Send("Hello");  // works with EmailNotification, SmsNotification, etc.
}
```

**Violations to avoid:**
- Throwing new exceptions in subclass methods not in base
- Narrowing preconditions (base allows null, subclass rejects it)
- Widening postconditions (base returns bool, subclass throws)
- Changing `virtual` to `sealed` or vice versa incorrectly

**In tai-portal:** `ApplicationUser : IdentityUser` extends the base while maintaining contract.

---

## Cross-References

- [[Design-Patterns]] — Many C# features enable patterns (DI, Repository, Singleton)
- [[EFCore-SQL]] — LINQ queries translate to SQL, async/await for DB operations
- [[Security-CSP-DPoP]] — C# type system enables security patterns
- [[Testing]] — async/await patterns affect how tests are written

---

## Further Reading

- [Microsoft Docs: async/await](https://docs.microsoft.com/en-us/dotnet/csharp/async)
- [Microsoft Docs: LINQ](https://docs.microsoft.com/en-us/dotnet/csharp/linq/)
- [C# record types](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record)
- Source code: `libs/core/domain/ValueObjects/TenantId.cs` — record struct example
- Source code: `libs/core/infrastructure/Persistence/Services/PrivilegeService.cs` — async/LINQ/caching

---

*Last updated: 2026-03-30*