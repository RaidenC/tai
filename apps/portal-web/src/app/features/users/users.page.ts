import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  DataTableComponent, 
  TableColumnDef, 
  TableActionDef,
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '@tai/ui-design-system';
import { UsersStore } from './users.store';
import { User } from './users.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

/**
 * UsersPage
 * 
 * Persona: Senior Full-Stack Architect.
 * Context: Enterprise-grade user directory with administrative approval workflows.
 * 
 * Features:
 * 1. Integrated DataTable for high-performance record display.
 * 2. Concurrency-safe approval workflow using CDK Dialog and ETag/xmin tokens.
 * 3. Signal-based state management via UsersStore.
 * 4. Zero-Trust compliant UI (No inline styles, strict CSP).
 * 5. URL-driven state synchronization (Deep linking).
 */
@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, DataTableComponent, DialogModule, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Users Directory</h1>
        <p class="mt-2 text-sm text-gray-500">Manage tenant users and approve pending registrations.</p>
      </header>

      @if (store.isError()) {
        <div class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-md shadow-sm" role="alert">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium">{{ store.errorMessage() }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Search and Filter Bar -->
      <div class="mb-6 flex items-center gap-4">
        <div class="relative flex-1 max-w-md">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search users..." 
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent sm:text-sm transition-all duration-200"
            data-testid="user-search-input">
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <tai-data-table
          [data]="store.users()"
          [columns]="columns"
          [actions]="actions"
          [loading]="store.isLoading()"
          [totalCount]="store.totalCount()"
          [pageIndex]="store.pageIndex()"
          [pageSize]="store.pageSize()"
          [sortColumnId]="store.sortColumn()"
          [sortDirection]="store.sortDirection()"
          (pageChanged)="onPageChange($event)"
          (sortChanged)="onSortChange($event)"
          (actionTriggered)="onAction($event)">
        </tai-data-table>
      </div>
    </div>
  `,
  styleUrls: ['./users.page.scss']
})
export class UsersPage implements OnInit {
  protected readonly store = inject(UsersStore);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected searchTerm = '';
  private readonly searchSubject = new Subject<string>();

  /**
   * Column definitions for the user directory.
   */
  protected readonly columns: TableColumnDef<User>[] = [
    { 
      id: 'name', 
      header: 'Name', 
      cell: (user) => `${user.firstName} ${user.lastName}`,
      sortable: true 
    },
    { 
      id: 'email', 
      header: 'Email Address', 
      cell: (user) => user.email,
      sortable: true 
    },
    { 
      id: 'status', 
      header: 'Status', 
      cell: (user) => user.status 
    }
  ];

  /**
   * Action definitions for user management.
   */
  protected readonly actions: TableActionDef<User>[] = [
    {
      id: 'view',
      label: 'View Details',
      class: 'text-gray-700 hover:text-gray-900'
    },
    {
      id: 'edit',
      label: 'Edit User',
      class: 'text-gray-700 hover:text-gray-900'
    },
    {
      id: 'approve',
      label: 'Approve Registration',
      class: 'text-indigo-600 hover:text-indigo-900 font-bold',
      visible: (user) => user.status === 'PendingApproval'
    }
  ];

  ngOnInit(): void {
    // Initial sync and default parameter enforcement
    const currentParams = this.route.snapshot.queryParams;
    if (!currentParams['page'] || !currentParams['size']) {
      this.updateUrl({
        page: currentParams['page'] || 1,
        size: currentParams['size'] || 10,
        sort: currentParams['sort'] || null,
        dir: currentParams['dir'] || null,
        search: currentParams['search'] || null
      });
    }

    // Synchronize Store with URL query parameters
    this.route.queryParams.subscribe(params => {
      const page = +params['page'] || 1;
      const size = +params['size'] || 10;
      const sort = params['sort'] || null;
      const dir = params['dir'] || null;
      const search = params['search'] || '';

      this.searchTerm = search;
      this.store.loadUsers(page, size, sort, dir, search);
    });

    // Handle search with debounce
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(search => {
      this.updateUrl({ search, page: 1 });
    });
  }

  protected onPageChange(page: number): void {
    this.updateUrl({ page });
  }

  protected onSortChange(sort: { columnId: string; direction: 'asc' | 'desc' }): void {
    this.updateUrl({ 
      sort: sort.columnId, 
      dir: sort.direction,
      page: 1 // Reset to page 1 on sort change
    });
  }

  protected onSearchChange(search: string): void {
    this.searchSubject.next(search);
  }

  protected onAction(event: { actionId: string; row: User }): void {
    if (event.actionId === 'approve') {
      this.confirmApproval(event.row);
    } else if (event.actionId === 'view' || event.actionId === 'edit') {
      const queryParams = event.actionId === 'edit' ? { edit: 'true' } : {};
      this.router.navigate(['/users', event.row.id], { queryParams });
    }
  }

  /**
   * Updates the URL query parameters.
   */
  private updateUrl(params: Partial<{ page: number; size: number; sort: string; dir: string; search: string }>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Opens the confirmation dialog for user approval.
   * If confirmed, triggers the approval workflow with concurrency protection.
   */
  private confirmApproval(user: User): void {
    const dialogRef = this.dialog.open<boolean>(ConfirmationDialogComponent, {
      data: {
        title: 'Approve User Registration',
        message: `Are you sure you want to approve the registration for ${user.firstName} ${user.lastName} (${user.email})? This will grant them access to the platform immediately.`,
        confirmText: 'Approve User',
        cancelText: 'Cancel',
        confirmButtonClass: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-600/20'
      } as ConfirmationDialogData
    });

    dialogRef.closed.subscribe(confirmed => {
      if (confirmed) {
        this.store.approveUser(user.id, user.rowVersion);
      }
    });
  }
}

