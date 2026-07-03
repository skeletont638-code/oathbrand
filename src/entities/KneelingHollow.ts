/**
 * Kneeling Hollow (Greater Vael Drop 1, Task 4) — a too-tall underfed figure
 * knelt in the field, head bowed, that RISES when the brand pulses and comes for
 * you on a wrong tempo.
 *
 * FSM (mapped onto the base states):
 *  - idle: dormant. Near-imperceptible idle micro-motion (breath-scale + a slow
 *    head-tilt) lives in the VIEW; the logic just waits. It leaves idle ONLY on
 *    a brand pulse — either the scare beat calls `wake()`, or it auto-wakes when
 *    `pulse() > WAKE_PULSE && dist <= aggroM`.
 *  - alert: the RISE. It holds `rise.holdMs` STILL at full height (the wrong,
 *    patient beat), then takes a single slow `rise.firstStepMs` first step,
 *    then walks.
 *  - approach: pursue (straight steer through `collider.slide`, no pathfinding).
 *  - attack: mirrors the soldier's telegraphed swing (windup → one active hit →
 *    recover), damage/range from tuning.
 *  - recover → approach.
 *
 * The SCARECROW variant (Gate Fields GF-1) is the SAME class dressed as a
 * field-ward — it is simply a kneeler nothing ever calls `wake()` on, so it
 * stirs only if a real brand pulse crosses it. Zero new asset cost; no code
 * branch. All numbers from `TUNING.greaterVael.kneeler`.
 */
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Material } from 'three';
import { TUNING } from '../content/tuning';
import { patchMaterial } from '../ps1/patchMaterial';
import type { Vec2 } from '../world/collision';
import { Enemy } from './Enemy';
import type { EnemyCtx, EnemyDeps } from './Enemy';
import { steppedTime } from './animator';
import type { EntityView } from './animator';
import { KNEELER_TINT } from './palette';

const K = TUNING.greaterVael.kneeler;
const RISE = K.rise;
const A = K.attack;
/** Brand-pulse intensity above which a dormant kneeler auto-wakes (matches the
 *  wraith's veil-thinning line — the same "the brand is answering" threshold). */
export const WAKE_PULSE = 0.15;

export type KneelingHollowDeps = Omit<EnemyDeps, 'kind' | 'hp'> & {
  /** Live brand pulse intensity (0..1) — main wires `() => brand.pulse`. */
  pulse: () => number;
  /** Low bone-creak one-shot, fired once on the rise. */
  creakCue: () => void;
};

export class KneelingHollow extends Enemy {
  override readonly radius = 0.45; // a thin, underfed frame

  /** ms since the rise began (alert). The view reads it to drive hold→step. */
  riseT = 0;
  /** Attack sub-phase timer + one-connect-per-swing latch. */
  private t = 0;
  private phase: 'windup' | 'active' = 'windup';
  private hitDone = false;
  // Scratch — the per-frame path allocates nothing.
  private readonly move: Vec2 = { x: 0, z: 0 };
  private readonly from: Vec2 = { x: 0, z: 0 };

  constructor(private readonly kneelerDeps: KneelingHollowDeps) {
    super({ ...kneelerDeps, kind: 'kneeler', hp: K.hp });
  }

  /** True while it is still kneeling (the view keeps the folded pose + micro-
   *  motion). Once it has risen it never kneels again. */
  get dormant(): boolean {
    return this.state === 'idle';
  }

  /** The scare beat's hook: raise this hollow. No-op unless it is dormant, so a
   *  double-trigger (pulse + beat in the same instant) can't reset the rise. */
  wake(): void {
    if (this.state !== 'idle') return;
    this.state = 'alert';
    this.riseT = 0;
    this.kneelerDeps.creakCue();
  }

  protected override think(dt: number, ctx: EnemyCtx): void {
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    switch (this.state) {
      case 'idle':
        // Dormant: it stirs only when the brand answers within reach.
        if (this.kneelerDeps.pulse() > WAKE_PULSE && dist <= K.aggroM) this.wake();
        return;

      case 'alert':
        // The rise: hold still at full height, THEN one wrong-tempo first step.
        this.face(dx, dz);
        this.riseT += dt;
        if (this.riseT >= RISE.holdMs + RISE.firstStepMs) this.state = 'approach';
        return;

      case 'reposition': // kneelers never reposition; recover to the pursuit
      case 'approach': {
        this.face(dx, dz);
        if (dist <= A.rangeM) {
          this.state = 'attack';
          this.resetAction();
          return;
        }
        const step = (K.speed * dt) / 1000;
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
        // Hit window: circle vs the player's body radius, one connect per swing.
        if (!this.hitDone && dist <= A.rangeM + TUNING.player.radius) {
          this.hitDone = true;
          this.from.x = this.pos.x;
          this.from.z = this.pos.z;
          if (!this.kneelerDeps.defense?.blockMelee(this.from)) {
            this.kneelerDeps.bus.emit({ type: 'player-hit', damage: A.damage });
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
    // A hollow player drops the kneeler back to dormant — it kneels again.
    this.riseT = 0;
    this.resetAction();
  }

  /** ZoneBuilder facing convention: rotate model +z toward (dx, dz). */
  private face(dx: number, dz: number): void {
    this.yaw = Math.atan2(dx, dz);
  }

  private resetAction(): void {
    this.t = 0;
    this.phase = 'windup';
    this.hitDone = false;
  }
}

// ---------------------------------------------------------------------------
// View: a bespoke low-poly biped (the KayKit pack has no figure with these
// wrong proportions). The tall-creepy directive is baked into the skeleton —
// ~2.4 m standing, elongated thin limbs and a long neck on an underfed frame,
// a small crunched head that carries no readable face. Dormant it is folded
// into a bowed kneel with near-imperceptible breath-scale + a slow head-tilt;
// the RISE unfolds it FAST then holds it unnaturally STILL at full height,
// before a slow wrong-tempo first step. Every pose is sampled off `steppedTime`
// (12 fps) so it stutters against the smooth world. No texture, no new light.
// ---------------------------------------------------------------------------

const K_STAND_HIP_Y = 1.2;
const K_KNEEL_HIP_Y = 0.5;
const K_THIGH = 0.62;
const K_SHIN = 0.58;
const K_TORSO_H = 0.72;
const K_ARM_LEN = 0.92;
/** The unfold from kneel→full-height at the very start of the rise (fast, so
 *  the rest of `holdMs` is genuine, wrong stillness). */
const K_UNFOLD_MS = 160;
/** Wrong, slow first-step / walk tempo. */
const K_WALK_RATE = 5;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function box(w: number, h: number, d: number, mat: Material): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), mat);
}

/** A pivot Group with a box hanging DOWN from its joint (limb segments). */
function segment(len: number, w: number, mat: Material): Group {
  const g = new Group();
  const m = box(w, len, w, mat);
  m.position.set(0, -len / 2, 0);
  g.add(m);
  return g;
}

export class KneelerView implements EntityView {
  readonly root: Group;
  private readonly frame = new Group(); // holds the death topple
  private readonly hipG = new Group();
  private readonly spine = new Group();
  private readonly neck = new Group();
  private readonly torso: Mesh;
  private readonly thighL: Group;
  private readonly thighR: Group;
  private readonly kneeL: Group;
  private readonly kneeR: Group;
  private readonly shoulderL: Group;
  private readonly shoulderR: Group;
  private readonly mat: MeshStandardMaterial;
  private clock = 0;
  private deadT = -1;

  constructor(private readonly hollow: KneelingHollow) {
    this.mat = new MeshStandardMaterial({ color: KNEELER_TINT, roughness: 1, metalness: 0 });
    this.mat.emissive = new Color(0x000000);
    patchMaterial(this.mat);
    const m = this.mat;

    this.root = new Group();
    this.root.name = `kneeler:${hollow.id}`;
    this.root.add(this.frame);
    this.frame.add(this.hipG);

    // Pelvis + spine stack.
    const pelvis = box(0.3, 0.22, 0.22, m);
    pelvis.position.set(0, 0, 0);
    this.hipG.add(pelvis);
    this.spine.position.set(0, 0.08, 0);
    this.hipG.add(this.spine);

    this.torso = box(0.32, K_TORSO_H, 0.22, m);
    this.torso.position.set(0, K_TORSO_H / 2, 0);
    this.spine.add(this.torso);

    // Long neck + a small crunched, faceless head.
    this.neck.position.set(0, K_TORSO_H, 0);
    this.spine.add(this.neck);
    const neckMesh = box(0.15, 0.34, 0.15, m);
    neckMesh.position.set(0, 0.17, 0);
    this.neck.add(neckMesh);
    const head = box(0.3, 0.26, 0.34, m);
    head.position.set(0, 0.34 + 0.12, 0.03);
    this.neck.add(head);

    // Over-long thin arms hanging near the knees.
    this.shoulderL = new Group();
    this.shoulderL.position.set(0.22, K_TORSO_H - 0.05, 0);
    this.shoulderL.add(segment(K_ARM_LEN, 0.12, m));
    this.spine.add(this.shoulderL);
    this.shoulderR = new Group();
    this.shoulderR.position.set(-0.22, K_TORSO_H - 0.05, 0);
    this.shoulderR.add(segment(K_ARM_LEN, 0.12, m));
    this.spine.add(this.shoulderR);

    // Long thin legs: thigh → knee → shin.
    this.thighL = segment(K_THIGH, 0.15, m);
    this.thighL.position.set(0.12, 0, 0);
    this.kneeL = segment(K_SHIN, 0.14, m);
    this.kneeL.position.set(0, -K_THIGH, 0);
    this.thighL.add(this.kneeL);
    this.hipG.add(this.thighL);

    this.thighR = segment(K_THIGH, 0.15, m);
    this.thighR.position.set(-0.12, 0, 0);
    this.kneeR = segment(K_SHIN, 0.14, m);
    this.kneeR.position.set(0, -K_THIGH, 0);
    this.thighR.add(this.kneeR);
    this.hipG.add(this.thighR);
  }

  update(dtMs: number): void {
    const k = this.hollow;
    this.root.position.set(k.pos.x, k.pos.y, k.pos.z);
    this.root.rotation.y = k.yaw;

    if (k.state === 'dead') {
      if (this.deadT < 0) this.deadT = 0;
      this.deadT += dtMs;
      const fall = Math.min(1, this.deadT / 600);
      this.frame.rotation.x = 1.4 * fall; // pitches forward, crumples
      this.frame.position.y = -0.3 * fall;
      this.applyHurt();
      return;
    }

    this.clock += dtMs / 1000;
    const stepped = steppedTime(this.clock, K.animFps);

    let kAmt = 0; // 0 standing, 1 kneeling
    let breath = 1;
    let headTiltZ = 0;
    let leadStep = 0; // alert first-step overlay
    let walkPhase = -1; // < 0 → not walking
    let reach = 0; // attack arms

    switch (k.state) {
      case 'idle': {
        kAmt = 1;
        // Sample the dormant micro-motion off `stepped` (12 fps), NOT raw
        // `this.clock` — the same defect 1edcc2e fixed for the Hag. The breath
        // and head-tilt must pop at the wrong tempo while the world renders
        // smooth (the tall-entity stutter), or the "aliveness in stillness"
        // reads as a butter-smooth idle that gives the kneeler away as ordinary.
        breath = 1 + (K.idle.breathScalePct / 100) * Math.sin(stepped * 1.3);
        headTiltZ =
          Math.sin((stepped * 2 * Math.PI) / (K.idle.tiltPeriodMs / 1000)) *
          ((K.idle.headTiltMaxDeg * Math.PI) / 180);
        break;
      }
      case 'alert': {
        kAmt = 1 - Math.min(1, k.riseT / K_UNFOLD_MS);
        if (k.riseT >= RISE.holdMs) leadStep = Math.min(1, (k.riseT - RISE.holdMs) / RISE.firstStepMs);
        break;
      }
      case 'reposition':
      case 'recover':
      case 'approach':
        walkPhase = stepped * K_WALK_RATE;
        break;
      case 'attack':
        reach = Math.sin(stepped * 7) * 0.5 + 0.5;
        break;
      default:
        kAmt = 0;
    }

    this.hipG.position.y = lerp(K_STAND_HIP_Y, K_KNEEL_HIP_Y, kAmt);
    this.spine.rotation.x = lerp(0.12, 0.55, kAmt) + leadStep * 0.14 + reach * 0.2;
    this.neck.rotation.x = lerp(0.3, 0.95, kAmt) - leadStep * 0.05;
    this.neck.rotation.z = headTiltZ;
    this.torso.scale.set(breath, breath, breath);

    let hipL = lerp(0, 1.35, kAmt);
    let hipR = lerp(0, 1.35, kAmt);
    let kneeLb = lerp(-0.05, -2.3, kAmt);
    let kneeRb = lerp(-0.05, -2.3, kAmt);
    let shL = 0.05 - reach * 1.5;
    let shR = 0.05 - reach * 1.5;

    if (walkPhase >= 0) {
      hipL += Math.sin(walkPhase) * 0.5;
      hipR += Math.sin(walkPhase + Math.PI) * 0.5;
      kneeLb += -Math.max(0, -Math.sin(walkPhase)) * 0.6;
      kneeRb += -Math.max(0, -Math.sin(walkPhase + Math.PI)) * 0.6;
      shL += Math.sin(walkPhase + Math.PI) * 0.35;
      shR += Math.sin(walkPhase) * 0.35;
    }
    hipL += -leadStep * 0.5; // the lead leg swings forward on the first step
    kneeLb += -leadStep * 0.2;

    this.thighL.rotation.x = hipL;
    this.thighR.rotation.x = hipR;
    this.kneeL.rotation.x = kneeLb;
    this.kneeR.rotation.x = kneeRb;
    this.shoulderL.rotation.x = shL;
    this.shoulderR.rotation.x = shR;

    this.applyHurt();
  }

  private applyHurt(): void {
    const glow = this.hollow.hurtMs > 0 ? 0.8 : 0;
    this.mat.emissive.setRGB(glow, 0, 0);
    this.mat.emissiveIntensity = glow;
  }

  dispose(): void {
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    this.mat.dispose();
  }
}
