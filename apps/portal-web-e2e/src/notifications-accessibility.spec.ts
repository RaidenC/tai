import { expect, test } from '@playwright/test';
import { injectAuthSession } from './test-utils';

test('keyboard user can open, filter, search, navigate, and close notifications', async ({ page }) => {
  await injectAuthSession(page, 'acme-session.json');
  await page.goto('http://acme.localhost:4200/admin/privileges');

  await page.getByRole('button', { name: /toggle notifications/i }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible();
  await expect(page.getByLabel('Search notifications')).toBeFocused();

  await page.keyboard.type('privilege');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Search notifications')).toHaveValue('');
  await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible();

  await page.getByRole('button', { name: 'Critical' }).click();
  await expect(page.getByRole('button', { name: 'Critical' })).toHaveAttribute('aria-pressed', 'true');

  const dialog = page.getByRole('dialog', { name: /notifications/i });
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const activeInsideDialog = await dialog.evaluate((node) => node.contains(document.activeElement));
    expect(activeInsideDialog).toBe(true);
  }

  await page.getByRole('button', { name: /close notifications panel/i }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /toggle notifications/i })).toBeFocused();

  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(dialog).toBeVisible();
  await page.locator('.panel-overlay').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /toggle notifications/i })).toBeFocused();

  await page.getByRole('button', { name: /toggle notifications/i }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /notifications/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /toggle notifications/i })).toBeFocused();
});
