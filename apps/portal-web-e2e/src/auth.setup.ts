import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { seedTestUser } from './test-utils';

const authFile = path.join(__dirname, '../.auth/user.json');
const acmeAuthFile = path.join(__dirname, '../.auth/acme-admin.json');

test('authenticate TAI Admin', async ({ page, request }) => {
  const TAI_URL = 'http://localhost:4200';

  // 0. Ensure Admin account exists via TDM API
  await seedTestUser(request, {
    email: 'admin@tai.com',
    firstName: 'System',
    lastName: 'Administrator',
    password: 'Password123!',
    status: 3 // Active
  });

  // 1. Navigate to the portal which redirects to identity UI
  await page.goto(TAI_URL);
  await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
  
  // 2. Perform login
  await page.getByLabel(/Corporate Email/i).fill('admin@tai.com', { timeout: 30000 });
  await page.getByLabel(/Password/i).fill('Password123!');
  await page.getByRole('button', { name: /Sign In to Portal/i }).click();

  // 3. Wait until we are redirected back to the portal and authenticated
  await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 30000 });

  // 4. Save the authenticated state
  await page.context().storageState({ path: authFile });

  // 5. Save sessionStorage as well
  const sessionData = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  fs.writeFileSync(path.join(__dirname, '../.auth/session.json'), sessionData, 'utf-8');
});

test('authenticate ACME Admin', async ({ page, request }) => {
  const ACME_URL = 'http://acme.localhost:4200';

  // 0. Ensure ACME Admin account exists via TDM API
  await seedTestUser(request, {
    email: 'admin@acme.com',
    firstName: 'ACME',
    lastName: 'Admin',
    password: 'Password123!',
    tenantHost: 'acme.localhost',
    status: 3 // Active
  });

  // 1. Navigate to ACME portal
  await page.goto(ACME_URL);
  await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
  
  // 2. Perform login
  await page.getByLabel(/Corporate Email/i).fill('admin@acme.com', { timeout: 30000 });
  await page.getByLabel(/Password/i).fill('Password123!');
  await page.getByRole('button', { name: /Sign In to Portal/i }).click();

  // 3. Wait until authenticated
  await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 30000 });

  // 4. Save the authenticated state
  await page.context().storageState({ path: acmeAuthFile });

  // 5. Save sessionStorage for ACME
  const sessionData = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  fs.writeFileSync(path.join(__dirname, '../.auth/acme-session.json'), sessionData, 'utf-8');
});
