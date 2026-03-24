import { test, expect } from '@playwright/test';
import { injectAuthSession } from './test-utils';
import * as path from 'path';

test.describe('Cross-Module Federation E2E', () => {
  const PORTAL_URL = 'http://localhost:4200';
  const DOCVIEWER_URL = 'http://localhost:4201'; // Assuming default port for second app

  test.use({ storageState: path.resolve(__dirname, '../.auth/user.json') });

  test('should share authentication state with DocViewer mock', async ({ page }) => {
    page.on('console', msg => console.log(`[FEDERATION BROWSER] ${msg.text()}`));
    // 1. First ensure we are logged in to the main Portal
    await injectAuthSession(page, 'session.json');
    await page.goto(PORTAL_URL);
    await expect(page.locator('tai-sidebar')).toBeVisible({ timeout: 30000 });

    // 2. Navigate to the DocViewer mock (Federated App)
    // In a real scenario, this might be a link or an iframe, here we just go to the URL.
    await page.goto(DOCVIEWER_URL);

    // 3. Verify DocViewer detects the same user session
    // We need to inject the session storage here too because OIDC state is in sessionStorage
    await injectAuthSession(page, 'session.json');
    await page.reload(); // Reload to pick up the injected session

    await expect(page.locator('h1')).toContainText('DocViewer Mock');
    await expect(page.locator('h3')).toContainText('Authenticated as: admin@tai.com');
    
    // 4. Verify privileges are correctly detected in the downstream app
    const privList = page.locator('ul');
    await expect(privList).toContainText('Portal.Privileges.Read');
    await expect(privList).toContainText('(Super User Bypass Active)');
  });
});
