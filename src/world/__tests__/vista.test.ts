/**
 * VistaDirector (Task 11, spec §9 clip #1) — pure envelope logic for the
 * one-shot scripted vista: fog far-plane opens 12→28 and the camera lifts
 * +0.8m over a 2.5s swell, then both ease back over 1.5s while the player
 * keeps full control. One-shot per save (seen-set seeds from SaveData).
 */
import { describe, it, expect } from 'vitest';
import type { VistaDef } from '../zoneDef';
import {
  VISTA_CAM_LIFT_M,
  VISTA_FOG_BOOST_M,
  VISTA_RETURN_MS,
  VISTA_SWELL_MS,
  VistaDirector,
} from '../vista';

const VISTA: VistaDef = {
  id: 'vista-test',
  cells: [
    [1, 3],
    [1, 4],
  ],
};

describe('VistaDirector', () => {
  it('starts inert (no boost, no lift, inactive)', () => {
    const v = new VistaDirector();
    expect(v.active).toBe(false);
    expect(v.fogFarBoost).toBe(0);
    expect(v.camLift).toBe(0);
  });

  it('ignores cells outside the trigger region', () => {
    const v = new VistaDirector();
    expect(v.enterCell(VISTA, 2, 3)).toBe(false);
    expect(v.enterCell(VISTA, 1, 5)).toBe(false);
    expect(v.active).toBe(false);
  });

  it('ignores zones without a vista', () => {
    const v = new VistaDirector();
    expect(v.enterCell(undefined, 1, 3)).toBe(false);
  });

  it('fires exactly once on entering a trigger cell', () => {
    const v = new VistaDirector();
    expect(v.enterCell(VISTA, 1, 3)).toBe(true);
    expect(v.active).toBe(true);
    // Same cell, other trigger cell, re-entry later: never again.
    expect(v.enterCell(VISTA, 1, 3)).toBe(false);
    expect(v.enterCell(VISTA, 1, 4)).toBe(false);
    v.update(VISTA_SWELL_MS + VISTA_RETURN_MS + 1000);
    expect(v.enterCell(VISTA, 1, 4)).toBe(false);
  });

  it('never fires when the id was already seen (save restore)', () => {
    const v = new VistaDirector(['vista-test']);
    expect(v.enterCell(VISTA, 1, 3)).toBe(false);
    expect(v.active).toBe(false);
  });

  it('records fired ids for the save merge', () => {
    const v = new VistaDirector(['vista-old']);
    v.enterCell(VISTA, 1, 3);
    expect([...v.seenIds].sort()).toEqual(['vista-old', 'vista-test']);
  });

  it('swells to full fog boost + cam lift at the swell peak', () => {
    const v = new VistaDirector();
    v.enterCell(VISTA, 1, 3);
    v.update(VISTA_SWELL_MS);
    expect(v.fogFarBoost).toBeCloseTo(VISTA_FOG_BOOST_M, 5);
    expect(v.camLift).toBeCloseTo(VISTA_CAM_LIFT_M, 5);
  });

  it('rises monotonically through the swell (eased, half-way at midpoint)', () => {
    const v = new VistaDirector();
    v.enterCell(VISTA, 1, 3);
    let prev = -1;
    const step = VISTA_SWELL_MS / 10;
    for (let i = 0; i < 10; i++) {
      v.update(step);
      expect(v.fogFarBoost).toBeGreaterThan(prev);
      prev = v.fogFarBoost;
      if (i === 4) expect(v.fogFarBoost).toBeCloseTo(VISTA_FOG_BOOST_M / 2, 5);
    }
  });

  it('eases back to zero over the return and goes inactive', () => {
    const v = new VistaDirector();
    v.enterCell(VISTA, 1, 3);
    v.update(VISTA_SWELL_MS);
    v.update(VISTA_RETURN_MS / 2);
    expect(v.fogFarBoost).toBeCloseTo(VISTA_FOG_BOOST_M / 2, 5);
    expect(v.camLift).toBeCloseTo(VISTA_CAM_LIFT_M / 2, 5);
    v.update(VISTA_RETURN_MS / 2);
    expect(v.fogFarBoost).toBe(0);
    expect(v.camLift).toBe(0);
    expect(v.active).toBe(false);
    // Long after: still parked at zero.
    v.update(10_000);
    expect(v.fogFarBoost).toBe(0);
  });

  it('update before any trigger is a no-op', () => {
    const v = new VistaDirector();
    v.update(5000);
    expect(v.fogFarBoost).toBe(0);
    expect(v.active).toBe(false);
  });
});
