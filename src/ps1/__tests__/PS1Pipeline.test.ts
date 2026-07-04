import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import type { WebGLRenderer } from 'three';
import { PS1Pipeline, hdTargetSize } from '../PS1Pipeline';
import { UPSCALE_FRAGMENT_SHADER } from '../upscale.frag';

/**
 * A minimal WebGLRenderer stand-in: PS1Pipeline's constructor + mode switching
 * only ever read sizes and (re)build render targets / uniforms — none of which
 * touch a live GL context (WebGLRenderTarget is a plain descriptor until a real
 * render). So the mode plumbing is unit-testable headless with this stub.
 */
function mockRenderer(w = 1280, h = 960): WebGLRenderer {
  return {
    getSize: (v: Vector2) => v.set(w, h),
    getDrawingBufferSize: (v: Vector2) => v.set(w, h),
    setRenderTarget: () => {},
    render: () => {},
  } as unknown as WebGLRenderer;
}

describe('hdTargetSize — native-res cap math', () => {
  it('passes small buffers through untouched', () => {
    expect(hdTargetSize(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(hdTargetSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it('caps a 4K buffer to 1920×1080 preserving aspect', () => {
    expect(hdTargetSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });

  it('caps an ultrawide by whichever axis binds first, keeping aspect', () => {
    // 3440×1440: width binds (3440 > 1920) → scale 1920/3440 ≈ 0.558.
    const out = hdTargetSize(3440, 1440);
    expect(out.width).toBe(1920);
    expect(out.height).toBe(Math.round(1440 * (1920 / 3440)));
    expect(out.height).toBeLessThanOrEqual(1080);
  });

  it('caps a very tall buffer by height', () => {
    const out = hdTargetSize(1000, 3000); // height binds → scale 1080/3000
    expect(out.height).toBe(1080);
    expect(out.width).toBe(Math.round(1000 * (1080 / 3000)));
  });

  it('never returns a zero dimension for a degenerate buffer', () => {
    expect(hdTargetSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe('PS1Pipeline render mode', () => {
  it('defaults to the PS1 (retro) render mode', () => {
    const p = new PS1Pipeline(mockRenderer());
    expect(p.getRenderMode()).toBe('ps1');
  });

  it('switches to HD and back without throwing, reflecting the mode', () => {
    const p = new PS1Pipeline(mockRenderer(3840, 2160));
    p.setRenderMode('hd');
    expect(p.getRenderMode()).toBe('hd');
    p.setRenderMode('ps1');
    expect(p.getRenderMode()).toBe('ps1');
  });

  it('setRenderScale still tracks the PS1 height even while in HD', () => {
    const p = new PS1Pipeline(mockRenderer());
    p.setRenderMode('hd');
    p.setRenderScale(360);
    expect(p.getRenderScale()).toBe(360); // remembered for the return to PS1
    p.setRenderMode('ps1');
    expect(p.getRenderScale()).toBe(360);
  });
});

describe('upscale shader HD gate', () => {
  it('declares a uHd uniform that gates the quantize/dither/CRT path off', () => {
    expect(UPSCALE_FRAGMENT_SHADER).toContain('uniform float uHd;');
    expect(UPSCALE_FRAGMENT_SHADER).toContain('uHd < 0.5');
  });
});
