import { describe, it, expect } from 'vitest';
import { TUNING } from '../tuning';

describe('TUNING.lighting', () => {
  it('every exterior preset drops the ambient floor below the old 0.6 flat', () => {
    for (const p of ['field', 'forest', 'gorge'] as const) {
      expect(TUNING.lighting.exterior[p].ambient).toBeGreaterThanOrEqual(0.25);
      expect(TUNING.lighting.exterior[p].ambient).toBeLessThanOrEqual(0.35);
    }
  });
  it('the field moon is a cold, low-intensity key', () => {
    expect(TUNING.lighting.exterior.field.moon.color).toBe(0x8fa3c8);
    expect(TUNING.lighting.exterior.field.moon.intensity).toBeCloseTo(0.45);
  });
  it('the interior faint directional is 0.12', () => {
    expect(TUNING.lighting.interior.directional.intensity).toBeCloseTo(0.12);
  });
});
