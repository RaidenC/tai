# Specification: E2E Test Suite Stabilization

## 1. Goal
Address frequent timeouts and general flakiness within our Playwright E2E test suites by implementing robust session management, dynamic resource allocation, optimized test pyramids, and improved assertions.

## 2. The Problems Addressed
1. **Redundant Setup:** Each test performs a full OIDC login flow via the UI, taking 5-10 seconds of overhead per test.
2. **Inverted Testing Pyramid:** E2E tests are validating component/state behavior (like filtering a grid) rather than focusing solely on user journeys.
3. **CPU Starvation:** Playwright workers default to consuming all available CPU threads locally, crippling system performance during runs.
4. **UI-Driven Data Setup:** Pre-test data creation relies on the UI, which is slow and prone to breaking if intermediate UI changes occur.
5. **Flaky Network & Hardcoded Sleeps:** Tests occasionally fail due to unexpected network spikes or hardcoded `waitForTimeout` calls.

## 3. The Solutions (Requirements)

### 3.1 Global Authentication State
- Implement Playwright's `auth.setup.ts` to perform a single login via Identity UI.
- Save the authenticated browser state (cookies/local storage) to `.auth/user.json`.
- Configure `playwright.config.ts` so that all subsequent E2E projects reuse this state.

### 3.2 Proper Resource Limits
- Update `playwright.config.ts` to intelligently allocate workers based on the environment:
  - Local: `workers: process.env.CI ? 1 : '50%'` (to ensure the developer's machine remains usable).
  - CI: Use multiple, scaled workers or Playwright sharding.

### 3.3 Shift-Left Testing (Pyramid Correction)
- **Unit/Component (Vitest & Storybook):** Move validation of UI states (e.g., table sorting, filtering) out of Playwright and into Vitest (for Signals) and Storybook Interaction Tests.
- **E2E Scope:** Playwright should only test the "Steel Thread" (critical user journeys: Login, Create User, Assign Privileges).

### 3.4 API-Driven Setup (TDM)
- Leverage the existing `TDMController` (`/api/tdm/seed-user`) via `request.post()` inside Playwright's `beforeEach` or `beforeAll` hooks to quickly set up required database state.
- Completely remove UI navigation steps that solely exist for data creation.

### 3.5 Network Mocks & Auto-Waiting (Chief SQA Additions)
- Replace all instances of `page.waitForTimeout()` with Playwright's strict auto-waiting locators (e.g., `expect(locator).toBeVisible()`).
- Use `page.route` to mock flaky third-party responses or test edge cases (like simulated 500 errors) to prevent dependency on brittle backend behaviors during frontend-centric tests.

### 3.6 CI Retries & Flaky Management (Chief SQA Additions)
- Enable retries strictly for the CI environment: `retries: process.env.CI ? 2 : 0`. Do NOT retry locally to avoid masking real issues during development.
- Break down large tests into explicit `test.step` blocks to improve traceability in CI reports.
