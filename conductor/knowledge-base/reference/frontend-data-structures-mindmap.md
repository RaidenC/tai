---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---
# 1. Frontend Data Structures & Patterns

## **1.1 JavaScript Built-in Structures**
1. Array Internals
   - Dense arrays use C++ backing stores — near-native iteration speed
   - Sparse arrays (gaps/delete) fall back to hash table — 10-100x slower
   - Typed Arrays (Uint8Array) for binary data, WebGL, audio
2. Map vs Plain Object
   - Map: any key type, .size, guaranteed order, no prototype pollution
   - Object: JSON-native, spread/destructure, TypeScript Record type
   - Backend analogue: Map ≈ Dictionary&lt;TKey, TValue&gt;
3. Set
   - O(1) has/add/delete — vs array.includes O(N)
   - tai-portal TransferList uses Set for assigned ID uniqueness
   - Backend analogue: Set ≈ HashSet&lt;T&gt;
4. WeakMap, WeakRef & WeakSet
   - Weak references: GC collects entries when key has no other refs
   - Not iterable, no .size — by design (GC non-deterministic)
   - Use for: DOM metadata, computed caches, framework internals
5. structuredClone vs JSON
   - JSON drops Date, undefined, Map, Set, RegExp, circular refs
   - structuredClone preserves all (2022+ browsers)
   - Cannot clone functions, DOM nodes, or class methods

## **1.2 Reactive Data Structures**
1. Observable as Push-Based IEnumerable
   - Mathematical dual: pull (IEnumerable) vs push (Observable)
   - Async event streams: HTTP, WebSocket, user events
   - Requires subscription management to prevent memory leaks
2. BehaviorSubject as Stateful Cache
   - Holds current value, emits to late subscribers immediately
   - .value for sync access — bypasses reactive graph
   - Being replaced by Signals in 2026 Angular
3. Angular Signals
   - Synchronous, pull-based reactive primitives
   - Targeted change detection — only dependent bindings re-render
   - Backend analogue: signal() ≈ INotifyPropertyChanged
4. computed() as Memoized Derivation
   - Re-computes only when dependencies change, caches result
   - Lazy evaluation — not computed until first read
   - Glitch-free: Angular batches updates before evaluating

## **1.3 State Management Structures**
1. NgRx Store
   - Single immutable state tree with pure reducer functions
   - Actions describe events, reducers produce new state
   - Backend analogue: Event Sourcing pattern
2. Selectors as Memoized Projections
   - Pure functions extracting store slices with memoization
   - Depth-1 cache: only caches last input/output pair
   - Compose selectors for multi-level derivations
3. ComponentStore
   - Lightweight, component-scoped state container
   - setState, patchState, select — no global actions
   - Being superseded by signal-based stores
4. Signal-Based Store Pattern
   - signal() + computed() in @Injectable service
   - tai-portal NotificationSignalStore: Set for O(1) dedup
   - No NgRx boilerplate, fully zone-free CD

## **1.4 Rendering & DOM Algorithms**
1. Incremental DOM vs Virtual DOM
   - Angular: instructions modify real DOM directly (lower memory)
   - React: diffs virtual tree then patches real DOM (concurrent mode)
2. @for track — Identity Diffing
   - Map&lt;trackValue, DOMNode&gt; matches items across re-renders
   - Without track: destroy all + recreate all on any change
   - Always use stable unique ID, never $index for reorderable lists
3. CDK VirtualScroll
   - Renders only viewport items + buffer — O(1) DOM nodes
   - Recycles nodes via translateY and content swap
   - Accessibility: screen readers can't see off-screen items
4. Change Detection as Tree Traversal
   - Zone-based: DFS walk checking all bindings on every event
   - Signal-based: only components reading changed signals checked
   - OnPush: skip subtree if inputs unchanged

## **1.5 Client-Side Persistence**
1. localStorage / sessionStorage
   - Synchronous key-value, 5-10MB limit, XSS-vulnerable
   - localStorage persists across sessions; sessionStorage per-tab
2. IndexedDB
   - Async transactional object store, hundreds of MB
   - Supports indexes, cursors, key ranges — like embedded NoSQL
   - Use idb wrapper library for sane async/await API
3. Cache API
   - Stores HTTP request/response pairs for Service Workers
   - Strategies: Cache-First, Network-First, Stale-While-Revalidate
   - Storage shared with IndexedDB under browser quota
