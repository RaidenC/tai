import { test, expect } from '@playwright/test';
import { seedTestUser } from './test-utils';

test.describe('Privileges UI Security E2E', () => {
  const BASE_URL = 'http://localhost:4200';
  const NORMAL_USER_EMAIL = 'user-security-test@tai.com';

  test.beforeAll(async ({ request }) => {
    // 1. Seed a normal user (no role)
    await seedTestUser(request, {
      email: NORMAL_USER_EMAIL,
      firstName: 'Normal',
      lastName: 'User',
      password: 'Password123!',
      role: 'User', // 'User' role should NOT have Portal.Privileges.Read
      status: 3 // Active
    });
  });

  test('normal user should NOT see Privileges link in sidebar', async ({ page }) => {
    // 1. Login as normal user
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
    
    await page.getByLabel(/Corporate Email/i).fill(NORMAL_USER_EMAIL);
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();

    // 2. Wait for sidebar
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 30000 });

    // 3. Verify 'Privileges' link is NOT visible
    const privilegesLink = page.getByRole('link', { name: 'Privileges' });
    await expect(privilegesLink).not.toBeVisible();
  });

  test('normal user should be redirected from /admin/privileges to home', async ({ page }) => {
    // 1. Login (re-using session if possible or just fresh login for security test)
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
    
    await page.getByLabel(/Corporate Email/i).fill(NORMAL_USER_EMAIL);
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();
    await expect(page.locator('tai-sidebar')).toBeVisible();

    // 2. Manually navigate to privileges page
    await page.goto(`${BASE_URL}/admin/privileges`);

    // 3. Verify we are redirected back to home (or root)
    // The privilegeGuard redirects to '/'
    await expect(page).toHaveURL(BASE_URL + '/');
  });
});
