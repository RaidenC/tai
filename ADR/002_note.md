# Feature 2.1: OpenIddict Server Configuration

## Overview
**Status:** Implemented
**Context:** Establishing the "Sovereign Identity" provider for the Portal platform.

### Description
We have configured the Portal API to act as its own OpenID Connect (OIDC) Provider using OpenIddict. This allows us to issue and validate tokens without relying on external SaaS providers (like Auth0 or Okta) or heavy enterprise servers (like IdentityServer Duende).

### Technical Specifications
*   **Endpoints:**
    *   Authorization: `/connect/authorize`
    *   Token: `/connect/token`
    *   Discovery: `/.well-known/openid-configuration`
*   **Security Protocols:**
    *   **PKCE (Proof Key for Code Exchange):** Enforced for all clients.
    *   **Flows:** `authorization_code` and `refresh_token` enabled.
    *   **Implicit Flow:** Explicitly disabled.
    *   **Transport Security:** TLS enforced (disabled locally for dev via `DisableTransportSecurityRequirement`).

## Implementation Details
The configuration resides in `Program.cs` using the `AddOpenIddict()` builder.

1.  **Core & EF Core Integration:**
    We configured OpenIddict to use Entity Framework Core to store applications, authorizations, and scopes in the `PortalDbContext`.
2.  **Server Configuration:**
    *   `AllowAuthorizationCodeFlow()`: The standard flow for user authentication.
    *   `RequireProofKeyForCodeExchange()`: Mitigates authorization code interception attacks.
    *   `RegisterScopes(...)`: Defines `openid`, `profile`, `email`, and `roles`.
    *   `AddDevelopmentSigningCertificate()`: Uses ephemeral keys for local development (would be replaced by real certs in prod).

## Why This Matters (Architecture Decisions)

### 1. Sovereign Identity vs. SaaS
By embedding the IdP (Identity Provider) into our API, we maintain full control over user data and the authentication lifecycle. This reduces vendor lock-in and allows for complex, custom authorization logic (like specific tenant rules) that might be hard to script in a SaaS provider.

### 2. Security Best Practices (OAuth 2.1 Alignment)
*   **Killing Implicit Flow:** Historically, SPAs used "Implicit Flow" to get tokens directly in the URL fragment. This is now considered insecure due to access token leakage in browser history and referer headers. We strictly use **Authorization Code Flow with PKCE**, which keeps tokens out of the URL.
*   **PKCE (Pixy):** Since our Angular app is a "Public Client" (it can't safely hide a client secret), PKCE provides a cryptographic check to ensure the entity requesting the code is the same one exchanging it for a token.

## Interview Talking Points

**Q: Why did you choose OpenIddict over IdentityServer?**
*   **A:** IdentityServer (Duende) shifted to a commercial license that can be cost-prohibitive or complex for certain internal use cases. OpenIddict offers a permissive license, is lightweight, and integrates natively with ASP.NET Core's dependency injection and EF Core, making it ideal for a "Sovereign Identity" implementation where we want full code ownership.

**Q: Why is Implicit Flow disabled?**
*   **A:** Implicit flow returns access tokens in the browser URL, which is a security risk (logging, history, referrer leakage). Modern best practices (OAuth 2.1) mandate using the Authorization Code flow with PKCE for SPAs. This keeps the token exchange on the back channel (mostly) or at least prevents the token from appearing in the URL.

**Q: What is the role of the Discovery Document?**
*   **A:** The `/.well-known/openid-configuration` endpoint allows clients (like our Angular app) to dynamically discover the issuer URL, key endpoints, and supported scopes. This decouples the client from hardcoded URLs; if we change an endpoint path, the client updates automatically upon restart.

**Q: How does PKCE work in this context?**
*   **A:**
    1.  **Client:** Generates a random secret (`code_verifier`), hashes it (`code_challenge`), and sends the hash with the authorization request.
    2.  **Server:** Stores the hash and issues an authorization code.
    3.  **Client:** Sends the code *and* the original secret (`code_verifier`) to the token endpoint.
    4.  **Server:** Hashes the secret received and compares it to the stored hash. If they match, it issues the token.
    *   *Why?* If an attacker stole the authorization code in step 2, they wouldn't have the original secret to complete step 3.

    ```mermaid
    sequenceDiagram
        autonumber
        participant User
        participant Client as Angular App (Public Client)
        participant Server as Portal API (OpenIddict)

        Note over Client: 1. Generates random "code_verifier"<br/>and hashes it to create "code_challenge"

        Client->>Server: GET /connect/authorize<br/>(client_id, scope, code_challenge)
        
        Note over Server: Stores "code_challenge"<br/>Validates Client ID

        Server->>User: Redirect to Login Page
        User->>Server: Enters Credentials
        
        Server->>Client: Redirects with Authorization Code
        
        Note over Client: 2. Prepares Token Request<br/>Includes original "code_verifier"

        Client->>Server: POST /connect/token<br/>(code, code_verifier)

        Note over Server: 3. Hashes the received "code_verifier"<br/>Compares result with stored "code_challenge"

        alt Hashes Match
            Server->>Client: 200 OK (Access Token + Refresh Token)
        else Hash Mismatch
            Server->>Client: 400 Bad Request (invalid_grant)
        end
    ```

# Feature 2.2: OIDC Client Registration (The Portal)
*   **Description:** Register the Angular frontend as a trusted "Public Client" within the IdP.
*   **Technical Detail:** Since the SPA cannot keep secrets, we register it without a client secret but mandate PKCE. The configuration must define strict Redirect URIs to prevent open redirect vulnerabilities.
*   **Acceptance Criteria:**
    *   A Client entity with ClientId `portal-web` is seeded in the database.
    *   Allowed Scopes include `openid`, `profile`, `email`, and `roles`.
    *   Redirect URIs match the localhost and production URLs exactly.

# Feature 2.3: Angular OIDC Service (RxJS-Based)
*   **Description:** Implement the client-side logic to handle the OIDC handshake.
*   **Technical Detail:** We will use the proven RxJS Observable pattern. `authService.user$` will return a stream of the current user profile, and `authService.isAuthenticated$` will be an Observable derived from the user state.
*   **Acceptance Criteria:**
    *   Calling `login()` redirects the browser to the Identity API.
    *   After redirect, the service exchanges the authorization code for an access token.
    *   The user Observable emits a new value, triggering UI changes via the AsyncPipe.

# Verification Strategy
1.  **API:** `/.well-known/openid-configuration` shows `S256` and no `implicit` flow.
2.  **DB:** `portal-web` exists with correct Redirect URIs.
3.  **UI:** Login redirects, exchanges code for token, and updates the UI via AsyncPipe.