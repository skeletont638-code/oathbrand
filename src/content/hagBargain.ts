/**
 * The Hag's bargain (Greater Vael Drop 1, Task 5) — a PURE state machine. She
 * never fights, never chases, never speaks; the ONLY thing she does is trade.
 * This module encodes spec §6.4's bargain table verbatim and NOTHING else — no
 * three.js, no DOM, no persistence, no mutation of its input. `main.ts` applies
 * the returned state/flags/boon to the world (sets the flags, bumps the fog,
 * plays the vision, persists); the pure result is unit-tested to the row.
 *
 * The one number here — the full-brand ember cap — is tuning-sourced
 * (`TUNING.brand.maxEmbers`); `restoreEmberCap` lifts a Drop-spent cap back to
 * it when the player leaves Greater Vael or begins the next Vigil.
 */
import { TUNING } from './tuning';
import type { GameFlag, ZoneId } from './types';

/** The Hag's persisted state — MIRRORS `save.greaterVael`: the current ember
 *  cap (a tithe lowers it, persisting across the Drop) and the bargains struck. */
export interface HagState {
  maxEmberCap: number;
  bargains: string[];
}

/** What the player lays at the cairn. `decline` = turn away (a pure no-op). */
export type Offering = 'ember' | 'ledger' | 'kneel' | 'decline';

/**
 * The boon a bargain grants. Each is HELD for later Drops as a mystery — a
 * boon references the unanswered, it never answers it (the Watcher's identity
 * stays sealed for Drop 3).
 */
export type Boon =
  | { kind: 'fogline-part' } // Ashen Forest N fogFar +6 this visit + unseals the PD lore cache
  | { kind: 'play-vision'; visionId: 'gv-vision-hag' } // colour bleeds back like a banner-vision
  | { kind: 'answer-watcher' } // the next Watcher glimpse is "answered" — without answering it
  | { kind: 'none' };

export interface BargainResult {
  /** The NEW state — pure: `offerToHag` never mutates the state it is given. */
  state: HagState;
  boon: Boon;
  /** Flags the bargain sets (a subset of the hag-* flags). */
  flagsSet: GameFlag[];
}

/** The full-brand cap (5) — the ceiling `restoreEmberCap` returns to. */
const FULL_CAP = TUNING.brand.maxEmbers;

/** Spec §6.4's `fogline-part` magnitude: Ashen Forest N `fogFar +6 m` for the
 *  visit. Lives HERE with the table it belongs to (main reads it — one source). */
export const FOGLINE_PART_M = 6;

/**
 * The effective fog far for a zone VISIT (meters): the zone's own base far, plus
 * the fog-line boost — but ONLY in Ashen Forest N (the boon is armed run-wide,
 * yet it opens that forest's far-plane alone). This is the T10 fog-boost STACKING
 * guard: it always RECOMPUTES `base (+ boost)` from the un-boosted base rather
 * than accumulating. main.ts arms `forestBoostM` once (0 → FOGLINE_PART_M) and
 * calls this from BOTH enterZone and the `fogline-part` boon, so a repeat in-zone
 * tithe re-derives `base + 6` instead of doing `+= 6` twice (which would stack to
 * +12); re-entry is idempotent for the same reason.
 */
export function zoneVisitFogFarM(args: {
  zone: ZoneId;
  zoneBaseFarM: number;
  forestBoostM: number;
}): number {
  return args.zone === 'ashen-forest-n' ? args.zoneBaseFarM + args.forestBoostM : args.zoneBaseFarM;
}

/** The cap floor the wiring enforces on the tithe: the Hag never caps the brand
 *  below one ember (a 0-cap brand would rekindle to nothing yet not be hollow —
 *  a broken state). `offerToHag` itself stays the exact §6.4 row; main gates
 *  the TITHE offering off this. */
export const MIN_EMBER_CAP = 1;

/** A fresh copy of a state (so every result is a new object, input untouched). */
function clone(state: HagState): HagState {
  return { maxEmberCap: state.maxEmberCap, bargains: [...state.bargains] };
}

/** A state that has struck one more bargain (append, never replace). */
function withBargain(state: HagState, capDelta: number, flag: GameFlag): HagState {
  return {
    maxEmberCap: state.maxEmberCap + capDelta,
    bargains: [...state.bargains, flag],
  };
}

/**
 * Resolve one offering at the cairn. Encodes spec §6.4 EXACTLY:
 *
 *  - `ember`   place one live ember → `maxEmberCap -= 1` (persists for the Drop),
 *              boon `fogline-part`, sets `hag-tithed`.
 *  - `ledger`  surrender the Cinder tithe-ledger (requires `hasLedger`) → no
 *              ember cost, boon `play-vision` (gv-vision-hag), sets
 *              `hag-ledger-given`. WITHOUT the ledger it is a no-op.
 *  - `kneel`   kneel with a full brand → nothing now (seeds a Second-Vigil
 *              anomaly), boon `answer-watcher`, sets `hag-kneeled`.
 *  - `decline` turn away → nothing; boon `none`; no flags. The threshold keeps.
 */
export function offerToHag(
  offering: Offering,
  state: HagState,
  hasLedger: boolean,
): BargainResult {
  switch (offering) {
    case 'ember':
      return {
        state: withBargain(state, -1, 'hag-tithed'),
        boon: { kind: 'fogline-part' },
        flagsSet: ['hag-tithed'],
      };
    case 'ledger':
      if (!hasLedger) return { state: clone(state), boon: { kind: 'none' }, flagsSet: [] };
      return {
        state: withBargain(state, 0, 'hag-ledger-given'),
        boon: { kind: 'play-vision', visionId: 'gv-vision-hag' },
        flagsSet: ['hag-ledger-given'],
      };
    case 'kneel':
      return {
        state: withBargain(state, 0, 'hag-kneeled'),
        boon: { kind: 'answer-watcher' },
        flagsSet: ['hag-kneeled'],
      };
    case 'decline':
      return { state: clone(state), boon: { kind: 'none' }, flagsSet: [] };
  }
}

/**
 * Leaving Greater Vael (the door out) or beginning the next Vigil lifts the
 * ember cap back to the full brand. Pure — the struck `bargains` are kept
 * (knowledge persists; only the brand's ceiling is restored).
 */
export function restoreEmberCap(state: HagState): HagState {
  return { maxEmberCap: FULL_CAP, bargains: [...state.bargains] };
}

/**
 * The ember cap to BOOT / resume with (spec §6.4). A Hag tithe lowers the cap
 * only WITHIN Greater Vael, so a save whose RESUME zone is not an exterior GV
 * zone must boot at the full brand — otherwise a tithe → quit-in-castle → reload
 * leaves the castle capped forever (the persistGreaterVael write banks the tithed
 * cap onto a save whose `zone` may still point at a castle banner, and boot read
 * it back unconditionally). Pure; main persists the restored value so the next
 * reload can't resurrect the tithed cap. `savedCap` absent ⇒ the full brand.
 *
 * GV BOUNDARY (Drop 1): "inside Greater Vael" ≡ `resumeZoneKind === 'exterior'`
 * (the four Drop-1 exteriors). Drop 2's interior GV sub-zones (Drowned Chapel,
 * Root-Crypt) will need an explicit GV zone-set instead of leaning on `kind`.
 */
export function bootEmberCap(args: {
  savedCap: number | undefined;
  resumeZoneKind: 'interior' | 'exterior' | undefined;
}): number {
  const cap = args.savedCap ?? FULL_CAP;
  return args.resumeZoneKind === 'exterior' ? cap : FULL_CAP;
}
