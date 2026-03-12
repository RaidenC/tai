import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';

/**
 * Interface defining the data structure for the ConfirmationDialogComponent.
 */
export interface ConfirmationDialogData {
  /** The title of the dialog. */
  title: string;
  /** The main message or prompt. */
  message: string;
  /** Custom text for the confirm button. Defaults to 'Confirm'. */
  confirmText?: string;
  /** Custom text for the cancel button. Defaults to 'Cancel'. */
  cancelText?: string;
  /** Optional custom CSS classes for the confirm button. */
  confirmButtonClass?: string;
}

/**
 * ConfirmationDialogComponent
 * 
 * A reusable, accessible confirmation dialog built using @angular/cdk/dialog.
 * Styled with Tailwind CSS 4.0.
 * 
 * Features:
 * 1. Accessible using CDK primitives.
 * 2. Tailwind 4.0 styling for modern aesthetics.
 * 3. data-testid attributes for E2E testing.
 */
@Component({
  selector: 'tai-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.scss',
})
export class ConfirmationDialogComponent {
  /**
   * Initializes the component with dialog reference and injected data.
   */
  constructor(
    public readonly dialogRef: DialogRef<boolean>,
    @Inject(DIALOG_DATA) public readonly data: ConfirmationDialogData
  ) {}

  /**
   * Closes the dialog and returns 'true' indicating confirmation.
   */
  public onConfirm(): void {
    this.dialogRef.close(true);
  }

  /**
   * Closes the dialog and returns 'false' indicating cancellation.
   */
  public onCancel(): void {
    this.dialogRef.close(false);
  }
}
