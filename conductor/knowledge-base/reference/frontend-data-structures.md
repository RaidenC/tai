---
title: Frontend Data Structures & Patterns
difficulty: L1 | L2 | L3 | Staff
lastUpdated: 2026-04-10
relatedTopics:
  - TypeScript
  - Angular-Core
  - RxJS-Signals
  - Data-Structures-Algorithms
stack:
  - frontend
---

## Table of Contents

[🧠 **View Interactive Mindmap**](./frontend-data-structures-mindmap.md)

1. **JavaScript Built-in Structures**
   - 1.1 [`Array` Internals — Sparse vs Dense](#array-internals--sparse-vs-dense)
   - 1.2 [`Map` vs Plain Object](#map-vs-plain-object)
   - 1.3 [`Set`](#set)
   - 1.4 [`WeakMap`, `WeakRef` & `WeakSet`](#weakmap-weakref--weakset)
   - 1.5 [`structuredClone()` vs `JSON.parse(JSON.stringify())`](#structuredclone-vs-jsonparsejsonstringify)

2. **Reactive Data Structures**
   - 2.1 [`Observable<T>` as Push-Based IEnumerable](#observablet-as-push-based-ienumerable)
   - 2.2 [`BehaviorSubject` as Stateful Cache](#behaviorsubject-as-stateful-cache)
   - 2.3 [Angular Signals as Synchronous Reactive Primitives](#angular-signals-as-synchronous-reactive-primitives)
   - 2.4 [`computed()` as Memoized Derivation](#computed-as-memoized-derivation)

3. **State Management Structures**
   - 3.1 [NgRx Store as Immutable State Tree](#ngrx-store-as-immutable-state-tree)
   - 3.2 [Selectors as Memoized Projections](#selectors-as-memoized-projections)
   - 3.3 [ComponentStore for Local State](#componentstore-for-local-state)
   - 3.4 [Signal-Based Store Pattern](#signal-based-store-pattern)

4. **Rendering & DOM Algorithms**
   - 4.1 [Incremental DOM vs Virtual DOM](#incremental-dom-vs-virtual-dom)
   - 4.2 [`@for track` — Identity-Based Diffing](#for-track--identity-based-diffing)
   - 4.3 [CDK VirtualScroll — Windowed Rendering](#cdk-virtualscroll--windowed-rendering)
   - 4.4 [Change Detection as Tree Traversal](#change-detection-as-tree-traversal)

5. **Client-Side Persistence**
   - 5.1 [`localStorage` / `sessionStorage`](#localstorage--sessionstorage)
   - 5.2 [IndexedDB — Structured Offline Storage](#indexeddb--structured-offline-storage)
   - 5.3 [Cache API — Service Worker Patterns](#cache-api--service-worker-patterns)

6. [Architecture & Data Flow](#architecture--data-flow)

7. **Real-World Examples**
   - 7.1 [tai-portal: TransferList `Set` Deduplication](#tai-portal-transferlist-set-deduplication)
   - 7.2 [tai-portal: NotificationSignalStore](#tai-portal-notificationsignalstore)
   - 7.3 [tai-portal: VirtualScroll for Privilege Lists](#tai-portal-virtualscroll-for-privilege-lists)

8. **Comparison Tables**

9. **Interview Q&A**
   - 9.1 **L1: Junior Knowledge**
     - 9.1.1 [`Map` vs Plain Object](#l1-map-vs-plain-object)
     - 9.1.2 [What Is `Set` and Why Use It?](#l1-what-is-set-and-why-use-it)
   - 9.2 **L2: Mid-Level Knowledge**
     - 9.2.1 [`WeakMap` and GC Behavior](#l2-weakmap-and-gc-behavior)
     - 9.2.2 [`structuredClone()` vs JSON Round-Trip](#l2-structuredclone-vs-json-round-trip)
     - 9.2.3 [`@for track` in Angular](#l2-for-track-in-angular)
   - 9.3 **L3: Senior Knowledge**
     - 9.3.1 [Signal vs Observable: Data Structure Perspective](#l3-signal-vs-observable-data-structure-perspective)
     - 9.3.2 [CDK VirtualScroll Algorithm & Accessibility](#l3-cdk-virtualscroll-algorithm--accessibility)
     - 9.3.3 [Client-Side Caching with IndexedDB](#l3-client-side-caching-with-indexeddb)
   - 9.4 **Staff: System Architecture**
     - 9.4.1 [Design a Signal-Based State System with Offline Support](#staff-design-a-signal-based-state-system-with-offline-support)

10. [Cross-References](#cross-references)
11. [Further Reading](#further-reading)

---

## TL;DR

Frontend data structures go far beyond arrays and objects. In 2026 Angular, <span style="color: #33b5e5; font-weight: bold;">`Map`</span> replaces plain objects for dynamic key-value storage (any key type, guaranteed iteration order, no prototype pollution), <span style="color: #33b5e5; font-weight: bold;">`Set`</span> provides O(1) deduplication (tai-portal's TransferList uses it for selected item uniqueness), and <span style="color: #33b5e5; font-weight: bold;">`WeakMap`/`WeakRef`</span> enable GC-friendly caching where entries are automatically collected when their key objects are no longer referenced. <span style="color: #00C851; font-weight: bold;">Angular Signals</span> are synchronous, pull-based reactive primitives that replace zone-based change detection with targeted, glitch-free updates — they are the data structure analogue of .NET's `INotifyPropertyChanged`. <span style="color: #00C851; font-weight: bold;">CDK VirtualScroll</span> applies the same windowing principle as server-side keyset pagination, rendering only visible DOM nodes from a 100K-item list. The key trade-off: <span style="color: #ffbb33; font-weight: bold;">Signals are synchronous and pull-based</span> (perfect for UI state), while <span style="color: #ffbb33; font-weight: bold;">Observables are asynchronous and push-based</span> (perfect for event streams) — knowing when to use each is a senior-level differentiator.

---
