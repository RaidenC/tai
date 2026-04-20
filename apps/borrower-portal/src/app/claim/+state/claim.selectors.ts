/**
 * CLAIM SELECTORS — Memoized Derived State for the Disability Claim Wizard
 *
 * NgRx Concept: Memoized Selectors via createSelector()
 * Selectors are pure functions that extract and DERIVE data from the store.
 * createSelector() memoizes the result: if none of the input selectors
 * return a new reference, the projector function is NOT re-executed.
 *
 * Why this matters in a multi-step wizard:
 * When the user types in Step 3 (Medical Providers), only selectMedicalProviders
 * returns a new reference. selectBorrower and selectIncident return their
 * cached values. The projector in selectCanSubmit only runs when it actually
 * needs to — not on every keystroke in every step.
 *
 * With Angular Signals or BehaviorSubjects, you'd need to manually track
 * which pieces changed and avoid recomputing derived state. Selectors
 * handle this automatically via referential equality checks on inputs.
 *
 * The auto-generated selectors from createFeature() (in claim.reducer.ts)
 * give us one selector per top-level state property. HERE we compose
 * those into higher-level derived selectors that answer business questions:
 * "Is step 2 valid?" "Can the user submit?" "Is this work-related?"
 */

import { createSelector } from '@ngrx/store';
import { claimFeature } from './claim.reducer';
import { MAX_PROVIDERS } from './claim.models';

// ──────────────────────────────────────────────
// Re-export auto-generated selectors for convenience
// ──────────────────────────────────────────────

export const {
  selectBorrower,
  selectIncident,
  selectMedicalProviders,
  selectDocuments,
  selectCurrentStep,
  selectIsSubmitting,
  selectError,
  selectClaimId,
  selectClaimState,  // Selects the entire claim feature state
} = claimFeature;

// ──────────────────────────────────────────────
// Derived Selectors — Step Validity
// ──────────────────────────────────────────────

/**
 * Step 1 is valid when all required borrower fields are non-empty.
 * This selector is used by:
 * - The stepper (to show a green checkmark on Step 1)
 * - The ClaimStepGuard (to allow/block navigation to Step 2+)
 * - selectCanSubmit (to determine if the full claim is submittable)
 */
export const selectBorrowerValid = createSelector(
  selectBorrower,
  (borrower) =>
    borrower?.firstName?.trim()?.length > 0 &&
    borrower?.lastName?.trim()?.length > 0 &&
    borrower?.ssnLastFour?.trim()?.length === 4 &&
    borrower?.phone?.trim()?.length > 0 &&
    borrower?.email?.trim()?.length > 0
);

/**
 * Step 2 is valid when the required incident fields are filled.
 * Note: workersCompClaimNumber is only required when isWorkRelated === true.
 */
export const selectIncidentValid = createSelector(
  selectIncident,
  (incident) =>
    incident.dateOfDisability.trim().length > 0 &&
    incident.disabilityType !== null &&
    incident.description.trim().length > 0 &&
    // If work-related, the claim number must also be filled
    (!incident.isWorkRelated || (incident.workersCompClaimNumber?.trim().length ?? 0) > 0)
);

/**
 * Convenience selector: is this a work-related claim?
 * Used by the UI to show/hide the conditional sub-form, and by
 * Effects to decide whether to fetch the Workers Comp template.
 */
export const selectIsWorkRelated = createSelector(
  selectIncident,
  (incident) => incident.isWorkRelated
);

/**
 * Step 3 is valid when at least one provider is present AND
 * every provider has all required fields filled.
 *
 * .every() on an empty array returns true — so we explicitly
 * check length > 0 first. A common source of bugs in form validation.
 */
export const selectProvidersValid = createSelector(
  selectMedicalProviders,
  (providers) =>
    providers.length > 0 &&
    providers.every(
      p =>
        p.doctorName.trim().length > 0 &&
        p.clinicName.trim().length > 0 &&
        p.phone.trim().length > 0 &&
        p.dateFirstTreated.trim().length > 0
    )
);

/**
 * Step 4 documents: at least one document must be uploaded.
 * In a real app, both might be required — for the POC, one is sufficient.
 */
export const selectDocumentsValid = createSelector(
  selectDocuments,
  (docs) =>
    docs.employerLeaveForm !== null ||
    docs.attendingPhysicianStatement !== null
);

/**
 * Can the user add more providers? Used to enable/disable the
 * "+ Add Provider" button and show the "X of 5" counter.
 */
export const selectCanAddProvider = createSelector(
  selectMedicalProviders,
  (providers) => providers.length < MAX_PROVIDERS
);

/**
 * Provider count for the "X of 5" display.
 */
export const selectProviderCount = createSelector(
  selectMedicalProviders,
  (providers) => providers.length
);

// ──────────────────────────────────────────────
// Composed Selector — The Whole Wizard
// ──────────────────────────────────────────────

/**
 * selectCanSubmit — The flagship composed selector.
 *
 * This selector composes data from ALL 4 steps to determine if the claim
 * can be submitted. NgRx memoizes the result: if none of the input selectors
 * return a new value, the projector function is NOT re-executed.
 *
 * In a wizard with 4 routes, this is the payoff. When the user types in Step 3,
 * only selectProvidersValid recomputes. selectBorrowerValid and selectIncidentValid
 * return cached values. The projector only runs when it actually needs to.
 *
 * With Angular Signals, you'd need to manually track which signals changed
 * and avoid recomputing derived state across 4 different route components.
 * NgRx does this automatically via referential equality checks.
 *
 * This selector is read by:
 * - Step 4's Submit button [disabled] binding
 * - The State Inspector panel (to show the composed result)
 */
export const selectCanSubmit = createSelector(
  selectBorrowerValid,
  selectIncidentValid,
  selectProvidersValid,
  selectDocumentsValid,
  (borrower, incident, providers, documents) =>
    borrower && incident && providers && documents
);

/**
 * selectStepValidity — Returns validity for all steps as an object.
 * Used by the CDK Stepper to show completed/incomplete indicators
 * and by the State Inspector to display step status.
 */
export const selectStepValidity = createSelector(
  selectBorrowerValid,
  selectIncidentValid,
  selectProvidersValid,
  selectDocumentsValid,
  (borrower, incident, providers, documents) => ({
    step1: borrower,
    step2: incident,
    step3: providers,
    step4: documents,
  })
);
