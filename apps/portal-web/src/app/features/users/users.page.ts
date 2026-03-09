import { Component, inject, OnInit } from '@angular/core';
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

  ngOnInit() {
    this.store.loadUsers();
  }
}