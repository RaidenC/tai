import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const authFile = path.join(__dirname, '../.auth/user.json');

test('authenticate', async ({ page }) => {
  const TAI_URL = 'http://localhost:4200';

  // 1. Navigate to the portal which redirects to identity UI
  await page.goto(TAI_URL);
  await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
  
  // 2. Perform login
  await page.getByLabel(/Corporate Email/i).fill('admin@tai.com');
  await page.getByLabel(/Password/i).fill('Password123!');
  await page.getByRole('button', { name: /Sign In to Portal/i }).click();

  // 3. Wait until we are redirected back to the portal and authenticated
  await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 15000 });

  // 4. Save the authenticated state
  await page.context().storageState({ path: authFile });

  // 5. Save sessionStorage as well
  const sessionData = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  fs.writeFileSync(path.join(__dirname, '../.auth/session.json'), sessionData, 'utf-8');
});
