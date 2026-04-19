import { stateSanitizer, actionSanitizer } from './claim.devtools-sanitizers';

describe('DevTools Sanitizers', () => {
  describe('stateSanitizer', () => {
    it('masks SSN in state', () => {
      const state = {
        claim: {
          borrower: { firstName: 'Jane', ssnLastFour: '1234' },
        },
      };
      const result = stateSanitizer(state);
      expect(result.claim.borrower.ssnLastFour).toBe('****');
    });

    it('preserves empty SSN as empty', () => {
      const state = {
        claim: {
          borrower: { firstName: 'Jane', ssnLastFour: '' },
        },
      };
      const result = stateSanitizer(state);
      expect(result.claim.borrower.ssnLastFour).toBe('');
    });

    // Edge cases - null safety
    it('returns state unchanged when state is null', () => {
      const result = stateSanitizer(null);
      expect(result).toBeNull();
    });

    it('returns state unchanged when state has no claim property', () => {
      const state = { otherData: 'value' };
      const result = stateSanitizer(state);
      expect(result).toEqual(state);
    });

    it('returns state unchanged when claim is null', () => {
      const state = { claim: null };
      const result = stateSanitizer(state);
      expect(result).toEqual(state);
    });

    it('returns state unchanged when claim.borrower is null', () => {
      const state = { claim: { borrower: null } };
      const result = stateSanitizer(state);
      expect(result).toEqual(state);
    });
  });

  describe('actionSanitizer', () => {
    it('masks SSN in saveBorrowerInfo action', () => {
      const action = {
        type: '[Claim] Save Borrower Info',
        borrower: { firstName: 'Jane', ssnLastFour: '5678' },
      };
      const result = actionSanitizer(action);
      expect(result.borrower.ssnLastFour).toBe('****');
    });

    it('passes non-borrower actions through unchanged', () => {
      const action = {
        type: '[Claim] Save Incident Details',
        incident: { description: 'Back injury' },
      };
      const result = actionSanitizer(action);
      expect(result).toEqual(action);
    });

    // Edge cases - null safety
    it('handles action with null borrower', () => {
      const action = {
        type: '[Claim] Save Borrower Info',
        borrower: null,
      };
      const result = actionSanitizer(action);
      expect(result).toEqual(action);
    });

    it('handles null action', () => {
      const result = actionSanitizer(null as any);
      expect(result).toBeNull();
    });

    it('masks SSN in draftLoaded action', () => {
      const action = {
        type: '[Claim] Draft Loaded',
        draft: {
          borrower: { firstName: 'Jane', ssnLastFour: '1234' },
          currentStep: 2,
        },
      };
      const result = actionSanitizer(action);
      expect(result.draft.borrower.ssnLastFour).toBe('****');
      // Non-SSN fields untouched
      expect(result.draft.borrower.firstName).toBe('Jane');
      expect(result.draft.currentStep).toBe(2);
    });

    it('handles draftLoaded with no borrower gracefully', () => {
      const action = { type: '[Claim] Draft Loaded', draft: {} };
      expect(() => actionSanitizer(action)).not.toThrow();
    });
  });
});
