import { describe, it, expect } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import { EventBus } from '../../engine/events';
import { AshHound, HoundView } from '../AshHound';
import { KneelingHollow, KneelerView } from '../KneelingHollow';
import { buildWatcher } from '../WatcherPresence';
import { buildHag } from '../HagPresence';
import { CrossingSilhouette } from '../CrossingSilhouette';
import { blobHead } from '../organic';

/** Total triangles across every mesh under a root (the tri-accounting helper). */
function viewTris(root: Group): number {
  let tris = 0;
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    }
  });
  return tris;
}

/** Every mesh under the root carries a uv attribute (the map-bind guard). */
function allHaveUV(root: Group): boolean {
  let ok = true;
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && !m.geometry.getAttribute('uv')) ok = false;
  });
  return ok;
}

function houndView(): HoundView {
  return new HoundView(new AshHound({ id: 'h', bus: new EventBus(), rng: () => 0.5, pantCue: () => {} }));
}
function kneelerView(): KneelerView {
  return new KneelerView(new KneelingHollow({ id: 'k', bus: new EventBus(), pulse: () => 0, creakCue: () => {} }));
}

describe('C1 organic entities — tri accounting, UVs, preserved numbers', () => {
  it('hound: curved rig ≤600 tris (and clearly not boxes), every part UV-mapped', () => {
    const v = houndView();
    const t = viewTris(v.root);
    expect(t).toBeGreaterThan(200); // boxes were ~100 — proves the rebuild landed
    expect(t).toBeLessThanOrEqual(600);
    expect(allHaveUV(v.root)).toBe(true); // hound-hide map binds on every part
    v.dispose();
  });
  it('hound: the heightM back-solve is preserved — ridge-top at 2.3 m', () => {
    const v = houndView();
    v.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(v.root);
    expect(Math.abs(box.max.y - 2.3)).toBeLessThanOrEqual(0.06);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.12); // feet at the ground (bow ≤ 0.09 in z only)
    v.dispose();
  });
  it('kneeler: ≤600 tris, UV-mapped, update() still drives the same joints', () => {
    const v = kneelerView();
    const t = viewTris(v.root);
    expect(t).toBeGreaterThan(200);
    expect(t).toBeLessThanOrEqual(600);
    expect(allHaveUV(v.root)).toBe(true); // kneeler-cloth map binds on every part
    expect(() => v.update(16)).not.toThrow(); // the untouched update() animates the new rig
    v.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(v.root);
    expect(box.max.y).toBeGreaterThan(0.9); // kneeling pose, believable envelope
    expect(box.max.y).toBeLessThan(2.0);
    v.dispose();
  });
  it('watcher: still EXACTLY 3.0 m, still a clean column (never the Hag stoop)', () => {
    const mats: MeshStandardMaterial[] = [];
    const g = buildWatcher(mats);
    g.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g);
    expect(Math.abs(box.max.y - 3.0)).toBeLessThanOrEqual(0.06);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.02);
    expect(box.max.x).toBeLessThanOrEqual(0.3); // a column, not a skirt
    expect(viewTris(g)).toBeLessThanOrEqual(300);
    for (const m of mats) expect(m.color.getHex()).toBe(0x000000); // pure black held
  });
  it('hag: stooped woman silhouette — wide lathe hem, hunch pivot preserved', () => {
    const mats: MeshStandardMaterial[] = [];
    const { root, hunch } = buildHag(mats);
    expect(hunch.position.y).toBeCloseTo(1.08);
    expect(hunch.rotation.x).toBeCloseTo(0.95); // HagView's baseHunchX reads this
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    expect(box.max.x).toBeGreaterThanOrEqual(0.45); // the robe hem — NOT a column
    expect(viewTris(root)).toBeLessThanOrEqual(400);
    for (const m of mats) expect(m.color.getHex()).toBe(0x000000);
  });
  it('crossing silhouette: bent legs still animate, ≤400 tris', () => {
    const c = new CrossingSilhouette();
    expect(viewTris(c.root)).toBeLessThanOrEqual(400);
    c.arm({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1000);
    expect(() => c.update(16, { x: 50, z: 50 })).not.toThrow();
    c.dispose();
  });
  it('blobHead is deterministic (seeded, never Math.random)', () => {
    const a = blobHead(0.2, 7).getAttribute('position');
    const b = blobHead(0.2, 7).getAttribute('position');
    for (let i = 0; i < a.count; i++) expect(a.getY(i)).toBe(b.getY(i));
  });
});
