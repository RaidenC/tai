---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Web Security — CSP & OWASP**

## **1. Strict CSP**

### **1.1 Core Directives**
1. `script-src 'self' 'strict-dynamic' 'nonce-{r}'`
2. `style-src 'self'` (no unsafe-inline)
3. `frame-ancestors 'none'` (replaces X-Frame-Options)
4. `base-uri 'self'` (prevent base-tag hijack)
5. `object-src 'none'` (Flash/Java dead)

### **1.2 Inline Strategy**
1. **Hash** — static, build-time-known inline
2. **Nonce** — dynamic per-response (SSR)
3. **`'strict-dynamic'`** — SPA default; transitive trust
4. **Zero-inline** (SWBC) — pure `'self'`, no exceptions

### **1.3 Trusted Types**
1. `require-trusted-types-for 'script'` directive
2. Throws on raw-string innerHTML, eval, document.write
3. Register policy with DOMPurify backing
4. Browser support: Chrome/Edge yes; FF flag; Safari partial

### **1.4 Reporting & Rollout**
1. `Report-Only` mode for safe migration
2. Reporting API → JSON to endpoint
3. Filter extension noise (`chrome-extension://`)
4. Two-phase: report 2-4 weeks → enforce

### **1.5 Common Bypasses**
1. JSONP on allow-listed origin
2. Missing `base-uri` → base-tag hijack
3. `data:` in `script-src` → arbitrary code
4. Wildcard hosts (`*.cdn.com`)
5. File-upload origin same as app

## **2. XSS Prevention**

### **2.1 The Three Types**
1. **Stored** — DB-persisted; defense: input validation + output encoding
2. **Reflected** — URL/form payload; defense: output encoding
3. **DOM-based** — never reaches server; defense: Trusted Types only

### **2.2 Output Encoding by Context**
1. HTML body — entity encode
2. HTML attribute — quote + attr encode
3. URL context — URL encode + scheme allowlist
4. JavaScript — Unicode escape (avoid embedding)
5. CSS — escape + allowlist (or never reflect)

### **2.3 DOMPurify**
1. Browser-native parser; no regex
2. `ALLOWED_TAGS` / `ALLOWED_ATTR` allowlist
3. `ALLOWED_URI_REGEXP` to ban `javascript:` / `data:`
4. `RETURN_TRUSTED_TYPE: true` for TT integration
5. Pin version; patch on CVE

### **2.4 Angular Defenses**
1. `{{ }}` and `[attr]` auto-encode (always safe)
2. `[innerHTML]` invokes Angular sanitizer
3. `bypassSecurityTrust*` = audit-every-call red flag
4. 5 SecurityContexts: HTML, STYLE, URL, RESOURCE_URL, SCRIPT

## **3. CSRF & Cross-Origin**

### **3.1 SameSite Cookie**
1. `Strict` — never sent cross-site
2. `Lax` (2026 default) — only top-level GET cross-site
3. `None; Secure` — required for cross-site (HTTPS only)
4. Pair with `HttpOnly` + `Secure`

### **3.2 CSRF Token Patterns**
1. Synchronizer (server session state)
2. Double-submit cookie (Angular default)
3. Custom header (preflight requirement)
4. DPoP signature (sender-constrained REST)

### **3.3 Origin / Fetch Metadata**
1. `Origin` header — server-side validate
2. `Sec-Fetch-Site` — same/cross/none
3. `Sec-Fetch-Mode` — cors/navigate/no-cors
4. Use as defense-in-depth on top of SameSite

### **3.4 CORS Pitfalls**
1. <span style="color: #ff4444;">CORS is NOT a CSRF defense</span>
2. Reflecting `Origin` without validation = breach
3. `Access-Control-Allow-Origin: *` + credentials = browser rejects
4. Wildcard subdomain via regex = forgotten subdomain risk

## **4. Browser Surface Hardening**

### **4.1 Subresource Integrity**
1. SHA-384 hash on `<script integrity="...">`
2. Browser refuses if hash mismatches
3. Pin to versioned CDN URLs
4. Build tools auto-generate hashes

### **4.2 Iframe & Origin Isolation**
1. `<iframe sandbox>` — restrict embed capabilities
2. `allow-scripts allow-same-origin` together = sandbox defeated
3. COOP / COEP / CORP — cross-origin isolation
4. Unlocks SharedArrayBuffer, high-res timers

### **4.3 Permissions-Policy**
1. Disable unused features by default
2. `camera=()` `microphone=()` `geolocation=()`
3. `interest-cohort=()` opts out of FLoC/Topics
4. `payment=(self)` allow only same-origin

### **4.4 Referrer-Policy**
1. Default leaks full URL — set explicit policy
2. `strict-origin-when-cross-origin` = sane default
3. `no-referrer` for paranoid contexts
4. Tokens in URL = leaked via Referer

## **5. OWASP Top 10 — Frontend**

### **5.1 A03 Injection (XSS)**
1. Strict CSP + Trusted Types + DOMPurify
2. Framework auto-encoding
3. Audit every `bypassSecurityTrust*`

### **5.2 A07 Auth Failures**
1. No tokens in `localStorage`
2. HttpOnly + SameSite cookies
3. DPoP for sender-constraint
4. Logout clears all client state

### **5.3 A02 Cryptographic Failures**
1. WebCrypto non-extractable keys
2. No hardcoded secrets in JS bundles
3. No sensitive data in URL (Referer leak)
4. Server-side encryption only

### **5.4 A05 Misconfiguration**
1. Strict CSP, HSTS preload, `nosniff`
2. Referrer-Policy + Permissions-Policy set
3. Test: Mozilla Observatory, securityheaders.com
4. CORS allow-list, never reflect

### **5.5 A06 Vulnerable Components**
1. `npm audit` in CI; fail on high+
2. Lockfile committed; `npm ci` not `install`
3. SRI on CDN scripts
4. Audit `postinstall` scripts of new deps
5. Auto-merge dependabot is a footgun

## **6. tai-portal Real Examples**

### **6.1 Zero-Violation CSP Stack**
1. No Angular Material (CDK Overlay injects inline)
2. Tailwind v4 build-time CSS only
3. Trusted Types policy `tai-security-policy`
4. Custom design system (atoms/molecules/organisms)

### **6.2 Frontend Defense Layers**
1. CSP + Trusted Types (browser surface)
2. DPoP per-request signature (REST)
3. BFF cookie + SameSite=Strict (WebSocket)
4. Tenant claim → server EF Core filter

### **6.3 Cross-Reference Notes**
1. [[Security-CSP-DPoP]] — DPoP + gateway trust depth
2. [[Authentication-Authorization]] — OIDC + sovereign IdP
3. [[CSS-Styling]] — why Tailwind survives strict CSP
4. [[Real-Time UI Patterns]] — Claim Check pattern

## **7. Interview Readiness**

### **7.1 L1 Junior**
1. CSP one-liner + `'unsafe-inline'` problem
2. CORS vs CSP (server vs client)
3. `SameSite=Strict` purpose

### **7.2 L2 Mid-Level**
1. 3 XSS types + per-type defense
2. Hash vs nonce vs `'strict-dynamic'`
3. Why `localStorage` is bad for tokens
4. `frame-ancestors` vs `X-Frame-Options`

### **7.3 L3 Senior**
1. SWBC zero-violation CSP architecture
2. Why CORS isn't CSRF defense
3. CSP rollout plan for legacy app
4. End-to-end financial form defense

### **7.4 Staff**
1. HIPAA + SOC 2 frontend architecture
2. Third-party widget security review process
3. CSP relaxation governance
4. Defense-in-depth threat model
