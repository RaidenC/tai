import { Provider } from '@angular/core';

export const environment = {
  enableE2eConnectionHook: false,
} as const;

/**
 * Additional providers for development builds.
 * Empty array - no test hook providers in development.
 */
export const environmentProviders: Provider[] = [];