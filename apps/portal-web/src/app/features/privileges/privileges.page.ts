import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  DataTableComponent, 
  TableColumnDef, 
  TableActionDef
} from '@tai/ui-design-system';
import { PrivilegesStore } from './privileges.store';
import { Privilege, RiskLevel } from './privileges.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-privileges-page',
  standalone: true,
  imports: [CommonModule, DataTableComponent, DialogModule, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Privilege Catalog</h1>
        <p class="mt-2 text-sm text-gray-500">Manage system-wide permissions and security risk levels.</p>
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

      @if (store.isStepUpRequired()) {
        <div class="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-700 rounded-r-md shadow-sm" role="alert">
          <div class="flex justify-between items-center">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium">Step-up authentication required for this high-risk action.</p>
              </div>
            </div>
            <button 
              (click)="simulateStepUp()"
              class="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition-colors">
              VERIFY MFA
            </button>
          </div>
        </div>
      }

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
            placeholder="Search privileges..." 
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent sm:text-sm transition-all duration-200"
            data-testid="privilege-search-input">
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <tai-data-table
          [data]="store.filteredPrivileges()"
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
  styles: [`
    :host { display: block; }
  `]
})
export class PrivilegesPage implements OnInit {
  protected readonly store = inject(PrivilegesStore);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected searchTerm = '';
  private readonly searchSubject = new Subject<string>();
  private pendingUpdate: { id: string; data: Partial<Privilege> } | null = null;

  protected readonly columns: TableColumnDef<Privilege>[] = [
    { id: 'name', header: 'Privilege Name', cell: (p) => p.name, sortable: true },
    { id: 'module', header: 'Module', cell: (p) => p.module, sortable: true },
    { 
      id: 'risk', 
      header: 'Risk Level', 
      cell: (p) => RiskLevel[p.riskLevel],
      sortable: true
    },
    { 
      id: 'status', 
      header: 'Status', 
      cell: (p) => p.isActive ? 'Active' : 'Inactive',
      sortable: true
    }
  ];

  protected readonly actions: TableActionDef<Privilege>[] = [
    {
      id: 'view',
      label: 'View Details',
      class: 'text-gray-600 hover:text-gray-900'
    },
    {
      id: 'edit',
      label: 'Edit',
      class: 'text-indigo-600 hover:text-indigo-900'
    },
    {
      id: 'toggle',
      label: 'Toggle Status',
      class: 'text-gray-600 hover:text-gray-900'
    }
  ];

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const page = +params['page'] || 1;
      const size = +params['size'] || 10;
      const search = params['search'] || '';
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const sort = params['sort'] || '';
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const dir = params['dir'] || '';

      this.searchTerm = search;
      this.store.loadPrivileges(page, size, search);
    });

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

  protected onSortChange(event: { columnId: string; direction: 'asc' | 'desc' }): void {
    this.updateUrl({ sort: event.columnId, dir: event.direction, page: 1 });
  }

  protected onSearchChange(search: string): void {
    this.searchSubject.next(search);
  }

  protected onAction(event: { actionId: string; row: Privilege }): void {
    if (event.actionId === 'view') {
      this.router.navigate(['/admin/privileges', event.row.id]);
    } else if (event.actionId === 'edit') {
      this.router.navigate(['/admin/privileges', event.row.id], { 
        queryParams: { edit: 'true' } 
      });
    } else if (event.actionId === 'toggle') {
      this.pendingUpdate = { 
        id: event.row.id, 
        data: { ...event.row, isActive: !event.row.isActive } 
      };
      this.store.updatePrivilege(this.pendingUpdate.id, this.pendingUpdate.data);
    }
  }

  protected simulateStepUp(): void {
    if (this.pendingUpdate) {
      this.store.updatePrivilege(this.pendingUpdate.id, this.pendingUpdate.data, true);
      this.pendingUpdate = null;
    }
  }

  private updateUrl(params: Partial<{ page: number; size: number; search: string; sort: string; dir: string }>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }
}
