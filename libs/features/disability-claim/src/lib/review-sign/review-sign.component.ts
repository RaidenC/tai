/**
 * REVIEW AND SIGN COMPONENT — Step 4 of Disability Claim Wizard
 *
 * This component displays a summary of all 4 steps:
 * - Step 1: Borrower Info (read-only with [Edit] link)
 * - Step 2: Incident Details (read-only with [Edit] link)
 * - Step 3: Medical Providers (read-only with [Edit] link)
 * - Step 4: Document Upload
 *
 * Key Features:
 * - Reads full state via selectors for summary display
 * - [Edit] links navigate back to each step
 * - Document upload (metadata only in store, blobs to IndexedDB)
 * - Certification checkbox required before submit
 * - selectCanSubmit determines if submit button is enabled
 * - Submit dispatches submitClaim action
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';

import { ClaimActions } from '../+state/claim.actions';
import {
  selectBorrower,
  selectIncident,
  selectMedicalProviders,
  selectDocuments,
  selectCanSubmit,
  selectIsSubmitting,
  selectClaimId,
  selectError,
} from '../+state/claim.selectors';
import { DocumentMeta } from '../+state/claim.models';

@Component({
  selector: 'claim-review-sign',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './review-sign.component.html',
  styleUrl: './review-sign.component.css',
})
export class ReviewSignComponent implements OnInit, OnDestroy {
  private store = inject(Store);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // Selectors for summary display
  borrower$ = this.store.select(selectBorrower);
  incident$ = this.store.select(selectIncident);
  providers$ = this.store.select(selectMedicalProviders);
  documents$ = this.store.select(selectDocuments);

  // Submit state
  canSubmit$ = this.store.select(selectCanSubmit);
  isSubmitting$ = this.store.select(selectIsSubmitting);
  claimId$ = this.store.select(selectClaimId);
  error$ = this.store.select(selectError);

  // Local form state
  certified = false;
  submitted = false;
  submittedClaimId: string | null = null;

  ngOnInit(): void {
    this.isSubmitting$.pipe(takeUntil(this.destroy$)).subscribe((submitting) => {
      // Handle submit completion
      if (!submitting && this.submitted) {
        this.claimId$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
          if (id) {
            this.submittedClaimId = id;
            this.submitted = true;
          }
        }).unsubscribe();
      }
    });

    this.error$.pipe(takeUntil(this.destroy$)).subscribe((error) => {
      if (error) {
        this.submitted = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle document upload (mock for POC).
   * In production, this would upload to IndexedDB and dispatch saveDocumentMeta.
   */
  onFileUpload(docType: 'employerLeaveForm' | 'attendingPhysicianStatement', event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Create metadata
      const meta: DocumentMeta = {
        fileName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      // Dispatch to store
      this.store.dispatch(
        ClaimActions.saveDocumentMeta({ docType, meta })
      );
    }
  }

  /**
   * Handle document removal
   */
  onRemoveDocument(docType: 'employerLeaveForm' | 'attendingPhysicianStatement'): void {
    this.store.dispatch(ClaimActions.removeDocument({ docType }));
  }

  /**
   * Handle certification checkbox change
   */
  onCertificationChange(): void {
    // Just track state locally; submit button disabled until checked
  }

  /**
   * Handle submit button click
   */
  onSubmit(): void {
    if (!this.certified) {
      return;
    }

    this.submitted = true;
    this.store.dispatch(ClaimActions.submitClaim());
  }

  /**
   * Handle "Start New Claim" after successful submission
   */
  onNewClaim(): void {
    this.store.dispatch(ClaimActions.resetClaim());
    this.router.navigate(['/claim/borrower-info']);
  }

  /**
   * Navigate to edit a specific step
   */
  editStep(step: number): void {
    const stepMap: Record<number, string> = {
      1: 'borrower-info',
      2: 'incident-details',
      3: 'medical-providers',
      4: 'review-sign',
    };
    this.router.navigate(['/claim', stepMap[step]]);
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Format date for display
   */
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}