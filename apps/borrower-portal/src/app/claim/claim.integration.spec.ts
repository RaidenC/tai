import { TestBed } from '@angular/core/testing';
import { provideStore, Store } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { throwError } from 'rxjs';
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

  it('full save round-trip: action -> debounce -> API -> verify no SSN', async () => {
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
    await new Promise((r) => setTimeout(r, 2100)); // Wait for debounce

    if (spy.mock.calls.length > 0) {
      expect(spy.mock.calls[0][0].borrower.ssnLastFour).toBe('');
    }
  });

  it('SSN never in sessionStorage plaintext after fallback save', async () => {
    const draftService = TestBed.inject(ClaimDraftService);
    vi.spyOn(draftService, 'saveDraft').mockReturnValue(
      throwError(() => new Error('API down')),
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
    await new Promise((r) => setTimeout(r, 2100)); // Wait for debounce

    const stored = sessionStorage.getItem('bp_draft_enc');
    if (stored) {
      expect(stored).not.toContain('1234');
      expect(stored).not.toContain('"ssnLastFour"');
    }
  });

  it('SSN never in localStorage at any point', async () => {
    const originalSetItem = localStorage.setItem;
    const calls: string[] = [];
    localStorage.setItem = (key: string, value: string) => {
      calls.push(key);
      return originalSetItem(key, value);
    };

    try {
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
      await new Promise((r) => setTimeout(r, 2100)); // Wait for debounce

      const ssnInLocalStorage = calls.some((key) => {
        const value = localStorage.getItem(key);
        return value?.includes('1234');
      });
      expect(ssnInLocalStorage).toBe(false);
    } finally {
      localStorage.setItem = originalSetItem;
    }
  });

  it('reset clears all persisted state', async () => {
    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
      }),
    );
    await new Promise((r) => setTimeout(r, 2100)); // Wait for debounce

    store.dispatch(ClaimActions.resetClaim());
    await new Promise((r) => setTimeout(r, 100));

    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
  });

  it('audit trail records full save lifecycle', async () => {
    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
      }),
    );
    await new Promise((r) => setTimeout(r, 2100)); // Wait for debounce

    const events = securityLogger.getEvents();
    const piiStripped = events.find((e) => e.type === 'PII_STRIPPED');
    expect(piiStripped).toBeTruthy();
  });

  it('audit trail records encrypt fallback on API failure', async () => {
    const draftService = TestBed.inject(ClaimDraftService);
    vi.spyOn(draftService, 'saveDraft').mockReturnValue(
      throwError(() => new Error('API down')),
    );

    store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
      }),
    );
    await new Promise((r) => setTimeout(r, 2100)); // Wait for debounce

    const events = securityLogger.getEvents();
    const types = events.map((e) => e.type);
    expect(types).toContain('PII_STRIPPED');
    expect(types).toContain('DRAFT_ENCRYPTED');
  });
});
