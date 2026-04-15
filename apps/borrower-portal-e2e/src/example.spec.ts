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

  // Check stepper labels using more specific selectors
  const stepper = page.locator('.wizard-stepper');
  await expect(stepper.locator('.step-label:has-text("Borrower Info")')).toBeVisible();
  await expect(stepper.locator('.step-label:has-text("Incident Details")')).toBeVisible();
  await expect(stepper.locator('.step-label:has-text("Medical Providers")')).toBeVisible();
  await expect(stepper.locator('.step-label:has-text("Review & Sign")')).toBeVisible();
});
