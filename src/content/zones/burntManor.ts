/**
 * THE BURNT MANOR (World Expansion v1.2, Task 8; merged into ONE walked climb,
 * Task 15) — the fire-gutted tithe-hall on the Cinder Village plaza, now a single
 * continuous zone. The two floor-zones (manor-ground hall + manor-upper gallery)
 * and the Stair Door that FADED between them are MERGED (seamless-traversal
 * directive): you enter off the street through the `Manor Door`, walk the charred
 * hall, climb a continuous stair up the east side, and arrive on the burnt gallery
 * whose rail genuinely looks DOWN into the hall below — every step WALKED, no
 * teleport, no fade. The T8 "missing floor" fiction (the boards the fire ate
 * first) is now REAL geometry: the burned-through hole is a void well the gallery
 * rail overlooks, and past it the hall floor reads a full storey down.
 *
 * ── ONE ZONE, ONE INTERIOR (dreadInterior) ────────────────────────────────────
 * BOTH old halves were `dreadInterior` dread interiors, and the merged hall stays
 * one — the gutted house is roofed masonry (no sky), ambient near void-black so
 * the wall-torches read as pools of safety and the overlook hole stays black. The
 * greatHall mezzanine (T14) is the exact precedent: a banded balcony over an
 * inner room with an `~` overlook well on its walking edge.
 *
 * ── THE BANDED CLIMB (one heightfield, non-overlap is law) ────────────────────
 * Collision stays the flat 2D grid (no jump); heightGrid is a visual y-lerp
 * (HEIGHT_LEVEL_M = 1.5 m/band). The footprint is laid FLAT: the ground hall sits
 * at band 0 (rows 6–10, the Manor Door on the south wall), the stair steps up the
 * east cols 5–6 (band 0 → 1 → 2 across rows 5 → 4 → 3), and the gallery rides
 * band 2 (rows 1–3, 3.0 m — ONE honest storey over the hall; band 3 would be a
 * grand-hall gallery, but a burnt manor is a modest two-storey house, so the
 * gallery is a single floor up). Every walkable Δ1 seam auto-generates a walkable
 * RAMP (buildHeightRamps): cols 5–6 rows 5→4→3 are the stair — one unbroken walk
 * from the hall floor onto the gallery. Each cell carries exactly ONE band, so
 * nothing walkable is stacked over anything walkable; the terrain skirt fills the
 * tall band lips as the solid arcade mass the gallery sits on.
 *
 * ── THE OVERLOOK / MISSING FLOOR (greatHall precedent) ────────────────────────
 * The burned-through hole is the 2×4 `~` void well at [4,1]–[4,4],[5,1]–[5,4]
 * (band 0). The gallery's SOUTH edge (row 3, cols 1–4, band 2) is its RAIL: the
 * row3↔row4 seam is a Δ2 CLIFF, so standing at the rail you look down 3 m into
 * the hole, and the hall floor (band 0, rows 6+) is contiguous just past the well
 * — the burnt hall floor shows through the gap, at the player's feet, real
 * geometry. A misstep off the boards into the `~` well is the existing void rule
 * (ember loss + reset). A walkable RING survives around the hole — the east
 * stair/landing (cols 5–6) and the south hall reach every torch, the inscription,
 * the soldier and the door without ever crossing it.
 *
 * ── WALL BANDING (T2b) ────────────────────────────────────────────────────────
 * Every border wall carries the band of the floor it bounds: the gallery walls
 * band 2, the east wall STEPS with the stair (band 2/1/0), the well + hall walls
 * band 0. Wall↔wall seams generate nothing.
 *
 * ── CONTENT (all relocated from the two merged zones — nothing lost) ──────────
 * Ground hall (band 0): the caved hearth cluster on the W wall (hearth-breast
 * `pillar` [6,1] + fallen-chimney `rubble` [7,1]), the sanctioned kneeler-vigil
 * ([6,2], the one villager who let itself be counted), two collapsed roof-beams,
 * three charred crates, the `act2-manor-a` inscription cut into the hearth wall,
 * 2 LIT wall-torches + 1 UNLIT bare bracket (the "some gone dark" read). Reserved
 * for the burning echo (Scene 4, `act2-burning`): the 2×2 block [6,3],[6,4],[7,3],
 * [7,4] before the hearth is kept prop/enemy-free so the villagers stage there.
 * Gallery (band 2): one hollow soldier still holds the boards, the `act2-manor-b`
 * inscription cut into the rail at the hole's edge, a fallen beam + a burnt crate,
 * 2 LIT wall-torches. Torches ×4 lit + 1 unlit = 5 brackets, under the ≤6 cap.
 * The Second Vigil (ngPlus) keeps BOTH old floors' wraiths — one among the hall
 * beams, one on the gallery beside the hole.
 *
 * The village entry keeps its `Manor Door` (gate '1'): the gateDoors decoration
 * is declared HERE (the manor side, one-side rule), so the Cinder Village renders
 * the same door automatically (its `cv-to-manor` gate cell/grid UNCHANGED — only
 * its target retargets from `manor-ground` to `burnt-manor`). The Stair Door DIES
 * with the merge; the retired `manor-ground`/`manor-upper` ids survive as save
 * aliases (save.ts).
 */
import type { ZoneDef } from '../../world/zoneDef';

export const BURNT_MANOR: ZoneDef = {
  id: 'burnt-manor',
  grid: [
    '########', // 0  N wall (band 2, banded with the gallery)
    '#......#', // 1  gallery (band 2) — torch [1,1], burnt crate [1,2]
    '#......#', // 2  gallery — soldier [2,3]; torch [2,6]
    '#......#', // 3  gallery RAIL over the hole — inscription [3,2], fallen beam [3,4]
    '#~~~~..#', // 4  overlook well [4,1]–[4,4] (void, band 0) | stair band 1 [4,5]/[4,6]
    '#~~~~..#', // 5  overlook well continues | stair foot band 0 [5,5]/[5,6]
    '#......#', // 6  ground hall (band 0) — hearth pillar [6,1], kneeler [6,2], crate [6,5], torch [6,6]
    '#......#', // 7  hall — fallen chimney rubble [7,1], collapsed beam [7,5]; ECHO block [7,3]/[7,4]
    '#......#', // 8  hall — hearth inscription [8,1], crate [8,6]
    '#......#', // 9  hall — collapsed beam [9,2], unlit torch bracket [9,6]
    '#...S..#', // 10 hall — spawn [10,4] (fallback; arrival is the Manor Door), torch [10,1], crate [10,6]
    '####1###', // 11 S wall — Manor Door '1' [11,4] → cinder-village (unlocked)
  ],
  cell: 2,
  // `~` is the burned-through floor of the gallery (void — walkable-blocking, a
  // fall = ember loss + reset), reading DOWN into the hall below; `.` the scorched
  // boards / bare hall stone; `1` the village gate.
  tiles: {},
  // FLAT bands (T2b): the ground hall is band 0 (rows 6–11), the stair steps the
  // east cols 5–6 up 0 → 1 → 2 (rows 5 → 4 → 3), the gallery rides band 2 (rows
  // 1–3). The overlook well (cols 1–4, rows 4–5) carries band 0 — the hall floor
  // level it reads down to — so the gallery rail's row3↔row4 seam drops Δ2 as the
  // arcade cliff. Border walls carry the band of the floor they bound (the east
  // wall steps with the stair). Same dims as `grid` (12 × 8).
  heightGrid: [
    '22222222', // 0  gallery band 2 (walls banded with the floor they bound)
    '22222222', // 1
    '22222222', // 2
    '22222222', // 3  gallery rail (band 2) over the well below
    '00000111', // 4  well band 0 (cols 1–4) | stair band 1 (cols 5–6)
    '00000000', // 5  well band 0 | stair foot band 0 (cols 5–6)
    '00000000', // 6  hall band 0
    '00000000', // 7
    '00000000', // 8
    '00000000', // 9
    '00000000', // 10
    '00000000', // 11 S wall banded with the hall band 0
  ],
  props: [
    // THE HEARTH (prop cluster): the caved hearth-breast + fallen chimney masonry
    // against the W wall — the fire's origin, the warmth the village chose.
    { kind: 'pillar', at: [6, 1] }, // hearth-breast / chimney stone
    { kind: 'rubble', at: [7, 1], rotY: 0.7 }, // the collapsed chimney
    // Collapsed roof-beams + charred crates — the fire-gutted, looted read. All
    // clear of the ECHO block ([6,3],[6,4],[7,3],[7,4]) and the kneeler line.
    { kind: 'rubble', at: [7, 5], rotY: 1.2 }, // a fallen roof-beam
    { kind: 'rubble', at: [9, 2], rotY: -0.5 }, // a fallen roof-beam
    { kind: 'crate', at: [6, 5], rotY: 0.4 }, // charred crate
    { kind: 'crate', at: [8, 6], rotY: -0.8 }, // charred crate, E wall
    { kind: 'crate', at: [10, 6], rotY: 0.6 }, // charred crate by the Manor Door
    // The UNLIT torch: a bare `torch` kit bracket placed as a PROP (no flame, no
    // light — the kit adds those only to `torches`), dead against the E wall near
    // the Manor Door. rotY ≈ -90° hangs the bracket arm off the E wall into the
    // room. The gutted house's "some gone dark" read, no kit extension (T7).
    { kind: 'torch', at: [9, 6], rotY: -Math.PI / 2 },
    // The grand-stair treads: decorative `stairs` props on the climbing cells
    // (the heightGrid carries the real rise; these are the visible read). Facing
    // north, ascending toward the gallery.
    { kind: 'stairs', at: [5, 5], rotY: Math.PI },
    { kind: 'stairs', at: [4, 5], rotY: Math.PI },
    { kind: 'stairs', at: [4, 6], rotY: Math.PI },
    // Gallery dressing (band 2): a fallen roof-beam at the hole's north lip and a
    // burnt crate — the gutted read, both on the surviving boards clear of the void.
    { kind: 'rubble', at: [3, 4], rotY: 0.6 }, // fallen beam at the hole's north lip
    { kind: 'crate', at: [1, 2], rotY: -0.4 }, // burnt crate, gallery NW
  ],
  // The interior wall-torches carry the light; no v1 braziers (lights empty, well
  // inside the ≤4 dynamic-light budget).
  lights: [],
  // Four LIT wall-torches (interior kit): two flanking the ground hall (the way
  // out + the stair foot) and two on the gallery boards (one each side of the
  // hole). Pools of safety while the well stays void-black. ≤6 (4 lit + 1 unlit).
  torches: [
    { at: [10, 1] }, // W wall, ground hall by the Manor Door
    { at: [6, 6] }, // E wall, ground hall at the stair foot
    { at: [1, 1] }, // W wall, gallery
    { at: [2, 6] }, // E wall, gallery
  ],
  enemies: [
    // The sanctioned kneeler-vigil (T5): one Kneeling Hollow knelt by the hearth —
    // the single villager who let itself be counted rather than take the fire.
    // Dormant statuary until a real brand pulse close by wakes it (KneelingHollow
    // auto-wake — the manor stages no scare beat, so nothing calls routeScare).
    { kind: 'kneeler', at: [6, 2] },
    // One hollow soldier still holds the burnt gallery, working the surviving ring.
    { kind: 'soldier', at: [2, 3] },
  ],
  // Inscriptions (Act II — the burning: they chose the fire rather than hollow;
  // the last waverers at the rail — both turned forward-dread).
  lore: [
    { id: 'act2-manor-a', at: [8, 1] }, // cut into the hearth wall, ground hall
    { id: 'act2-manor-b', at: [3, 2] }, // cut into the rail at the hole's edge
  ],
  doors: [
    // Out onto the Cinder Village street — the paired other end of the village's
    // gate '1' ('cv-to-manor', retargeted to burnt-manor). Unlocked; the 'Manor
    // Door' decoration is declared HERE (one side per edge), so the village renders
    // the same door. The Stair Door DIES with the merge (the stair is walked now).
    { id: 'burnt-manor-to-village', at: [11, 4], to: 'cinder-village', pair: 'manor-door' },
  ],
  gateDoors: [
    { gate: '1', label: 'Manor Door' }, // the cinder-village edge (unlocked)
  ],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  // Near void-black (hall-gallery precedent): the overlook hole stays black, the
  // torches pool the hall floor + the surviving gallery boards.
  ambientFloor: 0.08,
  dreadInterior: true,
  ngPlus: {
    // The Second Vigil keeps BOTH merged floors' wraiths: one among the ground
    // hall's collapsed beams beside the kneeler, one on the gallery beside the
    // burned-through hole with the hollow soldier. (ngPlus.enemies REPLACES base.)
    enemies: [
      { kind: 'kneeler', at: [6, 2] },
      { kind: 'soldier', at: [2, 3] },
      { kind: 'wraith', at: [8, 2] }, // among the ground-hall beams
      { kind: 'wraith', at: [2, 5] }, // on the gallery beside the hole
    ],
  },
};
