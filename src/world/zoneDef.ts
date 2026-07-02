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

/** A readable lore spot. */
export interface LoreSpot {
  id: string;
  at: GridPos;
  text: string;
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
  lock?: 'gatekey' | 'shortcut' | 'throne' | 'ngplus' | 'illusory';
  /** Edge id shared by both ends of a passage (see PAIRING above). */
  pair?: string;
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

/** NG+ overrides applied on top of the base zone. */
export type NgPlusVariant = Partial<
  Pick<ZoneDef, 'props' | 'lights' | 'enemies' | 'doors' | 'ambience'>
>;

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
  doors: DoorDef[];
  illusory?: IllusoryWall[];
  ambience: string[];
  /** One-shot scripted vista (spec §9); ashen-gate carries clip #1. */
  vista?: VistaDef;
  /** Fog far-plane for this zone, meters. Default 16 (main.ts); the
   * ashen-gate courtyard uses 12 so the vista's 12→28 swell reads. */
  fogFarM?: number;
  ngPlus?: NgPlusVariant;
}
