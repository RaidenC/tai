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

## Testing

### Unit Tests

1. **`sanitizeForPersistence()`** — input state with SSN → output state with `ssnLastFour: ''`
2. **`CryptoStorageService.save/load`** — round-trip: save state, load state, assert deep equality
3. **`CryptoStorageService` key loss** — save state, create new service instance, load → returns `null`
4. **`CryptoStorageService` corrupt data** — tamper with sessionStorage content, load → returns `null`, sessionStorage cleared
5. **Reducer `draftLoaded`** — merges draft, forces `ssnLastFour: ''`, resets `isSubmitting`
6. **DevTools `stateSanitizer`** — state with SSN → sanitized state shows `****`
7. **DevTools `actionSanitizer`** — `saveBorrowerInfo` action → SSN replaced with `****`

### Effect Tests

8. **`autoSaveDraft`** — dispatches data-changing action → after 2s debounce → calls `draftService.saveDraft` with sanitized state
9. **`autoSaveDraft` API failure** — `draftService.saveDraft` errors → `cryptoStorage.save()` called → dispatches `draftSaveError`
10. **`autoSaveDraft` replay suppression** — `replayMode.active = true` → effect does not fire
11. **`loadDraft`** — `ROOT_EFFECTS_INIT` → calls `draftService.loadDraft` → dispatches `draftLoaded`
12. **`loadDraft` API failure, sessionStorage hit** — API errors → loads from `cryptoStorage` → dispatches `draftLoaded`
13. **`loadDraft` both fail** — API and crypto both fail → dispatches `draftLoadError`
14. **`clearDraftOnReset`** — `resetClaim` dispatched → clears sessionStorage and server draft

### Integration Tests

15. **SSN re-entry flow** — hydrate draft without SSN → guard redirects to Step 1 → message shown → user enters SSN → can proceed to Step 2
16. **Full round-trip** — fill Steps 1-3 → wait 2s → mock API receives sanitized draft → reload app → draft restored (minus SSN)

## Acceptance Criteria

- [ ] `localStorageMetaReducer` removed from codebase
- [ ] `ssnLastFour` never appears in any persisted storage (localStorage, sessionStorage plaintext, network requests)
- [ ] Draft auto-saves to mock API after 2s debounce on data changes
- [ ] On mock API failure, draft encrypts to sessionStorage via AES-GCM
- [ ] On app init, draft loads from mock API, falls back to encrypted sessionStorage
- [ ] DevTools state/action views show `****` instead of SSN
- [ ] SSN re-entry UX message appears after hydration
- [ ] Draft cleared from all storage on claim reset/submit
- [ ] All 16 tests pass
- [ ] No PII/PHI in browser developer tools, application storage, or console
