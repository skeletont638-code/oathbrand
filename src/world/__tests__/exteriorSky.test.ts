/**
 * Exterior backdrop (Task 2): dome + moon + ash-fall. The dome and moon must
 * ignore fog (they read through the 16 m dread haze); the ash is a Points
 * system that drifts down each `update` and frees cleanly on `dispose`.
 */
import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import type { MeshBasicMaterial } from 'three';
import { buildExteriorSky } from '../exteriorSky';

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
});
