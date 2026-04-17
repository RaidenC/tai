# Design: Secure Draft Persistence for Borrower Portal

## Problem

The current `localStorageMetaReducer` persists the entire claim draft (including PII/PHI) as plaintext JSON in localStorage. This violates:

- **GLBA** — SSN (even last-4) stored unencrypted on disk
- **HIPAA** — Medical provider names, treatment dates, disability descriptions in plaintext
- **CCPA** — Names, phone, email persisted without encryption or expiry
- **DevTools leak** — Redux DevTools exposes all PII/PHI in browser extension state views

localStorage persists across tabs, browser restarts, and survives until explicitly cleared. Any XSS vulnerability, browser extension, or shared computer scenario exposes everything.

## Architecture

### Data Flow

```
Component dispatches action
    ↓
Reducer produces new state (unchanged)
    ↓
autoSaveDraft effect (debounced 2s)
    ↓
sanitizeForPersistence() strips ssnLastFour → ''
    ↓
┌─── Try: PATCH /api/claims/draft (mock API) ───┐
│    Success → done                              │
│    Failure ↓                                   │
│    CryptoStorageService.encrypt()              │
│    AES-GCM via Web Crypto API                  │
│    Write to sessionStorage (tab-scoped)        │
└────────────────────────────────────────────────┘

On app init:
    loadDraft effect
    ↓
┌─── Try: GET /api/claims/draft (mock API) ──────┐
│    Success → dispatch draftLoaded               │
│    Failure ↓                                    │
│    CryptoStorageService.decrypt()               │
│    Read from sessionStorage                     │
│    Success → dispatch draftLoaded               │
│    Failure → fresh initialClaimState            │
└─────────────────────────────────────────────────┘

On draftLoaded:
    Reducer merges draft into state
    ssnLastFour is '' → guard redirects to Step 1
    UI shows "For your security, please re-enter your SSN"
```

### Why This Architecture

1. **Meta-reducer removed.** `crypto.subtle.encrypt()` returns a Promise. Meta-reducers are synchronous. You cannot await inside a meta-reducer. The async boundary is a hard constraint, not a design preference.

2. **Effects are the persistence orchestrator.** Effects are async-native (RxJS). The `autoSaveDraft` effect debounces state changes, strips PII, attempts the API, and falls back to encrypted sessionStorage. One effect, one place, same "single point of persistence" argument the meta-reducer had.

3. **sessionStorage over localStorage.** sessionStorage is tab-scoped and dies when the tab closes. localStorage persists indefinitely. For PII/PHI, the shortest-lived storage wins.

4. **Encryption key is in-memory only.** The AES-GCM key lives in a class property. Tab refresh = key gone = sessionStorage ciphertext is unrecoverable = data self-destructs. This is the desired behavior for a fallback cache, not a bug.

## Data Classification

| Field | Regulation | Persistence Rule |
|---|---|---|
| `ssnLastFour` | GLBA | **NEVER persisted.** Stripped to `''` by `sanitizeForPersistence()` before any write. User re-enters after hydration. |
| `doctorName`, `clinicName`, `dateFirstTreated` | HIPAA | Encrypted at rest (AES-GCM in sessionStorage) or server-side only. |
| `disabilityType`, `description`, `isWorkRelated` | HIPAA | Same as above. |
| `firstName`, `lastName`, `phone`, `email` | CCPA | Same as above. |
| `currentStep`, `claimId`, `isSubmitting`, `error` | None | UI metadata. Can be persisted in clear if needed, but encrypted with the rest for simplicity. |
| Document blobs | N/A | Already in IndexedDB, not in NgRx state. Out of scope. |

## Components

### 1. `sanitizeForPersistence()` — Pure Function

**Location:** `apps/borrower-portal/src/app/claim/+state/claim.sanitize.ts`

```typescript
import { DisabilityClaimDraft } from './claim.models';

/**
 * Strips PII that must NEVER be persisted client-side.
 * Called by the autoSaveDraft effect before any write.
 *
 * Returns a new object (immutable). The original state is untouched.
 */
export function sanitizeForPersistence(
  state: DisabilityClaimDraft
): DisabilityClaimDraft {
  return {
    ...state,
    borrower: {
      ...state.borrower,
      ssnLastFour: '', // GLBA: never persisted
    },
  };
}
```

Pure function. No DI. Trivially testable: input state with SSN, output state without. The effect calls this before handing data to either the API or encrypted storage.

### 2. `CryptoStorageService` — Encrypted sessionStorage

**Location:** `apps/borrower-portal/src/app/claim/services/crypto-storage.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class CryptoStorageService {
  private key: CryptoKey | null = null;
  private static readonly STORAGE_KEY = 'bp_draft_enc';
  private static readonly ALGORITHM = 'AES-GCM';

  /** Generate a new AES-256-GCM key. In-memory only, no export. */
  private async getOrCreateKey(): Promise<CryptoKey> {
    if (!this.key) {
      this.key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt']
      );
    }
    return this.key;
  }

  /** Encrypt state and write to sessionStorage. */
  async save(state: DisabilityClaimDraft): Promise<void> {
    const key = await this.getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(state));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );
    // Store IV + ciphertext as base64
    const payload = {
      iv: this.toBase64(iv),
      data: this.toBase64(new Uint8Array(ciphertext)),
    };
    sessionStorage.setItem(
      CryptoStorageService.STORAGE_KEY,
      JSON.stringify(payload)
    );
  }

  /** Read from sessionStorage and decrypt. Returns null if missing/corrupt/key lost. */
  async load(): Promise<DisabilityClaimDraft | null> {
    const raw = sessionStorage.getItem(CryptoStorageService.STORAGE_KEY);
    if (!raw) return null;

    try {
      const key = await this.getOrCreateKey();
      const { iv, data } = JSON.parse(raw);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: this.fromBase64(iv) },
        key,
        this.fromBase64(data)
      );
      const parsed = JSON.parse(new TextDecoder().decode(decrypted));
      // Schema check
      if (typeof parsed.currentStep !== 'number') return null;
      return parsed as DisabilityClaimDraft;
    } catch {
      // Key rotated (tab refresh), corrupt data, schema mismatch
      sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
      return null;
    }
  }

  /** Clear encrypted draft from sessionStorage. */
  clear(): void {
    sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
  }

  private toBase64(bytes: Uint8Array): string { /* ArrayBuffer → base64 */ }
  private fromBase64(str: string): Uint8Array { /* base64 → ArrayBuffer */ }
}
```

**Key security properties:**
- `extractable: false` — key cannot be exported via `crypto.subtle.exportKey()`
- Key lives in `this.key` (class instance) — tab refresh = new instance = old ciphertext is dead
- Fresh IV per write — required by AES-GCM (IV reuse = catastrophic)
- sessionStorage — tab-scoped, not shared across tabs, not persisted to disk by default

**Reference:** The team already uses `crypto.subtle` in `apps/portal-web/src/app/dpop.service.ts` for DPoP proofs (ECDSA P-256). This service follows the same patterns: lazy key generation, non-extractable keys, `getOrCreate` memoization.

### 3. `ClaimDraftService` — Mock API Client

**Location:** `apps/borrower-portal/src/app/claim/services/claim-draft.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class ClaimDraftService {
  private http = inject(HttpClient);

  saveDraft(draft: DisabilityClaimDraft): Observable<void> {
    return this.http.patch<void>('/api/claims/draft', draft);
  }

  loadDraft(): Observable<DisabilityClaimDraft> {
    return this.http.get<DisabilityClaimDraft>('/api/claims/draft');
  }
}
```

For the POC, an Angular interceptor returns mock responses. The interface is production-correct so swapping in a real backend is just removing the mock interceptor.

**Mock interceptor location:** `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.ts`

The mock interceptor stores the draft in an in-memory `Map<string, DisabilityClaimDraft>` keyed by a static user ID. This simulates server-side persistence within a single browser session. Returns:
- `PATCH /api/claims/draft` → `204 No Content` (saves to map)
- `GET /api/claims/draft` → `200` with draft body, or `404` if no draft exists

### 4. New Actions

**Added to:** `apps/borrower-portal/src/app/claim/+state/claim.actions.ts`

```typescript
// ── Draft Persistence ─────────────────────────
'Draft Saved': emptyProps(),
'Draft Save Error': props<{ message: string }>(),
'Draft Loaded': props<{ draft: DisabilityClaimDraft }>(),
'Draft Load Error': props<{ message: string }>(),
```

These are non-blocking. `draftSaveError` does not stop the user from continuing. The draft is in NgRx memory regardless. `draftLoaded` triggers the reducer to merge the hydrated draft into state.

### 5. Modified Effects

**Modified file:** `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`

#### `autoSaveDraft` — New Effect

```typescript
export const autoSaveDraft = createEffect(
  (
    actions$ = inject(Actions),
    store = inject(Store),
    draftService = inject(ClaimDraftService),
    cryptoStorage = inject(CryptoStorageService),
    replayMode = inject(REPLAY_MODE),
  ) => {
    return actions$.pipe(
      // Trigger on any action that changes claim data
      ofType(
        ClaimActions.saveBorrowerInfo,
        ClaimActions.saveIncidentDetails,
        ClaimActions.setWorkRelated,
        ClaimActions.addProvider,
        ClaimActions.updateProvider,
        ClaimActions.removeProvider,
        ClaimActions.saveDocumentMeta,
        ClaimActions.removeDocument,
        ClaimActions.setCurrentStep,
      ),

      filter(() => !replayMode.active),

      // Debounce: don't hit the API on every keystroke
      debounceTime(2000),

      withLatestFrom(store.select(selectClaimState)),

      exhaustMap(([, claimState]) => {
        const sanitized = sanitizeForPersistence(claimState);

        return draftService.saveDraft(sanitized).pipe(
          map(() => ClaimActions.draftSaved()),
          catchError(() => {
            // API failed — fall back to encrypted sessionStorage
            // This is fire-and-forget from the effect's perspective
            from(cryptoStorage.save(sanitized)).subscribe();
            return of(ClaimActions.draftSaveError({
              message: 'Draft saved locally (encrypted).',
            }));
          }),
        );
      }),
    );
  },
  { functional: true }
);
```

**Key design decisions:**
- `debounceTime(2000)` — waits 2s after the last data-changing action before saving. Prevents hammering the API on rapid typing. The user sees no delay because the NgRx store is always up to date.
- `exhaustMap` — ignores new save triggers while a save is in flight. Prevents concurrent writes and race conditions on the API.
- PII stripping happens BEFORE the `draftService.saveDraft()` call. Even the mock API never sees `ssnLastFour`.
- On API failure, the effect writes to encrypted sessionStorage as a fallback. The `from()` wrapping handles the async Promise from `CryptoStorageService`.

#### `loadDraft` — New Effect

```typescript
export const loadDraft = createEffect(
  (
    actions$ = inject(Actions),
    draftService = inject(ClaimDraftService),
    cryptoStorage = inject(CryptoStorageService),
    replayMode = inject(REPLAY_MODE),
  ) => {
    return actions$.pipe(
      // Trigger on app initialization
      ofType(ROOT_EFFECTS_INIT),

      filter(() => !replayMode.active),

      switchMap(() =>
        draftService.loadDraft().pipe(
          map((draft) => ClaimActions.draftLoaded({ draft })),
          catchError(() =>
            // API failed — try encrypted sessionStorage
            from(cryptoStorage.load()).pipe(
              map((draft) =>
                draft
                  ? ClaimActions.draftLoaded({ draft })
                  : ClaimActions.draftLoadError({ message: 'No saved draft found.' })
              ),
              catchError(() =>
                of(ClaimActions.draftLoadError({ message: 'Could not restore draft.' }))
              ),
            )
          ),
        )
      ),
    );
  },
  { functional: true }
);
```

Uses `ROOT_EFFECTS_INIT` to fire once on app bootstrap. Tries API first, falls back to encrypted sessionStorage, falls back to no-op (fresh state).

### 6. Reducer Changes

**Modified file:** `apps/borrower-portal/src/app/claim/+state/claim.reducer.ts`

Add one `on()` handler for `draftLoaded`:

```typescript
on(ClaimActions.draftLoaded, (state, { draft }) => ({
  ...state,
  ...draft,
  // SSN was stripped — ensure it's empty (defense in depth)
  borrower: {
    ...draft.borrower,
    ssnLastFour: '',
  },
  // Reset transient UI state
  isSubmitting: false,
  error: null,
})),
```

The `ssnLastFour: ''` assignment is defense-in-depth. `sanitizeForPersistence()` already stripped it, but the reducer enforces it again on the way in. Belt and suspenders.

### 7. DevTools Sanitizers

**Modified file:** `apps/borrower-portal/src/app/app.config.ts`

```typescript
provideStoreDevtools({
  maxAge: 50,
  logOnly: !isDevMode(),
  name: 'Borrower Portal — NgRx Store',
  stateSanitizer: (state: any) => ({
    ...state,
    claim: state.claim
      ? {
          ...state.claim,
          borrower: {
            ...state.claim.borrower,
            ssnLastFour: state.claim.borrower?.ssnLastFour ? '****' : '',
          },
        }
      : state.claim,
  }),
  actionSanitizer: (action: any) =>
    action.type === '[Claim] Save Borrower Info' && action.borrower
      ? {
          ...action,
          borrower: { ...action.borrower, ssnLastFour: '****' },
        }
      : action,
}),
```

Without this, anyone with Redux DevTools open sees the SSN in the state tree and in the `saveBorrowerInfo` action payload. The sanitizers replace it with `****` in the DevTools UI only. The actual store state is unaffected.

### 8. `app.config.ts` Changes

```typescript
// ADD:
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { mockApiInterceptor } from './claim/services/mock-api.interceptor';
import { autoSaveDraft, loadDraft } from './claim/+state';

// REMOVE from imports:
// import { localStorageMetaReducer } from './claim/+state';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing providers

    // HTTP client with mock API interceptor
    provideHttpClient(withInterceptors([mockApiInterceptor])),

    // Store: remove metaReducers entirely
    provideStore(
      { [claimFeature.name]: claimFeature.reducer },
      // NO metaReducers — persistence moved to effects
    ),

    // Effects: add autoSaveDraft and loadDraft
    provideEffects({
      fetchWorkersCompTemplate,
      submitClaim,
      autoSaveDraft,
      loadDraft,
    }),

    // DevTools with PII sanitizers (see section 7)
    provideStoreDevtools({ /* ... sanitizers ... */ }),
  ],
};
```

### 9. SSN Re-Entry UX

After hydration from API or encrypted sessionStorage, `ssnLastFour` is always `''`. The `selectBorrowerValid` selector checks `ssnLastFour.trim().length === 4`, so it returns `false`. The `claimStepGuard` redirects the user to Step 1.

**Change in `borrower-info.component.ts`:**

Add a boolean flag `ssnReEntryRequired` that is `true` when the rest of the borrower form is populated but SSN is empty (hydration scenario). Show a message:

```
For your security, your SSN was not saved. Please re-enter the last 4 digits to continue.
```

This is detected by checking: `firstName.length > 0 && ssnLastFour.length === 0` after rehydration.

### 10. Cleanup on Submit and Reset

When `ClaimActions.resetClaim` is dispatched (after successful submission or explicit "Start New Claim"), the `autoSaveDraft` effect should also clear persisted data:

```typescript
export const clearDraftOnReset = createEffect(
  (
    actions$ = inject(Actions),
    draftService = inject(ClaimDraftService),
    cryptoStorage = inject(CryptoStorageService),
  ) => {
    return actions$.pipe(
      ofType(ClaimActions.resetClaim),
      tap(() => cryptoStorage.clear()),
      switchMap(() =>
        draftService.saveDraft(initialClaimState).pipe(
          map(() => ClaimActions.draftSaved()),
          catchError(() => of(ClaimActions.draftSaveError({
            message: 'Could not clear server draft.',
          }))),
        )
      ),
    );
  },
  { functional: true }
);
```

## Files Changed

| File | Action | Description |
|---|---|---|
| `+state/claim.meta-reducer.ts` | **DELETE** | Replaced by effect-based persistence |
| `+state/claim.sanitize.ts` | **CREATE** | `sanitizeForPersistence()` pure function |
| `+state/claim.actions.ts` | **MODIFY** | Add 4 draft persistence actions |
| `+state/claim.effects.ts` | **MODIFY** | Add `autoSaveDraft`, `loadDraft`, `clearDraftOnReset` |
| `+state/claim.reducer.ts` | **MODIFY** | Add `on(draftLoaded)` handler |
| `+state/index.ts` | **MODIFY** | Update barrel exports |
| `services/crypto-storage.service.ts` | **CREATE** | AES-GCM encrypted sessionStorage |
| `services/claim-draft.service.ts` | **CREATE** | HTTP client for draft API |
| `services/mock-api.interceptor.ts` | **CREATE** | Mock PATCH/GET `/api/claims/draft` |
| `app.config.ts` | **MODIFY** | Remove meta-reducer, add HttpClient, register new effects, add DevTools sanitizers |
| `borrower-info.component.ts` | **MODIFY** | SSN re-entry UX message |
| `borrower-info.component.html` | **MODIFY** | SSN re-entry alert markup |

## Security Properties Summary

| Threat | Mitigation |
|---|---|
| SSN in localStorage | SSN **never** persisted. `sanitizeForPersistence()` strips it. Reducer defense-in-depth on load. |
| PII/PHI in localStorage | localStorage not used at all. sessionStorage (tab-scoped) with AES-GCM encryption. |
| Key theft | Key is `extractable: false`, lives in-memory only. Tab refresh = key destroyed = ciphertext dead. |
| XSS reads sessionStorage | Ciphertext only. Without the in-memory key, it's random bytes. |
| DevTools PII leak | `stateSanitizer` and `actionSanitizer` replace SSN with `****`. |
| Shared computer | sessionStorage clears on tab close. Encryption key lost on refresh. No persistent traces. |
| IV reuse (AES-GCM) | Fresh random IV on every `save()` call. |
| Stale draft after submission | `clearDraftOnReset` effect clears both server and sessionStorage on reset. |

## Option A: Real Backend (Nice-to-Have, Next Step)

When ready to add a real backend:

1. Create `ClaimsController.cs` with `PATCH /api/claims/draft` and `GET /api/claims/draft` endpoints
2. Server stores draft in database, encrypted at rest (SQL Server TDE or column-level encryption)
3. Copy OIDC + DPoP auth infrastructure from `portal-web` into `borrower-portal`:
   - `provideAuth()` with OIDC config
   - `authInterceptor()` for Bearer tokens
   - `dpopInterceptor` for proof-of-possession
4. Remove `mockApiInterceptor` from `app.config.ts`
5. The frontend code (effects, services, sanitizer) requires **zero changes**. The `ClaimDraftService` already uses `HttpClient` with the production-correct interface.

This is the entire point of the mock interceptor approach: production-correct frontend code from day one.

## Testing Strategy

### Methodology: Strict TDD (Red-Green-Refactor)

Every implementation file is written test-first. No production code exists without a failing test that demanded it.

**Workflow per component:**
1. **Red** — Write the test. Run it. Watch it fail (compile error or assertion failure).
2. **Green** — Write the minimum production code to make the test pass. Nothing more.
3. **Refactor** — Clean up duplication, improve naming, extract helpers. Tests stay green.

**Enforcement rules:**
- Test files are created BEFORE their corresponding implementation files.
- Each test file covers a single unit (one service, one pure function, one effect, one reducer handler).
- Tests must be runnable in isolation (`vitest run <file>`) and as a full suite.
- No `skip`, `xit`, `xdescribe`, or `todo` tests in the final commit.
- Coverage gate: 100% branch coverage on `sanitizeForPersistence()` and `CryptoStorageService`. These are security-critical paths where an untested branch could leak PII.

**Test tooling:** Vitest with `@angular/core/testing` (TestBed), `@ngrx/store/testing` (provideMockStore), `@ngrx/effects/testing` (provideMockActions). Consistent with existing `apps/borrower-portal/src/app/app.spec.ts`.

### Test File Locations

All test files live next to their implementation files, following Angular convention:

| Test File | Tests For |
|---|---|
| `+state/claim.sanitize.spec.ts` | `sanitizeForPersistence()` |
| `+state/claim.reducer.spec.ts` | `draftLoaded` reducer handler |
| `+state/claim.effects.spec.ts` | `autoSaveDraft`, `loadDraft`, `clearDraftOnReset` |
| `+state/claim.selectors.spec.ts` | `selectBorrowerValid` SSN-empty edge case |
| `services/crypto-storage.service.spec.ts` | `CryptoStorageService` |
| `services/claim-draft.service.spec.ts` | `ClaimDraftService` |
| `services/mock-api.interceptor.spec.ts` | `mockApiInterceptor` |
| `claim.devtools-sanitizers.spec.ts` | `stateSanitizer`, `actionSanitizer` |
| `borrower-info/borrower-info.component.spec.ts` | SSN re-entry UX |
| `claim.integration.spec.ts` | End-to-end persistence flows |

---

### A. Unit Tests — `sanitizeForPersistence()` (5 tests)

**File:** `+state/claim.sanitize.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 1 | strips ssnLastFour from populated state | State with `ssnLastFour: '1234'` | `sanitizeForPersistence(state)` | Result has `ssnLastFour: ''` |
| 2 | preserves all non-PII fields | Full state with all fields populated | `sanitizeForPersistence(state)` | Every field except `ssnLastFour` matches input. Deep equality check on `incident`, `medicalProviders`, `documents`, `currentStep`. |
| 3 | returns new object reference (immutability) | Any state | `sanitizeForPersistence(state)` | `result !== state` AND `result.borrower !== state.borrower` |
| 4 | handles already-empty SSN (idempotent) | State with `ssnLastFour: ''` | `sanitizeForPersistence(state)` | Result has `ssnLastFour: ''`, no error thrown |
| 5 | does not strip other borrower fields | State with `firstName: 'Jane'`, `email: 'j@x.com'` | `sanitizeForPersistence(state)` | `firstName`, `lastName`, `phone`, `email` all preserved |

---

### B. Unit Tests — `CryptoStorageService` (9 tests)

**File:** `services/crypto-storage.service.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 6 | save/load round-trip preserves state | Service instance, full claim state | `await save(state)`, then `await load()` | Loaded state deep-equals input state |
| 7 | save writes to sessionStorage | Service instance | `await save(state)` | `sessionStorage.getItem('bp_draft_enc')` is not null |
| 8 | stored value is not plaintext JSON | Service instance, state with `firstName: 'Jane'` | `await save(state)` | `sessionStorage.getItem('bp_draft_enc')` does NOT contain `'Jane'` |
| 9 | stored value contains IV and data fields | Service instance | `await save(state)` | Parsed JSON has `iv` (string) and `data` (string) properties |
| 10 | load returns null when sessionStorage is empty | Service instance, empty sessionStorage | `await load()` | Returns `null` |
| 11 | load returns null after key loss (new instance) | Instance A saves, Instance B (new `CryptoStorageService()`) loads | `instanceB.load()` | Returns `null` |
| 12 | load clears corrupt data from sessionStorage | Set `sessionStorage('bp_draft_enc', 'garbage')` | `await load()` | Returns `null` AND `sessionStorage.getItem('bp_draft_enc')` is `null` |
| 13 | load returns null for tampered ciphertext | Save valid state, then flip a byte in stored `data` | `await load()` | Returns `null` (AES-GCM authentication failure) |
| 14 | clear removes entry from sessionStorage | Save state, then `clear()` | `sessionStorage.getItem('bp_draft_enc')` | Returns `null` |

**Note on test 11:** `CryptoStorageService` is `providedIn: 'root'`, so in real DI you get a singleton. The test creates a raw `new CryptoStorageService()` to simulate tab refresh (new key). This is the critical security property: key dies with the instance.

---

### C. Unit Tests — `ClaimDraftService` (4 tests)

**File:** `services/claim-draft.service.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 15 | saveDraft sends PATCH to /api/claims/draft | `HttpTestingController` | `service.saveDraft(draft)` | Intercept: method is `PATCH`, URL is `/api/claims/draft`, body matches draft |
| 16 | saveDraft completes on 204 | Mock 204 response | Subscribe to `saveDraft()` | Observable completes without error |
| 17 | loadDraft sends GET to /api/claims/draft | `HttpTestingController` | `service.loadDraft()` | Intercept: method is `GET`, URL is `/api/claims/draft` |
| 18 | loadDraft returns draft on 200 | Mock 200 with draft body | Subscribe to `loadDraft()` | Emitted value deep-equals mock draft |

---

### D. Unit Tests — `mockApiInterceptor` (5 tests)

**File:** `services/mock-api.interceptor.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 19 | PATCH /api/claims/draft stores draft and returns 204 | HttpClient with interceptor | `http.patch('/api/claims/draft', draft)` | Response status conceptually 204. Subsequent GET returns the draft. |
| 20 | GET /api/claims/draft returns 404 when no draft saved | Fresh interceptor state | `http.get('/api/claims/draft')` | Response is 404 error |
| 21 | GET /api/claims/draft returns saved draft after PATCH | PATCH a draft first | `http.get('/api/claims/draft')` | Response body deep-equals the PATCHed draft |
| 22 | PATCH overwrites previous draft | PATCH draft A, then PATCH draft B | `http.get('/api/claims/draft')` | Response body deep-equals draft B |
| 23 | non-matching URLs pass through | HttpClient with interceptor | `http.get('/api/other')` | Request passes to `HttpTestingController` (not intercepted) |

---

### E. Unit Tests — Reducer `draftLoaded` handler (5 tests)

**File:** `+state/claim.reducer.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 24 | merges loaded draft into state | Initial state + draft with populated borrower/incident | `reducer(initialState, draftLoaded({ draft }))` | Result contains draft's `borrower.firstName`, `incident.disabilityType`, etc. |
| 25 | forces ssnLastFour to empty string (defense-in-depth) | Draft with `ssnLastFour: '9999'` (shouldn't happen, but defense) | `reducer(initialState, draftLoaded({ draft }))` | `result.borrower.ssnLastFour === ''` |
| 26 | resets isSubmitting to false | Draft with `isSubmitting: true` | `reducer(initialState, draftLoaded({ draft }))` | `result.isSubmitting === false` |
| 27 | resets error to null | Draft with `error: 'stale error'` | `reducer(initialState, draftLoaded({ draft }))` | `result.error === null` |
| 28 | returns new state reference | Any draft | `reducer(initialState, draftLoaded({ draft }))` | `result !== initialState` |

---

### F. Unit Tests — Selectors SSN edge case (2 tests)

**File:** `+state/claim.selectors.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 29 | selectBorrowerValid returns false when SSN is empty after hydration | Borrower with `firstName: 'Jane'`, `lastName: 'Doe'`, `ssnLastFour: ''`, valid phone/email | `selectBorrowerValid.projector(borrower)` | Returns `false` |
| 30 | selectBorrowerValid returns true after SSN re-entered | Same borrower but `ssnLastFour: '1234'` | `selectBorrowerValid.projector(borrower)` | Returns `true` |

---

### G. Unit Tests — DevTools Sanitizers (4 tests)

**File:** `claim.devtools-sanitizers.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 31 | stateSanitizer masks SSN in state | State with `claim.borrower.ssnLastFour: '1234'` | `stateSanitizer(state)` | `result.claim.borrower.ssnLastFour === '****'` |
| 32 | stateSanitizer preserves empty SSN as empty | State with `ssnLastFour: ''` | `stateSanitizer(state)` | `result.claim.borrower.ssnLastFour === ''` |
| 33 | actionSanitizer masks SSN in saveBorrowerInfo action | Action `{ type: '[Claim] Save Borrower Info', borrower: { ssnLastFour: '5678' } }` | `actionSanitizer(action)` | `result.borrower.ssnLastFour === '****'` |
| 34 | actionSanitizer passes non-borrower actions through unchanged | Action `{ type: '[Claim] Save Incident Details', incident: {...} }` | `actionSanitizer(action)` | `result` deep-equals input |

---

### H. Effect Tests — `autoSaveDraft` (7 tests)

**File:** `+state/claim.effects.spec.ts` (autoSaveDraft section)

Uses `provideMockActions()`, `fakeAsync`/`tick` for debounce timing, spy on `ClaimDraftService` and `CryptoStorageService`.

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 35 | saves sanitized draft to API after 2s debounce | Mock store with full state, `draftService.saveDraft` returns success | Dispatch `saveBorrowerInfo`, `tick(2000)` | `draftService.saveDraft` called once with state where `ssnLastFour === ''` |
| 36 | dispatches draftSaved on API success | Same as above | Dispatch action, `tick(2000)` | Effect emits `ClaimActions.draftSaved()` |
| 37 | falls back to encrypted sessionStorage on API failure | `draftService.saveDraft` returns `throwError` | Dispatch action, `tick(2000)` | `cryptoStorage.save` called with sanitized state |
| 38 | dispatches draftSaveError on API failure | Same as above | Dispatch action, `tick(2000)` | Effect emits `ClaimActions.draftSaveError(...)` |
| 39 | debounces rapid actions (only last wins) | Dispatch 3 `updateProvider` actions 500ms apart | `tick(500)`, dispatch, `tick(500)`, dispatch, `tick(2000)` | `draftService.saveDraft` called exactly once |
| 40 | does not fire during replay mode | `replayMode.active = true` | Dispatch `saveBorrowerInfo`, `tick(2000)` | `draftService.saveDraft` never called |
| 41 | ignores new triggers while save in flight (exhaustMap) | `draftService.saveDraft` returns delayed observable (1s) | Dispatch action, `tick(2000)`, dispatch another, `tick(1000)` | `draftService.saveDraft` called exactly once |

---

### I. Effect Tests — `loadDraft` (5 tests)

**File:** `+state/claim.effects.spec.ts` (loadDraft section)

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 42 | loads draft from API on ROOT_EFFECTS_INIT | `draftService.loadDraft` returns mock draft | Dispatch `ROOT_EFFECTS_INIT` | Effect emits `ClaimActions.draftLoaded({ draft })` |
| 43 | falls back to encrypted sessionStorage on API 404 | `draftService.loadDraft` returns error, `cryptoStorage.load` returns draft | Dispatch `ROOT_EFFECTS_INIT` | Effect emits `ClaimActions.draftLoaded({ draft })` |
| 44 | dispatches draftLoadError when both fail | Both `draftService.loadDraft` and `cryptoStorage.load` fail | Dispatch `ROOT_EFFECTS_INIT` | Effect emits `ClaimActions.draftLoadError(...)` |
| 45 | dispatches draftLoadError when API fails and sessionStorage empty | `draftService.loadDraft` errors, `cryptoStorage.load` returns `null` | Dispatch `ROOT_EFFECTS_INIT` | Effect emits `ClaimActions.draftLoadError(...)` |
| 46 | does not fire during replay mode | `replayMode.active = true` | Dispatch `ROOT_EFFECTS_INIT` | Neither `draftService` nor `cryptoStorage` called |

---

### J. Effect Tests — `clearDraftOnReset` (3 tests)

**File:** `+state/claim.effects.spec.ts` (clearDraftOnReset section)

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 47 | clears sessionStorage on resetClaim | Spy on `cryptoStorage.clear` | Dispatch `ClaimActions.resetClaim` | `cryptoStorage.clear` called |
| 48 | sends reset to API on resetClaim | `draftService.saveDraft` returns success | Dispatch `ClaimActions.resetClaim` | `draftService.saveDraft` called with `initialClaimState` |
| 49 | dispatches draftSaveError if API clear fails | `draftService.saveDraft` returns error | Dispatch `ClaimActions.resetClaim` | Effect emits `ClaimActions.draftSaveError(...)` AND `cryptoStorage.clear` was still called |

---

### K. Component Tests — SSN Re-Entry UX (4 tests)

**File:** `borrower-info/borrower-info.component.spec.ts`

Uses `provideMockStore` with selector overrides.

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 50 | shows SSN re-entry message when borrower hydrated without SSN | Override `selectBorrower` with `{ firstName: 'Jane', ..., ssnLastFour: '' }` | Render component | Element with test ID `ssn-reentry-message` is visible, contains "re-enter" text |
| 51 | does not show re-entry message on fresh form | Override `selectBorrower` with all-empty fields | Render component | `ssn-reentry-message` element is not present |
| 52 | does not show re-entry message when SSN is populated | Override `selectBorrower` with `ssnLastFour: '1234'` | Render component | `ssn-reentry-message` element is not present |
| 53 | SSN field is empty and focused after hydration | Override with hydrated borrower (SSN empty) | Render component | SSN input value is `''` |

---

### L. Integration Tests — Persistence Flows (5 tests)

**File:** `claim.integration.spec.ts`

Full TestBed with real store, real effects, mock `ClaimDraftService`, real `CryptoStorageService`. These tests verify the full pipeline from action dispatch through effects to storage.

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 54 | full save round-trip: action → debounce → API → verify no SSN | Real store, spy on `draftService.saveDraft` | Dispatch `saveBorrowerInfo` with SSN, `tick(2000)` | `saveDraft` called with payload where `ssnLastFour === ''` |
| 55 | full fallback round-trip: API fail → encrypt → decrypt → verify | `draftService.saveDraft` errors, `draftService.loadDraft` errors | Dispatch `saveBorrowerInfo`, `tick(2000)`, then trigger `loadDraft` | `draftLoaded` dispatched with original state (minus SSN) |
| 56 | SSN never in sessionStorage plaintext after fallback save | Real `CryptoStorageService`, state with `ssnLastFour: '1234'` | Dispatch `saveBorrowerInfo`, `tick(2000)`, API fails | `sessionStorage.getItem('bp_draft_enc')` does NOT contain `'1234'`, does NOT contain `'ssnLastFour'` as readable text |
| 57 | SSN never in localStorage at any point | Full flow: save, load, reset | After each step, check `localStorage` | `localStorage.length === 0` OR no key contains SSN-related data |
| 58 | reset clears all persisted state | Save a draft (API + sessionStorage fallback), then dispatch `resetClaim` | Check storage | `sessionStorage.getItem('bp_draft_enc')` is `null`, `draftService.saveDraft` called with `initialClaimState` |

---

### Test Summary

| Category | Count | File |
|---|---|---|
| A. `sanitizeForPersistence()` | 5 | `claim.sanitize.spec.ts` |
| B. `CryptoStorageService` | 9 | `crypto-storage.service.spec.ts` |
| C. `ClaimDraftService` | 4 | `claim-draft.service.spec.ts` |
| D. `mockApiInterceptor` | 5 | `mock-api.interceptor.spec.ts` |
| E. Reducer `draftLoaded` | 5 | `claim.reducer.spec.ts` |
| F. Selectors SSN edge case | 2 | `claim.selectors.spec.ts` |
| G. DevTools Sanitizers | 4 | `claim.devtools-sanitizers.spec.ts` |
| H. Effect `autoSaveDraft` | 7 | `claim.effects.spec.ts` |
| I. Effect `loadDraft` | 5 | `claim.effects.spec.ts` |
| J. Effect `clearDraftOnReset` | 3 | `claim.effects.spec.ts` |
| K. Component SSN Re-Entry | 4 | `borrower-info.component.spec.ts` |
| L. Integration Flows | 5 | `claim.integration.spec.ts` |
| **Total** | **58** | |

### TDD Implementation Order

Tests are written in dependency order. Each layer's tests are written and passing before the next layer begins.

1. **`sanitizeForPersistence`** (tests 1-5) — pure function, zero dependencies. TDD starting point.
2. **`CryptoStorageService`** (tests 6-14) — depends only on Web Crypto API.
3. **`ClaimDraftService`** (tests 15-18) — depends only on HttpClient.
4. **`mockApiInterceptor`** (tests 19-23) — depends on HttpClient testing.
5. **Reducer `draftLoaded`** (tests 24-28) — pure function, depends on action definition.
6. **Selectors** (tests 29-30) — pure projector tests, depends on model types.
7. **DevTools sanitizers** (tests 31-34) — pure functions, depends on state shape.
8. **Effects** (tests 35-49) — depends on services from steps 2-3. This is where the async orchestration lives.
9. **Component** (tests 50-53) — depends on store selectors from step 6.
10. **Integration** (tests 54-58) — full pipeline. Written last, validates the assembled system.

## Acceptance Criteria

- [ ] `localStorageMetaReducer` removed from codebase
- [ ] `ssnLastFour` never appears in any persisted storage (localStorage, sessionStorage plaintext, network requests)
- [ ] Draft auto-saves to mock API after 2s debounce on data changes
- [ ] On mock API failure, draft encrypts to sessionStorage via AES-GCM
- [ ] On app init, draft loads from mock API, falls back to encrypted sessionStorage
- [ ] DevTools state/action views show `****` instead of SSN
- [ ] SSN re-entry UX message appears after hydration
- [ ] Draft cleared from all storage on claim reset/submit
- [ ] All 58 tests pass
- [ ] No `skip`, `xit`, `xdescribe`, or `todo` tests
- [ ] 100% branch coverage on `sanitizeForPersistence()` and `CryptoStorageService`
- [ ] Every production file has a corresponding `.spec.ts` created BEFORE it
- [ ] No PII/PHI in browser developer tools, application storage, or console
