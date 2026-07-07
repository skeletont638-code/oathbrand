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
import { CINDER_VILLAGE } from './cinderVillage';
import { PILGRIMS_DESCENT } from './pilgrimsDescent';
import { HALL_BARRACKS } from './hallBarracks';
import { KEEP_CHAPEL } from './keepChapel';
import { WATCHTOWER } from './watchtower';
import { CHAPEL_NAVE } from './chapelNave';
import { CHAPEL_CRYPT } from './chapelCrypt';
import { BURNT_MANOR } from './burntManor';

/** Every built zone, by id. The seven-zone castle campaign (T11–T16) plus the
 *  first Greater Vael exteriors — the Gate Fields hub (Task 9), the Ashen
 *  Forest N (Task 10, the Hound showcase + the Hag's threshold), the Cinder
 *  Village (Task 11, the frozen procession + the tithe-ledger), and the
 *  Pilgrim's Descent (Task 12, the height-layer showcase + the vista terminus). */
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
  'cinder-village': CINDER_VILLAGE,
  'pilgrims-descent': PILGRIMS_DESCENT,
  // World Expansion v1.2 (Task 4, merged in Task 14) — the keep grows outward:
  // the barracks off the Great Hall. The Hall Gallery is no longer its own zone:
  // Task 14 folded it into `great-hall` as a walked mezzanine (its faded Stair
  // Door died; the retired id survives as a save alias, save.ts).
  'hall-barracks': HALL_BARRACKS,
  // World Expansion v1.2 (Task 5) — the keep's chapel, off the Ramparts.
  'keep-chapel': KEEP_CHAPEL,
  // World Expansion v1.2 (Task 6, merged in Task 13) — the Gate Fields
  // watchtower: ONE continuous climb from the ruined guardroom up the stair to
  // the open roof-walk over the fields (the tower-ground + tower-upper floor-
  // zones and their Stair Door fade are merged into this single banded zone).
  watchtower: WATCHTOWER,
  // World Expansion v1.2 (Task 7) — the Sunken Chapel off the Ashen Forest road:
  // the half-collapsed nave (the queen's-walk echo room) and the crypt beneath.
  'chapel-nave': CHAPEL_NAVE,
  'chapel-crypt': CHAPEL_CRYPT,
  // World Expansion v1.2 (Task 8, merged in Task 15) — the Burnt Manor off the
  // Cinder Village plaza: ONE continuous climb from the fire-gutted tithe-hall
  // (the burning-echo room) up the stair to the burnt gallery whose rail overlooks
  // the hall below (the manor-ground + manor-upper floor-zones and their Stair
  // Door fade are merged into this single banded zone; the retired ids survive as
  // save aliases, save.ts).
  'burnt-manor': BURNT_MANOR,
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
 * its zone ships, and the structural tests then demand a real pairing). Tasks
 * 10–12 shipped the Ashen Forest N, the Cinder Village and the Pilgrim's Descent,
 * so all three are gone from the list — their `gf-forest` / `gf-village` /
 * `gf-descent` doors now pair both ways. `salt-road` alone remains: the Drop-2
 * target the Cinder Village's sealed east arch and the Pilgrim's Descent's sealed
 * bottom gate door into a drop early.
 */
export const FUTURE_ZONE_IDS: ReadonlySet<ZoneId> = new Set<ZoneId>([
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
