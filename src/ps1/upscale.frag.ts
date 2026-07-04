/**
 * Fullscreen upscale pass: takes the low-res PS1 render target and blits it
 * to the screen while applying (in order) desaturation, RGB555 color
 * quantization with 4x4 Bayer ordered-dithering, and optional CRT extras
 * (static scanlines + vignette always; grain + shimmer gated behind
 * `uFlickerSafe` for photosensitivity safety).
 *
 * Hand-written RawShaderMaterial GLSL (no three.js built-in chunks) so the
 * fullscreen triangle doesn't need model/view/projection uniforms at all.
 */

export const UPSCALE_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  // position is already authored in clip space (a fullscreen triangle), so
  // no projection/view/model matrices are needed for this pass.
  gl_Position = vec4(position, 1.0);
}
`;

export const UPSCALE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D uBayer;
uniform vec2 uTargetSize;
uniform float uDesat;
uniform float uCrt;
uniform float uFlickerSafe;
uniform float uTime;
uniform float uAspect;
// HD-Mode prototype: 1 = native-res "realistic" pass (bypass RGB555 quantize +
// Bayer dither + all CRT extras); 0 = the shipped PS1 pass. Desaturation is
// PRESERVED in both (scare/vision code drives it). Default 0 → PS1 path
// executes exactly as before, bit-for-bit.
uniform float uHd;

varying vec2 vUv;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);
// RGB555: 5 bits per channel => 32 representable levels (0..31) per channel.
const float RGB555_LEVELS = 31.0;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// tDiffuse holds LINEAR scene color (three.js only applies the sRGB output
// transform for the null/screen render target — see WebGLRenderer's
// per-draw colorSpace selection). This pass IS the screen target and is a
// RawShaderMaterial (no built-in chunks), so we do that linear->sRGB
// encode by hand before quantizing, matching how PS1 hardware quantized
// already display-referred framebuffer values.
vec3 linearToSRGB(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  vec3 color = linearToSRGB(texel.rgb);

  // Desaturate toward luma so grayscale mode also dithers cleanly
  // (0 = full color, 1 = grayscale). PRESERVED in HD — the scare/vision code
  // drives this and it is not a PS1 artifice.
  float luma = dot(color, LUMA);
  color = mix(color, vec3(luma), uDesat);

  // Everything below is the PS1 artifice: RGB555 quantize + Bayer dither and
  // the optional CRT extras. HD (uHd >= 0.5) bypasses the whole block, leaving
  // the native-res, full-colour, perspective-correct image the scene rendered.
  if (uHd < 0.5) {
    // Ordered (Bayer) dither: uBayer is a 4x4 NearestFilter/RepeatWrapping
    // texture, sampled at native render-target texel granularity so the dither
    // pattern is stable per source pixel regardless of the upscale factor.
    float threshold = texture2D(uBayer, vUv * uTargetSize * 0.25).r;
    color = floor(color * RGB555_LEVELS + threshold) / RGB555_LEVELS;

    if (uCrt > 0.5) {
      // Static scanlines + vignette: no time dependence, always safe.
      float scan = sin(vUv.y * uTargetSize.y * 3.14159265) * 0.04;
      color -= scan;

      vec2 centered = (vUv - 0.5) * vec2(uAspect, 1.0);
      float vignette = smoothstep(0.9, 0.35, length(centered));
      color *= mix(0.7, 1.0, vignette);

      // Grain + shimmer are per-frame time-varying flicker: disabled under
      // flicker-safe mode (photosensitivity accessibility requirement).
      if (uFlickerSafe < 0.5) {
        float grain = (rand(vUv * uTargetSize + uTime) - 0.5) * 0.06;
        color += grain;
        float shimmer = sin(uTime * 18.0 + vUv.y * 40.0) * 0.015;
        color += shimmer;
      }
    }
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
}
`;
