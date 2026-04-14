/**
 * BORROWER INFO COMPONENT — Step 1 of Disability Claim Wizard
 *
 * This component captures borrower verification information:
 * - First Name, Last Name
 * - SSN (last 4 digits)
 * - Phone
 * - Email
 *
 * Form-Store Sync Strategy (from spec):
 * - On step exit ("Next" click): dispatch saveBorrowerInfo with full form value
 * - On blur of critical fields (SSN, email): dispatch partial save for data recovery
 * - On ngOnInit: select borrower slice from store and patch into form
 *
 * This avoids dispatching on every keystroke (noisy action log) while
 * still persisting data reliably.
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';

import { ClaimActions } from '../+state/claim.actions';
import { selectBorrower } from '../+state/claim.selectors';
import { BorrowerInfo } from '../+state/claim.models';

@Component({
  selector: 'claim-borrower-info',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './borrower-info.component.html',
  styleUrl: './borrower-info.component.css',
})
export class BorrowerInfoComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();

    // Rehydrate from store on init
    this.store
      .select(selectBorrower)
      .pipe(takeUntil(this.destroy$))
      .subscribe((borrower) => {
        // Only patch if there's data and form is pristine (first load)
        if (borrower.firstName || borrower.lastName) {
          this.form.patchValue(borrower, { emitEvent: false });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize the reactive form with validators.
   * SSN: exactly 4 digits
   * Email: valid email format
   * Phone: required, any format
   */
  private initForm(): void {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(1)]],
      lastName: ['', [Validators.required, Validators.minLength(1)]],
      ssnLastFour: [
        '',
        [Validators.required, Validators.pattern(/^\d{4}$/)],
      ],
      phone: ['', [Validators.required, Validators.minLength(10)]],
      email: ['', [Validators.required, Validators.email]],
    });
  }

  /**
   * Handle blur event on critical fields.
   * Dispatches partial save so data survives tab close mid-step.
   */
  onFieldBlur(field: string): void {
    const control = this.form.get(field);
    if (control && control.value) {
      // Dispatch current full form state
      this.store.dispatch(
        ClaimActions.saveBorrowerInfo({
          borrower: this.form.value as BorrowerInfo,
        })
      );
    }
  }

  /**
   * Handle "Next" button click.
   * Validates form, dispatches save, navigates to step 2.
   */
  onNext(): void {
    if (this.form.invalid) {
      // Mark all fields as touched to show errors
      this.form.markAllAsTouched();
      return;
    }

    // Dispatch full form state to store
    this.store.dispatch(
      ClaimActions.saveBorrowerInfo({
        borrower: this.form.value as BorrowerInfo,
      })
    );

    // Navigate to step 2
    this.router.navigate(['/claim/incident-details']);
  }
}