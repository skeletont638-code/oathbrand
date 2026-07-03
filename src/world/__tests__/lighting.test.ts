import { describe, it, expect } from 'vitest';
import { resolveZoneLighting } from '../lighting';
import type { ZoneDef } from '../zoneDef';

const base = (o: Partial<ZoneDef>): ZoneDef => ({
  id: 'gate-fields', grid: ['.'], cell: 2, tiles: {}, props: [], lights: [],
  enemies: [], lore: [], doors: [], ambience: [], ...o,
});

describe('resolveZoneLighting', () => {
  it('an exterior field zone uses the field preset, dropped ambient + moon key', () => {
    const l = resolveZoneLighting(base({ kind: 'exterior', exteriorSky: 'field' }));
    expect(l.ambient).toBeCloseTo(0.30);
    expect(l.key.color).toBe(0x8fa3c8);
    expect(l.hemi.intensity).toBeCloseTo(0.25);
  });
  it('an interior zone gets the faint cool directional and NO hemisphere', () => {
    const l = resolveZoneLighting(base({ kind: undefined, ambientFloor: 0.35 }));
    expect(l.key.intensity).toBeCloseTo(0.12);
    expect(l.hemi.intensity).toBe(0);
  });
  it('keyLightIntensity overrides the resolved directional (Undercroft guard)', () => {
    const l = resolveZoneLighting(base({ ambientFloor: 0.06, keyLightIntensity: 0 }));
    expect(l.key.intensity).toBe(0);
  });
});
