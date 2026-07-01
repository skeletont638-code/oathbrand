/**
 * ZoneManager — owns the currently-loaded zone: loads/builds zones, swaps
 * them into the scene, disposes the previous zone's GPU resources on
 * transition (renderer.info must not grow across transitions), fires
 * `zone-entered` on the event bus, and ticks torch flicker as a `Subsystem`.
 */
import type { Mesh, MeshStandardMaterial, PointLight, Scene } from 'three';
import type { ZoneId } from '../content/types';
import type { EventBus } from '../engine/events';
import type { Subsystem } from '../engine/Game';
import { loadKitPieces } from './assets';
import type { AssetCache } from './assets';
import { gridToPlacements, ZoneBuilder } from './ZoneBuilder';
import type { BuiltZone, PlacedDoor } from './ZoneBuilder';
import type { ZoneDef } from './zoneDef';

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
  for (const prop of def.props) pieces.add(prop.kind);
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
    // NG+ variants override whole satellite arrays on top of the base zone.
    const def: ZoneDef = ng && base.ngPlus ? { ...base, ...base.ngPlus } : base;

    const assets = await this.loadAssets(neededPieces(def));
    const built = this.builder.build(def, assets);

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
    this.bus.emit({ type: 'zone-entered', zone: id });
    return built;
  }

  /** Walk through a door: loads its destination zone (same NG+ state). */
  async transition(door: PlacedDoor): Promise<void> {
    await this.load(door.def.to, this.ng);
  }

  /** Subsystem tick: torch flicker via layered sin-noise (deterministic,
   * no random flashes — flicker-safe). */
  update(dtMs: number): void {
    this.time += dtMs;
    const t = this.time;
    for (const { light, base, phase } of this.torches) {
      const n =
        Math.sin(t * 0.011 + phase * 7.3) * 0.55 +
        Math.sin(t * 0.0047 + phase * 3.1) * 0.3 +
        Math.sin(t * 0.023 + phase) * 0.15;
      light.intensity = base * (1 + 0.22 * n);
    }
  }

  /** Remove the current zone and free its GPU resources. Geometries and
   * material clones are zone-owned; textures are shared with the kit
   * template cache, but disposing them is safe — three re-uploads a
   * disposed texture the next time a material samples it. */
  private disposeCurrent(): void {
    const built = this.built;
    if (!built) return;
    this.scene.remove(built.group);
    built.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          (material as MeshStandardMaterial).map?.dispose();
          material.dispose();
        }
        return;
      }
      const light = obj as PointLight;
      if (light.isPointLight) light.dispose();
    });
    this.built = undefined;
    this.torches = [];
  }
}
