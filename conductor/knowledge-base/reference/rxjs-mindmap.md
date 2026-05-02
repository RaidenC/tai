---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **RxJS Deep Dive**

## **1. The Async Streaming Model**

### **1.1 Observables**
1. Lazy, push-based, multi-emit, cancellable
   - Nothing runs until `.subscribe()`
   - Can emit 0..N values, then `complete` OR `error` (terminal)
2. Promise = one async value; Observable = stream of values over time
3. Angular APIs return Observables
   - `HttpClient`, `Router`, `FormControl.valueChanges`, `BreakpointObserver`

### **1.2 Cold vs Hot**
1. **Cold** — producer per subscriber (HttpClient default)
   - 3 async pipes = 3 HTTP calls
2. **Hot** — shared producer (Subject, shareReplay)
   - Late subscriber misses past emissions (unless replay)
3. Convert cold→hot: `share`, `shareReplay(1)`
4. Convert hot→cold: `defer(() => hot$)`

### **1.3 Marble Diagrams**
1. `-` = frame; `a/b/c` = emission; `|` = complete; `X` = error
2. `()` = sync group; `^` = subscribe; `!` = unsubscribe
3. Use to settle "why is this emitting twice?" arguments

### **1.4 Observer Contract**
1. `next(value)` 0..N times
2. `error(err)` OR `complete()` — terminal, exactly one
3. After terminal: no further emissions, `finalize` runs

## **2. Creation Operators**

### **2.1 From Existing Values**
1. `of(...)` — sync emit then complete (catchError fallback)
2. `from(promise|array|iterable)` — Promise → Observable bridge

### **2.2 From Time**
1. `interval(ms)` — tick every ms (no initial)
2. `timer(initial, period?)` — first after initial, then optional period

### **2.3 From DOM / Events**
1. `fromEvent(target, name)` — DOM events as stream
   - Pause-on-blur polling: `fromEvent(document, 'visibilitychange')`

### **2.4 Special Constants**
1. `EMPTY` — completes immediately (no-op stream)
2. `NEVER` — never emits, never completes (pause switch in switchMap)
3. `throwError(() => err)` — error path
4. `defer(() => factory)` — recompute Observable per subscriber

## **3. Pipeable Operators**

### **3.1 Transformation**
1. `map(fn)` — reshape each value (workhorse)
2. `scan(reducer, seed)` — accumulate state, emit each step
   - Infinite scroll: append new pages, reset on filter change
3. `mapTo(value)` — replace every emission with a constant

### **3.2 Filtering & Rate-Limiting**
1. `filter`, `take`, `takeWhile`, `skip`, `distinctUntilChanged`
2. `debounceTime(ms)` — emit after silence (search-as-you-type)
3. `throttleTime(ms)` — first then ignore window (scroll handlers)
4. `auditTime(ms)` — skip first, emit last of window
5. `takeUntil(notifier$)` — unsubscribe trigger
   - **Always last in pipe** (avoid mid-pipe Subject leak)

### **3.3 Higher-Order Mapping (THE Topic)**
1. `switchMap` — latest only, **cancels previous**
   - Reads: search, route params, dropdown filter
   - DANGER: cancels writes mid-flight
2. `concatMap` — sequential **queue**, FIFO
   - Writes: ordered form saves, sequential mutations
3. `mergeMap(fn, concurrency?)` — parallel, race-prone
   - Independent uploads (always set concurrency cap)
4. `exhaustMap` — ignore new while busy
   - One-shots: login, submit, payment
5. **Marble (a, b, c source):**
   - switchMap kills inner-a when b arrives
   - concatMap waits for inner-a to finish, then runs inner-b
   - mergeMap runs all three in parallel
   - exhaustMap ignores b while inner-a runs

### **3.4 Combination**
1. `combineLatest([a$, b$])` — emits when ANY emits, latest of all
   - Needs `startWith(...)` on slow inputs or never emits
   - **Glitch**: two emissions if shared upstream
2. `forkJoin({a$, b$})` — `Promise.all` equivalent, all-or-nothing
   - Wrap inner with `catchError` for partial results
3. `merge(a$, b$)` — funnel multi-source triggers (load + manual + interval)
4. `withLatestFrom(other$)` — source-driven; attach latest of other
5. `concat(a$, b$)` — sequential drain (cache then live)
6. `race(a$, b$)` — first to emit wins (timeout vs response)

### **3.5 Error Handling & Retry**
1. `catchError(handler)` — must return Observable (fallback or rethrow)
   - **Place INSIDE switchMap**, not outside (dead effect bug)
2. `retry({ count, delay })` — exponential backoff with jitter
   - Don't retry 401/403; do retry 5xx with delay
3. `retryWhen` is DEPRECATED — use `retry({ delay })`
4. `throwError(() => err)` — produce an error Observable

### **3.6 Side Effects**
1. `tap` — observability (log, analytics)
   - Errors thrown in tap propagate
   - **Don't put state mutations in tap** — use subscribe
2. `finalize(fn)` — runs on complete OR error OR unsubscribe
   - Restore loading flags reliably

### **3.7 Multicasting**
1. `share()` — refcount multicast, no replay
2. `shareReplay(1)` — multicast + replay last value
   - Default: refCount=false (cache lives forever)
   - For component scope: `{ bufferSize: 1, refCount: true }`
3. `shareReplay` is THE way to make HTTP cold→hot for multiple consumers

### **3.8 Utility**
1. `delay`, `delayWhen` — shift emissions in time
2. `startWith(initial)` — prepend (combineLatest fix)
3. `timeout(ms)` — error if no emission within ms
4. `defaultIfEmpty(val)` — handle empty completion
5. `repeat({ delay })` — re-subscribe on complete

## **4. Subjects**

### **4.1 The Four Variants**
1. `Subject<T>` — no initial, no replay (event bus)
2. `BehaviorSubject<T>` — initial required, replays last
   - Sync `.value` accessor
   - Connection state, auth state
3. `ReplaySubject<T>(n, windowMs?)` — last n emissions to late subs
4. `AsyncSubject<T>` — final value on complete only (rare)

### **4.2 Patterns**
1. Private writable Subject, public `.asObservable()`
   - Hides `.next()` from consumers; enforces unidirectional flow
2. Subject as imperative on-ramp
   - DOM events, SignalR callbacks, search input bridge
3. `BehaviorSubject` vs `ReplaySubject(1)`
   - BehaviorSubject requires initial value; sync `.value`
   - ReplaySubject has no initial; nothing until first `.next()`

## **5. Subscription Management**

### **5.1 Cleanup Strategies (2026 priority order)**
1. `async` pipe — template-scoped, automatic
2. `toSignal()` — injection-context-scoped, automatic
3. `takeUntilDestroyed(destroyRef)` — universal, automatic
4. `takeUntil(destroy$)` — manual, legacy
5. Raw `.subscribe()` — only safe in `providedIn: 'root'` services

### **5.2 The Five Leak Patterns**
1. `interval` / `fromEvent` without unsubscribe
2. `subscribe-in-subscribe` (use `switchMap`)
3. `shareReplay(1)` keeps upstream alive forever
4. `takeUntil` placed mid-pipe (subject downstream survives)
5. Multiple `async` pipes on cold Observable (multicast missing)

## **6. Schedulers**

### **6.1 Built-in Schedulers**
1. `asyncScheduler` — setTimeout (default for `interval`, `debounceTime`)
2. `asapScheduler` — microtask (`Promise.resolve`)
3. `queueScheduler` — synchronous FIFO
4. `animationFrameScheduler` — `requestAnimationFrame` (smooth UI)

### **6.2 When You Need Them**
1. Heavy sync emissions choking call stack — `observeOn(asyncScheduler)`
2. Smooth scroll/drag tracking — `animationFrameScheduler`
3. Marble tests — `TestScheduler`
4. 99% of Angular code: defaults are correct

## **7. Testing RxJS**

### **7.1 Tools**
1. `firstValueFrom(obs$)` / `lastValueFrom(obs$)` — Promise bridge
   - `toPromise()` is DEPRECATED
2. `TestScheduler` + marble syntax — deterministic time
   - `cold`, `hot`, `expectObservable`, `flush`
3. Subject mocks — feed test events into a service stream

### **7.2 Common Test Pitfalls**
1. `fakeAsync` doesn't flush RxJS schedulers (use `TestScheduler` or pass scheduler)
2. `firstValueFrom` resolves on next microtask — `await` it
3. `HttpTestingController` queues responses — must call `.flush()`

## **8. RxJS in NgRx Effects**

### **8.1 Effect Pattern**
1. Listen to `actions$` filtered by `ofType`
2. Use higher-order operator (switchMap/concatMap/exhaustMap) per action semantics
3. Map success → success action; `catchError` inside → failure action

### **8.2 The Dead Effect Bug**
1. `catchError` outside `switchMap` kills the effect on first error
2. Always nest `catchError` inside the inner Observable
3. Common L3 interview screen

### **8.3 Operator Choice By Action**
1. `loadData` — switchMap (latest wins)
2. `saveItem` — concatMap (queue, preserve order)
3. `submitOnce` — exhaustMap (ignore double-submit)
4. `uploadParallel` — mergeMap with concurrency cap

## **9. Common Pitfalls**

### **9.1 The Top Five Production Bugs**
1. `mergeMap` for typeahead (race conditions, stale results)
2. `switchMap` for sequential writes (cancels mutations)
3. `catchError` outside switchMap (dead effect)
4. Missing `shareReplay(1)` (duplicate HTTP calls per async pipe)
5. `takeUntil` mid-pipe (subject downstream survives destroy)

### **9.2 Other Smells**
1. Subscribe-in-subscribe (use higher-order mapping)
2. Public `BehaviorSubject` (any consumer can `.next()`)
3. `retry({ count: 3 })` without delay (DDoS your own backend)
4. `tap` mutating state (readers expect inspection-only)
5. `combineLatest` without `startWith` on slow input (never emits)

## **10. tai-portal / borrower-portal Real Examples**

### **10.1 Portal-Web**
1. **DPoP interceptor** — `from` + `switchMap` + conditional `catchError` retry
2. **Auth state** — `shareReplay(1)` multicast for guards/menu/components
3. **Permission menu** — `combineLatest` + `async` pipe filter
4. **SignalR connection** — `BehaviorSubject` + NgZone.run on callbacks
5. **Search → URL sync** — `Subject` + `debounceTime` + `distinctUntilChanged`
6. **Datatable filter** — `combineLatest([search, sort, page])` + `switchMap`

### **10.2 Borrower-Portal**
1. **Wizard auto-save** — `valueChanges` + `debounceTime` + `concatMap` (order safe)
2. **Submit effect** — `exhaustMap` + inner `catchError` (rage-click safe)
3. **Load draft** — `switchMap` (latest wins)
4. **Document upload** — `mergeMap(fn, 3)` (parallel with concurrency cap)

## **11. Interview Readiness Map**

### **11.1 L1 Junior**
1. Observable vs Promise
2. What `.pipe()` and `.subscribe()` do
3. Why HTTP doesn't fire until subscribed

### **11.2 L2 Mid-Level**
1. switchMap vs concatMap vs mergeMap vs exhaustMap (with reasons)
2. shareReplay + the refCount gotcha
3. Cold vs hot — why HTTP fires N times
4. catchError placement (inner vs outer)
5. BehaviorSubject vs ReplaySubject(1)

### **11.3 L3 Senior**
1. Memory leak prevention strategy (5 cleanup options)
2. Refreshable cache with shareReplay + BehaviorSubject trigger
3. combineLatest glitch + mitigations
4. tap vs subscribe semantics
5. defer use cases

### **11.4 Staff**
1. Real-time dashboard architecture (WS + polling fallback + offline)
2. RxJS-vs-Signal layering decision
3. RxJS-only → Signals incremental migration
4. NgRx Effects design + dead-effect prevention
