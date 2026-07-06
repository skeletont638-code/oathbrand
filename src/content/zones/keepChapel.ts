/**
 * THE KEEP CHAPEL (World Expansion v1.2, Task 5) — the vigil's chapel, a tall
 * narrow nave reached off the Ramparts (the `Chapel Door`, unlocked). Where the
 * hall musters and the barracks arms, the chapel is where the vigil KNELT: the
 * altar stands on a raised dais at the north end, the pews run the nave, and a
 * hollow still kneels at the altar-step in false prayer (a dormant Kneeling
 * Hollow — it RISES when your brand pulses near it; KneelingHollow auto-wake).
 *
 * THE RAISED ALTAR (stair convention, mechanism A — zoneDef.ts): the dais (rows
 * 0–2) rides one band (heightGrid '1', 1.5 m) above the nave (band '0'); the
 * row2↔row3 seam auto-generates a walkable RAMP (buildHeightRamps classifies a
 * Δ1 walkable↔walkable seam as a slope, not a ledge), and a decorative `stairs`
 * prop rests on it as the visible treads. Collision stays the flat 2D grid (no
 * jump), so the rise is a look the camera glides up, not a barrier. Per the
 * wall-banding rule the dais's bounding walls (N wall + the col0/col6 sides of
 * rows 0–2) carry the SAME band digit as the floor they bound, so their bases
 * seat flush with the raised dais instead of stepping away from it.
 *
 * Interior kit (Task 2): `dreadInterior` opts the chapel into the DreadDirector;
 * ambient stays low so the three wall-torches read as pools of safety over the
 * altar and the entrance (spec §2). Two Act-II inscriptions carry Queen Maren's
 * last vigil (the queen's-walk ECHO stages elsewhere — these are stone only).
 * No banner: the chapel is a devotional room, not a checkpoint.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const KEEP_CHAPEL: ZoneDef = {
  id: 'keep-chapel',
  grid: [
    '#######', // 0  N wall (behind the altar) — banded with the dais (band 1)
    '#.....#', // 1  altar dais (raised, band 1) — altar block [1,3]
    '#.....#', // 2  altar dais front — the kneeler knelt at [2,3]
    '#.....#', // 3  nave (band 0) — the ramp seam is row2↔row3; treads [3,3]
    '#.....#', // 4  nave — pew rows flank the aisle
    '#.....#', // 5  nave — the chancel memorial slab at [5,3]
    '#.....#', // 6  nave — pew rows
    '#..S..#', // 7  entrance — spawn [7,3] (where the Chapel Door lands you)
    '###3###', // 8  S wall — gate '3' [8,3] → ramparts ('Chapel Door', unlocked)
  ],
  cell: 2,
  tiles: {},
  // The altar dais rides one band above the nave (mechanism A). The bounding
  // walls of rows 0–2 carry the dais's band '1' (wall-banding rule) so they seat
  // flush; the nave and its walls stay band '0'. The single Δ1 seam (row2↔row3)
  // is the walkable altar ramp; no voids ⇒ no cliffs.
  heightGrid: [
    '1111111', // 0  N wall — banded with the altar dais it bounds
    '1111111', // 1  altar dais (band 1), side walls banded
    '1111111', // 2  altar dais front (band 1), side walls banded
    '0000000', // 3  nave (band 0) — the ramp lands here
    '0000000', // 4
    '0000000', // 5
    '0000000', // 6
    '0000000', // 7
    '0000000', // 8  S wall (band 0)
  ],
  props: [
    // The altar block on the dais + the visible treads resting on the ramp seam
    // (stair convention: the heightGrid carries the real rise, the `stairs` prop
    // is the read). The `stairs` GLB faces up the nave (treads ascending north).
    { kind: 'pillar', at: [1, 3] }, // the altar stone / reliquary, centred on the dais
    { kind: 'stairs', at: [3, 3], rotY: Math.PI }, // treads up onto the dais
    // Pew rows — crate props re-dressed as benches, flanking the central aisle
    // (col 3 stays clear so the walk to the altar is unobstructed).
    { kind: 'crate', at: [4, 1], rotY: 0.05 },
    { kind: 'crate', at: [5, 1], rotY: -0.05 },
    { kind: 'crate', at: [6, 1], rotY: 0.05 },
    { kind: 'crate', at: [4, 5], rotY: -0.05 },
    { kind: 'crate', at: [5, 5], rotY: 0.05 },
    { kind: 'crate', at: [6, 5], rotY: -0.05 },
    // A little devotional decay: a fallen kneeling figure by the west pews.
    { kind: 'rubble', at: [5, 2], rotY: 0.8 },
  ],
  // The interior wall-torches carry the light; no v1 braziers (lights stays empty,
  // well inside the ≤4 budget).
  lights: [],
  // Three wall-torches (interior kit): two flanking the altar dais, one at the
  // entrance — pools of safety over the kneel and the way out.
  torches: [
    { at: [2, 1] }, // W wall, altar dais
    { at: [2, 5] }, // E wall, altar dais
    { at: [7, 1] }, // W wall, entrance
  ],
  enemies: [
    // The kneeler at the altar: a Kneeling Hollow knelt in false prayer, DORMANT
    // until your brand pulses within its aggro — then it rises. The chapel's one
    // resident menace (the barracks keeps a soldier; the chapel keeps a suppliant).
    { kind: 'kneeler', at: [2, 3] },
  ],
  // Inscriptions (Act II — Queen Maren's last vigil). Text resolves by id in lore.ts.
  lore: [
    { id: 'act2-chapel-a', at: [1, 2] }, // on the altar dais, beside the kneeler
    { id: 'act2-chapel-b', at: [5, 3] }, // the chancel stone in the aisle
  ],
  doors: [
    // Out onto the Ramparts — the paired other end of the ramparts' new gate '3'.
    // Unlocked; the 'Chapel Door' decoration is declared HERE (one side per edge),
    // so the ramparts render the same door automatically.
    { id: 'chapel-to-ramparts', at: [8, 3], to: 'ramparts', pair: 'chapel-ramparts' },
  ],
  gateDoors: [{ gate: '3', label: 'Chapel Door' }],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  ambientFloor: 0.1,
  dreadInterior: true,
  ngPlus: {
    // The Second Vigil sets a wraith among the pews with the kneeling hollow.
    enemies: [
      { kind: 'kneeler', at: [2, 3] },
      { kind: 'wraith', at: [4, 3] },
    ],
  },
};
