import { test, expect } from '@playwright/test';

test.describe('Meridian Onboarding Platform E2E Suite', () => {
  test('Page HTML contains correct title tag', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Pathway|Onboarding|Meridian/i);
  });
});
