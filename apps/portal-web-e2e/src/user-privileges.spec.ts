import { test, expect } from '@playwright/test';
import * as path from 'path';
import { injectAuthSession } from './test-utils';

const authFile = path.join(__dirname, '../.auth/acme-admin.json');

test.describe('User Privileges E2E', () => {
  test.use({ storageState: authFile });

  test('should assign privileges to a user via Transfer List', async ({ page }) => {
    // Capture console logs and network requests
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    page.on('request', request => {
      if (request.method() === 'PUT' && request.url().includes('/api/users/')) {
        console.log(`[NETWORK REQUEST] ${request.method()} ${request.url()}`);
        console.log(`[NETWORK PAYLOAD] ${request.postData()}`);
      }
    });

    page.on('response', async response => {
      if (response.request().method() === 'GET' && response.url().includes('/api/users/')) {
        try {
          const body = await response.json();
          console.log(`[NETWORK RESPONSE] ${response.status()} ${response.url()}`);
          console.log(`[NETWORK RESPONSE BODY] ${JSON.stringify(body)}`);
        } catch (e) {
          // Not JSON or already read
        }
      }
    });

    // 1. Inject Session Storage
    await injectAuthSession(page, 'acme-session.json');

    // 2. Navigate to User Directory
    await page.goto('http://acme.localhost:4200/users');
    await expect(page).toHaveURL(/.*\/users/);
    
    // 3. Search for and find a user (e.g., user1@acme.com)
    const userEmail = 'user1@acme.com';
    await page.getByPlaceholder(/search users/i).fill(userEmail);
    await page.waitForResponse(res => res.url().includes('/api/users') && res.status() === 200);

    const row = page.locator('tr').filter({ hasText: userEmail });
    await expect(row).toBeVisible();
    
    // Open Actions menu and click 'View Details'
    await row.getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /view details/i }).click();
    
    await expect(page).toHaveURL(/.*\/users\/.*/);

    // Wait for user data to load
    await expect(page.getByTestId('loading-indicator')).not.toBeVisible();
    await expect(page.getByTestId('user-profile-card')).toBeVisible();

    // 4. Verify Read-Only Privileges List is visible
    const viewPrivilegesList = page.locator('tai-transfer-list[data-testid="view-privileges-list"]');
    await expect(viewPrivilegesList).toBeVisible();

    // 5. Enter Edit Mode
    await page.getByTestId('edit-button').click();
    await expect(page.getByTestId('edit-form')).toBeVisible();

    // 6. Verify Edit Privileges List is visible and interactable
    const editPrivilegesList = page.getByTestId('edit-privileges-list');
    await expect(editPrivilegesList).toBeVisible();

    // 7. Move a privilege (e.g., Portal.Users.Create) from Available to Assigned
    const privilegeName = 'Portal.Users.Create';
    
    // Use search to ensure the item is in the list
    const availableSearch = editPrivilegesList.locator('input[type="text"]').first();
    await availableSearch.fill(privilegeName);
    
    // Wait for debounce (300ms) + rendering
    await page.waitForTimeout(500);

    const privilegeItem = editPrivilegesList.locator('li').filter({ hasText: privilegeName });
    
    await expect(privilegeItem).toBeVisible();
    await privilegeItem.dblclick();

    // Verify it moved to Assigned list
    // (In our component, it will be in the right pane now)
    
    // Clear search to see all assigned items
    await availableSearch.clear();
    await page.waitForTimeout(500);
    
    await expect(editPrivilegesList.locator('li').filter({ hasText: privilegeName })).toBeVisible();

    // 8. Save Changes
    await page.getByTestId('save-button').click();

    // 9. Verify success and return to Read-Only mode
    await expect(page.getByTestId('read-only-view')).toBeVisible();
    
    // 10. Verify the assigned privilege is shown in the Read-Only list
    const readOnlyAssignedList = page.getByTestId('view-privileges-list');
    await expect(readOnlyAssignedList.locator('li').filter({ hasText: privilegeName })).toBeVisible();
  });
});
