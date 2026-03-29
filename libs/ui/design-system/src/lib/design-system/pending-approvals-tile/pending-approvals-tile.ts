import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PendingUser {
  id: string;
  email: string;
  name: string;
}

/**
 * PendingApprovalsTileComponent
 *
 * Persona: Tenant Admin Auditor.
 * Context: Administrative dashboard for identity verification (Four-Eyes Principle).
 *
 * Features:
 * 1. Reactive list of users awaiting approval via Signal Inputs.
 * 2. Semantic action triggers for secondary approval flow.
 * 3. Accessibility-first row navigation.
 */
@Component({
  selector: 'tai-pending-approvals-tile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pending-approvals-tile.html',
  styleUrl: './pending-approvals-tile.scss',
})
export class PendingApprovalsTileComponent {
  /**
   * List of users requiring secondary approval.
   */
  public readonly users = input<PendingUser[]>([]);

  /**
   * Emitted when an admin approves a user registration.
   */
  public readonly approved = output<string>();

  /**
   * Handles the approval action.
   */
  public onApprove(userId: string): void {
    this.approved.emit(userId);
  }
}
