# Secure Draft Persistence — Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Address all Critical and Important findings from the code review of the secure draft persistence implementation (commits `9542dea..8fbe732`) to bring the code back in line with the security spec and fix real defects.

**Architecture:** Each task is an isolated fix targeting a specific review finding. Behavioral changes follow TDD (RED → GREEN → commit). Comment-only and rename refactors skip TDD since the type system enforces correctness. Every task ends in a single focused commit.

**Tech Stack:** Angular 21, NgRx 21 (functional effects), Vitest, fast-check, Storybook 8

**Review source:** Code review summary on commit range `173f369..8fbe732`. Findings mapped:
- Critical #1 → Task 1
- Critical #2 → Task 2
- Important #3 → Task 3
- Important #7 → Task 4 (same effect block as #3, split for clarity)
- Important #4 → Task 5 (SecurityAlert) + Task 6 (CryptoUnavailable)
- Important #6 → Task 7
- Important #8 → Task 8
- Important #5 → Task 9 (stale comments)
- Suggestion #9 → Task 10
- Suggestion #10 → Task 11
- Verification → Task 12

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.ts` | MODIFY | Revert from sessionStorage back to in-memory `Map` (removes plaintext PII store) |
| `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts` | MODIFY | Drop sessionStorage cleanup hooks now that mock is in-memory |
| `apps/borrower-portal/src/app/claim/+state/claim.effects.ts` | MODIFY | Fix crypto fallback action, rename event types, remove spurious log call |
| `apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts` | MODIFY | Update effect tests for the two behavior changes |
| `apps/borrower-portal/src/app/claim/services/security-logger.service.ts` | MODIFY | Rename `ENCRYPT_FAIL` → `ENCRYPT_FAILED`, `DECRYPT_FAIL` → `DECRYPT_FAILED` |
| `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.ts` | MODIFY | Add `role="alert"`, `aria-live`, dismiss `aria-label` |
| `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts` | MODIFY | Assert ARIA attributes |
| `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.ts` | MODIFY | Add `role="alert"`, `aria-live="assertive"` |
| `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts` | MODIFY | Assert ARIA attributes |
| `apps/borrower-portal/src/app/app.ts` | MODIFY | Inject `SecurityLoggerService`, log `CRYPTO_UNAVAILABLE` when gate fails |
| `apps/borrower-portal/src/app/app.spec.ts` | CREATE | Tests for the availability gate + logging side-effect |
| `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.ts` | MODIFY | Replace `takeUntil` subscription with `first()` so hydration only runs once |
| `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts` | MODIFY | Add regression test: second store emission does not overwrite typed form input |
| `apps/borrower-portal/src/app/claim/+state/claim.reducer.ts` | MODIFY | Remove stale "meta-reducer will persist" comment on `resetClaim` |
| `apps/borrower-portal/src/app/claim/+state/claim.models.ts` | MODIFY | Remove stale localStorage meta-reducer comments |
| `apps/borrower-portal/src/app/claim/+state/claim.effects.ts` | MODIFY | Remove stale comment at line 6 referencing localStorage writes |
| `apps/borrower-portal/src/app/claim/+state/claim-step.guard.ts` | MODIFY | Remove stale meta-reducer reference in doc comment |
| `apps/borrower-portal/src/app/app.routes.ts` | MODIFY | Remove stale localStorage hydration comment |
| `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.ts` | MODIFY | Extend `actionSanitizer` to mask SSN in `draftLoaded` action |
| `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts` | MODIFY | Add tests for `draftLoaded` action sanitization |
| `apps/borrower-portal/src/app/claim/services/claim-draft.service.ts` | MODIFY | Use `inject(HttpClient)` for consistency with rest of codebase |

---

### Task 1: Revert Mock Interceptor to In-Memory Map (CRITICAL #1)

**Problem:** The unstaged change swapped the mock interceptor from an in-memory `Map` to `sessionStorage`. This persists sanitized draft (names, phone, email, medical info) as **plaintext JSON** at `bp_mock_api_draft`, violating the spec's "no unencrypted sessionStorage" guarantee. The in-memory `Map` keeps the mock aligned with the security model — the crypto fallback path becomes the real cross-refresh store, which is what the spec intended.

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.ts`
- Modify: `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts`

- [x] **Step 1: Revert the interceptor to the in-memory Map implementation**

Replace the entire contents of `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.ts` with:

```typescript
import {
  HttpInterceptorFn,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';

/**
 * In-memory store simulating a real backend for the draft API.
 *
 * SECURITY: We intentionally do NOT use sessionStorage here. The spec
 * forbids any unencrypted persistence of draft PII. The crypto fallback
 * path (CryptoStorageService) is the only authorized cross-refresh store
 * and it uses AES-GCM. This mock only lives for the lifetime of the tab.
 */
const draftStore = new Map<string, DisabilityClaimDraft>();
const MOCK_USER_ID = 'mock-user-001';

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/claims/draft') {
    if (req.method === 'PATCH') {
      draftStore.set(MOCK_USER_ID, req.body as DisabilityClaimDraft);
      return of(
        new HttpResponse({ status: 204, statusText: 'No Content' }),
      );
    }

    if (req.method === 'GET') {
      const stored = draftStore.get(MOCK_USER_ID);
      if (stored) {
        return of(new HttpResponse({ status: 200, body: stored }));
      }
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            statusText: 'Not Found',
            url: req.url,
          }),
      );
    }
  }

  return next(req);
};
```

- [x] **Step 2: Update the interceptor tests**

Replace the contents of `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts` with the version that does NOT touch `sessionStorage` and resets the in-memory map between tests:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpRequest, HttpHandlerFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { mockApiInterceptor } from './mock-api.interceptor';
import { initialClaimState } from '../+state/claim.models';

const draft = {
  ...initialClaimState,
  borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
} as any;

function makeNext(): HttpHandlerFn {
  return vi.fn((_req: HttpRequest<any>) => of({} as any));
}

describe('mockApiInterceptor', () => {
  let mockNext: HttpHandlerFn;

  beforeEach(() => {
    // Reset the in-memory store by issuing a PATCH of the initial state
    // for the GET-404 test, the first test runs before any PATCH.
    mockNext = makeNext();
  });

  afterEach(() => {
    // Drain the map by PATCHing initial state then letting the next test's
    // order take over. This is simpler than exporting a reset function.
    const resetReq = new HttpRequest('PATCH', '/api/claims/draft', null as any);
    mockApiInterceptor(resetReq, makeNext()).subscribe();
  });

  it('GET /api/claims/draft throws 404 when no draft stored', () => {
    const req = new HttpRequest('GET', '/api/claims/draft');
    let errorStatus: number | null = null;
    mockApiInterceptor(req, mockNext).subscribe({
      error: (err) => {
        errorStatus = err.status;
      },
    });
    expect(errorStatus).toBe(404);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('PATCH /api/claims/draft stores draft and returns 204', () => {
    const req = new HttpRequest('PATCH', '/api/claims/draft', draft);
    let status: number | null = null;
    mockApiInterceptor(req, mockNext).subscribe((event) => {
      if (event instanceof HttpResponse) status = event.status;
    });
    expect(status).toBe(204);
  });

  it('GET /api/claims/draft returns saved draft after PATCH', () => {
    const patchReq = new HttpRequest('PATCH', '/api/claims/draft', draft);
    mockApiInterceptor(patchReq, mockNext).subscribe();

    const getReq = new HttpRequest('GET', '/api/claims/draft');
    let body: any = null;
    mockApiInterceptor(getReq, mockNext).subscribe((event) => {
      if (event instanceof HttpResponse) body = event.body;
    });
    expect(body).toEqual(draft);
  });

  it('PATCH overwrites previous draft', () => {
    const draftB = { ...draft, currentStep: 3 };
    mockApiInterceptor(
      new HttpRequest('PATCH', '/api/claims/draft', draft),
      mockNext,
    ).subscribe();
    mockApiInterceptor(
      new HttpRequest('PATCH', '/api/claims/draft', draftB),
      mockNext,
    ).subscribe();

    let body: any = null;
    mockApiInterceptor(
      new HttpRequest('GET', '/api/claims/draft'),
      mockNext,
    ).subscribe((event) => {
      if (event instanceof HttpResponse) body = event.body;
    });
    expect(body.currentStep).toBe(3);
  });

  it('non-matching URLs pass through', () => {
    const req = new HttpRequest('GET', '/api/other');
    mockApiInterceptor(req, mockNext);
    expect(mockNext).toHaveBeenCalledWith(req);
  });
});
```

- [x] **Step 3: Confirm no `sessionStorage.getItem('bp_mock_api_draft')` reference remains**

```bash
cd "/home/matt/War Room/War Room/01_Projects/Portal_POC/tai-portal/.worktrees/frontend-workspace"
```

```bash
grep -rn "bp_mock_api_draft" apps/ libs/ || echo "OK: no references"
```

Expected: `OK: no references`

- [x] **Step 4: Run interceptor tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts
```

Expected: 5 tests PASS

- [x] **Step 5: Commit**

```bash
git add apps/borrower-portal/src/app/claim/services/mock-api.interceptor.ts apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts
git commit -m "fix(security): revert mock interceptor to in-memory Map to prevent plaintext PII in sessionStorage"
```

---

### Task 2: Fix `autoSaveDraft` Crypto Fallback Action (CRITICAL #2) — Test First

**Problem:** When the API save fails and the crypto fallback succeeds, the effect dispatches `ClaimActions.draftSaved()`. This makes API failures invisible to the UI and collapses two semantically different outcomes into one. The spec requires `draftSaveError({ message: 'Draft saved locally (encrypted).' })` on the fallback-success path so downstream components can show a "you're offline" indicator.

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts`
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`

- [x] **Step 1: Add a failing test for the new fallback behavior (RED)**

Open `apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts` and add this test to the `autoSaveDraft` describe block (placement: after the existing "falls back to encrypted sessionStorage on API failure" test):

```typescript
  it('dispatches draftSaveError with "saved locally" message when API fails but crypto fallback succeeds', async () => {
    vi.useFakeTimers();
    draftService.saveDraft = vi.fn().mockReturnValue(throwError(() => new Error('API down')));
    cryptoStorage.save = vi.fn().mockResolvedValue(undefined);

    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));

    const results: Action[] = [];
    TestBed.runInInjectionContext(() => {
      const effect = autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger);
      effect.subscribe((a) => results.push(a));
    });

    vi.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    expect(cryptoStorage.save).toHaveBeenCalled();
    expect(results[0].type).toBe('[Claim] Draft Save Error');
    expect((results[0] as any).message).toContain('locally');
    vi.useRealTimers();
  });
```

Make sure `throwError` is imported at the top of the file alongside `of`:

```typescript
import { Observable, of, throwError } from 'rxjs';
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts -t "saved locally"
```

Expected: FAIL — current code dispatches `Draft Saved` (not `Draft Save Error`).

- [x] **Step 3: Change the fallback mapping in the effect (GREEN)**

In `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`, find the `autoSaveDraft` effect. Inside the outer `catchError((apiError) => { ... })`, change the inner `from(cryptoStorage.save(sanitized))` pipeline so the success path dispatches `draftSaveError` with the user-facing locality message:

```typescript
            // Attempt encrypted sessionStorage fallback
            return from(cryptoStorage.save(sanitized)).pipe(
              tap(() => securityLogger.log('DRAFT_ENCRYPTED', 'Fallback to sessionStorage succeeded')),
              map(() =>
                ClaimActions.draftSaveError({
                  message: 'Draft saved locally (encrypted). Reconnect to sync.',
                }),
              ),
              catchError((cryptoError) => {
                securityLogger.log('ENCRYPT_FAIL', `Crypto fallback failed: ${cryptoError.message}`);
                return of(ClaimActions.draftSaveError({
                  message: 'Could not save draft. Please check your connection.',
                }));
              }),
            );
```

Note: Task 2 keeps the old `ENCRYPT_FAIL` spelling. Task 3 renames the type, and Task 4 deletes the unnecessary API-error log line. By the end of Task 4 only `ENCRYPT_FAILED` remains.

- [x] **Step 4: Run only the new test**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts -t "saved locally"
```

Expected: PASS (TypeScript may flag `ENCRYPT_FAILED` as not assignable — this is expected and resolved in Task 3).

- [x] **Step 5: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/claim.effects.ts apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts
git commit -m "fix: autoSaveDraft crypto fallback dispatches draftSaveError with locality message"
```

---

### Task 3: Rename Security Event Types to Match Spec (IMPORTANT #3)

**Problem:** `SecurityLoggerService` defines `ENCRYPT_FAIL` / `DECRYPT_FAIL` but the spec and audit log consumers expect `ENCRYPT_FAILED` / `DECRYPT_FAILED`. This is a minor naming drift that breaks any external filter on the event type string.

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/services/security-logger.service.ts`
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`

- [x] **Step 1: Rename the type members in the service**

In `apps/borrower-portal/src/app/claim/services/security-logger.service.ts`, change the union to match the spec:

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
```

- [x] **Step 2: Update the effects.ts call sites in lockstep**

In `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`, rename every `'ENCRYPT_FAIL'` string to `'ENCRYPT_FAILED'`. There are two call sites inside `autoSaveDraft`:

1. The one on API error: `securityLogger.log('ENCRYPT_FAIL', 'API error: ...')` → rename to `'ENCRYPT_FAILED'` for now. (Task 4 will delete this line outright; we rename it here so the file type-checks between Tasks 3 and 4.)
2. The one inside the inner `catchError` (added in Task 2): `securityLogger.log('ENCRYPT_FAIL', 'Crypto fallback failed: ...')` → rename to `'ENCRYPT_FAILED'`.

Verify no old spellings remain in source:

```bash
grep -rn "'ENCRYPT_FAIL'\|'DECRYPT_FAIL'" apps/ libs/ || echo "OK: no old spellings"
```

Expected: `OK: no old spellings`

- [x] **Step 3: Type-check the app**

```bash
npx tsc --project apps/borrower-portal/tsconfig.app.json --noEmit
```

Expected: no errors.

- [x] **Step 4: Run security-logger and effect tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/security-logger.service.spec.ts apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add apps/borrower-portal/src/app/claim/services/security-logger.service.ts apps/borrower-portal/src/app/claim/+state/claim.effects.ts
git commit -m "fix: rename ENCRYPT_FAIL/DECRYPT_FAIL to ENCRYPT_FAILED/DECRYPT_FAILED to match spec"
```

---

### Task 4: Stop Logging `ENCRYPT_FAILED` on API Error (IMPORTANT #7)

**Problem:** In `autoSaveDraft`, when the API call fails, the effect logs `ENCRYPT_FAIL` ("API error: ...") before even attempting the crypto fallback. API failure is not an encryption failure — this corrupts the audit log. The correct behavior: log nothing for the API-failure transition itself; let the fallback path log its own `DRAFT_ENCRYPTED` (success) or `ENCRYPT_FAILED` (real encryption failure).

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts`
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`

- [x] **Step 1: Add a failing test that asserts `ENCRYPT_FAILED` is NOT logged on API error alone (RED)**

Add to the `autoSaveDraft` describe block in `apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts`:

```typescript
  it('does not log ENCRYPT_FAILED when only the API fails', async () => {
    vi.useFakeTimers();
    draftService.saveDraft = vi.fn().mockReturnValue(throwError(() => new Error('API down')));
    cryptoStorage.save = vi.fn().mockResolvedValue(undefined);

    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));

    TestBed.runInInjectionContext(() => {
      const effect = autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger);
      effect.subscribe();
    });

    vi.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    const loggedTypes = (securityLogger.log as any).mock.calls.map((c: any[]) => c[0]);
    expect(loggedTypes).not.toContain('ENCRYPT_FAILED');
    expect(loggedTypes).toContain('DRAFT_ENCRYPTED'); // fallback success is logged
    vi.useRealTimers();
  });
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts -t "does not log ENCRYPT_FAILED when only the API fails"
```

Expected: FAIL — `loggedTypes` currently contains `'ENCRYPT_FAILED'` (or `ENCRYPT_FAIL`) from the "API error:" log.

- [x] **Step 3: Remove the spurious log call (GREEN)**

In `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`, inside the `catchError((apiError) => { ... })` block of the `autoSaveDraft` effect, **delete** the line:

```typescript
securityLogger.log('ENCRYPT_FAILED', `API error: ${apiError.message}`);
```

This is the immediate-on-API-error log (left over from Task 3's rename). The inner-catchError `ENCRYPT_FAILED` log (for genuine crypto failure) stays. The block should now look like:

```typescript
          catchError((apiError) => {
            // SECURITY: Fallback to encrypted sessionStorage on API failure.
            // We do NOT log an encryption failure here — the failure is the
            // API, not the crypto layer. The fallback pipeline will log
            // DRAFT_ENCRYPTED on success or ENCRYPT_FAILED on real crypto error.
            void apiError;
            return from(cryptoStorage.save(sanitized)).pipe(
              tap(() => securityLogger.log('DRAFT_ENCRYPTED', 'Fallback to sessionStorage succeeded')),
              map(() =>
                ClaimActions.draftSaveError({
                  message: 'Draft saved locally (encrypted). Reconnect to sync.',
                }),
              ),
              catchError((cryptoError) => {
                securityLogger.log('ENCRYPT_FAILED', `Crypto fallback failed: ${cryptoError.message}`);
                return of(ClaimActions.draftSaveError({
                  message: 'Could not save draft. Please check your connection.',
                }));
              }),
            );
          }),
```

- [x] **Step 4: Run the effect tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts
```

Expected: all `autoSaveDraft` tests PASS (including the two new ones from Tasks 2 and 4).

- [x] **Step 5: Verify old spellings are gone**

```bash
grep -rn "ENCRYPT_FAIL\|DECRYPT_FAIL" apps/ libs/ | grep -v "ENCRYPT_FAILED\|DECRYPT_FAILED" || echo "OK: no old spellings"
```

Expected: `OK: no old spellings`

- [x] **Step 6: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/claim.effects.ts apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts
git commit -m "fix: do not log ENCRYPT_FAILED on API-only failures; tighten audit semantics"
```

---

### Task 5: Add ARIA Attributes to `SecurityAlertComponent` (IMPORTANT #4) — Test First

**Problem:** The warning banner appears dynamically (e.g., after draft hydration prompts SSN re-entry). Screen readers need `role="alert"` and `aria-live="polite"` to announce it. The dismiss button needs `aria-label="Dismiss alert"`.

**Files:**
- Modify: `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts`
- Modify: `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.ts`

- [x] **Step 1: Add failing ARIA tests (RED)**

Append these tests to the existing `describe('SecurityAlertComponent', ...)` in `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts`:

```typescript
  it('has role="alert" and aria-live="polite" when visible', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Re-enter SSN');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[data-testid="security-alert"]');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
  });

  it('dismiss button has aria-label', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Dismiss me');
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[data-testid="security-alert-dismiss"]');
    expect(btn.getAttribute('aria-label')).toBe('Dismiss alert');
  });
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts
```

Expected: the two new tests FAIL (no `role` or `aria-live` attribute).

- [x] **Step 3: Add the ARIA attributes to the template (GREEN)**

In `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.ts`, update the template to add `role`, `aria-live`, and the dismiss `aria-label`:

```typescript
  template: `
    @if (visible()) {
      <div
        class="security-alert"
        [class.security-alert--warning]="severity() === 'warning'"
        [class.security-alert--info]="severity() === 'info'"
        role="alert"
        aria-live="polite"
        data-testid="security-alert"
      >
        <span class="security-alert__icon" aria-hidden="true">&#x1f512;</span>
        <span class="security-alert__message">{{ message() }}</span>
        @if (dismissible()) {
          <button
            type="button"
            class="security-alert__dismiss"
            aria-label="Dismiss alert"
            (click)="dismissed.emit()"
            data-testid="security-alert-dismiss"
          >
            &times;
          </button>
        }
      </div>
    }
  `,
```

- [x] **Step 4: Run all SecurityAlertComponent tests**

```bash
npx vitest run libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts
```

Expected: all tests PASS (existing 4 + the 2 new ones).

- [x] **Step 5: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/security-alert/
git commit -m "feat(a11y): add role=alert, aria-live, and dismiss aria-label to SecurityAlertComponent"
```

---

### Task 6: Add ARIA Attributes to `CryptoUnavailableComponent` (IMPORTANT #4) — Test First

**Problem:** `CryptoUnavailableComponent` is a hard-block screen shown when the browser lacks crypto.subtle. Screen readers need `role="alert"` and `aria-live="assertive"` so users learn their session is blocked.

**Files:**
- Modify: `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts`
- Modify: `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.ts`

- [x] **Step 1: Add failing ARIA test (RED)**

Append this test to `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts`:

```typescript
  it('has role="alert" and aria-live="assertive"', () => {
    fixture = TestBed.createComponent(CryptoUnavailableComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="crypto-unavailable"]');
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts
```

Expected: new test FAILS.

- [x] **Step 3: Add the ARIA attributes to the template (GREEN)**

In `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.ts`, update the template:

```typescript
  template: `
    <div
      class="crypto-unavailable"
      role="alert"
      aria-live="assertive"
      data-testid="crypto-unavailable"
    >
      <h2>Secure Connection Required</h2>
      <p>{{ message() }}</p>
      <p>Please ensure you are accessing this application over HTTPS.</p>
    </div>
  `,
```

- [x] **Step 4: Run all tests for this component**

```bash
npx vitest run libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/crypto-unavailable/
git commit -m "feat(a11y): add role=alert and aria-live=assertive to CryptoUnavailableComponent"
```

---

### Task 7: Log `CRYPTO_UNAVAILABLE` When Gate Fails (IMPORTANT #6) — Test First

**Problem:** When `CryptoStorageService.isAvailable()` returns false, the app shows the block screen but does not emit a security audit event. The spec requires a `CRYPTO_UNAVAILABLE` log entry so this state is observable from the audit trail.

**Files:**
- Create: `apps/borrower-portal/src/app/app.spec.ts`
- Modify: `apps/borrower-portal/src/app/app.ts`

- [x] **Step 1: Write failing test (RED)**

Create `apps/borrower-portal/src/app/app.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from './app';
import { CryptoStorageService } from './claim/services/crypto-storage.service';
import { SecurityLoggerService } from './claim/services/security-logger.service';

describe('App — crypto availability gate', () => {
  let loggerSpy: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    loggerSpy = { log: vi.fn() };
  });

  function configureWithAvailability(isAvailable: boolean) {
    vi.spyOn(CryptoStorageService, 'isAvailable').mockReturnValue(isAvailable);
    TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [
        { provide: SecurityLoggerService, useValue: loggerSpy },
      ],
    });
  }

  it('logs CRYPTO_UNAVAILABLE when crypto.subtle is missing', () => {
    configureWithAvailability(false);
    TestBed.createComponent(App);
    expect(loggerSpy.log).toHaveBeenCalledWith(
      'CRYPTO_UNAVAILABLE',
      expect.any(String),
    );
  });

  it('does not log CRYPTO_UNAVAILABLE when crypto.subtle is present', () => {
    configureWithAvailability(true);
    TestBed.createComponent(App);
    const types = loggerSpy.log.mock.calls.map((c) => c[0]);
    expect(types).not.toContain('CRYPTO_UNAVAILABLE');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/app.spec.ts
```

Expected: FAIL — the app does not call `SecurityLoggerService.log` at all yet.

- [x] **Step 3: Wire the logger into `App` (GREEN)**

Replace the contents of `apps/borrower-portal/src/app/app.ts` with:

```typescript
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CryptoStorageService } from './claim/services/crypto-storage.service';
import { SecurityLoggerService } from './claim/services/security-logger.service';
import { CryptoUnavailableComponent } from '@tai/ui-design-system';

@Component({
  imports: [RouterModule, CryptoUnavailableComponent],
  selector: 'bp-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly logger = inject(SecurityLoggerService);

  protected title = 'borrower-portal';
  protected cryptoAvailable = signal(CryptoStorageService.isAvailable());

  constructor() {
    if (!this.cryptoAvailable()) {
      this.logger.log(
        'CRYPTO_UNAVAILABLE',
        'crypto.subtle unavailable — application gated behind CryptoUnavailableComponent',
      );
    }
  }
}
```

- [x] **Step 4: Run the app tests**

```bash
npx vitest run apps/borrower-portal/src/app/app.spec.ts
```

Expected: both tests PASS.

- [x] **Step 5: Commit**

```bash
git add apps/borrower-portal/src/app/app.ts apps/borrower-portal/src/app/app.spec.ts
git commit -m "feat(security): log CRYPTO_UNAVAILABLE audit event when crypto.subtle missing"
```

---

### Task 8: `BorrowerInfoComponent` — Hydrate Once, Not on Every Emission (IMPORTANT #8) — Test First

**Problem:** `ngOnInit` subscribes to `selectBorrower` with `takeUntil(destroy$)`, so every future state change re-patches the form. If the user types then the effect dispatches `saveBorrowerInfo`, the subscription fires again and overwrites what the user just typed. Hydration should happen exactly once.

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts`
- Modify: `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.ts`

- [x] **Step 1: Add failing regression test (RED)**

Append to `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts`:

```typescript
  it('does not overwrite user-typed firstName when store emits a new borrower value', () => {
    createComponent({
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    });

    // User starts editing
    fixture.componentInstance.form.patchValue({ firstName: 'Janet' });

    // Store emits a new borrower slice (e.g. an auto-save round-trip)
    store.overrideSelector(selectBorrower, {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    });
    store.refreshState();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.get('firstName')?.value).toBe('Janet');
  });
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts -t "does not overwrite user-typed"
```

Expected: FAIL — the current subscription patches the form back to `Jane` on every store emission.

- [x] **Step 3: Replace the subscription with a one-shot `first()` call (GREEN)**

In `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.ts`:

1. Change the rxjs import to bring in `first` instead of `takeUntil`:

```typescript
import { first } from 'rxjs/operators';
```

And remove the `Subject, takeUntil` import plus the `destroy$` field. The class body becomes:

```typescript
export class BorrowerInfoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);

  form!: FormGroup;
  ssnReEntryRequired = false;

  ngOnInit(): void {
    this.initForm();

    // Hydrate once from the store. Subsequent state changes must not
    // overwrite values the user is actively typing.
    this.store
      .select(selectBorrower)
      .pipe(first())
      .subscribe((borrower) => {
        if (borrower.firstName || borrower.lastName) {
          this.form.patchValue(borrower, { emitEvent: false });
          this.ssnReEntryRequired =
            borrower.firstName.length > 0 && borrower.ssnLastFour.length === 0;
        }
      });
  }
```

Remove `OnDestroy` from the `implements` clause and delete the now-unused `ngOnDestroy` method and `destroy$` field. Also remove `OnDestroy` from the `@angular/core` import list.

- [x] **Step 4: Run the component tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts
```

Expected: all tests PASS (the new test plus the existing 4).

- [x] **Step 5: Commit**

```bash
git add apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.ts apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts
git commit -m "fix: BorrowerInfoComponent hydrates form once; later store emissions no longer overwrite user input"
```

---

### Task 9: Remove Stale `meta-reducer` / `localStorage` Comments (IMPORTANT #5)

**Problem:** Several files still reference the deleted `localStorageMetaReducer`. Future readers will be misled.

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.reducer.ts`
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.models.ts`
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`
- Modify: `apps/borrower-portal/src/app/claim/+state/claim-step.guard.ts`
- Modify: `apps/borrower-portal/src/app/app.routes.ts`

- [x] **Step 1: Fix `claim.reducer.ts` — replace the stale `resetClaim` comment**

In `apps/borrower-portal/src/app/claim/+state/claim.reducer.ts`, find the comment block above `on(ClaimActions.resetClaim, ...)` (around lines 186-190). Replace it with:

```typescript
    /**
     * Nuclear option: returns to the initial blank state.
     * The `clearDraftOnReset` effect picks up this action and clears
     * both the server-side draft (via API PATCH with initial state)
     * and the encrypted sessionStorage fallback.
     */
```

- [x] **Step 2: Fix `claim.models.ts` — rewrite the file-level doc comment**

In `apps/borrower-portal/src/app/claim/+state/claim.models.ts`, replace the final sentence of the file-level doc comment (around lines 19-21) to remove the "via localStorage meta-reducer" phrase. The sentence currently reads:

```
 * Because this state must survive route navigation (the user jumps between
 * 4 different Angular routes), survive page refresh (via localStorage
 * meta-reducer), and be composable across steps ...
```

Replace with:

```
 * Because this state must survive route navigation (the user jumps between
 * 4 different Angular routes), survive page refresh (via the encrypted
 * sessionStorage fallback managed by the autoSaveDraft/loadDraft effects),
 * and be composable across steps ...
```

Also update the comment above `ClaimDocuments` (line ~99):

```
 *   This keeps the NgRx state small enough for localStorage (~1KB).
```

Change to:

```
 *   This keeps the NgRx state small enough for the encrypted
 *   sessionStorage fallback (~1KB).
```

And the comment above `initialClaimState` (line ~121-123):

```
 * Initial state — every field starts empty/default.
 * The localStorage meta-reducer will overwrite this with saved data
 * on app startup if a previous draft exists.
```

Change to:

```
 * Initial state — every field starts empty/default.
 * The `loadDraft` effect will overwrite this with saved data on app
 * startup if a previous draft exists (API-first, crypto fallback).
```

- [x] **Step 3: Fix `claim.effects.ts` header comment**

At the top of `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`, line 6 reads:

```
 * Effects listen for specific actions and perform side-effects: API calls,
 * localStorage writes, navigation, logging. They are the ONLY place where
```

Replace with:

```
 * Effects listen for specific actions and perform side-effects: API calls,
 * encrypted sessionStorage writes, navigation, logging. They are the ONLY
 * place where
```

- [x] **Step 4: Fix `claim-step.guard.ts` edge-case comment**

In `apps/borrower-portal/src/app/claim/+state/claim-step.guard.ts`, lines 19-22 contain:

```
 * (step 3), the guard checks steps 1 and 2. If they're invalid, the guard blocks
 * and redirects to step 1. The localStorage meta-reducer ensures the store has
 * the user's previous data even on a fresh page load.
```

Replace with:

```
 * (step 3), the guard checks steps 1 and 2. If they're invalid, the guard blocks
 * and redirects to step 1. The `loadDraft` effect (dispatched from
 * ROOT_EFFECTS_INIT) ensures the store has the user's previous data even on a
 * fresh page load.
```

- [x] **Step 5: Fix `app.routes.ts` comment**

In `apps/borrower-portal/src/app/app.routes.ts`, lines 7-10:

```
 * The claim state is eagerly loaded because NgRx store
 * initialization happens in app.config.ts for localStorage hydration.
```

Replace with:

```
 * The claim state is eagerly loaded because NgRx store initialization
 * runs the `loadDraft` effect on ROOT_EFFECTS_INIT (API-first, encrypted
 * sessionStorage fallback).
```

- [x] **Step 6: Verify no more misleading references remain in source**

```bash
grep -rn "meta-reducer\|localStorage meta-reducer\|localStorage hydration" apps/borrower-portal/src/app/ || echo "OK: source is clean"
```

Expected: `OK: source is clean` (test files that simulate localStorage calls are fine — the security-negative tests intentionally verify localStorage is never touched).

- [x] **Step 7: Run the type-checker for a quick sanity pass**

```bash
npx tsc --project apps/borrower-portal/tsconfig.app.json --noEmit
```

Expected: no errors.

- [x] **Step 8: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/claim.reducer.ts apps/borrower-portal/src/app/claim/+state/claim.models.ts apps/borrower-portal/src/app/claim/+state/claim.effects.ts apps/borrower-portal/src/app/claim/+state/claim-step.guard.ts apps/borrower-portal/src/app/app.routes.ts
git commit -m "docs: remove stale localStorage meta-reducer references across the claim feature"
```

---

### Task 10: Extend `actionSanitizer` to Mask SSN in `draftLoaded` (SUGGESTION #9) — Test First

**Problem:** `actionSanitizer` only masks SSN in `[Claim] Save Borrower Info`. If a draft with SSN ever flows through `draftLoaded`, the action payload would display unmasked in DevTools. Defense-in-depth says mask it there too.

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts`
- Modify: `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.ts`

- [x] **Step 1: Add failing test (RED)**

Append to `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts` inside the `describe('actionSanitizer', ...)` block:

```typescript
    it('masks SSN in draftLoaded action', () => {
      const action = {
        type: '[Claim] Draft Loaded',
        draft: {
          borrower: { firstName: 'Jane', ssnLastFour: '1234' },
          currentStep: 2,
        },
      };
      const result = actionSanitizer(action);
      expect(result.draft.borrower.ssnLastFour).toBe('****');
      // Non-SSN fields untouched
      expect(result.draft.borrower.firstName).toBe('Jane');
      expect(result.draft.currentStep).toBe(2);
    });

    it('handles draftLoaded with no borrower gracefully', () => {
      const action = { type: '[Claim] Draft Loaded', draft: {} };
      expect(() => actionSanitizer(action)).not.toThrow();
    });
```

- [x] **Step 2: Run the tests to verify failure**

```bash
npx vitest run apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts
```

Expected: the two new tests FAIL.

- [x] **Step 3: Update `actionSanitizer` (GREEN)**

Replace the `actionSanitizer` in `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.ts` with:

```typescript
export function actionSanitizer(action: any): any {
  if (!action) return action;

  if (action.type === '[Claim] Save Borrower Info' && action.borrower) {
    return {
      ...action,
      borrower: { ...action.borrower, ssnLastFour: '****' },
    };
  }

  if (action.type === '[Claim] Draft Loaded' && action.draft?.borrower) {
    return {
      ...action,
      draft: {
        ...action.draft,
        borrower: { ...action.draft.borrower, ssnLastFour: '****' },
      },
    };
  }

  return action;
}
```

- [x] **Step 4: Run the tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.ts apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts
git commit -m "feat(security): mask SSN in draftLoaded action for DevTools defense-in-depth"
```

---

### Task 11: Align `ClaimDraftService` to Use `inject()` (SUGGESTION #10)

**Problem:** Only cosmetic — the whole codebase uses `inject()`, but this one service uses constructor injection. Aligning makes future DI changes (e.g. optional tokens) uniform.

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/services/claim-draft.service.ts`

- [x] **Step 1: Switch to `inject()`**

Replace the contents of `apps/borrower-portal/src/app/claim/services/claim-draft.service.ts` with:

```typescript
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';

@Injectable({ providedIn: 'root' })
export class ClaimDraftService {
  private readonly http = inject(HttpClient);

  saveDraft(draft: DisabilityClaimDraft): Observable<void> {
    return this.http.patch<void>('/api/claims/draft', draft);
  }

  loadDraft(): Observable<DisabilityClaimDraft> {
    return this.http.get<DisabilityClaimDraft>('/api/claims/draft');
  }
}
```

- [x] **Step 2: Run the draft-service tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/claim-draft.service.spec.ts
```

Expected: all tests PASS (no behavior change).

- [x] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/services/claim-draft.service.ts
git commit -m "refactor: use inject() in ClaimDraftService for DI consistency"
```

---

### Task 12: Full Test Suite + Smoke Check

**Purpose:** Confirm every fix composes with the others and nothing regressed.

- [x] **Step 1: Run the complete Vitest suite**

```bash
npx vitest run
```

Expected: all tests PASS. Note the counts for each suite; they should match or exceed the pre-fix totals (the plan adds 6 new tests: 1 in Task 2, 1 in Task 4, 2 in Task 5, 1 in Task 6, 2 in Task 7, 1 in Task 8, 2 in Task 10 — tallied, that's 10 new tests; original suites contribute their existing counts).

- [x] **Step 2: Type-check both Angular projects**

```bash
npx tsc --project apps/borrower-portal/tsconfig.app.json --noEmit
npx tsc --project libs/ui/design-system/tsconfig.lib.json --noEmit
```

Expected: no errors in either.

- [x] **Step 3: Grep one last time for the old event type spellings and for plaintext PII keys**

```bash
grep -rn "ENCRYPT_FAIL\|DECRYPT_FAIL" apps/ libs/ | grep -v "ENCRYPT_FAILED\|DECRYPT_FAILED" || echo "OK: no old spellings"
grep -rn "bp_mock_api_draft" apps/ libs/ || echo "OK: no plaintext mock key"
grep -rn "meta-reducer\|localStorage meta-reducer" apps/borrower-portal/src/app/ || echo "OK: source comments clean"
```

All three should print their respective `OK` line.

- [x] **Step 4: Smoke test in the browser**

```bash
npx nx serve borrower-portal
```

In the browser:
1. Fill out step 1 (borrower info including SSN), click Next.
2. Observe the console — there should be `[SECURITY] {"type":"PII_STRIPPED",...}` events after ~2s (the debounce).
3. Refresh the page. Step 1 data should rehydrate with first name, last name, phone, email — but the SSN field empty.
4. The `tai-security-alert` banner should appear with the "re-enter your SSN" message.
5. Screen reader (or inspector) should show `role="alert"` and `aria-live="polite"` on the banner.
6. Open DevTools Redux extension (if available). State and actions should show `ssnLastFour: '****'`.
7. Simulate the API failing (open DevTools Network tab → Offline, or block `/api/claims/draft`). Trigger an auto-save by editing a field. Expect an error action with "Draft saved locally (encrypted). Reconnect to sync."

- [x] **Step 5: Commit summary + mark plan complete**

Update `docs/superpowers/plans/2026-04-18-code-review-fixes-plan.md` to mark all tasks complete (check all boxes) and add a completion banner near the top:

```markdown
> **🏁 CODE REVIEW FIXES COMPLETE — 2026-04-18**
```

Then:

```bash
git add docs/superpowers/plans/2026-04-18-code-review-fixes-plan.md
git commit -m "docs: mark code-review-fixes plan complete"
```

---

## Completion Checklist (for reviewers)

| Finding | Severity | Task | Done |
|---|---|---|---|
| Mock interceptor plaintext sessionStorage | Critical | 1 | ☐ |
| `autoSaveDraft` crypto fallback action | Critical | 2 | ☐ |
| `ENCRYPT_FAIL` vs spec `ENCRYPT_FAILED` | Important | 3 | ☐ |
| Spurious `ENCRYPT_FAILED` log on API error | Important | 4 | ☐ |
| Missing ARIA on SecurityAlert | Important | 5 | ☐ |
| Missing ARIA on CryptoUnavailable | Important | 6 | ☐ |
| Missing `CRYPTO_UNAVAILABLE` audit log | Important | 7 | ☐ |
| BorrowerInfo subscription overwrites user input | Important | 8 | ☐ |
| Stale `meta-reducer` / `localStorage` comments | Important | 9 | ☐ |
| `actionSanitizer` does not cover `draftLoaded` | Suggestion | 10 | ☐ |
| `ClaimDraftService` uses constructor injection | Suggestion | 11 | ☐ |
| Full-suite re-verification | — | 12 | ☐ |

**Explicitly deferred (not in this plan):**
- Suggestion #11 (verify exact test count against spec's 85) — counting is audit work, not code; defer to the spec owner.
- Suggestion #13 (richer property-based generators for incident/providers/documents in `CryptoStorageService` round-trip) — optional quality improvement, not a defect.
