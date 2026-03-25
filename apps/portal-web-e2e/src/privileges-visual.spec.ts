import { test, expect } from '@playwright/test';
import { injectAuthSession } from './test-utils';
import * as path from 'path';

test.describe('Privileges Visual Regression E2E', () => {
  const BASE_URL = 'http://localhost:4200';

  test.use({ storageState: path.resolve(__dirname, '../.auth/user.json') });

  test.beforeEach(async ({ page }) => {
    await injectAuthSession(page, 'session.json');
    await page.goto(`${BASE_URL}/admin/privileges`);
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 30000 });
  });

  test('visual snapshot - catalog main view', async ({ page }) => {
    const table = page.getByTestId('data-table');
    await expect(table).toBeVisible();
    
    // Take a full page snapshot or component snapshot
    await expect(page).toHaveScreenshot('privileges-catalog-main.png', {
        mask: [page.locator('[data-testid^="row-id-"]')], // Mask dynamic IDs if any
        maxDiffPixelRatio: 0.05,
        threshold: 0.2
    });
  });

  test('visual snapshot - long privilege name layout', async ({ page }) => {
    const searchInput = page.getByTestId('privilege-search-input');
    await searchInput.fill('Portal.Users.ReallyLongNameThatMightBreakTheUILayout');
    
    await expect(page).toHaveURL(/search=Portal.Users.ReallyLongNameThatMightBreakTheUILayout/);
    const table = page.getByTestId('data-table');
    await expect(table).toBeVisible();

    // Verify row is rendered and take snapshot to check for truncation/wrapping
    const row = table.locator('tr', { hasText: 'Portal.Users.ReallyLongNameThatMightBreakTheUILayout' });
    await expect(row).toBeVisible();
    
    await expect(row).toHaveScreenshot('privilege-long-name-row.png', {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2
    });
  });

  test('visual snapshot - extreme hierarchical depth', async ({ page }) => {
    const searchInput = page.getByTestId('privilege-search-input');
    await searchInput.fill('A.B.C.D.E.F.G.H.I.J.K');
    
    await expect(page).toHaveURL(/search=A.B.C.D.E.F.G.H.I.J.K/);
    const table = page.getByTestId('data-table');
    await expect(table).toBeVisible();

    const row = table.locator('tr', { hasText: 'A.B.C.D.E.F.G.H.I.J.K' });
    await expect(row).toBeVisible();
    
    await expect(row).toHaveScreenshot('privilege-extreme-depth-row.png', {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2
    });
  });
});
