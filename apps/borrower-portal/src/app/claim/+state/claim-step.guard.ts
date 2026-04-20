/**
 * CLAIM STEP GUARD — Route Navigation Protection
 *
 * NgRx Concept: Guard Integration with Store
 * Angular's Route Guards are the gatekeepers of navigation. This guard
 * queries the NgRx store to determine if the user can proceed to a step.
 *
 * How it works:
 * 1. Extracts the target step number from the route data ('step')
 * 2. Selects all step validity selectors from the store
 * 3. Returns true if all prior steps are valid, false otherwise
 *
 * Why not use CDK Stepper's built-in linear mode?
 * CDK Stepper's linear mode is local to the stepper component. It doesn't
 * integrate with Angular's router — so deep links like /claim/medical-providers
 * would bypass the stepper entirely. This guard is the single source of truth
 * for whether a step is accessible, regardless of how the user navigates.
 *
 * Edge case: Deep links. If the user navigates directly to /claim/medical-providers
 * (step 3), the guard checks steps 1 and 2. If they're invalid, the guard blocks
 * and redirects to step 1. The `loadDraft` effect (dispatched from
 * ROOT_EFFECTS_INIT) ensures the store has the user's previous data even on a
 * fresh page load.
 */

import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  selectBorrowerValid,
  selectIncidentValid,
  selectProvidersValid,
} from './claim.selectors';
import { map, take } from 'rxjs/operators';
import { combineLatest } from 'rxjs';

/**
 * Maps route paths to step numbers.
 * Used to determine which validity checks to run.
 */
const STEP_MAP: Record<string, number> = {
  'borrower-info': 1,
  'incident-details': 2,
  'medical-providers': 3,
  'review-sign': 4,
};

/**
 * Determines if a target step can be accessed based on prior step validity.
 *
 * Step 1: Always accessible (first step)
 * Step 2: Requires Step 1 valid
 * Step 3: Requires Steps 1 & 2 valid
 * Step 4: Requires Steps 1, 2 & 3 valid
 */
export const claimStepGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const store = inject(Store);

  // Get target step from route path
  const path = route.url[0]?.path ?? '';
  const targetStep = STEP_MAP[path] ?? 1;

  // Step 1 is always accessible
  if (targetStep === 1) {
    return true;
  }

  // Build validity checks for steps before target
  const validityChecks$ = combineLatest([
    store.select(selectBorrowerValid),
    store.select(selectIncidentValid),
    store.select(selectProvidersValid),
  ]).pipe(take(1));

  return validityChecks$.pipe(
    map(([step1Valid, step2Valid, step3Valid]) => {
      // Check if all required prior steps are valid
      const canAccess =
        (targetStep <= 1 || step1Valid) &&
        (targetStep <= 2 || step2Valid) &&
        (targetStep <= 3 || step3Valid);

      if (!canAccess) {
        // Redirect to first incomplete step
        const redirectStep = !step1Valid
          ? 'borrower-info'
          : !step2Valid
          ? 'incident-details'
          : 'medical-providers';

        router.navigate(['/claim', redirectStep]);
        return false;
      }

      return true;
    })
  );
};