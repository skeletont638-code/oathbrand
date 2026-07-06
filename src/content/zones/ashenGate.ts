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
    '2..........#',
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
    // Skyline sweep (World Expansion v1.2, Task 10): a broken great-keep on the
    // far-WEST horizon of the reveal — a dead stronghold behind the ruin cluster,
    // deepening the "dead kingdom" read the vista opens. OFF-GRID at [-7,-1]
    // (world x=-1, z=-13): far west of the torii CENTRE (col 3, the reveal's
    // subject) and DEEP behind the mid-ground cluster (rows -2..-5), so it frames
    // the composition on the flank without competing with the centred torii — a
    // distant silhouette, ~16 m out (inside the vista-swelled 28 m plane, hidden
    // at the 12 m baseline). ~48-tri procedural masonry shell (1 draw call;
    // PROCEDURAL_PROPS 'keep-shell'). Unreachable set-dressing (out-of-bounds is
    // solid), like the torii/statue/stair skyline it joins.
    { kind: 'keep-shell', at: [-7, -1], rotY: 0.5 },
  ],
  lights: [
    // A lone ember burning deep among the ruins beyond the wall — the
    // reveal's warm accent (backdrop cell; lights pass through walls, no
    // shadow maps). T20 exposure pass: moved from [-2,2] (west of the torii,
    // where its highlight clipped at the left edge of the 9:16 README crop and
    // left the east silhouettes near-black) to [-3,5] — central among the
    // torii/stair/statue cluster so it grazes ALL three and reads as a distant
    // glow, not a hot blob; intensity trimmed 8→5.5 so the point never blows
    // out to a hard highlight in the README hero (checked in the vista capture).
    { at: [-3, 5], intensity: 5.5, color: 0xff8a3c },
    { at: [5, 8] }, // ruin's east face — front-lights the banner from the south
    { at: [7, 4] }, // south wall, west of the gate
    // T14: a low torch on the west wall by the Ash-Priest [3,2] so he reads at
    // the gate (the west court was too dark to make him out — T13 re-shoot
    // obligation). Replaces the redundant east-gate flank ([7,7]) to keep the
    // 4-light budget; [7,4] still lights the gate.
    { at: [3, 1] },
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
  // Inscriptions (Task 13). Text resolves by id in src/content/lore.ts.
  lore: [
    { id: 'gate-plaque', at: [6, 5] }, // the checkpoint plaque by the ruin
    { id: 'herald-corpse', at: [5, 6] }, // the dead herald in the watch-post
    { id: 'torii-lintel', at: [1, 9] }, // north wall, gazing at the broken royal gate
    { id: 'gate-ash', at: [3, 8] }, // the ash that never settles
    { id: 'watchpost-ledger', at: [6, 6] }, // the muster-roll by the watch-post
  ],
  doors: [
    { id: 'gate-to-hall', at: [7, 5], to: 'great-hall', pair: 'gate-hall' },
    // Greater Vael Drop 1 (Task 9): the postern west out of the courtyard,
    // sealed until the castle is beaten (`greater-vael-open`). Its `2` anchor
    // sits at [6,0] on the west wall, well clear of the vista row and the
    // banner — pairs with the Gate Fields `gf-to-gate` postern.
    { id: 'gate-to-fields', at: [6, 0], to: 'gate-fields', lock: 'greatervael', pair: 'gate-fields-postern' },
  ],
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
  // T20 exposure pass: lift the ash-grey ambient floor (0.35 → 0.5) so the
  // vista's east silhouettes (statue/stair/rubble) read as shape rather than
  // near-black in the README GIF's 9:16 crop, and the opening courtyard reads
  // legibly as a first impression. Still well below interior light; the mood
  // is carried by the desaturated palette + PS1 filter, not crushed blacks.
  ambientFloor: 0.5,
  ngPlus: {
    // "3 soldiers, moved": one now stands IN the vista row — the reveal is
    // no longer safe; the others hold the west court and the watch-post.
    enemies: [
      { kind: 'soldier', at: [1, 5] },
      { kind: 'soldier', at: [6, 2] },
      { kind: 'soldier', at: [5, 6] },
    ],
    // Edda's true errand, read in the watch-post where her remains are no longer
    // to be found (paired with the 'gate-herald-gone' anomaly). T16 ngOnly.
    addedLore: [{ id: 'ng-edda-lie', at: [5, 5] }],
  },
};
