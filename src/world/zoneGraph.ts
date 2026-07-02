/**
 * Zone lock-graph and door traversal: which doors pass under which game
 * flags, which cells belong to a door, and where the player lands after
 * walking through one (see DoorDef in zoneDef.ts for the pairing design).
 * Pure TS — no three.js.
 */
import type { GameFlag, ZoneId } from '../content/types';
import type { DoorDef, GridPos, ZoneDef } from './zoneDef';

/** The flag each lock kind requires before the door passes. */
const LOCK_FLAG: Record<NonNullable<DoorDef['lock']>, GameFlag> = {
  gatekey: 'gatekey',
  shortcut: 'shortcut-open',
  throne: 'throne-open',
  ngplus: 'ng-plus',
  illusory: 'garden-found', // illusory walls pass freely once revealed
  // The throne→summit stair opens only once the Forsworn is down (Task 15).
  forsworn: 'forsworn-dead',
};

/** The save flag that satisfies a given lock kind. */
export function lockFlag(lock: NonNullable<DoorDef['lock']>): GameFlag {
  return LOCK_FLAG[lock];
}

/** No lock → always passes; otherwise the lock's flag must be set. */
export function canPass(door: DoorDef, flags: Set<GameFlag>): boolean {
  return door.lock === undefined || flags.has(LOCK_FLAG[door.lock]);
}

/** Grid char at [row, col]; undefined when out of bounds. */
function charAt(def: ZoneDef, row: number, col: number): string | undefined {
  return def.grid[row]?.[col];
}

/** Plain walkable floor: '.', spawn, banner, or a zone letter mapped to it. */
function isFloor(def: ZoneDef, row: number, col: number): boolean {
  const ch = charAt(def, row, col);
  if (ch === undefined) return false;
  return ch === '.' || ch === 'S' || ch === 'B' || def.tiles[ch] === 'floor';
}

// Neighbor scan order (row/col deltas): N, S, W, E — matches ZoneBuilder.
const ORTHO: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Every grid cell belonging to `door`: all cells sharing the anchor's door
 * char (a gate wider than one cell repeats its digit — ashen-gate's `11`).
 * Walking into ANY span cell counts as walking through the door. The
 * structural zone tests enforce one DoorDef per digit per zone, so a plain
 * whole-grid scan is exact.
 */
export function doorSpan(def: ZoneDef, door: DoorDef): GridPos[] {
  const ch = charAt(def, door.at[0], door.at[1]);
  const cells: GridPos[] = [];
  if (ch === undefined) return cells; // malformed anchor: fail soft, no cells
  for (let row = 0; row < def.grid.length; row++) {
    for (let col = 0; col < def.grid[row].length; col++) {
      if (def.grid[row][col] === ch) cells.push([row, col]);
    }
  }
  return cells;
}

/**
 * The door in `target` that is the other end of `via` (walked from
 * `fromZone`): explicit `pair` edge id first, else the first target door
 * pointing back at the source zone. Undefined for one-way passages (e.g.
 * the undercroft drop) — arrival then falls back to the zone's `S` spawn.
 */
export function pairedDoor(fromZone: ZoneId, via: DoorDef, target: ZoneDef): DoorDef | undefined {
  if (via.pair !== undefined) {
    const match = target.doors.find((d) => d.pair === via.pair);
    if (match) return match;
  }
  return target.doors.find((d) => d.to === fromZone);
}

/** Arrival pose when stepping out of `door` into zone `def`. */
export interface DoorEntry {
  x: number;
  z: number;
  /** Controller yaw (0 faces -z), pointed into the room. */
  yaw: number;
}

/**
 * Where the player lands after arriving through `door`: centered one cell
 * inward (the anchor's first plain-floor orthogonal neighbor), facing away
 * from the door — NOT on the door cell itself, so the arrival never
 * re-triggers the walk-through transition. Fails soft to the anchor cell
 * when the door has no floor neighbor (structural tests forbid that).
 */
export function doorEntry(def: ZoneDef, door: DoorDef): DoorEntry {
  const [row, col] = door.at;
  const d = ORTHO.find(([dr, dc]) => isFloor(def, row + dr, col + dc));
  const [dr, dc] = d ?? [0, 0];
  return {
    x: (col + dc + 0.5) * def.cell,
    z: (row + dr + 0.5) * def.cell,
    // Face the inward direction (dx,dz)=(dc,dr): forward is (-sin,-cos)yaw.
    // `0 - d` (not `-d`) so a 0 delta stays +0 — atan2(-0,-1) would be -π.
    yaw: d ? Math.atan2(0 - dc, 0 - dr) : 0,
  };
}
