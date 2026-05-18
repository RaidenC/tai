import { InjectionToken, Signal } from '@angular/core';
import { HubConnectionState } from '@microsoft/signalr';

/**
 * InjectionToken for the connection test hook service.
 * Only provided when environment.enableE2eConnectionHook is true.
 * Using an InjectionToken allows the service implementation to be tree-shaken
 * when not provided in production builds.
 */
export const CONNECTION_TEST_HOOK_SERVICE = new InjectionToken<ConnectionTestHookServiceInterface>('ConnectionTestHookService');

/**
 * Interface for the connection test hook service.
 * Used to allow type-safe injection without importing the actual service class.
 */
export interface ConnectionTestHookServiceInterface {
  readonly connectionStateOverride: Signal<HubConnectionState | null>;
  installHook(): void;
}