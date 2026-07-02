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

/** Every built zone, by id. Partial until all seven land (see above). */
export const ZONES: Partial<Record<ZoneId, ZoneDef>> = {
  'ashen-gate': ASHEN_GATE,
  'great-hall': GREAT_HALL,
  undercroft: UNDERCROFT,
  ramparts: RAMPARTS,
};

/**
 * Zones the design names but later tasks build: doors may already target
 * them (great-hall's throne door 4; the undercroft's illusory garden wall).
 * Until a target ships, its doors refuse to open in-game (main.ts treats an
 * unbuilt destination as sealed). T15: throne · T16: summit + queens-garden.
 * (T12 landed undercroft + ramparts, so they left this allowlist.)
 */
export const FUTURE_ZONE_IDS: ReadonlySet<ZoneId> = new Set<ZoneId>([
  'throne',
  'summit',
  'queens-garden',
]);

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
