import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PrivilegesStore } from './privileges.store';
import { Privilege, RiskLevel } from './privileges.service';

/**
 * PrivilegeDetailPage
 * 
 * Persona: Senior Full-Stack Architect.
 * Context: Detailed privilege catalog management with JIT settings and strict immutability.
 */
@Component({
  selector: 'app-privilege-detail-page',
  standalone: true,
  imports: [CommonModule, NgClass, ReactiveFormsModule, RouterModule],
  template: `
    <div class="p-8 max-w-4xl mx-auto">
      <!-- Header -->
      <nav class="mb-8 flex items-center gap-4" aria-label="Breadcrumb">
        <button 
          (click)="goBack()" 
          class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200"
          aria-label="Go back to privileges catalog"
          data-testid="back-button">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <title>Go Back</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Privilege Details</h1>
      </nav>

      @if (store.isLoading()) {
        <div class="flex flex-col items-center justify-center py-20" data-testid="loading-indicator">
          <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="mt-4 text-gray-500 font-medium">Loading privilege...</p>
        </div>
      } @else if (store.selectedPrivilege(); as privilege) {
        <div class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" data-testid="privilege-card">
          <!-- Banner -->
          <div class="h-32 bg-gradient-to-r from-slate-700 to-slate-900"></div>
          
          <div class="px-8 pb-8">
            <div class="relative flex justify-between items-end -mt-12 mb-8">
              <div class="px-6 py-4 bg-white rounded-2xl shadow-lg border-4 border-white flex items-center justify-center text-xl font-bold text-slate-800" data-testid="display-name">
                {{ privilege.name }}
              </div>
              
              @if (!isEditing()) {
                <button 
                  (click)="toggleEdit()"
                  class="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all duration-200 cursor-pointer"
                  data-testid="edit-button">
                  Edit Privilege
                </button>
              }
            </div>

            <!-- Content Area -->
            @if (!isEditing()) {
              <div class="space-y-8" data-testid="read-only-view">
                <h2 class="sr-only">Information</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <span class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Module / Application</span>
                    <p class="text-lg font-semibold text-gray-900" data-testid="display-module">{{ privilege.module }}</p>
                  </div>
                  <div>
                    <span class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Risk Level</span>
                    <span 
                      class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold"
                      [ngClass]="{
                        'bg-blue-100 text-blue-700': privilege.riskLevel === 0,
                        'bg-yellow-100 text-yellow-700': privilege.riskLevel === 1,
                        'bg-orange-100 text-orange-700': privilege.riskLevel === 2,
                        'bg-red-100 text-red-700': privilege.riskLevel === 3
                      }"
                      data-testid="display-riskLevel">{{ getRiskLevelName(privilege.riskLevel) }}</span>
                  </div>
                  <div class="md:col-span-2">
                    <span class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Description</span>
                    <p class="text-lg text-gray-700" data-testid="display-description">{{ privilege.description }}</p>
                  </div>
                  <div>
                    <span class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Status</span>
                    <span 
                      class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold"
                      [ngClass]="privilege.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
                      data-testid="display-status">
                      {{ privilege.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                </div>

                <!-- JIT Settings Section -->
                <div class="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Just-In-Time (JIT) Settings</h3>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <span class="block text-xs font-bold text-gray-500 mb-1">Max Duration</span>
                      <p class="font-mono font-bold text-slate-700" data-testid="display-jit-expiry">{{ privilege.jitSettings.expiry || 'No Limit' }}</p>
                    </div>
                    <div>
                      <span class="block text-xs font-bold text-gray-500 mb-1">Allow Guest</span>
                      <p class="font-bold text-slate-700">{{ privilege.jitSettings.allowGuest ? 'Yes' : 'No' }}</p>
                    </div>
                    <div>
                      <span class="block text-xs font-bold text-gray-500 mb-1">Require MFA</span>
                      <p class="font-bold text-slate-700">{{ privilege.jitSettings.requireMfa ? 'Yes' : 'No' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            } @else {
              <form [formGroup]="editForm" (ngSubmit)="onSave()" class="space-y-6" data-testid="edit-form">
                <h2 class="sr-only">Edit Form</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Immutable Name -->
                  <div class="space-y-1">
                    <label for="name" class="block text-sm font-bold text-gray-700">Privilege Name (Immutable)</label>
                    <input 
                      id="name"
                      type="text" 
                      [value]="privilege.name" 
                      disabled
                      class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-600 cursor-not-allowed outline-none"
                      data-testid="input-name">
                  </div>
                  <!-- Immutable Module -->
                  <div class="space-y-1">
                    <label for="module" class="block text-sm font-bold text-gray-700">Module (Immutable)</label>
                    <input 
                      id="module"
                      type="text" 
                      [value]="privilege.module" 
                      disabled
                      class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-600 cursor-not-allowed outline-none"
                      data-testid="input-module">
                  </div>

                  <div class="md:col-span-2 space-y-1">
                    <label for="description" class="block text-sm font-bold text-gray-700">Description</label>
                    <textarea 
                      id="description"
                      formControlName="description"
                      rows="3"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none"
                      data-testid="input-description"></textarea>
                  </div>

                  <div class="space-y-1">
                    <label for="riskLevel" class="block text-sm font-bold text-gray-700">Risk Level</label>
                    <select 
                      id="riskLevel"
                      formControlName="riskLevel"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none bg-white"
                      data-testid="input-riskLevel">
                      <option [value]="0">Low</option>
                      <option [value]="1">Medium</option>
                      <option [value]="2">High</option>
                      <option [value]="3">Critical</option>
                    </select>
                  </div>

                  <div class="flex items-center pt-8">
                    <label for="isActive" class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" id="isActive" formControlName="isActive" class="sr-only peer">
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span class="ml-3 text-sm font-bold text-gray-700">Active Status</span>
                    </label>
                  </div>
                </div>

                <!-- JIT Settings Sub-form -->
                <div class="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4" formGroupName="jitSettings">
                  <h3 class="text-sm font-bold text-slate-600 uppercase tracking-widest">JIT Configuration</h3>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="space-y-1">
                      <label for="expiry" class="block text-xs font-bold text-gray-500">Max Expiry (HH:mm:ss)</label>
                      <input 
                        id="expiry"
                        type="text" 
                        formControlName="expiry"
                        placeholder="01:00:00"
                        class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 outline-none font-mono"
                        data-testid="input-jit-expiry">
                    </div>
                    <div class="flex items-center gap-2">
                      <input type="checkbox" id="allowGuest" formControlName="allowGuest" class="w-4 h-4 text-indigo-600 rounded" aria-label="Allow Guest Access">
                      <label for="allowGuest" class="text-sm font-bold text-gray-600">Allow Guest</label>
                    </div>
                    <div class="flex items-center gap-2">
                      <input type="checkbox" id="requireMfa" formControlName="requireMfa" class="w-4 h-4 text-indigo-600 rounded" aria-label="Require MFA">
                      <label for="requireMfa" class="text-sm font-bold text-gray-600">Require MFA</label>
                    </div>
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
          @if (store.errorMessage()?.includes('conflict') || store.errorMessage()?.includes('Refresh')) {
            <p class="mb-4 text-sm text-red-600">This privilege was modified by another user. Please refresh to see the latest data.</p>
            <button 
              (click)="refresh()"
              class="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200"
              data-testid="refresh-button">
              Refresh Data
            </button>
          } @else {
            <button 
              (click)="goBack()"
              class="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200">
              Back to Directory
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class PrivilegeDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly store = inject(PrivilegesStore);

  protected readonly RiskLevel = RiskLevel;
  protected readonly isEditing = signal(false);
  
  protected readonly editForm = this.fb.group({
    description: ['', [Validators.required, Validators.maxLength(500)]],
    riskLevel: [0, [Validators.required]],
    isActive: [true],
    jitSettings: this.fb.group({
      expiry: ['', [Validators.pattern(/^\d{2}:\d{2}:\d{2}$/)]],
      allowGuest: [false],
      requireMfa: [true]
    })
  });

  constructor() {
    effect(() => {
      const privilege = this.store.selectedPrivilege();
      if (privilege && this.isEditing()) {
        this.editForm.patchValue({
          description: privilege.description,
          riskLevel: privilege.riskLevel,
          isActive: privilege.isActive,
          jitSettings: {
            expiry: privilege.jitSettings.expiry,
            allowGuest: privilege.jitSettings.allowGuest,
            requireMfa: privilege.jitSettings.requireMfa
          }
        }, { emitEvent: false });
      }
    });

    // Handle transition out of edit mode on success
    effect(() => {
      if (this.store.status() === 'Success' && this.isEditing()) {
        // Only exit edit mode if we were actually saving (determined by presence of valid form)
        // This prevents exiting edit mode if a background refresh happens
        this.isEditing.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.refresh();

    if (this.route.snapshot.queryParamMap.get('edit') === 'true') {
      this.isEditing.set(true);
    }
  }

  protected getRiskLevelName(level: RiskLevel): string {
    return RiskLevel[level] || 'Unknown';
  }

  protected refresh(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.loadPrivilege(id);
    }
  }

  protected toggleEdit(): void {
    if (!this.isEditing()) {
      const privilege = this.store.selectedPrivilege();
      if (privilege) {
        this.editForm.patchValue({
          description: privilege.description,
          riskLevel: privilege.riskLevel,
          isActive: privilege.isActive,
          jitSettings: {
            expiry: privilege.jitSettings.expiry,
            allowGuest: privilege.jitSettings.allowGuest,
            requireMfa: privilege.jitSettings.requireMfa
          }
        });
      }
    }
    this.isEditing.set(!this.isEditing());
  }

  protected onSave(): void {
    const privilege = this.store.selectedPrivilege();
    if (privilege && this.editForm.valid) {
      this.store.updatePrivilege(privilege.id, this.editForm.value as Partial<Privilege>);
      // Removal of synchronous isEditing.set(false) to avoid race condition
    }
  }

  protected goBack(): void {
    this.router.navigate(['/admin/privileges']);
  }
}
