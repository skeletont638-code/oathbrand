/**
 * Zone 2 — THE GREAT HALL (Task 11; the Hall Gallery merged in as a MEZZANINE,
 * Task 14). The hub: every road of the vigil crosses this room (spec §5). An
 * inner chamber (the old feast hall) holds the banner; the north wall carries
 * the undercroft drop (2) and the ramparts stair (3); the inner chamber's south
 * face carries the two LOCKED doors — the Throne door (4, needs the Gatekey) and
 * the shortcut gate (5, kicked open from the Ramparts side). First real combat:
 * three hollow soldiers and an archer holding the length of the nave.
 *
 * ── THE GALLERY IS NOW A WALKED MEZZANINE (seamless-traversal directive) ──────
 * The old `hall-gallery` floor-zone and its faded `Stair Door` are GONE. The
 * gallery is folded into THIS zone as a banded mezzanine you WALK to: cross the
 * hall floor, climb the grand stair along the east wall (a continuous heightGrid
 * rise, bands 0→1→2→3), arrive on the gallery balcony overlooking the hall, and
 * walk out to the Ramparts through the Gallery Door — every step walked, no fade.
 *
 * The hall floor is UNCHANGED (band 0): every v1 content cell keeps its exact
 * coordinates (cols 0–16 byte-for-byte; the pinned statue [1,13], banner [5,8],
 * spawn [8,9], every v1 gate/lore/enemy/light/anomaly cell). The ONLY edits to
 * the original footprint: the dead `Stair Door` gate '6' at [0,3] reverts to
 * wall, and the east wall (col 17) opens as the grand-stair mouth (rows 6–7) and
 * two arched overlook windows (rows 3–4). Everything else is APPENDED to the
 * right (cols 18–24) — appending cols/rows shifts no existing cell.
 *
 * ── THE BANDED CLIMB (one heightfield, non-overlap is law) ────────────────────
 * Collision stays the flat v1 2D grid (no jump); heightGrid is a visual y-lerp
 * (HEIGHT_LEVEL_M = 1.5 m/band). The grand stair rises EAST across the mouth on
 * rows 6–7, col 17→20 (band 0→1→2→3); every walkable Δ1 seam auto-generates a
 * walkable RAMP (buildHeightRamps), so it is one unbroken walk from the hall
 * floor up onto the balcony. The balcony rides band 3 (4.5 m — a real gallery
 * height over the hall). Its WEST edge (col 20) drops Δ3 to the `~` overlook
 * well (cols 18–19, band 0) as a CLIFF: the terrain skirt fills that face as the
 * solid arcade mass the balcony sits on (the "under-mezzanine cells read as wall
 * mass" law), and a step off the rail is the existing void rule (ember loss +
 * reset). At rows 3–4 the col-17 wall opens so the well peers through the arcade
 * into the hall floor below — the mezzanine edge IS the overlook now, real.
 *
 * ── WALL BANDING (T2b) ────────────────────────────────────────────────────────
 * The mezzanine's border walls carry the band of the floor they bound (balcony
 * walls band 3, the stair-flanking south wall steps 1/2/3) so their bases seat
 * at the balcony rather than stepping away. Wall↔wall seams generate nothing.
 *
 * ── CONTENT (the gallery's content relocated onto the mezzanine — nothing lost)
 * Balcony (band 3): 4 wall-torches (pools of safety on the walk), 2 hollow
 * soldiers + 1 archer holding the gallery (NG+ adds a wraith on the spine), the
 * two Act-III `act3-gallery-a/b` inscriptions (the king's overlook + the smooth
 * stone), the grand-stair treads, balustrade/decay dressing. Reserved for the
 * echo (Task 9): the 2×2 dais [3,20],[3,21],[4,20],[4,21] at the rail is kept
 * CLEAR of every prop/enemy/lore so scene #6 (`act3-king-hollows`: Osric sets the
 * crown down at the overlook and forgets why) stages there.
 *
 * ── DOORS ─────────────────────────────────────────────────────────────────────
 * The v1 hall gates (ashen-gate 1, undercroft 2, ramparts-stair 3, throne 4,
 * shortcut 5, barracks 7) are UNCHANGED on the hall floor. The Stair Door (6→
 * hall-gallery) DIES. A new Gallery Door (gate '6' at [4,24], the mezzanine's
 * east wall) carries the old `gallery-ramparts` edge — great-hall ↔ ramparts
 * FROM THE MEZZANINE, unlocked, so the keep is a ring from the first visit. The
 * ramparts declare no door for it (great-hall declares the 'Gallery Door' here,
 * one side per edge).
 *
 * Grid is the authored v1 layout (cols 0–17) — copied VERBATIM save the two
 * edits above — with the mezzanine appended at cols 18–24. Annotations honored:
 * doors 1→ashen-gate 2→undercroft(drop) 3→ramparts 4→throne(lock gatekey — T12)
 * 5→shortcut(lock shortcut) 6→ramparts(Gallery Door, from the mezzanine) 7→
 * barracks · banner yes (vision 2, T14) · 7 lore + 2 gallery · 3+2 soldiers +
 * 1+1 archer (NG+: +1 wraith hall, +1 wraith gallery).
 */
import type { ZoneDef } from '../../world/zoneDef';

export const GREAT_HALL: ZoneDef = {
  id: 'great-hall',
  grid: [
    //         111111111122222   cols 18–24 = the mezzanine (gallery balcony + grand stair)
    // 0123456789012345678901234
    '#########################', // 0  N wall (the dead Stair Door '6' at [0,3] reverted to wall)
    '#....2..........3#~~....#', // 1  undercroft '2' [1,5] · ramparts-stair '3' [1,16] · overlook well
    '#................#~~....#', // 2  hall floor N | arcade pier | overlook well | balcony
    '#..####....####..~~~....#', // 3  overlook WINDOW (col 17 open) — the balcony sees the hall
    '7..#..........#..~~~....6', // 4  barracks '7' [4,0] · overlook WINDOW · Gallery Door '6' [4,24]
    '#..#....B.....#..#~~....#', // 5  banner 'B' [5,8] · arcade pier | overlook well | balcony
    '#..####....####.........#', // 6  grand-stair mouth (col 17 open) — climb E, band 0→1→2→3
    '#.....4....5............#', // 7  throne '4' [7,6] · shortcut '5' [7,11] · grand stair
    '#........S.......########', // 8  spawn 'S' [8,9] · mezzanine S wall
    '#........1.......########', // 9  ashen-gate '1' [9,9]
    '#########################', // 10 S wall
  ],
  cell: 2,
  // `~` is the gallery overlook well (void — a floorless drop reading down into
  // the hall; a fall = ember loss + reset). The hall floor and mezzanine balcony
  // are both `.` — the heightGrid puts the balcony a real storey up.
  tiles: {},
  // FLAT bands (Task 2b): the hall floor is band 0 (every v1 cell reads y = 0
  // exactly, so the hall is unchanged); the grand stair steps 0→1→2→3 across the
  // east mouth (rows 6–7, cols 17→20); the gallery balcony rides band 3 (cols
  // 20–23, rows 1–7). The overlook well (cols 18–19, band 0) drops Δ3 from the
  // balcony's west edge as the arcade cliff. Border walls carry the band of the
  // floor they bound. Same dims as `grid` (11 × 25).
  heightGrid: [
    '0000000000000000000033333', // 0
    '0000000000000000000033333', // 1
    '0000000000000000000033333', // 2
    '0000000000000000000033333', // 3
    '0000000000000000000033333', // 4
    '0000000000000000000033333', // 5
    '0000000000000000001233333', // 6  stair: col18 band1, col19 band2, col20 band3
    '0000000000000000001233333', // 7
    '0000000000000000001233333', // 8  S wall banded with the stair/balcony above
    '0000000000000000000000000', // 9
    '0000000000000000000000000', // 10
  ],
  props: [
    // Banner post (banner cell [5,8] has no adjacent wall — see ashen-gate).
    { kind: 'pillar', at: [4, 8] },
    // Moved off [2,13] (which abutted the inner-chamber NE wall block at [3,11-14]
    // — the statue clipped it) back to the north wall at [1,13], clear of the
    // chamber (realism pass, Task 9). NOTE: the NG+ `hall-statue-turned` anomaly
    // DERIVES its cell from this prop (anomalies.ts) — the pair can't desync.
    { kind: 'statue-knight', at: [1, 13], rotY: Math.PI }, // composite: eyeball in-game (T5 note)
    { kind: 'crate', at: [2, 1], rotY: 0.55 },
    { kind: 'crate', at: [8, 16], rotY: -0.4 },
    // The grand-stair treads: decorative `stairs` props on the climbing cells
    // (the heightGrid carries the real rise; these are the visible read). Facing
    // east, ascending toward the balcony.
    { kind: 'stairs', at: [6, 18], rotY: Math.PI / 2 },
    { kind: 'stairs', at: [6, 19], rotY: Math.PI / 2 },
    { kind: 'stairs', at: [7, 18], rotY: Math.PI / 2 },
    // Gallery dressing (band 3): a balustrade post and fallen decay along the
    // walk, clear of the echo dais / door / enemies / torches / inscriptions.
    { kind: 'pillar', at: [5, 22] },
    { kind: 'rubble', at: [7, 22], rotY: 0.5 },
  ],
  lights: [
    { at: [7, 5] }, // beside the sealed Throne door
    { at: [7, 12] }, // beside the sealed shortcut gate
    { at: [4, 4], intensity: 10 }, // inside the banner chamber (NW fill), lifted a touch
    // T14: the checkpoint banner [5,8] read as a black silhouette (T11 note).
    // The banner faces SOUTH into the room, so a torch just south of it (on the
    // chamber's south wall at [6,6]) front-lights its face. Replaces the far NE
    // stair torch ([1,13]) to stay within the 4-light budget. T18: brightened
    // to 13 (from the default 8) — it still read dim in real lighting (T14 note).
    { at: [6, 7], intensity: 13 },
  ],
  enemies: [
    // ── Hall floor (band 0) — unchanged v1 roster ──
    // Banner-chamber guard: aggros through the south gap on the approach.
    { kind: 'soldier', at: [4, 5] },
    // West-wing patrol and east-wing straggler flank the nave.
    { kind: 'soldier', at: [4, 2] },
    { kind: 'soldier', at: [7, 14] },
    // Archer at the head of the nave: opens up the moment the player
    // steps off the entry cell (14m aggro straight down the center gap).
    { kind: 'archer', at: [1, 10] },
    // ── Gallery balcony (band 3) — relocated from hall-gallery ──
    // Two hollow soldiers work the walk; an archer holds the north end, firing
    // down the gallery on the climb.
    { kind: 'soldier', at: [1, 22] },
    { kind: 'soldier', at: [6, 20] },
    { kind: 'archer', at: [2, 21] },
  ],
  banner: { at: [5, 8], name: 'Banner of the Hall' },
  // Inscriptions (Task 13; +Act-III gallery pair relocated from hall-gallery,
  // Task 14). Text resolves by id in src/content/lore.ts.
  lore: [
    { id: 'hall-mural', at: [2, 2] }, // the scoured mural, west wall
    { id: 'cold-hearth', at: [4, 12] }, // the dead feast-fire in the chamber
    { id: 'kings-decree', at: [8, 3] }, // the decree nailed to the nave floor
    { id: 'oath-spoken', at: [5, 5] }, // the oath-stone by the banner
    { id: 'feast-roster', at: [8, 12] }, // the vigil's roster down the nave
    { id: 'throne-bar', at: [8, 6] }, // at the sealed throne approach
    // Forward-dread (P4): the set feast-table at [4,10], inside the feast chamber
    // on the N–S crossing corridor to the checkpoint banner [5,8] the player walks
    // to kneel — between the banner post [4,8] and the dead feast-hearth [4,12].
    { id: 'hall-set-places', at: [4, 10] },
    // Act III (the king hollows) — on the gallery balcony above.
    { id: 'act3-gallery-a', at: [2, 20] }, // the king's overlook, at the rail
    { id: 'act3-gallery-b', at: [6, 21] }, // the smooth stone, down the walk
  ],
  // Four wall-torches (interior kit) on the gallery balcony — pools of safety on
  // the walk while the overlook well stays void-black. The hall floor keeps its
  // v1 point-light braziers (`lights` above); torches ≤6 (4 here).
  torches: [
    { at: [1, 21] }, // N wall
    { at: [7, 21] }, // S wall
    { at: [2, 23] }, // E wall
    { at: [6, 23] }, // E wall
  ],
  doors: [
    { id: 'hall-to-gate', at: [9, 9], to: 'ashen-gate', pair: 'gate-hall' },
    { id: 'hall-to-undercroft', at: [1, 5], to: 'undercroft', pair: 'hall-undercroft' },
    { id: 'hall-to-ramparts', at: [1, 16], to: 'ramparts', pair: 'hall-ramparts' },
    // The Gatekey (taken in the Undercroft) opens the Throne approach (T12
    // changed this lock from 'throne' → 'gatekey'). The 'throne'/'throne-open'
    // lock is now unused — kept in the graph for a possible T15 boss-gate.
    { id: 'hall-throne-door', at: [7, 6], to: 'throne', lock: 'gatekey', pair: 'hall-throne' },
    // Shortcut gate: same wall, opens from the Ramparts side (flag
    // 'shortcut-open'); its ramparts twin must reuse pair 'hall-shortcut'.
    { id: 'hall-shortcut', at: [7, 11], to: 'ramparts', lock: 'shortcut', pair: 'hall-shortcut' },
    // The side door into the Hall Barracks — the barracks declares the
    // 'Barracks Door' decoration on its side (World Expansion v1.2, Task 4).
    { id: 'hall-to-barracks', at: [4, 0], to: 'hall-barracks', pair: 'barracks-hall' },
    // The Gallery Door OFF THE MEZZANINE onto the Ramparts (World Expansion v1.2,
    // Task 14 — the merged hall-gallery's `gallery-ramparts` edge, now anchored
    // on the balcony). Unlocked; great-hall declares the 'Gallery Door' below
    // (one side per edge), so the ramparts render the same door automatically.
    { id: 'hall-to-ramparts-gallery', at: [4, 24], to: 'ramparts', pair: 'gallery-ramparts' },
  ],
  gateDoors: [
    { gate: '6', label: 'Gallery Door' }, // the ramparts edge, off the mezzanine
  ],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  ngPlus: {
    // Remixed placement + the promised extra wraith on the hall floor, and the
    // gallery's own Second-Vigil roster (2 soldiers + archer + a wraith on the
    // spine) — the whole zone's NG+ enemies REPLACE the base roster.
    enemies: [
      // Hall floor
      { kind: 'soldier', at: [4, 10] },
      { kind: 'soldier', at: [7, 3] },
      { kind: 'soldier', at: [2, 15] },
      { kind: 'archer', at: [1, 7] },
      { kind: 'wraith', at: [5, 9] },
      // Gallery balcony
      { kind: 'soldier', at: [1, 22] },
      { kind: 'soldier', at: [6, 20] },
      { kind: 'archer', at: [2, 21] },
      { kind: 'wraith', at: [5, 20] }, // haunts the spine by the overlook
    ],
    // The kindest reading of every hollow you have put down, cut into the nave
    // floor among the roster of the dead (T16 ngOnly).
    addedLore: [{ id: 'ng-mercy', at: [8, 10] }],
  },
};
