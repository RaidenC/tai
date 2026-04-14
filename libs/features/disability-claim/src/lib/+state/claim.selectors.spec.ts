/**
 * CLAIM SELECTORS TESTS — Memoized Derived State
 *
 * Selector tests verify that derived state is computed correctly.
 * We use .projector() to test the projector function directly,
 * without needing a full store. This is the recommended NgRx
 * testing approach — fast, isolated, and focused on logic.
 */

import { describe, it, expect } from 'vitest';
import {
  selectBorrowerValid,
  selectIncidentValid,
  selectProvidersValid,
  selectDocumentsValid,
  selectCanSubmit,
  selectIsWorkRelated,
  selectCanAddProvider,
  selectStepValidity,
} from './claim.selectors';
import { BorrowerInfo, IncidentDetails, MedicalProvider, ClaimDocuments, MAX_PROVIDERS } from './claim.models';

// ── Helpers ──────────────────────────────────────

const validBorrower: BorrowerInfo = {
  firstName: 'John',
  lastName: 'Doe',
  ssnLastFour: '1234',
  phone: '555-0100',
  email: 'john@example.com',
};

const validIncident: IncidentDetails = {
  dateOfDisability: '2026-03-15',
  disabilityType: 'Injury',
  isWorkRelated: false,
  workersCompClaimNumber: null,
  description: 'Back injury sustained during exercise',
};

const validProvider: MedicalProvider = {
  id: 'p1',
  doctorName: 'Dr. Smith',
  clinicName: 'City Clinic',
  phone: '555-0200',
  dateFirstTreated: '2026-03-16',
};

const validDocs: ClaimDocuments = {
  employerLeaveForm: { fileName: 'leave.pdf', size: 142000, uploadedAt: '2026-03-20T10:00:00Z' },
  attendingPhysicianStatement: null,
};

// ── Step 1: Borrower Validity ────────────────────

describe('selectBorrowerValid', () => {
  it('should return true when all fields are filled', () => {
    expect(selectBorrowerValid.projector(validBorrower)).toBe(true);
  });

  it('should return false when email is missing', () => {
    expect(selectBorrowerValid.projector({ ...validBorrower, email: '' })).toBe(false);
  });

  it('should return false when SSN is not 4 digits', () => {
    expect(selectBorrowerValid.projector({ ...validBorrower, ssnLastFour: '12' })).toBe(false);
  });

  it('should return false when name has only whitespace', () => {
    expect(selectBorrowerValid.projector({ ...validBorrower, firstName: '   ' })).toBe(false);
  });
});

// ── Step 2: Incident Validity ────────────────────

describe('selectIncidentValid', () => {
  it('should return true when all required fields are filled (non-work-related)', () => {
    expect(selectIncidentValid.projector(validIncident)).toBe(true);
  });

  it('should return false when disabilityType is null', () => {
    expect(selectIncidentValid.projector({ ...validIncident, disabilityType: null })).toBe(false);
  });

  it('should return false when work-related but no claim number', () => {
    const workRelated: IncidentDetails = {
      ...validIncident,
      isWorkRelated: true,
      workersCompClaimNumber: null,
    };
    expect(selectIncidentValid.projector(workRelated)).toBe(false);
  });

  it('should return true when work-related with claim number', () => {
    const workRelated: IncidentDetails = {
      ...validIncident,
      isWorkRelated: true,
      workersCompClaimNumber: 'WC-001',
    };
    expect(selectIncidentValid.projector(workRelated)).toBe(true);
  });
});

// ── selectIsWorkRelated ──────────────────────────

describe('selectIsWorkRelated', () => {
  it('should return true when isWorkRelated is true', () => {
    expect(selectIsWorkRelated.projector({ ...validIncident, isWorkRelated: true })).toBe(true);
  });

  it('should return false when isWorkRelated is false', () => {
    expect(selectIsWorkRelated.projector(validIncident)).toBe(false);
  });
});

// ── Step 3: Providers Validity ───────────────────

describe('selectProvidersValid', () => {
  it('should return true when at least one complete provider exists', () => {
    expect(selectProvidersValid.projector([validProvider])).toBe(true);
  });

  it('should return false when providers array is empty', () => {
    expect(selectProvidersValid.projector([])).toBe(false);
  });

  it('should return false when a provider has empty doctorName', () => {
    const incomplete = { ...validProvider, doctorName: '' };
    expect(selectProvidersValid.projector([incomplete])).toBe(false);
  });

  it('should return false when one of multiple providers is incomplete', () => {
    const complete = validProvider;
    const incomplete = { ...validProvider, id: 'p2', clinicName: '' };
    expect(selectProvidersValid.projector([complete, incomplete])).toBe(false);
  });
});

// ── Step 4: Documents Validity ───────────────────

describe('selectDocumentsValid', () => {
  it('should return true when at least one document is uploaded', () => {
    expect(selectDocumentsValid.projector(validDocs)).toBe(true);
  });

  it('should return false when no documents uploaded', () => {
    expect(selectDocumentsValid.projector({
      employerLeaveForm: null,
      attendingPhysicianStatement: null,
    })).toBe(false);
  });
});

// ── Composed: selectCanSubmit ────────────────────

describe('selectCanSubmit', () => {
  it('should return true when all 4 steps are valid', () => {
    expect(selectCanSubmit.projector(true, true, true, true)).toBe(true);
  });

  it('should return false when step 2 is invalid', () => {
    expect(selectCanSubmit.projector(true, false, true, true)).toBe(false);
  });

  it('should return false when step 3 is invalid', () => {
    expect(selectCanSubmit.projector(true, true, false, true)).toBe(false);
  });

  it('should return false when all steps are invalid', () => {
    expect(selectCanSubmit.projector(false, false, false, false)).toBe(false);
  });
});

// ── selectCanAddProvider ─────────────────────────

describe('selectCanAddProvider', () => {
  it('should return true when below max', () => {
    expect(selectCanAddProvider.projector([validProvider])).toBe(true);
  });

  it('should return false when at max', () => {
    const full = Array.from({ length: MAX_PROVIDERS }, (_, i) => ({
      ...validProvider,
      id: `p${i}`,
    }));
    expect(selectCanAddProvider.projector(full)).toBe(false);
  });
});

// ── selectStepValidity ───────────────────────────

describe('selectStepValidity', () => {
  it('should return validity for all 4 steps', () => {
    const result = selectStepValidity.projector(true, false, true, false);
    expect(result).toEqual({
      step1: true,
      step2: false,
      step3: true,
      step4: false,
    });
  });
});
