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
