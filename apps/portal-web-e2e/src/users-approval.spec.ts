import { test, expect } from '@playwright/test';
import * as path from 'path';
import { injectAuthSession, seedTestUser } from './test-utils';

/**
 * Users Approval Workflow E2E Tests
 * 
 * Persona: Tenant Administrator
 * Context: Approving a pending user registration.
 */
test.describe('Users Approval Workflow', () => {
  const TAI_URL = 'http://localhost:4200';
  const authFile = path.join(__dirname, '../.auth/user.json');

  test.use({ storageState: authFile });

  test('should approve a pending user successfully', async ({ page, request }) => {
    // 1. Arrange: Seed a pending user via API
    const uniqueId = Date.now();
    const testEmail = `pending_${uniqueId}@tai.com`;
    const firstName = `Pending_${uniqueId}`;
    
    await seedTestUser(request, {
        email: testEmail,
        firstName: firstName,
        lastName: 'User',
        status: 1 // PendingApproval
    });

    // 2. Inject global auth state (SessionStorage)
    await injectAuthSession(page);

    // 3. Navigate directly to the portal
    await page.goto(TAI_URL);

    // 4. Navigate to Users
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 15000 });
    await page.getByRole('menuitem', { name: /Users/i }).click();
    await expect(page).toHaveURL(/\/users/);

    // 5. Find the specific pending user and click approve
    const dataTable = page.getByTestId('data-table');
    await expect(dataTable).toBeVisible();

    // Use search to find our specific user (avoids pagination issues)
    const searchInput = page.getByPlaceholder(/Search users/i);
    await searchInput.fill(testEmail);
    // Wait for the table to filter
    await expect(page.locator('tr', { hasText: testEmail })).toBeVisible({ timeout: 10000 });

    // Find the row for our specific user
    const row = page.locator('tr', { hasText: testEmail });
    await expect(row).toContainText('Pending');

    // Trigger the action menu for this specific user
    const actionMenuTrigger = row.locator('[data-testid^="action-menu-trigger-"]');
    await actionMenuTrigger.click();
    
    const approveAction = page.getByTestId('action-approve');
    await expect(approveAction).toBeVisible();
    await approveAction.click();
    
    // 6. Verify Modal opens
    const dialog = page.locator('tai-confirmation-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Approve User Registration');
    
    // 7. Confirm Approval
    await page.getByRole('button', { name: 'Approve User' }).click();
    
    // 8. Verify Modal closes and status updates
    await expect(dialog).toBeHidden();
    
    // Status should now be 'PendingVerification' as per domain logic (Approving PendingApproval leads to PendingVerification)
    await expect(row).toContainText(/Verification/i);
  });
});
