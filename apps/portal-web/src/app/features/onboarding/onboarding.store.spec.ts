import { TestBed } from '@angular/core/testing';
import { OnboardingStore } from './onboarding.store';
import { OnboardingService, PendingUser } from './onboarding.service';
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

  it('should update status to Success on successful verification', () => {
    // Set registeredUserId first
    mockService.register.mockReturnValue(of({ userId: '123' }));
    store.register({ email: 'test@tai.com', firstName: 'Test', lastName: 'User' });

    mockService.verifyOtp.mockReturnValue(of(void 0));
    store.verify('123456');

    expect(store.status()).toBe('Success');
  });

  it('should handle verification errors', () => {
    mockService.register.mockReturnValue(of({ userId: '123' }));
    store.register({ email: 'test@tai.com', firstName: 'Test', lastName: 'User' });

    const errorResponse = new HttpErrorResponse({
      error: { detail: 'Invalid OTP' },
      status: 400
    });
    mockService.verifyOtp.mockReturnValue(throwError(() => errorResponse));

    store.verify('wrong');

    expect(store.status()).toBe('Error');
    expect(store.errorMessage()).toBe('Invalid OTP');
  });

  it('should handle verification when no userId exists', () => {
    store.verify('123456');
    expect(store.status()).toBe('Error');
    expect(store.errorMessage()).toBe('No user ID found. Please register first.');
  });

  it('should load pending approvals', () => {
    const mockUsers: PendingUser[] = [{ id: '1', email: 'test@tai.com', name: 'Test' }];
    mockService.getPendingApprovals.mockReturnValue(of(mockUsers));

    store.loadPendingApprovals();

    expect(store.pendingUsers()).toEqual(mockUsers);
    expect(store.status()).toBe('Success');
  });

  it('should approve a user and refresh pending list', () => {
    mockService.approveUser.mockReturnValue(of(void 0));
    mockService.getPendingApprovals.mockReturnValue(of([]));

    store.approve('user-1');

    expect(mockService.approveUser).toHaveBeenCalledWith('user-1');
    expect(mockService.getPendingApprovals).toHaveBeenCalled();
  });

  it('should handle errors during approval', () => {
    const errorResponse = new HttpErrorResponse({
      error: { detail: 'Approval Failed' },
      status: 403
    });
    mockService.approveUser.mockReturnValue(throwError(() => errorResponse));

    store.approve('user-1');

    expect(store.status()).toBe('Error');
    expect(store.errorMessage()).toBe('Approval Failed');
  });

  it('should handle loadUsers errors with fallback message', () => {
    const errorResponse = new HttpErrorResponse({
      error: {}, // No detail
      status: 500
    });
    mockService.getUsers.mockReturnValue(throwError(() => errorResponse));

    store.loadUsers();

    expect(store.errorMessage()).toBe('Failed to load users.');
  });

  it('should handle registration validation errors', () => {
    const errorResponse = new HttpErrorResponse({
      error: { errors: { field: ['Error 1', 'Error 2'] } },
      status: 400
    });
    mockService.register.mockReturnValue(throwError(() => errorResponse));

    store.register({ email: 'test@tai.com', firstName: 'Test', lastName: 'User' });

    expect(store.errorMessage()).toBe('Error 1, Error 2');
  });

  it('should load users with legacy array response', () => {
    const mockArray = [{ id: '1', email: 'legacy@tai.com', name: 'Legacy' }];
    mockService.getUsers.mockReturnValue(of(mockArray));

    store.loadUsers(1, 10);

    expect(store.allUsers().length).toBe(1);
    expect(store.totalUsersCount()).toBe(1);
    expect(store.allUsers()[0].email).toBe('legacy@tai.com');
  });

  it('should navigate to next and previous pages', () => {
    const mockResponse = { items: [], totalCount: 25 };
    mockService.getUsers.mockReturnValue(of(mockResponse));

    // Page 1 -> 2
    store.loadUsers(1, 10);
    store.nextPage();
    expect(store.currentPage()).toBe(2);
    expect(mockService.getUsers).toHaveBeenCalledWith(2, 10);

    // Page 2 -> 1
    store.prevPage();
    expect(store.currentPage()).toBe(1);
    expect(mockService.getUsers).toHaveBeenCalledWith(1, 10);
  });

  it('should not navigate past page boundaries', () => {
    const mockResponse = { items: [], totalCount: 5 }; // Only 1 page
    mockService.getUsers.mockReturnValue(of(mockResponse));

    store.loadUsers(1, 10);
    store.nextPage();
    expect(store.currentPage()).toBe(1); // Stayed on 1

    store.prevPage();
    expect(store.currentPage()).toBe(1); // Stayed on 1
  });

  it('should fallback to default values during user mapping', () => {
    const mockResponse = {
      items: [{ status: 'Pending' }], // Missing id, name, email
      totalCount: 1
    };
    mockService.getUsers.mockReturnValue(of(mockResponse));

    store.loadUsers();

    const user = store.allUsers()[0];
    expect(user.id).toBeDefined();
    expect(user.email).toBe('No Email');
    expect(user.name).toBe('No Name');
    expect(user.status).toBe('Pending');
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
