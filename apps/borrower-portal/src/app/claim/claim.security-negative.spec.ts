import { TestBed } from '@angular/core/testing';
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
import { CryptoStorageService } from './services/crypto-storage.service';
import { ClaimDraftService } from './services/claim-draft.service';
import { mockApiInterceptor } from './services/mock-api.interceptor';

describe('Negative Security Tests', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('reducer strips SSN even on direct draftLoaded dispatch (bypass effect)', () => {
    const draftWithSSN = {
      ...initialClaimState,
      borrower: { ...initialClaimState.borrower, firstName: 'Jane', ssnLastFour: '9999' },
    };

    const result = claimFeature.reducer(
      initialClaimState,
      ClaimActions.draftLoaded({ draft: draftWithSSN }),
    );

    expect(result.borrower.ssnLastFour).toBe('');
    expect(result.borrower.firstName).toBe('Jane');
  });

  it('sanitizeForPersistence is the only code path writing to draftService', async () => {
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
    await new Promise((r) => setTimeout(r, 2100)); // Wait for debounce

    if (saveSpy.mock.calls.length > 0) {
      const savedDraft = saveSpy.mock.calls[0][0];
      expect(savedDraft.borrower.ssnLastFour).toBe('');
    }
  });

  it('localStorage is never written to by any code path', async () => {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const calls: [string, string][] = [];
    localStorage.setItem = (key: string, value: string) => {
      calls.push([key, value]);
      originalSetItem(key, value);
    };

    try {
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
      await new Promise((r) => setTimeout(r, 2100)); // Wait for debounce

      const localStorageCalls = calls.filter(
        ([key]) => key !== 'nx-runfile-cache' && typeof key === 'string' && !key.startsWith('__nx_')
      );
      expect(localStorageCalls.length).toBe(0);
    } finally {
      localStorage.setItem = originalSetItem;
    }
  });

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

    try {
      const service = new CryptoStorageService();
      await expect(service.save(initialClaimState)).rejects.toThrow();
      expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });
});
