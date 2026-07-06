/**
 * Interior kit (world-expansion v1.2, Task 2) — the wall-torch prop + pooled
 * flicker light, the interior dread opt-in predicate, and the per-zone torch
 * content cap. The kit is DORMANT: no shipped zone declares `torches` yet, so
 * these tests exercise it through synthetic zones + a structural sweep over the
 * real registry (which guards Tasks 4–8 the moment they author interiors).
 */
import { describe, it, expect } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, PointLight, Points, Sprite } from 'three';
import { MAX_POINT_LIGHTS, ZoneBuilder } from '../ZoneBuilder';
import type { AssetCache } from '../assets';
import type { ZoneDef, TileKind } from '../zoneDef';
import { ZONES } from '../../content/zones';
import { dreadEligible } from '../../engine/DreadDirector';
import { TUNING } from '../../content/tuning';

/** A stand-in kit cache: every requested piece is a one-mesh Group whose
 *  material NAME is the piece name (so a merged bucket surfaces as
 *  `merged:<piece>`). Mirrors the helper in zoneBuilder.test.ts. */
function fakeAssets(): AssetCache {
  const made = new Map<string, Group>();
  return {
    get(name: string): Group {
      let g = made.get(name);
      if (!g) {
        g = new Group();
        const mat = new MeshStandardMaterial();
        mat.name = name;
        g.add(new Mesh(new BoxGeometry(1, 1, 1), mat));
        g.updateMatrixWorld(true);
        made.set(name, g);
      }
      return g;
    },
  };
}

function interiorZone(grid: string[], overrides: Partial<ZoneDef> = {}, tiles: Record<string, TileKind> = {}): ZoneDef {
  return {
    id: 'great-hall',
    grid,
    cell: 2,
    tiles,
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
    ...overrides,
  };
}

/** A 7-wide, 2-floor-row room whose six interior floor cells each abut a wall
 *  (top/bottom) — a valid 6-torch mounting frame. */
const SIX_TORCH_GRID = ['#######', '#.....#', '#.....#', '#######'];
const SIX_TORCHES: { at: [number, number] }[] = [
  { at: [1, 1] }, { at: [1, 2] }, { at: [1, 3] },
  { at: [2, 4] }, { at: [2, 5] }, { at: [1, 5] },
];

/** Draw-call proxy: every renderable child (Mesh incl. InstancedMesh, Points,
 *  Sprite). PointLights are not draw calls. Mirrors the ≤100/zone invariant. */
function drawCalls(group: Group): number {
  let n = 0;
  group.traverse((o) => {
    if (o instanceof Mesh || o instanceof InstancedMesh || o instanceof Points || o instanceof Sprite) n++;
  });
  return n;
}

// --- 1 · torch content cap, structural over ALL zones -----------------------

describe('interior kit — torch content cap', () => {
  it('every registered zone declares at most 6 torches (content-review bound)', () => {
    for (const [id, def] of Object.entries(ZONES)) {
      expect((def.torches?.length ?? 0), `zone "${id}" torches`).toBeLessThanOrEqual(6);
    }
  });
});

// --- 2 · dread opt-in predicate --------------------------------------------

describe('dreadEligible(def) — the extracted dread gate', () => {
  it('exterior zones are dread-eligible', () => {
    expect(dreadEligible({ kind: 'exterior' })).toBe(true);
  });
  it('an interior that opts in via dreadInterior is eligible', () => {
    expect(dreadEligible({ kind: 'interior', dreadInterior: true })).toBe(true);
  });
  it('a plain interior is NOT eligible', () => {
    expect(dreadEligible({ kind: 'interior' })).toBe(false);
  });
  it('a zone with no kind (interior default) is NOT eligible', () => {
    expect(dreadEligible({})).toBe(false);
  });
  it('dreadInterior:false never opts in', () => {
    expect(dreadEligible({ kind: 'interior', dreadInterior: false })).toBe(false);
  });
  it('exterior stays eligible even without the interior flag', () => {
    expect(dreadEligible({ kind: 'exterior', dreadInterior: false })).toBe(true);
  });
});

// --- 3 · pooled flicker light never exceeds the cap -------------------------

describe('interior kit — pooled torchlight', () => {
  it('the torch pool cap never exceeds the per-zone dynamic-light cap', () => {
    expect(TUNING.lighting.torch.poolCap).toBeLessThanOrEqual(MAX_POINT_LIGHTS);
  });

  it('a 6-torch zone yields at most poolCap live PointLights', () => {
    const built = new ZoneBuilder().build(
      interiorZone(SIX_TORCH_GRID, { torches: SIX_TORCHES }), fakeAssets());
    expect(built.lights.length).toBeLessThanOrEqual(TUNING.lighting.torch.poolCap);
    expect(built.lights.length).toBe(Math.min(6, TUNING.lighting.torch.poolCap));
    for (const l of built.lights) expect(l).toBeInstanceOf(PointLight);
  });

  it('every torch still reads: all six get a bracket + an emissive flame quad', () => {
    const built = new ZoneBuilder().build(
      interiorZone(SIX_TORCH_GRID, { torches: SIX_TORCHES }), fakeAssets());
    // Brackets merge into one `merged:torch` bucket (shared atlas), flames into
    // one emissive `torch-flames` mesh — both present, so no torch is invisible.
    let hasBrackets = false;
    let flames: Mesh | undefined;
    built.group.traverse((o) => {
      if (o instanceof Mesh && o.name === 'merged:torch') hasBrackets = true;
      if (o instanceof Mesh && o.name === 'torch-flames') flames = o;
    });
    expect(hasBrackets).toBe(true);
    expect(flames).toBeDefined();
    // The flame material is emissive so it glows in a near-void-black interior.
    const mat = flames!.material as MeshStandardMaterial;
    expect(mat.emissiveIntensity).toBeGreaterThan(0);
  });

  it('torches do NOT turn an interior exterior (no instanced/height children)', () => {
    const built = new ZoneBuilder().build(
      interiorZone(SIX_TORCH_GRID, { torches: SIX_TORCHES }), fakeAssets());
    let instanced = 0;
    built.group.traverse((o) => { if (o instanceof InstancedMesh) instanced++; });
    expect(instanced).toBe(0);
    expect(built.moonDir).toBeUndefined();
    expect(built.cellHeightM(1, 1)).toBe(0);
  });
});

// --- 4 · draw-call budget holds with 6 torches ------------------------------

describe('interior kit — draw-call budget', () => {
  it('a 6-torch interior zone stays within the ≤100 draw-call budget', () => {
    const built = new ZoneBuilder().build(
      interiorZone(SIX_TORCH_GRID, { torches: SIX_TORCHES }), fakeAssets());
    expect(drawCalls(built.group)).toBeLessThanOrEqual(100);
  });
});
