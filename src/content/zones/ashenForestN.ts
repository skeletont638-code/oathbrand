/**
 * ASHEN FOREST N (Greater Vael Drop 1, Task 10) — the "audio-leads" forest and
 * the Ash-Hound's showcase. Reached from the Gate Fields hub down the E road
 * (`gf-forest`); the forest DEAD-ENDS at the fog-line, so this single spoke
 * door is the only way in or out. A sparse west road (cols 1–6, `t`/`.`) ramps
 * into a dense stand (cols 8–13, `T`) whose occlusion converges the sightline
 * toward ~13 m — where the 12 m brand pulse and the Hounds' 13 m aggro meet, so
 * the pant you HEAR circling arrives before the shape you SEE (no `fogCells`:
 * the treeline itself is the fog band, and each dense cell muffles the voice).
 *
 * It carries the drop's hero Watcher beat (AF-2) and the Hag's first real
 * threshold: her carved cairn at [8,9], at the road's end on the fog-line. The
 * three scares teach that a silhouette is a genuine warning — AF-1 is a pure
 * visual (a tall shape crosses between the trunks, gone if neared) that a real
 * Hound answers ~4 s later; AF-2 stutters the world while the tall watcher holds
 * beyond the far-plane; AF-3 is the desat stab as the Hag turns and recedes.
 *
 * Flat terrain (no `heightGrid`) — every spawn/prop/lore sits on h0, so the v1
 * flat-2D placement is exact and the camera never lerps. Zero dynamic lights (a
 * forest under the sky/moon backdrop, lit by the ash-grey ambient) — well inside
 * the ≤4-light budget, and the instanced trunks/pines hold one draw call each.
 *
 * Grid is the authored layout from the Task-10 brief — copied VERBATIM (row 2
 * bakes the required `S` spawn at [2,2]); do not "fix" it.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const ASHEN_FOREST_N: ZoneDef = {
  id: 'ashen-forest-n',
  grid: [
    '###############', // 0
    '3ppt..t..tTtTT#', // 1  W door 3 [1,0] → gate-fields (pair 'gf-forest')
    '#.Spt.t.tTTTTT#', // 2  S spawn [2,2] (plain floor, the west road)
    '#t.pp.t.T.tTTT#', // 3
    '#.t.pptt.TT.TT#', // 4
    '#tt.tpBpt.TtTT#', // 5  B banner [5,6], at the density transition
    '#.t..ppptTTtTT#', // 6
    '#t.tt..ppTtT.T#', // 7
    '#..t.tt.ppTTTT#', // 8  Hag cairn [8,9]; the road's end at the fog-line
    '#t.tt.t..ptTTT#', // 9
    '###############', // 10
  ],
  cell: 2,
  // `t` sparse trunk (walkable, the west road), `p` worn path, `T` dense stand
  // (solid — the fog-line thicket). '#' border renders as the deep treeline; '.'
  // is bare forest floor.
  tiles: { t: 'floor', T: 'wall', p: 'floor' },
  kind: 'exterior',
  exteriorSky: 'forest',
  // No fogFarM override → the 16 m exterior default; the dense-column occlusion
  // does the tightening (Step 2). No fogCells: the treeline IS the band, and its
  // per-cell muffle is the audio tell that keeps the 13 m Hound aggro fair.
  props: [],
  // A forest under the sky/moon backdrop — lit by the lifted ash-grey ambient,
  // zero dynamic lights (the instancing stress zone stays at 0 of the ≤4 budget).
  lights: [],
  enemies: [
    // The Ash-Hound showcase — TWO hounds, no v1 staples. One circles at the
    // dense-fog edge, one flanks from the deep stand; both on flat h0 floor.
    { kind: 'hound', at: [6, 8] }, // circles at the dense-fog edge (the `t` at the edge)
    { kind: 'hound', at: [9, 10] }, // flanks from the deep trees (a `t` among the dense stand)
  ],
  banner: { at: [5, 6], name: 'Banner at the Fog-Line' },
  lore: [
    { id: 'gv-forest-fogline', at: [5, 5] }, // the `p` band at the transition
    { id: 'gv-forest-hag-cairn', at: [8, 9] }, // the cairn itself (the threshold cell)
    { id: 'gv-forest-sold-brand', at: [9, 1] }, // off-path, the branded bark
    { id: 'gv-forest-hound-kennels', at: [7, 2] }, // the loosed kennels
    { id: 'gv-forest-watcher-note', at: [3, 1] }, // the scratched line (off-path secret)
  ],
  doors: [
    // The single spoke door — the forest dead-ends at the fog-line / Hag cairn.
    { id: 'af-to-fields', at: [1, 0], to: 'gate-fields', pair: 'gf-forest' },
  ],
  ambience: ['amb-forest-hush', 'amb-forest-wrong'],
  scares: [
    // AF-1: pure-visual (no screen gimmick) — a tall shape crosses between two
    // dense-tree cells at the fog's edge, gone if looked at / approached. Teaches
    // that a silhouette is a genuine warning: a real Hound begins circling ~4 s later.
    // `crossing` = the two endpoints the silhouette lerps between, downrange at
    // the fog's edge (col 8, the density transition just east of the [4,5]
    // trigger): it emerges from the dense [3,8] clump, crosses the road corridor
    // N→S in the player's sightline, and vanishes past [7,8], then despawns
    // (finding 4a). Sited at the transition (not deep in the col-10 stand) so it
    // reads across the open road rather than being buried behind dense trunks.
    { id: 'AF-1', zone: 'ashen-forest-n', trigger: { on: 'cellEnter', cells: [[4, 5]] }, gimmick: null, crossing: [[3, 8], [7, 8]], oneLine: 'Something crosses between the trees, downrange.' },
    // AF-2: the drop's hero Watcher beat — the world stutters (snap-grid) while
    // the tall watcher holds beyond the far-plane, gone when neared.
    { id: 'AF-2', zone: 'ashen-forest-n', trigger: { on: 'cellEnter', cells: [[6, 7]] }, gimmick: 'snap-grid', showsWatcher: true, oneLine: 'The tall watcher, and the world stutters around it.' },
    // AF-3: the desat stab as the Hag turns and recedes at the fog-line (also
    // glimpses the Hag — the 2.5 m woman-shape turns and is gone when you near her).
    { id: 'AF-3', zone: 'ashen-forest-n', trigger: { on: 'approach', at: [8, 9], withinM: 4 }, gimmick: 'desaturation', oneLine: 'A woman, wrong-tall, gone when you near her.' },
  ],
  // Off-grid backdrop beyond the dense treeline, past the far-plane (AF-2's
  // manifest anchor). Kept KEYED BY ZONE by the run-scoped DreadDirector.
  watcherAnchors: [[6, 15]],
  // The Hag-of-the-Fog-Line threshold: her cairn at the road's end, glimpsed as
  // you cross the `p` approach cells toward it. The OFFER bargain (Task 5) arms here.
  hagThreshold: { at: [8, 9], glimpseCells: [[6, 6], [7, 7], [8, 8]] },
};
