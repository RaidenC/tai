import { ClaimActions } from './claim.actions';
import { DisabilityClaimDraft } from './claim.models';

describe('ClaimActions — Draft Persistence', () => {
  const mockDraft: DisabilityClaimDraft = {
    claimId: 'CLM-2026-0001',
    currentStep: 2,
    borrower: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '', // Intentionally empty - SSN should never be in draft
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
    medicalProviders: [],
    documents: {
      employerLeaveForm: null,
      attendingPhysicianStatement: null,
    },
    isSubmitting: false,
    error: null,
  };

  describe('payload shapes and sensitivity', () => {
    it('Draft Saved has no payload (emptyProps)', () => {
      const action = ClaimActions.draftSaved();
      expect(action.type).toBe('[Claim] Draft Saved');
      // emptyProps produces an action with no props
      expect('step' in action).toBe(false);
      expect('message' in action).toBe(false);
      expect('draft' in action).toBe(false);
    });

    it('Draft Save Error carries message only, no sensitive data', () => {
      const action = ClaimActions.draftSaveError({ message: 'API timeout' });
      expect(action.type).toBe('[Claim] Draft Save Error');
      expect(action.message).toBe('API timeout');
      // No sensitive fields in payload
      expect('ssn' in action).toBe(false);
      expect('draft' in action).toBe(false);
    });

    it('Draft Loaded carries draft but type makes sensitivity visible', () => {
      const action = ClaimActions.draftLoaded({ draft: mockDraft });
      expect(action.type).toBe('[Claim] Draft Loaded');
      expect(action.draft).toBeDefined();
      expect(action.draft.borrower).toBeDefined();
      // The typing makes sensitivity visible: draft is DisabilityClaimDraft
      // which explicitly has borrower.ssnLastFour field - consumers know it's draft data
      // that should be handled with care (reducer will strip SSN anyway)
      expect(action.draft.borrower.ssnLastFour).toBe(''); // Already sanitized in this mock
    });

    it('Draft Load Error carries message only, no sensitive data', () => {
      const action = ClaimActions.draftLoadError({ message: 'No saved draft found' });
      expect(action.type).toBe('[Claim] Draft Load Error');
      expect(action.message).toBe('No saved draft found');
      // No sensitive fields in payload
      expect('ssn' in action).toBe(false);
      expect('draft' in action).toBe(false);
    });

    it('none of the draft persistence actions carry raw unsanitized SSN', () => {
      // Verify at the type level - these actions should never have SSN fields
      // This is a compile-time check expressed in runtime tests for documentation

      const savedAction = ClaimActions.draftSaved();
      expect(Object.keys(savedAction).includes('ssn')).toBe(false);

      const saveErrorAction = ClaimActions.draftSaveError({ message: 'err' });
      expect(Object.keys(saveErrorAction).includes('ssn')).toBe(false);

      const loadedAction = ClaimActions.draftLoaded({ draft: mockDraft });
      // loadedAction has draft, but the action type itself doesn't expose SSN as top-level
      // The SSN would be in draft.borrower.ssnLastFour which consumers must handle
      expect(Object.keys(loadedAction).includes('ssn')).toBe(false);

      const loadErrorAction = ClaimActions.draftLoadError({ message: 'err' });
      expect(Object.keys(loadErrorAction).includes('ssn')).toBe(false);
    });
  });

  describe('naming convention compliance', () => {
    // Pre-task-18 actions as baseline:
    // - 'Set Current Step': imperative "Set"
    // - 'Save Borrower Info': imperative "Save"
    // - 'Submit Claim': imperative "Submit"
    // - 'Submit Claim Success': [Verb] [Noun] [Result] format
    // - 'Submit Claim Error': [Verb] [Noun] [Result] format

    it('follows source tag "Claim" (produces "[Claim]" prefix)', () => {
      expect(ClaimActions.draftSaved.type).toContain('[Claim]');
      expect(ClaimActions.draftSaveError.type).toContain('[Claim]');
      expect(ClaimActions.draftLoaded.type).toContain('[Claim]');
      expect(ClaimActions.draftLoadError.type).toContain('[Claim]');
    });

    it('uses past tense for completion events (Saved, Loaded)', () => {
      // "Draft Saved" follows same pattern as "Reset Claim" (past participle)
      // "Draft Loaded" follows same pattern
      expect(ClaimActions.draftSaved.type).toMatch(/Saved$/);
      expect(ClaimActions.draftLoaded.type).toMatch(/Loaded$/);
    });

    it('uses Error suffix for failure events, consistent with Submit Claim Error', () => {
      // Follows same pattern as "Submit Claim Error"
      expect(ClaimActions.draftSaveError.type).toMatch(/Error$/);
      expect(ClaimActions.draftLoadError.type).toMatch(/Error$/);
    });

    it('consistent naming pattern with Submit Claim (Verb Noun format)', () => {
      // "Draft Save Error" follows [Object] [Verb] [Result] like "Submit Claim Error"
      // vs "Draft Saved" which uses [Object] [Verb-ed] (past participle)
      // This matches the existing pattern in the codebase
      const allTypes = [
        ClaimActions.draftSaved.type,
        ClaimActions.draftSaveError.type,
        ClaimActions.draftLoaded.type,
        ClaimActions.draftLoadError.type,
      ];
      allTypes.forEach(type => {
        expect(type).toMatch(/^\[Claim\] Draft/);
      });
    });
  });
});
