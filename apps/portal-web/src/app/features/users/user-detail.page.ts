import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UsersStore } from './users.store';
import { User } from './users.service';

/**
 * UserDetailPage
 * 
 * Persona: Senior Full-Stack Architect.
 * Context: Detailed profile management with optimistic concurrency and Zero-Trust constraints.
 * 
 * Features:
 * 1. Read-Only and Edit modes.
 * 2. Form validation for Name and Email.
 * 3. Institution field is strictly Read-Only for Tenant Admins.
 * 4. Concurrency protection via If-Match (xmin).
 */
@Component({
  selector: 'app-user-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="p-8 max-w-4xl mx-auto">
      <!-- Header -->
      <nav class="mb-8 flex items-center gap-4">
        <button 
          (click)="goBack()" 
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
          aria-label="Go back to users directory"
          data-testid="back-button">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">User Profile</h1>
      </nav>

      @if (store.isLoading()) {
        <div class="flex flex-col items-center justify-center py-20" data-testid="loading-indicator">
          <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="mt-4 text-gray-500 font-medium">Loading profile...</p>
        </div>
      } @else if (store.selectedUser(); as user) {
        <div class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" data-testid="user-profile-card">
          <!-- Profile Banner -->
          <div class="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          
          <div class="px-8 pb-8">
            <div class="relative flex justify-between items-end -mt-12 mb-8">
              <div class="w-24 h-24 bg-white rounded-2xl shadow-lg border-4 border-white flex items-center justify-center text-3xl font-bold text-indigo-600 uppercase" data-testid="user-avatar">
                {{ user.firstName[0] }}{{ user.lastName[0] }}
              </div>
              
              @if (!isEditing()) {
                <button 
                  (click)="toggleEdit()"
                  class="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all duration-200 cursor-pointer"
                  data-testid="edit-button">
                  Edit Profile
                </button>
              }
            </div>

            <!-- Content Area -->
            @if (!isEditing()) {
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8" data-testid="read-only-view">
                <div>
                  <span class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">First Name</span>
                  <p class="text-lg font-semibold text-gray-900" data-testid="display-firstName">{{ user.firstName }}</p>
                </div>
                <div>
                  <span class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Last Name</span>
                  <p class="text-lg font-semibold text-gray-900" data-testid="display-lastName">{{ user.lastName }}</p>
                </div>
                <div>
                  <span class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</span>
                  <p class="text-lg font-semibold text-gray-900" data-testid="display-email">{{ user.email }}</p>
                </div>
                <div>
                  <span class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Account Status</span>
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700" data-testid="display-status">
                    {{ user.status }}
                  </span>
                </div>
                <div class="md:col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Institution</span>
                  <p class="text-lg font-semibold text-gray-700" data-testid="display-institution">{{ user.institution || 'Tai Portal' }}</p>
                  <p class="mt-1 text-xs text-gray-400">This field is managed by System Administrators and cannot be edited.</p>
                </div>
              </div>
            } @else {
              <form [formGroup]="editForm" (ngSubmit)="onSave()" class="space-y-6" data-testid="edit-form">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-1">
                    <label for="firstName" class="block text-sm font-bold text-gray-700">First Name</label>
                    <input 
                      id="firstName"
                      type="text" 
                      formControlName="firstName"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none"
                      data-testid="input-firstName">
                  </div>
                  <div class="space-y-1">
                    <label for="lastName" class="block text-sm font-bold text-gray-700">Last Name</label>
                    <input 
                      id="lastName"
                      type="text" 
                      formControlName="lastName"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none"
                      data-testid="input-lastName">
                  </div>
                  <div class="md:col-span-2 space-y-1">
                    <label for="email" class="block text-sm font-bold text-gray-700">Email Address</label>
                    <input 
                      id="email"
                      type="email" 
                      formControlName="email"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none"
                      data-testid="input-email">
                  </div>
                </div>

                <div class="flex items-center justify-end gap-4 mt-8">
                  <button 
                    type="button" 
                    (click)="toggleEdit()"
                    class="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-all duration-200"
                    data-testid="cancel-button">
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    [disabled]="editForm.invalid || store.isLoading()"
                    class="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    data-testid="save-button">
                    Save Changes
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      } @else if (store.isError()) {
        <div class="bg-red-50 p-8 rounded-2xl border border-red-100 text-center" data-testid="error-message">
          <p class="text-red-700 font-bold mb-4">{{ store.errorMessage() }}</p>
          <button 
            (click)="goBack()"
            class="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200">
            Back to Directory
          </button>
        </div>
      }
    </div>
  `,
  styleUrls: ['./user-detail.page.scss']
})
export class UserDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly store = inject(UsersStore);

  protected readonly isEditing = signal(false);
  
  protected readonly editForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    effect(() => {
      const user = this.store.selectedUser();
      if (user && this.isEditing()) {
        this.editForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        }, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.loadUser(id);
    }

    if (this.route.snapshot.queryParamMap.get('edit') === 'true') {
      this.isEditing.set(true);
    }
  }

  protected toggleEdit(): void {
    if (!this.isEditing()) {
      const user = this.store.selectedUser();
      if (user) {
        this.editForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        });
      }
    }
    this.isEditing.set(!this.isEditing());
  }

  protected onSave(): void {
    const user = this.store.selectedUser();
    if (user && this.editForm.valid) {
      this.store.updateUser(user.id, this.editForm.value as Partial<User>, user.rowVersion);
      this.isEditing.set(false);
    }
  }

  protected goBack(): void {
    this.router.navigate(['/users']);
  }
}
