---
title: Data Structures & Algorithms
difficulty: L1 | L2 | L3 | Staff
lastUpdated: 2026-04-10
relatedTopics:
  - CSharp-Fundamentals
  - EFCore-SQL
  - Design-Patterns
  - System-Design
  - Performance-Optimization
  - Async-Concurrency
stack:
  - backend
---

## Table of Contents

[🧠 **View Interactive Mindmap**](./data-structures-algorithms-mindmap.md)

1. **Linear Structures**
   - 1.1 [Arrays & `List<T>`](#arrays--listt)
   - 1.2 [`LinkedList<T>`](#linkedlistt)
   - 1.3 [`Stack<T>` & `Queue<T>`](#stackt--queuet)
   - 1.4 [`PriorityQueue<TElement, TPriority>`](#priorityqueuetelement-tpriority)

2. **Hash-Based Structures**
   - 2.1 [`Dictionary<TKey, TValue>` & Hash Collisions](#dictionarytkey-tvalue--hash-collisions)
   - 2.2 [`HashSet<T>`](#hashsett)
   - 2.3 [`FrozenDictionary` & `FrozenSet` (.NET 8+)](#frozendictionary--frozenset-net-8)
   - 2.4 [`ImmutableDictionary` — Structural Sharing](#immutabledictionary--structural-sharing)
   - 2.5 [`ArrayPool<T>` & `MemoryPool<T>` — Buffer Reuse](#arraypoolt--memorypoolt--buffer-reuse)

3. **Trees & Graphs**
   - 3.1 [Binary Search Trees](#binary-search-trees)
   - 3.2 [B-Trees & Database Indexing](#b-trees--database-indexing)
   - 3.3 [Graph Representation](#graph-representation)
   - 3.4 [Trie — Prefix Trees](#trie--prefix-trees)

4. **Core Algorithms**
   - 4.1 [Big-O Notation](#big-o-notation)
   - 4.2 [Sorting — IntroSort, Stable vs Unstable](#sorting--introsort-stable-vs-unstable)
   - 4.3 [Binary Search](#binary-search)
   - 4.4 [BFS & DFS](#bfs--dfs)
   - 4.5 [Recursion & Backtracking](#recursion--backtracking)

5. **Interview Algorithm Patterns**
   - 5.1 [Two-Pointer Technique](#two-pointer-technique)
   - 5.2 [Sliding Window](#sliding-window)
   - 5.3 [Dynamic Programming — Memoization & Tabulation](#dynamic-programming--memoization--tabulation)
   - 5.4 [Greedy Algorithms](#greedy-algorithms)

6. **LINQ Algorithmic Complexity**
   - 6.1 [Complexity Table](#complexity-table)
   - 6.2 [Common Pitfall: Repeated Materialization](#common-pitfall-repeated-materialization)
   - 6.3 [`.Any()` vs `.Count() > 0`](#any-vs-count--0)

7. **Architecture & Data Flow**

8. **Real-World Examples**
   - 8.1 [tai-portal: IdentityService Pagination](#tai-portal-identityservice-pagination)
   - 8.2 [tai-portal: Permission Graph Traversal with BFS](#tai-portal-permission-graph-traversal-with-bfs)
   - 8.3 [DocViewer: Inverted Index & Tree Pruning](#docviewer-inverted-index--tree-pruning)

9. **Comparison Tables**

10. **Interview Q&A**
    - 10.1 **L1: Junior Knowledge**
      - 10.1.1 [Array vs `List<T>`](#l1-array-vs-listt)
      - 10.1.2 [`IEnumerable` vs `ICollection` vs `IList`](#l1-ienumerable-vs-icollection-vs-ilist)
      - 10.1.3 [What Is Big-O Notation?](#l1-what-is-big-o-notation)
    - 10.2 **L2: Mid-Level Knowledge**
      - 10.2.1 [Dictionary Internals & Hash Collisions](#l2-dictionary-internals--hash-collisions)
      - 10.2.2 [`HashSet` vs `List.Contains` Performance](#l2-hashset-vs-listcontains-performance)
      - 10.2.3 [Stack vs Queue vs PriorityQueue](#l2-stack-vs-queue-vs-priorityqueue)
      - 10.2.4 [`Span<T>` as Zero-Copy Data View](#l2-spant-as-zero-copy-data-view)
    - 10.3 **L3: Senior Knowledge**
      - 10.3.1 [Keyset Pagination vs Offset Pagination](#l3-keyset-pagination-vs-offset-pagination)
      - 10.3.2 [BFS vs DFS: When and How](#l3-bfs-vs-dfs-when-and-how)
      - 10.3.3 [Dynamic Programming: Memoization vs Tabulation](#l3-dynamic-programming-memoization-vs-tabulation)
      - 10.3.4 [`FrozenDictionary` vs `Dictionary`](#l3-frozendictionary-vs-dictionary)
    - 10.4 **Staff: System Architecture**
      - 10.4.1 [Design a Distributed Rate Limiter](#staff-design-a-distributed-rate-limiter)
      - 10.4.2 [Algorithmic Refactoring: O(N²) to O(N)](#staff-algorithmic-refactoring-on2-to-on)

11. [Cross-References](#cross-references)
12. [Further Reading](#further-reading)

---

## TL;DR

Data Structures and Algorithms form the foundation of efficient software engineering. This note covers <span style="color: #33b5e5; font-weight: bold;">classic structures</span> (Arrays, Lists, Hash Tables, Trees, Stacks, Queues) and <span style="color: #00C851; font-weight: bold;">modern .NET additions</span> (`FrozenDictionary`, `PriorityQueue`, immutable collections) that are critical for 2026 senior-level interviews. Beyond structures, it covers <span style="color: #33b5e5; font-weight: bold;">core algorithms</span> (BFS/DFS, binary search, sorting) and <span style="color: #00C851; font-weight: bold;">interview patterns</span> (two-pointer, sliding window, dynamic programming) that separate senior engineers from mid-levels. Understanding <span style="color: #ffbb33; font-weight: bold;">Big-O notation</span>, LINQ's hidden algorithmic complexity, and when to reach for `FrozenDictionary` over `Dictionary` demonstrates the production-grade thinking interviewers expect at the 9 YOE level. tai-portal uses `Skip/Take` pagination in `IdentityService`, value objects as `readonly record struct` for stack allocation, and `HashSet<T>` for O(1) tenant deduplication.

---

## Deep Dive

### Concept Group 1: Linear Structures

#### Arrays & `List<T>`

##### What
An <span style="color: #33b5e5; font-weight: bold;">array</span> is a contiguous fixed-size block of memory where every element occupies the same number of bytes, enabling O(1) index access via pointer arithmetic. <span style="color: #33b5e5; font-weight: bold;">`List<T>`</span> is a generic wrapper around an internal array that doubles its capacity when the element count exceeds the current array length, amortizing the resize cost over many insertions.

##### Why
Without understanding the array vs. `List<T>` distinction, you cannot reason about why index access is always O(1) while inserting at position 0 of a million-element list is O(N) — every subsequent element must shift one slot to the right. This matters whenever you review code that builds large lists via `Insert(0, item)` in a loop: what looks like O(N) iterations is actually <span style="color: #ff4444; font-weight: bold;">O(N²) total work</span>, a performance cliff that only surfaces at production data volumes.

##### How
```csharp
// Arrays — fixed size, fastest possible access
int[] scores = new int[5];
scores[0] = 42;          // O(1) — direct pointer offset
scores[6] = 99;          // IndexOutOfRangeException — bounds enforced at runtime
                         // .NET 10 JIT eliminates bounds checks in tight loops
                         // where it can prove the index is in range (no overhead)

// List<T> — dynamic array with doubling resize
List<string> names = new();   // Internal array capacity: 4
names.Add("Alice");           // O(1) amortized
names.Add("Bob");
names.Add("Carol");
names.Add("Dave");
names.Add("Eve");             // Capacity exceeded → new array of size 8, Array.Copy called

// The doubling strategy: resize cost amortized to O(1) per insert
// N insertions → at most 2N copy operations total (geometric series)

// Pre-allocate when count is known to avoid resizing
List<int> ids = new(capacity: 10_000);  // No resizes during population

// Mid-list insert — the silent O(N) killer
names.Insert(0, "Zara");   // Shifts ALL existing elements right — O(N)

// Span<T> for zero-copy slicing (avoids array allocation)
int[] data = { 1, 2, 3, 4, 5 };
Span<int> slice = data.AsSpan(1, 3);   // { 2, 3, 4 } — no heap allocation
```

##### When
Use a raw array when the size is known at compile time and you need maximum performance (e.g., fixed-size buffers, image pixel rows). Use `List<T>` as your default ordered, dynamic collection. Do <span style="color: #ff4444; font-weight: bold;">not</span> use `List<T>` for frequent mid-list insertions or removals — reach for `LinkedList<T>` if you hold node references, or reconsider your data model.

##### Trade-offs
O(1) index access, O(1) amortized append. <span style="color: #ffbb33; font-weight: bold;">O(N) mid-list insert/delete</span> due to element shifting. Memory layout is contiguous, which means <span style="color: #00C851; font-weight: bold;">excellent CPU cache locality</span> — hardware prefetchers love sequential access patterns. Resizing allocates a new backing array (old one becomes GC garbage), so pre-allocating with a known capacity eliminates that pressure.

---

#### `LinkedList<T>`

##### What
<span style="color: #33b5e5; font-weight: bold;">`LinkedList<T>`</span> is a doubly-linked list where each node (`LinkedListNode<T>`) stores a value plus references to the previous and next nodes. The collection itself holds only `First` and `Last` node references plus a count.

##### Why
`LinkedList<T>` provides O(1) insert and remove at a known node position — a guarantee no array-backed structure can match. If you already hold a `LinkedListNode<T>` reference, splicing it in or out requires only pointer rewiring, regardless of list length. This is the precise semantic needed for structures like an LRU cache eviction queue, where you promote a node to the front on cache hit.

##### How
```csharp
var history = new LinkedList<string>();
LinkedListNode<string> node = history.AddLast("Step 1");
history.AddLast("Step 2");
history.AddLast("Step 3");

// O(1) insert adjacent to a known node
history.AddAfter(node, "Step 1.5");  // No shifting — just pointer rewiring

// O(1) remove by node reference
history.Remove(node);  // "Step 1" gone; surrounding pointers updated

// O(N) traversal — no index access
foreach (var step in history)
    Console.WriteLine(step);

// LRU cache pattern: move recently accessed node to front in O(1)
void Touch(LinkedListNode<string> n) {
    history.Remove(n);       // O(1) — node reference known
    history.AddFirst(n);     // O(1) — prepend
}
```

##### When
Use `LinkedList<T>` when you hold node references and need frequent O(1) insert/remove at arbitrary positions — the canonical example is an LRU eviction queue. <span style="color: #ff4444; font-weight: bold;">Do not use it for random access</span> (O(N) traversal) or when you just need a dynamic ordered list (`List<T>` is faster for everything else). In 2026 .NET, `List<T>` beats `LinkedList<T>` for most workloads because CPU cache locality dominates over theoretical pointer-manipulation savings.

##### Trade-offs
O(1) insert/remove at a known node, O(N) search, O(N) index access. <span style="color: #ffbb33; font-weight: bold;">Poor CPU cache locality</span> — each node is a separate heap allocation, so traversal generates cache misses on every step. Extra memory overhead: two object references per node (~16 bytes on 64-bit) plus the node object header itself. Effectively never the right default choice — justify it with a specific O(1)-node-manipulation requirement.

---

#### `Stack<T>` & `Queue<T>`

##### What
<span style="color: #33b5e5; font-weight: bold;">`Stack<T>`</span> is a Last-In-First-Out (LIFO) collection backed by an internal array: `Push` appends to the top, `Pop` removes from the top. <span style="color: #33b5e5; font-weight: bold;">`Queue<T>`</span> is a First-In-First-Out (FIFO) collection backed by a circular buffer: `Enqueue` writes to the tail, `Dequeue` reads from the head — avoiding the O(N) shift that a naive array-front-removal would require.

##### Why
These types encode access semantics into the type system. A `Stack<T>` makes it impossible to accidentally dequeue the middle element; a `Queue<T>` prevents jumping the line. Beyond correctness, they communicate intent: a reviewer seeing `Stack<T>` immediately knows LIFO semantics are required. Without them, you'd simulate LIFO/FIFO on a `List<T>` and pay O(N) on every removal from the wrong end.

##### How
```csharp
// Stack<T> — LIFO: DFS, undo/redo, expression parsing
var undo = new Stack<string>();
undo.Push("typed 'H'");
undo.Push("typed 'i'");
undo.Push("deleted 'i'");

string last = undo.Pop();     // "deleted 'i'" — O(1)
string peek = undo.Peek();    // "typed 'i'" — O(1), no removal

// Queue<T> — FIFO: BFS, task scheduling, message processing
// Backed by a circular buffer: head/tail indices wrap around the array
// Avoids O(N) shift on Dequeue that List<T>.RemoveAt(0) would require
var tasks = new Queue<string>();
tasks.Enqueue("Task A");
tasks.Enqueue("Task B");
tasks.Enqueue("Task C");

string next = tasks.Dequeue();   // "Task A" — O(1)
string front = tasks.Peek();     // "Task B" — O(1), no removal

// Iterative DFS using Stack (avoids recursion stack overflow on deep graphs)
void Dfs(int start, int[] adj) {
    var stack = new Stack<int>();
    var visited = new HashSet<int>();
    stack.Push(start);
    while (stack.Count > 0) {
        int node = stack.Pop();
        if (!visited.Add(node)) continue;
        // process node
        foreach (var neighbor in adj) stack.Push(neighbor);
    }
}
```

##### When
Use `Stack<T>` for most-recent-first processing: undo/redo, iterative DFS, bracket-matching, expression evaluation. Use `Queue<T>` for first-come-first-served: BFS traversal, work queues, buffering items for batch processing. Neither is suitable for priority-based ordering — reach for `PriorityQueue<TElement, TPriority>` instead.

##### Trade-offs
Both `Push`/`Pop` and `Enqueue`/`Dequeue` are O(1) amortized (same doubling resize as `List<T>`). Low memory overhead — the circular buffer in `Queue<T>` reuses slots without shifting. <span style="color: #ffbb33; font-weight: bold;">Neither is thread-safe</span> — use `ConcurrentStack<T>` or `ConcurrentQueue<T>` (lock-free, CAS-based) for multi-producer/multi-consumer scenarios.

---

#### `PriorityQueue<TElement, TPriority>`

##### What
<span style="color: #33b5e5; font-weight: bold;">`PriorityQueue<TElement, TPriority>`</span>, introduced in .NET 6, is a binary min-heap that always dequeues the element with the **lowest** priority value. Internally, elements are stored in a flat array where each parent at index `i` has children at `2i + 1` and `2i + 2`, maintaining the heap invariant via `Heapify` operations on enqueue and dequeue.

##### Why
Without `PriorityQueue`, ordering by priority requires either sorting the collection on every dequeue — O(N log N) — or maintaining a sorted `List<T>` with O(N) inserts. A binary heap gives you O(log N) insert and O(log N) extract-minimum, which is the difference between a scheduler that handles 10,000 events/second and one that crawls past a few hundred.

##### How
```csharp
// Basic priority queue — lower number = higher priority
var scheduler = new PriorityQueue<string, int>();
scheduler.Enqueue("Low priority task",    priority: 10);
scheduler.Enqueue("Critical task",        priority: 1);
scheduler.Enqueue("Normal task",          priority: 5);

// Dequeue always returns the minimum priority element
while (scheduler.Count > 0) {
    string task = scheduler.Dequeue();   // Critical → Normal → Low
    Console.WriteLine(task);
}

// Dijkstra's shortest path skeleton
var dist = new Dictionary<int, int>();
var pq = new PriorityQueue<int, int>();  // (node, distance)
pq.Enqueue(startNode, 0);

while (pq.Count > 0) {
    pq.TryDequeue(out int node, out int d);
    if (dist.ContainsKey(node)) continue;   // Already settled
    dist[node] = d;
    foreach (var (neighbor, weight) in graph[node])
        pq.Enqueue(neighbor, d + weight);   // O(log N) per enqueue
}

// Binary heap array representation (min-heap invariant):
// Index:  0   1   2   3   4   5   6
// Value:  1   3   5   7   4   8   6
//         ^   ^ ^   ^ ^
//         root  children  grandchildren
// Parent of i → (i-1)/2 ; Children of i → 2i+1, 2i+2
```

##### When
Use `PriorityQueue<TElement, TPriority>` for job scheduling with urgency levels, Dijkstra's and A* pathfinding, event-driven simulations (process earliest-time event first), and any "always process the most important item next" pattern. <span style="color: #ff4444; font-weight: bold;">Do not use it as a FIFO queue</span> — elements with equal priority have no guaranteed ordering. For highest-priority-first, negate the priority value (e.g., pass `-urgency`).

##### Trade-offs
O(log N) enqueue, O(log N) dequeue, O(1) peek-minimum. <span style="color: #ffbb33; font-weight: bold;">No efficient priority update</span> for an element already in the heap — the standard workaround is lazy deletion (re-enqueue with new priority, skip stale entries on dequeue). <span style="color: #ff4444; font-weight: bold;">Not thread-safe</span> — wrap with locks or use a third-party concurrent priority queue for multi-threaded scenarios. Memory is contiguous (flat array), so cache performance is good compared to pointer-based heap implementations.

---

## Concept Group 2: Hash-Based Structures

---

#### `Dictionary<TKey, TValue>` & Hash Collisions

##### What
<span style="color: #33b5e5; font-weight: bold;">`Dictionary<TKey, TValue>`</span> is a hash table that maps keys to values by running the key through a hash function to produce a bucket index. Each bucket holds a linked chain of entries — when two keys hash to the same bucket index, that's a <span style="color: #33b5e5; font-weight: bold;">collision</span>, and the chain grows by one node. Internally, .NET's `Dictionary<TKey, TValue>` stores entries in a flat array (not a true linked list) alongside a parallel `_buckets` int array of head indices, giving it excellent cache locality compared to pointer-chasing implementations.

##### Why
The primary reason `Dictionary<TKey, TValue>` dominates day-to-day .NET development is its <span style="color: #00C851; font-weight: bold;">O(1) average-case lookup and insert</span>. When you need to look up a user by ID, cache a computed value by key, or invert a mapping, no other general-purpose structure competes. Contrast with `List<T>.Contains()` at O(N) — on a list of 100,000 items, a dictionary lookup is orders of magnitude faster.

##### How
```csharp
// Core operations
var cache = new Dictionary<int, UserDto>();

// TryGetValue — preferred over ContainsKey + indexer (single hash computation)
if (!cache.TryGetValue(userId, out var user))
{
    user = await db.Users.FindAsync(userId);
    cache[userId] = user;
}

// Collision demonstration: two keys with the same bucket index
// GetHashCode() → bucket via (hash & 0x7FFFFFFF) % bucketCount
// If "Alice" and "Bob" both map to bucket 7:
//   bucket[7] → entry("Alice", ...) → entry("Bob", ...) → null
// Equality check walks the chain until key matches

// Load factor & resizing: .NET resizes when count/buckets > ~0.72
// Resize doubles bucket count and rehashes all entries — O(N) one-time cost
// Amortized over N inserts → still O(1) per insert

// Dictionary with custom equality (case-insensitive keys)
var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
headers["Content-Type"] = "application/json";
Console.WriteLine(headers["content-type"]);  // "application/json" — key match ignores case
```

##### When
<span style="color: #00C851; font-weight: bold;">Reach for `Dictionary<TKey, TValue>`</span> for key-value mapping, result caching, lookup tables by ID/slug, and grouping operations where you build a map once and query it repeatedly. <span style="color: #ff4444; font-weight: bold;">Do not use it when you need ordered iteration by key</span> — use `SortedDictionary<TKey, TValue>` (red-black tree, O(log N)) or `SortedList<TKey, TValue>` (array-backed, faster reads, slower inserts) instead. Also avoid when insertion order matters — `Dictionary<TKey, TValue>` does not guarantee enumeration order (even though the current implementation tends to preserve it).

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">O(N) worst-case</span> if an adversary can control input keys and engineer hash collisions into the same bucket (hash flooding attack) — .NET mitigates this with randomized hash seeds (`DOTNET_UseRandomizedHashing`). Memory overhead is higher than `List<T>`: two parallel arrays (buckets + entries) plus per-entry metadata. No insertion-order guarantee. For read-heavy scenarios with a fixed key set, see `FrozenDictionary` below.

---

#### `HashSet<T>`

##### What
<span style="color: #33b5e5; font-weight: bold;">`HashSet<T>`</span> is a hash table that stores unique keys with no associated values. Internally it shares the same bucket-and-entry array design as `Dictionary<TKey, TValue>` — you can think of it as `Dictionary<T, Unit>` where the value slot is omitted. Duplicate `Add()` calls are silently ignored; the return value (`bool`) tells you whether the item was newly inserted.

##### Why
The critical performance win is <span style="color: #00C851; font-weight: bold;">O(1) `Contains()` vs O(N) on `List<T>`</span>. In interview scenarios and production code alike, replacing a `List<T>` with a `HashSet<T>` for membership checks is one of the most common and highest-ROI optimizations. Beyond membership, `HashSet<T>` provides set-algebra methods (`UnionWith`, `IntersectWith`, `ExceptWith`) that operate in O(N) on both collections, making deduplication and set comparison trivial.

##### How
```csharp
var seen = new HashSet<int>();
var processed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

// Add returns false if already present
bool isNew = seen.Add(42);   // true
isNew = seen.Add(42);         // false — duplicate silently dropped

// O(1) membership check
if (!seen.Contains(userId))
    ProcessUser(userId);

// Set algebra — all mutate the receiver in-place
var admins   = new HashSet<string> { "alice", "bob" };
var editors  = new HashSet<string> { "bob", "carol" };

admins.UnionWith(editors);        // { "alice", "bob", "carol" }
admins.IntersectWith(editors);    // { "bob" }
admins.ExceptWith(editors);       // { "alice" }

// Deduplication pattern
var unique = new HashSet<int>(rawList);   // O(N), removes all duplicates

// Read-only set operations without mutation — return new sets
var union = new HashSet<string>(admins);
union.UnionWith(editors);

// Overlaps & subset checks (O(N))
bool anyShared = admins.Overlaps(editors);
bool isSubset  = admins.IsSubsetOf(editors);
```

##### When
Use `HashSet<T>` for deduplication, existence checks, visited-node tracking in graph traversal, and any set-algebra operation (union, intersection, difference). <span style="color: #ff4444; font-weight: bold;">Don't reach for `HashSet<T>` reflexively on tiny collections</span> — for fewer than ~10 elements, `List<T>.Contains()` is often faster because the entire list fits in a cache line and avoids the hashing overhead and two-array memory layout of `HashSet<T>`.

##### Trade-offs
Same hash-table costs as `Dictionary<TKey, TValue>`: higher memory than `List<T>`, O(N) worst-case on adversarial input, no ordering guarantee. <span style="color: #ffbb33; font-weight: bold;">For small, cache-hot collections, `List<T>` wins on raw throughput</span> due to sequential memory access patterns (hardware prefetcher helps). When ordering matters and uniqueness is required, `SortedSet<T>` (red-black tree) gives you O(log N) operations with sorted iteration.

---

#### `FrozenDictionary` & `FrozenSet` (.NET 8+)

##### What
<span style="color: #33b5e5; font-weight: bold;">`FrozenDictionary<TKey, TValue>`</span> and <span style="color: #33b5e5; font-weight: bold;">`FrozenSet<T>`</span>, introduced in .NET 8, are read-only collections that are **optimized at creation time** for the specific key set they contain. Unlike `Dictionary<TKey, TValue>`, which uses a generic hash function, `FrozenDictionary` analyzes the actual keys during construction and may select a perfect or near-perfect hash function that eliminates collisions entirely for that key set. The result is a collection that cannot be mutated after creation but delivers measurably faster reads on hot paths.

##### Why
Benchmarks show <span style="color: #00C851; font-weight: bold;">20–40% faster lookups than `Dictionary<TKey, TValue>`</span> on string keys in read-heavy scenarios. For data that is loaded once at startup — permission maps, route tables, configuration values, feature flag registries — and then queried millions of times per second, that improvement compounds significantly. The immutability contract also removes the need for any read-side locking, which eliminates lock contention entirely.

##### How
```csharp
using System.Collections.Frozen;

// Build once at startup, store as FrozenDictionary
var permissions = new Dictionary<string, string[]>
{
    ["Admin"]  = ["Portal.Users.Read", "Portal.Users.Create", "Portal.Users.Delete"],
    ["Editor"] = ["Portal.Users.Read", "Portal.Users.Create"],
    ["Viewer"] = ["Portal.Users.Read"]
}.ToFrozenDictionary();

// tai-portal pattern: inject as singleton, use in authorization middleware
public class PermissionService(FrozenDictionary<string, string[]> permissionMap)
{
    public bool HasPermission(string role, string permission) =>
        permissionMap.TryGetValue(role, out var perms) &&
        perms.Contains(permission);
}

// FrozenSet — same idea for unique value lookup
var allowedExtensions = new HashSet<string> { ".pdf", ".docx", ".xlsx" }
    .ToFrozenSet(StringComparer.OrdinalIgnoreCase);

bool allowed = allowedExtensions.Contains(ext);  // ~30% faster than HashSet on average

// Registration in DI (startup, not per-request)
builder.Services.AddSingleton(_ =>
    LoadPermissionsFromConfig().ToFrozenDictionary());
```

##### When
<span style="color: #00C851; font-weight: bold;">Use `FrozenDictionary` / `FrozenSet` for any data that is populated once and read many times</span>: permission maps, route/endpoint registries, country/currency lookup tables, allowed-value sets for validation, feature flag definitions. <span style="color: #ff4444; font-weight: bold;">Do not use for runtime-changing data</span> — the collection is permanently immutable. If the underlying data must be refreshed (e.g., permission rules change at runtime), you need to rebuild the `FrozenDictionary` and swap an `Interlocked`-managed reference, which is an O(N) rebuild cost.

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">Construction is expensive</span>: `ToFrozenDictionary()` performs key analysis, potentially sorts, and computes the optimized hash structure — a high constant-factor O(N) operation. For small dictionaries (<50 entries), the creation overhead may exceed the total lifetime read savings. The collection is permanently immutable post-construction; any "update" requires a full rebuild. Not suitable for collections that grow or shrink during application lifetime.

---

#### `ImmutableDictionary` — Structural Sharing

##### What
<span style="color: #33b5e5; font-weight: bold;">`ImmutableDictionary<TKey, TValue>`</span> (from `System.Collections.Immutable`) is a <span style="color: #33b5e5; font-weight: bold;">persistent data structure</span> implemented as a balanced binary tree (HAMT — Hash Array Mapped Trie). Each "modification" — `Add`, `Remove`, `SetItem` — does **not** mutate the original; instead it returns a new `ImmutableDictionary` instance that shares most of the internal tree nodes with the original. This is called <span style="color: #33b5e5; font-weight: bold;">structural sharing</span>: two dictionary versions coexist in memory with O(log N) new nodes, not two full copies.

##### Why
The key benefit is <span style="color: #00C851; font-weight: bold;">lock-free concurrent reads</span>. Because no mutation ever occurs in-place, any number of threads can read an `ImmutableDictionary` simultaneously without locks. When an update is needed, a writer atomically swaps a reference (via `Interlocked.Exchange` or `Volatile.Write`) to a new version, and subsequent readers naturally pick up the new version without stale-read risk. Each reader seeing the old reference continues seeing a fully consistent snapshot.

##### How
```csharp
using System.Collections.Immutable;

// Immutable — all "mutation" methods return a new instance
var v1 = ImmutableDictionary<string, int>.Empty
    .Add("Alice", 1)
    .Add("Bob",   2);

var v2 = v1.Add("Carol", 3);   // v1 unchanged; v2 shares nodes with v1
var v3 = v1.Remove("Alice");   // v1 unchanged; v3 is independent

Console.WriteLine(v1.Count);  // 2  — original untouched
Console.WriteLine(v2.Count);  // 3
Console.WriteLine(v3.Count);  // 1

// Thread-safe snapshot swap pattern
private volatile ImmutableDictionary<string, FeatureFlag> _flags =
    ImmutableDictionary<string, FeatureFlag>.Empty;

public void UpdateFlag(string key, FeatureFlag value)
{
    // Spin loop for compare-and-swap
    ImmutableDictionary<string, FeatureFlag> current, updated;
    do
    {
        current = _flags;
        updated = current.SetItem(key, value);
    }
    while (!ReferenceEquals(
        Interlocked.CompareExchange(ref _flags, updated, current),
        current));
}

public FeatureFlag? GetFlag(string key) =>
    _flags.TryGetValue(key, out var f) ? f : null;  // No lock needed

// Builder for batch construction (avoid O(N log N) individual Adds)
var builder = ImmutableDictionary.CreateBuilder<string, int>();
builder.Add("x", 1);
builder.Add("y", 2);
var dict = builder.ToImmutable();   // Single O(N) build pass
```

##### When
Use `ImmutableDictionary` when multiple threads read concurrently and updates are infrequent: feature flag registries refreshed every few minutes, per-request snapshots of shared state, undo/redo history stacks, and functional-style transformations where you need to preserve previous versions. <span style="color: #ff4444; font-weight: bold;">Do not use for write-heavy workloads</span> — each `Add` or `Remove` is O(log N) and allocates new tree nodes, making it dramatically slower than `Dictionary<TKey, TValue>` under high write throughput. For write-heavy concurrent scenarios, prefer `ConcurrentDictionary<TKey, TValue>`.

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">Reads are slower than `Dictionary<TKey, TValue>`</span>: tree traversal (O(log N)) vs hash lookup (O(1)), plus pointer-chasing through tree nodes hurts cache performance. Higher per-node memory (each node stores key, value, hash, child references). The structural sharing benefit only justifies the overhead when concurrent consistency or version history is a hard requirement. For a simpler read-mostly singleton, prefer `FrozenDictionary`; for concurrent writes, prefer `ConcurrentDictionary`.

---

#### `ArrayPool<T>` & `MemoryPool<T>` — Buffer Reuse

##### What
<span style="color: #33b5e5; font-weight: bold;">`ArrayPool<T>`</span> and <span style="color: #33b5e5; font-weight: bold;">`MemoryPool<T>`</span> (from `System.Buffers`) are shared pools for renting and returning temporary arrays and memory segments, bypassing the GC allocator entirely for hot-path buffer usage. `ArrayPool<T>.Shared` is the static thread-local-aware pool built into the runtime. `MemoryPool<T>` wraps `ArrayPool` and returns `IMemoryOwner<T>` — an `IDisposable` handle to a `Memory<T>` slice — which integrates cleanly with async pipelines.

##### Why
In high-throughput APIs, allocating a `new byte[4096]` per request pushes objects onto the heap and triggers Gen0 GC collections. Under load, GC pauses become a dominant latency source — even Gen0 collections that take <1 ms add up to tens of milliseconds of pause time per second across many threads. Buffer pooling <span style="color: #00C851; font-weight: bold;">eliminates the per-request allocation entirely</span>: the array is rented from the pool (a thread-local array taken from a pre-allocated bucket), used, then returned — zero GC pressure.

##### How
```csharp
using System.Buffers;

// ArrayPool<T> — rent, use, return
byte[] buffer = ArrayPool<byte>.Shared.Rent(1024);
try
{
    // buffer.Length may be >= 1024 (pool rounds up to power of two)
    int bytesRead = stream.Read(buffer, 0, 1024);
    ProcessData(buffer.AsSpan(0, bytesRead));
}
finally
{
    // MUST return — forgetting causes pool exhaustion (silent memory leak)
    ArrayPool<byte>.Shared.Return(buffer, clearArray: false);
}

// MemoryPool<T> — IDisposable pattern, safer for async
using IMemoryOwner<byte> owner = MemoryPool<byte>.Shared.Rent(1024);
Memory<byte> mem = owner.Memory;  // Slice up to requested size
int read = await stream.ReadAsync(mem);
ProcessData(mem.Span[..read]);
// owner.Dispose() returns buffer automatically at end of using block

// Custom-sized pool for domain-specific buffer sizes
private static readonly ArrayPool<char> _charPool =
    ArrayPool<char>.Create(maxArrayLength: 64 * 1024, maxArraysPerBucket: 50);
```

##### When
Use `ArrayPool<T>` / `MemoryPool<T>` for parsing, serialization, stream processing, and any pattern where you repeatedly allocate and discard identically-sized byte or char buffers within a request. Common in middleware, gRPC handlers, JSON serializers, and file upload endpoints. Cross-reference: see [[Performance-Optimization]] for a full deep dive on `Span<T>`, `Memory<T>`, and zero-allocation patterns. <span style="color: #ff4444; font-weight: bold;">Do not rent and forget</span> — a buffer that is never returned exhausts the pool bucket and falls back to heap allocation, defeating the purpose entirely.

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">Rented arrays may be larger than requested</span> (pool rounds up to the next power-of-two bucket) — always slice with `AsSpan(0, actualLength)` rather than using the full array. Returning without `clearArray: true` means the buffer may contain data from a previous caller — a subtle <span style="color: #ff4444; font-weight: bold;">security risk</span> if buffer contents could be read by untrusted code (e.g., sending HTTP response buffers). `ArrayPool<T>` is not suitable as a long-lived storage mechanism — rented arrays should be held only for the duration of a single operation, not stored on objects or fields.

---
