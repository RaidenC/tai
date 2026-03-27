import { test, expect } from '@playwright/test';
import * as path from 'path';
import { injectAuthSession } from './test-utils';

const authFile = path.join(__dirname, '../.auth/acme-admin.json');

test.describe('User Privileges Negative E2E (409 Conflict)', () => {
  test.use({ storageState: authFile });

  test('should handle 409 Conflict during user update', async ({ page }) => {
    // 1. Inject Session Storage
    await injectAuthSession(page, 'acme-session.json');

    // 2. Navigate to User Directory
    await page.goto('http://acme.localhost:4200/users');
    
    // 3. Find a user (user1@acme.com)
    const userEmail = 'user1@acme.com';
    await page.getByPlaceholder(/search users/i).fill(userEmail);
    await page.waitForResponse(res => res.url().includes('/api/users') && res.status() === 200);

    const row = page.locator('tr').filter({ hasText: userEmail });
    await row.getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /view details/i }).click();
    
    await expect(page).toHaveURL(/.*\/users\/.*/);

    // Wait for user data to load
    await expect(page.getByTestId('loading-indicator')).not.toBeVisible();

    // 4. Enter Edit Mode
    await page.getByTestId('edit-button').click();
    await expect(page.getByTestId('edit-form')).toBeVisible();

    // 5. Change something
    const firstNameInput = page.getByTestId('input-firstName');
    const originalValue = await firstNameInput.inputValue();
    await firstNameInput.fill(originalValue + ' Modified');

    // 6. Intercept PUT request to return 409 Conflict
    await page.route('**/api/users/*', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'This record has been modified by another user. Please refresh and try again.'
          })
        });
      } else {
        await route.continue();
      }
    });

    // 7. Save Changes and expect 409
    await page.getByTestId('save-button').click();

    // 8. Verify conflict alert
    const conflictAlert = page.getByTestId('conflict-alert');
    await expect(conflictAlert).toBeVisible();
    await expect(conflictAlert).toContainText(/concurrency conflict/i);

    // 9. Intercept the GET request to return "new" data (simulating another user's change)
    const updatedFirstName = originalValue + ' External Change';
    await page.route('**/api/users/*', async (route) => {
      if (route.request().method() === 'GET') {
        // Use 127.0.0.1 instead of acme.localhost for Node.js fetch
        const url = route.request().url().replace('acme.localhost', '127.0.0.1');
        const response = await route.fetch({
          url,
          headers: {
            ...route.request().headers(),
            'Host': 'acme.localhost'
          }
        });
        const json = await response.json();
        json.firstName = updatedFirstName;
        json.rowVersion = json.rowVersion + 1; // Increment row version
        await route.fulfill({ json });
      } else {
        await route.continue();
      }
    });

    // 10. Click "Refresh data and try again"
    await page.getByText(/refresh data and try again/i).click();

    // 11. Verify conflict alert is gone
    await expect(conflictAlert).not.toBeVisible();

    // 12. Verify form is updated with the "External Change" data
    await expect(firstNameInput).toHaveValue(updatedFirstName);
    
    // 13. Verify we are still in edit mode (the form should be visible)
    await expect(page.getByTestId('edit-form')).toBeVisible();
  });
});
