import { selectBorrowerValid } from './claim.selectors';

describe('selectBorrowerValid — SSN edge cases', () => {
  it('returns false when SSN is empty after hydration', () => {
    const borrower = {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    };
    expect(selectBorrowerValid.projector(borrower)).toBe(false);
  });

  it('returns true after SSN re-entered', () => {
    const borrower = {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '1234',
      phone: '5551234567',
      email: 'jane@example.com',
    };
    expect(selectBorrowerValid.projector(borrower)).toBe(true);
  });
});
