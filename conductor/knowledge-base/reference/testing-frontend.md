---
title: Testing — Frontend & CSP Compliance
difficulty: L1 | L2 | L3 | Staff
lastUpdated: 2026-04-10
relatedTopics:
  - Angular-Core
  - RxJS-Signals
  - Testing-Backend
stack:
  - frontend
---

## Table of Contents

[🧠 **View Interactive Mindmap**](./testing-frontend-mindmap.md)

1. [TL;DR](#tldr)
2. [Deep Dive](#deep-dive)
   2.1 [Frontend Testing (Angular)](#concept-group-1-frontend-testing-angular)
      2.1.1 [Vitest & Angular TestBed](#1-vitest--angular-testbed)
      2.1.2 [Service Testing with HttpTestingController](#2-service-testing-with-httptestingcontroller)
      2.1.3 [Signal Store Testing](#3-signal-store-testing)
   2.2 [Component Testing & CSP Compliance](#concept-group-2-component-testing--csp-compliance)
      2.2.1 [Storybook for Component Development & Testing](#4-storybook-for-component-development--testing)
      2.2.2 [Storybook Test Runner: Automated A11y & CSP Guardrails](#5-storybook-test-runner-automated-a11y--csp-guardrails)
      2.2.3 [Why Storybook Enables Strict CSP Custom Components](#6-why-storybook-enables-strict-csp-custom-components)
3. [Real-World Examples](#real-world-examples)
   3.1 [Frontend Service Test — HTTP Mocking with HttpTestingController](#1-frontend-service-test--http-mocking-with-httptestingcontroller)
   3.2 [Storybook CSP Guardrail — Inline Style Detection](#2-storybook-csp-guardrail--inline-style-detection)
   3.3 [Storybook Interaction Test — SecureInput Security Proof](#3-storybook-interaction-test--secureinput-security-proof)
4. [Comparison Tables](#comparison-tables)
5. [Interview Q&A](#interview-qa)
   5.1 [L2: Mid-Level](#l2-mid-level-knowledge)
   5.2 [L3: Senior](#l3-senior-knowledge)
6. [Cross-References](#cross-references)
7. [Further Reading](#further-reading)

---

## TL;DR

Frontend testing in Angular 21 uses <span style="color: #00C851; font-weight: bold;">Vitest + Angular TestBed</span> for unit/service tests and <span style="color: #00C851; font-weight: bold;">Storybook + test runner</span> for component-level visual and compliance testing. Signal-based stores simplify assertions — read state synchronously with `store.status()` instead of subscribing to observables. <span style="color: #33b5e5; font-weight: bold;">HttpTestingController</span> intercepts HTTP calls for deterministic service testing. The unique challenge in tai-portal is <span style="color: #ffbb33; font-weight: bold;">Strict CSP compliance</span> (`style-src 'self'`; no `'unsafe-inline'`): Angular Material cannot be used because it injects inline styles. Storybook provides the isolated rendering environment to build and verify custom CSP-compliant components, with the <span style="color: #00C851; font-weight: bold;">test runner enforcing zero inline styles</span> via `postVisit` DOM scanning. See **[[Testing-Backend]]** for foundations (pyramid, AAA, test doubles), .NET testing (xUnit, Moq, WebApplicationFactory, Testcontainers), and E2E testing (Playwright, TDM).

---

## Deep Dive

### Concept Group 1: Frontend Testing (Angular)

#### 1. Vitest & Angular TestBed

##### What
<span style="color: #33b5e5; font-weight: bold;">Vitest</span> is the modern JavaScript test framework replacing Jest in Angular projects (faster, native ESM support). <span style="color: #33b5e5; font-weight: bold;">Angular TestBed</span> creates a testing module that configures the DI container, enabling you to inject services and mock dependencies.

##### Why
Without TestBed, testing Angular services that use `inject()` would fail — `inject()` requires an injection context. TestBed provides that context, mimicking how Angular's DI works at runtime. Vitest replaces Jest with faster execution, native TypeScript support, and better HMR integration.

##### How

```typescript
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

describe('DPoPService', () => {
    let service: DPoPService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [DPoPService]
        });
        service = TestBed.inject(DPoPService);
    });

    it('should generate a DPoP header', async () => {
        const header = await service.getDPoPHeader('GET', 'http://localhost/api');

        const parts = header.split('.');
        expect(parts.length).toBe(3);  // JWT has 3 parts

        const payload = JSON.parse(atob(parts[1]));
        expect(payload.htm).toBe('GET');
        expect(payload.htu).toBe('http://localhost/api');
    });
});
```

##### When
Use TestBed for all Angular service and component tests. Use Vitest as the test runner. Configure coverage thresholds in `vitest.config.ts` (tai-portal uses 80-90% for lines/functions/branches).

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">TestBed is slower than plain Vitest tests</span> because it initializes Angular's DI container. For pure utility functions that don't use `inject()`, test them directly without TestBed. <span style="color: #ff4444; font-weight: bold;">TestBed doesn't fully replicate the runtime environment</span> — `ChangeDetectorRef`, `NgZone`, and component lifecycle hooks behave slightly differently in tests.

---

#### 2. Service Testing with HttpTestingController

##### What
<span style="color: #33b5e5; font-weight: bold;">`HttpTestingController`</span> (from `@angular/common/http/testing`) intercepts all HTTP requests in tests, allowing you to assert the request was made correctly and flush a canned response.

##### Why
Without `HttpTestingController`, service tests would make real HTTP calls — requiring a running backend, causing network flakiness, and testing the server instead of the Angular service. The controller lets you verify the exact URL, method, and body of outgoing requests.

##### How

```typescript
describe('OnboardingService', () => {
    let service: OnboardingService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [OnboardingService],
        });
        service = TestBed.inject(OnboardingService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();  // Fail if unexpected requests were made
    });

    it('should call register', () => {
        service.register({ email: 'test@example.com', ... }).subscribe();

        const req = httpMock.expectOne('/api/onboarding/register');
        expect(req.request.method).toBe('POST');
        req.flush({});  // Respond with empty success
    });
});
```

##### When
Use `HttpTestingController` for every Angular service that makes HTTP calls. Always call `httpMock.verify()` in `afterEach` to catch unexpected requests.

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">`expectOne()` is strict</span> — if the URL doesn't match exactly (query params, trailing slashes), the test fails with a confusing "no request found" error. Use `expectOne(req => req.url.includes('/api/...'))` for flexible matching.

---

#### 3. Signal Store Testing

##### What
Testing <span style="color: #33b5e5; font-weight: bold;">Signal-based stores</span> involves providing mock services via TestBed, calling store methods, and asserting Signal values synchronously — no subscription management needed.

##### Why
Without testing stores, you can't verify that: state transitions are correct (Idle → Loading → Success), error messages are extracted from HTTP responses, and side effects (like refreshing a list after approval) are triggered.

##### How

```typescript
describe('OnboardingStore', () => {
    let store: OnboardingStore;
    let mockService: { register: Mock; verifyOtp: Mock; ... };

    beforeEach(() => {
        mockService = {
            register: vi.fn(),
            verifyOtp: vi.fn(),
            getPendingApprovals: vi.fn(),
            approveUser: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                OnboardingStore,
                { provide: OnboardingService, useValue: mockService }
            ]
        });
        store = TestBed.inject(OnboardingStore);
    });

    it('should update status to Success on registration', () => {
        mockService.register.mockReturnValue(of({ userId: '123' }));

        store.register({ email: 'test@tai.com', ... });

        // Signals are read synchronously — no subscribe needed!
        expect(store.status()).toBe('Success');
        expect(store.isError()).toBe(false);
    });

    it('should extract error detail from HttpErrorResponse', () => {
        const errorResponse = new HttpErrorResponse({
            error: { detail: 'Registration failed' }, status: 400
        });
        mockService.register.mockReturnValue(throwError(() => errorResponse));

        store.register({ email: 'test@tai.com', ... });

        expect(store.status()).toBe('Error');
        expect(store.errorMessage()).toBe('Registration failed');
    });
});
```

##### When
Test every store method for: success path, error path, edge cases (missing data, boundary conditions), and side effects (e.g., `approve()` should refresh `pendingUsers`).

##### Trade-offs
<span style="color: #00C851; font-weight: bold;">Signals make store testing dramatically simpler than NgRx</span> — no need for `store.select().subscribe()`, no marble testing, no managing subscriptions. The trade-off: <span style="color: #ffbb33; font-weight: bold;">effects run synchronously in tests</span>, which may not match production timing where effects run asynchronously.

---

### Concept Group 2: Component Testing & CSP Compliance

#### 4. Storybook for Component Development & Testing

##### What
<span style="color: #33b5e5; font-weight: bold;">Storybook</span> is a component workbench that renders UI components in isolation, outside the full application. Each component gets "stories" — named configurations that exercise different states (default, loading, error, disabled). In tai-portal, the design system library (`libs/ui/design-system`) has Storybook stories for every shared component: `DataTableComponent`, `SecureInputComponent`, `TransferListComponent`, `AppShellComponent`, `LoginFormComponent`, and more.

##### Why
Without Storybook, developing a `SecureInputComponent` requires spinning up the entire Angular app, navigating to the login page, and manually triggering each state (focused, error, disabled, password masking). Storybook renders the component instantly with configurable props, enabling <span style="color: #00C851; font-weight: bold;">rapid iteration on visual states without touching application code</span>. More critically for security: Storybook provides the isolated rendering environment needed to verify that components comply with <span style="color: #33b5e5; font-weight: bold;">Strict Content Security Policy (CSP)</span> — something that's impossible to test with unit tests alone.

##### How

```typescript
// libs/ui/design-system/src/lib/design-system/secure-input/secure-input.stories.ts
const meta: Meta<SecureInputComponent> = {
  title: 'Identity/SecureInput',
  component: SecureInputComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, SecureInputComponent],
    }),
  ],
  tags: ['autodocs'],  // Auto-generate documentation pages
  args: {
    label: 'Email Address',
    type: 'email',
    placeholder: 'Enter your corporate email',
    errorMessage: 'Invalid identity format',
  },
};

// Each export is a "story" — a named visual state
export const Default: Story = { args: { label: 'Email', type: 'email' } };
export const PasswordState: Story = { args: { label: 'Password', type: 'password' } };
export const ErrorVisible: Story = {
  args: { label: 'Invalid Input', errorMessage: '<strong>XSS Attempt</strong> Blocked' },
};
export const Loading: Story = { args: { loading: true } };
```

tai-portal's Storybook configuration:
- **Portal-level:** `apps/portal-web/.storybook/` — stories for feature pages
- **Design system-level:** `libs/ui/design-system/.storybook/` — stories for shared components
- **Addons:** `@storybook/addon-a11y` (accessibility audits), `@storybook/addon-interactions` (interaction testing)

##### When
Write Storybook stories for every component in the design system library. Write interaction tests (`play` functions) for components with complex user interactions (sorting, pagination, form validation). Use Storybook as the <span style="color: #00C851; font-weight: bold;">primary development environment</span> for UI components — not the full application.

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">Storybook adds build and maintenance overhead</span> — each component needs stories kept in sync with its API. Stories that hard-code mock data become stale when the component interface changes. <span style="color: #ffbb33; font-weight: bold;">Storybook doesn't test DI context</span> — services injected via `inject()` need manual `moduleMetadata` providers or mocks in the decorator.

---

#### 5. Storybook Test Runner: Automated A11y & CSP Guardrails

##### What
The <span style="color: #33b5e5; font-weight: bold;">Storybook Test Runner</span> (`@storybook/test-runner`) executes all stories as automated tests using Playwright, optionally running custom assertions in `preVisit` and `postVisit` hooks. In tai-portal, the test runner enforces two automated guardrails: <span style="color: #00C851; font-weight: bold;">accessibility (axe-core)</span> and <span style="color: #00C851; font-weight: bold;">CSP compliance (no inline styles)</span>.

##### Why
Without automated guardrails, CSP violations creep in silently. A developer adds `[style]="'color: red'"` to a template, it works in development (no CSP header), and the violation only surfaces in production when the browser blocks it. The Storybook test runner catches these violations <span style="color: #00C851; font-weight: bold;">at build time, before code reaches production</span>.

##### How

```typescript
// libs/ui/design-system/.storybook/test-runner.ts
import { TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page) {
    // 1. Accessibility Check — axe-core audit on every story
    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });

    // 2. CSP Guardrail — reject ANY inline styles in rendered DOM
    const inlineStylesCount = await page
      .locator('#storybook-root [style]')
      .count();
    if (inlineStylesCount > 0) {
      throw new Error(
        `CSP Violation: Found ${inlineStylesCount} elements with inline styles. ` +
        `Inline styles are prohibited by SWBC Zero-Trust architecture.`
      );
    }
  },
};
```

This runs automatically for **every story** — if any component renders a `style` attribute in the DOM, the test runner fails the entire suite.

##### When
Enable the test runner in CI for the design system library. Add it as a pre-merge gate so no component with inline styles can be merged. Use `checkA11y` for WCAG compliance and the inline style check for CSP compliance.

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">The test runner adds ~2-5 seconds per story</span> because it renders each story in a real browser via Playwright. For a design system with 50+ stories, this can add several minutes to CI. Mitigate by running the test runner only on design system changes, not on every commit. <span style="color: #ff4444; font-weight: bold;">False positives from third-party dependencies</span> — if a dependency injects inline styles (Angular CDK, Material), the guardrail catches it, forcing you to either remove the dependency or find a CSP-compatible alternative.

---

#### 6. Why Storybook Enables Strict CSP Custom Components

##### What
<span style="color: #33b5e5; font-weight: bold;">Strict CSP</span> (`style-src 'self'; script-src 'self'`) prohibits all inline styles and scripts. This means <span style="color: #ff4444; font-weight: bold;">Angular Material cannot be used</span> — it injects inline `style` attributes at runtime for theming, ripple effects, and overlay positioning. Storybook provides the isolated development environment needed to build and verify <span style="color: #00C851; font-weight: bold;">custom CSP-compliant components</span> as replacements.

##### Why
The problem is a fundamental conflict between UI component libraries and browser security:

1. **Angular Material** (and most component libraries) dynamically inject `style` attributes via JavaScript for layout calculations, animations, and theming. This violates `style-src 'self'` — the browser blocks the style and the component renders broken.

2. **`'unsafe-inline'` is not acceptable** in regulated environments (PCI DSS, SOC 2, Zero Trust). Adding `style-src 'unsafe-inline'` to the CSP defeats the entire purpose of the policy — it reopens the XSS attack surface that CSP is designed to close.

3. **The only solution is custom components** that use CSS classes, stylesheets, and `computed()` Signal-based class bindings instead of inline `[style]` bindings. But building custom components without a visual testing environment is error-prone — you can't verify all visual states (hover, focus, error, disabled, loading, responsive breakpoints) through unit tests alone.

<span style="color: #00C851; font-weight: bold;">Storybook solves this by providing the visual development loop + automated CSP enforcement:</span>

```
Developer writes component → Storybook renders all states → 
Test runner checks for inline styles → CSP violation = build failure →
Developer fixes with CSS class / computed() binding → 
Component ships CSP-compliant
```

##### How
tai-portal's approach — build every component with strict DOM control:

```typescript
// SecureInputComponent — CSP-compliant dynamic styling
// Instead of: [style]="{ 'border-color': hasError ? 'red' : 'gray' }"
// Use computed class binding:
public readonly inputClasses = computed(() => {
  const base = 'secure-input-field px-4 py-3 text-base border rounded-md ...';
  const error = this.errorMessage() && this.isTouched()
    ? ' border-red-600 focus:ring-red-600/10'
    : '';
  const password = this.type() === 'password' ? ' password-mask' : '';
  return `${base}${error}${password}`;
});
```

```html
<!-- Template uses [class] binding, never [style] -->
<input [class]="inputClasses()" [type]="type()" />
```

The pattern for every tai-portal design system component:
- <span style="color: #00C851; font-weight: bold;">Tailwind CSS utility classes</span> for static styling (compiled to external stylesheet)
- <span style="color: #00C851; font-weight: bold;">`computed()` Signals</span> for dynamic class composition (no inline styles)
- <span style="color: #00C851; font-weight: bold;">External `.scss` files</span> for component-specific styles (loaded as external stylesheet by Angular)
- <span style="color: #00C851; font-weight: bold;">`TrustedTypesService`</span> for sanitizing dynamic HTML (XSS prevention for `[innerHTML]` sinks)
- <span style="color: #ff4444; font-weight: bold;">Zero Angular Material</span> — replaced by CDK primitives + custom Tailwind components

**Storybook interaction tests as security proofs:**

```typescript
// secure-input.stories.ts — PasswordState story
export const PasswordState: Story = {
  args: { label: 'Password', type: 'password' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Password');

    // Security Proof: autocomplete prevents stealer malware extraction
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.type(input, 'Secret123!');
    // CSS masking via -webkit-text-security, not inline style
  },
};

// ErrorVisible story — Trusted Types proof
export const ErrorVisible: Story = {
  args: { errorMessage: '<strong>XSS Attempt</strong> Blocked' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Invalid Input'));
    await userEvent.tab();

    const errorMsg = canvas.getByRole('alert');
    // Verify Trusted Types sanitized the HTML safely
    expect(errorMsg.innerHTML).toContain('<strong>XSS Attempt</strong> Blocked');
  },
};
```

##### When
Use Storybook + test runner whenever you're building UI components for an application with <span style="color: #00C851; font-weight: bold;">Strict CSP requirements</span> (banking, healthcare, government, any PCI DSS / SOC 2 scope). The Storybook test runner is the enforcement mechanism — without it, CSP compliance is a manual review process that inevitably misses violations.

##### Trade-offs
<span style="color: #ffbb33; font-weight: bold;">Building custom components is significantly more work than using Angular Material.</span> A `DataTableComponent` with sorting, pagination, and row actions takes days instead of hours. The trade-off is justified when: (a) regulatory compliance mandates Strict CSP, (b) the design system needs to be audit-ready for SOC 2 / PCI DSS, or (c) the security team refuses to allow `'unsafe-inline'` in production. <span style="color: #ff4444; font-weight: bold;">Using Angular CDK (not Material) is the middle ground</span> — CDK provides unstyled behavioral primitives (overlays, tables, drag-drop) without injecting inline styles, which tai-portal uses for the `DataTableComponent` via `CdkTableModule`.

---

## Real-World Examples

### 1. Frontend Service Test — HTTP Mocking with HttpTestingController

📍 From tai-portal: `apps/portal-web/src/app/features/onboarding/onboarding.service.spec.ts`

Tests that the Angular service makes the correct HTTP calls with the right method, URL, and body.

```typescript
it('should call verifyOtp', () => {
    service.verifyOtp('user123', '123456').subscribe();

    const req = httpMock.expectOne('/api/onboarding/verify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'user123', code: '123456' });
    req.flush(null);
});

it('should fetch users with pagination', () => {
    service.getUsers(2, 20).subscribe(response => {
        expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/users?page=2&pageSize=20');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
});
```

---

### 2. Storybook CSP Guardrail — Inline Style Detection

📍 From tai-portal: `libs/ui/design-system/.storybook/test-runner.ts`

The test runner's `postVisit` hook scans every rendered story for `[style]` attributes in the DOM. If any component injects inline styles — whether from your code or a third-party dependency — the test runner fails the entire suite. This is the automated enforcement mechanism for Strict CSP.

```typescript
async postVisit(page) {
    // 1. Accessibility audit via axe-core
    await checkA11y(page, '#storybook-root', {
        detailedReport: true,
        detailedReportOptions: { html: true },
    });

    // 2. CSP Guardrail — zero tolerance for inline styles
    const inlineStylesCount = await page
        .locator('#storybook-root [style]')
        .count();
    if (inlineStylesCount > 0) {
        throw new Error(
            `CSP Violation: Found ${inlineStylesCount} elements with inline styles.`
        );
    }
}
```

---

### 3. Storybook Interaction Test — SecureInput Security Proof

📍 From tai-portal: `libs/ui/design-system/src/lib/design-system/secure-input/secure-input.stories.ts`

Interaction tests (`play` functions) serve as executable security proofs — they verify that the `SecureInputComponent` uses the correct `autocomplete` attribute to defend against credential-stealing malware, and that XSS payloads in error messages are sanitized by Trusted Types.

```typescript
export const PasswordState: Story = {
    args: { label: 'Password', type: 'password' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const input = canvas.getByLabelText('Password');

        // Security Proof: autocomplete prevents stealer malware extraction
        expect(input).toHaveAttribute('autocomplete', 'new-password');
        expect(input).toHaveAttribute('type', 'password');

        await userEvent.type(input, 'Secret123!');
        // CSS masking via -webkit-text-security, not inline style
    },
};

export const ErrorVisible: Story = {
    args: { errorMessage: '<strong>XSS Attempt</strong> Blocked' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByLabelText('Invalid Input'));
        await userEvent.tab();

        const errorMsg = canvas.getByRole('alert');
        // Verify Trusted Types sanitized the HTML safely
        expect(errorMsg.innerHTML).toContain('<strong>XSS Attempt</strong> Blocked');
    },
};
```

---

## Comparison Tables

### Component Testing: Angular Material vs Custom + Storybook

| Dimension | **Angular Material** | **Custom Components + Storybook** |
|-----------|---------------------|----------------------------------|
| **Development speed** | <span style="color: #00C851; font-weight: bold;">Fast — pre-built, documented</span> | Slower — build from scratch |
| **CSP compliance** | <span style="color: #ff4444; font-weight: bold;">Violates strict CSP (inline styles)</span> | <span style="color: #00C851; font-weight: bold;">Fully compliant — class bindings only</span> |
| **Audit readiness** | Requires `'unsafe-inline'` exception | SOC 2 / PCI DSS ready out of the box |
| **Visual testing** | Limited — relies on full app context | <span style="color: #00C851; font-weight: bold;">Every state testable in isolation</span> |
| **A11y enforcement** | Built-in ARIA | Storybook axe-core on every story |
| **Bundle size** | <span style="color: #ffbb33; font-weight: bold;">Large — pulls Material theming system</span> | Minimal — Tailwind + CDK primitives |
| **tai-portal choice** | Not used — CSP prohibits it | All design system components |

### Frontend Test Stack

| Dimension | **Vitest + TestBed** | **HttpTestingController** | **Signal Store Tests** |
|-----------|---------------------|--------------------------|----------------------|
| **Purpose** | Service & component unit tests | HTTP service testing | State management verification |
| **Speed** | ~10ms/test (with DI init) | ~5ms/test | ~5ms/test |
| **Dependencies** | Angular DI context | `HttpClientTestingModule` | Mock services via `vi.fn()` |
| **Key assertion** | `expect(result).toBe(...)` | `httpMock.expectOne(url)` | `expect(store.status()).toBe(...)` |
| **Async model** | Promise/Observable | Synchronous flush | Synchronous Signal read |

---

## Interview Q&A

### L2: Mid-Level Knowledge

#### L2: How do you test Angular services that make HTTP calls?
**Difficulty:** L2 (Mid-Level)

**Question:** How does `HttpTestingController` work, and what should you verify in an HTTP service test?

**Answer:** <span style="color: #33b5e5; font-weight: bold;">`HttpTestingController`</span> intercepts all `HttpClient` requests in tests. You import `HttpClientTestingModule`, call the service method that triggers the HTTP call, then use `httpMock.expectOne(url)` to assert the request was made to the right URL with the right method and body. You respond with `req.flush(mockData)` to provide a canned response. <span style="color: #00C851; font-weight: bold;">Always call `httpMock.verify()` in `afterEach`</span> — it fails the test if unexpected requests were made or expected requests were not consumed. This pattern tests the service's request construction and response mapping without needing a running backend.

---

### L3: Senior Knowledge

#### L3: Why build custom components instead of using Angular Material under Strict CSP?
**Difficulty:** L3 (Senior)

**Question:** Your security team mandates Strict CSP (`style-src 'self'`; no `'unsafe-inline'`). The frontend team wants to use Angular Material. Why can't you, and how does Storybook help you build the alternative?

**Answer:** <span style="color: #ff4444; font-weight: bold;">Angular Material injects inline `style` attributes at runtime</span> — for theming, ripple effects, overlay positioning, and layout calculations. Under Strict CSP, the browser blocks these styles and the components render broken. The only options are: (a) add `'unsafe-inline'` to CSP — <span style="color: #ff4444; font-weight: bold;">which reopens the XSS attack surface and fails PCI DSS / SOC 2 audits</span>, or (b) build custom components that use CSS classes and external stylesheets exclusively.

<span style="color: #00C851; font-weight: bold;">Storybook is what makes option (b) viable.</span> Building custom components without visual testing is error-prone — you need to verify dozens of states (default, hover, focus, error, disabled, loading, responsive breakpoints) that unit tests can't cover. Storybook provides: (1) **isolated rendering** — develop each component state independently, (2) **interaction tests** — `play` functions that serve as executable security proofs (verify `autocomplete` attributes, Trusted Types sanitization), and (3) **automated CSP enforcement** — the Storybook test runner's `postVisit` hook scans every story for `[style]` attributes and fails the build if any are found.

In tai-portal, the pattern is: <span style="color: #33b5e5; font-weight: bold;">Tailwind CSS</span> for static classes, <span style="color: #33b5e5; font-weight: bold;">`computed()` Signals</span> for dynamic class composition (e.g., `inputClasses()` returns conditional class strings), <span style="color: #33b5e5; font-weight: bold;">Angular CDK</span> for unstyled behavioral primitives (`CdkTableModule`), and zero Angular Material. The Storybook test runner in CI ensures no regression — if a developer accidentally adds `[style]="..."`, the build fails before merge.

---

## Cross-References

- [[Angular-Core]] — TestBed provides DI context for `inject()`, Signal stores simplify assertion (synchronous reads), `HttpTestingController` mocks `HttpClient`.
- [[RxJS-Signals]] — Signal-based store testing reads state synchronously. RxJS `of()` and `throwError()` create mock observable responses.
- [[Testing-Backend]] — Shared foundations (testing pyramid, AAA pattern, test doubles), .NET backend testing, and E2E testing with Playwright.
- [[Security-CSP-DPoP]] — DPoP proof generation tests verify JWT structure. Strict CSP drives the entire Storybook + custom component strategy.

---

## Further Reading

- [Angular Testing Guide](https://angular.dev/guide/testing)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Storybook for Angular](https://storybook.js.org/docs/angular/get-started)
- [Storybook Test Runner](https://storybook.js.org/docs/angular/writing-tests/test-runner)
- [axe-core Accessibility Testing](https://github.com/dequelabs/axe-core)
- Source: `apps/portal-web/src/app/**/*.spec.ts` — Vitest + TestBed frontend tests
- Source: `libs/ui/design-system/.storybook/` — Storybook configuration and test runner
- Source: `libs/ui/design-system/src/lib/design-system/**/*.stories.ts` — Component stories

---

*Last updated: 2026-04-10*
