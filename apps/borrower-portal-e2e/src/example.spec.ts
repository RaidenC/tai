import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/claim/borrower-info');

  // Expect h1 to contain the disability claim title
  expect(await page.locator('h1').innerText()).toContain('Disability Claim');
});

test('shows step 1 borrower info form', async ({ page }) => {
  await page.goto('/claim/borrower-info');

  // Expect step 1 heading to be visible
  await expect(page.locator('h2:has-text("Borrower Information")')).toBeVisible();
});

test('stepper shows 4 steps', async ({ page }) => {
  await page.goto('/claim/borrower-info');

  const stepper = page.getByRole('navigation', { name: 'Claim progress' });
  await expect(stepper.getByRole('button', { name: /Borrower Info/ })).toBeVisible();
  await expect(stepper.getByRole('button', { name: /Incident Details/ })).toBeVisible();
  await expect(stepper.getByRole('button', { name: /Medical Providers/ })).toBeVisible();
  await expect(stepper.getByRole('button', { name: /Review & Sign/ })).toBeVisible();
  await expect(page.getByTestId('claim-stepper-step-borrower-info')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('claim-stepper-step-medical-providers')).toBeDisabled();
});
