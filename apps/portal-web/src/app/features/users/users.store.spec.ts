import { TestBed } from '@angular/core/testing';
import { UsersStore } from './users.store';
import { UsersService, User, PaginatedUsers } from './users.service';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('UsersStore', () => {
  let store: UsersStore;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getUsers: vi.fn(),
      approveUser: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        UsersStore,
        { provide: UsersService, useValue: mockService }
      ]
    });
    store = TestBed.inject(UsersStore);
  });

  it('should be created in Idle state', () => {
    expect(store).toBeTruthy();
    expect(store.status()).toBe('Idle');
    expect(store.isLoading()).toBe(false);
  });

  it('should load users successfully', () => {
    const mockResponse: PaginatedUsers = {
      items: [{ id: '1', name: 'John', email: 'john@tai.com', status: 'Active', rowVersion: 1 }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 10
    };
    mockService.getUsers.mockReturnValue(of(mockResponse));

    store.loadUsers(1, 10);

    expect(store.status()).toBe('Success');
    expect(store.users()).toEqual(mockResponse.items);
    expect(store.totalCount()).toBe(1);
    expect(store.pageIndex()).toBe(1);
  });

  it('should handle API errors when loading users', () => {
    const errorResponse = new HttpErrorResponse({
      error: { detail: 'Server Error' },
      status: 500
    });
    mockService.getUsers.mockReturnValue(throwError(() => errorResponse));

    store.loadUsers();

    expect(store.status()).toBe('Error');
    expect(store.errorMessage()).toBe('Server Error');
    expect(store.isError()).toBe(true);
  });

  it('should handle generic error without detail', () => {
    const errorResponse = new HttpErrorResponse({
      error: {}, // No detail
      status: 500
    });
    mockService.getUsers.mockReturnValue(throwError(() => errorResponse));

    store.loadUsers();

    expect(store.errorMessage()).toBe('Failed to load users.');
  });

  it('should handle generic error during approval', () => {
    const errorResponse = new HttpErrorResponse({
      error: {}, 
      status: 500
    });
    mockService.approveUser.mockReturnValue(throwError(() => errorResponse));

    store.approveUser('1', 1);

    expect(store.errorMessage()).toBe('Failed to approve user.');
  });

  it('should load users with default parameters', () => {
    const mockResponse: PaginatedUsers = {
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 10
    };
    mockService.getUsers.mockReturnValue(of(mockResponse));

    store.loadUsers();

    expect(mockService.getUsers).toHaveBeenCalledWith(1, 10);
  });

  it('should approve a user and refresh the list', () => {
    mockService.approveUser.mockReturnValue(of(void 0));
    
    // Setup initial state and mock a refresh
    const mockResponse: PaginatedUsers = {
      items: [{ id: '1', name: 'John', email: 'john@tai.com', status: 'Active', rowVersion: 1 }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 10
    };
    mockService.getUsers.mockReturnValue(of(mockResponse));

    store.approveUser('user-1', 123);

    expect(mockService.approveUser).toHaveBeenCalledWith('user-1', 123);
    expect(mockService.getUsers).toHaveBeenCalled();
  });

  it('should set page and refresh users', () => {
    mockService.getUsers.mockReturnValue(of({ items: [], totalCount: 0, pageNumber: 2, pageSize: 10 }));
    
    store.setPage(2);
    
    expect(store.pageIndex()).toBe(2);
    expect(mockService.getUsers).toHaveBeenCalledWith(2, 10);
  });

  it('should reset state on reset()', () => {
    // Set error state
    (store as any)._status.set('Error');
    (store as any)._errorMessage.set('Fail');
    
    store.reset();
    
    expect(store.status()).toBe('Idle');
    expect(store.errorMessage()).toBeNull();
  });
});
