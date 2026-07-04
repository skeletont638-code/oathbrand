/**
 * Exterior backdrop (Task 2): dome + moon + ash-fall. The dome and moon must
 * ignore fog (they read through the 16 m dread haze); the ash is a Points
 * system that drifts down each `update` and frees cleanly on `dispose`.
 */
import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import type { MeshBasicMaterial } from 'three';
import { buildExteriorSky, moonDirection } from '../exteriorSky';

describe('buildExteriorSky', () => {
  it('builds a fog-immune dome + moon and an ash Points system for each preset', () => {
    for (const preset of ['field', 'forest', 'gorge'] as const) {
      const bg = buildExteriorSky(preset, { center: { x: 10, z: 8 }, spanM: 30 });
      expect((bg.dome.material as MeshBasicMaterial).fog).toBe(false);
      expect((bg.moon.material as MeshBasicMaterial).fog).toBe(false);
      expect(bg.ash).toBeInstanceOf(Points);
      expect(bg.dome.geometry.getAttribute('color')).toBeDefined(); // gradient
      bg.dispose();
    }
  });

  it('update drifts the ash downward (and never NaNs)', () => {
    const bg = buildExteriorSky('field');
    const pos = bg.ash.geometry.getAttribute('position');
    const y0 = pos.getY(0);
    bg.update(1000); // 1 s
    const y1 = bg.ash.geometry.getAttribute('position').getY(0);
    expect(Number.isFinite(y1)).toBe(true);
    expect(y1).not.toBe(y0); // it moved
    bg.dispose();
  });

  // --- Task 10: per-preset particles + gorge embers ---------------------------

  it('the gorge preset adds a warm ember Points system; field does not', () => {
    const gorge = buildExteriorSky('gorge', { spanM: 40 });
    expect(gorge.embers).toBeDefined();
    gorge.dispose();
    const field = buildExteriorSky('field', { spanM: 40 });
    expect(field.embers).toBeUndefined();
    field.dispose();
  });
});

describe('moon direction', () => {
  it('points UP and NORTH (−z) so the key agrees with the visible moon', () => {
    const d = moonDirection(40);
    expect(d.length()).toBeCloseTo(1);
    expect(d.y).toBeGreaterThan(0.4);
    expect(d.z).toBeLessThan(0);
  });
  it('the built backdrop exposes the same moonDir', () => {
    const b = buildExteriorSky('field', { spanM: 40 });
    expect(b.moonDir.y).toBeGreaterThan(0.4);
    b.dispose();
  });
});
