---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Testing**

## **1. Testing Foundations**

### **1.1 Testing Pyramid**
1. Unit tests: many, fast (~1ms), catches logic errors
   - Domain invariants, handler mapping, store state transitions
   - Mocked dependencies — isolated from infrastructure
2. Integration tests: medium, (~100ms), catches wiring bugs
   - Real HTTP pipeline via WebApplicationFactory
   - Real PostgreSQL via Testcontainers, fast resets via Respawn
3. E2E tests: few, slow (~5-30s), catches user-visible regressions
   - Playwright drives real browsers across full system
   - Critical paths only: registration, approval, tenant isolation
4. Trade-off: mocks hide integration bugs; E2E is slow and flaky

### **1.2 Arrange-Act-Assert (AAA)**
1. Arrange: set up preconditions, create mocks, seed data
2. Act: execute the single operation under test
3. Assert: verify outcomes — result values AND side effects
4. Every test in tai-portal follows AAA with explicit comments

### **1.3 Test Doubles**
1. Stub: returns canned data, no verification
   - `mockService.register.mockReturnValue(of(...))`
2. Mock: returns data AND verifies interactions
   - `Mock<IOtpService>` with `.Verify(x => ..., Times.Once)`
3. Fake: working implementation with shortcuts
   - `TestAuthHandler`, `TestMessageHandler` in integration tests
4. Spy: wraps real object, records calls
   - `vi.fn()` / `vi.spyOn()` in Angular store tests
5. Rule: prefer verifying outcomes over interactions

## **2. Backend Testing (.NET)**

### **2.1 xUnit & FluentAssertions**
1. `[Fact]` for single tests, `[Theory]` for parameterized
   - `.Should().Be()` reads left-to-right naturally
2. FluentAssertions: better failure messages with full object diffs
   - `.Should().Throw<T>().WithMessage("*pattern*")`
3. `IClassFixture<T>`: share fixture per test class
4. `ICollectionFixture<T>`: share fixture across test classes

### **2.2 Mocking with Moq**
1. `new Mock<IInterface>()` creates runtime proxy
   - `.Setup(x => x.Method()).ReturnsAsync(value)` configures returns
2. `.Verify(x => x.Method(), Times.Once)` asserts interactions
   - `It.IsAny<T>()` for flexible matching, `It.Is<T>(pred)` for specific
3. Default `Loose` behavior — strict mocks are brittle
4. Not NativeAOT compatible — uses runtime reflection
5. Use only in unit tests, never in integration tests

### **2.3 WebApplicationFactory**
1. Boots entire ASP.NET Core app in-memory — no network
   - Full middleware pipeline: routing, auth, model binding, filters
2. `ConfigureTestServices` replaces specific services
   - `TestAuthHandler` replaces OIDC, `BypassAuthorizationService` skips authz
3. `IClassFixture` shares factory per test class
4. Disable parallelization for shared database state
   - `[assembly: CollectionBehavior(DisableTestParallelization = true)]`

### **2.4 Testcontainers & Respawn**
1. Real PostgreSQL 17 in Docker — exact production match
   - SQLite/InMemory lies: different NULL, no jsonb, wrong dialect
2. EF Core migrations applied automatically in fixture
3. Respawn resets data in ~5ms — respects foreign keys
   - Ignores `__EFMigrationsHistory` to preserve schema state
4. `ICollectionFixture<DatabaseFixture>` shares container across assembly
5. Trade-off: requires Docker; ~2-5s startup amortized

## **3. Frontend Testing (Angular)**

### **3.1 Vitest & TestBed**
1. Vitest replaces Jest — faster, native ESM, TypeScript support
   - Coverage thresholds: 80-90% lines/functions/branches
2. TestBed creates Angular DI container for tests
   - Required for any service/component using `inject()`
3. `TestBed.configureTestingModule({ providers: [...] })`
   - `TestBed.inject(ServiceClass)` retrieves instances
4. Skip TestBed for pure utility functions without DI

### **3.2 HttpTestingController**
1. Intercepts all HttpClient requests in tests
   - `expectOne(url)` asserts correct URL, method, body
2. `req.flush(data)` provides canned response
3. `httpMock.verify()` in afterEach catches unexpected requests
4. Strict URL matching — use predicate for flexible matching

### **3.3 Signal Store Testing**
1. Mock services via `{ provide: Service, useValue: mockObj }`
   - `vi.fn().mockReturnValue(of(data))` for success paths
   - `throwError(() => new HttpErrorResponse(...))` for error paths
2. Assert Signal values synchronously — no subscribe needed
   - `expect(store.status()).toBe('Success')`
3. Verify side effects: approval refreshes pending list
4. Dramatically simpler than NgRx testing — no marble syntax

## **4. End-to-End Testing**

### **4.1 Playwright**
1. Real browser automation: Chromium, Firefox, WebKit
   - Auto-waiting eliminates most timing issues
2. `page.getByRole()`, `page.getByLabel()` for accessible locators
3. `page.waitForResponse()` for API call verification
   - `toPass()` with intervals for polling async operations
4. Multi-browser context for admin approval flows
   - `browser.newContext({ storageState: '...' })` for auth
5. Never use `page.waitForTimeout()` — hides race conditions

### **4.2 Test Data Management (TDM)**
1. TDM API endpoints: `/api/tdm/seed-user` bypasses UI setup
   - Gated by environment — disabled in production
2. Auth session injection: `page.addInitScript()` with saved sessions
   - One-time setup in `auth.setup.ts`, reused across tests
3. Diagnostic endpoints: `/identity/diag/otp-by-email` for async flows
   - Security risk — only in dev/test environments
4. Respawn for isolation between integration test classes

## **5. Component Testing & CSP Compliance**

### **5.1 Storybook for Component Development**
1. Isolated component workbench — renders outside full app
   - Each component gets stories: Default, Loading, Error, Disabled
2. Design system library: every shared component has stories
   - DataTable, SecureInput, TransferList, AppShell, LoginForm
3. Addons: `addon-a11y` (accessibility), `addon-interactions` (play tests)
4. `tags: ['autodocs']` auto-generates documentation pages
5. Faster iteration than spinning up entire Angular app

### **5.2 Storybook Test Runner: A11y & CSP Guardrails**
1. Runs all stories as automated tests via Playwright
   - `preVisit`: injects axe-core for accessibility auditing
2. `postVisit`: scans DOM for `[style]` attributes
   - Any inline style = immediate build failure
3. Catches CSP violations at build time, not production
   - Third-party dependencies that inject inline styles are caught too
4. Two guardrails per story: WCAG compliance + CSP compliance

### **5.3 Why Storybook Enables Strict CSP Components**
1. Angular Material violates strict CSP — injects inline styles
   - Theming, ripple effects, overlay positioning all use `[style]`
2. `'unsafe-inline'` reopens XSS attack surface — fails SOC 2/PCI DSS
3. Custom components use class bindings, never inline styles
   - Tailwind CSS for static, `computed()` Signals for dynamic classes
   - Angular CDK for unstyled behavioral primitives (CdkTableModule)
4. Storybook provides the visual dev loop custom components need
   - Verify all states: hover, focus, error, disabled, responsive
5. Interaction tests as security proofs
   - Verify `autocomplete='new-password'`, Trusted Types sanitization
