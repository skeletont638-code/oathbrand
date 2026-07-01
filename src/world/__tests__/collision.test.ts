import { describe, it, expect } from 'vitest';
import { GridCollider } from '../collision';
import type { ZoneDef, TileKind } from '../zoneDef';
import { TUNING } from '../../content/tuning';

const R = TUNING.player.radius; // 0.4 — canonical player radius

function zone(grid: string[], tiles: Record<string, TileKind> = {}): ZoneDef {
  return {
    id: 'ashen-gate',
    grid,
    cell: 2,
    tiles,
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
  };
}

// 5x5 room, walls all around. Floor spans x ∈ [2,8], z ∈ [2,8];
// the top wall (row 0) is the 2m slab z ∈ [0,2].
const ROOM = zone([
  '#####',
  '#...#',
  '#...#',
  '#...#',
  '#####',
]);

// Two rooms split by a 2m-thick interior wall at column 3 (x ∈ [6,8]).
const SPLIT = zone([
  '#######',
  '#..#..#',
  '#..#..#',
  '#######',
]);

describe('GridCollider.slide', () => {
  it('applies the full delta on open floor', () => {
    const c = new GridCollider(ROOM);
    const out = c.slide({ x: 5, z: 5 }, { x: 0.3, z: -0.2 }, R);
    expect(out.x).toBeCloseTo(5.3, 6);
    expect(out.z).toBeCloseTo(4.8, 6);
  });

  it('sliding into a wall preserves tangent motion and zeroes the normal component', () => {
    const c = new GridCollider(ROOM);
    // Pushing diagonally into the top wall (face at z=2): the x (tangent)
    // component must be applied in full; the z (normal) component must be
    // absorbed, leaving the circle resting at face + radius.
    const out = c.slide({ x: 4, z: 2.5 }, { x: 1.2, z: -0.5 }, R);
    expect(out.x).toBeCloseTo(5.2, 6); // tangent preserved
    expect(out.z).toBeCloseTo(2 + R, 6); // normal zeroed at contact
    expect(out.z).toBeGreaterThanOrEqual(2 + R - 1e-9); // never inside the wall
  });

  it('cannot tunnel through a 2m wall in one 0.5m step', () => {
    const c = new GridCollider(ROOM);
    const out = c.slide({ x: 5, z: 2.5 }, { x: 0, z: -0.5 }, R);
    expect(out.z).toBeCloseTo(2 + R, 6);
    expect(out.z).toBeGreaterThan(2); // not embedded in / past the slab
  });

  it('cannot tunnel through a 2m wall with a large single step', () => {
    const c = new GridCollider(SPLIT);
    // Naive endpoint x=9 lies fully beyond the far face (8 + R), so an
    // endpoint-only check would report "no overlap" and teleport through.
    const out = c.slide({ x: 5, z: 3 }, { x: 4, z: 0 }, R);
    expect(out.x).toBeCloseTo(6 - R, 6); // stopped at the near face
    expect(out.x).toBeLessThan(6);
    expect(out.z).toBeCloseTo(3, 6);
  });

  it('treats zone-specific letters mapped to wall as solid', () => {
    const c = new GridCollider(
      zone(['#####', '#.W.#', '#####'], { W: 'wall' }),
    );
    const out = c.slide({ x: 3, z: 3 }, { x: 2, z: 0 }, R);
    expect(out.x).toBeCloseTo(4 - R, 6); // W cell spans x ∈ [4,6]
  });

  it('walks freely across door anchors and void', () => {
    const doorZone = zone(['#####', '#.1.#', '#####']);
    const voidZone = zone(['#####', '#.~.#', '#####']);
    const throughDoor = new GridCollider(doorZone).slide({ x: 3, z: 3 }, { x: 2, z: 0 }, R);
    const throughVoid = new GridCollider(voidZone).slide({ x: 3, z: 3 }, { x: 2, z: 0 }, R);
    expect(throughDoor.x).toBeCloseTo(5, 6);
    expect(throughVoid.x).toBeCloseTo(5, 6); // falling is handled elsewhere
  });
});

describe('GridCollider.raycastWall', () => {
  it('returns true for a ray passing through a # wall', () => {
    const c = new GridCollider(SPLIT);
    expect(c.raycastWall({ x: 3, z: 3 }, { x: 11, z: 3 })).toBe(true);
  });

  it('returns false for a ray across open floor', () => {
    const c = new GridCollider(SPLIT);
    expect(c.raycastWall({ x: 3, z: 3 }, { x: 5, z: 5 })).toBe(false);
  });

  it('returns false when both points share a cell', () => {
    const c = new GridCollider(SPLIT);
    expect(c.raycastWall({ x: 3, z: 3 }, { x: 3.5, z: 3.5 })).toBe(false);
  });

  it('treats tiles-mapped wall letters as blocking', () => {
    const c = new GridCollider(zone(['#####', '#.W.#', '#####'], { W: 'wall' }));
    expect(c.raycastWall({ x: 3, z: 3 }, { x: 7, z: 3 })).toBe(true);
  });

  it('does not treat void as a wall', () => {
    const c = new GridCollider(zone(['#####', '#.~.#', '#####']));
    expect(c.raycastWall({ x: 3, z: 3 }, { x: 7, z: 3 })).toBe(false);
  });
});
