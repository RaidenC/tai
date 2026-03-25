import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Dashboard Authentication (Pilot)', () => {
  const authFile = path.join(__dirname, '../.auth/user.json');
  const sessionFile = path.join(__dirname, '../.auth/session.json');

  test.use({ storageState: authFile });

  test('should load the dashboard instantly using global auth state', async ({ page }) => {
    // 1. Read the saved session storage
    // We expect this file to exist if the setup ran successfully.
    // If it doesn't, the test should fail on the read, which is better than a conditional.
    const sessionData = fs.readFileSync(sessionFile, 'utf-8');

    // 2. Inject session storage into the page before it loads
    await page.addInitScript((data) => {
      const parsed = JSON.parse(data);
      for (const key of Object.keys(parsed)) {
        window.sessionStorage.setItem(key, parsed[key]);
      }
    }, sessionData);

    // 3. Navigate directly to the dashboard
    await page.goto('/');

    // 4. Verify we are authenticated by checking for the sidebar
    // We increase timeout slightly as the first navigation might take a moment to initialize
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 10000 });
    
    // 5. Verify we are on the portal and not on the login page
    await expect(page).toHaveURL(/.*localhost:4200.*/);
  });
});
