/**
 * CINDER VILLAGE (Greater Vael Drop 1, Task 11) — the tithe's ground truth and
 * the Kneeling Hollow's home. Reached from the Gate Fields hub down the W road
 * (`gf-village`); a corridor-network wearing an outdoor skin — `H` ruin
 * house-blocks break every sightline, and one long exposure street (row 4) is
 * the spine, with the alleys of rows 1–3 / 5–7 hiding the finds. The signature
 * dread here is the frozen flagellant procession: three Kneeling Hollow
 * presences set along the street, of which EXACTLY ONE is a live `kneeler`
 * (at [4,9]) and TWO are permanently-inert statue-knight props (at [4,3],
 * [4,11]) — statuary until CV-1's brand-pulse beat wakes the single real one,
 * teaching which kneelers are counting you back.
 *
 * The zone produces the surrenderable `tithe-ledger` (a burned hearth-room
 * alley at [3,3]), the Hag's ledger-bargain input (Task 5): carry it to her
 * cairn in the Ashen Forest N and the LEDGER offer clears the flag and plays
 * `gv-vision-hag`. An `archer` holds the collector's house ([5,11]), firing
 * across the exposure street — its 14 m aggro sits inside the 16 m exterior
 * fog, so the shot is always fair (no fogCells; the `H` blocks are the band,
 * and `amb-cinder-knock` is the audio tell that keeps the street honest).
 *
 * Flat terrain (no `heightGrid`) — every spawn/prop/lore sits on h0, so the v1
 * flat-2D placement is exact and the camera never lerps. Zero dynamic lights
 * (a ruined village under the field sky/moon backdrop, lit by the ash-grey
 * ambient) — well inside the ≤4-light budget.
 *
 * Grid is the authored layout from the Task-11 brief — copied VERBATIM; do not
 * "fix" it. `w` is the curdled-well floor [1,8]; `D` is the sealed east arch
 * [4,14] into the Drop-2 salt-road (a `greatervael` lock it reads as sealed
 * set-dressing — the target lives in FUTURE_ZONE_IDS).
 */
import type { ZoneDef } from '../../world/zoneDef';

export const CINDER_VILLAGE: ZoneDef = {
  id: 'cinder-village',
  grid: [
    '###HHHHHHHHH###', // 0
    '#..H..H.wH.H..#', // 1  `w` = curdled well [1,8]
    '#.HHH.H.H.HHH.#', // 2
    '#....A.H.A....#', // 3  door-void houses [3,5]/[3,9] frame the plaza · tithe-ledger + salt-line + collector-house alleys
    '3SpppppBppppppD', // 4  W door 3 [4,0]→gate-fields (pair gf-village)·S spawn [4,1]·B banner [4,7]·D sealed east arch [4,14]→salt-road
    '#....A.H.A....#', // 5  door-void houses [5,5]/[5,9] frame the plaza · archer on the collector-house floor [5,11]
    '#.HHH.H.H.HHH.#', // 6
    '#..H..H..H.H..#', // 7
    '###HHHHHHHHH###', // 8
  ],
  cell: 2,
  // `H` renders as a `wall.glb` ruin house-block (the exterior builder stamps it
  // like a castle wall); `A` is a `wall-arch.glb` door-void house-block (Task 9 —
  // a burnt home with a gaping doorway; same atlas → same merge bucket, solid for
  // collision like `H` via the fail-closed rule); `p` is the worn exposure street;
  // `w` is the curdled well's floor tile. '#' border is the deep treeline that
  // rings the village; '.' is the bare alley floor. Every H/A block gets a charred
  // roof-wedge cap (one InstancedMesh).
  tiles: { H: 'wall', p: 'floor', w: 'floor' },
  kind: 'exterior',
  exteriorSky: 'field',
  // No fogFarM override → the 16 m exterior default; the `H` house-blocks do the
  // sightline-tightening. No fogCells: the ruin corridors ARE the band, and the
  // per-cell knock (amb-cinder-knock) is the audio tell that keeps the archer's
  // 14 m aggro fair inside the 16 m fog.
  props: [
    // The frozen procession's two PERMANENTLY-INERT presences — statue-knight is
    // the kit's kneeling figure (knelt, cowled, hollow-still). They flank the
    // live kneeler at [4,9] and NEVER rise (1 real : 2 props); the checkpoint-
    // banner kneel silhouette is never used as a Hollow here.
    { kind: 'statue-knight', at: [4, 3], rotY: 1.6 },
    { kind: 'statue-knight', at: [4, 11], rotY: 1.6 },
  ],
  // A ruined village under the field sky/moon backdrop — lit by the lifted
  // ash-grey ambient, zero dynamic lights (0 of the ≤4-light budget).
  lights: [],
  enemies: [
    // The one LIVE kneeler in the frozen procession — dormant statuary until
    // CV-1's brand-pulse beat calls wake() on it (main.ts routeScare); the two
    // statue-knight props never move, so the rise teaches which kneelers are real.
    { kind: 'kneeler', at: [4, 9] },
    // The collector's-house archer, firing across the exposure street from the
    // interior floor [5,11] — its 14 m aggro sits inside the 16 m exterior fog.
    // (The brief's [2,12] is an `H` wall an enemy can't stand on; [5,11] is the
    // adjacent room floor, same tactical role.)
    { kind: 'archer', at: [5, 11] },
  ],
  banner: { at: [4, 7], name: 'Banner of the Cinder Plaza' },
  lore: [
    { id: 'gv-village-tithe-ledger', at: [3, 3] }, // the carried ledger's read (the item lies one cell east at [3,4])
    { id: 'gv-village-salt-line', at: [3, 1] }, // an alley threshold, the ward scuffed through
    { id: 'gv-village-collector-house', at: [3, 11] }, // ward-marks scraped off the collector's door
    { id: 'gv-village-well', at: [1, 8] }, // the curdled well (`w`→floor)
    { id: 'gv-village-procession', at: [4, 5] }, // the kneeling line worn into the street
  ],
  items: [
    // The surrenderable tithe-ledger, in the same burned hearth-room alley as its
    // read. Taking it sets `tithe-ledger` and surfaces its inscription; the Hag's
    // LEDGER bargain (Task 5, at the Ashen Forest N cairn) clears the flag + plays
    // gv-vision-hag. Placed at [3,4] — one cell east of the `gv-village-tithe-
    // ledger` LoreSpot's [3,3] — because the Interactor breaks a distance tie by
    // array order (lore READ is collected before item TAKE), so a co-located item
    // would have its TAKE prompt permanently shadowed by the READ and be unpickable
    // (the v1 undercroft separates the Gatekey from its plinth-lore for the same
    // reason). Same alley, plain floor; the pickup surfaces the identical inscription.
    {
      id: 'tithe-ledger',
      at: [3, 4],
      flag: 'tithe-ledger',
      card: 'Its spine cracks open to this page. A column of names down the left, a column of embers owed down the right, and the right column only ever grows. The last entry is a woman’s name, and the sum beside it is not a number — it is one word, pressed so hard the nib tore through: ALL.',
    },
  ],
  doors: [
    // W road back to the Gate Fields hub — the paired other end of `gf-village`.
    { id: 'cv-to-fields', at: [4, 0], to: 'gate-fields', pair: 'gf-village' },
    // The sealed east arch into the Drop-2 salt-road. Its `greatervael` lock is
    // satisfiable, but the target is authored-but-unbuilt (FUTURE_ZONE_IDS), so
    // it reads as a sealed arch — never a live transition this drop.
    { id: 'cv-to-saltroad', at: [4, 14], to: 'salt-road', lock: 'greatervael' },
  ],
  ambience: ['amb-cinder-wind', 'amb-cinder-knock'],
  // The field sky's open ambient floor (matches the Gate Fields field sibling) so
  // the street + ruin-blocks read as shape rather than void.
  ambientFloor: 0.6,
  scares: [
    // CV-1: the silence-spike as a real brand pulse reaches the live kneeler —
    // main.ts wakes the [4,9] kneeler on this beat (the two props stay kneeling),
    // so the frozen procession reveals which of its statues is counting you.
    { id: 'CV-1', zone: 'cinder-village', trigger: { on: 'brandPulse', at: [4, 9], withinM: 3 }, gimmick: 'silence-spike', oneLine: 'The frozen procession — one of them rises.' },
    // CV-2: the resolution-drop garnishes the diegetic guttering — the lit
    // windows die in sequence toward the player, ending near-dark, telegraphing
    // the plaza kneeler + the collector's-house archer.
    { id: 'CV-2', zone: 'cinder-village', trigger: { on: 'cellEnter', cells: [[4, 5]] }, gimmick: 'resolution-drop', oneLine: 'The lights go out one by one, toward you.' },
    // CV-3: a pure-visual beat (no combat) — the curdled well reads subtly wrong,
    // a name scratched shaking into the coping, blaming "her", never confirmed.
    { id: 'CV-3', zone: 'cinder-village', trigger: { on: 'approach', at: [1, 8], withinM: 3 }, gimmick: null, oneLine: 'The well-water has gone wrong; a name, scratched shaking.' },
    // CV-4 (finding 2): the QUIET rooftop Watcher sighting (no screen gimmick) —
    // a tall silhouette on the roofline by the sealed east arch, gone when the
    // player reaches it (spec §3.3). Fires from the west end of the exposure
    // street (right off the spawn): every trigger cell is ≥16 m from the [2,12]
    // roof anchor so the sighting manifests (rule 10), and clear of the
    // collector-house archer's 14 m aggro at [5,11]. One of the drop's 4 sightings.
    { id: 'CV-4', zone: 'cinder-village', trigger: { on: 'cellEnter', cells: [[4, 2], [4, 3]] }, gimmick: null, showsWatcher: true, oneLine: 'On the rooftops by the sealed arch, the tall watcher — gone when you reach it.' },
  ],
  // On the roofline by the sealed east arch: the `H` house-block at [2,12], which
  // the player can never stand on (a wall cell) → unreachable. The 3rd tuple
  // element is the anchor's ELEVATION (2.0 m ≈ the ruin roofline), so the 3 m
  // silhouette breaks the roofs against the sky rather than sitting on the y=0
  // street occluded by the solid north wall (round 1's off-grid [-1,13] sat
  // BEHIND that wall → never seen). ≥16 m from CV-4's west-street trigger cells
  // (rule 10). Kept KEYED BY ZONE by the run-scoped DreadDirector.
  watcherAnchors: [[2, 12, 2.0]],
};
