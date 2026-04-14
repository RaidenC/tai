/**
 * INCIDENT DETAILS COMPONENT — Step 2 of Disability Claim Wizard
 *
 * This component captures incident information:
 * - Date of Disability
 * - Disability Type (Illness, Injury, Pregnancy)
 * - Is Work Related (toggle)
 *   - If true: shows Workers Comp Claim Number sub-form
 *   - Effect: fetchWorkersCompTemplate triggers on toggle to true
 * - Description
 *
 * Key Features:
 * - Conditional sub-form for isWorkRelated
 * - Effect integration: toggling isWorkRelated triggers fetchWorkersCompTemplate
 * - Effect cancellation: switching back to false cancels pending fetch via switchMap
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';

import { ClaimActions } from '../+state/claim.actions';
import { selectIncident, selectIsWorkRelated } from '../+state/claim.selectors';
import { IncidentDetails, DisabilityType } from '../+state/claim.models';

@Component({
  selector: 'claim-incident-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './incident-details.component.html',
  styleUrl: './incident-details.component.css',
})
export class IncidentDetailsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  form!: FormGroup;
  isWorkRelated$ = this.store.select(selectIsWorkRelated);

  // Available disability types
  disabilityTypes: DisabilityType[] = ['Illness', 'Injury', 'Pregnancy'];

  // Workers Comp loading state (set by effect via a separate selector if needed)
  workersCompLoading = false;

  ngOnInit(): void {
    this.initForm();

    // Rehydrate from store on init
    this.store
      .select(selectIncident)
      .pipe(takeUntil(this.destroy$))
      .subscribe((incident) => {
        if (incident.dateOfDisability || incident.disabilityType) {
          this.form.patchValue(incident, { emitEvent: false });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.form = this.fb.group({
      dateOfDisability: ['', Validators.required],
      disabilityType: [null, Validators.required],
      isWorkRelated: [false],
      workersCompClaimNumber: [''],
      description: ['', [Validators.required, Validators.minLength(10)]],
    });

    // Add/remove workersCompClaimNumber validator based on isWorkRelated
    this.form.get('isWorkRelated')?.valueChanges.subscribe((isWorkRelated) => {
      const workersCompControl = this.form.get('workersCompClaimNumber');
      if (isWorkRelated) {
        workersCompControl?.setValidators([Validators.required]);
      } else {
        workersCompControl?.clearValidators();
        workersCompControl?.setValue(null);
      }
      workersCompControl?.updateValueAndValidity();
    });
  }

  /**
   * Handle work-related toggle.
   * Dispatches setWorkRelated which triggers the fetchWorkersCompTemplate effect
   * when toggling to true.
   */
  onWorkRelatedChange(isWorkRelated: boolean): void {
    this.form.patchValue({ isWorkRelated });

    // Dispatch the work-related change (this triggers the effect)
    this.store.dispatch(
      ClaimActions.setWorkRelated({ isWorkRelated })
    );
  }

  /**
   * Handle "Back" button click.
   * Saves current form data, navigates to step 1.
   */
  onBack(): void {
    this.saveAndNavigate(['/claim/borrower-info']);
  }

  /**
   * Handle "Next" button click.
   * Validates form, saves, navigates to step 3.
   */
  onNext(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saveAndNavigate(['/claim/medical-providers']);
  }

  /**
   * Save form to store and navigate.
   */
  private saveAndNavigate(commands: string[]): void {
    const formValue = this.form.value;

    // If isWorkRelated is false, ensure workersCompClaimNumber is null
    const incident: IncidentDetails = {
      ...formValue,
      workersCompClaimNumber: formValue.isWorkRelated
        ? formValue.workersCompClaimNumber
        : null,
    };

    this.store.dispatch(ClaimActions.saveIncidentDetails({ incident }));
    this.router.navigate(commands);
  }
}