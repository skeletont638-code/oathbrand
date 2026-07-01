import { it, expect } from 'vitest';
import { bayer4x4, quantizeRGB555 } from '../bayer';

it('bayer matrix has 16 unique thresholds in [0,1)', () => {
  const b = bayer4x4();
  expect(b).toHaveLength(16);
  expect(new Set(b).size).toBe(16);
  b.forEach((v) => {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

it('RGB555 quantizes to 32 levels', () => {
  expect(quantizeRGB555(0)).toBe(0);
  expect(quantizeRGB555(1)).toBe(1);
  expect(quantizeRGB555(0.5)).toBeCloseTo(Math.round(0.5 * 31) / 31, 5);
});
