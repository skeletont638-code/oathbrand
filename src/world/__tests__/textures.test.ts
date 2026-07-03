import { describe, it, expect } from 'vitest';
import { Texture } from 'three';
import { NearestFilter, RepeatWrapping } from 'three';
import { configureTexture, getTexture, preloadTextures } from '../textures';

describe('textures', () => {
  it('configureTexture applies the crunchy PS1 sampler settings', () => {
    const t = configureTexture(new Texture());
    expect(t.magFilter).toBe(NearestFilter);
    expect(t.minFilter).toBe(NearestFilter);
    expect(t.generateMipmaps).toBe(false);
    expect(t.wrapS).toBe(RepeatWrapping);
    expect(t.wrapT).toBe(RepeatWrapping);
  });
  it('getTexture returns undefined before preload (flat fallback in tests)', () => {
    expect(getTexture('ground-dirt')).toBeUndefined();
  });
  it('preloadTextures never rejects — load failures keep the flat fallback', async () => {
    // Headless node has no `document`, so every TextureLoader load FAILS —
    // the contract is that preloadTextures resolves anyway (a flaky/404 fetch
    // must never turn boot into the failure screen) and the unloaded textures
    // simply stay unregistered → getTexture undefined → flat colour.
    await expect(preloadTextures()).resolves.toBeUndefined();
    expect(getTexture('ground-dirt')).toBeUndefined();
    expect(getTexture('kneeler-cloth')).toBeUndefined();
  });
});
