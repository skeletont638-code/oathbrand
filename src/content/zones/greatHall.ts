/**
 * Zone 2 — THE GREAT HALL (Task 11). The hub: every road of the vigil
 * crosses this room (spec §5). An inner chamber (the old feast hall) holds
 * the banner; the north wall carries the undercroft drop (2) and the
 * ramparts stair (3); the inner chamber's south face carries the two
 * LOCKED doors — the Throne door (4, needs the Gatekey) and the shortcut
 * gate (5, kicked open from the Ramparts side). First real combat: three
 * hollow soldiers and an archer holding the length of the nave.
 *
 * Grid is the authored layout from the plan — copied VERBATIM; do not
 * "fix" it. Annotations honored: doors 1→ashen-gate 2→undercroft(drop)
 * 3→ramparts 4→throne(lock gatekey — T12) 5→shortcut(lock shortcut) · banner yes
 * (vision 2, T14) · 3 lore · 3 soldiers + 1 archer (NG+: +1 wraith).
 */
import type { ZoneDef } from '../../world/zoneDef';

export const GREAT_HALL: ZoneDef = {
  id: 'great-hall',
  grid: [
    '##################',
    '#....2..........3#',
    '#................#',
    '#..####....####..#',
    '#..#..........#..#',
    '#..#....B.....#..#',
    '#..####....####..#',
    '#.....4....5.....#',
    '#........S.......#',
    '#........1.......#',
    '##################',
  ],
  cell: 2,
  tiles: {},
  props: [
    // Banner post (banner cell [5,8] has no adjacent wall — see ashen-gate).
    { kind: 'pillar', at: [4, 8] },
    { kind: 'statue-knight', at: [2, 13], rotY: Math.PI }, // composite: eyeball in-game (T5 note)
    { kind: 'crate', at: [2, 1], rotY: 0.55 },
    { kind: 'crate', at: [8, 16], rotY: -0.4 },
  ],
  lights: [
    { at: [7, 5] }, // beside the sealed Throne door
    { at: [7, 12] }, // beside the sealed shortcut gate
    { at: [4, 4] }, // inside the banner chamber (NW fill)
    // T14: the checkpoint banner [5,8] read as a black silhouette (T11 note).
    // The banner faces SOUTH into the room, so a torch just south of it (on the
    // chamber's south wall at [6,6]) front-lights its face. Replaces the far NE
    // stair torch ([1,13]) to stay within the 4-light budget.
    { at: [6, 7] },
  ],
  enemies: [
    // Banner-chamber guard: aggros through the south gap on the approach.
    { kind: 'soldier', at: [4, 5] },
    // West-wing patrol and east-wing straggler flank the nave.
    { kind: 'soldier', at: [4, 2] },
    { kind: 'soldier', at: [7, 14] },
    // Archer at the head of the nave: opens up the moment the player
    // steps off the entry cell (14m aggro straight down the center gap).
    { kind: 'archer', at: [1, 10] },
  ],
  banner: { at: [5, 8], name: 'Banner of the Hall' },
  // Inscriptions (Task 13). Text resolves by id in src/content/lore.ts.
  lore: [
    { id: 'hall-mural', at: [2, 2] }, // the scoured mural, west wall
    { id: 'cold-hearth', at: [4, 12] }, // the dead feast-fire in the chamber
    { id: 'kings-decree', at: [8, 3] }, // the decree nailed to the nave floor
    { id: 'oath-spoken', at: [5, 5] }, // the oath-stone by the banner
    { id: 'feast-roster', at: [8, 12] }, // the vigil's roster down the nave
    { id: 'throne-bar', at: [8, 6] }, // at the sealed throne approach
  ],
  doors: [
    { id: 'hall-to-gate', at: [9, 9], to: 'ashen-gate', pair: 'gate-hall' },
    { id: 'hall-to-undercroft', at: [1, 5], to: 'undercroft', pair: 'hall-undercroft' },
    { id: 'hall-to-ramparts', at: [1, 16], to: 'ramparts', pair: 'hall-ramparts' },
    // The Gatekey (taken in the Undercroft) opens the Throne approach (T12
    // changed this lock from 'throne' → 'gatekey'). The 'throne'/'throne-open'
    // lock is now unused — kept in the graph for a possible T15 boss-gate.
    { id: 'hall-throne-door', at: [7, 6], to: 'throne', lock: 'gatekey', pair: 'hall-throne' },
    // Shortcut gate: same wall, opens from the Ramparts side (flag
    // 'shortcut-open'); its ramparts twin must reuse pair 'hall-shortcut'.
    { id: 'hall-shortcut', at: [7, 11], to: 'ramparts', lock: 'shortcut', pair: 'hall-shortcut' },
  ],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  ngPlus: {
    // Remixed placement + the promised extra wraith, haunting the banner.
    enemies: [
      { kind: 'soldier', at: [4, 10] },
      { kind: 'soldier', at: [7, 3] },
      { kind: 'soldier', at: [2, 15] },
      { kind: 'archer', at: [1, 7] },
      { kind: 'wraith', at: [5, 9] },
    ],
  },
};
