import { test, expect } from '@playwright/test';

/**
 * Greater Vael Drop 1 exterior smoke (Task 13, Step 1). Proves the exterior
 * zones LOAD, RENDER their instanced forests, and hold the per-zone draw-call
 * budget — the CI proof the perf sweep rests on.
 *
 * Runs against the VITE_E2E build served by playwright.config.ts's webServer,
 * which exposes `window.__oathbrand` (state + a dev/CI-only `loadZone(id)` jump
 * and a `drawCalls` reader). The shipped production bundle (no VITE_E2E, no
 * ?dev=1) exposes none of it.
 *
 * Draw calls is the GPU-independent budget metric (Playwright's headless GL is
 * SwiftShader, so FPS reads depressed and is NOT asserted here). The exterior
 * forest instances grass/trunk/canopy into 3 draws, so even the dense zone
 * sits far under the 100-call ceiling (spec §11).
 */

type Handle = {
  loadZone: (id: string) => Promise<void>;
  state: string;
  drawCalls: number;
};

/** Jump to a gv zone, wait for `playing`, and read the settled draw-call count.
 *  Polls until the frame loop has actually rendered the new zone (calls > 0),
 *  so a read taken before the first paint can't spuriously pass at 0. */
async function drawCallsFor(page: import('@playwright/test').Page, zone: string): Promise<number> {
  await page.goto('/oathbrand/');
  // The E2E handle is present the moment the module boots (proves the gate).
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { __oathbrand?: Handle }).__oathbrand))
    .toBe('object');
  await page.evaluate((z) => (window as unknown as { __oathbrand: Handle }).__oathbrand.loadZone(z), zone);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __oathbrand: Handle }).__oathbrand.state), {
      timeout: 10_000,
    })
    .toBe('playing');
  // Wait for the renderer to have drawn the zone at least once.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __oathbrand: Handle }).__oathbrand.drawCalls), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  // Return the MAX whole-frame count over several rAF frames: renderer.info is
  // reset at each frame start, so a lone read can land in the reset→render
  // window and see 0. The max is the true per-frame draw count.
  return page.evaluate(async () => {
    const h = (window as unknown as { __oathbrand: Handle }).__oathbrand;
    const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
    let calls = 0;
    for (let i = 0; i < 12; i++) {
      await raf();
      calls = Math.max(calls, h.drawCalls);
    }
    return calls;
  });
}

test('gate-fields (field) loads, instanced forest renders, draw calls < 100', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  const calls = await drawCallsFor(page, 'gate-fields');
  expect(calls).toBeGreaterThan(0); // the zone actually rendered
  expect(calls).toBeLessThan(100);
  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ashen-forest-n (dense forest) holds the draw-call budget', async ({ page }) => {
  const calls = await drawCallsFor(page, 'ashen-forest-n');
  expect(calls).toBeLessThan(100);
});

test('cinder-village holds the draw-call budget', async ({ page }) => {
  const calls = await drawCallsFor(page, 'cinder-village');
  expect(calls).toBeLessThan(100);
});

test('pilgrims-descent (height layer) holds the draw-call budget', async ({ page }) => {
  const calls = await drawCallsFor(page, 'pilgrims-descent');
  expect(calls).toBeLessThan(100);
});
