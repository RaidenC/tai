import { Injectable, signal, computed, inject } from '@angular/core';
import { PrivilegesService, Privilege, PaginatedList } from './privileges.service';
import { HttpErrorResponse } from '@angular/common/http';

export type PrivilegesStatus = 'Idle' | 'Loading' | 'Success' | 'Error' | 'StepUpRequired';

/**
 * PrivilegesStore
 * 
 * Centralized signal-based state for privilege catalog management.
 */
@Injectable({
  providedIn: 'root',
})
export class PrivilegesStore {
  private readonly privilegesService = inject(PrivilegesService);

  // --- Internal State ---
  private readonly _privileges = signal<Privilege[]>([]);
  private readonly _selectedPrivilege = signal<Privilege | null>(null);
  private readonly _totalCount = signal<number>(0);
  private readonly _pageIndex = signal<number>(1);
  private readonly _pageSize = signal<number>(10);
  private readonly _search = signal<string | null>(null);
  private readonly _status = signal<PrivilegesStatus>('Idle');
  private readonly _errorMessage = signal<string | null>(null);

  // --- Public State ---
  public readonly privileges = this._privileges.asReadonly();
  public readonly selectedPrivilege = this._selectedPrivilege.asReadonly();
  public readonly totalCount = this._totalCount.asReadonly();
  public readonly pageIndex = this._pageIndex.asReadonly();
  public readonly pageSize = this._pageSize.asReadonly();
  public readonly search = this._search.asReadonly();
  public readonly status = this._status.asReadonly();
  public readonly errorMessage = this._errorMessage.asReadonly();

  // --- Mocked Licensed Modules (UI-Side Prototype) ---
  // In a real system, this would come from a 'TenantConfigurationService' or OIDC claims.
  private readonly _licensedModules = signal<string[]>(['Portal', 'LoanOrigination', 'Wires', 'System']);

  // --- Derived State ---
  public readonly isLoading = computed(() => this._status() === 'Loading');
  public readonly isError = computed(() => this._status() === 'Error');
  public readonly isStepUpRequired = computed(() => this._status() === 'StepUpRequired');

  /**
   * Filtered Privileges
   */
  public readonly filteredPrivileges = computed(() => this._privileges());

  /**
   * Loads the list of privileges.
   */
  public loadPrivileges(pageIndex?: number, pageSize?: number, search?: string): void {
    if (pageIndex !== undefined) this._pageIndex.set(pageIndex);
    if (pageSize !== undefined) this._pageSize.set(pageSize);
    if (search !== undefined) this._search.set(search || null);

    this._status.set('Loading');
    this._errorMessage.set(null);

    // Pass the mock licensed modules to the backend so pagination matches the exact count.
    const modules = this._licensedModules();

    this.privilegesService.getPrivileges(this._pageIndex(), this._pageSize(), this._search() || undefined, modules)
      .subscribe({
        next: (response: PaginatedList<Privilege>) => {
          this._privileges.set(response.items);
          this._totalCount.set(response.totalCount);
          this._status.set('Success');
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Failed to load privileges.');
        }
      });
  }

  /**
   * Loads a single privilege.
   */
  public loadPrivilege(id: string): void {
    this._status.set('Loading');
    this._errorMessage.set(null);

    this.privilegesService.getPrivilegeById(id)
      .subscribe({
        next: (privilege) => {
          this._selectedPrivilege.set(privilege);
          this._status.set('Success');
        },
        error: (err: HttpErrorResponse) => {
          this._status.set('Error');
          this._errorMessage.set(err.error?.detail || 'Failed to load privilege.');
        }
      });
  }

  /**
   * Updates a privilege. Handles Step-Up verification.
   */
  public updatePrivilege(id: string, data: Partial<Privilege>, isStepUpVerified = false): void {
    this._status.set('Loading');
    this._errorMessage.set(null);

    this.privilegesService.updatePrivilege(id, data, isStepUpVerified)
      .subscribe({
        next: (response: any) => {
          this._selectedPrivilege.set(response.body);
          this._status.set('Success');
          // Refresh catalog in background
          this.loadPrivileges();
        },
        error: (err: HttpErrorResponse) => {
          console.error('[PrivilegesStore] Update failed:', err);
          
          // Case-insensitive header check
          const stepUpHeader = err.headers.get('X-Step-Up-Required') || err.headers.get('x-step-up-required');
          console.log('[PrivilegesStore] Step-Up Header Value:', stepUpHeader);
          
          if (err.status === 403 && stepUpHeader === 'true') {
            this._status.set('StepUpRequired');
          } else {
            this._status.set('Error');
            // Extract error message safely regardless of whether it's a string or object
            const message = err.error?.detail || (typeof err.error === 'string' ? err.error : null) || 'Failed to update privilege.';
            this._errorMessage.set(message);
          }
        }
      });
  }

  public reset(): void {
    this._status.set('Idle');
    this._errorMessage.set(null);
    this._selectedPrivilege.set(null);
  }
}
