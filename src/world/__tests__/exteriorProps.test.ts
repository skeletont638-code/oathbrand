/**
 * Procedural prop geometry (Task 9). Each prop is a low-poly, vertex-coloured
 * `BufferGeometry` built in pure three.js (no WebGL) so it renders as the
 * flat-shaded PS1 look and is safe under vitest. Orientation/UV assertions
 * follow the Task-6 lesson: a hand-authored geometry gets a real grounded/
 * tri-cap assertion, never just "defined".
 */
import { describe, it, expect } from 'vitest';
import { bonePileGeometry, chapelShellGeometry, gibbetGeometry, roofWedgeGeometry, stoneGeometry, stumpGeometry, towerShellGeometry } from '../exteriorProps';
import type { BufferGeometry } from 'three';

function tris(g: BufferGeometry): number {
  const p = g.getAttribute('position');
  return (g.index ? g.index.count : p.count) / 3;
}
function minY(g: BufferGeometry): number {
  const p = g.getAttribute('position');
  let m = Infinity;
  for (let i = 0; i < p.count; i++) m = Math.min(m, p.getY(i));
  return m;
}

describe('exterior props', () => {
  // C4 rebuilt the gibbet from rods/rings/blob (~336 tris); cap tracks the C4 ceiling.
  for (const [name, build, cap] of [['gibbet', gibbetGeometry, 600], ['roof-wedge', roofWedgeGeometry, 24]] as const) {
    it(`${name}: low-poly, vertex-coloured, grounded base`, () => {
      const g = build();
      expect(g.getAttribute('color')).toBeDefined();
      expect(tris(g)).toBeGreaterThan(0);
      expect(tris(g)).toBeLessThanOrEqual(cap);
      expect(minY(g)).toBeGreaterThanOrEqual(-0.001);
      g.dispose();
    });

    it(`${name}: every vertex is UV'd so an affine map can sample it (merge-drop guard)`, () => {
      // Lesson (exteriorForest.test.ts): a UV claim gets a REAL count assertion,
      // not just "defined" — the roof-wedge samples the shared bark map through
      // stampForest (UVs load-bearing) and the gibbet goes through
      // mergeGeometries, which silently drops any attribute the parts don't all
      // share. uv.count === position.count proves nothing was dropped.
      const g = build();
      const uv = g.getAttribute('uv');
      expect(uv).toBeDefined();
      expect(uv.itemSize).toBe(2);
      expect(uv.count).toBe(g.getAttribute('position').count);
      g.dispose();
    });
  }
});

describe('C4 boulder-ized props', () => {
  it('the gibbet is rounded — the cylindrical/toroidal rebuild lands well above the box tri count', () => {
    const g = gibbetGeometry();
    expect(tris(g)).toBeGreaterThan(250); // the 7-part box cage was ~96 tris
    expect(tris(g)).toBeLessThanOrEqual(600);
    expect(minY(g)).toBeGreaterThanOrEqual(-0.001); // still hangs — nothing below the floor
    g.dispose();
  });
  for (const [name, build, cap] of [
    ['stone', stoneGeometry, 90],
    ['bone pile', bonePileGeometry, 140],
    ['stump', stumpGeometry, 120],
  ] as const) {
    it(`${name}: lumpy, low-poly (≤${cap} tris), vertex-coloured, settled (embedded ≤0.15 m, never floating)`, () => {
      const g = build();
      expect(g.getAttribute('color')).toBeDefined();
      expect(g.getAttribute('uv')).toBeDefined(); // phase policy: UV assertion on every hand geometry
      expect(tris(g)).toBeGreaterThan(0);
      expect(tris(g)).toBeLessThanOrEqual(cap);
      expect(minY(g)).toBeLessThanOrEqual(0.02); // touches/embeds the ground — no hover
      expect(minY(g)).toBeGreaterThanOrEqual(-0.15);
      g.dispose();
    });
  }
  it('clutter is deterministic (seeded, never Math.random)', () => {
    for (const build of [stoneGeometry, bonePileGeometry, stumpGeometry, gibbetGeometry]) {
      const a = build().getAttribute('position');
      const b = build().getAttribute('position');
      expect(a.count).toBe(b.count);
      for (let i = 0; i < a.count; i++) expect(a.getY(i)).toBe(b.getY(i));
    }
  });
});

describe('the watchtower shell (Task 6)', () => {
  it('is a cheap (≤200 tri), grounded, vertex-coloured, UV\'d silhouette', () => {
    // The Gate Fields watchtower silhouette — an off-grid backdrop prop.
    // Must stay cheap (≤200 tris per the brief), keep its base on the ground
    // (minY ≥ 0, never floats), and — going through mergeGeometries — keep every
    // vertex UV'd (uv.count === position.count proves no attribute was dropped).
    const g = towerShellGeometry();
    expect(g.getAttribute('color')).toBeDefined();
    expect(tris(g)).toBeGreaterThan(0);
    expect(tris(g)).toBeLessThanOrEqual(200);
    expect(minY(g)).toBeGreaterThanOrEqual(-0.001);
    const uv = g.getAttribute('uv');
    expect(uv).toBeDefined();
    expect(uv.count).toBe(g.getAttribute('position').count);
    g.dispose();
  });

  it('is deterministic (no Math.random)', () => {
    const a = towerShellGeometry().getAttribute('position');
    const b = towerShellGeometry().getAttribute('position');
    expect(a.count).toBe(b.count);
    for (let i = 0; i < a.count; i++) expect(a.getY(i)).toBe(b.getY(i));
  });
});

describe('the sunken chapel shell (Task 7)', () => {
  it('is a cheap (≤200 tri), grounded, vertex-coloured, UV\'d silhouette', () => {
    // The Ashen Forest sunken-chapel silhouette — an off-grid backdrop prop.
    // Cheap (≤200 tris), base on the ground (minY ≥ 0, never floats), and — going
    // through mergeGeometries — every vertex UV'd (uv.count === position.count
    // proves no attribute was dropped).
    const g = chapelShellGeometry();
    expect(g.getAttribute('color')).toBeDefined();
    expect(tris(g)).toBeGreaterThan(0);
    expect(tris(g)).toBeLessThanOrEqual(200);
    expect(minY(g)).toBeGreaterThanOrEqual(-0.001);
    const uv = g.getAttribute('uv');
    expect(uv).toBeDefined();
    expect(uv.count).toBe(g.getAttribute('position').count);
    g.dispose();
  });

  it('is deterministic (no Math.random)', () => {
    const a = chapelShellGeometry().getAttribute('position');
    const b = chapelShellGeometry().getAttribute('position');
    expect(a.count).toBe(b.count);
    for (let i = 0; i < a.count; i++) expect(a.getY(i)).toBe(b.getY(i));
  });
});
