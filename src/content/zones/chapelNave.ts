/**
 * THE SUNKEN CHAPEL — NAVE (World Expansion v1.2, Task 7) — the second landscape
 * ruin: a half-collapsed wayside chapel in the Ashen Forest, entered off the
 * forest road through the `Chapel Door` (unlocked). A long, narrow nave: the
 * altar stands on a raised dais at the north end, pews run the aisle, the south
 * half of the roof has fallen in, and a broken stair (the `Crypt Stair`) drops
 * DOWN to the crypt beneath. Where the keep's chapel is where Queen Maren KNELT,
 * this is the wayside nave she WALKED — and the queen's-walk ECHO stages here
 * (Task 9), so the central aisle is kept clear for it.
 *
 * THE RAISED ALTAR (stair convention, mechanism A — zoneDef.ts): the dais (rows
 * 0–2) rides one band (heightGrid '1', 1.5 m) above the nave (band '0'); the
 * row2↔row3 seam auto-generates a walkable RAMP (buildHeightRamps classifies a
 * Δ1 walkable↔walkable seam as a slope, not a ledge), and a decorative `stairs`
 * prop rests on it as the visible treads. Collision stays the flat 2D grid (no
 * jump), so the rise is a look the camera glides up, not a barrier. Per the
 * wall-banding rule the dais's bounding walls (N wall + the col0/col6 sides of
 * rows 0–2) carry band '1' so their bases seat flush with the raised dais.
 *
 * THE ECHO AISLE (Task 9 reservation): the four contiguous aisle cells
 * [4,3],[5,3],[6,3],[7,3] (col 3, the walk from the entrance toward the altar
 * treads at [3,3]) are kept prop/enemy-free so the silent queen's-walk apparition
 * can pace them, altar to door and back.
 *
 * Interior kit (Task 2): `dreadInterior` opts the nave into the DreadDirector;
 * ambient stays low so the torches read as pools of safety. The kit's `torches`
 * are always lit (bracket + emissive flame + pooled cast light), so the "some
 * gone dark" read comes from TWO lit torches (`torches`, flanking the tended
 * altar) PLUS ONE unlit torch as a `props` entry — the bare `torch` kit bracket
 * (torch.glb is a bracket only; the flame/light are added by the interior kit),
 * placed against the wall at the collapsed south end with no flame and no light.
 * That is the kit's native no-light variant (a bracket without the kit's flame),
 * NOT a kit extension. Two Act-II inscriptions carry the queen's walk.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const CHAPEL_NAVE: ZoneDef = {
  id: 'chapel-nave',
  grid: [
    '#######', // 0  N wall (behind the altar) — banded with the dais (band 1)
    '#.....#', // 1  altar dais (raised, band 1) — altar block [1,3], lit torches [1,1]/[1,5]
    '#.....#', // 2  altar dais front — inscription [2,1], fallen debris [2,5]
    '#.....#', // 3  nave (band 0) — the ramp seam is row2↔row3; treads [3,3]
    '#.....#', // 4  nave — pews flank the aisle; ECHO aisle cell [4,3] (Task 9)
    '#.....#', // 5  nave — pews; ECHO aisle cell [5,3]
    '#.....#', // 6  nave — the collapse (rubble [6,1]/[6,5]); ECHO aisle cell [6,3]
    '#.....#', // 7  nave — pews; ECHO aisle cell [7,3]
    '#.....2', // 8  nave — unlit torch [8,1], chancel stone [8,3], Crypt Stair '2' [8,6] → chapel-crypt (DOWN)
    '#..S..#', // 9  entrance — spawn [9,3] (where the Chapel Door lands you)
    '###1###', // 10 S wall — Chapel Door '1' [10,3] → ashen-forest-n (unlocked)
  ],
  cell: 2,
  // The altar dais rides one band above the nave (mechanism A). The bounding
  // walls of rows 0–2 carry the dais's band '1' (wall-banding rule) so they seat
  // flush; the nave and its walls stay band '0'. The single Δ1 seam (row2↔row3)
  // is the walkable altar ramp; the Crypt Stair landing [8,6] + its entry [8,5]
  // stay flat band 0 (a landing is never sloped). No voids ⇒ no cliffs.
  heightGrid: [
    '1111111', // 0  N wall — banded with the altar dais it bounds
    '1111111', // 1  altar dais (band 1), side walls banded
    '1111111', // 2  altar dais front (band 1), side walls banded
    '0000000', // 3  nave (band 0) — the ramp lands here
    '0000000', // 4
    '0000000', // 5
    '0000000', // 6
    '0000000', // 7
    '0000000', // 8  Crypt Stair landing (flat)
    '0000000', // 9
    '0000000', // 10 S wall (band 0)
  ],
  tiles: {},
  props: [
    // The altar block on the dais + the visible treads resting on the ramp seam
    // (stair convention: the heightGrid carries the real rise, the `stairs` prop
    // is the read). The `stairs` GLB faces up the nave (treads ascending north).
    { kind: 'pillar', at: [1, 3] }, // the altar stone, centred on the dais
    { kind: 'stairs', at: [3, 3], rotY: Math.PI }, // treads up onto the dais
    // Pew rows — crate props re-dressed as benches, flanking the central aisle
    // (col 3 stays clear so the walk to the altar — and the Task-9 echo — is
    // unobstructed). Row 6 is left bare on both sides: the collapse gap.
    { kind: 'crate', at: [4, 1], rotY: 0.05 },
    { kind: 'crate', at: [5, 1], rotY: -0.05 },
    { kind: 'crate', at: [7, 1], rotY: 0.05 },
    { kind: 'crate', at: [4, 5], rotY: -0.05 },
    { kind: 'crate', at: [5, 5], rotY: 0.05 },
    { kind: 'crate', at: [7, 5], rotY: -0.05 },
    // The half-collapse: a fallen block by the dais and rubble where the roof
    // came down over the south pews (row 6).
    { kind: 'rubble', at: [2, 5], rotY: 0.8 },
    { kind: 'rubble', at: [6, 1], rotY: 1.3 },
    { kind: 'rubble', at: [6, 5], rotY: -0.6 },
    // The UNLIT torch: the bare `torch` kit bracket placed as a prop (no flame,
    // no light — the kit adds those only to `torches`), against the west wall at
    // the dark, collapsed south end. rotY ≈ +90° hangs the bracket arm into the
    // room off the W wall. The nave's "some gone dark" read without extending the kit.
    { kind: 'torch', at: [8, 1], rotY: Math.PI / 2 },
  ],
  // The interior wall-torches carry the light; no v1 braziers (lights empty, well
  // inside the ≤4 budget).
  lights: [],
  // Two LIT wall-torches (interior kit): flanking the altar dais — the pools of
  // safety over the still-tended north end. The south end is left dark (the unlit
  // bracket above) so the collapse reads as the light failing back from the altar.
  torches: [
    { at: [1, 1] }, // W wall, altar dais
    { at: [1, 5] }, // E wall, altar dais
  ],
  // No base enemies: the nave is the queen's-walk echo room; the menace is below,
  // in the crypt. The Second Vigil sets one wraith among the collapsed south pews.
  enemies: [],
  // Inscriptions (Act II — Queen Maren's walk). Text resolves by id in lore.ts.
  lore: [
    { id: 'act2-nave-a', at: [2, 1] }, // on the dais front, W side, by the altar
    { id: 'act2-nave-b', at: [8, 3] }, // the chancel/threshold stone in the aisle
  ],
  doors: [
    // Out onto the Ashen Forest road — the paired other end of the forest's new
    // gate '4' ('chapel-door'). Unlocked; the 'Chapel Door' decoration is declared
    // HERE (one side per edge), so the forest renders the same door automatically.
    { id: 'nave-to-forest', at: [10, 3], to: 'ashen-forest-n', pair: 'chapel-door' },
    // Down the broken stair to the crypt (chapelCrypt) — the paired other end of
    // the crypt's stairwell gate. Unlocked; the 'Crypt Stair' decoration is here.
    { id: 'nave-to-crypt', at: [8, 6], to: 'chapel-crypt', pair: 'chapel-crypt-stair' },
  ],
  gateDoors: [
    { gate: '1', label: 'Chapel Door' }, // the forest-road edge (unlocked)
    { gate: '2', label: 'Crypt Stair' }, // down to the crypt
  ],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  ambientFloor: 0.1,
  dreadInterior: true,
  ngPlus: {
    // The Second Vigil sets a wraith among the fallen south pews.
    enemies: [
      { kind: 'wraith', at: [8, 2] },
    ],
  },
};
