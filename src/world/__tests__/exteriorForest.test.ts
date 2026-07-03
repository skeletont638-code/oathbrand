/**
 * Procedural forest geometry (Task 2). Each instance kind must be a single,
 * very-low-poly, base-at-y0, vertex-coloured `BufferGeometry` so it can drive
 * one `InstancedMesh` (1 draw call) and hold the drop's `tris < 100k` budget
 * even when a zone plants dozens of trees.
 */
import { describe, it, expect } from 'vitest';
import { grassGeometry, pineGeometry, trunkGeometry } from '../exteriorForest';
import type { BufferGeometry } from 'three';

function tris(geo: BufferGeometry): number {
  const pos = geo.getAttribute('position');
  return (geo.index ? geo.index.count : pos.count) / 3;
}

function minY(geo: BufferGeometry): number {
  const pos = geo.getAttribute('position');
  let m = Infinity;
  for (let i = 0; i < pos.count; i++) m = Math.min(m, pos.getY(i));
  return m;
}

describe('exteriorForest geometry', () => {
  // C3 (spec §11.3): caps RAISED with accounting — guards, not targets.
  // Worst forest ≈ 60 dense + 20 sparse ⇒ ~12k tris; <100k holds with 8× headroom.
  for (const [name, build, triCap] of [
    ['pine (dense)', pineGeometry, 160],
    ['trunk (sparse)', trunkGeometry, 120],
    ['grass tuft', grassGeometry, 12],
  ] as const) {
    it(`${name}: low-poly, vertex-coloured, base on the ground`, () => {
      const geo = build();
      expect(geo.getAttribute('position')).toBeDefined();
      expect(geo.getAttribute('color')).toBeDefined();
      const t = tris(geo);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(triCap);
      // Base sits on (or just below) the ground so an instance matrix grounds it.
      expect(minY(geo)).toBeGreaterThanOrEqual(-0.001);
      expect(minY(geo)).toBeLessThan(0.05);
      geo.dispose();
    });
  }

  it('grass has a uv attribute so the affine bark map can sample it', () => {
    const geo = grassGeometry();
    const uv = geo.getAttribute('uv');
    expect(uv).toBeDefined();
    // Lesson (1): a hand-authored UV claim gets a real assertion, not just
    // "defined" — every blade vertex must be UV'd or a partial-attribute merge
    // would silently drop uv (three's mergeGeometries keeps only shared attrs).
    expect(uv!.itemSize).toBe(2);
    expect(uv!.count).toBe(geo.getAttribute('position').count);
    geo.dispose();
  });

  it('pine/trunk already carry uv (cone/cylinder) for the map', () => {
    for (const build of [pineGeometry, trunkGeometry]) {
      const g = build();
      expect(g.getAttribute('uv')).toBeDefined();
      g.dispose();
    }
  });

  it('C3: trees are asymmetric (bent trunk breaks mirror symmetry) and deterministic', () => {
    for (const build of [pineGeometry, trunkGeometry]) {
      const a = build();
      const pos = a.getAttribute('position');
      let minX = Infinity, maxX = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        minX = Math.min(minX, pos.getX(i));
        maxX = Math.max(maxX, pos.getX(i));
      }
      expect(Math.abs(minX + maxX)).toBeGreaterThan(0.05); // the lean: |minX| ≠ maxX
      const b = build();
      const pb = b.getAttribute('position');
      for (let i = 0; i < pos.count; i++) expect(pos.getX(i)).toBe(pb.getX(i)); // seeded, reproducible
      a.dispose();
      b.dispose();
    }
  });

  it('rebalanced under the key light: vertex colours sit in the readable band', () => {
    for (const build of [pineGeometry, trunkGeometry, grassGeometry]) {
      const geo = build();
      const col = geo.getAttribute('color')!;
      let maxLuma = 0;
      for (let i = 0; i < col.count; i++) {
        const luma = 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
        maxLuma = Math.max(maxLuma, luma);
      }
      expect(maxLuma).toBeGreaterThan(0.20); // lifted from the old near-0.1 flat-ambient values
      expect(maxLuma).toBeLessThan(0.45);    // still a dead, desaturated forest
      geo.dispose();
    }
  });
});
