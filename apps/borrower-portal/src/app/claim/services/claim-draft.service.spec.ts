import { HttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimDraftService } from './claim-draft.service';
import { initialClaimState } from '../+state/claim.models';

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

  beforeEach(() => {
    patchSpy = vi.fn().mockReturnValue({ subscribe: (cb: any) => cb() });
    getSpy = vi.fn().mockReturnValue({ subscribe: (cb: any) => cb(mockDraft) });

    httpClient = {
      patch: patchSpy,
      get: getSpy,
    } as any;

    service = new ClaimDraftService(httpClient);
  });

  it('saveDraft sends PATCH to /api/claims/draft', () => {
    service.saveDraft(mockDraft);
    expect(patchSpy).toHaveBeenCalledWith('/api/claims/draft', mockDraft);
  });

  it('saveDraft calls patch with draft data', () => {
    service.saveDraft(mockDraft);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it('loadDraft sends GET to /api/claims/draft', () => {
    service.loadDraft();
    expect(getSpy).toHaveBeenCalledWith('/api/claims/draft');
  });

  it('loadDraft returns observable from get', () => {
    service.loadDraft();
    expect(getSpy).toHaveBeenCalledTimes(1);
  });
});
