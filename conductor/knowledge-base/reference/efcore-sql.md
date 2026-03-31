---
title: EF Core & SQL
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - Data-Structures-Algorithms
  - Authentication-Authorization
  - Nx-Monorepo
---

## TL;DR

Entity Framework Core is an ORM that maps C# objects to database tables. Key concepts: DbContext, migrations, lazy/eager loading, change tracking, and query optimization. For interviews: know the difference between LINQ and SQL, what N+1 queries are, and how to optimize database access.

## Deep Dive

### ORM Concepts
### Migrations
### Query Optimization
### Transactions

---

## Interview Q&A

### L1: What is an N+1 query problem?
**Answer:** When loading related entities causes N additional queries (1 for parent, N for children). Solve with Include() or eager loading.

### L2: What's the difference between AsNoTracking() and regular queries?
**Answer:** AsNoTracking() skips change tracking - faster for read-only scenarios but can't update entities.

---

*Last updated: 2026-03-30*