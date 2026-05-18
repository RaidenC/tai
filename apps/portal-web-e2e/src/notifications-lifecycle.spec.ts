import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { injectAuthSession } from './test-utils';

const authFile = path.join(__dirname, '../.auth/acme-admin.json');

test.describe('notification lifecycle', () => {
  test.use({ storageState: authFile });

  test('persists read and acknowledged state across refresh', async ({ page }) => {
    // 1. Inject Session Storage (Required by BFF to maintain OIDC state in Angular)
    await injectAuthSession(page, 'acme-session.json');

    // 2. Navigate to ACME portal privileges page
    await page.goto('http://acme.localhost:4200/admin/privileges');
    await expect(page).toHaveURL(/.*\/admin\/privileges/);
    await expect(page.locator('tai-sidebar')).toBeVisible();

    // 3. Select a privilege to edit
    const privilegeName = 'Portal.Users.Read';
    await page.getByPlaceholder(/search privileges/i).fill(privilegeName);
    await page.waitForResponse(res => res.url().includes('/api/privileges') && res.status() === 200);
    await expect(page.getByTestId('table-loading')).toBeHidden();
    await expect(page.locator('[data-testid^="action-menu-"]').first()).toBeVisible();

    // 4. Open the action menu and click edit
    await page.locator('[data-testid^="action-menu-"]').first().click();
    const editMenuItem = page.getByRole('menuitem', { name: /edit/i });
    await expect(editMenuItem).toBeVisible({ timeout: 10000 });
    await editMenuItem.click({ force: true });

    // 5. Wait for navigation to detail page
    await page.waitForURL(/.*\/admin\/privileges\/.*/, { timeout: 10000 });
    await expect(page.getByTestId('edit-form')).toBeVisible();

    // 6. Modify the privilege with a unique description for the notification
    const correlationId = uuidv4();
    const uniqueDescription = `Notification lifecycle update ${correlationId}`;
    await page.getByLabel(/description/i).fill(uniqueDescription);

    // Route to inject headers for the save request
    await page.route('**/api/privileges/**', async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          'X-Correlation-ID': correlationId,
          'X-Step-Up-Verified': 'true',
        },
      });
    });

    // 7. Save the changes (this triggers the notification via SignalR)
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByTestId('read-only-view')).toBeVisible();

    // 8. Open the notification panel
    const toggle = page.getByRole('button', { name: /toggle notifications/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // 9. Verify the notification panel is visible
    const panel = page.locator('tai-notification-panel .notification-panel');
    await expect(panel).toBeVisible();

    // 10. Wait for the new notification to appear via SignalR
    // The notification should contain the privilege name or the unique description
    // Poll for up to 30 seconds for the SignalR notification to arrive
    const notificationItem = panel.getByTestId('notification-item').filter({ hasText: /privilege/i }).first();

    // Wait for the notification to appear with a longer timeout
    // SignalR notifications may take a few seconds to propagate
    await expect(notificationItem).toBeVisible({ timeout: 30000 });

    // 11. Verify the unread badge is present on the toggle (indicates unread notifications exist)
    await expect(page.locator('.unread-badge')).toBeVisible();

    // 12. Mark the notification as read
    await notificationItem.getByRole('button', { name: /mark notification as read/i }).click();

    // Wait for the state to update (read marker should appear)
    await expect(notificationItem).toHaveAccessibleName(/read notification/i, { timeout: 5000 });

    // 13. If it's a critical notification, acknowledge it
    const acknowledgeButton = notificationItem.getByRole('button', { name: /acknowledge critical notification/i });
    const isCritical = await acknowledgeButton.isVisible();
    if (isCritical) {
      await acknowledgeButton.click();
      // Wait for acknowledge button to disappear (confirms state change)
      await expect(acknowledgeButton).toBeHidden({ timeout: 5000 });
      // Now verify acknowledged label appears
      await expect(notificationItem.getByLabel(/acknowledged notification/i)).toBeVisible({ timeout: 5000 });
    }

    // 14. Reload the page and verify state persistence
    await page.reload();
    await injectAuthSession(page, 'acme-session.json');

    // 15. Re-open the notification panel
    await page.getByRole('button', { name: /toggle notifications/i }).click();
    await expect(panel).toBeVisible({ timeout: 10000 });

    // 16. Verify the notification persists with correct read state
    // The notification should still be visible and marked as read
    const refreshedItem = panel.getByTestId('notification-item').filter({ hasText: /privilege/i }).first();
    await expect(refreshedItem).toBeVisible({ timeout: 10000 });
    await expect(refreshedItem).toHaveAccessibleName(/read notification/i, { timeout: 5000 });

    // 17. Verify acknowledged state persists (if it was acknowledged)
    if (isCritical) {
      await expect(refreshedItem.getByLabel(/acknowledged notification/i)).toBeVisible({ timeout: 5000 });
    }
  });
});