/**
 * The DreadDirector (Task 3) — the pure scheduler behind "the engine notices
 * IT". It watches the player each frame and, at most once per frame, decides a
 * single authored scare beat may fire. No three.js, no DOM, no clock of its
 * own: time is the `dtMs` the caller feeds `update`, and randomness is the
 * injected per-run `rng` (main seeds it `mulberry32(runSeed)`), so the whole
 * thing replays deterministically under a scripted rng + fake clock.
 *
 * It never renders anything — it EMITS `ScareActivation[]` for main to route to
 * the ScreenScareKit / AudioManager / presence systems. Every binding rule the
 * spec pins is enforced HERE and unit-tested (see dreadDirector.test.ts):
 *
 *  1. Shared cooldown — after any activation, a single ≥ minScareGapSec (90 s)
 *     cooldown blocks EVERY scare type (Watcher/Hag included).
 *  2. Never in combat — `ctx.inCombat` suppresses all activations and does NOT
 *     consume the cooldown.
 *  3. Damage 0 — a ScareActivation has no damage field; the type makes a
 *     damaging scare unrepresentable.
 *  4. Banner never spoofed — there is no code path that targets the player's
 *     banner/kneel; a `kneel` trigger only READS a completed kneel.
 *  5. Gimmick cap — each screen gimmick fires at most gimmickUseMax (2×)/drop.
 *  6. Beat ceiling — `beatsFired` never exceeds maxBeatsPerDrop (10).
 *  7. False-pulse — a `seededClearing` beat fires only on the run-seeded
 *     crossing and at most falsePulsePerZoneMax (2) per zone.
 *  8. Fidelity scarcity — the first fire of a gimmick banks its id in
 *     `glitchSeen`; a later fire is still allowed (up to the cap) but flagged
 *     `everSeen` so the kit can render it shorter/weaker.
 *  9. Watcher budget — `watcherSightings` caps at watcherPerDropMax (6).
 */
import { TUNING } from '../content/tuning';
import type { ZoneId } from '../content/types';
import type { GridPos, HagThresholdDef, ScareBeat } from '../world/zoneDef';

const D = TUNING.greaterVael.dread;

/** The universal 2 m grid (zoneDef: "Cell size in meters — always 2"). */
const CELL_M = 2;

/**
 * The window (1..N crossings) the run seed picks the false-pulse from. Wider
 * than falsePulsePerZoneMax so the seeded visit can land late — the player
 * can cross the clearing several times before it ignites once.
 */
export const FALSE_PULSE_VISIT_WINDOW = 3;

/** Per-frame world view the DreadDirector evaluates its triggers against. */
export interface DreadCtx {
  zone: ZoneId;
  cell: GridPos;
  dtMs: number;
  inCombat: boolean;
  brandPulse: number;
  events:
    | { kind: 'loreRead'; loreId: string }
    | { kind: 'kneel' }
    | { kind: 'none' };
  /** Set the frame a VistaDef fires (for PD-1's `vista` trigger). */
  vistaFiredId?: string;
}

/** The screen gimmicks that share the per-gimmick usage cap (rule 5). */
type ScreenGimmick = 'snap-grid' | 'resolution-drop' | 'desaturation' | 'silence-spike' | 'false-pulse';
const SCREEN_GIMMICKS: ReadonlySet<string> = new Set<ScreenGimmick>([
  'snap-grid', 'resolution-drop', 'desaturation', 'silence-spike', 'false-pulse',
]);

/**
 * What the DreadDirector emits for main to route. NOTE (rule 3): no variant
 * carries a damage field — a scare that hurts the player is not expressible.
 */
export type ScareActivation =
  | { kind: ScreenGimmick; beatId: string; oneLine: string; everSeen: boolean }
  | { kind: 'pure-visual'; beatId: string; oneLine: string; everSeen: boolean }
  | { kind: 'watcher'; anchor: GridPos; beatId?: string }
  | { kind: 'hag-glimpse'; beatId?: string }; // beatId absent ⇒ a threshold glimpse

/** Distance in meters between two grid cells (2 m grid). */
function cellDistM(a: GridPos, b: GridPos): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) * CELL_M;
}

function inCells(cell: GridPos, cells: GridPos[]): boolean {
  return cells.some(([r, c]) => r === cell[0] && c === cell[1]);
}

export class DreadDirector {
  private cooldownMs = 0;
  private firedBeats = 0;
  private sightings: number;
  private readonly glitchSeen: Set<string>;
  /** Per-gimmick usage counter (rule 5), keyed by the screen-gimmick id. */
  private readonly gimmickUse = new Map<string, number>();
  /** False-pulse fires already spent per zone (rule 7). */
  private readonly falsePulseByZone = new Map<ZoneId, number>();
  /** Per seededClearing beat: crossings so far + the seed-chosen target crossing. */
  private readonly clearingVisits = new Map<string, { visits: number; target: number }>();
  /** Per timer beat: accumulated ms spent near its `at` (fires at `minSec`). */
  private readonly timerDwell = new Map<string, number>();
  /** Previous frame's cell, for crossing-edge detection; null resets on zone change. */
  private prevCell: GridPos | null = null;
  private lastZone: ZoneId | null = null;

  constructor(
    private readonly scares: ScareBeat[],
    /** Watcher anchors KEYED BY ZONE (T5 review): one run-scoped director spans
     *  every exterior zone, so a beat's manifest anchor must come from the beat's
     *  OWN zone — never another zone's flattened in. */
    private readonly anchorsByZone: Partial<Record<ZoneId, GridPos[]>>,
    private readonly hag: HagThresholdDef | undefined,
    state: { glitchSeen: string[]; watcherSightings: number },
    private readonly rng: () => number,
  ) {
    this.glitchSeen = new Set(state.glitchSeen);
    this.sightings = state.watcherSightings;
    // Bank the seeded target crossing for every false-pulse beat, once, at
    // construction — so the choice is stable for the whole run.
    for (const beat of this.scares) {
      if (beat.trigger.on === 'seededClearing') {
        const target = 1 + Math.floor(this.rng() * FALSE_PULSE_VISIT_WINDOW);
        this.clearingVisits.set(beat.id, { visits: 0, target });
      }
    }
  }

  /** Seconds left on the shared scare cooldown (rule 1). */
  get cooldownRemainingSec(): number {
    return this.cooldownMs / 1000;
  }

  /** Authored beats fired this drop (capped at maxBeatsPerDrop). */
  get beatsFired(): number {
    return this.firedBeats;
  }

  /** Watcher sightings this drop (capped at watcherPerDropMax). */
  get watcherSightings(): number {
    return this.sightings;
  }

  /** The persistable slice for the save (banked at each kneel checkpoint). */
  snapshot(): { glitchSeen: string[]; watcherSightings: number } {
    return { glitchSeen: [...this.glitchSeen], watcherSightings: this.sightings };
  }

  /**
   * Evaluate the frame. Returns the activations for this frame — 0 entries when
   * nothing fires, or the one chosen beat's activation(s) (a `showsWatcher`
   * beat returns two: its gimmick AND the Watcher, the same beat).
   */
  update(ctx: DreadCtx): ScareActivation[] {
    // A single shared clock: the cooldown always ticks down (time passes even
    // in combat — combat only blocks NEW fires, it never resets the cooldown).
    this.cooldownMs = Math.max(0, this.cooldownMs - ctx.dtMs);

    // Crossing-edge bookkeeping runs every frame (a physical clearing crossing
    // counts toward the seeded visit whether or not a fire is allowed). A zone
    // change is not a crossing — reset the baseline.
    if (this.lastZone !== ctx.zone) {
      this.prevCell = null;
      this.lastZone = ctx.zone;
    }
    const prev = this.prevCell;
    const crossedInto = (cells: GridPos[]): boolean =>
      prev !== null && inCells(ctx.cell, cells) && !inCells(prev, cells);
    for (const beat of this.scares) {
      if (beat.zone !== ctx.zone) continue;
      if (beat.trigger.on === 'seededClearing' && crossedInto(beat.trigger.cells)) {
        const v = this.clearingVisits.get(beat.id);
        if (v) v.visits += 1;
      } else if (beat.trigger.on === 'timer' && cellDistM(ctx.cell, beat.trigger.at) <= CELL_M * 3) {
        // Accumulate dwell near the spot; the trigger fires once minSec passes.
        this.timerDwell.set(beat.id, (this.timerDwell.get(beat.id) ?? 0) + ctx.dtMs);
      }
    }
    // Record this frame's cell as the baseline BEFORE the fire gates, so the
    // next frame's crossing detection is correct regardless of what fires.
    this.prevCell = ctx.cell;

    // Rule 2: no scare while in combat, and the cooldown is not consumed.
    if (ctx.inCombat) return [];
    // Rule 1: the shared cooldown blocks every scare type.
    if (this.cooldownMs > 0) return [];

    // At most one thing fires per frame. Authored beats first (subject to the
    // rule-6 beat ceiling), then the Hag threshold (not a beat → not ceiling-
    // gated, but it still consumes the shared cooldown — rule 1).
    if (this.firedBeats < D.maxBeatsPerDrop) {
      for (const beat of this.scares) {
        if (beat.zone !== ctx.zone) continue;
        if (!this.triggerMatches(beat, ctx, crossedInto)) continue;
        if (!this.passesCaps(beat, ctx.zone)) continue;
        return this.fire(beat, ctx.zone);
      }
    }
    if (this.hag && crossedInto(this.hag.glimpseCells)) {
      this.cooldownMs = D.minScareGapSec * 1000;
      return [{ kind: 'hag-glimpse' }]; // no beatId ⇒ a threshold glimpse
    }
    return [];
  }

  private triggerMatches(
    beat: ScareBeat,
    ctx: DreadCtx,
    crossedInto: (cells: GridPos[]) => boolean,
  ): boolean {
    const t = beat.trigger;
    switch (t.on) {
      case 'cellEnter':
        return crossedInto(t.cells);
      case 'approach':
        return cellDistM(ctx.cell, t.at) <= t.withinM;
      case 'brandPulse':
        return ctx.brandPulse > 0 && cellDistM(ctx.cell, t.at) <= t.withinM;
      case 'kneel':
        // Rule 4: a kneel trigger only READS a completed kneel; it never
        // spoofs one. Optional `at` also requires being at that banner.
        return ctx.events.kind === 'kneel' && (t.at === undefined || cellDistM(ctx.cell, t.at) <= CELL_M);
      case 'loreRead':
        return ctx.events.kind === 'loreRead' && ctx.events.loreId === t.loreId;
      case 'vista':
        return ctx.vistaFiredId === t.vistaId;
      case 'timer':
        // Fires once the player has dwelt near `at` for minSec (accumulated in
        // the per-frame bookkeeping above), and is still near it.
        return (this.timerDwell.get(beat.id) ?? 0) >= t.minSec * 1000
          && cellDistM(ctx.cell, t.at) <= CELL_M * 3;
      case 'seededClearing': {
        const v = this.clearingVisits.get(beat.id);
        return v !== undefined && crossedInto(t.cells) && v.visits === v.target;
      }
      default:
        return false;
    }
  }

  private passesCaps(beat: ScareBeat, zone: ZoneId): boolean {
    const g = beat.gimmick;
    if (g !== null && SCREEN_GIMMICKS.has(g)) {
      if ((this.gimmickUse.get(g) ?? 0) >= D.gimmickUseMax) return false; // rule 5
    }
    if (g === 'false-pulse') {
      if ((this.falsePulseByZone.get(zone) ?? 0) >= D.falsePulsePerZoneMax) return false; // rule 7
    }
    // Rule 9: a Watcher sighting (a `watcher` beat OR a showsWatcher rider)
    // must fit the budget.
    if (g === 'watcher' || beat.showsWatcher) {
      if (this.sightings >= D.watcherPerDropMax) return false;
    }
    return true;
  }

  private fire(beat: ScareBeat, zone: ZoneId): ScareActivation[] {
    // Rule 1: the fire (re)starts the full shared cooldown.
    this.cooldownMs = D.minScareGapSec * 1000;
    this.firedBeats += 1;
    const out: ScareActivation[] = [];
    const g = beat.gimmick;

    if (g === null) {
      out.push({ kind: 'pure-visual', beatId: beat.id, oneLine: beat.oneLine, everSeen: this.seen('pure-visual') });
    } else if (SCREEN_GIMMICKS.has(g)) {
      const everSeen = this.seen(g);
      this.gimmickUse.set(g, (this.gimmickUse.get(g) ?? 0) + 1);
      if (g === 'false-pulse') this.falsePulseByZone.set(zone, (this.falsePulseByZone.get(zone) ?? 0) + 1);
      out.push({ kind: g as ScreenGimmick, beatId: beat.id, oneLine: beat.oneLine, everSeen });
    } else if (g === 'watcher') {
      this.sightings += 1;
      out.push({ kind: 'watcher', anchor: this.pickAnchor(beat), beatId: beat.id });
    } else if (g === 'hag-glimpse') {
      out.push({ kind: 'hag-glimpse', beatId: beat.id });
    }

    // A showsWatcher rider on a non-watcher beat manifests the Watcher in the
    // SAME activation frame (rule 9). Two entries for one beat is allowed.
    if (beat.showsWatcher && g !== 'watcher') {
      this.sightings += 1;
      out.push({ kind: 'watcher', anchor: this.pickAnchor(beat), beatId: beat.id });
    }
    return out;
  }

  /** True if `id` was already banked (this run or a prior save); banks it now. */
  private seen(id: string): boolean {
    const before = this.glitchSeen.has(id);
    this.glitchSeen.add(id);
    return before;
  }

  /** Resolve the Watcher's manifest anchor for a beat — from the beat's OWN
   *  zone's anchors only (never another zone's; T5 review). */
  private pickAnchor(beat: ScareBeat): GridPos {
    const zoneAnchors = this.anchorsByZone[beat.zone] ?? [];
    if (zoneAnchors.length > 0) {
      // Cycle this zone's authored anchors so successive sightings vary position.
      return zoneAnchors[(this.sightings - 1 + zoneAnchors.length) % zoneAnchors.length];
    }
    // Fall back to the beat's own location so an anchor is always defined.
    const t = beat.trigger;
    if (t.on === 'approach' || t.on === 'brandPulse' || t.on === 'timer') return t.at;
    if (t.on === 'cellEnter' || t.on === 'seededClearing') return t.cells[0] ?? [0, 0];
    if (t.on === 'kneel' && t.at) return t.at;
    return [0, 0];
  }
}
