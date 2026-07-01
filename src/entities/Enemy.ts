/**
 * Enemy FSM base (Task 9). Pure logic + three's Vector3 math — no renderer,
 * no clocks: `update(dt, ctx)` is fixed-step-friendly and fully testable.
 *
 * The seven states are shared by every enemy kind (soldier, archer, wraith,
 * forsworn); subclasses implement `think()` and may never leave 'dead'.
 *
 * Two world rules live HERE so no subclass can get them wrong:
 * - Hollow player ⇒ every state collapses to 'idle' (a hollowed player is
 *   beneath notice — enemies simply stop caring).
 * - Death emits 'enemy-slain' exactly once, then the enemy stops thinking.
 */
import { Vector3 } from 'three';
import type { EnemyKind } from '../content/types';
import type { EventBus } from '../engine/events';
import type { GridCollider, Vec2 } from '../world/collision';

export type EnemyState =
  | 'idle'
  | 'alert'
  | 'approach'
  | 'attack'
  | 'recover'
  | 'reposition'
  | 'dead';

/** Per-frame world view handed to every enemy by the main loop. */
export interface EnemyCtx {
  playerPos: Vector3;
  playerHollow: boolean;
  collider: GridCollider;
  canSeePlayer: boolean;
}

/** Player-side melee defense seam (Combat satisfies it structurally):
 * returns true when the incoming hit from `from` was blocked — the defender
 * handles its own consequences (guard shove); the attacker deals no damage. */
export interface MeleeDefense {
  blockMelee(from: Vec2): boolean;
}

export interface EnemyDeps {
  /** Unique per placed enemy — the `enemy-slain` payload. */
  id: string;
  kind: EnemyKind;
  bus: EventBus;
  hp: number;
  /** The player's guard, when there is one to check against. */
  defense?: MeleeDefense;
}

export abstract class Enemy {
  state: EnemyState = 'idle';
  hp: number;
  /** World position (y stays at floor height). Steering writes x/z only. */
  readonly pos = new Vector3();
  /** Facing, ZoneBuilder convention: yaw = atan2(dx, dz) turns +z toward (dx,dz). */
  yaw = 0;
  /** Body circle for steering and the player's melee arc test. */
  readonly radius: number = 0.5;
  /** Hit-flash countdown (ms) for the view; set on non-fatal takeHit. */
  hurtMs = 0;

  constructor(protected readonly deps: EnemyDeps) {
    this.hp = deps.hp;
  }

  get id(): string {
    return this.deps.id;
  }

  get kind(): EnemyKind {
    return this.deps.kind;
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  /** Advance one fixed step. Dead enemies never think; a hollow player
   * collapses every live state to 'idle' before the subclass runs. */
  update(dt: number, ctx: EnemyCtx): void {
    if (this.state === 'dead') return;
    if (this.hurtMs > 0) this.hurtMs = Math.max(0, this.hurtMs - dt);
    if (ctx.playerHollow) {
      if (this.state !== 'idle') {
        this.state = 'idle';
        this.onCollapse();
      }
      return;
    }
    this.think(dt, ctx);
  }

  /** Apply damage. Lethal ⇒ 'dead' + 'enemy-slain' exactly once (further
   * hits and updates are no-ops). Non-lethal ⇒ flags `hurtMs` for the view. */
  takeHit(damage: number): void {
    if (this.state === 'dead') return;
    this.hp -= damage;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dead';
      this.deps.bus.emit({ type: 'enemy-slain', enemyId: this.deps.id, kind: this.deps.kind });
      return;
    }
    this.hurtMs = 400;
  }

  /** Reset any in-flight action when the FSM is forced back to 'idle'. */
  protected onCollapse(): void {}

  /** Kind-specific behavior; runs only while alive and the player matters. */
  protected abstract think(dt: number, ctx: EnemyCtx): void;
}
