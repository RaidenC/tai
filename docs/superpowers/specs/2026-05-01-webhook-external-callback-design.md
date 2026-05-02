# Design: Webhook + External Callback Boundary

## Problem

The signing workflow needs to accept asynchronous callbacks from external providers such as DocuSign Connect. Those requests are not borrower browser requests and cannot use the borrower’s Portal Identity bearer token.

At the same time, external callbacks are high-risk trust-boundary events. A valid route match must not be enough to mutate claim state, download signed documents, or mark a signing attempt complete.

The system needs a provider-neutral callback boundary before DocuSign-specific webhook logic is designed.

## Decision

Add a dedicated **External Callback** architecture:

- callback endpoints bypass borrower authentication with explicit `[AllowAnonymous]`
- callbacks are verified by provider-specific verifier services before application state changes
- every callback delivery is recorded in an idempotency table
- replay, duplicate, conflicting duplicate, out-of-order, and unknown-correlation events are handled explicitly
- provider account/envelope identifiers must map to an internal signing attempt before claim mutation
- local development uses fake callback by default, with ngrok/public tunnel as the optional manual provider validation path

This spec defines the boundary and persistence. The later DocuSign spec will plug DocuSign-specific HMAC/signature rules and payload fields into this boundary.

## Goals

- Let external providers call borrower API callback endpoints without borrower auth.
- Keep callback routes fail-closed through provider-specific verification.
- Define where signature verification happens.
- Persist every callback delivery enough for idempotency, replay diagnostics, and support.
- Define account/envelope correlation before state mutation.
- Define duplicate and out-of-order event behavior.
- Define a local dev strategy that does not require public tunnels in CI.
- Give the DocuSign spec a precise webhook contract to implement.

## Non-Goals

- Choosing the exact DocuSign Connect HMAC header/payload format.
- Implementing DocuSign document download.
- Implementing signing attempt creation.
- Implementing signed document storage.
- Building an admin replay UI.
- Exposing provider callback payloads to borrowers.

## Existing Inputs

This spec depends on:

- `2026-05-01-borrower-identity-api-auth-design.md`
- `2026-05-01-claim-record-snapshot-design.md`
- `2026-05-01-claim-submission-lifecycle-design.md`
- `2026-05-01-document-storage-retention-design.md`

Important decisions inherited from those specs:

- borrower-owned APIs use bearer-token auth
- external callbacks use `[AllowAnonymous]` plus provider verification
- signing attempts are bound to `ClaimId`, `SnapshotVersion`, and `SnapshotHash`
- provider completion alone does not move a claim to `SignedDocumentsStored`
- signed artifacts must be stored before `SignedDocumentsStored`

## Route Boundary

Callback endpoints live under:

```text
/api/external-callbacks/{provider}
```

Initial provider route:

```http
POST /api/external-callbacks/docusign
```

Rules:

- endpoint is marked `[AllowAnonymous]`
- endpoint does not read `ICurrentUserService.UserId`
- endpoint does not require `Authorization: Bearer`
- endpoint is excluded from borrower-only authorization policies
- endpoint still passes through CORS-neutral server middleware where safe
- endpoint must not mutate state before provider verification succeeds

For clarity, do not mount callbacks under borrower-owned resource routes such as:

```text
/api/claims/{claimId}/...
```

Provider callbacks should identify internal records through verified provider identifiers, not route-supplied borrower claim IDs.

## Middleware Bypass

Borrower API middleware order should remain:

```csharp
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

Callback bypass should be route/attribute based:

```csharp
[AllowAnonymous]
[Route("api/external-callbacks/docusign")]
public sealed class DocusignCallbackController : ControllerBase
```

Do not implement callback bypass by:

- accepting `X-User-Id`
- injecting a fake borrower user
- skipping the entire middleware pipeline based on path string
- trusting CORS origin checks

If future gateway trust middleware is added to borrower API, external callback routes must have an explicit documented bypass or allowlist path that is separate from borrower identity.

## Verification Boundary

Provider-specific verification belongs at the edge, before application command dispatch:

```text
Controller
  -> read raw request body and headers
  -> call provider verifier
  -> persist callback delivery attempt
  -> map verified payload to normalized callback event
  -> dispatch application command
```

Verifier interface:

```csharp
public interface IExternalCallbackVerifier {
  Task<ExternalCallbackVerificationResult> VerifyAsync(
    ExternalCallbackVerificationRequest request,
    CancellationToken cancellationToken);
}
```

Request:

```csharp
public sealed record ExternalCallbackVerificationRequest(
  ExternalProvider Provider,
  IReadOnlyDictionary<string, string[]> Headers,
  byte[] RawBody,
  string? RemoteIpAddress,
  string CorrelationId);
```

Result:

```csharp
public sealed record ExternalCallbackVerificationResult(
  bool IsAuthentic,
  string? FailureCode,
  string? FailureReason,
  VerifiedExternalCallback? Callback);
```

Normalized verified callback:

```csharp
public sealed record VerifiedExternalCallback(
  ExternalProvider Provider,
  string ProviderAccountId,
  string ProviderEnvelopeId,
  string ProviderEventId,
  string EventType,
  DateTimeOffset? EventCreatedAt,
  string RawBodySha256,
  string VerificationMethod);
```

Rules:

- raw request body must be available to the verifier exactly as received
- verification failure returns `401` or `403`
- verification failure records a rejected callback delivery
- verification failure does not dispatch lifecycle commands
- parsing provider payload into business fields happens only after authenticity is established enough for that provider’s verification method

The later DocuSign spec must define the exact verification method, headers, canonical payload, and failure codes.

## Callback Delivery Idempotency Table

Add table:

```text
external_callback_deliveries
```

Columns:

```text
id uuid primary key
provider text not null
provider_account_id text null
provider_envelope_id text null
provider_event_id text null
event_type text null
raw_body_sha256 text not null
verification_status text not null
verification_method text null
failure_code text null
failure_reason text null
processing_status text not null
processing_attempts integer not null
first_received_at timestamptz not null
last_received_at timestamptz not null
processed_at timestamptz null
ignored_at timestamptz null
replay_of_delivery_id uuid null
correlation_id text null
remote_ip_address text null
headers_json jsonb null
payload_metadata_json jsonb null
```

`verification_status` values:

```text
Unverified
Verified
Rejected
```

`processing_status` values:

```text
Received
DuplicateIgnored
ConflictRejected
UnknownCorrelation
OutOfOrderIgnored
Processed
ProcessingFailedRetryable
ProcessingFailedTerminal
```

Indexes:

```text
index external_callback_deliveries(provider, provider_account_id, provider_envelope_id)
index external_callback_deliveries(provider, provider_event_id)
index external_callback_deliveries(raw_body_sha256)
index external_callback_deliveries(processing_status)
unique external_callback_deliveries(provider, provider_event_id) where provider_event_id is not null
unique external_callback_deliveries(provider, provider_account_id, provider_envelope_id, event_type, raw_body_sha256)
```

Rationale:

- provider event ID is preferred when stable
- body hash provides fallback idempotency when event ID is absent or provider-specific
- account/envelope index supports correlation diagnostics
- processing status distinguishes duplicate success from suspicious conflicts

## Idempotency Rules

### Same Event ID, Same Body Hash

Behavior:

- treat as duplicate delivery
- do not re-run state mutation
- update `last_received_at`
- increment a duplicate count or processing attempts if modeled
- return success response to provider if original delivery was processed or safely ignored

### Same Event ID, Different Body Hash

Behavior:

- mark new delivery `ConflictRejected`
- do not mutate state
- return `409`, `400`, or provider-safe failure response
- write security/support audit event

This indicates either provider inconsistency, replay tampering, or a bad idempotency assumption.

### No Event ID, Same Account/Envelope/Event Type/Body Hash

Behavior:

- treat as duplicate delivery
- do not re-run state mutation
- return success if prior equivalent event was processed or safely ignored

### Duplicate Completion After Terminal Success

Behavior:

- if claim is already `SignedDocumentsStored` or `Submitted` for the same signing attempt, ignore duplicate completion
- return success to provider
- record `DuplicateIgnored`

### Completion For Unknown Envelope

Behavior:

- verify authenticity first
- record delivery as `UnknownCorrelation`
- do not fetch provider documents
- do not mutate claim
- return `202 Accepted` when retrying will not help
- alert/log for support review

For the POC, prefer returning `202 Accepted` after verification for unknown but authentic callbacks to avoid infinite provider retries while preserving diagnostics.

## Account And Envelope Correlation

Callbacks must map to an internal signing attempt before any claim lifecycle transition.

Required signing attempt fields from the future signing-provider spec:

```text
Id
Provider
ProviderAccountId
ProviderEnvelopeId
ClaimId
UserId
SnapshotVersion
SnapshotHash
Status
CreatedAt
CompletedAt
```

Correlation rules:

- provider must match
- provider account ID must match configured account or stored signing attempt
- provider envelope ID must match exactly one internal signing attempt
- signing attempt snapshot hash must match the current claim snapshot hash
- signing attempt claim ID must exist
- signing attempt claim must not already be terminal in an incompatible state

If multiple internal attempts match one provider account/envelope pair, processing must stop with `ConflictRejected`.

If the provider account ID is missing from a provider payload, the provider-specific spec must define whether the configured account ID can be inferred from verification context. The default rule is fail closed.

## Event Replay Handling

Replay means intentionally reprocessing a previously received authentic callback for diagnostics or recovery.

POC rules:

- no public replay API
- no borrower replay control
- replay can be a service method or test-only/internal command
- replay reads from `external_callback_deliveries`
- replay creates a new delivery row with `replay_of_delivery_id`
- replay must not bypass idempotency checks
- replay must not bypass provider correlation checks

Replay is allowed only for deliveries with:

```text
verification_status = Verified
```

Replay is not allowed for:

```text
Rejected
ConflictRejected
```

unless a future support/admin tool explicitly overrides it with a manual audit reason.

## Out-Of-Order Event Handling

Provider events may arrive out of order.

Default rules:

- completion after already completed/stored/submitted is duplicate/ignored
- intermediate status after completion is ignored if it would move lifecycle backward
- failure/voided event after successful stored documents is ignored and audited as out-of-order
- completion before signing attempt is persisted becomes `UnknownCorrelation`
- completion before generated packet metadata exists remains in signing provider handling and must not transition claim directly

No callback may move a claim backward without an explicit application command and audit reason.

## Local Development Strategy

### Default: Fake Callback Path

Default local and CI strategy:

- use fake signing provider
- fake provider invokes application callback handler directly or posts to local callback endpoint
- fake payloads use the same idempotency table
- fake verifier is deterministic and test-controlled
- no public tunnel required

This is the only required automated test path.

### Optional Manual: ngrok/Public Tunnel

Manual DocuSign validation may use a public tunnel such as ngrok.

Rules:

- tunnel URL is configured explicitly for manual runs
- tunnel URL is never committed
- callback endpoint remains the same route
- provider verification remains enabled
- manual checklist records provider headers, event IDs, account IDs, envelope IDs, and duplicate delivery behavior

### Optional Shared Dev Environment

A deployed dev environment can be used later if available.

Rules:

- HTTPS required
- provider webhook secret/config is environment-specific
- test data is isolated from local developer data
- callback logs are accessible for debugging

## API Responses To Providers

Response rules should avoid provider retry storms while preserving fail-closed security.

| Condition | Response |
|---|---|
| invalid signature/authentication | `401` or `403` |
| malformed body before verification possible | `400` |
| authentic duplicate already processed | `200` or `204` |
| authentic unknown correlation | `202` |
| authentic event processed successfully | `200` or `204` |
| authentic retryable internal processing failure | `500` if provider retry is useful |
| authentic terminal internal processing failure | `202` with recorded terminal status if retry will not help |

Provider-specific specs may adjust exact status codes when the provider documents retry behavior.

## Application Flow

```text
External Provider
  -> POST /api/external-callbacks/{provider}
  -> Controller reads raw body and headers
  -> Verifier authenticates provider request
  -> Delivery row persisted
  -> Duplicate/conflict checks run
  -> Verified callback maps to signing attempt
  -> Application command handles event
  -> Claim lifecycle/storage commands run if allowed
  -> Delivery row processing status updated
```

## Security Requirements

- callback routes must not use borrower identity
- callback routes must not accept `X-User-Id`
- callback routes must not trust route claim IDs
- raw body must be hashed and persisted before processing status is final
- invalid verification must fail closed
- verified provider account ID must map to expected account
- provider envelope ID must map to exactly one internal signing attempt
- callbacks must not log raw document bytes or full signed packets
- callback payload logging must be metadata-only or redacted
- duplicate and conflicting duplicate events must be distinguishable

## Observability

Log structured events:

```text
external_callback.received
external_callback.verified
external_callback.rejected
external_callback.duplicate_ignored
external_callback.unknown_correlation
external_callback.processed
external_callback.processing_failed
```

Common fields:

```text
Provider
ProviderAccountId
ProviderEnvelopeId
ProviderEventId
EventType
DeliveryId
RawBodySha256
ProcessingStatus
CorrelationId
```

Do not log:

- raw callback body if it contains PII
- document bytes
- bearer tokens
- provider secrets

## Testing Strategy

### Application Tests

- invalid verification does not dispatch lifecycle command
- valid callback maps to exactly one signing attempt
- valid callback with unknown envelope records `UnknownCorrelation`
- same event ID and same body is ignored as duplicate
- same event ID and different body is rejected as conflict
- completion after `SignedDocumentsStored` is duplicate ignored
- out-of-order intermediate event after completion does not move status backward
- replay of verified delivery passes through idempotency checks

### Persistence Tests

- delivery row persists raw body hash
- unique provider event ID prevents duplicate processing rows
- account/envelope lookup index supports correlation query
- conflict duplicate can be recorded without mutating claim state
- rejected delivery stores failure code and reason

### API Tests

- callback route is reachable without bearer token
- callback route does not set `ICurrentUserService.UserId`
- invalid fake signature returns `401` or `403`
- valid fake callback returns success
- valid duplicate fake callback returns success and does not duplicate state mutation
- unknown authentic fake envelope returns `202`

### Local/CI Tests

- fake provider callback path exercises the same delivery table
- no ngrok or public network is required in CI
- fake verifier can simulate invalid signature, duplicate event, conflict event, unknown envelope, and out-of-order event

## Migration Plan

1. Add `ExternalCallbackDelivery` entity and EF configuration.
2. Add callback delivery migration.
3. Add provider-neutral verifier interfaces and normalized callback models.
4. Add fake verifier for tests/local development.
5. Add callback controller route with `[AllowAnonymous]`.
6. Add delivery persistence and idempotency handling.
7. Add signing-attempt correlation interface expected by future signing provider spec.
8. Add tests for auth bypass, verification failure, idempotency, correlation, and replay.
9. Update DocuSign spec to implement this boundary.

## Impact On DocuSign Spec

This spec resolves these prior DocuSign blockers:

- middleware bypass for provider callbacks
- provider verification boundary
- idempotency table shape
- duplicate/conflicting duplicate behavior
- event replay rules
- account/envelope correlation rules
- local dev strategy using fake callback by default and ngrok only for manual provider validation

This spec does not resolve:

- exact DocuSign HMAC/signature implementation
- DocuSign Connect payload version
- DocuSign envelope creation
- DocuSign document download endpoints
- recipient view URL creation

Those belong in the revised DocuSign + QuestPDF spec.

## Acceptance Criteria

- External callback endpoints are explicitly anonymous to borrower auth.
- Provider verification happens before any claim lifecycle mutation.
- Every callback delivery is persisted with raw body hash and processing status.
- Duplicate deliveries are idempotent.
- Same event ID with different body is rejected as a conflict.
- Provider account/envelope identifiers must correlate to exactly one internal signing attempt.
- Unknown authentic callbacks are recorded without mutating claim state.
- CI can test callbacks with a fake provider and no public tunnel.
- Manual DocuSign validation can use ngrok or a dev environment without changing application code.
