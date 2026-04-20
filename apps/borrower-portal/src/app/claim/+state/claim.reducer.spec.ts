import { claimFeature } from './claim.reducer';
import { ClaimActions } from './claim.actions';
import { DisabilityClaimDraft, initialClaimState } from './claim.models';

describe('claimReducer — draftLoaded', () => {
  const reducer = claimFeature.reducer;

  const hydratedDraft: DisabilityClaimDraft = {
    ...initialClaimState,
    currentStep: 3,
    borrower: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    },
    incident: {
      dateOfDisability: '2026-01-15',
      disabilityType: 'Illness',
      isWorkRelated: false,
      workersCompClaimNumber: null,
      description: 'Back injury',
    },
    isSubmitting: true,
    error: 'stale error',
  };

  it('merges loaded draft into state', () => {
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: hydratedDraft }));
    expect(result.borrower.firstName).toBe('Jane');
    expect(result.incident.disabilityType).toBe('Illness');
    expect(result.currentStep).toBe(3);
  });

  it('forces ssnLastFour to empty string (defense-in-depth)', () => {
    const draftWithSSN = {
      ...hydratedDraft,
      borrower: { ...hydratedDraft.borrower, ssnLastFour: '9999' },
    };
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: draftWithSSN }));
    expect(result.borrower.ssnLastFour).toBe('');
  });

  it('resets isSubmitting to false', () => {
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: hydratedDraft }));
    expect(result.isSubmitting).toBe(false);
  });

  it('resets error to null', () => {
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: hydratedDraft }));
    expect(result.error).toBeNull();
  });

  it('returns new state reference', () => {
    const result = reducer(initialClaimState, ClaimActions.draftLoaded({ draft: hydratedDraft }));
    expect(result).not.toBe(initialClaimState);
  });
});
