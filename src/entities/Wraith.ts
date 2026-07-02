/**
 * Brand-Wraith (Task 10) — the enemy you hear before you see.
 *
 * The wraith is bound to the Oath-Brand: it is rendered ONLY while the
 * brand's pulse burns above `WRAITH_VISIBLE_PULSE` (the view sets material
 * opacity = pulse intensity), and it ALWAYS feeds the pulse — `pulseDistM`
 * caps its reported distance just inside `pulseRangeM`, so a live wraith
 * anywhere in the zone keeps the brand faintly throbbing. Proximity does
 * the rest: as the player closes, the pulse climbs and the wraith fades in.
 *
 * FSM: idle → alert (LOS within aggroM, `alertMs` notice beat) → approach
 * (fast — speed 2.3 — straight-line steer through `collider.slide`) →
 * attack, gated on BOTH range and line of sight (a wraith never lunges
 * blind). The lunge telegraphs `windupMs` with the facing committed at
 * windup start, then DASHES `rangeM` forward over the active window,
 * connecting at most once (guard is consulted first, same as melee) →
 * recover → approach. All numbers from `TUNING.enemies.wraith`.
 */
import { TUNING } from '../content/tuning';
import type { Vec2 } from '../world/collision';
import { Enemy } from './Enemy';
import type { EnemyCtx, EnemyDeps } from './Enemy';

const W = TUNING.enemies.wraith;
const L = W.lunge;
/** Give up the hunt past 1.5× aggro range (soldier rule). */
const LEASH_M = W.aggroM * 1.5;
/** Pulse intensity above which the veil thins and the wraith renders. */
export const WRAITH_VISIBLE_PULSE = 0.15;
/** How far inside pulseRangeM a distant wraith reports itself (the ε of the
 * always-pulse rule): intensity stays > 0 but far below the visible line. */
const PULSE_EPS = 0.01;
/** The active-window dash covers the full lunge range. */
const DASH_SPEED = L.rangeM / (L.activeMs / 1000);

export type WraithDeps = Omit<EnemyDeps, 'kind' | 'hp'> & {
  /** Live brand pulse intensity (0..1) — main wires `() => brand.pulse`. */
  pulse: () => number;
};

export class Wraith extends Enemy {
  /** ms spent in 'alert' (the notice beat before the hunt). */
  private alertT = 0;
  /** Attack sub-phase timer + one-connect-per-lunge latch. */
  private t = 0;
  private phase: 'windup' | 'active' = 'windup';
  private hitDone = false;
  // Scratch — the per-frame path allocates nothing.
  private readonly move: Vec2 = { x: 0, z: 0 };
  private readonly from: Vec2 = { x: 0, z: 0 };

  constructor(private readonly wraithDeps: WraithDeps) {
    super({ ...wraithDeps, kind: 'wraith', hp: W.hp });
  }

  /** Rendered only while the brand pulses hard enough to thin the veil. */
  get visible(): boolean {
    return this.wraithDeps.pulse() > WRAITH_VISIBLE_PULSE;
  }

  /** Material opacity = pulse intensity (clamped to 0..1). */
  get opacity(): number {
    return Math.min(1, Math.max(0, this.wraithDeps.pulse()));
  }

  /**
   * The always-pulse rule: the distance this wraith reports to the brand's
   * nearest-enemy input. Near distances pass through (proximity drives the
   * fade-in); far ones cap just inside pulseRangeM so the brand never goes
   * fully quiet while a wraith stalks the zone.
   */
  pulseDistM(distM: number): number {
    return Math.min(distM, TUNING.brand.pulseRangeM - PULSE_EPS);
  }

  protected override think(dt: number, ctx: EnemyCtx): void {
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    // Clamped away from 0 so dx/dist can never go NaN with the player
    // standing exactly on top of us.
    const dist = Math.hypot(dx, dz) || 1e-6;

    switch (this.state) {
      case 'idle':
        if (ctx.canSeePlayer && dist <= W.aggroM) {
          this.state = 'alert';
          this.alertT = 0;
          this.face(dx, dz);
        }
        return;

      case 'alert':
        this.face(dx, dz);
        this.alertT += dt;
        if (this.alertT >= W.alertMs) this.state = 'approach';
        return;

      case 'reposition': // wraiths never reposition; recover to the hunt
      case 'approach': {
        if (dist > LEASH_M) {
          this.state = 'idle';
          this.resetAction();
          return;
        }
        this.face(dx, dz);
        // Lunge gate: range AND line of sight — never a blind lunge.
        if (dist <= L.rangeM && ctx.canSeePlayer) {
          this.state = 'attack';
          this.resetAction(); // facing committed as of this frame
          return;
        }
        const step = (W.speed * dt) / 1000;
        this.move.x = (dx / dist) * step;
        this.move.z = (dz / dist) * step;
        const out = ctx.collider.slide(this.pos, this.move, this.radius);
        this.pos.x = out.x;
        this.pos.z = out.z;
        return;
      }

      case 'attack': {
        this.t += dt;
        if (this.phase === 'windup' && this.t >= L.windupMs) {
          this.phase = 'active';
          this.t -= L.windupMs;
        }
        if (this.phase !== 'active') return;
        // The lunge itself: surge along the committed facing (walls stop it).
        const dash = (DASH_SPEED * Math.min(dt, L.activeMs)) / 1000;
        this.move.x = Math.sin(this.yaw) * dash;
        this.move.z = Math.cos(this.yaw) * dash;
        const out = ctx.collider.slide(this.pos, this.move, this.radius);
        this.pos.x = out.x;
        this.pos.z = out.z;
        // Hit window: circle vs player radius, at most one connect per lunge.
        const d = Math.hypot(ctx.playerPos.x - this.pos.x, ctx.playerPos.z - this.pos.z);
        if (!this.hitDone && d <= L.rangeM + TUNING.player.radius) {
          this.hitDone = true;
          this.from.x = this.pos.x;
          this.from.z = this.pos.z;
          if (!this.wraithDeps.defense?.blockMelee(this.from)) {
            this.wraithDeps.bus.emit({ type: 'player-hit', damage: L.damage });
          }
        }
        if (this.t >= L.activeMs) {
          this.state = 'recover';
          this.t = 0;
        }
        return;
      }

      case 'recover':
        this.t += dt;
        if (this.t >= L.recoverMs) {
          this.state = 'approach';
          this.t = 0;
        }
        return;

      case 'dead': // unreachable — Enemy.update never thinks while dead
        return;
    }
  }

  protected override onCollapse(): void {
    this.resetAction();
  }

  /** ZoneBuilder facing convention: rotate model +z toward (dx, dz). */
  private face(dx: number, dz: number): void {
    this.yaw = Math.atan2(dx, dz);
  }

  private resetAction(): void {
    this.alertT = 0;
    this.t = 0;
    this.phase = 'windup';
    this.hitDone = false;
  }
}
