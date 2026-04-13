---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **RxJS & Signals**

## **1. Observable Fundamentals**
### **1.1 Observables**
1. Lazy, push-based async stream
   - Nothing executes until `.subscribe()`
   - Can emit 0..N values, then complete or error
2. Cold vs Hot
   - Cold: re-executes producer per subscriber (HttpClient)
   - Hot: shared execution, multicast (Subject, shareReplay)
3. Angular APIs return Observables
   - HttpClient, Router, FormControl.valueChanges

### **1.2 Operators**
1. Pure functions composed via `.pipe()`
   - Transform: `map`, `switchMap`, `concatMap`
   - Filter: `debounceTime`, `distinctUntilChanged`, `take`
   - Combine: `combineLatest`, `forkJoin`, `merge`
2. ~15 operators cover 95% of real-world Angular code
   - Over-engineering with exotic operators hurts readability
3. Rule: logic in `.pipe()`, side effects in `.subscribe()`

### **1.3 Higher-Order Mapping**
1. `switchMap` — latest only, cancels previous
   - Search typeahead, route params
   - Danger: cancels writes silently
2. `concatMap` — sequential queue
   - Ordered form saves, mutations
3. `exhaustMap` — ignores new while busy
   - Login button, payment submission
4. `mergeMap` — unlimited parallel
   - Parallel file uploads
   - Danger: race conditions

### **1.4 Subjects**
1. `Subject` — fire-and-forget event bus
   - Destroy notifier, search bridge
2. `BehaviorSubject` — always has current value
   - Connection state, auth state
   - Expose via `.asObservable()` to hide `.next()`
3. `ReplaySubject(n)` — replays last n values
   - Late subscribers need history

## **2. Angular Signals & State**
### **2.1 Signals**
1. Synchronous reactive primitive (Angular 16+)
   - `signal()`, `computed()`, `effect()`
   - Always has a current value, no subscription needed
2. Fine-grained change detection
   - Angular tracks which binding depends on which signal
   - Only re-renders changed bindings, not entire component
3. Cannot handle async: no debounce, throttle, cancel
   - Complementary to RxJS, not a replacement

### **2.2 Signal Store Pattern**
1. Private `signal()` → `.asReadonly()` → `computed()`
   - Unidirectional data flow without NgRx ceremony
   - tai-portal: UsersStore, PrivilegesStore, OnboardingStore
2. Action methods: set Loading → HTTP → set Success/Error
   - Subscribe callbacks update signals imperatively
3. When to escalate to NgRx
   - 10+ devs, time-travel debug, action replay needed

### **2.3 Bridge: toSignal() / toObservable()**
1. `toSignal(obs$, { initialValue })` — Observable → Signal
   - Auto-unsubscribes on injection context destroy
   - Must be called in injection context (not ngOnInit)
2. `toObservable(signal)` — Signal → Observable
   - Feed signal into RxJS pipeline for debounce/throttle
3. tai-portal: transfer-list.ts debounced search
   - RxJS for time-based ops → toSignal → computed for template

## **3. Subscription Management**
### **3.1 Cleanup Strategies**
1. `toSignal()` — automatic, injection context scoped
   - Preferred for template-consumed values
2. `takeUntilDestroyed(destroyRef)` — automatic with DestroyRef
   - Preferred for imperative subscriptions (Angular 19+)
3. `async` pipe — automatic, template-level
   - Good fallback, triggers component-level CD
4. `takeUntil(destroy$)` — manual Subject-based
   - Legacy pattern, still reliable
5. Raw `.subscribe()` — no cleanup
   - Avoid in components, OK in root singletons
