import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Texture, MeshStandardMaterial, Mesh } from 'three';
import { HOUND_TINT, KNEELER_TINT, WATCHER_TINT, HAG_TINT } from '../palette';
import { EventBus } from '../../engine/events';
import { AshHound, HoundView } from '../AshHound';
import { KneelingHollow, KneelerView } from '../KneelingHollow';
import type { EntityView } from '../animator';

// The entity skins (Task 8) read `getTexture(...)` for their hide/cloth map.
// Mock it so the view code can be exercised with AND without a texture present
// (headless three has no WebGL/loader, so the real accessor is always undefined
// in tests — the mock lets us prove BOTH the map-bind path and the flat fallback).
const getTextureMock = vi.hoisted(() => vi.fn());
vi.mock('../../world/textures', () => ({
  getTexture: getTextureMock,
  configureTexture: (t: unknown) => t,
  preloadTextures: async () => {},
}));

describe('entity tint invariants (spec §3)', () => {
  it('the Watcher and the Hag stay PURE BLACK', () => {
    expect(WATCHER_TINT).toBe(0x000000);
    expect(HAG_TINT).toBe(0x000000);
  });
  it('the Hound and Kneeler stay dark-but-formed (not black, low luma)', () => {
    for (const c of [HOUND_TINT, KNEELER_TINT]) {
      const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      expect(luma).toBeGreaterThan(8);   // not void
      expect(luma).toBeLessThan(60);     // still dark
    }
  });
});

describe('entity skins (Task 8) — the photo-crunch map MULTIPLIES the tint', () => {
  beforeEach(() => getTextureMock.mockReset());

  it('the entity skins keep their tint as the multiply base (Hound/Kneeler unchanged)', () => {
    expect(HOUND_TINT).toBe(0x2a2521);
    expect(KNEELER_TINT).toBe(0x232026);
  });

  /** First material in a view's scene graph (hound → torso, kneeler → pelvis). */
  function firstMat(view: EntityView): MeshStandardMaterial {
    let mat: MeshStandardMaterial | undefined;
    view.root.traverse((o) => {
      const m = o as Mesh;
      if (!mat && m.isMesh) mat = m.material as MeshStandardMaterial;
    });
    if (!mat) throw new Error('no mesh material in view');
    return mat;
  }

  function houndView(): { view: HoundView; mat: MeshStandardMaterial } {
    const hound = new AshHound({ id: 'h', bus: new EventBus(), rng: () => 0.5, pantCue: () => {} });
    const view = new HoundView(hound);
    return { view, mat: firstMat(view) };
  }

  function kneelerView(): { view: KneelerView; mat: MeshStandardMaterial } {
    const k = new KneelingHollow({ id: 'k', bus: new EventBus(), pulse: () => 0, creakCue: () => {} });
    const view = new KneelerView(k);
    return { view, mat: firstMat(view) };
  }

  it('HoundView paints HOUND_TINT and binds the hide map when getTexture provides one', () => {
    getTextureMock.mockReturnValue(new Texture()); // a hide texture is loaded
    const { view, mat } = houndView();
    expect(mat.color.getHex()).toBe(HOUND_TINT); // the tint is the multiply base
    expect(mat.map).not.toBeNull();              // the hide map is bound
    expect(mat.map!.isTexture).toBe(true);
    view.dispose();
  });

  it('KneelerView paints KNEELER_TINT and binds the cloth map when getTexture provides one', () => {
    getTextureMock.mockReturnValue(new Texture()); // a cloth texture is loaded
    const { view, mat } = kneelerView();
    expect(mat.color.getHex()).toBe(KNEELER_TINT);
    expect(mat.map).not.toBeNull();
    expect(mat.map!.isTexture).toBe(true);
    view.dispose();
  });

  it('no map when the texture is absent (headless), tint preserved — flat fallback, never throws', () => {
    getTextureMock.mockReturnValue(undefined); // the real headless case: nothing loaded
    const h = houndView();
    expect(h.mat.color.getHex()).toBe(HOUND_TINT);
    expect(h.mat.map).toBeNull(); // no double-nothing crash; the flat tint stands in
    h.view.dispose();
    const k = kneelerView();
    expect(k.mat.color.getHex()).toBe(KNEELER_TINT);
    expect(k.mat.map).toBeNull();
    k.view.dispose();
  });
});
