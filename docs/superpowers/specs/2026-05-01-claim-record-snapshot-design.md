# Design: Claim Record + Snapshot Boundary

## Problem

The DocuSign/QuestPDF workflow needs the backend to generate a legally meaningful claim packet from authoritative claim data. The current borrower portal draft model cannot satisfy that requirement.

Today, the frontend owns the claim wizard state and persists it to `borrower-portal-api` as an opaque encrypted payload:

```text
ClaimDraft(UserId, ClaimId, EncryptedPayload, ExpiresAt)
```

The server intentionally treats `EncryptedPayload` as unreadable business data. That is appropriate for temporary draft persistence, but it means the backend cannot:

- validate claim completeness
- render a deterministic PDF
- compute a meaningful claim snapshot hash
- prove which claim fields were signed
- lock claim data once signing begins
- safely compare a signing envelope against current claim contents

The current frontend also uses a POC claim identity of `current`, while the visible submitted claim ID is generated only by the mocked `submitClaimSuccess` effect. A signing flow needs a stable server-side claim ID before envelope creation.

## Decision

Add a server-owned **Claim Intake Record** and immutable **Claim Snapshot** boundary before DocuSign signing.

Draft persistence remains encrypted and temporary. It is not the legal source for signing.

Borrower Portal will promote a completed wizard draft into a server-owned claim intake record through a new submit/finalize endpoint. The backend validates the submitted claim command, stores structured claim data, assigns a stable `ClaimId`, computes a canonical snapshot hash, and marks the record ready for signing.

QuestPDF and DocuSign will depend on this snapshot boundary, not on encrypted draft bytes.

## Goals

- Create a stable server-side `ClaimId` before signing.
- Store structured claim data that the backend can validate and render.
- Preserve encrypted draft persistence for in-progress autosave.
- Define when draft data becomes immutable for signing.
- Define a canonical snapshot hash over normalized claim data.
- Support generated document versions without losing prior claim history.
- Provide a clean source for future signing-session creation.
- Avoid storing full SSN or document file bytes in the claim record.

## Non-Goals

- Implementing DocuSign envelope creation.
- Implementing final claim adjudication.
- Implementing long-term document retention.
- Implementing actual uploaded supporting-document binary storage.
- Replacing encrypted draft autosave.
- Adding multi-claim dashboard UX.
- Adding business workflows after claim submission.

## Existing Context

### Frontend Claim Model

Current frontend state lives in:

```text
apps/borrower-portal/src/app/claim/+state/claim.models.ts
```

Important fields:

```typescript
export interface DisabilityClaimDraft {
  claimId: string | null;
  currentStep: number;
  borrower: BorrowerInfo;
  incident: IncidentDetails;
  medicalProviders: MedicalProvider[];
  documents: ClaimDocuments;
  isSubmitting: boolean;
  error: string | null;
}
```

The frontend stores:

- borrower name, email, phone, SSN last four only
- disability incident details
- up to five medical providers
- supporting document metadata only

Actual document blobs are not in NgRx state.

### Current Draft Persistence

Current domain entity:

```text
libs/payment-protection/domain/Entities/ClaimDraft.cs
```

Current persistence:

```text
libs/payment-protection/infrastructure/Persistence/EfClaimDraftStore.cs
```

The draft is keyed by `(UserId, ClaimId)` and stores opaque encrypted bytes. The server cannot use it as signing source material.

### Current Submit Flow

Current submit is mocked in:

```text
apps/borrower-portal/src/app/claim/+state/claim.effects.ts
```

It generates a frontend-side reference like:

```typescript
CLM-2026-0001
```

That must be replaced by a backend-created claim intake record.

## Architecture

### New Concepts

#### Claim Intake Record

A server-owned structured record for a borrower disability claim after the borrower completes the wizard and chooses to continue toward signing.

Purpose:

- stable claim identity
- structured validated claim content
- ownership by authenticated borrower
- source material for claim packet rendering
- lifecycle anchor for signing and later submission

#### Claim Snapshot

An immutable representation of the claim content at a point in time.

Purpose:

- deterministic PDF input
- stable hash for audit
- comparison point for generated document versions
- basis for deciding whether an existing signing envelope is still safe to reuse

For the first POC, one claim intake record may have one active snapshot version. The model should still allow later versions when a claim is reset or corrected before signing.

## Data Model

### ClaimIntake

Purpose: root record for a borrower’s structured disability claim.

Fields:

```text
Id
UserId
Status
CurrentSnapshotVersion
CreatedAt
CreatedBy
LastModifiedAt
LastModifiedBy
LockedAt
LockedReason
```

Status values for this spec:

```text
DraftPromoted
ReadyForSigning
SigningStarted
Signed
Submitted
Voided
Failed
```

Notes:

- `Id` is the stable `ClaimId` used by future APIs.
- `UserId` comes from `ICurrentUserService`, never from request body.
- `LockedAt` is set when signing starts.
- Later lifecycle specs may refine status names, but this spec establishes the claim record boundary.

### ClaimSnapshot

Purpose: immutable claim content version.

Fields:

```text
Id
ClaimIntakeId
Version
SnapshotHash
TemplateCompatibilityVersion
BorrowerJson
IncidentJson
MedicalProvidersJson
SupportingDocumentsJson
CreatedAt
CreatedBy
```

Constraints:

```text
unique(ClaimIntakeId, Version)
unique(ClaimIntakeId) where Version = current active version is enforced through ClaimIntake.CurrentSnapshotVersion
index(ClaimIntakeId, Version)
index(SnapshotHash)
```

JSON sections are acceptable for the POC because:

- the claim packet shape is still evolving
- the first queries are ownership/status lookups, not field-level analytics
- canonical snapshot hashing needs section-level normalized content

If field-level reporting becomes a requirement, this can be normalized later.

### Snapshot Content

Snapshot content mirrors the frontend wizard structure after server validation:

```json
{
  "borrower": {
    "firstName": "Jane",
    "lastName": "Borrower",
    "ssnLastFour": "1234",
    "phone": "555-0100",
    "email": "jane@example.com"
  },
  "incident": {
    "dateOfDisability": "2026-04-15",
    "disabilityType": "Injury",
    "isWorkRelated": false,
    "workersCompClaimNumber": null,
    "description": "Short borrower-entered description"
  },
  "medicalProviders": [
    {
      "id": "provider-client-id",
      "doctorName": "Dr. Smith",
      "clinicName": "Smith Clinic",
      "phone": "555-0110",
      "dateFirstTreated": "2026-04-16"
    }
  ],
  "supportingDocuments": {
    "employerLeaveForm": {
      "fileName": "leave.pdf",
      "size": 12345,
      "uploadedAt": "2026-04-30T18:00:00Z"
    },
    "attendingPhysicianStatement": null
  }
}
```

## API Design

### Promote Draft To Claim Intake

```http
POST /api/claims
Authorization: Bearer <access-token>
```

Request:

```json
{
  "borrower": {
    "firstName": "Jane",
    "lastName": "Borrower",
    "ssnLastFour": "1234",
    "phone": "555-0100",
    "email": "jane@example.com"
  },
  "incident": {
    "dateOfDisability": "2026-04-15",
    "disabilityType": "Injury",
    "isWorkRelated": false,
    "workersCompClaimNumber": null,
    "description": "Short borrower-entered description"
  },
  "medicalProviders": [
    {
      "id": "provider-client-id",
      "doctorName": "Dr. Smith",
      "clinicName": "Smith Clinic",
      "phone": "555-0110",
      "dateFirstTreated": "2026-04-16"
    }
  ],
  "supportingDocuments": {
    "employerLeaveForm": {
      "fileName": "leave.pdf",
      "size": 12345,
      "uploadedAt": "2026-04-30T18:00:00Z"
    },
    "attendingPhysicianStatement": null
  }
}
```

Response:

```json
{
  "claimId": "CLM-2026-000001",
  "status": "ReadyForSigning",
  "snapshotVersion": 1,
  "snapshotHash": "sha256-base64url-or-hex",
  "createdAt": "2026-05-01T17:00:00Z"
}
```

Rules:

- User ID comes from `ICurrentUserService`.
- Request body never accepts `userId`.
- Backend validates all required fields.
- Backend normalizes values before hashing.
- Backend creates `ClaimIntake` and `ClaimSnapshot` in one transaction.
- Initial status is `ReadyForSigning` after validation succeeds.
- Frontend stores returned `claimId` in NgRx.
- Existing encrypted draft may remain until later cleanup or reset.

### Get Claim Intake

```http
GET /api/claims/{claimId}
Authorization: Bearer <access-token>
```

Response:

```json
{
  "claimId": "CLM-2026-000001",
  "status": "ReadyForSigning",
  "snapshotVersion": 1,
  "snapshotHash": "sha256-base64url-or-hex",
  "borrower": {
    "firstName": "Jane",
    "lastName": "Borrower",
    "ssnLastFour": "1234",
    "phone": "555-0100",
    "email": "jane@example.com"
  },
  "incident": {
    "dateOfDisability": "2026-04-15",
    "disabilityType": "Injury",
    "isWorkRelated": false,
    "workersCompClaimNumber": null,
    "description": "Short borrower-entered description"
  },
  "medicalProviders": [],
  "supportingDocuments": {
    "employerLeaveForm": null,
    "attendingPhysicianStatement": null
  }
}
```

Rules:

- Current user must own the claim.
- Returns `404` for missing claims or claims owned by another user.
- Does not expose internal database IDs other than public `claimId`.

### Snapshot Replacement Capability

The first implementation should not expose a public `PUT /api/claims/{claimId}/snapshot` endpoint. Borrowers can correct wizard data before they promote the draft into a claim intake record.

The domain and persistence model should still support a new snapshot version because later correction flows may need it. That internal capability follows these rules:

- current user must own the claim
- replacement is allowed only while status is `ReadyForSigning`
- replacement creates a new `ClaimSnapshot` version
- replacement increments `CurrentSnapshotVersion`
- replacement recomputes `SnapshotHash`
- replacement does not mutate older snapshots
- replacement after signing has started returns a conflict from the application layer

## Validation Rules

Server validation must be at least as strict as frontend `selectCanSubmit`.

### Borrower

- `firstName` required, trimmed, max length 100
- `lastName` required, trimmed, max length 100
- `ssnLastFour` required, exactly four digits
- `phone` required, max length 30
- `email` required, valid email shape, max length 254

### Incident

- `dateOfDisability` required
- `dateOfDisability` must not be in the future
- `disabilityType` required and one of `Illness`, `Injury`, `Pregnancy`
- `description` required, trimmed, max length 4000
- if `isWorkRelated` is true, `workersCompClaimNumber` required
- if `isWorkRelated` is false, `workersCompClaimNumber` normalized to null

### Medical Providers

- at least one provider required
- maximum five providers
- `doctorName` required, max length 150
- `clinicName` required, max length 150
- `phone` required, max length 30
- `dateFirstTreated` required
- `dateFirstTreated` must not be before `dateOfDisability` unless product later explicitly allows historical treatment context

### Supporting Documents

- at least one supporting document metadata entry required for POC parity with frontend
- file name required when metadata exists
- file size must be greater than zero
- uploaded timestamp required when metadata exists
- metadata is not proof of stored file bytes

## Snapshot Hashing

### Canonicalization

Before hashing:

- trim leading/trailing whitespace on strings
- normalize empty optional strings to null
- normalize dates to ISO `YYYY-MM-DD`
- normalize datetimes to UTC ISO-8601
- sort medical providers by stable client `id`
- serialize JSON with stable property ordering
- exclude transient fields such as UI step, `isSubmitting`, and frontend error

### Hash Algorithm

Use SHA-256 over UTF-8 canonical JSON.

Store:

```text
SnapshotHash
CanonicalizationVersion
```

Recommended initial canonicalization version:

```text
payment-protection-claim-snapshot-v1
```

The hash must change when any signed claim content changes. The hash must not change when UI-only fields change.

## Immutability Rules

### Before Signing Starts

Allowed:

- create initial claim intake
- replace snapshot with corrected content
- delete or abandon encrypted draft

Not allowed:

- mutate an existing snapshot row in place

### After Signing Starts

Allowed:

- read current snapshot for PDF rendering and status display
- transition claim lifecycle status through signing states in later specs

Not allowed:

- replace current snapshot without voiding/resetting signing work
- edit signed content in place
- reuse an existing envelope if current snapshot hash no longer matches envelope snapshot hash

If borrower edits the wizard after signing starts, the future signing spec must choose one explicit behavior:

```text
block edits
or void active signing and create a new snapshot version
```

Preferred POC behavior: block edits after signing starts.

## Frontend Impact

The current mocked submit flow should become:

```text
ClaimActions.submitClaim
  -> POST /api/claims with sanitized complete wizard state
  -> ClaimActions.submitClaimSuccess({ claimId })
  -> signing session can begin using claimId
```

Frontend state changes:

- `claimId` becomes backend-assigned stable ID.
- `isSubmitting` can continue to mean “promoting draft to claim intake” until the lifecycle spec introduces more precise names.
- encrypted draft autosave remains unchanged.
- `POC_CLAIM_ID = 'current'` remains draft-only and must not be used as signing claim ID.

The frontend must not compute `SnapshotHash`. It may display the backend-returned value in debug/admin contexts, but the server owns it.

## Application Interfaces

Add application-layer use cases:

```csharp
public sealed record CreateClaimIntakeCommand(
  string UserId,
  ClaimIntakeInput Input
) : IRequest<CreateClaimIntakeResult>;

public sealed record GetClaimIntakeQuery(
  string UserId,
  string ClaimId
) : IRequest<ClaimIntakeDto?>;

public sealed record ReplaceClaimSnapshotCommand(
  string UserId,
  string ClaimId,
  ClaimIntakeInput Input
) : IRequest<ReplaceClaimSnapshotResult>;
```

Add interfaces:

```csharp
public interface IClaimIntakeStore {
  Task<ClaimIntake?> GetByIdAsync(
    string userId,
    string claimId,
    CancellationToken cancellationToken);

  Task AddAsync(
    ClaimIntake claim,
    ClaimSnapshot snapshot,
    CancellationToken cancellationToken);

  Task ReplaceSnapshotAsync(
    ClaimIntake claim,
    ClaimSnapshot snapshot,
    CancellationToken cancellationToken);
}

public interface IClaimSnapshotHasher {
  ClaimSnapshotHash Compute(ClaimIntakeInput input);
}
```

## Persistence Strategy

Add tables:

```text
claim_intakes
claim_snapshots
```

Recommended columns:

```text
claim_intakes
  id text primary key
  user_id text not null
  status text not null
  current_snapshot_version integer not null
  created_at timestamptz not null
  created_by text null
  last_modified_at timestamptz null
  last_modified_by text null
  locked_at timestamptz null
  locked_reason text null

claim_snapshots
  id uuid primary key
  claim_intake_id text not null references claim_intakes(id)
  version integer not null
  snapshot_hash text not null
  canonicalization_version text not null
  template_compatibility_version text not null
  borrower_json jsonb not null
  incident_json jsonb not null
  medical_providers_json jsonb not null
  supporting_documents_json jsonb not null
  created_at timestamptz not null
  created_by text null
```

Indexes:

```text
index claim_intakes(user_id, id)
index claim_intakes(user_id, status)
unique claim_snapshots(claim_intake_id, version)
index claim_snapshots(snapshot_hash)
```

## Claim ID Generation

Claim IDs should be generated server-side.

For the POC, use a sortable human-readable ID:

```text
CLM-{yyyy}-{sequence}
```

Example:

```text
CLM-2026-000001
```

The implementation may use a database sequence, identity table, or collision-safe retry around a generated value. The requirement is uniqueness and server ownership, not a specific formatting mechanism.

## Relationship To Drafts

Encrypted drafts remain useful for autosave and recovery before claim promotion.

Rules:

- Draft `ClaimId = current` is a frontend draft key, not a legal claim ID.
- Promoting a draft to claim intake does not require the backend to decrypt draft bytes.
- The frontend sends structured claim data from NgRx to `POST /api/claims`.
- After successful promotion, the app may keep the encrypted draft until reset or until the next cleanup spec chooses deletion semantics.
- Later signed-claim flows must use `ClaimIntake.Id`, not draft key `current`.

## Security And Privacy

- Server stores only SSN last four, never full SSN.
- Server must not trust frontend validity alone.
- Request body must be bound to current authenticated user.
- Claim lookup must always include `UserId`.
- Supporting document metadata is not sufficient authorization to retrieve document bytes.
- Snapshot JSON may contain PII and must be protected as application data.
- Logs must not include full snapshot JSON.
- Audit/log entries should reference `ClaimId`, `SnapshotVersion`, and `SnapshotHash`, not raw claim content.

## Testing Strategy

### Domain/Application Tests

- Creating claim intake rejects missing borrower fields.
- Creating claim intake rejects invalid SSN last four.
- Creating claim intake rejects future disability date.
- Creating claim intake rejects work-related claims without workers comp claim number.
- Creating claim intake normalizes workers comp claim number to null when not work-related.
- Creating claim intake rejects zero medical providers.
- Creating claim intake rejects more than five medical providers.
- Creating claim intake rejects no supporting document metadata.
- Snapshot hash is stable for semantically identical input.
- Snapshot hash changes when signed content changes.
- Snapshot hash ignores UI-only fields that are not part of `ClaimIntakeInput`.
- Internal snapshot replacement creates version 2 and leaves version 1 unchanged.
- Internal snapshot replacement after signing starts returns conflict.

### Infrastructure Tests

- `ClaimIntake` and `ClaimSnapshot` persist in one transaction.
- `(UserId, ClaimId)` lookup returns only owner’s claim.
- Snapshot version uniqueness is enforced.
- Current snapshot version resolves to the expected snapshot.
- JSON sections round-trip without losing required fields.

### API Tests

- `POST /api/claims` requires authentication.
- `POST /api/claims` ignores any body/user identity spoofing.
- `POST /api/claims` returns stable `claimId`, `snapshotVersion`, and `snapshotHash`.
- `GET /api/claims/{claimId}` returns `404` for another user’s claim.
- no public snapshot replacement endpoint is exposed in the first slice.

### Frontend Tests

- `submitClaim` effect posts structured sanitized claim data to `/api/claims`.
- successful response stores backend `claimId`.
- failure keeps draft state intact.
- draft autosave still uses encrypted draft endpoint.
- signing flow cannot use `claimId = current`.

## Migration Plan

1. Add domain entities `ClaimIntake` and `ClaimSnapshot`.
2. Add application DTOs and validators for `ClaimIntakeInput`.
3. Add snapshot canonicalizer/hasher.
4. Add EF configurations and migration.
5. Add application commands/queries.
6. Add API controller endpoints.
7. Replace mocked frontend submit effect with real `POST /api/claims`.
8. Keep encrypted draft autosave unchanged.
9. Update tests across application, infrastructure, API, and frontend.

## Impact On DocuSign Spec

This spec resolves these prior DocuSign blockers:

- defines authoritative server-side claim data
- provides stable pre-signing `ClaimId`
- defines immutable snapshot versions
- defines `ClaimSnapshotHash`
- gives QuestPDF deterministic input
- gives DocuSign envelope reuse logic a hash/version anchor
- defines edit behavior after signing starts

This spec does not resolve:

- full signing lifecycle status model
- signed document storage
- DocuSign webhook verification
- DocuSign Connect local reachability
- envelope/document idempotency tables
- borrower download behavior

## Acceptance Criteria

- A signed-in borrower can promote a complete wizard state into a backend claim intake record.
- The backend returns a stable `ClaimId`.
- The backend stores an immutable versioned snapshot.
- The backend computes and stores a deterministic SHA-256 snapshot hash.
- The server can retrieve the current snapshot without decrypting draft persistence.
- The encrypted draft store remains unchanged and temporary.
- Future signing-session creation can depend on `ClaimId`, `SnapshotVersion`, and `SnapshotHash`.
