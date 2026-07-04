import { afterEach, describe, expect, it } from 'vitest';
import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';
import { patchMaterial, setRenderMode, setSnapResolution } from '../patchMaterial';
import { WIND } from '../../world/exteriorForest';

/**
 * `onBeforeCompile` is just a plain function three's renderer calls during
 * shader compilation; we can invoke it directly with a minimal stand-in for
 * `WebGLProgramParametersWithUniforms` without needing a real WebGL context
 * (no rendering happens in these tests, only shader-string/uniform wiring).
 */
function fakeCompile(mat: Material): WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: {},
    vertexShader: 'void main() {\n  gl_Position = vec4(0.0);\n}',
    fragmentShader: 'void main() {\n  gl_FragColor = vec4(0.0);\n}',
    map: false,
  } as unknown as WebGLProgramParametersWithUniforms;
  mat.onBeforeCompile?.(shader, null as never);
  return shader;
}

/** A stub carrying the stock three chunks patchMaterial injects at (`begin_vertex`,
 * `project_vertex`, `map_fragment`) so the FULL injected bodies are observable. */
function fakeCompileFull(mat: Material, map = false): WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: {},
    vertexShader: 'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}',
    fragmentShader: 'void main() {\n#include <map_fragment>\n}',
    map,
  } as unknown as WebGLProgramParametersWithUniforms;
  mat.onBeforeCompile?.(shader, null as never);
  return shader;
}

describe('patchMaterial snap-resolution registry', () => {
  afterEach(() => {
    // Tests share module state (the registry + default are module-level);
    // reset to the documented default so test order can't leak between it()s.
    setSnapResolution(320, 240);
  });

  it('defaults uSnapRes to 320x240 for newly patched materials', () => {
    const mat = new MeshBasicMaterial();
    patchMaterial(mat);
    const shader = fakeCompile(mat);
    expect(shader.uniforms.uSnapRes.value.x).toBe(320);
    expect(shader.uniforms.uSnapRes.value.y).toBe(240);
  });

  it('setSnapResolution updates uSnapRes on already-compiled patched materials', () => {
    const matA = new MeshBasicMaterial();
    const matB = new MeshBasicMaterial();
    patchMaterial(matA);
    patchMaterial(matB);

    fakeCompile(matA);
    fakeCompile(matB);

    setSnapResolution(480, 360);

    const shaderA = matA.userData.ps1Shader as WebGLProgramParametersWithUniforms;
    const shaderB = matB.userData.ps1Shader as WebGLProgramParametersWithUniforms;
    expect(shaderA.uniforms.uSnapRes.value.x).toBe(480);
    expect(shaderA.uniforms.uSnapRes.value.y).toBe(360);
    expect(shaderB.uniforms.uSnapRes.value.x).toBe(480);
    expect(shaderB.uniforms.uSnapRes.value.y).toBe(360);
  });

  it('new patches after setSnapResolution pick up the new default', () => {
    setSnapResolution(480, 360);

    const mat = new MeshBasicMaterial();
    patchMaterial(mat);
    const shader = fakeCompile(mat);

    expect(shader.uniforms.uSnapRes.value.x).toBe(480);
    expect(shader.uniforms.uSnapRes.value.y).toBe(360);
  });

  it('a material patched before setSnapResolution but compiled after also gets the new default', () => {
    const mat = new MeshBasicMaterial();
    patchMaterial(mat);

    setSnapResolution(480, 360);

    const shader = fakeCompile(mat);
    expect(shader.uniforms.uSnapRes.value.x).toBe(480);
    expect(shader.uniforms.uSnapRes.value.y).toBe(360);
  });
});

describe('patchMaterial wind', () => {
  it('wind amplitude stays a few cm (smooth micro-motion, spec §6)', () => {
    expect(WIND.ampM).toBeLessThanOrEqual(0.12);
    expect(WIND.ampM).toBeGreaterThan(0);
  });
  it('a wind material gets a distinct program cache key (no cross-compile with static)', () => {
    const a = new MeshStandardMaterial(); patchMaterial(a, { wind: WIND });
    const b = new MeshStandardMaterial(); patchMaterial(b);
    expect(a.customProgramCacheKey!()).toBe('ps1-patched-wind');
    expect(b.customProgramCacheKey!()).toBe('ps1-patched');
  });
});

describe('patchMaterial HD render mode', () => {
  afterEach(() => {
    // Mode + snap-res are module-level; reset both so order can't leak.
    setRenderMode('ps1');
    setSnapResolution(320, 240);
  });

  it('each of the four mode/wind variants gets a distinct program cache key', () => {
    setRenderMode('ps1');
    const p = new MeshStandardMaterial(); patchMaterial(p);
    const pw = new MeshStandardMaterial(); patchMaterial(pw, { wind: WIND });
    expect(p.customProgramCacheKey!()).toBe('ps1-patched');
    expect(pw.customProgramCacheKey!()).toBe('ps1-patched-wind');

    setRenderMode('hd');
    const h = new MeshStandardMaterial(); patchMaterial(h);
    const hw = new MeshStandardMaterial(); patchMaterial(hw, { wind: WIND });
    expect(h.customProgramCacheKey!()).toBe('hd-patched');
    expect(hw.customProgramCacheKey!()).toBe('hd-patched-wind');
  });

  it('the cache key is read live so a switch never cross-compiles across modes', () => {
    setRenderMode('ps1');
    const m = new MeshStandardMaterial(); patchMaterial(m);
    expect(m.customProgramCacheKey!()).toBe('ps1-patched');
    setRenderMode('hd');
    // Same material now reports the HD key → three recompiles a fresh program.
    expect(m.customProgramCacheKey!()).toBe('hd-patched');
  });

  it('PS1 mode injects vertex snap + affine; HD injects neither', () => {
    setRenderMode('ps1');
    const ps1 = new MeshStandardMaterial(); patchMaterial(ps1);
    const ps1Shader = fakeCompileFull(ps1, true);
    expect(ps1Shader.vertexShader).toContain('floor(gl_Position.xy * uSnapRes) / uSnapRes');
    expect(ps1Shader.vertexShader).toContain('vAffine = uv * gl_Position.w;');
    expect(ps1Shader.fragmentShader).toContain('vec2 uv = vAffine / vW;');
    expect(ps1Shader.fragmentShader).toContain('texture2D( map, uv )'); // affine map sampling

    setRenderMode('hd');
    const hd = new MeshStandardMaterial(); patchMaterial(hd);
    const hdShader = fakeCompileFull(hd, true);
    expect(hdShader.vertexShader).not.toContain('uSnapRes');
    expect(hdShader.vertexShader).not.toContain('vAffine');
    expect(hdShader.vertexShader).not.toContain('floor(gl_Position.xy');
    expect(hdShader.fragmentShader).not.toContain('vAffine');
    expect(hdShader.fragmentShader).not.toContain('vec2 uv = vAffine / vW;');
    // HD leaves three's stock map_fragment untouched (perspective-correct).
    expect(hdShader.fragmentShader).toContain('#include <map_fragment>');
  });

  it('HD keeps the wind injection but not the snap/affine', () => {
    setRenderMode('hd');
    const m = new MeshStandardMaterial(); patchMaterial(m, { wind: WIND });
    // The wind body is injected at `#include <begin_vertex>` (+ snap/affine at
    // `#include <project_vertex>`), so the stub carries both stock chunks.
    const shader = {
      uniforms: {},
      vertexShader:
        'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}',
      fragmentShader: 'void main() {\n#include <map_fragment>\n}',
      map: false,
    } as unknown as WebGLProgramParametersWithUniforms;
    m.onBeforeCompile?.(shader, null as never);
    expect(shader.vertexShader).toContain('uniform float uWindTime;');
    expect(shader.vertexShader).toContain('transformed.x += sin(uWindTime');
    // …but none of the PS1 snap/affine artifice.
    expect(shader.vertexShader).not.toContain('uSnapRes');
    expect(shader.vertexShader).not.toContain('vAffine');
    expect(shader.fragmentShader).not.toContain('vAffine');
  });

  it('the PS1 compiled shader is byte-identical after an HD round-trip', () => {
    setRenderMode('ps1');
    const a = new MeshStandardMaterial(); patchMaterial(a);
    const before = fakeCompile(a);
    const beforeV = before.vertexShader;
    const beforeF = before.fragmentShader;

    setRenderMode('hd');
    setRenderMode('ps1');
    const after = fakeCompile(a);
    expect(after.vertexShader).toBe(beforeV);
    expect(after.fragmentShader).toBe(beforeF);
  });

  it('setRenderMode bumps live patched materials so they recompile', () => {
    setRenderMode('ps1');
    const m = new MeshStandardMaterial(); patchMaterial(m);
    const v0 = m.version;
    setRenderMode('hd');
    expect(m.version).toBeGreaterThan(v0);
    const v1 = m.version;
    setRenderMode('hd'); // no-op when already in that mode
    expect(m.version).toBe(v1);
  });
});
