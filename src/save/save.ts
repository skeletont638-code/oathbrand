/**
 * Save persistence — one localStorage slot, written when the player kneels
 * at a banner (rekindle) and on other checkpoint moments later tasks add.
 *
 * Contract: NEVER throw. Corrupted JSON, an unknown version, a malformed
 * payload, quota/security errors, or a missing localStorage (node, locked
 * browsers) all degrade to "no save" (null) or a silently dropped write —
 * a failed save must never take the game down with it.
 */
import type { EndingId, GameFlag, ZoneId } from '../content/types';

/**
 * Greater Vael Drop 1 dread state that survives reloads (Task 3): which glitch
 * gimmicks have been seen (fidelity scarcity — a seen glitch renders shorter)
 * and how many Watcher sightings the drop has spent. OPTIONAL and additive, so
 * every v1 save round-trips unchanged (absent ⇒ a fresh dread ledger).
 */
export interface DreadSave {
  glitchSeen: string[];
  watcherSightings: number;
}

export interface SaveData {
  version: 1;
  zone: ZoneId;
  bannerId: string;
  embers: number;
  flags: GameFlag[];
  endingsSeen: EndingId[];
  loreRead: string[];
  visionsSeen: string[];
  ngPlus: boolean;
  /** Greater Vael dread ledger (Task 3); absent on v1/castle-only saves. */
  greaterVael?: DreadSave;
}

export const SAVE_KEY = 'oathbrand.save.v1';

/** localStorage, or null when absent/locked (never throws). */
function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    // Property access alone can throw (Safari private mode, blocked cookies).
    return typeof localStorage === 'undefined' || localStorage === undefined
      ? null
      : localStorage;
  } catch {
    return null;
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** Structural check so a tampered/malformed payload can't crash gameplay. */
function isSaveData(v: unknown): v is SaveData {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.version === 1 &&
    typeof o.zone === 'string' &&
    typeof o.bannerId === 'string' &&
    typeof o.embers === 'number' &&
    isStringArray(o.flags) &&
    Array.isArray(o.endingsSeen) &&
    o.endingsSeen.every((x) => typeof x === 'number') &&
    isStringArray(o.loreRead) &&
    isStringArray(o.visionsSeen) &&
    typeof o.ngPlus === 'boolean' &&
    isDreadSave(o.greaterVael)
  );
}

/** The optional dread ledger: absent is valid; if present it must be well-formed. */
function isDreadSave(v: unknown): v is DreadSave | undefined {
  if (v === undefined) return true;
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isStringArray(o.glitchSeen) && typeof o.watcherSightings === 'number';
}

export function saveGame(d: SaveData): void {
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(d));
  } catch {
    // Quota exceeded / security error: drop the write, keep playing.
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSaveData(parsed) ? parsed : null;
  } catch {
    return null; // corrupted JSON or a throwing storage → fresh start
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    // Nothing sensible to do; the next loadGame() will still behave.
  }
}

/**
 * The Second Vigil save (Task 16) — what "KEEP THE VIGIL AGAIN" writes before
 * the reload. Pure, so the reset-vs-persist contract is unit-tested.
 *
 * RESET (the castle re-seals): every progression flag is cleared — gatekey,
 * shortcut-open, throne-open, forsworn-dead/noguard, callun-tachi, queens-brand,
 * garden-found, wraith-hunt-done — the run restarts at the Ashen Gate with a
 * full brand and no checkpoint. PERSIST (knowledge carries across Vigils):
 * endingsSeen, loreRead, visionsSeen. `ngPlus` is forced true, so a THIRD Vigil
 * (calling this on an already-NG+ save) is identical to the second — the
 * anomalies are static, they do not escalate.
 */
export function secondVigilSave(prev: SaveData | null, maxEmbers: number): SaveData {
  return {
    version: 1,
    zone: 'ashen-gate',
    bannerId: '',
    embers: maxEmbers,
    flags: [], // the castle re-seals — every gate, key, and kill is undone
    endingsSeen: prev?.endingsSeen ?? [], // knowledge persists
    loreRead: prev?.loreRead ?? [],
    visionsSeen: prev?.visionsSeen ?? [],
    ngPlus: true, // second — and every later — Vigil
  };
}
