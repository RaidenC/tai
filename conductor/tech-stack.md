# TAI Portal Technology Stack

## API Gateway & Security
- **Gateway Framework:** **YARP (Yet Another Reverse Proxy)** for centralized API management.
- **Centralized Controls:** SSL termination, request sanitization, and IP-based rate limiting (**Token Bucket** algorithm).
- **BFF Implementation:** YARP acts as the primary BFF bridge, securely forwarding `/api/` calls to the correct microservices while managing authentication cookies.
- **DPoP Enforcement:** Early-stage validation of DPoP headers at the gateway before routing to the custom identity service.
- **Gateway Trust:** Shared secret validation between Gateway and API to prevent direct API access and spoofing.

## Backend (Presentation & Application)
- **Framework:** .NET 10 REST API (Minimal APIs / Controllers).
- **Core Pattern:** Strict Clean Architecture (Domain, Application, Infrastructure, Presentation).
- **Identity Service:** Custom-built via **OpenIddict**, adhering to the **FAPI 2.0** security profile.
- **Security Protocols:** DPoP (Demonstrating Proof-of-Possession), Phishing-Resistant Auth via **Passkeys (FIDO2/WebAuthn)**.
- **Persistence:** **PostgreSQL** via EF Core 10 with Global Query Filters for tenant isolation.
- **Multi-Tenancy:** Host-based resolution with high-performance caching and automated `TenantId` injection via EF Core Interceptors.
- **Communication:** **Service Bus** for reliable messaging and **SignalR** for real-time notifications (bridged via BFF).

## Frontend (UI & Design System)
- **Architecture:** Multi-app Angular workspace:
  - **Main Portal (`portal-web`):** The primary shell for Tiles and administrative features.
  - **Secure Login UI (`identity-ui`):** A dedicated application for the OIDC login flow, ensuring maximum isolation for credential entry.
- **Framework:** Angular (Standard Zone-based change detection).
- **Reactivity:** Stable, LTS **Signals** (`signal()`, `computed()`, `input()`) with full RxJS Observable interop (`toSignal`, `toObservable`).
- **Styling:** **Tailwind CSS 4.0** with CSS Variables for dynamic multi-tenant branding.
- **Component Logic:** **Headless Angular CDK** + Tailwind utility classes (Zero Inline Styles).
- **Isolation & Docs:** **Storybook** for isolated component development and verifiable security ledgers.

## Infrastructure & Tooling
- **Monorepo Management:** **Nx** for build orchestration and linting enforcement.
- **CI/CD Pipeline:** **GitHub Actions** using **Nx Affected** for optimized build/test cycles.
- **Security Scanning:** Automated **Gitleaks** integration to prevent credential exposure.
- **Containerization:** **Docker** multi-stage builds for production-grade API and Gateway images.
- **Runtime:** **Standard JIT Compilation** (.NET Core CLR) to ensure maximum ecosystem compatibility; **NativeAOT is strictly prohibited**.
- **Security:** BFF (Backend-for-Frontend) pattern; all tokens managed server-side via Secure, HttpOnly, SameSite=Strict cookies.

## Gateway & Proxy Standards
- **Standard Tokens:** Always use `{Host}` for YARP host transformations (never `{RequestHost}`).
- **Path Awareness:** The API must use `app.UsePathBase("/identity")` to correctly generate internal redirects when proxied.
- **Issuer Consistency:** The OIDC Issuer (`options.SetIssuer`) must point to the Gateway's public URL.
- **Middleware Pipeline:** `app.UseForwardedHeaders()` must be the absolute first middleware; `app.UseCors()` must precede any security/trust checks.
- **Gateway Trust:** Direct API access is blocked via `GatewayTrustMiddleware`; all calls must carry the `X-Gateway-Secret`.

## Quality & Testing Strategy
- **Backend Unit:** xUnit + FluentAssertions (Domain Invariants, Value Objects).
- **Backend Integration:** WebApplicationFactory + Respawn / TestContainers (API & Persistence).
- **Frontend Logic:** Vitest (Services, Signal logic, Reducers).
- **Component Verification:** Storybook Interaction Tests (Play functions) + Axe-core (Accessibility).
- **End-to-End (E2E):** Playwright for critical "Steel Thread" workflows, utilizing Global Auth state and TDM API seeding for setup efficiency.
