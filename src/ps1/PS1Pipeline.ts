import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  DataTexture,
  LinearFilter,
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
import type { IUniform, MagnificationTextureFilter, Texture } from 'three';
import { bayer4x4 } from './bayer';
import { setRenderMode as setPatchRenderMode, setSnapResolution } from './patchMaterial';
import type { RenderMode } from './patchMaterial';
import { UPSCALE_FRAGMENT_SHADER, UPSCALE_VERTEX_SHADER } from './upscale.frag';

export type { RenderMode };

export interface PS1PipelineOptions {
  /** Render-target height setting: 240 -> 320x240, 360 -> 480x360. Default 240. */
  width?: 240 | 360;
}

const DEFAULT_HEIGHT_SETTING: 240 | 360 = 240;

/** HD-mode render target cap: never exceed 1920×1080 (spec), even on 4K/ultrawide. */
const HD_CAP_W = 1920;
const HD_CAP_H = 1080;

/**
 * Resolve the HD render-target size for a given drawing-buffer size, capped to
 * {@link HD_CAP_W}×{@link HD_CAP_H} with aspect ratio preserved (scale down by
 * whichever axis binds first). Pure + exported so the cap math is unit-tested
 * without a GL context. Never returns a zero dimension.
 */
export function hdTargetSize(
  bufW: number,
  bufH: number,
  capW = HD_CAP_W,
  capH = HD_CAP_H,
): { width: number; height: number } {
  const scale = Math.min(1, capW / bufW, capH / bufH);
  return {
    width: Math.max(1, Math.round(bufW * scale)),
    height: Math.max(1, Math.round(bufH * scale)),
  };
}

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
  uHd: IUniform<number>;
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
  /** Current render-target height setting (240 → 320×240, 360 → 480×360). Only
   * drives the target in PS1 mode; HD renders at native size but this is
   * remembered so returning to PS1 restores the player's chosen scale. */
  private heightSetting: 240 | 360;
  /** PS1 (retro, downscaled) vs HD (native-res A/B lens). Default PS1. */
  private renderMode: RenderMode = 'ps1';

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
      uHd: { value: 0 },
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
   * The render target's spec for the CURRENT mode. PS1 → the fixed low res
   * (320×240 / 480×360), NearestFilter. HD → the native drawing-buffer size
   * capped to 1920×1080, LinearFilter (no pixelation, no snap-crawl).
   */
  private targetSpec(): { width: number; height: number; filter: MagnificationTextureFilter } {
    if (this.renderMode === 'hd') {
      const buf = this.renderer.getDrawingBufferSize(new Vector2());
      const { width, height } = hdTargetSize(buf.x, buf.y);
      return { width, height, filter: LinearFilter };
    }
    const height = this.heightSetting;
    const width = height === 240 ? 320 : 480;
    return { width, height, filter: NearestFilter };
  }

  /**
   * (Re)create the offscreen render target for the current mode, re-point the
   * upscale pass at it, and — in PS1 mode only — re-sync `patchMaterial`'s
   * vertex-snap grid to the target size so the wobble stays keyed to the actual
   * pixels. (HD has no snap grid, so it leaves the last PS1 value untouched.)
   */
  private rebuildTarget(): void {
    const { width, height, filter } = this.targetSpec();
    this.target.dispose();
    this.target = new WebGLRenderTarget(width, height, {
      minFilter: filter,
      magFilter: filter,
      depthBuffer: true,
    });
    this.uniforms.tDiffuse.value = this.target.texture;
    this.uniforms.uTargetSize.value.set(width, height);
    if (this.renderMode === 'ps1') setSnapResolution(width, height);
  }

  /**
   * Switch the internal render resolution live (240 → 320×240, 360 → 480×360).
   * Rebuilds the offscreen render target at the new size, re-points the upscale
   * pass at it, and re-syncs `patchMaterial`'s vertex-snap grid so the PS1
   * wobble stays keyed to the actual pixels. A no-op when already at `height`.
   * In HD mode the target stays native — the new height is remembered and takes
   * effect only when the player returns to PS1.
   */
  setRenderScale(height: 240 | 360): void {
    if (height === this.heightSetting) return;
    this.heightSetting = height;
    if (this.renderMode === 'ps1') this.rebuildTarget();
  }

  /** Current render-target height setting (240 or 360). */
  getRenderScale(): 240 | 360 {
    return this.heightSetting;
  }

  /**
   * Switch between the shipped PS1 pipeline and the HD (native-res) A/B lens.
   * Rebuilds the render target (native+Linear for HD, low-res+Nearest for PS1),
   * flips the upscale pass's `uHd` gate (bypasses quantize/dither/CRT in HD,
   * desat preserved), and — mirroring how the constructor drives
   * `setSnapResolution` — flips `patchMaterial`'s compile-time mode so every
   * live material recompiles without its snap/affine injection (wind kept).
   * A no-op when already in `mode`.
   */
  setRenderMode(mode: RenderMode): void {
    if (mode === this.renderMode) return;
    this.renderMode = mode;
    this.rebuildTarget();
    this.uniforms.uHd.value = mode === 'hd' ? 1 : 0;
    setPatchRenderMode(mode);
  }

  /** Current render mode ('ps1' | 'hd'). */
  getRenderMode(): RenderMode {
    return this.renderMode;
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

  /** Call after the renderer/canvas is resized. In PS1 mode the render target
   * stays a fixed low resolution, so this only refreshes the aspect ratio used
   * by the CRT vignette. In HD mode the target tracks the native drawing
   * buffer, so it is rebuilt to the new size to stay crisp. */
  resize(): void {
    const size = this.renderer.getSize(new Vector2());
    this.uniforms.uAspect.value = size.y === 0 ? 1 : size.x / size.y;
    if (this.renderMode === 'hd') this.rebuildTarget();
  }
}
