/**
 * ZoneManager — owns the currently-loaded zone: loads/builds zones, swaps
 * them into the scene, disposes the previous zone's GPU resources on
 * transition (renderer.info must not grow across transitions), fires
 * `zone-entered` on the event bus, and ticks torch flicker as a `Subsystem`.
 */
import type { InstancedMesh, Material, Mesh, MeshStandardMaterial, PointLight, Points, Scene, Sprite } from 'three';
import type { ZoneId } from '../content/types';
import type { EventBus } from '../engine/events';
import type { Subsystem } from '../engine/Game';
import { loadKitPieces } from './assets';
import type { AssetCache } from './assets';
import { gridToPlacements, PROCEDURAL_PROPS, ZoneBuilder } from './ZoneBuilder';
import type { BuiltZone, PlacedDoor } from './ZoneBuilder';
import type { ZoneDef } from './zoneDef';
import { applyNgPlus } from './ngplus';
import { anomaliesForZone } from '../content/anomalies';

export interface ZoneManagerOptions {
  scene: Scene;
  bus: EventBus;
  /** Zone registry: resolves an id to its authored definition. */
  resolve: (id: ZoneId) => ZoneDef;
  /** Asset loader, injectable for tests. Defaults to the GLB kit loader. */
  loadAssets?: (names: Iterable<string>) => Promise<AssetCache>;
}

/** Kit pieces a zone needs: grid placements + props + torch/banner extras. */
function neededPieces(def: ZoneDef): Set<string> {
  const pieces = new Set<string>();
  for (const p of gridToPlacements(def)) pieces.add(p.piece); // also validates the grid early
  // Procedural props (gibbet) are generated geometry, not a GLB — never request
  // them. Object.hasOwn, not `in`: a bare `in` reaches Object.prototype, so a
  // kit prop named e.g. 'toString' would be silently dropped from the load set.
  for (const prop of def.props) if (!Object.hasOwn(PROCEDURAL_PROPS, prop.kind)) pieces.add(prop.kind);
  // `A` door-void house-blocks render as `wall-arch.glb` in the exterior build
  // (gridToPlacements only knows the interior 'wall' path), so request it here.
  if (def.grid.some((row) => row.includes('A'))) pieces.add('wall-arch');
  if (def.lights.length > 0) pieces.add('torch');
  if (def.banner) pieces.add('banner');
  return pieces;
}

interface FlickeringTorch {
  light: PointLight;
  base: number;
  phase: number;
}

export class ZoneManager implements Subsystem {
  /** Id of the zone currently in the scene. Valid after the first `load`. */
  current!: ZoneId;

  private readonly scene: Scene;
  private readonly bus: EventBus;
  private readonly resolve: (id: ZoneId) => ZoneDef;
  private readonly loadAssets: (names: Iterable<string>) => Promise<AssetCache>;
  private readonly builder = new ZoneBuilder();
  private built: BuiltZone | undefined;
  private ng = false;
  private torches: FlickeringTorch[] = [];
  private time = 0;
  /** Global multiplier on every torch's base intensity — the Forsworn snuffs
   *  the arena to near-black in P3 (main.ts lerps this toward ~0). Reset to 1
   *  on every zone load. */
  private torchScale = 1;

  constructor(opts: ZoneManagerOptions) {
    this.scene = opts.scene;
    this.bus = opts.bus;
    this.resolve = opts.resolve;
    this.loadAssets = opts.loadAssets ?? loadKitPieces;
  }

  /** Load a zone (optionally its NG+ variant), swap it into the scene,
   * dispose the previous zone, and announce `zone-entered`. */
  async load(id: ZoneId, ng: boolean): Promise<BuiltZone> {
    const base = this.resolve(id);
    // NG+ (Second Vigil): merge the zone's ngPlus variant (enemy remix + ngOnly
    // lore) and apply this zone's anomalies as the post-build hook. A base run
    // uses the untouched def and an empty anomaly list — no NG+ leakage.
    const def: ZoneDef = ng ? applyNgPlus(base) : base;
    const anomalies = ng ? anomaliesForZone(id) : [];

    const assets = await this.loadAssets(neededPieces(def));
    const built = this.builder.build(def, assets, anomalies);

    this.disposeCurrent();
    this.scene.add(built.group);
    this.built = built;
    this.current = id;
    this.ng = ng;
    this.torches = built.lights.map((light, i) => ({
      light,
      base: light.intensity,
      phase: i * 1.618,
    }));
    this.torchScale = 1; // a fresh zone starts fully lit
    this.bus.emit({ type: 'zone-entered', zone: id });
    return built;
  }

  /** Walk through a door: loads its destination zone (same NG+ state) and
   * returns it so the caller can rebuild zone-scoped state (Task 11). */
  async transition(door: PlacedDoor): Promise<BuiltZone> {
    return this.load(door.def.to, this.ng);
  }

  /** Global torch-intensity multiplier (0..1). The Forsworn's P3 blackout. */
  setTorchScale(scale: number): void {
    this.torchScale = Math.min(1, Math.max(0, scale));
  }

  /** Subsystem tick: torch flicker via layered sin-noise (deterministic,
   * no random flashes — flicker-safe), plus the exterior ash-fall drift. */
  update(dtMs: number): void {
    this.time += dtMs;
    const t = this.time;
    for (const { light, base, phase } of this.torches) {
      const n =
        Math.sin(t * 0.011 + phase * 7.3) * 0.55 +
        Math.sin(t * 0.0047 + phase * 3.1) * 0.3 +
        Math.sin(t * 0.023 + phase) * 0.15;
      light.intensity = base * this.torchScale * (1 + 0.22 * n);
    }
    // Exterior zones drift the ash each frame (interior zones leave it unset).
    this.built?.updateExterior?.(dtMs);
  }

  /** Remove the current zone and free its GPU resources. Geometries and
   * material clones are zone-owned; textures are shared with the kit
   * template cache, but disposing them is safe — three re-uploads a
   * disposed texture the next time a material samples it. */
  private disposeCurrent(): void {
    const built = this.built;
    if (!built) return;
    this.scene.remove(built.group);
    // Free a mesh/points/sprite's geometry + material(s) (and its texture, which
    // three re-uploads on next sample so a shared-atlas dispose is safe).
    const freeDrawable = (obj: Mesh | Points | Sprite): void => {
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        (material as MeshStandardMaterial).map?.dispose();
        (material as Material).dispose();
      }
    };
    built.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        freeDrawable(mesh);
        // InstancedMesh (exterior forest) also owns an instanceMatrix buffer.
        const inst = obj as InstancedMesh;
        if (inst.isInstancedMesh) inst.dispose();
        return;
      }
      // Task 2: the exterior ash-fall (Points) and any Sprite leaked under the
      // v1 teardown (Mesh + PointLight only) — free them too.
      const points = obj as Points;
      if (points.isPoints) {
        freeDrawable(points);
        return;
      }
      const sprite = obj as Sprite;
      if (sprite.isSprite) {
        freeDrawable(sprite);
        return;
      }
      const light = obj as PointLight;
      if (light.isPointLight) light.dispose();
    });
    this.built = undefined;
    this.torches = [];
  }
}
