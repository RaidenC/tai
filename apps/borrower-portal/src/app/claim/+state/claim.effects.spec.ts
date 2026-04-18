import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { Action } from '@ngrx/store';
import { ClaimActions } from './claim.actions';
import { initialClaimState } from './claim.models';
import { selectClaimState } from './claim.selectors';

// Import effects after they're created - these will fail initially
import { autoSaveDraft, loadDraft, clearDraftOnReset } from './claim.effects';
import { ClaimDraftService } from '../services/claim-draft.service';
import { CryptoStorageService } from '../services/crypto-storage.service';
import { SecurityLoggerService } from '../services/security-logger.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Claim Effects — autoSaveDraft', () => {
  let actions$: Observable<Action>;
  let store: MockStore;
  let draftService: any;
  let cryptoStorage: any;
  let securityLogger: any;

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
    };

    cryptoStorage = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };

    securityLogger = {
      log: vi.fn(),
      getEvents: vi.fn().mockReturnValue([]),
    };

    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({
          selectors: [{ selector: selectClaimState, value: testState }],
        }),
        { provide: ClaimDraftService, useValue: draftService },
        { provide: CryptoStorageService, useValue: cryptoStorage },
        { provide: SecurityLoggerService, useValue: securityLogger },
      ],
    });

    store = TestBed.inject(MockStore);
  });

  it('saves sanitized draft to API after debounce', async () => {
    vi.useFakeTimers();
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));

    let results: Action[] = [];
    TestBed.runInInjectionContext(() => {
      const effect = autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger);
      effect.subscribe((a) => results.push(a));
    });

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(draftService.saveDraft).toHaveBeenCalledTimes(1);
    const savedDraft = draftService.saveDraft.mock.calls[0][0];
    expect(savedDraft.borrower.ssnLastFour).toBe('');
    vi.useRealTimers();
  });

  it('dispatches draftSaved on API success', async () => {
    vi.useFakeTimers();
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));

    let results: Action[] = [];
    TestBed.runInInjectionContext(() => {
      const effect = autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger);
      effect.subscribe((a) => results.push(a));
    });

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(results).toEqual([ClaimActions.draftSaved()]);
    vi.useRealTimers();
  });

  it('falls back to encrypted sessionStorage on API failure', async () => {
    vi.useFakeTimers();
    draftService.saveDraft.mockReturnValue(throwError(() => new Error('API down')));
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));

    TestBed.runInInjectionContext(() => {
      const effect = autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger);
      effect.subscribe();
    });

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(cryptoStorage.save).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('dispatches draftSaveError on API failure', async () => {
    vi.useFakeTimers();
    draftService.saveDraft.mockReturnValue(throwError(() => new Error('API down')));
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));

    let results: Action[] = [];
    TestBed.runInInjectionContext(() => {
      const effect = autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger);
      effect.subscribe((a) => results.push(a));
    });

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(results[0].type).toBe('[Claim] Draft Save Error');
    vi.useRealTimers();
  });

  it('logs PII_STRIPPED on every save', async () => {
    vi.useFakeTimers();
    actions$ = of(ClaimActions.saveBorrowerInfo({ borrower: testState.borrower }));

    TestBed.runInInjectionContext(() => {
      const effect = autoSaveDraft(actions$, store, draftService, cryptoStorage, securityLogger);
      effect.subscribe();
    });

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(securityLogger.log).toHaveBeenCalledWith('PII_STRIPPED', expect.any(String));
    vi.useRealTimers();
  });
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

  it('loads draft from API on ROOT_EFFECTS_INIT', () => {
    const mockDraft = { ...initialClaimState, currentStep: 2 };
    draftService.loadDraft.mockReturnValue(of(mockDraft));
    actions$ = of({ type: '@ngrx/effects/init' });

    let results: Action[] = [];
    TestBed.runInInjectionContext(() => {
      const effect = loadDraft(actions$, draftService, cryptoStorage);
      effect.subscribe((a) => results.push(a));
    });

    expect(results[0]).toEqual(ClaimActions.draftLoaded({ draft: mockDraft }));
  });

  it('falls back to encrypted sessionStorage on API 404', async () => {
    const mockDraft = { ...initialClaimState, currentStep: 3 };
    draftService.loadDraft.mockReturnValue(throwError(() => new Error('404')));
    cryptoStorage.load.mockResolvedValue(mockDraft);
    actions$ = of({ type: '@ngrx/effects/init' });

    let results: Action[] = [];
    TestBed.runInInjectionContext(() => {
      const effect = loadDraft(actions$, draftService, cryptoStorage);
      effect.subscribe((a) => results.push(a));
    });

    // Wait for the async fallback to resolve
    await Promise.resolve();

    expect(results[0]).toEqual(ClaimActions.draftLoaded({ draft: mockDraft }));
  });

  it('dispatches draftLoadError when both fail', async () => {
    draftService.loadDraft.mockReturnValue(throwError(() => new Error('API')));
    cryptoStorage.load.mockRejectedValue(new Error('crypto'));
    actions$ = of({ type: '@ngrx/effects/init' });

    let results: Action[] = [];
    TestBed.runInInjectionContext(() => {
      const effect = loadDraft(actions$, draftService, cryptoStorage);
      effect.subscribe((a) => results.push(a));
    });

    // Wait for the async fallback to fail
    await Promise.resolve();

    expect(results[0].type).toBe('[Claim] Draft Load Error');
  });
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

  it('clears sessionStorage on resetClaim', () => {
    actions$ = of(ClaimActions.resetClaim());

    TestBed.runInInjectionContext(() => {
      const effect = clearDraftOnReset(actions$, draftService, cryptoStorage);
      effect.subscribe();
    });

    expect(cryptoStorage.clear).toHaveBeenCalled();
  });

  it('sends reset to API on resetClaim', () => {
    actions$ = of(ClaimActions.resetClaim());

    TestBed.runInInjectionContext(() => {
      const effect = clearDraftOnReset(actions$, draftService, cryptoStorage);
      effect.subscribe();
    });

    expect(draftService.saveDraft).toHaveBeenCalledWith(initialClaimState);
  });

  it('dispatches draftSaveError if API clear fails', () => {
    draftService.saveDraft.mockReturnValue(throwError(() => new Error('fail')));
    actions$ = of(ClaimActions.resetClaim());

    let results: Action[] = [];
    TestBed.runInInjectionContext(() => {
      const effect = clearDraftOnReset(actions$, draftService, cryptoStorage);
      effect.subscribe((a) => results.push(a));
    });

    expect(results[0].type).toBe('[Claim] Draft Save Error');
    expect(cryptoStorage.clear).toHaveBeenCalled();
  });
});
