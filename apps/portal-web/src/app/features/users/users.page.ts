import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingStore } from '../onboarding/onboarding.store';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-8">
      <h1 class="text-2xl font-bold mb-6">Users Directory</h1>
      
      @if (store.isLoading()) {
        <div class="flex justify-center p-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      } @else {
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name/Email</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @for (user of store.allUsers(); track user.id) {
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{{ user.name }}</div>
                    <div class="text-sm text-gray-500">{{ user.email }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {{ (user.status || 'Active') }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="2" class="px-6 py-4 text-center text-gray-500">No users found.</td>
                </tr>
              }
            </tbody>
          </table>

          <!-- Pagination Controls -->
          <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div class="flex-1 flex justify-between sm:hidden">
              <button (click)="store.prevPage()" [disabled]="store.currentPage() === 1" 
                class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                Previous
              </button>
              <button (click)="store.nextPage()" [disabled]="store.currentPage() === totalPages()"
                class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                Next
              </button>
            </div>
            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700">
                  Showing
                  <span class="font-medium">{{ ((store.currentPage() - 1) * store.pageSize()) + 1 }}</span>
                  to
                  <span class="font-medium">{{ Math.min(store.currentPage() * store.pageSize(), store.totalUsersCount()) }}</span>
                  of
                  <span class="font-medium">{{ store.totalUsersCount() }}</span>
                  results
                </p>
              </div>
              <div>
                <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button (click)="store.prevPage()" [disabled]="store.currentPage() === 1"
                    class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                    <span class="sr-only">Previous</span>
                    <!-- Heroicon name: solid/chevron-left -->
                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    Page {{ store.currentPage() }} of {{ totalPages() }}
                  </span>
                  <button (click)="store.nextPage()" [disabled]="store.currentPage() === totalPages()"
                    class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                    <span class="sr-only">Next</span>
                    <!-- Heroicon name: solid/chevron-right -->
                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      }

      @if (store.isError()) {
        <div class="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {{ store.errorMessage() }}
        </div>
      }
    </div>
  `
})
export class UsersPage implements OnInit {
  protected readonly store = inject(OnboardingStore);
  protected readonly Math = Math;

  protected readonly totalPages = computed(() => 
    Math.ceil(this.store.totalUsersCount() / this.store.pageSize()) || 1
  );

  ngOnInit() {
    this.store.loadUsers(1, 10);
  }
}