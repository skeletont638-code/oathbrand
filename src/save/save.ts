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
    typeof o.ngPlus === 'boolean'
  );
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
