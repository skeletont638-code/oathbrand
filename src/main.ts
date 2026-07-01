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
  scene.add(cube);

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
    pipeline.render(scene, camera);
  }
  animate();
}

if (hasWebGL()) {
  startScene();
} else {
  showFallback();
}
