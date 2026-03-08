import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { DPoPService } from './dpop.service';

/**
 * This is a functional Angular HTTP Interceptor for DPoP.
 * 
 * Interceptors are a powerful mechanism in Angular for transforming HTTP requests
 * on their way out of the application and responses on their way in.
 * 
 * This interceptor's job is to:
 * 1. Catch every outgoing HTTP request.
 * 2. Check if the request is for our backend API.
 * 3. If it is, use the DPoPService to generate a DPoP proof.
 * 4. Attach the proof as a 'DPoP' header to the request.
 * 5. Handle "DPoP Nonce" retry: If the server returns a 401 with a new nonce,
 *    automatically retry the request with that nonce.
 */
export const dpopInterceptor: HttpInterceptorFn = (req, next) => {
  // Use Angular's dependency injection to get an instance of our DPoPService.
  const dpopService = inject(DPoPService);

  // We only want to add the DPoP header to requests going to our API,
  // not to third-party URLs or local assets.
  if (!req.url.startsWith('https://api.portal.com') && !req.url.startsWith('/api') && !req.url.includes('localhost')) {
    // If it's not an API request, pass it through without modification.
    return next(req);
  }

  // Extract the access token if present, to bind the DPoP proof to it.
  const authHeader = req.headers.get('Authorization');
  let accessToken: string | undefined;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'DPoP')) {
      accessToken = parts[1];
    }
  }

  // Helper function to create a request with a DPoP proof.
  const executeWithDPoP = (nonce?: string) => {
    return from(dpopService.getDPoPHeader(req.method, req.url, accessToken, nonce)).pipe(
      switchMap(dpopHeader => {
        let headers = req.headers.set('DPoP', dpopHeader);
        
        // If an access token was found, we must explicitly change the Authorization scheme 
        // from 'Bearer' (added by the standard auth interceptor) to 'DPoP'.
        if (accessToken) {
            headers = headers.set('Authorization', `DPoP ${accessToken}`);
        }

        const clonedReq = req.clone({
          headers: headers
        });
        return next(clonedReq);
      })
    );
  };

  return executeWithDPoP().pipe(
    catchError((error: unknown) => {
      // If the server returns a 401 Unauthorized, it might be because our 
      // DPoP nonce is missing or expired.
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Look for the 'DPoP-Nonce' header in the response.
        const nonce = error.headers.get('DPoP-Nonce');
        if (nonce) {
          // If a new nonce is provided, retry the entire process ONCE with it.
          return executeWithDPoP(nonce);
        }
      }
      // If it's not a DPoP nonce error, just pass the error through.
      return throwError(() => error);
    })
  );
};
