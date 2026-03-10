import { TestBed } from '@angular/core/testing';
import { OnboardingStore } from './onboarding.store';
import { OnboardingService } from './onboarding.service';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

describe('OnboardingStore', () => {
  let store: OnboardingStore;
  let mockService: {
    register: Mock;
    verifyOtp: Mock;
    getPendingApprovals: Mock;
    approveUser: Mock;
    getUsers: Mock;
  };

  beforeEach(() => {
    mockService = {
      register: vi.fn(),
      verifyOtp: vi.fn(),
      getPendingApprovals: vi.fn(),
      approveUser: vi.fn(),
      getUsers: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        OnboardingStore,
        { provide: OnboardingService, useValue: mockService }
      ]
    });

    store = TestBed.inject(OnboardingStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should update status to Success on successful registration', () => {
    mockService.register.mockReturnValue(of({ userId: '123' }));
    
    store.register({ email: 'test@tai.com', firstName: 'Test', lastName: 'User', password: 'password' });
    
    expect(store.status()).toBe('Success');
    expect(store.isError()).toBe(false);
  });

  it('should update status to Error on registration failure', () => {
    const errorResponse = new HttpErrorResponse({
      error: { detail: 'Registration failed' },
      status: 400
    });
    mockService.register.mockReturnValue(throwError(() => errorResponse));
    
    store.register({ email: 'test@tai.com', firstName: 'Test', lastName: 'User', password: 'password' });
    
    expect(store.status()).toBe('Error');
    expect(store.errorMessage()).toBe('Registration failed');
  });

  it('should update status to Success on successful verification', () => {
    // Set registeredUserId first
    mockService.register.mockReturnValue(of({ userId: '123' }));
    store.register({ email: 'test@tai.com', firstName: 'Test', lastName: 'User', password: 'password' });
    
    mockService.verifyOtp.mockReturnValue(of(void 0));
    
    store.verify('123456');
    
    expect(store.status()).toBe('Success');
  });

  it('should reset status and error message on reset', () => {
    // Set an error state first
    const errorResponse = new HttpErrorResponse({
      error: { detail: 'Error' },
      status: 400
    });
    mockService.register.mockReturnValue(throwError(() => errorResponse));
    store.register({ email: 'test@tai.com', firstName: 'Test', lastName: 'User', password: 'password' });
    
    expect(store.status()).toBe('Error');
    
    store.reset();
    
    expect(store.status()).toBe('Idle');
    expect(store.errorMessage()).toBeNull();
  });

  it('should load users with pagination', () => {
    const mockResponse = {
      items: [{ id: '1', email: 'test@tai.com', name: 'Test User' }],
      totalCount: 1,
      page: 1,
      pageSize: 10
    };
    mockService.getUsers.mockReturnValue(of(mockResponse));
    
    store.loadUsers(1, 10);
    
    expect(store.allUsers()).toEqual([
      { id: '1', email: 'test@tai.com', name: 'Test User', status: 'Active' }
    ]);
    expect(store.totalUsersCount()).toBe(1);
    expect(store.currentPage()).toBe(1);
    expect(store.status()).toBe('Success');
  });
});
