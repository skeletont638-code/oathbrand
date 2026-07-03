import { describe, it, expect } from 'vitest';
import { SphereGeometry } from 'three';
import { displaceRadial, mulberry32, seededAt } from '../noise';

describe('seeded noise (C1)', () => {
  it('mulberry32 matches the game PRNG contract: deterministic, [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('seededAt is position-stable and seed-sensitive', () => {
    expect(seededAt(3, 0, 7, 1)).toBe(seededAt(3, 0, 7, 1));
    expect(seededAt(3, 0, 7, 1)).not.toBe(seededAt(3, 0, 7, 2));
  });
  it('displaceRadial keeps duplicated verts welded (watertight) and is deterministic', () => {
    const build = (): SphereGeometry => new SphereGeometry(0.3, 7, 5);
    const g1 = build().toNonIndexed();
    const g2 = build().toNonIndexed();
    displaceRadial(g1, 0.06, 9);
    displaceRadial(g2, 0.06, 9);
    const p1 = g1.getAttribute('position'), p2 = g2.getAttribute('position');
    // deterministic: same build + seed → identical arrays
    for (let i = 0; i < p1.count; i++) {
      expect(p1.getX(i)).toBe(p2.getX(i));
      expect(p1.getY(i)).toBe(p2.getY(i));
      expect(p1.getZ(i)).toBe(p2.getZ(i));
    }
    // watertight: verts that shared a position before displacement still do
    const byKey = new Map<string, [number, number, number]>();
    const orig = build().toNonIndexed().getAttribute('position');
    for (let i = 0; i < orig.count; i++) {
      const key = `${orig.getX(i).toFixed(5)},${orig.getY(i).toFixed(5)},${orig.getZ(i).toFixed(5)}`;
      const disp: [number, number, number] = [p1.getX(i), p1.getY(i), p1.getZ(i)];
      const prev = byKey.get(key);
      if (prev) {
        expect(disp[0]).toBeCloseTo(prev[0], 6);
        expect(disp[1]).toBeCloseTo(prev[1], 6);
        expect(disp[2]).toBeCloseTo(prev[2], 6);
      } else byKey.set(key, disp);
    }
  });
});
