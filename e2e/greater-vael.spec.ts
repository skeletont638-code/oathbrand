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

/**
 * World Expansion v1.2 (Task 10) — the two headline systems this phase added,
 * driven end-to-end through the real game: a gate-door transition and a silent
 * echo scene. Both read through dev/CI-only `__oathbrand` hooks (openDoor /
 * echoScenes / echoesWitnessed), never present in the shipped bundle.
 */
type WorldHandle = Handle & {
  zones: { current: string };
  controller: { pos: { set: (x: number, y: number, z: number) => void } };
  doorsOpened: string[];
  echoesWitnessed: string[];
  echoScenes: { activeActors: () => unknown[] };
  openDoor: (defId: string) => boolean;
  stepFrame: (dtMs?: number) => void;
  blackout: number;
  built: { doors: { def: { id: string }; position: { x: number; z: number } }[] };
};

/** Boot the CI build and jump to `zone` in 'playing', returning nothing (the
 *  handle is read per-step by the caller). */
async function bootInto(page: import('@playwright/test').Page, zone: string): Promise<void> {
  await page.goto('/oathbrand/');
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { __oathbrand?: WorldHandle }).__oathbrand))
    .toBe('object');
  await page.evaluate((z) => (window as unknown as { __oathbrand: WorldHandle }).__oathbrand.loadZone(z), zone);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __oathbrand: WorldHandle }).__oathbrand.state), {
      timeout: 10_000,
    })
    .toBe('playing');
}

test('the Tower Door swings open and you WALK gate-fields → watchtower, fade-free', async ({ page }) => {
  await bootInto(page, 'gate-fields');
  // OPEN the decorated Tower Door (gf-to-tower): it SWINGS open — it does NOT
  // teleport you (seamless traversal, T12; the fade is dead).
  const opened = await page.evaluate(() => (window as unknown as { __oathbrand: WorldHandle }).__oathbrand.openDoor('gf-to-tower'));
  expect(opened, 'openDoor should open the unlocked door').toBe(true);
  // E only swung the leaf — the knight is still in gate-fields.
  expect(await page.evaluate(() => (window as unknown as { __oathbrand: WorldHandle }).__oathbrand.zones.current)).toBe('gate-fields');
  // The far-side edge was recorded ON OPEN (persisted, additive doorsOpened).
  const openedIds = await page.evaluate(() => (window as unknown as { __oathbrand: WorldHandle }).__oathbrand.doorsOpened);
  expect(openedIds.some((id) => id.includes('watchtower'))).toBe(true);
  // WALK onto the now-passable door cell → the walk-in path carries you across.
  // The blackout overlay must never rise while the player moves (the fade is dead).
  const peakBlackout = await page.evaluate(() => {
    const g = (window as unknown as { __oathbrand: WorldHandle }).__oathbrand;
    const door = g.built.doors.find((d) => d.def.id === 'gf-to-tower')!;
    g.controller.pos.set(door.position.x, 0, door.position.z);
    let peak = g.blackout;
    for (let i = 0; i < 4; i++) {
      g.stepFrame(16);
      peak = Math.max(peak, g.blackout);
    }
    return peak;
  });
  expect(peakBlackout, 'no blackout fade during a door crossing').toBe(0);
  // The walk-in transition lands the player in the watchtower (the merged
  // continuous-climb zone: enter the guardroom, then climb every step to the roof).
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __oathbrand: WorldHandle }).__oathbrand.zones.current), {
      timeout: 10_000,
    })
    .toBe('watchtower');
});

test('stepping onto the oath trigger cell witnesses the act1-oath echo', async ({ page }) => {
  await bootInto(page, 'gate-fields');
  // act1-oath triggers on cell [5,7]/[5,8] (world x∈[14,16), z∈[10,12)). Stand the
  // knight on [5,7] and tick a couple of frames: the EchoSceneSystem fires, marks
  // the scene witnessed the same instant, and reports its apparitions live.
  const result = await page.evaluate(() => {
    const h = (window as unknown as { __oathbrand: WorldHandle }).__oathbrand;
    h.controller.pos.set(15, 0, 11); // cell [5,7] centre
    h.stepFrame(16);
    h.stepFrame(16);
    return { active: h.echoScenes.activeActors().length, witnessed: h.echoesWitnessed };
  });
  expect(result.witnessed).toContain('act1-oath'); // marked witnessed on trigger
  expect(result.active).toBeGreaterThan(0); // apparitions are live this frame
});
