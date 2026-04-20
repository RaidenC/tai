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
    // Store IV + ciphertext + timestamp as base64
    const payload = {
      iv: this.toBase64(iv),
      data: this.toBase64(new Uint8Array(ciphertext)),
      ts: Date.now(),
    };
    sessionStorage.setItem(
      CryptoStorageService.STORAGE_KEY,
      JSON.stringify(payload)
    );
  }

  /** Draft TTL: 30 minutes. Entries older than this are rejected and purged. */
  private static readonly DRAFT_TTL_MS = 30 * 60 * 1000;

  /** Read from sessionStorage and decrypt. Returns null if missing/corrupt/key lost/expired. */
  async load(): Promise<DisabilityClaimDraft | null> {
    const raw = sessionStorage.getItem(CryptoStorageService.STORAGE_KEY);
    if (!raw) return null;

    try {
      const key = await this.getOrCreateKey();
      const { iv, data, ts } = JSON.parse(raw);

      // TTL check: reject stale entries
      if (typeof ts === 'number' && Date.now() - ts > CryptoStorageService.DRAFT_TTL_MS) {
        sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
        return null;
      }

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
- TTL enforcement — entries older than 30 minutes are rejected and purged on `load()`. Prevents stale PII from lingering even within a single tab session.

**Static method for crypto.subtle availability check:**

```typescript
  /** Check if Web Crypto API is available. Call before constructing. */
  static isAvailable(): boolean {
    return typeof crypto !== 'undefined'
      && typeof crypto.subtle !== 'undefined';
  }
```

Used by the app bootstrap guard to hard-stop the application if running in a non-secure context (HTTP, restrictive WebView). See Component 12 (`CryptoUnavailableComponent`).

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

### 4. `SecurityLoggerService` — Audit Trail for Security Events

**Location:** `apps/borrower-portal/src/app/claim/services/security-logger.service.ts`

GLBA and HIPAA auditors want to know: when was PII stripped? When did encryption fail? When did a decrypt fail (possible tampering)? This service produces structured security event logs.

```typescript
export type SecurityEventType =
  | 'PII_STRIPPED'
  | 'DRAFT_ENCRYPTED'
  | 'DRAFT_DECRYPTED'
  | 'ENCRYPT_FAILED'
  | 'DECRYPT_FAILED'
  | 'TAMPER_DETECTED'
  | 'DRAFT_TTL_EXPIRED'
  | 'CRYPTO_UNAVAILABLE';

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;    // ISO 8601
  details?: string;     // human-readable context, NEVER contains PII
}

@Injectable({ providedIn: 'root' })
export class SecurityLoggerService {
  private readonly events: SecurityEvent[] = [];

  log(type: SecurityEventType, details?: string): void {
    const event: SecurityEvent = {
      type,
      timestamp: new Date().toISOString(),
      details,
    };
    this.events.push(event);

    // In production: forward to server-side audit log endpoint
    // For POC: console.info with structured JSON
    if (isDevMode()) {
      console.info('[SECURITY]', JSON.stringify(event));
    }
  }

  /** Snapshot for testing. */
  getEvents(): readonly SecurityEvent[] {
    return this.events;
  }
}
```

**Integration points:**
- `sanitizeForPersistence()` caller (in effect) logs `PII_STRIPPED` after stripping SSN
- `CryptoStorageService.save()` logs `DRAFT_ENCRYPTED` on success, `ENCRYPT_FAILED` on failure
- `CryptoStorageService.load()` logs `DRAFT_DECRYPTED` on success, `DECRYPT_FAILED` on AES-GCM auth error (implies tamper), `DRAFT_TTL_EXPIRED` on stale entry
- App bootstrap logs `CRYPTO_UNAVAILABLE` if `CryptoStorageService.isAvailable()` returns false

### 5. `crypto.subtle` Availability Guard

**Location:** `apps/borrower-portal/src/app/app.config.ts` (APP_INITIALIZER)

`crypto.subtle` is `undefined` in non-secure contexts (plain HTTP, some corporate WebViews, IE11). The app must not silently degrade to no encryption. An `APP_INITIALIZER` checks availability at bootstrap and renders `CryptoUnavailableComponent` (from design system) if missing.

```typescript
// In app.config.ts providers array:
{
  provide: APP_INITIALIZER,
  useFactory: () => () => {
    if (!CryptoStorageService.isAvailable()) {
      inject(SecurityLoggerService).log('CRYPTO_UNAVAILABLE');
      // Set a flag that app.component reads to show CryptoUnavailableComponent
      inject(CryptoAvailabilityToken).set(false);
    }
  },
  multi: true,
}
```

The `CryptoAvailabilityToken` is a simple `signal<boolean>(true)` injection token. `AppComponent` checks it and renders either the router outlet or the `CryptoUnavailableComponent`.

### 6. Content Security Policy (CSP)

**Location:** `apps/borrower-portal/src/index.html`

CSP prevents XSS from executing in the first place. The spec addresses "what if XSS reads sessionStorage" with encryption, but the first line of defense is stopping the XSS.

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self';
  img-src 'self' data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
">
```

Notes:
- `'unsafe-inline'` for `style-src` is required by Angular's component styles. A production hardening step would use nonces.
- `object-src 'none'` blocks Flash/Java plugin vectors.
- `connect-src 'self'` restricts API calls to same origin. OIDC endpoints get added when auth is wired up.
- The existing design system already uses `TrustedTypesService` for DOM sink protection (see `secure-input` component). CSP + Trusted Types = defense in depth.

### 7. New Actions

**Added to:** `apps/borrower-portal/src/app/claim/+state/claim.actions.ts`

```typescript
// ── Draft Persistence ─────────────────────────
'Draft Saved': emptyProps(),
'Draft Save Error': props<{ message: string }>(),
'Draft Loaded': props<{ draft: DisabilityClaimDraft }>(),
'Draft Load Error': props<{ message: string }>(),
```

These are non-blocking. `draftSaveError` does not stop the user from continuing. The draft is in NgRx memory regardless. `draftLoaded` triggers the reducer to merge the hydrated draft into state.

### 8. Modified Effects

**Modified file:** `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`

#### `autoSaveDraft` — New Effect

```typescript
export const autoSaveDraft = createEffect(
  (
    actions$ = inject(Actions),
    store = inject(Store),
    draftService = inject(ClaimDraftService),
    cryptoStorage = inject(CryptoStorageService),
    securityLogger = inject(SecurityLoggerService),
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
        securityLogger.log('PII_STRIPPED', 'ssnLastFour removed before persistence');

        return draftService.saveDraft(sanitized).pipe(
          map(() => ClaimActions.draftSaved()),
          catchError(() => {
            // API failed — fall back to encrypted sessionStorage
            from(cryptoStorage.save(sanitized)).pipe(
              tap(() => securityLogger.log('DRAFT_ENCRYPTED', 'Fallback to sessionStorage')),
              catchError((err) => {
                securityLogger.log('ENCRYPT_FAILED', err?.message);
                return EMPTY;
              }),
            ).subscribe();
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

### 9. Reducer Changes

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

### 10. DevTools Sanitizers

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

### 11. `app.config.ts` Changes

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

### 12. SSN Re-Entry UX

After hydration from API or encrypted sessionStorage, `ssnLastFour` is always `''`. The `selectBorrowerValid` selector checks `ssnLastFour.trim().length === 4`, so it returns `false`. The `claimStepGuard` redirects the user to Step 1.

**Change in `borrower-info.component.ts`:**

Add a boolean flag `ssnReEntryRequired` that is `true` when the rest of the borrower form is populated but SSN is empty (hydration scenario). Show a message:

```
For your security, your SSN was not saved. Please re-enter the last 4 digits to continue.
```

This is detected by checking: `firstName.length > 0 && ssnLastFour.length === 0` after rehydration.

### 13. Cleanup on Submit and Reset

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

## Reusable Design System Components

Components that are not borrower-portal-specific belong in `libs/ui/design-system/` for cross-app reuse. Each gets a `.spec.ts` (Vitest) and a `.stories.ts` (Storybook with interaction tests), following the existing pattern in `secure-input`, `toast`, etc.

### 14. `SecurityAlertComponent` — Reusable Security Message Banner

**Location:** `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.ts`

A reusable banner for security-related user messages (re-enter credentials, session expired, encryption fallback notices). Not borrower-portal-specific. Any app that strips PII on hydration needs this pattern.

```typescript
@Component({
  selector: 'tai-security-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="visible()"
      class="security-alert"
      [class.security-alert--warning]="severity() === 'warning'"
      [class.security-alert--info]="severity() === 'info'"
      data-testid="security-alert"
    >
      <span class="security-alert__icon">&#x1f512;</span>
      <span class="security-alert__message">{{ message() }}</span>
      <button
        *ngIf="dismissible()"
        class="security-alert__dismiss"
        (click)="dismissed.emit()"
        data-testid="security-alert-dismiss"
      >
        &times;
      </button>
    </div>
  `,
})
export class SecurityAlertComponent {
  message = input.required<string>();
  severity = input<'warning' | 'info'>('warning');
  visible = input<boolean>(true);
  dismissible = input<boolean>(false);
  dismissed = output<void>();
}
```

**Storybook:** `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.stories.ts`

```typescript
const meta: Meta<SecurityAlertComponent> = {
  title: 'Security/SecurityAlert',
  component: SecurityAlertComponent,
  tags: ['autodocs'],
};
```

Stories:
- **Warning** — default severity, SSN re-entry message text
- **Info** — `severity: 'info'`, encrypted fallback notice text
- **Dismissible** — `dismissible: true`, play function clicks dismiss button, asserts banner hidden
- **Hidden** — `visible: false`, asserts no banner in DOM

**Export:** Add to `libs/ui/design-system/src/index.ts`

### 15. `CryptoUnavailableComponent` — Secure Context Gate

**Location:** `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.ts`

Full-page blocker shown when `crypto.subtle` is unavailable (HTTP context, restrictive corporate WebView, older browser). FinTech apps must not silently degrade to no encryption. This is a hard stop, not a fallback.

```typescript
@Component({
  selector: 'tai-crypto-unavailable',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="crypto-unavailable" data-testid="crypto-unavailable">
      <h2>Secure Connection Required</h2>
      <p>{{ message() }}</p>
      <p>Please ensure you are accessing this application over HTTPS.</p>
    </div>
  `,
})
export class CryptoUnavailableComponent {
  message = input<string>(
    'This application requires a secure browser environment to protect your data.'
  );
}
```

**Storybook:** `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.stories.ts`

Stories:
- **Default** — renders with default message
- **Custom Message** — renders with custom `message` input

**Export:** Add to `libs/ui/design-system/src/index.ts`

## Files Changed

| File | Action | Description |
|---|---|---|
| **borrower-portal app** | | |
| `+state/claim.meta-reducer.ts` | **DELETE** | Replaced by effect-based persistence |
| `+state/claim.sanitize.ts` | **CREATE** | `sanitizeForPersistence()` pure function |
| `+state/claim.actions.ts` | **MODIFY** | Add 4 draft persistence actions |
| `+state/claim.effects.ts` | **MODIFY** | Add `autoSaveDraft`, `loadDraft`, `clearDraftOnReset` |
| `+state/claim.reducer.ts` | **MODIFY** | Add `on(draftLoaded)` handler |
| `+state/index.ts` | **MODIFY** | Update barrel exports |
| `services/crypto-storage.service.ts` | **CREATE** | AES-GCM encrypted sessionStorage |
| `services/claim-draft.service.ts` | **CREATE** | HTTP client for draft API |
| `services/mock-api.interceptor.ts` | **CREATE** | Mock PATCH/GET `/api/claims/draft` |
| `services/security-logger.service.ts` | **CREATE** | Structured security audit event logger |
| `app.config.ts` | **MODIFY** | Remove meta-reducer, add HttpClient, register new effects, add DevTools sanitizers, add CSP meta tag |
| `borrower-info.component.ts` | **MODIFY** | SSN re-entry UX using `SecurityAlertComponent` |
| `borrower-info.component.html` | **MODIFY** | SSN re-entry alert markup |
| **libs/ui/design-system** | | |
| `design-system/security-alert/security-alert.ts` | **CREATE** | Reusable security message banner |
| `design-system/security-alert/security-alert.spec.ts` | **CREATE** | Vitest unit tests |
| `design-system/security-alert/security-alert.stories.ts` | **CREATE** | Storybook stories with interaction tests |
| `design-system/crypto-unavailable/crypto-unavailable.ts` | **CREATE** | Secure context gate blocker |
| `design-system/crypto-unavailable/crypto-unavailable.spec.ts` | **CREATE** | Vitest unit tests |
| `design-system/crypto-unavailable/crypto-unavailable.stories.ts` | **CREATE** | Storybook stories |
| `src/index.ts` | **MODIFY** | Export new components |

## Security Properties Summary

| Threat | Mitigation |
|---|---|
| SSN in localStorage | SSN **never** persisted. `sanitizeForPersistence()` strips it. Reducer defense-in-depth on load. |
| PII/PHI in localStorage | localStorage not used at all. sessionStorage (tab-scoped) with AES-GCM encryption. |
| Key theft | Key is `extractable: false`, lives in-memory only. Tab refresh = key destroyed = ciphertext dead. |
| XSS reads sessionStorage | Ciphertext only. Without the in-memory key, it's random bytes. |
| XSS prevention (defense-in-depth) | CSP meta tag restricts script sources. Existing `TrustedTypesService` in design system for DOM sinks. |
| DevTools PII leak | `stateSanitizer` and `actionSanitizer` replace SSN with `****`. |
| Shared computer | sessionStorage clears on tab close. Encryption key lost on refresh. No persistent traces. |
| IV reuse (AES-GCM) | Fresh random IV on every `save()` call. |
| Stale draft after submission | `clearDraftOnReset` effect clears both server and sessionStorage on reset. |
| `crypto.subtle` unavailable | `CryptoUnavailableComponent` hard-blocks the app. No silent degradation to plaintext. |
| No audit trail | `SecurityLoggerService` emits structured events for PII strip, encrypt fail, decrypt fail, tamper detect. |
| Stale draft without TTL | sessionStorage entries carry a timestamp. `CryptoStorageService.load()` rejects entries older than `DRAFT_TTL_MS`. |
| Sanitizer bypass via direct dispatch | Negative security tests verify reducer strips SSN even when `draftLoaded` is dispatched directly (not via effect). |

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

**Test tooling:** Vitest with `@angular/core/testing` (TestBed), `@ngrx/store/testing` (provideMockStore), `@ngrx/effects/testing` (provideMockActions), `fast-check` for property-based testing, Storybook with `@storybook/test` for interaction tests. Consistent with existing `apps/borrower-portal/src/app/app.spec.ts` and `libs/ui/design-system/src/lib/design-system/secure-input/secure-input.stories.ts`.

### Test File Locations

All test files live next to their implementation files, following Angular convention:

| Test File | Tests For |
|---|---|
| `+state/claim.sanitize.spec.ts` | `sanitizeForPersistence()` unit + property-based |
| `+state/claim.reducer.spec.ts` | `draftLoaded` reducer handler |
| `+state/claim.effects.spec.ts` | `autoSaveDraft`, `loadDraft`, `clearDraftOnReset` |
| `+state/claim.selectors.spec.ts` | `selectBorrowerValid` SSN-empty edge case |
| `services/crypto-storage.service.spec.ts` | `CryptoStorageService` unit + property-based + TTL |
| `services/claim-draft.service.spec.ts` | `ClaimDraftService` |
| `services/mock-api.interceptor.spec.ts` | `mockApiInterceptor` |
| `services/security-logger.service.spec.ts` | `SecurityLoggerService` |
| `claim.devtools-sanitizers.spec.ts` | `stateSanitizer`, `actionSanitizer` |
| `borrower-info/borrower-info.component.spec.ts` | SSN re-entry UX |
| `claim.security-negative.spec.ts` | Negative security tests (bypass prevention) |
| `claim.integration.spec.ts` | End-to-end persistence flows |
| **Design System (libs/ui/design-system)** | |
| `security-alert/security-alert.spec.ts` | `SecurityAlertComponent` Vitest |
| `security-alert/security-alert.stories.ts` | `SecurityAlertComponent` Storybook interaction tests |
| `crypto-unavailable/crypto-unavailable.spec.ts` | `CryptoUnavailableComponent` Vitest |
| `crypto-unavailable/crypto-unavailable.stories.ts` | `CryptoUnavailableComponent` Storybook interaction tests |

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

### B. Unit Tests — `CryptoStorageService` (13 tests)

**File:** `services/crypto-storage.service.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 6 | save/load round-trip preserves state | Service instance, full claim state | `await save(state)`, then `await load()` | Loaded state deep-equals input state |
| 7 | save writes to sessionStorage | Service instance | `await save(state)` | `sessionStorage.getItem('bp_draft_enc')` is not null |
| 8 | stored value is not plaintext JSON | Service instance, state with `firstName: 'Jane'` | `await save(state)` | `sessionStorage.getItem('bp_draft_enc')` does NOT contain `'Jane'` |
| 9 | stored value contains IV, data, and ts fields | Service instance | `await save(state)` | Parsed JSON has `iv` (string), `data` (string), and `ts` (number) properties |
| 10 | load returns null when sessionStorage is empty | Service instance, empty sessionStorage | `await load()` | Returns `null` |
| 11 | load returns null after key loss (new instance) | Instance A saves, Instance B (new `CryptoStorageService()`) loads | `instanceB.load()` | Returns `null` |
| 12 | load clears corrupt data from sessionStorage | Set `sessionStorage('bp_draft_enc', 'garbage')` | `await load()` | Returns `null` AND `sessionStorage.getItem('bp_draft_enc')` is `null` |
| 13 | load returns null for tampered ciphertext | Save valid state, then flip a byte in stored `data` | `await load()` | Returns `null` (AES-GCM authentication failure) |
| 14 | clear removes entry from sessionStorage | Save state, then `clear()` | `sessionStorage.getItem('bp_draft_enc')` | Returns `null` |
| 15 | load rejects entry older than DRAFT_TTL_MS | Save state, then set `ts` to `Date.now() - 31 * 60 * 1000` in sessionStorage | `await load()` | Returns `null`, sessionStorage entry removed |
| 16 | load accepts entry within DRAFT_TTL_MS | Save state (ts is fresh) | `await load()` | Returns the saved state |
| 17 | isAvailable returns true in secure context | Standard test environment | `CryptoStorageService.isAvailable()` | Returns `true` |
| 18 | isAvailable returns false when crypto.subtle missing | Mock `crypto.subtle` as `undefined` | `CryptoStorageService.isAvailable()` | Returns `false` |

**Property-based test (fast-check):**

| # | Test Name | Property |
|---|---|---|
| 19 | round-trip preserves arbitrary valid state | `fc.record({ claimId: fc.string(), currentStep: fc.integer({min:1,max:4}), borrower: fc.record({...}), ... })` | For all generated states: `save(state)` then `load()` deep-equals `state` |

**Note on test 11:** `CryptoStorageService` is `providedIn: 'root'`, so in real DI you get a singleton. The test creates a raw `new CryptoStorageService()` to simulate tab refresh (new key). This is the critical security property: key dies with the instance.

---

### C. Unit Tests — `ClaimDraftService` (4 tests)

**File:** `services/claim-draft.service.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 20 | saveDraft sends PATCH to /api/claims/draft | `HttpTestingController` | `service.saveDraft(draft)` | Intercept: method is `PATCH`, URL is `/api/claims/draft`, body matches draft |
| 21 | saveDraft completes on 204 | Mock 204 response | Subscribe to `saveDraft()` | Observable completes without error |
| 22 | loadDraft sends GET to /api/claims/draft | `HttpTestingController` | `service.loadDraft()` | Intercept: method is `GET`, URL is `/api/claims/draft` |
| 23 | loadDraft returns draft on 200 | Mock 200 with draft body | Subscribe to `loadDraft()` | Emitted value deep-equals mock draft |

---

### D. Unit Tests — `mockApiInterceptor` (5 tests)

**File:** `services/mock-api.interceptor.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 24 | PATCH /api/claims/draft stores draft and returns 204 | HttpClient with interceptor | `http.patch('/api/claims/draft', draft)` | Response status conceptually 204. Subsequent GET returns the draft. |
| 25 | GET /api/claims/draft returns 404 when no draft saved | Fresh interceptor state | `http.get('/api/claims/draft')` | Response is 404 error |
| 26 | GET /api/claims/draft returns saved draft after PATCH | PATCH a draft first | `http.get('/api/claims/draft')` | Response body deep-equals the PATCHed draft |
| 27 | PATCH overwrites previous draft | PATCH draft A, then PATCH draft B | `http.get('/api/claims/draft')` | Response body deep-equals draft B |
| 28 | non-matching URLs pass through | HttpClient with interceptor | `http.get('/api/other')` | Request passes to `HttpTestingController` (not intercepted) |

---

### E. Unit Tests — `SecurityLoggerService` (5 tests)

**File:** `services/security-logger.service.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 29 | logs event with correct type and timestamp | Fresh service | `service.log('PII_STRIPPED', 'ssnLastFour removed')` | `getEvents()[0].type === 'PII_STRIPPED'`, `timestamp` is valid ISO 8601 |
| 30 | accumulates multiple events in order | Fresh service | Log 3 events of different types | `getEvents().length === 3`, types match in order |
| 31 | details field is optional | Fresh service | `service.log('DRAFT_ENCRYPTED')` | `getEvents()[0].details` is `undefined` |
| 32 | details never contains PII patterns | Fresh service | `service.log('PII_STRIPPED', 'ssnLastFour removed')` | `details` does not match `/\d{4}/` (no 4-digit sequences that could be SSN) |
| 33 | console.info called in dev mode | `isDevMode() = true`, spy on `console.info` | `service.log('TAMPER_DETECTED')` | `console.info` called with `[SECURITY]` prefix and JSON string |

---

### F. Unit Tests — Reducer `draftLoaded` handler (5 tests)

**File:** `+state/claim.reducer.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 34 | merges loaded draft into state | Initial state + draft with populated borrower/incident | `reducer(initialState, draftLoaded({ draft }))` | Result contains draft's `borrower.firstName`, `incident.disabilityType`, etc. |
| 35 | forces ssnLastFour to empty string (defense-in-depth) | Draft with `ssnLastFour: '9999'` (shouldn't happen, but defense) | `reducer(initialState, draftLoaded({ draft }))` | `result.borrower.ssnLastFour === ''` |
| 36 | resets isSubmitting to false | Draft with `isSubmitting: true` | `reducer(initialState, draftLoaded({ draft }))` | `result.isSubmitting === false` |
| 37 | resets error to null | Draft with `error: 'stale error'` | `reducer(initialState, draftLoaded({ draft }))` | `result.error === null` |
| 38 | returns new state reference | Any draft | `reducer(initialState, draftLoaded({ draft }))` | `result !== initialState` |

---

### G. Unit Tests — Selectors SSN edge case (2 tests)

**File:** `+state/claim.selectors.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 39 | selectBorrowerValid returns false when SSN is empty after hydration | Borrower with `firstName: 'Jane'`, `lastName: 'Doe'`, `ssnLastFour: ''`, valid phone/email | `selectBorrowerValid.projector(borrower)` | Returns `false` |
| 40 | selectBorrowerValid returns true after SSN re-entered | Same borrower but `ssnLastFour: '1234'` | `selectBorrowerValid.projector(borrower)` | Returns `true` |

---

### H. Unit Tests — DevTools Sanitizers (4 tests)

**File:** `claim.devtools-sanitizers.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 41 | stateSanitizer masks SSN in state | State with `claim.borrower.ssnLastFour: '1234'` | `stateSanitizer(state)` | `result.claim.borrower.ssnLastFour === '****'` |
| 42 | stateSanitizer preserves empty SSN as empty | State with `ssnLastFour: ''` | `stateSanitizer(state)` | `result.claim.borrower.ssnLastFour === ''` |
| 43 | actionSanitizer masks SSN in saveBorrowerInfo action | Action `{ type: '[Claim] Save Borrower Info', borrower: { ssnLastFour: '5678' } }` | `actionSanitizer(action)` | `result.borrower.ssnLastFour === '****'` |
| 44 | actionSanitizer passes non-borrower actions through unchanged | Action `{ type: '[Claim] Save Incident Details', incident: {...} }` | `actionSanitizer(action)` | `result` deep-equals input |

---

### I. Effect Tests — `autoSaveDraft` (8 tests)

**File:** `+state/claim.effects.spec.ts` (autoSaveDraft section)

Uses `provideMockActions()`, `fakeAsync`/`tick` for debounce timing, spy on `ClaimDraftService`, `CryptoStorageService`, and `SecurityLoggerService`.

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 45 | saves sanitized draft to API after 2s debounce | Mock store with full state, `draftService.saveDraft` returns success | Dispatch `saveBorrowerInfo`, `tick(2000)` | `draftService.saveDraft` called once with state where `ssnLastFour === ''` |
| 46 | dispatches draftSaved on API success | Same as above | Dispatch action, `tick(2000)` | Effect emits `ClaimActions.draftSaved()` |
| 47 | falls back to encrypted sessionStorage on API failure | `draftService.saveDraft` returns `throwError` | Dispatch action, `tick(2000)` | `cryptoStorage.save` called with sanitized state |
| 48 | dispatches draftSaveError on API failure | Same as above | Dispatch action, `tick(2000)` | Effect emits `ClaimActions.draftSaveError(...)` |
| 49 | debounces rapid actions (only last wins) | Dispatch 3 `updateProvider` actions 500ms apart | `tick(500)`, dispatch, `tick(500)`, dispatch, `tick(2000)` | `draftService.saveDraft` called exactly once |
| 50 | does not fire during replay mode | `replayMode.active = true` | Dispatch `saveBorrowerInfo`, `tick(2000)` | `draftService.saveDraft` never called |
| 51 | ignores new triggers while save in flight (exhaustMap) | `draftService.saveDraft` returns delayed observable (1s) | Dispatch action, `tick(2000)`, dispatch another, `tick(1000)` | `draftService.saveDraft` called exactly once |
| 52 | logs PII_STRIPPED on every save | Mock store, `draftService.saveDraft` success | Dispatch action, `tick(2000)` | `securityLogger.log` called with `'PII_STRIPPED'` |

---

### J. Effect Tests — `loadDraft` (5 tests)

**File:** `+state/claim.effects.spec.ts` (loadDraft section)

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 53 | loads draft from API on ROOT_EFFECTS_INIT | `draftService.loadDraft` returns mock draft | Dispatch `ROOT_EFFECTS_INIT` | Effect emits `ClaimActions.draftLoaded({ draft })` |
| 54 | falls back to encrypted sessionStorage on API 404 | `draftService.loadDraft` returns error, `cryptoStorage.load` returns draft | Dispatch `ROOT_EFFECTS_INIT` | Effect emits `ClaimActions.draftLoaded({ draft })` |
| 55 | dispatches draftLoadError when both fail | Both `draftService.loadDraft` and `cryptoStorage.load` fail | Dispatch `ROOT_EFFECTS_INIT` | Effect emits `ClaimActions.draftLoadError(...)` |
| 56 | dispatches draftLoadError when API fails and sessionStorage empty | `draftService.loadDraft` errors, `cryptoStorage.load` returns `null` | Dispatch `ROOT_EFFECTS_INIT` | Effect emits `ClaimActions.draftLoadError(...)` |
| 57 | does not fire during replay mode | `replayMode.active = true` | Dispatch `ROOT_EFFECTS_INIT` | Neither `draftService` nor `cryptoStorage` called |

---

### K. Effect Tests — `clearDraftOnReset` (3 tests)

**File:** `+state/claim.effects.spec.ts` (clearDraftOnReset section)

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 58 | clears sessionStorage on resetClaim | Spy on `cryptoStorage.clear` | Dispatch `ClaimActions.resetClaim` | `cryptoStorage.clear` called |
| 59 | sends reset to API on resetClaim | `draftService.saveDraft` returns success | Dispatch `ClaimActions.resetClaim` | `draftService.saveDraft` called with `initialClaimState` |
| 60 | dispatches draftSaveError if API clear fails | `draftService.saveDraft` returns error | Dispatch `ClaimActions.resetClaim` | Effect emits `ClaimActions.draftSaveError(...)` AND `cryptoStorage.clear` was still called |

---

### L. Component Tests — SSN Re-Entry UX (4 tests)

**File:** `borrower-info/borrower-info.component.spec.ts`

Uses `provideMockStore` with selector overrides.

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 61 | shows SSN re-entry message when borrower hydrated without SSN | Override `selectBorrower` with `{ firstName: 'Jane', ..., ssnLastFour: '' }` | Render component | `tai-security-alert` component is visible, contains "re-enter" text |
| 62 | does not show re-entry message on fresh form | Override `selectBorrower` with all-empty fields | Render component | `tai-security-alert` is not present |
| 63 | does not show re-entry message when SSN is populated | Override `selectBorrower` with `ssnLastFour: '1234'` | Render component | `tai-security-alert` is not present |
| 64 | SSN field is empty and focused after hydration | Override with hydrated borrower (SSN empty) | Render component | SSN input value is `''` |

---

### M. Negative Security Tests (6 tests)

**File:** `claim.security-negative.spec.ts`

These tests prove that *bypasses are impossible*. They verify the system's security properties hold even when components are used outside their intended flow.

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 65 | reducer strips SSN even on direct draftLoaded dispatch (bypass effect) | Real store, no effects | `store.dispatch(draftLoaded({ draft: draftWithSSN }))` | `store.select(selectBorrower)` has `ssnLastFour === ''` |
| 66 | sanitizeForPersistence is the only code path writing to draftService | Spy on `ClaimDraftService.saveDraft` across all effect runs | Run full save cycle | Every call to `saveDraft` has `ssnLastFour === ''` in payload |
| 67 | localStorage is never written to by any code path | Full TestBed, spy on `localStorage.setItem` | Dispatch all action types, trigger save/load/reset | `localStorage.setItem` never called |
| 68 | DevTools sanitizer cannot be bypassed with nested action | Action with `borrower` nested under unexpected key | `actionSanitizer(action)` | SSN not present in any serialized output |
| 69 | expired TTL draft cannot be loaded even with valid key | Save state, manipulate `ts` to expired, same service instance (key valid) | `await load()` | Returns `null` despite valid decryption key |
| 70 | crypto.subtle unavailability prevents any storage write | Mock `crypto.subtle` as `undefined` | Attempt `cryptoStorage.save(state)` | Throws or returns error. sessionStorage unchanged. |

---

### N. Design System — `SecurityAlertComponent` (4 Vitest + 4 Storybook)

**Vitest file:** `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 71 | renders message text | `message: 'Re-enter SSN'`, `visible: true` | Render component | Text content contains `'Re-enter SSN'` |
| 72 | applies warning class by default | `severity: 'warning'` | Render component | Element has class `security-alert--warning` |
| 73 | hidden when visible is false | `visible: false` | Render component | No `security-alert` element in DOM |
| 74 | emits dismissed event on dismiss click | `dismissible: true` | Click dismiss button | `dismissed` output emitted |

**Storybook file:** `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.stories.ts`

Following the existing pattern from `secure-input.stories.ts`: `Meta` with `tags: ['autodocs']`, `moduleMetadata`, `play` functions with `within`/`expect`/`userEvent` from `storybook/test`.

| Story | Args | Play Function Assertions |
|---|---|---|
| Warning | `message: 'For your security, please re-enter your SSN', severity: 'warning'` | Assert `data-testid="security-alert"` visible, contains message text |
| Info | `message: 'Draft saved locally (encrypted)', severity: 'info'` | Assert `security-alert--info` class applied |
| Dismissible | `dismissible: true, message: 'Session expired'` | Click dismiss button via `userEvent.click`, assert element removed from DOM |
| Hidden | `visible: false, message: 'Hidden message'` | Assert no `security-alert` element in canvas |

---

### O. Design System — `CryptoUnavailableComponent` (2 Vitest + 2 Storybook)

**Vitest file:** `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts`

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 75 | renders default message | No inputs | Render component | Contains `'secure browser environment'` text |
| 76 | renders custom message | `message: 'Please use Chrome or Edge'` | Render component | Contains `'Please use Chrome or Edge'` text |

**Storybook file:** `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.stories.ts`

| Story | Args | Play Function Assertions |
|---|---|---|
| Default | No args | Assert `data-testid="crypto-unavailable"` visible, contains HTTPS guidance |
| CustomMessage | `message: 'WebView not supported'` | Assert custom message text rendered |

---

### P. Property-Based Tests — `sanitizeForPersistence()` (2 tests)

**File:** `+state/claim.sanitize.spec.ts` (fast-check section)

Uses `fast-check` to generate arbitrary valid `DisabilityClaimDraft` instances and verify security invariants hold for ALL possible inputs, not just the examples we thought of.

| # | Property | Generator | Assertion |
|---|---|---|---|
| 77 | SSN is always stripped regardless of input | `fc.record` matching `DisabilityClaimDraft` shape with `ssnLastFour: fc.stringOf(fc.char(), {minLength:0, maxLength:10})` | `sanitizeForPersistence(state).borrower.ssnLastFour === ''` for every generated state |
| 78 | all non-SSN fields are always preserved | Same generator | `result.incident` deep-equals `input.incident`, `result.medicalProviders` deep-equals `input.medicalProviders`, `result.documents` deep-equals `input.documents`, `result.currentStep === input.currentStep` |

---

### Q. Integration Tests — Persistence Flows (7 tests)

**File:** `claim.integration.spec.ts`

Full TestBed with real store, real effects, mock `ClaimDraftService`, real `CryptoStorageService`, real `SecurityLoggerService`. These tests verify the full pipeline from action dispatch through effects to storage and audit trail.

| # | Test Name | Arrange | Act | Assert |
|---|---|---|---|---|
| 79 | full save round-trip: action → debounce → API → verify no SSN | Real store, spy on `draftService.saveDraft` | Dispatch `saveBorrowerInfo` with SSN, `tick(2000)` | `saveDraft` called with payload where `ssnLastFour === ''` |
| 80 | full fallback round-trip: API fail → encrypt → decrypt → verify | `draftService.saveDraft` errors, `draftService.loadDraft` errors | Dispatch `saveBorrowerInfo`, `tick(2000)`, then trigger `loadDraft` | `draftLoaded` dispatched with original state (minus SSN) |
| 81 | SSN never in sessionStorage plaintext after fallback save | Real `CryptoStorageService`, state with `ssnLastFour: '1234'` | Dispatch `saveBorrowerInfo`, `tick(2000)`, API fails | `sessionStorage.getItem('bp_draft_enc')` does NOT contain `'1234'`, does NOT contain `'ssnLastFour'` as readable text |
| 82 | SSN never in localStorage at any point | Full flow: save, load, reset | After each step, check `localStorage` | `localStorage.length === 0` OR no key contains SSN-related data |
| 83 | reset clears all persisted state | Save a draft (API + sessionStorage fallback), then dispatch `resetClaim` | Check storage | `sessionStorage.getItem('bp_draft_enc')` is `null`, `draftService.saveDraft` called with `initialClaimState` |
| 84 | audit trail records full save lifecycle | Real `SecurityLoggerService`, API success path | Dispatch `saveBorrowerInfo`, `tick(2000)` | `securityLogger.getEvents()` contains `PII_STRIPPED` event |
| 85 | audit trail records encrypt fallback on API failure | Real `SecurityLoggerService`, API fails | Dispatch action, `tick(2000)` | Events contain `PII_STRIPPED` followed by `DRAFT_ENCRYPTED` |

---

### Test Summary

| Category | Count | File |
|---|---|---|
| A. `sanitizeForPersistence()` | 5 | `claim.sanitize.spec.ts` |
| B. `CryptoStorageService` | 14 | `crypto-storage.service.spec.ts` |
| C. `ClaimDraftService` | 4 | `claim-draft.service.spec.ts` |
| D. `mockApiInterceptor` | 5 | `mock-api.interceptor.spec.ts` |
| E. `SecurityLoggerService` | 5 | `security-logger.service.spec.ts` |
| F. Reducer `draftLoaded` | 5 | `claim.reducer.spec.ts` |
| G. Selectors SSN edge case | 2 | `claim.selectors.spec.ts` |
| H. DevTools Sanitizers | 4 | `claim.devtools-sanitizers.spec.ts` |
| I. Effect `autoSaveDraft` | 8 | `claim.effects.spec.ts` |
| J. Effect `loadDraft` | 5 | `claim.effects.spec.ts` |
| K. Effect `clearDraftOnReset` | 3 | `claim.effects.spec.ts` |
| L. Component SSN Re-Entry | 4 | `borrower-info.component.spec.ts` |
| M. Negative Security | 6 | `claim.security-negative.spec.ts` |
| N. Design System `SecurityAlert` | 4 + 4 stories | `security-alert.spec.ts` + `.stories.ts` |
| O. Design System `CryptoUnavailable` | 2 + 2 stories | `crypto-unavailable.spec.ts` + `.stories.ts` |
| P. Property-Based (fast-check) | 2 | `claim.sanitize.spec.ts` |
| Q. Integration Flows | 7 | `claim.integration.spec.ts` |
| **Total** | **85 tests + 6 Storybook stories** | |

### TDD Implementation Order

Tests are written in dependency order. Each layer's tests are written and passing before the next layer begins.

1. **`sanitizeForPersistence`** (tests 1-5, 77-78) — pure function, zero dependencies. TDD starting point. Property-based tests added here too.
2. **`SecurityLoggerService`** (tests 29-33) — no external deps. Needed by services and effects below.
3. **`CryptoStorageService`** (tests 6-19) — depends on Web Crypto API. Includes TTL tests and property-based round-trip.
4. **`ClaimDraftService`** (tests 20-23) — depends only on HttpClient.
5. **`mockApiInterceptor`** (tests 24-28) — depends on HttpClient testing.
6. **Design System components** (tests 71-76 + 6 stories) — standalone, no NgRx deps. Can be built in parallel with steps 3-5.
7. **Reducer `draftLoaded`** (tests 34-38) — pure function, depends on action definition.
8. **Selectors** (tests 39-40) — pure projector tests, depends on model types.
9. **DevTools sanitizers** (tests 41-44) — pure functions, depends on state shape.
10. **Effects** (tests 45-60) — depends on services from steps 2-5. Includes security audit logging verification.
11. **Component** (tests 61-64) — depends on store selectors and `SecurityAlertComponent` from step 6.
12. **Negative security** (tests 65-70) — adversarial tests. Depends on assembled system.
13. **Integration** (tests 79-85) — full pipeline with audit trail. Written last, validates the assembled system.

## Acceptance Criteria

- [ ] `localStorageMetaReducer` removed from codebase
- [ ] `ssnLastFour` never appears in any persisted storage (localStorage, sessionStorage plaintext, network requests)
- [ ] Draft auto-saves to mock API after 2s debounce on data changes
- [ ] On mock API failure, draft encrypts to sessionStorage via AES-GCM
- [ ] On app init, draft loads from mock API, falls back to encrypted sessionStorage
- [ ] DevTools state/action views show `****` instead of SSN
- [ ] SSN re-entry UX message appears after hydration (uses `SecurityAlertComponent` from design system)
- [ ] Draft cleared from all storage on claim reset/submit
- [ ] All 85 tests pass
- [ ] All 6 Storybook stories pass interaction tests
- [ ] No `skip`, `xit`, `xdescribe`, or `todo` tests
- [ ] 100% branch coverage on `sanitizeForPersistence()` and `CryptoStorageService`
- [ ] Every production file has a corresponding `.spec.ts` created BEFORE it
- [ ] No PII/PHI in browser developer tools, application storage, or console
- [ ] Property-based tests (fast-check) verify sanitizer and crypto round-trip for arbitrary inputs
- [ ] Negative security tests verify bypass prevention (direct dispatch, localStorage prohibition, TTL enforcement)
- [ ] `SecurityLoggerService` records audit events for PII strip, encrypt, decrypt, tamper, and TTL expiry
- [ ] `crypto.subtle` unavailability hard-blocks the app with `CryptoUnavailableComponent`
- [ ] CSP meta tag in `index.html` restricts script/connect/object sources
- [ ] sessionStorage entries enforce 30-minute TTL
- [ ] `SecurityAlertComponent` and `CryptoUnavailableComponent` exported from `libs/ui/design-system`
