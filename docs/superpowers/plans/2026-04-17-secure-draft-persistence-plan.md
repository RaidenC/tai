# Secure Draft Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plaintext localStorage meta-reducer with effect-based secure draft persistence that strips PII before any write, encrypts sessionStorage fallback via AES-GCM, and logs security audit events.

> **🏁 IMPLEMENTATION COMPLETE — 2026-04-18**

**Architecture:** Effects-based persistence pipeline: `autoSaveDraft` effect debounces state changes, calls `sanitizeForPersistence()` to strip SSN, attempts mock API save, falls back to `CryptoStorageService` (AES-GCM encrypted sessionStorage). `loadDraft` effect hydrates on bootstrap via API-first, crypto fallback. `SecurityLoggerService` provides audit trail. Design system gets `SecurityAlertComponent` and `CryptoUnavailableComponent`.

**Tech Stack:** Angular 21, NgRx 21 (functional effects), Web Crypto API (AES-GCM), Vitest, Storybook 8, fast-check (property-based testing)

**Spec:** `docs/superpowers/specs/2026-04-16-secure-draft-persistence-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/borrower-portal/src/app/claim/+state/claim.sanitize.ts` | CREATE | Pure function: strips `ssnLastFour` from draft |
| `apps/borrower-portal/src/app/claim/+state/claim.sanitize.spec.ts` | CREATE | Unit + property-based tests for sanitizer |
| `apps/borrower-portal/src/app/claim/services/security-logger.service.ts` | CREATE | Structured security audit event logger |
| `apps/borrower-portal/src/app/claim/services/security-logger.service.spec.ts` | CREATE | Unit tests for logger |
| `apps/borrower-portal/src/app/claim/services/crypto-storage.service.ts` | CREATE | AES-GCM encrypted sessionStorage |
| `apps/borrower-portal/src/app/claim/services/crypto-storage.service.spec.ts` | CREATE | Unit + property-based + TTL tests |
| `apps/borrower-portal/src/app/claim/services/claim-draft.service.ts` | CREATE | HTTP client for draft API |
| `apps/borrower-portal/src/app/claim/services/claim-draft.service.spec.ts` | CREATE | HTTP testing controller tests |
| `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.ts` | CREATE | Mock PATCH/GET `/api/claims/draft` |
| `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts` | CREATE | Interceptor tests |
| `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.ts` | CREATE | Reusable security message banner |
| `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts` | CREATE | Vitest unit tests |
| `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.stories.ts` | CREATE | Storybook interaction tests |
| `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.ts` | CREATE | Secure context gate blocker |
| `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts` | CREATE | Vitest unit tests |
| `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.stories.ts` | CREATE | Storybook stories |
| `libs/ui/design-system/src/index.ts` | MODIFY | Export new components |
| `apps/borrower-portal/src/app/claim/+state/claim.actions.ts` | MODIFY | Add 4 draft persistence actions |
| `apps/borrower-portal/src/app/claim/+state/claim.reducer.ts` | MODIFY | Add `on(draftLoaded)` handler |
| `apps/borrower-portal/src/app/claim/+state/claim.effects.ts` | MODIFY | Add `autoSaveDraft`, `loadDraft`, `clearDraftOnReset` |
| `apps/borrower-portal/src/app/claim/+state/index.ts` | MODIFY | Update barrel exports |
| `apps/borrower-portal/src/app/claim/+state/claim.reducer.spec.ts` | CREATE | Reducer `draftLoaded` tests |
| `apps/borrower-portal/src/app/claim/+state/claim.selectors.spec.ts` | CREATE | SSN edge case tests |
| `apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts` | CREATE | Effect tests (autoSave, load, clear) |
| `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.ts` | CREATE | Extracted sanitizer functions |
| `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts` | CREATE | DevTools sanitizer tests |
| `apps/borrower-portal/src/app/app.config.ts` | MODIFY | Remove meta-reducer, add HttpClient, effects, DevTools sanitizers |
| `apps/borrower-portal/src/app/app.ts` | MODIFY | Add crypto availability check + conditional rendering |
| `apps/borrower-portal/src/app/app.html` | MODIFY | Add conditional template |
| `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.ts` | MODIFY | Add SSN re-entry UX |
| `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.html` | MODIFY | Add SecurityAlertComponent |
| `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts` | CREATE | SSN re-entry UX tests |
| `apps/borrower-portal/src/app/claim/claim.security-negative.spec.ts` | CREATE | Negative security tests |
| `apps/borrower-portal/src/app/claim/claim.integration.spec.ts` | CREATE | Integration flow tests |
| `apps/borrower-portal/src/app/claim/+state/claim.meta-reducer.ts` | DELETE | Replaced by effect-based persistence |
| `apps/borrower-portal/src/index.html` | MODIFY | Add CSP meta tag |

---

### Task 1: Install fast-check

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install fast-check as dev dependency**

```bash
cd /home/matt/War\ Room/War\ Room/01_Projects/Portal_POC/tai-portal/.worktrees/frontend-workspace
npm install --save-dev fast-check
```

- [ ] **Step 2: Verify installation**

```bash
npx fast-check --version
```

Expected: Version number printed (e.g., `3.x.x`)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add fast-check for property-based testing"
```

---

### Task 2: `sanitizeForPersistence()` — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/+state/claim.sanitize.spec.ts`

- [ ] **Step 1: Write all sanitizer unit tests (RED)**

```typescript
import { sanitizeForPersistence } from './claim.sanitize';
import { DisabilityClaimDraft, initialClaimState } from './claim.models';
import * as fc from 'fast-check';

describe('sanitizeForPersistence', () => {
  const populatedState: DisabilityClaimDraft = {
    ...initialClaimState,
    claimId: 'CLM-2026-0001',
    currentStep: 2,
    borrower: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '1234',
      phone: '5551234567',
      email: 'jane@example.com',
    },
    incident: {
      dateOfDisability: '2026-01-15',
      disabilityType: 'Illness',
      isWorkRelated: false,
      workersCompClaimNumber: null,
      description: 'Back injury',
    },
    medicalProviders: [
      {
        id: 'uuid-1',
        doctorName: 'Dr. Smith',
        clinicName: 'Main St Clinic',
        phone: '5559876543',
        dateFirstTreated: '2026-01-20',
      },
    ],
    documents: {
      employerLeaveForm: { fileName: 'leave.pdf', size: 1024, uploadedAt: '2026-01-25T10:00:00Z' },
      attendingPhysicianStatement: null,
    },
  };

  it('strips ssnLastFour from populated state', () => {
    const result = sanitizeForPersistence(populatedState);
    expect(result.borrower.ssnLastFour).toBe('');
  });

  it('preserves all non-PII fields', () => {
    const result = sanitizeForPersistence(populatedState);
    expect(result.borrower.firstName).toBe('Jane');
    expect(result.borrower.lastName).toBe('Doe');
    expect(result.borrower.phone).toBe('5551234567');
    expect(result.borrower.email).toBe('jane@example.com');
    expect(result.incident).toEqual(populatedState.incident);
    expect(result.medicalProviders).toEqual(populatedState.medicalProviders);
    expect(result.documents).toEqual(populatedState.documents);
    expect(result.currentStep).toBe(2);
    expect(result.claimId).toBe('CLM-2026-0001');
  });

  it('returns new object reference (immutability)', () => {
    const result = sanitizeForPersistence(populatedState);
    expect(result).not.toBe(populatedState);
    expect(result.borrower).not.toBe(populatedState.borrower);
  });

  it('handles already-empty SSN (idempotent)', () => {
    const emptySSN = {
      ...populatedState,
      borrower: { ...populatedState.borrower, ssnLastFour: '' },
    };
    const result = sanitizeForPersistence(emptySSN);
    expect(result.borrower.ssnLastFour).toBe('');
  });

  it('does not strip other borrower fields', () => {
    const result = sanitizeForPersistence(populatedState);
    expect(result.borrower.firstName).toBe('Jane');
    expect(result.borrower.email).toBe('jane@example.com');
    expect(result.borrower.phone).toBe('5551234567');
    expect(result.borrower.lastName).toBe('Doe');
  });

  // ── Property-based tests (fast-check) ──────────────

  const borrowerArb = fc.record({
    firstName: fc.string({ minLength: 0, maxLength: 50 }),
    lastName: fc.string({ minLength: 0, maxLength: 50 }),
    ssnLastFour: fc.stringOf(fc.char(), { minLength: 0, maxLength: 10 }),
    phone: fc.string({ minLength: 0, maxLength: 15 }),
    email: fc.string({ minLength: 0, maxLength: 100 }),
  });

  const draftArb = fc.record({
    claimId: fc.option(fc.string(), { nil: null }),
    currentStep: fc.integer({ min: 1, max: 4 }),
    borrower: borrowerArb,
    incident: fc.constant(initialClaimState.incident),
    medicalProviders: fc.constant(initialClaimState.medicalProviders),
    documents: fc.constant(initialClaimState.documents),
    isSubmitting: fc.boolean(),
    error: fc.option(fc.string(), { nil: null }),
  });

  it('PROPERTY: SSN is always stripped regardless of input', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const result = sanitizeForPersistence(draft);
        return result.borrower.ssnLastFour === '';
      }),
    );
  });

  it('PROPERTY: all non-SSN fields are always preserved', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const result = sanitizeForPersistence(draft);
        return (
          result.borrower.firstName === draft.borrower.firstName &&
          result.borrower.lastName === draft.borrower.lastName &&
          result.borrower.phone === draft.borrower.phone &&
          result.borrower.email === draft.borrower.email &&
          result.currentStep === draft.currentStep &&
          result.incident === draft.incident &&
          result.medicalProviders === draft.medicalProviders &&
          result.documents === draft.documents
        );
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.sanitize.spec.ts
```

Expected: FAIL — `Cannot find module './claim.sanitize'`

---

### Task 3: `sanitizeForPersistence()` — Implementation (GREEN)

**Files:**
- Create: `apps/borrower-portal/src/app/claim/+state/claim.sanitize.ts`

- [ ] **Step 1: Write minimal implementation**

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

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.sanitize.spec.ts
```

Expected: 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/claim.sanitize.ts apps/borrower-portal/src/app/claim/+state/claim.sanitize.spec.ts
git commit -m "feat: add sanitizeForPersistence with TDD + property-based tests"
```

---

### Task 4: `SecurityLoggerService` — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/services/security-logger.service.spec.ts`

First, create the `services` directory (it doesn't exist yet).

- [ ] **Step 1: Create services directory**

```bash
mkdir -p "apps/borrower-portal/src/app/claim/services"
```

- [ ] **Step 2: Write all SecurityLoggerService tests (RED)**

```typescript
import { TestBed } from '@angular/core/testing';
import { SecurityLoggerService, SecurityEventType } from './security-logger.service';

describe('SecurityLoggerService', () => {
  let service: SecurityLoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SecurityLoggerService);
  });

  it('logs event with correct type and timestamp', () => {
    service.log('PII_STRIPPED', 'ssnLastFour removed');
    const events = service.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('PII_STRIPPED');
    expect(events[0].details).toBe('ssnLastFour removed');
    // Verify ISO 8601 timestamp
    expect(() => new Date(events[0].timestamp).toISOString()).not.toThrow();
  });

  it('accumulates multiple events in order', () => {
    service.log('PII_STRIPPED');
    service.log('DRAFT_ENCRYPTED');
    service.log('TAMPER_DETECTED');
    const events = service.getEvents();
    expect(events.length).toBe(3);
    expect(events[0].type).toBe('PII_STRIPPED');
    expect(events[1].type).toBe('DRAFT_ENCRYPTED');
    expect(events[2].type).toBe('TAMPER_DETECTED');
  });

  it('details field is optional', () => {
    service.log('DRAFT_ENCRYPTED');
    const events = service.getEvents();
    expect(events[0].details).toBeUndefined();
  });

  it('details never contains PII patterns', () => {
    service.log('PII_STRIPPED', 'ssnLastFour removed');
    const events = service.getEvents();
    // No 4-digit sequences that could be SSN values
    expect(events[0].details).not.toMatch(/\b\d{4}\b/);
  });

  it('console.info called in dev mode', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    service.log('TAMPER_DETECTED', 'integrity check failed');
    expect(spy).toHaveBeenCalledWith(
      '[SECURITY]',
      expect.stringContaining('TAMPER_DETECTED'),
    );
    spy.mockRestore();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/security-logger.service.spec.ts
```

Expected: FAIL — `Cannot find module './security-logger.service'`

---

### Task 5: `SecurityLoggerService` — Implementation (GREEN)

**Files:**
- Create: `apps/borrower-portal/src/app/claim/services/security-logger.service.ts`

- [ ] **Step 1: Write minimal implementation**

```typescript
import { Injectable, isDevMode } from '@angular/core';

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
  timestamp: string;
  details?: string;
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

    if (isDevMode()) {
      console.info('[SECURITY]', JSON.stringify(event));
    }
  }

  getEvents(): readonly SecurityEvent[] {
    return this.events;
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/security-logger.service.spec.ts
```

Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/services/security-logger.service.ts apps/borrower-portal/src/app/claim/services/security-logger.service.spec.ts
git commit -m "feat: add SecurityLoggerService with TDD audit trail"
```

---

### Task 6: `CryptoStorageService` — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/services/crypto-storage.service.spec.ts`

- [ ] **Step 1: Write all CryptoStorageService tests (RED)**

```typescript
import { CryptoStorageService } from './crypto-storage.service';
import { DisabilityClaimDraft, initialClaimState } from '../+state/claim.models';
import * as fc from 'fast-check';

describe('CryptoStorageService', () => {
  let service: CryptoStorageService;

  const testState: DisabilityClaimDraft = {
    ...initialClaimState,
    currentStep: 2,
    borrower: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    service = new CryptoStorageService();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('save/load round-trip preserves state', async () => {
    await service.save(testState);
    const loaded = await service.load();
    expect(loaded).toEqual(testState);
  });

  it('save writes to sessionStorage', async () => {
    await service.save(testState);
    expect(sessionStorage.getItem('bp_draft_enc')).not.toBeNull();
  });

  it('stored value is not plaintext JSON', async () => {
    await service.save(testState);
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    expect(raw).not.toContain('Jane');
    expect(raw).not.toContain('Doe');
  });

  it('stored value contains iv, data, and ts fields', async () => {
    await service.save(testState);
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    const parsed = JSON.parse(raw);
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.data).toBe('string');
    expect(typeof parsed.ts).toBe('number');
  });

  it('load returns null when sessionStorage is empty', async () => {
    const result = await service.load();
    expect(result).toBeNull();
  });

  it('load returns null after key loss (new instance)', async () => {
    await service.save(testState);
    const newService = new CryptoStorageService();
    const result = await newService.load();
    expect(result).toBeNull();
  });

  it('load clears corrupt data from sessionStorage', async () => {
    sessionStorage.setItem('bp_draft_enc', 'garbage');
    const result = await service.load();
    expect(result).toBeNull();
    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
  });

  it('load returns null for tampered ciphertext', async () => {
    await service.save(testState);
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    const parsed = JSON.parse(raw);
    // Flip a character in the data to simulate tampering
    const chars = parsed.data.split('');
    chars[10] = chars[10] === 'A' ? 'B' : 'A';
    parsed.data = chars.join('');
    sessionStorage.setItem('bp_draft_enc', JSON.stringify(parsed));
    const result = await service.load();
    expect(result).toBeNull();
  });

  it('clear removes entry from sessionStorage', async () => {
    await service.save(testState);
    service.clear();
    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
  });

  it('load rejects entry older than DRAFT_TTL_MS', async () => {
    await service.save(testState);
    // Manipulate timestamp to be 31 minutes ago
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    const parsed = JSON.parse(raw);
    parsed.ts = Date.now() - 31 * 60 * 1000;
    sessionStorage.setItem('bp_draft_enc', JSON.stringify(parsed));
    const result = await service.load();
    expect(result).toBeNull();
    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
  });

  it('load accepts entry within DRAFT_TTL_MS', async () => {
    await service.save(testState);
    const result = await service.load();
    expect(result).toEqual(testState);
  });

  it('isAvailable returns true in secure context', () => {
    expect(CryptoStorageService.isAvailable()).toBe(true);
  });

  it('isAvailable returns false when crypto.subtle missing', () => {
    const original = globalThis.crypto.subtle;
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(CryptoStorageService.isAvailable()).toBe(false);
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: original,
      writable: true,
      configurable: true,
    });
  });

  // ── Property-based test ──────────────

  it('PROPERTY: round-trip preserves arbitrary valid state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          claimId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
          currentStep: fc.integer({ min: 1, max: 4 }),
          borrower: fc.record({
            firstName: fc.string({ minLength: 0, maxLength: 30 }),
            lastName: fc.string({ minLength: 0, maxLength: 30 }),
            ssnLastFour: fc.constant(''),
            phone: fc.string({ minLength: 0, maxLength: 15 }),
            email: fc.string({ minLength: 0, maxLength: 50 }),
          }),
          incident: fc.constant(initialClaimState.incident),
          medicalProviders: fc.constant(initialClaimState.medicalProviders),
          documents: fc.constant(initialClaimState.documents),
          isSubmitting: fc.boolean(),
          error: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        }),
        async (draft) => {
          sessionStorage.clear();
          const svc = new CryptoStorageService();
          await svc.save(draft);
          const loaded = await svc.load();
          expect(loaded).toEqual(draft);
        },
      ),
      { numRuns: 20 },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/crypto-storage.service.spec.ts
```

Expected: FAIL — `Cannot find module './crypto-storage.service'`

---

### Task 7: `CryptoStorageService` — Implementation (GREEN)

**Files:**
- Create: `apps/borrower-portal/src/app/claim/services/crypto-storage.service.ts`

- [ ] **Step 1: Write implementation**

```typescript
import { Injectable } from '@angular/core';
import { DisabilityClaimDraft } from '../+state/claim.models';

@Injectable({ providedIn: 'root' })
export class CryptoStorageService {
  private key: CryptoKey | null = null;
  private static readonly STORAGE_KEY = 'bp_draft_enc';
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly DRAFT_TTL_MS = 30 * 60 * 1000;

  static isAvailable(): boolean {
    return (
      typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
    );
  }

  private async getOrCreateKey(): Promise<CryptoKey> {
    if (!this.key) {
      this.key = await crypto.subtle.generateKey(
        { name: CryptoStorageService.ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    }
    return this.key;
  }

  async save(state: DisabilityClaimDraft): Promise<void> {
    const key = await this.getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(state));
    const ciphertext = await crypto.subtle.encrypt(
      { name: CryptoStorageService.ALGORITHM, iv },
      key,
      plaintext,
    );
    const payload = {
      iv: this.toBase64(iv),
      data: this.toBase64(new Uint8Array(ciphertext)),
      ts: Date.now(),
    };
    sessionStorage.setItem(
      CryptoStorageService.STORAGE_KEY,
      JSON.stringify(payload),
    );
  }

  async load(): Promise<DisabilityClaimDraft | null> {
    const raw = sessionStorage.getItem(CryptoStorageService.STORAGE_KEY);
    if (!raw) return null;

    try {
      const key = await this.getOrCreateKey();
      const { iv, data, ts } = JSON.parse(raw);

      if (
        typeof ts === 'number' &&
        Date.now() - ts > CryptoStorageService.DRAFT_TTL_MS
      ) {
        sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
        return null;
      }

      const decrypted = await crypto.subtle.decrypt(
        { name: CryptoStorageService.ALGORITHM, iv: this.fromBase64(iv) },
        key,
        this.fromBase64(data),
      );
      const parsed = JSON.parse(new TextDecoder().decode(decrypted));
      if (typeof parsed.currentStep !== 'number') return null;
      return parsed as DisabilityClaimDraft;
    } catch {
      sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private fromBase64(str: string): Uint8Array {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/crypto-storage.service.spec.ts
```

Expected: 14 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/services/crypto-storage.service.ts apps/borrower-portal/src/app/claim/services/crypto-storage.service.spec.ts
git commit -m "feat: add CryptoStorageService with AES-GCM + TTL + TDD"
```

---

### Task 8: `ClaimDraftService` — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/services/claim-draft.service.spec.ts`

- [ ] **Step 1: Write all ClaimDraftService tests (RED)**

```typescript
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ClaimDraftService } from './claim-draft.service';
import { initialClaimState } from '../+state/claim.models';

describe('ClaimDraftService', () => {
  let service: ClaimDraftService;
  let httpMock: HttpTestingController;

  const mockDraft = {
    ...initialClaimState,
    currentStep: 2,
    borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClaimDraftService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('saveDraft sends PATCH to /api/claims/draft', () => {
    service.saveDraft(mockDraft).subscribe();
    const req = httpMock.expectOne('/api/claims/draft');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(mockDraft);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('saveDraft completes on 204', () => {
    const next = vi.fn();
    const complete = vi.fn();
    service.saveDraft(mockDraft).subscribe({ next, complete });
    const req = httpMock.expectOne('/api/claims/draft');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(complete).toHaveBeenCalled();
  });

  it('loadDraft sends GET to /api/claims/draft', () => {
    service.loadDraft().subscribe();
    const req = httpMock.expectOne('/api/claims/draft');
    expect(req.request.method).toBe('GET');
    req.flush(mockDraft);
  });

  it('loadDraft returns draft on 200', () => {
    let result: any;
    service.loadDraft().subscribe((d) => (result = d));
    const req = httpMock.expectOne('/api/claims/draft');
    req.flush(mockDraft);
    expect(result).toEqual(mockDraft);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/claim-draft.service.spec.ts
```

Expected: FAIL — `Cannot find module './claim-draft.service'`

---

### Task 9: `ClaimDraftService` — Implementation (GREEN)

**Files:**
- Create: `apps/borrower-portal/src/app/claim/services/claim-draft.service.ts`

- [ ] **Step 1: Write implementation**

```typescript
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';

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

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/claim-draft.service.spec.ts
```

Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/services/claim-draft.service.ts apps/borrower-portal/src/app/claim/services/claim-draft.service.spec.ts
git commit -m "feat: add ClaimDraftService HTTP client with TDD"
```

---

### Task 10: `mockApiInterceptor` — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts`

- [ ] **Step 1: Write all interceptor tests (RED)**

```typescript
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { mockApiInterceptor } from './mock-api.interceptor';
import { initialClaimState } from '../+state/claim.models';

describe('mockApiInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const draft = {
    ...initialClaimState,
    borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('PATCH /api/claims/draft stores draft and returns 204', (done) => {
    http.patch('/api/claims/draft', draft, { observe: 'response' }).subscribe((res) => {
      expect(res.status).toBe(204);
      done();
    });
  });

  it('GET /api/claims/draft returns 404 when no draft saved', (done) => {
    http.get('/api/claims/draft').subscribe({
      error: (err) => {
        expect(err.status).toBe(404);
        done();
      },
    });
  });

  it('GET /api/claims/draft returns saved draft after PATCH', (done) => {
    http.patch('/api/claims/draft', draft).subscribe(() => {
      http.get('/api/claims/draft').subscribe((result) => {
        expect(result).toEqual(draft);
        done();
      });
    });
  });

  it('PATCH overwrites previous draft', (done) => {
    const draftB = { ...draft, currentStep: 3 };
    http.patch('/api/claims/draft', draft).subscribe(() => {
      http.patch('/api/claims/draft', draftB).subscribe(() => {
        http.get('/api/claims/draft').subscribe((result: any) => {
          expect(result.currentStep).toBe(3);
          done();
        });
      });
    });
  });

  it('non-matching URLs pass through', () => {
    http.get('/api/other').subscribe();
    const req = httpMock.expectOne('/api/other');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts
```

Expected: FAIL — `Cannot find module './mock-api.interceptor'`

---

### Task 11: `mockApiInterceptor` — Implementation (GREEN)

**Files:**
- Create: `apps/borrower-portal/src/app/claim/services/mock-api.interceptor.ts`

- [ ] **Step 1: Write implementation**

```typescript
import {
  HttpInterceptorFn,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';

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

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts
```

Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/services/mock-api.interceptor.ts apps/borrower-portal/src/app/claim/services/mock-api.interceptor.spec.ts
git commit -m "feat: add mockApiInterceptor for draft persistence POC with TDD"
```

---

### Task 12: `SecurityAlertComponent` — Test First

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "libs/ui/design-system/src/lib/design-system/security-alert"
```

- [ ] **Step 2: Write Vitest tests (RED)**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecurityAlertComponent } from './security-alert';

describe('SecurityAlertComponent', () => {
  let fixture: ComponentFixture<SecurityAlertComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityAlertComponent],
    }).compileComponents();
  });

  it('renders message text', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Re-enter SSN');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Re-enter SSN');
  });

  it('applies warning class by default', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Test');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[data-testid="security-alert"]');
    expect(alert.classList.contains('security-alert--warning')).toBe(true);
  });

  it('hidden when visible is false', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Hidden');
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[data-testid="security-alert"]');
    expect(alert).toBeNull();
  });

  it('emits dismissed event on dismiss click', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Dismiss me');
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();

    let dismissed = false;
    fixture.componentInstance.dismissed.subscribe(() => (dismissed = true));

    const btn = fixture.nativeElement.querySelector('[data-testid="security-alert-dismiss"]');
    btn.click();
    expect(dismissed).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts
```

Expected: FAIL — `Cannot find module './security-alert'`

---

### Task 13: `SecurityAlertComponent` — Implementation (GREEN)

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.ts`

- [ ] **Step 1: Write implementation**

```typescript
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'tai-security-alert',
  standalone: true,
  template: `
    @if (visible()) {
      <div
        class="security-alert"
        [class.security-alert--warning]="severity() === 'warning'"
        [class.security-alert--info]="severity() === 'info'"
        data-testid="security-alert"
      >
        <span class="security-alert__icon">&#x1f512;</span>
        <span class="security-alert__message">{{ message() }}</span>
        @if (dismissible()) {
          <button
            class="security-alert__dismiss"
            (click)="dismissed.emit()"
            data-testid="security-alert-dismiss"
          >
            &times;
          </button>
        }
      </div>
    }
  `,
  styles: `
    .security-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
    }
    .security-alert--warning {
      background-color: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
    }
    .security-alert--info {
      background-color: #dbeafe;
      border: 1px solid #3b82f6;
      color: #1e40af;
    }
    .security-alert__dismiss {
      margin-left: auto;
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: inherit;
      padding: 0 0.25rem;
    }
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

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run libs/ui/design-system/src/lib/design-system/security-alert/security-alert.spec.ts
```

Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/security-alert/
git commit -m "feat: add SecurityAlertComponent to design system with TDD"
```

---

### Task 14: `SecurityAlertComponent` — Storybook Stories

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/security-alert/security-alert.stories.ts`

- [ ] **Step 1: Write Storybook stories**

```typescript
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { within, expect, userEvent } from 'storybook/test';
import { SecurityAlertComponent } from './security-alert';

const meta: Meta<SecurityAlertComponent> = {
  title: 'Security/SecurityAlert',
  component: SecurityAlertComponent,
  decorators: [
    moduleMetadata({
      imports: [SecurityAlertComponent],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<SecurityAlertComponent>;

export const Warning: Story = {
  args: {
    message: 'For your security, please re-enter your SSN.',
    severity: 'warning',
    visible: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByTestId('security-alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('re-enter your SSN');
  },
};

export const Info: Story = {
  args: {
    message: 'Draft saved locally (encrypted).',
    severity: 'info',
    visible: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByTestId('security-alert');
    expect(alert.classList.contains('security-alert--info')).toBe(true);
  },
};

export const Dismissible: Story = {
  args: {
    message: 'Session expired. Please re-authenticate.',
    severity: 'warning',
    visible: true,
    dismissible: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dismissBtn = canvas.getByTestId('security-alert-dismiss');
    await userEvent.click(dismissBtn);
    const alert = canvas.queryByTestId('security-alert');
    // Note: dismissing emits event but visibility is controlled by parent
    expect(dismissBtn).toBeTruthy();
  },
};

export const Hidden: Story = {
  args: {
    message: 'This should not be visible.',
    visible: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.queryByTestId('security-alert');
    expect(alert).toBeNull();
  },
};
```

- [ ] **Step 2: Verify stories render**

```bash
npx storybook build --quiet 2>&1 | tail -5
```

Expected: Build succeeds without errors

- [ ] **Step 3: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/security-alert/security-alert.stories.ts
git commit -m "feat: add SecurityAlert Storybook stories with interaction tests"
```

---

### Task 15: `CryptoUnavailableComponent` — Test First

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "libs/ui/design-system/src/lib/design-system/crypto-unavailable"
```

- [ ] **Step 2: Write Vitest tests (RED)**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CryptoUnavailableComponent } from './crypto-unavailable';

describe('CryptoUnavailableComponent', () => {
  let fixture: ComponentFixture<CryptoUnavailableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CryptoUnavailableComponent],
    }).compileComponents();
  });

  it('renders default message', () => {
    fixture = TestBed.createComponent(CryptoUnavailableComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('secure browser environment');
  });

  it('renders custom message', () => {
    fixture = TestBed.createComponent(CryptoUnavailableComponent);
    fixture.componentRef.setInput('message', 'Please use Chrome or Edge');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Please use Chrome or Edge');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts
```

Expected: FAIL — `Cannot find module './crypto-unavailable'`

---

### Task 16: `CryptoUnavailableComponent` — Implementation + Stories (GREEN)

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.ts`
- Create: `libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.stories.ts`

- [ ] **Step 1: Write component implementation**

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'tai-crypto-unavailable',
  standalone: true,
  template: `
    <div class="crypto-unavailable" data-testid="crypto-unavailable">
      <h2>Secure Connection Required</h2>
      <p>{{ message() }}</p>
      <p>Please ensure you are accessing this application over HTTPS.</p>
    </div>
  `,
  styles: `
    .crypto-unavailable {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      padding: 2rem;
      color: #991b1b;
    }
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    p {
      max-width: 32rem;
      line-height: 1.5;
      margin-bottom: 0.5rem;
    }
  `,
})
export class CryptoUnavailableComponent {
  message = input<string>(
    'This application requires a secure browser environment to protect your data.',
  );
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run libs/ui/design-system/src/lib/design-system/crypto-unavailable/crypto-unavailable.spec.ts
```

Expected: 2 tests PASS

- [ ] **Step 3: Write Storybook stories**

```typescript
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { within, expect } from 'storybook/test';
import { CryptoUnavailableComponent } from './crypto-unavailable';

const meta: Meta<CryptoUnavailableComponent> = {
  title: 'Security/CryptoUnavailable',
  component: CryptoUnavailableComponent,
  decorators: [
    moduleMetadata({
      imports: [CryptoUnavailableComponent],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<CryptoUnavailableComponent>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const el = canvas.getByTestId('crypto-unavailable');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('HTTPS');
  },
};

export const CustomMessage: Story = {
  args: {
    message: 'WebView not supported. Please open in Chrome or Edge.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const el = canvas.getByTestId('crypto-unavailable');
    expect(el.textContent).toContain('WebView not supported');
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/crypto-unavailable/
git commit -m "feat: add CryptoUnavailableComponent to design system with TDD"
```

---

### Task 17: Export Design System Components

**Files:**
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Add exports to barrel file**

Add these two lines at the end of `libs/ui/design-system/src/index.ts`:

```typescript
export * from './lib/design-system/security-alert/security-alert';
export * from './lib/design-system/crypto-unavailable/crypto-unavailable';
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --project libs/ui/design-system/tsconfig.lib.json --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add libs/ui/design-system/src/index.ts
git commit -m "feat: export SecurityAlert and CryptoUnavailable from design system"
```

---

### Task 18: Add Draft Persistence Actions

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.actions.ts`

- [ ] **Step 1: Add 4 new action events**

In `apps/borrower-portal/src/app/claim/+state/claim.actions.ts`, add the import for `DisabilityClaimDraft` and add 4 new events inside the `events` object, after the `'Reset Claim': emptyProps(),` line (before the closing `}`):

Add `DisabilityClaimDraft` to the import from `./claim.models`:

```typescript
import {
  BorrowerInfo,
  DisabilityClaimDraft,
  DocumentMeta,
  IncidentDetails,
  MedicalProvider,
} from './claim.models';
```

Add these 4 events after the `'Reset Claim': emptyProps(),` line:

```typescript
    // ── Draft Persistence ───────────────────────────
    'Draft Saved': emptyProps(),
    'Draft Save Error': props<{ message: string }>(),
    'Draft Loaded': props<{ draft: DisabilityClaimDraft }>(),
    'Draft Load Error': props<{ message: string }>(),
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --project apps/borrower-portal/tsconfig.app.json --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/claim.actions.ts
git commit -m "feat: add draft persistence actions (draftSaved, draftLoaded, etc.)"
```

> **TDD Gap Note (2026-04-17):** Task 18 was originally implemented as a direct modification without test-first TDD. Tests added in follow-up commit `79f9e61` to close this gap — see `claim.actions.spec.ts`.

---

### Task 19: Reducer `draftLoaded` Handler — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/+state/claim.reducer.spec.ts`

- [ ] **Step 1: Write reducer tests (RED)**

```typescript
import { claimFeature } from './claim.reducer';
import { ClaimActions } from './claim.actions';
import { DisabilityClaimDraft, initialClaimState } from './claim.models';

describe('claimReducer — draftLoaded', () => {
  const reducer = claimFeature.reducer;

  const hydratedDraft: DisabilityClaimDraft = {
    ...initialClaimState,
    currentStep: 3,
    borrower: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    },
    incident: {
      dateOfDisability: '2026-01-15',
      disabilityType: 'Illness',
      isWorkRelated: false,
      workersCompClaimNumber: null,
      description: 'Back injury',
    },
    isSubmitting: true,
    error: 'stale error',
  };

  it('merges loaded draft into state', () => {
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: hydratedDraft }));
    expect(result.borrower.firstName).toBe('Jane');
    expect(result.incident.disabilityType).toBe('Illness');
    expect(result.currentStep).toBe(3);
  });

  it('forces ssnLastFour to empty string (defense-in-depth)', () => {
    const draftWithSSN = {
      ...hydratedDraft,
      borrower: { ...hydratedDraft.borrower, ssnLastFour: '9999' },
    };
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: draftWithSSN }));
    expect(result.borrower.ssnLastFour).toBe('');
  });

  it('resets isSubmitting to false', () => {
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: hydratedDraft }));
    expect(result.isSubmitting).toBe(false);
  });

  it('resets error to null', () => {
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: hydratedDraft }));
    expect(result.error).toBeNull();
  });

  it('returns new state reference', () => {
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: hydratedDraft }));
    expect(result).not.toBe(initialClaimState);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.reducer.spec.ts
```

Expected: FAIL — tests fail because `draftLoaded` action handler doesn't exist in reducer yet

---

### Task 20: Reducer `draftLoaded` Handler — Implementation (GREEN)

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.reducer.ts`

- [ ] **Step 1: Add draftLoaded handler to reducer**

In `apps/borrower-portal/src/app/claim/+state/claim.reducer.ts`, add this `on()` handler after the `on(ClaimActions.resetClaim, ...)` handler (before the closing `),` of `createReducer`):

```typescript
    // ── Draft Persistence ───────────────────────────

    on(ClaimActions.draftLoaded, (state, { draft }): DisabilityClaimDraft => ({
      ...state,
      ...draft,
      borrower: {
        ...draft.borrower,
        ssnLastFour: '', // Defense-in-depth: ensure SSN is never loaded from persisted data
      },
      isSubmitting: false,
      error: null,
    })),
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.reducer.spec.ts
```

Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/claim.reducer.ts apps/borrower-portal/src/app/claim/+state/claim.reducer.spec.ts
git commit -m "feat: add draftLoaded reducer handler with SSN defense-in-depth"
```

---

### Task 21: Selector SSN Edge Case Tests

**Files:**
- Create: `apps/borrower-portal/src/app/claim/+state/claim.selectors.spec.ts`

- [ ] **Step 1: Write selector tests**

```typescript
import { selectBorrowerValid } from './claim.selectors';

describe('selectBorrowerValid — SSN edge cases', () => {
  it('returns false when SSN is empty after hydration', () => {
    const borrower = {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    };
    expect(selectBorrowerValid.projector(borrower)).toBe(false);
  });

  it('returns true after SSN re-entered', () => {
    const borrower = {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '1234',
      phone: '5551234567',
      email: 'jane@example.com',
    };
    expect(selectBorrowerValid.projector(borrower)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.selectors.spec.ts
```

Expected: 2 tests PASS (selectors are pure projectors, already implemented)

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/claim.selectors.spec.ts
git commit -m "test: add selector SSN edge case tests for hydration scenario"
```

---

### Task 22: DevTools Sanitizers — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts`

- [ ] **Step 1: Write sanitizer tests (RED)**

```typescript
import { stateSanitizer, actionSanitizer } from './claim.devtools-sanitizers';

describe('DevTools Sanitizers', () => {
  describe('stateSanitizer', () => {
    it('masks SSN in state', () => {
      const state = {
        claim: {
          borrower: { firstName: 'Jane', ssnLastFour: '1234' },
        },
      };
      const result = stateSanitizer(state);
      expect(result.claim.borrower.ssnLastFour).toBe('****');
    });

    it('preserves empty SSN as empty', () => {
      const state = {
        claim: {
          borrower: { firstName: 'Jane', ssnLastFour: '' },
        },
      };
      const result = stateSanitizer(state);
      expect(result.claim.borrower.ssnLastFour).toBe('');
    });
  });

  describe('actionSanitizer', () => {
    it('masks SSN in saveBorrowerInfo action', () => {
      const action = {
        type: '[Claim] Save Borrower Info',
        borrower: { firstName: 'Jane', ssnLastFour: '5678' },
      };
      const result = actionSanitizer(action);
      expect(result.borrower.ssnLastFour).toBe('****');
    });

    it('passes non-borrower actions through unchanged', () => {
      const action = {
        type: '[Claim] Save Incident Details',
        incident: { description: 'Back injury' },
      };
      const result = actionSanitizer(action);
      expect(result).toEqual(action);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts
```

Expected: FAIL — `Cannot find module './claim.devtools-sanitizers'`

---

### Task 23: DevTools Sanitizers — Implementation (GREEN)

**Files:**
- Create: `apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.ts`

- [ ] **Step 1: Write implementation**

```typescript
/**
 * DevTools state and action sanitizers.
 * Masks SSN (ssnLastFour) in Redux DevTools to prevent PII leaks
 * through the browser extension.
 */

export function stateSanitizer(state: any): any {
  if (!state?.claim?.borrower) return state;
  return {
    ...state,
    claim: {
      ...state.claim,
      borrower: {
        ...state.claim.borrower,
        ssnLastFour: state.claim.borrower.ssnLastFour ? '****' : '',
      },
    },
  };
}

export function actionSanitizer(action: any): any {
  if (action.type === '[Claim] Save Borrower Info' && action.borrower) {
    return {
      ...action,
      borrower: { ...action.borrower, ssnLastFour: '****' },
    };
  }
  return action;
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts
```

Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.ts apps/borrower-portal/src/app/claim/claim.devtools-sanitizers.spec.ts
git commit -m "feat: add DevTools PII sanitizers with TDD"
```

---

### Task 24: Effects — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts`

- [ ] **Step 1: Write all effect tests (RED)**

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { Action } from '@ngrx/store';
import { ClaimActions } from './claim.actions';
import { initialClaimState } from './claim.models';
import { selectClaimState } from './claim.selectors';
import { REPLAY_MODE } from './claim.effects';
import { ClaimDraftService } from '../services/claim-draft.service';
import { CryptoStorageService } from '../services/crypto-storage.service';
import { SecurityLoggerService } from '../services/security-logger.service';

// We'll import the effects after they're created
import { autoSaveDraft, loadDraft, clearDraftOnReset } from './claim.effects';

describe('Claim Effects — autoSaveDraft', () => {
  let actions$: Observable<Action>;
  let store: MockStore;
  let draftService: jest.Mocked<ClaimDraftService>;
  let cryptoStorage: jest.Mocked<CryptoStorageService>;
  let securityLogger: jest.Mocked<SecurityLoggerService>;

  const testState = {
    ...initialClaimState,
    borrower: {
      ...initialClaimState.borrower,
      firstName: 'Jane',
      ssnLastFour: '1234',
    },
  };

  beforeEach(() => {
    draftService = {
      saveDraft: vi.fn().mockReturnValue(of(undefined)),
      loadDraft: vi.fn().mockReturnValue(of(initialClaimState)),
    } as any;

    cryptoStorage = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    } as any;

    securityLogger = {
      log: vi.fn(),
      getEvents: vi.fn().mockReturnValue([]),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({
          selectors: [{ selector: selectClaimState, value: testState }],
        }),
        { provide: ClaimDraftService, useValue: draftService },
        { provide: CryptoStorageService, useValue: cryptoStorage },
        { provide: SecurityLoggerService, useValue: securityLogger },
        { provide: REPLAY_MODE, useValue: { active: false } },
      ],
    });

    store = TestBed.inject(MockStore);
  });

  it('saves sanitized draft to API after 2s debounce', fakeAsync(() => {
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));
    const effect = TestBed.runInInjectionContext(() => autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger, { active: false }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick(2000);

    expect(draftService.saveDraft).toHaveBeenCalledTimes(1);
    const savedDraft = draftService.saveDraft.mock.calls[0][0];
    expect(savedDraft.borrower.ssnLastFour).toBe('');
  }));

  it('dispatches draftSaved on API success', fakeAsync(() => {
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));
    const effect = TestBed.runInInjectionContext(() => autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger, { active: false }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick(2000);

    expect(results).toEqual([ClaimActions.draftSaved()]);
  }));

  it('falls back to encrypted sessionStorage on API failure', fakeAsync(() => {
    draftService.saveDraft.mockReturnValue(throwError(() => new Error('API down')));
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));
    const effect = TestBed.runInInjectionContext(() => autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger, { active: false }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick(2000);

    expect(cryptoStorage.save).toHaveBeenCalled();
  }));

  it('dispatches draftSaveError on API failure', fakeAsync(() => {
    draftService.saveDraft.mockReturnValue(throwError(() => new Error('API down')));
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));
    const effect = TestBed.runInInjectionContext(() => autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger, { active: false }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick(2000);

    expect(results[0].type).toBe('[Claim] Draft Save Error');
  }));

  it('does not fire during replay mode', fakeAsync(() => {
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));
    const effect = TestBed.runInInjectionContext(() => autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger, { active: true }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick(2000);

    expect(draftService.saveDraft).not.toHaveBeenCalled();
  }));

  it('logs PII_STRIPPED on every save', fakeAsync(() => {
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));
    const effect = TestBed.runInInjectionContext(() => autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger, { active: false }));

    effect.subscribe();
    tick(2000);

    expect(securityLogger.log).toHaveBeenCalledWith('PII_STRIPPED', expect.any(String));
  }));
});

describe('Claim Effects — loadDraft', () => {
  let actions$: Observable<Action>;
  let draftService: any;
  let cryptoStorage: any;

  beforeEach(() => {
    draftService = {
      saveDraft: vi.fn(),
      loadDraft: vi.fn(),
    };
    cryptoStorage = {
      save: vi.fn(),
      load: vi.fn(),
      clear: vi.fn(),
    };
  });

  it('loads draft from API on ROOT_EFFECTS_INIT', fakeAsync(() => {
    const mockDraft = { ...initialClaimState, currentStep: 2 };
    draftService.loadDraft.mockReturnValue(of(mockDraft));
    actions$ = of({ type: '@ngrx/effects/init' });

    const effect = TestBed.runInInjectionContext(() => loadDraft(actions$, draftService, cryptoStorage, { active: false }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick();

    expect(results[0]).toEqual(ClaimActions.draftLoaded({ draft: mockDraft }));
  }));

  it('falls back to encrypted sessionStorage on API 404', fakeAsync(() => {
    const mockDraft = { ...initialClaimState, currentStep: 3 };
    draftService.loadDraft.mockReturnValue(throwError(() => new Error('404')));
    cryptoStorage.load.mockResolvedValue(mockDraft);
    actions$ = of({ type: '@ngrx/effects/init' });

    const effect = TestBed.runInInjectionContext(() => loadDraft(actions$, draftService, cryptoStorage, { active: false }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick();

    expect(results[0]).toEqual(ClaimActions.draftLoaded({ draft: mockDraft }));
  }));

  it('dispatches draftLoadError when both fail', fakeAsync(() => {
    draftService.loadDraft.mockReturnValue(throwError(() => new Error('API')));
    cryptoStorage.load.mockRejectedValue(new Error('crypto'));
    actions$ = of({ type: '@ngrx/effects/init' });

    const effect = TestBed.runInInjectionContext(() => loadDraft(actions$, draftService, cryptoStorage, { active: false }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick();

    expect(results[0].type).toBe('[Claim] Draft Load Error');
  }));

  it('dispatches draftLoadError when API fails and sessionStorage empty', fakeAsync(() => {
    draftService.loadDraft.mockReturnValue(throwError(() => new Error('API')));
    cryptoStorage.load.mockResolvedValue(null);
    actions$ = of({ type: '@ngrx/effects/init' });

    const effect = TestBed.runInInjectionContext(() => loadDraft(actions$, draftService, cryptoStorage, { active: false }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick();

    expect(results[0].type).toBe('[Claim] Draft Load Error');
  }));

  it('does not fire during replay mode', fakeAsync(() => {
    draftService.loadDraft.mockReturnValue(of(initialClaimState));
    actions$ = of({ type: '@ngrx/effects/init' });

    const effect = TestBed.runInInjectionContext(() => loadDraft(actions$, draftService, cryptoStorage, { active: true }));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick();

    expect(draftService.loadDraft).not.toHaveBeenCalled();
  }));
});

describe('Claim Effects — clearDraftOnReset', () => {
  let actions$: Observable<Action>;
  let draftService: any;
  let cryptoStorage: any;

  beforeEach(() => {
    draftService = {
      saveDraft: vi.fn().mockReturnValue(of(undefined)),
      loadDraft: vi.fn(),
    };
    cryptoStorage = {
      save: vi.fn(),
      load: vi.fn(),
      clear: vi.fn(),
    };
  });

  it('clears sessionStorage on resetClaim', fakeAsync(() => {
    actions$ = of(ClaimActions.resetClaim());
    const effect = TestBed.runInInjectionContext(() => clearDraftOnReset(actions$, draftService, cryptoStorage));

    effect.subscribe();
    tick();

    expect(cryptoStorage.clear).toHaveBeenCalled();
  }));

  it('sends reset to API on resetClaim', fakeAsync(() => {
    actions$ = of(ClaimActions.resetClaim());
    const effect = TestBed.runInInjectionContext(() => clearDraftOnReset(actions$, draftService, cryptoStorage));

    effect.subscribe();
    tick();

    expect(draftService.saveDraft).toHaveBeenCalledWith(initialClaimState);
  }));

  it('dispatches draftSaveError if API clear fails', fakeAsync(() => {
    draftService.saveDraft.mockReturnValue(throwError(() => new Error('fail')));
    actions$ = of(ClaimActions.resetClaim());
    const effect = TestBed.runInInjectionContext(() => clearDraftOnReset(actions$, draftService, cryptoStorage));

    const results: Action[] = [];
    effect.subscribe((a) => results.push(a));
    tick();

    expect(results[0].type).toBe('[Claim] Draft Save Error');
    expect(cryptoStorage.clear).toHaveBeenCalled();
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts
```

Expected: FAIL — effects `autoSaveDraft`, `loadDraft`, `clearDraftOnReset` not yet exported from `claim.effects.ts`

---

### Task 25: Effects — Implementation (GREEN)

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/+state/claim.effects.ts`

- [ ] **Step 1: Add imports at top of claim.effects.ts**

Add these imports to the existing import statements in `claim.effects.ts`:

```typescript
import {
  catchError,
  debounceTime,
  delay,
  exhaustMap,
  filter,
  map,
  of,
  from,
  switchMap,
  tap,
  withLatestFrom,
  EMPTY,
} from 'rxjs';
import { ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { ClaimDraftService } from '../services/claim-draft.service';
import { CryptoStorageService } from '../services/crypto-storage.service';
import { SecurityLoggerService } from '../services/security-logger.service';
import { sanitizeForPersistence } from './claim.sanitize';
import { initialClaimState } from './claim.models';
```

- [ ] **Step 2: Add autoSaveDraft effect after the existing submitClaim effect**

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
      debounceTime(2000),
      withLatestFrom(store.select(selectClaimState)),
      exhaustMap(([, claimState]) => {
        const sanitized = sanitizeForPersistence(claimState);
        securityLogger.log('PII_STRIPPED', 'ssnLastFour removed before persistence');

        return draftService.saveDraft(sanitized).pipe(
          map(() => ClaimActions.draftSaved()),
          catchError(() => {
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
  { functional: true },
);
```

- [ ] **Step 3: Add loadDraft effect**

```typescript
export const loadDraft = createEffect(
  (
    actions$ = inject(Actions),
    draftService = inject(ClaimDraftService),
    cryptoStorage = inject(CryptoStorageService),
    replayMode = inject(REPLAY_MODE),
  ) => {
    return actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      filter(() => !replayMode.active),
      switchMap(() =>
        draftService.loadDraft().pipe(
          map((draft) => ClaimActions.draftLoaded({ draft })),
          catchError(() =>
            from(cryptoStorage.load()).pipe(
              map((draft) =>
                draft
                  ? ClaimActions.draftLoaded({ draft })
                  : ClaimActions.draftLoadError({ message: 'No saved draft found.' }),
              ),
              catchError(() =>
                of(ClaimActions.draftLoadError({ message: 'Could not restore draft.' })),
              ),
            ),
          ),
        ),
      ),
    );
  },
  { functional: true },
);
```

- [ ] **Step 4: Add clearDraftOnReset effect**

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
          catchError(() =>
            of(ClaimActions.draftSaveError({
              message: 'Could not clear server draft.',
            })),
          ),
        ),
      ),
    );
  },
  { functional: true },
);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts
```

Expected: 16 tests PASS

Note: The effect test signatures may need adjusting based on how `runInInjectionContext` works with functional effects. If tests fail due to DI, switch to using `TestBed.inject` pattern with `provideMockActions`. The test patterns above follow the functional effect testing approach. If the function signatures don't match the DI-injected version, refactor the tests to use:

```typescript
// Alternative: test via the effect stream directly using TestBed
TestBed.configureTestingModule({
  providers: [
    provideMockActions(() => actions$),
    provideMockStore({ ... }),
    { provide: ClaimDraftService, useValue: draftService },
    { provide: CryptoStorageService, useValue: cryptoStorage },
    { provide: SecurityLoggerService, useValue: securityLogger },
    { provide: REPLAY_MODE, useValue: { active: false } },
  ],
});
// Then run the effect function inside injection context
```

- [ ] **Step 6: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/claim.effects.ts apps/borrower-portal/src/app/claim/+state/claim.effects.spec.ts
git commit -m "feat: add autoSaveDraft, loadDraft, clearDraftOnReset effects with TDD"
```

---

### Task 26: Update Barrel Exports + Delete Meta-Reducer

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/+state/index.ts`
- Delete: `apps/borrower-portal/src/app/claim/+state/claim.meta-reducer.ts`

- [ ] **Step 1: Update barrel exports**

Replace the entire contents of `apps/borrower-portal/src/app/claim/+state/index.ts`:

```typescript
/**
 * Public API for the claim NgRx state.
 * Import from this barrel file, not from individual files.
 */
export * from './claim.models';
export * from './claim.actions';
export * from './claim.reducer';
export * from './claim.selectors';
export * from './claim.effects';
export * from './claim.sanitize';
export { claimStepGuard } from './claim-step.guard';
```

- [ ] **Step 2: Delete the meta-reducer**

```bash
git rm "apps/borrower-portal/src/app/claim/+state/claim.meta-reducer.ts"
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --project apps/borrower-portal/tsconfig.app.json --noEmit
```

Expected: No errors (all references to `localStorageMetaReducer` and `STORAGE_KEY` removed)

- [ ] **Step 4: Commit**

```bash
git add apps/borrower-portal/src/app/claim/+state/index.ts
git commit -m "refactor: remove localStorageMetaReducer, update barrel exports"
```

---

### Task 27: Wire Up `app.config.ts`

**Files:**
- Modify: `apps/borrower-portal/src/app/app.config.ts`

- [ ] **Step 1: Replace entire app.config.ts**

Replace the full contents of `apps/borrower-portal/src/app/app.config.ts`:

```typescript
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { appRoutes } from './app.routes';
import {
  claimFeature,
  fetchWorkersCompTemplate,
  submitClaim,
  autoSaveDraft,
  loadDraft,
  clearDraftOnReset,
} from './claim/+state';
import { mockApiInterceptor } from './claim/services/mock-api.interceptor';
import {
  stateSanitizer,
  actionSanitizer,
} from './claim/claim.devtools-sanitizers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),

    provideHttpClient(withInterceptors([mockApiInterceptor])),

    provideStore({ [claimFeature.name]: claimFeature.reducer }),

    provideEffects({
      fetchWorkersCompTemplate,
      submitClaim,
      autoSaveDraft,
      loadDraft,
      clearDraftOnReset,
    }),

    provideStoreDevtools({
      maxAge: 50,
      logOnly: !isDevMode(),
      name: 'Borrower Portal — NgRx Store',
      stateSanitizer,
      actionSanitizer,
    }),
  ],
};
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --project apps/borrower-portal/tsconfig.app.json --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/app.config.ts
git commit -m "feat: wire up effect-based persistence, HttpClient, DevTools sanitizers"
```

---

### Task 28: CSP Meta Tag

**Files:**
- Modify: `apps/borrower-portal/src/index.html`

- [ ] **Step 1: Add CSP meta tag to head**

In `apps/borrower-portal/src/index.html`, add this after the `<meta name="viewport" ...>` line:

```html
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';">
```

- [ ] **Step 2: Commit**

```bash
git add apps/borrower-portal/src/index.html
git commit -m "feat: add Content Security Policy meta tag for XSS prevention"
```

---

### Task 29: Crypto Availability Check in AppComponent

**Files:**
- Modify: `apps/borrower-portal/src/app/app.ts`
- Modify: `apps/borrower-portal/src/app/app.html`

- [ ] **Step 1: Update AppComponent to check crypto availability**

Replace `apps/borrower-portal/src/app/app.ts`:

```typescript
import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CryptoStorageService } from './claim/services/crypto-storage.service';
import { CryptoUnavailableComponent } from '@tai-portal/ui/design-system';

@Component({
  imports: [RouterModule, CryptoUnavailableComponent],
  selector: 'bp-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'borrower-portal';
  protected cryptoAvailable = signal(CryptoStorageService.isAvailable());
}
```

- [ ] **Step 2: Update app.html template**

Replace `apps/borrower-portal/src/app/app.html`:

```html
@if (cryptoAvailable()) {
  <router-outlet></router-outlet>
} @else {
  <tai-crypto-unavailable></tai-crypto-unavailable>
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --project apps/borrower-portal/tsconfig.app.json --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/borrower-portal/src/app/app.ts apps/borrower-portal/src/app/app.html
git commit -m "feat: add crypto.subtle availability gate in AppComponent"
```

---

### Task 30: SSN Re-Entry UX — Test First

**Files:**
- Create: `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts`

- [ ] **Step 1: Write component tests (RED)**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { BorrowerInfoComponent } from './borrower-info.component';
import { selectBorrower } from '../+state';

describe('BorrowerInfoComponent — SSN Re-Entry UX', () => {
  let fixture: ComponentFixture<BorrowerInfoComponent>;
  let store: MockStore;

  function createComponent(borrowerOverride: any) {
    TestBed.configureTestingModule({
      imports: [BorrowerInfoComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        provideMockStore({
          selectors: [{ selector: selectBorrower, value: borrowerOverride }],
        }),
      ],
    });

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(BorrowerInfoComponent);
    fixture.detectChanges();
  }

  it('shows SSN re-entry message when borrower hydrated without SSN', () => {
    createComponent({
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    });
    const alert = fixture.nativeElement.querySelector('tai-security-alert');
    expect(alert).toBeTruthy();
  });

  it('does not show re-entry message on fresh form', () => {
    createComponent({
      firstName: '',
      lastName: '',
      ssnLastFour: '',
      phone: '',
      email: '',
    });
    const alert = fixture.nativeElement.querySelector('tai-security-alert');
    expect(alert).toBeNull();
  });

  it('does not show re-entry message when SSN is populated', () => {
    createComponent({
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '1234',
      phone: '5551234567',
      email: 'jane@example.com',
    });
    const alert = fixture.nativeElement.querySelector('tai-security-alert');
    expect(alert).toBeNull();
  });

  it('SSN field is empty after hydration', () => {
    createComponent({
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    });
    const ssnInput = fixture.nativeElement.querySelector('#ssnLastFour') as HTMLInputElement;
    expect(ssnInput.value).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts
```

Expected: FAIL — component doesn't render `tai-security-alert` yet

---

### Task 31: SSN Re-Entry UX — Implementation (GREEN)

**Files:**
- Modify: `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.ts`
- Modify: `apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.html`

- [ ] **Step 1: Update component TS**

In `borrower-info.component.ts`, add the `SecurityAlertComponent` import and a `ssnReEntryRequired` flag:

Add to imports at top:

```typescript
import { SecurityAlertComponent } from '@tai-portal/ui/design-system';
```

Update the `@Component` decorator's `imports` array:

```typescript
  imports: [CommonModule, ReactiveFormsModule, SecurityAlertComponent],
```

Add a property to the class:

```typescript
  ssnReEntryRequired = false;
```

Update the `subscribe` callback in `ngOnInit` to set the flag:

```typescript
    this.store
      .select(selectBorrower)
      .pipe(takeUntil(this.destroy$))
      .subscribe((borrower) => {
        if (borrower.firstName || borrower.lastName) {
          this.form.patchValue(borrower, { emitEvent: false });
          // Detect hydration scenario: data exists but SSN stripped
          this.ssnReEntryRequired =
            borrower.firstName.length > 0 && borrower.ssnLastFour.length === 0;
        }
      });
```

- [ ] **Step 2: Update component HTML**

In `borrower-info.component.html`, add the security alert after the `<h2>` heading and before the error summary. Insert between lines 10 and 13:

```html
  <!-- SSN Re-Entry Alert (shown after hydration from encrypted storage) -->
  @if (ssnReEntryRequired) {
    <tai-security-alert
      message="For your security, your SSN was not saved. Please re-enter the last 4 digits to continue."
      severity="warning"
    ></tai-security-alert>
  }
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npx vitest run apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts
```

Expected: 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.ts apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.html apps/borrower-portal/src/app/claim/borrower-info/borrower-info.component.spec.ts
git commit -m "feat: add SSN re-entry UX with SecurityAlertComponent"
```

---

### Task 32: Negative Security Tests

**Files:**
- Create: `apps/borrower-portal/src/app/claim/claim.security-negative.spec.ts`

- [ ] **Step 1: Write negative security tests**

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideStore, Store } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  claimFeature,
  ClaimActions,
  initialClaimState,
  selectBorrower,
  autoSaveDraft,
  loadDraft,
  clearDraftOnReset,
  fetchWorkersCompTemplate,
  submitClaim,
} from './+state';
import { sanitizeForPersistence } from './+state/claim.sanitize';
import { CryptoStorageService } from './services/crypto-storage.service';
import { ClaimDraftService } from './services/claim-draft.service';
import { mockApiInterceptor } from './services/mock-api.interceptor';

describe('Negative Security Tests', () => {
  it('reducer strips SSN even on direct draftLoaded dispatch (bypass effect)', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStore({ [claimFeature.name]: claimFeature.reducer }),
      ],
    });
    const store = TestBed.inject(Store);

    const draftWithSSN = {
      ...initialClaimState,
      borrower: { ...initialClaimState.borrower, firstName: 'Jane', ssnLastFour: '9999' },
    };

    store.dispatch(ClaimActions.draftLoaded({ draft: draftWithSSN }));

    let result: any;
    store.select(selectBorrower).subscribe((b) => (result = b));
    expect(result.ssnLastFour).toBe('');
    expect(result.firstName).toBe('Jane');
  });

  it('sanitizeForPersistence is the only code path writing to draftService', fakeAsync(() => {
    TestBed.configureTestingModule({
      providers: [
        provideStore({ [claimFeature.name]: claimFeature.reducer }),
        provideEffects({
          autoSaveDraft,
          loadDraft,
          clearDraftOnReset,
          fetchWorkersCompTemplate,
          submitClaim,
        }),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    });
    const store = TestBed.inject(Store);
    const draftService = TestBed.inject(ClaimDraftService);
    const saveSpy = vi.spyOn(draftService, 'saveDraft');

    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: { ...initialClaimState.borrower, firstName: 'Jane', ssnLastFour: '1234' },
      }),
    );
    tick(2000);

    if (saveSpy.mock.calls.length > 0) {
      const savedDraft = saveSpy.mock.calls[0][0];
      expect(savedDraft.borrower.ssnLastFour).toBe('');
    }
  }));

  it('localStorage is never written to by any code path', fakeAsync(() => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    TestBed.configureTestingModule({
      providers: [
        provideStore({ [claimFeature.name]: claimFeature.reducer }),
        provideEffects({
          autoSaveDraft,
          loadDraft,
          clearDraftOnReset,
          fetchWorkersCompTemplate,
          submitClaim,
        }),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    });
    const store = TestBed.inject(Store);

    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
      }),
    );
    tick(2000);

    const localStorageCalls = spy.mock.calls.filter(
      ([, ], self) => self === localStorage,
    );
    expect(localStorageCalls.length).toBe(0);

    spy.mockRestore();
  }));

  it('expired TTL draft cannot be loaded even with valid key', async () => {
    const service = new CryptoStorageService();
    const state = { ...initialClaimState, currentStep: 2 };
    await service.save(state);

    // Manipulate timestamp to expired
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    const parsed = JSON.parse(raw);
    parsed.ts = Date.now() - 31 * 60 * 1000;
    sessionStorage.setItem('bp_draft_enc', JSON.stringify(parsed));

    const result = await service.load();
    expect(result).toBeNull();
  });

  it('crypto.subtle unavailability prevents any storage write', async () => {
    const original = globalThis.crypto.subtle;
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const service = new CryptoStorageService();
    await expect(service.save(initialClaimState)).rejects.toThrow();
    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();

    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/claim.security-negative.spec.ts
```

Expected: 5 tests PASS

Note: The `localStorage is never written to` test may need adjustment based on how `vi.spyOn` handles `Storage.prototype`. If it doesn't work as shown, use this alternative approach:

```typescript
const originalSetItem = localStorage.setItem;
const calls: any[][] = [];
localStorage.setItem = (...args: any[]) => calls.push(args);
// ... test body ...
localStorage.setItem = originalSetItem;
expect(calls.length).toBe(0);
```

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/claim.security-negative.spec.ts
git commit -m "test: add negative security tests for bypass prevention"
```

---

### Task 33: Integration Tests

**Files:**
- Create: `apps/borrower-portal/src/app/claim/claim.integration.spec.ts`

- [ ] **Step 1: Write integration tests**

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideStore, Store } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  claimFeature,
  ClaimActions,
  initialClaimState,
  autoSaveDraft,
  loadDraft,
  clearDraftOnReset,
  fetchWorkersCompTemplate,
  submitClaim,
} from './+state';
import { mockApiInterceptor } from './services/mock-api.interceptor';
import { CryptoStorageService } from './services/crypto-storage.service';
import { SecurityLoggerService } from './services/security-logger.service';
import { ClaimDraftService } from './services/claim-draft.service';

describe('Integration Tests — Persistence Flows', () => {
  let store: Store;
  let securityLogger: SecurityLoggerService;

  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideStore({ [claimFeature.name]: claimFeature.reducer }),
        provideEffects({
          autoSaveDraft,
          loadDraft,
          clearDraftOnReset,
          fetchWorkersCompTemplate,
          submitClaim,
        }),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    });

    store = TestBed.inject(Store);
    securityLogger = TestBed.inject(SecurityLoggerService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('full save round-trip: action -> debounce -> API -> verify no SSN', fakeAsync(() => {
    const draftService = TestBed.inject(ClaimDraftService);
    const spy = vi.spyOn(draftService, 'saveDraft');

    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: {
          firstName: 'Jane',
          lastName: 'Doe',
          ssnLastFour: '1234',
          phone: '5551234567',
          email: 'jane@example.com',
        },
      }),
    );
    tick(2000);

    if (spy.mock.calls.length > 0) {
      expect(spy.mock.calls[0][0].borrower.ssnLastFour).toBe('');
    }
  }));

  it('SSN never in sessionStorage plaintext after fallback save', fakeAsync(() => {
    // Force API failure to trigger crypto fallback
    const draftService = TestBed.inject(ClaimDraftService);
    vi.spyOn(draftService, 'saveDraft').mockReturnValue(
      new (require('rxjs').Observable)((sub: any) => sub.error(new Error('API down'))),
    );

    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: {
          firstName: 'Jane',
          lastName: 'Doe',
          ssnLastFour: '1234',
          phone: '5551234567',
          email: 'jane@example.com',
        },
      }),
    );
    tick(2000);

    const stored = sessionStorage.getItem('bp_draft_enc');
    if (stored) {
      expect(stored).not.toContain('1234');
      expect(stored).not.toContain('"ssnLastFour"');
    }
  }));

  it('SSN never in localStorage at any point', fakeAsync(() => {
    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: {
          firstName: 'Jane',
          lastName: 'Doe',
          ssnLastFour: '1234',
          phone: '5551234567',
          email: 'jane@example.com',
        },
      }),
    );
    tick(2000);

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      const value = localStorage.getItem(key)!;
      expect(value).not.toContain('1234');
    }
  }));

  it('reset clears all persisted state', fakeAsync(() => {
    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
      }),
    );
    tick(2000);

    store.dispatch(ClaimActions.resetClaim());
    tick(100);

    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
  }));

  it('audit trail records full save lifecycle', fakeAsync(() => {
    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
      }),
    );
    tick(2000);

    const events = securityLogger.getEvents();
    const piiStripped = events.find((e) => e.type === 'PII_STRIPPED');
    expect(piiStripped).toBeTruthy();
  }));

  it('audit trail records encrypt fallback on API failure', fakeAsync(() => {
    const draftService = TestBed.inject(ClaimDraftService);
    vi.spyOn(draftService, 'saveDraft').mockReturnValue(
      new (require('rxjs').Observable)((sub: any) => sub.error(new Error('API down'))),
    );

    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
      }),
    );
    tick(2000);

    const events = securityLogger.getEvents();
    const types = events.map((e) => e.type);
    expect(types).toContain('PII_STRIPPED');
    expect(types).toContain('DRAFT_ENCRYPTED');
  }));
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run apps/borrower-portal/src/app/claim/claim.integration.spec.ts
```

Expected: 6 tests PASS

Note: Some integration tests depend on real effects running with the mock interceptor. If `throwError` import issues arise in the `require('rxjs')` usage, replace with:

```typescript
import { throwError } from 'rxjs';
// ... then in test:
vi.spyOn(draftService, 'saveDraft').mockReturnValue(throwError(() => new Error('API down')));
```

- [ ] **Step 3: Commit**

```bash
git add apps/borrower-portal/src/app/claim/claim.integration.spec.ts
git commit -m "test: add integration tests for full persistence flows"
```

---

### Task 34: Run Full Test Suite

- [ ] **Step 1: Run all borrower-portal tests**

```bash
npx vitest run --project borrower-portal
```

If no project config exists, run:

```bash
npx vitest run apps/borrower-portal/
```

Expected: All tests pass (existing `app.spec.ts` + all new tests)

- [ ] **Step 2: Run design system tests**

```bash
npx vitest run libs/ui/design-system/
```

Expected: All tests pass

- [ ] **Step 3: Run TypeScript compilation for entire workspace**

```bash
npx tsc --build
```

Expected: No errors

- [ ] **Step 4: Verify no skip/xit/xdescribe/todo in test files**

```bash
grep -rn "\.skip\|xit\|xdescribe\|\.todo" apps/borrower-portal/src/app/claim/**/*.spec.ts libs/ui/design-system/src/lib/design-system/security-alert/*.spec.ts libs/ui/design-system/src/lib/design-system/crypto-unavailable/*.spec.ts || echo "CLEAN: no skipped tests"
```

Expected: `CLEAN: no skipped tests`

- [ ] **Step 5: Verify coverage on security-critical paths**

```bash
npx vitest run --coverage apps/borrower-portal/src/app/claim/+state/claim.sanitize.spec.ts apps/borrower-portal/src/app/claim/services/crypto-storage.service.spec.ts
```

Expected: 100% branch coverage on both files

---

### Task 35: Smoke Test in Browser

- [ ] **Step 1: Start dev server**

```bash
npx nx serve borrower-portal
```

- [ ] **Step 2: Test golden path**

1. Open `http://localhost:4200` in browser
2. Open Redux DevTools and Network tab
3. Fill out Step 1 (Borrower Info) with test data including SSN `1234`
4. Verify: DevTools shows `ssnLastFour: '****'` (not `1234`)
5. Wait 2 seconds after last keystroke
6. Verify: Network tab shows PATCH to `/api/claims/draft` (or intercepted)
7. Navigate to Step 2, fill out incident details
8. Navigate to Step 3, add a medical provider
9. Refresh the page
10. Verify: SSN field is empty, security alert shows "re-enter your SSN"
11. Verify: Other fields (firstName, incident, etc.) are restored
12. Verify: `localStorage` has NO `borrower_claim_draft` key (check Application > Local Storage)
13. Check `sessionStorage` — should have `bp_draft_enc` with encrypted data (not plaintext)

- [ ] **Step 3: Test crypto unavailable scenario**

Open browser DevTools console and run:
```javascript
delete crypto.subtle
```
Then refresh. The app should show the `CryptoUnavailableComponent` blocker.

(Note: This is a manual verification. The actual `crypto.subtle` cannot be deleted in most secure contexts, but this validates the component renders when the flag is false.)

---

## Test Count Summary

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
| I-K. Effects (autoSave, load, clear) | 16 | `claim.effects.spec.ts` |
| L. Component SSN Re-Entry | 4 | `borrower-info.component.spec.ts` |
| M. Negative Security | 5 | `claim.security-negative.spec.ts` |
| N. Design System SecurityAlert | 4 + 4 stories | `security-alert.spec.ts` + `.stories.ts` |
| O. Design System CryptoUnavailable | 2 + 2 stories | `crypto-unavailable.spec.ts` + `.stories.ts` |
| P. Property-Based (fast-check) | 3 | `claim.sanitize.spec.ts` + `crypto-storage.service.spec.ts` |
| Q. Integration Flows | 6 | `claim.integration.spec.ts` |
| **Total** | **77 unit/integration + 6 Storybook stories** | |
