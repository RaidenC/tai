import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OnboardingService } from './onboarding.service';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OnboardingService],
    });

    service = TestBed.inject(OnboardingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call register', () => {
    const request = { email: 'test@example.com', firstName: 'Jane', lastName: 'Doe' };
    service.register(request).subscribe();

    const req = httpMock.expectOne('/api/onboarding/register');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should call verifyOtp', () => {
    service.verifyOtp('user123', '123456').subscribe();
    const req = httpMock.expectOne('/api/onboarding/verify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'user123', code: '123456' });
    req.flush({});
  });

  it('should fetch pending approvals', () => {
    const mockPendingUsers = [{ id: '1', email: 'test@example.com', name: 'Test User' }];
    service.getPendingApprovals().subscribe((users) => {
      expect(users).toEqual(mockPendingUsers);
    });

    const req = httpMock.expectOne('/api/onboarding/pending-approvals');
    expect(req.request.method).toBe('GET');
    req.flush(mockPendingUsers);
  });
});
