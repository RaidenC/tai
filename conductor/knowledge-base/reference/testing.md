---
title: Testing
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - Angular-Core
  - RxJS-Signals
  - Nx-Monorepo
---

## TL;DR

Testing pyramid: many unit tests (fast, isolated), fewer integration tests, fewest E2E tests (slow, comprehensive). In .NET: xUnit + FluentAssertions. In Angular: Vitest + Playwright. For interviews: know when to mock, what makes a good test, and TDD concepts.

## Deep Dive

### Unit Testing (xUnit/Vitest)
### Integration Testing
### E2E Testing (Playwright)
### Test-Driven Development

---

## Interview Q&A

### L1: What makes a good unit test?
**Answer:** Fast, isolated, repeatable, self-validating, timely. Tests one thing, has clear name, no external dependencies.

### L2: When should you use mocks vs real objects?
**Answer:** Mock external dependencies (APIs, databases). Use real objects for logic that doesn't touch outside systems.

---

*Last updated: 2026-03-30*