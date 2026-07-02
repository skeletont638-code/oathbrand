import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  DataTexture,
  Mesh,
  NearestFilter,
  RawShaderMaterial,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  UnsignedByteType,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { IUniform, Texture } from 'three';
import { bayer4x4 } from './bayer';
import { setSnapResolution } from './patchMaterial';
import { UPSCALE_FRAGMENT_SHADER, UPSCALE_VERTEX_SHADER } from './upscale.frag';

export interface PS1PipelineOptions {
  /** Render-target height setting: 240 -> 320x240, 360 -> 480x360. Default 240. */
  width?: 240 | 360;
}

const DEFAULT_HEIGHT_SETTING: 240 | 360 = 240;

/** Builds a single oversized triangle covering the full NDC square: one draw
 * call, no diagonal seam — the standard fullscreen-pass trick. */
function createFullscreenTriangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  const positions = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
  const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  return geometry;
}

/** Bakes bayer4x4()'s 16 thresholds into a tiny tileable NearestFilter texture. */
function createBayerTexture(): DataTexture {
  const thresholds = bayer4x4();
  const data = new Uint8Array(16 * 4);
  for (let i = 0; i < 16; i += 1) {
    const v = Math.round(thresholds[i] * 255);
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const texture = new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

interface UpscaleUniforms {
  // Index signature so this satisfies three's `{ [uniform: string]: IUniform }`
  // uniforms record type without needing an `any` cast at the call site.
  [uniform: string]: IUniform;
  tDiffuse: IUniform<Texture>;
  uBayer: IUniform<DataTexture>;
  uTargetSize: IUniform<Vector2>;
  uDesat: IUniform<number>;
  uCrt: IUniform<number>;
  uFlickerSafe: IUniform<number>;
  uTime: IUniform<number>;
  uAspect: IUniform<number>;
}

/**
 * Renders a scene at a fixed low PS1-era resolution (NearestFilter, no
 * mipmaps) into an offscreen render target, then blits it to the full
 * canvas through a hand-written fullscreen-triangle upscale pass that
 * applies RGB555 quantization + Bayer dithering, optional desaturation, and
 * optional CRT extras. See `src/ps1/README.md` for the full writeup.
 */
export class PS1Pipeline {
  private readonly renderer: WebGLRenderer;
  private target: WebGLRenderTarget;
  private readonly quadScene: Scene;
  private readonly quadCamera: Camera;
  private readonly uniforms: UpscaleUniforms;
  private time = 0;
  /** Current render-target height setting (240 → 320×240, 360 → 480×360). */
  private heightSetting: 240 | 360;

  constructor(renderer: WebGLRenderer, opts: PS1PipelineOptions = {}) {
    this.renderer = renderer;

    const targetHeight = opts.width ?? DEFAULT_HEIGHT_SETTING;
    const targetWidth = targetHeight === 240 ? 320 : 480;
    this.heightSetting = targetHeight;

    this.target = new WebGLRenderTarget(targetWidth, targetHeight, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
    });

    // Single source of truth for `patchMaterial()`'s vertex-snap grid: keeps
    // `uSnapRes` in sync with this pipeline's actual render-target size,
    // both for materials patched after this point and (retroactively) for
    // any patched earlier. See `src/ps1/patchMaterial.ts` and
    // `src/ps1/README.md`.
    setSnapResolution(targetWidth, targetHeight);

    this.uniforms = {
      tDiffuse: { value: this.target.texture },
      uBayer: { value: createBayerTexture() },
      uTargetSize: { value: new Vector2(targetWidth, targetHeight) },
      uDesat: { value: 0 },
      uCrt: { value: 0 },
      uFlickerSafe: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
    };

    const quadMaterial = new RawShaderMaterial({
      vertexShader: UPSCALE_VERTEX_SHADER,
      fragmentShader: UPSCALE_FRAGMENT_SHADER,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.quadScene = new Scene();
    this.quadScene.add(new Mesh(createFullscreenTriangle(), quadMaterial));
    // A bare Camera: our vertex shader outputs clip-space positions directly
    // and never reads view/projection matrices, so no camera setup is needed
    // beyond satisfying WebGLRenderer.render()'s signature.
    this.quadCamera = new Camera();

    this.resize();
  }

  /** Renders `scene`/`cam` at the pipeline's fixed low resolution, then
   * upscales the result to the renderer's full canvas. */
  render(scene: Scene, cam: Camera): void {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, cam);
    this.renderer.setRenderTarget(null);

    // Only ever consumed by the optional grain/shimmer CRT extras below
    // flicker-safe gating; never drives gameplay timing.
    this.time += 1 / 60;
    this.uniforms.uTime.value = this.time;

    this.renderer.render(this.quadScene, this.quadCamera);
  }

  /**
   * Switch the internal render resolution live (240 → 320×240, 360 → 480×360).
   * Rebuilds the offscreen render target at the new size, re-points the upscale
   * pass at it, and re-syncs `patchMaterial`'s vertex-snap grid so the PS1
   * wobble stays keyed to the actual pixels. A no-op when already at `height`.
   */
  setRenderScale(height: 240 | 360): void {
    if (height === this.heightSetting) return;
    this.heightSetting = height;
    const width = height === 240 ? 320 : 480;
    this.target.dispose();
    this.target = new WebGLRenderTarget(width, height, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
    });
    this.uniforms.tDiffuse.value = this.target.texture;
    this.uniforms.uTargetSize.value.set(width, height);
    setSnapResolution(width, height);
  }

  /** Current render-target height setting (240 or 360). */
  getRenderScale(): 240 | 360 {
    return this.heightSetting;
  }

  /** 0 = full color, 1 = grayscale. Applied in the upscale pass only — never
   * touches scene materials. */
  setDesaturation(v: number): void {
    this.uniforms.uDesat.value = Math.min(1, Math.max(0, v));
  }

  /** Current desaturation (so an ending can ease colour back from here). */
  getDesaturation(): number {
    return this.uniforms.uDesat.value;
  }

  /** Toggles the optional scanline/vignette/grain CRT extras. */
  setCrtEnabled(b: boolean): void {
    this.uniforms.uCrt.value = b ? 1 : 0;
  }

  /** When true, disables the CRT pass's grain and shimmer (the two
   * time-varying, per-frame-random effects) — a photosensitivity
   * accessibility requirement. Static scanlines/vignette are unaffected. */
  setFlickerSafe(b: boolean): void {
    this.uniforms.uFlickerSafe.value = b ? 1 : 0;
  }

  /** Call after the renderer/canvas is resized. The render target itself
   * stays a fixed low resolution; this only refreshes the aspect ratio used
   * by the CRT vignette so it stays correctly proportioned. */
  resize(): void {
    const size = this.renderer.getSize(new Vector2());
    this.uniforms.uAspect.value = size.y === 0 ? 1 : size.x / size.y;
  }
}
