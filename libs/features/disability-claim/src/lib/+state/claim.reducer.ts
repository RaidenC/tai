/**
 * CLAIM REDUCER — Pure State Transitions for the Disability Claim Wizard
 *
 * NgRx Concept: Reducers as Pure Functions
 * A reducer takes the current state + an action and returns a NEW state.
 * It never mutates the existing state — it always produces a fresh object.
 * This immutability is what makes time-travel debugging and change detection
 * work: Angular can use reference equality (===) to know if state changed.
 *
 * createFeature() is the modern NgRx API (v15+). It:
 * 1. Defines the feature name (used as the state key in the global store)
 * 2. Bundles the reducer with auto-generated selectors for every top-level
 *    property. selectBorrower, selectIncident, selectCurrentStep, etc.
 *    are created automatically — no boilerplate.
 *
 * Why createFeature over createReducer + createSelector manually?
 * - Less code: auto-generated selectors for every state property
 * - Type-safe: the feature name becomes the state key in the store
 * - Conventional: follows the NgRx recommended pattern since v15
 * - You can still write custom selectors (see claim.selectors.ts) that
 *   compose the auto-generated ones for complex derived state.
 */

import { createFeature, createReducer, on } from '@ngrx/store';
import { ClaimActions } from './claim.actions';
import {
  DisabilityClaimDraft,
  MAX_PROVIDERS,
  initialClaimState,
} from './claim.models';

export const claimFeature = createFeature({
  name: 'claim',
  reducer: createReducer(
    initialClaimState,

    // ── Step Navigation ──────────────────────────────

    on(ClaimActions.setCurrentStep, (state, { step }): DisabilityClaimDraft => ({
      ...state,
      currentStep: step,
      // Clear any lingering error when navigating to a new step
      error: null,
    })),

    // ── Step 1: Borrower Info ────────────────────────

    /**
     * Replaces the entire borrower slice with the form values.
     * This is dispatched on step exit and on blur of SSN/email.
     * Using spread (...state) ensures we produce a new object reference
     * so Angular change detection picks it up.
     */
    on(ClaimActions.saveBorrowerInfo, (state, { borrower }): DisabilityClaimDraft => ({
      ...state,
      borrower,
    })),

    // ── Step 2: Incident Details ─────────────────────

    on(ClaimActions.saveIncidentDetails, (state, { incident }): DisabilityClaimDraft => ({
      ...state,
      incident,
    })),

    /**
     * The isWorkRelated toggle is handled separately from saveIncidentDetails
     * because it triggers immediate side-effects (an Effect fetches the
     * Workers Comp template). The reducer also handles cleanup: when toggling
     * OFF, workersCompClaimNumber is nulled out. This prevents stale data
     * from persisting if the user toggles back and forth.
     */
    on(ClaimActions.setWorkRelated, (state, { isWorkRelated }): DisabilityClaimDraft => ({
      ...state,
      incident: {
        ...state.incident,
        isWorkRelated,
        // Clean up the claim number when toggling work-related OFF
        workersCompClaimNumber: isWorkRelated
          ? state.incident.workersCompClaimNumber
          : null,
      },
    })),

    // Workers Comp template loaded — for POC, we just acknowledge it
    on(ClaimActions.workersCompTemplateLoaded, (state): DisabilityClaimDraft => state),

    // ── Step 3: Medical Providers ────────────────────

    /**
     * Add a new provider to the array.
     * Guard: if we're already at MAX_PROVIDERS (5), this is a no-op.
     * The cap is enforced HERE in the reducer, not in the UI — this is
     * a key NgRx pattern: business rules live in the state layer.
     */
    on(ClaimActions.addProvider, (state, { provider }): DisabilityClaimDraft => {
      if (state.medicalProviders.length >= MAX_PROVIDERS) {
        return state; // No-op — cap enforced in reducer
      }
      return {
        ...state,
        medicalProviders: [...state.medicalProviders, provider],
      };
    }),

    /**
     * Remove a provider by ID using .filter().
     * This produces a new array reference (immutable update).
     * With @ngrx/entity you'd call adapter.removeOne() — but for
     * a max-5 array, .filter() is clearer and equally fast.
     */
    on(ClaimActions.removeProvider, (state, { id }): DisabilityClaimDraft => ({
      ...state,
      medicalProviders: state.medicalProviders.filter(p => p.id !== id),
    })),

    /**
     * Update a specific provider by ID using .map().
     * When the ID matches, replace the entire provider object.
     * When it doesn't match, return the original (no new reference).
     */
    on(ClaimActions.updateProvider, (state, { provider }): DisabilityClaimDraft => ({
      ...state,
      medicalProviders: state.medicalProviders.map(p =>
        p.id === provider.id ? provider : p
      ),
    })),

    // ── Step 4: Documents ────────────────────────────

    on(ClaimActions.saveDocumentMeta, (state, { docType, meta }): DisabilityClaimDraft => ({
      ...state,
      documents: {
        ...state.documents,
        [docType]: meta,
      },
    })),

    on(ClaimActions.removeDocument, (state, { docType }): DisabilityClaimDraft => ({
      ...state,
      documents: {
        ...state.documents,
        [docType]: null,
      },
    })),

    // ── Submit Flow ──────────────────────────────────

    /**
     * When the user clicks Submit, we set isSubmitting = true.
     * This disables the button and grays out the form (see interaction
     * states in the design doc). An Effect handles the actual API call.
     */
    on(ClaimActions.submitClaim, (state): DisabilityClaimDraft => ({
      ...state,
      isSubmitting: true,
      error: null, // Clear any previous error
    })),

    on(ClaimActions.submitClaimSuccess, (state, { claimId }): DisabilityClaimDraft => ({
      ...state,
      claimId,
      isSubmitting: false,
    })),

    on(ClaimActions.submitClaimError, (state, { message }): DisabilityClaimDraft => ({
      ...state,
      isSubmitting: false,
      error: message,
    })),

    // ── Error Handling ───────────────────────────────

    on(ClaimActions.apiError, (state, { message }): DisabilityClaimDraft => ({
      ...state,
      error: message,
    })),

    on(ClaimActions.clearError, (state): DisabilityClaimDraft => ({
      ...state,
      error: null,
    })),

    // ── Reset ────────────────────────────────────────

    /**
     * Nuclear option: returns to the initial blank state.
     * The meta-reducer will persist this to localStorage too,
     * effectively wiping the saved draft.
     */
    on(ClaimActions.resetClaim, (): DisabilityClaimDraft => ({
      ...initialClaimState,
    })),
  ),
});

/**
 * Auto-generated selectors from createFeature().
 * These select individual top-level properties from the claim state:
 *
 *   claimFeature.selectBorrower      → state.claim.borrower
 *   claimFeature.selectIncident      → state.claim.incident
 *   claimFeature.selectCurrentStep   → state.claim.currentStep
 *   claimFeature.selectIsSubmitting  → state.claim.isSubmitting
 *   claimFeature.selectError         → state.claim.error
 *   ... etc.
 *
 * For composed/derived selectors (e.g., selectCanSubmit), see claim.selectors.ts.
 */
