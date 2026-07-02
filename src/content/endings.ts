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
import type { GameFlag } from './types';

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
