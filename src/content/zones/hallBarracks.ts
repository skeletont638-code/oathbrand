/**
 * THE HALL BARRACKS (World Expansion v1.2, Task 4) — a side room off the Great
 * Hall (spec §3). The vigil's muster room: cots along the walls (crate props
 * re-dressed as bunks), an armory's clutter, and the oath-stone by the door.
 * One plain door back to the hall (the `Barracks Door`); no shortcut, no
 * checkpoint — a small, lived-in dead-kingdom room whose lore carries Act I
 * (the swearing-in, the gathering), turned forward-dread.
 *
 * Interior kit (Task 2): `dreadInterior` opts it into the DreadDirector; ambient
 * stays low so the three wall-torches read as pools of safety (spec §2). One
 * hollow soldier keeps the room; the Second Vigil sends a wraith in with him.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const HALL_BARRACKS: ZoneDef = {
  id: 'hall-barracks',
  grid: [
    '########', // 0
    '#......#', // 1
    '#......#', // 2
    '#......1', // 3  E wall — gate '1' [3,7] → great-hall ('Barracks Door')
    '#......#', // 4
    '#......#', // 5
    '#S.....#', // 6  spawn [6,1]
    '########', // 7
  ],
  cell: 2,
  tiles: {},
  props: [
    // Cots along the walls — crate props re-dressed as bunks (spec §3).
    { kind: 'crate', at: [1, 1], rotY: 0.1 },
    { kind: 'crate', at: [1, 2], rotY: -0.1 },
    { kind: 'crate', at: [6, 5], rotY: 0.2 },
    { kind: 'crate', at: [6, 6], rotY: -0.15 },
    // Armory clutter framing the door — a full crate, a spilled rack.
    { kind: 'crate', at: [2, 6], rotY: 0.5 },
    { kind: 'rubble', at: [4, 6], rotY: -0.6 },
  ],
  // The interior wall-torches carry the light; no v1 braziers.
  lights: [],
  // Three wall-torches (interior kit): the N, S and W walls, leaving the E wall
  // for the door.
  torches: [
    { at: [1, 3] },
    { at: [6, 3] },
    { at: [3, 1] },
  ],
  enemies: [
    // One hollow soldier holds the muster room.
    { kind: 'soldier', at: [4, 4] },
  ],
  // Inscriptions (Act I — the muster & the oath). Text resolves by id in lore.ts.
  lore: [
    { id: 'act1-barracks-a', at: [5, 2] }, // the muster cots
    { id: 'act1-barracks-b', at: [2, 4] }, // the oath-stone by the door
  ],
  doors: [
    // Back into the Great Hall — the paired other end of the hall's new side
    // gate '7'. Unlocked; the 'Barracks Door' decoration is declared HERE (one
    // side per edge), so the hall renders the same door automatically.
    { id: 'barracks-to-hall', at: [3, 7], to: 'great-hall', pair: 'barracks-hall' },
  ],
  gateDoors: [{ gate: '1', label: 'Barracks Door' }],
  ambience: ['amb-hall-drone', 'amb-banner-cloth'],
  ambientFloor: 0.1,
  dreadInterior: true,
  ngPlus: {
    // The Second Vigil sends a wraith into the muster room with the soldier.
    enemies: [
      { kind: 'soldier', at: [4, 4] },
      { kind: 'wraith', at: [2, 5] },
    ],
  },
};
