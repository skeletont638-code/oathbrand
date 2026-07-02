/**
 * THE FORSWORN, FIRST KNIGHT OF VAEL (Task 15) — the boss, and the only enemy
 * that fights the player as an equal. Ser Callun, who broke his oath and let the
 * dark in, waiting a hundred years at the last door.
 *
 * He extends the shared Enemy FSM (idle → alert → approach → attack → recover),
 * but with three phases keyed off his hp (`TUNING.enemies.forsworn.phaseAt`):
 *
 *  - P1 (hp > 16): a mirror match. His swing IS the player's heavy — a slow,
 *    deliberate, fully guard-able tachi (windup ≥ 500ms; the telegraph never
 *    lies). No leash: the arena is sealed, and he never forgets you.
 *  - P2 (8 < hp ≤ 16): every swing that goes active lays a DARK-FLAME TRAIL on
 *    the floor ahead of him — a hazard that lingers `trail.lifetimeMs` and burns
 *    the player once per touch (stand clear or eat it).
 *  - P3 (hp ≤ 8): the torches die (main.ts reads `currentPhase()`), and he keeps
 *    laying trails. He always feeds the brand's pulse (`pulseDistM`, like a
 *    wraith), so in the dark the pulse is how you find him.
 *
 * Two world rules he owns beyond the base FSM:
 *  - THE MERCY: a hollow player collapses him to idle (inherited) AND turns his
 *    back (`onCollapse` sets the mercy yaw). He never strikes the dark.
 *  - THE REWARD: he tracks whether the player EVER guarded (`guardedNever`) — a
 *    raised guard (`noteGuard`) or a blocked swing forfeits it. A no-guard kill
 *    drops Callun's broken tachi (main.ts spawns the pickup on his death).
 */
import { TUNING } from '../content/tuning';
import type { Vec2 } from '../world/collision';
import { Enemy } from './Enemy';
import type { EnemyCtx, EnemyDeps } from './Enemy';

const F = TUNING.enemies.forsworn;
const A = F.attack;
const T = F.trail;

/** The mercy stance: facing the empty throne (north, −z), his back to the
 *  hollow knight he will not fight. (yaw = atan2(dx,dz); (0,−1) → π.) */
export const FORSWORN_MERCY_YAW = Math.PI;

/** A dark-flame hazard he leaves on the floor (P2+). `touching` latches the
 *  once-per-touch rule; `ttl` counts the lifetime down. */
export interface FlameTrail {
  x: number;
  z: number;
  ttl: number;
  touching: boolean;
}

export type ForswornDeps = Omit<EnemyDeps, 'kind' | 'hp'>;

export class Forsworn extends Enemy {
  /** Boss body is a touch broader than a soldier's — matches the larger view. */
  override readonly radius = 0.6;

  /** Dark-flame trails currently on the floor (rendered by main.ts). */
  trails: FlameTrail[] = [];

  private alertT = 0;
  private t = 0;
  private phase: 'windup' | 'active' = 'windup';
  private hitDone = false;
  private guarded = false;
  private readonly move: Vec2 = { x: 0, z: 0 };
  private readonly from: Vec2 = { x: 0, z: 0 };

  constructor(deps: ForswornDeps) {
    super({ ...deps, kind: 'forsworn', hp: F.hp });
  }

  /** 1, 2, or 3 from the current hp (thresholds in tuning.phaseAt = [16, 8]). */
  currentPhase(): 1 | 2 | 3 {
    const [p2, p3] = F.phaseAt;
    if (this.hp <= p3) return 3;
    if (this.hp <= p2) return 2;
    return 1;
  }

  /** True until the player raises guard even once (the no-guard reward gate). */
  get guardedNever(): boolean {
    return !this.guarded;
  }

  /** Record that the player guarded (held guard, or blocked a swing). */
  noteGuard(): void {
    this.guarded = true;
  }

  /** Always-pulse rule (wraith-style): distance capped just inside the pulse
   *  range so the brand never goes quiet while he lives — the only way to read
   *  him once the torches die in P3. Near distances pass through. */
  pulseDistM(distM: number): number {
    return Math.min(distM, TUNING.brand.pulseRangeM - 0.01);
  }

  /**
   * Advance the floor trails: age them, expire the dead, and return the total
   * damage the player takes THIS frame — once per touch (damage on entry only,
   * re-armed when the player steps out). Called by main.ts every frame.
   */
  tickTrails(dt: number, playerPos: Vec2): number {
    let damage = 0;
    for (const tr of this.trails) tr.ttl -= dt;
    this.trails = this.trails.filter((tr) => tr.ttl > 0);
    for (const tr of this.trails) {
      const inside = Math.hypot(playerPos.x - tr.x, playerPos.z - tr.z) <= T.radiusM;
      if (inside && !tr.touching) damage += T.damage;
      tr.touching = inside;
    }
    return damage;
  }

  protected override think(dt: number, ctx: EnemyCtx): void {
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1e-6;

    switch (this.state) {
      case 'idle':
        if (ctx.canSeePlayer && dist <= F.aggroM) {
          this.state = 'alert';
          this.alertT = 0;
          this.face(dx, dz);
        }
        return;

      case 'alert':
        this.face(dx, dz);
        this.alertT += dt;
        if (this.alertT >= F.alertMs) this.state = 'approach';
        return;

      case 'reposition': // unused; fall through to the chase
      case 'approach': {
        // No leash — the arena is sealed, and the first knight does not tire.
        this.face(dx, dz);
        if (dist <= A.rangeM) {
          this.state = 'attack';
          this.resetAction();
          return;
        }
        const step = (F.speed * dt) / 1000;
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
          this.onActiveStart(); // P2+ lays a dark-flame trail as the blow lands
        }
        if (this.phase !== 'active') return;
        // One connect per swing: circle (rangeM) vs the player body radius.
        if (!this.hitDone && dist <= A.rangeM + TUNING.player.radius) {
          this.hitDone = true;
          this.from.x = this.pos.x;
          this.from.z = this.pos.z;
          if (this.deps.defense?.blockMelee(this.from)) {
            this.guarded = true; // a block forfeits the no-guard reward
          } else {
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

  /** The mercy: collapsing to idle (a hollow player) turns his back. */
  protected override onCollapse(): void {
    this.resetAction();
    this.yaw = FORSWORN_MERCY_YAW;
  }

  /** As a swing lands, phase 2+ drops a hazard on the struck ground ahead. */
  private onActiveStart(): void {
    if (this.currentPhase() < 2) return;
    const reach = A.rangeM * 0.7;
    this.trails.push({
      x: this.pos.x + Math.sin(this.yaw) * reach,
      z: this.pos.z + Math.cos(this.yaw) * reach,
      ttl: T.lifetimeMs,
      touching: false,
    });
  }

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
