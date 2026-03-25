import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { injectAuthSession } from './test-utils';

const authFile = path.join(__dirname, '../.auth/acme-admin.json');

test.describe('Privileges Audit Trail E2E', () => {
  test.use({ storageState: authFile });

  test('should record audit log with correlation ID when privilege is modified', async ({ page, request }) => {
    // 1. Inject Session Storage (Required by BFF to maintain OIDC state in Angular)
    await injectAuthSession(page, 'acme-session.json');

    // 2. Navigate to ACME portal
    await page.goto('http://acme.localhost:4200/admin/privileges');
    await expect(page).toHaveURL(/.*\/admin\/privileges/);
    
    // Ensure we are authenticated
    await expect(page.locator('tai-sidebar')).toBeVisible();

    // 3. Select a privilege to edit (e.g., Portal.Users.Read)
    const privilegeName = 'Portal.Users.Read';
    await page.getByPlaceholder(/search privileges/i).fill(privilegeName);
    await page.waitForResponse(res => res.url().includes('/api/privileges') && res.status() === 200);
    
    // Locate the specific row and open Actions menu
    const row = page.locator('tr').filter({ hasText: privilegeName });
    const actionsTrigger = row.getByRole('button', { name: /actions/i });
    
    // Capture ID from the catalog row BEFORE navigating away
    const privilegeId = await actionsTrigger.getAttribute('data-testid').then(id => id?.replace('action-menu-trigger-', ''));
    expect(privilegeId).toBeDefined();

    await actionsTrigger.click();
    await page.getByRole('menuitem', { name: /edit/i }).click();
    
    await expect(page).toHaveURL(/.*\/admin\/privileges\/.*/);

    // 4. Modify the privilege and capture Correlation ID
    const correlationId = uuidv4();
    const description = `Updated description at ${new Date().toISOString()}`;
    
    await page.getByLabel(/description/i).fill(description);

    // We need to inject the X-Correlation-ID header into the save request
    await page.route('**/api/privileges/**', async (route) => {
      const headers = {
        ...route.request().headers(),
        'X-Correlation-ID': correlationId,
      };
      await route.continue({ headers });
    });

    // Save the changes
    await page.getByRole('button', { name: /save changes/i }).click();
    
    // Wait for success and redirection back to catalog (strict match)
    await expect(page).toHaveURL(/.*\/admin\/privileges$/);
    await expect(page.getByTestId('data-table')).toBeVisible();

    // 5. Verify Audit Log via Diagnostic API
    const GATEWAY_SECRET = process.env.GATEWAY_SECRET || 'portal-poc-secret-2026';

    // Use the diagnostic API to fetch logs for this resource.
    // Call API directly (5031) to avoid potential Gateway routing issues during test.
    const API_URL = process.env.CI ? 'http://127.0.0.1:5031' : 'http://localhost:5031';
    const auditLogsResponse = await request.get(`${API_URL}/diag/audit-logs/${privilegeId}`, {
        headers: {
            'X-Gateway-Secret': GATEWAY_SECRET
        }
    });
    expect(auditLogsResponse.ok()).toBeTruthy();
    
    const logs = await auditLogsResponse.json();
    
    // Verify we have a log entry with our correlation ID
    const relevantLog = logs.find((l: any) => l.action === 'PrivilegeModified' && l.correlationId === correlationId);
    
    expect(relevantLog).toBeDefined();
    expect(relevantLog.details).toContain(privilegeName);
    expect(relevantLog.userId).toBeDefined();
  });
});
