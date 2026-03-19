import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Dashboard Authentication (Pilot)', () => {
  test.use({ storageState: path.join(__dirname, '../.auth/user.json') });

  test('should load the dashboard instantly using global auth state', async ({ page }) => {
    // 1. Read the saved session storage
    const sessionData = JSON.parse(fs.readFileSync(path.join(__dirname, '../.auth/session.json'), 'utf-8'));

    // 2. Inject session storage into the page before it loads
    await page.addInitScript((data) => {
      for (const key of Object.keys(data)) {
        window.sessionStorage.setItem(key, data[key]);
      }
    }, sessionData);

    // 3. Navigate directly to the dashboard, skipping login entirely
    await page.goto('/');

    // 4. Verify we are authenticated by checking for the sidebar
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 5000 });
    
    // 5. Verify we are on the portal and not on the login page
    await expect(page).toHaveURL(/localhost:4200/);
  });
});