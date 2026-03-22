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
   * 
   * Requirement: Automatically filter out privileges belonging to Apps/Modules ("Tiles") 
   * that are not enabled in the current Tenant's Configuration.
   * 
   * JUNIOR RATIONALE: We use a computed signal here to handle the filtering reactively.
   * If the list of privileges or the list of licensed modules changes, this 
   * automatically recalculates without us needing to manually call a function.
   */
  public readonly filteredPrivileges = computed(() => {
    const allPrivileges = this._privileges();
    const licensed = this._licensedModules();
    
    // For this POC, we assume if 'DocViewer' isn't in the list, its privileges are hidden.
    return allPrivileges.filter(p => licensed.includes(p.module));
  });

  /**
   * Loads the list of privileges.
   */
  public loadPrivileges(pageIndex?: number, pageSize?: number, search?: string): void {
    if (pageIndex !== undefined) this._pageIndex.set(pageIndex);
    if (pageSize !== undefined) this._pageSize.set(pageSize);
    if (search !== undefined) this._search.set(search || null);

    this._status.set('Loading');
    this._errorMessage.set(null);

    this.privilegesService.getPrivileges(this._pageIndex(), this._pageSize(), this._search() || undefined)
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
        next: (updatedPrivilege) => {
          this._selectedPrivilege.set(updatedPrivilege);
          this._status.set('Success');
          this.loadPrivileges(); // Refresh list
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 403 && err.headers.get('X-Step-Up-Required') === 'true') {
            this._status.set('StepUpRequired');
          } else {
            this._status.set('Error');
            this._errorMessage.set(err.error?.detail || 'Failed to update privilege.');
          }
        }
      });
  }
}
