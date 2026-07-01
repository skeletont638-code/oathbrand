/**
 * Player combat kit (Task 9): light/heavy melee swings, hold-to-guard, and a
 * quick-step dash, all on one small state machine. Pure math + GridCollider —
 * NO three.js/DOM, so vitest runs it without WebGL.
 *
 * - Timings/specs come from `TUNING.player` (feel lives in tuning.ts ONLY).
 * - `hitArc()` is non-null ONLY while `state === 'active'`; the caller (main
 *   loop) sweeps enemies against it with `inArc` once per `swingId`.
 * - Guard blocks FRONTAL hits only (±90° of facing, inclusive). A blocked hit
 *   costs 0 embers and shoves the player back `guardShoveM` — resolved
 *   through the collider so a wall stops the shove.
 * - The quick-step displaces `stepDistM` over `stepMs` along the injected
 *   `stepDir` (main wires the current move direction; default = backstep).
 *   No i-frames: dodging is physical — you step out of the swing or you eat it.
 */
import { TUNING } from '../content/tuning';
import type { GridCollider, Vec2 } from '../world/collision';
import type { Pose } from './Interactor';

export type CombatState = 'idle' | 'windup' | 'active' | 'recover' | 'guard' | 'step';

/** The live swing volume, published only during the 'active' window. */
export interface HitArc {
  origin: Vec2;
  dirYaw: number;
  arcDeg: number;
  rangeM: number;
  damage: number;
}

/** Shape of TUNING.player.light/heavy. */
interface AttackSpec {
  readonly damage: number;
  readonly windupMs: number;
  readonly activeMs: number;
  readonly recoverMs: number;
  readonly arcDeg: number;
  readonly rangeM: number;
}

export interface CombatDeps {
  /** Live player pose — the Controller satisfies this; shoves/steps mutate
   * `pose.pos` in place (collider-approved positions only). */
  pose: Pose;
  /** Current zone collider (a thunk: it changes on zone transitions). */
  collider: () => GridCollider;
  /** Desired quick-step direction, written into `out` (need not be
   * normalized). Omitted/zero ⇒ backstep away from facing. */
  stepDir?: (out: Vec2) => void;
}

/**
 * Melee hit test: `target` is hit when its circle overlaps the arc's range
 * (dist ≤ rangeM + targetRadius) AND its center lies within ±arcDeg/2 of the
 * facing direction. A target on top of the origin always hits.
 */
export function inArc(arc: HitArc, target: Vec2, targetRadius: number): boolean {
  const dx = target.x - arc.origin.x;
  const dz = target.z - arc.origin.z;
  const dist = Math.hypot(dx, dz);
  if (dist > arc.rangeM + targetRadius) return false;
  if (dist < 1e-9) return true;
  // yaw 0 faces -z (three 'YXZ' convention — see movement.ts).
  const fx = -Math.sin(arc.dirYaw);
  const fz = -Math.cos(arc.dirYaw);
  const cosHalf = Math.cos(((arc.arcDeg / 2) * Math.PI) / 180);
  return (fx * dx + fz * dz) / dist >= cosHalf;
}

export class Combat {
  state: CombatState = 'idle';

  /** Increments when a swing starts. Callers use it to apply each swing's
   * damage at most once per enemy (clear your hit-set when it changes). */
  swingId = 0;

  private spec: AttackSpec = TUNING.player.light;
  /** ms elapsed in the current windup/active/recover/step phase. */
  private t = 0;
  // Scratch objects reused every frame — the hot path allocates nothing.
  private readonly stepVec: Vec2 = { x: 0, z: 0 };
  private readonly delta: Vec2 = { x: 0, z: 0 };
  private readonly arc: HitArc = {
    origin: { x: 0, z: 0 },
    dirYaw: 0,
    arcDeg: 0,
    rangeM: 0,
    damage: 0,
  };

  constructor(private readonly deps: CombatDeps) {}

  /** Start a light swing. Only from 'idle' (attacks commit; guard must be
   * released first). Returns whether the swing started. */
  tryLight(): boolean {
    return this.beginAttack(TUNING.player.light);
  }

  /** Start a heavy swing. Same gating as tryLight. */
  tryHeavy(): boolean {
    return this.beginAttack(TUNING.player.heavy);
  }

  /**
   * Guard is a held stance: call every frame with the button state (the calls
   * are idempotent). Raises guard from 'idle'; drops it back to 'idle'.
   * Swings and steps in progress are unaffected.
   */
  tryGuard(down: boolean): void {
    if (down && this.state === 'idle') this.state = 'guard';
    else if (!down && this.state === 'guard') this.state = 'idle';
  }

  /** Quick-step dash from 'idle' or 'guard'. Direction is captured now. */
  tryStep(): boolean {
    if (this.state !== 'idle' && this.state !== 'guard') return false;
    this.stepVec.x = 0;
    this.stepVec.z = 0;
    this.deps.stepDir?.(this.stepVec);
    const len = Math.hypot(this.stepVec.x, this.stepVec.z);
    if (len > 1e-9) {
      this.stepVec.x /= len;
      this.stepVec.z /= len;
    } else {
      // Backstep: straight away from facing (yaw 0 faces -z ⇒ back is +z).
      this.stepVec.x = Math.sin(this.deps.pose.yaw);
      this.stepVec.z = Math.cos(this.deps.pose.yaw);
    }
    this.state = 'step';
    this.t = 0;
    return true;
  }

  /** Advance the state machine by `dt` ms (large dt carries across phases). */
  update(dt: number): void {
    if (this.state === 'idle' || this.state === 'guard') return;
    if (this.state === 'step') {
      this.stepTick(dt);
      return;
    }
    // windup → active → recover → idle, with leftover time carried so an
    // oversized frame cannot stall a phase boundary.
    this.t += dt;
    for (;;) {
      const dur =
        this.state === 'windup'
          ? this.spec.windupMs
          : this.state === 'active'
            ? this.spec.activeMs
            : this.spec.recoverMs;
      if (this.t < dur) return;
      this.t -= dur;
      if (this.state === 'windup') this.state = 'active';
      else if (this.state === 'active') this.state = 'recover';
      else {
        this.state = 'idle';
        this.t = 0;
        return;
      }
    }
  }

  /**
   * The live swing volume — non-null ONLY during 'active'. The returned
   * object is reused between calls: consume it immediately, do not retain.
   */
  hitArc(): HitArc | null {
    if (this.state !== 'active') return null;
    const { pos, yaw } = this.deps.pose;
    this.arc.origin.x = pos.x;
    this.arc.origin.z = pos.z;
    this.arc.dirYaw = yaw;
    this.arc.arcDeg = this.spec.arcDeg;
    this.arc.rangeM = this.spec.rangeM;
    this.arc.damage = this.spec.damage;
    return this.arc;
  }

  /**
   * Resolve an incoming melee hit from an attacker at `from` (enemies call
   * this via the `MeleeDefense` seam). Returns true when blocked: guarding
   * AND the attacker is frontal (±90° of facing, inclusive). A block shoves
   * the player `guardShoveM` straight away from the attacker, through the
   * collider (walls absorb the shove). Not blocked ⇒ caller deals damage.
   */
  blockMelee(from: Vec2): boolean {
    if (this.state !== 'guard') return false;
    const { pos, yaw } = this.deps.pose;
    const dx = from.x - pos.x;
    const dz = from.z - pos.z;
    const len = Math.hypot(dx, dz);
    if (len > 1e-9) {
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      if (fx * dx + fz * dz < 0) return false; // behind the guard: not blocked
    }
    // Shove away from the attacker (attacker on top of us: shove backward).
    if (len > 1e-9) {
      this.delta.x = (-dx / len) * TUNING.player.guardShoveM;
      this.delta.z = (-dz / len) * TUNING.player.guardShoveM;
    } else {
      this.delta.x = Math.sin(yaw) * TUNING.player.guardShoveM;
      this.delta.z = Math.cos(yaw) * TUNING.player.guardShoveM;
    }
    const out = this.deps.collider().slide(pos, this.delta, TUNING.player.radius);
    pos.x = out.x;
    pos.z = out.z;
    return true;
  }

  private beginAttack(spec: AttackSpec): boolean {
    if (this.state !== 'idle') return false;
    this.spec = spec;
    this.state = 'windup';
    this.t = 0;
    this.swingId += 1;
    return true;
  }

  private stepTick(dt: number): void {
    const remaining = TUNING.player.stepMs - this.t;
    const slice = Math.min(dt, remaining);
    const dist = (TUNING.player.stepDistM * slice) / TUNING.player.stepMs;
    this.delta.x = this.stepVec.x * dist;
    this.delta.z = this.stepVec.z * dist;
    const pos = this.deps.pose.pos;
    const out = this.deps.collider().slide(pos, this.delta, TUNING.player.radius);
    pos.x = out.x;
    pos.z = out.z;
    this.t += dt;
    if (this.t >= TUNING.player.stepMs) {
      this.state = 'idle';
      this.t = 0;
    }
  }
}
