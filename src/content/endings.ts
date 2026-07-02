/**
 * Ending-track gate (Task 13). A single pure function reads the run's state
 * and answers which of the campaign's endings it is currently bound for — the
 * Ash-Priest's final words at the summit branch on it (dialogue.ts), and the
 * ending screens (T15/T16) will resolve from it too.
 *
 * Only two tracks are REACHABLE this early:
 *   1 — KEPT COURSE. The default. You still mean to obey the last command.
 *   3 — HOLLOW. The brand is out; nothing you carry matters any more.
 *
 * Two more are DESIGNED but dormant until later tasks build the choice that
 * unlocks them:
 *   2 — BROKEN COURSE (T15). Refusing the queen's command at the throne. The
 *       flag that records the refusal doesn't exist until T15's boss scene, so
 *       there is no path to track 2 yet — `endingPending` never returns 2.
 *   4 — THE QUEEN'S BRAND (T16). Taking Maren's own brand from the sealed
 *       garden. The mechanic that sets 'queens-brand' ships in T16.
 *
 * `EndingTrack` is 1|2|3 today; T16 widens it to include 4 in ONE place and the
 * compiler then walks every switch (dialogue's ASHPRIEST_3_FINAL included) that
 * must grow a fourth arm. Deliberately narrow so the future work is loud.
 */
import type { EndingId, GameFlag } from './types';

/** Which ending a run is on track for. Widens to `1 | 2 | 3 | 4` in T16. */
export type EndingTrack = 1 | 2 | 3;

/**
 * The ending the run is currently bound for. Pure — same inputs, same answer.
 * `flags` is taken now so callers pass the live set (and so the signature is
 * ready for T15/T16 to branch on refusal / the Queen's Brand without a
 * ripple); today only the hollow state can move the needle.
 */
export function endingPending(flags: ReadonlySet<GameFlag>, brandHollow: boolean): EndingTrack {
  // Track 3 dominates: a dark brand has no ears for anything else.
  if (brandHollow) return 3;
  // Tracks 2 and 4 are gated on flags T15/T16 introduce; see the file header.
  // Referenced so the branch is honest about what it will read later.
  void flags;
  return 1;
}

// ─── the four endings: names, cards, and Vhaelis's one utterance ────────────
//
// The RESOLUTION logic (which ending a choice yields) is the pure `selectEnding`
// in engine/endings.ts; this is the prose the summit scene shows for each.
//
//   1 OATH KEPT   — lit, gave the crown back. The account closes.
//   2 OATH BROKEN — lit, kept the crown. The falling goes on.
//   3 HOLLOW      — arrived dark. The eye never opens. NO title card, by design.
//   4 THE FLAME THAT LENDS — gave the crown AND the queen's own brand (T16).

/** Short name for each ending — the endings tracker (T18) and credits use it. */
export const ENDING_NAME: Record<EndingId, string> = {
  1: 'OATH KEPT',
  2: 'OATH BROKEN',
  3: 'HOLLOW',
  4: 'THE FLAME THAT LENDS',
};

/**
 * The full-bleed title card each ending raises. Ending 3 shows NONE — the
 * hollow ending is silence and a slow fade, "the one people make videos about"
 * — so its entry is `null` and the summit scene skips straight to the credits.
 */
export const ENDING_CARD: Record<EndingId, { title: string; subtitle: string } | null> = {
  1: { title: 'OATH KEPT', subtitle: 'The crown returns to the fire that forged it. Vael ends as Vael — and the ash, at last, begins to settle.' },
  2: { title: 'OATH BROKEN', subtitle: 'You keep the crown, and the debt, and the long slow falling that comes with it. Vael buys another hundred years, in the dark.' },
  3: null,
  4: { title: 'THE FLAME THAT LENDS', subtitle: 'You brought the crown, and the one coal she hid from it. The loan is not called. It is forgiven.' },
};

/**
 * VHAELIS, the Flame That Lends, speaks ONCE ever — Ending 4 only, to the knight
 * who carried up BOTH the crown and the queen's own hidden brand. Litany voice,
 * the same terse image-then-turn as the inscriptions. (Ending 4 is unreachable
 * until T16 sets the 'queens-brand' flag; the lines are written now so T16 only
 * wires them.)
 */
export const VHAELIS_LINES: readonly string[] = [
  'You bring me my crown, little brand — and under your glove, one ember I never lent. Hers.',
  'Maren kept a single coal back from every fire I ever gave, and buried it in a green place, and let them call it a queen.',
  'A hundred years I waited for my embers to come home. I did not think one would climb to me on its own two feet, still burning.',
  'So. Kneel, keeper of the last unbroken oath — and keep it. What is carried to me freely, I have never once had to take.',
];

/** The credits crawl shown after every ending (DOM scroll). `%ENDING%` is
 *  replaced by the reached ending's name. CC0 asset + tool credits per the
 *  project's LICENSES.md. */
export const CREDITS_LINES: readonly string[] = [
  'OATHBRAND',
  'a game from the world of Iron Oath',
  '',
  '— your ending —',
  '%ENDING%',
  '',
  'design · code · words',
  'Stackrift',
  '',
  'built with',
  'Three.js · TypeScript · Vite',
  '',
  'art — KayKit dungeon & skeleton kits',
  'Kay Lousberg (CC0)',
  '',
  'type — Georgia · Courier New',
  '',
  'The brand remembers.',
  'Thank you for keeping the vigil.',
];
