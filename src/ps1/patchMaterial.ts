import { Vector2 } from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';

// ---------------------------------------------------------------------------
// Snap-resolution registry
//
// `PS1Pipeline`'s render-target size (320x240 or 480x360, via `opts.width`)
// and this module's `uSnapRes` vertex-snap uniform must agree — vertex
// snapping quantizes to a grid, and if that grid doesn't match the actual
// low-res render target, geometry snaps to the wrong resolution. Rather than
// hardcode the same literal in two files, `PS1Pipeline`'s constructor calls
// `setSnapResolution()` with its chosen size, making it the single source of
// truth. See `src/ps1/README.md` for the full writeup.
// ---------------------------------------------------------------------------

let defaultSnapResX = 320;
let defaultSnapResY = 240;

// ---------------------------------------------------------------------------
// Render mode (HD-Mode prototype, 2026-07-04)
//
// `'ps1'` is the shipped default: vertex snap + affine texture warp injected as
// below. `'hd'` is the A/B "realistic" lens — the SAME materials recompile with
// the snap + affine injections skipped (stock perspective-correct UVs), while
// the smooth wind sway is KEPT. The mode is a module-level flag consulted at
// compile time and folded into `customProgramCacheKey`, so three never
// cross-compiles a PS1 program with an HD one. `setRenderMode()` flips it and
// marks every live patched material dirty so it recompiles under the new key —
// exactly the retroactive-fixup pattern `setSnapResolution()` already uses.
// `PS1Pipeline.setRenderMode()` drives this in lockstep with its render target.
// ---------------------------------------------------------------------------
export type RenderMode = 'ps1' | 'hd';
let renderMode: RenderMode = 'ps1';

// Materials patched so far, so `setSnapResolution()` can retroactively fix up
// ones that already compiled. WeakRefs so the registry never keeps a
// disposed material alive.
const patchedMaterials = new Set<WeakRef<Material>>();

/**
 * Switches the compile-time render mode for every patched material. `'hd'` drops
 * the snap + affine injections (keeping wind); `'ps1'` restores the full retro
 * patch. Flags every live patched material for recompile (`needsUpdate`) so the
 * switch takes effect on the next render — the same registry sweep
 * `setSnapResolution()` performs. A no-op when already in `mode`.
 */
export function setRenderMode(mode: RenderMode): void {
  if (mode === renderMode) return;
  renderMode = mode;
  for (const ref of patchedMaterials) {
    const mat = ref.deref();
    if (!mat) {
      patchedMaterials.delete(ref);
      continue;
    }
    // `needsUpdate = true` bumps the material version; three re-evaluates
    // `customProgramCacheKey` and re-runs `onBeforeCompile` on the next render.
    mat.needsUpdate = true;
  }
}

/** The current compile-time render mode (mainly for tests / diagnostics). */
export function getRenderMode(): RenderMode {
  return renderMode;
}

/**
 * Sets the snap resolution used by vertex snapping (`uSnapRes`):
 *
 * 1. Updates the default applied to any material `patchMaterial()`-ed after
 *    this call.
 * 2. Retroactively updates the `uSnapRes` uniform on every material that was
 *    already patched *and* has already compiled at least once (i.e. has a
 *    `userData.ps1Shader` stashed — see `patchMaterial` below). Materials
 *    patched but not yet compiled will simply pick up the new default the
 *    first time they compile.
 *
 * `PS1Pipeline`'s constructor calls this with its own render-target size, so
 * as long as patched materials share a `PS1Pipeline` instance (the normal
 * case), `uSnapRes` can never silently drift out of sync with the target
 * resolution actually being rendered.
 */
export function setSnapResolution(width: number, height: number): void {
  defaultSnapResX = width;
  defaultSnapResY = height;

  for (const ref of patchedMaterials) {
    const mat = ref.deref();
    if (!mat) {
      // Material was garbage-collected; stop tracking it.
      patchedMaterials.delete(ref);
      continue;
    }
    const shader = mat.userData.ps1Shader as WebGLProgramParametersWithUniforms | undefined;
    const uSnapRes = shader?.uniforms.uSnapRes as { value: Vector2 } | undefined;
    uSnapRes?.value.set(width, height);
  }
}

/**
 * A SMOOTH per-vertex wind sway (Task 10, spec §6). Injected into the vertex
 * shader at `#include <begin_vertex>` (before projection, so vertex-snap +
 * affine still operate on the swayed clip position). The sway weights by
 * object-space height so trunk bases stay planted; a per-instance `aWindPhase`
 * attribute desyncs neighbours; `uWindTime` advances continuously (full frame
 * rate — the world micro-motion is NEVER stepped, unlike the ~12 fps entities).
 */
export interface WindOpts {
  ampM: number; // sway amplitude at the crown, metres (a few cm)
  freqHz: number; // sway frequency
  heightRefM: number; // object-space height that reaches full sway weight
}

/**
 * Patches a three.js Material's shader (via `onBeforeCompile`) with two of
 * the PS1 pipeline's signature tricks:
 *
 * 1. Vertex snapping — quantizes clip-space vertex positions to a coarse
 *    grid (`uSnapRes`), producing the wobble/jitter of the PS1's lack of
 *    sub-pixel-precision vertex transforms. `uSnapRes` defaults to whatever
 *    `setSnapResolution()` was last called with (see above); `PS1Pipeline`
 *    keeps this in sync with its own render-target size.
 * 2. Affine UVs — recomputes an unperspective-corrected UV in the fragment
 *    shader, producing the classic warped-texture look of the PS1's affine
 *    (non-perspective-correct) texture mapping. Only wired into the base
 *    `map` (diffuse texture) slot, since that's the common case for the
 *    kit-bashed environment art this pipeline targets.
 *
 * `opts.wind` (Task 10) additionally injects the smooth vertex sway above.
 * Backward-compatible: every existing `patchMaterial(mat)` call is unaffected
 * (no wind, and the SAME `'ps1-patched'` program cache key as before).
 */
export function patchMaterial(mat: Material, opts: { wind?: WindOpts } = {}): void {
  patchedMaterials.add(new WeakRef(mat));
  const wind = opts.wind;

  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    // HD drops the two PS1 artifice injections (snap + affine) at compile time
    // but keeps everything else — wind, lighting, fog. In `'ps1'` the code path
    // below is BYTE-FOR-BYTE the pre-HD patch (shipped product); nothing in that
    // branch changed. See `setRenderMode`.
    const hd = renderMode === 'hd';

    if (!hd) shader.uniforms.uSnapRes = { value: new Vector2(defaultSnapResX, defaultSnapResY) };
    if (wind) {
      shader.uniforms.uWindTime = { value: 0 };
      shader.uniforms.uWindAmp = { value: wind.ampM };
      shader.uniforms.uWindFreq = { value: wind.freqHz };
      shader.uniforms.uWindHeight = { value: wind.heightRefM };
    }

    const vHead: string[] = [];
    if (!hd) vHead.push('uniform vec2 uSnapRes;', 'varying vec2 vAffine;', 'varying float vW;');
    if (wind) vHead.push(
      'uniform float uWindTime;', 'uniform float uWindAmp;', 'uniform float uWindFreq;',
      'uniform float uWindHeight;', 'attribute float aWindPhase;',
    );
    vHead.push('void main() {');
    shader.vertexShader = shader.vertexShader.replace('void main() {', vHead.join('\n'));

    if (wind) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '  float wW = clamp(transformed.y / uWindHeight, 0.0, 1.0);',
          '  wW *= wW;', // ease: base planted, crown sways most
          '  transformed.x += sin(uWindTime * uWindFreq + aWindPhase) * uWindAmp * wW;',
          '  transformed.z += cos(uWindTime * uWindFreq * 0.73 + aWindPhase) * uWindAmp * wW * 0.6;',
        ].join('\n'),
      );
    }

    // The snap + affine injections are the PS1 artifice; HD skips both so the
    // vertex transform stays plain perspective-correct and the base map is
    // sampled through three's stock `map_fragment` (no affine warp).
    if (!hd) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        [
          '#include <project_vertex>',
          // Vertex snap: quantize clip-space xy to a coarse pixel grid.
          '  gl_Position.xy /= gl_Position.w;',
          '  gl_Position.xy = floor(gl_Position.xy * uSnapRes) / uSnapRes;',
          '  gl_Position.xy *= gl_Position.w;',
          // Affine UV setup: carry uv*w and w separately so the fragment
          // shader can undo perspective-correct interpolation.
          '  vAffine = uv * gl_Position.w;',
          '  vW = gl_Position.w;',
        ].join('\n'),
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        [
          'varying vec2 vAffine;',
          'varying float vW;',
          'void main() {',
          '  vec2 uv = vAffine / vW;',
        ].join('\n'),
      );

      // `shader.map` reflects whether this material has a diffuse texture
      // bound for this compile; only rewrite the map sampling when relevant.
      //
      // NOTE: `vMapUv` (declared by three's `uv_pars_fragment` chunk) is a
      // varying, and varyings are read-only in fragment shaders — assigning to
      // it (`vMapUv = uv;`) is a hard GLSL compile error ("'assign' : l-value
      // required"), not merely bad style. Instead, we replace the whole
      // `#include <map_fragment>` chunk with a copy of three's own
      // `map_fragment.glsl.js` (r183) that samples `map` with our local
      // affine-corrected `uv` instead of `vMapUv`. Everything else (the
      // `DECODE_VIDEO_TEXTURE` handling, multiplying into `diffuseColor`) is
      // reproduced verbatim so behavior otherwise matches stock three.
      if (shader.map) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          [
            '#ifdef USE_MAP',
            '  vec4 sampledDiffuseColor = texture2D( map, uv );',
            '  #ifdef DECODE_VIDEO_TEXTURE',
            '    sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );',
            '  #endif',
            '  diffuseColor *= sampledDiffuseColor;',
            '#endif',
          ].join('\n'),
        );
      }
    }

    // Standard three.js onBeforeCompile idiom: stash the compiled shader so
    // callers can reach the uniforms afterwards (e.g. `setSnapResolution`
    // above, which uses this to retroactively fix up already-compiled
    // materials; ZoneBuilder's wind clock reads `uWindTime` through it).
    mat.userData.ps1Shader = shader;
  };

  // onBeforeCompile's body isn't part of three's program cache key, so two
  // materials with identical parameters but different onBeforeCompile logic
  // could otherwise wrongly share a compiled program. Wind injects a DIFFERENT
  // vertex shader, and HD skips the snap/affine injections entirely — so the
  // key spans BOTH axes (`{ps1,hd}` × `{static,wind}`), giving four distinct
  // programs that never cross-compile. Read live so a `setRenderMode` switch
  // recompiles each material under its new mode's key.
  mat.customProgramCacheKey = () => {
    const base = renderMode === 'hd' ? 'hd-patched' : 'ps1-patched';
    return wind ? `${base}-wind` : base;
  };
  mat.needsUpdate = true;
}
