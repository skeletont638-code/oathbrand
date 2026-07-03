/**
 * The AF-1 crossing silhouette (Greater Vael Drop 1, finding 4a) — the drop's
 * ONE pure-visual scare: a tall dark shape that crosses between two dense-tree
 * cells at the fog's edge, downrange of the player, then is gone. It teaches
 * that a silhouette is a genuine warning (a real Ash-Hound begins circling ~4 s
 * later), NOT a screen gimmick — so it uses no PS1 glitch, deals no damage, and
 * shares no collider: it is a backdrop mesh the DreadDirector arms and main ticks.
 *
 * It is motion, NOT a strobe (spec §3.2): the figure LERPS smoothly between the
 * two authored world points over ~1.8 s while a subtle 12 fps stride sway leans
 * it along the travel; it despawns at the end of the traverse OR the instant the
 * player closes within `DESPAWN_M` ("gone if approached"). A dark, thin, too-tall
 * biped run through the same PS1 material patch the zones use, `fog:true` so it
 * dissolves into the fog gradient rather than reading as a lit body.
 */
import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Material } from 'three';
import { patchMaterial } from '../ps1/patchMaterial';
import { steppedTime } from './animator';
import type { Vec2Like, Vec3Like } from './WatcherPresence';
import { bentLimb, blobHead, centredCapsule, taperedCapsule } from './organic';

/** Traverse duration, ms (spec §3.2: ~1.5–2 s). */
export const CROSS_MS = 1800;
/** Approach distance that despawns it early — "gone if approached", m. */
export const CROSS_DESPAWN_M = 6;
/** The figure's height, m — tall/creepy, but an ambiguous glimpse, not the Watcher. */
const FIG_H = 2.5;
/** The stepped stride cadence (12 fps, the tall-entity stutter). */
const STRIDE_FPS = 12;

function darkMat(sink: MeshStandardMaterial[]): MeshStandardMaterial {
  // Pure black + black emissive → reflects no light → an unlit silhouette under
  // any ambient; fog tints it toward the sky horizon as it recedes.
  const mat = new MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0 });
  mat.emissive = new Color(0x000000);
  patchMaterial(mat);
  sink.push(mat);
  return mat;
}

/** A pivot Group with a BENT thin leg hanging DOWN from its joint. */
function leg(len: number, mat: Material): Group {
  const g = new Group();
  g.add(new Mesh(bentLimb(len, 0.09, 0.055, len * 0.06), mat));
  return g;
}

export class CrossingSilhouette {
  readonly root: Group;
  private readonly figure = new Group();
  private readonly legL: Group;
  private readonly legR: Group;
  private readonly mats: MeshStandardMaterial[] = [];
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private t = -1; // < 0 ⇒ inactive
  private durMs = CROSS_MS;
  private clock = 0;

  constructor() {
    this.root = new Group();
    this.root.name = 'crossing-silhouette';
    this.root.add(this.figure);

    const legLen = FIG_H * 0.5;
    // Two over-long bent thin legs on a hip line (the stride sells "moving").
    this.legL = leg(legLen, darkMat(this.mats));
    this.legL.position.set(0.13, legLen, 0);
    this.legR = leg(legLen, darkMat(this.mats));
    this.legR.position.set(-0.13, legLen, 0);
    this.figure.add(this.legL, this.legR);
    // A narrow tapered torso, a thin neck spindle, a small crunched blob head.
    const torsoH = FIG_H * 0.3;
    const torso = new Mesh(centredCapsule(0.19, 0.13, torsoH), darkMat(this.mats));
    torso.position.set(0, legLen + torsoH / 2, 0);
    this.figure.add(torso);
    const neck = new Mesh(taperedCapsule(0.065, 0.05, FIG_H * 0.1), darkMat(this.mats));
    neck.position.set(0, legLen + torsoH, 0);
    this.figure.add(neck);
    const head = new Mesh(blobHead(0.12, 0x77c), darkMat(this.mats));
    head.position.set(0, legLen + torsoH + FIG_H * 0.13, 0.02);
    this.figure.add(head);
    this.figure.rotation.x = 0.12; // a slight forward lean along the travel

    this.root.visible = false;
  }

  /** True while the crossing is playing (the mesh is visible). */
  get present(): boolean {
    return this.t >= 0;
  }

  /** Start a crossing from `from` to `to` (world space) over `durMs`. Faces the
   *  figure along the travel so the lean reads as walking. */
  arm(from: Vec3Like, to: Vec3Like, durMs = CROSS_MS): void {
    this.from.set(from.x, from.y, from.z);
    this.to.set(to.x, to.y, to.z);
    this.durMs = Math.max(1, durMs);
    this.t = 0;
    this.clock = 0;
    this.root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    this.root.position.copy(this.from);
    this.root.visible = true;
  }

  /** Per frame while active: lerp the position, sway a stepped stride, and
   *  despawn at the end of the traverse or when the player closes within
   *  CROSS_DESPAWN_M. Cheap; touches no collider, no sim, no damage. */
  update(dtMs: number, playerPos: Vec2Like): void {
    if (this.t < 0) return;
    this.t += dtMs;
    this.clock += dtMs / 1000;
    const u = Math.min(1, this.t / this.durMs);
    const x = this.from.x + (this.to.x - this.from.x) * u;
    const y = this.from.y + (this.to.y - this.from.y) * u;
    const z = this.from.z + (this.to.z - this.from.z) * u;
    this.root.position.set(x, y, z);
    // A subtle 12 fps stride sway — motion, not a strobe (the position lerp is
    // smooth; only the limb phase steps at the tall-entity tempo).
    const phase = steppedTime(this.clock, STRIDE_FPS) * 6;
    this.legL.rotation.x = Math.sin(phase) * 0.5;
    this.legR.rotation.x = Math.sin(phase + Math.PI) * 0.5;
    const dist = Math.hypot(playerPos.x - x, playerPos.z - z);
    if (u >= 1 || dist <= CROSS_DESPAWN_M) this.despawn();
  }

  private despawn(): void {
    this.t = -1;
    this.root.visible = false;
  }

  dispose(): void {
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}
