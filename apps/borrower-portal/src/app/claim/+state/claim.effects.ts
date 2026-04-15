/**
 * CLAIM EFFECTS — Side-Effect Handling for the Disability Claim Wizard
 *
 * NgRx Concept: Effects as Side-Effect Managers
 * Effects listen for specific actions and perform side-effects: API calls,
 * localStorage writes, navigation, logging. They are the ONLY place where
 * async or impure operations should happen in an NgRx app.
 *
 * Why not put API calls in components?
 * 1. Components would need to know about HTTP, error handling, and retry logic.
 * 2. The same API call might be triggered from multiple places (UI click,
 *    route guard, replay system). Effects centralize the logic.
 * 3. Effects can be suppressed during replay (via REPLAY_MODE injection token).
 *    If API calls lived in components, replay would fire real API calls.
 *
 * Key RxJS operators used here:
 * - switchMap: cancels the previous inner observable when a new action arrives.
 *   Used for fetchWorkersCompTemplate — if the user toggles isWorkRelated
 *   rapidly, only the latest request completes.
 * - withLatestFrom: grabs the current store state without subscribing to it.
 *   Used in submitClaim to grab the entire 4-page draft in one shot.
 * - catchError: catches errors from the inner observable and maps them to
 *   error actions. NEVER re-throws — that would kill the effect stream.
 */

import { inject, InjectionToken } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  delay,
  filter,
  map,
  of,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import { ClaimActions } from './claim.actions';
import { selectClaimState, selectIsWorkRelated } from './claim.selectors';

/**
 * REPLAY_MODE Injection Token
 *
 * When the replay system is active, effects should NOT fire real API calls
 * or trigger navigation. This token provides a signal that effects can check.
 *
 * During normal operation: { active: false }
 * During replay: { active: true }
 *
 * The replay service sets this before dispatching recorded actions,
 * and clears it when replay completes.
 */
export const REPLAY_MODE = new InjectionToken<{ active: boolean }>(
  'Replay Mode Flag',
  { providedIn: 'root', factory: () => ({ active: false }) }
);

/**
 * fetchWorkersCompTemplate$
 *
 * Triggers when setWorkRelated is dispatched. Checks if isWorkRelated is now
 * true, then fetches the Workers Comp form template (mocked as a 500ms delay).
 *
 * Key patterns demonstrated:
 * - switchMap: if the user toggles isWorkRelated rapidly (true → false → true),
 *   switchMap cancels the previous in-flight request. No race conditions.
 * - filter: only proceed when isWorkRelated is true. When toggled to false,
 *   the effect does nothing (the reducer already cleaned up the state).
 * - REPLAY_MODE check: during replay, skip the API call entirely.
 */
export const fetchWorkersCompTemplate = createEffect(
  (
    actions$ = inject(Actions),
    store = inject(Store),
    replayMode = inject(REPLAY_MODE),
  ) => {
    return actions$.pipe(
      ofType(ClaimActions.setWorkRelated),

      // Don't fire API calls during replay
      filter(() => !replayMode.active),

      // Read the current isWorkRelated value from the store
      // (it's already been updated by the reducer at this point)
      withLatestFrom(store.select(selectIsWorkRelated)),

      // Only proceed if isWorkRelated is now true
      filter(([, isWorkRelated]) => isWorkRelated),

      // switchMap cancels any previous in-flight fetch.
      // If the user toggles work-related off and back on quickly,
      // only the latest fetch completes.
      switchMap(() =>
        // Mock API call — in production, this would be an HTTP request
        // to fetch the Workers Comp form template
        of({ templateId: 'WC-TEMPLATE-001' }).pipe(
          // Simulate network latency
          delay(500),
          map(({ templateId }) =>
            ClaimActions.workersCompTemplateLoaded({ templateId })
          ),
          catchError(() =>
            // Non-blocking error — the user can continue without the template
            of(
              ClaimActions.apiError({
                message:
                  'Could not load Workers Comp template. You can continue without it.',
              })
            )
          )
        )
      )
    );
  },
  { functional: true }
);

/**
 * submitClaim$
 *
 * The grand finale effect. When the user clicks "Submit Claim":
 * 1. withLatestFrom grabs the ENTIRE claim draft from the store in one shot.
 *    This is the power of a global store — the submit effect doesn't need to
 *    know which components collected which data. It just reads the truth.
 * 2. The draft is packaged and sent to the API (mocked for POC).
 * 3. On success: dispatches submitClaimSuccess with a reference ID.
 * 4. On error: dispatches submitClaimError with a user-friendly message.
 *    The draft is NOT destroyed — the user can fix and retry.
 */
export const submitClaim = createEffect(
  (
    actions$ = inject(Actions),
    store = inject(Store),
    replayMode = inject(REPLAY_MODE),
  ) => {
    return actions$.pipe(
      ofType(ClaimActions.submitClaim),

      // Don't submit during replay
      filter(() => !replayMode.active),

      /**
       * withLatestFrom grabs the entire claim state from the store.
       * This is the key NgRx pattern for submit effects:
       * - The effect doesn't need constructor-injected form values
       * - It doesn't need to know which components exist
       * - It just reads the single source of truth
       */
      withLatestFrom(store.select(selectClaimState)),

      switchMap(() =>
        // Mock API call — in production, this would POST the claim draft
        // to the backend API endpoint
        of({
          claimId: `CLM-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
        }).pipe(
          // Simulate network latency
          delay(1500),
          map(({ claimId }) => ClaimActions.submitClaimSuccess({ claimId })),
          catchError(() =>
            of(
              ClaimActions.submitClaimError({
                message: 'Unable to submit your claim. Please try again.',
              })
            )
          )
        )
      )
    );
  },
  { functional: true }
);
