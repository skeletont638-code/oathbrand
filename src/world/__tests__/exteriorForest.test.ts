/**
 * Procedural forest geometry (Task 2). Each instance kind must be a single,
 * very-low-poly, base-at-y0, vertex-coloured `BufferGeometry` so it can drive
 * one `InstancedMesh` (1 draw call) and hold the drop's `tris < 100k` budget
 * even when a zone plants dozens of trees.
 */
import { describe, it, expect } from 'vitest';
import { grassGeometry, pineGeometry, trunkGeometry } from '../exteriorForest';
import { ZONES } from '../../content/zones';
import type { BufferGeometry } from 'three';

// C3 (spec §11.3): per-kind tri caps RAISED with accounting — guards, not
// targets (measured: pine 74, trunk 38, grass 6). Named consts so the per-kind
// cap tests and the worst-case zone budget test below can never drift apart.
const PINE_TRI_CAP = 160;
const TRUNK_TRI_CAP = 120;
const GRASS_TRI_CAP = 12;

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
  // Worst forest ≈ 60 dense + 20 sparse ⇒ ~12k tris at guard caps; <100k holds
  // with 8× headroom (see the zone-derived budget test at the bottom).
  for (const [name, build, triCap] of [
    ['pine (dense)', pineGeometry, PINE_TRI_CAP],
    ['trunk (sparse)', trunkGeometry, TRUNK_TRI_CAP],
    ['grass tuft', grassGeometry, GRASS_TRI_CAP],
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

  it('pine/trunk carry a full uv attribute (cone/cylinder) for the map', () => {
    for (const build of [pineGeometry, trunkGeometry]) {
      const g = build();
      const uv = g.getAttribute('uv');
      expect(uv).toBeDefined();
      // Lesson (1) again for the C3 rebuild: pine/trunk are MERGED geometries
      // (bentTrunk + crookedCones) — the exact partial-attribute-merge failure
      // mode. EVERY vertex must be UV'd or mergeGeometries silently drops uv.
      expect(uv!.itemSize).toBe(2);
      expect(uv!.count).toBe(g.getAttribute('position').count);
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

  it('C3: worst REAL zone forest, costed at guard caps, holds the <100k tri budget (spec §8)', () => {
    // Spec §8 claims the <100k visible-tri budget is asserted, but the e2e only
    // reads draw calls — and C3 raised the per-tree guards (160/120), widening
    // the unguarded ceiling. This derives instance counts from the REAL zone
    // grids (ZoneBuilder's exterior classification: ',' → grass tuft, 't' →
    // sparse trunk, 'T'/'#' → dense pine), so future zone AUTHORING is guarded
    // too: plant a big enough forest and this test fails before any playtest.
    const exteriors = Object.entries(ZONES).filter(([, def]) => def?.kind === 'exterior');
    expect(exteriors.length).toBeGreaterThan(0); // the derivation must see real zones
    let worstTris = 0;
    let worstId = '';
    for (const [id, def] of exteriors) {
      let dense = 0, sparse = 0, grass = 0;
      for (const line of def!.grid) {
        for (const ch of line) {
          if (ch === 'T' || ch === '#') dense++;
          else if (ch === 't') sparse++;
          else if (ch === ',') grass++;
        }
      }
      // Every instance costed at its GUARD cap (not its measured size) — the
      // worst the caps permit, not the best the current meshes deliver.
      const forestTris = dense * PINE_TRI_CAP + sparse * TRUNK_TRI_CAP + grass * GRASS_TRI_CAP;
      if (forestTris > worstTris) { worstTris = forestTris; worstId = id; }
    }
    expect(worstTris).toBeGreaterThan(0); // at least one exterior actually plants a forest
    // Conservative allowance for everything that is NOT forest: undulating
    // ground (~8 tris/cell × ~200 cells ≈ 1.6k), terrain skirt, sky dome +
    // moon + ash Points, kit ruin blocks, roof wedges, props (gibbet ~336),
    // entities (≤600 each, ~4 visible ≈ 2.4k) — 50k dwarfs all of it combined
    // (plan header accounts the true worst zone at ~20–25k INCLUDING forest).
    const STATIC_ALLOWANCE = 50_000;
    expect(worstTris + STATIC_ALLOWANCE, `worst forest zone: ${worstId}`).toBeLessThan(100_000);
  });
});
