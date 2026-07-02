import { test, expect } from '@playwright/test';

/**
 * Smoke (Task 19, Step 1). The app boots, WebGL is live, and BEGIN drops into
 * play with a clean console.
 *
 * Runs against the VITE_E2E build served by playwright.config.ts's webServer —
 * that build exposes `window.__oathbrand.state` (an alias of the game state)
 * without the dev HUD, which is the only handle this test needs. The shipped
 * production bundle (no VITE_E2E, no ?dev=1) never exposes it.
 */
test('boots, WebGL live, BEGIN → playing, no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/oathbrand/');

  // Canvas present.
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // A WebGL context is live on one of the page's canvases (the renderer's).
  const hasWebGL = await page.evaluate(() => {
    for (const c of Array.from(document.querySelectorAll('canvas'))) {
      try {
        if (c.getContext('webgl2') ?? c.getContext('webgl')) return true;
      } catch {
        /* 2D canvases (the title's ash motes) reject a GL context — skip */
      }
    }
    return false;
  });
  expect(hasWebGL).toBe(true);

  // The E2E state handle is present (proves the VITE_E2E gate is wired).
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { __oathbrand?: { state?: unknown } }).__oathbrand?.state), {
      timeout: 10_000,
    })
    .toBe('string');

  // Fresh boot (no save) → the menu is [BEGIN, SETTINGS]. Click BEGIN.
  await page.getByRole('button', { name: 'BEGIN', exact: true }).click();

  // The game reaches 'playing' within 10s.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __oathbrand?: { state?: string } }).__oathbrand?.state), {
      timeout: 10_000,
    })
    .toBe('playing');

  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
