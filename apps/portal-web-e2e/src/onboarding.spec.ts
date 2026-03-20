import { test, expect } from '@playwright/test';
import * as path from 'path';
import { injectAuthSession, seedTestUser } from './test-utils';

/**
 * Onboarding "Steel Thread" E2E Tests
 * 
 * Persona: New Banking Customer / Staff Member / Tenant Admin
 * Context: Full end-to-end flow from registration to active state.
 */
test.describe('User Onboarding Flows', () => {
  const TAI_URL = 'http://localhost:4200';
  const ACME_URL = 'http://acme.localhost:4200';
  const API_URL = 'http://localhost:5217'; // Gateway

  test('Customer Self-Service: Should register, verify OTP, and reach success state', async ({ page, request }) => {
    const email = `customer_${Date.now()}@example.com`;

    // 1. Navigate to Portal and start registration
    await page.goto(TAI_URL);
    
    // 2. Click "Create New Account" directly on the Portal home page
    await page.getByRole('button', { name: /Create New Account/i }).click();
    await expect(page).toHaveURL(/\/register/);

    // 3. Fill Registration Form
    await page.getByLabel(/First Name/i).fill('E2E');
    await page.getByLabel(/Last Name/i).fill('Customer');
    await page.getByLabel(/Email Address/i).fill(email);
    await page.getByLabel(/Password/i).fill('Password123!');
    
    // Intercept registration response
    const registerResponsePromise = page.waitForResponse(r => r.url().includes('/api/onboarding/register') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Register Account/i }).click();
    const registerResponse = await registerResponsePromise;
    expect(registerResponse.ok()).toBeTruthy();

    // 4. Should be redirected to /verify
    await expect(page).toHaveURL(/\/verify/);

    // 5. Retrieve OTP from Diag Endpoint (via email) with retry
    let code = '';
    await expect(async () => {
      const otpResponse = await request.get(`${API_URL}/identity/diag/otp-by-email?email=${encodeURIComponent(email)}`);
      if (!otpResponse.ok()) {
        const text = await otpResponse.text();
        throw new Error(`OTP not ready yet: ${otpResponse.status()} - ${text}`);
      }
      const data = await otpResponse.json();
      code = data.code;
    }).toPass({
      intervals: [500, 1000, 1000],
      timeout: 10000
    });

    // 6. Enter OTP
    await page.getByLabel(/Verification Code/i).fill(code);
    await page.getByRole('button', { name: /Verify Code/i }).click();

    // 7. Should reach Success / Passkey setup page
    await expect(page).toHaveURL(/\/create-passkey/, { timeout: 10000 });
    await expect(page.locator('h2')).toContainText(/Create Your Passkey/i);
  });

  test('Staff Approval: Should require admin approval before OTP verification', async ({ page, request, browser }) => {
    const email = `staff_${Date.now()}@acme.com`;

    // 1. ARRANGE: Register as Staff at ACME Subdomain
    await page.goto(ACME_URL);
    await page.getByRole('button', { name: /Create New Account/i }).click();
    await expect(page).toHaveURL(/\/register/);
    
    await page.getByLabel(/First Name/i).fill('E2E');
    await page.getByLabel(/Last Name/i).fill('Staff');
    await page.getByLabel(/Email Address/i).fill(email);
    await page.getByLabel(/Password/i).fill('Password123!');
    
    const registerResponsePromise = page.waitForResponse(r => r.url().includes('/api/onboarding/register') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Register Account/i }).click();
    const registerResponse = await registerResponsePromise;
    expect(registerResponse.ok()).toBeTruthy();

    // 2. ASSERT: Should be redirected to /verify
    await expect(page).toHaveURL(/\/verify/);
    
    // 3. ACT: Admin Approval (Bypassing UI login with ACME Admin session)
    const adminContext = await browser.newContext({ storageState: path.join(__dirname, '../.auth/acme-admin.json') });
    const adminPage = await adminContext.newPage();
    await injectAuthSession(adminPage, 'acme-session.json');
    await adminPage.goto(ACME_URL);
    
    // 4. Navigate to Approvals
    await expect(adminPage.locator('tai-sidebar')).toBeVisible({ timeout: 15000 });
    await adminPage.getByRole('menuitem', { name: /Approvals/i }).click();
    await expect(adminPage).toHaveURL(/\/admin\/approvals/);

    // 5. Approve the new staff member
    const initialPendingPromise = adminPage.waitForResponse(r => r.url().includes('/api/onboarding/pending-approvals') && r.request().method() === 'GET');
    await adminPage.reload();
    await initialPendingPromise;
    
    // Use a locator that specifically targets the table body to avoid matching headers/footers
    const table = adminPage.locator('table');
    const row = table.locator('tr').filter({ hasText: email });
    await expect(row).toBeVisible({ timeout: 15000 });
    
    const approveResponsePromise = adminPage.waitForResponse(r => r.url().includes('/api/onboarding/approve') && r.request().method() === 'POST');
    const refreshResponsePromise = adminPage.waitForResponse(r => r.url().includes('/api/onboarding/pending-approvals') && r.request().method() === 'GET');
    
    await row.getByRole('button', { name: /Approve/i }).click();
    
    await approveResponsePromise;
    await refreshResponsePromise;
    
    await expect(row).toBeHidden({ timeout: 10000 }); 

    // 6. ACT: Verify OTP as the approved staff member
    let code = '';
    await expect(async () => {
      const otpResponse = await request.get(`${API_URL}/identity/diag/otp-by-email?email=${encodeURIComponent(email)}`, {
        headers: {
          'Host': 'acme.localhost:5217'
        }
      });
      if (!otpResponse.ok()) {
        const text = await otpResponse.text();
        throw new Error(`OTP not ready yet: ${otpResponse.status()} - ${text}`);
      }
      const data = await otpResponse.json();
      code = data.code;
    }).toPass({
      intervals: [500, 1000, 1000],
      timeout: 10000
    });

    // Enter OTP using single input
    await page.getByLabel(/Verification Code/i).fill(code);
    await page.getByRole('button', { name: /Verify Code/i }).click();

    // 7. ASSERT: Success
    await expect(page).toHaveURL(/\/create-passkey/, { timeout: 10000 });
    
    await adminPage.close();
  });

  test.describe('Authenticated Tests (TAI Admin)', () => {
    test.use({ storageState: path.join(__dirname, '../.auth/user.json') });

    test('User Directory: Should enforce tenant isolation', async ({ page }) => {
      // 1. Inject global auth state
      await injectAuthSession(page);

      // 2. Navigate directly to Users
      await page.goto(TAI_URL);
      await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 15000 });
      await page.getByRole('menuitem', { name: /Users/i }).click();
      await expect(page).toHaveURL(/\/users/);

      // 3. Verify visibility (Isolation check)
      await expect(page.locator('tbody')).toContainText('admin@tai.com');
      await expect(page.locator('tbody')).not.toContainText('admin@acme.com');
    });
  });
});
