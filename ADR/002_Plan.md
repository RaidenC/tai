### Day 2: The Identity Provider (OpenIddict) Setup
**Strategic Context:**
For a platform like Portal, relying on a generic auth service is a risk. We need a "Sovereign Identity" model where the platform controls the issuance of tokens. We will use OpenIddict, a framework for building custom OpenID Connect servers in .NET. It is preferred over IdentityServer for this POC due to its permissive licensing and native integration with the ASP.NET Core ecosystem.

**Feature 2.1: OpenIddict Server Configuration**
*   **Description:** Configure the API to act as an OIDC Provider. This involves setting up the endpoints (`/connect/token`, `/connect/authorize`) and the token signing cryptography.
*   **Technical Detail:** We must enforce PKCE (Proof Key for Code Exchange) for all interactions. The server must be configured to use reference tokens or encrypted JWTs (JWE) to protect sensitive claim data.
*   **Acceptance Criteria:**
    *   The OpenID Configuration endpoint (`/.well-known/openid-configuration`) returns a valid JSON document.
    *   The server supports `authorization_code` and `refresh_token` flows.
    *   Implicit flow is explicitly disabled (security best practice).

**Feature 2.2: OIDC Client Registration (The Portal)**
*   **Description:** Register the Angular frontend as a trusted "Public Client" within the IdP.
*   **Technical Detail:** Since the SPA cannot keep secrets, we register it without a client secret but mandate PKCE. The configuration must define strict Redirect URIs to prevent open redirect vulnerabilities.
*   **Acceptance Criteria:**
    *   A Client entity with ClientId `portal-web` is seeded in the database.
    *   Allowed Scopes include `openid`, `profile`, `email`, and `roles`.
    *   Redirect URIs match the localhost and production URLs exactly.

**Feature 2.3: Angular OIDC Service (RxJS-Based)**
*   **Description:** Implement the client-side logic to handle the OIDC handshake.
*   **Technical Detail:** We will use the proven RxJS Observable pattern. `authService.user$` will return a stream of the current user profile, and `authService.isAuthenticated$` will be an Observable derived from the user state.
*   **Acceptance Criteria:**
    *   Calling `login()` redirects the browser to the Identity API.
    *   After redirect, the service exchanges the authorization code for an access token.
    *   The user Observable emits a new value, triggering UI changes via the AsyncPipe.

> **Gemini Code Assist Prompt (Day 2):**
>
> **Persona:** Senior Security Engineer.
> **Context:** Configuring an OpenID Connect Provider (OpenIddict) on .NET 10 for a high-security financial platform (TAI Portal).
> **Task:** Implement the OpenIddict configuration and Angular Client integration.
> **Constraints:**
> *   **Security:** Enforce PKCE (Proof Key for Code Exchange) for all public clients.
> *   **Security:** Disable Implicit Flow (allow only Authorization Code Flow).
> *   **Tech:** Use RxJS BehaviorSubjects for the AuthService state (e.g., `public user$ = new BehaviorSubject<User | null>(null)`).
>
> **Coding Instructions:**
> 1.  Generate the `Program.cs` service registration code for OpenIddict in ASP.NET Core 10.
> 2.  Ensure it uses Entity Framework Core stores and registers a 'Client' entity for the Angular SPA with `Requirements.Features.ProofKeyForCodeExchange`.
> 3.  Create a dedicated encryption and signing certificate setup using `System.Security.Cryptography`.
> 4.  Write the Angular `AuthService`. Use `BehaviorSubject` to hold state and expose `isAuthenticated$` as an Observable. Show how to interface this service with the `angular-auth-oidc-client` library.