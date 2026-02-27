import { test, expect } from '@playwright/test';

/**
 * Real-World Multi-Tenant E2E Tests
 * 
 * This suite verifies the "Institutional" grade multi-tenancy requirements:
 * 1. Subdomain-based context resolution (acme.localhost).
 * 2. Full OIDC redirection handshake (Portal -> API -> Identity UI -> Portal).
 * 3. Tenant-specific data isolation in the final authenticated state.
 */
test.describe('Real-World Multi-Tenant Handshake', () => {
  const TAI_URL = 'http://localhost:4200';
  const ACME_URL = 'http://acme.localhost:4200';

  test('TAI (Default): Should complete full OIDC handshake', async ({ page }) => {
    // 1. Start at the Portal
    await page.goto(TAI_URL);
    
    // 2. Trigger Login
    await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
    
    // 3. Verify we are on the Identity UI and OIDC params
    await expect(page).toHaveURL(/.*:4300\/login.*/);
    // The redirect_uri is nested inside returnUrl, so it's double-encoded.
    expect(page.url()).toContain('redirect_uri%3Dhttp%253A%252F%252Flocalhost%253A4200');
    
    // 4. Perform Login
    await page.getByLabel(/Corporate Email/i).fill('admin@tai.com');
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();

    // 5. Verify redirect back to Portal
    await expect(page).toHaveURL(TAI_URL + '/', { timeout: 15000 });
    
    // 6. Verify authenticated state
    // We wait for the sidebar to be visible as a proxy for the app shell rendering
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 10000 });
    
    // Verify a known menu item exists. 
    await expect(page.locator('.sidebar-menu-item-label')).toContainText(['Collections']);
  });

  test('ACME (Subdomain): Should resolve context and complete handshake', async ({ page }) => {
    // 1. Start at the ACME Subdomain
    await page.goto(ACME_URL);
    
    // 2. Trigger Login
    await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
    
    // 3. Verify Identity UI preserves the 'acme.localhost' host
    await expect(page).toHaveURL(/.*acme\.localhost:4300\/login.*/);
    expect(page.url()).toContain('redirect_uri%3Dhttp%253A%252F%252Facme.localhost%253A4200');
    
    // 4. Perform Login (using ACME admin)
    await page.getByLabel(/Corporate Email/i).fill('admin@acme.com');
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();

    // 5. Verify redirect back to ACME Portal
    await expect(page).toHaveURL(ACME_URL + '/', { timeout: 15000 });
    
    // 6. Verify authenticated state
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.sidebar-menu-item-label')).toContainText(['Payments']);

    // 7. Verification of Tenant Context via Gateway Diagnostic
    // We hit the API through the Gateway to see the resolved Host header.
    // The DiagController returns JSON with a "host" property.
    await page.goto(`http://acme.localhost:5217/identity/diag/headers`);
    const content = await page.textContent('body');
    // We check that the API sees the host as 'acme.localhost:5217'
    expect(content).toContain('"host":"acme.localhost:5217"');
  });

  test('ACME (Subdomain): Should reject TAI Admin login (Cross-Tenant Isolation)', async ({ page }) => {
    // 1. Start at the ACME Subdomain
    await page.goto(ACME_URL);
    
    // 2. Trigger Login
    await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
    
    // 3. Verify Identity UI
    await expect(page).toHaveURL(/.*acme\.localhost:4300\/login.*/);
    
    // 4. Perform Login with TAI Admin credentials on ACME portal
    await page.getByLabel(/Corporate Email/i).fill('admin@tai.com');
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();

    // 5. Verify that we STAY on the login page and an error message is displayed
    // In our POC, the API redirects back with ?error=invalid_credentials
    await expect(page).toHaveURL(/.*acme\.localhost:4300\/login\?returnUrl=.*&error=invalid_credentials/);
    
    // 6. Verify the visual error message in the UI
    await expect(page.locator('.error-alert')).toBeVisible();
    await expect(page.locator('.error-alert')).toContainText(/Invalid login attempt/i);

    // 7. Verify we are NOT in the portal (sidebar is not visible)
    await expect(page.locator('tai-sidebar')).not.toBeVisible();
  });
});
