import { afterEach, describe, expect, it } from 'vitest';
import { MeshBasicMaterial } from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';
import { patchMaterial, setSnapResolution } from '../patchMaterial';

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
