/**
 * Enemy animation (Task 9): maps the Enemy FSM state to KayKit skeleton
 * clips and crossfades them on a three `AnimationMixer`.
 *
 * Clip names below are VERIFIED against assets/kit/skeleton-warrior.glb
 * (95 embedded clips — `node scripts/verify-gltf.mjs`). KIT.md's shortlist
 * checks out; we additionally use `Idle_Combat` (present in the pack) for
 * the alert/recover stance because plain `Idle` reads as unaware.
 *
 * `EnemyView` is the render-side twin of an `Enemy`: it owns the skinned
 * clone (SkeletonUtils — a plain .clone() breaks skinned meshes), syncs
 * position/yaw from the logic object every frame, drives the state clip,
 * plays `Hit_A` as a one-shot flash while `enemy.hurtMs` runs, and clamps
 * `Death_A` on its last frame so corpses stay down.
 */
import { AnimationClip, AnimationMixer, LoopOnce, NearestFilter } from 'three';
import type { AnimationAction, Group, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { patchMaterial } from '../ps1/patchMaterial';
import type { Enemy, EnemyState } from './Enemy';
import type { Wraith } from './Wraith';

/** FSM state → KayKit clip. (Hit/death handling is in EnemyView.) */
export const CLIP_FOR_STATE: Record<EnemyState, string> = {
  idle: 'Idle',
  alert: 'Idle_Combat',
  approach: 'Walking_A',
  attack: '1H_Melee_Attack_Chop',
  recover: 'Idle_Combat',
  reposition: 'Walking_A',
  dead: 'Death_A',
};

/** Per-kind overrides layered over CLIP_FOR_STATE (Task 10). All names
 * verified against the GLBs (both skeletons share the 95-clip rig). */
export const ARCHER_CLIPS: Partial<Record<EnemyState, string>> = {
  alert: '2H_Ranged_Aiming', // crossbow up, holding the line
  attack: '2H_Ranged_Shooting',
  recover: '2H_Ranged_Reload',
  reposition: 'Walking_Backwards', // backpedals while keeping aim
};

export const WRAITH_CLIPS: Partial<Record<EnemyState, string>> = {
  approach: 'Running_A', // speed 2.3 reads as a run, not a walk
  attack: '1H_Melee_Attack_Stab', // the lunge
};

const HIT_CLIP = 'Hit_A';
const FADE_MS = 140;

/** Currently-playing action per mixer, for crossfades. */
const current = new WeakMap<AnimationMixer, AnimationAction>();

/**
 * Crossfade the mixer to the named clip over `fadeMs`. Clips are resolved
 * from the mixer root's `animations` array (set it when instancing the GLB).
 * Re-requesting the clip that is already running is a no-op; unknown names
 * warn once and return null (a missing clip must never crash combat).
 */
export function playClip(mixer: AnimationMixer, name: string, fadeMs: number): AnimationAction | null {
  const root = mixer.getRoot() as Object3D;
  const clip = AnimationClip.findByName(root.animations, name);
  if (!clip) {
    console.warn(`animator: no clip "${name}" on ${root.name || 'mixer root'}`);
    return null;
  }
  const prev = current.get(mixer);
  if (prev && prev.getClip() === clip && prev.isRunning()) return prev;
  const action = mixer.clipAction(clip);
  action.reset().fadeIn(fadeMs / 1000).play();
  if (prev && prev !== action) prev.fadeOut(fadeMs / 1000);
  current.set(mixer, action);
  return action;
}

export interface SkeletonTemplate {
  scene: Group;
  animations: AnimationClip[];
}

/** Load a skinned enemy GLB keeping its animations (the kit template cache
 * in world/assets.ts stores scenes only, so skeletons load through here). */
export async function loadSkeleton(url: string): Promise<SkeletonTemplate> {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  return { scene: gltf.scene, animations: gltf.animations };
}

/** PS1-ify a clone's materials: per-instance clone, crunchy nearest
 * sampling, and the pipeline's vertex-snap/affine patch (skinning happens
 * before project_vertex, so the snap applies to the posed vertices). */
function ps1ify(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    // Skinned bounds don't follow the bones; never let three cull mid-swing.
    mesh.frustumCulled = false;
    const material = (mesh.material as Material).clone();
    const map = (material as MeshStandardMaterial).map;
    if (map) {
      map.magFilter = NearestFilter;
      map.minFilter = NearestFilter;
      map.generateMipmaps = false;
      map.needsUpdate = true;
    }
    patchMaterial(material);
    mesh.material = material;
  });
}

export class EnemyView {
  readonly root: Object3D;
  private readonly mixer: AnimationMixer;
  private lastState: EnemyState | null = null;
  private prevHurt = 0;
  private flashing = false;
  private deadPlayed = false;

  /**
   * @param attackMs total windup+active ms of the enemy's swing — the attack
   *   clip's timeScale is stretched so the anim contact lines up with the
   *   FSM's active window (the telegraph must not lie).
   * @param clips per-kind clip overrides layered over CLIP_FOR_STATE
   *   (e.g. ARCHER_CLIPS swaps the melee chop for the crossbow set).
   */
  constructor(
    private readonly enemy: Enemy,
    template: SkeletonTemplate,
    scale: number,
    private readonly attackMs: number,
    private readonly clips?: Partial<Record<EnemyState, string>>,
  ) {
    this.root = cloneSkinned(template.scene);
    this.root.name = `enemy:${enemy.id}`;
    this.root.animations = template.animations;
    this.root.scale.setScalar(scale);
    ps1ify(this.root);
    this.mixer = new AnimationMixer(this.root);
  }

  /** Sync transform from the logic enemy and advance the animation state. */
  update(dtMs: number): void {
    const e = this.enemy;
    this.root.position.set(e.pos.x, e.pos.y, e.pos.z);
    this.root.rotation.y = e.yaw;

    if (e.state === 'dead') {
      if (!this.deadPlayed) {
        this.deadPlayed = true;
        const action = playClip(this.mixer, this.clipFor('dead'), FADE_MS);
        if (action) {
          action.setLoop(LoopOnce, 1);
          action.clampWhenFinished = true;
        }
      }
    } else if (e.hurtMs > this.prevHurt) {
      // Fresh hit: one-shot flinch, then force the state clip to reapply.
      // Clamp so a short clip holds its last frame instead of bind-posing.
      const action = playClip(this.mixer, HIT_CLIP, 60);
      if (action) {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.flashing = true;
      this.lastState = null;
    } else if ((!this.flashing || e.hurtMs === 0) && e.state !== this.lastState) {
      this.flashing = false;
      this.lastState = e.state;
      const action = playClip(this.mixer, this.clipFor(e.state), FADE_MS);
      if (action && e.state === 'attack') {
        // Stretch/compress the chop so its contact sits in the FSM's window.
        action.timeScale = action.getClip().duration / (this.attackMs / 1000);
      } else if (action) {
        action.timeScale = 1;
      }
    }
    this.prevHurt = e.hurtMs;
    this.mixer.update(dtMs / 1000);
  }

  private clipFor(state: EnemyState): string {
    return this.clips?.[state] ?? CLIP_FOR_STATE[state];
  }

  /**
   * Release this view's per-instance resources on zone teardown (Task 11):
   * stop + uncache the mixer's actions and dispose the materials `ps1ify`
   * cloned. Geometry and textures stay — both are shared with the cached
   * skeleton template that outlives every zone. Call after removing
   * `root` from the scene; the view must not be updated afterwards.
   */
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) (mesh.material as Material).dispose();
    });
  }
}

/**
 * Brand-Wraith view (Task 10): the skeleton-warrior rig wearing a ghost —
 * there is no dedicated wraith model. Every (already per-instance-cloned,
 * `patchMaterial`-patched) material is made transparent with `depthWrite`
 * off and a cold spectral tint; per frame the root's visibility follows
 * `wraith.visible` (brand pulse > threshold) and opacity = pulse intensity.
 *
 * patchMaterial + transparency: the patch only rewrites vertex snapping and
 * the affine `map` sample — `opacity` stays a stock three uniform that the
 * renderer refreshes from `material.opacity` every frame, so driving it
 * here works unchanged on patched materials (verified in-browser).
 */
export class WraithView extends EnemyView {
  private readonly wraith: Wraith;
  private readonly ghostMats: MeshStandardMaterial[] = [];

  constructor(wraith: Wraith, template: SkeletonTemplate, scale: number, attackMs: number) {
    super(wraith, template, scale, attackMs, WRAITH_CLIPS);
    this.wraith = wraith;
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as MeshStandardMaterial;
      mat.transparent = true;
      mat.depthWrite = false; // a veil, not a body — never occludes
      mat.opacity = 0;
      mat.color.setHex(0x9fd8e8); // cold spectral tint over the bone texture
      mat.emissive.setHex(0x10333f); // faint inner glow so it reads in the dark
      this.ghostMats.push(mat);
    });
    this.root.visible = false;
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    this.root.visible = this.wraith.visible;
    const opacity = this.wraith.opacity;
    for (const mat of this.ghostMats) mat.opacity = opacity;
  }
}
