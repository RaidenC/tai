import { Injectable, signal, computed, inject } from '@angular/core';
import { UsersService, User, PaginatedUsers, UserDetail } from './users.service';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

export type UsersStatus = 'Idle' | 'Loading' | 'Success' | 'Error';

/**
 * UsersStore
 * 
 * Persona: Frontend State Architect.
 * Context: Centralized signal-based state for user management.
 */
@Injectable({
  providedIn: 'root',
})
export class UsersStore {
  private readonly usersService = inject(UsersService);

  // --- Internal State (Private Signals) ---
  private readonly _users = signal<User[]>([]);
  private readonly _selectedUser = signal<UserDetail | null>(null);
  private readonly _totalCount = signal<number>(0);
  private readonly _pageIndex = signal<number>(1);
  private readonly _pageSize = signal<number>(10);
  private readonly _status = signal<UsersStatus>('Idle');
  private readonly _errorMessage = signal<string | null>(null);

  // --- Public Read-Only State (Exposed Signals) ---
  public readonly users = this._users.asReadonly();
  public readonly selectedUser = this._selectedUser.asReadonly();
  public readonly totalCount = this._totalCount.asReadonly();
  public readonly pageIndex = this._pageIndex.asReadonly();
  public readonly pageSize = this._pageSize.asReadonly();
  public readonly status = this._status.asReadonly();
  public readonly errorMessage = this._errorMessage.asReadonly();

  // --- Derived State (Computed Signals) ---
  public readonly isLoading = computed(() => this._status() === 'Loading');
  public readonly isError = computed(() => this._status() === 'Error');

  /**
   * Loads the list of users with pagination.
   */
  public loadUsers(pageIndex?: number, pageSize?: number): void {
    if (pageIndex) this._pageIndex.set(pageIndex);
    if (pageSize) this._pageSize.set(pageSize);

    this._status.set('Loading');
    this._errorMessage.set(null);

    this.usersService.getUsers(this._pageIndex(), this._pageSize())
      .pipe(finalize(() => {
        // Status remains Success or Error after completion
      }))
      .subscribe({
        next: (response: PaginatedUsers) => {
          this._users.set(response.items);
          this._totalCount.set(response.totalCount);
          this._status.set('Success');
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Failed to load users.');
        }
      });
  }

  /**
   * Loads a single user by ID.
   */
  public loadUser(id: string): void {
    this._status.set('Loading');
    this._errorMessage.set(null);

    this.usersService.getUserById(id)
      .subscribe({
        next: (user) => {
          this._selectedUser.set(user);
          this._status.set('Success');
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Failed to load user.');
        }
      });
  }

  /**
   * Updates a user profile.
   */
  public updateUser(id: string, userData: Partial<User>, rowVersion: number): void {
    this._status.set('Loading');
    this._errorMessage.set(null);

    this.usersService.updateUser(id, userData, rowVersion)
      .subscribe({
        next: () => {
          this._status.set('Success');
          this.loadUser(id); // Reload to get fresh data/xmin
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Failed to update user.');
        }
      });
  }

  /**
   * Approves a user and refreshes the current page.
   */
  public approveUser(userId: string, rowVersion: number): void {
    this._status.set('Loading');
    this._errorMessage.set(null);

    this.usersService.approveUser(userId, rowVersion)
      .subscribe({
        next: () => {
          this.loadUsers(); // Refresh the list
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Failed to approve user.');
        }
      });
  }

  public setPage(pageIndex: number): void {
    this.loadUsers(pageIndex);
  }

  public reset(): void {
    this._status.set('Idle');
    this._errorMessage.set(null);
    this._selectedUser.set(null);
  }
}
