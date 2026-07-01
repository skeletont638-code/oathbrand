import { Vector2 } from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';

// Matches PS1Pipeline's default 320x240 render target. If you drive the
// pipeline at the 480x360 setting, update the uniform after compile:
// `material.userData.ps1Shader?.uniforms.uSnapRes.value.set(480, 360)`.
const DEFAULT_SNAP_RES_X = 320;
const DEFAULT_SNAP_RES_Y = 240;

/**
 * Patches a three.js Material's shader (via `onBeforeCompile`) with two of
 * the PS1 pipeline's signature tricks:
 *
 * 1. Vertex snapping — quantizes clip-space vertex positions to a coarse
 *    grid (`uSnapRes`), producing the wobble/jitter of the PS1's lack of
 *    sub-pixel-precision vertex transforms.
 * 2. Affine UVs — recomputes an unperspective-corrected UV in the fragment
 *    shader, producing the classic warped-texture look of the PS1's affine
 *    (non-perspective-correct) texture mapping. Only wired into the base
 *    `map` (diffuse texture) slot, since that's the common case for the
 *    kit-bashed environment art this pipeline targets.
 */
export function patchMaterial(mat: Material): void {
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSnapRes = { value: new Vector2(DEFAULT_SNAP_RES_X, DEFAULT_SNAP_RES_Y) };

    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        [
          'uniform vec2 uSnapRes;',
          'varying vec2 vAffine;',
          'varying float vW;',
          'void main() {',
        ].join('\n'),
      )
      .replace(
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
    // bound for this compile; only rewrite the map UV when it's relevant.
    if (shader.map) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        ['  vMapUv = uv;', '  #include <map_fragment>'].join('\n'),
      );
    }
  };

  // onBeforeCompile's body isn't part of three's program cache key, so two
  // materials with identical parameters but different onBeforeCompile logic
  // could otherwise wrongly share a compiled program.
  mat.customProgramCacheKey = () => 'ps1-patched';
  mat.needsUpdate = true;
}
