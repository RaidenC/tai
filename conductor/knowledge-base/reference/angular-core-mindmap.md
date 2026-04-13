---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Angular Core**

## **1. Module-less Architecture**

### **1.1 Standalone Components**
1. Self-contained — import dependencies directly, no NgModule needed
   - Angular 21 default: `standalone: true` is implicit
   - Bootstrap via `bootstrapApplication()` + `ApplicationConfig`
2. Tree-shaking friendly — only imported code is bundled
   - `loadComponent` enables per-component lazy loading
3. Trade-off: repetitive imports across components
   - Solution: barrel exports or shared component arrays

### **1.2 Dependency Injection with `inject()`**
1. Replaces constructor injection — cleaner, works in functional contexts
   - Field-level: `private readonly service = inject(MyService)`
   - Enables composable utility functions (like React hooks)
2. `providedIn: 'root'` for singletons, component `providers` for scoped instances
   - `InjectionToken` for interface-based DI
3. Constraint: only callable in injection context (constructor/field/factory)
   - Runtime error if called inside a method body

## **2. Reactivity & Performance**

### **2.1 Signals**
1. `signal()` — writable reactive value, synchronous read
   - Private signals + `.asReadonly()` = encapsulated state
2. `computed()` — derived value, auto-tracks dependencies
   - Replaces NgRx selectors for simple derived state
3. `effect()` — side effects when tracked signals change
   - Replaces complex RxJS subscription chains
4. `toSignal()` / `toObservable()` — bridges RxJS and Signals
   - `toSignal()` requires `initialValue` (Signals always have a value)
5. Trade-off: no async operators (no debounce, switchMap)
   - RxJS still needed for HTTP, WebSocket, complex streams

### **2.2 Change Detection**
1. Default: checks entire component tree on every event
   - Expensive in large apps — every click triggers full traversal
2. OnPush: only checks when input references change or internal events fire
   - Recommended for all production components
3. Signals + OnPush = fine-grained reactivity
   - Angular tracks individual template bindings, not whole templates
4. Gotcha: object mutation won't trigger OnPush
   - `signal.set()` always creates new reference — mitigates this

### **2.3 NgZone & Optimization**
1. Zone.js monkey-patches all async APIs to trigger change detection
   - Every `setTimeout`, `Promise.then`, WebSocket callback triggers CD
2. `runOutsideAngular()` for high-frequency events (SignalR, animation)
   - Process data without triggering change detection
3. `NgZone.run()` to re-enter zone when UI data is ready
   - Reduces CD from N events/second to 1 per meaningful update
4. Forgetting to re-enter zone causes "stale template" bugs

## **3. Modern Syntax & Patterns**

### **3.1 Functional Guards & Interceptors**
1. Plain functions replace class-based `implements CanActivate`
   - ~70% less boilerplate than class-based approach
2. Use `inject()` inside function body to access services
   - Registered via route config or `withInterceptors([...])`
3. Composable: `canActivate: [authGuard, privilegeGuard]`
4. Trade-off: stateless — inject a service if you need state

### **3.2 New Control Flow**
1. `@if / @else` — native syntax, no `ng-template` needed
   - Replaces `*ngIf` with cleaner, more readable syntax
2. `@for (item of items; track item.id)` — mandatory track expression
   - `@empty` block for empty collections built-in
3. `@switch / @case` — replaces `*ngSwitch` directive
4. Migration schematic: `ng generate @angular/core:control-flow`

## **4. tai-portal Architecture**

### **4.1 Signal Store Pattern**
1. Three layers: private signals, readonly projections, computed derivations
   - ~165 lines vs ~500+ for NgRx boilerplate
2. RxJS for HTTP calls, Signals for state management
   - Best of both worlds: async streams + synchronous reactivity
3. Trade-off vs NgRx: no time-travel debugging or action replay
   - Right choice for medium-complexity apps (< 10 features)

### **4.2 Bootstrap Flow**
1. `main.ts` → `bootstrapApplication(App, appConfig)`
2. `appConfig` provides: Router, HttpClient, Auth, NgZone
3. Routes use `loadComponent` for per-page code splitting
4. Interceptor chain: `authInterceptor` → `dpopInterceptor` → API Gateway
