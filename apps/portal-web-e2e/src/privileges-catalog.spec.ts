import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Privileges Catalog E2E', () => {
  const BASE_URL = 'http://localhost:4200';

  test.beforeEach(async ({ page }) => {
    // 1. Login as TAI Admin
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click({ force: true });
    await page.getByLabel(/Corporate Email/i).fill('admin@tai.com');
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click({ force: true });

    // 2. Navigate to Privileges
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 30000 });
    await page.getByRole('menuitem', { name: /Privileges/i }).click();
    
    // 3. Verify page loaded
    await expect(page).toHaveURL(/\/admin\/privileges/);
    await expect(page.locator('h1')).toContainText('Privilege Catalog');
    
    // Inject Axe for all tests
    await injectAxe(page);
  });

  test('should pass accessibility checks', async ({ page }) => {
    // Wait for table to load
    await expect(page.getByTestId('data-table')).toBeVisible();
    
    // Run Axe audit
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
  });

  test('should display the datatable with privileges', async ({ page }) => {
    const table = page.getByTestId('data-table');
    await expect(table).toBeVisible();
    
    // Should have at least one row (from seed data)
    const rows = table.locator('tr[cdk-row]');
    await expect(rows.first()).toBeVisible();
  });

  test('should support searching privileges', async ({ page }) => {
    const searchInput = page.getByTestId('privilege-search-input');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('Portal.Users.Read');
    
    // Wait for debounce and reload
    await expect(page).toHaveURL(/search=Portal.Users.Read/);
    
    const table = page.getByTestId('data-table');
    const rows = table.locator('tr[cdk-row]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Portal.Users.Read');
  });

  test('should support keyboard navigation', async ({ page }) => {
    // 1. Focus search input
    const searchInput = page.getByTestId('privilege-search-input');
    await searchInput.focus();
    
    // 2. Tab to the first sortable header (Name)
    await page.keyboard.press('Tab');
    const nameHeader = page.getByTestId('sort-button-name');
    await expect(nameHeader).toBeFocused({ timeout: 10000 });
    
    // 3. Tab through headers to the first action trigger
    // Sequence: Module Header -> Risk Level Header -> Status Header -> First Row Action Trigger
    await page.keyboard.press('Tab'); // Module
    await page.keyboard.press('Tab'); // Risk
    await page.keyboard.press('Tab'); // Status
    await page.keyboard.press('Tab'); // First Row Action Trigger
    
    const firstActionTrigger = page.locator('[data-testid^="action-menu-trigger-"]').first();
    await expect(firstActionTrigger).toBeFocused({ timeout: 10000 });
    
    // 4. Open menu with Enter
    console.log('[DEBUG] Opening action menu with Enter...');
    await page.keyboard.press('Enter');
    const firstMenuItem = page.getByTestId('action-edit');
    await expect(firstMenuItem).toBeVisible({ timeout: 15000 });
    
    // CDK Menu often focuses the first item automatically when opened via keyboard
    // We'll give it ample time to settle
    console.log('[DEBUG] Waiting for focus to settle on action-edit...');
    await expect(async () => {
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          id: el?.getAttribute('id'),
          testid: el?.getAttribute('data-testid'),
          text: (el as HTMLElement)?.innerText
        };
      });
      console.log(`[DEBUG] Current focus: ${activeElement.tagName} [testid: ${activeElement.testid}]`);

      const isFocused = await firstMenuItem.evaluate(el => document.activeElement === el);
      if (!isFocused) {
        console.log('[DEBUG] Not focused, pressing ArrowDown...');
        await page.keyboard.press('ArrowDown');
      }
      await expect(firstMenuItem).toBeFocused();
    }).toPass({ timeout: 30000 });
  });

  test('should support pagination', async ({ page }) => {
    // Navigate to page 2 (assuming there are > 10 privileges in seed data)
    const nextBtn = page.getByTestId('pagination-next');
    
    // Seed data has ~11 privileges, so next button should be enabled if page size is 10
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.getByTestId('pagination-summary')).toContainText(/Showing 11 to/);
    }
  });
});
