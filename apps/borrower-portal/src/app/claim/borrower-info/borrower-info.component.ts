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

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { first } from 'rxjs/operators';

import { ClaimActions } from '../+state';
import { selectBorrower } from '../+state';
import { BorrowerInfo } from '../+state';
import { SecurityAlertComponent } from '@tai/ui-design-system';

@Component({
  selector: 'bp-borrower-info',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SecurityAlertComponent],
  templateUrl: './borrower-info.component.html',
})
export class BorrowerInfoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);

  form!: FormGroup;
  ssnReEntryRequired = false;

  ngOnInit(): void {
    this.initForm();

    // Hydrate once from the store. Subsequent state changes must not
    // overwrite values the user is actively typing.
    this.store
      .select(selectBorrower)
      .pipe(first())
      .subscribe((borrower) => {
        if (borrower.firstName || borrower.lastName) {
          this.form.patchValue(borrower, { emitEvent: false });
          this.ssnReEntryRequired =
            borrower.firstName.length > 0 && borrower.ssnLastFour.length === 0;
        }
      });

    // Clear ssnReEntryRequired when user enters valid SSN
    this.form.get('ssnLastFour')?.valueChanges.subscribe((value) => {
      if (value && value.length === 4) {
        this.ssnReEntryRequired = false;
      }
    });
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