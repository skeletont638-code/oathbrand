/**
 * The banner visions (Task 14) — the memory of the night Vael fell, one per
 * banner, played the FIRST time the player kneels there. Together, in zone
 * order, they assemble the tragedy:
 *
 *   the flame guttered  →  the oaths died  →  Callun opened the gate  →
 *   the queen knelt alone  →  the herald ran  →  the garden kept her brand
 *
 * VOICE matches the T13 inscriptions (src/content/lore.ts): terse, litany-like,
 * an image then a turn that darkens it. Each step's caption is a single line.
 *
 * Every vision opens on ash (`desatTo` ≈ 0.82), floods colour back toward 0
 * (the past briefly alive), then the last step SNAPS to ash — the memory
 * ending. Ghosts are placed on cells near each banner; the four built zones
 * (gate/hall/undercroft/ramparts) use real floor cells, and the throne &
 * queens-garden placements are authored now for when T15/T16 build those zones
 * — `main.ts` only ever plays the vision of the banner actually being knelt at.
 *
 * `id`s are namespaced `vision-*`; the vista one-shots are `vista-*`; both live
 * in `SaveData.visionsSeen`, so the two families never collide.
 */
import type { ZoneId } from './types';
import type { VisionDef } from '../engine/VisionPlayer';

/** Close, intimate ash for a memory — the world pulls in around the ghosts. */
const MEMORY_FOG = 9;
/** The ash the memory opens on and snaps back to (the 4-embers-lost ramp). */
const ASH = 0.82;

export const VISIONS: Record<
  Extract<
    ZoneId,
    | 'ashen-gate'
    | 'great-hall'
    | 'undercroft'
    | 'ramparts'
    | 'throne'
    | 'queens-garden'
    // --- Greater Vael Drop 1 (Task 8) banner memories — append only ---
    | 'gate-fields'
    | 'ashen-forest-n'
    | 'cinder-village'
    | 'pilgrims-descent'
  >,
  VisionDef
> = {
  // ─── 1. THE ASHEN GATE — the flame guttered ──────────────────────────────
  'ashen-gate': {
    id: 'vision-ashen-gate',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'The royal flame once stood taller than a man; every brand in Vael was lit from it.',
        spawnGhosts: [
          { piece: 'skeleton-warrior', at: [2, 6], rotY: 0 },
          { piece: 'skeleton-warrior', at: [3, 5], rotY: 0.3 },
        ],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'One breath, and it leaned — the way a candle leans — and did not lean back.', waitMs: 1600 },
      { desatTo: 0, caption: 'They named that night the Guttering before they knew it had no morning.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── 2. THE GREAT HALL — the oaths died ───────────────────────────────────
  'great-hall': {
    id: 'vision-great-hall',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'In the hall the sworn were still kneeling when the brands went cold in their hands.',
        spawnGhosts: [
          { piece: 'skeleton-warrior', at: [5, 6], rotY: -1.2 },
          { piece: 'skeleton-warrior', at: [4, 7], rotY: -1.2 },
          { piece: 'skeleton-warrior', at: [4, 9], rotY: -1.6 },
        ],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'An oath is only fire remembering a promise; the fire forgot the promise first.', waitMs: 1600 },
      { desatTo: 0, caption: 'One by one the faces emptied, and none of them felt themselves empty.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── 3. THE UNDERCROFT — Callun opened the gate ───────────────────────────
  undercroft: {
    id: 'vision-undercroft',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'The first knight walked to the last door and took no torch, for he no longer meant to see.',
        spawnGhosts: [{ piece: 'statue-knight', at: [6, 4], rotY: 1.2 }],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'He drew the bar with his own hand — sworn before all others, forsworn before all others.', waitMs: 1600 },
      { desatTo: 0, caption: 'He let the dark in the way a man lets in the cold, to be done with the waiting.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── 4. THE RAMPARTS — the queen knelt alone ──────────────────────────────
  ramparts: {
    id: 'vision-ramparts',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'The Queen did not run; she knelt where the flame had been and gave it back her crown.',
        spawnGhosts: [
          { piece: 'statue-knight', at: [4, 4], rotY: -0.6 },
          { piece: 'skeleton-warrior', at: [3, 3], rotY: 0.4 },
        ],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: '‘Return the crown to the flame that forged it’ — she said it to an empty hall.', waitMs: 1600 },
      { desatTo: 0, caption: 'No banner answered, and no brand. She knelt alone, and named it enough.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── 5. THE THRONE (T15) — the herald ran ─────────────────────────────────
  throne: {
    id: 'vision-throne',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'A herald took the Queen’s last words and ran — outward, against the tide of the fleeing.',
        spawnGhosts: [{ piece: 'statue-knight', at: [6, 4], rotY: 2.4 }],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'Her scroll-case was sealed still; she could not have carried what was set in her mouth.', waitMs: 1600 },
      // T15 obligation: line 3 keeps the impossibility/unease WITHOUT stating she
      // was a thing wearing a herald's shape — that reveal is ng-edda-lie's, saved
      // for NG+. Here she only runs the wrong way and arrives nowhere anyone recalls.
      { desatTo: 0, caption: 'She passed every gate that night and reached none of them; no threshold in Vael remembers her crossing.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── 6. THE QUEEN’S GARDEN (NG+, T16) — the garden kept her brand ──────────
  'queens-garden': {
    id: 'vision-queens-garden',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'Behind the sealed wall the garden went on, green in a kingdom of ash.',
        spawnGhosts: [{ piece: 'statue-knight', at: [3, 4], rotY: 0 }],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'Her brand still burns here, low and blue — the last unbroken oath in Vael.', waitMs: 1600 },
      { desatTo: 0, caption: 'It kept faith for one who would walk all the way round to the truth. For you.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── GREATER VAEL DROP 1 (Task 8) ─────────────────────────────────────────
  // The tithe tragedy, told banner by banner in zone order: the tithe begins →
  // a brand traded at the tree-line → the ledger's last page → pilgrims
  // descending to repay. Same Second-Vigil grammar as the castle six.

  // ─── GV.1 GATE FIELDS — the tithe begins ──────────────────────────────────
  'gate-fields': {
    id: 'vision-gate-fields',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'Once the fields were given fire freely, and the harvest came up gold under the brand.',
        spawnGhosts: [
          { piece: 'skeleton-warrior', at: [2, 6], rotY: 0 },
          { piece: 'skeleton-warrior', at: [3, 7], rotY: 0 },
        ],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'Then a clerk set a price on the warmth, and called the price a kindness — fire, on loan.', waitMs: 1600 },
      { desatTo: 0, caption: 'The first ember sold was the first the fields never got back. They have been owing ever since.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── GV.2 ASHEN FOREST N — a brand traded away at the tree-line ────────────
  'ashen-forest-n': {
    id: 'vision-ashen-forest',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'At the fog-line a woman knelt, and let them strike the fire from her brand.',
        spawnGhosts: [{ piece: 'statue-knight', at: [5, 6], rotY: 0 }],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'It was carried off to warm a hall she would never enter, and counted as a debt half-paid.', waitMs: 1600 },
      { desatTo: 0, caption: 'The other half is still owed. Something in the trees took it up, so she would not have to die of it.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── GV.3 CINDER VILLAGE — the ledger's last page ─────────────────────────
  'cinder-village': {
    id: 'vision-cinder-village',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: "The collector's hand moved down the column, name by name, ember by ember.",
        spawnGhosts: [{ piece: 'statue-knight', at: [4, 9], rotY: 0 }],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'The last name had nothing left to give but itself, so beside it he wrote a single word.', waitMs: 1600 },
      { desatTo: 0, caption: 'ALL. Then the flame guttered, and there was no one left to collect, and no one left to pay.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },

  // ─── GV.4 PILGRIM'S DESCENT — pilgrims descending to repay ─────────────────
  'pilgrims-descent': {
    id: 'vision-pilgrims-descent',
    steps: [
      { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
      {
        desatTo: 0.5,
        caption: 'They went down in a long line to give their embers back to the water, and be clean of the debt.',
        spawnGhosts: [
          { piece: 'skeleton-warrior', at: [4, 3], rotY: 0 },
          { piece: 'skeleton-warrior', at: [7, 4], rotY: 0 },
        ],
        waitMs: 1500,
      },
      { desatTo: 0.15, caption: 'The water took the embers. It did not give back the pilgrims.', waitMs: 1600 },
      { desatTo: 0, caption: 'The path down is deep-worn. No one has counted the ones who came up, because none did.', waitMs: 1700 },
      { desatTo: ASH, waitMs: 500 },
    ],
  },
};

/**
 * The Hag vision (Task 8) — NOT a banner memory. It plays only when the ledger
 * is surrendered at the cairn (the `ledger` bargain, hagBargain.ts → boon
 * `play-vision` → main.ts applyHagBoon → `visionPlayer.play(GV_VISION_HAG)`).
 * Its id is the exact string the bargain boon carries: `gv-vision-hag`. Same
 * colour-bleed grammar as the banners — the ledger's own tithe, shown back.
 */
export const GV_VISION_HAG: VisionDef = {
  id: 'gv-vision-hag',
  steps: [
    { desatTo: ASH, fogFar: MEMORY_FOG, waitMs: 700 },
    {
      desatTo: 0.5,
      caption: 'Here is what your ledger bought: a woman, kneeling, while strangers took her fire to sell.',
      spawnGhosts: [{ piece: 'statue-knight', at: [8, 9], rotY: 0 }],
      waitMs: 1500,
    },
    { desatTo: 0.15, caption: 'She did not curse them. She only asked who would carry the rest of what she owed.', waitMs: 1600 },
    { desatTo: 0, caption: 'The fog answered. It has been answering for her ever since — and now it knows your name too.', waitMs: 1700 },
    { desatTo: ASH, waitMs: 500 },
  ],
};

/** The memory for a banner in `zone`, or undefined for a zone with no banner. */
export function visionForZone(zone: ZoneId): VisionDef | undefined {
  return (VISIONS as Partial<Record<ZoneId, VisionDef>>)[zone];
}
