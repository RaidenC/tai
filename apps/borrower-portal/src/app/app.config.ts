import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { appRoutes } from './app.routes';
import {
  claimFeature,
  fetchWorkersCompTemplate,
  submitClaim,
  autoSaveDraft,
  loadDraft,
  clearDraftOnReset,
} from './claim/+state';
import {
  stateSanitizer,
  actionSanitizer,
} from './claim/claim.devtools-sanitizers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),

    provideHttpClient(),

    provideStore({ [claimFeature.name]: claimFeature.reducer }),

    provideEffects({
      fetchWorkersCompTemplate,
      submitClaim,
      autoSaveDraft,
      loadDraft,
      clearDraftOnReset,
    }),

    provideStoreDevtools({
      maxAge: 50,
      logOnly: !isDevMode(),
      name: 'Borrower Portal — NgRx Store',
      stateSanitizer,
      actionSanitizer,
    }),
  ],
};
