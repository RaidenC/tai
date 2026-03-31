---
title: Angular Core
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - RxJS-Signals
  - Nx-Monorepo
  - Security-CSP-DPoP
---

## TL;DR

Angular is a TypeScript-based framework using component architecture. Key concepts: Dependency Injection, component lifecycle, modules, and change detection. For interviews: understand how DI works, the difference between OnPush and Default change detection, and component communication patterns.

## Deep Dive

### Components & Templates
### Dependency Injection
### Modules
### Change Detection

---

## Interview Q&A

### L1: What is Dependency Injection in Angular?
**Answer:** A design pattern where dependencies are provided to a class rather than created by it. Angular's DI system manages service instantiation and scoping.

### L2: What is ChangeDetectionStrategy.OnPush?
**Answer:** Optimizes change detection by only checking when @Input references change or events fire. Improves performance significantly.

---

*Last updated: 2026-03-30*