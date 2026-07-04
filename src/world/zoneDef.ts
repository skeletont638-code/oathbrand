/**
 * Zone authoring format. Every zone in OATHBRAND is an ASCII grid plus
 * satellite data (props, lights, spawns, doors, lore). Pure types — no
 * three.js, no runtime code.
 *
 * Grid characters (row 0 = z 0..cell, col 0 = x 0..cell):
 *   `#`      wall (solid, blocks movement + sight)
 *   `.`      floor (walkable)
 *   `~`      void (walkable for collision; falling in = ember loss + reset)
 *   `1`-`9`  door anchor (walkable); `D` is also accepted as a door anchor
 *   `B`      banner (checkpoint) anchor — walkable
 *   `S`      player spawn — walkable
 *   others   zone-specific letters (`K`, `W`, `V`, …) resolved via
 *            `ZoneDef.tiles`; an unmapped unknown char is treated as wall
 *            (fail closed — typos block instead of leaking players out).
 */
import type { ZoneId, EnemyKind, GameFlag } from '../content/types';

/** What a zone-specific grid letter means for collision/traversal. */
export type TileKind = 'wall' | 'floor' | 'void';

/** Grid coordinate as [row, col] into `ZoneDef.grid`. */
export type GridPos = [number, number];

/** A Watcher sighting position: `[row, col]` (on the ground, y=0) or
 *  `[row, col, elevM]` for an OFF-GRID backdrop that stands elevated on a far
 *  cliff-top rather than the gorge floor. `elevM` is the anchor's ground
 *  elevation in metres (the Watcher's feet); absent ⇒ 0. An off-grid anchor has
 *  no `heightGrid` cell to read a height from, so PD-1's "across the chasm"
 *  Watcher carries its own elevation to break the vista-ledge horizon. Existing
 *  2-tuple anchors are unchanged (elevation 0). The `[row, col]` prefix still
 *  drives every distance/cycle check (they read indices 0 and 1). */
export type WatcherAnchor = [number, number] | [number, number, number];

/** A static decoration/mesh placed on the grid. */
export interface Prop {
  kind: string;
  at: GridPos;
  /** Yaw in radians, applied by the renderer. Defaults to 0. */
  rotY?: number;
}

/** A torch/flame point light. */
export interface Torch {
  at: GridPos;
  /** 0xRRGGBB; renderer default if omitted. */
  color?: number;
  intensity?: number;
}

/** An enemy placement. */
export interface EnemySpawn {
  kind: EnemyKind;
  at: GridPos;
  /** Optional patrol waypoints (grid coords). */
  patrol?: GridPos[];
}

/** The zone's banner checkpoint (the `B` cell). */
export interface Banner {
  at: GridPos;
  name: string;
}

/**
 * A readable lore spot. The `id` resolves to its written inscription (title +
 * body) in `src/content/lore.ts` — the single source of truth for all lore
 * prose (Task 13). The reader (`ui/inscription.ts`) looks the entry up by id;
 * the structural tests enforce that every placed id resolves and that no base
 * entry is left unplaced.
 */
export interface LoreSpot {
  id: string;
  at: GridPos;
}

/**
 * A door between zones. `at` is the [row, col] of the door anchor cell in
 * the grid (a `1`-`9`/`D` char). A gate wider than one cell repeats the
 * digit on adjacent cells (e.g. ashen-gate's `11`); the DoorDef anchors on
 * one of them and `doorSpan` (zoneGraph.ts) claims the rest.
 *
 * `lock` gates passage — see `canPass` in zoneGraph.ts for the flag each
 * lock kind requires.
 *
 * PAIRING (Task 11): walking through a door drops the player at the
 * matching door of the target zone. Two doors are two ends of one passage
 * when they share the same `pair` edge id (unique per passage, game-wide);
 * when `pair` is absent, the first door in the target whose `to` points
 * back at the source zone is used (fine while zones link at most once —
 * ramparts↔great-hall has TWO edges, so those doors MUST set `pair`).
 * The arrival pose itself comes from `doorEntry`: one cell inward from the
 * paired anchor, facing into the room.
 */
export interface DoorDef {
  id: string;
  at: [number, number];
  to: ZoneId;
  lock?: 'gatekey' | 'shortcut' | 'throne' | 'ngplus' | 'illusory' | 'forsworn' | 'greatervael';
  /** Edge id shared by both ends of a passage (see PAIRING above). */
  pair?: string;
  /**
   * Kicked open from THIS side: interacting sets the door's lock flag (see
   * `kickOpen` in mechanics.ts) instead of denying, permanently unsealing
   * both ends of the passage. The Ramparts shortcut gate — openable from the
   * ramparts, never from the hall (the hall twin has no `kick`, so it waits
   * on the flag). Meaningless without a `lock`.
   */
  kick?: boolean;
}

/**
 * A picked-up world item (a "lore-item"): the `at` cell shows a prompt
 * (`TAKE`); taking it sets `flag` once and surfaces `card` as an inscription
 * plate. The Gatekey of Vael lives on the undercroft pedestal.
 */
export interface ItemSpot {
  id: string;
  at: GridPos;
  /** Set once when the item is taken (persisted in the save flags). */
  flag: GameFlag;
  /** Inscription shown on pickup. */
  card: string;
}

/**
 * A one-shot scripted vista moment (spec §9, clip #1): the first time the
 * player steps into any of `cells`, the renderer swells the fog far-plane
 * open and lifts the camera (VistaDirector, world/vista.ts) without taking
 * control away. `id` is persisted in SaveData.visionsSeen (namespaced
 * `vista-*` so banner-vision ids can never collide) so it plays once per
 * save; until the first banner checkpoint it replays on reload — intended,
 * it is the game's signature capture shot.
 */
export interface VistaDef {
  id: string;
  cells: GridPos[];
}

/** A fake wall cell; revealing it sets `flag` (e.g. 'garden-found'). */
export interface IllusoryWall {
  at: GridPos;
  flag: GameFlag;
}

/**
 * NG+ overrides merged onto the base zone by `applyNgPlus` (world/ngplus.ts) —
 * the Second Vigil (T16). The satellite arrays here (enemies/props/lights/
 * doors/ambience) REPLACE the base zone's whole array when present (the enemy
 * remixes authored in T11/T12/T15 use `enemies`); `addedLore` is CONCATENATED
 * onto the base zone's lore (deduped by id, so the merge is idempotent) — the
 * eight `ngOnly` recontextualisation inscriptions (lore.ts) are placed here,
 * never in a base `lore` array, so they surface only on a Second Vigil.
 *
 * Anomalies are NOT declared here: they mutate the BUILT three.js scene rather
 * than the pure ZoneDef, so they live in the anomaly registry (content/
 * anomalies.ts), keyed by zone, and are applied by the ZoneBuilder post-build
 * hook in NG+ only.
 */
export interface NgPlusVariant {
  props?: Prop[];
  lights?: Torch[];
  enemies?: EnemySpawn[];
  doors?: DoorDef[];
  ambience?: string[];
  /** Extra inscriptions the Second Vigil adds (concatenated onto base lore). */
  addedLore?: LoreSpot[];
}

// --- Greater Vael Drop 1 — exterior / dread surface ------------------------
// All additive; every field below is optional on ZoneDef and absent on the
// v1 castle zones, so those zones build byte-for-byte identical (spec §2).

/** Which backdrop an exterior zone renders (sky/moon/horizon palette). */
export type ExteriorSky = 'field' | 'forest' | 'gorge';

/**
 * A patch of low-fog "scare cells" (10–12 m) inside an otherwise 16 m
 * exterior — the ONLY places aggro may exceed visual range, and only when
 * paired with an audio tell (spec §4). `farM` is the fog far-plane inside
 * `cells`.
 */
export interface FogCellBand {
  cells: GridPos[];
  farM: number;
}

/**
 * The screen-effect a scare beat fires. All four glitch gimmicks are driven
 * through the existing PS1/patchMaterial/mixer APIs (one glitch metaphor —
 * "the engine notices IT"); `false-pulse` spoofs a brand pulse; `watcher` /
 * `hag-glimpse` manifest a presence; `null` is a pure-visual beat (no gimmick).
 */
export type ScareGimmick =
  | 'snap-grid'
  | 'resolution-drop'
  | 'desaturation'
  | 'silence-spike'
  | 'false-pulse'
  | 'watcher'
  | 'hag-glimpse'
  | null;

/** What arms a scare beat (the DreadDirector evaluates these per frame). */
export type ScareTrigger =
  | { on: 'cellEnter'; cells: GridPos[] }
  | { on: 'approach'; at: GridPos; withinM: number }
  | { on: 'brandPulse'; at: GridPos; withinM: number }
  | { on: 'kneel'; at?: GridPos }
  | { on: 'loreRead'; loreId: string }
  | { on: 'timer'; at: GridPos; minSec: number }
  | { on: 'seededClearing'; cells: GridPos[] } // GF-2 per-run seeded false pulse
  | { on: 'vista'; vistaId: string }; // PD-1

/** One authored scare beat (`id` e.g. 'GF-1' … 'PD-2'). */
export interface ScareBeat {
  id: string;
  zone: ZoneId;
  trigger: ScareTrigger;
  gimmick: ScareGimmick;
  /** AF-2, PD-1 manifest the Watcher when they fire. */
  showsWatcher?: boolean;
  /** A pure-visual crossing (AF-1): the two grid cells a tall dark silhouette
   *  traverses between (downrange, at the fog's edge) before it despawns. Only
   *  meaningful on a `gimmick: null` beat; main reads it to arm the crossing. */
  crossing?: [GridPos, GridPos];
  oneLine: string;
}

/** The Hag-of-the-Fog-Line threshold: where she is glimpsed, receding. */
export interface HagThresholdDef {
  at: GridPos;
  glimpseCells: GridPos[];
}

export interface ZoneDef {
  id: ZoneId;
  /** ASCII rows; every row the same length. */
  grid: string[];
  /** Cell size in meters — always 2. */
  cell: number;
  /** Zone-specific letter → collision meaning. */
  tiles: Record<string, TileKind>;
  props: Prop[];
  lights: Torch[];
  enemies: EnemySpawn[];
  banner?: Banner;
  lore: LoreSpot[];
  /** Takeable world items (pedestal pickups); the Gatekey lives here. */
  items?: ItemSpot[];
  doors: DoorDef[];
  illusory?: IllusoryWall[];
  ambience: string[];
  /**
   * Ambient-light intensity floor for this zone (main.ts drives the scene
   * AmbientLight from it). Default 0.35 (lit halls); the Undercroft crypt
   * uses 0.06 so its unlit east half stays black for the wraith showcase.
   */
  ambientFloor?: number;
  /**
   * Overrides the resolved DirectionalLight (moon/interior key) intensity for
   * this zone (realism pass, spec §3). The Undercroft sets 0 so its faint
   * interior directional never defeats the void-black wraith showcase (Task 2).
   */
  keyLightIntensity?: number;
  /** One-shot scripted vista (spec §9); ashen-gate carries clip #1. */
  vista?: VistaDef;
  /** Fog far-plane for this zone, meters. Default 16 (main.ts); the
   * ashen-gate courtyard uses 12 so the vista's 12→28 swell reads. */
  fogFarM?: number;
  // --- Greater Vael Drop 1 (all optional; absent ⇒ v1 interior behavior) ---
  /** 'interior' (default) keeps v1 behavior; 'exterior' opts into the outdoor
   * zone engine — height layer, instanced forest, sky/moon/ash, DreadDirector. */
  kind?: 'interior' | 'exterior';
  /** Per-cell terrain step, same dims as `grid`; one digit '0'–'3' per cell.
   * A visual y-lerp only — collision stays the flat v1 2D grid (no jump). */
  heightGrid?: string[];
  /** Low-fog scare-cell bands within this zone (spec §4). */
  fogCells?: FogCellBand[];
  /** Backdrop palette for an exterior zone. */
  exteriorSky?: ExteriorSky;
  /** Realism pass (Task 10): sparse instanced ground clutter (1 draw call/kind). */
  scatter?: { kind: 'stone' | 'bones' | 'stump'; cells: GridPos[] }[];
  /** Authored scare beats the DreadDirector may fire in this zone. */
  scares?: ScareBeat[];
  /** Watcher sighting positions (may be off-grid backdrop coordinates, and may
   *  carry an optional elevation — see WatcherAnchor). */
  watcherAnchors?: WatcherAnchor[];
  /** The Hag-of-the-Fog-Line threshold for this zone, if any. */
  hagThreshold?: HagThresholdDef;
  ngPlus?: NgPlusVariant;
}
