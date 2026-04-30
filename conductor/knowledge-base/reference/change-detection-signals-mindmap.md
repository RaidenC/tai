---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Change Detection & Signals**

## **1. Rendering Model**

### **1.1 Change Detection**
1. Synchronizes TypeScript state to DOM
   - Evaluates template bindings
   - Writes changed DOM values
   - Separates notification from checking
2. Senior mental model
   - What changed?
   - Who notified Angular?
   - Which subtree needs checking?
3. Anti-pattern
   - hidden mutation
   - forced `detectChanges`
   - tests that pass only by manual rendering

### **1.2 Zone.js and Zoneless**
1. Zone.js
   - patches timers, promises, events, XHR
   - schedules broad synchronization
   - convenient for legacy async code
2. Zoneless
   - removes global patching
   - needs explicit notifications
   - improves performance, Core Web Vitals, debugging
3. tai-portal status
   - currently requires Zone.js
   - early identity-ui flow hit login timing/race issue
   - Storybook is coupled to portal-web build but not proven original blocker

### **1.3 OnPush**
1. Skips subtrees unless notified
   - new inputs
   - template/host events
   - signal reads in template
   - AsyncPipe / markForCheck
2. Production default
   - design-system components
   - data tables
   - forms
   - dashboards
3. Gotchas
   - mutable inputs
   - mutated arrays/maps/sets
   - accidental reliance on default checking

### **1.4 Notification Sources**
1. Good notifications
   - signal set/update
   - input binding / setInput
   - template event
   - AsyncPipe
   - markForCheck
2. Risky sources
   - timer mutating plain field
   - WebSocket callback mutating field
   - third-party callback outside Angular
   - native DOM mutation
3. Debugging question
   - state changed where?
   - Angular was notified how?

## **2. Signal Reactivity**

### **2.1 Writable Signals**
1. Synchronous state container
   - read with `count()`
   - write with `.set()` / `.update()`
2. Store pattern
   - private writable signal
   - public `.asReadonly()`
   - narrow mutation methods
3. Caveat
   - readonly does not prevent deep mutation
   - use immutable conventions

### **2.2 Computed Signals**
1. Pure derived state
   - lazy
   - memoized
   - dynamically tracked
2. Best use
   - filtered rows
   - summaries
   - permission-aware menus
   - loading flags
3. Rule
   - no side effects
   - no API calls
   - no signal writes

### **2.3 Reactive Contexts**
1. Tracking happens synchronously
   - templates
   - computed
   - effects
   - linkedSignal
   - resource params/loaders
2. Async boundary gotcha
   - reads after `await` are not tracked
   - read signals before async boundary
3. `untracked`
   - incidental reads
   - analytics/logging
   - avoid accidental dependencies

### **2.4 Effects**
1. Imperative edge bridge
   - analytics
   - local storage
   - focus
   - charts/canvas
   - third-party APIs
2. Prefer alternatives first
   - computed for derived state
   - linkedSignal for writable dependent state
   - command methods for business actions
3. Risks
   - circular updates
   - hidden dependencies
   - ExpressionChanged errors

### **2.5 Signal Inputs and Outputs**
1. Modern component boundary
   - `input`
   - `output`
   - `model`
2. Fits OnPush
   - input state enters reactively
   - computed derives display state
   - output emits commands/events
3. Testing
   - use `fixture.componentRef.setInput`
   - prefer production-like notification paths

## **3. Advanced Signal APIs**

### **3.1 linkedSignal**
1. Writable state linked to source
   - selected tenant
   - selected role
   - active tab
2. Replaces many propagation effects
   - follows source collection
   - user can still override
3. Use only when writable
   - computed remains better for readonly derivation

### **3.2 Resource and httpResource**
1. Async state as signals
   - value
   - loading
   - error
   - status
   - reload
2. Current docs
   - resource is experimental
   - httpResource integrates with Angular HTTP
3. Enterprise stance
   - promising for leaf fetching
   - RxJS services still safer for complex orchestration

### **3.3 Equality and Mutation**
1. Default equality
   - `Object.is`
   - referential updates
2. Custom equality
   - only for proven hot paths
   - avoid casual deep equality
3. Better design
   - immutable updates
   - smaller state slices
   - computed selectors

## **4. RxJS Interop**

### **4.1 toSignal**
1. Observable to signal
   - route params
   - media queries
   - service state
2. Needs stable creation
   - once at boundary
   - provide initial value
   - avoid loops/method calls

### **4.2 toObservable**
1. Signal to Observable
   - debounce
   - switchMap
   - retry
   - combineLatest
2. Keeps RxJS where it belongs
   - async orchestration
   - cancellation
   - backpressure

### **4.3 Boundary Rule**
1. Signals
   - synchronous UI state
   - derived view state
   - template reads
2. RxJS
   - HTTP
   - auth streams
   - SignalR/WebSocket
   - typeahead/polling
3. Senior answer
   - hybrid architecture
   - clear ownership
   - bridge at boundaries

## **5. Testing and Migration**

### **5.1 Production-Like Tests**
1. Prefer real notification paths
   - setInput
   - user events
   - signal writes
   - whenStable
2. Avoid overusing detectChanges
   - hides missing scheduling
   - useful for setup, not proof

### **5.2 Zoneless Readiness**
1. Compatibility before provider switch
   - OnPush
   - signals
   - immutable updates
   - markForCheck at external callbacks
2. Audit surface
   - identity login flow
   - Storybook
   - tests
   - SignalR
   - auth libraries
   - third-party widgets
3. Migration order
   - make compatible
   - test zoneless in small scope
   - switch provider
   - remove Zone.js last

## **6. Interview Framing**

### **6.1 Best-Practice Summary**
1. OnPush by default
2. Signals for synchronous UI state
3. computed for derivation
4. effects only at imperative edges
5. RxJS for async streams
6. zoneless-compatible even when Zone.js remains enabled

### **6.2 Senior Trade-offs**
1. Zoneless improves precision but exposes hidden assumptions
2. Signals simplify state but do not replace RxJS
3. OnPush improves performance but requires immutable discipline
4. Resource APIs are promising but still experimental
5. Deep equality can hide state design problems
