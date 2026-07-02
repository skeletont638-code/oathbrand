/**
 * The zone registry (Task 11). `ZONES` maps every BUILT zone id to its
 * authored ZoneDef; the full campaign is seven zones, landed task by task,
 * so the record is intentionally Partial until T12/T15/T16 complete it —
 * ids of authored-but-unbuilt zones live in `FUTURE_ZONE_IDS`, the
 * allowlist the structural zone tests accept as door targets (remove each
 * id from it when its zone lands; the tests then demand a real pairing).
 */
import type { ZoneId } from '../types';
import type { ZoneDef } from '../../world/zoneDef';
import { ASHEN_GATE } from './ashenGate';
import { GREAT_HALL } from './greatHall';
import { UNDERCROFT } from './undercroft';
import { RAMPARTS } from './ramparts';
import { THRONE } from './throne';
import { SUMMIT } from './summit';
import { QUEENS_GARDEN } from './queensGarden';

/** Every built zone, by id. All seven have landed (T16 built the garden). */
export const ZONES: Partial<Record<ZoneId, ZoneDef>> = {
  'ashen-gate': ASHEN_GATE,
  'great-hall': GREAT_HALL,
  undercroft: UNDERCROFT,
  ramparts: RAMPARTS,
  throne: THRONE,
  summit: SUMMIT,
  'queens-garden': QUEENS_GARDEN,
};

/**
 * Zones the design names but later tasks build: a door may target one before
 * its zone ships, and main.ts treats an unbuilt destination as sealed. The
 * campaign is complete as of T16 (the Queen's Garden landed), so this allowlist
 * is now EMPTY — every door target is a real, registered zone, and the
 * structural tests demand a real pairing for each. Kept (empty) as the seam for
 * any future zone rather than deleting the mechanism.
 */
export const FUTURE_ZONE_IDS: ReadonlySet<ZoneId> = new Set<ZoneId>();

/** True when `id` names a built, registered zone. */
export function hasZone(id: ZoneId): boolean {
  return ZONES[id] !== undefined;
}

/** The registered ZoneDef for `id`; throws for unbuilt zones (a door into
 * one is a wiring bug — main.ts must gate on `hasZone` first). */
export function zoneOrThrow(id: ZoneId): ZoneDef {
  const def = ZONES[id];
  if (!def) throw new Error(`zone "${id}" is not built yet (see FUTURE_ZONE_IDS)`);
  return def;
}
