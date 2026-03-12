import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OnboardingService, PendingUser, PaginatedUsers } from './onboarding.service';
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
    req.flush(null);
  });

  it('should fetch pending approvals', () => {
    const mockUsers: PendingUser[] = [{ id: '1', email: 'test@tai.com', name: 'Test' }];

    service.getPendingApprovals().subscribe(users => {
      expect(users).toEqual(mockUsers);
    });

    const req = httpMock.expectOne('/api/onboarding/pending-approvals');
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers);
  });

  it('should approve a user', () => {
    service.approveUser('user-1').subscribe();

    const req = httpMock.expectOne('/api/onboarding/approve');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetUserId: 'user-1' });
    req.flush(null);
  });

  it('should fetch users with pagination', () => {
    const mockResponse: PaginatedUsers = {
      items: [{ id: '1', email: 'test@tai.com', name: 'Test' }],
      totalCount: 1,
      page: 1,
      pageSize: 10
    };

    service.getUsers(2, 20).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/users?page=2&pageSize=20');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
