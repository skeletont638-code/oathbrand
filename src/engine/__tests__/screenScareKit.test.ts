/**
 * Task 3 — ScreenScareKit: the four screen-effect gimmick timelines.
 *
 * Pure, headless coverage (no three.js). Every timeline is a HELD/static
 * envelope over an internal elapsed clock advanced only by `update(dtMs)` —
 * there is NO per-frame-random term, so the kit is flicker-safe by
 * construction (the accessibility contract) and fully deterministic.
 *
 *   - snap()      → snapRes()   = [96,72] for SNAP_MS, then null (vertex-snap spike)
 *   - resDrop()   → renderDrop() = true for RESDROP_MS (one-frame resolution drop)
 *   - desatStab() → desatBoost() rises to DESAT_PEAK within DESAT_STAB_MS, then
 *                   eases monotonically toward 0 over DESAT_EASE_MS
 *   - setFlickerSafe() strips any layered per-frame random (there is none → a
 *     no-op on output; two reads at the same elapsed are byte-identical)
 */
import { describe, it, expect } from 'vitest';
import {
  ScreenScareKit,
  SNAP_COARSE, SNAP_MS, RESDROP_MS, DESAT_PEAK, DESAT_STAB_MS, DESAT_EASE_MS, EVER_SEEN_HOLD_MUL,
} from '../ScreenScareKit';

describe('ScreenScareKit — vertex-snap spike', () => {
  it('holds [96,72] for SNAP_MS, then releases to null', () => {
    const kit = new ScreenScareKit();
    expect(kit.snapRes()).toBeNull(); // idle
    kit.snap();
    expect(kit.snapRes()).toEqual(SNAP_COARSE);
    expect(SNAP_COARSE).toEqual([96, 72]);
    kit.update(SNAP_MS - 1);
    expect(kit.snapRes()).toEqual([96, 72]); // still held one frame short
    kit.update(1);
    expect(kit.snapRes()).toBeNull(); // elapsed SNAP_MS → released
  });
});

describe('ScreenScareKit — one-frame resolution drop', () => {
  it('renderDrop() is true for RESDROP_MS then false', () => {
    const kit = new ScreenScareKit();
    expect(kit.renderDrop()).toBe(false);
    kit.resDrop();
    expect(kit.renderDrop()).toBe(true);
    kit.update(RESDROP_MS - 1);
    expect(kit.renderDrop()).toBe(true);
    kit.update(1);
    expect(kit.renderDrop()).toBe(false);
  });
});

describe('ScreenScareKit — desaturation stab', () => {
  it('rises to DESAT_PEAK within DESAT_STAB_MS', () => {
    const kit = new ScreenScareKit();
    expect(kit.desatBoost()).toBe(0);
    kit.desatStab();
    kit.update(DESAT_STAB_MS / 2);
    const mid = kit.desatBoost();
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(DESAT_PEAK);
    kit.update(DESAT_STAB_MS / 2);
    expect(kit.desatBoost()).toBeCloseTo(DESAT_PEAK, 5);
  });

  it('eases monotonically back toward 0 after the peak', () => {
    const kit = new ScreenScareKit();
    kit.desatStab();
    kit.update(DESAT_STAB_MS); // at the peak
    let prev = kit.desatBoost();
    expect(prev).toBeCloseTo(DESAT_PEAK, 5);
    for (let t = 0; t < DESAT_EASE_MS; t += 200) {
      kit.update(200);
      const now = kit.desatBoost();
      expect(now).toBeLessThan(prev); // strictly decreasing
      prev = now;
    }
    kit.update(400); // well past the ease window
    expect(kit.desatBoost()).toBe(0);
  });
});

describe('ScreenScareKit — flicker-safe determinism', () => {
  it('produces byte-identical output at the same elapsed (no per-frame random to strip)', () => {
    const kit = new ScreenScareKit();
    kit.setFlickerSafe(true);
    kit.snap();
    kit.resDrop();
    kit.desatStab();
    kit.update(60);
    const a = { snap: kit.snapRes(), drop: kit.renderDrop(), desat: kit.desatBoost() };
    // A second read at the SAME elapsed (no update between) is identical.
    const b = { snap: kit.snapRes(), drop: kit.renderDrop(), desat: kit.desatBoost() };
    expect(b).toEqual(a);
    // Held components survive the toggle unchanged.
    kit.setFlickerSafe(false);
    expect(kit.snapRes()).toEqual(a.snap);
    expect(kit.desatBoost()).toBe(a.desat);
  });

  it('renders an already-seen glitch ~30% shorter (fidelity scarcity, rule 8)', () => {
    const kit = new ScreenScareKit();
    kit.snap(true); // everSeen → shortened hold
    kit.update(SNAP_MS * EVER_SEEN_HOLD_MUL - 1);
    expect(kit.snapRes()).toEqual(SNAP_COARSE); // still held one frame short
    kit.update(1);
    expect(kit.snapRes()).toBeNull(); // released ~30% early
    // ...whereas a first-seen glitch is still holding at that same elapsed.
    const fresh = new ScreenScareKit();
    fresh.snap(false);
    fresh.update(SNAP_MS * EVER_SEEN_HOLD_MUL);
    expect(fresh.snapRes()).toEqual(SNAP_COARSE);
  });

  it('runs all three timelines independently and concurrently', () => {
    const kit = new ScreenScareKit();
    kit.snap();
    kit.desatStab();
    kit.update(SNAP_MS); // snap ends here; desat still easing
    expect(kit.snapRes()).toBeNull();
    expect(kit.desatBoost()).toBeGreaterThan(0);
  });
});
