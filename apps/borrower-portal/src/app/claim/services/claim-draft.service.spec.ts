import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimDraftService } from './claim-draft.service';
import { initialClaimState } from '../+state/claim.models';

// Mock environment before importing service
vi.mock('../../../environments/environment', () => ({
  environment: {
    apiBaseUrl: 'http://localhost:5180/api',
    production: false,
  },
}));

describe('ClaimDraftService', () => {
  let service: ClaimDraftService;
  let httpClient: HttpClient;
  let patchSpy: ReturnType<typeof vi.fn>;
  let getSpy: ReturnType<typeof vi.fn>;

  const mockDraft = {
    ...initialClaimState,
    currentStep: 2,
    borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
  } as any;

  beforeEach(async () => {
    patchSpy = vi.fn().mockReturnValue(of(undefined));
    getSpy = vi.fn().mockReturnValue(of({ encryptedPayload: 'dGVzdA==' }));

    const TestProvider = {
      provide: HttpClient,
      useValue: {
        patch: patchSpy,
        get: getSpy,
      },
    };

    TestBed.configureTestingModule({
      providers: [ClaimDraftService, TestProvider],
    });

    service = TestBed.inject(ClaimDraftService);
    httpClient = TestBed.inject(HttpClient);
  });

  it('saveDraft sends PATCH to claims/draft endpoint', () => {
    service.saveDraft(mockDraft);
    expect(patchSpy).toHaveBeenCalled();
    const callArgs = patchSpy.mock.calls[0];
    expect(callArgs[0]).toContain('/claims/draft');
    expect(callArgs[1]).toHaveProperty('claimId', 'current');
  });

  it('saveDraft calls patch with draft data', () => {
    service.saveDraft(mockDraft);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it('loadDraft sends GET to claims/draft endpoint', () => {
    service.loadDraft();
    expect(getSpy).toHaveBeenCalled();
    expect(getSpy.mock.calls[0][0]).toContain('/claims/draft/current');
  });

  it('loadDraft returns observable from get', () => {
    service.loadDraft();
    expect(getSpy).toHaveBeenCalledTimes(1);
  });
});
