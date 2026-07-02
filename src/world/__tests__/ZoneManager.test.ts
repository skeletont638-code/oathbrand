/**
 * ZoneManager teardown (Task 2). The v1 `disposeCurrent` freed `Mesh` +
 * `PointLight` children only; the exterior zones add `Points` (ash-fall) and
 * `InstancedMesh` (forest) children, so teardown must free those too or
 * `renderer.info` grows every zone change. This drives a real load→load
 * transition of an exterior zone and asserts the previous zone's ash and
 * instanced-forest buffers are disposed.
 */
import { describe, it, expect, vi } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Points, Scene } from 'three';
import { EventBus } from '../../engine/events';
import { ZoneManager } from '../ZoneManager';
import type { AssetCache } from '../assets';
import type { ZoneDef } from '../zoneDef';

function fakeAssets(): AssetCache {
  return {
    get(): Group {
      const g = new Group();
      g.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
      g.updateMatrixWorld(true);
      return g;
    },
  };
}

const EXTERIOR: ZoneDef = {
  id: 'gate-fields',
  grid: ['.,t', 'T#.'],
  cell: 2,
  tiles: { ',': 'floor', t: 'floor', T: 'wall' },
  props: [],
  lights: [],
  enemies: [],
  lore: [],
  doors: [],
  ambience: [],
  kind: 'exterior',
  exteriorSky: 'field',
};

function find<T>(group: Group, ctor: new (...a: never[]) => T): T {
  let found: T | undefined;
  group.traverse((o) => {
    if (o instanceof (ctor as never) && !found) found = o as unknown as T;
  });
  if (!found) throw new Error(`no ${ctor.name} child`);
  return found;
}

describe('ZoneManager.disposeCurrent (exterior FX)', () => {
  it('disposes the previous zone Points (ash) and InstancedMesh (forest) on transition', async () => {
    const scene = new Scene();
    const zm = new ZoneManager({
      scene,
      bus: new EventBus(),
      resolve: () => EXTERIOR,
      loadAssets: async () => fakeAssets(),
    });

    const first = await zm.load('gate-fields', false);
    const ash = find(first.group, Points);
    const forest = find(first.group, InstancedMesh);
    const ashSpy = vi.spyOn(ash.geometry, 'dispose');
    const forestSpy = vi.spyOn(forest.geometry, 'dispose');

    await zm.load('gate-fields', false); // load→load = disposes `first`

    expect(ashSpy).toHaveBeenCalled();
    expect(forestSpy).toHaveBeenCalled();
    // The old group left the scene; only the new one remains.
    expect(scene.children.filter((c) => c === first.group)).toHaveLength(0);
  });
});
