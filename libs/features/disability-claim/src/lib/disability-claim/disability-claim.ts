/**
 * DISABILITY CLAIM — Main Wizard Container
 *
 * This is the parent component that wraps the CDK Stepper.
 * It subscribes to NgRx store for step validity and current step,
 * coordinating navigation between child route components.
 *
 * The stepper runs in non-linear mode — users can click any completed
 * step to navigate back. The ClaimStepGuard ensures they can't jump
 * ahead to invalid steps.
 */

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Store } from '@ngrx/store';
import { CdkStepperModule } from '@angular/cdk/stepper';
import { filter, map } from 'rxjs/operators';

import {
  selectStepValidity,
  selectCurrentStep,
} from '../+state/claim.selectors';
import { ClaimActions } from '../+state/claim.actions';

@Component({
  selector: 'claim-disability-claim',
  standalone: true,
  imports: [CommonModule, RouterOutlet, CdkStepperModule],
  templateUrl: './disability-claim.html',
  styleUrl: './disability-claim.css',
})
export class DisabilityClaim implements OnInit {
  private store = inject(Store);
  private router = inject(Router);

  // Select step validity for the stepper indicators
  stepValidity$ = this.store.select(selectStepValidity);

  // Current step from store (1-4)
  currentStep$ = this.store.select(selectCurrentStep);

  // Track if this is first visit (for welcome message)
  showWelcome = false;

  ngOnInit(): void {
    // Determine if showing welcome message (step 1, no data yet)
    this.currentStep$.pipe(filter((step) => step === 1)).subscribe(() => {
      // Check if there's existing data in store
      this.stepValidity$.subscribe((validity) => {
        this.showWelcome = !validity.step1;
      }).unsubscribe();
    });

    // Update current step when route changes
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map((event) => event as NavigationEnd)
      )
      .subscribe((event) => {
        const path = event.urlAfterRedirects.split('/').pop() ?? 'borrower-info';
        const stepMap: Record<string, number> = {
          'borrower-info': 1,
          'incident-details': 2,
          'medical-providers': 3,
          'review-sign': 4,
        };
        const step = stepMap[path] ?? 1;
        this.store.dispatch(ClaimActions.setCurrentStep({ step }));
      });
  }

  /**
   * Navigate to a specific step.
   * Used by the stepper's clickable step indicators.
   */
  navigateToStep(stepNumber: number): void {
    const stepMap: Record<number, string> = {
      1: 'borrower-info',
      2: 'incident-details',
      3: 'medical-providers',
      4: 'review-sign',
    };
    this.router.navigate(['/claim', stepMap[stepNumber]]);
  }
}
