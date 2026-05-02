# Design: Claim Submission Lifecycle

## Problem

The DocuSign/QuestPDF design currently mixes several meanings into similar status names:

- the borrower has a saved draft
- the backend has accepted a structured claim
- a signing ceremony is in progress
- the external signing provider says the envelope is complete
- signed artifacts were actually stored
- the business claim was submitted

Those are not the same event. If the system collapses them into one `Signed` or `Submitted` flag, the portal can show the wrong borrower state, retry the wrong operation, or mark a claim submitted before signed documents and certificates are safely stored.

The system needs a provider-independent claim submission lifecycle before the DocuSign spec is revised. DocuSign should become one implementation detail inside this lifecycle, not the owner of the lifecycle vocabulary.

## Decision

Define a canonical **Claim Submission Lifecycle** with statuses independent of DocuSign:

```text
Draft
ReadyForSigning
SigningInProgress
SignedDocumentsStored
Submitted
Failed
```

`Draft` remains represented by encrypted draft persistence for the POC. The structured server-owned `ClaimIntake` record begins at `ReadyForSigning` after the completed wizard is promoted into a claim snapshot.

Signing provider completion is not a final borrower/business status. The claim reaches `SignedDocumentsStored` only after signed artifacts required by the storage spec are persisted and hashed. It reaches `Submitted` only after the backend performs the business submission transition.

## Goals

- Define one canonical lifecycle vocabulary across backend, API, frontend, tests, and future DocuSign work.
- Separate external signing completion from internal artifact storage.
- Separate signed artifact storage from business claim submission.
- Define retryable versus terminal failure behavior.
- Define status transitions that do not depend on DocuSign-specific terms.
- Give frontend state a precise mapping for borrower-facing UI.
- Establish where generated PDFs, signed PDFs, certificates, and audit-safe references fit in the lifecycle without choosing final storage mechanics.

## Non-Goals

- Choosing filesystem, database bytes, or object storage for signed artifacts.
- Defining retention/delete rules in detail.
- Implementing DocuSign webhook verification.
- Implementing claim snapshot persistence.
- Implementing claim adjudication or downstream carrier submission.
- Building admin/support tooling.

Generated PDFs, signed PDFs, certificates, hashes, download authorization, and retention rules are covered in detail by the next spec: **Document Storage + Retention**. This lifecycle spec only defines when those artifacts are required for a status transition.

## Existing Inputs

This spec depends on:

- `2026-05-01-borrower-identity-api-auth-design.md`
- `2026-05-01-claim-record-snapshot-design.md`

The claim snapshot spec defines:

- stable backend `ClaimId`
- immutable `ClaimSnapshot`
- `SnapshotVersion`
- `SnapshotHash`
- `ReadyForSigning` as the initial state after successful claim promotion

This lifecycle spec formalizes what happens after that point.

## Status Model

### Draft

Meaning:

The borrower is still editing claim data. The POC stores this as an encrypted opaque `ClaimDraft`; the backend cannot render or sign it.

Representation:

- existing `ClaimDraft`
- no required `ClaimIntake` row
- frontend wizard state may have `claimId = null`
- draft key such as `current` is not a legal claim ID

Allowed actions:

- save draft
- load draft
- update wizard fields
- upload or remove supporting document metadata
- promote complete wizard data into a claim intake record

Exit transition:

```text
Draft -> ReadyForSigning
```

Transition trigger:

Borrower submits complete wizard state to `POST /api/claims`; backend validates, creates `ClaimIntake`, creates immutable snapshot version 1, and returns stable `ClaimId`.

Retry behavior:

Validation failures do not create a lifecycle failure state. They return `400` and the borrower remains in `Draft`.

### ReadyForSigning

Meaning:

The backend has accepted structured claim data and created an immutable current snapshot. The claim is ready for a signing session, but no active signing attempt is currently in progress.

Representation:

- `ClaimIntake.Status = ReadyForSigning`
- current `ClaimSnapshot` exists
- `ClaimId`, `SnapshotVersion`, and `SnapshotHash` are stable

Allowed actions:

- read claim summary
- generate or reuse a signing session in a future signing-provider spec
- perform internal snapshot replacement only before signing starts, if a correction flow is later added
- abandon/void claim if product later needs that path

Exit transitions:

```text
ReadyForSigning -> SigningInProgress
ReadyForSigning -> Failed
```

Transition triggers:

- `SigningInProgress`: backend successfully creates or resumes an active signing attempt for the current snapshot.
- `Failed`: unrecoverable internal problem prevents signing from starting, such as unsupported snapshot/template compatibility.

Retry behavior:

Most provider or network errors during signing-session creation should not move the claim to `Failed`. They should return an API error and leave the claim `ReadyForSigning` so the borrower can retry.

### SigningInProgress

Meaning:

A signing attempt exists for the current claim snapshot. The borrower may be at the external signing ceremony, may have returned to the portal, or the system may be waiting for a provider callback.

Representation:

- `ClaimIntake.Status = SigningInProgress`
- active signing attempt record exists in the later signing-provider spec
- active signing attempt is bound to `ClaimId`, `SnapshotVersion`, and `SnapshotHash`

Allowed actions:

- issue or reissue signing ceremony URL when safe
- refresh signing status
- show borrower “finalizing” or “signing in progress”
- receive provider callback
- fetch signed artifacts after provider completion
- retry signed artifact fetch/storage if provider says signing completed

Exit transitions:

```text
SigningInProgress -> SignedDocumentsStored
SigningInProgress -> ReadyForSigning
SigningInProgress -> Failed
```

Transition triggers:

- `SignedDocumentsStored`: provider completion is verified, required signed artifacts are fetched, hashes are computed, and artifact references are stored.
- `ReadyForSigning`: active signing attempt is voided, expired, declined, or abandoned in a way that allows a new signing attempt for the same snapshot.
- `Failed`: signing cannot continue without manual or explicit borrower action.

Retry behavior:

Retryable inside `SigningInProgress`:

- recipient view URL creation failure after an envelope exists
- provider completion callback duplicate
- provider completion callback arrives before internal polling sees completion
- signed artifact download temporary failure
- signed artifact storage temporary failure

Terminal or reset-required:

- borrower declines to sign
- provider voids the envelope
- active attempt snapshot hash does not match current claim snapshot hash
- provider account/envelope identifiers do not map to this claim

Provider completion alone does not leave `SigningInProgress`. The claim remains `SigningInProgress` until internal artifact storage succeeds.

### SignedDocumentsStored

Meaning:

The claim has completed signing, and the backend has stored every artifact required to support the signed claim packet.

Representation:

- `ClaimIntake.Status = SignedDocumentsStored`
- signed document artifact references exist
- signed document hashes exist
- completion/certificate artifact references exist if required by the selected provider
- audit-safe metadata exists for what was signed and stored

Required artifact classes:

```text
GeneratedClaimPacket
SignedClaimPacket
SigningCompletionCertificate
```

The next Document Storage + Retention spec chooses storage provider, encryption, schema, retention, and download behavior. This lifecycle spec requires only that the artifact references and hashes exist before entering `SignedDocumentsStored`.

Allowed actions:

- show borrower signed state
- allow signed packet download if the storage spec enables borrower download
- submit the business claim
- retry business submission if it fails

Exit transitions:

```text
SignedDocumentsStored -> Submitted
SignedDocumentsStored -> Failed
```

Transition triggers:

- `Submitted`: backend records that the signed claim has been submitted to the business workflow.
- `Failed`: business submission cannot proceed due to a terminal validation or downstream failure.

Retry behavior:

Business submission failures that are temporary should keep the claim in `SignedDocumentsStored` and expose a retry path. They should not roll the claim backward to `SigningInProgress`.

### Submitted

Meaning:

The signed claim has been accepted by the backend as submitted. This is the borrower-visible completion state for the POC.

Representation:

- `ClaimIntake.Status = Submitted`
- `SubmittedAt` timestamp exists
- submitted audit event exists
- current snapshot and signed artifacts remain associated with the claim

Allowed actions:

- view submission confirmation
- download signed packet if enabled
- read status

Not allowed:

- edit claim contents
- replace snapshot
- create new signing attempt for the submitted claim
- delete signed artifacts through borrower UI

Exit transitions:

None for the first POC.

Retry behavior:

`Submitted` is terminal for borrower-facing flow. Corrections, withdrawal, adjudication, or reopening are out of scope for this lifecycle.

### Failed

Meaning:

The claim is in an error state that cannot continue automatically without retry, reset, support action, or a future explicit transition.

Representation:

- `ClaimIntake.Status = Failed`
- failure code exists
- failure reason safe for support/internal logs exists
- borrower-safe error message can be derived
- `FailedAt` timestamp exists

Failure kind should be stored separately from status:

```text
Retryable
Terminal
ManualReviewRequired
```

Examples:

| Failure | Kind | Recovery |
|---|---|---|
| signing provider temporarily unavailable before attempt creation | Retryable | remain or return to `ReadyForSigning`; borrower retries |
| signed artifact storage temporary failure after provider completion | Retryable | remain in `SigningInProgress`; backend retries |
| provider envelope declined by borrower | Terminal | return to `ReadyForSigning` only through explicit reset/void flow |
| snapshot hash mismatch on active signing attempt | Terminal | void attempt and require new snapshot/signing flow |
| downstream business submission unavailable | Retryable | remain in `SignedDocumentsStored`; backend or borrower retries submission |
| impossible state transition detected | ManualReviewRequired | support/admin intervention |

Preferred POC rule:

Use `Failed` only when the claim cannot safely remain in its current retryable state. Temporary failures should usually keep the previous state and add a failure event/attempt record rather than changing the claim status to `Failed`.

## Canonical Transition Table

| From | To | Trigger | Retryable? |
|---|---|---|---|
| Draft | ReadyForSigning | claim intake created and snapshot stored | no retry state; validation errors remain Draft |
| ReadyForSigning | SigningInProgress | signing attempt created for current snapshot | retry API call if attempt creation fails before persistence |
| ReadyForSigning | Failed | unsupported template/snapshot or terminal pre-signing error | usually terminal/manual |
| SigningInProgress | SignedDocumentsStored | provider completion verified and signed artifacts stored | artifact fetch/storage failures retry in SigningInProgress |
| SigningInProgress | ReadyForSigning | attempt voided/expired/declined and claim can restart signing | explicit reset/retry |
| SigningInProgress | Failed | unsafe mismatch or unrecoverable signing failure | terminal/manual |
| SignedDocumentsStored | Submitted | business submission recorded | temporary downstream failures retry in SignedDocumentsStored |
| SignedDocumentsStored | Failed | unrecoverable business submission failure | terminal/manual |
| Submitted | none | terminal borrower completion state | not applicable |
| Failed | ReadyForSigning | explicit reset after terminal signing failure when allowed | manual/explicit |
| Failed | SigningInProgress | support resumes retryable storage/signing issue | manual/explicit |
| Failed | SignedDocumentsStored | support resolves submission-only failure after artifacts are valid | manual/explicit |

No implicit backward transitions are allowed. Any backward movement must create an audit event explaining the reason.

## Backend Model

Add lifecycle fields to `ClaimIntake` or equivalent claim root:

```text
Status
FailureKind
FailureCode
FailureMessage
ReadyForSigningAt
SigningStartedAt
SignedDocumentsStoredAt
SubmittedAt
FailedAt
LastStatusChangedAt
LastStatusChangedBy
```

Recommended status enum:

```csharp
public enum ClaimSubmissionStatus {
  ReadyForSigning,
  SigningInProgress,
  SignedDocumentsStored,
  Submitted,
  Failed
}
```

`Draft` is intentionally not in the persisted `ClaimIntake` enum for the first POC because `Draft` is represented by encrypted draft persistence before the claim intake row exists.

Recommended projected API status enum:

```text
Draft
ReadyForSigning
SigningInProgress
SignedDocumentsStored
Submitted
Failed
```

The API may return `Draft` from draft endpoints or frontend projection, but `GET /api/claims/{claimId}/status` only applies after a server claim exists.

## API Design

### Get Claim Status

```http
GET /api/claims/{claimId}/status
Authorization: Bearer <access-token>
```

Response:

```json
{
  "claimId": "CLM-2026-000001",
  "status": "SigningInProgress",
  "snapshotVersion": 1,
  "snapshotHash": "sha256-value",
  "failureKind": null,
  "failureCode": null,
  "canRetry": false,
  "canStartSigning": false,
  "canDownloadSignedPacket": false,
  "canSubmit": false,
  "lastStatusChangedAt": "2026-05-01T18:30:00Z"
}
```

Rules:

- current user must own the claim
- return `404` for missing or other-user claims
- booleans are backend-derived capabilities, not frontend guesses
- no DocuSign envelope ID is required in this provider-independent endpoint

### Internal Lifecycle Transitions

Public API endpoints should not directly expose arbitrary status mutation.

Application commands perform transitions:

```csharp
StartSigningCommand
MarkSignedDocumentsStoredCommand
SubmitSignedClaimCommand
MarkClaimFailedCommand
ResetSigningAttemptCommand
```

Each command must:

- load claim by `UserId` or trusted system context
- verify current status
- validate transition is allowed
- set timestamps
- write audit event
- save atomically

## Frontend Mapping

Frontend should map canonical backend statuses to borrower-facing UI labels:

| Backend/API status | Borrower label | Primary UI behavior |
|---|---|---|
| Draft | Continue your claim | wizard editable |
| ReadyForSigning | Ready to sign | show generate/sign button |
| SigningInProgress | Finalizing signature | show status refresh/polling; allow resume when backend says so |
| SignedDocumentsStored | Signed | show signed packet availability if enabled |
| Submitted | Submitted | show confirmation |
| Failed | Needs attention | show backend-derived retry/contact action |

Frontend state should avoid separate ambiguous `signed` and `submitted` booleans. It should store:

```typescript
type ClaimSubmissionStatus =
  | 'draft'
  | 'readyForSigning'
  | 'signingInProgress'
  | 'signedDocumentsStored'
  | 'submitted'
  | 'failed';
```

Frontend should also store backend capabilities:

```typescript
interface ClaimStatusView {
  claimId: string;
  status: ClaimSubmissionStatus;
  snapshotVersion: number | null;
  canRetry: boolean;
  canStartSigning: boolean;
  canDownloadSignedPacket: boolean;
  canSubmit: boolean;
  failureKind: 'retryable' | 'terminal' | 'manualReviewRequired' | null;
  failureCode: string | null;
}
```

## Document Artifact Lifecycle Dependencies

This spec does not choose storage implementation, but it defines artifact gates:

### Before `SigningInProgress`

Required:

- current claim snapshot exists
- snapshot hash exists
- generated packet may be created during transition into signing, depending on signing provider design

### Before `SignedDocumentsStored`

Required:

- generated claim packet reference exists
- generated claim packet hash exists
- signed claim packet reference exists
- signed claim packet hash exists
- completion certificate reference exists if the provider supplies one
- completion certificate hash exists if the certificate is required
- artifact metadata links to `ClaimId`, `SnapshotVersion`, and signing attempt/provider identifiers

### Before `Submitted`

Required:

- status is `SignedDocumentsStored`
- signed artifact references pass internal consistency checks
- submission audit event can reference snapshot hash and signed artifact hashes

The next Document Storage + Retention spec must decide:

- filesystem vs database bytes vs object-storage abstraction
- encryption expectations
- document metadata schema
- hash storage format
- download authorization
- retention/delete rules for POC

## Audit Requirements

Every lifecycle transition must write an audit event with:

```text
ClaimId
UserId or SystemActor
PreviousStatus
NewStatus
SnapshotVersion
SnapshotHash
Timestamp
CorrelationId
ReasonCode
```

Artifact-related transitions must also include artifact hash references once the storage spec defines them.

Audit events must not contain raw claim snapshot JSON or document bytes.

## Error Handling Rules

- Validation errors during draft promotion leave the borrower in `Draft`.
- Transient signing-session creation errors leave the claim `ReadyForSigning` unless a persisted signing attempt exists.
- Once a signing attempt exists, transient provider callback/download/storage errors remain `SigningInProgress`.
- Provider completion without stored signed artifacts is not `SignedDocumentsStored`.
- Signed artifacts stored without business submission is not `Submitted`.
- Business submission retry failures remain `SignedDocumentsStored` unless classified terminal.
- Any impossible transition returns conflict and writes a security/support audit event.

## Testing Strategy

### Domain/Application Tests

- `ReadyForSigning -> SigningInProgress` succeeds for current snapshot.
- `SigningInProgress -> SignedDocumentsStored` fails if signed packet hash is missing.
- `SigningInProgress -> SignedDocumentsStored` fails if certificate is required but missing.
- `SignedDocumentsStored -> Submitted` succeeds and sets `SubmittedAt`.
- `SigningInProgress -> Submitted` is rejected.
- `ReadyForSigning -> Submitted` is rejected.
- `Submitted` rejects all mutation transitions.
- retryable artifact-storage failure keeps status `SigningInProgress`.
- retryable downstream submission failure keeps status `SignedDocumentsStored`.
- terminal failure records `FailureKind`, `FailureCode`, and `FailedAt`.

### API Tests

- `GET /api/claims/{claimId}/status` requires auth.
- other-user claim status returns `404`.
- status response includes backend-derived capabilities.
- `canStartSigning` is true only in `ReadyForSigning`.
- `canDownloadSignedPacket` is true only when status and storage policy allow it.
- `canSubmit` is true only in `SignedDocumentsStored`.

### Frontend Tests

- `ReadyForSigning` shows signing CTA.
- `SigningInProgress` shows finalizing/resume state and does not show submitted.
- `SignedDocumentsStored` shows signed state and download only when backend capability allows it.
- `Submitted` shows final confirmation.
- `Failed` renders retry/contact action from backend capabilities.
- frontend does not mark signed based on provider/browser return alone.

## Migration Notes

The claim snapshot spec currently names `ReadyForSigning` as the initial structured claim state. This lifecycle spec refines the model:

- encrypted drafts represent `Draft`
- structured `ClaimIntake` starts at `ReadyForSigning`
- future signing provider work moves it to `SigningInProgress`
- future document storage work enables `SignedDocumentsStored`
- business submission moves it to `Submitted`

If existing design docs mention `Signed`, replace it with either:

- `SigningInProgress` when provider says signing completed but artifacts are not stored
- `SignedDocumentsStored` when internal signed artifacts are stored
- `Submitted` when the business submission is complete

## Impact On DocuSign Spec

This spec resolves these prior DocuSign blockers:

- canonical backend/API/frontend status vocabulary
- separation of provider completion from internal storage
- separation of signed artifact storage from claim submission
- retryable versus terminal failure rules
- frontend mapping for signing states
- lifecycle gates for generated/signed document references and hashes

This spec does not resolve:

- exact document storage backend
- document retention/deletion rules
- signed document download URL/stream behavior
- DocuSign Connect signature verification
- webhook idempotency storage
- local DocuSign webhook reachability

## Acceptance Criteria

- The lifecycle has exactly one canonical provider-independent status vocabulary.
- `Draft` is clearly represented by encrypted draft persistence before structured claim creation.
- Structured claims begin at `ReadyForSigning`.
- Provider completion cannot directly mark a claim `Submitted`.
- A claim cannot reach `SignedDocumentsStored` until required signed artifacts and hashes exist.
- A claim cannot reach `Submitted` until it is already `SignedDocumentsStored`.
- Retryable failures remain in the state where retry is meaningful.
- Terminal/manual failures are represented by `Failed` plus failure classification.
