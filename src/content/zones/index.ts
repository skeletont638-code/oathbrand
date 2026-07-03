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
import { GATE_FIELDS } from './gateFields';
import { ASHEN_FOREST_N } from './ashenForestN';

/** Every built zone, by id. The seven-zone castle campaign (T11–T16) plus the
 *  first Greater Vael exteriors — the Gate Fields hub (Task 9) and the Ashen
 *  Forest N (Task 10, the Hound showcase + the Hag's threshold). */
export const ZONES: Partial<Record<ZoneId, ZoneDef>> = {
  'ashen-gate': ASHEN_GATE,
  'great-hall': GREAT_HALL,
  undercroft: UNDERCROFT,
  ramparts: RAMPARTS,
  throne: THRONE,
  summit: SUMMIT,
  'queens-garden': QUEENS_GARDEN,
  'gate-fields': GATE_FIELDS,
  'ashen-forest-n': ASHEN_FOREST_N,
};

/**
 * Zones the design names but later tasks build: a door may target one before
 * its zone ships, and main.ts treats an unbuilt destination as sealed. The v1
 * castle campaign is complete (T16 landed the Queen's Garden), so every v1 door
 * target is a real, registered zone.
 *
 * Greater Vael Drop 1 re-arms the allowlist: the Gate Fields hub (Task 9) opens
 * three roads — `cinder-village`, `ashen-forest-n`, `pilgrims-descent` — whose
 * zones land in Tasks 10–12, so they live here until then (each is removed as
 * its zone ships, and the structural tests then demand a real pairing). Task 10
 * shipped the Ashen Forest N, so it is gone from the list — its `gf-forest` door
 * now pairs both ways.
 * `salt-road` is the Drop-2 target Pilgrim's Descent will door into a drop early.
 */
export const FUTURE_ZONE_IDS: ReadonlySet<ZoneId> = new Set<ZoneId>([
  'cinder-village',
  'pilgrims-descent',
  'salt-road',
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
