# Implementation Plan: E2E Test Suite Stabilization

*Note: This plan is designed to be highly iterative. Every step must be independently testable to ensure we don't introduce massive failures into the CI or break the E2E suite.*

## Phase 1: Safe Configuration & Stability Baseline [COMPLETED]
**Goal: Improve general suite stability without changing test logic.**
1. [x] **Resource Limits & Retries:**
   - Update `playwright.config.ts` in both `portal-web-e2e` and `identity-ui-e2e`.
   - Set `workers: process.env.CI ? 1 : '50%'`.
   - Set `retries: process.env.CI ? 2 : 0`.
2. [x] **Verification:** Run the existing test suite locally and in CI to ensure the worker limits don't break current execution.

## Phase 2: Global Authentication Foundation (Opt-in) [COMPLETED]
**Goal: Build the global auth infrastructure without migrating any existing tests.**
1. [x] **Create Auth Script:** Create `src/auth.setup.ts` in `portal-web-e2e` to perform the login flow and save the session to `.auth/user.json`.
2. [x] **Playwright Config (Setup Project):** Add the `setup` project to `playwright.config.ts`.
3. [x] **Pilot Test:** Create a single, simple pilot test (e.g., `dashboard-auth.spec.ts`) that opts into using the `storageState`.
4. [x] **Verification:** Run the E2E suite. The pilot test should pass instantly using the cached auth, and all existing tests should continue to run via their standard `beforeEach` UI logins.

## Phase 3: Global Authentication Rollout [COMPLETED]
**Goal: Iteratively migrate existing tests to the global auth state.**
1. [x] **Migrate by Domain/Folder:** Select one group of tests at a time (e.g., just the `users/` tests or just the `privileges/` tests).
2. [x] **Remove Redundant Logins:** Remove their `beforeEach` UI login logic and configure them to use the global `storageState`.
3. [x] **Verification:** Run the E2E suite after each group is migrated to catch any state-leakage or dependency issues. Repeat until all tests are migrated.

## Phase 4: TDM API Setup Utility & Pilot [COMPLETED]
**Goal: Create reusable API seed data helpers without breaking UI setup.**
1. [x] **Create TDM Utility:** Create a `test-data.ts` helper file that uses Playwright's `APIRequestContext` to call `POST /api/tdm/seed-user`.
2. [x] **Pilot Test Refactor:** Pick a single, non-critical test that currently uses the UI to create a user before editing them. Refactor it to use the new TDM utility instead.
3. [x] **Verification:** Run the specific test to ensure the API correctly seeds the data and the test passes.

## Phase 5: TDM API Setup Rollout [COMPLETED]
**Goal: Replace slow UI data creation steps across the suite.**
1. [x] **Iterative Refactor:** Go through the test suite, one spec file at a time, replacing UI-based "Arrange" steps with TDM API calls.
2. [x] **Verification:** Run the E2E suite after modifying each spec file. Do not merge large batches of these changes at once.

## Phase 6: Auto-Waiting & Mock Networks (Targeted Fixes) [COMPLETED]
**Goal: Replace brittle `waitForTimeout` calls gradually.**
1. [x] **Code Audit & Search:** Search the codebase for `page.waitForTimeout()`.
2. [x] **Iterative Replacement:** Replace hardcoded waits in one spec file at a time with strict `expect().toBeVisible()` or `expect().toHaveText()` assertions.
3. [x] **Network Mocks (As Needed):** Where UI behavior relies on slow or flaky third-party endpoints, introduce `page.route` to mock the response for that specific test.
4. [x] **Verification:** Run the modified test locally using `--repeat-each=5` to ensure the flakiness is actually resolved before committing.

## Phase 7: Shift-Left Migration
**Goal: Move non-critical UI interaction tests to Vitest/Storybook safely.**
1. [ ] **Identify Candidates:** Flag tests in Playwright that are purely validating component state (e.g., "does the search box filter the table?").
2. [ ] **Write Lower-Level Tests:** Implement the equivalent test in Vitest (for Signal logic) or Storybook Interaction Tests.
3. [ ] **Verification:** Ensure the Vitest/Storybook tests pass and adequately cover the functionality.
4. [ ] **Prune E2E Suite:** *Only after the lower-level test is merged and passing*, remove the expensive E2E test from Playwright.

## History
- **2026-03-20:** Completed Phases 3-6. Implemented multi-tenant auth in `auth.setup.ts`, created `seedTestUser` TDM utility, refactored `onboarding.spec.ts` and `login-flow.spec.ts`. Resolved `BrowserContext` isolation issues for multi-persona tests. [f6042c0]
