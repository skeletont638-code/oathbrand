import { describe, it, expect } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import {
  DOOR_PANEL_MAX_TRIS,
  doorPanelGeometry,
  doorPropPlacements,
  gridToPlacements,
  planarUV,
  ZoneBuilder,
} from '../ZoneBuilder';
import { UNDULATION_AMP_M, undulation } from '../noise';
import { ZONES } from '../../content/zones';
import type { AssetCache } from '../assets';
import type { ZoneDef, TileKind } from '../zoneDef';

const HALF_PI = Math.PI / 2;

/**
 * A stand-in kit cache: every requested piece is a one-mesh Group whose
 * material NAME is the piece name, so a merged bucket surfaces as
 * `merged:<piece>` and a test can tell a `wall.glb` block from a `floor.glb`.
 */
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

/** Names of a built group's InstancedMesh children. */
function instancedNames(group: Group): string[] {
  const out: string[] = [];
  group.traverse((o) => {
    if (o instanceof InstancedMesh) out.push(o.name);
  });
  return out;
}

/** Names of a built group's merged static meshes (`merged:*`). */
function mergedNames(group: Group): string[] {
  const out: string[] = [];
  group.traverse((o) => {
    if (o instanceof Mesh && !(o instanceof InstancedMesh) && o.name.startsWith('merged:')) {
      out.push(o.name);
    }
  });
  return out;
}

/** First standalone Mesh in the group with the given name (e.g. `exterior-ground`). */
function meshNamed(group: Group, name: string): Mesh | undefined {
  let found: Mesh | undefined;
  group.traverse((o) => {
    if (o instanceof Mesh && o.name === name) found = o;
  });
  return found;
}

/** The InstancedMesh child with the given name (e.g. `roof-wedge`). */
function instancedNamed(group: Group, name: string): InstancedMesh | undefined {
  let found: InstancedMesh | undefined;
  group.traverse((o) => {
    if (o instanceof InstancedMesh && o.name === name) found = o;
  });
  return found;
}

/** Axis-aligned bounding-box centre (x/y/z) of a mesh's baked geometry. */
function bboxCenter(mesh: Mesh): { x: number; y: number; z: number } {
  const p = mesh.geometry.getAttribute('position');
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
}

/** The y-translation of each instance of an InstancedMesh. */
function instanceYs(mesh: InstancedMesh): number[] {
  const m = new Matrix4();
  const ys: number[] = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    ys.push(new Vector3().setFromMatrixPosition(m).y);
  }
  return ys;
}

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

describe('gridToPlacements', () => {
  it('3x3 room yields 8 walls facing inward + 1 floor', () => {
    const p = gridToPlacements(zone(['###', '#.#', '###']));
    const walls = p.filter((x) => x.piece === 'wall');
    const floors = p.filter((x) => x.piece === 'floor');
    expect(walls).toHaveLength(8);
    expect(floors).toHaveLength(1);
    expect(p).toHaveLength(9);

    // Floor sits at its cell center (cell 2m; row 1/col 1 center = (3, 3)).
    expect(floors[0]).toEqual({ piece: 'floor', x: 3, z: 3, rotY: 0 });

    // Edge walls face the open center cell (rotY = atan2(dx, dz) toward it)
    // and sit flush against the shared cell boundary: 2m cell, 0.5m-thick
    // wall (1m GLB at 0.5 kit scale) -> center offset 0.75m toward the open
    // neighbor, so the wall face lands exactly on the collider boundary.
    expect(walls).toContainEqual({ piece: 'wall', x: 3, z: 1.75, rotY: 0 }); // north wall faces +z
    expect(walls).toContainEqual({ piece: 'wall', x: 3, z: 4.25, rotY: Math.PI }); // south faces -z
    expect(walls).toContainEqual({ piece: 'wall', x: 1.75, z: 3, rotY: HALF_PI }); // west faces +x
    expect(walls).toContainEqual({ piece: 'wall', x: 4.25, z: 3, rotY: -HALF_PI }); // east faces -x

    // Corner walls have no orthogonal open neighbor: they face the open
    // diagonal's z-component (still "inward"), centered in their cell.
    expect(walls).toContainEqual({ piece: 'wall', x: 1, z: 1, rotY: 0 });
    expect(walls).toContainEqual({ piece: 'wall', x: 5, z: 1, rotY: 0 });
    expect(walls).toContainEqual({ piece: 'wall', x: 1, z: 5, rotY: Math.PI });
    expect(walls).toContainEqual({ piece: 'wall', x: 5, z: 5, rotY: Math.PI });
  });

  it('door digit yields a wall-door oriented across the passage, centered', () => {
    const p = gridToPlacements(zone(['#1#', '#.#', '###']));
    const doors = p.filter((x) => x.piece === 'wall-door');
    expect(doors).toHaveLength(1);
    // Faces the open floor cell to its south (+z), centered so the player
    // can walk through the opening.
    expect(doors[0]).toEqual({ piece: 'wall-door', x: 3, z: 1, rotY: 0 });
    // Door cells are walkable, so ground is placed under the doorway too.
    expect(p).toContainEqual({ piece: 'floor', x: 3, z: 1, rotY: 0 });
  });

  it("'D' is accepted as a door anchor like a digit", () => {
    const p = gridToPlacements(zone(['#D#', '#.#', '###']));
    expect(p.filter((x) => x.piece === 'wall-door')).toHaveLength(1);
  });

  it('unknown char throws with zone id and [row,col]', () => {
    expect(() => gridToPlacements(zone(['###', '#?#', '###']))).toThrowError(/ashen-gate/);
    expect(() => gridToPlacements(zone(['###', '#?#', '###']))).toThrowError(/\[1,1\]/);
    expect(() => gridToPlacements(zone(['###', '#?#', '###']))).toThrowError(/\?/);
  });

  it('zone-specific tile letters resolve through def.tiles', () => {
    // 'K' declared as wall, 'W' as floor: K behaves like '#', W like '.'.
    const p = gridToPlacements(zone(['KKK', 'KWK', 'KKK'], { K: 'wall', W: 'floor' }));
    expect(p.filter((x) => x.piece === 'wall')).toHaveLength(8);
    expect(p.filter((x) => x.piece === 'floor')).toHaveLength(1);
  });

  it('void cells get no floor piece (pits stay open)', () => {
    const p = gridToPlacements(zone(['###', '#~#', '###']));
    expect(p.filter((x) => x.piece === 'floor')).toHaveLength(0);
  });

  it('fully buried wall cells emit no geometry', () => {
    const p = gridToPlacements(zone(['#####', '#...#', '#.#.#', '#...#', '#####']));
    const walls = p.filter((x) => x.piece === 'wall');
    // 16 perimeter cells (4 corners face diagonals, 12 edges face the floor
    // ring) + the center pillar cell -> 17 wall placements, none skipped.
    expect(walls).toHaveLength(17);
    // Center pillar (row 2, col 2) faces its first open neighbor (north),
    // flush-offset 0.75 toward it: (5, 4.25).
    expect(walls).toContainEqual({ piece: 'wall', x: 5, z: 4.25, rotY: Math.PI });
    // ...but a 1x1 grid of just '#' has no open neighbor at all:
    expect(gridToPlacements(zone(['#']))).toHaveLength(0);
  });

  it('spawn and banner anchors are walkable floor', () => {
    const p = gridToPlacements(zone(['###', '#S#', '#B#', '###']));
    expect(p.filter((x) => x.piece === 'floor')).toHaveLength(2);
  });
});

// --- Task 2: exterior build (instanced forest + height layer) ---------------

const EXTERIOR_TILES: Record<string, TileKind> = { ',': 'floor', p: 'floor', t: 'floor', T: 'wall', H: 'wall' };

function exteriorZone(grid: string[], overrides: Partial<ZoneDef> = {}): ZoneDef {
  return {
    id: 'gate-fields',
    grid,
    cell: 2,
    tiles: EXTERIOR_TILES,
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
    kind: 'exterior',
    exteriorSky: 'field',
    ...overrides,
  };
}

describe('ZoneBuilder.build (exterior)', () => {
  it('emits exactly three instanced forest meshes and no wall.glb for T/#', () => {
    // `.` bare floor, `,` grass, `t` sparse trunk, `T`/`#` dense tree (walls,
    // but NOT castle wall.glb). No `H` here → no `merged:wall`.
    const built = new ZoneBuilder().build(exteriorZone(['.,t', 'T#.'], { heightGrid: ['011', '000'] }), fakeAssets());
    const inst = instancedNames(built.group).sort();
    expect(inst).toEqual(['grass-tuft', 'pine-dense', 'pine-sparse']);
    // The dense-tree instance carries both the `T` and the `#` cell.
    built.group.traverse((o) => {
      if (o instanceof InstancedMesh && o.name === 'pine-dense') expect(o.count).toBe(2);
    });
    // T/# rendered as trees, so the castle wall block never appears…
    expect(mergedNames(built.group)).not.toContain('merged:wall');
    // …and exterior floor cells no longer bucket as kit atlas tiles: the ground
    // is now a standalone world-planar textured mesh, not `merged:floor`.
    expect(mergedNames(built.group)).not.toContain('merged:floor');
  });

  it('renders an `H` ruin cell as the castle wall.glb block', () => {
    const built = new ZoneBuilder().build(exteriorZone(['H.']), fakeAssets());
    expect(mergedNames(built.group)).toContain('merged:wall');
  });

  it('exposes per-cell visual height (heightGrid digit × level), 0 off-grid', () => {
    const built = new ZoneBuilder().build(exteriorZone(['.,t', 'T#.'], { heightGrid: ['011', '000'] }), fakeAssets());
    expect(built.cellHeightM(0, 0)).toBe(0); // digit '0'
    expect(built.cellHeightM(0, 1)).toBeCloseTo(1.5); // digit '1' × 1.5 m
    expect(built.cellHeightM(0, 2)).toBeCloseTo(1.5);
    expect(built.cellHeightM(9, 9)).toBe(0); // out of bounds
  });

  it('an interior zone builds byte-identically — no instanced/exterior children', () => {
    const built = new ZoneBuilder().build(zone(['###', '#.#', '###']), fakeAssets());
    expect(instancedNames(built.group)).toHaveLength(0);
    expect(built.cellHeightM(1, 1)).toBe(0); // interiors are flat
    expect(built.updateExterior).toBeUndefined();
  });

  it('an exterior build exposes a moonDir; an interior build does not', () => {
    const ext = new ZoneBuilder().build(exteriorZone(['.,t', 'T#.']), fakeAssets());
    expect(ext.moonDir).toBeDefined();
    expect(ext.moonDir!.y).toBeGreaterThan(0);
    const int = new ZoneBuilder().build(zone(['###', '#.#', '###']), fakeAssets()); // `zone()` is the file's interior helper
    expect(int.moonDir).toBeUndefined();
  });

  it('an exterior build emits one exterior-ground mesh with a uv attribute', () => {
    const built = new ZoneBuilder().build(exteriorZone(['.,t', 'p#.']), fakeAssets());
    const g = meshNamed(built.group, 'exterior-ground');
    expect(g).toBeDefined();
    expect(g!.geometry.getAttribute('uv')).toBeDefined();
  });

  it('winds the exterior ground up-facing (+y) so it renders from above', () => {
    const built = new ZoneBuilder().build(exteriorZone(['.,t', 'p#.']), fakeAssets());
    const g = meshNamed(built.group, 'exterior-ground')!;
    // Every vertex normal must face up — a down-facing (0,-1,0) winding would be
    // FrontSide-culled from the player's above-ground viewpoint (and unlit by the moon).
    const normal = g.geometry.getAttribute('normal');
    expect(normal).toBeDefined();
    for (let i = 0; i < normal.count; i++) {
      expect(normal.getY(i)).toBeGreaterThan(0);
    }
  });

  it('forest instanced materials keep vertexColors (multiply tint) with a map slot', () => {
    const built = new ZoneBuilder().build(exteriorZone([',t', 'T#']), fakeAssets());
    let checked = 0;
    built.group.traverse((o) => {
      if (o instanceof InstancedMesh) {
        const m = o.material as MeshStandardMaterial;
        expect(m.vertexColors).toBe(true); // per-instance tint survives × bark map
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('C3: tree instances carry seeded tilt; roof wedges stay upright', () => {
    const built = new ZoneBuilder().build(exteriorZone(['TH', 'T.']), fakeAssets());
    const m = new Matrix4(); const q = new Quaternion(); const p = new Vector3(); const s = new Vector3();
    let treeTilted = false;
    built.group.traverse((o) => {
      if (!(o instanceof InstancedMesh)) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(p, q, s);
        const tilted = Math.abs(q.x) > 1e-4 || Math.abs(q.z) > 1e-4;
        if (o.name === 'pine-dense' && tilted) treeTilted = true;
        if (o.name === 'roof-wedge') expect(tilted).toBe(false); // buildings never lean
      }
    });
    expect(treeTilted).toBe(true);
  });

  it('keeps the kit merge bucket count at exactly 1 for an exterior zone (≤6 budget)', () => {
    const built = new ZoneBuilder().build(exteriorZone(['H,t', 'T#.']), fakeAssets());
    // only the wall/H atlas remains a kit bucket; ground/skirt/forest are separate meshes
    expect(mergedNames(built.group)).toEqual(['merged:wall']); // the H ruin block, and nothing else
    expect(mergedNames(built.group).length).toBeLessThanOrEqual(6);
    expect(mergedNames(built.group)).not.toContain('merged:floor');
  });

  // --- Task 9: procedural props + roof-wedge cap -----------------------------

  it('a gibbet prop builds as a standalone procedural mesh, not a kit piece', () => {
    const built = new ZoneBuilder().build(
      exteriorZone(['..', '..'], { props: [{ kind: 'gibbet', at: [0, 0] }] }), fakeAssets());
    let found = false;
    built.group.traverse((o) => { if ((o as Mesh).name === 'prop:gibbet') found = true; });
    expect(found).toBe(true);
  });

  it('H/A house cells get a roof-wedge instanced cap (1 draw call)', () => {
    const built = new ZoneBuilder().build(exteriorZone(['H.', 'A.']), fakeAssets());
    expect(instancedNames(built.group)).toContain('roof-wedge');
  });

  // --- Task 10: smooth wind sway + ground clutter -----------------------------

  it('forest instanced geometry carries a per-instance aWindPhase attribute', () => {
    const built = new ZoneBuilder().build(exteriorZone([',t', 'T#']), fakeAssets());
    let hasPhase = false;
    built.group.traverse((o) => {
      if (o instanceof InstancedMesh && o.geometry.getAttribute('aWindPhase')) hasPhase = true;
    });
    expect(hasPhase).toBe(true);
  });
  it('scatter stamps one instanced mesh per kind (1 draw call each)', () => {
    const built = new ZoneBuilder().build(
      exteriorZone(['..', '..'], { scatter: [{ kind: 'stone', cells: [[0, 0], [1, 1]] }] }), fakeAssets());
    expect(instancedNames(built.group)).toContain('clutter-stone');
  });
  it('the standalone banner pivots about its own pole: world anchor on mesh.position, geometry local', () => {
    // Regression guard (T10 review): baking the FULL world placement into the
    // geometry and leaving the mesh at (0,0,0) makes main's rotation.z sway
    // pivot about the WORLD ORIGIN — a metre-scale heave, not a pendulum skew.
    // The anchor must live on mesh.position; the geometry stays at its base.
    const built = new ZoneBuilder().build(
      exteriorZone(['.B', '..'], { banner: { at: [0, 1], name: 'Test Banner' } }), fakeAssets());
    const bannerMesh = meshNamed(built.group, 'banner-standalone');
    expect(bannerMesh).toBeDefined();
    expect(built.bannerMesh).toBe(bannerMesh);
    // World anchor carried by the mesh transform (banner cell [0,1] → cx=3,
    // cz=1, hung on the implicit north wall: z = cz − setback, setback =
    // half − BANNER_BACK_M × BANNER_EXT_SCALE = 1 − 0.69 × 0.65).
    expect(bannerMesh!.position.x).toBeCloseTo(3, 6);
    expect(bannerMesh!.position.z).toBeCloseTo(1 - (1 - 0.69 * 0.65), 6);
    expect(bannerMesh!.position.y).toBeCloseTo(
      built.groundYAt(bannerMesh!.position.x, bannerMesh!.position.z), 6);
    // Geometry stays LOCAL to the pole (bbox centred near its own origin, not
    // out at world x≈3) so rotation.z skews about the attachment point.
    bannerMesh!.geometry.computeBoundingBox();
    const c = bannerMesh!.geometry.boundingBox!.getCenter(new Vector3());
    expect(Math.abs(c.x)).toBeLessThan(1);
    expect(Math.abs(c.z)).toBeLessThan(1);
  });

  it("a prop kind inherited from Object.prototype (e.g. 'toString') stays a kit piece", () => {
    // Object.hasOwn guard: a plain index/`in` lookup on PROCEDURAL_PROPS reaches
    // the prototype chain, so a kit prop named 'toString' would false-positive
    // as procedural (its "geometry factory" being Object.prototype.toString).
    const built = new ZoneBuilder().build(
      exteriorZone(['..', '..'], { props: [{ kind: 'toString', at: [0, 0] }] }), fakeAssets());
    expect(mergedNames(built.group)).toContain('merged:toString');
  });

  // --- Task C2: undulating terrain + shared y-grounding -----------------------

  it('the ground undulates within the amplitude and stays watertight at shared corners', () => {
    const built = new ZoneBuilder().build(exteriorZone(['..', '..']), fakeAssets());
    const g = meshNamed(built.group, 'exterior-ground')!;
    const pos = g.geometry.getAttribute('position');
    expect(g.geometry.getAttribute('uv').count).toBe(pos.count); // subdivision kept one UV per vertex
    let deviated = false;
    const atKey = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      expect(Math.abs(y)).toBeLessThanOrEqual(UNDULATION_AMP_M + 1e-6); // flat heightGrid ⇒ pure undulation
      if (Math.abs(y) > 0.01) deviated = true;
      const key = `${pos.getX(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      const prev = atKey.get(key);
      if (prev !== undefined) expect(y).toBeCloseTo(prev, 6); // duplicated corners weld
      atKey.set(key, y);
    }
    expect(deviated).toBe(true);
  });
  it('ground orientation still faces +y after the undulation (Task 6 guard extended)', () => {
    const built = new ZoneBuilder().build(exteriorZone(['..']), fakeAssets());
    const normal = meshNamed(built.group, 'exterior-ground')!.geometry.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) expect(normal.getY(i)).toBeGreaterThan(0);
  });
  it('groundYAt = cell height + undulation on exteriors; flat on interiors', () => {
    const ext = new ZoneBuilder().build(exteriorZone(['..']), fakeAssets());
    expect(ext.groundYAt(1, 1)).toBeCloseTo(undulation(1, 1), 6);
    const int = new ZoneBuilder().build(zone(['###', '#.#', '###']), fakeAssets());
    expect(int.groundYAt(3, 3)).toBe(0);
  });
  it('skirt lips weld to the displaced ground across terraced seams (cross-buffer)', () => {
    // Terraced fixture: heightGrid '01'/'00' yields one Δ1 E/W seam ([0,0]↔[0,1])
    // AND one Δ1 N/S seam ([0,1]↔[1,1]) — both pushQuad branches. All cells are
    // walkable floor, so every seam is a RAMP: both lips of every riser have
    // ground on their side (a cliff's void side has no ground by design).
    const built = new ZoneBuilder().build(
      exteriorZone(['..', '..'], { heightGrid: ['01', '00'] }), fakeAssets());
    const groundPos = meshNamed(built.group, 'exterior-ground')!.geometry.getAttribute('position');
    const skirt = meshNamed(built.group, 'exterior-terrain');
    expect(skirt).toBeDefined(); // the terraced fixture MUST produce a skirt
    const skirtPos = skirt!.geometry.getAttribute('position');
    expect(skirtPos.count).toBeGreaterThan(0);
    // Index ground verts: (x,z) → the ground heights there. A seam column carries
    // one height per adjacent terrace (the low AND the high cell both own the edge).
    const groundYs = new Map<string, number[]>();
    for (let i = 0; i < groundPos.count; i++) {
      const key = `${groundPos.getX(i).toFixed(3)},${groundPos.getZ(i).toFixed(3)}`;
      const ys = groundYs.get(key) ?? [];
      ys.push(groundPos.getY(i));
      groundYs.set(key, ys);
    }
    // EVERY skirt vertex (both lips, ends + midpoints) must coincide with a
    // ground vertex at the same (x,z) and the same displaced height — the
    // empirical ground↔skirt watertight-seam guarantee.
    for (let i = 0; i < skirtPos.count; i++) {
      const key = `${skirtPos.getX(i).toFixed(3)},${skirtPos.getZ(i).toFixed(3)}`;
      const ys = groundYs.get(key);
      expect(ys, `no ground vertex under skirt lip at (${key})`).toBeDefined();
      const gap = Math.min(...ys!.map((gy) => Math.abs(gy - skirtPos.getY(i))));
      expect(gap, `skirt lip at (${key}) is ${gap} m off the ground sheet`).toBeLessThanOrEqual(1e-6);
    }
  });
});

// --- H1: no sky-through-ground (dense-tree / border cells were floorless) -----

describe('ZoneBuilder exterior ground coverage (H1)', () => {
  const exteriors = Object.entries(ZONES).filter(([, def]) => def?.kind === 'exterior');

  it('the derivation sees real exterior zones', () => {
    expect(exteriors.length).toBeGreaterThan(0);
  });

  for (const [id, def] of exteriors) {
    it(`${id}: EVERY non-designed-void cell emits a ground quad (dome cannot show through)`, () => {
      // Derived over the REAL grid: the dome renders with depthWrite:false, so
      // any cell that emits no ground paints the sky straight through the floor
      // (the oath-oak/checkpoint hole, the border treelines, the forest stand).
      // Only a `~` gorge (or a tile authored as 'void') is allowed to be floorless.
      const built = new ZoneBuilder().build(def!, fakeAssets());
      const ground = meshNamed(built.group, 'exterior-ground');
      expect(ground, `${id}: no exterior-ground mesh`).toBeDefined();
      const pos = ground!.geometry.getAttribute('position');
      const keys = new Set<string>();
      for (let i = 0; i < pos.count; i++) keys.add(`${pos.getX(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`);
      const cell = def!.cell;
      const half = cell / 2;
      const missing: string[] = [];
      for (let row = 0; row < def!.grid.length; row++) {
        const line = def!.grid[row];
        for (let col = 0; col < line.length; col++) {
          const ch = line[col];
          const designedVoid = ch === '~' || def!.tiles?.[ch] === 'void';
          if (designedVoid) continue; // the descent gorge is meant to be bottomless
          const key = `${(col * cell + half).toFixed(3)},${(row * cell + half).toFixed(3)}`;
          if (!keys.has(key)) missing.push(`[${row},${col}]='${ch}'`);
        }
      }
      expect(missing, `${id} floorless (sky-through-ground) cells: ${missing.join(' ')}`).toEqual([]);
    });
  }

  it('the descent gorge `~` cells stay floorless (designed bottomless void preserved)', () => {
    const built = new ZoneBuilder().build(ZONES['pilgrims-descent']!, fakeAssets());
    const pos = meshNamed(built.group, 'exterior-ground')!.geometry.getAttribute('position');
    const keys = new Set<string>();
    for (let i = 0; i < pos.count; i++) keys.add(`${pos.getX(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`);
    // [2,5] is a `~` gorge cell (row 2 = '#~~~~~~~~~p~#') → its centre must NOT be floored.
    expect(keys.has(`${(5 * 2 + 1).toFixed(3)},${(2 * 2 + 1).toFixed(3)}`)).toBe(false);
  });
});

describe('The Watchtower builds through the full path (Task 6)', () => {
  it('the guardroom (interior) and roof-walk (exterior) both build without throwing', () => {
    const ground = new ZoneBuilder().build(ZONES['tower-ground']!, fakeAssets());
    const upper = new ZoneBuilder().build(ZONES['tower-upper']!, fakeAssets());
    expect(ground.group.children.length).toBeGreaterThan(0);
    expect(upper.group.children.length).toBeGreaterThan(0);
    // The exterior roof-walk gets a ground mesh (sky/moon path); the interior does not.
    expect(meshNamed(upper.group, 'exterior-ground')).toBeDefined();
    expect(meshNamed(ground.group, 'exterior-ground')).toBeUndefined();
  });

  it('the off-grid tower-shell silhouette lands behind the Gate Fields Tower Door', () => {
    const built = new ZoneBuilder().build(ZONES['gate-fields']!, fakeAssets());
    const shell = meshNamed(built.group, 'prop:tower-shell');
    expect(shell, 'gate-fields is missing the tower-shell backdrop prop').toBeDefined();
    // Placed at grid [3,-1] → world x = -1 (one cell WEST of the Tower Door cell
    // [3,0], whose centre is x=1): a treeline backdrop, off the walkable grid.
    expect(shell!.position.x).toBeCloseTo(-1, 3);
    expect(shell!.position.z).toBeCloseTo(7, 3); // row 3 → z = 3*2 + 1
  });
});

describe('the skyline ruined-keep silhouettes land off-grid at vista distance (Task 10)', () => {
  /** Every `prop:keep-shell` mesh's world XZ, as sorted "x,z" keys. */
  function keepShellXZ(group: Group): string[] {
    const keys: string[] = [];
    group.traverse((o) => {
      if (o instanceof Mesh && o.name === 'prop:keep-shell') {
        keys.push(`${o.position.x.toFixed(3)},${o.position.z.toFixed(3)}`);
      }
    });
    return keys.sort();
  }

  it('the Ashen Gate reveal gets one keep-shell deep on the far-WEST horizon', () => {
    const built = new ZoneBuilder().build(ZONES['ashen-gate']!, fakeAssets());
    // Grid [-7,-1] → world x = -1·2+1 = -1, z = -7·2+1 = -13: far west of the
    // torii centre (col 3), deep behind the mid-ground ruin cluster (rows -2..-5).
    expect(keepShellXZ(built.group)).toEqual([`${(-1).toFixed(3)},${(-13).toFixed(3)}`]);
  });

  it('the Pilgrim\'s Descent vista gets two drowned-lands keep-shells, both clear of the Watcher column', () => {
    const built = new ZoneBuilder().build(ZONES['pilgrims-descent']!, fakeAssets());
    // Grid [13,1] → world (3, 27) [due-south, beyond the sealed bottom] and
    // [11,-1] → world (-1, 23) [off the west wall]. The Watcher anchor is at
    // [9,5] → world x=11: BOTH shells sit at x ≤ 3 (due-south or WEST of the
    // vista→Watcher azimuth), so neither can occlude his silhouette reveal.
    expect(keepShellXZ(built.group)).toEqual(
      [`${(-1).toFixed(3)},${(23).toFixed(3)}`, `${(3).toFixed(3)},${(27).toFixed(3)}`].sort(),
    );
    // Contract guard: no keep-shell lands on the Watcher's world column (x=11).
    built.group.traverse((o) => {
      if (o instanceof Mesh && o.name === 'prop:keep-shell') {
        expect(o.position.x).toBeLessThan(11);
      }
    });
  });
});

// --- H2 / H3: cinder wall + roof welding --------------------------------------

describe('ZoneBuilder cinder wall/roof welding (H2/H3)', () => {
  it('H2: adjacent wall slabs share edge heights on flat terrain (no stepped bases)', () => {
    // Flat cinder terrain: pre-H2 each slab settled to its OWN cell-centre
    // groundYAt (base + undulation), so neighbours stepped by up to ~0.2 m. They
    // must now seat to one shared flat base (cellHeightM − settle) → welded.
    const built = new ZoneBuilder().build(exteriorZone(['HHH']), fakeAssets());
    const pos = meshNamed(built.group, 'merged:wall')!.geometry.getAttribute('position');
    // Split the merged slabs by x: cell centres 1/3/5 → boundaries at x=2, x=4.
    const slabs = [
      { min: Infinity, max: -Infinity },
      { min: Infinity, max: -Infinity },
      { min: Infinity, max: -Infinity },
    ];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const s = x < 2 ? 0 : x < 4 ? 1 : 2;
      slabs[s].min = Math.min(slabs[s].min, y);
      slabs[s].max = Math.max(slabs[s].max, y);
    }
    // Every slab base AND top identical → the run reads as one weld, not steps.
    expect(slabs[1].min).toBeCloseTo(slabs[0].min, 6);
    expect(slabs[2].min).toBeCloseTo(slabs[0].min, 6);
    expect(slabs[1].max).toBeCloseTo(slabs[0].max, 6);
    expect(slabs[2].max).toBeCloseTo(slabs[0].max, 6);
  });

  it('H2: a wall abutting another wall is centred (no flush sliver between neighbours)', () => {
    // H[0,1] abuts H[0,0] to its west and has open floor east. Pre-H2 it shoved
    // 0.75 m east toward the open side while its neighbour shoved/centred the
    // other way → a see-through sliver. A run member must stay CENTRED.
    const built = new ZoneBuilder().build(exteriorZone(['HH.']), fakeAssets());
    const pos = meshNamed(built.group, 'merged:wall')!.geometry.getAttribute('position');
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x >= 2.5) { min = Math.min(min, x); max = Math.max(max, x); } // the east slab (col 1)
    }
    expect((min + max) / 2).toBeCloseTo(3, 6); // centred on cell col1 (x=3), NOT shoved to 3.75
  });

  it('H2: an isolated wall (no wall neighbour) still shoves flush onto its open boundary', () => {
    // Regression guard: a lone ruin block should still meet the collider edge.
    const built = new ZoneBuilder().build(exteriorZone(['...', '.H.', '...']), fakeAssets());
    const c = bboxCenter(meshNamed(built.group, 'merged:wall')!);
    expect(c.x).toBeCloseTo(3, 6);
    expect(c.z).toBeCloseTo(3 - 0.75, 6); // flush 0.75 toward its first open neighbour (N)
  });

  it('H3: the roof-wedge tracks its wall — offset over an isolated (shoved) wall, not centred over open ground', () => {
    const built = new ZoneBuilder().build(exteriorZone(['...', '.H.', '...']), fakeAssets());
    const roof = instancedNamed(built.group, 'roof-wedge')!;
    const m = new Matrix4();
    roof.getMatrixAt(0, m);
    const t = new Vector3().setFromMatrixPosition(m);
    const wall = bboxCenter(meshNamed(built.group, 'merged:wall')!);
    expect(t.x).toBeCloseTo(wall.x, 6);
    expect(t.z).toBeCloseTo(wall.z, 6); // roof rides the wall's flush offset (2.25), not the cell centre (3)
  });

  it('H3: roof-wedges on flat terrain all seat at ONE height (welded to the flat wall base, not per-cell undulation)', () => {
    // Pre-H3 the roof stamped at groundYAt(cell centre) − settle (undulated), so
    // eaves floated at per-cell heights. They must seat at the wall's flat base.
    const built = new ZoneBuilder().build(exteriorZone(['HHH']), fakeAssets());
    const ys = instanceYs(instancedNamed(built.group, 'roof-wedge')!);
    expect(ys.length).toBe(3);
    for (const y of ys) expect(y).toBeCloseTo(ys[0], 6);
  });
});

describe('custom exterior masonry letters seat on the welded flat base (Task 6 review)', () => {
  // towerUpper's room-forming `M` was the first custom exterior wall letter to
  // hit the generic fallback, which seated at groundYAt − KIT_SETTLE_M — the
  // undulated per-cell-centre height. Adjacent slabs stepped ~0.1 m and a base
  // could float ~0.07 m above the abutting floor: exactly the defect class H2
  // fixed for H/A. The fallback must use the same welded flat-base seating.
  const M_TILES = { ...EXTERIOR_TILES, M: 'wall' as TileKind };

  it('an M run welds: every slab shares one base and top (undulation-immune)', () => {
    const built = new ZoneBuilder().build(exteriorZone(['MMM'], { tiles: M_TILES }), fakeAssets());
    const pos = meshNamed(built.group, 'merged:wall')!.geometry.getAttribute('position');
    const slabs = [
      { min: Infinity, max: -Infinity },
      { min: Infinity, max: -Infinity },
      { min: Infinity, max: -Infinity },
    ];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const s = x < 2 ? 0 : x < 4 ? 1 : 2;
      slabs[s].min = Math.min(slabs[s].min, y);
      slabs[s].max = Math.max(slabs[s].max, y);
    }
    expect(slabs[1].min).toBeCloseTo(slabs[0].min, 6);
    expect(slabs[2].min).toBeCloseTo(slabs[0].min, 6);
    expect(slabs[1].max).toBeCloseTo(slabs[0].max, 6);
    expect(slabs[2].max).toBeCloseTo(slabs[0].max, 6);
  });

  it('M seats exactly like H (cellHeightM − WALL_SETTLE_M), and rides its heightGrid band', () => {
    // Same formula as the H house blocks: identical base on band 0, and a band-1
    // M sits exactly one HEIGHT_LEVEL_M (1.5 m) above a band-0 one.
    const baseOf = (grid: string[], heightGrid?: string[]): number => {
      const built = new ZoneBuilder().build(exteriorZone(grid, { tiles: M_TILES, heightGrid }), fakeAssets());
      const pos = meshNamed(built.group, 'merged:wall')!.geometry.getAttribute('position');
      let min = Infinity;
      for (let i = 0; i < pos.count; i++) min = Math.min(min, pos.getY(i));
      return min;
    };
    expect(baseOf(['M.'])).toBeCloseTo(baseOf(['H.']), 6); // the H2 welded seat, exactly
    expect(baseOf(['M.'], ['10'])).toBeCloseTo(baseOf(['M.'], ['00']) + 1.5, 6); // band-1 terrace
  });

  it('M still blocks movement and sight (the fix is visual seating only)', () => {
    const built = new ZoneBuilder().build(exteriorZone(['.M.'], { tiles: M_TILES }), fakeAssets());
    expect(built.collider.raycastWall({ x: 1, z: 1 }, { x: 5, z: 1 })).toBe(true); // wall between
  });
});

describe('planarUV', () => {
  it('tiles seamlessly at 2 m per repeat', () => {
    expect(planarUV(0, 0)).toEqual([0, 0]);
    expect(planarUV(2, 4)).toEqual([1, 2]);
  });
});

describe('door prop (world-expansion v1.2, Task 1)', () => {
  it('the shared door panel is within the ≤120-tri budget', () => {
    const geo = doorPanelGeometry();
    const tris = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
    expect(tris).toBeLessThanOrEqual(DOOR_PANEL_MAX_TRIS);
    expect(geo.attributes.uv).toBeDefined(); // textured through the PS1 pipeline
  });

  it('places a panel on each decorated gate cell, aligned with its wall-door frame', () => {
    const def = zone(['#2#', '#.#', '###']);
    const props = doorPropPlacements(def, new Set(['2']));
    expect(props).toHaveLength(1);
    expect(props[0]).toMatchObject({ row: 0, col: 1 });
    expect(props[0].x).toBeCloseTo(3); // col 1 centre (cell 2)
    expect(props[0].z).toBeCloseTo(1); // row 0 centre
    // The panel faces exactly where the gate's `wall-door` frame faces, so the
    // iron fills the opening rather than sitting askew in it.
    const frame = gridToPlacements(def).find((p) => p.piece === 'wall-door');
    expect(frame).toBeDefined();
    expect(props[0].rotY).toBeCloseTo(frame!.rotY);
  });

  it('covers every cell of a wide gate (repeated digit)', () => {
    const def = zone(['######', '#....#', '#.22.#', '######']);
    expect(doorPropPlacements(def, new Set(['2']))).toHaveLength(2);
  });

  it('places nothing when no gate is decorated (v1 zones build unchanged)', () => {
    const def = zone(['#2#', '#.#', '###']);
    expect(doorPropPlacements(def, new Set())).toEqual([]);
  });
});
