/**
 * Per-zone draw-call budgets (World Expansion v1.2, Task 10 — verification sweep).
 * The nine NEW interior/height zones this phase added must each hold the
 * ≤100-draw-call/zone ceiling (spec §11), the same GPU-independent budget the
 * greater-vael Playwright smoke asserts for the exteriors. This is the HEADLESS
 * proof — it builds each zone through the real `ZoneBuilder` (no WebGL, no
 * browser, so it runs in CI even where a headless GL context is unavailable) and
 * counts the renderable children the builder emits (walls, floor, risers, props,
 * torch brackets/flames, banner). It mirrors the interior-kit test's draw-call
 * proxy and the greater-vael smoke's `< 100` assertion.
 *
 * The count here is a builder-side LOWER BOUND: door panels, echo apparitions,
 * enemy rigs and the PS1 blit are added by main.ts at run time (the greater-vael
 * e2e measures the true per-frame `renderer.info.render.calls`). The builder
 * geometry is by far the dominant term, so a comfortable headless margin under
 * 100 is the CI-independent guard the perf sweep rests on.
 */
import { describe, it, expect } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Points, Sprite } from 'three';
import { ZoneBuilder } from '../ZoneBuilder';
import type { AssetCache } from '../assets';
import { ZONES } from '../../content/zones';

/** A stand-in kit cache: every requested piece is a one-mesh Group whose material
 *  NAME is the piece name (so merged buckets surface as `merged:<piece>`).
 *  Mirrors the helper in interiorKit.test.ts / zoneBuilder.test.ts. */
function fakeAssets(): AssetCache {
  const made = new Map<string, Group>();
  return {
    get(name: string): Group {
      let g = made.get(name);
      if (!g) {
        g = new Group();
        const mat = new MeshStandardMaterial();
        mat.name = name;
        g.add(new Mesh(new BoxGeometry(1, 1, 1), mat));
        g.updateMatrixWorld(true);
        made.set(name, g);
      }
      return g;
    },
  };
}

/** Draw-call proxy: every renderable child (Mesh incl. InstancedMesh, Points,
 *  Sprite). PointLights are not draw calls. Mirrors the ≤100/zone invariant. */
function drawCalls(group: Group): number {
  let n = 0;
  group.traverse((o) => {
    if (o instanceof Mesh || o instanceof InstancedMesh || o instanceof Points || o instanceof Sprite) n++;
  });
  return n;
}

/** The nine zones the World Expansion v1.2 content tasks (T4–T8) authored. */
const NEW_ZONES = [
  'hall-gallery',
  'hall-barracks',
  'keep-chapel',
  'tower-ground',
  'tower-upper',
  'chapel-nave',
  'chapel-crypt',
  'manor-ground',
  'manor-upper',
] as const;

describe('per-zone draw-call budget — the nine new World Expansion zones (Task 10)', () => {
  for (const id of NEW_ZONES) {
    it(`${id} builds and holds the ≤100 draw-call budget`, () => {
      const def = ZONES[id];
      expect(def, `zone "${id}" is not registered`).toBeDefined();
      const built = new ZoneBuilder().build(def!, fakeAssets());
      const calls = drawCalls(built.group);
      // A real build (the zone rendered SOMETHING), comfortably under the ceiling.
      expect(calls, `zone "${id}" drew nothing`).toBeGreaterThan(0);
      expect(calls, `zone "${id}" draw calls`).toBeLessThanOrEqual(100);
    });
  }
});
