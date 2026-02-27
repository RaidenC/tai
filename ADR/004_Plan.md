### Day 4: API Security Gateway (YARP & DPoP)
**Strategic Context:**
In a microservices architecture like Portal (Collections, Payments, LPI), the API Gateway is the sentry. We will use YARP (Yet Another Reverse Proxy). Furthermore, to prevent token theft, we will implement DPoP (Demonstrating Proof-of-Possession). Standard Bearer tokens are like cash—anyone holding them can spend them. DPoP tokens are like checks—they are bound to the specific private key of the client, making stolen tokens useless.

**Feature 4.1: YARP Configuration for Identity**
*   **Description:** Configure YARP to route traffic to the Identity API.
*   **Technical Detail:** YARP will handle SSL termination and request sanitation.
*   **Acceptance Criteria:**
    *   Requests to `api.portal.com/identity/*` are routed to the Identity Service.
    *   YARP adds `X-Forwarded-For` headers correctly.

**Feature 4.2: Rate Limiting Middleware**
*   **Description:** Protect the login endpoints from brute-force attacks.
*   **Technical Detail:** Use .NET 10's `System.Threading.RateLimiting`. We will implement a "Token Bucket" algorithm for the `/connect/token` endpoint.
*   **Acceptance Criteria:**
    *   Limit: 10 requests per minute per IP address.
    *   Exceeding the limit returns HTTP 429 "Too Many Requests".

**Feature 4.3: DPoP Enforcement**
*   **Description:** Bind access tokens to the client's session.
*   **Technical Detail:** Configure OpenIddict to require DPoP headers. On the Angular side, implement an `HttpInterceptor` that generates a unique DPoP proof (signed JWT) for every API call.
*   **Acceptance Criteria:**
    *   API returns 401 Unauthorized if a Bearer token is sent without a DPoP header.
    *   Angular interceptor calculates the correct `htm` (method) and `htu` (url) claims for the DPoP proof.

> **Gemini Deep Search Prompt (Day 4):**
>
> **Persona:** Security Architect.
> **Context:** Hardening the API surface for the Portal POC against token theft and brute force.
> **Task:** Implement Rate Limiting and DPoP support in .NET 10.
> **Constraints:**
> *   Use the `Microsoft.AspNetCore.RateLimiting` namespace.
> *   For DPoP, ensure compatibility with the OpenIddict validation handler.
>
> **Research & Coding Prompt:**
> "Provide a code snippet for `Program.cs` in .NET 10 that configures a 'TokenBucket' rate limiter specifically for the `/connect/token` endpoint.
> Then, explain how to enable DPoP enforcement in OpenIddict server options (`options.EnableDegradedMode().RequireProofKeyForCodeExchange()`).
> Finally, generate an Angular 21 `HttpInterceptorFn` (functional interceptor) that generates a DPoP proof JWT for every outgoing API request. It must dynamically calculate the `htm` and `htu` claims and sign the proof using a session-specific `CryptoKey` (Web Crypto API)."