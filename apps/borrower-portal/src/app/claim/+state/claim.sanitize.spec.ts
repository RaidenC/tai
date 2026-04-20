import { sanitizeForPersistence } from './claim.sanitize';
import { DisabilityClaimDraft, initialClaimState } from './claim.models';
import * as fc from 'fast-check';

describe('sanitizeForPersistence', () => {
  const populatedState: DisabilityClaimDraft = {
    ...initialClaimState,
    claimId: 'CLM-2026-0001',
    currentStep: 2,
    borrower: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '1234',
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
    medicalProviders: [
      {
        id: 'uuid-1',
        doctorName: 'Dr. Smith',
        clinicName: 'Main St Clinic',
        phone: '5559876543',
        dateFirstTreated: '2026-01-20',
      },
    ],
    documents: {
      employerLeaveForm: { fileName: 'leave.pdf', size: 1024, uploadedAt: '2026-01-25T10:00:00Z' },
      attendingPhysicianStatement: null,
    },
  };

  it('strips ssnLastFour from populated state', () => {
    const result = sanitizeForPersistence(populatedState);
    expect(result.borrower.ssnLastFour).toBe('');
  });

  it('preserves all non-PII fields', () => {
    const result = sanitizeForPersistence(populatedState);
    expect(result.borrower.firstName).toBe('Jane');
    expect(result.borrower.lastName).toBe('Doe');
    expect(result.borrower.phone).toBe('5551234567');
    expect(result.borrower.email).toBe('jane@example.com');
    expect(result.incident).toEqual(populatedState.incident);
    expect(result.medicalProviders).toEqual(populatedState.medicalProviders);
    expect(result.documents).toEqual(populatedState.documents);
    expect(result.currentStep).toBe(2);
    expect(result.claimId).toBe('CLM-2026-0001');
  });

  it('returns new object reference (immutability)', () => {
    const result = sanitizeForPersistence(populatedState);
    expect(result).not.toBe(populatedState);
    expect(result.borrower).not.toBe(populatedState.borrower);
  });

  it('handles already-empty SSN (idempotent)', () => {
    const emptySSN = {
      ...populatedState,
      borrower: { ...populatedState.borrower, ssnLastFour: '' },
    };
    const result = sanitizeForPersistence(emptySSN);
    expect(result.borrower.ssnLastFour).toBe('');
  });

  it('does not strip other borrower fields', () => {
    const result = sanitizeForPersistence(populatedState);
    expect(result.borrower.firstName).toBe('Jane');
    expect(result.borrower.email).toBe('jane@example.com');
    expect(result.borrower.phone).toBe('5551234567');
    expect(result.borrower.lastName).toBe('Doe');
  });

  // Property-based tests (fast-check)

  const borrowerArb = fc.record({
    firstName: fc.string({ minLength: 0, maxLength: 50 }),
    lastName: fc.string({ minLength: 0, maxLength: 50 }),
    ssnLastFour: fc.string({ minLength: 0, maxLength: 10 }),
    phone: fc.string({ minLength: 0, maxLength: 15 }),
    email: fc.string({ minLength: 0, maxLength: 100 }),
  });

  const draftArb = fc.record({
    claimId: fc.option(fc.string(), { nil: null }),
    currentStep: fc.integer({ min: 1, max: 4 }),
    borrower: borrowerArb,
    incident: fc.constant(initialClaimState.incident),
    medicalProviders: fc.constant(initialClaimState.medicalProviders),
    documents: fc.constant(initialClaimState.documents),
    isSubmitting: fc.boolean(),
    error: fc.option(fc.string(), { nil: null }),
  });

  it('PROPERTY: SSN is always stripped regardless of input', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const result = sanitizeForPersistence(draft);
        return result.borrower.ssnLastFour === '';
      }),
    );
  });

  it('PROPERTY: all non-SSN fields are always preserved', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const result = sanitizeForPersistence(draft);
        return (
          result.borrower.firstName === draft.borrower.firstName &&
          result.borrower.lastName === draft.borrower.lastName &&
          result.borrower.phone === draft.borrower.phone &&
          result.borrower.email === draft.borrower.email &&
          result.currentStep === draft.currentStep &&
          result.incident === draft.incident &&
          result.medicalProviders === draft.medicalProviders &&
          result.documents === draft.documents
        );
      }),
    );
  });
});
