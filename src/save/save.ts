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
  /** Authored scare beats already fired this drop (finding 1): each beat is
   *  one-shot per drop, so the ids survive a reload and a spent beat never
   *  re-arms. OPTIONAL + additive — absent on pre-fix v2 saves ⇒ none fired. */
  firedBeatIds?: string[];
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
  /**
   * Canonical edge ids of far-side doors opened for good (world-expansion
   * v1.2, Task 1 — see `world/doors.ts`). OPTIONAL + additive: absent on every
   * pre-v1.2 save ⇒ no door has been unbarred yet (a fresh `[]` at the load
   * site). Second Vigil drops it (the castle re-seals — far-side doors re-bar).
   */
  doorsOpened?: string[];
  /**
   * Echo-scene ids already witnessed this run (world-expansion v1.2, Task 3 —
   * see `engine/EchoScene.ts`). OPTIONAL + additive: absent on every pre-v1.2
   * save ⇒ no apparition has played yet (a fresh `[]` at the load site). Second
   * Vigil DROPS it (like `doorsOpened`) so every echo re-arms in NG+ — the sole
   * replay condition (scenes are otherwise one-shot per run).
   */
  echoesWitnessed?: string[];
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
 * The current save shape. `version` is `1 | 2` because a PRE-v2 save may still
 * exist in a player's localStorage: `loadGame` accepts it and migrates it to v2
 * on read (in place). The game itself now only ever WRITES version 2 — every
 * checkpoint (`main.ts onSave`), `migrateV1toV2`, and `secondVigilSave` produce
 * the canonical v2 shape (the old version-1 checkpoint write was retired in T7).
 */
export interface SaveData extends SaveDataBase {
  version: 1 | 2;
}

export const SAVE_KEY = 'oathbrand.save.v1';

/**
 * Zone-id aliases (world-expansion v1.2 seamless traversal). When a floor-pair
 * merges into one continuous-climb zone, the retired ids may still live in a
 * player's localStorage `zone` field — the owner's own save must survive the
 * merge. `loadGame` rewrites `zone` through this table on read (before validation
 * and migration, so the resolved id is what persists), and any zone the game no
 * longer knows loads into its surviving replacement with no data loss.
 *
 * EXTENSIBLE: Task 13 merged the watchtower (tower-ground + tower-upper → the one
 * `watchtower` zone); Task 14 merged the Hall Gallery INTO the Great Hall as a
 * mezzanine (`hall-gallery` → `great-hall`, so a save on the old gallery floor
 * lands in the hall — the closest surviving space). Tasks 15–16 add their own
 * entries here as the manor and chapel floor-pairs merge — one line per retired id.
 */
export const ZONE_ALIASES: Readonly<Record<string, ZoneId>> = {
  'tower-ground': 'watchtower',
  'tower-upper': 'watchtower',
  'hall-gallery': 'great-hall',
};

/** Resolve a possibly-retired zone id to the surviving zone (identity for a
 *  current id). Pure; the single seam every load path routes `zone` through. */
export function resolveZoneAlias(zone: string): ZoneId {
  return (Object.hasOwn(ZONE_ALIASES, zone) ? ZONE_ALIASES[zone] : zone) as ZoneId;
}

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
    isDreadSave(o.greaterVael) &&
    // `doorsOpened` (v1.2) is optional + additive: absent is valid; if present
    // it must be a string[] (a malformed one can't crash `new Set(...)`).
    (o.doorsOpened === undefined || isStringArray(o.doorsOpened)) &&
    // `echoesWitnessed` (v1.2, Task 3) — same optional + additive contract.
    (o.echoesWitnessed === undefined || isStringArray(o.echoesWitnessed))
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
  // The finding-1 one-shot ledger is optional + additive: string[] if present.
  if (o.firedBeatIds !== undefined && !isStringArray(o.firedBeatIds)) return false;
  return true;
}

/** A fresh dread ledger (Task 5 default cap + no bargains/glitches spent). */
function freshDread(open: boolean): DreadSave {
  return {
    open,
    glitchSeen: [],
    watcherSightings: 0,
    maxEmberCap: DEFAULT_EMBER_CAP,
    bargains: [],
    firedBeatIds: [],
  };
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
      firedBeatIds: prev?.firedBeatIds ?? [],
    },
  };
}

/**
 * The greaterVael block a main.ts checkpoint writes (Task 13, T7 obligation).
 * Copies the live dread ledger + Hag slice and mirrors the REAL
 * `greater-vael-open` flag into `open`, so a v2 checkpoint is authoritative and
 * self-describing — no longer a version-1 payload the migration back-fills on
 * read (which made `open` inert and oscillated the stored version every
 * save/load). Kept here (not inline in main.ts's start-scene closure) so the
 * write shape is unit-tested and every checkpoint site writes an identical
 * block. Arrays are copied so a later mutation of the run-state source can
 * never leak into a written save.
 */
export function greaterVaelCheckpoint(live: {
  open: boolean;
  glitchSeen: string[];
  watcherSightings: number;
  maxEmberCap: number;
  bargains: string[];
  firedBeatIds?: string[];
}): DreadSave {
  return {
    open: live.open,
    glitchSeen: [...live.glitchSeen],
    watcherSightings: live.watcherSightings,
    maxEmberCap: live.maxEmberCap,
    bargains: [...live.bargains],
    firedBeatIds: [...(live.firedBeatIds ?? [])],
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

    // Rewrite a retired zone id to its surviving replacement BEFORE validation +
    // migration (Task 13): a save that resumed in tower-ground/tower-upper loads
    // into the merged `watchtower` zone, and the migration/write-back persists the
    // resolved id so the next load is already current. Applied in place; a
    // non-string zone falls through to isSaveData's rejection below.
    if (typeof o.zone === 'string') o.zone = resolveZoneAlias(o.zone);

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
    // doorsOpened + echoesWitnessed intentionally DROPPED (absent): far-side
    // doors re-bar and every echo scene re-arms — NG+ is the only replay path.
  };
}
