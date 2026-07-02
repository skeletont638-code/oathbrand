/**
 * KneelRitual (Task 14) — the game's checkpoint AND its storytelling device.
 * Kneeling at a banner is a ~4s uninterruptible sequence:
 *
 *   1. INPUT LOCKS. The ritual transitions the game into the `vision` state,
 *      which freezes movement + combat in the frame loop (the same gate the
 *      inscription/dialogue overlays use). No input reaches the player.
 *   2. THE CAMERA SINKS. `camSink` eases from 0 to ~0.5m over the settle, and
 *      the player kneels there for the rest of the ritual (and any vision).
 *   3. AT THE SETTLE the brand REKINDLES — restoring every ember and firing a
 *      save (the checkpoint) — the `motif-kneel` audio cue fires, and the
 *      zone's enemies RESPAWN. This is the bonfire rule: kneeling mid-combat is
 *      allowed and dangerous — the roster is torn down and rebuilt fresh (never
 *      merely cleared), so in-progress fights reset and re-aggro naturally.
 *   4. FIRST KNEEL PER BANNER additionally plays that banner's VISION — a
 *      VisionPlayer memory of the night Vael fell. Control returns only once
 *      the memory ends. On later kneels (vision already seen) the ritual just
 *      holds for the remainder of the ~4s and hands control back.
 *
 * Pure timeline logic, NO three.js / NO DOM: `main.ts` injects `rekindle`,
 * the cue emitter, and the enemy respawn as callbacks, so this runs in vitest.
 */
import type { Game } from '../engine/Game';
import type { VisionDef, VisionPlayer } from '../engine/VisionPlayer';

/** How deep the camera sinks as the knight goes to one knee (metres). */
export const KNEEL_SINK_M = 0.5;
/** Time to sink + settle before the brand rekindles (ms). */
export const KNEEL_SETTLE_MS = 900;
/** Total length of a plain (no-vision) kneel before control returns (ms). */
export const KNEEL_TOTAL_MS = 4000;

/** The narrow slice of the Brand the ritual drives. */
export interface Rekindler {
  rekindle(bannerId: string): void;
}

export interface KneelDeps {
  game: Game;
  brand: Rekindler;
  /** The shared VisionPlayer that actually renders the memory. Omit to skip
   *  visions entirely (used by the plain-ritual tests). */
  visionPlayer?: VisionPlayer;
  /** Fire a named audio cue ('motif-kneel') for the sound layer (T17). */
  emitCue: (id: string) => void;
  /** Bonfire rule: tear down + rebuild this zone's enemy roster. */
  respawnEnemies: () => void;
}

/** Smoothstep: gentle at both ends, for the camera going to one knee. */
function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export class KneelRitual {
  private active_ = false;
  private elapsed = 0;
  private rekindled = false;
  private bannerId = '';
  private pendingVision: VisionDef | null = null;
  private handedToVision = false;

  constructor(private readonly deps: KneelDeps) {}

  /** True while the ritual (or its vision) owns the screen. */
  get active(): boolean {
    return this.active_;
  }

  /** Metres to SUBTRACT from the camera eye height this frame (0 when idle). */
  get camSink(): number {
    if (!this.active_) return 0;
    return KNEEL_SINK_M * smoothstep(this.elapsed / KNEEL_SETTLE_MS);
  }

  /**
   * Begin kneeling at `bannerId`. `vision` is this banner's memory (resolved by
   * the caller per zone) — it plays only on the FIRST kneel (unseen id). Only
   * legal from `playing`; locks input by entering the `vision` state. Returns
   * false if already active or the game will not leave `playing`.
   */
  start(bannerId: string, vision?: VisionDef): boolean {
    if (this.active_) return false;
    if (this.deps.game.state !== 'playing') return false;
    if (!this.deps.game.transition('vision')) return false;

    this.active_ = true;
    this.elapsed = 0;
    this.rekindled = false;
    this.handedToVision = false;
    this.bannerId = bannerId;
    // Play the vision only if one is given, a player is wired, AND it is unseen.
    this.pendingVision =
      vision && this.deps.visionPlayer && !this.deps.visionPlayer.hasSeen(vision.id)
        ? vision
        : null;
    return true;
  }

  /** Advance the ritual (call only while the game is in the `vision` state). */
  update(dtMs: number): void {
    if (!this.active_) return;

    // Once the memory is playing it owns the timeline; complete when it ends.
    if (this.handedToVision) {
      this.deps.visionPlayer?.update(dtMs);
      if (!this.deps.visionPlayer?.active) this.finish();
      return;
    }

    this.elapsed += dtMs;

    if (!this.rekindled && this.elapsed >= KNEEL_SETTLE_MS) {
      this.rekindled = true;
      // Start the memory BEFORE the rekindle. play() marks the vision id seen,
      // so the rekindle's save (below) banks it — otherwise a reload right
      // after this first kneel would replay the memory. We are already in the
      // `vision` state, so play() proceeds without a second transition; it
      // opens the memory on ash.
      if (this.pendingVision && this.deps.visionPlayer) {
        this.deps.visionPlayer.play(this.pendingVision);
        this.handedToVision = true;
      }
      this.deps.brand.rekindle(this.bannerId); // restores embers + SAVES (id banked)
      this.deps.emitCue('motif-kneel');
      this.deps.respawnEnemies(); // bonfire rule: rebuild, don't just clear
      if (this.handedToVision) {
        // rekindle just reset desaturation to full colour (embers restored);
        // re-assert the memory's ash so it opens correctly next frame.
        this.deps.visionPlayer?.update(0);
        return;
      }
    }

    if (!this.pendingVision && this.elapsed >= KNEEL_TOTAL_MS) this.finish();
  }

  private finish(): void {
    this.active_ = false;
    if (this.deps.game.state === 'vision') this.deps.game.transition('playing');
  }
}
