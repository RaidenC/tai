import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { injectAuthSession } from './test-utils';

test('reconnect rehydration recovers missed privilege events', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.goto('http://acme.localhost:4200/admin/privileges');
  await page.getByRole('button', { name: /toggle notifications/i }).click();

  await page.evaluate(() => {
    window.__testConnectionStateOverride__('Disconnected');
  });

  await expect(page.getByText('Notification updates are offline. Recent items may be stale.')).toBeVisible();

  const correlationId = uuidv4();
  await page.getByRole('button', { name: /close notifications panel/i }).click();
  await page.route('**/api/privileges/**', async route => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'X-Correlation-ID': correlationId,
        'X-Step-Up-Verified': 'true',
      },
    });
  });

  await page.getByPlaceholder(/search privileges/i).fill('Portal.Users.Read');
  await page.getByRole('button', { name: /edit/i }).first().click();
  await page.getByLabel(/description/i).fill(`Reconnect recovery update ${correlationId}`);
  await page.getByRole('button', { name: /save changes/i }).click();

  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await page.evaluate(() => {
    window.__testConnectionStateOverride__('Connected');
  });

  await expect(page.getByTestId('notification-item').filter({ hasText: correlationId })).toBeVisible({ timeout: 10000 });
});
