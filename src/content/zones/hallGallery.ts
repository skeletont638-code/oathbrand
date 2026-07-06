/**
 * THE HALL GALLERY (World Expansion v1.2, Task 4) — the keep's first upper
 * floor. A ring-gallery riding above the Great Hall: an outer walkable walkway
 * around two open wells that read DOWN into the void-black where the hall lies
 * (the `~` cells render as floorless holes — the same open-void treatment the
 * Undercroft/Pilgrim's Descent use, so a misstep off the rail is the existing
 * void rule, not new code). A central north–south spine bridges the wells and
 * carries the echo-scene dais.
 *
 * This is SHORTCUT LOOP #2 (spec §3): the gallery links the Great Hall (the
 * `Stair Door`, climbed up from the hall) to the Ramparts (the `Gallery Door`,
 * unlocked). With the hall↔ramparts stair already open, the keep is now a RING
 * rather than a corridor — a wrong turn becomes a way round, not a dead end.
 *
 * Reserved for Task 9: the echo dais [4,6],[4,7],[5,6],[5,7] is kept CLEAR of
 * props — echo scene #6 (the king hollows: Osric sets the crown down and
 * forgets why) stages there. Its inscriptions already carry that Act-III beat.
 *
 * Interior kit (Task 2): `dreadInterior` opts the room into the DreadDirector;
 * ambient stays near void-black (spec §2) so the four wall-torches read as pools
 * of safety on the walkway while the two wells stay black. No banner (the
 * gallery is a pass-through loop, not a checkpoint).
 */
import type { ZoneDef } from '../../world/zoneDef';

export const HALL_GALLERY: ZoneDef = {
  id: 'hall-gallery',
  grid: [
    '##########2###', // 0  N wall — gate '2' [0,10] → ramparts ('Gallery Door')
    '#............#', // 1  north walkway
    '#............#', // 2  north walkway
    '#..~~~..~~~..#', // 3  W walkway | W well | spine | E well | E walkway
    '#..~~~..~~~..#', // 4  echo dais spans the spine at [4,6],[4,7]
    '#..~~~..~~~..#', // 5  echo dais spans the spine at [5,6],[5,7]
    '#..~~~..~~~..#', // 6
    '#............#', // 7  south walkway
    '#......S.....#', // 8  south walkway — spawn [8,7]
    '###1##########', // 9  S wall — gate '1' [9,3] → great-hall ('Stair Door')
  ],
  cell: 2,
  tiles: {},
  props: [
    // Balustrade posts at the four well-lips — the gallery's columns, ringing
    // the overlook. All on the walkway (the wells are floorless `~`), clear of
    // the echo dais.
    { kind: 'pillar', at: [2, 4] },
    { kind: 'pillar', at: [2, 9] },
    { kind: 'pillar', at: [7, 4] },
    { kind: 'pillar', at: [7, 9] },
    // The hollowed keep's decay along the walkway corners.
    { kind: 'rubble', at: [1, 3], rotY: 0.6 },
    { kind: 'rubble', at: [8, 11], rotY: -0.5 },
  ],
  // No v1 point-light braziers here — the interior wall-torches below carry the
  // light (pooled, capped). `lights` stays empty (well within the ≤4 budget).
  lights: [],
  // Four wall-torches (interior kit): flanking the spine on the N and S walls so
  // the walkway and the spine approaches read while the wells stay void-black.
  torches: [
    { at: [1, 5] },
    { at: [1, 8] },
    { at: [8, 5] },
    { at: [8, 8] },
  ],
  enemies: [
    // Two hollow soldiers work the flanking walkways; an archer holds the north
    // walkway, firing across the spine on the approach.
    { kind: 'soldier', at: [3, 2] }, // west walkway
    { kind: 'soldier', at: [6, 11] }, // east walkway
    { kind: 'archer', at: [1, 7] }, // north walkway, over the spine
  ],
  // Inscriptions (Act III — the king hollows). Text resolves by id in lore.ts.
  lore: [
    { id: 'act3-gallery-a', at: [2, 10] }, // the king's overlook, north walkway
    { id: 'act3-gallery-b', at: [7, 3] }, // the smooth stone, south walkway
  ],
  doors: [
    // Down the stair to the Great Hall — the paired other end of the hall's new
    // stairwell gate '6'. Unlocked; the 'Stair Door' decoration is declared HERE
    // (one side per edge), so the hall renders the same door automatically.
    { id: 'gallery-to-hall', at: [9, 3], to: 'great-hall', pair: 'gallery-hall' },
    // Out onto the Ramparts — shortcut loop #2 (spec §3). Unlocked, so the ring
    // is a ring from the first visit.
    { id: 'gallery-to-ramparts', at: [0, 10], to: 'ramparts', pair: 'gallery-ramparts' },
  ],
  gateDoors: [
    { gate: '1', label: 'Stair Door' }, // the great-hall edge
    { gate: '2', label: 'Gallery Door' }, // the ramparts edge (unlocked shortcut)
  ],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  // Near void-black (spec §2): the wells stay black, the torches pool the walk.
  ambientFloor: 0.08,
  dreadInterior: true,
  ngPlus: {
    // The Second Vigil adds a wraith haunting the spine below the echo dais.
    enemies: [
      { kind: 'soldier', at: [3, 2] },
      { kind: 'soldier', at: [6, 11] },
      { kind: 'archer', at: [1, 7] },
      { kind: 'wraith', at: [6, 7] },
    ],
  },
};
