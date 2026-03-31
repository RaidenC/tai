---
title: RxJS & Signals
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - Angular-Core
  - SignalR-Realtime
  - Testing
---

## TL;DR

RxJS provides reactive programming with Observables. Signals are Angular's newer reactive primitive (Angular 16+). For interviews: understand Observable lifecycle (create, subscribe, pipe operators), common operators (map, switchMap, catchError), and when to use Signals vs Observables.

## Deep Dive

### Observables
### Operators
### Subjects
### Angular Signals

---

## Interview Q&A

### L1: What is the difference between Observable and Promise?
**Answer:** Promise is eager (executes immediately), Observable is lazy (executes on subscription). Observable can emit multiple values, Promise resolves once.

### L2: When would you use switchMap over map?
**Answer:** switchMap cancels previous inner Observable when new value arrives - good for search autocomplete. map just transforms values.

---

*Last updated: 2026-03-30*