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

C# is a strongly-typed, object-oriented language running on .NET. Key concepts include value types vs reference types, async/await, LINQ, and memory management. For interviews, understand the difference between `class` and `struct`, how `async/await` works under the hood, and when to use LINQ vs loops.

## Deep Dive

### Core Concepts
(Content in progress - being generated)

### Real-World Example from tai-portal
(Examples will be drawn from the portal-api codebase)

---

## Interview Q&A

### L1: What is the difference between `class` and `struct` in C#?
**Answer:** Structs are value types stored on the stack (unless boxed), classes are reference types stored on the heap. Structs are copied by value, classes by reference. Use struct for small, immutable data like points or dates.

### L2: Explain how async/await works in C#
**Answer:** async/await is syntactic sugar over Task-based asynchronous patterns. The compiler transforms async methods into state machines. await suspends execution until the Task completes without blocking the thread.

---

*Last updated: 2026-03-30*