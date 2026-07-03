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
 * every save round-trips unchanged (absent ⇒ a fresh dread ledger).
 *
 * Task 7 (schema v2) makes this block schema-official and adds `open` — the
 * persisted mirror of the `greater-vael-open` flag (the postern unsealed).
 * The Task-3/5 field names/shapes are adopted VERBATIM (`glitchSeen`,
 * `watcherSightings`, optional `maxEmberCap`, optional `bargains`).
 */
export interface DreadSave {
  /** Mirrors the `greater-vael-open` flag: the postern is unsealed (v2, Task 7).
   *  Absent on v1/Task-3/5 saves; the migration derives it from `endingsSeen`. */
  open?: boolean;
  glitchSeen: string[];
  watcherSightings: number;
  /** The Hag-bargain ember cap (Task 5): a tithe lowers it, persisting across
   *  Drop 1 until the player leaves Greater Vael. Absent ⇒ the full brand. */
  maxEmberCap?: number;
  /** The Hag bargains struck this drop (mirrors HagState). Absent ⇒ none. */
  bargains?: string[];
}

/** Fields shared by every save-schema version. */
interface SaveDataBase {
  zone: ZoneId;
  bannerId: string;
  embers: number;
  flags: GameFlag[];
  endingsSeen: EndingId[];
  loreRead: string[];
  visionsSeen: string[];
  ngPlus: boolean;
  /** Greater Vael dread ledger (Task 3); absent on castle-only saves. */
  greaterVael?: DreadSave;
}

/**
 * The pre-v2 save shape, retained as the migration input type. A "real" v1 save
 * predates Greater Vael and has no `greaterVael`; live Drop-1 saves may already
 * carry a Task-3/5 ledger (which the migration preserves, never drops).
 */
export interface SaveDataV1 extends SaveDataBase {
  version: 1;
}

/**
 * The current save shape. `version` is `1 | 2` because the game still writes
 * version-1 checkpoints (see main.ts) that `loadGame` migrates to v2 on read;
 * `migrateV1toV2`/`secondVigilSave` produce version 2 — the canonical shape.
 */
export interface SaveData extends SaveDataBase {
  version: 1 | 2;
}

export const SAVE_KEY = 'oathbrand.save.v1';

/** The full brand — the ember cap a fresh dread ledger defaults to (Task 5).
 *  Mirrors `TUNING.brand.maxEmbers`; kept as a literal so save.ts stays free of
 *  tuning/content imports (the load-site convention: absent ⇒ the full brand). */
const DEFAULT_EMBER_CAP = 5;

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

/**
 * Structural check so a tampered/malformed payload can't crash gameplay.
 * Accepts version 1 OR 2 (Task 7); the dread ledger, if present, must be
 * well-formed for either version (a malformed one is repaired at the load site,
 * not rejected here — see `loadGame`).
 */
function isSaveData(v: unknown): v is SaveData {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    (o.version === 1 || o.version === 2) &&
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
  if (!(isStringArray(o.glitchSeen) && typeof o.watcherSightings === 'number')) return false;
  // `open` (v2, Task 7) is optional + additive: if present it must be a boolean.
  if (o.open !== undefined && typeof o.open !== 'boolean') return false;
  // The Task-5 Hag slice is optional + additive: if present it must be well-formed.
  if (o.maxEmberCap !== undefined && typeof o.maxEmberCap !== 'number') return false;
  if (o.bargains !== undefined && !isStringArray(o.bargains)) return false;
  return true;
}

/** A fresh dread ledger (Task 5 default cap + no bargains/glitches spent). */
function freshDread(open: boolean): DreadSave {
  return { open, glitchSeen: [], watcherSightings: 0, maxEmberCap: DEFAULT_EMBER_CAP, bargains: [] };
}

/**
 * Pure v1→v2 migration (Task 7): copies EVERY v1 field, bumps to version 2, and
 * formalizes the greater-Vael ledger. A beaten-castle save (any ending seen) is
 * carried into Greater Vael with the postern unsealed — never discarded.
 * Any live Task-3/5 ledger is PRESERVED (lossless); only the new `open` mirror
 * is derived. This supersedes the v1 "discard on version mismatch" rule for the
 * 1→2 step specifically.
 */
export function migrateV1toV2(v1: SaveDataV1): SaveData {
  const prev = v1.greaterVael;
  return {
    ...v1,
    version: 2,
    greaterVael: {
      open: prev?.open ?? v1.endingsSeen.length > 0,
      glitchSeen: prev?.glitchSeen ?? [],
      watcherSightings: prev?.watcherSightings ?? 0,
      maxEmberCap: prev?.maxEmberCap ?? DEFAULT_EMBER_CAP,
      bargains: prev?.bargains ?? [],
    },
  };
}

/**
 * A malformed `greaterVael` degrades to a fresh ledger per-block — never sinks
 * the whole save. Absent or well-formed ledgers are returned untouched (so a
 * clean v2 save round-trips exactly). Applied before validation in `loadGame`.
 */
function repairGreaterVael(o: Record<string, unknown>): Record<string, unknown> {
  const gv = o.greaterVael;
  if (gv === undefined || isDreadSave(gv)) return o;
  const open = Array.isArray(o.endingsSeen) && o.endingsSeen.length > 0;
  return { ...o, greaterVael: freshDread(open) };
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
    if (typeof parsed !== 'object' || parsed === null) return null;
    // Repair a malformed dread ledger first, so a corrupt block defaults to a
    // fresh ledger rather than sinking the whole save (Task 7).
    const o = repairGreaterVael(parsed as Record<string, unknown>);

    // A version-1 payload is migrated to v2 and written back in place, so a
    // beaten-castle save carries into Greater Vael and the next load is already
    // v2 (this supersedes the version-mismatch drop for the 1→2 step).
    if (o.version === 1) {
      if (!isSaveData(o)) return null;
      const migrated = migrateV1toV2(o as SaveDataV1);
      saveGame(migrated);
      return migrated;
    }

    // v2 (and any future-but-valid shape isSaveData accepts) loads as-is; an
    // unknown version (0, ≥3) still returns null → a fresh start.
    return isSaveData(o) ? o : null;
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
 * the reload. Pure, so the reset-vs-persist contract is unit-tested. Writes the
 * v2 schema (Task 7).
 *
 * RESET (the castle re-seals): every progression flag is cleared — gatekey,
 * shortcut-open, throne-open, forsworn-dead/noguard, callun-tachi, queens-brand,
 * garden-found, wraith-hunt-done — the run restarts at the Ashen Gate with a
 * full brand and no checkpoint. PERSIST (knowledge carries across Vigils):
 * endingsSeen, loreRead, visionsSeen. `ngPlus` is forced true, so a THIRD Vigil
 * (calling this on an already-NG+ save) is identical to the second — the
 * anomalies are static, they do not escalate.
 *
 * The `greaterVael` ledger is intentionally DROPPED (absent), which is how the
 * Hag-tithed ember cap restores on a new Vigil (Task 5's `restoreEmberCap`): on
 * the next load `save.greaterVael?.maxEmberCap` is undefined, so the brand's
 * ceiling defaults back to the full brand. Knowledge of the postern does not
 * carry as save state — a re-sealed castle re-opens Greater Vael by play.
 */
export function secondVigilSave(prev: SaveData | null, maxEmbers: number): SaveData {
  return {
    version: 2,
    zone: 'ashen-gate',
    bannerId: '',
    embers: maxEmbers,
    flags: [], // the castle re-seals — every gate, key, and kill is undone
    endingsSeen: prev?.endingsSeen ?? [], // knowledge persists
    loreRead: prev?.loreRead ?? [],
    visionsSeen: prev?.visionsSeen ?? [],
    ngPlus: true, // second — and every later — Vigil
    // greaterVael dropped — the tithed ember cap restores to the full brand.
  };
}
