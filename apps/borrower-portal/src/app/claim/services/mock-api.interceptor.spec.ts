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
    mockNext = makeNext();
  });

  afterEach(() => {
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
