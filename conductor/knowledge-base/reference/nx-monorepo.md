---
title: Nx & Monorepo
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - Angular-Core
  - Design-Patterns
  - Testing
---

## TL;DR

Nx is a build system for monorepos - multiple projects in one repository. Key concepts: shared code, dependency graph, affected builds, and library boundaries. For interviews: understand why monorepos, how Nx caches, and when to create libraries vs apps.

## Deep Dive

### Monorepo Benefits
### Nx Architecture
### Library Boundaries
### Affected Builds

---

## Interview Q&A

### L1: What are the benefits of a monorepo?
**Answer:** Shared code, atomic commits, easier refactoring, consistent tooling, faster builds via caching. Trade-offs: repo size, access control complexity.

### L2: What is the difference between an app and a library in Nx?
**Answer:** Apps are deployable (can be served/run). Libraries are shared code consumed by apps. Libraries enforce boundaries.

---

*Last updated: 2026-03-30*