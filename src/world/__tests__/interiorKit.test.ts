/**
 * Interior kit (world-expansion v1.2, Task 2) — the wall-torch prop + pooled
 * flicker light, the interior dread opt-in predicate, and the per-zone torch
 * content cap. The kit is DORMANT: no shipped zone declares `torches` yet, so
 * these tests exercise it through synthetic zones + a structural sweep over the
 * real registry (which guards Tasks 4–8 the moment they author interiors).
 */
import { readFileSync } from 'node:fs';
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

// --- Task 2b · FIX 1: firing and manifestation share ONE dread gate ---------
// `spawnPresenceViews` / the scare gather live in main's private render closure
// (needs a live scene + GLBs — not exercisable headlessly), so this asserts the
// seam in the source directly, the same pattern visionGhostGrounding.test.ts
// uses for `buildGhosts`. The invariant: a `dreadInterior` zone that FIRES a
// presence beat (gather + dread.update both dreadEligible-gated) must also get
// its presence VIEWS spawned + its watcherAnchors set — or the beat silently
// no-ops into null views (all ?.-guarded: no crash, just a vanishing scare).

describe('main.ts dread gates route through dreadEligible (Task 2b seam)', () => {
  const src = readFileSync(new URL('../../main.ts', import.meta.url), 'utf8');

  it('spawnPresenceViews (manifestation: views + anchors) gates on dreadEligible', () => {
    const start = src.indexOf('function spawnPresenceViews');
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, src.indexOf('\n  }', start));
    expect(body).toContain('dreadEligible(');
    expect(body).not.toContain("kind !== 'exterior'"); // the pre-2b raw gate
    // The anchors re-scope lives INSIDE the gated body, so a dreadInterior
    // zone's watcherAnchors are set exactly when its beats may fire.
    expect(body).toContain('setAnchors(activeDef.watcherAnchors');
  });

  it('the scare/anchor gather (dreadScareData) filters by the same predicate', () => {
    const start = src.indexOf('function dreadScareData');
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, src.indexOf('return { scares', start));
    expect(body).toContain('dreadEligible(');
    expect(body).not.toContain("kind !== 'exterior'");
  });

  it('the per-frame dread.update gate uses dreadEligible too', () => {
    const start = src.indexOf('dread.update({');
    expect(start).toBeGreaterThan(0);
    // The nearest `if (...)` above the update call is the gate.
    const gate = src.lastIndexOf('if (dreadEligible(activeDef))', start);
    expect(gate).toBeGreaterThan(0);
    expect(start - gate).toBeLessThan(900); // same block, not a distant stray match
  });

  it('the GV physical boundaries STAY keyed to kind === exterior (deliberate)', () => {
    // Conscious decision (Task 2b): the ember-cap restore on leaving Greater
    // Vael and the boot/resume cap restore are PHYSICAL-boundary rules — a
    // dreadInterior castle room is still inside the castle, so they must NOT
    // follow the dread gate. Pin both so a later sweep can't "fix" them.
    expect(src).toContain("resolveZone(from).kind === 'exterior' && def.kind !== 'exterior'");
    expect(src.includes('bootEmberCap')).toBe(true);
  });
});

// --- Task 2b · FIX 2: interior zones render heightGrid elevation ------------

/** 3×5 interior room: cell [1,2] raised one band (1.5 m), the rest flat. */
const RAISED_GRID = ['#####', '#...#', '#####'];
const RAISED_HEIGHTS = ['00000', '00100', '00000'];

/** Vertex ys of `mesh` whose baked x/z fall inside the given cell footprint. */
function tileYsInCell(mesh: Mesh, row: number, col: number, cellM = 2): number[] {
  const p = mesh.geometry.getAttribute('position');
  const ys: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (x > col * cellM && x < (col + 1) * cellM && z > row * cellM && z < (row + 1) * cellM) {
      ys.push(p.getY(i));
    }
  }
  return ys;
}

function meshNamed(group: Group, name: string): Mesh | undefined {
  let found: Mesh | undefined;
  group.traverse((o) => { if (o instanceof Mesh && o.name === name) found = o; });
  return found;
}

describe('interior heightGrid elevation (Task 2b)', () => {
  it('(a) raised cell: tile y, cellHeightM and groundYAt agree; flat cell stays 0; slope stays walkable', () => {
    const built = new ZoneBuilder().build(
      interiorZone(RAISED_GRID, { heightGrid: RAISED_HEIGHTS }), fakeAssets());
    // The kit floor piece (fake: unit box at 0.5 scale → ±0.25 about its seat)
    // seats at the cell's height: raised cell [1,2] mid-y ≈ 1.5, flat [1,1] ≈ 0.
    const floor = meshNamed(built.group, 'merged:floor');
    expect(floor).toBeDefined();
    const raised = tileYsInCell(floor!, 1, 2);
    const flat = tileYsInCell(floor!, 1, 1);
    expect(raised.length).toBeGreaterThan(0);
    expect(flat.length).toBeGreaterThan(0);
    const mid = (ys: number[]): number => (Math.min(...ys) + Math.max(...ys)) / 2;
    expect(mid(raised)).toBeCloseTo(1.5, 6);
    expect(mid(flat)).toBeCloseTo(0, 6);
    // The THREE height authorities agree exactly (no undulation indoors):
    expect(built.cellHeightM(1, 2)).toBeCloseTo(1.5, 6);
    expect(built.groundYAt(5, 3)).toBeCloseTo(1.5, 6); // raised cell centre
    expect(built.groundYAt(3, 3)).toBeCloseTo(0, 6); // flat cell centre
    // Collision is the flat 2D grid: the band step is a slope, not a barrier.
    expect(built.collider.raycastWall({ x: 3, z: 3 }, { x: 5, z: 3 })).toBe(false);
  });

  it('(a2) an interior riser fills the band seam, with NO undulation (exact 0 / 1.5 ys)', () => {
    const built = new ZoneBuilder().build(
      interiorZone(RAISED_GRID, { heightGrid: RAISED_HEIGHTS }), fakeAssets());
    const riser = meshNamed(built.group, 'interior-riser');
    expect(riser).toBeDefined();
    const p = riser!.geometry.getAttribute('position');
    expect(p.count).toBeGreaterThan(0);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // Every riser vertex sits EXACTLY on a band level — dressed stone, no
      // terrain noise (the exterior skirt's undulation stays exterior-only).
      expect(Math.abs(y) < 1e-9 || Math.abs(y - 1.5) < 1e-9, `riser y ${y}`).toBe(true);
    }
  });

  it('(b) dormancy: an interior WITHOUT heightGrid builds flat with no riser (v1-exact)', () => {
    const built = new ZoneBuilder().build(interiorZone(RAISED_GRID), fakeAssets());
    const floor = meshNamed(built.group, 'merged:floor')!;
    const p = floor.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(0.25 + 1e-9); // ±half tile, seat 0
    }
    expect(meshNamed(built.group, 'interior-riser')).toBeUndefined();
    expect(built.groundYAt(3, 3)).toBe(0);
  });

  it('(c) the exterior skirt keeps its name and its undulation (unchanged path)', () => {
    const built = new ZoneBuilder().build(
      {
        ...interiorZone(['..', '..'], { heightGrid: ['01', '00'] }),
        kind: 'exterior',
        exteriorSky: 'field',
        tiles: {},
      } as ZoneDef,
      fakeAssets());
    const skirt = meshNamed(built.group, 'exterior-terrain');
    expect(skirt).toBeDefined();
    expect(meshNamed(built.group, 'interior-riser')).toBeUndefined();
    // Undulated: at least one vertex is OFF the exact band levels.
    const p = skirt!.geometry.getAttribute('position');
    let off = false;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (Math.abs(y) > 1e-9 && Math.abs(y - 1.5) > 1e-9) off = true;
    }
    expect(off).toBe(true);
  });
});
