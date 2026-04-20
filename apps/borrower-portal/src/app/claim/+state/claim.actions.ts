/**
 * CLAIM ACTIONS — The Event Catalog for the Disability Claim Wizard
 *
 * NgRx Concept: Actions as Events
 * Actions are the ONLY way to change state in NgRx. Think of them as an
 * event log — every user interaction, API response, and navigation event
 * gets recorded as a typed action. This is what makes replay possible:
 * we can serialize the action stream and play it back later.
 *
 * Naming convention: [Source] Event Description
 * - [Claim Form] = user interaction in the wizard UI
 * - [Claim API] = response from an API call (via Effects)
 * - [Claim Nav] = navigation/routing event
 * - [Claim Replay] = replay system control
 *
 * Why not just call reducer functions directly?
 * Because actions create an audit trail. With Redux DevTools open, you can
 * see every action that was dispatched, in order, with timestamps. When a
 * bug occurs, you can trace exactly which action caused the bad state.
 * This is impossible with direct state mutation or BehaviorSubject.set().
 */

import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  BorrowerInfo,
  DisabilityClaimDraft,
  DocumentMeta,
  IncidentDetails,
  MedicalProvider,
} from './claim.models';

/**
 * createActionGroup bundles related actions under a shared source prefix.
 * Each action gets a strongly-typed creator function.
 *
 * Usage: store.dispatch(ClaimActions.saveBorrowerInfo({ borrower: {...} }))
 *
 * The action type string becomes "[Claim] Save Borrower Info" — readable
 * in Redux DevTools and in the State Inspector's action log.
 */
export const ClaimActions = createActionGroup({
  source: 'Claim',
  events: {
    // ── Step Navigation ──────────────────────────────
    /**
     * Dispatched when the user navigates between wizard steps.
     * The CDK Stepper's (selectionChange) event triggers this.
     */
    'Set Current Step': props<{ step: number }>(),

    // ── Step 1: Borrower Info ────────────────────────
    /**
     * Dispatched on step exit (navigating away) or on blur
     * of critical fields (SSN, email). Saves the entire
     * borrower form slice to the store in one shot.
     */
    'Save Borrower Info': props<{ borrower: BorrowerInfo }>(),

    // ── Step 2: Incident Details ─────────────────────
    /**
     * Dispatched on step exit. Saves the incident form slice.
     */
    'Save Incident Details': props<{ incident: IncidentDetails }>(),

    /**
     * Dispatched when the "Was this work-related?" toggle changes.
     * When toggling to false: the reducer clears workersCompClaimNumber.
     * When toggling to true: an Effect kicks off fetchWorkersCompTemplate.
     *
     * This is separate from saveIncidentDetails because the toggle
     * triggers side-effects immediately (not just on step exit).
     */
    'Set Work Related': props<{ isWorkRelated: boolean }>(),

    /**
     * Dispatched by the fetchWorkersCompTemplate Effect on success.
     * For the POC, this is a mock — it just confirms the template loaded.
     */
    'Workers Comp Template Loaded': props<{ templateId: string }>(),

    // ── Step 3: Medical Providers ────────────────────
    /**
     * Dispatched when clicking "+ Add Provider".
     * The reducer appends to the array (up to MAX_PROVIDERS = 5).
     * The component generates the UUID before dispatching.
     */
    'Add Provider': props<{ provider: MedicalProvider }>(),

    /**
     * Dispatched when clicking "Remove" on a provider card.
     * The reducer filters the array by id.
     */
    'Remove Provider': props<{ id: string }>(),

    /**
     * Dispatched on blur of any field within a provider card.
     * The reducer maps over the array and replaces the matching item.
     */
    'Update Provider': props<{ provider: MedicalProvider }>(),

    // ── Step 4: Documents ────────────────────────────
    /**
     * Dispatched after a file is successfully stored in IndexedDB.
     * Only the metadata (name, size, timestamp) goes into NgRx state.
     * The actual file blob stays in IndexedDB.
     *
     * `docType` identifies which document slot this fills.
     */
    'Save Document Meta': props<{
      docType: 'employerLeaveForm' | 'attendingPhysicianStatement';
      meta: DocumentMeta;
    }>(),

    /**
     * Dispatched when the user removes an uploaded document.
     */
    'Remove Document': props<{
      docType: 'employerLeaveForm' | 'attendingPhysicianStatement';
    }>(),

    // ── Submit Flow ──────────────────────────────────
    /**
     * Dispatched when the user clicks "Submit Claim" on Step 4.
     * Sets isSubmitting = true. An Effect picks this up, grabs the
     * full draft from the store via withLatestFrom, and fires the
     * API call (mocked for POC).
     */
    'Submit Claim': emptyProps(),

    /**
     * Dispatched by the submit Effect on success.
     * Sets isSubmitting = false and stores the claim reference ID.
     */
    'Submit Claim Success': props<{ claimId: string }>(),

    /**
     * Dispatched by the submit Effect on failure.
     * Sets isSubmitting = false and stores the error message.
     */
    'Submit Claim Error': props<{ message: string }>(),

    // ── Error Handling ───────────────────────────────
    /**
     * Generic error action for non-blocking failures (e.g., Workers
     * Comp template fetch failure). Sets state.error for display.
     */
    'Api Error': props<{ message: string }>(),

    /**
     * Clears the error state. Dispatched when the user dismisses
     * an error banner or navigates to a new step.
     */
    'Clear Error': emptyProps(),

    // ── Reset ────────────────────────────────────────
    /**
     * Resets the entire claim draft to initialState.
     * Used after successful submission ("Start New Claim") or
     * when the user explicitly clears their draft.
     */
    'Reset Claim': emptyProps(),

    // ── Draft Persistence ───────────────────────────
    'Draft Saved': emptyProps(),
    'Draft Save Error': props<{ message: string }>(),
    'Draft Loaded': props<{ draft: DisabilityClaimDraft }>(),
    'Draft Load Error': props<{ message: string }>(),
  },
});
