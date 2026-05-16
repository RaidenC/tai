import { expect, test } from '@playwright/test';
import { injectAuthSession } from './test-utils';

test('initial loading and reconnect syncing use different visuals', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.route('**/api/AuditLogs/recent?limit=50', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.fulfill({ status: 200, json: [] });
  });

  await page.goto('http://acme.localhost:4200/admin/privileges');
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(page.locator('.skeleton-item')).toHaveCount(3);
  await expect(page.getByText('All caught up! No recent notifications')).toBeVisible();

  await page.evaluate(() => window.__testConnectionStateOverride__('Reconnecting'));
  await expect(page.getByText('Syncing notifications...')).toBeVisible();
  await expect(page.locator('.skeleton-item')).toHaveCount(0);
});

test('connected banner is suppressed for healthy empty state', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.route('**/api/AuditLogs/recent?limit=50', route => route.fulfill({ status: 200, json: [] }));
  await page.goto('http://acme.localhost:4200/admin/privileges');
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(page.getByText('All caught up! No recent notifications')).toBeVisible();
  await expect(page.getByText('Notifications are live.')).toBeHidden();
});
