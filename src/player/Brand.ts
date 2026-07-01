/**
 * The Oath-Brand — the game's signature mechanic. There is no HP bar: the
 * brand seared into the player's hand is health (embers), threat radar
 * (pulse), checkpoint trigger (kneel/rekindle), and ending gate in one.
 *
 * - Embers: `maxEmbers` charges. Each hit burns embers out one by one
 *   (`ember-lost` per ember). At zero the player is HOLLOWED — not dead:
 *   the world drains to grayscale and enemies stop caring (further damage
 *   is a no-op; you are beneath their notice).
 * - Pulse: the brand throbs as enemies close in — intensity eases from 0 at
 *   `pulseRangeM` to 1 at touch range. Illusory walls make it gutter BLUE
 *   inside `illusoryFlickerRangeM` (flag consumed by the HUD).
 * - Rekindle: kneeling at a banner restores all embers, emits
 *   `player-rekindled`, and triggers a save (the checkpoint).
 * - Desaturation: the PS1 upscale pass drains color as embers die —
 *   `hollowDesatRamp[embers lost]`, hard 1 when hollow.
 */
import { TUNING } from '../content/tuning';
import type { EventBus } from '../engine/events';
import type { Subsystem } from '../engine/Game';

/** The slice of PS1Pipeline the brand drives (stubbed in tests). */
export interface DesaturationTarget {
  setDesaturation(v: number): void;
}

export interface BrandDeps {
  bus: EventBus;
  /** Usually the PS1Pipeline; optional so headless tests can omit it. */
  pipeline?: DesaturationTarget;
  /** Fired by rekindle() — main wiring persists a SaveData snapshot here. */
  onSave?: (bannerId: string) => void;
  /**
   * Distance providers polled once per frame by `update()` when the brand
   * runs as a Game-registered subsystem. Combat (Task 9+) supplies real
   * distances; until then they default to null (nothing near).
   */
  nearestEnemyM?: () => number | null;
  nearestIllusoryM?: () => number | null;
}

export class Brand implements Subsystem {
  embers: number = TUNING.brand.maxEmbers;

  /** Last computed pulse intensity (0..1); read per frame by the HUD. */
  pulse = 0;

  /** True while an illusory wall is nearer than `illusoryFlickerRangeM`.
   * Set by tick(), consumed by the HUD as a blue tint on the sigil. */
  blueFlicker = false;

  private hollowed = false;

  /** Kills counted toward the ember-wisp rule (+1 ember per 3 kills). */
  private kills = 0;

  constructor(private readonly deps: BrandDeps) {
    this.applyDesaturation();
    // Design call (Task 9): the kill counter lives INSIDE Brand, wired by
    // self-subscribing to 'enemy-slain' — main wiring cannot forget it and
    // tests get the rule for free by sharing a bus. Callers must NOT also
    // invoke onEnemySlain() manually, or kills double-count.
    deps.bus.on('enemy-slain', () => this.onEnemySlain());
  }

  get hollow(): boolean {
    return this.hollowed;
  }

  /**
   * Burn out `n` embers, emitting `ember-lost` (with the count remaining)
   * per ember, then `player-hollowed` exactly once on reaching zero.
   * While hollow, damage is a no-op — the hollowed are beneath notice.
   */
  damage(n: number): void {
    if (this.hollowed) return;
    for (let i = 0; i < n && this.embers > 0; i += 1) {
      this.embers -= 1;
      this.deps.bus.emit({ type: 'ember-lost', remaining: this.embers });
    }
    if (this.embers === 0) {
      this.hollowed = true;
      this.deps.bus.emit({ type: 'player-hollowed' });
    }
    this.applyDesaturation();
  }

  /**
   * Ember-wisp rule: every 3rd kill returns +1 ember (with `ember-gained`),
   * but only if embers < max AND not hollow — the hollowed brand is dark;
   * kneeling at a banner is the only way back. Kills keep counting either
   * way, so the cadence never drifts.
   */
  onEnemySlain(): void {
    this.kills += 1;
    if (this.kills % 3 !== 0) return;
    if (this.hollowed || this.embers >= TUNING.brand.maxEmbers) return;
    this.embers += 1;
    this.deps.bus.emit({ type: 'ember-gained', total: this.embers });
    this.applyDesaturation();
  }

  /** Kneel at a banner: restore every ember, announce it, checkpoint. */
  rekindle(bannerId: string): void {
    this.embers = TUNING.brand.maxEmbers;
    this.hollowed = false;
    this.deps.bus.emit({ type: 'player-rekindled', bannerId });
    this.deps.onSave?.(bannerId);
    this.applyDesaturation();
  }

  /**
   * Pulse intensity for a threat `distM` meters away: 0 at/beyond
   * `pulseRangeM` (or when nothing is near), easing up to 1 at 0m.
   * Smoothstep on 1 - d/range — monotonic, gentle at the rim, urgent close.
   */
  pulseFor(distM: number | null): number {
    const range = TUNING.brand.pulseRangeM;
    if (distM === null || distM >= range) return 0;
    const t = 1 - Math.max(0, distM) / range;
    return t * t * (3 - 2 * t);
  }

  /**
   * Per-frame heartbeat: recompute pulse (emitting `brand-pulse` while a
   * threat is in range), refresh the illusory blue-flicker flag, and drive
   * the pipeline's desaturation from the current ember count.
   */
  tick(dt: number, nearestEnemyM: number | null, nearestIllusoryM: number | null): void {
    void dt; // reserved: heartbeat pacing for audio pulses in a later task
    this.pulse = this.pulseFor(nearestEnemyM);
    if (this.pulse > 0) {
      this.deps.bus.emit({ type: 'brand-pulse', intensity: this.pulse });
    }
    this.blueFlicker =
      nearestIllusoryM !== null && nearestIllusoryM < TUNING.brand.illusoryFlickerRangeM;
    this.applyDesaturation();
  }

  /** Subsystem hook: poll the distance providers and tick. */
  update(dtMs: number): void {
    this.tick(
      dtMs,
      this.deps.nearestEnemyM?.() ?? null,
      this.deps.nearestIllusoryM?.() ?? null,
    );
  }

  /** hollow → hard grayscale; else the tuned ramp indexed by embers LOST. */
  private applyDesaturation(): void {
    const v = this.hollowed
      ? 1
      : TUNING.brand.hollowDesatRamp[TUNING.brand.maxEmbers - this.embers];
    this.deps.pipeline?.setDesaturation(v);
  }
}
