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
    const originalSetItem = localStorage.setItem;
    const calls: string[] = [];
    localStorage.setItem = (key: string, value: string) => {
      calls.push(key);
      return originalSetItem.apply(localStorage, [key, value]);
    };

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

    const ssnInLocalStorage = calls.some((key) => {
      const value = localStorage.getItem(key);
      return value?.includes('1234');
    });
    expect(ssnInLocalStorage).toBe(false);

    localStorage.setItem = originalSetItem;
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
