# 🎓 Foundation Masterclass: The Sovereign Identity & Zero-Trust Core

This material deconstructs the foundational architecture of the TAI Portal, covering the Monorepo setup, Sovereign Identity Provider, and the Zero-Trust Frontend.

## 🏗️ System Architecture: The "Steel Thread" Handshake

```mermaid
sequenceDiagram
    participant Browser as Angular (portal-web)
    participant Gateway as YARP Gateway
    participant API as Identity API (OpenIddict)
    participant DB as PostgreSQL

    Note over Browser: 1. Generate DPoP KeyPair
    Browser->>Gateway: GET /connect/authorize (PKCE + DPoP)
    Gateway->>API: Forward with X-Gateway-Secret
    API-->>Browser: Redirect to Login
    Note over Browser: 2. Input Sanitization (Trusted Types)
    Browser->>Gateway: POST /identity/Account/Login
    Gateway->>API: Validate Rate Limit (Token Bucket)
    API->>DB: Verify Credentials
    API-->>Browser: Set Secure; HttpOnly; SameSite=Strict Cookies
    Note over Browser: 3. Final Auth Handshake
    Browser->>Gateway: GET /api/data (DPoP Proof)
    Gateway->>API: Verify DPoP + Forward
    API-->>Browser: 200 OK (Isolated Data)
```

---

## 🎖️ Level 3: Senior Architect / Senior SDE
**Focus:** Strategic Security, Sovereign Identity, and Compliance.

### 1. Sovereign Identity vs. SaaS (Auth0/Okta)
*   **Strategy:** We chose **OpenIddict** to implement a "Sovereign Identity" model.
*   **Rationale:** In high-stakes Fintech, external dependencies on identity providers introduce "Vendor Lock-in" and regulatory risks. By owning the IdP code, we can implement custom FAPI 2.0 (Financial-grade API) requirements like **DPoP** and **mTLS** without waiting for a vendor's roadmap.
*   **Security:** Using **Standard JIT** instead of NativeAOT for the Identity core was a strategic decision to ensure full compatibility with the reflection-heavy OpenIddict and EF Core ecosystem, prioritizing stability over binary size.

### 2. The BFF (Backend-for-Frontend) Pattern with YARP
*   **What:** The Angular app never sees a JWT. All tokens are managed server-side.
*   **Why:** Traditional SPAs store JWTs in `localStorage`, where they are vulnerable to XSS "Token Theft." In our BFF pattern, YARP manages the cookies. JavaScript has **zero access** to the session tokens, physically neutralizing most XSS-based account takeovers.

### 3. FAPI 2.0 Compliance: DPoP (Proof of Possession)
*   **Concept:** Upgrades Bearer tokens (cash) to Sender-Constrained tokens (checks).
*   **Impact:** Even if a session cookie were somehow intercepted, it cannot be used by an attacker because they lack the non-extractable private key stored in the original user's browser `IndexedDB/WebCrypto` sandbox.

---

## ⚖️ Level 2: Mid-Level SDE
**Focus:** Patterns, Security-in-Depth, and Verification.

### 1. DOM Hardening: Trusted Types & CSS Masking
*   **Trusted Types:** We implemented a `TrustedTypesService` to block DOM-based XSS. The browser physically rejects any `element.innerHTML = string` call that hasn't been passed through our security policy.
*   **Malware Defense:** We used `autocomplete="new-password"` and `-webkit-text-security: disc` to confuse "Stealer Malware" that targets auto-populated browser fields.

### 2. Verifiable UI Logic (Storybook Interaction Tests)
*   **Logic:** We don't just "show" components in Storybook; we use the `play` function to **mathematically prove** UI invariants.
*   *Example:* A test that asserts the "Login" button is `disabled` until the email regex is satisfied. This acts as a "Verifiable Security Ledger" for SOC 2 auditors.

### 3. Rate Limiting (The Token Bucket)
*   **Implementation:** Using .NET 10's `System.Threading.RateLimiting` on the `/connect/token` endpoint. 
*   **Why:** Prevents brute-force password guessing. By partitioning by IP, we ensure one attacker can't lock out legitimate users from other locations.

---

## 🔰 Level 1: Junior SDE
**Focus:** Clean Code, Nx Monorepo, and Component Basics.

### 1. Nx Monorepo & Boundary Rules
*   **Organization:** We use an "Integrated" Nx workspace.
*   **The Law:** The `GEMINI.md` file defines the rules. For example, `libs/core/domain` is "Pure"—it cannot import anything from the outside. This prevents our business logic from getting "tangled" with database or UI code.

### 2. Smart vs. Dumb Components
*   **Dumb (Presentational):** `SecureInputComponent`. It only knows how to render an input and emit changes. It doesn't know about APIs or Users.
*   **Smart (Container):** `LoginFormComponent`. It manages the form state and communicates with the backend.

### 3. CSS Variables for Multi-Tenancy
*   **How:** We avoid hardcoded colors. Instead, we use `var(--primary-color)`.
*   **Why:** This allows the portal to change its look (Branding) instantly based on whether the user is logging into "TAI Financial" or "ACME Credit Union."

---

## 📝 Technical Interview Prep (Mock Q&A)

**Q1: Why did we build our own UI components instead of using Angular Material?**
*   **Answer:** Strict Security (CSP). Material and other libraries often inject inline styles or have complex DOM structures that are hard to audit. By building custom components on top of the **Headless Angular CDK**, we maintain 100% control over the HTML/CSS, allowing us to enforce a Zero-Trust Content Security Policy.

**Q2: What is the difference between `@ts-ignore` and `@ts-expect-error`?**
*   **Answer:** `@ts-expect-error` is a proactive check. It tells the compiler "I know there is an error here." If the error is fixed later, the compiler will fail and tell you to remove the comment. `@ts-ignore` is a "silent killer"—it suppresses errors forever, even if the code becomes valid or a *different* error occurs.

**Q3: How does PKCE protect the OIDC flow?**
*   **Answer:** It prevents "Authorization Code Injection." The client sends a secret hash (`code_challenge`) during the start of the login. When the login finishes, the client must provide the original secret (`code_verifier`). If an attacker stole the code in the middle, they wouldn't have the secret to exchange it for a token.

**Q4: What is "OnPush" change detection and why use it?**
*   **Answer:** It's a performance optimization. Normally, Angular checks every component on every event. `ChangeDetectionStrategy.OnPush` tells Angular only to check a component if its `@Input()` values actually change. This is critical for high-performance dashboards with real-time data.
