import { Route } from '@angular/router';
import { DisabilityClaim } from './disability-claim/disability-claim';
import { claimStepGuard } from './+state/claim-step.guard';

/**
 * Claim Feature Routes — 4-Step Wizard Navigation
 *
 * Each step is a separate route with ClaimStepGuard protecting access.
 * The parent route lazy-loads the feature and renders the stepper wrapper.
 *
 * Route Structure:
 * - /claim (parent) — renders the CDK Stepper with all steps
 *   - /claim/borrower-info — Step 1: Borrower verification
 *   - /claim/incident-details — Step 2: Incident details
 *   - /claim/medical-providers — Step 3: Medical providers
 *   - /claim/review-sign — Step 4: Review & submit
 */
export const claimRoutes: Route[] = [
  {
    path: '',
    component: DisabilityClaim,
    children: [
      {
        path: '',
        redirectTo: 'borrower-info',
        pathMatch: 'full',
      },
      {
        path: 'borrower-info',
        loadComponent: () =>
          import('./borrower-info/borrower-info.component').then(
            (m) => m.BorrowerInfoComponent
          ),
        data: { step: 1 },
        canActivate: [claimStepGuard],
      },
      {
        path: 'incident-details',
        loadComponent: () =>
          import('./incident-details/incident-details.component').then(
            (m) => m.IncidentDetailsComponent
          ),
        data: { step: 2 },
        canActivate: [claimStepGuard],
      },
      {
        path: 'medical-providers',
        loadComponent: () =>
          import('./medical-providers/medical-providers.component').then(
            (m) => m.MedicalProvidersComponent
          ),
        data: { step: 3 },
        canActivate: [claimStepGuard],
      },
      {
        path: 'review-sign',
        loadComponent: () =>
          import('./review-sign/review-sign.component').then(
            (m) => m.ReviewSignComponent
          ),
        data: { step: 4 },
        canActivate: [claimStepGuard],
      },
    ],
  },
];
