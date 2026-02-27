# Architectural Blueprint and Execution Strategy: Recreating the TAI Portal Identity Ecosystem

## Executive Summary
The modernization of financial risk management platforms represents one of the most significant engineering challenges in the current software landscape. Platforms like TAI Portal are not merely administrative dashboards; they are critical infrastructure components that manage the intersection of lending, insurance tracking, payments, and asset recovery for thousands of financial institutions. As we approach the regulatory and technological milestones of 2026, recreating such a platform requires a fundamental shift in how we architect identity. The traditional perimeter-based security model is obsolete. In its place, we must construct a distributed, identity-centric architecture where trust is never implicit, and verification is continuous.

This report outlines a comprehensive, fourteen-day execution plan to build a Proof of Concept (POC) for the identity core of the TAI Portal system. This POC is designed to be the "steel thread"—a vertical slice of functionality that proves the viability of the architecture before broader development begins. The focus is strictly on the Essential Features of Single Sign-On (SSO) and Identity Management, as these form the immutable bedrock upon which all other modules—Collections, Payments, and Asset Recovery—must rest.

The proposed architecture leverages the modern, enterprise-focused capabilities of the Microsoft and Google technology stacks: .NET 10 and Angular 21. This choice is strategic.
*   **.NET 10’s** focus on performance and cloud-native capabilities aligns perfectly with the high-throughput, low-latency demands of financial transaction processing.
*   On the frontend, **Angular's** mature, enterprise-grade architecture using **RxJS** and **Zone.js** ensures maximum compatibility, stability, and developer velocity for complex financial dashboards.

Furthermore, this plan places a heavy emphasis on Component-Driven Development (CDD) using Storybook. In a financial context governed by PCI DSS and SOC 2 standards, the User Interface (UI) cannot be an afterthought. Security vulnerabilities often lurk in the frontend—in the form of Cross-Site Scripting (XSS) flaws in input fields or improper state management in authentication forms. By mandating that all identity-related components be built and tested in isolation via Storybook, we establish a "Secure Component Supply Chain" that ensures every input, button, and dialog is hardened against attack and compliant with the European Accessibility Act (EAA) 2025 before it is ever integrated into the main application.

The following sections detail the architectural vision, the regulatory landscape, and a day-by-day execution guide. Each day’s plan includes detailed feature specifications, acceptance criteria, and Context-Optimized Prompts designed for AI coding assistants. These prompts follow the PCTC (Persona-Context-Task-Constraint) framework, ensuring that AI agents generate code that adheres to our strict architectural standards.

## 1. Architectural Vision and Technology Stack

### 1.1 The Identity-Centric Security Model
The TAI Portal platform serves a diverse ecosystem of stakeholders: financial institution staff, third-party collections agents, and borrowers. A monolithic identity approach is insufficient for this complexity. Instead, we propose a Federated Identity Architecture based on OpenID Connect (OIDC) and OAuth 2.1.

In this model, the "Portal Identity Provider" (IdP) acts as the central authority. It does not merely authenticate users; it mints cryptographically signed tokens (Identity Tokens and Access Tokens) that carry the "truth" of a user's identity and permissions across the distributed system. This decoupling allows the Collections Module to trust a user without needing access to their password credentials, and enables the Payment Processing module to verify authorization scopes (e.g., `payment.write` vs. `payment.read`) independently.

We will adopt the Financial-grade API (FAPI) 2.0 security profile. This standard, developed by the OpenID Foundation, mandates rigorous security controls such as Mutual TLS (mTLS) or Demonstrating Proof-of-Possession (DPoP) for token usage, preventing the catastrophic "replay attacks" that plague lesser systems.

### 1.2 Backend Strategy: .NET 10 (LTS)
The backend core will be built on .NET 10, scheduled for Long Term Support (LTS) release in November 2025. This platform offers specific advantages for a financial POC:
*   **C# 14 & Data Integrity:** The POC will utilize C# 14 features to create immutable "Value Objects" for domain concepts like `UserId`, `TenantId`, and `MonetaryAmount`. This strictly enforces domain invariants at the compiler level, preventing "primitive obsession" bugs where a generic string might be mistaken for a secure identifier.
*   **ASP.NET Core Identity with Passkeys:** A critical requirement is modernization. .NET 10 includes native support for FIDO2/WebAuthn Passkeys. This allows us to implement phishing-resistant, passwordless authentication from day one, significantly enhancing the security posture compared to legacy password-based flows.

### 1.3 Frontend Strategy: Angular (Stable)
The frontend will be constructed using the latest stable release of Angular, prioritizing proven patterns over experimental features.
*   **Zone.js Change Detection:** We will utilize the standard Zone.js change detection mechanism. This ensures 100% compatibility with all third-party libraries, simplifies debugging, and provides the stability required for a financial system of record.
*   **Reactive Forms:** The POC will utilize the industry-standard `ReactiveFormsModule`. This mature API provides robust, stream-based handling of form state, validation, and value changes via RxJS, which is essential for complex, data-heavy financial input screens.
*   **Angular CDK (Component Dev Kit):** To meet strict accessibility requirements, we will use the Angular CDK. These primitives provide the functional behavior of complex components (like Comboboxes or Menus) with full A11y compliance, allowing us to build a UI that is 100% compliant with WCAG 2.1 AA standards while retaining complete freedom to implement TAI’s specific branding.

### 1.4 The "Secure Component Lab": Storybook 8+
In this architecture, Storybook is not just a documentation tool; it is a security sandbox. Developing identity components (Login Screens, MFA inputs, Consent Dialogs) within the main application carries risks: business logic bleeds into UI code, and edge cases (like network errors during auth) are hard to reproduce.

By isolating development in Storybook, we enforce:
*   **Pure Components:** UI components must be "dumb," receiving data via `@Input()` and emitting events via `@Output()`. They cannot inject global services, making them easier to test and harder to break.
*   **Automated Accessibility Audits:** The `storybook-addon-a11y` will run automated Axe scans on every component state, ensuring compliance before code review.
*   **Interaction Testing:** We will use Storybook’s `play` functions to script user interactions (typing, clicking) and assert DOM states, effectively unit-testing the UI behavior without a browser driver.

## 2. Phase 1: The Secure Foundation (Week 1)
The primary objective of the first week is to establish the "Steel Thread"—a fully functional, secure path from the frontend user interface, through the API gateway, to the database, and back. This proves the integration of the stack components and establishes the security baseline.

### Day 1: Project Scaffolding & Secure Monorepo Initialization
**Strategic Context:**
The foundation of a distributed system dictates its long-term maintainability. We will use an Nx Monorepo structure. Nx provides the sophisticated dependency graph analysis required to manage both the .NET backend and Angular frontend in a single repository, ensuring that shared contracts (like API DTOs) remain synchronized.

**Feature 1.1: Nx Workspace with Strict Boundaries**
*   **Description:** Initialize the workspace with strict module boundaries. The architecture will separate `libs/identity/ui` (Dumb Components), `libs/identity/feature` (Smart Components/Pages), `libs/identity/domain` (Business Logic), and `libs/identity/data-access` (API Clients).
*   **Technical Detail:** The Angular application will use standard configuration with SCSS and ESLint. The .NET API will use standard configuration.
*   **Acceptance Criteria:**
    *   `nx serve portal-portal` launches the Angular app with `zone.js` enabled.
    *   `nx serve identity-api` launches the .NET 10 Web API.
    *   A generic `Refining_Prompts.md` file is created in the root to guide future AI interactions.

**Feature 1.2: Storybook 8+ Integration**
*   **Description:** Configure the component development environment. This requires standard configuration for Angular's build system.
*   **Technical Detail:** We will use the standard `@storybook/angular` builder. The accessibility addon must be active by default.
*   **Acceptance Criteria:**
    *   Storybook runs on port 6006.
    *   A "Hello World" component using standard `@Input()` decorators renders correctly in Storybook.
    *   The "Accessibility" panel in Storybook is visible and shows zero violations for the default component.

**Feature 1.3: C# 14 Domain Modeling (Identity Kernel)**
*   **Description:** Define the core entities that represent the identity domain. This is not just a database schema; it is the behavioral model of the user.
*   **Technical Detail:** We will use C# 14's enhanced record types to implement concise, encapsulated properties. The `ApplicationUser` entity will inherit from `IdentityUser` but will be extended with multi-tenancy support (`TenantId`).
*   **Acceptance Criteria:**
    *   `ApplicationUser` class is defined with a strongly-typed `TenantId` (Value Object).
    *   `Tenant` entity is defined with configuration properties for SSO settings (e.g., `EnforceMfa`).
    *   EF Core 10 `DbContext` is configured with these entities.

> **Gemini Deep Search Prompt (Day 1):**
>
> **Persona:** Principal Software Architect specializing in .NET 10 and Angular 21.
> **Context:** You are initializing a greenfield "TAI Portal" POC. The system requires strict Clean Architecture constraints to support a distributed financial platform.
> **Task:** Scaffolding the Nx Monorepo and Core Domain.
> **Constraints:**
> *   **Angular:** Use standard Angular with Zone.js enabled for stability.
> *   **Backend:** Use .NET 10. Avoid reflection-heavy libraries.
> *   **Language:** Use C# 14 syntax for domain entities.
> *   **Architecture:** Strictly separate Domain, Infrastructure, and API layers.
>
> **Step-by-Step Instructions:**
> 1.  Generate an `nx` workspace configuration command that creates a .NET 10 API project and a standard Angular application.
> 2.  Provide the content for `.storybook/main.ts` using the standard `@storybook/angular` builder.
> 3.  Draft the C# 14 code for the `ApplicationUser` entity. It must inherit from `IdentityUser`. Include a `TenantId` property.
> 4.  Create a `GEMINI.md` file structure that maps these directories for future context retrieval.

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

### Day 3: Authentication UI & Custom Security Components
**Strategic Context: Why Custom Components over Angular Material?**
The login screen is the most attacked surface of any financial application. While libraries like Angular Material accelerate development, they do not meet the strict security requirements of financial institutions governed by PCI DSS and SOC 2. Pre-built UI libraries introduce third-party dependency risks, increase the attack surface, and dictate rigid DOM structures. By building custom components using Angular Aria (headless directives), we maintain 100% control over the HTML. This is critical for enforcing strict Content Security Policies (CSP), mitigating DOM-based XSS via Angular's "Trusted Types" API, and preventing data leakage from browser autofill stealer logs by strictly controlling input attributes. Furthermore, custom components allow us to implement robust anti-clickjacking (overlay attack) defenses at the UI level.

**How Storybook Satisfies Security Audits**
Developing these components in Storybook provides a massive compliance advantage. Storybook isolates the UI from complex application state, creating a sandbox where security and accessibility can be audited independently. It serves as a verifiable "Secure Component Inventory" for SOC 2 auditors, allowing teams to use scripted interaction tests to mathematically prove that sensitive inputs handle validation securely and do not leak data.

**Feature 3.1: Secure Custom Input Components (Storybook)**
*   **Description:** Create a library of custom "Identity Inputs" (Email, Password, MFA Code) that bypass Angular Material to guarantee strict DOM control and security. Unlike pre-built libraries that often inject inline `<style>` tags at runtime and violate strict CSP policies, these custom components will rely on external CSS/SCSS and headless primitives.
*   **Technical Detail:**
    *   **LTS Compatibility:** These components will implement the standard `ControlValueAccessor` interface to integrate seamlessly with Angular's production-ready Reactive Forms API.
    *   **Strict CSP:** By fully owning the HTML and avoiding inline styles, the components ensure compatibility with a strict `Content-Security-Policy: default-src 'self'` and `style-src 'self'` without needing `unsafe-inline` exceptions.
    *   **Trusted Types:** To prevent DOM-based XSS, the application will define a custom `TrustedTypePolicy` (e.g., using DOMPurify). If a component ever needs to render dynamic content, it will only accept a `TrustedHTML` object via the `createHTML` method, preventing arbitrary string injection.
    *   **Clickjacking Mitigation:** While primary defense relies on HTTP headers (`frame-ancestors 'none'`), we will utilize Storybook's `@chromatic-com/storybook` visual testing addon to establish baseline snapshots. This ensures that any UI redress or unintended overlapping layers introduced during development are caught immediately.
    *   **Autofill Stealer Log Defense:** Stealer malware targets browser-stored credentials. Since browsers often ignore `autocomplete="off"` for login fields, the components will employ techniques like using `autocomplete="new-password"` or applying CSS-based masking (`-webkit-text-security: disc`) to prevent the browser from automatically populating sensitive data on the screen.
*   **Acceptance Criteria:**
    *   `SecureInputComponent` implements `ControlValueAccessor` correctly and registers providers via `NG_VALUE_ACCESSOR`.
    *   `SecureInputComponent` restricts injected HTML to Trusted Types only.
    *   Storybook: Stories exist for "Default", "Focused", "Error", and "Disabled" states, acting as interactive documentation for security teams.
    *   Automated interaction tests (using the `play` function) and visual regression tests in Storybook verify component visibility and ensure autocomplete attributes are correctly bound to prevent stealer log extraction.

**Feature 3.2: The Login Form Composition (Reactive Forms)**
*   **Description:** Compose the inputs into a functional Login Form using the stable Reactive Forms API.
*   **Technical Detail:** Use `FormGroup` and `FormControl` to define the form model with strict typing. Implement validators using the standard `Validators.required` and `Validators.email` rules.
*   **Acceptance Criteria:**
    *   The form model is strongly typed using `FormGroup<{ email: FormControl<string>, password: FormControl<string> }>`.
    *   The form submits only when valid.
    *   "Submit" button state is bound to the `loginForm.valid` property.
    *   Error messages appear immediately upon blur if invalid.

> **Gemini Code Assist Prompt (Day 3):**
>
> **Persona:** Frontend Security Architect (Angular/Accessibility).
> **Context:** Building the secure Login UI for TAI Portal using Angular 21. We are explicitly avoiding Angular Material to ensure strict DOM control to meet PCI DSS and SOC 2 compliance requirements.
> **Task:** Implement the `SecureInputComponent`, `LoginFormComponent`, and their isolated Storybook stories with integrated security testing.
> **Constraints:**
> *   **Tech:** Use Reactive Forms (`ReactiveFormsModule`). DO NOT use the experimental Signal Forms. Ensure `SecureInputComponent` properly implements `ControlValueAccessor` and registers the `NG_VALUE_ACCESSOR` provider.
> *   **Security (CSP & Trusted Types):** Do not use inline styles. Ensure strict CSP compatibility. If dynamically rendering HTML (e.g., error messages), you must define a custom `TrustedTypePolicy` and use `createHTML` to prevent DOM-based XSS.
> *   **Security (Data Leakage):** Apply `autocomplete="new-password"` or CSS masking (`-webkit-text-security: disc`) to password inputs to prevent browser autofill stealer logs from extracting credentials.
> *   **Accessibility:** Use Angular Aria headless directives inside the custom inputs.
>
> **Coding Instructions:**
> 1.  Create a `SecureInputComponent` that implements `ControlValueAccessor` to integrate with Reactive Forms.
> 2.  Inside `SecureInputComponent`, implement a `TrustedTypesService` that initializes `window.trustedTypes.createPolicy` to safely sanitize and bind dynamic error messages.
> 3.  Apply CSS-based masking (`-webkit-text-security: disc`) and the correct autocomplete attributes to the input fields to mitigate stealer malware.
> 4.  Create a `LoginComponent` that composes these secure inputs using a strictly typed `FormGroup` and built-in Angular Validators.
> 5.  Generate a `login.stories.ts` file. Configure the `@chromatic-com/storybook` addon in the story metadata to establish visual baselines for clickjacking and overlay attack prevention.
> 6.  Write a `play` function in the story to automate interaction testing. Simulate filling invalid/valid data using `userEvent`, and assert state changes to mathematically prove the component handles validation without leaking data.

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

### Day 5: The Federated Dashboard Shell
**Strategic Context:**
The "Portal Dashboard" is the container for all business modules. It must be resilient and accessible. We will use Angular Aria primitives to build the navigation shell. This ensures that the complex navigation menus (often a trap for screen readers) are perfectly compliant with EAA 2025 standards.

**Feature 5.1: Accessible Sidebar Navigation**
*   **Description:** A collapsible sidebar that lists available modules (Collections, Payments).
*   **Technical Detail:** Use the `cdkMenu` directives from `@angular/cdk/menu`. These handle focus management (e.g., pressing 'Down' moves to the next item, 'Escape' closes the menu) automatically.
*   **Acceptance Criteria:**
    *   Sidebar expands/collapses.
    *   Keyboard navigation works exactly as defined in the WAI-ARIA Authoring Practices.
    *   Storybook: AppShell story demonstrates the responsive behavior.

**Feature 5.2: User Profile Widget**
*   **Description:** A dropdown in the header showing the user's avatar and "Logout" button.
*   **Technical Detail:** Connected to the `AuthService` observables via `AsyncPipe`.
*   **Acceptance Criteria:**
    *   Displays user initials.
    *   Dropdown opens on Click or Enter key.
    *   Logout clears the session (revoking DPoP keys) and redirects to login.

**Feature 5.3: Automated A11y Guardrails**
*   **Description:** Prevent regression of accessibility features.
*   **Technical Detail:** Configure the Storybook Test Runner to execute a full accessibility audit on the App Shell.
*   **Acceptance Criteria:**
    *   CI pipeline fails if any critical accessibility violation is found.

> **Gemini Code Assist Prompt (Day 5):**
>
> **Persona:** UI/UX Engineer.
> **Context:** Building the main layout for the Portal dashboard using headless components.
> **Task:** Implement the AppShell and Sidebar components.
> **Constraints:**
> *   Use Angular CDK primitives (e.g., `import { CdkMenu, CdkMenuItem } from '@angular/cdk/menu'`).
> *   Do not use Angular Material (we need custom styles for TAI branding).
> *   Use CSS Grid for layout.
>
> **Coding Instructions:**
> "Create an Angular component `SidebarComponent` that uses the Angular CDK `Menu` directive.
> The menu should be data-driven, accepting an `@Input() menuItems`.
> Style it using CSS Modules/SCSS to match a 'Financial Dashboard' aesthetic (dark blue sidebar, clean typography).
> Write a Storybook story that simulates a 'screen reader' user navigating the menu using only keyboard commands (ArrowDown, ArrowUp, Enter). Use the `play` function to automate this verification, asserting that `document.activeElement` updates correctly."

## 3. Phase 2: Advanced Identity & Compliance (Week 2)
Week 2 focuses on the complex business requirements of the financial sector: serving multiple institutions (Multi-Tenancy), handling granular permissions (RBAC), and ensuring auditability (SOC2).

### Day 6: Multi-Tenancy & Data Isolation
**Strategic Context:**
TAI serves many clients. "Bank A" must never see "Credit Union B's" data. We will implement discriminator-based multi-tenancy enforced at the database level. This is safer than code-level filtering because the database itself enforces the separation.

**Feature 6.1: Tenant Resolution Middleware**
*   **Description:** Identify the tenant from the incoming request.
*   **Technical Detail:** A .NET Middleware that inspects the Host header (e.g., `bank-a.portal.com`). It retrieves the Tenant configuration from the cache.
*   **Acceptance Criteria:**
    *   `HttpContext.Features.Get<ITenantFeature>()` returns the correct tenant.
    *   Requests to unknown domains return 404.

**Feature 6.2: Global Query Filters (EF Core 10)**
*   **Description:** Automatically filter all database queries by `TenantId`.
*   **Technical Detail:** In `OnModelCreating`, apply a LINQ expression `e => e.TenantId == _currentTenantService.TenantId` to all entities implementing `IMultiTenant`.
*   **Acceptance Criteria:**
    *   A query for `Users.ToListAsync()` returns only users for the current tenant.
    *   Attempting to save an entity with a cross-tenant ID throws a security exception.

**Feature 6.3: Tenant-Aware Branding**
*   **Description:** The UI should reflect the branding of the financial institution.
*   **Technical Detail:** Angular service that fetches tenant theme configuration (primary color, logo URL) and updates CSS variables in the document root.
*   **Acceptance Criteria:**
    *   Login page logo changes based on the subdomain used to access it.

> **Gemini Deep Search Prompt (Day 6):**
>
> **Persona:** Backend Architect.
> **Context:** Implementing multi-tenancy in ASP.NET Core 10 with EF Core.
> **Task:** Secure data isolation and tenant resolution.
> **Constraints:**
> *   Use Global Query Filters.
> *   Use a Scoped service for `ITenantProvider`.
>
> **Research & Coding Prompt:**
> "Write the C# implementation for a `TenantResolutionMiddleware`. It should resolve the tenant from the HTTP Host header.
> Then, show how to register a Global Query Filter in `AppDbContext` that automatically applies `x.TenantId == currentTenant.Id` to all entities implementing `IMultiTenant`.
> Ensure this works with a caching layer to cache tenant configuration. Explain how to handle the 'Scope' mismatch (Middleware is singleton/transient, DbContext is scoped)."

### Day 7: Granular RBAC & Claims Transformation
**Strategic Context:**
In risk management, roles are complex. A "Collections Agent" can view loans but not restructure them. An "LPI Specialist" can order insurance but not view payment history. We need a granular permission system, not just simple roles.

**Feature 7.1: Claims Transformation Service**
*   **Description:** Convert high-level Roles (e.g., "Agent") into granular Permissions (e.g., `loan:read`, `insurance:write`).
*   **Technical Detail:** Implement `IClaimsTransformation` in .NET. When a user logs in, the system looks up their role permissions and adds them as permissions claims to the principal.
*   **Acceptance Criteria:**
    *   The Access Token payload includes a list of permissions.
    *   `[Authorize(Policy = "loan:read")]` works on controllers.

**Feature 7.2: Structural Directive for Permissions**
*   **Description:** A directive to conditionally render UI elements based on permissions.
*   **Technical Detail:** An Angular structural directive `*hasPermission="'loan:write'"` that subscribes to the `AuthService` observables.
*   **Acceptance Criteria:**
    *   "Edit" buttons disappear for users without write permission.
    *   The directive reacts dynamically if permissions change (e.g., via a WebSocket push).

**Feature 7.3: Admin User Management Grid**
*   **Description:** A UI for administrators to assign roles.
*   **Technical Detail:** Use Angular Aria Grid to create an accessible data table.
*   **Acceptance Criteria:**
    *   Storybook: `UserGrid` component supports keyboard navigation through rows and cells.
    *   Admin can toggle user roles.

> **Gemini Code Assist Prompt (Day 7):**
>
> **Persona:** Full Stack Developer.
> **Context:** Implementing RBAC for the Portal POC.
> **Task:** Create the backend authorization policies and the frontend permission directive.
> **Constraints:**
> *   **Frontend:** The directive must be reactive. Subscribe to the Observable and toggle the `ViewContainerRef`.
> *   **Backend:** Use Policy-based authorization factories in ASP.NET Core.
>
> **Coding Instructions:**
> "Generate an Angular structural directive `@Directive({ selector: '[hasPermission]' })`.
> It should take an input `hasPermission` (string).
> Use the `AuthService` observable to check if the user has the required permission.
> On the backend, show how to register a `.AddAuthorization(options => options.AddPolicy(...))` that dynamically checks for the presence of a specific claim in the 'permissions' array of the user's principal."

### Day 8: Session Management & Security Auditing
**Strategic Context:**
To meet SOC 2 requirements, every action must be auditable. Additionally, we need to manage sessions securely to allow for immediate revocation (e.g., if a device is lost).

**Feature 8.1: Token Rotation Strategy**
*   **Description:** Implement "Refresh Token Rotation".
*   **Technical Detail:** Every time a refresh token is used, it is invalidated and a new one is issued. If an old refresh token is reused, the system assumes theft and revokes the entire chain.
*   **Acceptance Criteria:**
    *   Frontend silently refreshes tokens.
    *   Replay of a used token triggers a "Security Alert" event.

**Feature 8.2: Immutable Audit Log**
*   **Description:** A central log of all identity events.
*   **Technical Detail:** An `AuditService` that writes to an append-only table. It captures Who, What, Where (IP), and When.
*   **Acceptance Criteria:**
    *   Log captures Login, Failed Login, Password Change, and Role Assignment events.

**Feature 8.3: "My Sessions" Dashboard**
*   **Description:** User-facing control of active sessions.
*   **Technical Detail:** Lists active refresh tokens with device metadata (parsed from User-Agent).
*   **Acceptance Criteria:**
    *   User can click "Revoke" to kill a specific session.
    *   Storybook: Component shows the list layout.

> **Gemini Deep Search Prompt (Day 8):**
>
> **Persona:** Security Compliance Officer / Developer.
> **Context:** Meeting SOC2 requirements for audit logging in the Identity system.
> **Task:** Design the Audit Log architecture.
> **Constraints:**
> *   Must be asynchronous (don't block the API response).
> *   Must be immutable.
>
> **Research & Coding Prompt:**
> "Design a C# 14 implementation of an `IAuditLogger` service.
> Use `System.Threading.Channels` (Producer/Consumer pattern) to offload logging to a background worker service in .NET 10.
> The log entry should be a `record struct` (for performance).
> Show how to inject this into the Login flow to log a successful authentication event without slowing down the HTTP response.
> Also, detail the schema for the Audit table (PostgreSQL) including partitioning by timestamp."

### Day 9: Compliance Automation (EAA 2025 & Accessibility)
**Strategic Context:**
The European Accessibility Act (2025) makes accessibility a legal requirement for financial services. We cannot rely on manual testing. We must automate it.

**Feature 9.1: Automated Axe Audits**
*   **Description:** Integrate accessibility checks into the CI/CD pipeline.
*   **Technical Detail:** Configure `storybook-test-runner` to run Axe on all stories.
*   **Acceptance Criteria:**
    *   Build fails if any story violates WCAG 2.1 AA.
    *   Report generated in JUnit format.

**Feature 9.2: Keyboard Navigation Verification**
*   **Description:** Ensure power users (and screen reader users) can navigate efficiently.
*   **Technical Detail:** Use Storybook `play` functions to tab through the entire dashboard shell and assert focus order.
*   **Acceptance Criteria:**
    *   Focus traps are verified (e.g., inside Modals).
    *   Skip links work correctly.

**Feature 9.3: Legacy Connector Simulation**
*   **Description:** Prove the system can integrate with legacy banking cores.
*   **Technical Detail:** A mock service that simulates a SOAP request to a legacy core to fetch user details on login.
*   **Acceptance Criteria:**
    *   Login latency includes the simulated delay of the legacy connector.

> **Gemini Code Assist Prompt (Day 9):**
>
> **Persona:** QA Automation Engineer.
> **Context:** Finalizing compliance for the EAA 2025 deadline.
> **Task:** Automate accessibility checks.
> **Constraints:**
> *   Use `axe-core` via Storybook.
>
> **Coding Instructions:**
> "Write a GitHub Actions workflow configuration (YAML) that:
> 1.  Builds the Storybook project.
> 2.  Runs `test-storybook` (the test runner).
> 3.  Fails the build if any accessibility violations are found.
> 4.  Publishes the accessibility report as a build artifact.
> Also, provide a checklist of manual checks for the 'Login' component (e.g., focus traps, screen reader announcements) that automation might miss, specifically focusing on the new Angular Aria patterns."

### Day 10: Production Readiness (E2E & Load Testing)
**Strategic Context:**
Performance must be verified. We also need to ensure the end-to-end flow works in a production-like environment.

**Feature 10.1: Playwright E2E Suite**
*   **Description:** A full simulation of a user logging in and navigating.
*   **Technical Detail:** TypeScript-based Playwright tests running against the Dockerized containers.
*   **Acceptance Criteria:**
    *   Tests pass in Headless mode.
    *   Video artifacts recorded for failed tests.

**Feature 10.2: Performance Load Test (k6)**
*   **Description:** Stress test the Identity API.
*   **Technical Detail:** Use k6 to simulate 50 concurrent logins per second.
*   **Acceptance Criteria:**
    *   P95 Latency < 100ms.
    *   Error rate < 0.1%.

**Feature 10.3: Documentation Generation**
*   **Description:** Generate the developer portal.
*   **Technical Detail:** Use Compodoc for Angular and Swagger for .NET.
*   **Acceptance Criteria:**
    *   Docs are accessible at `/docs`.

> **Gemini Deep Search Prompt (Day 10):**
>
> **Persona:** DevOps Engineer.
> **Context:** Finalizing the POC for demo.
> **Task:** Create the E2E test plan and Load Test configuration.
> **Constraints:**
> *   Use Playwright for E2E.
> *   Use k6 for Load Testing.
>
> **Research & Coding Prompt:**
> "Generate a Playwright test script (in TypeScript) that navigates to the Angular login page, fills in credentials, handles the MFA step (by reading a mock TOTP secret from an env var), and asserts the dashboard URL.
> Then, create a k6 script to stress-test the .NET 10 `/connect/token` endpoint, simulating 50 concurrent users logging in. Include checks for HTTP 200 OK status."

## 4. Conclusion
This execution plan provides a roadmap for recreating the core identity capabilities of the TAI Portal platform. By strictly adhering to Clean Architecture and leveraging the specific advantages of .NET 10 (Passkeys) and Angular 21 (Signals, Zoneless, Aria), the POC will not only demonstrate functional parity with modern identity systems but will also surpass them in performance and compliance.

### Table 1: Strategic Technology Alignment

| Component | Technology Choice | Strategic Justification for Financial Services |
| :--- | :--- | :--- |
| **Backend Runtime** | **.NET 10 (LTS)** | Standard LTS release provides stability and long-term support. A mature ecosystem ensures a wide range of available libraries and tools. |
| **Frontend Runtime** | **Angular (Stable)** | Zone.js architecture ensures compatibility and stability. RxJS provides the robust stream management required for risk dashboards. |
| **Identity Protocol** | **OpenID Connect / FAPI 2.0** | The financial industry standard. Enables secure federation and third-party delegation (e.g., allowing a collections agency to access specific data). |
| **Security Token** | **DPoP (Proof of Possession)** | Prevents token theft/replay, a critical mitigation for distributed teams working from insecure networks. |
| **Development** | **Storybook 8+** | Enforces a "Secure Component Supply Chain." Isolates the development of sensitive UI (Login, MFA) from business logic, ensuring auditability and EAA 2025 compliance. |
| **Infrastructure** | **Nx Monorepo** | Enables shared contracts (DTOs) between backend and frontend, reducing integration bugs in complex domain models. |

This roadmap is aggressive but achievable. It focuses the first week on the "hard problems" of architecture and security, leaving the second week for the business-specific logic of multi-tenancy and compliance. By following this plan, the team will deliver a POC that is not just a prototype, but a production-ready foundation for the future of TAI Portal.