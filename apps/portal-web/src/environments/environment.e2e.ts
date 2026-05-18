import { Provider } from '@angular/core';
import { CONNECTION_TEST_HOOK_SERVICE } from '../app/notifications/connection-test-hook.token';
import { ConnectionTestHookService } from '../app/notifications/connection-test-hook.service';

export const environment = {
  enableE2eConnectionHook: true,
} as const;

/**
 * Additional providers for E2E/test builds.
 * Includes ConnectionTestHookService for the connection state test hook.
 * This file is only used in test builds, so the service import
 * is tree-shaken from production builds.
 */
export const environmentProviders: Provider[] = [
  { provide: CONNECTION_TEST_HOOK_SERVICE, useClass: ConnectionTestHookService },
];