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

## Deep Dive

---

## Concept Group 1: JavaScript Built-in Structures

### 1.1 `Array` Internals — Sparse vs Dense

##### What

<span style="color: #33b5e5; font-weight: bold;">JavaScript arrays are objects with numeric keys</span>, not true contiguous memory blocks like C# arrays. V8 (Chrome's JS engine) uses two internal representations: **dense arrays** have contiguous integer indices from `0..N-1` and get an optimized C++ backing store (essentially a real array in memory), while **sparse arrays** have gaps in their indices and fall back to a hash-table representation. The engine transparently switches between these modes based on access patterns.

##### Why

<span style="color: #00C851; font-weight: bold;">Dense arrays iterate at near-C++ speed</span> because the JIT compiler can generate tight loops against contiguous memory. <span style="color: #ff4444; font-weight: bold;">Sparse arrays are 10–100x slower</span> for iteration because every index access becomes a hash-table lookup. The danger is that this switch is silent — `delete arr[5]` leaves a hole and silently degrades performance for the entire array.

##### How

```typescript
// Dense array — V8 uses optimized C++ backing store
const dense: number[] = [1, 2, 3, 4, 5];

// Sparse array — created by delete or skipping indices
const sparse: number[] = [1, 2, 3, 4, 5];
delete sparse[2]; // ← hole at index 2, now hash-table backed

// Safe dense initialization with N elements (never use new Array(N))
const denseN = Array.from({ length: 5 }, (_, i) => i * 2); // [0, 2, 4, 6, 8]

// Typed Arrays: single fixed type, true contiguous memory (for binary/WebGL)
const buffer = new Uint8Array(1024);      // 1024 bytes, no boxing overhead
const floatBuf = new Float32Array(256);   // 32-bit floats for shader uniforms

// Avoid these patterns that create sparse arrays:
const bad1 = new Array(100);             // 100-slot sparse array
bad1[50] = 'value';                      // still sparse — gaps everywhere
```

##### When

<span style="color: #00C851; font-weight: bold;">Always prefer dense arrays.</span> Use `Array.from({ length: N }, fn)` instead of `new Array(N)` for pre-allocated dense arrays. Use **Typed Arrays** (`Uint8Array`, `Float32Array`, etc.) for WebGL vertex buffers, binary protocol parsing (e.g. reading a WebSocket binary frame), or any numeric computation that needs zero boxing overhead.

##### Trade-offs

| Approach | Speed | Flexibility | Memory |
|---|---|---|---|
| Dense array | <span style="color: #00C851; font-weight: bold;">V8-optimized, JIT-compiled loops</span> | Any element type | Boxing per element |
| Sparse array | <span style="color: #ff4444; font-weight: bold;">Hash-table penalty, loses JIT</span> | Any element type | Hash overhead |
| Typed Array | <span style="color: #00C851; font-weight: bold;">True contiguous, no boxing</span> | <span style="color: #ff4444; font-weight: bold;">Fixed size, single numeric type</span> | Minimal |

---

### 1.2 `Map` vs Plain Object

##### What

<span style="color: #33b5e5; font-weight: bold;">`Map<K, V>` is a proper hash table</span> with well-defined behavior: any key type (objects, functions, primitives), guaranteed insertion-order iteration, and no prototype chain. Plain objects (`{}`) carry JavaScript's prototype chain, which means keys like `__proto__`, `constructor`, and `toString` are reserved and can cause subtle bugs.

##### Why

<span style="color: #ff4444; font-weight: bold;">Prototype pollution</span> is a real security concern when using objects as dictionaries with user-controlled keys. A key of `"__proto__"` can corrupt the prototype chain. `Map` has no prototype chain on its entries, accepts any key type (e.g. `Map<HTMLElement, ComponentRef>`), tracks `.size` natively, and performs slightly better for frequent add/delete workloads because it's purpose-built for hash-table operations.

##### How

```typescript
type UserId = string;
interface User { id: UserId; name: string; }

// Map: explicit type-safe, any key, O(1) operations
const userCache = new Map<UserId, User>();
userCache.set('u1', { id: 'u1', name: 'Alice' });
userCache.set('u2', { id: 'u2', name: 'Bob' });

console.log(userCache.get('u1'));     // { id: 'u1', name: 'Alice' }
console.log(userCache.has('u3'));     // false
console.log(userCache.size);         // 2

userCache.delete('u1');
for (const [id, user] of userCache) { // guaranteed insertion order
  console.log(id, user.name);
}

// Plain object (Record): fine for static, known keys
const config: Record<string, string> = {
  apiUrl: 'https://api.example.com',
  environment: 'production',
};

// Prototype pollution danger with plain objects:
const dict: Record<string, unknown> = {};
const userInput = '__proto__';
dict[userInput] = { polluted: true }; // ← corrupts Object.prototype in old JS engines
```

##### When

Use **`Map`** when: keys are dynamic or user-controlled, keys are non-strings (object references), you need frequent add/delete, or you need `.size` without `Object.keys().length`. Use **plain objects/`Record`** when: the shape is statically known (TypeScript interface), you need JSON serialization, or you're working with Angular component `@Input()` configs.

##### Trade-offs

<span style="color: #ff4444; font-weight: bold;">`Map` is not JSON-serializable</span> — `JSON.stringify(map)` produces `{}`. Plain objects work seamlessly with spread (`{ ...obj }`), destructuring, and Angular template binding. `Map` wins on correctness and safety for dynamic key scenarios.

---

### 1.3 `Set`

##### What

<span style="color: #33b5e5; font-weight: bold;">`Set<T>` is a collection of unique values</span> with O(1) average-case `add`, `has`, and `delete` operations backed by a hash table. Values are deduplicated by the SameValueZero algorithm (same as `===` except `NaN === NaN`).

##### Why

<span style="color: #ff4444; font-weight: bold;">`Array.prototype.includes()` is O(N)</span> — it walks every element. For a TransferList UI with 10,000 items, checking "is this item selected?" on every render cycle is catastrophic. `Set.has()` is O(1) regardless of size, making it the correct tool for membership checks and deduplication.

##### How

```typescript
// Basic Set usage
const selectedIds = new Set<string>();
selectedIds.add('item-1');
selectedIds.add('item-2');
selectedIds.add('item-1'); // ← silently ignored, already present

console.log(selectedIds.has('item-1')); // true  — O(1)
console.log(selectedIds.size);          // 2

selectedIds.delete('item-2');

// Convert to/from array
const asArray: string[] = [...selectedIds];        // spread
const fromArray = new Set(['a', 'b', 'a', 'c']);  // dedup on construction → size 3

// Set operations (JS has no built-in, but easy with spread)
const setA = new Set([1, 2, 3]);
const setB = new Set([2, 3, 4]);
const union        = new Set([...setA, ...setB]);         // {1,2,3,4}
const intersection = new Set([...setA].filter(x => setB.has(x))); // {2,3}
const difference   = new Set([...setA].filter(x => !setB.has(x))); // {1}

// tai-portal TransferList pattern: tracking selected items
class TransferListStore {
  private readonly _selected = signal(new Set<string>());

  toggle(id: string): void {
    this._selected.update(prev => {
      const next = new Set(prev);      // immutable update
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this._selected().has(id);   // O(1)
  }
}
```

##### When

Use `Set` for: uniqueness constraints, fast membership testing, deduplication of arrays, and tracking "seen" items (like `seenEventIds` in `NotificationSignalStore`). Do NOT use for key-value pairs (use `Map`) or index-based access.

##### Trade-offs

<span style="color: #ff4444; font-weight: bold;">No index access</span> — you cannot do `set[0]`. Iteration is guaranteed insertion order. Equality is reference-based for objects — two different objects with the same shape are NOT equal (`new Set([{a:1}, {a:1}]).size === 2`). For deep-equality deduplication you need a custom serialization key (e.g. `JSON.stringify(obj)`).

**Backend Analogue:** `Set<T>` ≈ `HashSet<T>` in C#. Same O(1) `Contains()`, same no-duplicates guarantee.

---

### 1.4 `WeakMap`, `WeakRef` & `WeakSet`

##### What

<span style="color: #33b5e5; font-weight: bold;">`WeakMap<K extends object, V>` holds weak references to its keys</span> — if the key object has no other references, the garbage collector can reclaim it and the entry is silently removed. `WeakSet` does the same for values. `WeakRef<T>` wraps a single object weakly. `FinalizationRegistry` lets you register a cleanup callback for when an object is GC'd.

##### Why

<span style="color: #ff4444; font-weight: bold;">Regular `Map` and `Set` hold strong references</span> — they prevent GC of their keys/values indefinitely. In long-lived SPAs, this causes memory leaks: a service that caches per-DOM-element metadata using a regular `Map` will accumulate entries forever as the DOM updates. `WeakMap` automatically cleans up when the DOM element is removed.

##### How

```typescript
// WeakMap: per-DOM-element metadata without leaking
const componentMetadata = new WeakMap<HTMLElement, { zone: string; timestamp: number }>();

function attachMetadata(el: HTMLElement): void {
  componentMetadata.set(el, { zone: 'notification-panel', timestamp: Date.now() });
}

function getMetadata(el: HTMLElement) {
  return componentMetadata.get(el); // undefined if GC'd
}
// When el is removed from DOM and has no other refs → entry is GC'd automatically

// WeakRef: hold an object without preventing GC
class ImageCache {
  private cache = new Map<string, WeakRef<HTMLImageElement>>();

  get(url: string): HTMLImageElement | undefined {
    const ref = this.cache.get(url);
    if (!ref) return undefined;
    const img = ref.deref(); // returns undefined if GC'd
    if (!img) {
      this.cache.delete(url); // clean up stale entry
    }
    return img;
  }

  set(url: string, img: HTMLImageElement): void {
    this.cache.set(url, new WeakRef(img));
  }
}

// FinalizationRegistry: run cleanup when object is GC'd
const registry = new FinalizationRegistry<string>((heldValue) => {
  console.log(`Object with token "${heldValue}" was garbage collected`);
});

const target = { data: 'important' };
registry.register(target, 'my-token'); // non-deterministic — fires after GC
```

##### When

Use `WeakMap` for: per-object metadata (Angular's internal component tracking uses this pattern), caches keyed by discardable DOM elements or component instances, and framework-level bookkeeping. Use `WeakRef` + `FinalizationRegistry` for optional caches where staleness is acceptable. **Never use these for primary application state** — non-deterministic GC timing makes them unsuitable.

##### Trade-offs

<span style="color: #ff4444; font-weight: bold;">Not iterable, no `.size`, no `.clear()`</span> — you cannot enumerate `WeakMap` entries. Keys must be objects (not primitives). `FinalizationRegistry` callbacks are non-deterministic and may never fire in low-memory situations. `WeakRef.deref()` can return `undefined` at any point — always null-check.

**Backend Analogue:** `WeakMap<K, V>` ≈ `ConditionalWeakTable<TKey, TValue>` in C# — same weak-key semantics used by the CLR for attaching metadata to objects without preventing GC.

---

### 1.5 `structuredClone()` vs `JSON.parse(JSON.stringify())`

##### What

<span style="color: #33b5e5; font-weight: bold;">`structuredClone(value)`</span> (available in all modern browsers since 2022, Node 17+) performs a deep copy using the HTML Structured Clone Algorithm — the same algorithm used by `postMessage`, `IndexedDB`, and `History.pushState`. The legacy approach — `JSON.parse(JSON.stringify(value))` — is a workaround that serializes to JSON text and re-parses it.

##### Why

<span style="color: #ff4444; font-weight: bold;">The JSON round-trip silently corrupts data:</span>
- `Date` → becomes a string (loses `Date` prototype)
- `undefined` → entry is dropped entirely
- `Map` and `Set` → become `{}`
- `RegExp` → becomes `{}`
- Circular references → throws `TypeError`
- `NaN`, `Infinity` → become `null`

These are silent failures — no exceptions, just wrong data. In an Angular form where a `Date` field gets cloned for undo/redo history, the JSON round-trip silently turns it into a string, breaking form validation.

##### How

```typescript
interface FormState {
  name: string;
  createdAt: Date;
  tags: Set<string>;
  metadata: Map<string, number>;
  data?: string;
}

const original: FormState = {
  name: 'Alice',
  createdAt: new Date('2026-01-01'),
  tags: new Set(['admin', 'user']),
  metadata: new Map([['score', 42]]),
  data: undefined,
};

// JSON round-trip — silently wrong
const jsonCopy = JSON.parse(JSON.stringify(original));
console.log(jsonCopy.createdAt instanceof Date); // false — it's a string
console.log(jsonCopy.tags);                      // {} — Set lost
console.log(jsonCopy.metadata);                  // {} — Map lost
console.log('data' in jsonCopy);                 // false — undefined dropped

// structuredClone — correct deep copy
const clone = structuredClone(original);
console.log(clone.createdAt instanceof Date);    // true ✓
console.log(clone.tags instanceof Set);          // true ✓
console.log(clone.metadata instanceof Map);      // true ✓

// What structuredClone CANNOT clone (throws DataCloneError):
// - Functions
// - DOM nodes (HTMLElement, etc.)
// - Class instances with methods (copies data only, loses prototype)
// - Symbols

// For undo/redo history in Angular:
class UndoRedoStore<T> {
  private history: T[] = [];

  snapshot(state: T): void {
    this.history.push(structuredClone(state)); // safe deep copy
  }

  restore(): T | undefined {
    return this.history.pop();
  }
}
```

##### When

<span style="color: #00C851; font-weight: bold;">Always prefer `structuredClone()` in 2026</span> for deep copying plain data objects. Use `JSON.stringify/parse` only when you explicitly need JSON serialization for network transport or `localStorage`. Use a library like `immer` or manual spread for class instances with methods.

##### Trade-offs

`structuredClone` cannot clone functions, DOM nodes, or class instance methods — it only copies the data properties. For class instances, the clone loses its prototype chain. For those cases, a manual copy constructor or `Object.assign(new MyClass(), source)` is needed.

---

**Backend Analogues (Group 1):** JavaScript's `Map<K,V>` maps directly to C#'s `Dictionary<TKey, TValue>` — both are hash tables with O(1) average-case operations. `Set<T>` ≈ `HashSet<T>` with the same `Contains()` O(1) guarantee. `WeakMap<K,V>` ≈ `ConditionalWeakTable<TKey, TValue>` from the BCL — same weak-key GC semantics. `structuredClone()` ≈ deep copy via `System.Text.Json` serialization/deserialization, with the same caveat that types must be serializable (no delegates, no stream handles).

---

## Concept Group 2: Reactive Data Structures

### 2.1 `Observable<T>` as Push-Based IEnumerable

##### What

<span style="color: #33b5e5; font-weight: bold;">`Observable<T>` is the mathematical dual of `IEnumerable<T>`.</span> `IEnumerable<T>` is synchronous and pull-based: the consumer calls `MoveNext()` when ready. `Observable<T>` is asynchronous and push-based: the producer calls `observer.next(value)` when data is available. The subscriber registers interest and waits. This duality is formalized as the **Observable Pattern** (Gang of Four) extended to async sequences.

##### Why

Frontend UIs are fundamentally event-driven. A button click, an HTTP response, a WebSocket message — these all arrive asynchronously, at times the consumer cannot predict. `Observable<T>` gives a single, composable abstraction over all of them, with a rich operator library (`map`, `filter`, `switchMap`, `debounceTime`) for transforming and combining streams.

##### How

```typescript
import { Observable, of, fromEvent, interval } from 'rxjs';
import { map, filter, switchMap, debounceTime } from 'rxjs/operators';

// Duality: pull-based (C#-style) vs push-based
// Pull: for (const item of [1, 2, 3]) { process(item); }
// Push:
of(1, 2, 3).subscribe(item => process(item));

// HTTP: one async value (HttpClient returns Observable)
// this.http.get<User[]>('/api/users').subscribe(users => this.users = users);

// WebSocket: continuous async stream
function connectWebSocket(url: string): Observable<MessageEvent> {
  return new Observable(observer => {
    const ws = new WebSocket(url);
    ws.onmessage = event => observer.next(event);
    ws.onerror  = err  => observer.error(err);
    ws.onclose  = ()   => observer.complete();
    // Teardown on unsubscribe — critical for avoiding zombie connections
    return () => ws.close();
  });
}

// Composition with operators
const searchResults$ = fromEvent<InputEvent>(searchInput, 'input').pipe(
  map(e => (e.target as HTMLInputElement).value),
  filter(term => term.length >= 3),
  debounceTime(300),                 // wait 300ms after typing stops
  switchMap(term => this.http.get<Result[]>(`/api/search?q=${term}`))
  // switchMap cancels the previous HTTP request when a new term arrives
);
```

##### When

Use `Observable` for: HTTP requests, WebSocket event streams, user interaction streams needing operators (`debounceTime`, `throttleTime`), and cross-component event buses. <span style="color: #ffbb33; font-weight: bold;">For synchronous UI state, prefer `signal()`</span> — Signals are simpler, glitch-free, and require no subscription management. See the RxJS-Signals reference for the `toSignal()`/`toObservable()` bridge.

##### Trade-offs

<span style="color: #ff4444; font-weight: bold;">Subscription leaks</span> are the most common Angular memory leak. Every `.subscribe()` must be cleaned up via `takeUntilDestroyed()`, `async` pipe, or manual `.unsubscribe()`. The **diamond problem** (glitchy intermediate states when two Observables derived from the same source emit at different times) can cause UI flicker. Zone.js change detection fires broadly on each emission.

---

### 2.2 `BehaviorSubject` as Stateful Cache

##### What

<span style="color: #33b5e5; font-weight: bold;">`BehaviorSubject<T>` is an `Observable` that holds exactly one current value</span> (a 1-item cache) and emits it immediately to any new subscriber. It extends `Subject<T>` (which itself is both an `Observable` and an `Observer`), adding state. Think of it as a reactive variable: it has a value at all times, and any subscriber gets the current value plus all future values.

##### Why

Before Angular Signals, `BehaviorSubject` was the standard pattern for sharing state between services. Late subscribers (a component that loads after initial data fetch) still receive the current value immediately, avoiding blank/loading states. It solves the "late subscriber" problem that `Subject` and `ReplaySubject(1)` address differently.

##### How

```typescript
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Private mutable subject — only this service can push values
  private readonly _state$ = new BehaviorSubject<AuthState>({
    user: null,
    isLoading: false,
  });

  // Public read-only observable — consumers cannot call .next()
  readonly state$: Observable<AuthState> = this._state$.asObservable();

  // Derived observables (computed projections)
  readonly user$    = this.state$.pipe(map(s => s.user), distinctUntilChanged());
  readonly isLoggedIn$ = this.state$.pipe(map(s => s.user !== null), distinctUntilChanged());

  login(credentials: Credentials): void {
    this._state$.next({ user: null, isLoading: true });
    this.http.post<User>('/api/auth/login', credentials).subscribe({
      next:  user  => this._state$.next({ user, isLoading: false }),
      error: _err  => this._state$.next({ user: null, isLoading: false }),
    });
  }

  // Escape hatch — synchronous current value (bypasses reactive graph)
  getCurrentUser(): User | null {
    return this._state$.value.user; // ← use sparingly
  }
}
```

##### When

Use `BehaviorSubject` in <span style="color: #ffbb33; font-weight: bold;">legacy Angular code or when bridging to RxJS operators</span>. In new Angular 17+ code, replace with `signal()` + `computed()` — they are simpler, have no subscription lifecycle, and Angular's change detection natively understands them. When you must use Observables (e.g. `switchMap` chains), keep `BehaviorSubject` as the source and derive Observables from it.

##### Trade-offs

<span style="color: #ff4444; font-weight: bold;">Manual subscription cleanup is required</span> for every derived observable. `.value` bypasses the reactive graph (synchronous read that does not register a dependency). Multiple `BehaviorSubject`s updated in sequence can cause intermediate state emissions (glitchy updates) that Signals prevent via batching. Being replaced by `signal()` in Angular's recommended style guide.

---

### 2.3 Angular Signals as Synchronous Reactive Primitives

##### What

<span style="color: #33b5e5; font-weight: bold;">`signal<T>(initialValue)` creates a reactive container</span> that holds a value and tracks which reactive contexts have read it. When the signal's value changes, Angular's reactive graph knows exactly which `computed()` values and template bindings to re-evaluate — no component tree traversal required. Signals are **synchronous** and **pull-based**: the consumer reads the value by calling the signal as a function.

##### Why

Zone.js change detection works by patching all async browser APIs (`setTimeout`, `fetch`, `addEventListener`) and triggering a full component-tree traversal on any async event. This is powerful but blunt — every component's `ngDoCheck` runs even if nothing related to it changed. <span style="color: #00C851; font-weight: bold;">Signals enable targeted, glitch-free updates</span>: only the `computed()` values and template bindings that depend on the changed signal re-evaluate, and Angular's scheduler ensures all dependents see a consistent state (no intermediate glitchy values).

##### How

From the real tai-portal `NotificationSignalStore`:

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { AuditLogDetails } from '@tai/shared';

@Injectable({ providedIn: 'root' })
export class NotificationSignalStore {
  // Private writable signal — only this class can mutate
  private readonly _eventBuffer = signal<AuditLogDetails[]>([]);

  // Deduplication — regular Set (not a signal, pure implementation detail)
  private readonly seenEventIds = new Set<string>();

  // Public read-only surface — consumers cannot call .set() or .update()
  readonly eventBuffer = this._eventBuffer.asReadonly();

  // Derived signal: re-computes only when _eventBuffer changes
  readonly latestEvent = computed(() => {
    const buffer = this._eventBuffer(); // ← reading signal registers dependency
    return buffer.length > 0 ? buffer[buffer.length - 1] : null;
  });

  addEvent(event: AuditLogDetails): void {
    if (this.seenEventIds.has(event.id)) return; // O(1) dedup via Set
    this.seenEventIds.add(event.id);
    // Immutable update — new array reference triggers change detection
    this._eventBuffer.update(buf => [...buf, event]);
  }
}

// Usage in component (no subscription management needed)
@Component({
  template: `
    <div>Total events: {{ store.eventBuffer().length }}</div>
    @if (store.latestEvent(); as event) {
      <div>Latest: {{ event.action }}</div>
    }
  `
})
export class NotificationPanelComponent {
  readonly store = inject(NotificationSignalStore);
  // Angular automatically re-renders only this template when signals change
  // No takeUntilDestroyed, no async pipe, no OnPush boilerplate
}
```

##### When

<span style="color: #00C851; font-weight: bold;">Use `signal()` for all synchronous component and service state in Angular 17+.</span> This is Angular's recommended default in 2026. Use `toSignal()` to bridge an Observable into a Signal at the component boundary. Do NOT use Signals for async event streams that need RxJS operators — bridge with `toObservable()` in that direction.

##### Trade-offs

<span style="color: #ff4444; font-weight: bold;">Signals are synchronous only</span> — no built-in async handling. No operator library (no `debounceTime`, `switchMap`). For complex async orchestration, you still need RxJS piped through `toSignal()`. Signals are not serializable to JSON natively — extract the value first: `JSON.stringify(mySignal())`.

**Backend Analogue:** `signal()` ≈ `INotifyPropertyChanged` in C# — both notify dependents when a value changes. `computed()` with automatic dependency tracking ≈ a property getter backed by cached computation that invalidates when its sources change, similar to how `INotifyPropertyChanged` implementations use `[CallerMemberName]` to propagate change notifications.

---

### 2.4 `computed()` as Memoized Derivation

##### What

<span style="color: #33b5e5; font-weight: bold;">`computed(() => expression)` creates a read-only, lazily-evaluated signal</span> whose value is derived from other signals. Angular's reactive graph tracks which signals are read during the computation function's execution. The result is cached: if none of the dependency signals have changed since the last read, the cached value is returned without re-executing the function.

##### Why

Without memoization, derived state is recalculated on every template check. A filtered + sorted list of 1,000 items recalculated 60 times per second wastes O(N log N) work per frame. <span style="color: #00C851; font-weight: bold;">`computed()` gives you memoized derivation for free</span>: the filter/sort only runs when `items` or `filter` actually change, not on every render cycle. This is the Signal equivalent of NgRx selectors or `useMemo` in React.

##### How

```typescript
import { signal, computed } from '@angular/core';

interface Item { id: string; name: string; priority: 'high' | 'low'; }

@Injectable({ providedIn: 'root' })
export class ItemStore {
  // Source signals
  readonly items    = signal<Item[]>([]);
  readonly filter   = signal('');
  readonly sortDesc = signal(false);

  // Derived signal — memoized, re-computes only when items, filter, or sortDesc changes
  readonly filteredItems = computed(() => {
    const term   = this.filter().toLowerCase();   // dependency: filter
    const desc   = this.sortDesc();               // dependency: sortDesc
    const source = this.items();                  // dependency: items

    const filtered = term
      ? source.filter(i => i.name.toLowerCase().includes(term))
      : source;

    return [...filtered].sort((a, b) =>
      desc
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name)
    );
  });

  // Further derivation — computed from another computed
  readonly highPriorityCount = computed(() =>
    this.filteredItems().filter(i => i.priority === 'high').length
  );

  // Template binding — Angular reads these signals and re-renders only on change
  // {{ store.filteredItems().length }} → no recalculation unless sources changed
}

// Anti-pattern: avoid heavy computation in getters (runs every change detection cycle)
// get filteredItemsBad() { return this.items().filter(...).sort(...); } // ← runs every CD check

// Correct: use computed() for the same result with memoization
```

##### When

<span style="color: #00C851; font-weight: bold;">Use `computed()` for every derived value that depends on one or more signals:</span> filtered lists, aggregations (count, sum), formatted display strings, UI state derivations (is the form valid? are all items selected?). Nest `computed()` calls freely — the reactive graph handles transitive dependencies efficiently and ensures glitch-free evaluation order.

##### Trade-offs

`computed()` is **lazy** — it only evaluates when read (not when dependencies change). This is efficient but means you cannot use it as an effect trigger. For side effects (logging, HTTP calls) when signals change, use `effect()` instead. Heavy synchronous computations (e.g. large sort) inside `computed()` still block the main thread — for that, move work to a Web Worker and bridge via Observable → `toSignal()`.

**Backend Analogue:** `computed()` ≈ a memoized LINQ query result — cached until its inputs change, then lazily re-evaluated. In C#, this is like a property backed by `Lazy<T>` that resets when its source data changes, or a ConcurrentDictionary-based cache keyed by input state. Angular's reactive graph makes the dependency tracking automatic, whereas in C# you would wire `INotifyPropertyChanged` events manually.

---

**Backend Analogues (Group 2):** `Observable<T>` ≈ `IAsyncEnumerable<T>` — both represent async sequences, though `IAsyncEnumerable` is pull-based (consumer awaits `MoveNextAsync()`) while `Observable` is push-based. `BehaviorSubject<T>` ≈ a `volatile` field combined with a pub/sub event (`event EventHandler<T> ValueChanged`) — same "current value + notification" pattern, done manually in C#. `signal<T>()` ≈ `INotifyPropertyChanged` with `PropertyChanged` events, but automatic dependency tracking replaces manual wiring. `computed()` ≈ a memoized LINQ projection with automatic cache invalidation, analogous to writing a property getter that re-runs only when its backing data changes.

---
