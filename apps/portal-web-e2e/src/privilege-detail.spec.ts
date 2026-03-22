import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { injectAuthSession } from './test-utils';

test.describe('Privilege Detail & Edit Page E2E', () => {
  const BASE_URL = 'http://localhost:4200';

  // Use the TAI Admin storage state from the setup project
  test.use({ storageState: '.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // 1. Inject session storage (OIDC state etc)
    await injectAuthSession(page, 'session.json');

    // 2. Navigate to Privileges Catalog
    await page.goto(`${BASE_URL}/admin/privileges`);
    
    // 3. Verify page loaded and sidebar is visible (ensures we are logged in)
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Privilege Catalog');
    
    // 4. Search for a known privilege to get a stable row
    const searchInput = page.getByTestId('privilege-search-input');
    await searchInput.fill('Portal.Users.Read');
    await expect(page).toHaveURL(/search=Portal.Users.Read/);
    
    // 5. Open Action Menu and click Edit
    const firstActionTrigger = page.locator('[data-testid^="action-menu-trigger-"]').first();
    await firstActionTrigger.click();
    
    const editAction = page.getByTestId('action-edit');
    await editAction.click();

    // 6. Verify we are on the detail page
    await expect(page).toHaveURL(/\/admin\/privileges\/[0-9a-f-]{36}/);
    await expect(page.locator('h1')).toContainText('Privilege Details');
    
    // Inject Axe for all tests
    await injectAxe(page);
  });

  test('should pass accessibility checks on detail page', async ({ page }) => {
    await expect(page.getByTestId('privilege-card')).toBeVisible();
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
  });

  test('should display privilege details accurately', async ({ page }) => {
    await expect(page.getByTestId('display-name')).toContainText('Portal.Users.Read');
    await expect(page.getByTestId('display-module')).toHaveText('Portal');
    await expect(page.getByTestId('display-riskLevel')).toHaveText('Low');
    await expect(page.getByTestId('display-description')).toContainText('View user accounts and profiles');
    await expect(page.getByTestId('display-status')).toHaveText('Active');
  });

  test('should support editing and saving changes', async ({ page }) => {
    // 1. Enter Edit Mode
    await page.getByTestId('edit-button').click();
    await expect(page.getByTestId('edit-form')).toBeVisible();

    // 2. Verify immutable fields are disabled
    await expect(page.getByTestId('input-name')).toBeDisabled();
    await expect(page.getByTestId('input-module')).toBeDisabled();

    // 3. Modify description and risk level
    const newDescription = 'Updated description for E2E test ' + Date.now();
    await page.getByTestId('input-description').fill(newDescription);
    await page.getByTestId('input-riskLevel').selectOption({ label: 'High' });

    // 4. Save Changes
    await page.getByTestId('save-button').click();

    // 5. Verify return to read-only mode and updated data
    await expect(page.getByTestId('read-only-view')).toBeVisible();
    await expect(page.getByTestId('display-description')).toHaveText(newDescription);
    await expect(page.getByTestId('display-riskLevel')).toHaveText('High');
  });

  test('should navigate back to catalog', async ({ page }) => {
    await page.getByTestId('back-button').click();
    await expect(page).toHaveURL(/\/admin\/privileges/);
    await expect(page.locator('h1')).toContainText('Privilege Catalog');
  });

  test('should support cancelling edits', async ({ page }) => {
    const originalDescription = await page.getByTestId('display-description').innerText();
    
    await page.getByTestId('edit-button').click();
    await page.getByTestId('input-description').fill('TEMP CHANGE');
    await page.getByTestId('cancel-button').click();

    await expect(page.getByTestId('read-only-view')).toBeVisible();
    await expect(page.getByTestId('display-description')).toHaveText(originalDescription);
  });
});
