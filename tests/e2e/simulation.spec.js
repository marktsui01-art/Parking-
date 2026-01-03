import { test, expect } from '@playwright/test';

test('simulation drives car forward', async ({ page }) => {
  await page.goto('/');

  // Start Level 1
  await page.getByRole('button', { name: 'Level 1: The Basics' }).click();

  // Wait for game to switch to PLAYING
  // We can check if Level Chooser is hidden
  await expect(page.locator('#level-chooser')).toBeHidden();

  // Get initial position from window.game object
  const initialX = await page.evaluate(() => window.game.pos.x);
  const initialY = await page.evaluate(() => window.game.pos.y);

  // Simulate pressing 'W' (Throttle)
  await page.keyboard.down('KeyW');

  // Wait for some frames (e.g. 500ms)
  await page.waitForTimeout(500);

  // Release key
  await page.keyboard.up('KeyW');

  // Get new position
  const newX = await page.evaluate(() => window.game.pos.x);
  const newY = await page.evaluate(() => window.game.pos.y);

  // Assert movement happened
  // Level 1 starts at 72, 300, heading 0 (East).
  // Throttle should increase X.
  expect(newX).toBeGreaterThan(initialX);

  // Y should remain roughly same (no steering)
  expect(Math.abs(newY - initialY)).toBeLessThan(1);
});
