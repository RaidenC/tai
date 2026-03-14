import { test, expect } from '@playwright/test';

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

  test.beforeEach(async ({ page }) => {
    // 1. Login as TAI Admin
    await page.goto(TAI_URL);
    await page.getByRole('button', { name: /Sign In with TAI Identity/i }).click();
    await page.getByLabel(/Corporate Email/i).fill('admin@tai.com');
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();

    // 2. Navigate to Users
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
