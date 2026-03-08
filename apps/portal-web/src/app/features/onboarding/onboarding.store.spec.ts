import { TestBed } from '@angular/core/testing';
import { OnboardingStore } from './onboarding.store';
import { OnboardingService } from './onboarding.service';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OnboardingStore', () => {
  let store: OnboardingStore;
  let onboardingServiceMock: any;

  beforeEach(() => {
    onboardingServiceMock = {
      register: vi.fn().mockReturnValue(of({})),
      verifyOtp: vi.fn().mockReturnValue(of({})),
      getPendingApprovals: vi.fn().mockReturnValue(of([])),
      approveUser: vi.fn().mockReturnValue(of({})),
    };

    TestBed.configureTestingModule({
      providers: [
        OnboardingStore,
        { provide: OnboardingService, useValue: onboardingServiceMock },
      ],
    });

    store = TestBed.inject(OnboardingStore);
  });

  it('should initialize with idle status', () => {
    expect(store.status()).toBe('Idle');
    expect(store.isLoading()).toBe(false);
    expect(store.isError()).toBe(false);
  });

  it('should update status to Success after registration', () => {
    onboardingServiceMock.register.mockReturnValue(of({}));
    
    store.register({ email: 'test@example.com', firstName: 'Jane', lastName: 'Doe' });
    
    expect(store.status()).toBe('Success');
  });

  it('should update status to Error on registration failure', () => {
    const errorResponse = {
        error: { detail: 'Server error' }
    };
    onboardingServiceMock.register.mockReturnValue(throwError(() => errorResponse));
    
    store.register({ email: 'test@example.com', firstName: 'Jane', lastName: 'Doe' });
    
    expect(store.status()).toBe('Error');
    expect(store.errorMessage()).toBe('Server error');
  });

  it('should load pending users and update signals', () => {
    const mockUsers = [{ id: '1', email: 'jdoe@tai.com', name: 'Jane Doe' }];
    onboardingServiceMock.getPendingApprovals.mockReturnValue(of(mockUsers));
    
    store.loadPendingApprovals();
    
    expect(store.status()).toBe('Success');
    expect(store.pendingUsers()).toEqual(mockUsers);
  });

  it('should refresh the list after approval', () => {
    onboardingServiceMock.approveUser.mockReturnValue(of({}));
    const loadSpy = vi.spyOn(store, 'loadPendingApprovals');
    
    store.approve('user123');
    
    expect(loadSpy).toHaveBeenCalled();
  });
});
