import { Provider } from '@angular/core';

export const environment = {
  enableE2eConnectionHook: false,
} as const;

/**
 * Additional providers for production builds.
 * Empty array - no test hook providers in production.
 */
export const environmentProviders: Provider[] = [];