import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { Router } from '@angular/router';
import { 
  DataTableComponent, 
  TableColumnDef, 
  TableActionDef,
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '@tai/ui-design-system';
import { UsersStore } from './users.store';
import { User } from './users.service';

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
 */
@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, DataTableComponent, DialogModule],
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

      <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <tai-data-table
          [data]="store.users()"
          [columns]="columns"
          [actions]="actions"
          [loading]="store.isLoading()"
          [totalCount]="store.totalCount()"
          [pageIndex]="store.pageIndex()"
          [pageSize]="store.pageSize()"
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
    this.store.loadUsers();
  }

  protected onPageChange(page: number): void {
    this.store.setPage(page);
  }

  protected onSortChange(sort: { columnId: string; direction: 'asc' | 'desc' }): void {
    // Server-side sorting can be implemented here if needed by the API
    console.log('Sort changed:', sort);
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
