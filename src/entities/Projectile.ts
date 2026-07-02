/**
 * Projectiles (Task 10) — the archer's crossbow bolts. Pure fixed-step
 * logic, no renderer: `ProjectilePool.update(dt, ctx)` moves every live
 * bolt in a straight line and resolves, in order:
 *
 * 1. walls — `GridCollider.raycastWall` over this step's segment (a bolt
 *    never crosses a wall tile);
 * 2. the player — segment-vs-circle against `TUNING.player.radius`, so a
 *    fast bolt cannot tunnel through the body between steps. The player's
 *    guard is consulted FIRST (`MeleeDefense.blockMelee`, same seam melee
 *    uses): a frontal guard eats the bolt for 0 embers (Combat applies its
 *    own shove); otherwise the pool emits 'player-hit'.
 * 3. max range — `shot.maxRangeM` of flight, then the bolt despawns.
 *
 * Bolts are POOLED: `fire()` reuses the first inactive bolt and the hot
 * path allocates nothing. The pool is shared by every archer in the zone;
 * the render side draws `items` where `active`.
 */
import { Vector3 } from 'three';
import { TUNING } from '../content/tuning';
import type { EventBus } from '../engine/events';
import type { GridCollider, Vec2 } from '../world/collision';
import type { MeleeDefense } from './Enemy';

/** Shape of TUNING.enemies.archer.shot (any shooter kind can reuse it). */
export interface ShotSpec {
  readonly damage: number;
  readonly speedM: number;
  readonly maxRangeM: number;
}

/** The per-frame world slice bolts need — EnemyCtx satisfies it. */
export interface ProjectileCtx {
  playerPos: Vector3;
  collider: GridCollider;
}

export interface ProjectileDeps {
  bus: EventBus;
  /** The player's guard; frontal blocks stop bolts just like melee. */
  defense?: MeleeDefense;
}

/** Bolt height for the view (chest-ish); the logic itself is 2D (XZ). */
const BOLT_Y = 1.15;

/** Squared distance from point P to segment A→B (2D, XZ). */
function segDistSq(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  let t = 0;
  if (lenSq > 1e-12) {
    t = Math.min(1, Math.max(0, ((px - ax) * abx + (pz - az) * abz) / lenSq));
  }
  const cx = ax + abx * t - px;
  const cz = az + abz * t - pz;
  return cx * cx + cz * cz;
}

export class Projectile {
  /** World position (y fixed at bolt height for the view). */
  readonly pos = new Vector3(0, BOLT_Y, 0);
  /** Normalized flight direction. */
  readonly dir: Vec2 = { x: 0, z: 1 };
  speedM = 0;
  damage = 0;
  maxRangeM = 0;
  active = false;

  private traveled = 0;
  // Scratch for blockMelee's `from` — the hot path allocates nothing.
  private readonly from: Vec2 = { x: 0, z: 0 };

  constructor(private readonly deps: ProjectileDeps) {}

  /** (Re)launch this bolt from (x, z) along (dirX, dirZ). */
  fire(x: number, z: number, dirX: number, dirZ: number, spec: ShotSpec): void {
    const len = Math.hypot(dirX, dirZ);
    this.dir.x = len > 1e-9 ? dirX / len : 0;
    this.dir.z = len > 1e-9 ? dirZ / len : 1;
    this.pos.set(x, BOLT_Y, z);
    this.speedM = spec.speedM;
    this.damage = spec.damage;
    this.maxRangeM = spec.maxRangeM;
    this.traveled = 0;
    this.active = true;
  }

  /** Advance one fixed step; resolves wall → player → range, in that order. */
  update(dt: number, ctx: ProjectileCtx): void {
    if (!this.active) return;
    const step = Math.min((this.speedM * dt) / 1000, this.maxRangeM - this.traveled);
    const nx = this.pos.x + this.dir.x * step;
    const nz = this.pos.z + this.dir.z * step;

    // Walls stop bolts dead — the segment for THIS step must stay clear.
    if (ctx.collider.raycastWall(this.pos, { x: nx, z: nz })) {
      this.active = false;
      return;
    }

    // Player: segment-vs-circle so a fast bolt can't skip through the body.
    const p = ctx.playerPos;
    const r = TUNING.player.radius;
    if (segDistSq(this.pos.x, this.pos.z, nx, nz, p.x, p.z) <= r * r) {
      this.from.x = this.pos.x;
      this.from.z = this.pos.z;
      if (!this.deps.defense?.blockMelee(this.from)) {
        this.deps.bus.emit({ type: 'player-hit', damage: this.damage });
      }
      this.active = false; // blocked or landed, the bolt is spent
      return;
    }

    this.pos.x = nx;
    this.pos.z = nz;
    this.traveled += step;
    if (this.traveled >= this.maxRangeM) this.active = false;
  }
}

/**
 * A zone's bolts. One pool serves every archer (they share the same bus and
 * player guard); `fire` recycles inactive bolts, so steady-state combat
 * allocates nothing.
 */
export class ProjectilePool {
  /** All bolts ever spawned; render only the `active` ones. Grows only when
   * every existing bolt is simultaneously in flight. */
  readonly items: Projectile[] = [];
  /** Lifetime shot counter (telemetry/tests). */
  firedTotal = 0;

  constructor(private readonly deps: ProjectileDeps) {}

  fire(x: number, z: number, dirX: number, dirZ: number, spec: ShotSpec): void {
    let bolt = this.items.find((b) => !b.active);
    if (!bolt) {
      bolt = new Projectile(this.deps);
      this.items.push(bolt);
    }
    bolt.fire(x, z, dirX, dirZ, spec);
    this.firedTotal += 1;
  }

  update(dt: number, ctx: ProjectileCtx): void {
    for (const bolt of this.items) bolt.update(dt, ctx);
  }

  activeCount(): number {
    let n = 0;
    for (const bolt of this.items) if (bolt.active) n += 1;
    return n;
  }
}
