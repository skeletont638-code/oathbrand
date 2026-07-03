/**
 * Ash-Hound (Greater Vael Drop 1, Task 4) — the thing that circles you at the
 * fog edge before it lunges.
 *
 * FSM: idle → alert (LOS within aggroM, `alertMs` notice) → approach (straight
 * steer through `collider.slide`, walls absorb the blocked axis — no
 * pathfinding) → circle (a flanking stalk: it orbits the player on a RANDOMISED
 * side while spiralling inward from `circle.radiusM` toward lunge range over a
 * RANDOMISED `minMs..maxMs` duration) → attack (the pounce, from the committed
 * flank: windup telegraph → active dash at `lunge.speedM` → recover) →
 * approach again, or leash to idle past 1.5×aggro. Every number is from
 * `TUNING.greaterVael.hound`.
 *
 * `circle` re-rolls BOTH the flank (`rng() < 0.5 ? +1 : -1`) and the duration
 * (`minMs + rng()*(maxMs-minMs)`) on EVERY entry, so no two circles are the
 * same and the player can't pre-commit a dodge direction.
 *
 * The connect goes through the player's `MeleeDefense` first (a guarded frontal
 * pounce is blocked; no event, no damage), exactly like the soldier/wraith.
 * `pantCue` is a distinct panting/footfall one-shot main wires while the hound
 * moves — it is deliberately NOT scaled by the brand pulse (spec §9): the hound
 * you HEAR is not the brand you feel.
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
import { HOUND_TINT } from './palette';
import { getTexture } from '../world/textures';

const H = TUNING.greaterVael.hound;
const C = H.circle;
const L = H.lunge;
/** Give up the hunt past 1.5× aggro (the soldier rule, tuned per-kind). */
const LEASH_M = H.aggroM * H.leashMul;
/** Footfall/pant cadence (ms) while the hound is moving. */
const PANT_MS = 320;

export type AshHoundDeps = Omit<EnemyDeps, 'kind' | 'hp'> & {
  /** Deterministic 0..1 source — main wires the run's seeded PRNG. */
  rng: () => number;
  /** Panting/footfall one-shot; NOT scaled by the brand pulse (spec §9). */
  pantCue: () => void;
};

export class AshHound extends Enemy {
  override readonly radius = 0.6; // a big four-legged frame
  /** The rolled flank (+1 / -1) and duration (ms) of the CURRENT circle — the
   *  view reads these to lean into the turn; tests assert they re-roll. */
  circleSide: 1 | -1 = 1;
  circleMs: number = C.minMs;

  private alertT = 0;
  private circleT = 0;
  /** Attack sub-phase timer + one-connect-per-pounce latch. */
  private t = 0;
  private phase: 'windup' | 'active' = 'windup';
  private hitDone = false;
  private pantT = 0;
  // Scratch — the per-frame path allocates nothing.
  private readonly move: Vec2 = { x: 0, z: 0 };
  private readonly from: Vec2 = { x: 0, z: 0 };

  constructor(private readonly houndDeps: AshHoundDeps) {
    super({ ...houndDeps, kind: 'hound', hp: H.hp });
  }

  protected override think(dt: number, ctx: EnemyCtx): void {
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    // Clamped away from 0 so unit vectors never go NaN standing on the player.
    const dist = Math.hypot(dx, dz) || 1e-6;

    switch (this.state) {
      case 'idle':
        if (ctx.canSeePlayer && dist <= H.aggroM) {
          this.state = 'alert';
          this.alertT = 0;
          this.face(dx, dz);
        }
        return;

      case 'alert':
        this.face(dx, dz);
        this.alertT += dt;
        if (this.alertT >= H.alertMs) this.state = 'approach';
        return;

      case 'reposition': // hounds never reposition; recover to the hunt
      case 'approach': {
        if (dist > LEASH_M) {
          this.state = 'idle';
          this.resetAction();
          return;
        }
        this.face(dx, dz);
        // Reached the fog edge → start the flanking stalk.
        if (dist <= C.radiusM) {
          this.enterCircle();
          return;
        }
        this.stepToward(dx, dz, dist, H.speed, dt, ctx);
        this.pant(dt);
        return;
      }

      case 'circle': {
        if (dist > LEASH_M) {
          this.state = 'idle';
          this.resetAction();
          return;
        }
        this.circleT += dt;
        // Orbit tangentially on the rolled flank while closing the radial gap so
        // the hound arrives at lunge range just as the stalk timer runs out.
        const ux = dx / dist; // unit toward player
        const uz = dz / dist;
        const tx = -uz * this.circleSide; // perpendicular, signed by flank
        const tz = ux * this.circleSide;
        const tang = (C.speedM * dt) / 1000;
        const remain = Math.max(dt, this.circleMs - this.circleT);
        const maxIn = (L.speedM * dt) / 1000; // never teleport inward
        const inward = Math.min(maxIn, Math.max(0, dist - L.rangeM) * (dt / remain));
        this.move.x = tx * tang + ux * inward;
        this.move.z = tz * tang + uz * inward;
        const out = ctx.collider.slide(this.pos, this.move, this.radius);
        this.pos.x = out.x;
        this.pos.z = out.z;
        this.face(dx, dz);
        this.pant(dt);
        // The pounce fires when the stalk elapses or the spiral reaches range.
        if (this.circleT >= this.circleMs || dist <= L.rangeM) {
          this.state = 'attack';
          this.resetAction();
          this.face(dx, dz); // facing committed as of this frame
        }
        return;
      }

      case 'attack': {
        this.t += dt;
        if (this.phase === 'windup' && this.t >= L.windupMs) {
          this.phase = 'active';
          this.t -= L.windupMs;
        }
        if (this.phase !== 'active') return;
        // The pounce: surge along the committed facing (walls stop it short).
        const dash = (L.speedM * dt) / 1000;
        this.move.x = Math.sin(this.yaw) * dash;
        this.move.z = Math.cos(this.yaw) * dash;
        const out = ctx.collider.slide(this.pos, this.move, this.radius);
        this.pos.x = out.x;
        this.pos.z = out.z;
        // Hit window: at most one connect per pounce, guard consulted first.
        const d = Math.hypot(ctx.playerPos.x - this.pos.x, ctx.playerPos.z - this.pos.z);
        if (!this.hitDone && d <= L.rangeM + TUNING.player.radius) {
          this.hitDone = true;
          this.from.x = this.pos.x;
          this.from.z = this.pos.z;
          if (!this.houndDeps.defense?.blockMelee(this.from)) {
            this.houndDeps.bus.emit({ type: 'player-hit', damage: L.damage });
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

  private enterCircle(): void {
    // Re-roll the flank AND the duration every cycle (spec §9 randomisation).
    this.circleSide = this.houndDeps.rng() < 0.5 ? 1 : -1;
    this.circleMs = C.minMs + this.houndDeps.rng() * (C.maxMs - C.minMs);
    this.circleT = 0;
    this.state = 'circle';
  }

  private stepToward(dx: number, dz: number, dist: number, speed: number, dt: number, ctx: EnemyCtx): void {
    const step = (speed * dt) / 1000;
    this.move.x = (dx / dist) * step;
    this.move.z = (dz / dist) * step;
    const out = ctx.collider.slide(this.pos, this.move, this.radius);
    this.pos.x = out.x;
    this.pos.z = out.z;
  }

  private pant(dt: number): void {
    this.pantT += dt;
    if (this.pantT >= PANT_MS) {
      this.pantT -= PANT_MS;
      this.houndDeps.pantCue();
    }
  }

  /** ZoneBuilder facing convention: rotate model +z toward (dx, dz). */
  private face(dx: number, dz: number): void {
    this.yaw = Math.atan2(dx, dz);
  }

  private resetAction(): void {
    this.alertT = 0;
    this.circleT = 0;
    this.t = 0;
    this.phase = 'windup';
    this.hitDone = false;
  }
}

// ---------------------------------------------------------------------------
// View: a bespoke low-poly quadruped (no quadruped rig ships in the KayKit
// pack). The tall-creepy directive — elongate the legs, elongate the low neck,
// underfeed the frame, crunch the drooping head — is baked into the box
// proportions here, so the flat-black silhouette at 13 m fog reads as a WRONG
// four-legged thing with a stride that's too long for anything that should
// exist. The lope + pounce are sampled off `steppedTime` (12 fps) so the hound
// stutters against the smooth world. The parts sample ONE shared crunched
// hound-hide map (ash-crusted hide/bone) MULTIPLIED by HOUND_TINT — the tint
// stays the multiply base so the frame reads dark-but-formed (brighter than the
// Watcher's pure black, darker than the terrain). Faceless is preserved: the
// head box samples the SAME skin, no face texture. No new light.
// ---------------------------------------------------------------------------

/** A dark-ash hound-hide part material, PS1-patched and tracked for disposal.
 *  The tint is the multiply base; the crunched hide map (a high-key detail map,
 *  so map×tint stays in the readable band — Task 7 lesson) supplies the crunch.
 *  getTexture undefined (headless / pre-preload) → no map → flat tint fallback. */
function houndMat(sink: MeshStandardMaterial[]): MeshStandardMaterial {
  const map = getTexture('hound-hide');
  const mat = new MeshStandardMaterial({ color: HOUND_TINT, roughness: 1, metalness: 0 });
  if (map) mat.map = map; // set BEFORE patchMaterial so the affine warp binds; absent → flat fallback
  mat.emissive = new Color(0x000000);
  patchMaterial(mat); // affine applies when map present; tint multiplies the crunched hide
  sink.push(mat);
  return mat;
}

function box(w: number, h: number, d: number, mat: Material): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), mat);
}

/** The body stack that rises ABOVE the hip line: the torso offset (0.05) + the
 *  gaunt ridge's offset (0.3) + its half-height (0.11). The silhouette's TOP is
 *  the ridge, so the leg length is back-solved from the tuned `heightM` (2.3 m,
 *  previously a dead field): ridge-top = HOUND_LEG_LEN + HOUND_BACK_RISE = heightM. */
const HOUND_BACK_RISE = 0.46;
const HOUND_LEG_LEN = H.heightM - HOUND_BACK_RISE; // 2.3 − 0.46 → 1.84 m of too-long leg
const HOUND_HIP_Y = HOUND_LEG_LEN;
const HOUND_TORSO_Y = HOUND_HIP_Y + 0.05;

export class HoundView implements EntityView {
  readonly root: Group;
  private readonly body = new Group();
  private readonly torso: Mesh;
  private readonly neck = new Group();
  /** Hip pivots: [frontL, frontR, backL, backR]. */
  private readonly hips: Group[] = [];
  private readonly mats: MeshStandardMaterial[] = [];
  private clock = 0;
  private deadT = -1;

  constructor(private readonly hound: AshHound) {
    this.root = new Group();
    this.root.name = `hound:${hound.id}`;
    this.root.add(this.body);

    // Elongated, underfed torso — narrow and far too long.
    this.torso = box(0.42, 0.46, 2.6, houndMat(this.mats));
    this.torso.position.set(0, HOUND_TORSO_Y, 0);
    this.body.add(this.torso);
    // A gaunt shoulder ridge so the back reads bony, not blocky.
    const ridge = box(0.24, 0.22, 1.9, houndMat(this.mats));
    ridge.position.set(0, HOUND_TORSO_Y + 0.3, -0.1);
    this.body.add(ridge);

    // Four over-long thin legs; the stride amplitude is what sells "too long".
    const legX = 0.2;
    const legZ = 1.05;
    for (const [sx, sz] of [
      [legX, legZ],
      [-legX, legZ],
      [legX, -legZ],
      [-legX, -legZ],
    ] as const) {
      const hip = new Group();
      hip.position.set(sx, HOUND_HIP_Y, sz);
      const leg = box(0.15, HOUND_LEG_LEN, 0.15, houndMat(this.mats));
      leg.position.set(0, -HOUND_LEG_LEN / 2, 0);
      hip.add(leg);
      this.body.add(hip);
      this.hips.push(hip);
    }

    // A long, low neck that droops forward, ending in a small crunched head —
    // no face reads at distance, only a wrong wedge hanging off the front.
    this.neck.position.set(0, HOUND_TORSO_Y + 0.22, 1.25);
    this.neck.rotation.x = 0.9; // pitched down toward the ground
    const neckMesh = box(0.26, 0.26, 1.15, houndMat(this.mats));
    neckMesh.position.set(0, 0, 0.5);
    this.neck.add(neckMesh);
    const head = box(0.34, 0.3, 0.5, houndMat(this.mats));
    head.position.set(0, -0.14, 1.05);
    head.rotation.x = -0.5; // crunched, snout-down
    this.neck.add(head);
    this.body.add(this.neck);
  }

  update(dtMs: number): void {
    const h = this.hound;
    this.root.position.set(h.pos.x, h.pos.y, h.pos.z);
    this.root.rotation.y = h.yaw;

    if (h.state === 'dead') {
      if (this.deadT < 0) this.deadT = 0;
      this.deadT += dtMs;
      const fall = Math.min(1, this.deadT / 500);
      this.body.rotation.z = (Math.PI / 2) * fall; // topples onto its side
      this.body.position.y = -HOUND_HIP_Y * 0.5 * fall;
      this.applyHurt();
      return;
    }

    this.clock += dtMs / 1000;
    const stepped = steppedTime(this.clock, H.animFps);

    // Per-state gait: idle barely breathes; the stalk/hunt swing the too-long
    // stride wide; the pounce leans the whole frame forward.
    let rate = 1.6;
    let amp = 0.1;
    let lean = 0;
    switch (h.state) {
      case 'approach':
        rate = 7;
        amp = 0.7;
        break;
      case 'circle':
        rate = 8;
        amp = 0.75;
        break;
      case 'attack':
        rate = 11;
        amp = 0.85;
        lean = 0.32; // nose-down pounce
        break;
      case 'recover':
        rate = 3;
        amp = 0.3;
        break;
      case 'alert':
        rate = 2.2;
        amp = 0.16;
        break;
      default: // idle
        rate = 1.6;
        amp = 0.1;
    }

    const p = stepped * rate;
    // Diagonal gait: FL+BR together, FR+BL opposed.
    this.hips[0].rotation.x = Math.sin(p) * amp;
    this.hips[3].rotation.x = Math.sin(p) * amp;
    this.hips[1].rotation.x = Math.sin(p + Math.PI) * amp;
    this.hips[2].rotation.x = Math.sin(p + Math.PI) * amp;
    this.torso.position.y = HOUND_TORSO_Y + Math.abs(Math.sin(p * 2)) * 0.05 * (amp > 0.3 ? 1 : 0.4);
    this.body.rotation.x = lean;
    this.body.rotation.z = 0;
    this.body.position.y = 0;
    // The low head keeps a slow wrong sway even mid-hunt.
    this.neck.rotation.y = Math.sin(stepped * 0.7) * 0.12;

    this.applyHurt();
  }

  /** Flash the ash red while a non-fatal hit registers (the view's hurt tell). */
  private applyHurt(): void {
    const glow = this.hound.hurtMs > 0 ? 0.8 : 0;
    for (const m of this.mats) {
      m.emissive.setRGB(glow, 0, 0);
      m.emissiveIntensity = glow;
    }
  }

  dispose(): void {
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}
