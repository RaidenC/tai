# TAI Portal Product Guidelines

## Prose & Writing Style
The portal utilizes an **Institutional** communication style. Every message, label, and notification must be:
- **Formal and Precise:** Suitable for high-stakes banking operations and audit trails.
- **Clear and Authoritative:** Providing users with confidence in the system's security and state.
- **Concise:** Minimizing cognitive load for operational personnel.

## Design System & UX Principles
The UI is built on a **Strict Tailwind 4.0** and **Headless-First** architecture.

### UI Implementation
- **Zero Inline Styles:** Strictly prohibited to ensure a Zero-Violation Content Security Policy (CSP).
- **Tailwind 4.0 Enforcement:** All layout, spacing, and typography must be implemented using Tailwind utility classes.
- **Headless CDK Logic:** Component behavior must be abstracted via Headless Angular CDK, separating logic from presentation.
- **Multi-tenant Styling:** Branding must be driven by CSS Variables injected into the Tailwind configuration.

### Security-First UX
- **Zero-Trust Friction:** High-assurance tasks (e.g., Wire Transfers, Admin Changes) must trigger security challenges (Step-Up, MFA) as the default behavior.
- **Visual Transparency:** All security states (e.g., Impersonation) must be accompanied by clear, undeniable visual indicators.
- **Passive Threat Awareness:** Global banners and real-time alerts provide users with constant visibility into multi-tenant system health and security events.
- **Efficiency-First:** Deep links to approval tasks and security events are prioritized to transform the portal into an active operational hub.

## Development & Verification Standards
The project adheres to the highest standards of code quality and verifiable logic.

### Testing & Quality
- **Strict TDD:** The Red-Green-Refactor methodology is non-negotiable for every feature. No code is merged without a preceding failing test case.
- **Living Specification:** Storybook interaction tests serve as the primary source of truth for component behavior, proving security and logic invariants before integration.
- **Accessibility-Native:** Full compliance with WCAG standards via Axe-core is a hard requirement for all UI components.
- **Ecosystem Compatibility:** The system uses standard **JIT Compilation** to maintain full compatibility with the banking ecosystem; **NativeAOT is strictly prohibited**.

### Verifiable Ledger
Every component must be developed in Storybook isolation, acting as a verifiable security ledger for auditors to inspect and validate.

### CI/CD Excellence
- **Affected-Only CI:** All PRs must pass `nx affected` checks for lint, build, and test.
- **Automated Security:** Every commit triggers a secret-leak scan (Gitleaks) to prevent credential exposure.
- **Verified Containers:** Production images are automatically built and verified in CI before being considered ready for deployment.
