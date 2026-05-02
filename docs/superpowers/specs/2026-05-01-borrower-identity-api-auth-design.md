# Design: Borrower Identity + API Auth

## Problem

Borrower Portal sign-in gives the frontend a real Portal Identity user and OIDC claims, but `borrower-portal-api` still trusts a development-only `X-User-Id` header. That header is currently installed globally by `XUserIdMiddleware`, so every API request must provide it before controllers run.

That blocks a defensible DocuSign signing flow for two reasons:

1. User-facing claim APIs need to authorize by the signed-in borrower, not a caller-controlled header.
2. External callbacks such as DocuSign Connect webhooks cannot and should not authenticate as a borrower.

The system needs a clear borrower identity boundary before claim snapshots, signing sessions, signed-document downloads, or webhook processing are implemented.

## Decision

Replace borrower API `X-User-Id` authentication with OpenIddict bearer-token validation for borrower-owned API routes.

Keep `ICurrentUserService` as the application-layer identity abstraction, but change its source from middleware-injected stub claims to validated OIDC bearer claims. Borrower Portal frontend calls should rely on the OIDC access token attached by `angular-auth-oidc-client`, not custom identity headers.

External provider callbacks must not pass through borrower authentication. Webhook endpoints should use a separate explicit trust boundary: route-level anonymous access plus provider-specific request verification inside the webhook controller/handler.

## Goals

- Borrower API requests use validated Portal Identity access tokens.
- `ICurrentUserService.UserId` resolves from the validated token subject/name identifier.
- Borrower-owned endpoints require authorization by default.
- Frontend draft API calls stop sending `X-User-Id`.
- The legacy header middleware is removed from the normal request path.
- Webhook endpoints can accept provider callbacks without borrower auth.
- Provider callbacks remain fail-closed through explicit signature/authenticity verification.
- Tests cover missing token, valid token, ownership identity propagation, and webhook route accessibility.

## Non-Goals

- Implementing DocuSign webhook verification.
- Implementing claim snapshots or submitted claim aggregates.
- Implementing signed document storage.
- Defining final claim submission statuses.
- Building a production identity deployment model.
- Supporting multiple identity providers.
- Adding borrower self-registration.

## Existing Context

### Borrower Portal Frontend

Current draft API client:

```text
apps/borrower-portal/src/app/claim/services/claim-draft.service.ts
```

It hardcodes:

```typescript
const POC_USER_ID = 'borrower-poc-user';
const POC_CLAIM_ID = 'current';
private headers = new HttpHeaders({ 'X-User-Id': POC_USER_ID });
```

After sign-in integration, Borrower Portal should already have `provideAuth(...)` and `authInterceptor()` configured similarly to `apps/docviewer-mock` / `apps/portal-web`.

### Borrower Portal API

Current API host:

```text
apps/borrower-portal-api/
```

Important files:

- `Program.cs`
- `Middleware/XUserIdMiddleware.cs`
- `Controllers/DraftController.cs`

`Program.cs` currently installs:

```csharp
app.UseMiddleware<XUserIdMiddleware>();
```

`DraftController` reads identity through:

```csharp
ICurrentUserService.UserId
```

### Shared Identity Abstraction

`ICurrentUserService` lives in:

```text
libs/core/application/Interfaces/ICurrentUserService.cs
```

Current implementation:

```text
libs/core/infrastructure/Services/CurrentUserService.cs
```

It reads:

```csharp
ClaimTypes.NameIdentifier
```

This is the right seam to keep.

### Main Portal API Pattern

`apps/portal-api/Program.cs` already configures OpenIddict validation:

```csharp
builder.Services.AddOpenIddict()
  .AddValidation(options => {
    options.UseLocalServer();
    options.UseAspNetCore();
  });

builder.Services.AddAuthentication(options => {
  options.DefaultScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
});

builder.Services.AddAuthorization();
...
app.UseAuthentication();
app.UseAuthorization();
```

Borrower API should use the same validation pattern where practical.

## Architecture

### Request Categories

Borrower API routes split into two categories:

| Category | Examples | Authentication | Authorization source |
|---|---|---|---|
| Borrower-owned API | draft save/load/delete, future signing session, future signed document download | OpenIddict bearer token | `ICurrentUserService.UserId` from validated token |
| External callbacks | future `/api/webhooks/docusign` | anonymous ASP.NET route access | provider-specific verifier, not borrower identity |

### Middleware Order

Borrower API should use this order:

```csharp
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

`XUserIdMiddleware` should not be installed in the normal pipeline.

For a short migration window, the class can remain in the codebase unused, marked as obsolete, or deleted once tests prove bearer auth covers current draft endpoints. The preferred outcome is deletion after the migration is complete.

### Controller Authorization

Borrower-owned controllers should opt into authorization explicitly:

```csharp
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
```

or, if the borrower API only exposes protected borrower endpoints except webhooks, the API can use a fallback authorization policy and mark webhooks with `[AllowAnonymous]`.

Preferred POC choice: explicit `[Authorize]` on borrower-owned controllers. This keeps webhook exceptions visible and avoids accidentally protecting future callback endpoints with borrower auth.

### Current User Resolution

`CurrentUserService` should continue to resolve:

```csharp
ClaimTypes.NameIdentifier
```

If OpenIddict emits `sub` but not `ClaimTypes.NameIdentifier` in borrower API validation, the auth setup must map the subject into a name identifier claim or `CurrentUserService` must check both:

```csharp
ClaimTypes.NameIdentifier
OpenIddictConstants.Claims.Subject
JwtRegisteredClaimNames.Sub
```

Preferred choice: update `CurrentUserService` to support both `ClaimTypes.NameIdentifier` and `sub`, because downstream application code should not care which token handler produced the claim type.

## API Behavior

### Borrower-Owned Endpoints

Example:

```http
PATCH /api/claims/draft
Authorization: Bearer <access-token>
```

Rules:

- Missing token returns `401`.
- Invalid token returns `401`.
- Valid token allows controller execution.
- `ICurrentUserService.UserId` is required.
- Controllers must not accept `userId` in request bodies.
- Controllers must not read `X-User-Id`.
- Application commands continue receiving `userId` from `ICurrentUserService`.

### External Webhook Endpoints

Future DocuSign endpoint:

```http
POST /api/webhooks/docusign
```

Rules:

- Route is marked `[AllowAnonymous]`.
- Route does not use `ICurrentUserService.UserId`.
- Route does not require a bearer token.
- Route must verify DocuSign authenticity before state mutation.
- Invalid provider verification returns `401` or `403`.
- Valid provider verification still must map provider identifiers, such as account ID and envelope ID, to an internal record before state mutation.

This spec only defines the auth boundary. The exact DocuSign HMAC/signature verification belongs in the later Webhook + External Callback spec.

## Frontend Behavior

Borrower Portal HTTP calls should no longer set `X-User-Id`.

Current draft service should change from:

```typescript
private headers = new HttpHeaders({ 'X-User-Id': POC_USER_ID });
```

to relying on `authInterceptor()`:

```typescript
this.http.patch<void>(
  `${environment.apiBaseUrl}/claims/draft`,
  { claimId: POC_CLAIM_ID, encryptedPayload, ttlHours: 24 },
  { withCredentials: true }
);
```

Notes:

- `POC_CLAIM_ID = 'current'` may remain until the Claim Record / Snapshot spec replaces it.
- `withCredentials` can remain if required by the current local OIDC/CORS setup, but identity should come from the bearer token, not cookies or custom headers.
- The app-level sign-in gate should prevent normal wizard use before authentication, but the API must still enforce bearer auth independently.

## Configuration

Borrower API needs OpenIddict validation configuration compatible with Portal Identity.

For local monolith-style development, reuse local server validation if the borrower API can access the same OpenIddict server configuration.

If borrower API is a separate process that cannot use `UseLocalServer()`, configure validation with issuer/audience metadata:

```text
Authentication:Authority = http://localhost:5217
Authentication:RequireHttpsMetadata = false for local development only
```

The implementation plan must verify which option fits the current solution topology before coding. The design target is stable either way: borrower API validates Portal Identity access tokens and does not trust request headers for user identity.

## Security Requirements

- `X-User-Id` must not be accepted as an authentication mechanism in normal borrower API routes.
- Missing/invalid bearer token must fail closed.
- User ID must come from a validated token claim.
- Borrower-owned resource access must use current user identity for all lookups.
- CORS must not be treated as authentication.
- Webhook endpoints must not inherit borrower identity from any request header.
- Webhook endpoints must not mutate state before provider-specific authenticity verification.
- Logs must not include full access tokens.
- Auth failures should log metadata only: route, status, correlation ID, and failure category.

## Testing Strategy

### Backend Unit/Integration Tests

Add borrower API auth tests covering:

- `PATCH /api/claims/draft` without bearer token returns `401`.
- `GET /api/claims/draft/current` without bearer token returns `401`.
- Valid bearer token reaches `DraftController`.
- `ICurrentUserService.UserId` resolves from token subject.
- Drafts are saved under token user ID, not request body/header user ID.
- Supplying `X-User-Id` without bearer token does not authenticate.
- Supplying `X-User-Id` with bearer token does not override token subject.
- A webhook-style anonymous route can be reached without borrower bearer auth and still performs its own verifier check before returning success.

### Frontend Tests

Update borrower portal tests covering:

- Draft save/load requests no longer include `X-User-Id`.
- Requests still target `environment.apiBaseUrl`.
- Sign-in gate remains responsible for hiding the wizard before auth.
- API auth behavior is not assumed by frontend-only tests.

### Manual Verification

1. Start Portal Identity / gateway.
2. Start Borrower Portal API.
3. Start Borrower Portal.
4. Sign in through Borrower Portal.
5. Save a draft.
6. Confirm the request contains `Authorization: Bearer ...`.
7. Confirm the request does not contain `X-User-Id`.
8. Confirm the draft round-trips for the signed-in user.
9. Confirm the same draft endpoint returns `401` when called without token.

## Migration Steps

1. Add borrower API authentication/authorization services.
2. Add `[Authorize]` to borrower-owned controllers.
3. Update `CurrentUserService` fallback claim resolution if needed.
4. Remove `app.UseMiddleware<XUserIdMiddleware>()` from the borrower API pipeline.
5. Remove hardcoded `X-User-Id` headers from Borrower Portal frontend services.
6. Add backend tests proving headers no longer authenticate.
7. Add frontend tests proving headers are no longer sent.
8. Delete `XUserIdMiddleware` if no tests or local tools still depend on it.

## Impact On DocuSign Spec

This spec resolves these prior panel findings:

- Borrower-facing APIs can use a real authenticated user.
- `ICurrentUserService` has a defensible source.
- Future signing-session creation can bind recipient identity to the current borrower.
- Future signed-document download can enforce borrower ownership.
- Future DocuSign webhook routes are no longer blocked by borrower-only middleware.

This spec does not resolve:

- authoritative claim snapshot source
- stable pre-signing claim ID
- document storage
- signing lifecycle/status model
- DocuSign webhook verification details
- local DocuSign Connect reachability
- idempotency/event storage

## Open Questions For Later Specs

These are intentionally deferred:

1. Should a signed-in borrower map to an existing customer/loan/claim domain record before drafting?
2. What server-side claim record should replace draft ID `current`?
3. Should borrower API use the same process-local OpenIddict validation as `portal-api`, or remote issuer validation against the gateway?
4. Should webhook signature verification be implemented as MVC filters, endpoint filters, or application-layer verifier services?

## Acceptance Criteria

- Borrower Portal can save/load drafts only after sign-in.
- Borrower API rejects missing or invalid bearer tokens on borrower-owned endpoints.
- `X-User-Id` no longer authenticates borrower API requests.
- `ICurrentUserService.UserId` returns the signed-in borrower subject.
- Webhook endpoints have a documented non-borrower auth path using `[AllowAnonymous]` plus provider verification.
- The design leaves a clean boundary for the next spec: Claim Record / Snapshot.
