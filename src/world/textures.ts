/**
 * Realism pass (Task 5): standalone CC0 photo textures, crunched to 128px by
 * scripts/downsample-textures.py and sampled NearestFilter/no-mipmaps/RepeatWrapping
 * through patchMaterial's affine warp. Preloaded once at boot; getTexture is a
 * SYNC accessor (undefined until preloaded, so ZoneBuilder/entities fall back to
 * flat colour under vitest — no WebGL, no download in tests).
 */
import { NearestFilter, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';

export type TexName = 'ground-dirt' | 'bark' | 'rock' | 'hound-hide' | 'kneeler-cloth';

const FILES: Record<TexName, string> = {
  'ground-dirt': 'ground-dirt', bark: 'bark', rock: 'rock',
  'hound-hide': 'hound-hide', 'kneeler-cloth': 'kneeler-cloth',
};

// Vite emits each PNG as a hashed URL (outside the JS bundle — no gzip impact).
const TEX_URLS = import.meta.glob<string>('/assets/tex/*.png', { query: '?url', import: 'default' });

const cache = new Map<TexName, Texture>();
let loader: TextureLoader | undefined;

/** The crunchy PS1 sampler config: nearest, no mipmaps, repeat, sRGB. Pure. */
export function configureTexture(tex: Texture): Texture {
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Load + configure every tex PNG. Missing files → flat fallback (never throws). */
export async function preloadTextures(): Promise<void> {
  loader ??= new TextureLoader();
  await Promise.all(
    (Object.keys(FILES) as TexName[]).map(async (name) => {
      const resolve = TEX_URLS[`/assets/tex/${FILES[name]}.png`];
      if (!resolve) return;
      const tex = await loader!.loadAsync(await resolve());
      cache.set(name, configureTexture(tex));
    }),
  );
}

/** Sync accessor. Undefined until preloadTextures resolves (tests → flat). */
export function getTexture(name: TexName): Texture | undefined {
  return cache.get(name);
}
