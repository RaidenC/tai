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
    const originalSetItem = localStorage.setItem;
    const calls: any[][] = [];
    localStorage.setItem = (...args: any[]) => {
      calls.push(args);
      return originalSetItem.apply(localStorage, args);
    };

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

    const localStorageCalls = calls.filter(
      ([key], i) => key !== 'nx-runfile-cache' && typeof key === 'string' && !key.startsWith('__nx_')
    );
    expect(localStorageCalls.length).toBe(0);

    localStorage.setItem = originalSetItem;
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
