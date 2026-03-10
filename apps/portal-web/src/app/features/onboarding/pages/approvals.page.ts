import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PendingApprovalsTileComponent } from '@tai/ui-design-system';
import { OnboardingStore } from '../onboarding.store';

@Component({
  selector: 'app-approvals-page',
  standalone: true,
  imports: [CommonModule, PendingApprovalsTileComponent],
  template: `
    <div class="p-8 max-w-4xl mx-auto">
      <h2 class="text-3xl font-extrabold text-gray-900 mb-8">Administrative Approvals</h2>
      
      <tai-pending-approvals-tile 
        [users]="store.pendingUsers()"
        (approved)="onApprove($event)">
      </tai-pending-approvals-tile>

      @if (store.isError()) {
        <div class="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {{ store.errorMessage() }}
        </div>
      }
    </div>
  `,
})
export class ApprovalsPage implements OnInit {
  protected readonly store = inject(OnboardingStore);

  ngOnInit() {
    this.store.loadPendingApprovals();
  }

  onApprove(userId: string) {
    this.store.approve(userId);
  }
}
