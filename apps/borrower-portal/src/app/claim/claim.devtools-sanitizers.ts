/**
 * DevTools state and action sanitizers.
 * Masks SSN (ssnLastFour) in Redux DevTools to prevent PII leaks
 * through the browser extension.
 */

export function stateSanitizer(state: any): any {
  if (!state?.claim?.borrower) return state;
  return {
    ...state,
    claim: {
      ...state.claim,
      borrower: {
        ...state.claim.borrower,
        ssnLastFour: state.claim.borrower.ssnLastFour ? '****' : '',
      },
    },
  };
}

export function actionSanitizer(action: any): any {
  if (!action) return action;

  if (action.type === '[Claim] Save Borrower Info' && action.borrower) {
    return {
      ...action,
      borrower: { ...action.borrower, ssnLastFour: '****' },
    };
  }

  if (action.type === '[Claim] Draft Loaded' && action.draft?.borrower) {
    return {
      ...action,
      draft: {
        ...action.draft,
        borrower: { ...action.draft.borrower, ssnLastFour: '****' },
      },
    };
  }

  return action;
}
