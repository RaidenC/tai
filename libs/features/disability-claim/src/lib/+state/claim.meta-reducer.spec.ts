/**
 * META-REDUCER TESTS — localStorage Hydration
 *
 * These tests verify the marquee NgRx pattern: automatic state persistence.
 * The meta-reducer should:
 * 1. Serialize state to localStorage on every dispatch
 * 2. Deserialize state from localStorage on app init
 * 3. Handle corrupt/missing localStorage gracefully
 * 4. Respect the REPLAY_MODE flag (tested in effects spec)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { INIT, UPDATE } from '@ngrx/store';
import {
  localStorageMetaReducer,
  loadStateFromStorage,
  saveStateToStorage,
  STORAGE_KEY,
} from './claim.meta-reducer';
import { initialClaimState, DisabilityClaimDraft } from './claim.models';

// Mock localStorage for isolated testing
const mockStorage: Record<string, string> = {};

beforeEach(() => {
  // Clear mock storage before each test
  Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
  });
});

describe('loadStateFromStorage', () => {
  it('should return null when localStorage is empty', () => {
    expect(loadStateFromStorage()).toBeNull();
  });

  it('should parse valid stored state', () => {
    const stored: DisabilityClaimDraft = {
      ...initialClaimState,
      currentStep: 3,
      borrower: {
        ...initialClaimState.borrower,
        firstName: 'John',
      },
    };
    mockStorage[STORAGE_KEY] = JSON.stringify(stored);

    const result = loadStateFromStorage();
    expect(result).not.toBeNull();
    expect(result!.currentStep).toBe(3);
    expect(result!.borrower.firstName).toBe('John');
  });

  it('should return null for corrupt JSON', () => {
    mockStorage[STORAGE_KEY] = '{not valid json!!!';
    expect(loadStateFromStorage()).toBeNull();
  });

  it('should return null for incompatible schema (missing currentStep)', () => {
    mockStorage[STORAGE_KEY] = JSON.stringify({ foo: 'bar' });
    expect(loadStateFromStorage()).toBeNull();
  });
});

describe('saveStateToStorage', () => {
  it('should serialize state to localStorage', () => {
    const state: DisabilityClaimDraft = {
      ...initialClaimState,
      currentStep: 2,
    };

    saveStateToStorage(state);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  });
});

describe('localStorageMetaReducer', () => {
  // Create a simple inner reducer that just returns state
  const innerReducer = (state: any = {}, _action: any) => state;
  const wrappedReducer = localStorageMetaReducer(innerReducer);

  it('should hydrate claim state from localStorage on INIT', () => {
    const stored: DisabilityClaimDraft = {
      ...initialClaimState,
      currentStep: 2,
      borrower: {
        ...initialClaimState.borrower,
        firstName: 'Jane',
        lastName: 'Doe',
      },
    };
    mockStorage[STORAGE_KEY] = JSON.stringify(stored);

    const result = wrappedReducer(undefined, { type: INIT });

    expect(result.claim.currentStep).toBe(2);
    expect(result.claim.borrower.firstName).toBe('Jane');
    expect(result.claim.borrower.lastName).toBe('Doe');
  });

  it('should hydrate claim state from localStorage on UPDATE', () => {
    const stored: DisabilityClaimDraft = {
      ...initialClaimState,
      currentStep: 4,
    };
    mockStorage[STORAGE_KEY] = JSON.stringify(stored);

    const result = wrappedReducer(undefined, { type: UPDATE });

    expect(result.claim.currentStep).toBe(4);
  });

  it('should fall back to initial state when localStorage is empty', () => {
    // No stored data — the reducer should just return what innerReducer produces
    const result = wrappedReducer({ claim: initialClaimState }, { type: 'SOME_ACTION' });

    // State passes through unchanged
    expect(result.claim).toEqual(initialClaimState);
  });

  it('should persist claim state to localStorage after every action', () => {
    const stateWithClaim = {
      claim: {
        ...initialClaimState,
        currentStep: 3,
      },
    };

    // Use a reducer that returns the state we provide
    const statefulReducer = (_state: any, _action: any) => stateWithClaim;
    const wrapped = localStorageMetaReducer(statefulReducer);

    wrapped(stateWithClaim, { type: 'ANY_ACTION' });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(stateWithClaim.claim)
    );
  });
});
