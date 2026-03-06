import { Injectable, signal, computed, inject } from '@angular/core';
import { OnboardingService, RegistrationRequest, PendingUser } from './onboarding.service';
import { finalize } from 'rxjs';

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
  private readonly _status = signal<OnboardingStatus>('Idle');
  private readonly _errorMessage = signal<string | null>(null);

  // --- Public Read-Only State (Exposed Signals) ---
  public readonly pendingUsers = this._pendingUsers.asReadonly();
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
        next: () => {
          this._status.set('Success');
        },
        error: (err) => {
          this._status.set('Error');
          this._errorMessage.set(err.message || 'Registration failed.');
        }
      });
  }

  /**
   * Verifies the OTP and transitions the state.
   */
  public verify(code: string): void {
    this._status.set('Loading');
    this._errorMessage.set(null);

    this.onboardingService.verifyOtp(code)
      .subscribe({
        next: () => {
          this._status.set('Success');
        },
        error: (err) => {
          this._status.set('Error');
          this._errorMessage.set(err.message || 'Verification failed.');
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
        error: (err) => {
          this._status.set('Error');
          this._errorMessage.set(err.message || 'Failed to load pending users.');
        }
      });
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
        error: (err) => {
          this._status.set('Error');
          this._errorMessage.set(err.message || 'Approval failed.');
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
