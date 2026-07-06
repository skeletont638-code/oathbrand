/**
 * THE SUNKEN CHAPEL — CRYPT (World Expansion v1.2, Task 7) — the dark beneath the
 * nave, reached DOWN the broken `Crypt Stair` from chapelNave. A low bone-vault
 * where the vigil laid its own: the uncounted who guttered before the ride. Near
 * pitch-black — the two torches keep a small pool of safety at the stair-foot and
 * the far end stays black, the Undercroft's wraith-showcase precedent — and one
 * brand-wraith haunts the dark corner, invisible until the Oath-Brand's pulse
 * thins its veil as you close (WRAITH_VISIBLE_PULSE). What Queen Maren left on the
 * lowest slab is the crypt's one inscription (`act2-crypt-a`).
 *
 * Interior kit (Task 2): `dreadInterior` opts the crypt into the DreadDirector.
 * `ambientFloor` 0.06 + `keyLightIntensity` 0 mirror the Undercroft (spec §3): the
 * faint interior directional must not defeat the void-black corner, or the wraith
 * reads before its pulse-reveal. Flat interior (no heightGrid) — every spawn/prop/
 * scatter sits on h0, so the flat-2D placement is exact and the camera never lerps.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const CHAPEL_CRYPT: ZoneDef = {
  id: 'chapel-crypt',
  grid: [
    '###1##', // 0  N wall — Crypt Stair '1' [0,3] → chapel-nave (UP)
    '#....#', // 1  vault — torches [1,1]/[1,4] flank the stair-foot; entry [1,3]
    '#....#', // 2  vault — inscription [2,2], the tomb-slab [2,3]
    '#....#', // 3  vault — bones [3,4]
    '#....#', // 4  vault — bones [4,1], the WRAITH [4,3] (dark corner), rubble [4,4]
    '#.S..#', // 5  vault — spawn [5,2] (fallback), bones [5,3]
    '######', // 6  S wall
  ],
  cell: 2,
  tiles: {},
  // Sparse bone-piles across the dark floor (Task 10 scatter kit): one InstancedMesh,
  // non-colliding, all on walkable floor and clear of the stair-foot/spawn/wraith.
  scatter: [
    { kind: 'bones', cells: [[4, 1], [5, 3], [3, 4], [2, 4]] },
  ],
  props: [
    // The tomb-slab the queen came to (the `act2-crypt-a` cell sits beside it) +
    // a fall of vault-stone in the wraith's corner (the collapse read).
    { kind: 'pillar', at: [2, 3] }, // the lowest slab / sarcophagus stone
    { kind: 'rubble', at: [4, 4], rotY: 0.9 },
  ],
  // The interior wall-torches carry the light; no v1 braziers (lights empty).
  lights: [],
  // Two LIT wall-torches at the stair-foot only — the far end (rows 3–5) stays
  // black so the wraith showcase reads (Undercroft precedent).
  torches: [
    { at: [1, 1] }, // W wall, by the stair
    { at: [1, 4] }, // E wall, by the stair
  ],
  enemies: [
    // One brand-wraith haunts the unlit corner; it never renders until the pulse
    // burns past WRAITH_VISIBLE_PULSE, so the vault reads empty until you close.
    { kind: 'wraith', at: [4, 3] },
  ],
  // Inscription (Act II — what the queen left here). Text resolves by id in lore.ts.
  lore: [
    { id: 'act2-crypt-a', at: [2, 2] }, // beside the lowest slab
  ],
  doors: [
    // Up the broken stair to the nave (chapelNave) — the paired other end of the
    // nave's stairwell gate '2'. Unlocked; the 'Crypt Stair' decoration is declared
    // on the nave side (one side per edge), so this end renders the same door.
    { id: 'crypt-to-nave', at: [0, 3], to: 'chapel-nave', pair: 'chapel-crypt-stair' },
  ],
  ambience: ['amb-crypt-drip', 'amb-wraith-whisper'],
  ambientFloor: 0.06,
  dreadInterior: true,
  keyLightIntensity: 0, // the faint interior directional must NOT defeat the wraith showcase (spec §3)
  ngPlus: {
    // The Second Vigil sets a second wraith among the bones.
    enemies: [
      { kind: 'wraith', at: [4, 3] },
      { kind: 'wraith', at: [3, 1] },
    ],
  },
};
