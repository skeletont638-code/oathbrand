/**
 * THE WATCHTOWER (World Expansion v1.2, Task 13) — the Gate Fields watchtower,
 * now ONE continuous climb. The two floor-zones (tower-ground guardroom +
 * tower-upper roof-walk) and the Stair Door that faded between them are MERGED
 * into a single banded zone (seamless-traversal directive): you enter at the
 * field door, walk the guardroom, climb a continuous stair, arrive in the upper
 * room and walk out onto the open roof — every step WALKED, no teleport, no fade.
 *
 * ── ONE ZONE, ONE KIND — `kind: 'exterior'` (the precedented, justified path) ──
 * A burnt watchtower ruin is roofless throughout: the guardroom reads as a
 * high-walled shell open to the sky, the roof MUST be open-air. Only an exterior
 * zone gives the sky/moon backdrop the roof needs (an interior's black ceiling
 * can't), and exterior is dread-native (the DreadDirector fires without a
 * `dreadInterior` opt-in). This follows the tower-upper precedent exactly (T6):
 * the room-forming masonry is a custom `M` 'wall' letter — the exterior builder
 * seats it as the ruin-block wall kit (NOT a `#` treeline), welded on the cell's
 * flat band (T6 fix). No `#` anywhere the tower should read as stone.
 *
 * ── THE BANDED CLIMB (one heightfield, non-overlap is law) ────────────────────
 * The footprint is laid FLAT and the floor RISES south→north across five bands
 * (HEIGHT_LEVEL_M = 1.5 m each): the guardroom sits at band 0, the stair steps
 * up band 1 → 2 → 3, the upper room rides band 3, and the roof-walk crowns it at
 * band 4 (6 m). Each cell carries exactly ONE band, so nothing walkable is ever
 * stacked over anything walkable — the upper room + roof occupy DIFFERENT grid
 * cells than the guardroom, and the terrain skirt fills the tall band lips as
 * solid tower mass beneath them. Every walkable Δ1 seam auto-generates a walkable
 * RAMP (buildHeightRamps): rows 9→8→7→6 are the stair (bands 0→1→2→3) and rows
 * 4→3 the step up onto the roof (band 3→4) — a single unbroken walk from door to
 * parapet. Collision stays the flat 2D grid (no jump), so the `stairs` props are
 * the visible treads dressing the real rise, and a step off the open parapet is
 * the existing void rule (ember loss + reset).
 *
 * ── WALL BANDING (T2b) ────────────────────────────────────────────────────────
 * Every wall is banded with the floor it bounds: each interior row is one band,
 * so its border `M` cells carry that row's digit and bound only same-band floor.
 * No wall bounds two floors a band apart — the outer wall simply STEPS with the
 * stair (adjacent wall cells differ by Δ1, wall↔wall so no seam is generated).
 *
 * ── THE ROOF (tower-upper precedent) ──────────────────────────────────────────
 * The parapet (rows 1–3, band 4) is open on N/E/W to the `~` void (band 0): the
 * band-4 lip drops Δ4 to void as cliff faces — the tower's outer walls falling
 * away to the plain. The vista (`vista-tower-roof`) swells the fog open over the
 * fields the first time you reach the north parapet; one hollow archer holds the
 * walk. Reserved for the muster echo (act1-muster): the 2×2 roof block
 * [2,2],[2,3],[3,2],[3,3] is kept CLEAR of every prop/enemy/lore so the scene
 * stages there.
 *
 * ── CONTENT (all relocated from the two merged zones — nothing lost) ──────────
 * Guardroom (band 0): 3 wall-torches (pools of safety over the door + stair),
 * rubble/crates, the `act1-tower-a` watch-roster inscription, one hollow soldier
 * on the dead watch. Upper room (band 3): the `act1-tower-b` tally-stone. Roof
 * (band 4): the archer + the vista. The Second Vigil (ngPlus) sets a wraith
 * among the guardroom rubble beside the hollow soldier.
 *
 * The field-entry keeps its `Tower Door` (gate '1'): the gateDoors decoration is
 * declared HERE (the tower side, one-side rule), so the fields render the same
 * door automatically. The Stair Door DIES with the merge.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const WATCHTOWER: ZoneDef = {
  id: 'watchtower',
  grid: [
    '~~~~~~', // 0  open air N of the parapet — the drop + sky (the vista out)
    '~....~', // 1  roof-walk (band 4) — the N parapet, open E/W to the drop
    '~....~', // 2  roof-walk — echo block [2,2],[2,3]; archer holds [2,4]
    '~....~', // 3  roof-walk — echo block [3,2],[3,3]
    'M....M', // 4  upper room (band 3), masonry walls
    'M....M', // 5  upper room — the tally-stone inscription [5,1]
    'M....M', // 6  upper room / top of the stair (band 3)
    'M....M', // 7  stair (band 2)
    'M....M', // 8  stair (band 1)
    'M....M', // 9  guardroom (band 0) — torches [9,1],[9,4]; watch-roster [9,3]
    'M....M', // 10 guardroom — the hollow soldier [10,2]
    'M..S.M', // 11 guardroom — spawn [11,3] (fallback; arrival is the Tower Door)
    'MM1MMM', // 12 S wall — Tower Door '1' [12,2] → gate-fields (unlocked)
  ],
  cell: 2,
  // `M` is the tower's masonry (a custom 'wall' letter so the exterior builder
  // seats the ruin-block wall kit, NOT a `#` treeline); `~` is the open drop over
  // the fields (void — walkable for collision, a fall = ember loss + reset); `.`
  // the bare stone floor; `1` the field gate.
  tiles: { M: 'wall' },
  kind: 'exterior',
  exteriorSky: 'field',
  // FLAT bands, one per row (Pilgrim's Descent precedent): guardroom band 0 (rows
  // 9–12), the stair steps 1 (row 8) → 2 (row 7) → 3 (row 6), the upper room band
  // 3 (rows 4–6), the roof-walk band 4 (rows 1–3). Border `M` cells carry their
  // row's band (banded with the floor they bound — T2b). The `~` flanks carry
  // band 0, so the roof's band-4 lips drop Δ4 to void as cliff faces. Same dims
  // as `grid` (13×6).
  heightGrid: [
    '000000', // 0  void
    '044440', // 1  roof band 4, void flanks (band 0)
    '044440', // 2
    '044440', // 3
    '333333', // 4  upper room band 3 (walls banded with the floor they bound)
    '333333', // 5
    '333333', // 6
    '222222', // 7  stair band 2
    '111111', // 8  stair band 1
    '000000', // 9  guardroom band 0
    '000000', // 10
    '000000', // 11
    '000000', // 12
  ],
  // The first step onto the north parapet swells the fog open over the plain —
  // the wind-exposed vista the roof exists for. Cells span the north walk.
  vista: { id: 'vista-tower-roof', cells: [[1, 1], [1, 2], [1, 3], [1, 4]] },
  props: [
    // Guardroom (band 0): fallen crates and rubble — the ruined watch-room.
    { kind: 'crate', at: [10, 4], rotY: 0.3 },
    { kind: 'crate', at: [10, 1], rotY: -0.5 },
    { kind: 'rubble', at: [11, 4], rotY: 0.8 },
    // The stair treads: decorative `stairs` props resting on the climbing cells
    // (the heightGrid carries the real rise; these are the visible read). Facing
    // north, ascending toward the upper room.
    { kind: 'stairs', at: [8, 2], rotY: Math.PI },
    { kind: 'stairs', at: [8, 3], rotY: Math.PI },
    { kind: 'stairs', at: [7, 2], rotY: Math.PI },
    // Upper room (band 3): a broken crate and a fallen block — the ruined read,
    // both clear of the tally-stone and the roof echo block above.
    { kind: 'rubble', at: [5, 4], rotY: 0.6 },
    { kind: 'crate', at: [4, 4], rotY: -0.4 },
  ],
  // The interior wall-torches carry the guardroom's light; no v1 braziers (lights
  // empty, well inside the ≤4 dynamic-light budget).
  lights: [],
  // Three wall-torches (interior kit): flanking the stair foot (N of the room)
  // and by the Tower Door (SW) — pools of safety over the way up and the way out.
  torches: [
    { at: [9, 1] }, // W wall, at the foot of the stair
    { at: [9, 4] }, // E wall, at the foot of the stair
    { at: [11, 1] }, // W wall, by the Tower Door
  ],
  enemies: [
    // One hollow soldier keeps the dead watch at the guardroom's heart, and one
    // hollow archer still holds the roof-walk, firing down the north parapet.
    { kind: 'soldier', at: [10, 2] },
    { kind: 'archer', at: [2, 4] },
  ],
  // Inscriptions (Act I — the field-watch's muster/watch, turned forward-dread):
  // the watch-roster in the guardroom, the tally-stone in the upper room.
  lore: [
    { id: 'act1-tower-a', at: [9, 3] }, // the watch-roster, guardroom N wall
    { id: 'act1-tower-b', at: [5, 1] }, // the tally-stone, cut into the upper room
  ],
  doors: [
    // Out onto the Gate Fields — the paired other end of the fields' gate '6'
    // ('gf-to-tower'). Unlocked; the 'Tower Door' decoration is declared HERE
    // (one side per edge), so the fields render the same door automatically.
    { id: 'watchtower-to-fields', at: [12, 2], to: 'gate-fields', pair: 'tower-door' },
  ],
  gateDoors: [
    { gate: '1', label: 'Tower Door' }, // the gate-fields edge (unlocked)
  ],
  ambience: ['amb-field-wind', 'amb-ember-hum'],
  // Open night: lift the ash-grey ambient floor so the parapet, the stair and the
  // plain below read as shape rather than void (matches the field exterior sibling).
  ambientFloor: 0.6,
  ngPlus: {
    // The Second Vigil sets a wraith among the guardroom rubble with the hollow
    // guard; the roof archer holds. (ngPlus.enemies REPLACES the base roster.)
    enemies: [
      { kind: 'soldier', at: [10, 2] },
      { kind: 'archer', at: [2, 4] },
      { kind: 'wraith', at: [10, 3] },
    ],
  },
};
