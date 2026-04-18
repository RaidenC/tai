/**
 * BORROWER PORTAL — Application Configuration
 *
 * This is where NgRx is bootstrapped for the entire app.
 * provideStore() creates the global store with the meta-reducer.
 * provideEffects() registers the claim effects.
 * provideStoreDevtools() enables Redux DevTools (dev-only).
 *
 * The claim feature state is registered here at the app level
 * (not lazy-loaded) because the meta-reducer needs to hydrate
 * from localStorage on app startup, before any routes load.
 */
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { appRoutes } from './app.routes';
import {
  claimFeature,
  fetchWorkersCompTemplate,
  submitClaim,
} from './claim/+state';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),

    /**
     * provideStore() sets up the global NgRx store.
     *
     * The first argument registers feature reducers. We register the claim
     * feature here (not via provideState in a lazy route) so it can
     * initialize on app startup.
     */
    provideStore(
      { [claimFeature.name]: claimFeature.reducer }
    ),

    /**
     * provideEffects() registers side-effect handlers.
     * These are functional effects (NgRx v15+ pattern) — just functions,
     * no classes needed.
     */
    provideEffects({ fetchWorkersCompTemplate, submitClaim }),

    /**
     * Redux DevTools integration — only in development.
     * Opens the browser extension's time-travel debugger.
     * maxAge limits the action history to 50 entries to avoid memory bloat.
     */
    provideStoreDevtools({
      maxAge: 50,
      logOnly: !isDevMode(),
      name: 'Borrower Portal — NgRx Store',
    }),
  ],
};
