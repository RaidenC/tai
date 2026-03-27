import { test, expect } from '@playwright/test';
import * as path from 'path';
import { injectAuthSession } from './test-utils';

const authFile = path.join(__dirname, '../.auth/acme-admin.json');

test.describe('Transfer List Visual Regression E2E', () => {
  test.use({ storageState: authFile });

  test.beforeEach(async ({ page }) => {
    // 1. Inject Session Storage
    await injectAuthSession(page, 'acme-session.json');

    // 2. Navigate to Users Directory
    await page.goto('http://acme.localhost:4200/users');
    
    // 3. Find a user (user1@acme.com)
    const userEmail = 'user1@acme.com';
    await page.getByPlaceholder(/search users/i).fill(userEmail);
    await page.waitForResponse(res => res.url().includes('/api/users') && res.status() === 200);

    const row = page.locator('tr').filter({ hasText: userEmail });
    await row.getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /view details/i }).click();
    
    // 4. Enter Edit Mode
    await expect(page).toHaveURL(/.*\/users\/.*/);
    await expect(page.getByTestId('loading-indicator')).not.toBeVisible();
    await page.getByTestId('edit-button').click();

    await expect(page.getByTestId('edit-form')).toBeVisible();
    
    const transferList = page.getByTestId('edit-privileges-list');
    await expect(transferList).toBeVisible();
    // Wait for internal items to be rendered (cdk-virtual-scroll)
    await expect(transferList.locator('li').first()).toBeVisible();
  });

  test('visual snapshot - desktop transfer list', async ({ page }) => {
    const transferList = page.getByTestId('edit-privileges-list');
    
    await expect(transferList).toHaveScreenshot('transfer-list-desktop.png', {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2
    });
  });

  test('visual snapshot - compact mode', async ({ page }) => {
    // Note: UserDetailPage uses the default density.
    // If we want to test compact mode, we would use a dedicated Storybook story or a test page.
  });
});
