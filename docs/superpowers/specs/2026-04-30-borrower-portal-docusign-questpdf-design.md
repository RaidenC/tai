# Design: Borrower Portal DocuSign + QuestPDF Signing

## Problem

The borrower portal needs an e-signing proof of concept for disability claim packets. Earlier review found that the first DocuSign design mixed signing-provider details with unresolved platform concerns: borrower identity, claim snapshots, lifecycle statuses, document storage, and webhook idempotency.

Those concerns are now split into prerequisite specs. This revised design should only define the DocuSign and QuestPDF-specific slice:

- how to render the claim packet PDF
- how to create a DocuSign envelope
- how to bind the recipient to the authenticated borrower
- how to place tabs with anchors
- how to issue a recipient view URL
- how DocuSign Connect maps into the external callback boundary
- how signed PDFs and certificates are retrieved and stored
- how fake provider and E2E/manual demo paths work

## Decision

Use **QuestPDF-generated claim packets + DocuSign eSignature developer/demo environment + embedded redirect signing + DocuSign anchor tabs + DocuSign Connect callbacks**.

DocuSign is treated as one signing provider behind provider-neutral application interfaces. It does not own claim identity, claim lifecycle vocabulary, document storage schema, or generic webhook idempotency.

QuestPDF renders deterministic claim-packet bytes from a server-owned `ClaimSnapshot`. DocuSign receives those bytes as a document, places tabs using anchor strings, and returns signer completion through Connect. The system marks the claim signed only after signed artifacts are retrieved from DocuSign and stored through the document storage boundary.

## Dependencies

This design depends on:

- `2026-05-01-borrower-identity-api-auth-design.md`
- `2026-05-01-claim-record-snapshot-design.md`
- `2026-05-01-claim-submission-lifecycle-design.md`
- `2026-05-01-document-storage-retention-design.md`
- `2026-05-01-webhook-external-callback-design.md`

The DocuSign implementation must use those specs as source of truth for:

- authenticated borrower identity
- stable `ClaimId`
- `SnapshotVersion`
- `SnapshotHash`
- lifecycle status names
- document metadata and hash storage
- external callback idempotency and replay handling

## Goals

- Generate one server-side claim packet PDF using QuestPDF.
- Include stable anchor strings for signature, date, and full name tabs.
- Create a DocuSign envelope in the developer/demo environment.
- Bind the embedded signing recipient to the authenticated borrower.
- Return a redirect-based recipient view URL to Borrower Portal.
- Treat DocuSign Connect as the authoritative provider completion signal.
- Use the external callback boundary for verification, idempotency, and correlation.
- Retrieve the signed PDF and completion certificate from DocuSign after verified completion.
- Store generated, signed, and certificate artifacts through the document storage abstraction.
- Provide a fake signing provider for CI and local automated E2E.
- Define a manual DocuSign demo path.

## Non-Goals

- Production DocuSign account setup.
- Production legal/compliance sign-off.
- Multi-signer workflows.
- Email signing.
- Iframe signing.
- Business-user-authored DocuSign templates.
- Long-term production retention policy.
- Object storage implementation.
- Replacing encrypted draft persistence.
- Defining generic webhook idempotency.
- Defining generic document storage schema.
- Defining claim lifecycle statuses.

## High-Level Flow

```text
Borrower Portal
  -> POST /api/claims/{claimId}/signing-session

Borrower Portal API
  -> authorize borrower owns claim
  -> load current ClaimSnapshot
  -> render QuestPDF claim packet
  -> validate anchors in test/render path
  -> store GeneratedClaimPacket artifact
  -> create DocuSign envelope
  -> persist signing attempt bound to ClaimId/SnapshotVersion/SnapshotHash
  -> transition claim to SigningInProgress
  -> create recipient view URL
  -> return signing URL

Borrower Browser
  -> full-page redirect to DocuSign recipient view
  -> returns to Borrower Portal return route
  -> frontend refreshes status only

DocuSign Connect
  -> POST /api/external-callbacks/docusign

Borrower Portal API
  -> verify callback through external callback boundary
  -> correlate account/envelope to signing attempt
  -> retrieve signed PDF and certificate
  -> store SignedClaimPacket and SigningCompletionCertificate artifacts
  -> transition claim to SignedDocumentsStored
```

Browser return never marks a claim signed.

## Backend Components

### Application Interfaces

Provider-neutral interfaces:

```csharp
public interface IClaimPacketRenderer {
  Task<RenderedClaimPacket> RenderAsync(
    ClaimSnapshotForSigning snapshot,
    CancellationToken cancellationToken);
}

public interface IElectronicSignatureProvider {
  Task<CreateSigningEnvelopeResult> CreateEnvelopeAsync(
    CreateSigningEnvelopeRequest request,
    CancellationToken cancellationToken);

  Task<RecipientViewResult> CreateRecipientViewAsync(
    CreateRecipientViewRequest request,
    CancellationToken cancellationToken);

  Task<CompletedSigningDocuments> GetCompletedDocumentsAsync(
    CompletedSigningDocumentsRequest request,
    CancellationToken cancellationToken);
}
```

DocuSign-specific infrastructure:

```text
QuestPdfClaimPacketRenderer
DocusignElectronicSignatureProvider
DocusignExternalCallbackVerifier
FakeElectronicSignatureProvider
```

The application layer should depend on provider-neutral interfaces. It may store provider-specific identifiers as opaque strings on signing-attempt records.

### Signing Attempt Record

DocuSign-specific implementation requires the provider-neutral signing attempt record from the callback spec.

Required fields:

```text
Id
Provider = Docusign
ProviderAccountId
ProviderEnvelopeId
ClaimId
UserId
SnapshotVersion
SnapshotHash
RecipientUserId
RecipientEmail
RecipientName
RecipientClientUserId
GeneratedPacketDocumentId
Status
CreatedAt
RecipientViewIssuedAt
CompletedAt
FailedAt
CorrelationId
```

Rules:

- `ProviderEnvelopeId` is stored after envelope creation.
- `RecipientClientUserId` must match the value used during envelope recipient creation.
- `GeneratedPacketDocumentId` points to the stored generated PDF artifact.
- signing attempt status is provider-level detail and maps to the canonical claim lifecycle.

## QuestPDF Claim Packet

### Input

QuestPDF renders from the current immutable claim snapshot:

```text
ClaimId
UserId
SnapshotVersion
SnapshotHash
Borrower
Incident
MedicalProviders
SupportingDocumentMetadata
TemplateCompatibilityVersion
```

It must not render from:

- frontend NgRx state directly
- encrypted draft payload
- route query parameters
- browser-supplied borrower identity

### Template Version

The PDF includes and metadata stores:

```text
ClaimPacketTemplateVersion = payment-protection-claim-packet-v1
```

The template version is stored with:

- generated packet artifact metadata
- signing attempt
- audit event

### Required Anchor Strings

The rendered PDF must include each anchor exactly once:

```text
/borrower_full_name/
/borrower_sign_here/
/borrower_date_signed/
```

Anchor intent:

| Anchor | DocuSign tab |
|---|---|
| `/borrower_full_name/` | full name tab |
| `/borrower_sign_here/` | signature tab |
| `/borrower_date_signed/` | date signed tab |

### Anchor Validation

Renderer tests must verify anchor presence with deterministic PDF text extraction or a renderer-level test seam.

Required tests:

- missing full-name anchor fails
- missing signature anchor fails
- missing date anchor fails
- duplicate anchor fails
- happy path includes exactly one of each anchor

Production runtime may fail fast if renderer validation metadata reports missing anchors. The test path must be deterministic enough to catch template regressions before a DocuSign envelope is created.

## Envelope Creation

### Request

Application command:

```http
POST /api/claims/{claimId}/signing-session
Authorization: Bearer <access-token>
```

Rules:

- current user must own `claimId`
- claim status must be `ReadyForSigning` or resumable `SigningInProgress`
- current snapshot must exist
- generated packet hash must match bytes stored and bytes sent to DocuSign
- if active signing attempt already exists for same `SnapshotHash`, reuse it and issue a new recipient view URL when safe
- if active attempt exists for a different `SnapshotHash`, do not reuse it

### DocuSign Envelope

Envelope contains:

```text
documentId = 1
documentName = claim-{claimId}-packet.pdf
one embedded signer recipient
anchor tabs for full name, sign here, and date signed
status = sent
```

Envelope custom fields should include where supported:

```text
ClaimId
SnapshotVersion
SnapshotHash
SigningAttemptId
CorrelationId
Environment = Demo
```

Custom fields are diagnostic only. Internal correlation still relies on stored `ProviderAccountId` and `ProviderEnvelopeId`.

## Recipient Identity Binding

Recipient data comes from trusted server-side sources:

- authenticated borrower identity from `ICurrentUserService`
- user profile/claim snapshot fields as defined by claim-record spec

The request body must not supply recipient identity.

DocuSign embedded recipient fields:

```text
recipientId = "1"
routingOrder = "1"
name = borrower full name from server snapshot/profile
email = borrower email from server snapshot/profile
clientUserId = stable internal borrower user ID or derived signing recipient ID
```

Rules:

- `clientUserId` used in envelope creation must be stored on signing attempt.
- recipient view creation must use the same recipient identity values.
- if borrower email/name differs between profile and snapshot, the POC uses the snapshot value for document-visible signer fields and stores both only if a later product spec requires profile comparison.
- recipient identity mismatch causes recipient view creation failure, not a new envelope.

## Anchor Tabs

DocuSign tab request uses anchor placement:

```json
{
  "signHereTabs": [
    {
      "anchorString": "/borrower_sign_here/",
      "anchorUnits": "pixels",
      "anchorXOffset": "0",
      "anchorYOffset": "0"
    }
  ],
  "dateSignedTabs": [
    {
      "anchorString": "/borrower_date_signed/",
      "anchorUnits": "pixels",
      "anchorXOffset": "0",
      "anchorYOffset": "0"
    }
  ],
  "fullNameTabs": [
    {
      "anchorString": "/borrower_full_name/",
      "anchorUnits": "pixels",
      "anchorXOffset": "0",
      "anchorYOffset": "0"
    }
  ]
}
```

Rules:

- anchor strings must match QuestPDF output exactly
- no x/y absolute coordinates in the POC
- offsets default to zero unless manual demo proves a small offset is needed
- any offset change must be captured in the signing provider config or template version notes

## Recipient View URL

The backend creates a DocuSign recipient view URL after envelope creation.

Request values:

```text
EnvelopeId
RecipientName
RecipientEmail
RecipientClientUserId
ReturnUrl
AuthenticationMethod
```

Return URL is derived by backend configuration, not accepted directly from the browser:

```text
Docusign:ReturnUrlBase = http://localhost:4202/claim/review-sign
```

Backend appends safe query parameters:

```text
?signing=returned&claimId={claimId}
```

Rules:

- `ReturnUrlBase` must be allowlisted configuration
- non-local environments require HTTPS
- returned `claimId` is navigation context only; backend status refresh re-authorizes ownership
- recipient view URLs are short-lived and should not be stored as durable claim state
- frontend redirects with `window.location.assign(signingUrl)`

## Connect Payload Handling

DocuSign Connect posts to:

```http
POST /api/external-callbacks/docusign
```

The generic external callback spec owns:

- `[AllowAnonymous]` route boundary
- raw body capture
- verification result model
- idempotency table
- duplicate/conflict handling
- replay handling
- unknown-correlation behavior

The DocuSign verifier must populate:

```text
Provider = Docusign
ProviderAccountId
ProviderEnvelopeId
ProviderEventId
EventType
EventCreatedAt
RawBodySha256
VerificationMethod
```

DocuSign event mapping:

| DocuSign event/status | Internal handling |
|---|---|
| completed | retrieve signed artifacts and attempt `SignedDocumentsStored` transition |
| declined | mark signing attempt declined; transition claim back to `ReadyForSigning` or `Failed` according to lifecycle rules |
| voided | mark signing attempt voided; transition claim back to `ReadyForSigning` or `Failed` according to lifecycle rules |
| delivered/sent/intermediate | record callback; do not change claim lifecycle unless a later spec requires status detail |

Rules:

- completion callback does not directly mark claim submitted
- completion callback does not mark `SignedDocumentsStored` before artifacts are stored
- account ID and envelope ID must map to exactly one signing attempt
- mismatched snapshot hash stops processing
- duplicate completed callbacks are idempotent

## Signed PDF And Certificate Retrieval

After verified DocuSign completion:

1. load signing attempt by `ProviderAccountId` and `ProviderEnvelopeId`
2. verify attempt is for current claim snapshot
3. call DocuSign API to retrieve signed PDF
4. call DocuSign API to retrieve completion certificate
5. store signed PDF through `IClaimDocumentStore` as `SignedClaimPacket`
6. store certificate through `IClaimDocumentStore` as `SigningCompletionCertificate`
7. verify generated packet artifact exists for same claim/snapshot/attempt
8. transition claim to `SignedDocumentsStored`

Rules:

- document bytes are never logged
- provider API credentials remain server-side
- temporary DocuSign document download failures are retryable in `SigningInProgress`
- storage failures are retryable in `SigningInProgress`
- artifact hashes are computed by internal document storage, not trusted from DocuSign

## Fake Provider Behavior

CI and local automated E2E use `FakeElectronicSignatureProvider` by default.

Fake provider must implement the same application interface:

```text
CreateEnvelopeAsync
CreateRecipientViewAsync
GetCompletedDocumentsAsync
```

Fake behavior:

- creates deterministic fake envelope IDs
- creates deterministic recipient view URLs, such as `/fake-signing/{envelopeId}`
- can simulate borrower completion
- emits fake callback through the external callback path or direct test seam
- returns deterministic fake signed packet bytes
- returns deterministic fake completion certificate bytes
- exercises the same document storage path as DocuSign
- supports test modes for duplicate callback, invalid signature, declined, voided, download failure, and storage retry

Fake provider must not bypass:

- claim ownership checks
- snapshot hash binding
- lifecycle transitions
- document storage abstraction
- external callback idempotency tests

## Frontend Behavior

Borrower Portal Step 4 uses backend status and capabilities.

Actions:

```text
CreateSigningSession
CreateSigningSessionSuccess
CreateSigningSessionError
ReturnedFromSigningProvider
RefreshClaimStatus
RefreshClaimStatusSuccess
RefreshClaimStatusError
DownloadSignedPacket
```

Rules:

- create signing session only when backend says `canStartSigning`
- redirect only after backend returns `signingUrl`
- after return, refresh status and optionally poll for bounded period
- browser return does not mark signed
- show signed state only for `SignedDocumentsStored` or `Submitted`
- download button appears only when backend says `canDownloadSignedPacket`

Polling details can be owned by frontend implementation plan, but it must be bounded, cancelled on navigation, and stopped on terminal status.

## Configuration

DocuSign POC config:

```text
Docusign:Environment = Demo
Docusign:BasePath
Docusign:AccountId
Docusign:IntegrationKey
Docusign:UserId
Docusign:PrivateKey
Docusign:WebhookSecret
Docusign:ReturnUrlBase
Signing:Provider = Fake | Docusign
```

Rules:

- secrets come from user secrets or environment variables
- private keys and webhook secrets are never committed
- config validation fails startup or disables DocuSign provider when required values are missing
- fake provider remains available for local/CI without DocuSign secrets

## Error Handling

| Failure | Behavior |
|---|---|
| QuestPDF render fails | do not create envelope; keep claim `ReadyForSigning`; audit failure |
| anchor validation fails | do not create envelope; keep claim `ReadyForSigning`; audit template failure |
| generated packet storage fails | do not create envelope; keep claim `ReadyForSigning`; retry allowed |
| DocuSign envelope creation fails before persistence | keep claim `ReadyForSigning`; retry allowed |
| recipient view creation fails after envelope exists | keep `SigningInProgress`; retry recipient view creation |
| borrower exits DocuSign | status refresh shows `SigningInProgress`; allow resume when backend can issue recipient view |
| callback invalid verification | reject through external callback boundary; no state mutation |
| callback duplicate completion | idempotent ignore |
| callback completion but signed PDF download fails | stay `SigningInProgress`; retry artifact retrieval |
| signed artifact storage fails | stay `SigningInProgress`; retry storage |
| declined/voided envelope | mark attempt terminal; transition according to lifecycle rules |

## Testing Strategy

### Unit Tests

- QuestPDF renderer includes all required anchors exactly once.
- renderer output hash is stable for identical snapshot input.
- signing session command rejects claims not owned by current user.
- signing session command rejects non-`ReadyForSigning` claims unless resumable.
- signing session command stores generated packet before envelope creation.
- active envelope reuse requires same `SnapshotHash`.
- recipient view request uses stored `clientUserId`.
- backend derives return URL and rejects caller-supplied return URL behavior.

### Integration Tests

- fake provider creates envelope and recipient view.
- fake callback completion stores signed packet and certificate.
- duplicate fake callback does not duplicate lifecycle transition.
- fake declined/voided callback does not mark signed.
- signed artifact download failure remains retryable.
- document storage metadata contains generated/signed/certificate artifacts for same claim/snapshot.

### Frontend Tests

- Step 4 starts signing only from `ReadyForSigning`.
- redirect happens after signing URL success.
- return route refreshes backend status.
- return route does not mark claim signed locally.
- `SignedDocumentsStored` enables signed packet download when backend capability allows it.
- error states preserve claim data.

### E2E Tests

Default CI path:

```text
fake provider
fake callback
local document storage
no ngrok
```

Flow:

1. borrower signs in
2. borrower completes wizard
3. frontend promotes draft to claim intake
4. Step 4 starts fake signing session
5. fake signing page completes
6. fake callback is processed
7. signed artifacts are stored
8. UI shows signed/submitted-ready state

Manual DocuSign demo path:

1. configure DocuSign demo credentials
2. configure public callback URL through ngrok or dev environment
3. start Borrower Portal and API
4. complete wizard and create signing session
5. verify DocuSign tabs appear at anchors
6. complete DocuSign ceremony
7. verify Connect callback delivery
8. verify signed PDF and certificate storage
9. verify duplicate callback behavior if DocuSign retries or manual resend is available

## Observability

Structured events:

```text
claim_packet.rendered
claim_packet.anchor_validation_failed
docusign.envelope_created
docusign.recipient_view_created
docusign.callback_completed
docusign.documents_retrieved
docusign.documents_retrieval_failed
signing_attempt.completed
signing_attempt.failed
```

Common fields:

```text
ClaimId
UserId
SnapshotVersion
SnapshotHash
SigningAttemptId
Provider
ProviderAccountId
ProviderEnvelopeId
CorrelationId
```

Do not log:

- PDF bytes
- full claim snapshot JSON
- DocuSign private key
- webhook secret
- recipient view URL beyond debug-safe redacted form

## Impact On Previous Specs

This spec consumes, rather than redefines:

- borrower identity from Borrower Identity + API Auth
- `ClaimId`, `SnapshotVersion`, and `SnapshotHash` from Claim Record + Snapshot
- statuses from Claim Submission Lifecycle
- document artifact storage from Document Storage + Retention
- callback idempotency and verification boundary from Webhook + External Callback

If this spec conflicts with any prerequisite spec, the prerequisite owns the platform boundary and this spec should be updated.

## Acceptance Criteria

- QuestPDF renders a deterministic claim packet from the server snapshot.
- Required DocuSign anchor strings appear exactly once.
- DocuSign envelope creation uses generated packet bytes and anchor tabs.
- recipient identity is bound to the authenticated borrower and stored signing attempt.
- backend derives the recipient return URL.
- browser return does not mark a claim signed.
- DocuSign Connect completion flows through the external callback boundary.
- signed PDF and certificate retrieval happen only after verified completion.
- generated, signed, and certificate artifacts are stored through the document storage abstraction.
- fake provider supports local/CI E2E without DocuSign credentials or public webhook tunnel.
- manual DocuSign demo path is documented separately from CI requirements.
