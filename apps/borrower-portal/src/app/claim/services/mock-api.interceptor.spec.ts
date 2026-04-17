import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockApiInterceptor } from './mock-api.interceptor';
import { initialClaimState } from '../+state/claim.models';
import { HttpRequest, HttpHandlerFn, HttpEvent, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

// Test data
const draft = {
  ...initialClaimState,
  borrower: { ...initialClaimState.borrower, firstName: 'Jane' },
} as any;

describe('mockApiInterceptor', () => {
  let mockNext: HttpHandlerFn;

  beforeEach(() => {
    mockNext = vi.fn((req: HttpRequest<any>): import('@angular/common/http').HttpEvent<any> => {
      return of({} as import('@angular/common/http').HttpEvent<any>);
    });
  });

  it('GET /api/claims/draft throws error when no draft is stored', () => {
    // Run this test FIRST before any PATCH stores a draft
    const req = new HttpRequest('GET', '/api/claims/draft');

    let errorThrown = false;
    mockApiInterceptor(req, mockNext).subscribe({
      error: (err) => {
        errorThrown = true;
        // Should be 404
        expect(err.status).toBe(404);
      },
    });

    // The interceptor should throw an error, not call next
    expect(errorThrown).toBe(true);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('PATCH /api/claims/draft stores draft and returns 204', () => {
    const req = new HttpRequest('PATCH', '/api/claims/draft', draft);
    const result = mockApiInterceptor(req, mockNext);

    let hasResponse = false;
    result.subscribe((event) => {
      if (event instanceof HttpResponse) {
        hasResponse = true;
        expect(event.status).toBe(204);
      }
    });

    expect(hasResponse).toBe(true);
  });

  it('GET /api/claims/draft returns saved draft after PATCH', () => {
    // First store the draft
    const patchReq = new HttpRequest('PATCH', '/api/claims/draft', draft);
    mockApiInterceptor(patchReq, mockNext).subscribe();

    // Then retrieve it
    const getReq = new HttpRequest('GET', '/api/claims/draft');
    let body: any = null;
    mockApiInterceptor(getReq, mockNext).subscribe({
      next: (event) => {
        if (event instanceof HttpResponse) {
          body = event.body;
        }
      },
    });

    expect(body).toEqual(draft);
  });

  it('PATCH overwrites previous draft', () => {
    const draftB = { ...draft, currentStep: 3 };

    // First PATCH with original draft
    const req1 = new HttpRequest('PATCH', '/api/claims/draft', draft);
    mockApiInterceptor(req1, mockNext).subscribe();

    // Second PATCH with overwritten draft
    const req2 = new HttpRequest('PATCH', '/api/claims/draft', draftB);
    mockApiInterceptor(req2, mockNext).subscribe();

    // GET should return the overwritten draft
    const getReq = new HttpRequest('GET', '/api/claims/draft');
    let body: any = null;
    mockApiInterceptor(getReq, mockNext).subscribe({
      next: (event) => {
        if (event instanceof HttpResponse) {
          body = event.body;
        }
      },
    });

    expect(body.currentStep).toBe(3);
  });

  it('non-matching URLs pass through', () => {
    const req = new HttpRequest('GET', '/api/other');

    mockApiInterceptor(req, mockNext);

    expect(mockNext).toHaveBeenCalledWith(req);
  });
});
