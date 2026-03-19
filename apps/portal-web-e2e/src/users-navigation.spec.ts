import { test, expect } from '@playwright/test';
import * as path from 'path';
import { injectAuthSession } from './test-utils';

/**
 * Users Navigation & URL State E2E Tests
 * 
 * Persona: Tenant Administrator
 * Context: Managing a large directory of users requires stable navigation.
 * 
 * Requirement: URL MUST be the source of truth for pagination, sorting, and filtering.
 */
test.describe('Users Page Navigation', () => {
  const TAI_URL = 'http://localhost:4200';
  const authFile = path.join(__dirname, '../.auth/user.json');

  test.use({ storageState: authFile });

  test.beforeEach(async ({ page }) => {
    // 1. Inject global auth state (SessionStorage)
    await injectAuthSession(page);

    // 2. Navigate directly to Users
    await page.goto(TAI_URL);
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 15000 });
    await page.getByRole('menuitem', { name: /Users/i }).click();
    await expect(page).toHaveURL(/\/users/);
    await expect(page.getByTestId('data-table')).toBeVisible();
  });

  test('Pagination: should update URL and persist on refresh', async ({ page }) => {
    // Ensure we are on page 1
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByTestId('pagination-summary')).toContainText(/Showing 1 to 10/);

    // 1. Click Next
    await page.getByTestId('pagination-next').click();

    // 2. Verify URL updated
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('pagination-summary')).toContainText(/Showing 11 to (20|\d+) of \d+/);

    // 3. Refresh the browser
    await page.reload();

    // 4. Verify state restored from URL
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('pagination-summary')).toContainText(/Showing 11 to (20|\d+) of \d+/);
  });

  test('Sorting: should update URL and persist on refresh', async ({ page }) => {
    // 1. Click "Name" column to sort
    // The spec requires sorting to be URL-driven.
    await page.getByTestId('sort-button-name').click();

    // 2. Verify URL updated to sort by name asc (first click default)
    await expect(page).toHaveURL(/sort=name&dir=asc/);

    // 3. Refresh the browser
    await page.reload();

    // 4. Verify state restored from URL
    await expect(page).toHaveURL(/sort=name&dir=asc/);
    // Verify the visual indicator in the table header
    await expect(page.getByTestId('sort-button-name')).toContainText('↑');
  });

  test('Filtering: should reset pagination to page 1', async ({ page }) => {
    // 1. Go to page 2 first
    await page.getByTestId('pagination-next').click();
    await expect(page).toHaveURL(/page=2/);

    // 2. Apply a filter (assuming search input exists or we add one)
    // For now, let's assume we implement a search filter as per spec requirement
    const searchInput = page.getByPlaceholder(/Search users/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Admin');

    // 3. Verify URL reset to page 1
    await expect(page).toHaveURL(/page=1/);
    await expect(page).toHaveURL(/search=Admin/);
  });
});
