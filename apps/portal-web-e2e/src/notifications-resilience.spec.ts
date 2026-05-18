import { expect, test } from '@playwright/test';
import { injectAuthSession } from './test-utils';
import * as path from 'path';

// Use storageState for browser auth (cookies/localStorage)
test.use({ storageState: path.resolve(__dirname, '../.auth/acme-admin.json') });

test('reconnect rehydration recovers missed privilege events', async ({ page }) => {
  // Inject OIDC session state into sessionStorage (ACME tenant)
  await injectAuthSession(page, 'acme-session.json');

  // Mock the initial notification history API to return empty (for initial hydration)
  // We'll unroute this later so reconnect recovery can fetch real data
  await page.route('**/api/AuditLogs/recent?limit=50', route => route.fulfill({ status: 200, json: [] }));

  // Navigate to ACME portal privileges page
  await page.goto('http://acme.localhost:4200/admin/privileges');
  await expect(page).toHaveURL(/.*\/admin\/privileges/);
  await expect(page.locator('tai-sidebar')).toBeVisible();

  // Wait for table to load
  await expect(page.getByTestId('table-loading')).toBeHidden();
  await expect(page.locator('[data-testid^="action-menu-"]').first()).toBeVisible();

  await page.getByRole('button', { name: /toggle notifications/i }).click();

  // Wait for initial hydration to complete (empty state shows from mock)
  await expect(page.getByText('All caught up! No recent notifications')).toBeVisible({ timeout: 5000 });

  // Set disconnected state - banner should show
  await page.evaluate(() => {
    window.__testConnectionStateOverride__('Disconnected');
  });

  await expect(page.getByText('Notification updates are offline. Recent items may be stale.')).toBeVisible();

  await page.getByRole('button', { name: /close notifications panel/i }).click();

  // Remove the mock so subsequent API calls go to real backend
  await page.unroute('**/api/AuditLogs/recent?limit=50');

  // Search for a privilege that exists in seeded data
  const privilegeName = 'Portal.Users.Read';
  await page.getByPlaceholder(/search privileges/i).fill(privilegeName);
  await page.waitForResponse(res => res.url().includes('/api/privileges') && res.status() === 200);

  // Wait for table to show filtered results
  await expect(page.getByTestId('table-loading')).toBeHidden();
  await expect(page.locator('[data-testid^="action-menu-"]').first()).toBeVisible({ timeout: 5000 });

  // Open the action menu and click edit
  await page.locator('[data-testid^="action-menu-"]').first().click();
  const editMenuItem = page.getByRole('menuitem', { name: /edit/i });
  await expect(editMenuItem).toBeVisible({ timeout: 10000 });
  await editMenuItem.click({ force: true });

  // Wait for navigation to detail page
  await page.waitForURL(/.*\/admin\/privileges\/.*/, { timeout: 10000 });
  await expect(page.getByTestId('edit-form')).toBeVisible();

  // Edit the description (backend will create audit log)
  await page.getByLabel(/description/i).fill(`Reconnect recovery test update`);

  // Route to inject headers for the save request
  await page.route('**/api/privileges/**', async route => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'X-Step-Up-Verified': 'true',
      },
    });
  });

  // Save the changes (this triggers the notification via backend)
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByTestId('read-only-view')).toBeVisible({ timeout: 5000 });

  // Open panel and reconnect - this triggers forceRetry which fetches from real backend
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await page.evaluate(() => {
    window.__testConnectionStateOverride__('Connected');
  });

  // Expect "privilege modified" notification to appear from reconnect recovery fetch
  // This verifies the key behavior: notifications created during disconnect are recovered
  // Use .first() to avoid strict mode violation if multiple notifications match
  await expect(page.getByTestId('notification-item').filter({ hasText: 'privilege modified' }).first()).toBeVisible({ timeout: 10000 });
});