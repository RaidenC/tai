import { test, expect } from '@playwright/test';
import { seedTestUser } from './test-utils';

/**
 * E2E Test for the primary user login flow.
 *
 * This test covers the "steel thread" of the authentication system.
 * It verifies that a user can successfully authenticate through the
 * dedicated `identity-ui` and be redirected to the main `portal-web`
 * portal application.
 */
test.describe('E2E User Login Flow', () => {
  const IDENTITY_UI_URL = 'http://localhost:4300';
  const PORTAL_URL = 'http://localhost:4200';
  // Use lowercase 'returnUrl' to match the Angular component's input binding.
  const LOGIN_URL = `${IDENTITY_UI_URL}/?returnUrl=${encodeURIComponent(PORTAL_URL + '/')}`;

  test('should allow a user to log in and be redirected to the portal', async ({ page, request }) => {
    const testEmail = `login_test_${Date.now()}@tai.com`;
    const password = 'Password123!';

    // 0. ARRANGE: Seed a test user via TDM API
    await seedTestUser(request, {
      email: testEmail,
      firstName: 'Login',
      lastName: 'Tester',
      password: password,
      status: 3 // Active
    });

    // 1. ACT: Navigate to the login page
    await page.goto(LOGIN_URL);

    // 2. ACT: Fill in credentials and submit
    await page.getByLabel('Corporate Email').fill(testEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In to Portal' }).click();

    // 3. ASSERT: Verify redirection to the main portal
    await expect(page).toHaveURL(`${PORTAL_URL}/`, { timeout: 15000 });
    const heading = page.locator('h1');
    await expect(heading).toContainText('Portal');
  });
});
