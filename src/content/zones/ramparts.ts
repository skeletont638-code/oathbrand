/**
 * Zone 4 — THE RAMPARTS (Task 12). The exterior wall-walk: wind, war-banners
 * along the south parapet, and the vigil's archers holding the height. This
 * is the loop-back. You arrive from the hall (door 1, the rampart stair), fight
 * across the walk, and reach the SHORTCUT GATE (door 5) — kicked open from
 * here, and only here. Opening it sets 'shortcut-open' for good, which unseals
 * the hall's twin gate (door 5) permanently: from then on the ramparts and the
 * hall connect directly, and the run home is a few seconds' walk instead of the
 * long way round. (Clip: the gate kick + the hall revealed beyond.)
 *
 * Grid follows the authored layout, with two deliberate, documented edits the
 * plan's annotation implies but its ASCII omits (see CONCERNS in the T12
 * report):
 *   1. ENTRY DOOR '1' at [1,2]. The plan draws no rampart-side door for the
 *      hall↔ramparts stair, yet the double-edge rule (zoneDef.ts PAIRING) and
 *      the loop REQUIRE one: it pairs 'hall-ramparts' so arrivals land here and
 *      the hall's door 3 pairs back. Placed on the north wall by the spawn.
 *   2. GATE POSTS at [2,15] and [2,17], flanking the shortcut gate '5' [2,16].
 *      The authored '5' stands free in the bastion (no orthogonal wall), which
 *      the T11 door invariant forbids (a door is a doorway IN a wall). The two
 *      stone posts make it a proper gateway at its authored cell without moving
 *      it; room flow is preserved (rows 1 and 3 stay open across the bastion).
 *
 * Annotations honored: banner (vision 4, T14) · 3 lore (incl. callun-post-log)
 * · 2 archers + 1 soldier (NG+ 3 archers + 1) · banner.glb ×6 along the south
 * wall · wind ambience.
 *
 * World Expansion v1.2 (Task 4) adds ONE gate cell — the ONLY change here (grid
 * otherwise byte-identical): gate '2' on the north wall [0,17], the far end of
 * shortcut loop #2 into the Hall Gallery. The gallery declares the unlocked
 * 'Gallery Door' decoration on its side; this file carries only the DoorDef.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const RAMPARTS: ZoneDef = {
  id: 'ramparts',
  grid: [
    '#################2##', // gate '2' [0,17] → hall-gallery (shortcut loop #2)
    '#S1..........#.....#',
    '#...#####....#.#5#.#',
    '#...#...#....#.....#',
    '#.B.#...#..........#',
    '#...#####......###.#',
    '#..................#',
    '####################',
  ],
  cell: 2,
  tiles: {},
  props: [
    // Banner post (cell [4,2] has no adjacent wall — see the other zones).
    { kind: 'pillar', at: [3, 2] },
    // Six war-banners along the south parapet (banner.glb ×6), facing in.
    { kind: 'banner', at: [6, 2], rotY: Math.PI },
    { kind: 'banner', at: [6, 5], rotY: Math.PI },
    { kind: 'banner', at: [6, 8], rotY: Math.PI },
    { kind: 'banner', at: [6, 11], rotY: Math.PI },
    { kind: 'banner', at: [6, 14], rotY: Math.PI },
    { kind: 'banner', at: [6, 18], rotY: Math.PI },
  ],
  lights: [
    // Braziers on the wall-walk; the bastion (east) gets one by the gate.
    { at: [1, 6] },
    { at: [6, 9] },
    { at: [4, 18] },
  ],
  enemies: [
    // Two archers hold the height + a soldier patrols the walk.
    { kind: 'archer', at: [1, 10] }, // sentry: fires down the north walk on arrival
    { kind: 'archer', at: [6, 15] }, // covers the bastion / gate approach
    { kind: 'soldier', at: [4, 10] }, // patrol across the central span
  ],
  banner: { at: [4, 2], name: 'Banner of the Ramparts' },
  // Inscriptions (Task 13). Text resolves by id in src/content/lore.ts.
  lore: [
    { id: 'callun-post-log', at: [6, 3] }, // Callun's watch-log, south walk
    { id: 'rampart-watch', at: [3, 3] }, // the sentry's tally by the arrow-slit
    { id: 'wind-scoured-oath', at: [6, 17] }, // the worn stone by the shortcut gate
    { id: 'callun-oath-broken', at: [6, 7] }, // the Forsworn's struck-down sigil
    { id: 'beacon-cold', at: [4, 16] }, // the dead signal-beacon on the bastion
    { id: 'edda-passage', at: [1, 4] }, // the herald's chalk route-mark, north walk
    { id: 'ride-to-battle', at: [4, 11] }, // the muster-ground overlook
  ],
  doors: [
    // Entry stair from the hall (added; see header note 1). Pairs 'hall-ramparts'
    // so arrivals land just inside, facing the walk.
    { id: 'ramparts-entry', at: [1, 2], to: 'great-hall', pair: 'hall-ramparts' },
    // The shortcut gate — kicked open from the ramparts only. Locked by
    // 'shortcut' (its hall twin waits on the same flag); `kick` makes the
    // interact SET the flag instead of denying (mechanics.kickOpen).
    {
      id: 'ramparts-shortcut',
      at: [2, 16],
      to: 'great-hall',
      lock: 'shortcut',
      pair: 'hall-shortcut',
      kick: true,
    },
    // World Expansion v1.2 (Task 4). Gallery Door — the far end of shortcut loop
    // #2 up into the Hall Gallery; unlocked, so the keep is a ring from the
    // first visit. The gallery declares the 'Gallery Door' decoration.
    { id: 'ramparts-to-gallery', at: [0, 17], to: 'hall-gallery', pair: 'gallery-ramparts' },
  ],
  ambience: ['amb-rampart-wind', 'amb-banner-cloth'],
  ngPlus: {
    // A third archer joins the height on the return trip.
    enemies: [
      { kind: 'archer', at: [1, 10] },
      { kind: 'archer', at: [6, 15] },
      { kind: 'archer', at: [3, 6] },
      { kind: 'soldier', at: [4, 10] },
    ],
    // The great warmth stirring above, felt from the overlook (T16 ngOnly).
    addedLore: [{ id: 'ng-vhaelis-wakes', at: [4, 13] }],
  },
};
