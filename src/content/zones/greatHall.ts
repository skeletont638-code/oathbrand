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
 * 3→ramparts 4→throne(lock throne) 5→shortcut(lock shortcut) · banner yes
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
    { at: [4, 4] }, // inside the banner chamber
    { at: [1, 13] }, // north wall, near the ramparts stair
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
  lore: [
    {
      id: 'hall-mural',
      at: [2, 2],
      text: 'A mural, ash-scoured: the queen hands a burning brand to a kneeling knight. Someone has scratched out the knight’s face. Not the queen’s.',
    },
    {
      id: 'cold-hearth',
      at: [4, 12],
      text: 'The feast hearth, cold a hundred years. In the soot, small handprints — the servants’ children hid here when the oath broke.',
    },
    {
      id: 'kings-decree',
      at: [8, 3],
      text: 'A decree, nailed to the floor: "NO FIRE SHALL PASS THE GATE." The nail is royal silver. The signature is not the king’s.',
    },
  ],
  doors: [
    { id: 'hall-to-gate', at: [9, 9], to: 'ashen-gate', pair: 'gate-hall' },
    { id: 'hall-to-undercroft', at: [1, 5], to: 'undercroft', pair: 'hall-undercroft' },
    { id: 'hall-to-ramparts', at: [1, 16], to: 'ramparts', pair: 'hall-ramparts' },
    { id: 'hall-throne-door', at: [7, 6], to: 'throne', lock: 'throne', pair: 'hall-throne' },
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
