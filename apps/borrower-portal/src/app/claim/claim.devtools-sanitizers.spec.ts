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
  });
});
