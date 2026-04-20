---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **NgRx State Management**

## **1. Core Patterns**

### **1.1 Actions**
1. Event catalog — the ONLY way to change state
   - `createActionGroup()` bundles related actions under a source prefix
   - `props<{}>()` for typed payloads, `emptyProps()` for no payload
   - Actions create an audit trail visible in Redux DevTools
2. Naming convention
   - Past-tense events: `'Save Borrower Info'`, not `'SET_BORROWER'`
   - Source prefix: `[Claim]`, `[Unemployment]`
3. Anti-patterns
   - Dispatching on every keystroke (noisy action log)
   - Generic actions like `'Update State'` (no audit value)

### **1.2 Reducers**
1. Pure function: state + action → new state
   - `createFeature()` (v15+) auto-generates selectors
   - `createReducer()` + `on()` for action-specific handlers
   - Spread operator (`...state`) ensures immutable updates
2. Business rules enforced HERE
   - MAX_PROVIDERS cap = no-op in reducer, not UI check
   - Cleanup on toggle-off (null workersCompClaimNumber)
3. Anti-patterns
   - Mutating state directly (`state.borrower = x`)
   - Storing derived values in state (use selectors)

### **1.3 Selectors**
1. Memoized derived state via `createSelector()`
   - Projector only runs when inputs return new references
   - `createFeature()` auto-generates one selector per state property
2. Composition is the power move
   - `selectBorrowerValid` + `selectIncidentValid` + ... → `selectCanSubmit`
   - Same selectors used by guard, stepper, submit button
3. Anti-patterns
   - Computing derived state in components (bypasses memoization)
   - Projectors that always create new references (breaks downstream cache)

### **1.4 Effects**
1. Side-effect isolation — ONLY place for async/impure ops
   - `createEffect()` with functional style (v15+)
   - `ofType()` filters for specific actions
   - `catchError` maps to error actions — NEVER re-throw
2. Key RxJS operators
   - `switchMap` — cancel previous (toggles, search)
   - `exhaustMap` — ignore new while busy (submit buttons)
   - `concatMap` — queue sequentially (ordered operations)
   - `withLatestFrom` — read store state without subscribing
3. REPLAY_MODE suppression
   - `filter(() => !replayMode.active)` — 1 line per effect

### **1.5 Store Bootstrap**
1. Registration functions
   - `provideStore()` — once at root, with meta-reducers
   - `provideState()` — lazy-loaded feature slices
   - `provideEffects()` — register effect handlers
   - `provideStoreDevtools()` — dev-only, `maxAge: 50`
2. Eager vs lazy loading
   - Borrower-portal: eager (meta-reducer needs INIT hydration)
   - Future claim types: lazy via `provideState()` in route

## **2. Advanced Patterns**

### **2.1 Meta-Reducers**
1. Middleware for the store
   - Wraps the root reducer: intercepts every action + every state change
   - ~30 lines replaces manual localStorage in 4+ components
2. localStorage hydration
   - `INIT`/`UPDATE` → read + merge stored state
   - Every action after → serialize + save
   - Schema check: `typeof parsed.currentStep !== 'number'` → discard
3. Other uses
   - State freeze in dev (catch mutations)
   - Action logging
   - Undo/redo

### **2.2 Guard Integration**
1. Route guards query NgRx store
   - `combineLatest` of validity selectors + `take(1)`
   - Single source of truth — works for UI clicks AND deep links
2. CDK Stepper bypass
   - Stepper's linear mode is component-local, not router-aware
   - Guard enforces at router level

### **2.3 Form-Store Sync**
1. Strategy: dispatch on exit, rehydrate on entry
   - Blur dispatch for critical fields (SSN, email)
   - `patchValue({ emitEvent: false })` prevents infinite loops
2. Anti-pattern
   - Two-way binding between form and store = infinite loop

### **2.4 Replay Mode**
1. `REPLAY_MODE` injection token
   - Effects check flag before firing API calls
   - Enables demo replay without side-effects

## **3. NgRx vs Alternatives**

### **3.1 NgRx Store vs BehaviorSubject Service**
1. Service wins when
   - State local to 1-2 components
   - No persistence, no derived state, no audit trail
   - ~80 lines vs NgRx's ~200
2. NgRx wins when
   - State crosses 3+ routes
   - Needs middleware persistence
   - Needs action history / replay / DevTools

### **3.2 NgRx Store vs @ngrx/signals (SignalStore)**
1. SignalStore for 2026 new projects
   - ~60% less boilerplate, no RxJS required
   - Uses Angular Signals natively
2. NgRx Store when you need
   - Meta-reducers, DevTools, replay, cross-feature selectors
   - tai-portal: "both — different tools for different jobs"

### **3.3 NgRx Store vs @ngrx/component-store**
1. Being superseded by SignalStore (2025+)
   - Don't start new work on ComponentStore
   - Migration path: ComponentStore → SignalStore

## **4. State Shape & Scalability**

### **4.1 State Shape Design**
1. Each wizard step = separate sub-object
   - Enables independent reducer updates + selector reads
   - UI state (isSubmitting, error) alongside domain data
2. Key decisions
   - `currentStep: number` not route string (decoupled)
   - Documents = metadata only (blobs in IndexedDB)
   - Plain array for max-5 providers (skip @ngrx/entity)

### **4.2 @ngrx/entity**
1. Normalized collections: `{ ids[], entities{} }`
   - O(1) lookups, built-in sort, adapter CRUD methods
2. When to use
   - 20+ items with frequent CRUD
   - NOT for max-5 arrays (premature optimization)

### **4.3 Multi-Claim Architecture**
1. Per-claim feature slices
   - `createFeature({ name: 'disabilityClaim' })` per type
   - Independent state — bug in one can't corrupt another
2. Shared infrastructure
   - `BaseClaimDraft` interface
   - `createClaimMetaReducer()` factory
   - `createClaimStepGuard()` factory
   - `selectBorrowerValid` shared (Step 1 always borrower)
3. Anti-pattern
   - Single monolithic ClaimDraft with optional fields = god-object
   - Abstracting factories before second claim type exists

## **5. Testing NgRx**

### **5.1 Reducers**
1. Pure function testing — no DI, no async
   - Input: state + action → Output: new state
   - Assert new reference (`not.toBe`)
   - Test business rules (MAX_PROVIDERS no-op)

### **5.2 Selectors**
1. Test via `.projector()` method
   - Pass mock inputs directly to projector function
   - No store setup needed

### **5.3 Effects**
1. `provideMockActions()` for mock action stream
   - Test happy path, error path, cancellation
   - Test replay suppression

### **5.4 Components**
1. `provideMockStore()` with selector overrides
   - Assert dispatch calls on user interaction
   - Override selectors for different UI states
