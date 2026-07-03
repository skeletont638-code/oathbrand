/**
 * The screen-effect scare kit (Task 3) — the visual half of "the engine
 * notices IT". Three held/static timelines the DreadDirector arms and main.ts
 * reads each frame to drive the existing PS1 pipeline (no new render code):
 *
 *   - `snap()`      a vertex-snap SPIKE: `snapRes()` returns the coarse
 *                   [96,72] grid (spec §7, "320×240 → 96×72") for `SNAP_MS`,
 *                   then null. main feeds it to `patchMaterial.setSnapResolution`.
 *   - `resDrop()`   a one-frame RESOLUTION DROP: `renderDrop()` stays true for
 *                   `RESDROP_MS`; main flips `pipeline.setRenderScale(240)` for
 *                   the beat (a no-op at the default 240 — the paired diegetic
 *                   guttering carries it) then restores the prior scale.
 *   - `desatStab()` a DESATURATION stab: `desatBoost()` climbs to `DESAT_PEAK`
 *                   within `DESAT_STAB_MS`, then eases monotonically to 0 over
 *                   `DESAT_EASE_MS`. main composites it with the Brand's own
 *                   per-frame desaturation via `max()`, so the stab never
 *                   fights the hollowing ramp.
 *
 * Every envelope is a pure function of an internal elapsed clock advanced ONLY
 * by `update(dtMs)` — there is deliberately NO per-frame-random term, so the
 * kit is flicker-safe by construction. `setFlickerSafe` therefore keeps the
 * held components and has nothing random to strip (it exists so a future
 * layered-random extra could be gated without touching the held timelines).
 */
import type { Subsystem } from './Game';

/** The coarse vertex-snap grid the spike quantizes to (spec §7). */
export const SNAP_COARSE: [number, number] = [96, 72];
/** Vertex-snap spike hold, ms. */
export const SNAP_MS = 500;
/** One-frame resolution-drop beat hold, ms. */
export const RESDROP_MS = 900;
/** Peak desaturation the stab reaches (0..1). */
export const DESAT_PEAK = 0.9;
/** Time to climb from 0 to the peak, ms (the "stab"). */
export const DESAT_STAB_MS = 120;
/** Time to ease from the peak back to 0, ms. */
export const DESAT_EASE_MS = 1400;
/** Fidelity scarcity (rule 8): a glitch already seen this run renders ~30%
 *  shorter — main passes `everSeen` so a repeat reads weaker than the first. */
export const EVER_SEEN_HOLD_MUL = 0.7;
/** False brand-pulse (GF-2, finding 4b): the total HUD-swell window, ms. "The
 *  radar you trust, lying once" — the sigil throbs with nothing there. */
export const SPOOF_PULSE_MS = 650;
/** Time the false pulse climbs to its peak (the throb), ms. */
export const SPOOF_RISE_MS = 90;
/** Reduced-flicker flash cap: the false pulse peaks at this gentler amplitude
 *  when reduced-flicker is engaged (spec §11 — GF-2 respects the flash cap). */
export const SPOOF_SAFE_PEAK = 0.5;

export class ScreenScareKit implements Subsystem {
  /** Elapsed since the last snap()/resDrop()/desatStab(); Infinity ⇒ inactive. */
  private snapT = Infinity;
  private resT = Infinity;
  private desatT = Infinity;
  /** Elapsed since the false brand-pulse spoof was armed; Infinity ⇒ inactive. */
  private spoofT = Infinity;
  /** Per-arm hold windows (shortened when the glitch was already seen). */
  private snapHold = SNAP_MS;
  private resHold = RESDROP_MS;
  private desatEase = DESAT_EASE_MS;
  private flickerSafe = false;

  /** Arm the vertex-snap spike. A repeat (`everSeen`) holds ~30% shorter. */
  snap(everSeen = false): void {
    this.snapT = 0;
    this.snapHold = SNAP_MS * (everSeen ? EVER_SEEN_HOLD_MUL : 1);
  }

  /** Arm the one-frame resolution drop. A repeat holds ~30% shorter. */
  resDrop(everSeen = false): void {
    this.resT = 0;
    this.resHold = RESDROP_MS * (everSeen ? EVER_SEEN_HOLD_MUL : 1);
  }

  /** Arm the desaturation stab: peak within DESAT_STAB_MS, ease over
   *  DESAT_EASE_MS. A repeat (`everSeen`) eases ~30% faster (weaker). */
  desatStab(everSeen = false): void {
    this.desatT = 0;
    this.desatEase = DESAT_EASE_MS * (everSeen ? EVER_SEEN_HOLD_MUL : 1);
  }

  /**
   * Arm the false brand-pulse (GF-2, finding 4b): a one-shot HUD swell with
   * nothing there. Main composites `pulseBoost()` with the real `brand.pulse`
   * via max() — so the sigil visibly throbs once, "the radar you trust, lying
   * once". A pure held envelope (no per-frame random), flash-capped when
   * reduced-flicker is on. The false-pulse fires once per drop, so no everSeen.
   */
  spoofPulse(): void {
    this.spoofT = 0;
  }

  /**
   * Held components stay; strips any layered per-frame random. The kit has no
   * random term (all three timelines are pure functions of elapsed), so this
   * only records the flag — the held snap/res/desat envelopes are unchanged.
   */
  setFlickerSafe(b: boolean): void {
    this.flickerSafe = b;
  }

  /** Whether reduced-flicker is engaged (held timelines are unaffected). */
  get isFlickerSafe(): boolean {
    return this.flickerSafe;
  }

  /** Advance every active timeline; a timeline past its hold goes inactive. */
  update(dtMs: number): void {
    if (this.snapT !== Infinity) {
      this.snapT += dtMs;
      if (this.snapT >= this.snapHold) this.snapT = Infinity;
    }
    if (this.resT !== Infinity) {
      this.resT += dtMs;
      if (this.resT >= this.resHold) this.resT = Infinity;
    }
    if (this.desatT !== Infinity) {
      this.desatT += dtMs;
      if (this.desatT >= DESAT_STAB_MS + this.desatEase) this.desatT = Infinity;
    }
    if (this.spoofT !== Infinity) {
      this.spoofT += dtMs;
      if (this.spoofT >= SPOOF_PULSE_MS) this.spoofT = Infinity;
    }
  }

  /** The coarse snap grid while a spike holds, else null. */
  snapRes(): [number, number] | null {
    return this.snapT === Infinity ? null : [SNAP_COARSE[0], SNAP_COARSE[1]];
  }

  /** True while a resolution-drop beat holds. */
  renderDrop(): boolean {
    return this.resT !== Infinity;
  }

  /** The 0..1 desaturation envelope: linear rise to the peak, linear ease down. */
  desatBoost(): number {
    const t = this.desatT;
    if (t === Infinity) return 0;
    if (t <= DESAT_STAB_MS) return DESAT_PEAK * (t / DESAT_STAB_MS);
    const eased = 1 - (t - DESAT_STAB_MS) / this.desatEase;
    return DESAT_PEAK * Math.max(0, eased);
  }

  /** The 0..1 false brand-pulse envelope: a quick throb (rise to peak within
   *  SPOOF_RISE_MS) then an ease back to 0 over the rest of SPOOF_PULSE_MS. The
   *  peak is flash-capped to SPOOF_SAFE_PEAK when reduced-flicker is engaged.
   *  Main max()-composites it with the real brand pulse to drive the HUD sigil. */
  pulseBoost(): number {
    const t = this.spoofT;
    if (t === Infinity) return 0;
    const peak = this.flickerSafe ? SPOOF_SAFE_PEAK : 1;
    if (t <= SPOOF_RISE_MS) return peak * (t / SPOOF_RISE_MS);
    const eased = 1 - (t - SPOOF_RISE_MS) / (SPOOF_PULSE_MS - SPOOF_RISE_MS);
    return peak * Math.max(0, eased);
  }
}
