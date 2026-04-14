import { Route } from '@angular/router';

/**
 * App Routes — Borrower Portal Wizard
 *
 * Lazy-loads the disability-claim feature library.
 * Each step is a child route with ClaimStepGuard protecting navigation.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'claim/borrower-info',
    pathMatch: 'full',
  },
  {
    path: 'claim',
    loadChildren: () =>
      import('disability-claim').then((m) => m.claimRoutes),
  },
];
