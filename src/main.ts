import * as THREE from 'three';
import { PS1Pipeline } from './ps1/PS1Pipeline';
import { patchMaterial } from './ps1/patchMaterial';
import './style.css';

function hasWebGL(): boolean {
  if (typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function showFallback(): void {
  document.body.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'webgl-fallback';
  div.textContent = 'It seems your browser cannot carry this flame. — OATHBRAND needs WebGL.';
  document.body.appendChild(div);
}

/**
 * A tiny 8x8 black/white checkerboard, generated on the fly (no asset
 * download needed). NearestFilter keeps it crisp/blocky, matching the PS1
 * aesthetic and making the affine-UV warp obvious to the eye.
 *
 * This texture backs the regression-canary mesh below: `patchMaterial()`
 * rewriting `#include <map_fragment>` to sample a *varying* (`vMapUv`)
 * instead of a local `vec2` used to be a hard GLSL compile error the moment
 * any patched material had a `map` bound (see `src/ps1/patchMaterial.ts`) —
 * a bug the untextured cube alone could never catch.
 */
function createCheckerboardTexture(): THREE.DataTexture {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const light = (x + y) % 2 === 0;
      const v = light ? 255 : 32;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function startScene(): void {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a1a1d, 1, 12);
  scene.background = new THREE.Color(0x1a1a1d);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 1, 4);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const pipeline = new PS1Pipeline(renderer);

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
  patchMaterial(material); // demonstrates the vertex-snap + affine-uv tricks
  const cube = new THREE.Mesh(geometry, material);
  cube.position.x = -0.8;
  scene.add(cube);

  // Regression canary for the "vMapUv is read-only" GLSL compile bug: a
  // second patched mesh with an actual `map` bound. Keep this around — the
  // untextured cube above can't catch that class of bug on its own.
  const texturedGeometry = new THREE.BoxGeometry(1, 1, 1);
  const texturedMaterial = new THREE.MeshLambertMaterial({ map: createCheckerboardTexture() });
  patchMaterial(texturedMaterial);
  const texturedCube = new THREE.Mesh(texturedGeometry, texturedMaterial);
  texturedCube.position.x = 0.8;
  scene.add(texturedCube);

  const light = new THREE.PointLight(0xffcf9a, 20, 20);
  light.position.set(2, 3, 2);
  scene.add(light);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    pipeline.resize();
  });

  function animate(): void {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.005;
    cube.rotation.y += 0.008;
    texturedCube.rotation.x += 0.005;
    texturedCube.rotation.y += 0.008;
    pipeline.render(scene, camera);
  }
  animate();
}

if (hasWebGL()) {
  startScene();
} else {
  showFallback();
}
