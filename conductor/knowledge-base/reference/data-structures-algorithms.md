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
