/**
 * PILGRIM'S DESCENT (Greater Vael Drop 1, Task 12) — the drop's TERMINUS and the
 * exterior height layer's first full showcase. Reached from the Gate Fields hub
 * down the S road (`gf-descent`); a single serpentine switchback trail cut down
 * the face of a gorge, terracing from the top ledge (band 3) to the sealed
 * bottom (band 0). The `~` void IS the gorge — a fall off a switchback is the
 * existing void rule (ember loss + reset), no new code; the trail is a one-cell-
 * wide ribbon so the drop is always a step away.
 *
 * The signature moment is the vista terminus (PD-1, Clip #5 — the primary hero
 * shot): the first step onto the top ledge swells the fog 12→24 over the drowned
 * lands of Drop 2 AND, on the far cliff across the chasm, the Watcher stands
 * (`showsWatcher` rider), the snap-grid firing under the swell. PD-2 is the
 * unreachable set-dressing banner across the gorge that reads ablaze then ashen —
 * the player's OWN checkpoint banner at [7,10] is never spoofed (owner decision
 * 8: kneel-safety is sacred; kneeling there always works). Two hounds work the
 * switchbacks, where the void makes repositioning lethal.
 *
 * THE HEIGHT LAYER (this zone's reason to exist): `heightGrid` carries the band
 * digit on every walkable path cell (`~`/`#` carry 0); ramps auto-generate on the
 * three Δ1 seams (col10 row2→3, col1 row5→6, col10 row8→9) and the path-vs-void
 * Δ≥2 seams render the gorge cliff faces (buildHeightRamps, ZoneBuilder). The
 * builder y-offsets every floor tile, prop, torch, door and banner by
 * `cellHeightM`; the camera eases onto it (main.ts groundY); the enemy VIEWs and
 * the Ash-Priest are grounded on it too (main.ts), the flat 2D collider staying
 * authoritative for movement (no jump — the height is visual only).
 *
 * Grid + heightGrid are the authored layout from the Task-12 brief — copied
 * VERBATIM (row 1 bakes the `S` spawn at [1,1], the top ledge); do not "fix" it.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const PILGRIMS_DESCENT: ZoneDef = {
  id: 'pilgrims-descent',
  grid: [
    '#############', // 0
    '1Sppppppppp~#', // 1  N door 1 [1,0] → gate-fields (pair 'gf-descent') · S spawn [1,1]. Top ledge.
    '#~~~~~~~~~p~#', // 2  col10 path
    '#~~~~~~~~~p~#', // 3  col10 path
    '#pppppppppp~#', // 4  west run
    '#p~~~~~~~~~~#', // 5  col1 path
    '#p~~~~~~~~~~#', // 6  col1 path
    '#pppppppppB~#', // 7  B banner [7,10]
    '#~~~~~~~~~p~#', // 8  col10 path
    '#~~~~~~~~~p~#', // 9  col10 path
    '#pppp44pppp~#', // 10 `44` [10,5],[10,6] = sealed gate → salt-road (Drop 2). Bottom ledge.
    '#############', // 11
  ],
  cell: 2,
  // `p` is the worn switchback trail (the only walkable path); '#' border renders
  // as the gorge-wall / deep treeline, '~' is the open gorge (void — walkable for
  // collision, a fall = ember loss + reset). No zone letters beyond `p`.
  tiles: { p: 'floor' },
  kind: 'exterior',
  exteriorSky: 'gorge',
  // The terraced descent — same 13×12 dims as `grid`. Walkable path cells carry
  // the band digit; `~`/`#` carry 0. Ramps auto-generate on the three Δ1 seams
  // (row2→3, row5→6, row8→9); path-vs-void Δ≥2 renders the gorge cliff faces.
  heightGrid: [
    '0000000000000', // 0
    '3333333333300', // 1  band 3 (top ledge)
    '0000000000300', // 2  band 3 (col10 path)
    '0000000000200', // 3  band 2 (col10 path)
    '0222222222200', // 4  band 2 (west run)
    '0200000000000', // 5  band 2 (col1 path)
    '0100000000000', // 6  band 1 (col1 path)
    '0111111111100', // 7  band 1 (row7 + banner)
    '0000000000100', // 8  band 1 (col10 path)
    '0000000000000', // 9  band 0 (col10 path)
    '0000000000000', // 10 band 0 (bottom)
    '0000000000000', // 11
  ],
  // fogFarM omitted → the 16 m exterior default; the vista swells the far plane
  // over the drowned lands (VistaDirector) on the first step onto the top ledge.
  // One scripted low-fog cell (fogCells) at the top ledge is the only place aggro
  // may exceed sight, paired with the hounds' positional pant/snarl + the
  // amb-descent-wind updraft tell.
  vista: { id: 'vista-pilgrims-descent', cells: [[1, 1], [1, 2], [1, 3], [1, 4]] },
  fogCells: [{ cells: [[1, 1], [1, 2]], farM: 11 }],
  props: [],
  // A night gorge under the gorge sky/moon backdrop, lit by the ash-grey ambient.
  // Zero dynamic lights — well inside the ≤4-light budget.
  lights: [],
  enemies: [
    // Two Ash-Hounds working the switchbacks: multi-angle threat where the void
    // makes repositioning lethal. Both on raised trail terraces (band 2 / band 1)
    // — the zone's y-grounding proof (their VIEWs ride cellHeightM in main.ts).
    { kind: 'hound', at: [4, 6] }, // the band-2 west run
    { kind: 'hound', at: [7, 4] }, // the band-1 row-7 terrace
  ],
  banner: { at: [7, 10], name: 'Banner Mid-Descent' }, // the exhale between the vista and the sealed bottom
  lore: [
    { id: 'gv-descent-shrine', at: [4, 3] }, // the wayside shrine on the west run
    { id: 'gv-descent-pilgrim-marker', at: [1, 5] }, // at the head of the switchbacks (top ledge)
    { id: 'gv-descent-sealed-gate', at: [10, 4] }, // at the sealed gate (bottom, one cell west of the `44`)
    { id: 'gv-descent-ash-priest', at: [7, 3] }, // his Drop-1 final line (the priest stands one cell west at [7,2])
  ],
  doors: [
    // N road back up to the Gate Fields hub — the paired other end of `gf-descent`.
    { id: 'pd-to-fields', at: [1, 0], to: 'gate-fields', pair: 'gf-descent' },
    // The sealed way at the bottom into the Drop-2 salt-road (the `44` gate). Its
    // `greatervael` lock is satisfiable, but the target is authored-but-unbuilt
    // (FUTURE_ZONE_IDS), so it reads as a barred, swollen-shut arch this drop.
    { id: 'pd-to-saltroad', at: [10, 5], to: 'salt-road', lock: 'greatervael' },
  ],
  ambience: ['amb-descent-drone', 'amb-descent-wind'],
  // The gorge floor is deep and cold; keep the ash-grey ambient lifted so the
  // terraces + cliff faces read as shape rather than void (matches the exterior
  // field/village siblings).
  ambientFloor: 0.6,
  scares: [
    // PD-1 (Clip #5, primary hero): the vista swells over the drowned lands AND,
    // on the far cliff across the chasm, the Watcher manifests (showsWatcher) —
    // the snap-grid fires under the same swell (wired in main.ts: the on:'vista'
    // trigger reads the VistaDirector's fired id this frame).
    { id: 'PD-1', zone: 'pilgrims-descent', trigger: { on: 'vista', vistaId: 'vista-pilgrims-descent' }, gimmick: 'snap-grid', showsWatcher: true, oneLine: 'The chasm opens — across it, the watcher, waiting.' },
    // PD-2: a DISTANT, unreachable banner on the far cliff appears ablaze and
    // guttering wrong, then reads as ash. The player's OWN checkpoint banner at
    // [7,10] is NEVER touched (owner decision 8 — kneeling there always works);
    // the false read is on the set-dressing across the gorge only.
    { id: 'PD-2', zone: 'pilgrims-descent', trigger: { on: 'approach', at: [7, 10], withinM: 3 }, gimmick: 'desaturation', oneLine: 'A banner burns where you can’t reach; yours is safe.' },
  ],
  // Far cliff across the chasm: far, elevated, unreachable — off-grid backdrop
  // (col -3), PD-1's manifest anchor. Kept KEYED BY ZONE by the run-scoped
  // DreadDirector.
  watcherAnchors: [[1, -3]],
};
