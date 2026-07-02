/**
 * VistaDirector — the scripted vista reveal (Task 11; spec §9 clip #1, the
 * game's signature shot and README GIF). Pure envelope logic, NO three.js:
 * main.ts feeds it the player's grid cell each frame and applies its two
 * outputs to the renderer:
 *
 * - `fogFarBoost` (0 → +16m): added to the zone's fog far-plane, opening
 *   the ashen horizon 12→28m;
 * - `camLift` (0 → +0.8m): added to the camera eye height, rising over the
 *   parapet line.
 *
 * Direction: a 2.5s eased swell to the peak, then a 1.5s eased return —
 *4s total, NON-BLOCKING (the player keeps walking; the world simply opens
 * around them; must read in a 9:16 phone crop). One-shot per save: fired
 * ids live in a seen-set seeded from `SaveData.visionsSeen` and merged
 * back on the next banner checkpoint. `update` only ticks while the game
 * simulates, so pausing freezes the swell mid-breath.
 */
import type { VistaDef } from './zoneDef';

/** Swell to the peak, ms (spec: "scripted ~2.5s"). */
export const VISTA_SWELL_MS = 2500;
/** Ease back to baseline, ms. */
export const VISTA_RETURN_MS = 1500;
/** Fog far-plane boost at the peak, meters (12 → 28). */
export const VISTA_FOG_BOOST_M = 16;
/** Camera eye lift at the peak, meters. */
export const VISTA_CAM_LIFT_M = 0.8;

/** Symmetric cubic ease: gentle first breath, gliding arrival. */
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export class VistaDirector {
  private readonly seen: Set<string>;
  private playing = false;
  private elapsed = 0;

  constructor(seenIds: Iterable<string> = []) {
    this.seen = new Set(seenIds);
  }

  /**
   * Report the player's current grid cell. If the zone's vista exists, is
   * unseen, and the cell is in its trigger region, the vista starts and
   * this returns true (exactly once — the caller emits `vision-played`).
   */
  enterCell(vista: VistaDef | undefined, row: number, col: number): boolean {
    if (!vista || this.seen.has(vista.id)) return false;
    if (!vista.cells.some(([r, c]) => r === row && c === col)) return false;
    this.seen.add(vista.id);
    this.playing = true;
    this.elapsed = 0;
    return true;
  }

  /** Advance the envelope (call only while the game simulates). */
  update(dtMs: number): void {
    if (!this.playing) return;
    this.elapsed += dtMs;
    if (this.elapsed >= VISTA_SWELL_MS + VISTA_RETURN_MS) this.playing = false;
  }

  /** Envelope 0..1: eased rise over the swell, eased fall over the return. */
  private envelope(): number {
    if (!this.playing) return 0;
    if (this.elapsed < VISTA_SWELL_MS) return easeInOutCubic(this.elapsed / VISTA_SWELL_MS);
    return 1 - easeInOutCubic((this.elapsed - VISTA_SWELL_MS) / VISTA_RETURN_MS);
  }

  /** Meters to ADD to the zone's fog far-plane this frame. */
  get fogFarBoost(): number {
    return this.envelope() * VISTA_FOG_BOOST_M;
  }

  /** Meters to ADD to the camera eye height this frame. */
  get camLift(): number {
    return this.envelope() * VISTA_CAM_LIFT_M;
  }

  /** True while the direction plays. */
  get active(): boolean {
    return this.playing;
  }

  /** Fired + seeded ids, for merging into SaveData.visionsSeen. */
  get seenIds(): readonly string[] {
    return [...this.seen];
  }
}
