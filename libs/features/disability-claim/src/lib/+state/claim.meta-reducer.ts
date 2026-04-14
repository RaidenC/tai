/**
 * CLAIM META-REDUCER — localStorage Hydration
 *
 * NgRx Concept: Meta-Reducers
 * A meta-reducer wraps the entire store's root reducer. It intercepts every
 * action BEFORE it reaches the feature reducers, and every state change AFTER.
 * Think of it as middleware for your state.
 *
 * Why not just write localStorage logic in each component?
 * - You'd need to call localStorage.setItem() in every component that modifies state.
 * - Miss one? The user loses data on refresh.
 * - With a meta-reducer, it's ONE place. Every state change is automatically persisted.
 *
 * Why not use a BehaviorSubject service with localStorage?
 * - A BehaviorSubject can hold state, but it doesn't give you action-based history,
 *   time-travel debugging, or the ability to replay the exact sequence of changes.
 * - The meta-reducer preserves all of that for free.
 *
 * How it works:
 * 1. On app startup (the INIT or UPDATE action), read from localStorage.
 *    If valid JSON exists, merge it into the initial state. If corrupt, ignore it.
 * 2. On every subsequent action, AFTER the reducer produces new state,
 *    serialize the claim slice to localStorage.
 *
 * This is ~30 lines of code that replaces what would otherwise be manual
 * localStorage.getItem/setItem calls scattered across 4+ components.
 * That's the meta-reducer pitch in an interview.
 */

import { ActionReducer, INIT, UPDATE } from '@ngrx/store';
import { DisabilityClaimDraft, initialClaimState } from './claim.models';

/** The localStorage key where the claim draft is persisted */
export const STORAGE_KEY = 'borrower_claim_draft';

/**
 * Attempts to read and parse the stored claim draft from localStorage.
 * Returns the parsed state if valid, or null if missing/corrupt.
 *
 * Defensive parsing:
 * - JSON.parse can throw on corrupt data
 * - The parsed object might not match our interface (e.g., schema changed
 *   between deployments). We check for the presence of `currentStep` as a
 *   simple schema version indicator. A production app might use a version field.
 */
export function loadStateFromStorage(): DisabilityClaimDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Basic schema check: if currentStep doesn't exist, the stored data
    // is from an incompatible version. Start fresh.
    if (typeof parsed.currentStep !== 'number') return null;

    return parsed as DisabilityClaimDraft;
  } catch {
    // Corrupt JSON, localStorage disabled, quota exceeded, etc.
    // Silently start fresh — don't show an error for this.
    return null;
  }
}

/**
 * Saves the claim state to localStorage.
 * Called on every state change (after reducer runs).
 *
 * The state is small (~1KB) because documents store metadata only
 * (file blobs live in IndexedDB). JSON.stringify on 1KB is sub-millisecond.
 */
export function saveStateToStorage(state: DisabilityClaimDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled (private browsing).
    // For the POC, silently ignore. A production app might dispatch
    // an action to show a "progress may not be saved" warning.
  }
}

/**
 * The meta-reducer factory.
 *
 * This function takes a reducer and returns a new reducer that wraps it.
 * NgRx calls meta-reducers in order, outermost first, before calling
 * the actual feature reducers. This one:
 *
 * 1. On INIT/UPDATE: hydrates the claim slice from localStorage
 * 2. On every action: runs the inner reducer, then saves to localStorage
 *
 * Usage (in app.config.ts or store registration):
 *   provideStore({}, { metaReducers: [localStorageMetaReducer] })
 *
 * The meta-reducer operates on the ENTIRE store state (not just the claim
 * slice), so it reads/writes state['claim'] specifically.
 */
export function localStorageMetaReducer(
  reducer: ActionReducer<any>
): ActionReducer<any> {
  return (state, action) => {
    // ── HYDRATION: on app startup, merge stored state ──
    if (action.type === INIT || action.type === UPDATE) {
      const stored = loadStateFromStorage();
      if (stored) {
        // Merge the stored claim state into whatever the reducer produces.
        // Other feature states (if any) are unaffected.
        const newState = reducer(state, action);
        return {
          ...newState,
          claim: {
            ...initialClaimState,
            ...stored,
          },
        };
      }
    }

    // ── NORMAL FLOW: run the reducer, then persist ──
    const nextState = reducer(state, action);

    // Only persist if the claim slice exists (it won't on the very first INIT
    // before the feature is registered, depending on timing)
    if (nextState?.claim) {
      saveStateToStorage(nextState.claim);
    }

    return nextState;
  };
}
