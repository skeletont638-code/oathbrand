/**
 * Kit-piece loading for ZoneBuilder. Loads `assets/kit/*.glb` through three's
 * GLTFLoader and caches the parsed template scenes for the lifetime of the
 * app — templates are cheap (~tens of KB each) and sharing them across zone
 * transitions means a zone reload never re-downloads or re-parses a GLB.
 *
 * ZoneBuilder never mutates templates: it clones geometry (baking transforms
 * in) and clones materials per zone, so the cached scenes stay pristine.
 */
import type { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Loaded kit templates, by canonical piece name ('wall', 'torch', …). */
export interface AssetCache {
  /** Template scene for a piece. Throws if the piece was never loaded. */
  get(name: string): Group;
}

// Vite emits each GLB as a lazily-importable URL: works in dev (served from
// the project root under BASE_URL) and in production builds (hashed asset
// copies), without pulling any binary into the JS bundle.
const KIT_URLS = import.meta.glob<string>('/assets/kit/*.glb', {
  query: '?url',
  import: 'default',
});

const templates = new Map<string, Group>();
let loader: GLTFLoader | undefined;

/**
 * Ensure every named piece is loaded, then return the shared cache.
 * Unknown names (no matching `assets/kit/<name>.glb`) throw immediately.
 */
export async function loadKitPieces(names: Iterable<string>): Promise<AssetCache> {
  const wanted = [...new Set(names)].filter((n) => !templates.has(n));
  await Promise.all(
    wanted.map(async (name) => {
      const key = `/assets/kit/${name}.glb`;
      const resolveUrl = KIT_URLS[key];
      if (!resolveUrl) throw new Error(`Unknown kit piece "${name}" (no ${key})`);
      loader ??= new GLTFLoader();
      const gltf = await loader.loadAsync(await resolveUrl());
      // Bake world matrices once so ZoneBuilder can read child transforms.
      gltf.scene.updateMatrixWorld(true);
      templates.set(name, gltf.scene);
    }),
  );
  return {
    get(name: string): Group {
      const t = templates.get(name);
      if (!t) throw new Error(`Kit piece "${name}" is not loaded`);
      return t;
    },
  };
}
