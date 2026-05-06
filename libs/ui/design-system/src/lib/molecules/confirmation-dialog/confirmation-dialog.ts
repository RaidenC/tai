import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ConfirmationPanelActionSelected,
  ConfirmationPanelComponent,
  ConfirmationPanelData,
} from '../confirmation-panel/confirmation-panel.component';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /**
   * @deprecated Caller-provided classes are ignored. Use typed confirmation tones
   * through ConfirmationPanelComponent for new code.
   */
  confirmButtonClass?: string;
}

/**
 * @deprecated Use ConfirmationPanelComponent inside a feature-owned modal host.
 * This wrapper preserves the old tai-confirmation-dialog selector and DialogRef
 * contract for existing CDK Dialog consumers during migration.
 */
@Component({
  selector: 'tai-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, ConfirmationPanelComponent],
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.scss',
})
export class ConfirmationDialogComponent {
  private readonly dialogRef = inject(DialogRef<boolean>);
  readonly data = inject<ConfirmationDialogData>(DIALOG_DATA);

  protected readonly panelData = computed<ConfirmationPanelData>(() => ({
    title: this.data.title,
    message: this.data.message,
    confirm: {
      label: this.data.confirmText ?? 'Confirm',
      tone: 'default',
    },
    cancel: {
      label: this.data.cancelText ?? 'Cancel',
    },
  }));

  protected onActionSelected(event: ConfirmationPanelActionSelected): void {
    this.dialogRef.close(event.action === 'confirm');
  }
}
