# Masterclass: User Onboarding & Identity Management - Phase 4 (API Endpoints)

## The Enterprise Challenge
Exposing sensitive backend domain logic (like user registration and approval workflows) to the frontend introduces significant risk. In a multi-tenant Fintech environment, an unmitigated API endpoint can lead to Cross-Tenant Data Leakage (BOLA/IDOR), unauthorized privilege escalation, or spam registration attacks. The challenge was to expose these onboarding capabilities securely, enforcing rigorous authentication protocols (like DPoP) and routing requests seamlessly via a Zero-Trust Gateway, while preserving Clean Architecture invariants.

## Knowledge Hierarchy

### Junior Level (The "What")
- **Controllers & MediatR:** We built an `OnboardingController` that receives standard HTTP requests (POST for registration/approvals, GET for pending lists) and delegates the actual business logic to MediatR via `ISender`. This keeps the API thin and focused solely on HTTP concerns.
- **`[AllowAnonymous]` vs `[Authorize]`:** We allowed anyone to hit the registration endpoint because guests need to be able to sign up. Conversely, fetching pending approvals or submitting an approval requires the caller to be fully authenticated.
- **YARP Reverse Proxy:** The Gateway was updated to route `/api/*` requests to the backend API cluster. This ensures all traffic must go through the frontend gateway, which acts as the system's strict entry door.

### Mid Level (The "How")
- **Integration Testing with WebApplicationFactory:** We used `WebApplicationFactory` to spin up an in-memory test server mimicking the production API pipeline. We specifically bypassed authentication middlewares during some tests to focus purely on the endpoint-to-MediatR wiring, ensuring the controllers mapped routes and payloads correctly.
- **Gateway Trust Handshake:** The Gateway dynamically injects an `X-Gateway-Secret` header to outgoing requests. The Backend API verifies this header before accepting any traffic. This "Caller ID" mechanism ensures attackers cannot bypass the Gateway and hit the internal API port directly.
- **LINQ Translation Constraints in EF Core 10:** While retrieving pending approvals, we discovered that referencing `TenantId.Value` directly in a LINQ predicate failed translation. We fixed this by comparing the strongly-typed `TenantId` objects directly, relying on EF Core's value converters to translate it down to the SQL level properly.

### Senior/Principal Level (The "Why")
- **DPoP (Demonstrating Proof-of-Possession):** By requiring authorization via the OpenIddict validation scheme, we automatically enforce DPoP constraints. A standard bearer token is easily stolen (e.g., XSS), but a DPoP-bound token is cryptographically tied to the client's private key. If the token leaks, it cannot be replayed by an attacker from a different origin.
- **Strict Boundary Enforcement:** By injecting `IMediator` directly into the controllers, the presentation layer (API) has zero knowledge of the persistence mechanisms (EF Core) or identity providers (ASP.NET Core Identity). The API only knows about Data Transfer Objects (DTOs) and CQRS Commands/Queries.
- **Multi-Tenant Isolation at the Edge:** While the Gateway routes the traffic, it also sets up context headers (e.g., `X-Tenant-Host`). These headers allow the API's middleware to resolve the `TenantId` early in the pipeline, enforcing Global Query Filters universally and mitigating the risk of cross-tenant exposure in subsequent database queries.

## Deep-Dive Mechanics
When a user hits the Registration endpoint:
1. **Gateway Ingress:** The request hits YARP at port `5217`. The Gateway applies Rate Limiting, attaches `X-Forwarded-*` headers, injects `X-Gateway-Secret`, and proxies the payload to the Backend API (port `5031`).
2. **Middleware Pipeline:** The API receives the request. The `GatewayTrustMiddleware` validates the secret. The `TenantResolutionMiddleware` looks at the host header and sets the database's Global Query Filter context.
3. **Controller to MediatR:** The `OnboardingController` accepts the payload, maps it to a `RegisterCustomerCommand`, and sends it to MediatR.
4. **Command Execution:** The Handler validates the request, orchestrates the Domain entity (`ApplicationUser`), and persists it via `IdentityService`. If any constraints are violated (e.g., password complexity), an exception is thrown, caught by the global error handler, and standardized into a Problem Details response.

## Interview Talking Points (Tiered)

### Junior/Mid Responses
- **Clean API Design:** "I ensure APIs are thin. By using MediatR, my controllers are rarely more than 3-4 lines of code. It makes unit and integration testing significantly easier."
- **Troubleshooting EF Core:** "When EF Core fails to translate a LINQ query, it's usually because it encounters a custom type or property it can't map to SQL. Relying on properly configured value converters solves this."

### Senior/Lead Responses
- **Zero-Trust Implementation:** "I never expose internal API ports to the public internet. All traffic must ingress through a reverse proxy (like YARP) that handles rate limiting, TLS termination, and injects a cryptographic handshake (like `X-Gateway-Secret`) so the backend knows the traffic is trusted."
- **DPoP vs Bearer Tokens:** "In high-security Fintech environments, Bearer tokens are insufficient because they are vulnerable to theft and replay. DPoP ensures the token is bound to the client's specific private key, heavily neutralizing the impact of an access token leak."

## March 2026 Market Context
The industry standard has completely shifted away from implicit trust architectures. The combination of **YARP for dynamic reverse proxying**, **MediatR for strict CQRS boundary enforcement**, and **OpenIddict for automated DPoP support** represents the "Gold Standard" for .NET 10 Enterprise backends. This pattern guarantees scalability without compromising on the Zero-Trust security models demanded by modern regulatory frameworks (SOC 2, PCI-DSS).