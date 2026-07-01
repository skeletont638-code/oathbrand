import * as THREE from 'three';
import { Game } from './engine/Game';
import { PS1Pipeline } from './ps1/PS1Pipeline';
import { createDevHud } from './ui/devHud';
import { ZoneManager } from './world/ZoneManager';
import type { ZoneDef } from './world/zoneDef';
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

function showFallback(message: string): void {
  document.body.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'webgl-fallback';
  div.textContent = message;
  document.body.appendChild(div);
}

/**
 * Hardcoded TEST zone until authored zone data lands: a 6×6 room with two
 * wall torches and a crate, player spawn at the center. Exercises the whole
 * chain: ASCII grid → gridToPlacements → merged, `patchMaterial`-patched kit
 * meshes → PS1Pipeline. The kit pieces are textured, so this room also covers
 * the "patched material with a bound map" GLSL path that the old
 * checkerboard-cube canary existed to guard.
 */
const TEST_ZONE: ZoneDef = {
  id: 'ashen-gate',
  grid: [
    '######',
    '#....#',
    '#....#',
    '#..S.#',
    '#....#',
    '######',
  ],
  cell: 2,
  tiles: {},
  props: [{ kind: 'crate', at: [4, 1], rotY: 0.35 }],
  lights: [{ at: [1, 2] }, { at: [4, 4] }],
  enemies: [],
  lore: [],
  doors: [],
  ambience: [],
};

async function startScene(): Promise<void> {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a1a1d, 2, 16);
  scene.background = new THREE.Color(0x1a1a1d);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const pipeline = new PS1Pipeline(renderer);
  const hud = createDevHud(renderer);

  // Faint ash-grey ambient so unlit geometry reads as shape, not void.
  scene.add(new THREE.AmbientLight(0x8a8a92, 0.35));

  const game = new Game();
  const zones = new ZoneManager({ scene, bus: game.bus, resolve: () => TEST_ZONE });
  game.register(zones);
  await zones.load('ashen-gate', false);

  // Dev-only escape hatch (?dev=1) so tooling/manual QA can poke at the
  // renderer and zone manager (e.g. verify renderer.info doesn't grow
  // across zone transitions). Never present in normal play.
  if (hud) {
    (window as unknown as Record<string, unknown>).__oathbrand = { renderer, zones, scene };
  }

  // Slow auto-orbit around the room center; player controls arrive in Task 7.
  const center = new THREE.Vector3(6, 0.9, 6);
  const orbitRadius = 3.1;
  let angle = 0;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    pipeline.resize();
  });

  let last = performance.now();
  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(now - last, 100); // clamp tab-switch jumps
    last = now;

    game.update(dt);

    angle += dt * 0.00018;
    camera.position.set(
      center.x + Math.cos(angle) * orbitRadius,
      1.7,
      center.z + Math.sin(angle) * orbitRadius,
    );
    camera.lookAt(center);

    hud?.begin();
    pipeline.render(scene, camera);
    hud?.end(zones.current);
  }
  requestAnimationFrame(frame);
}

if (hasWebGL()) {
  startScene().catch((err: unknown) => {
    console.error('OATHBRAND failed to start:', err);
    showFallback('The flame gutters — OATHBRAND could not load its world. See console.');
  });
} else {
  showFallback('It seems your browser cannot carry this flame. — OATHBRAND needs WebGL.');
}
