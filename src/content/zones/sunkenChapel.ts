/**
 * THE SUNKEN CHAPEL (World Expansion v1.2, Task 7; the nave + crypt merged into
 * ONE walked descent, Task 16) — the half-collapsed wayside chapel in the Ashen
 * Forest, now a single continuous zone. The two floor-zones (chapel-nave above,
 * chapel-crypt below) and the `Crypt Stair` door that FADED between them are
 * MERGED (seamless-traversal directive): you enter off the forest road through
 * the `Chapel Door`, walk the half-collapsed nave (the raised altar still tended),
 * find the crypt stair at the nave's east flank, and WALK DOWN into the dark — the
 * crypt is sunk a full storey below, beside the nave via bands (accepted trade-off:
 * beside-not-under). Every step walked, no teleport, no fade. The descent into the
 * dark IS the dread beat.
 *
 * ── ONE ZONE, ONE INTERIOR (dreadInterior) ────────────────────────────────────
 * BOTH old halves were `dreadInterior` dread interiors; the merged chapel stays
 * one. ONE zone ⇒ ONE ambient floor: the crypt's darkest 0.06 wins (the nave was
 * 0.1) — the descent should get DARKER, not lighter. `keyLightIntensity` 0 is
 * KEPT from the crypt (the Undercroft/wraith-showcase guard, spec §3): the faint
 * interior directional must not defeat the void-black corner, or the crypt wraith
 * reads before its pulse-reveal (WRAITH_VISIBLE_PULSE). With no key light the
 * TORCH POOLS carry the whole zone — two lit brackets flank the still-tended altar
 * (the nave draws you up toward the light), two pool the crypt stair-foot; the
 * nave body between and the crypt's far corner stay near-black. The half-collapsed
 * nave reading dim under altar-light, then blackness swallowing the descent, is
 * the whole point.
 *
 * ── THE HEIGHT INVERSION (one heightfield, non-overlap is law) ─────────────────
 * Collision stays the flat 2D grid (no jump); heightGrid is a visual y-lerp
 * (HEIGHT_LEVEL_M = 1.5 m/band). The footprint is laid FLAT and the CRYPT is the
 * LOW ground: the crypt floor rides band 0, the nave floor rides band 2 (+3.0 m —
 * a raised platform over the sunk vault), and the altar dais crowns band 3 (+4.5 m,
 * one step over the nave). The dais↔nave seam (row2↔row3, cols 1–5) auto-generates
 * a walkable RAMP (buildHeightRamps classifies a Δ1 walkable↔walkable seam as a
 * slope) — the altar step, dressed by a `stairs` prop. The DESCENT is a Δ1×2 stair
 * stepping the nave (band 2) down through band 1 to the crypt (band 0) across a
 * tight east passage (row 5, cols 5→6→7): TWO walkable ramps, dressed by two
 * `stairs` props. Each cell carries exactly ONE band, so nothing walkable is
 * stacked over anything walkable — the crypt occupies DIFFERENT grid cells than
 * the nave (cols 8–10 vs 1–5), sunk beside it. There are NO cliffs: the nave and
 * crypt never touch directly, separated everywhere by the thick east wall (cols
 * 6–7) except the single stepped passage, so you can only reach the dark by
 * WALKING DOWN the stair — no walk-off, no fall.
 *
 * ── WALL BANDING (T2b) — the thick east wall, no wall two bands apart ──────────
 * Every wall carries the band of the floor it bounds. The nave's east wall (col 6)
 * bounds only the band-2 nave; the crypt's west wall (col 7) bounds only the
 * band-0 crypt — a TWO-cell-thick masonry mass between them, so no single wall
 * ever bounds floors two bands apart (the raised nave block simply steps down to
 * the sunk crypt across the two wall columns). The dais's bounding walls carry
 * band 3, the descent-flanking walls step with it. Wall↔wall seams generate
 * nothing; the interior riser fills the walkable band lips (the altar step + the
 * descent) as dressed stone.
 *
 * ── THE DESCENT (lose sight of the nave) ──────────────────────────────────────
 * The crypt stair is found at the nave's east flank (row 5), part-way up toward
 * the altar — as a chapel crypt sits beneath the chancel. You step EAST down the
 * two treads into the vault, then TURN south into the dark toward the far corner;
 * the 3 m drop plus the thick east wall put the lit nave behind and above you,
 * lost from sight. What Queen Maren left on the lowest slab is the crypt's one
 * inscription (`act2-crypt-a`); one brand-wraith haunts the far corner, invisible
 * until the Oath-Brand's pulse thins its veil as you close.
 *
 * ── THE ECHO AISLE (Task 9 reservation — re-zoned to `sunken-chapel`) ──────────
 * The queen's-walk echo (`act2-queens-walk`) stages on the nave's central aisle:
 * the four contiguous cells [4,3],[5,3],[6,3],[7,3] (col 3, the walk from the
 * entrance toward the altar treads at [3,3]) are kept prop/enemy/lore-free so the
 * silent queen paces them, altar to door and back. The aisle cells are UNCHANGED
 * from the old nave (col 3, rows 4–7) — the merge did not move them.
 *
 * ── CONTENT (all relocated from the two merged zones — nothing lost) ──────────
 * Nave (band 2 / dais band 3): the altar block on the dais + the ramp treads, the
 * pews flanking the aisle (row 6 bare — the collapse gap), the half-collapse
 * rubble, 2 LIT wall-torches flanking the tended altar + 1 UNLIT bare bracket (a
 * `props` `torch` — the kit's no-light variant, no flame/light) at the dark
 * collapsed south end, and both Act-II inscriptions (`act2-nave-a` on the dais
 * front, `act2-nave-b` on the chancel stone). Crypt (band 0): the tomb-slab + its
 * `act2-crypt-a` inscription, a fall of vault-stone, sparse bone-piles (scatter
 * kit), 2 LIT wall-torches at the stair-foot, and the brand-wraith in the far
 * dark corner. Torches ×4 lit + 1 unlit = 5 brackets, under the ≤6 cap.
 *
 * The forest keeps its `Chapel Door` (gate '1'): the gateDoors decoration is
 * declared HERE (the chapel side, one-side rule), so the Ashen Forest renders the
 * same door automatically (its `af-to-chapel` door-def retargets from `chapel-nave`
 * to `sunken-chapel` — TARGET only; the forest grid/gate '4' is untouched). The
 * `Crypt Stair` door DIES with the merge (the stair is walked now); the retired
 * `chapel-nave`/`chapel-crypt` ids survive as save aliases (save.ts).
 */
import type { ZoneDef } from '../../world/zoneDef';

export const SUNKEN_CHAPEL: ZoneDef = {
  id: 'sunken-chapel',
  grid: [
    '############', // 0  N wall (behind the altar) — banded with the dais (band 3)
    '#.....######', // 1  altar dais (band 3) — altar [1,3], lit torches [1,1]/[1,5]
    '#.....######', // 2  altar dais front — inscription [2,1], fallen debris [2,5]
    '#.....######', // 3  nave (band 2) — the ramp seam is row2↔row3; altar treads [3,3]
    '#.....######', // 4  nave — pews flank the aisle; ECHO aisle cell [4,3]
    '#..........#', // 5  nave — ECHO aisle [5,3]; DESCENT east: [5,6] band1, [5,7] band0 → crypt
    '#.....##...#', // 6  nave (collapse gap) — ECHO aisle [6,3]; crypt (band 0) — torches [6,8]/[6,10]
    '#.....##...#', // 7  nave — pews; ECHO aisle [7,3]; crypt band 0
    '#.....##...#', // 8  nave — chancel inscription [8,3]; crypt band 0 (NG+ wraith [8,9])
    '#.....##...#', // 9  nave — unlit torch [9,1]; crypt — inscription [9,8], tomb-slab [9,9], rubble [9,10]
    '#..S..##...#', // 10 nave — spawn [10,3] (where the Chapel Door lands you); crypt — the WRAITH [10,10]
    '###1########', // 11 S wall — Chapel Door '1' [11,3] → ashen-forest-n (unlocked)
  ],
  cell: 2,
  // `.` is the dressed chapel stone (nave boards / crypt vault floor); `1` the
  // forest gate. No voids ⇒ no walk-off drops: the crypt is reached ONLY by
  // walking down the stepped stair (the nave and crypt never touch directly, so
  // buildHeightRamps generates no cliff — every seam here is a walkable ramp).
  tiles: {},
  // FLAT bands (T2b), the height INVERTED so the crypt is the LOW ground: the crypt
  // floor is band 0 (cols 8–10, rows 5–10), the nave floor band 2 (cols 1–5, rows
  // 3–10 — a raised platform +3.0 m), the altar dais band 3 (cols 1–5, rows 1–2,
  // +4.5 m). The single dais↔nave Δ1 seam (row2↔row3) is the walkable altar ramp;
  // the descent (row 5, cols 5→6→7) steps the nave down 2→1→0 as two walkable
  // ramps into the crypt. Border walls carry the band of the floor they bound —
  // the nave's east wall (col 6) band 2, the crypt's west wall (col 7) band 0, a
  // two-cell-thick mass so no wall bounds floors two bands apart. Same dims as
  // `grid` (12 × 12).
  heightGrid: [
    '333333300000', // 0  N wall banded with the dais (cols 0–6) / crypt mass (cols 7–11)
    '333333300000', // 1  altar dais (band 3), side walls banded
    '333333300000', // 2  altar dais front (band 3)
    '222222200000', // 3  nave (band 2) — the altar ramp lands here
    '222222200000', // 4
    '222222100000', // 5  descent: col6 band 1, col7 band 0 (the stepped stair into the crypt)
    '222222200000', // 6  nave band 2 (cols 0–6) | crypt band 0 (cols 7–11)
    '222222200000', // 7
    '222222200000', // 8
    '222222200000', // 9
    '222222200000', // 10
    '222222200000', // 11 S wall banded with the nave (cols 0–6) / crypt (cols 7–11)
  ],
  // Sparse bone-piles across the dark crypt floor (Task 10 scatter kit): one
  // InstancedMesh, non-colliding, all on walkable band-0 floor and clear of the
  // stair-foot [5,8], the tomb-slab and the wraith's corner.
  scatter: [
    { kind: 'bones', cells: [[6, 9], [7, 8], [8, 10], [10, 8]] },
  ],
  props: [
    // THE ALTAR (on the dais) + the visible treads resting on the ramp seam (stair
    // convention: the heightGrid carries the real rise, the `stairs` prop is the
    // read). The `stairs` GLB faces up the nave (treads ascending north).
    { kind: 'pillar', at: [1, 3] }, // the altar stone, centred on the dais
    { kind: 'stairs', at: [3, 3], rotY: Math.PI }, // treads up onto the dais
    // Pew rows — crate props re-dressed as benches, flanking the central aisle
    // (col 3 stays clear so the walk to the altar — and the queen's-walk echo — is
    // unobstructed). Row 6 is left bare on both sides: the collapse gap.
    { kind: 'crate', at: [4, 2], rotY: 0.05 },
    { kind: 'crate', at: [4, 4], rotY: -0.05 },
    { kind: 'crate', at: [5, 2], rotY: -0.05 },
    { kind: 'crate', at: [5, 4], rotY: 0.05 },
    { kind: 'crate', at: [7, 2], rotY: 0.05 },
    { kind: 'crate', at: [7, 4], rotY: -0.05 },
    // The half-collapse: fallen block on the dais front and rubble where the roof
    // came down over the south pews (row 6, the collapse gap).
    { kind: 'rubble', at: [2, 5], rotY: 0.8 },
    { kind: 'rubble', at: [6, 2], rotY: 1.3 },
    { kind: 'rubble', at: [6, 4], rotY: -0.6 },
    // The UNLIT torch: the bare `torch` kit bracket placed as a prop (no flame, no
    // light — the kit adds those only to `torches`), against the west wall at the
    // dark, collapsed south end. rotY ≈ +90° hangs the bracket arm into the room
    // off the W wall. The nave's "some gone dark" read without extending the kit.
    { kind: 'torch', at: [9, 1], rotY: Math.PI / 2 },
    // The crypt-stair treads: decorative `stairs` props on the two descending cells
    // (the heightGrid carries the real rise; these are the visible read). Facing
    // east, descending toward the crypt.
    { kind: 'stairs', at: [5, 6], rotY: Math.PI / 2 },
    { kind: 'stairs', at: [5, 7], rotY: Math.PI / 2 },
    // Crypt dressing (band 0): the lowest slab / sarcophagus stone (the
    // `act2-crypt-a` cell sits beside it) + a fall of vault-stone in the wraith's
    // corner (the collapse read).
    { kind: 'pillar', at: [9, 9] }, // the tomb-slab
    { kind: 'rubble', at: [9, 10], rotY: 0.9 },
  ],
  // The interior wall-torches carry the light; no v1 braziers (lights empty, well
  // inside the ≤4 dynamic-light budget).
  lights: [],
  // Four LIT wall-torches (interior kit): two flanking the still-tended altar dais
  // (the nave's pool of safety over the north end, the south left dark by the unlit
  // bracket) and two at the crypt stair-foot (the descent's small pool — the crypt's
  // far corner stays black so the wraith showcase reads). ≤6 (4 lit + 1 unlit).
  torches: [
    { at: [1, 1] }, // W wall, altar dais
    { at: [1, 5] }, // E wall, altar dais
    { at: [6, 8] }, // crypt, W-ish by the stair-foot
    { at: [6, 10] }, // crypt, E wall by the stair-foot
  ],
  enemies: [
    // No nave enemies: the nave is the queen's-walk echo room; the menace is below.
    // One brand-wraith haunts the crypt's far dark corner; it never renders until
    // the pulse burns past WRAITH_VISIBLE_PULSE, so the vault reads empty until you
    // close. The Second Vigil keeps BOTH old floors' extra wraiths (see ngPlus).
    { kind: 'wraith', at: [10, 10] },
  ],
  // Inscriptions (Act II — Queen Maren's walk + what she left below). Text
  // resolves by id in lore.ts. All THREE preserved from the merged floors.
  lore: [
    { id: 'act2-nave-a', at: [2, 1] }, // on the dais front, W side, by the altar
    { id: 'act2-nave-b', at: [8, 3] }, // the chancel/threshold stone in the aisle
    { id: 'act2-crypt-a', at: [9, 8] }, // beside the lowest slab, in the crypt
  ],
  doors: [
    // Out onto the Ashen Forest road — the paired other end of the forest's gate
    // '4' ('chapel-door', retargeted to sunken-chapel). Unlocked; the 'Chapel Door'
    // decoration is declared HERE (one side per edge), so the forest renders the
    // same door. The Crypt Stair DIES with the merge (the stair is walked now).
    { id: 'sunken-chapel-to-forest', at: [11, 3], to: 'ashen-forest-n', pair: 'chapel-door' },
  ],
  gateDoors: [
    { gate: '1', label: 'Chapel Door' }, // the forest-road edge (unlocked)
  ],
  ambience: ['amb-hall-drone', 'amb-crypt-drip'],
  ambientFloor: 0.06, // the crypt's darkest floor wins — the descent gets DARKER
  dreadInterior: true,
  keyLightIntensity: 0, // the faint interior directional must NOT defeat the crypt wraith showcase (spec §3)
  ngPlus: {
    // The Second Vigil keeps BOTH merged floors' extra wraiths: the nave's among
    // the fallen south pews ([8,2], the old nave NG+ wraith), plus a SECOND crypt
    // wraith among the bones ([8,9], relocated from the old crypt's [3,1]) — the
    // base crypt wraith holds its corner. (ngPlus.enemies REPLACES the base roster.)
    enemies: [
      { kind: 'wraith', at: [10, 10] }, // the crypt corner (base wraith holds)
      { kind: 'wraith', at: [8, 9] }, // a second wraith among the crypt bones
      { kind: 'wraith', at: [8, 2] }, // among the fallen south pews of the nave
    ],
  },
};
