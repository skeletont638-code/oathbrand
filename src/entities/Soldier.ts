/**
 * Hollow Soldier — the first thing in OATHBRAND that fights back.
 *
 * idle → alert (LOS within aggroM) → approach (straight-line steer through
 * `GridCollider.slide` — no pathfinding; walls absorb the blocked axis) →
 * attack (telegraphed: windup 700ms → active hit-window 200ms, circle vs
 * player radius, once per swing → FSM 'recover' 900ms) → approach again.
 * 'reposition' is unused by soldiers (archers own it) and falls through to
 * approach. All numbers come from `TUNING.enemies.soldier`.
 *
 * The connect goes through the player's `MeleeDefense` first: a guarded
 * frontal hit is blocked (Combat shoves the player; no event, no damage);
 * otherwise the soldier emits 'player-hit' and main routes it to
 * `brand.damage`.
 */
import { TUNING } from '../content/tuning';
import type { Vec2 } from '../world/collision';
import { Enemy } from './Enemy';
import type { EnemyCtx, EnemyDeps } from './Enemy';

const S = TUNING.enemies.soldier;
const A = S.attack;
/** Give up the chase past 1.5× aggro range — walking away un-aggros. */
const LEASH_M = S.aggroM * 1.5;

export type SoldierDeps = Omit<EnemyDeps, 'kind' | 'hp'>;

export class Soldier extends Enemy {
  /** ms spent in 'alert' (the notice beat before the chase). */
  private alertT = 0;
  /** Attack sub-phase timer + one-connect-per-swing latch. */
  private t = 0;
  private phase: 'windup' | 'active' = 'windup';
  private hitDone = false;
  // Scratch — the per-frame path allocates nothing.
  private readonly move: Vec2 = { x: 0, z: 0 };
  private readonly from: Vec2 = { x: 0, z: 0 };

  constructor(deps: SoldierDeps) {
    super({ ...deps, kind: 'soldier', hp: S.hp });
  }

  protected override think(dt: number, ctx: EnemyCtx): void {
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    switch (this.state) {
      case 'idle':
        if (ctx.canSeePlayer && dist <= S.aggroM) {
          this.state = 'alert';
          this.alertT = 0;
          this.face(dx, dz);
        }
        return;

      case 'alert':
        this.face(dx, dz);
        this.alertT += dt;
        if (this.alertT >= S.alertMs) this.state = 'approach';
        return;

      case 'reposition': // soldiers never reposition; recover to the chase
      case 'approach': {
        if (dist > LEASH_M) {
          this.state = 'idle';
          this.resetAction();
          return;
        }
        this.face(dx, dz);
        if (dist <= A.rangeM) {
          // Commit to the telegraph: face once at windup start, no tracking.
          this.state = 'attack';
          this.resetAction();
          return;
        }
        const step = (S.speed * dt) / 1000;
        this.move.x = (dx / dist) * step;
        this.move.z = (dz / dist) * step;
        const out = ctx.collider.slide(this.pos, this.move, this.radius);
        this.pos.x = out.x;
        this.pos.z = out.z;
        return;
      }

      case 'attack': {
        this.t += dt;
        if (this.phase === 'windup' && this.t >= A.windupMs) {
          this.phase = 'active';
          this.t -= A.windupMs;
        }
        if (this.phase !== 'active') return;
        // Hit window: circle (rangeM) vs the player's body radius, at most
        // one connect per swing — stepping out during the windup whiffs it.
        if (!this.hitDone && dist <= A.rangeM + TUNING.player.radius) {
          this.hitDone = true;
          this.from.x = this.pos.x;
          this.from.z = this.pos.z;
          if (!this.deps.defense?.blockMelee(this.from)) {
            this.deps.bus.emit({ type: 'player-hit', damage: A.damage });
          }
        }
        if (this.t >= A.activeMs) {
          this.state = 'recover';
          this.t = 0;
        }
        return;
      }

      case 'recover':
        this.t += dt;
        if (this.t >= A.recoverMs) {
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
