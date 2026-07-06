/**
 * Door system kit (world-expansion v1.2, Task 1). Pure TS — no three.js.
 *
 * A door DECORATES an existing zoneGraph gate: the sibling `DoorDef` (see
 * `zoneDef.ts` + `zoneGraph.ts`) still carries the transition (`to`/`pair`);
 * a `ZoneDoorDef` (`ZoneDef.gateDoors`) lays a physical, `OPEN`-gated panel
 * over that gate plus an optional far-side lock. This module resolves the
 * authored decorations into canonical, edge-keyed `DoorInstance`s that
 * `main.ts` (barred check / fade / persist) and the reachability guard read.
 *
 * ONE door per zoneGraph edge: a `gateDoors` entry on EITHER side defines the
 * door for the whole edge; the far side renders the same door automatically.
 * The canonical edge id is `"<zoneA>-<zoneB>:<gate>"` with the two zone ids in
 * lexicographic order and `<gate>` the DEFINING side's gate digit — this is
 * the id stored in `SaveData.doorsOpened`.
 */
import type { DoorDef, ZoneDef } from './zoneDef';
import type { ZoneId } from '../content/types';
import { pairedDoor } from './zoneGraph';

/**
 * Canonical, order-independent id for the door on the zoneGraph edge between
 * `zoneA` and `zoneB` at gate digit `gate`. The two zone ids sort
 * lexicographically so both ends compute the same id:
 *   doorEdgeId('undercroft', 'gateFields', '2') === 'gateFields-undercroft:2'
 */
export function doorEdgeId(zoneA: string, zoneB: string, gate: string): string {
  const [lo, hi] = zoneA <= zoneB ? [zoneA, zoneB] : [zoneB, zoneA];
  return `${lo}-${hi}:${gate}`;
}

/** A resolved door — one per decorated zoneGraph edge, keyed by `edgeId`. */
export interface DoorInstance {
  /** Canonical edge id (see `doorEdgeId`); the id persisted in `doorsOpened`. */
  edgeId: string;
  /** Prompt label ("Iron Door", "Postern Gate", "Stair Door", …). */
  label: string;
  /** The zone id whose `ZoneDef.gateDoors` carries the authored entry. */
  definedIn: ZoneId;
  /** The defining side's gate digit. */
  gate: string;
  /** True when the door bars its far side until first opened from within. */
  lockedFarSide: boolean;
}

/** The grid char at a door's anchor cell — the gate digit it sits on. */
function gateCharOf(def: ZoneDef, door: DoorDef): string | undefined {
  return def.grid[door.at[0]]?.[door.at[1]];
}

/** The transition `DoorDef` in `def` whose anchor sits on gate digit `gate`. */
function doorOnGate(def: ZoneDef, gate: string): DoorDef | undefined {
  return def.doors.find((d) => gateCharOf(def, d) === gate);
}

/**
 * Resolve every authored `gateDoors` decoration into a `DoorInstance`, keyed by
 * canonical `edgeId`. Each entry names a gate digit; the sibling `DoorDef` on
 * that digit supplies the far zone (`to`) needed to form the edge id.
 *
 * Throws when two zones both declare a door for the SAME edge (a door is one
 * per edge), or when a `gateDoors` entry names a gate digit with no matching
 * transition door in its zone (an authoring typo — it decorates nothing).
 */
export function collectDoors(zones: ZoneDef[]): Map<string, DoorInstance> {
  const byEdge = new Map<string, DoorInstance>();
  for (const zone of zones) {
    for (const gd of zone.gateDoors ?? []) {
      const door = doorOnGate(zone, gd.gate);
      if (!door) {
        throw new Error(
          `zone "${zone.id}" gateDoor decorates gate '${gd.gate}', which has no matching door`,
        );
      }
      const edgeId = doorEdgeId(zone.id, door.to, gd.gate);
      if (byEdge.has(edgeId)) {
        throw new Error(`duplicate door on edge "${edgeId}" (declared on both sides)`);
      }
      byEdge.set(edgeId, {
        edgeId,
        label: gd.label,
        definedIn: zone.id,
        gate: gd.gate,
        lockedFarSide: gd.locked === 'far-side',
      });
    }
  }
  return byEdge;
}

/**
 * Barred iff the door locks its far side, the player is approaching from the
 * FAR side (not the defining zone), and the edge has not yet been opened.
 * Opening it once from within (the defining side always passes) records the
 * `edgeId` in `opened` and unbars the far side for good.
 */
export function isBarred(
  door: DoorInstance,
  approachingFrom: string,
  opened: ReadonlySet<string>,
): boolean {
  return door.lockedFarSide && approachingFrom !== door.definedIn && !opened.has(door.edgeId);
}

/**
 * The cell disposition of a decorated door for the CURRENT run (seamless
 * traversal, Task 12 — the fade is dead; doors swing open and you walk through):
 *
 *   'walk-in' — the edge has been opened this run: the panel is swung, the cell
 *               un-solidifies and rejoins the walk-in `doorCells`, and the
 *               player crosses instantly mid-stride, exactly like any v1 gate.
 *               (Both ends of an opened edge report 'walk-in' — one `edgeId`.)
 *   'barred'  — a far-side lock, approached from the far side, not yet opened:
 *               the panel stays solid and E answers 'Barred from the other side.'
 *   'closed'  — decorated and openable from here: the panel is solid and E
 *               swings it open (recording the edge, un-barring the far side).
 *
 * Pure — `main.ts` turns the state into meshes + collider bits.
 */
export type DoorCellState = 'walk-in' | 'barred' | 'closed';

export function doorCellState(
  door: DoorInstance,
  approachingFrom: string,
  opened: ReadonlySet<string>,
): DoorCellState {
  if (opened.has(door.edgeId)) return 'walk-in';
  if (isBarred(door, approachingFrom, opened)) return 'barred';
  return 'closed';
}

/**
 * Index every `DoorDef` that lies on a decorated edge — BOTH ends — to its
 * `DoorInstance`, keyed by `DoorDef.id` (unique game-wide). The defining side's
 * door is found directly; the far side is resolved through `pairedDoor`, so a
 * decorated edge whose two sides use different gate digits still resolves.
 * `main.ts` and the reachability guard look a `PlacedDoor` up here by its
 * `def.id` to decide whether it is decorated / barred.
 */
export function resolveDoorInstances(zones: ZoneDef[]): Map<string, DoorInstance> {
  const byId = new Map<string, DoorInstance>();
  const byZoneId = new Map<ZoneId, ZoneDef>(zones.map((z) => [z.id, z]));
  const edges = collectDoors(zones); // also validates (throws on dup / bad gate)
  for (const zone of zones) {
    for (const gd of zone.gateDoors ?? []) {
      const door = doorOnGate(zone, gd.gate);
      if (!door) continue; // unreachable: collectDoors already threw
      const inst = edges.get(doorEdgeId(zone.id, door.to, gd.gate));
      if (!inst) continue;
      byId.set(door.id, inst); // defining end
      const target = byZoneId.get(door.to);
      if (target) {
        const far = pairedDoor(zone.id, door, target);
        if (far) byId.set(far.id, inst); // far end (renders the same door)
      }
    }
  }
  return byId;
}
