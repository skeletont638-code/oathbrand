/**
 * GATE FIELDS (Greater Vael Drop 1, Task 9) — the hub of the Fields, and the
 * FIRST real exterior zone. Reached through the Ashen Gate postern once the
 * castle is beaten (`greater-vael-open`); from here four roads leave — back to
 * the gate (N), the Cinder Village (W), the Ashen Forest (E), and down the
 * Pilgrim's Descent (S). The oath-oak stands dead-center (`TT`), the one tall
 * silhouette from every cell, the banner hung on its trunk (orbit archetype —
 * the oak is the single safe eye), an empty gibbet swinging under it.
 *
 * The zone teaches the drop's grammar without a single cheap shock: the
 * scarecrow-ward (a `kneeler` that stays INERT — GF-1 only spikes the silence
 * so you SEE it is a knelt knight) and the seeded false-pulse (GF-2 — the radar
 * throbs once over an empty crossing). One Watcher anchor sits beyond the E
 * tree-line gap, half-occluded by the oak — a quiet, gimmick-less sighting.
 *
 * Flat terrain (no `heightGrid`) — every enemy/prop/lore sits on h0, so the
 * v1 flat-2D placement is exact and the camera never lerps (Task 4 y-grounding
 * is a no-op here; deferred until a zone actually spawns on raised terrain).
 *
 * Grid is the authored layout from the Task-9 brief — copied VERBATIM (row 7
 * uses the corrected string so `B` sits at [7,7] beneath the oak and the `S`
 * spawn at [7,6]); do not "fix" it. The realism density pass (map-gaps §2) planted
 * four `,`→`t` sparse trunks ([2,4],[4,4],[10,11],[11,12]) for vertical relief in
 * the NW + SE dead quadrants — `t` stays walkable floor (no collision change) and
 * sits clear of the GF-3 eastward sightline and the GF-2 crossing spine.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const GATE_FIELDS: ZoneDef = {
  id: 'gate-fields',
  grid: [
    '#######11#######', // 0  N gate 11 [0,7],[0,8] → ashen-gate (postern)
    '#t,,,,,pp,,,,,t#', // 1
    '#,,,t,,pp,,,,,,#', // 2  +t NW dead-quadrant relief (realism density pass)
    '#,,,,t,pp,t,,,,#', // 3
    '#,,,t,pppp,,,,,#', // 4  +t NW dead-quadrant relief (realism density pass)
    '#,,,ppp..ppp,,,#', // 5
    '3pppp,.TT.,pppp2', // 6  W gate 3 [6,0]·E gate 2 [6,15]·TT oath-oak [6,7],[6,8]
    '#,,,ppSB.ppp,,,#', // 7  S spawn [7,6]·B banner [7,7]·[7,8] gibbet lore
    '#,,,,,pppp,,,,,#', // 8
    '#,,t,,,pp,,,t,,#', // 9
    '#,,,,,,pp,,t,,,#', // 10  +t SE dead-quadrant relief (realism density pass)
    '#t,,,,,pp,,,t,t#', // 11  +t SE dead-quadrant relief (realism density pass)
    '#,,,,,,pp,,,,,,#', // 12
    '#######44#######', // 13 S gate 44 [13,7],[13,8] → pilgrims-descent
  ],
  cell: 2,
  // `,` grass · `p` worn path · `t` sparse trunk · `T` dense oak (solid). '#'
  // border renders as the dense tree-line; '.' is bare floor (the clearing).
  tiles: { ',': 'floor', p: 'floor', t: 'floor', T: 'wall' },
  kind: 'exterior',
  exteriorSky: 'field',
  // Sparse ground clutter (Task 10): a few field-stones, a scatter of bones, and
  // two felled stumps near the tree-line — all on grass floor cells, clear of the
  // props/enemies/lore/banner. One InstancedMesh per kind; well inside SCATTER_CAP.
  scatter: [
    // Realism density pass (map-gaps §2 — gate-fields was the barren worst offender,
    // ~55–65% empty): raised 8 → 19. Field-stones/bones/stumps seeded into the dead
    // W/NW flank and the bare lower-centre so no 8 m sightline reads empty. All on
    // walkable grass/path floor, clear of every beat/anchor/banner/spawn/lore/enemy/
    // crossing cell (non-colliding instanced clutter; well inside SCATTER_CAP).
    { kind: 'stone', cells: [[1, 2], [2, 12], [10, 3], [12, 11], [2, 2], [5, 4], [8, 3], [11, 5], [4, 13], [8, 12]] },
    { kind: 'bones', cells: [[3, 2], [9, 10], [5, 10], [11, 8]] },
    { kind: 'stump', cells: [[3, 13], [12, 2], [2, 13], [9, 2], [12, 10]] },
  ],
  // fogFarM omitted → the 16 m exterior default. No fogCells: the field reads
  // open; GF-2's dread is the false-pulse, not a fog band.
  props: [
    // The oath-oak itself is the `TT` grid pair (rendered as a dense-tree pair
    // by the exterior builder), NOT a prop. The banner hangs flush on its trunk.
    // The empty gibbet under the oak: an original procedural hanging iron cage
    // (rusted open — the `gv-field-gibbet` lore card), placed at [7,8] (the
    // gibbet lore cell, under the oak). Rendered as a standalone vertex-coloured
    // mesh by the ZoneBuilder's PROCEDURAL_PROPS hook — no kit GLB.
    { kind: 'gibbet', at: [7, 8], rotY: 0.2 },
    // The scarecrow-ward's two INERT kneeling figures (1 real `kneeler` : 2
    // props, the spec's 1:2–3 ratio; never the banner silhouette). statue-knight
    // is the kit's kneeling figure — knelt, cowled, hollow-still by the ward.
    { kind: 'statue-knight', at: [9, 5], rotY: -1.6 },
    { kind: 'statue-knight', at: [8, 4], rotY: 2.4 },
    // Scattered field debris on the plain floor.
    { kind: 'rubble', at: [3, 12], rotY: 0.7 },
    { kind: 'crate', at: [11, 2], rotY: -0.4 },
    { kind: 'crate', at: [12, 3], rotY: 0.9 },
    // Realism density pass: two landmark clusters break the two worst dead
    // sightlines the investigator flagged — the W flank (around [4,3]) and the bare
    // lower-centre (around [10,7]). Masonry debris, NOT more kneelers (the scarecrow-
    // ward's 1 real : 2 inert ratio is a teaching beat). All on walkable floor and
    // clear of the [9,3] ward + the [4,11]/[10,4] soldier spawns; props carry no
    // collider, so the field stays fully walkable.
    { kind: 'rubble', at: [4, 3], rotY: 1.3 },
    { kind: 'crate', at: [3, 4], rotY: -0.8 },
    { kind: 'rubble', at: [10, 7], rotY: 0.5 },
    { kind: 'crate', at: [11, 9], rotY: -1.2 },
  ],
  // No torches: an open field under the sky/moon backdrop, lit by the lifted
  // ash-grey ambient. Zero dynamic lights — well inside the ≤4 budget.
  lights: [],
  enemies: [
    // Two v1-staple soldiers hold the field flanks (all on flat h0 floor).
    { kind: 'soldier', at: [4, 11] },
    { kind: 'soldier', at: [10, 4] },
    // The scarecrow-ward: a Kneeling Hollow, DORMANT until a real brand pulse
    // near it. GF-1 does NOT wake it — it only spikes the silence so you read
    // the straw ward for the knelt knight it is (the pure teaching beat).
    { kind: 'kneeler', at: [9, 3] },
  ],
  banner: { at: [7, 7], name: 'Banner of the Owed Field' },
  lore: [
    { id: 'gv-field-boundary-stone', at: [2, 3] }, // the tallied march-stone
    { id: 'gv-field-scarecrow-ward', at: [9, 4] }, // beside the knelt ward
    { id: 'gv-field-childs-shoe', at: [1, 1] }, // NW secret
    { id: 'gv-field-gibbet', at: [7, 8] }, // under the oak
    { id: 'gv-field-tithe-post', at: [12, 7] }, // SE breadcrumb toward the descent
  ],
  doors: [
    { id: 'gf-to-gate', at: [0, 7], to: 'ashen-gate', lock: 'greatervael', pair: 'gate-fields-postern' },
    { id: 'gf-to-village', at: [6, 0], to: 'cinder-village', pair: 'gf-village' },
    { id: 'gf-to-forest', at: [6, 15], to: 'ashen-forest-n', pair: 'gf-forest' },
    { id: 'gf-to-descent', at: [13, 7], to: 'pilgrims-descent', pair: 'gf-descent' },
  ],
  ambience: ['amb-field-wind', 'amb-tithe-toll'],
  // Open night: lift the ash-grey ambient floor so the field + tree-line read
  // as shape rather than void (the ashen-gate's 0.5 is a walled court; the open
  // field wants a touch more).
  ambientFloor: 0.6,
  scares: [
    // GF-1: the silence-spike as you near the ward — the field goes dead-quiet
    // for a breath so you SEE the straw ward is a knelt knight. It stays inert.
    { id: 'GF-1', zone: 'gate-fields', trigger: { on: 'approach', at: [9, 3], withinM: 3 }, gimmick: 'silence-spike', oneLine: 'The straw ward is a kneeling knight.' },
    // GF-2: one hard brand-pulse + heartbeat over the empty clearing cross, on
    // the per-run-seeded crossing — the radar throbs once with nothing there.
    { id: 'GF-2', zone: 'gate-fields', trigger: { on: 'seededClearing', cells: [[6, 6], [7, 6], [6, 9], [7, 9]] }, gimmick: 'false-pulse', oneLine: 'The radar throbs once in the empty field.' },
    // GF-3 (finding 2): the zone's QUIET Watcher sighting (no screen gimmick) —
    // a distant tall silhouette in the E tree-line gap, beyond the far-plane,
    // gone when neared. Fires on the north-central arrival from the postern
    // (spec §3.1 "first look toward the E treeline gap"). Trigger cells sit in the
    // NW arrival band: ≥16 m from the [6,16] anchor so the sighting manifests
    // (rule 10), AND clear of both field soldiers' 9 m aggro ([4,11], [10,4]) so
    // `inCombat` never suppresses it. One of the drop's 4 Watcher sightings.
    { id: 'GF-3', zone: 'gate-fields', trigger: { on: 'cellEnter', cells: [[1, 6], [1, 7], [2, 5], [2, 6]] }, gimmick: null, showsWatcher: true, oneLine: 'A tall shape stands in the treeline gap, and is gone when you look again.' },
  ],
  // Beyond the E tree-line gap: distant, static, half-occluded by the oak — GF-3
  // manifests the Watcher here. Off-grid backdrop coord, ≥16 m from every GF-3
  // trigger cell. Kept KEYED BY ZONE by the run-scoped DreadDirector.
  watcherAnchors: [[6, 16]],
};
