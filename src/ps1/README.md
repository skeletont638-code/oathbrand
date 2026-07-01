# PS1 Pipeline

A small, dependency-free Three.js post-processing pipeline that recreates the
look of mid-90s 3D hardware: low native resolution, wobbly vertices, warped
textures, and a dithered, quantized color palette. It's used throughout
OATHBRAND and is written to be lifted into any other Three.js project as-is
— no external packages, not even `pmndrs/postprocessing`.

It renders your scene into a small offscreen `WebGLRenderTarget` (320×240 by
default, or 480×360) with `NearestFilter` and no mipmaps — the resolution
class the original hardware pushed to a CRT — then a hand-written
fullscreen-triangle shader pass upscales that target to your full canvas,
applying color quantization, ordered dithering, optional desaturation, and
optional CRT scanlines/vignette/grain.

## The three tricks

### 1. Vertex snapping

PS1-era GPUs transformed vertices without sub-pixel precision, giving
geometry a characteristic wobble as it moves. `patchMaterial()` reproduces
this by rounding clip-space coordinates to a coarse grid inside
`onBeforeCompile`:

```glsl
// injected right after #include <project_vertex>
gl_Position.xy /= gl_Position.w;
gl_Position.xy = floor(gl_Position.xy * uSnapRes) / uSnapRes;
gl_Position.xy *= gl_Position.w;
```

### 2. Affine texture mapping

The PS1 also didn't correct UVs for perspective, so textures on large,
steeply-angled surfaces visibly warp. We carry `uv * w` and `w` as separate
varyings and only divide them back apart in the fragment shader — the
opposite of the GPU's normal perspective-correct interpolation:

```glsl
// vertex shader
vAffine = uv * gl_Position.w;
vW = gl_Position.w;

// fragment shader
vec2 uv = vAffine / vW;
```

### 3. Dither + color quantize

The upscale pass quantizes color to RGB555 (5 bits/channel, 32 levels) and
dithers against a classic 4×4 Bayer matrix so gradients don't band as hard.
Both are pure, unit-tested functions with no GPU dependency:

```ts
// src/ps1/bayer.ts
export function quantizeRGB555(r: number): number {
  return Math.round(r * 31) / 31;
}
```

The shader samples a tiny baked `DataTexture` of `bayer4x4()`'s 16
thresholds (tiled via `RepeatWrapping`) and does
`floor(color * 31 + threshold) / 31` per channel before writing the pixel.

### Keeping `uSnapRes` in sync with the render target

`uSnapRes` (the grid vertex snapping quantizes to) has to match the
pipeline's actual render-target resolution, or geometry snaps to the wrong
grid than what's actually being rendered. Rather than hardcode the same
literal in both `PS1Pipeline.ts` and `patchMaterial.ts`, `patchMaterial.ts`
keeps a small module-level registry: `PS1Pipeline`'s constructor calls
`setSnapResolution(width, height)` with its own target size, which updates
the default used by every `patchMaterial()` call from then on *and*
retroactively fixes the `uSnapRes` uniform on any material already patched
(and already compiled). In practice this means: construct your
`PS1Pipeline` before (or after — order doesn't matter) calling
`patchMaterial()` on your materials, and they'll always agree with whatever
resolution the pipeline was built with, even at the non-default 480×360
setting.

## Usage

```ts
import { PS1Pipeline } from './ps1/PS1Pipeline';
import { patchMaterial } from './ps1/patchMaterial';

const pipeline = new PS1Pipeline(renderer); // or { width: 360 } for 480x360
patchMaterial(someMesh.material); // opt in to vertex-snap + affine UV; uSnapRes tracks `pipeline`'s resolution automatically

function animate() {
  requestAnimationFrame(animate);
  pipeline.render(scene, camera); // replaces renderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  pipeline.resize();
});

pipeline.setDesaturation(0.5); // 0 = full color, 1 = grayscale
pipeline.setCrtEnabled(true);  // scanlines + vignette + grain
pipeline.setFlickerSafe(true); // disables grain/shimmer (photosensitivity)
```

`setFlickerSafe(true)` wins over `setCrtEnabled(true)`: static scanlines and
vignette stay, but the two time-varying effects (grain, shimmer) are
hard-disabled, since those are the ones that can trigger photosensitive
reactions.

## License

MIT — see the repo root `LICENSE`. Use it, fork it, rip it out for your own
game.
