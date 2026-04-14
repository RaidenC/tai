/**
 * CLAIM REDUCER TESTS — Pure State Transitions
 *
 * Each test dispatches one action and verifies the resulting state.
 * Reducer tests are fast (no async, no DI) and the most valuable
 * tests in an NgRx app — they verify your business logic.
 */

import { describe, it, expect } from 'vitest';
import { ClaimActions } from './claim.actions';
import { claimFeature } from './claim.reducer';
import {
  initialClaimState,
  DisabilityClaimDraft,
  BorrowerInfo,
  IncidentDetails,
  MedicalProvider,
  MAX_PROVIDERS,
} from './claim.models';

const { reducer } = claimFeature;

// Helper: create a provider with required fields
function makeProvider(overrides: Partial<MedicalProvider> = {}): MedicalProvider {
  return {
    id: 'test-id-1',
    doctorName: 'Dr. Smith',
    clinicName: 'City Clinic',
    phone: '555-0100',
    dateFirstTreated: '2026-03-15',
    ...overrides,
  };
}

describe('Claim Reducer', () => {
  // ── Step Navigation ──────────────────────────────

  it('should set current step and clear error', () => {
    const stateWithError: DisabilityClaimDraft = {
      ...initialClaimState,
      error: 'Previous error',
    };
    const result = reducer(stateWithError, ClaimActions.setCurrentStep({ step: 3 }));

    expect(result.currentStep).toBe(3);
    expect(result.error).toBeNull();
  });

  // ── Step 1: Borrower Info ────────────────────────

  it('should save borrower info', () => {
    const borrower: BorrowerInfo = {
      firstName: 'John',
      lastName: 'Doe',
      ssnLastFour: '1234',
      phone: '555-0100',
      email: 'john@example.com',
    };
    const result = reducer(initialClaimState, ClaimActions.saveBorrowerInfo({ borrower }));

    expect(result.borrower).toEqual(borrower);
  });

  // ── Step 2: Incident Details ─────────────────────

  it('should save incident details', () => {
    const incident: IncidentDetails = {
      dateOfDisability: '2026-03-15',
      disabilityType: 'Injury',
      isWorkRelated: true,
      workersCompClaimNumber: 'WC-001',
      description: 'Back injury at work',
    };
    const result = reducer(initialClaimState, ClaimActions.saveIncidentDetails({ incident }));

    expect(result.incident).toEqual(incident);
  });

  it('should set isWorkRelated to true and preserve claim number', () => {
    const stateWithClaimNum: DisabilityClaimDraft = {
      ...initialClaimState,
      incident: {
        ...initialClaimState.incident,
        workersCompClaimNumber: 'WC-001',
      },
    };
    const result = reducer(stateWithClaimNum, ClaimActions.setWorkRelated({ isWorkRelated: true }));

    expect(result.incident.isWorkRelated).toBe(true);
    expect(result.incident.workersCompClaimNumber).toBe('WC-001');
  });

  it('should set isWorkRelated to false and null out claim number', () => {
    const stateWithWorkRelated: DisabilityClaimDraft = {
      ...initialClaimState,
      incident: {
        ...initialClaimState.incident,
        isWorkRelated: true,
        workersCompClaimNumber: 'WC-001',
      },
    };
    const result = reducer(stateWithWorkRelated, ClaimActions.setWorkRelated({ isWorkRelated: false }));

    expect(result.incident.isWorkRelated).toBe(false);
    expect(result.incident.workersCompClaimNumber).toBeNull();
  });

  // ── Step 3: Medical Providers ────────────────────

  it('should add a provider to the array', () => {
    const provider = makeProvider();
    const result = reducer(initialClaimState, ClaimActions.addProvider({ provider }));

    expect(result.medicalProviders).toHaveLength(1);
    expect(result.medicalProviders[0]).toEqual(provider);
  });

  it('should not add provider beyond MAX_PROVIDERS', () => {
    // Fill up to max
    const fullState: DisabilityClaimDraft = {
      ...initialClaimState,
      medicalProviders: Array.from({ length: MAX_PROVIDERS }, (_, i) =>
        makeProvider({ id: `id-${i}` })
      ),
    };
    const result = reducer(fullState, ClaimActions.addProvider({ provider: makeProvider({ id: 'overflow' }) }));

    expect(result.medicalProviders).toHaveLength(MAX_PROVIDERS);
    expect(result.medicalProviders.find(p => p.id === 'overflow')).toBeUndefined();
  });

  it('should remove a provider by id', () => {
    const stateWithProviders: DisabilityClaimDraft = {
      ...initialClaimState,
      medicalProviders: [
        makeProvider({ id: 'keep' }),
        makeProvider({ id: 'remove' }),
      ],
    };
    const result = reducer(stateWithProviders, ClaimActions.removeProvider({ id: 'remove' }));

    expect(result.medicalProviders).toHaveLength(1);
    expect(result.medicalProviders[0].id).toBe('keep');
  });

  it('should update a provider by id', () => {
    const original = makeProvider({ id: 'update-me', doctorName: 'Old Name' });
    const stateWithProvider: DisabilityClaimDraft = {
      ...initialClaimState,
      medicalProviders: [original],
    };
    const updated = { ...original, doctorName: 'New Name' };
    const result = reducer(stateWithProvider, ClaimActions.updateProvider({ provider: updated }));

    expect(result.medicalProviders[0].doctorName).toBe('New Name');
  });

  // ── Submit Flow ──────────────────────────────────

  it('should set isSubmitting true and clear error on submitClaim', () => {
    const stateWithError: DisabilityClaimDraft = {
      ...initialClaimState,
      error: 'Previous error',
    };
    const result = reducer(stateWithError, ClaimActions.submitClaim());

    expect(result.isSubmitting).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should set claimId and clear isSubmitting on success', () => {
    const submittingState: DisabilityClaimDraft = {
      ...initialClaimState,
      isSubmitting: true,
    };
    const result = reducer(submittingState, ClaimActions.submitClaimSuccess({ claimId: 'CLM-2026-0042' }));

    expect(result.claimId).toBe('CLM-2026-0042');
    expect(result.isSubmitting).toBe(false);
  });

  it('should set error and clear isSubmitting on failure', () => {
    const submittingState: DisabilityClaimDraft = {
      ...initialClaimState,
      isSubmitting: true,
    };
    const result = reducer(submittingState, ClaimActions.submitClaimError({ message: 'Network error' }));

    expect(result.error).toBe('Network error');
    expect(result.isSubmitting).toBe(false);
  });

  // ── Reset ────────────────────────────────────────

  it('should reset to initial state', () => {
    const dirtyState: DisabilityClaimDraft = {
      ...initialClaimState,
      currentStep: 4,
      borrower: { ...initialClaimState.borrower, firstName: 'John' },
      isSubmitting: true,
      error: 'something',
    };
    const result = reducer(dirtyState, ClaimActions.resetClaim());

    expect(result).toEqual(initialClaimState);
  });
});
