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
 * spawn at [7,6]); do not "fix" it.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const GATE_FIELDS: ZoneDef = {
  id: 'gate-fields',
  grid: [
    '#######11#######', // 0  N gate 11 [0,7],[0,8] → ashen-gate (postern)
    '#t,,,,,pp,,,,,t#', // 1
    '#,,,,,,pp,,,,,,#', // 2
    '#,,,,t,pp,t,,,,#', // 3
    '#,,,,,pppp,,,,,#', // 4
    '#,,,ppp..ppp,,,#', // 5
    '3pppp,.TT.,pppp2', // 6  W gate 3 [6,0]·E gate 2 [6,15]·TT oath-oak [6,7],[6,8]
    '#,,,ppSB.ppp,,,#', // 7  S spawn [7,6]·B banner [7,7]·[7,8] gibbet lore
    '#,,,,,pppp,,,,,#', // 8
    '#,,t,,,pp,,,t,,#', // 9
    '#,,,,,,pp,,,,,,#', // 10
    '#t,,,,,pp,,,,,t#', // 11
    '#,,,,,,pp,,,,,,#', // 12
    '#######44#######', // 13 S gate 44 [13,7],[13,8] → pilgrims-descent
  ],
  cell: 2,
  // `,` grass · `p` worn path · `t` sparse trunk · `T` dense oak (solid). '#'
  // border renders as the dense tree-line; '.' is bare floor (the clearing).
  tiles: { ',': 'floor', p: 'floor', t: 'floor', T: 'wall' },
  kind: 'exterior',
  exteriorSky: 'field',
  // fogFarM omitted → the 16 m exterior default. No fogCells: the field reads
  // open; GF-2's dread is the false-pulse, not a fog band.
  props: [
    // The oath-oak itself is the `TT` grid pair (rendered as a dense-tree pair
    // by the exterior builder), NOT a prop. The banner hangs flush on its trunk.
    // The empty gibbet under the oak: the kit has no `gibbet` GLB, so a `pillar`
    // stands in as the gibbet's post at [7,8] (the gibbet lore cell, under the
    // oak) — a future art pass can drop a cage mesh behind this same placement.
    { kind: 'pillar', at: [7, 8], rotY: 0.2 },
    // The scarecrow-ward's two INERT kneeling figures (1 real `kneeler` : 2
    // props, the spec's 1:2–3 ratio; never the banner silhouette). statue-knight
    // is the kit's kneeling figure — knelt, cowled, hollow-still by the ward.
    { kind: 'statue-knight', at: [9, 5], rotY: -1.6 },
    { kind: 'statue-knight', at: [8, 4], rotY: 2.4 },
    // Scattered field debris on the plain floor.
    { kind: 'rubble', at: [3, 12], rotY: 0.7 },
    { kind: 'crate', at: [11, 2], rotY: -0.4 },
    { kind: 'crate', at: [12, 3], rotY: 0.9 },
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
    // gone when neared. Fires on the north-central descent from the postern
    // (spec §3.1 "first look toward the E treeline gap"); every trigger cell is
    // ≥16 m from the [6,16] anchor so the sighting manifests (DreadDirector rule
    // 10). One of the drop's 4 Watcher sightings (spec §5).
    { id: 'GF-3', zone: 'gate-fields', trigger: { on: 'cellEnter', cells: [[3, 6], [3, 7], [4, 7], [4, 8]] }, gimmick: null, showsWatcher: true, oneLine: 'A tall shape stands in the treeline gap, and is gone when you look again.' },
  ],
  // Beyond the E tree-line gap: distant, static, half-occluded by the oak — GF-3
  // manifests the Watcher here. Off-grid backdrop coord, ≥16 m from every GF-3
  // trigger cell. Kept KEYED BY ZONE by the run-scoped DreadDirector.
  watcherAnchors: [[6, 16]],
};
