/**
 * Hollow Archer (Task 10) — the roster's ranged pressure.
 *
 * idle → alert (LOS within aggroM). 'alert' is the hub: from it the archer
 * repositions when the player crowds inside `repositionM` (backs straight
 * away through `GridCollider.slide`, keeping its face to the player; when
 * the wall behind eats the retreat it strafes sideways instead, flipping
 * direction when cornered), chases to re-acquire a broken line of sight
 * ('approach'), or — with LOS and a cold bow — telegraphs a shot ('attack',
 * `shot.windupMs`) and looses a `Projectile` at the player's position at
 * release. After the loose it 'recover's until `shot.cooldownMs` runs out.
 * All numbers come from `TUNING.enemies.archer`.
 *
 * The bolt itself (wall blocking, guard, damage) lives in Projectile.ts —
 * the archer only aims and pulls the trigger via the shared pool.
 */
import { TUNING } from '../content/tuning';
import type { Vec2 } from '../world/collision';
import { Enemy } from './Enemy';
import type { EnemyCtx, EnemyDeps } from './Enemy';
import type { ProjectilePool } from './Projectile';

const R = TUNING.enemies.archer;
const SHOT = R.shot;
/** Give up past 1.5× aggro range — walking away un-aggros (soldier rule). */
const LEASH_M = R.aggroM * 1.5;
/** A retreat step that moves less than this fraction of the intent is
 * "blocked" — a wall is eating it; strafe instead. */
const BLOCKED_FRACTION = 0.5;
/** Bolts spawn just outside the archer's own body circle. */
const MUZZLE_M = 0.2;

export type ArcherDeps = Omit<EnemyDeps, 'kind' | 'hp'> & {
  /** Zone-shared bolt pool; the archer fires into it. */
  shots: ProjectilePool;
};

export class Archer extends Enemy {
  /** Windup timer for the current shot. */
  private t = 0;
  /** ms until the bow may be drawn again (ticks in every live state). */
  private cool = 0;
  /** Which way to strafe when the retreat is wall-blocked; flips when stuck. */
  private strafeSign = 1;
  // Scratch — the per-frame path allocates nothing.
  private readonly move: Vec2 = { x: 0, z: 0 };

  constructor(private readonly archerDeps: ArcherDeps) {
    super({ ...archerDeps, kind: 'archer', hp: R.hp });
  }

  protected override think(dt: number, ctx: EnemyCtx): void {
    if (this.cool > 0) this.cool = Math.max(0, this.cool - dt);
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    // Clamped away from 0 so dx/dist can never go NaN with the player
    // standing exactly on top of us (dx/1e-6 = 0 → we just hold still).
    const dist = Math.hypot(dx, dz) || 1e-6;

    switch (this.state) {
      case 'idle':
        if (ctx.canSeePlayer && dist <= R.aggroM) {
          this.state = 'alert';
          this.face(dx, dz);
        }
        return;

      case 'alert':
        this.face(dx, dz);
        if (dist > LEASH_M) {
          this.state = 'idle';
          this.t = 0;
          return;
        }
        if (dist < R.repositionM) this.state = 'reposition';
        else if (!ctx.canSeePlayer) this.state = 'approach';
        else if (this.cool === 0) {
          this.state = 'attack';
          this.t = 0;
        }
        return;

      case 'approach': {
        // Line of sight is broken: close in until it isn't.
        this.face(dx, dz);
        if (dist > LEASH_M) {
          this.state = 'idle';
          return;
        }
        if (ctx.canSeePlayer) {
          this.state = 'alert';
          return;
        }
        const step = (R.speed * dt) / 1000;
        this.move.x = (dx / dist) * step;
        this.move.z = (dz / dist) * step;
        this.applySlide(ctx);
        return;
      }

      case 'reposition': {
        // Too close for the bow: keep facing the player, back away; strafe
        // along whatever wall blocks the retreat.
        this.face(dx, dz);
        if (dist >= R.repositionM) {
          this.state = 'alert';
          return;
        }
        const step = (R.speed * dt) / 1000;
        const ax = -dx / dist; // straight away from the player
        const az = -dz / dist;
        this.move.x = ax * step;
        this.move.z = az * step;
        if (this.applySlide(ctx) < step * BLOCKED_FRACTION) {
          // Retreat wall-blocked → sidestep (perpendicular); cornered → flip.
          this.move.x = -az * this.strafeSign * step;
          this.move.z = ax * this.strafeSign * step;
          if (this.applySlide(ctx) < step * BLOCKED_FRACTION) this.strafeSign *= -1;
        }
        return;
      }

      case 'attack': {
        // Telegraph: track the aim through the windup, loose at its end
        // toward the player's position NOW — the dodge is the bolt's flight.
        this.face(dx, dz);
        this.t += dt;
        if (this.t < SHOT.windupMs) return;
        const ox = (dx / dist) * (this.radius + MUZZLE_M);
        const oz = (dz / dist) * (this.radius + MUZZLE_M);
        this.archerDeps.shots.fire(this.pos.x + ox, this.pos.z + oz, dx, dz, SHOT);
        this.cool = SHOT.cooldownMs;
        this.t = 0;
        this.state = 'recover';
        return;
      }

      case 'recover':
        // Post-shot: hold (reload) until the cooldown clears; a crowding
        // player still forces a reposition (the cooldown keeps ticking).
        this.face(dx, dz);
        if (dist < R.repositionM) this.state = 'reposition';
        else if (this.cool === 0) this.state = 'alert';
        return;

      case 'dead': // unreachable — Enemy.update never thinks while dead
        return;
    }
  }

  protected override onCollapse(): void {
    this.t = 0;
  }

  /** Slide by `this.move`; returns the distance actually covered. */
  private applySlide(ctx: EnemyCtx): number {
    const out = ctx.collider.slide(this.pos, this.move, this.radius);
    const moved = Math.hypot(out.x - this.pos.x, out.z - this.pos.z);
    this.pos.x = out.x;
    this.pos.z = out.z;
    return moved;
  }

  /** ZoneBuilder facing convention: rotate model +z toward (dx, dz). */
  private face(dx: number, dz: number): void {
    this.yaw = Math.atan2(dx, dz);
  }
}
