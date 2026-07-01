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
 * the grid (a `1`-`9`/`D` char). `lock` gates passage — see `canPass` in
 * zoneGraph.ts for the flag each lock kind requires.
 */
export interface DoorDef {
  id: string;
  at: [number, number];
  to: ZoneId;
  lock?: 'gatekey' | 'shortcut' | 'throne' | 'ngplus' | 'illusory';
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
  ngPlus?: NgPlusVariant;
}
