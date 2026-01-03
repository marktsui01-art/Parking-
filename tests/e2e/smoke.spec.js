import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/2D Kinematic Parking Simulator/);
});

test('canvas exists', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('#gameCanvas');
    await expect(canvas).toBeVisible();
});

test('UI layer exists', async ({ page }) => {
    await page.goto('/');
    const ui = page.locator('#ui-layer');
    await expect(ui).toBeVisible();
});
