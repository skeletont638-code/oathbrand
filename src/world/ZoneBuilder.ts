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
import { Group, Matrix4, Mesh, NearestFilter, PointLight, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, Material, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patchMaterial } from '../ps1/patchMaterial';
import { GridCollider } from './collision';
import type { AssetCache } from './assets';
import type { DoorDef, EnemySpawn, ItemSpot, LoreSpot, TileKind, ZoneDef } from './zoneDef';

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
  lore: PlacedLore[];
  /** Takeable world-item pickups resolved to world space. */
  items: PlacedItem[];
  /** Torch PointLights (children of `group`), exposed for flicker updates. */
  lights: PointLight[];
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
/** Merge only these attributes; anything else (tangents…) is dropped. */
const MERGE_ATTRS = ['position', 'normal', 'uv'] as const;

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

export class ZoneBuilder {
  /**
   * Build the zone. Kit templates in `assets` are treated read-only: geometry
   * is cloned with all transforms baked in, materials are cloned per zone
   * (textures stay shared with the template cache).
   */
  build(def: ZoneDef, assets: AssetCache): BuiltZone {
    const cell = def.cell;
    const half = cell / 2;
    const group = new Group();
    group.name = `zone:${def.id}`;

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

    // Architecture from the grid (4m module at 0.5 scale for the 2m cell).
    for (const p of gridToPlacements(def)) addPiece(p.piece, p.x, 0, p.z, p.rotY, KIT_SCALE);

    // Props are life-sized (KIT.md): scale 1 at their cell center.
    for (const prop of def.props) {
      const [row, col] = prop.at;
      addPiece(prop.kind, col * cell + half, 0, row * cell + half, prop.rotY ?? 0, 1);
    }

    // Torches: bracket mesh mounted on an adjacent wall face (model's +z arm
    // pointing into the room) + a flickering PointLight, capped at 4.
    const lights: PointLight[] = [];
    for (const torch of def.lights) {
      const [row, col] = torch.at;
      const cx = col * cell + half;
      const cz = row * cell + half;
      const [dr, dc] = wallDirFrom(def, row, col) ?? [-1, 0];
      addPiece('torch', cx + dc * half, TORCH_MOUNT_Y, cz + dr * half, Math.atan2(-dc, -dr), 1);
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
      light.position.set(cx + dc * (half - 0.45), TORCH_MOUNT_Y + 0.55, cz + dr * (half - 0.45));
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
      const setback = half - BANNER_BACK_M * KIT_SCALE;
      addPiece('banner', cx + dc * setback, 0, cz + dr * setback, Math.atan2(dc, dr), KIT_SCALE);
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

    const toWorld = ([row, col]: readonly [number, number]): Vector3 =>
      new Vector3(col * cell + half, 0, row * cell + half);

    return {
      group,
      collider: new GridCollider(def),
      cellM: cell,
      spawns: def.enemies,
      doors: def.doors.map((d) => ({ def: d, position: toWorld(d.at) })),
      banner,
      lore: def.lore.map((spot) => ({ spot, position: toWorld(spot.at) })),
      items: (def.items ?? []).map((spot) => ({ spot, position: toWorld(spot.at) })),
      lights,
    };
  }
}
