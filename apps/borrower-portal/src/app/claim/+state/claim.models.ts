/**
 * CLAIM STATE MODELS — Domain Types for the Disability Claim Wizard
 *
 * NgRx Concept: State Shape Design
 * The shape of your NgRx state IS your application's data architecture.
 * Every property here becomes a slice that reducers can update independently
 * and selectors can read independently. Getting this shape right means:
 *
 * 1. Each wizard step maps to a clear sub-object (borrower, incident, etc.)
 * 2. UI state (currentStep, isSubmitting, error) lives alongside domain data
 *    but is clearly separated — so selectors can compose domain validity
 *    without being polluted by UI concerns.
 * 3. Arrays use explicit `id` fields for tracking — even though we're using
 *    a plain array (not @ngrx/entity), the ID lets us target specific items
 *    in update/remove actions without index-based bugs.
 *
 * Why not just use component state or a BehaviorSubject service?
 * Because this state must survive route navigation (the user jumps between
 * 4 different Angular routes), survive page refresh (via localStorage
 * meta-reducer), and be composable across steps (selectCanSubmit needs
 * data from ALL 4 steps). NgRx gives us all three for free.
 */

// ──────────────────────────────────────────────
// Step 1: Borrower Verification
// ──────────────────────────────────────────────

export interface BorrowerInfo {
  firstName: string;
  lastName: string;
  /** Last 4 digits only — we NEVER store full SSN in the frontend */
  ssnLastFour: string;
  phone: string;
  email: string;
}

// ──────────────────────────────────────────────
// Step 2: Incident Details
// ──────────────────────────────────────────────

export type DisabilityType = 'Illness' | 'Injury' | 'Pregnancy';

export interface IncidentDetails {
  /** ISO date string (YYYY-MM-DD) */
  dateOfDisability: string;
  disabilityType: DisabilityType | null;
  isWorkRelated: boolean;
  /** Only populated when isWorkRelated === true; cleared to null on toggle-off */
  workersCompClaimNumber: string | null;
  description: string;
}

// ──────────────────────────────────────────────
// Step 3: Medical Providers (dynamic array, max 5)
// ──────────────────────────────────────────────

export interface MedicalProvider {
  /** UUID for tracking — used in add/remove/update actions */
  id: string;
  doctorName: string;
  clinicName: string;
  phone: string;
  /** ISO date string */
  dateFirstTreated: string;
}

/** Maximum number of medical providers allowed */
export const MAX_PROVIDERS = 5;

// ──────────────────────────────────────────────
// Step 4: Documents (metadata only — blobs go to IndexedDB)
// ──────────────────────────────────────────────

export interface DocumentMeta {
  fileName: string;
  size: number;
  /** ISO datetime string */
  uploadedAt: string;
}

export interface ClaimDocuments {
  employerLeaveForm: DocumentMeta | null;
  attendingPhysicianStatement: DocumentMeta | null;
}

// ──────────────────────────────────────────────
// Root State Shape
// ──────────────────────────────────────────────

/**
 * The complete state for a disability claim draft.
 * This is the single source of truth for the entire 4-step wizard.
 *
 * Key design decisions:
 * - `currentStep` is a number (1-4), not a route string — the guard
 *   maps step numbers to routes, keeping state decoupled from routing.
 * - `documents` stores METADATA only (filename, size, timestamp).
 *   Actual file blobs live in IndexedDB via DocumentStorageService.
 *   This keeps the NgRx state small enough for localStorage (~1KB).
 * - `medicalProviders` is a plain array, not @ngrx/entity EntityState.
 *   With a max of 5 items, the normalized ids[]/entities{} pattern
 *   would add complexity without performance benefit.
 */
export interface DisabilityClaimDraft {
  claimId: string | null;
  /** Current wizard step: 1 = Borrower Info, 2 = Incident, 3 = Providers, 4 = Review */
  currentStep: number;

  borrower: BorrowerInfo;
  incident: IncidentDetails;
  medicalProviders: MedicalProvider[];
  documents: ClaimDocuments;

  /** True while the submit API call is in flight */
  isSubmitting: boolean;
  /** User-friendly error message from the last failed operation */
  error: string | null;
}

/**
 * Initial state — every field starts empty/default.
 * The localStorage meta-reducer will overwrite this with saved data
 * on app startup if a previous draft exists.
 */
export const initialClaimState: DisabilityClaimDraft = {
  claimId: null,
  currentStep: 1,

  borrower: {
    firstName: '',
    lastName: '',
    ssnLastFour: '',
    phone: '',
    email: '',
  },

  incident: {
    dateOfDisability: '',
    disabilityType: null,
    isWorkRelated: false,
    workersCompClaimNumber: null,
    description: '',
  },

  medicalProviders: [],

  documents: {
    employerLeaveForm: null,
    attendingPhysicianStatement: null,
  },

  isSubmitting: false,
  error: null,
};
