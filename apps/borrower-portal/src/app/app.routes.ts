import { Route } from '@angular/router';
import { claimRoutes } from 'disability-claim';

/**
 * App Routes — Borrower Portal Wizard
 *
 * The disability-claim feature is eagerly loaded because NgRx store
 * initialization happens in app.config.ts for localStorage hydration.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'claim/borrower-info',
    pathMatch: 'full',
  },
  {
    path: 'claim',
    children: claimRoutes,
  },
];
