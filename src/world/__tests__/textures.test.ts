import { describe, it, expect } from 'vitest';
import { Texture } from 'three';
import { NearestFilter, RepeatWrapping } from 'three';
import { configureTexture, getTexture } from '../textures';

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
});
