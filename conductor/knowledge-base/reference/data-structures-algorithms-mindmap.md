---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---
# 1. Data Structures & Algorithms

## **1.1 Linear Structures**
1. Arrays & List&lt;T&gt;
   - Contiguous memory, O(1) index, O(1) amortized append
   - List doubles capacity on overflow — O(N) resize amortized away
   - Best CPU cache locality of all collections
2. LinkedList&lt;T&gt;
   - O(1) insert/remove at known node, but O(N) search
   - Poor cache locality — rarely used in modern .NET
3. Stack&lt;T&gt; & Queue&lt;T&gt;
   - Stack: LIFO for undo/redo, DFS, expression parsing
   - Queue: FIFO circular buffer for BFS, job scheduling
4. PriorityQueue
   - Min-heap: O(log N) enqueue/dequeue by priority
   - Cannot update priority of existing element

## **1.2 Hash-Based Structures**
1. Dictionary&lt;TKey, TValue&gt;
   - Hash function → bucket index → chaining on collision
   - O(1) average, O(N) worst-case with bad hash distribution
2. HashSet&lt;T&gt;
   - O(1) Contains vs List's O(N) — critical for deduplication
   - Set operations: UnionWith, IntersectWith, ExceptWith
3. FrozenDictionary (.NET 8+)
   - Optimized hash function generated at creation time
   - 20-40% faster reads, but expensive creation and permanently immutable
4. ImmutableDictionary
   - Structural sharing via balanced trees — lock-free concurrent reads
   - O(log N) modifications, higher memory per node
5. ArrayPool&lt;T&gt; & MemoryPool&lt;T&gt;
   - Rent/return buffers to avoid GC pressure
   - See Performance-Optimization for Span&lt;T&gt; deep dive

## **1.3 Trees & Graphs**
1. Binary Search Trees
   - Left < Parent < Right — O(log N) if balanced
   - SortedDictionary uses Red-Black Tree internally
2. B-Trees & Database Indexing
   - High branching factor → shallow tree → fewer disk reads
   - PostgreSQL/SQL Server index foundation
3. Graph Representation
   - Adjacency list: O(V + E) space, best for sparse graphs
   - Adjacency matrix: O(V²) space, O(1) edge lookup
4. Trie — Prefix Trees
   - O(K) lookup (K = key length), independent of collection size
   - Foundation for autocomplete and inverted index term lookup

## **1.4 Core Algorithms**
1. Big-O Notation
   - O(1) < O(log N) < O(N) < O(N log N) < O(N²) < O(2^N)
   - Ignores constants — cache locality matters for small N
2. Sorting — IntroSort
   - C# Array.Sort: QuickSort → HeapSort → InsertionSort hybrid
   - LINQ OrderBy is stable; Array.Sort is unstable
3. Binary Search
   - O(log N) on sorted data — halves search space each step
   - Watch for off-by-one errors in low/high/mid logic
4. BFS & DFS
   - BFS (Queue): shortest unweighted path, level-order
   - DFS (Stack): cycle detection, topological sort, backtracking
5. Recursion & Backtracking
   - Base case + recursive case; undo choices on dead ends
   - .NET stack ~1MB (~10K frames) — use iterative for deep recursion

## **1.5 Interview Algorithm Patterns**
1. Two-Pointer
   - Two indices moving through sorted array — O(N) vs O(N²)
   - Sum pairs, palindrome, container problems
2. Sliding Window
   - Maintain expanding/shrinking subarray window — O(N)
   - Fixed window (max sum) and variable window (longest substring)
3. Dynamic Programming
   - Memoization (top-down recursive + cache) vs Tabulation (bottom-up iterative)
   - Turns O(2^N) → O(N) for overlapping subproblems
4. Greedy Algorithms
   - Locally optimal choice at each step — O(N log N) with sort
   - Interval scheduling, Huffman coding, Dijkstra's

## **1.6 LINQ Algorithmic Complexity**
1. Complexity Table
   - Where/Select: O(N) lazy. OrderBy: O(N log N). Distinct: O(N) via HashSet
   - Count: O(1) on ICollection, O(N) otherwise. Contains on List: O(N)
2. Repeated Materialization
   - Lazy LINQ re-evaluates on each iteration — ToList() once to avoid
3. Any() vs Count() > 0
   - Any() short-circuits on first match — O(1) best case
   - Count() > 0 after ToList() materializes everything — wasteful
