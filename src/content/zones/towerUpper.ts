/**
 * THE WATCHTOWER — UPPER (World Expansion v1.2, Task 6) — the roof-walk over the
 * Gate Fields, climbed from the guardroom (the `Stair Door`, unlocked). A small
 * sheltered upper room at the south gives onto an open, wind-exposed parapet that
 * looks north over the whole plain: the highest eyes in the fields.
 *
 * ── ROOF-KIND CHOICE (Task 6 watch-out) ─────────────────────────────────────
 * This zone is `kind: 'exterior'`, so it gets the sky/moon backdrop and the
 * DreadDirector (dread default via exterior kind) — an open-air ROOF must read
 * as open air, which an interior zone (black ceiling, no moon) cannot give. The
 * watch-out's twin risks are both answered natively, WITHOUT fighting the engine:
 *
 *   • Undulation vs. a flat tower floor → the heightGrid carries FLAT bands
 *     (room band 1, roof band 2), the Pilgrim's Descent precedent; the exterior
 *     ash-drift over stone is the ruined read, not a fight.
 *   • Exterior `#`/`T` render as TREES, not masonry → so the outer faces are `~`
 *     open drop (sky-through cliffs, the tower falling away to the fields — the
 *     same void treatment as the gorge / hall-gallery wells) and the sheltered
 *     room walls use a custom `M` masonry letter (tiles → 'wall' → the exterior
 *     ruin-block, i.e. the SAME wall kit piece as an interior, seated on the
 *     terrace). No `#` tree-walls anywhere the tower should be stone.
 *
 * THE ROOF-WALK (stair convention, mechanism A — zoneDef.ts): the parapet (rows
 * 1–3, band 2) rides one band above the upper room (rows 4–6, band 1); the
 * row3↔row4 seam auto-generates a walkable RAMP (buildHeightRamps), and a
 * decorative `stairs` prop rests on it as the visible step up onto the walk. The
 * roof's band-2 lip drops Δ2 to the surrounding `~` void (band 0) → cliff faces:
 * the tower's outer walls, falling away to the plain. Collision stays the flat
 * 2D grid (no jump), so a step off the open parapet is the existing void rule
 * (ember loss + reset) — a real, wind-exposed edge with no rail.
 *
 * The vista (`vista-tower-roof`) swells the fog open the first time you reach the
 * north parapet — the plain laid bare under the moon. One archer holds the walk.
 * Reserved for Task 9 (the muster echo): the 2×2 roof block [2,2],[2,3],[3,2],[3,3]
 * is kept CLEAR of every prop/enemy/lore so the echo scene can stage there.
 * One Act-I inscription carries the watcher's tally, turned forward-dread.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const TOWER_UPPER: ZoneDef = {
  id: 'tower-upper',
  grid: [
    '~~~~~~', // 0  open air — the drop + sky north of the parapet (the vista out)
    '~....~', // 1  roof-walk (band 2), open E/W to the drop — the north parapet
    '~....~', // 2  roof-walk — echo block [2,2],[2,3] (Task 9, kept prop-free)
    '~....~', // 3  roof-walk — echo block [3,2],[3,3] (Task 9, kept prop-free)
    'M....M', // 4  the step: roof (band 2) ↔ room (band 1) ramp seam is row3↔row4
    'M....M', // 5  upper room (band 1), masonry walls
    'M.S..M', // 6  upper room — spawn [6,2] (fallback; arrival is the Stair Door)
    'MMM1MM', // 7  S wall — Stair Door '1' [7,3] → tower-ground (DOWN)
  ],
  cell: 2,
  // `M` is the sheltered upper room's masonry (a custom 'wall' letter so the
  // exterior builder seats the ruin-block wall kit, NOT a `#` treeline); `~` is
  // the open drop over the fields (void — walkable for collision, a fall = ember
  // loss + reset), `.` the bare roof/room floor, `1` the stairwell gate.
  tiles: { M: 'wall' },
  kind: 'exterior',
  exteriorSky: 'field',
  // FLAT bands (Pilgrim's Descent precedent): the room rides band 1, the roof-walk
  // band 2; the single Δ1 seam (row3↔row4) is the walkable step onto the parapet.
  // The `~`/`M` cells carry band 0/room-band so the outer lips drop Δ2 to void
  // (cliff faces = the tower's falling-away walls). Same dims as `grid` (8×6).
  heightGrid: [
    '000000', // 0  void
    '022220', // 1  roof-walk band 2, void flanks (band 0)
    '022220', // 2
    '022220', // 3
    '111111', // 4  room band 1 (walls banded with the floor they bound)
    '111111', // 5
    '111111', // 6
    '111111', // 7
  ],
  // The first step onto the north parapet swells the fog open over the plain —
  // the wind-exposed vista the roof exists for. Cells span the north walk.
  vista: { id: 'vista-tower-roof', cells: [[1, 1], [1, 2], [1, 3], [1, 4]] },
  props: [
    // The visible step up onto the roof-walk, resting on the row3↔row4 ramp seam
    // (stair convention: the heightGrid carries the real rise, the `stairs` prop
    // is the read). Faces north, treads ascending onto the parapet.
    { kind: 'stairs', at: [4, 3], rotY: Math.PI },
    // A fallen merlon on the west walk and a broken crate in the room — the ruined
    // read. Both clear of the reserved echo block.
    { kind: 'rubble', at: [3, 1], rotY: 0.6 },
    { kind: 'crate', at: [5, 4], rotY: -0.4 },
  ],
  // Open night over the fields under the 'field' sky/moon backdrop, lit by the
  // lifted ash-grey ambient. Zero dynamic lights — well inside the ≤4 budget.
  lights: [],
  enemies: [
    // One hollow archer holds the parapet, firing down the north walk over the
    // drop — the roof's single watcher, still at his post.
    { kind: 'archer', at: [1, 3] },
  ],
  // Inscription (Act I — the last watcher's tally, turned forward-dread).
  lore: [
    { id: 'act1-tower-b', at: [1, 1] }, // cut into the parapet stone, NW corner
  ],
  doors: [
    // Down the stair to the guardroom (towerGround) — the paired other end of the
    // ground's stairwell gate '2'. Unlocked; the 'Stair Door' decoration is
    // declared on the ground side (one side per edge), so this end renders it.
    { id: 'tower-upper-to-ground', at: [7, 3], to: 'tower-ground', pair: 'tower-stair' },
  ],
  ambience: ['amb-field-wind', 'amb-tithe-toll'],
  // Open night: lift the ash-grey ambient floor so the parapet + the plain below
  // read as shape rather than void (matches the field/descent exterior siblings).
  ambientFloor: 0.6,
};
