import { expect, test } from '@playwright/test';
import { injectAuthSession } from './test-utils';

test('initial loading and reconnect syncing use different visuals', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');

  // Delay API long enough for skeleton (300ms delay + 300ms min display) to be visible
  await page.route('**/api/AuditLogs/recent?limit=50', async route => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ status: 200, json: [] });
  });

  await page.goto('http://acme.localhost:4200/admin/privileges');
  await page.getByRole('button', { name: /toggle notifications/i }).click();

  // Skeleton should appear within 2s (300ms delay + buffer)
  await expect(page.locator('.skeleton-item').first()).toBeVisible({ timeout: 2000 });

  // After API resolves, skeleton should disappear and empty state appears
  await expect(page.getByText('All caught up! No recent notifications')).toBeVisible({ timeout: 3000 });

  // Now simulate full reconnection recovery flow:
  // 1. Set reconnecting state (shows amber banner)
  // 2. Set up delayed API route for the recovery fetch
  // 3. Transition to Connected (triggers forceRetry)
  // 4. Expect "Syncing notifications..." while API is in flight
  await page.evaluate(() => window.__testConnectionStateOverride__('Reconnecting'));
  // Amber banner should show during reconnecting phase
  await expect(page.getByText('Reconnecting to notification updates.')).toBeVisible({ timeout: 2000 });

  // Set up a new delayed route for the recovery fetch
  let recoveryResolve: () => void;
  const recoveryPromise = new Promise<void>(resolve => { recoveryResolve = resolve; });
  await page.route('**/api/AuditLogs/recent?limit=50', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fulfill({ status: 200, json: [] });
    recoveryResolve();
  });

  // Transition to Connected - this triggers forceRetry() which starts API fetch
  await page.evaluate(() => window.__testConnectionStateOverride__('Connected'));

  // During API fetch, should show "Syncing notifications..." (not skeleton)
  await expect(page.getByText('Syncing notifications...')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('.skeleton-item')).toHaveCount(0);

  // Wait for API to complete
  await recoveryPromise;

  // After recovery, syncing text disappears and empty state returns
  await expect(page.getByText('Syncing notifications...')).toBeHidden({ timeout: 3000 });
  await expect(page.getByText('All caught up! No recent notifications')).toBeVisible();
});

test('connected banner is suppressed for healthy empty state', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.route('**/api/AuditLogs/recent?limit=50', route => route.fulfill({ status: 200, json: [] }));
  await page.goto('http://acme.localhost:4200/admin/privileges');
  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(page.getByText('All caught up! No recent notifications')).toBeVisible();
  await expect(page.getByText('Notifications are live.')).toBeHidden();
});