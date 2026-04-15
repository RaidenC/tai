import { Route } from '@angular/router';
import { claimStepGuard } from './claim/+state';
import { ClaimWizardComponent } from './claim/claim-wizard.component';

/**
 * App Routes — Borrower Portal Wizard
 *
 * The claim state is eagerly loaded because NgRx store
 * initialization happens in app.config.ts for localStorage hydration.
 *
 * Step components live in the app layer to access design-system
 * components like secure-input.
 *
 * The wizard UI (stepper) comes from @tai/ui-design-system.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'claim/borrower-info',
    pathMatch: 'full',
  },
  {
    path: 'claim',
    component: ClaimWizardComponent,
    children: [
      {
        path: '',
        redirectTo: 'borrower-info',
        pathMatch: 'full',
      },
      {
        path: 'borrower-info',
        loadComponent: () =>
          import('./claim/borrower-info/borrower-info.component').then(
            (m) => m.BorrowerInfoComponent
          ),
        data: { step: 1 },
        canActivate: [claimStepGuard],
      },
      {
        path: 'incident-details',
        loadComponent: () =>
          import('./claim/incident-details/incident-details.component').then(
            (m) => m.IncidentDetailsComponent
          ),
        data: { step: 2 },
        canActivate: [claimStepGuard],
      },
      {
        path: 'medical-providers',
        loadComponent: () =>
          import('./claim/medical-providers/medical-providers.component').then(
            (m) => m.MedicalProvidersComponent
          ),
        data: { step: 3 },
        canActivate: [claimStepGuard],
      },
      {
        path: 'review-sign',
        loadComponent: () =>
          import('./claim/review-sign/review-sign.component').then(
            (m) => m.ReviewSignComponent
          ),
        data: { step: 4 },
        canActivate: [claimStepGuard],
      },
    ],
  },
];
