import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  const TAI_URL = 'http://localhost:4200';

  // 1. Navigate to the portal which redirects to identity UI
  await page.goto(TAI_URL);
  await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click({ force: true });
  
  // 2. Perform login
  await page.getByLabel(/Corporate Email/i).fill('admin@tai.com');
  await page.getByLabel(/Password/i).fill('Password123!');
  await page.getByRole('button', { name: /Sign In to Portal/i }).click({ force: true });

  // 3. Wait until we are redirected back to the portal and authenticated
  await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 15000 });

  // 4. Save the authenticated state
  await page.context().storageState({ path: authFile });

  // 5. Save sessionStorage as well
  const sessionStorage = await page.evaluate(() => JSON.stringify(sessionStorage));
  fs.writeFileSync(path.join(__dirname, '../.auth/session.json'), sessionStorage, 'utf-8');
});
