import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PrivilegesStore } from './privileges.store';
import { RiskLevel } from './privileges.service';

@Component({
  selector: 'app-privilege-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="p-8 max-w-4xl mx-auto">
      <nav class="mb-8">
        <a routerLink="/admin/privileges" class="text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm font-medium">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Catalog
        </a>
      </nav>

      @if (store.isLoading()) {
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      } @else if (store.selectedPrivilege(); as privilege) {
        <header class="mb-8">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">{{ privilege.name }}</h1>
              <p class="mt-2 text-sm text-gray-500">Module: {{ privilege.module }}</p>
            </div>
            <div [class]="getRiskBadgeClass(privilege.riskLevel)">
              {{ riskLevelLabels[privilege.riskLevel] }} Risk
            </div>
          </div>
        </header>

        <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <form [formGroup]="form" (ngSubmit)="onSave()" class="p-6 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="col-span-2">
                <label class="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea 
                  formControlName="description"
                  rows="3"
                  class="block w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-200"
                ></textarea>
              </div>

              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1">Risk Level</label>
                <select 
                  formControlName="riskLevel"
                  class="block w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-200"
                >
                  <option [value]="0">Low</option>
                  <option [value]="1">Medium</option>
                  <option [value]="2">High</option>
                  <option [value]="3">Critical</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <div class="flex items-center h-[50px]">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" formControlName="isActive" class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span class="ml-3 text-sm font-medium text-gray-900">Active</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="pt-6 border-t border-gray-100 flex justify-end gap-4">
              <button 
                type="button"
                routerLink="/admin/privileges"
                class="px-6 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                [disabled]="form.invalid || store.isLoading()"
                class="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all duration-200"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; background-color: #f9fafb; min-height: 100vh; }
  `]
})
export class PrivilegeDetailPage implements OnInit {
  protected readonly store = inject(PrivilegesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly RiskLevel = RiskLevel;
  protected readonly riskLevelLabels: Record<number, string> = {
    [RiskLevel.Low]: 'Low',
    [RiskLevel.Medium]: 'Medium',
    [RiskLevel.High]: 'High',
    [RiskLevel.Critical]: 'Critical'
  };
  protected readonly form = this.fb.group({
    description: ['', [Validators.required, Validators.maxLength(500)]],
    riskLevel: [RiskLevel.Low, [Validators.required]],
    isActive: [true, [Validators.required]]
  });

  constructor() {
    effect(() => {
      const p = this.store.selectedPrivilege();
      if (p) {
        this.form.patchValue({
          description: p.description,
          riskLevel: p.riskLevel,
          isActive: p.isActive
        }, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.loadPrivilege(id);
    }
  }

  protected getRiskBadgeClass(level: RiskLevel): string {
    const base = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ';
    switch (level) {
      case RiskLevel.Low: return base + 'bg-green-100 text-green-800';
      case RiskLevel.Medium: return base + 'bg-blue-100 text-blue-800';
      case RiskLevel.High: return base + 'bg-amber-100 text-amber-800';
      case RiskLevel.Critical: return base + 'bg-red-100 text-red-800';
      default: return base + 'bg-green-100 text-green-800';
    }
  }

  protected onSave(): void {
    const privilege = this.store.selectedPrivilege();
    if (privilege && this.form.valid) {
      this.store.updatePrivilege(privilege.id, {
        ...this.form.value,
        rowVersion: privilege.rowVersion
      } as any);
    }
  }
}
