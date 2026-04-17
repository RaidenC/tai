import {
  HttpInterceptorFn,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';

const draftStore = new Map<string, DisabilityClaimDraft>();
const MOCK_USER_ID = 'mock-user-001';

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/claims/draft') {
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
