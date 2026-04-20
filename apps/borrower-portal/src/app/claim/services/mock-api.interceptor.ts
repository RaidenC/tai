import {
  HttpInterceptorFn,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';

/**
 * In-memory store simulating a real backend for the draft API.
 *
 * SECURITY: We intentionally do NOT use sessionStorage here. The spec
 * forbids any unencrypted persistence of draft PII. The crypto fallback
 * path (CryptoStorageService) is the only authorized cross-refresh store
 * and it uses AES-GCM. This mock only lives for the lifetime of the tab.
 *
 * TO TEST FAILURE FALLBACK:
 *   sessionStorage.setItem('__mock_fail__', 'true')
 * To re-enable success:
 *   sessionStorage.removeItem('__mock_fail__')
 */
const draftStore = new Map<string, DisabilityClaimDraft>();
const MOCK_USER_ID = 'mock-user-001';

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  // Toggle failure mode via: sessionStorage.setItem('__mock_fail__', 'true')
  // To disable: sessionStorage.removeItem('__mock_fail__')
  const shouldFail = sessionStorage.getItem('__mock_fail__') === 'true';

  if (req.url === '/api/claims/draft') {
    if (shouldFail) {
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Internal Server Error',
            url: req.url,
          }),
      );
    }
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
