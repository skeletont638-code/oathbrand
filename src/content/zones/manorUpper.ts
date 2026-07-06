/**
 * THE BURNT MANOR — UPPER (World Expansion v1.2, Task 8) — the gallery over the
 * fire-gutted hall, climbed from the ground floor (the `Stair Door`, unlocked). A
 * ring of scorched walkway around a burned-through hole where the gallery floor
 * fell into the hall below: the `~` cells render as floorless void reading DOWN
 * into the black (the hall-gallery well treatment — a misstep off the boards is
 * the existing void rule, ember loss + reset, not new code). One hollow soldier
 * still holds the gallery; one Act-II inscription reads the last waverers.
 *
 * THE MISSING FLOOR: the 2×3 hole [2,2],[2,3],[2,4],[3,2],[3,3],[3,4] is `~` void
 * — where the fire ate the boards first, so the hall where the village chose the
 * fire shows through at the player's feet. A walkable RING survives around it: the
 * north walk (row 1), the west run (col 1), the east run (cols 5–6), and the south
 * walk (row 4) all stay floor, so a route reaches every torch, the inscription,
 * the soldier and both stairs without ever needing to cross the hole. Ambient
 * stays near void-black (0.08, hall-gallery precedent) so the torches pool the
 * boards while the hole stays black.
 *
 * Interior kit (Task 2): `dreadInterior` opts the gallery into the DreadDirector.
 * TORCHES ×2 (lit kit `torches`): [1,1] on the north walk and [4,6] on the south —
 * pools of safety on the surviving boards, one each side of the hole. Flat interior
 * (no heightGrid): the void is the drop, not a terrace, so every walkway cell sits
 * on h0 and the placement stays exact.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const MANOR_UPPER: ZoneDef = {
  id: 'manor-upper',
  grid: [
    '###1####', // 0  N wall — Stair Door '1' [0,3] → manor-ground (DOWN)
    '#......#', // 1  north walk — torch [1,1], fallen beam [1,4]
    '#.~~~..#', // 2  gallery — the burned-through hole reads DOWN into the hall
    '#.~~~..#', // 3  gallery — the hole continues; ring survives at cols 1 / 5–6
    '#......#', // 4  south walk — inscription [4,5], soldier [4,4], torch [4,6]
    '#..S...#', // 5  south walk — spawn [5,3] (fallback; arrival is the Stair Door); crate [5,1]
    '########', // 6  S wall
  ],
  cell: 2,
  // `~` is the burned-through floor (void — walkable for collision, a fall = ember
  // loss + reset), `.` the surviving scorched boards, `1` the stairwell gate.
  tiles: {},
  props: [
    // A fallen roof-beam at the north lip of the hole and a burnt crate by the
    // spawn — the gutted read. Both on the surviving ring, clear of the void.
    { kind: 'rubble', at: [1, 4], rotY: 0.6 }, // fallen beam at the hole's north lip
    { kind: 'crate', at: [5, 1], rotY: -0.4 }, // burnt crate, SW walk
  ],
  // The interior wall-torches carry the light; no v1 braziers (lights empty).
  lights: [],
  // Two LIT wall-torches (interior kit): one on the north walk, one on the south —
  // the boards read on both sides of the hole while the void between stays black.
  torches: [
    { at: [1, 1] }, // W wall, north walk
    { at: [4, 6] }, // E wall, south walk
  ],
  enemies: [
    // One hollow soldier still holds the gallery, working the surviving ring.
    { kind: 'soldier', at: [4, 4] },
  ],
  // Inscription (Act II — the last waverers at the rail, turned forward-dread).
  lore: [
    { id: 'act2-manor-b', at: [4, 5] }, // cut into the rail at the hole's south edge
  ],
  doors: [
    // Down the stair to the gutted hall (manorGround) — the paired other end of the
    // ground floor's stairwell gate '1'. Unlocked; the 'Stair Door' decoration is
    // declared on the ground side (one side per edge), so this end renders it.
    { id: 'manor-upper-to-ground', at: [0, 3], to: 'manor-ground', pair: 'manor-stair' },
  ],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  // Near void-black (hall-gallery precedent): the hole stays black, the torches
  // pool the surviving boards.
  ambientFloor: 0.08,
  dreadInterior: true,
  ngPlus: {
    // The Second Vigil sets a wraith on the east run beside the burned-through hole.
    enemies: [
      { kind: 'soldier', at: [4, 4] },
      { kind: 'wraith', at: [2, 6] },
    ],
  },
};
