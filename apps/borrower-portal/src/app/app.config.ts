import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
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
import { mockApiInterceptor } from './claim/services/mock-api.interceptor';
import {
  stateSanitizer,
  actionSanitizer,
} from './claim/claim.devtools-sanitizers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),

    provideHttpClient(withInterceptors([mockApiInterceptor])),

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
