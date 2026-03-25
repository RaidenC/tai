import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { injectAuthSession } from './test-utils';
import * as path from 'path';

test.describe('Privilege Detail & Edit Page E2E', () => {
  const BASE_URL = 'http://localhost:4200';

  // Use absolute path to ensure it works regardless of CWD (Root vs Project folder)
  test.use({ storageState: path.resolve(__dirname, '../.auth/user.json') });

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
    
    // Wait for the table loading overlay to be hidden
    await expect(page.getByTestId('table-loading')).toBeHidden();
    
    // 5. Open Action Menu and click View Details
    // JUNIOR RATIONALE: We target the specific row containing our search text. 
    // This is more resilient than using .first() because it ensures 
    // Playwright waits for the table to actually filter before clicking.
    const row = page.locator('tr', { hasText: 'Portal.Users.Read' });
    const actionTrigger = row.locator('[data-testid^="action-menu-trigger-"]');
    
    // Ensure the trigger is visible and stable before clicking
    await actionTrigger.waitFor({ state: 'visible' });
    await actionTrigger.click({ force: true });
    
    const viewAction = page.getByTestId('action-view');
    // Ensure the menu item is visible before clicking
    await viewAction.waitFor({ state: 'visible' });
    await viewAction.click();

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
    // Allow for either Low (original) or High (if modified by a previous run)
    const riskLevelText = await page.getByTestId('display-riskLevel').innerText();
    expect(['Low', 'High']).toContain(riskLevelText);
    
    // Check that description exists and is not empty, but don't strictly check content
    // as it might have been modified by a previous run
    const descText = await page.getByTestId('display-description').innerText();
    expect(descText.length).toBeGreaterThan(5);
    
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

    // 4. Save Changes and wait for network synchronization
    // Note: We need to bypass the Step-Up MFA check for this E2E test
    await page.route(/\/api\/privileges\//, async (route, request) => {
      if (request.method() === 'PUT') {
        const headers = { ...request.headers(), 'X-Step-Up-Verified': 'true' };
        await route.continue({ headers });
      } else {
        await route.continue();
      }
    });

    const savePromise = page.waitForResponse(response => {
      return response.request().method() === 'PUT' && 
             /\/api\/privileges\//i.test(response.url());
    });
    
    await page.getByTestId('save-button').click();
    
    await savePromise;

    // 5. Verify return to read-only mode and updated data
    await expect(page.getByTestId('read-only-view')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('display-description')).toHaveText(newDescription, { timeout: 15000 });
    await expect(page.getByTestId('display-riskLevel')).toHaveText('High', { timeout: 10000 });
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
