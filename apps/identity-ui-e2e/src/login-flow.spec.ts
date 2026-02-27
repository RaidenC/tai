import { test, expect } from '@playwright/test';

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

  test('should allow a user to log in and be redirected to the portal', async ({ page }) => {
    // Add a listener to log all navigations
    page.on('load', (p) => console.log(`[NAVIGATED] => ${p.url()}`));

    // 1. ARRANGE: Navigate to the login page with the correct return URL.
    await page.goto(LOGIN_URL);
    console.log(`[STARTED] at ${page.url()}`);

    // 2. ACT: Fill in credentials and submit the form.
    // The design system uses 'Corporate Email' instead of just 'Email'.
    await page.getByLabel('Corporate Email').fill('admin@tai.com');
    await page.getByLabel('Password').fill('Password123!');

    console.log('[ACTION] Clicking Sign In button...');
    // The button text is 'Sign In to Portal'.
    await page.getByRole('button', { name: 'Sign In to Portal' }).click();

    // 3. ASSERT: Verify the user is redirected to the main portal.
    // We add a long timeout here to ensure we see all the intermediate hops.
    console.log('[ASSERT] Waiting for final URL...');
    await expect(page).toHaveURL(`${PORTAL_URL}/`, { timeout: 15000 });

    // As a final verification, check that the main portal's content has loaded.
    const heading = page.locator('h1');
    await expect(heading).toContainText('Portal');
  });
});
