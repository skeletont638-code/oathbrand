/**
 * Zone 1 — THE ASHEN GATE (Task 11). Outer courtyard of the dead kingdom:
 * the player wakes here (S), meets the first inscription, the first banner,
 * and the game's signature shot — the scripted vista reveal (spec §9 clip
 * #1) on first stepping into the northern row. A ruined watch-post squats
 * mid-court (the herald's corpse inside, a hollow soldier over it) and the
 * double gate `11` on the south wall line leads into the Great Hall.
 *
 * Grid is the authored layout from the plan — copied VERBATIM; do not
 * "fix" it. Annotations honored: doors 1→great-hall · lore gate-plaque +
 * herald-corpse · 2 soldiers (NG+: 3, moved) · vista at row 1 cols 3–8.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const ASHEN_GATE: ZoneDef = {
  id: 'ashen-gate',
  grid: [
    '############',
    '#..........#',
    '#..S....B..#',
    '#..........#',
    '#...####...#',
    '#...#..#...#',
    '#..........#',
    '#....11....#',
    '############',
  ],
  cell: 2,
  tiles: {},
  props: [
    // The banner cell [2,8] has no adjacent wall — a freestanding pillar in
    // the cell behind it gives the checkpoint its post (eyeballed in-game).
    { kind: 'pillar', at: [1, 8] },
    { kind: 'crate', at: [6, 1], rotY: 0.42 },
    { kind: 'crate', at: [3, 9], rotY: -0.31 },
    // --- the ruined kingdom skyline (vista backdrop, spec §9 clip #1) ---
    // Negative rows sit BEYOND the north wall: unreachable set-dressing
    // (out-of-bounds is solid to the collider), ash-veiled at the 12m fog
    // baseline and revealed when the vista swells the far plane to 28.
    // (torii sits on col 3 — dead ahead of the natural walk line from S, so
    // the reveal centers on it even in a 9:16 phone crop; at 10m it hides
    // beyond the 12m fog baseline until the vista opens the far plane.)
    { kind: 'torii', at: [-4, 3], rotY: 0.06 }, // broken royal gate, center of the reveal
    { kind: 'stairs', at: [-5, 5], rotY: 0.3 }, // a stair climbing to nothing, deep in the ash
    { kind: 'statue-knight', at: [-2, 7], rotY: 2.8 },
    { kind: 'pillar', at: [-2, 0] },
    { kind: 'pillar', at: [-4, 6], rotY: 0.9 },
    { kind: 'rubble', at: [-3, 9], rotY: 1.7 },
  ],
  lights: [
    // A lone ember burning among the ruins beyond the wall — the reveal's
    // warm accent (backdrop cell; lights pass through walls, no shadow
    // maps, so it also pools faintly over the parapet).
    { at: [-2, 2] },
    { at: [5, 8] }, // ruin's east face — front-lights the banner from the south
    { at: [7, 4] }, // south wall, west of the gate
    { at: [7, 7] }, // south wall, east of the gate
  ],
  enemies: [
    // Gate guard: far enough from S and the vista row to leave the reveal
    // and the banner tutorial unbothered; aggros on the approach south.
    { kind: 'soldier', at: [7, 2] },
    // Watch-post ambusher: walls block line of sight until the player
    // rounds the ruin for the herald's corpse.
    { kind: 'soldier', at: [5, 5] },
  ],
  banner: { at: [2, 8], name: 'Banner of the Vigil' },
  lore: [
    {
      id: 'gate-plaque',
      at: [6, 5],
      text: 'THE ASHEN GATE. Kneel, keeper of the brand. The kingdom you swore to is behind you; what kept the oath is ahead.',
    },
    {
      id: 'herald-corpse',
      at: [5, 6],
      text: 'A herald, years dead, his scroll-case fused to his ribs. The seal is the queen’s. The wax was never broken.',
    },
  ],
  doors: [{ id: 'gate-to-hall', at: [7, 5], to: 'great-hall', pair: 'gate-hall' }],
  ambience: ['amb-ash-wind', 'amb-vigil-synth'],
  // Clip #1: first entry to the northern row — fog opens 12→28, camera
  // lifts over the parapet (VistaDirector). Row 1, cols 3–8 per the plan.
  vista: {
    id: 'vista-ashen-gate',
    cells: [
      [1, 3],
      [1, 4],
      [1, 5],
      [1, 6],
      [1, 7],
      [1, 8],
    ],
  },
  fogFarM: 12, // outdoor ash-haze baseline; the vista swells it to 28
  ngPlus: {
    // "3 soldiers, moved": one now stands IN the vista row — the reveal is
    // no longer safe; the others hold the west court and the watch-post.
    enemies: [
      { kind: 'soldier', at: [1, 5] },
      { kind: 'soldier', at: [6, 2] },
      { kind: 'soldier', at: [5, 6] },
    ],
  },
};
