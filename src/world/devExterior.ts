/**
 * DEV-ONLY exterior verification zone (Task 2). There is no shipped exterior
 * zone yet — Tasks 3–5 author the real Fields/Forest/Village — so this small
 * hand-built `kind: 'exterior'` def exists purely to exercise the Task 2
 * rendering engine in-browser: instanced forest (`,`/`t`/`T`/`#`), the worn
 * path (`p`), a ruin block (`H`), a gorge (`~`), the height layer + its ramp
 * and cliff skirts (`heightGrid`), a low-fog scare band (`fogCells`), and the
 * sky/moon/ash backdrop (`exteriorSky`).
 *
 * It is NOT in the `ZONES` registry (so the structural suite's "exactly 7
 * zones" invariant is untouched) and main.ts only resolves it behind
 * `?dev=1&zone=gate-fields`. Its id reuses the unbuilt `gate-fields` ZoneId so
 * that the moment Task 3 registers a real `gate-fields`, `hasZone` flips true
 * and this scaffold is shadowed out with no further wiring.
 */
import type { ZoneDef } from './zoneDef';

export const DEV_EXTERIOR_ZONE: ZoneDef = {
  id: 'gate-fields',
  // A raised northern plateau (h2) overlooking a gorge to its west, stepping
  // down a ramp (h1) into the open field (h0); dense treeline border, sparse
  // trunks and grass scattered, a worn path, one ruin, and a field pit.
  grid: [
    '############',
    '#TT,,,,,,TT#',
    '#~,,,S,,,,,#',
    '#~,,ppp,,,H#',
    '#,tt,p,,tt,#',
    '#,,,,p,,,,,#',
    '#,,,ppp,,,,#',
    '#,,,,,,,,,,#',
    '#,,,~~~,,,,#',
    '############',
  ],
  // Same dims as `grid`. Wall/void cells' digits are inert (no seam originates
  // at a wall; the west `~` reads h0 so the plateau edge beside it is a cliff).
  heightGrid: [
    '000000000000',
    '000222222000',
    '002222222220',
    '002222222220',
    '011111111110',
    '000000000000',
    '000000000000',
    '000000000000',
    '000000000000',
    '000000000000',
  ],
  cell: 2,
  tiles: { ',': 'floor', p: 'floor', t: 'floor', T: 'wall', H: 'wall' },
  kind: 'exterior',
  exteriorSky: 'field',
  // A low-fog "scare band" hugging the field pit (spec §4) — proves the
  // per-cell fog override; the paired audio tell is Task 6/10/12.
  fogCells: [{ cells: [[7, 4], [7, 5], [7, 6], [8, 3]], farM: 11 }],
  props: [],
  lights: [],
  enemies: [],
  lore: [],
  doors: [],
  ambience: [],
  ambientFloor: 0.65, // open night: lift the ash-grey ambient so the forest reads
};
