# TAI Portal POC

## Overview
The TAI Portal is a high-security, multi-tenant Fintech Identity Portal designed to provide centralized identity management and delegated administration for enterprise banking institutions. Built on a Zero-Trust architecture and adhering to the **Financial-grade API (FAPI) 2.0** security profile, the portal ensures the highest level of security for financial transactions and sensitive identity operations.

## Target Audience
- **Bank Staff:** Operational personnel using **Phishing-Resistant Authentication (Passkeys/FIDO2)** for secure access to customer management tasks.
- **End Customers:** Individual users accessing self-service identity and profile management.
- **Tenant Admins:** Bank-level administrators who manage their own staff, institution settings, and delegated privileges.
- **System Admins:** Platform-level administrators who manage global tenants (Institutions), groups, and foundational configuration.

## Core Features (Dashboard Tiles)
The portal uses a dynamic "Tiles" architecture where dashboard components are rendered based on user privileges and tenant configuration.

- **User & Identity Management:** Full lifecycle management (onboarding, offboarding, role assignment) for all user types.
- **Institution (Tenant) Management:** Configuration of organizational hierarchies, branding, and tenant-specific settings.
- **Group Management:** Logical grouping of users or tenants for collective permissioning and reporting.
- **RBAC & PBAC:** Granular management of Privileges, Roles, and custom "Tiles" access rights.
- **Context Switching:** Seamless account switching for users with access to multiple institutions, triggering real-time state updates.
- **Security Audit Logs:** Comprehensive logging and visibility into all identity-related events.

## Advanced Capabilities
- **Just-in-Time (JIT) Elevation:** A security-first approach to privileged actions (e.g., "Reset User Password").
  - **Temporary Access:** Users can request temporary elevation for restricted tiles, reducing the attack surface for compromised accounts.
  - **Collaborative Approval:** Tenant Admins receive real-time notifications to approve or deny elevation requests.
  - **Auto-Expiring Privileges:** Approved elevations result in re-issued Access Tokens with specific scopes that automatically expire (e.g., after 2 hours).
- **Real-Time Security Notifications:** Proactive user awareness and SOC 2 compliance.
  - **Event-Driven Alerts:** Instant notifications for security events such as new IP access or MFA failures.
  - **Technical Bridge:** OpenIddict events trigger Service Bus messages, which are pushed to the frontend via a SignalR hub bridged through the BFF.
- **Step-Up Authentication:** High-assurance flows for sensitive actions (e.g., Wire Transfers, Admin Settings).
  - **Dynamic Enforcement:** Accessing sensitive tiles triggers an immediate challenge if the current session's assurance level is insufficient.
  - **API-Driven Flow:** The API returns a `403 Forbidden` with an `insufficient_assurance` code, which the frontend intercepts.
  - **Seamless UI Integration:** A specialized modal automatically handles TOTP or Passkey challenges, exchanges them for a higher-privilege token, and transparently retries the original request.
- **Secure User Impersonation:** Tenant Admins can initiate a controlled impersonation session to assist users or troubleshoot issues.
  - **Visual Indicator:** The dashboard border turns bright orange with a "You are viewing as [User]" indicator to prevent accidental actions.
  - **Security Tokens:** The session generates a specific "Impersonation Token" via OpenIddict with a restricted `act_as` scope.
  - **Compliance & Audit:** Every action taken during an impersonation session is logged with both the Actor ID (Admin) and Subject ID (User), ensuring a non-repudiation chain.

## Quality, Integrity & Security Standards
- **Test-Driven Development (TDD):** The portal is built using a strict **Red-Green-Refactor** methodology. Every business requirement is preceded by a failing test case, ensuring 100% requirements-to-code traceability.
- **Domain Integrity:** The system utilizes **C# 14 Value Objects** (e.g., `MonetaryAmount`, `TenantId`) to prevent "Primitive Obsession" and ensure domain-level data integrity enforced by the compiler.
- **Verifiable UI Logic:** Storybook interaction tests act as a **"Living Specification,"** mathematically proving that security and accessibility invariants are met before components are integrated. This serves as a "verifiable security ledger" for auditors.
- **Testing Strategy:**
  - **Unit Testing:** xUnit and FluentAssertions for validating domain invariants and pure business logic.
  - **Integration Testing:** WebApplicationFactory combined with Respawn or TestContainers to verify the OpenIddict handshake and EF Core filters.
  - **Frontend Verification:** Vitest for logic (targeting >90% coverage) and Storybook interaction tests for component-level security and A11y verification (Axe-core).
  - **End-to-End (E2E):** Playwright for "Steel Thread" verification of critical workflows, using Global Auth and TDM API seeding for high reliability.

## Architectural Integration
The portal adheres to a Privacy-First, Zero-Trust architectural model:
- **Infrastructure-Layer Notification Hub:** A specialized service in the Infrastructure layer manages the consumption of Service Bus messages and orchestration of notifications.
- **Privacy-First Messaging:** SignalR payloads are strictly reference-based and contain no PII. The Angular application uses these references to fetch secured details via authorized BFF calls.
- **Privilege-Aware Initialization:** Real-time components like the SignalR hub only initialize and connect if the user possesses the necessary privileges, enforcing security from the moment of bootstrap.

## User Experience & Multi-tenancy
- **Active Operational Hub:** The portal transforms from a static dashboard into an active hub using deep links and real-time approval workflows.
- **White-labeled Experience:** The UI dynamically adapts its visual identity (branding, themes) based on the active tenant context.
- **Dynamic Multi-tenant Styling:** CSS Variables are injected into the Tailwind configuration to provide real-time, tenant-specific branding while maintaining a consistent design system.
- **Federated Access:** Users can access multiple institutions via a single set of credentials while maintaining strict logical isolation between data sets.
- **Dynamic Access Control:** Users only see the "Tiles" and features they are explicitly authorized to access.
- **Custom UI System:** A custom set of Angular components built using Headless Angular CDK and Tailwind CSS 4.0 to satisfy strict CSP and Zero-Trust security requirements.

## Technology & Integration
- **Frontend Architecture:** Multi-application strategy managed via Nx:
  - **`portal-web` (The Portal):** The primary shell hosting tiles and business modules.
  - **`identity-ui` (Secure Login):** A standalone, hardened Angular application dedicated to the authentication handshake.
- **Frontend Framework:** Angular using standard change detection (Zone.js). Component development utilizes Headless Angular CDK and Tailwind CSS 4.0.
- **Reactivity:** Stable, LTS Signal features provide high-performance reactivity with full RxJS interop.
- **Backend:** .NET REST API implementing Clean Architecture and BFF (Backend-for-Frontend) patterns.
- **Identity Service:** Custom-built identity service using OpenIddict, adhering to the **FAPI 2.0** security profile.
- **Security:** Zero-JWT policy in the frontend; all tokens managed server-side via Secure, HttpOnly, SameSite=Strict cookies. Phishing-resistant authentication via **Passkeys (FIDO2/WebAuthn)**.
- **DPoP (Demonstrating Proof-of-Possession):** Ensures that tokens cannot be replayed from other clients or environments.
- **Data & Storage:** PostgreSQL via EF Core with Global Query Filters for robust tenant isolation.
- **Communications:** Service Bus and SignalR integration for real-time notifications and system-wide security alerts.
