/**
 * ZoneBuilder — turns a `ZoneDef` ASCII grid + satellites into a renderable
 * three.js group:
 *
 * - `gridToPlacements` (pure, unit-tested) maps grid chars to kit-piece
 *   placements, auto-orienting walls to face their open neighbors.
 * - `ZoneBuilder.build` instantiates kit templates per placement, bakes all
 *   transforms into cloned geometry, merges by material (≤6 merged static
 *   meshes per zone), patches every material through the PS1 pipeline's
 *   `patchMaterial`, and places torch PointLights (≤4, no shadows).
 *
 * Grid convention (see zoneDef.ts / collision.ts): cell = 2m, row↔z, col↔x;
 * row 0 col 0 spans x∈[0,2] z∈[0,2]. Kit architecture is a 4m module, so
 * grid pieces are placed at uniform scale 0.5; props are life-sized.
 */
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PointLight,
  Quaternion,
  Vector3,
} from 'three';
import type { Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patchMaterial } from '../ps1/patchMaterial';
import { GridCollider } from './collision';
import type { AssetCache } from './assets';
import type { DoorDef, EnemySpawn, GridPos, ItemSpot, LoreSpot, TileKind, ZoneDef } from './zoneDef';
import { grassGeometry, pineGeometry, trunkGeometry, WIND } from './exteriorForest';
import { undulation, UNDULATION_AMP_M } from './noise';
import { bonePileGeometry, gibbetGeometry, roofWedgeGeometry, stoneGeometry, stumpGeometry } from './exteriorProps';
import { buildExteriorSky } from './exteriorSky';
import { getTexture } from './textures';
import type { Anomaly } from '../content/anomalies';

/** One kit piece placed on the grid. `x`/`z` are world meters, `rotY` yaw. */
export interface Placement {
  piece: string;
  x: number;
  z: number;
  rotY: number;
}

/** A zone door with its world-space anchor position (cell center). */
export interface PlacedDoor {
  def: DoorDef;
  position: Vector3;
}

/** The zone's banner checkpoint, resolved to world space. */
export interface PlacedBanner {
  name: string;
  position: Vector3;
}

/** A lore spot resolved to world space. */
export interface PlacedLore {
  spot: LoreSpot;
  position: Vector3;
}

/** A takeable world item resolved to world space (the Gatekey pedestal). */
export interface PlacedItem {
  spot: ItemSpot;
  position: Vector3;
}

export interface BuiltZone {
  group: Group;
  collider: GridCollider;
  /** The built def's cell size (m) — world placement (enemy spawns, door
   * cells) MUST use this, never a zone-def constant (T9 review). */
  cellM: number;
  spawns: EnemySpawn[];
  doors: PlacedDoor[];
  banner?: PlacedBanner;
  /** The standalone (un-merged) exterior banner mesh, so `main` can sway it
   *  smoothly (Task 10). Undefined on interiors (banner stays merged — no sway). */
  bannerMesh?: Mesh;
  lore: PlacedLore[];
  /** Takeable world-item pickups resolved to world space. */
  items: PlacedItem[];
  /** Torch PointLights (children of `group`), exposed for flicker updates. */
  lights: PointLight[];
  /** Visual floor height (m) of a cell — the exterior height layer; always 0
   *  for interior zones (no `heightGrid`), so `main` can lerp it uniformly. */
  cellHeightM(row: number, col: number): number;
  /** Surface height (m) at a world point: cell base + the C2 undulation on
   *  exteriors; flat `cellHeightM` on interiors. THE one function every static
   *  placement and dynamic view-y consumer samples, so feet can never drift. */
  groundYAt(worldX: number, worldZ: number): number;
  /** Per-frame tick for exterior ambient FX (ash-fall drift). Undefined on
   *  interior zones — the ZoneManager only calls it when present. */
  updateExterior?(dtMs: number): void;
  /** Unit direction toward the moon (realism pass, spec §3) — main orients the
   *  shared DirectionalLight from it. Set on exterior builds; undefined interior. */
  moonDir?: Vector3;
}

// --- budgets & kit facts ----------------------------------------------------

/** Kit architecture is a 4m module; the grid cell is 2m. */
const KIT_SCALE = 0.5;
/** wall.glb is 1m thick at module scale (KIT.md bbox). */
const WALL_THICKNESS_M = 1;
/** Perf budget: at most this many merged static meshes per zone. */
const MAX_MERGED_MESHES = 6;
/** Perf budget: at most this many dynamic PointLights per zone. */
const MAX_POINT_LIGHTS = 4;
/** Torch bracket height on a 2m wall. */
const TORCH_MOUNT_Y = 1.1;
const TORCH_LIGHT_COLOR = 0xffa050;
const TORCH_LIGHT_INTENSITY = 8;
const TORCH_LIGHT_DISTANCE = 11;
/** banner.glb extends to z≈0.69 behind its origin (KIT.md) — used to rest it on a wall face. */
const BANNER_BACK_M = 0.69;
/** Exterior checkpoint banners render larger so the kneel-point is findable
 *  across an open field/gorge (spec §5, Pilgrim's readability). */
const BANNER_EXT_SCALE = 0.65;

/**
 * Procedural props: kinds whose geometry is generated in `exteriorProps.ts`
 * (not a kit GLB), placed as a standalone vertex-coloured mesh rather than
 * merged into a material bucket. `ZoneManager.neededPieces` reads this so it
 * never asks the GLB loader for a `gibbet.glb` (there is none).
 */
export const PROCEDURAL_PROPS: Record<string, () => BufferGeometry> = { gibbet: gibbetGeometry };
/** Merge only these attributes; anything else (tangents…) is dropped. */
const MERGE_ATTRS = ['position', 'normal', 'uv'] as const;

// --- Greater Vael Drop 1: exterior (Task 2) --------------------------------
/** Meters per height-grid level; digits '0'–'3' → max 4.5 m descent. */
const HEIGHT_LEVEL_M = 1.5;
/** Instanced forest kinds — one InstancedMesh (1 draw call) per kind. */
const GRASS_KIND = 'grass-tuft'; // scattered ground tuft on `,` cells
const TRUNK_KIND = 'pine-sparse'; // walkable partial-occlusion trunk on `t`
const TREE_KIND = 'pine-dense'; // blocking treeline/border on `T`/`#`
/** Dark rock skirt filling the risers between height steps (ramps/cliffs). */
const TERRAIN_COLOR = 0x2b2a2c;
/** One ground-texture repeat spans this many world metres (texel density ≈ kit atlas). */
const GROUND_TILE_M = 2;
/** Ground sub-quads per cell axis: 1 m facets give the undulation edges to
 *  catch the moon under flatShading (2 m corners alone read as flat plates). */
const GROUND_SUB = 2;
/** Flat ground colour when the crunched dirt map is absent (tests / fetch not run). */
const GROUND_FLAT_HEX = 0x3a3632;
/** Perf budget: total ground-clutter instances per zone (Task 10). Sparse by
 *  design — a zone that scatters more than this is clamped + warns. */
const SCATTER_CAP = 40;

/** World-space planar UV for a ground point (pure; exported for the test). */
export function planarUV(worldX: number, worldZ: number, tileM = GROUND_TILE_M): [number, number] {
  return [worldX / tileM, worldZ / tileM];
}

// Neighbor scan orders (row/col deltas). Ortho: N, S, W, E.
const ORTHO: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
// Diagonals: NW, NE, SW, SE.
const DIAG: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

// --- grid semantics ----------------------------------------------------------

type CellKind = TileKind | 'door';

/**
 * Rendering meaning of a grid char. Unlike `GridCollider` (which fails closed
 * at runtime), the builder throws on unknown chars: a typo in authored zone
 * data should explode at build time, with coordinates.
 */
function cellKind(ch: string, def: ZoneDef, row: number, col: number): CellKind {
  switch (ch) {
    case '#':
      return 'wall';
    case 'A': // door-void ruin house-block: solid like `H`, rendered as wall-arch (Task 9)
      return 'wall';
    case '.':
    case 'B': // banner anchor
    case 'S': // player spawn
      return 'floor';
    case '~':
      return 'void';
    case 'D':
      return 'door';
  }
  if (ch >= '1' && ch <= '9') return 'door';
  const mapped = def.tiles[ch];
  if (mapped) return mapped;
  throw new Error(`zone "${def.id}": unknown grid char "${ch}" at [${row},${col}]`);
}

/** Kind of the cell at [row, col]; out-of-bounds/short rows read as wall. */
function kindAt(def: ZoneDef, row: number, col: number): CellKind {
  const ch = def.grid[row]?.[col];
  return ch === undefined ? 'wall' : cellKind(ch, def, row, col);
}

/** First orthogonal direction from [row, col] that points at a wall cell. */
function wallDirFrom(def: ZoneDef, row: number, col: number): readonly [number, number] | undefined {
  return ORTHO.find(([dr, dc]) => kindAt(def, row + dr, col + dc) === 'wall');
}

/**
 * Pure grid → kit-piece placements (positions in world meters, cell centers).
 *
 * - floor-kind cells ('.', 'B', 'S', zone letters) → `floor` at cell center;
 * - door anchors ('1'-'9', 'D') → `wall-door` oriented to face the passage
 *   (centered so the player can walk through) + `floor` beneath the opening;
 * - void ('~') → nothing (open pit);
 * - walls ('#', zone letters) auto-orient to face their first open orthogonal
 *   neighbor and are offset flush against the shared cell boundary, so the
 *   visible face sits exactly on the collider edge (and room corners seal).
 *   Walls with only diagonal open neighbors face the diagonal's z component,
 *   centered; fully buried walls emit nothing.
 * - any other char throws (zone id + [row,col] in the message).
 */
export function gridToPlacements(def: ZoneDef): Placement[] {
  const cell = def.cell;
  const half = cell / 2;
  // Offset that puts an oriented wall's face on the cell boundary:
  // half-cell minus half the scaled wall thickness.
  const flush = half - (WALL_THICKNESS_M * KIT_SCALE) / 2;
  const isOpen = (k: CellKind): boolean => k !== 'wall';

  const out: Placement[] = [];
  for (let row = 0; row < def.grid.length; row++) {
    for (let col = 0; col < def.grid[row].length; col++) {
      const kind = cellKind(def.grid[row][col], def, row, col);
      const cx = col * cell + half;
      const cz = row * cell + half;

      if (kind === 'void') continue;
      if (kind === 'floor') {
        out.push({ piece: 'floor', x: cx, z: cz, rotY: 0 });
        continue;
      }
      if (kind === 'door') {
        out.push({ piece: 'floor', x: cx, z: cz, rotY: 0 });
        const d = ORTHO.find(([dr, dc]) => isOpen(kindAt(def, row + dr, col + dc)));
        // rotY = atan2(dx, dz) rotates the piece's +z face toward (dx, dz).
        out.push({ piece: 'wall-door', x: cx, z: cz, rotY: d ? Math.atan2(d[1], d[0]) : 0 });
        continue;
      }

      // kind === 'wall'
      const d = ORTHO.find(([dr, dc]) => isOpen(kindAt(def, row + dr, col + dc)));
      if (d) {
        out.push({
          piece: 'wall',
          x: cx + d[1] * flush,
          z: cz + d[0] * flush,
          rotY: Math.atan2(d[1], d[0]),
        });
        continue;
      }
      const diag = DIAG.find(([dr, dc]) => isOpen(kindAt(def, row + dr, col + dc)));
      if (diag) {
        // Corner piece: face the diagonal's z component (0 or π), centered.
        out.push({ piece: 'wall', x: cx, z: cz, rotY: Math.atan2(0, diag[0]) });
      }
      // No open neighbor at all: fully buried, emit nothing.
    }
  }
  return out;
}

// --- Door prop (world-expansion v1.2, Task 1) ------------------------------

/** Perf budget for the shared door panel (spec §1). Enforced by a unit test. */
export const DOOR_PANEL_MAX_TRIS = 120;

/**
 * The shared door-prop geometry: a stone frame (two jambs + a lintel) holding
 * an iron-studded plank panel, built in the canonical `+z`-facing orientation
 * (so a placement's `rotY` turns the face toward the passage, exactly like the
 * `wall-door` frame). ONE geometry, instanced per decorated door — 96 tris,
 * inside the ≤120 budget. Textured through the PS1 pipeline at spawn.
 * Origin at the sill, so a placement sits it on the floor.
 */
export function doorPanelGeometry(): BufferGeometry {
  const W = 1.7; // opening width (a 2 m cell)
  const H = 2.0; // opening height
  const T = 0.14; // panel thickness
  const box = (w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry =>
    new BoxGeometry(w, h, d).translate(x, y, z);
  const parts: BufferGeometry[] = [
    box(W - 0.3, H - 0.2, T, 0, H / 2, 0), // iron-studded plank panel (12 tris)
    box(0.18, H, 0.22, -(W / 2 - 0.09), H / 2, 0), // left jamb (12)
    box(0.18, H, 0.22, W / 2 - 0.09, H / 2, 0), // right jamb (12)
    box(W, 0.2, 0.22, 0, H - 0.1, 0), // lintel (12)
  ];
  // Four iron studs, proud of the panel face (48 tris) → 96 total.
  for (const yy of [0.55, 1.35]) for (const xx of [-0.35, 0.35]) parts.push(box(0.12, 0.12, 0.1, xx, yy, T / 2 + 0.03));
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('doorPanelGeometry: mergeGeometries returned null');
  merged.computeVertexNormals();
  return merged;
}

/** A placed door panel: the span cell it covers + its world pose. */
export interface DoorPropPlacement {
  row: number;
  col: number;
  x: number;
  z: number;
  rotY: number;
}

/**
 * Where a zone's decorated gates want a door panel. `decoratedGates` holds the
 * gate DIGIT chars that carry a door in THIS zone (resolved from the global
 * door map by `main.ts`, so BOTH sides of a decorated edge render). Every grid
 * cell of a decorated digit gets a panel (a wide gate repeats its digit → one
 * panel per cell), oriented toward the passage exactly like its `wall-door`.
 * Pure — `main.ts` turns each into a shared-geometry mesh + solidifies its cell.
 */
export function doorPropPlacements(def: ZoneDef, decoratedGates: ReadonlySet<string>): DoorPropPlacement[] {
  if (decoratedGates.size === 0) return [];
  const cell = def.cell;
  const half = cell / 2;
  const out: DoorPropPlacement[] = [];
  for (let row = 0; row < def.grid.length; row++) {
    for (let col = 0; col < def.grid[row].length; col++) {
      const ch = def.grid[row][col];
      if (!decoratedGates.has(ch)) continue;
      if (cellKind(ch, def, row, col) !== 'door') continue; // only real gate cells
      const d = ORTHO.find(([dr, dc]) => kindAt(def, row + dr, col + dc) !== 'wall');
      out.push({
        row,
        col,
        x: col * cell + half,
        z: row * cell + half,
        rotY: d ? Math.atan2(d[1], d[0]) : 0,
      });
    }
  }
  return out;
}

/** The height-grid digit at a cell ('0' default: flat / off-grid / no grid). */
function heightDigit(def: ZoneDef, row: number, col: number): string {
  return def.heightGrid?.[row]?.[col] ?? '0';
}

/**
 * Pure: classify every orthogonal seam of an exterior zone's height layer.
 *
 * For each pair of orthogonally-adjacent cells (counted once, via each cell's
 * East + South neighbour) where NEITHER cell is a wall (treeline/ruin blocks
 * have no traversable seam):
 *   - both cells walkable (floor/door) and `|Δlevel| === 1` → `ramp`
 *   - `|Δlevel| >= 2` with at least one walkable cell (typically a walkable
 *     cell dropping into a `~`/lower void) → `cliff`
 * A flat seam (or an absent/all-'0' `heightGrid`) yields nothing. Drives the
 * terrain skirt geometry (visual only — collision stays the flat 2D grid).
 */
export function buildHeightRamps(def: ZoneDef): { a: GridPos; b: GridPos; kind: 'ramp' | 'cliff' }[] {
  const out: { a: GridPos; b: GridPos; kind: 'ramp' | 'cliff' }[] = [];
  const walkable = (k: CellKind): boolean => k === 'floor' || k === 'door';
  const forward: readonly (readonly [number, number])[] = [
    [0, 1],
    [1, 0],
  ];
  for (let row = 0; row < def.grid.length; row++) {
    for (let col = 0; col < def.grid[row].length; col++) {
      const ka = kindAt(def, row, col);
      if (ka === 'wall') continue; // no seam originates at a treeline/ruin cell
      for (const [dr, dc] of forward) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= def.grid.length || nc >= (def.grid[nr]?.length ?? 0)) continue; // off-grid
        const kb = kindAt(def, nr, nc);
        if (kb === 'wall') continue; // neighbour is a treeline/ruin block
        if (!walkable(ka) && !walkable(kb)) continue; // void↔void: nothing to stand on
        const d = Math.abs(Number(heightDigit(def, row, col)) - Number(heightDigit(def, nr, nc)));
        if (walkable(ka) && walkable(kb) && d === 1) out.push({ a: [row, col], b: [nr, nc], kind: 'ramp' });
        // A walkable↔void lip needs a cliff face at ANY drop ≥1 (H4): a band-1
        // trail beside a `~` gorge is Δ1 with one non-walkable side — pre-H4 it
        // matched neither branch (ramp wants both walkable; cliff wanted Δ≥2), so
        // the single-sided trail quad showed sky/void under its lip. Band-2/3 lips
        // (Δ≥2) already got a face; this gives band-1 (and any Δ1 path↔void) one too.
        else if (d >= 2 || (d >= 1 && walkable(ka) !== walkable(kb))) out.push({ a: [row, col], b: [nr, nc], kind: 'cliff' });
      }
    }
  }
  return out;
}

// --- builder ------------------------------------------------------------------

const UP = new Vector3(0, 1, 0);

/** Force the crunchy PS1 sampler settings on a material's diffuse map. */
function forceNearest(material: Material): void {
  const map = (material as MeshStandardMaterial).map;
  if (!map) return;
  map.magFilter = NearestFilter;
  map.minFilter = NearestFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
}

/**
 * Prepare geometries for `mergeGeometries`: de-index everything (mixed
 * indexed/non-indexed can't merge) and keep only the attributes every member
 * of the group shares (of position/normal/uv — tangents etc. are dropped).
 */
function normalizeForMerge(geoms: BufferGeometry[]): BufferGeometry[] {
  const keep = MERGE_ATTRS.filter((name) => geoms.every((g) => g.getAttribute(name) !== undefined));
  return geoms.map((src) => {
    const g = src.index ? src.toNonIndexed() : src;
    for (const name of Object.keys(g.attributes)) {
      if (!(keep as readonly string[]).includes(name)) g.deleteAttribute(name);
    }
    g.morphAttributes = {};
    return g;
  });
}

// --- exterior forest + terrain skirt (Task 2) -------------------------------

/** A forest instance's grounded transform inputs. */
interface ForestSpot {
  x: number;
  y: number;
  z: number;
  row: number;
  col: number;
}

/** Deterministic per-cell pseudo-random in [0,1) — no per-build RNG churn. */
function cellNoise(row: number, col: number, salt: number): number {
  const n = Math.sin((row * 127.1 + col * 311.7 + salt * 74.7) * 0.5453) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Stamp one forest kind into a single `InstancedMesh` (1 draw call), grounded
 * at each cell's terrain height with a deterministic yaw + slight scale jitter
 * so the treeline never looks tiled. Empty lists build nothing (and free the
 * geometry). The material is flat-shaded, PS1-patched, and samples ONE shared
 * crunchy bark map (Task 7) MULTIPLIED by the baked BARK/NEEDLE/BLADE vertex
 * tints — one map per instanced kind, so trunk+cones stay a single draw call
 * and per-instance vertex-colour variation survives (map × vertexColor). When
 * the crunched bark map is absent (tests / no fetch) `map` is undefined and
 * the material reads as the flat vertex-coloured look — never throws.
 */
function stampForest(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  spots: ForestSpot[],
  opts: { tilt?: boolean; windMats?: MeshStandardMaterial[] } = {},
): void {
  if (spots.length === 0) {
    geometry.dispose();
    return;
  }
  // Shipped kinds keep their ratified bark×tint look (T7/T9); only the NEW
  // clutter kinds stay vertex-colour-only (a bark-wrapped stone reads wrong).
  const map = name.startsWith('clutter-') ? undefined : getTexture('bark'); // one bark map shared by trunk + canopy (kept 1 draw/kind)
  const material = new MeshStandardMaterial({
    vertexColors: true, // per-instance BARK/NEEDLE/BLADE tint stays ON — it multiplies the map
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  if (map) material.map = map; // set BEFORE patchMaterial/first compile so the affine warp binds (absent → flat fallback)
  forceNearest(material); // crunchy PS1 sampler when a map is present; no-op when absent
  patchMaterial(material, opts.windMats ? { wind: WIND } : {}); // SMOOTH sway on wind kinds only; affine still binds (map set)
  const mesh = new InstancedMesh(geometry, material, spots.length);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  if (opts.windMats) {
    // Per-instance wind phase so neighbouring trees desync (the sway shader
    // reads `aWindPhase`); collect the material so the zone clock can advance
    // its `uWindTime` each frame (SMOOTH — never stepped, spec §6).
    const phase = new Float32Array(spots.length);
    spots.forEach((s, i) => { phase[i] = cellNoise(s.row, s.col, 3) * Math.PI * 2; });
    geometry.setAttribute('aWindPhase', new InstancedBufferAttribute(phase, 1));
    opts.windMats.push(material);
  }
  const m = new Matrix4();
  const q = new Quaternion();
  const euler = new Euler();
  const s = new Vector3();
  const p = new Vector3();
  spots.forEach((spot, i) => {
    const yaw = cellNoise(spot.row, spot.col, 1) * Math.PI * 2;
    const scale = 0.85 + cellNoise(spot.row, spot.col, 2) * 0.35; // 0.85–1.2
    if (opts.tilt) {
      // Seeded per-instance lean + squash (C3): the instance matrix carries the
      // per-tree crookedness the shared geometry can't — 1 draw/kind held.
      const tx = (cellNoise(spot.row, spot.col, 4) - 0.5) * 0.16; // ±0.08 rad
      const tz = (cellNoise(spot.row, spot.col, 6) - 0.5) * 0.16;
      const squash = 0.88 + cellNoise(spot.row, spot.col, 5) * 0.28; // 0.88–1.16 y
      m.compose(p.set(spot.x, spot.y, spot.z), q.setFromEuler(euler.set(tx, yaw, tz)), s.set(scale, scale * squash, scale));
    } else {
      m.compose(p.set(spot.x, spot.y, spot.z), q.setFromAxisAngle(UP, yaw), s.set(scale, scale, scale));
    }
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  // Bounds from the instance spread (not the single origin tree), so frustum
  // culling keeps the forest when the zone-origin cell is off-screen.
  mesh.computeBoundingSphere();
  group.add(mesh);
}

/**
 * One merged textured ground mesh over the exterior floor cells, world-planar
 * UV'd (seamless tiling), each cell quad at its terrain height. Replaces the kit
 * floor tiles for exteriors so the ground carries the dirt map, NOT the wall
 * atlas — a standalone Mesh, so the kit merge-bucket count does not grow. Falls
 * back to a flat colour when the crunched dirt map is absent (tests / no fetch).
 * Returns null when the zone has no floor cells.
 */
function buildExteriorGround(cell: number, spots: ForestSpot[]): Mesh | null {
  if (spots.length === 0) return null;
  const pos: number[] = [];
  const uv: number[] = [];
  const subM = cell / GROUND_SUB;
  for (const { x, y, z } of spots) {
    const x0 = x - cell / 2;
    const z0 = z - cell / 2;
    for (let sx = 0; sx < GROUND_SUB; sx++) {
      for (let sz = 0; sz < GROUND_SUB; sz++) {
        const ax = x0 + sx * subM;
        const az = z0 + sz * subM;
        const bx = ax + subM;
        const bz = az + subM;
        // Two tris wound so the FRONT face (three.js CCW) is +y — the ground
        // must render from the player's above-ground viewpoint and catch the
        // moonlight. (+y winding preserved through the subdivision → the Task 6
        // orientation guard keeps passing.) Per-VERTEX undulation: shared corners
        // sample the same world position → the same offset → the sheet stays
        // watertight across sub-quads AND cells.
        const corners: [number, number][] = [
          [ax, az], [ax, bz], [bx, bz],
          [ax, az], [bx, bz], [bx, az],
        ];
        for (const [cx, cz] of corners) {
          pos.push(cx, y + undulation(cx, cz), cz);
          const [u, v] = planarUV(cx, cz);
          uv.push(u, v);
        }
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new Float32BufferAttribute(new Float32Array(uv), 2));
  // flatShading derives face normals in-shader, so this attribute is not needed
  // to render — kept because the orientation unit test reads it to prove the
  // winding faces +y (the bug it guards against was a down-wound, culled ground).
  geo.computeVertexNormals();
  const map = getTexture('ground-dirt');
  const material = new MeshStandardMaterial({
    color: map ? 0xffffff : GROUND_FLAT_HEX, // white so the crunched map shows at its own brightness
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  if (map) material.map = map; // set BEFORE patchMaterial/first compile so the affine warp binds
  forceNearest(material);
  patchMaterial(material);
  const mesh = new Mesh(geo, material);
  mesh.name = 'exterior-ground';
  return mesh;
}

/**
 * A single dark-rock mesh filling the vertical risers between height steps
 * (every ramp/cliff seam), so stepped terrain never shows a gap under a floor
 * tile. World-planar UV'd so the crunched rock map tiles across the risers
 * (vertical faces map by x/z footprint — acceptable at PS1 crunch). Returns
 * null when the zone is flat.
 */
function buildTerrainSkirt(def: ZoneDef, cellHeightM: (r: number, c: number) => number): Mesh | null {
  const seams = buildHeightRamps(def);
  if (seams.length === 0) return null;
  const cell = def.cell;
  const v: number[] = [];
  for (const { a, b } of seams) {
    const [ra, ca] = a;
    const [rb, cb] = b;
    const ylo = Math.min(cellHeightM(ra, ca), cellHeightM(rb, cb));
    const yhi = Math.max(cellHeightM(ra, ca), cellHeightM(rb, cb));
    // Both edges sample the SAME undulation as the ground at the shared world
    // positions (ends + midpoint) — the riser meets the displaced ground
    // watertight on both its lips (ground verts sit at 1 m spacing too). A
    // midpoint splits each seam into two sub-quads, killing the razor-straight step.
    const pushQuad = (x0: number, z0: number, x1: number, z1: number): void => {
      const lo0 = ylo + undulation(x0, z0);
      const lo1 = ylo + undulation(x1, z1);
      const hi0 = yhi + undulation(x0, z0);
      const hi1 = yhi + undulation(x1, z1);
      v.push(x0, lo0, z0, x1, lo1, z1, x1, hi1, z1, x0, lo0, z0, x1, hi1, z1, x0, hi0, z0);
    };
    if (cb !== ca) {
      // East/West seam: a vertical plane at the shared x, spanning the row's z.
      const bx = Math.max(ca, cb) * cell;
      const z0 = ra * cell;
      const zm = z0 + cell / 2;
      pushQuad(bx, z0, bx, zm);
      pushQuad(bx, zm, bx, z0 + cell);
    } else {
      // North/South seam: a vertical plane at the shared z, spanning the col's x.
      const bz = Math.max(ra, rb) * cell;
      const x0 = ca * cell;
      const xm = x0 + cell / 2;
      pushQuad(x0, bz, xm, bz);
      pushQuad(xm, bz, x0 + cell, bz);
    }
  }
  // World-planar UV per vertex (from its x/z footprint), so the rock map tiles
  // seamlessly across the risers — same tiling as the ground for matched density.
  const uvArr: number[] = [];
  for (let i = 0; i < v.length; i += 3) {
    const [u, w] = planarUV(v[i], v[i + 2]);
    uvArr.push(u, w);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(v), 3));
  geo.setAttribute('uv', new Float32BufferAttribute(new Float32Array(uvArr), 2));
  geo.computeVertexNormals();
  const map = getTexture('rock');
  const material = new MeshStandardMaterial({
    color: map ? 0xffffff : TERRAIN_COLOR,
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
    flatShading: true,
  });
  if (map) material.map = map; // set BEFORE patchMaterial/first compile so the affine warp binds
  forceNearest(material);
  patchMaterial(material);
  const mesh = new Mesh(geo, material);
  mesh.name = 'exterior-terrain';
  return mesh;
}

export class ZoneBuilder {
  /**
   * Build the zone. Kit templates in `assets` are treated read-only: geometry
   * is cloned with all transforms baked in, materials are cloned per zone
   * (textures stay shared with the template cache).
   *
   * `anomalies` is the Second-Vigil post-build hook (T16): after the zone is
   * fully assembled, each anomaly mutates the built scene in place. It is empty
   * on a base run, so a non-NG+ build is byte-for-byte the pre-T16 zone.
   */
  build(def: ZoneDef, assets: AssetCache, anomalies: readonly Anomaly[] = []): BuiltZone {
    const cell = def.cell;
    const half = cell / 2;
    const group = new Group();
    group.name = `zone:${def.id}`;

    // Visual floor height (m) of a cell — the exterior height layer. Always 0
    // for interior zones (no heightGrid), so props/torches/camera lerp uniformly
    // and a v1 interior builds byte-for-byte identical.
    const cellHeightM = (row: number, col: number): number =>
      Number(heightDigit(def, row, col)) * HEIGHT_LEVEL_M;
    /** Surface height at a world point: cell base + the C2 undulation
     *  (exteriors; interiors stay flat). THE one function placements and
     *  view-y consumers use — exposed on BuiltZone as groundYAt. */
    const groundYAt = (worldX: number, worldZ: number): number => {
      const base = cellHeightM(Math.floor(worldZ / cell), Math.floor(worldX / cell));
      return def.kind === 'exterior' ? base + undulation(worldX, worldZ) : base;
    };
    /** Kit architecture settles slightly INTO the dirt — a block may sink a
     *  few cm on a swell but can never float on one (ruins sit, they don't hover). */
    const KIT_SETTLE_M = 0.05;
    /** Ruin/house walls (and their roof caps) seat to the cell's FLAT base height
     *  minus this — NOT the per-cell-centre undulated ground. So adjacent slabs in
     *  a run share one base/top (no stepped bases, H2) and the base always embeds
     *  under the ±UNDULATION_AMP_M swell (never floats). Deeper than KIT_SETTLE_M. */
    const WALL_SETTLE_M = UNDULATION_AMP_M + 0.03;
    /** Set by the exterior branch to drift the ash-fall each frame. */
    let updateExterior: ((dtMs: number) => void) | undefined;
    /** Set by the exterior branch: unit direction toward the moon (key light). */
    let moonDir: Vector3 | undefined;
    /** Forest instanced materials carrying the smooth wind sway (Task 10); the
     *  exterior branch advances their `uWindTime` each frame. */
    const windMats: MeshStandardMaterial[] = [];
    /** The standalone exterior banner mesh (Task 10), so `main` can sway it. */
    let bannerMeshRef: Mesh | undefined;

    // Geometry buckets keyed by material *name*: every KayKit piece embeds
    // its own copy of the same atlas material (name "texture"), so keying by
    // instance would defeat merging entirely. First-seen instance wins.
    const buckets = new Map<string, { material: Material; geoms: BufferGeometry[] }>();

    const addPiece = (piece: string, x: number, y: number, z: number, rotY: number, scale: number): void => {
      const template = assets.get(piece);
      const place = new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion().setFromAxisAngle(UP, rotY),
        new Vector3(scale, scale, scale),
      );
      template.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        if (Array.isArray(mesh.material)) {
          throw new Error(
            `zone "${def.id}": kit piece "${piece}" mesh "${mesh.name}" is multi-material — unsupported by the merge path`,
          );
        }
        const material = mesh.material;
        const key = material.name || material.uuid;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { material, geoms: [] };
          buckets.set(key, bucket);
        }
        const geom = mesh.geometry.clone();
        geom.applyMatrix4(new Matrix4().multiplyMatrices(place, mesh.matrixWorld));
        bucket.geoms.push(geom);
      });
    };

    /** A standalone (un-merged) banner mesh so it can sway (exterior only). Bakes
     *  only the LOCAL rotation/scale into the cloned geometry and carries the
     *  world anchor on `mesh.position`, so `main`'s `rotation.z` sway pivots
     *  about the banner's own pole — NOT the world origin (which would heave
     *  the whole banner metres sideways). Material is a patched clone; the
     *  atlas texture stays shared with the template cache. */
    const buildStandaloneBanner = (x: number, y: number, z: number, rotY: number, scale: number): Mesh | undefined => {
      const template = assets.get('banner');
      // Zero translation: the geometry stays anchored at its own base.
      const local = new Matrix4().compose(
        new Vector3(0, 0, 0), new Quaternion().setFromAxisAngle(UP, rotY), new Vector3(scale, scale, scale),
      );
      const geoms: BufferGeometry[] = [];
      let srcMat: Material | undefined;
      template.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        srcMat = mesh.material;
        const g = mesh.geometry.clone();
        g.applyMatrix4(new Matrix4().multiplyMatrices(local, mesh.matrixWorld));
        geoms.push(g);
      });
      if (geoms.length === 0 || !srcMat) return undefined;
      const geometry = mergeGeometries(normalizeForMerge(geoms), false);
      for (const g of geoms) g.dispose();
      if (!geometry) return undefined;
      const material = srcMat.clone();
      forceNearest(material);
      patchMaterial(material);
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z); // world anchor — the sway's pivot
      mesh.name = 'banner-standalone';
      return mesh;
    };

    // A castle wall.glb block, oriented to face its first open neighbour and
    // flush-offset onto the shared boundary (the `H` ruin block, or an unknown
    // solid exterior letter). At the cell's terrain height.
    const flush = half - (WALL_THICKNESS_M * KIT_SCALE) / 2;
    /** The flush offset (dx,dz) a ruin/house wall cell is shoved by. An ISOLATED
     *  wall shoves onto its open boundary (its face lands on the collider edge); a
     *  wall that ABUTS another wall stays CENTRED so neighbouring slabs weld with
     *  no see-through sliver (H2). Shared by the wall AND its roof-wedge cap so the
     *  roof sits on the wall rather than floating centred over open ground (H3). */
    const houseOffset = (row: number, col: number): [number, number] => {
      const inRun = ORTHO.some(([dr, dc]) => kindAt(def, row + dr, col + dc) === 'wall');
      if (inRun) return [0, 0];
      const open = ORTHO.find(([dr, dc]) => kindAt(def, row + dr, col + dc) !== 'wall');
      return open ? [open[1] * flush, open[0] * flush] : [0, 0];
    };
    const addExteriorWall = (row: number, col: number, x: number, y: number, z: number, piece = 'wall'): void => {
      // Face the first open neighbour (the run direction) but offset only when
      // ISOLATED — a run member stays centred so its slab abuts the next (H2).
      const open = ORTHO.find(([dr, dc]) => kindAt(def, row + dr, col + dc) !== 'wall');
      const [ox, oz] = houseOffset(row, col);
      addPiece(piece, x + ox, y, z + oz, open ? Math.atan2(open[1], open[0]) : 0, KIT_SCALE);
    };

    // Architecture from the grid. Interiors place kit modules (4m module at
    // 0.5 scale for the 2m cell). Exteriors map the grid to bare terrain tiles
    // + a stamped instanced forest (Task 2): `,`→grass, `t`→sparse trunk,
    // `T`/`#`→dense tree (NOT castle wall.glb), `H`→ruin block, `~`→open gorge.
    const grass: ForestSpot[] = [];
    const sparse: ForestSpot[] = [];
    const dense: ForestSpot[] = [];
    const ground: ForestSpot[] = [];
    // House cells (`H` ruin block + `A` door-void arch) get an auto roof-wedge
    // cap (1 InstancedMesh, Cinder Village only) — collected here, stamped after
    // the ground mesh below (Task 9).
    const houseCells: GridPos[] = [];
    if (def.kind === 'exterior') {
      for (let row = 0; row < def.grid.length; row++) {
        const line = def.grid[row];
        for (let col = 0; col < line.length; col++) {
          const ch = line[col];
          const x = col * cell + half;
          const z = row * cell + half;
          const y = cellHeightM(row, col);
          // Exteriors collect floor cells into ONE world-planar textured ground
          // mesh (buildExteriorGround) instead of emitting kit floor.glb tiles,
          // so the ground carries the dirt map, not the wall atlas.
          const floorTile = (): void => {
            ground.push({ x, y, z, row, col });
          };
          const spot = (): ForestSpot => ({ x, y: groundYAt(x, z), z, row, col });
          if (ch === '~') continue; // the gorge — open air, no tile
          else if (ch === ',') {
            floorTile();
            grass.push(spot());
          } else if (ch === 'p') {
            floorTile(); // worn path: bare tile, no instance
          } else if (ch === 't') {
            floorTile();
            sparse.push(spot());
          } else if (ch === 'T' || ch === '#') {
            floorTile(); // H1: ground under the treeline/border too — the dome
            dense.push(spot()); // renders depthWrite:false, so a floorless dense
            // cell paints sky straight through the ground (the oath-oak/checkpoint
            // hole, every border treeline, the whole forest stand). Only `~` stays floorless.
          } else if (ch === 'H') {
            floorTile();
            // Seat on the cell's FLAT base (not the undulated cell-centre), so a
            // run of houses shares one welded base/top (H2). Deep settle embeds it.
            addExteriorWall(row, col, x, cellHeightM(row, col) - WALL_SETTLE_M, z); // a built ruin (Cinder Village house)
            houseCells.push([row, col]); // gets a charred roof-wedge cap
          } else if (ch === 'A') {
            // Door-void ruin house-block: a `wall-arch.glb` (SAME atlas → SAME
            // merge bucket as `wall`) in place of the solid wall, so the house
            // reads as a burnt home with a gaping doorway rather than castle wall.
            floorTile();
            addExteriorWall(row, col, x, cellHeightM(row, col) - WALL_SETTLE_M, z, 'wall-arch'); // flat-seated like `H` (H2)
            houseCells.push([row, col]); // capped by the same roof-wedge stamp
          } else {
            const kind = cellKind(ch, def, row, col);
            if (kind === 'void') continue;
            floorTile();
            if (kind === 'door') {
              const d = ORTHO.find(([dr, dc]) => kindAt(def, row + dr, col + dc) !== 'wall');
              addPiece('wall-door', x, groundYAt(x, z) - KIT_SETTLE_M, z, d ? Math.atan2(d[1], d[0]) : 0, KIT_SCALE);
            } else if (kind === 'wall') {
              addExteriorWall(row, col, x, groundYAt(x, z) - KIT_SETTLE_M, z); // unknown solid letter → ruin block
            }
          }
        }
      }
    } else {
      for (const p of gridToPlacements(def)) addPiece(p.piece, p.x, 0, p.z, p.rotY, KIT_SCALE);
    }

    // Props are life-sized (KIT.md): scale 1 at their cell center, on the terrain.
    // Procedural props (gibbet) are original vertex-coloured geometry placed as a
    // standalone mesh (NOT a kit GLB and NOT merged into a bucket — 1 draw each).
    for (const prop of def.props) {
      const [row, col] = prop.at;
      const px = col * cell + half, pz = row * cell + half, py = groundYAt(px, pz);
      // Own-key guard: a bare index reaches Object.prototype, so a kit prop
      // named e.g. 'toString' would false-positive as procedural.
      const make = Object.hasOwn(PROCEDURAL_PROPS, prop.kind) ? PROCEDURAL_PROPS[prop.kind] : undefined;
      if (make) {
        const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
        patchMaterial(material);
        const mesh = new Mesh(make(), material);
        mesh.position.set(px, py, pz);
        mesh.rotation.y = prop.rotY ?? 0;
        mesh.name = `prop:${prop.kind}`;
        group.add(mesh);
        continue;
      }
      addPiece(prop.kind, px, py, pz, prop.rotY ?? 0, 1);
    }

    // Torches: bracket mesh mounted on an adjacent wall face (model's +z arm
    // pointing into the room) + a flickering PointLight, capped at 4.
    const lights: PointLight[] = [];
    for (const torch of def.lights) {
      const [row, col] = torch.at;
      const cx = col * cell + half;
      const cz = row * cell + half;
      const [dr, dc] = wallDirFrom(def, row, col) ?? [-1, 0];
      const ty = groundYAt(cx, cz);
      addPiece('torch', cx + dc * half, TORCH_MOUNT_Y + ty, cz + dr * half, Math.atan2(-dc, -dr), 1);
      if (lights.length >= MAX_POINT_LIGHTS) {
        console.warn(`zone "${def.id}": more than ${MAX_POINT_LIGHTS} torches — extra lights skipped`);
        continue;
      }
      const light = new PointLight(
        torch.color ?? TORCH_LIGHT_COLOR,
        torch.intensity ?? TORCH_LIGHT_INTENSITY,
        TORCH_LIGHT_DISTANCE,
      );
      // Roughly at the flame: pulled off the wall toward the room, above the bracket.
      light.position.set(cx + dc * (half - 0.45), TORCH_MOUNT_Y + 0.55 + ty, cz + dr * (half - 0.45));
      light.castShadow = false; // shadow maps are never enabled in OATHBRAND
      group.add(light);
      lights.push(light);
    }

    // Banner checkpoint: hung flush on an adjacent wall face, at kit scale so
    // the 3.2m source banner fits the 2m walls.
    let banner: PlacedBanner | undefined;
    if (def.banner) {
      const [row, col] = def.banner.at;
      const cx = col * cell + half;
      const cz = row * cell + half;
      const [dr, dc] = wallDirFrom(def, row, col) ?? [-1, 0];
      // Exterior checkpoint banners render larger (readability across the open
      // field/gorge); interior banners stay at kit scale to fit the 2 m walls.
      const bScale = def.kind === 'exterior' ? BANNER_EXT_SCALE : KIT_SCALE;
      const setback = half - BANNER_BACK_M * bScale;
      // Exteriors build the banner as a STANDALONE mesh so `main` can sway it
      // smoothly (Task 10); interiors keep the merged banner (no sway indoors).
      if (def.kind === 'exterior') {
        bannerMeshRef = buildStandaloneBanner(cx + dc * setback, groundYAt(cx + dc * setback, cz + dr * setback), cz + dr * setback, Math.atan2(dc, dr), bScale);
        if (bannerMeshRef) group.add(bannerMeshRef);
      } else {
        addPiece('banner', cx + dc * setback, groundYAt(cx + dc * setback, cz + dr * setback), cz + dr * setback, Math.atan2(dc, dr), bScale);
      }
      banner = { name: def.banner.name, position: new Vector3(cx, 0, cz) };
    }

    // Merge each material bucket into a single static mesh.
    for (const [key, bucket] of buckets) {
      const geoms = normalizeForMerge(bucket.geoms);
      const geometry = mergeGeometries(geoms, false);
      if (!geometry) {
        throw new Error(`zone "${def.id}": mergeGeometries failed for material "${key}"`);
      }
      for (const g of geoms) g.dispose();
      for (const g of bucket.geoms) g.dispose();
      const material = bucket.material.clone();
      forceNearest(material);
      patchMaterial(material);
      const mesh = new Mesh(geometry, material);
      mesh.name = `merged:${key}`;
      group.add(mesh);
    }
    if (buckets.size > MAX_MERGED_MESHES) {
      console.warn(
        `zone "${def.id}": ${buckets.size} merged meshes exceeds the budget of ${MAX_MERGED_MESHES}`,
      );
    }

    // --- exterior forest + terrain skirt + sky (Task 2) -------------------
    // Each forest kind becomes ONE InstancedMesh (1 draw call); the skirt is a
    // single dark-rock mesh; the backdrop is a dome + moon + ash Points.
    if (def.kind === 'exterior') {
      // Trees + grass sway smoothly (windMats shared so one clock drives them
      // all); buildings/clutter (roof-wedge below, scatter) never lean or sway.
      stampForest(group, GRASS_KIND, grassGeometry(), grass, { tilt: true, windMats });
      stampForest(group, TRUNK_KIND, trunkGeometry(), sparse, { tilt: true, windMats });
      stampForest(group, TREE_KIND, pineGeometry(), dense, { tilt: true, windMats });

      const groundMesh = buildExteriorGround(cell, ground);
      if (groundMesh) group.add(groundMesh);

      // Charred roof-wedge cap over every house cell (H ruin + A door-void) — one
      // InstancedMesh (1 draw call), Cinder Village only (no H/A ⇒ nothing stamped).
      if (houseCells.length > 0) {
        // Seat each roof on its wall: the SAME flush offset (H3 — no floating
        // off-centre eave) and the SAME flat base height as the welded wall (H2).
        const spots: ForestSpot[] = houseCells.map(([r, c]) => {
          const [ox, oz] = houseOffset(r, c);
          return { x: c * cell + half + ox, y: cellHeightM(r, c) - WALL_SETTLE_M, z: r * cell + half + oz, row: r, col: c };
        });
        stampForest(group, 'roof-wedge', roofWedgeGeometry(), spots);
      }

      // Ground clutter (Task 10): one InstancedMesh per kind, grounded on C2's
      // undulated dirt. Sparse by authoring — clamped to SCATTER_CAP total so a
      // zone can never balloon the static tri count. No opts → never sways/leans.
      const CLUTTER: Record<string, () => BufferGeometry> = {
        stone: stoneGeometry, bones: bonePileGeometry, stump: stumpGeometry,
      };
      let scattered = 0;
      for (const s of def.scatter ?? []) {
        const room = SCATTER_CAP - scattered;
        if (room <= 0) {
          console.warn(`zone "${def.id}": ground clutter exceeds the cap of ${SCATTER_CAP} — extra "${s.kind}" skipped`);
          break;
        }
        const cells = s.cells.length > room ? s.cells.slice(0, room) : s.cells;
        if (cells.length < s.cells.length) {
          console.warn(`zone "${def.id}": ground clutter exceeds the cap of ${SCATTER_CAP} — clamped "${s.kind}"`);
        }
        const geo = CLUTTER[s.kind]();
        const spots: ForestSpot[] = cells.map(([r, c]) => ({
          x: c * cell + half, y: groundYAt(c * cell + half, r * cell + half), z: r * cell + half, row: r, col: c,
        }));
        stampForest(group, `clutter-${s.kind}`, geo, spots); // no opts — clutter never sways or leans
        scattered += cells.length;
      }

      const skirt = buildTerrainSkirt(def, cellHeightM);
      if (skirt) group.add(skirt);

      const rows = def.grid.length;
      const cols = def.grid.reduce((m, r) => Math.max(m, r.length), 0);
      const backdrop = buildExteriorSky(def.exteriorSky ?? 'field', {
        center: { x: cols * half, z: rows * half },
        spanM: Math.max(cols, rows) * cell + 12,
      });
      group.add(backdrop.dome, backdrop.moon, backdrop.ash);
      if (backdrop.embers) group.add(backdrop.embers); // gorge only (spec §6)
      // Advance the smooth wind clock alongside the ash-fall each frame. The
      // world micro-motion runs at full frame rate — never stepped (spec §6).
      let windClockMs = 0;
      const backdropUpdate = backdrop.update;
      updateExterior = (dtMs: number): void => {
        backdropUpdate(dtMs);
        windClockMs += dtMs;
        for (const m of windMats) {
          const u = (m.userData.ps1Shader as { uniforms?: Record<string, { value: number }> } | undefined)?.uniforms?.uWindTime;
          if (u) u.value = windClockMs / 1000;
        }
      };
      moonDir = backdrop.moonDir;
    }

    const toWorld = ([row, col]: readonly [number, number]): Vector3 =>
      new Vector3(col * cell + half, 0, row * cell + half);

    const built: BuiltZone = {
      group,
      collider: new GridCollider(def),
      cellM: cell,
      spawns: def.enemies,
      doors: def.doors.map((d) => ({ def: d, position: toWorld(d.at) })),
      banner,
      bannerMesh: bannerMeshRef,
      lore: def.lore.map((spot) => ({ spot, position: toWorld(spot.at) })),
      items: (def.items ?? []).map((spot) => ({ spot, position: toWorld(spot.at) })),
      lights,
      cellHeightM,
      groundYAt,
      updateExterior,
      moonDir,
    };

    // Second-Vigil anomalies (T16): they alter `built` in place — add spectral
    // meshes/lights to `group`, retint a torch, remove a lore spot. Applied last
    // so they see the finished zone; empty (and thus a no-op) on a base run.
    for (const anomaly of anomalies) anomaly.apply(built);

    return built;
  }
}
