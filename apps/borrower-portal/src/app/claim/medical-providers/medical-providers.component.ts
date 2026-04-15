/**
 * MEDICAL PROVIDERS COMPONENT — Step 3 of Disability Claim Wizard
 *
 * This component manages the dynamic list of medical providers:
 * - Maximum 5 providers (enforced by reducer and UI)
 * - Each provider: doctorName, clinicName, phone, dateFirstTreated
 * - Add/Remove/Update actions sync with NgRx store
 *
 * Key Features:
 * - FormArray pattern for dynamic form management
 * - UUID generation for provider IDs
 * - Max 5 providers enforcement (selectCanAddProvider selector)
 * - Real-time sync to store on field blur (updateProvider action)
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';

import { ClaimActions } from '../+state';
import {
  selectMedicalProviders,
  selectCanAddProvider,
  selectProviderCount,
} from '../+state';
import { MedicalProvider, MAX_PROVIDERS } from '../+state';

@Component({
  selector: 'bp-medical-providers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './medical-providers.component.html',
})
export class MedicalProvidersComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  form!: FormGroup;
  providers$ = this.store.select(selectMedicalProviders);
  canAddProvider$ = this.store.select(selectCanAddProvider);
  providerCount$ = this.store.select(selectProviderCount);

  maxProviders = MAX_PROVIDERS;

  ngOnInit(): void {
    this.initForm();

    // Rehydrate providers from store
    this.store
      .select(selectMedicalProviders)
      .pipe(takeUntil(this.destroy$))
      .subscribe((providers) => {
        // Sync store data to form array (only if form is pristine)
        const formProviders = this.providersArray.controls;
        if (formProviders.length === 0 && providers.length > 0) {
          providers.forEach((provider) => {
            this.addProviderToForm(provider);
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.form = this.fb.group({
      providers: this.fb.array([]),
    });
  }

  /**
   * Get the providers FormArray
   */
  get providersArray(): FormArray {
    return this.form.get('providers') as FormArray;
  }

  /**
   * Create a new provider form group
   */
  private createProviderGroup(data?: Partial<MedicalProvider>): FormGroup {
    return this.fb.group({
      id: [data?.id ?? crypto.randomUUID()],
      doctorName: [data?.doctorName ?? '', Validators.required],
      clinicName: [data?.clinicName ?? '', Validators.required],
      phone: [data?.phone ?? '', [Validators.required, Validators.minLength(10)]],
      dateFirstTreated: [data?.dateFirstTreated ?? '', Validators.required],
    });
  }

  /**
   * Add a provider form group to the array AND dispatch to store
   */
  addProvider(): void {
    // Check max limit
    if (this.providersArray.length >= MAX_PROVIDERS) {
      return;
    }

    // Add to form
    const newProvider = this.createProviderGroup();
    this.providersArray.push(newProvider);

    // Dispatch to store
    const provider: MedicalProvider = {
      id: newProvider.value.id,
      doctorName: '',
      clinicName: '',
      phone: '',
      dateFirstTreated: '',
    };
    this.store.dispatch(ClaimActions.addProvider({ provider }));

    // Listen for changes and sync to store
    newProvider.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (value.doctorName || value.clinicName || value.phone) {
          this.store.dispatch(
            ClaimActions.updateProvider({ provider: value as MedicalProvider })
          );
        }
      });
  }

  /**
   * Add a provider with existing data (for rehydration)
   */
  addProviderToForm(data: MedicalProvider): void {
    const group = this.createProviderGroup(data);
    this.providersArray.push(group);

    // Set up change listener
    group.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      if (value.doctorName || value.clinicName || value.phone) {
        this.store.dispatch(
          ClaimActions.updateProvider({ provider: value as MedicalProvider })
        );
      }
    });
  }

  /**
   * Remove a provider from the form AND dispatch to store
   */
  removeProvider(index: number): void {
    const provider = this.providersArray.at(index);
    const id = provider.value.id;

    // Remove from form
    this.providersArray.removeAt(index);

    // Dispatch to store
    this.store.dispatch(ClaimActions.removeProvider({ id }));
  }

  /**
   * Handle "Back" button click.
   */
  onBack(): void {
    // Sync any pending changes before leaving
    this.providersArray.controls.forEach((group) => {
      const value = group.value;
      if (value.doctorName || value.clinicName || value.phone) {
        this.store.dispatch(
          ClaimActions.updateProvider({ provider: value as MedicalProvider })
        );
      }
    });

    this.router.navigate(['/claim/incident-details']);
  }

  /**
   * Handle "Next" button click.
   */
  onNext(): void {
    // Validate at least one provider exists and is complete
    if (this.providersArray.length === 0) {
      return;
    }

    // Check if all providers are valid
    const allValid = this.providersArray.controls.every(
      (group) => group.valid
    );

    if (!allValid) {
      this.providersArray.controls.forEach((group) => {
        group.markAllAsTouched();
      });
      return;
    }

    // Sync any remaining changes
    this.providersArray.controls.forEach((group) => {
      const value = group.value;
      this.store.dispatch(
        ClaimActions.updateProvider({ provider: value as MedicalProvider })
      );
    });

    this.router.navigate(['/claim/review-sign']);
  }
}