import { Injectable, signal, computed, inject } from '@angular/core';
import { OnboardingService, RegistrationRequest, PendingUser } from './onboarding.service';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

export type OnboardingStatus = 'Idle' | 'Loading' | 'Success' | 'Error';

/**
 * OnboardingStore
 * 
 * Persona: Frontend State Architect.
 * Context: Centralized signal-based state for onboarding workflows.
 * 
 * Features:
 * 1. Reactive state management using Angular 21 Signals.
 * 2. Encapsulation of side effects (API calls) within the store layer.
 * 3. Derived state (computed) for loading and error UI bindings.
 */
@Injectable({
  providedIn: 'root',
})
export class OnboardingStore {
  private readonly onboardingService = inject(OnboardingService);

  // --- Internal State (Private Signals) ---
  private readonly _pendingUsers = signal<PendingUser[]>([]);
  private readonly _allUsers = signal<PendingUser[]>([]);
  private readonly _totalUsersCount = signal<number>(0);
  private readonly _currentPage = signal<number>(1);
  private readonly _pageSize = signal<number>(10);
  private readonly _status = signal<OnboardingStatus>('Idle');
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _registeredUserId = signal<string | null>(null);

  // --- Public Read-Only State (Exposed Signals) ---
  public readonly pendingUsers = this._pendingUsers.asReadonly();
  public readonly allUsers = this._allUsers.asReadonly();
  public readonly totalUsersCount = this._totalUsersCount.asReadonly();
  public readonly currentPage = this._currentPage.asReadonly();
  public readonly pageSize = this._pageSize.asReadonly();
  public readonly status = this._status.asReadonly();
  public readonly errorMessage = this._errorMessage.asReadonly();

  // --- Derived State (Computed Signals) ---
  public readonly isLoading = computed(() => this._status() === 'Loading');
  public readonly isError = computed(() => this._status() === 'Error');

  /**
   * Registers a new customer and updates the store state.
   */
  public register(request: RegistrationRequest): void {
    this._status.set('Loading');
    this._errorMessage.set(null);

    this.onboardingService.register(request)
      .pipe(finalize(() => {
        // Status remains 'Success' or 'Error' after completion
      }))
      .subscribe({
        next: (response: { userId: string }) => {
          this._registeredUserId.set(response.userId);
          this._status.set('Success');
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          let message = 'Registration failed.';
          if (err.error?.detail) {
            message = err.error.detail;
          } else if (err.error?.errors) {
            message = Object.values(err.error.errors).flat().join(', ');
          }
          this._errorMessage.set(message);
        }
      });
  }

  /**
   * Verifies the OTP and transitions the state.
   */
  public verify(code: string): void {
    const userId = this._registeredUserId();
    if (!userId) {
      this._status.set('Error');
      this._errorMessage.set('No user ID found. Please register first.');
      return;
    }

    this._status.set('Loading');
    this._errorMessage.set(null);

    this.onboardingService.verifyOtp(userId, code)
      .subscribe({
        next: () => {
          this._status.set('Success');
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          let message = 'Verification failed.';
          if (err.error?.detail) {
            message = err.error.detail;
          }
          this._errorMessage.set(message);
        }
      });
  }

  /**
   * Refreshes the list of pending approvals.
   */
  public loadPendingApprovals(): void {
    this._status.set('Loading');
    
    this.onboardingService.getPendingApprovals()
      .subscribe({
        next: (users) => {
          this._pendingUsers.set(users);
          this._status.set('Success');
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Failed to load pending users.');
        }
      });
  }

  /**
   * Refreshes the list of all users with pagination.
   */
  public loadUsers(page?: number, pageSize?: number): void {
    if (page) this._currentPage.set(page);
    if (pageSize) this._pageSize.set(pageSize);

    this._status.set('Loading');
    
    this.onboardingService.getUsers(this._currentPage(), this._pageSize())
      .subscribe({
        next: (response: Record<string, unknown> | unknown[]) => {
          let rawItems: unknown[] = [];
          let totalCount = 0;

          if (Array.isArray(response)) {
            // Old behavior: response is the array
            rawItems = response;
            totalCount = response.length;
          } else if (response && typeof response === 'object') {
            const r = response as Record<string, unknown>;
            // New behavior: response is PaginatedList
            rawItems = (r['items'] || r['Items'] || []) as unknown[];
            totalCount = (r['totalCount'] ?? r['TotalCount'] ?? 0) as number;
          }

          const items: PendingUser[] = rawItems.map((u: unknown) => {
            const obj = u as Record<string, unknown>;
            return {
              id: (obj['id'] || obj['Id'] || Math.random().toString()) as string, // Ensure we have an ID for tracking
              email: (obj['email'] || obj['Email'] || 'No Email') as string,
              name: (obj['name'] || obj['Name'] || 'No Name') as string,
              status: (obj['status'] || obj['Status'] || 'Active') as string
            };
          });
          
          this._allUsers.set(items);
          this._totalUsersCount.set(totalCount);
          this._status.set('Success');
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Failed to load users.');
        }
      });
  }

  public nextPage(): void {
    const totalPages = Math.ceil(this._totalUsersCount() / this._pageSize());
    if (this._currentPage() < totalPages) {
      this.loadUsers(this._currentPage() + 1);
    }
  }

  public prevPage(): void {
    if (this._currentPage() > 1) {
      this.loadUsers(this._currentPage() - 1);
    }
  }

  /**
   * Approves a user and refreshes the list.
   */
  public approve(userId: string): void {
    this._status.set('Loading');

    this.onboardingService.approveUser(userId)
      .subscribe({
        next: () => {
          this.loadPendingApprovals(); // Refresh the list after successful approval
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Approval failed.');
        }
      });
  }

  /**
   * Resets the store status to Idle.
   */
  public reset(): void {
    this._status.set('Idle');
    this._errorMessage.set(null);
  }
}