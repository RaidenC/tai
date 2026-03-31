---
title: Data Structures & Algorithms
difficulty: L1 | L2 | L3
lastUpdated: 2026-03-31
relatedTopics:
  - CSharp-Fundamentals
  - EFCore-SQL
---

## TL;DR

Data Structures and Algorithms (DSA) form the foundation of efficient software. Understanding Arrays, Lists, Hash Tables, and Trees is crucial for writing code that scales, while grasping Big-O notation allows you to predictably measure performance. In modern C# 14 and .NET 10, choosing the right structure (e.g., `Dictionary` vs `List`, or leveraging stack-allocated types and `Span<T>`) can eliminate garbage collection pressure and dramatically improve application latency.

## Deep Dive

### Concept Overview

#### 1. Arrays & Lists
- **Explanation:** Arrays are contiguous blocks of memory holding elements of the same type. `List<T>` is a dynamic wrapper around an array.
- **How it works:** An array is fixed in size upon creation. A `List<T>` starts with a default capacity. When it gets full, it allocates a new underlying array (usually double the size) and copies the elements over (an O(N) operation that amortizes to O(1)).
- **Why / When to use:** Use arrays when the size is known at compile/initialization time for minimal memory overhead. Use `List<T>` as the default for ordered, dynamic collections you intend to iterate over.
- **Trade-offs:** O(1) index access (extremely fast). However, inserting or deleting in the middle of a `List<T>` is O(N) because all subsequent elements must be shifted in memory.
```csharp
// Array: Fixed size, minimal overhead
int[] numbers = new int[5]; 
numbers[0] = 42; // O(1) access

// List: Dynamic size
List<string> names = new();
names.Add("Alice"); // O(1) Amortized insertion
names.Insert(0, "Bob"); // O(N) insertion - shifts "Alice" to index 1
```

#### 2. Hash Tables (`Dictionary<TKey, TValue>`, `HashSet<T>`)
- **Explanation:** Structures that map keys to values (or just store unique keys) allowing for ultra-fast lookups.
- **How it works:** They use a hash function to convert a key into an integer (hash code), which maps to a "bucket" (an array index). If two keys map to the same bucket (a collision), .NET resolves it using "chaining" (linking entries).
- **Why / When to use:** Perfect for caching, lookups by ID, or checking for existence/uniqueness (e.g., using `HashSet<Guid>` to ensure no duplicate tenant IDs).
- **Trade-offs:** O(1) *average* access/insert, but degrades to O(N) worst-case if there are massive hash collisions. They consume significantly more memory than lists and do not maintain element insertion order.
```csharp
var cache = new Dictionary<Guid, User>();
cache[userId] = user; // O(1) insert

// O(1) lookup, much faster than a LINQ .FirstOrDefault() on a List
if (cache.TryGetValue(userId, out var cachedUser)) {
    return cachedUser;
}

var uniqueIds = new HashSet<int> { 1, 2, 2, 3 }; // Contains { 1, 2, 3 }
```

#### 3. Trees & Graphs
- **Explanation:** Non-linear data structures. Trees are hierarchical (one root, child nodes). Graphs are networks of nodes (vertices) connected by edges.
- **How it works:** Trees ensure no cycles; Binary Search Trees (BST) keep smaller values left, larger right. Graphs can be directed/undirected and cyclic/acyclic, typically represented using Adjacency Lists or Matrices.
- **Why / When to use:** Trees represent hierarchical data (DOM, ASTs, file systems) and enable fast searching (B-Trees in databases). Graphs model real-world networks (social connections, routing maps, Dependency Injection resolution graphs).
- **Trade-offs:** Trees offer O(log N) search/insert if balanced, but degrade to O(N) if unbalanced (looking like a linked list). Graphs require complex traversal algorithms (BFS/DFS) and cycle-detection logic, carrying memory overhead for pointers/edges.
```csharp
// Simple Tree Node
public class TreeNode<T> {
    public T Value { get; set; }
    public List<TreeNode<T>> Children { get; set; } = new();
}

// Graph using an Adjacency List
var graph = new Dictionary<int, List<int>>();
graph[1] = new List<int> { 2, 3 }; // Node 1 connects to Node 2 and Node 3
```

#### 4. Sorting Algorithms
- **Explanation:** Reordering elements into an ordered sequence (ascending/descending).
- **How it works:** Algorithms compare elements and swap them. Modern frameworks use hybrid algorithms. C#'s `Array.Sort` uses Introspective Sort (IntroSort)—starting with QuickSort, and switching to HeapSort or InsertionSort depending on recursion depth and partition size.
- **Why / When to use:** Needed before performing Binary Search, or for UI presentation (e.g., paginated datatables ordered by `CreatedAt`).
- **Trade-offs:** Sorting takes O(N log N) time in the best/average cases. You trade CPU cycles upfront for faster search (O(log N)) or better UX later. Note the difference between stable (preserves relative order of equal elements, e.g., `OrderBy`) and unstable sorting (e.g., `Array.Sort`).
```csharp
var numbers = new[] { 5, 1, 4, 2, 8 };
Array.Sort(numbers); // Unstable, O(N log N), modifies in-place array

// Stable, O(N log N), creates new enumerable/collection
var sortedNames = names.OrderBy(n => n.Length).ToList(); 
```

#### 5. Big-O Notation
- **Explanation:** Mathematical notation describing how an algorithm's runtime (Time Complexity) or memory usage (Space Complexity) grows as the input size (N) grows.
- **How it works:** It focuses on the dominant term and drops constants. `O(2N + 10)` simplifies to `O(N)`. It evaluates the worst-case scenario.
- **Why / When to use:** Crucial during system design and interviews to justify technical decisions, compare approaches, and predict performance bottlenecks in production at scale.
- **Trade-offs:** There is often a Time vs. Space trade-off. You can speed up an algorithm (lower Time Complexity) by caching data in memory (higher Space Complexity).
```csharp
// O(1) - Constant Time: Doesn't matter if array has 10 or 10M elements
var first = numbers[0]; 

// O(N) - Linear Time: Time scales linearly with collection size
foreach (var item in numbers) { /* ... */ } 

// O(N^2) - Quadratic Time: nested loops. Avoid for large N!
for (int i = 0; i < numbers.Length; i++) {
    for (int j = 0; j < numbers.Length; j++) { /* ... */ }
}
```

### .NET 10 / C# 14 Context
.NET 10 expands stack allocation capabilities and improves JIT "de-abstraction," making interface-based iteration (`IEnumerable`) as fast as concrete list iteration. C# 14 introduces implicit span conversions, making high-performance, zero-allocation memory handling (`Span<T>`) easier when working with underlying arrays.

### Real-World Examples (tai-portal & DocViewer)

#### TAI Portal: Standard Application Data Structures
In the `tai-portal` codebase, the `IdentityService` makes heavy use of Lists, IQueryable (Trees/Expression Graphs behind the scenes), and optimized Sorting algorithms via LINQ to efficiently paginate and order users.

```csharp
// Example from libs/core/infrastructure/Identity/IdentityService.cs
public async Task<IEnumerable<ApplicationUser>> GetUsersByTenantAsync(
    TenantId tenantId, int skip, int take, string? sortColumn = null) {
    
    var query = _userManager.Users.Where(u => u.TenantId == tenantId);

    // Using Big-O optimal built-in LINQ OrderBy (Introsort under the hood)
    query = sortColumn?.ToLower() switch {
      "name" => query.OrderBy(u => u.FirstName).ThenBy(u => u.LastName),
      _ => query.OrderBy(u => u.UserName)
    };

    // Paginating data limits the space complexity to O(take) instead of O(N)
    return await query.Skip(skip).Take(take).ToListAsync();
}
```

#### DocViewer: Massive Scale Data Structures (OpenSearch)
In the **DocViewer** project, standard `List` and `OrderBy` operations fail entirely due to the sheer volume of documents. Instead, we rely on distributed algorithmic concepts:
1. **Partitioning & Sharding:** Data is horizontally partitioned across multiple nodes. A routing hash function (often based on `TenantId`) ensures all documents for one tenant land on the same shard, changing network complexity from scattering across the whole cluster to targeted O(1) shard lookups.
2. **Indexing & Tree Pruning:** OpenSearch uses Inverted Indices. When searching for a keyword, it doesn't scan documents (O(N)). It looks up the keyword in an internal Trie/B-Tree (O(log N)) to instantly get the list of document IDs. Furthermore, if a query includes a date filter, OpenSearch uses **Tree Pruning** to drop entire segments of the index from the search if their metadata bounding boxes don't overlap the date range.

Furthermore, in our Domain models, we use `List<T>` for domain events, but encapsulate primitive IDs using value objects designed for stack allocation efficiency:

```csharp
// Example from libs/core/domain/ValueObjects/TenantId.cs
/// Designed as a readonly record struct to ensure value semantics and 
/// stack allocation efficiency in the NativeAOT environment.
public readonly record struct TenantId(Guid Value);
```

### Key Takeaways
- **Pick the right tool:** Use `List<T>` for ordered sequences you iterate over, `HashSet<T>` for uniqueness and O(1) lookups, and `Dictionary<TKey, TValue>` for key-value O(1) mapping.
- **Space vs Time Trade-off:** Caching results in a `Dictionary` uses more memory (Space O(n)) but speeds up lookups (Time O(1)). 
- **.NET 10 Efficiency:** Structs (like `TenantId`) and `Span<T>` allow for stack allocation, completely bypassing the heap and reducing GC (Garbage Collection) pauses.

---

## Interview Q&A

### L1: Array vs. List
**Difficulty:** L1 (Junior)

**Question:** What is the difference between an Array and a `List<T>` in C#?

**Answer:** An Array has a fixed size determined at creation, meaning you cannot easily add or remove elements. A `List<T>` is a dynamic collection backed by an array that automatically resizes itself (usually doubling in capacity) when it gets full.

---

### L1: IEnumerable vs ICollection vs IList
**Difficulty:** L1 (Junior)

**Question:** What is the difference between `IEnumerable<T>`, `ICollection<T>`, and `IList<T>`?

**Answer:** `IEnumerable<T>` represents a read-only, forward-only sequence of items. `ICollection<T>` extends `IEnumerable` by adding the ability to count, add, and remove items. `IList<T>` extends `ICollection` by adding index-based access (e.g., `list[0] = item`), making it the most feature-rich of the three interfaces.

---

### L2: Dictionary Time Complexity
**Difficulty:** L2 (Mid-Level)

**Question:** How does a `Dictionary<TKey, TValue>` work under the hood, and what happens when two keys hash to the same bucket?

**Answer:** A `Dictionary` uses a hash function to map keys to array indices, offering O(1) average time complexity for lookups. When two keys produce the same index (a collision), .NET resolves it using "chaining" (linking entries in the same bucket). If collisions are frequent, performance degrades to O(n), which is why a good, evenly distributed hash function is critical.

---

### L2: HashSet vs List.Contains
**Difficulty:** L2 (Mid-Level)

**Question:** Why is `HashSet<T>.Contains()` generally faster than `List<T>.Contains()`, and when would you NOT use a `HashSet`?

**Answer:** `HashSet<T>` uses a hash function to achieve O(1) lookups, while `List<T>.Contains()` performs a linear O(N) scan. However, `HashSet` consumes more memory, does not preserve insertion order, and has significant allocation overhead. For extremely small collections (e.g., < 10 items), a linear array scan might actually be faster due to contiguous memory and CPU cache locality.

---

### L3: Pagination and Big-O
**Difficulty:** L3 (Senior)

**Question:** If you are querying millions of users from a database, why is `Skip(skip).Take(take)` potentially inefficient at high page numbers, and what data structure or algorithmic approach would you use instead?

**Answer:** `Skip(N)` forces the database to scan and discard `N` rows before taking the results, making it an O(N) operation that degrades heavily on deep pages (e.g., page 10,000). A better algorithmic approach is "Keyset Pagination" (or cursor-based pagination). You track the last seen value (e.g., `WHERE Id > lastSeenId`), allowing the database to use an underlying B-Tree index to jump directly to the correct starting point in O(log N) time.

---

### L3: Probabilistic Data Structures (Bloom Filters)
**Difficulty:** L3 (Senior / Staff)

**Question:** In the DocViewer project, before executing an expensive disk read on an OpenSearch index, how can the system quickly determine if a specific document ID definitely *does not* exist in that segment?

**Answer:** It uses a **Bloom Filter**, a highly space-efficient probabilistic data structure. By passing the ID through multiple hash functions and setting bits in a bit array, it can answer "Does this exist?" with either "Probably Yes" or "Definitely No." If it says "Definitely No," OpenSearch skips the disk read entirely (saving massive I/O). The trade-off is that it can yield false positives, but *never* false negatives.

---

### L3: High-Performance Queues (`Channel<T>` vs `ConcurrentQueue<T>`)
**Difficulty:** L3 (Senior / Staff)

**Question:** You are writing an `IHostedService` background worker to process incoming Service Bus messages. Why should you use `System.Threading.Channels.Channel<T>` instead of `ConcurrentQueue<T>` to pass messages from the listener to the processor?

**Answer:** `ConcurrentQueue<T>` is a thread-safe collection, but it doesn't have built-in signaling; consumers have to spin-wait or use `Thread.Sleep()`, which wastes CPU. `Channel<T>` provides an asynchronous, backpressure-aware Producer/Consumer pipeline. The consumer can efficiently `await channel.Reader.ReadAsync()`, yielding the thread until data arrives. Furthermore, you can bound the channel (`Channel.CreateBounded<T>`), causing the producer to await if the queue is full, preventing OutOfMemory exceptions under heavy load.

---

### L3: Reactive Streams as Data Structures (`Observable<T>` vs `IEnumerable<T>`)
**Difficulty:** L3 (Senior / Staff)

**Question:** In the Angular frontend, we use `BehaviorSubject` and `Observable`. From an algorithmic and data structure perspective, how does an `Observable` relate to an `IEnumerable`?

**Answer:** They are mathematical duals. `IEnumerable<T>` is a **synchronous pull-based** structure; the consumer requests the next item and blocks until it gets it (`IEnumerator.MoveNext()`). `Observable<T>` is an **asynchronous push-based** structure; the producer pushes items to the consumer over time without blocking the main thread. A `BehaviorSubject` is simply an Observable that holds the "current state" (acting as a 1-item cache), making it the perfect data structure for real-time frontend UI state.

---

### L3: Concurrency and Thread Safety
**Difficulty:** L3 (Senior)

**Question:** You have a web API where multiple threads are adding and reading items from a shared `Dictionary<string, int>`. How do you prevent exceptions and data corruption?

**Answer:** Standard `Dictionary` is not thread-safe and will throw exceptions or corrupt data on concurrent writes. To fix this, use `ConcurrentDictionary<TKey, TValue>`, which utilizes fine-grained locking. If the data is read-heavy and rarely changes, wrapping a standard dictionary in a `ReaderWriterLockSlim`, or replacing the reference entirely using `ImmutableDictionary` for O(1) lock-free reads, might yield better performance under contention.

---

### L2: Span<T> vs Arrays for Performance
**Difficulty:** L2 (Mid-Level / Senior)

**Question:** You need to parse millions of strings or binary payloads in a high-throughput API. Why would you use `Span<T>` or `ReadOnlySpan<T>` instead of `string.Substring()` or array slicing?

**Answer:** `string.Substring()` and array slicing allocate new strings/arrays on the heap, triggering frequent Garbage Collection (GC) pauses. `Span<T>` is a ref struct that provides a window into existing contiguous memory (managed arrays, native memory, or stack memory) without allocating new objects. This achieves zero-allocation parsing, drastically reducing GC pressure and lowering API latency.

---

### L3: Memory Layout: List<Class> vs List<Struct>
**Difficulty:** L3 (Senior)

**Question:** From a memory and CPU cache perspective, what is the difference between `List<UserClass>` and `List<UserStruct>`, and how does it impact Garbage Collection?

**Answer:** A `List<UserClass>` is an array of object references (pointers). The actual object data is scattered across the heap. Iterating it causes frequent CPU cache misses, and the GC must trace every pointer during collection. A `List<UserStruct>` stores the actual value types contiguously in the backing array. Iterating it is incredibly fast due to CPU cache locality (spatial locality), and because structs have no object headers and live inline, they create zero additional objects for the GC to track, vastly reducing GC overhead.

---

### L2: State Machines (Domain vs Infrastructure)
**Difficulty:** L2 (Mid-Level)

**Question:** In the `tai-portal` backend, we implement a strict State Machine for user onboarding within the Domain layer (`ApplicationUser`), rather than just updating a database column. Why?

**Answer:** A State Machine ensures data integrity by enforcing valid transitions (e.g., `Created` -> `PendingApproval` -> `PendingVerification` -> `Active`). By encapsulating this in the Domain entity (`ApplicationUser.StartCustomerOnboarding()`), the C# compiler enforces the business rules before the database is ever touched or the Infrastructure layer is invoked. It prevents impossible states (like an unapproved user logging in) at the core object level.

---

### L2: Mathematical Sets for UI Deduplication
**Difficulty:** L2 (Mid-Level)

**Question:** In the Angular frontend for `tai-portal` (specifically the `TransferList` component), we store selected items using a JavaScript `Set<string>` rather than a standard array `[]`. What is the algorithmic benefit?

**Answer:** When users rapidly move items back and forth between two lists, we need to guarantee uniqueness. If we used an array, preventing duplicates requires calling `array.includes(item)` before every insertion, which is an O(N) operation. As the list grows, performance degrades. A `Set` enforces uniqueness mathematically via a hash map, making insertions and deduplication an O(1) operation, ensuring the UI remains perfectly responsive regardless of the list size.

---

### L3: Local Caching vs Network Bottlenecks
**Difficulty:** L3 (Senior)

**Question:** In a multi-tenant architecture, the `TenantResolutionMiddleware` needs to identify the `TenantId` based on the incoming hostname for every single API request. Why do we use an `IMemoryCache` instead of querying the database directly?

**Answer:** Hitting the database on every single HTTP request to resolve the tenant would introduce a massive O(N) network I/O bottleneck, crippling API latency. `IMemoryCache` (which acts as a thread-safe `ConcurrentDictionary` under the hood) caches the Hostname-to-TenantId mapping locally in the server's RAM. This turns a slow, multi-millisecond network hop into an instantaneous O(1) memory lookup.

---

### L3: Synchronous APIs vs Asynchronous Queues
**Difficulty:** L3 (Senior)

**Question:** When a new user is registered, we need to send them a welcome email and push a SignalR notification. Why do we publish a `UserRegisteredEvent` to a Service Bus (Message Queue) rather than awaiting the email service directly in the API controller?

**Answer:** If we `await` the email service in the controller, the API's response time becomes coupled to the latency of the external SMTP server. If the SMTP server is slow or down, the API call hangs or fails. By publishing the event to an out-of-process Message Queue (like Azure Service Bus or RabbitMQ), the API offloads the work and immediately returns a fast `200 OK`. A separate background worker pulls the message from the queue asynchronously, guaranteeing delivery without blocking the end-user.

---

### L3: Yield Return and Deferred Execution
**Difficulty:** L3 (Senior)

**Question:** When parsing a 10GB log file, why is it better to return `IEnumerable<string>` using `yield return` rather than returning a populated `List<string>`?

**Answer:** Returning a `List<string>` forces the application to load all 10GB into memory at once, likely causing an `OutOfMemoryException`. Using `yield return` creates a state machine (a compiler-generated class) that implements deferred execution. It reads, yields, and garbage collects one line at a time, keeping the application's memory footprint tiny (O(1) space complexity) while streaming the data to the caller.

---

### L3: Real-World Algorithm: Rate Limiting
**Difficulty:** L3 (Senior)

**Question:** How would you design a distributed Rate Limiter (e.g., 100 requests per minute per IP) across multiple instances of our `.NET 10` API? What data structure would you use?

**Answer:** An in-memory `Dictionary` won't work across multiple API instances. I would use Redis. A common algorithmic approach is the **Sliding Window Log**: using a Redis Sorted Set (`ZSET`) where the key is the IP, the score is the timestamp, and the value is a unique request ID. To check limits, we remove items older than 1 minute (`ZREMRANGEBYSCORE`), count the remaining items (`ZCARD`), and if under 100, add the new request (`ZADD`). Alternatively, a **Token Bucket** algorithm using atomic Lua scripts in Redis is highly efficient for memory.

---

### L3: Massive Data Search (OpenSearch & Trees)
**Difficulty:** L3 (Senior)

**Question:** In our DocViewer project, we have millions of documents. If a user searches for the word "contract" within a specific date range, why don't we use a standard SQL `LIKE '%contract%'` query, and what data structures make OpenSearch so much faster for this?

**Answer:** A SQL `LIKE` query with a leading wildcard performs an O(N) full table scan, scanning every row on disk. OpenSearch solves this using an **Inverted Index** (combining a Trie and Hash Map), which maps terms directly to document IDs in O(log N) or O(1) time. For the date range, OpenSearch uses **Tree Pruning** (via B-Trees/KD-Trees). It checks the bounding metadata of data segments, instantly discarding entire branches of the index if the dates don't overlap, meaning it only searches the exact shard and segment where a match is mathematically possible.

---

### L3: AI-Augmented Engineering & Algorithmic Refactoring
**Difficulty:** L3 (Senior)

**Question:** As an Agentic AI native software engineer, how do you leverage AI tools (like Copilot, Gemini CLI, or Cursor) to handle complex algorithmic bottlenecks or refactor legacy data structures in a massive `.NET` codebase?

**Answer:** Instead of treating AI as a simple autocomplete, I use it as a high-level reasoning engine for Big-O analysis and structural refactoring. For example, if I find a legacy $O(N^2)$ bottleneck caused by nested `List.Contains()` checks inside a `foreach` loop, I prompt the AI to mathematically analyze the time complexity and propose a space-for-time trade-off. By providing the exact constraints (e.g., "Refactor this mapping logic in C# 14 using `Dictionary` for O(1) lookups and `Span<T>` for zero-allocation parsing"), the agent generates the boilerplate for the optimized data structures. I then rely on my senior engineering judgment to verify thread safety (e.g., swapping to `ConcurrentDictionary` if it's a shared state) and rigorously test the AI's output for edge cases.

---

## Cross-References
- [[CSharp-Fundamentals]] — Provides context on Value Types (structs) vs Reference Types (classes).
- [[EFCore-SQL]] — Details how LINQ translates expression trees into SQL queries.

---

## Further Reading
- [Collections and Data Structures in .NET](https://learn.microsoft.com/en-us/dotnet/standard/collections/)
- [C# 14 and .NET 10 Performance Improvements](https://devblogs.microsoft.com/dotnet/)
- [libs/core/application/Models/PaginatedList.cs](../../../libs/core/application/Models/PaginatedList.cs)

---

*Last updated: 2026-03-31*lue Types (structs) vs Reference Types (classes).
- [[EFCore-SQL]] — Details how LINQ translates expression trees into SQL queries.

---

## Further Reading
- [Collections and Data Structures in .NET](https://learn.microsoft.com/en-us/dotnet/standard/collections/)
- [C# 14 and .NET 10 Performance Improvements](https://devblogs.microsoft.com/dotnet/)
- [libs/core/application/Models/PaginatedList.cs](../../../libs/core/application/Models/PaginatedList.cs)

---

*Last updated: 2026-03-31*