import { DisabilityClaimDraft } from './claim.models';

/**
 * Strips PII that must NEVER be persisted client-side.
 * Called by the autoSaveDraft effect before any write.
 *
 * Returns a new object (immutable). The original state is untouched.
 */
export function sanitizeForPersistence(
  state: DisabilityClaimDraft
): DisabilityClaimDraft {
  return {
    ...state,
    borrower: {
      ...state.borrower,
      ssnLastFour: '', // GLBA: never persisted
    },
  };
}
