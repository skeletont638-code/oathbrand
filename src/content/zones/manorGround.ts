/**
 * THE BURNT MANOR — GROUND (World Expansion v1.2, Task 8) — the third and final
 * landscape ruin: the fire-gutted tithe-hall on the Cinder Village plaza, entered
 * off the street through the `Manor Door` (unlocked). This was the collector's own
 * hall, where the village was called in to be counted; when the last count came,
 * the folk here chose the fire rather than the hollowing. A charred hall now:
 * collapsed roof-beams (rubble), burnt crates, a caved-in hearth on the west wall,
 * and — the sanctioned kneeler-vigil (T5) — one Kneeling Hollow knelt by the warmth,
 * the single villager who let itself be counted. The stairwell climbs UP (the
 * `Stair Door`) to the burnt upper gallery.
 *
 * FACADE / STREET READ (brief acceptance): the Manor Door reads from the street
 * off an EXISTING Cinder Village house-block — no new shell prop. The gate cell
 * `1` at cinderVillage [3,8] sits in the pocket of the central plaza house-blocks
 * ([2,8]`H` / [3,7]`H` / [3,9]`A`), so the burnt manor IS that dense central ruin
 * on the spine the player must walk; the door is its one enterable face. This is
 * the brief's PREFERRED option (reuse an H-block face over a bespoke facade), so
 * cinderVillage grows by exactly one gate cell + one DoorDef and nothing else.
 *
 * THE HEARTH READ (author's call — a PROP CLUSTER, not masonry): the `pillar` at
 * [4,1] is the caved hearth-breast / chimney stone against the west wall, with a
 * fall of `rubble` at [5,1] where the chimney came down — a two-piece cluster that
 * reads as the ruined hearth without a new kit piece. The kneeler [4,2] kneels
 * before it; the inscription [3,1] is cut into the hearth wall above.
 *
 * SCENE 4 RESERVATION (the burning — Task 9 echo): the 2×2 open block
 * [3,3],[3,4],[4,3],[4,4] before the hearth is kept prop/enemy-free so the silent
 * echo of the barred hall's burning can stage there, at the warmth the villagers
 * chose. Test-locked clear (mirrors the tower's muster-echo / nave's queen's-walk
 * reservations).
 *
 * Interior kit (Task 2): `dreadInterior` opts the hall into the DreadDirector;
 * ambient stays low (0.1) so the torches read as pools of safety. TORCHES ×3 as a
 * mix (per T7): TWO lit kit `torches` ([1,1]/[1,6], flanking the way in from the
 * stair) PLUS ONE unlit `torch` PROP ([7,6], a dead bracket by the Manor Door) —
 * the "some gone dark" read of a gutted house, the bare torch.glb bracket with no
 * kit flame/light (NOT a kit extension). Flat interior (no heightGrid): every
 * spawn/prop/enemy sits on h0, so placement is exact and the camera never lerps.
 * One Act-II inscription (`act2-manor-a`) carries the burning, turned forward-dread.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const MANOR_GROUND: ZoneDef = {
  id: 'manor-ground',
  grid: [
    '##1#####', // 0  N wall — Stair Door '1' [0,2] → manor-upper (UP)
    '#......#', // 1  hall — lit torches [1,1]/[1,6] flank the stair
    '#......#', // 2  hall — collapsed beam [2,5], charred crate [2,1]
    '#......#', // 3  hall — hearth inscription [3,1]; SCENE-4 cells [3,3]/[3,4]
    '#......#', // 4  hall — hearth pillar [4,1], kneeler vigil [4,2]; SCENE-4 [4,3]/[4,4]
    '#......#', // 5  hall — hearth rubble [5,1]
    '#......#', // 6  hall — collapsed beam [6,4], charred crate [6,1]
    '#.S....#', // 7  hall — spawn [7,2] (fallback; arrival is the Manor Door); crate [7,5]; unlit torch [7,6]
    '###2####', // 8  S wall — Manor Door '2' [8,3] → cinder-village (unlocked)
  ],
  cell: 2,
  tiles: {},
  props: [
    // THE HEARTH (prop cluster): the caved hearth-breast + fallen chimney masonry
    // against the west wall — the fire's origin, the warmth the village chose.
    { kind: 'pillar', at: [4, 1] }, // hearth-breast / chimney stone
    { kind: 'rubble', at: [5, 1], rotY: 0.7 }, // the collapsed chimney
    // Collapsed roof-beams (the fire-gutted read) + charred crates of a looted,
    // burnt hall. All clear of the SCENE-4 block and the kneeler line.
    { kind: 'rubble', at: [2, 5], rotY: 1.2 }, // a fallen roof-beam, NE
    { kind: 'rubble', at: [6, 4], rotY: -0.5 }, // a fallen roof-beam, S-centre
    { kind: 'crate', at: [2, 1], rotY: 0.4 }, // charred crate, W wall
    { kind: 'crate', at: [6, 1], rotY: -0.8 }, // charred crate, SW
    { kind: 'crate', at: [7, 5], rotY: 0.6 }, // charred crate by the Manor Door
    // The UNLIT torch: a bare `torch` kit bracket placed as a prop (no flame, no
    // light — the kit adds those only to `torches`), dead against the E wall by the
    // Manor Door. rotY ≈ -90° hangs the bracket arm off the E wall into the room.
    // The gutted house's "some gone dark" read, no kit extension (T7 precedent).
    { kind: 'torch', at: [7, 6], rotY: -Math.PI / 2 },
  ],
  // The interior wall-torches carry the light; no v1 braziers (lights empty, well
  // inside the ≤4 budget).
  lights: [],
  // Two LIT wall-torches (interior kit): flanking the way in from the stair (N),
  // pools of safety over the north half while the gutted south end darkens toward
  // the dead bracket by the door.
  torches: [
    { at: [1, 1] }, // W wall, by the stair
    { at: [1, 6] }, // E wall, by the stair
  ],
  enemies: [
    // The sanctioned kneeler-vigil (T5): one Kneeling Hollow knelt by the hearth —
    // the single villager who let itself be counted rather than take the fire.
    // Dormant statuary until a real brand pulse close by wakes it (KneelingHollow
    // auto-wake — the manor stages no scare beat, so nothing calls routeScare here).
    { kind: 'kneeler', at: [4, 2] },
  ],
  // Inscription (Act II — the burning: they chose the fire rather than hollow).
  lore: [
    { id: 'act2-manor-a', at: [3, 1] }, // cut into the hearth wall, above the breast
  ],
  doors: [
    // Out onto the Cinder Village street — the paired other end of the village's
    // new gate '1' ('cv-to-manor'). Unlocked; the 'Manor Door' decoration is
    // declared HERE (one side per edge), so the village renders the same door.
    { id: 'manor-ground-to-village', at: [8, 3], to: 'cinder-village', pair: 'manor-door' },
    // Up the stair to the burnt gallery (manorUpper) — the paired other end of the
    // upper floor's stairwell gate. Unlocked; the 'Stair Door' decoration is here.
    { id: 'manor-ground-to-upper', at: [0, 2], to: 'manor-upper', pair: 'manor-stair' },
  ],
  gateDoors: [
    { gate: '2', label: 'Manor Door' }, // the cinder-village edge (unlocked)
    { gate: '1', label: 'Stair Door' }, // up to the gallery
  ],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  ambientFloor: 0.1,
  dreadInterior: true,
  ngPlus: {
    // The Second Vigil sets a wraith among the collapsed beams with the kneeler.
    enemies: [
      { kind: 'kneeler', at: [4, 2] },
      { kind: 'wraith', at: [6, 5] },
    ],
  },
};
