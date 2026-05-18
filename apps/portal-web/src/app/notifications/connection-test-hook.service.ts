import { Injectable, signal, Signal } from '@angular/core';
import { HubConnectionState } from '@microsoft/signalr';
import { ConnectionTestHookServiceInterface } from './connection-test-hook.token';

declare global {
  interface Window {
    __testConnectionStateOverride__?: (state: HubConnectionState | keyof typeof HubConnectionState) => void;
  }
}

/**
 * Coerces a HubConnectionState value or enum member name to the actual enum value.
 * Returns null for invalid values.
 */
function coerceHubConnectionState(state: HubConnectionState | keyof typeof HubConnectionState): HubConnectionState | null {
  // Handle numeric enum values
  if (typeof state === 'number' && Object.values(HubConnectionState).includes(state)) {
    return state;
  }

  // Handle string enum member names (e.g., 'Connected', 'Disconnected')
  if (typeof state === 'string' && Object.prototype.hasOwnProperty.call(HubConnectionState, state)) {
    return HubConnectionState[state as keyof typeof HubConnectionState] as HubConnectionState;
  }

  return null;
}

/**
 * Service that provides an E2E test hook for overriding connection state.
 * This service is only provided when environment.enableE2eConnectionHook is true,
 * ensuring the hook string is tree-shaken from production builds.
 */
@Injectable()
export class ConnectionTestHookService implements ConnectionTestHookServiceInterface {
  private readonly overrideSignal = signal<HubConnectionState | null>(null);
  readonly connectionStateOverride: Signal<HubConnectionState | null> = this.overrideSignal.asReadonly();

  /**
   * Installs the E2E test hook on the window object for Playwright tests.
   * Should be called once during app initialization.
   */
  installHook(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.__testConnectionStateOverride__ = (state: HubConnectionState | keyof typeof HubConnectionState) => {
      const nextState = coerceHubConnectionState(state);
      if (nextState === null) {
        // Invalid state name - ignore and keep current state
        return;
      }
      this.overrideSignal.set(nextState);
    };
  }
}