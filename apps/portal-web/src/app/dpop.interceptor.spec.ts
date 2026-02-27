import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { dpopInterceptor } from './dpop.interceptor';
import { DPoPService } from './dpop.service';
import { firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

/**
 * DPoP Interceptor Unit Tests
 * 
 * JUNIOR RATIONALE: This test file checks that our "Security Guard" (the Interceptor) 
 * is correctly stamping outgoing requests with a "Proof of Possession" (DPoP) ticket.
 * We want to make sure it only stamps requests going to OUR server, not others,
 * and that it doesn't crash the app if the stamping process fails.
 */
describe('dpopInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let dpopServiceSpy: {
    getDPoPHeader: Mock;
  };

  beforeEach(() => {
    // JUNIOR RATIONALE: We reset the testing environment before each test to 
    // ensure they don't interfere with each other. It's like clearing the 
    // whiteboard before starting a new problem.
    TestBed.resetTestingModule();

    // JUNIOR RATIONALE: We don't want to run the real cryptographic logic 
    // in our unit tests—it's slow and complex. Instead, we create a "Spy" 
    // (a mock) that just returns a fixed string we can look for.
    dpopServiceSpy = {
      getDPoPHeader: vi.fn().mockResolvedValue('mock-dpop-jwt')
    };

    TestBed.configureTestingModule({
      providers: [
        // We tell Angular to use our interceptor for all HTTP calls during the test.
        provideHttpClient(withInterceptors([dpopInterceptor])),
        // This is a "fake" backend that lets us intercept and inspect requests 
        // without actually sending them over the internet.
        provideHttpClientTesting(),
        // We tell Angular: "When someone asks for DPoPService, give them our Spy instead."
        { provide: DPoPService, useValue: dpopServiceSpy }
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // JUNIOR RATIONALE: After each test, we verify that there are no 
    // "dangling" requests. Every request we started must have been 
    // handled. It's a way to find bugs where we accidentally fire extra requests.
    httpMock.verify();
  });

  it('should add DPoP header to localhost API requests', async () => {
    // 1. Arrange & Act: Fire off a request to our local API.
    const requestObservable = httpClient.get('http://localhost:5217/api/data');
    const requestPromise = firstValueFrom(requestObservable);

    // JUNIOR RATIONALE: Our interceptor is 'async' (it uses a Promise to get the header).
    // JavaScript needs a tiny "tick" of time to process that async work. 
    // setTimeout(resolve, 0) lets the interceptor finish its job before we check the result.
    await new Promise(resolve => setTimeout(resolve, 0));

    // 2. Assert: Find the request in our fake backend and inspect it.
    const req = httpMock.expectOne('http://localhost:5217/api/data');
    
    // Check if the 'DPoP' header was added.
    expect(req.request.headers.has('DPoP')).toBe(true);
    // Check if it has the value our Spy promised to return.
    expect(req.request.headers.get('DPoP')).toBe('mock-dpop-jwt');
    
    // Clean up by responding to the fake request.
    req.flush({});
    await requestPromise;
  });

      it('should handle DPoP generation failure gracefully', async () => {
        // JUNIOR RATIONALE: What if the user's computer is too old or has 
        // broken crypto settings? We want to make sure the app reports 
        // an error instead of hanging or sending an unsecure request.
        
        // Force our Spy to fail.
        dpopServiceSpy.getDPoPHeader.mockRejectedValue(new Error('Crypto Error'));
  
        const requestObservable = httpClient.get('/api/secure');
  
        // JUNIOR RATIONALE: Our interceptor is 'async'. We expect the request 
        // to fail because the crypto part failed.
        await expect(firstValueFrom(requestObservable)).rejects.toThrow('Crypto Error');
  
        // IMPORTANT: If the header generation fails, the interceptor should 
        // BLOCK the request from ever leaving the browser.
        httpMock.expectNone('/api/secure');
      });
  it('should retry request with new nonce when server returns 401 with DPoP-Nonce', async () => {
    /**
     * JUNIOR RATIONALE: DPoP can use a "Nonce" (a single-use number) to prevent 
     * replay attacks. If the server says "Hey, your nonce is expired, use this 
     * new one instead," our interceptor should automatically try again with 
     * the new nonce without the user ever noticing.
     */
    
    // 1. Initial Request
    const requestPromise = firstValueFrom(httpClient.get('/api/secure-data'));
    await new Promise(resolve => setTimeout(resolve, 0));

    // 2. Mock Server returns 401 with DPoP-Nonce header
    const firstReq = httpMock.expectOne('/api/secure-data');
    firstReq.flush('Use a nonce!', {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'DPoP-Nonce': 'fresh-new-nonce' }
    });

    // JUNIOR RATIONALE: At this point, the test will FAIL because the 
    // current dpopInterceptor does NOT yet support retries.
    // This is the "Red" phase of Test Driven Development.
    
    // 3. We expect a SECOND request to be made automatically
    await new Promise(resolve => setTimeout(resolve, 0));
    const secondReq = httpMock.expectOne('/api/secure-data');
    
    // The second request should have been generated with the new nonce.
    // Note: We'd need to update DPoPService to accept nonces for this to fully work.
    expect(dpopServiceSpy.getDPoPHeader).toHaveBeenCalledTimes(2);
    
    secondReq.flush({ success: true });
    const response = await requestPromise;
    expect(response).toEqual({ success: true });
  });
});
