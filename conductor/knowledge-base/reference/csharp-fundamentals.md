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

**Stack vs Heap — The Real Story:**

| Aspect | Stack | Heap |
|--------|-------|------|
| Storage | Sequential, LIFO | Random, managed by GC |
| Speed | Very fast (pointer arithmetic) | Slower (allocation + GC) |
| Size | Small, limited (MB range) | Large (GB range) |
| Lifetime | Scope-bound | GC-managed |
| Resizing | Expensive (copy) | Cheap (new allocation) |

**Memory Layout Visualization:**
```csharp
// STACK (local variables)
void ProcessUser() {
    int id = 1;           // 4 bytes on stack
    TenantId tid = Guid.NewGuid();  // 16 bytes inline on stack
    
    // HEAP (reference types)
    var user = new ApplicationUser();  // user pointer on stack, object on heap
}
```

**Boxing and Unboxing (The Performance Killer):**

```csharp
int number = 42;          // Value type on stack
object boxed = number;    // Boxing: copies to heap (~40 bytes overhead)
int unboxed = (int)boxed; // Unboxing: copies back to stack

// THIS IS EXPENSIVE - AVOID IN LOOPS
List<object> list = new();
for (int i = 0; i < 10000; i++) {
    list.Add(i);  // BOXING every iteration - 10000 heap allocations!
}

// CORRECT: Use generic collection
List<int> list = new();
for (int i = 0; i < 10000; i++) {
    list.Add(i);  // No boxing - stack/heap once
}
```

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

**When to Use Each:**

| Use `struct` when... | Use `class` when... |
|---------------------|---------------------|
| Small (≤16 bytes) | Larger objects |
| Immutable | Need inheritance |
| Frequent copying OK | Need reference semantics |
| Mathematical primitives | Complex behavior |
| No null needed | Null is valid |

**Common Pitfall:**
```csharp
// BAD - struct in a class is still on heap (as part of the class)
public class User {
    public TenantId Id;  // Embedded in User object on heap
    public string Name;
}

// GOOD - use class for entities with multiple fields
public class User {
    public Guid Id;  // Still on heap as part of User
    public string Name;
}
```

**Interview Tip:** If you say "structs go on the stack," clarify that's true for local variables. When used as class fields or in collections, they're heap-allocated.

---

### 2. Init-Only Properties (C# 9+) & Immutability

**The Problem:** Traditional C# properties are mutable after construction:
```csharp
var user = new ApplicationUser();
user.Email = "hacked@example.com";  // Can change anytime!
```

**Init Solution:** Set once at construction, then immutable:

```csharp
public class User {
    public string Name { get; init; }
}

var user = new User { Name = "John" };
user.Name = "Jane";  // COMPILE ERROR: can't set after init
```

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

**Key Points:**
- `init` = can only set during object construction (constructor or object initializer)
- After construction, property is read-only
- Unlike `private set`, allows object initializer syntax

**C# 14 Bonus:** The `field` keyword refers to the compiler-synthesized backing store:

```csharp
// C# 14 syntax - direct field access in accessor
public override string? Email {
  get;
  set => field = value?.Trim().ToLowerInvariant();  // normalization on set
}
```

**Immutability Patterns:**

```csharp
// Pattern 1: Traditional immutable class
public sealed class Money {
    public decimal Amount { get; }
    public string Currency { get; }
    
    public Money(decimal amount, string currency) {
        Amount = amount;
        Currency = currency;
    }
}

// Pattern 2: Record (C# 9+)
public record Money(decimal Amount, string Currency);

// Pattern 3: Record struct (C# 10+)
public readonly record struct Money(decimal Amount, string Currency);
```

**Why Immutability Matters:**

| Benefit | Explanation |
|---------|-------------|
| Thread Safety | No locking needed - can't be modified |
| Predictability | Same input = same output |
| Caching Safe | Can cache without worry |
| Refactoring Safe | No hidden state changes |
| Debugging Easier | Objects don't change unexpectedly |

**With Expression (Records):**

```csharp
var original = new Money(100, "USD");
var doubled = original with { Amount = 200 };  // Copy + modify

// Deep copy with records
var copy = original with { };  // Exact copy
```

**Gotchas:**

```csharp
// PROBLEM: Internal array still mutable!
public readonly struct ImmutableWrapper {
    private readonly List<string> _items = new();
    public IReadOnlyList<string> Items => _items.AsReadOnly();
    
    public void Add(string item) => _items.Add(item);  // MUTABLE!
}

// SOLUTION: Defensive copy on every read
public struct SafeWrapper {
    private readonly List<string> _items;
    public SafeWrapper() => _items = new();
    
    public IReadOnlyList<string> Items => _items.ToList().AsReadOnly();
}
```

**Interview Tip:** When asked about immutability, mention:
1. Thread safety (no locks needed)
2. Predictability (no hidden state changes)
3. `init` vs `readonly` vs `record`
4. Defensive copies for mutable fields

---

### 3. Async/Await Under the Hood

**The Basics:**
`async/await` is syntactic sugar that the compiler transforms into a **state machine**.

**What happens:**
1. Compiler generates a state machine class
2. `await` suspends execution, returns control to caller
3. When the Task completes, continuation runs

**Generated State Machine (Conceptual):**

```csharp
// What you write:
public async Task<string> GetDataAsync() {
    var result = await FetchAsync();
    return result.ToUpper();
}

// What the compiler generates (simplified):
public class GetDataAsyncStateMachine : IAsyncStateMachine {
    private AsyncTaskMethodBuilder<string> _builder;
    private Task<string> _fetchTask;
    private int _state;
    private string _result;
    
    public void MoveNext() {
        switch (_state) {
            case 0:  // Start
                _fetchTask = FetchAsync();
                _builder.AwaitUnsafeOnCompleted(ref _fetchTask, this);
                return;
            case 1:  // After await
                _result = _fetchTask.Result.ToUpper();
                _builder.SetResult(_result);
                return;
        }
    }
}
```

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

**Common Mistakes:**

```csharp
// BAD: .Result blocks the thread
public User GetUserSync(Guid id) {
    return _userService.GetByIdAsync(id).Result;  // DEADLOCK RISK!
}

// BAD: Fire and forget without await
public void UpdateUser(User user) {
    _context.SaveChangesAsync();  // Task created but not awaited - data loss!
}

// GOOD: Proper async all the way
public async Task<User> GetUserAsync(Guid id) {
    return await _userService.GetByIdAsync(id);
}

// GOOD: Fire and forget with warning
public async Task UpdateUser(User user) {
    _ = _context.SaveChangesAsync();  // Intentional fire-and-forget
    // OR
    _ = Task.Run(() => _emailService.SendWelcome(user.Email));  // Background
}
```

**ConfigureAwait:**

```csharp
// In library code - AVOID capturing SyncContext (better performance)
public async Task<User> GetUserAsync(Guid id) {
    var user = await _context.Users
        .FirstOrDefaultAsync(u => u.Id == id)
        .ConfigureAwait(false);  // Don't resume on UI thread
    
    return user;  // Continues on thread pool
}

// In UI code - WANT to resume on UI thread
public async void OnLoad() {
    var users = await _api.GetUsersAsync().ConfigureAwait(true);  // Back to UI thread
    this.UserList = users;  // Safe to update UI
}
```

**When to Use Async:**

| Scenario | Use Async? |
|----------|------------|
| I/O Bound (DB, Network, File) | ✅ Yes |
| CPU Bound (Computation) | ❌ No - use `Task.Run` |
| Simple calculations | ❌ No |
| Web API controllers | ✅ Yes |
| Background workers | ✅ Yes |

**Performance Implications:**

```csharp
// EACH async method has overhead:
// - State machine allocation
// - Task allocation
// - Context switches

// DON'T do this:
public async Task<Product> GetProduct(int id) => await _cache.GetAsync(id);

// DO: Return cached value synchronously if available
public Task<Product> GetProductAsync(int id) {
    if (_cache.TryGetValue(id, out var cached)) {
        return Task.FromResult(cached);  // Synchronous completion
    }
    return FetchAndCacheAsync(id);
}
```

**Interview Questions to Know:**

1. **What happens when you await a Task?**
   - If complete: continue immediately
   - If not complete: yield control, schedule continuation

2. **What's the difference between Task and Task<T>?**
   - `Task` - async operation with no return value
   - `Task<T>` - async operation returning T

3. **What does ConfigureAwait(false) do?**
   - Don't resume on captured SynchronizationContext
   - Better performance in library code

4. **How do you handle exceptions in async code?**
   ```csharp
   try {
       await riskyOperation();
   }
   catch (SpecificException ex) {
       // Handle specific
   }
   ```

5. **What's a deadlock and how do you avoid it?**
   - Deadlock: Thread waiting on Task that needs same thread
   - Solution: Use async/await all the way, or `ConfigureAwait(false)`
- Always use `CancellationToken`
- Don't use `.Result` or `.Wait()` (deadlock risk)

---

### 4. LINQ (Language Integrated Query)

LINQ provides declarative data querying in C#. Two syntaxes are available:

**Query Syntax (SQL-like):**
```csharp
var results = from p in privileges
              where p.Name.Contains("admin")
              orderby p.Name
              select p.Name;
```

**Method Syntax (Lambda):**
```csharp
var results = privileges
    .Where(p => p.Name.Contains("admin"))
    .OrderBy(p => p.Name)
    .Select(p => p.Name);
```

**When to Use Each:**

| Query Syntax | Method Syntax |
|-------------|---------------|
| Complex multi-join queries | Simple filtering |
| More readable (SQL devs) | Chaining transformations |
| Less common | More idiomatic C# |
| Only with `IEnumerable` | Works with both |

**Real Example from tai-portal:**

```csharp
// Method syntax - common in EF Core
var results = await _context.Privileges
  .Where(p => p.Name.Contains(search) || p.Description.Contains(search))  // IQueryable
  .OrderBy(p => p.Name)
  .Skip(skip).Take(take)
  .Select(p => new PrivilegeDto(p.Id.Value, p.Name, p.Description, p.Module, p.RiskLevel, p.IsActive, p.RowVersion, p.JitSettings))
  .ToListAsync(cancellationToken);
```

**Deferred vs Immediate Execution:**

| Operator | Type | Example |
|----------|------|---------|
| `Where`, `Select`, `SelectMany` | Deferred | `.Where(x => x > 5)` |
| `OrderBy`, `OrderByDescending` | Deferred | `.OrderBy(x => x.Name)` |
| `Take`, `Skip`, `SkipWhile` | Deferred | `.Take(10)` |
| `ToList`, `ToArray` | Immediate | `.ToList()` |
| `Count`, `Sum`, `Average` | Immediate | `.Count()` |
| `First`, `FirstOrDefault` | Immediate | `.FirstOrDefault()` |
| `Single`, `SingleOrDefault` | Immediate | `.Single()` |

**Why This Matters:**

```csharp
// PROBLEM: Multiple enumeration - inefficient!
var query = users.Where(u => u.Active);  // Not executed yet
var count = query.Count();               // Executes query #1
var list = query.Take(10).ToList();      // Executes query #2 (expensive!)

// SOLUTION: Enumerate once
var query = users.Where(u => u.Active).ToList();  // Single query
var count = query.Count;  // In-memory, no DB call
var list = query.Take(10);
```

**Common LINQ Operators:**

```csharp
// Filtering
users.Where(u => u.Active)

// Projection
users.Select(u => new { u.Id, u.Name })

// Ordering
users.OrderBy(u => u.Name)
     .ThenByDescending(u => u.CreatedAt)

// Set Operations
users.Union(otherUsers)       // Unique union
users.Concat(otherUsers)     // All (including duplicates)
users.Intersection(other)    // Common elements
users.Except(other)          // In first, not second

// Partitioning
users.Skip(10).Take(5)       // Pagination

// Element Operations
users.First()                // Throws if empty
users.FirstOrDefault()       // Null if empty
users.Single()              // Throws if not exactly one
users.ElementAt(5)           // By index

// Aggregation
users.Count()
users.Sum(u => u.Age)
users.Average(u => u.Age)
users.Max(u => u.Age)
users.Min(u => u.Age)

// Partitioning with predicate
users.SkipWhile(u => !u.Active)  // Skip until first active
users.TakeWhile(u => u.Active)   // Take until first inactive
```

**Quantifiers (Return bool):**

```csharp
users.Any()                    // Any elements?
users.Any(u => u.Active)       // Any active?
users.All(u => u.Active)        // All active?
users.Contains(user)           // Contains specific?
```

**Generation:**

```csharp
Enumerable.Range(1, 100)           // 1-100
Enumerable.Repeat("x", 5)           // ["x","x","x","x","x"]
Enumerable.Empty<string>()          // Empty sequence
```

**Gotchas and Performance:**

```csharp
// N+1 Query Problem - DON'T DO THIS
foreach (var user in users) {
    var orders = _context.Orders.Where(o => o.UserId == user.Id).ToList();
}

// SOLUTION: Use Include/Eager Loading
var usersWithOrders = _context.Users
    .Include(u => u.Orders)  // Single query with JOIN
    .ToList();

// Or use Projections
var userOrders = _context.Users
    .Select(u => new { u.Name, OrderCount = u.Orders.Count() })
    .ToList();

// Case Sensitivity - Database matters!
users.Where(u => u.Name.Contains("john"))   // SQL: LIKE '%john%' (case varies by DB)
users.Where(u => u.Name.ToLower().Contains("john"))  // Forces in-memory!

// Better: Use EF.Functions
users.Where(u => EF.Functions.Like(u.Name, "%john%"))
```

**IQueryable vs IEnumerable:**

```csharp
// IEnumerable<T> - In-memory processing
IEnumerable<User> memoryUsers = users;
var filtered = memoryUsers.Where(u => u.Active);  // Filters in RAM

// IQueryable<T> - Expression tree (translates to SQL)
IQueryable<User> dbUsers = _context.Users;
var filtered = dbUsers.Where(u => u.Active);  // Builds SQL WHERE

// CRITICAL: Don't mix!
IQueryable<User> query = _context.Users;
// .ToList() triggers execution - everything after runs in memory
var list = query.Where(u => u.Active).ToList();  
// This .Where runs in C#, not SQL!
list = list.Where(u => u.Name.StartsWith("A"));
```

---

### 5. Pattern Matching & Switch Expressions (C# 8+)

**The Evolution:**

```csharp
// OLD: Verbose if-else chain
string GetRiskDescription(RiskLevel level) {
    if (level == RiskLevel.High) return "High risk";
    else if (level == RiskLevel.Medium) return "Medium risk";
    else if (level == RiskLevel.Low) return "Low risk";
    else return "Unknown";
}

// C# 8+: Switch expression (single expression)
string GetRiskDescription(RiskLevel level) => level switch {
    RiskLevel.High => "High risk",
    RiskLevel.Medium => "Medium risk",
    RiskLevel.Low => "Low risk",
    _ => "Unknown"
};
```

**Switch Expression Features:**

```csharp
// Property patterns
user switch {
    { Status: UserStatus.Active, TenantId: { Value: var tid } } => tid.ToString(),
    { Status: UserStatus.PendingApproval } => "Pending",
    _ => "Other"
};

// Type patterns (before C# 10)
object obj = GetData();
string result = obj switch {
    string s => s.ToUpper(),
    int i => i.ToString(),
    null => "NULL!",
    _ => "Unknown"
};

// C# 10+ Relational patterns
int score = 85;
string grade = score switch {
    >= 90 => "A",
    >= 80 => "B",
    >= 70 => "C",
    >= 60 => "D",
    _ => "F"
};

// Logical patterns
string categorize = score switch {
    < 0 or > 100 => "Invalid",
    >= 90 and <= 100 => "Excellent",
    _ => "Normal"
};
```

**Pattern Matching with `is`:**

```csharp
// Basic type check with cast
if (obj is string str) {
    // str is in scope, compiler knows it's string
    Console.WriteLine(str.Length);
}

// With relational conditions
if (user is { Status: UserStatus.Active, Age: var age } && age >= 18) {
    // Match AND additional condition
}

// Nullable patterns
string? maybe = GetString();
if (maybe is { } someValue) {  // Matches non-null
    Console.WriteLine(someValue);
}

// Tuple patterns
(int x, int y) point = (5, 10);
string location = point switch {
    (0, 0) => "Origin",
    (var a, 0) when a > 0 => $"Positive X axis at {a}",  // with guard
    (0, var b) => $"Y axis at {b}",
    _ => "Somewhere else"
};
```

**Real Example from tai-portal:**

```csharp
// In ApplicationUser entity
public void Approve(TenantAdminId approvedBy) {
    if (Status != UserStatus.PendingApproval) {
        throw new InvalidOperationException($"User account cannot be approved in state {Status}");
    }
    if (Id == (string)approvedBy) {
        throw new InvalidOperationException("Users cannot approve their own accounts.");
    }
    Status = UserStatus.PendingVerification;
    ApprovedBy = approvedBy;
    _domainEvents.Add(new UserApprovedEvent(Id, approvedBy));
}
```

**Guard Clauses (with `when`):**

```csharp
// Add conditions with 'when'
var message = user switch {
    { Status: UserStatus.Active } => "Welcome back!",
    { Status: UserStatus.PendingApproval } when user.CreatedAt < DateTime.Now.AddDays(-7) => 
        "Your pending application is being reviewed",
    { Status: UserStatus.PendingApproval } => "Please wait for approval",
    _ => "Contact support"
};
```

**Common Interview Patterns:**

```csharp
// Null check (old way)
if (obj != null && obj is SomeType t) { }

// Null check (new way)
if (obj is SomeType t) { }  // is already handles null!

// Switch on multiple values
var category = (age, creditScore) switch {
    (< 18, _) => "Minor",
    (_, >= 750) => "Premium",
    (_, >= 500) => "Standard",
    _ => "Basic"
};
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

### 9. Access Modifiers

C# has five access modifiers defining visibility:

| Modifier | Same Assembly | Derived Class | Same Class |
|----------|---------------|---------------|------------|
| `public` | ✅ | ✅ | ✅ |
| `private` | ❌ | ❌ | ✅ |
| `protected` | ❌ | ✅ | ✅ |
| `internal` | ✅ | ❌ | ✅ |
| `protected internal` | ✅ | ✅ | ❌ |
| `private protected` | ✅ (if same type) | ✅ (if derived) | ✅ |

**Real Example from tai-portal:**

```csharp
// libs/core/domain/Entities/ApplicationUser.cs

// protected - accessible to derived classes
protected ApplicationUser() { }  // EF Core requirement - not public

// public - accessible everywhere
public TenantId TenantId { get; init; }

// private - only within ApplicationUser
private readonly List<IDomainEvent> _domainEvents = new();
```

**Best Practice:**
- Default to `private`, increase visibility only when needed
- Use `internal` for assembly-level implementation details
- `protected` for extensibility points in base classes

---

### 10. Generics

Generics provide **compile-time type safety** without runtime overhead.

**Generic Method:**
```csharp
public T FindById<T>(Guid id) where T : class, IEntity {
  return _context.Set<T>().Find(id);
}
```

**Generic Constraint (`where`):**
- `where T : class` — reference type
- `where T : struct` — value type
- `where T : new()` — parameterless constructor
- `where T : IEntity` — implements interface
- `where T : BaseClass` — derives from class

**Real Example — Generic Repository Pattern:**

```csharp
// libs/core/infrastructure/Persistence/PortalDbContext.cs
public class PortalDbContext : DbContext {
  // DbSet is generic - type-safe table access
  public DbSet<ApplicationUser> Users => Set<ApplicationUser>();
  public DbSet<Privilege> Privileges => Set<Privilege>();
  public DbSet<Tenant> Tenants => Set<Tenant>();
}
```

**Covariance and Contravariance (C# 4+):**
```csharp
// Covariance (out) - can return derived where base expected
IEnumerable<Derived> derived = ...;
IEnumerable<Base> base = derived;  // IEnumerable is covariant

// Contravariance (in) - can pass base where derived expected
Action<Base> baseAction = ...;
Action<Derived> derivedAction = baseAction;  // Action is contravariant
```

---

### 11. Exception Handling

**Best Practices:**
1. Don't catch exceptions you can't handle
2. Use specific exception types, not `Exception`
3. Always use `finally` for cleanup
4. Throw specific exceptions with meaningful messages

**Real Example from tai-portal:**

```csharp
// libs/core/infrastructure/Persistence/Services/PrivilegeService.cs
public async Task<PrivilegeDto> UpdatePrivilegeAsync(...) {
  var privilege = await _context.Privileges
    .FirstOrDefaultAsync(p => p.Id == new PrivilegeId(id), cancellationToken);

  if (privilege == null) 
    throw new KeyNotFoundException($"Privilege with ID {id} not found.");  // Specific

  if (privilege.RowVersion != rowVersion) {
    throw new DbUpdateConcurrencyException("Concurrency conflict detected.");
  }

  // ... update logic
  
  await _context.SaveChangesAsync(cancellationToken);
  
  // Force reload for latest RowVersion
  await _context.Entry(privilege).ReloadAsync(cancellationToken);
}
```

**Custom Exceptions:**

```csharp
// libs/core/domain/Exceptions/ConcurrencyException.cs
public class ConcurrencyException : Exception {
  public ConcurrencyException(string message) : base(message) { }
  public ConcurrencyException(string message, Exception inner) : base(message, inner) { }
}
```

**Try-Catch-Finally Pattern:**
```csharp
try {
  var result = await riskyOperation();
}
catch (KeyNotFoundException ex) {
  logger.LogWarning(ex, "Entity not found");
  return NotFound();
}
catch (DbUpdateConcurrencyException ex) {
  logger.LogError(ex, "Concurrency conflict");
  return Conflict();
}
finally {
  // Always runs - cleanup
  disposable.Dispose();
}
```

**Don't Do This:**
```csharp
// BAD - catches everything, hides bugs
try { ... }
catch (Exception) { /* ignore */ }

// GOOD - catch specific, let unknown propagate
try { ... }
catch (SpecificException ex) { handle(ex); }
throw;  // re-throw unknown
```

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

### L2: What are the different access modifiers in C#?

**Difficulty:** L1 (Junior)

**Question:** Describe the access modifiers in C# and when to use each.

**Answer:**
- `public` — anywhere, no restrictions
- `private` — only within same class (default for classes)
- `protected` — same class + derived classes
- `internal` — same assembly only (default for classes in explicit internals-visible)
- `protected internal` — same assembly OR derived classes (union)
- `private protected` — same assembly AND derived classes (intersection)

**Best practice:** Default to most restrictive (`private`), expose incrementally.

---

### L2: Explain generics in C# and when to use them

**Difficulty:** L2 (Mid-Level)

**Question:** What are generics and when would you use them?

**Answer:**
Generics provide **type-safe** reusable code without boxing/unboxing:

```csharp
// Generic method
T FindById<T>(Guid id) where T : class;

// Generic class
public class Repository<T> where T : class {
  private readonly DbContext _context;
  public DbSet<T> Set => _context.Set<T>();
}
```

**Benefits:**
- Compile-time type safety
- No runtime casting
- Better performance (no boxing)
- Reusable across types

**Constraints (`where`):** Use `where T : class`, `where T : struct`, `where T : new()`, `where T : IEntity`.

---

### L2: What is the difference between throw and throw ex?

**Difficulty:** L2 (Mid-Level)

**Question:** What's wrong with `throw ex;` in a catch block?

**Answer:**
```csharp
// BAD - loses stack trace
catch (Exception ex) {
  logger.Log(ex);
  throw ex;  // Stack trace starts HERE
}

// GOOD - preserves original stack trace
catch (Exception ex) {
  logger.Log(ex);
  throw;  // Original stack trace preserved
}

// GOOD - wrap with additional context
catch (Exception ex) {
  throw new CustomException("Operation failed", ex);  // InnerException preserves original
}
```

`throw ex;` resets the stack trace. Use `throw;` to preserve it.

---

### L3: Design a generic repository with CRUD operations

**Difficulty:** L3 (Senior)

**Question:** How would you implement a generic repository pattern in C#?

**Answer:**

```csharp
public interface IRepository<T> where T : class {
  Task<T?> GetByIdAsync(Guid id);
  Task<IEnumerable<T>> GetAllAsync();
  Task AddAsync(T entity);
  Task UpdateAsync(T entity);
  Task DeleteAsync(T entity);
}

public class Repository<T> : IRepository<T> where T : class {
  private readonly DbContext _context;
  private readonly DbSet<T> _dbSet;
  
  public Repository(PortalDbContext context) {
    _context = context;
    _dbSet = context.Set<T>();
  }
  
  public async Task<T?> GetByIdAsync(Guid id) {
    return await _dbSet.FindAsync(id);
  }
  
  public async Task<IEnumerable<T>> GetAllAsync() {
    return await _dbSet.ToListAsync();
  }
  
  public async Task AddAsync(T entity) {
    await _dbSet.AddAsync(entity);
    await _context.SaveChangesAsync();
  }
}
```

**Key points:**
- Generic constraint `where T : class` ensures reference type
- `DbContext.Set<T>()` provides type-safe access
- Can add query-specific methods via non-generic repositories

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