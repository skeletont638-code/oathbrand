import * as THREE from 'three';
import { TUNING } from './content/tuning';
import { Game } from './engine/Game';
import { installScreenshotKey } from './engine/screenshot';
import { Brand } from './player/Brand';
import { Controller } from './player/Controller';
import { Interactor } from './player/Interactor';
import type { Interactable } from './player/Interactor';
import { PS1Pipeline } from './ps1/PS1Pipeline';
import { loadGame, saveGame } from './save/save';
import type { SaveData } from './save/save';
import { createBrandHud } from './ui/brandHud';
import { createDevHud } from './ui/devHud';
import { hidePrompt, showPrompt } from './ui/prompt';
import type { BuiltZone } from './world/ZoneBuilder';
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
  // A readable note on the crate so the interact prompt has a live target.
  lore: [{ id: 'crate-note', at: [4, 1], text: 'The ash keeps no oaths.' }],
  doors: [],
  ambience: [],
};

/** World-space center of the zone's `S` cell (player start). */
function findSpawn(def: ZoneDef): { x: number; z: number } {
  for (let row = 0; row < def.grid.length; row++) {
    const col = def.grid[row].indexOf('S');
    if (col !== -1) {
      return { x: (col + 0.5) * def.cell, z: (row + 0.5) * def.cell };
    }
  }
  return { x: def.cell * 1.5, z: def.cell * 1.5 }; // fail soft: first floor-ish cell
}

/** Everything the context prompt can target in a built zone. */
function collectInteractables(built: BuiltZone): Interactable[] {
  const items: Interactable[] = built.lore.map((l) => ({
    id: l.spot.id,
    verb: 'READ',
    x: l.position.x,
    z: l.position.z,
  }));
  for (const door of built.doors) {
    items.push({
      id: door.def.id,
      verb: 'OPEN',
      x: door.position.x,
      z: door.position.z,
    });
  }
  if (built.banner) {
    items.push({
      id: 'banner',
      verb: 'KNEEL',
      x: built.banner.position.x,
      z: built.banner.position.z,
      label: built.banner.name,
    });
  }
  return items;
}

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
  const built = await zones.load('ashen-gate', false);

  // First-person player. Camera reads the controller pose every frame;
  // 'YXZ' keeps yaw level when pitched (no roll creep).
  const controller = new Controller({ game, canvas: renderer.domElement });
  const spawn = findSpawn(TEST_ZONE);
  controller.pos.set(spawn.x, 0, spawn.z);
  camera.rotation.order = 'YXZ';
  const eyeY = TUNING.player.height * 0.9;

  const interactor = new Interactor(controller);
  const interactables = collectInteractables(built);

  // The Oath-Brand: embers-as-health, threat pulse, hollowing desaturation,
  // and the rekindle→save checkpoint loop. No enemies exist yet (Task 9+),
  // so the distance providers report nothing near.
  const brandHud = createBrandHud(TUNING.brand.maxEmbers);
  const brand = new Brand({
    bus: game.bus,
    pipeline,
    onSave: (bannerId) => {
      // Merge over any prior save so progression fields survive checkpoints.
      const prev = loadGame();
      const data: SaveData = {
        version: 1,
        zone: zones.current,
        bannerId,
        embers: brand.embers,
        flags: prev?.flags ?? [],
        endingsSeen: prev?.endingsSeen ?? [],
        loreRead: prev?.loreRead ?? [],
        visionsSeen: prev?.visionsSeen ?? [],
        ngPlus: prev?.ngPlus ?? false,
      };
      saveGame(data);
    },
    nearestEnemyM: () => null,
    nearestIllusoryM: () => null,
  });
  game.register(brand);

  // Brand → HUD: embers/hollow are event-driven; pulse is pushed per frame
  // below (it decays to zero silently, which no event announces).
  game.bus.on('ember-lost', (e) => brandHud.setEmbers(e.remaining));
  game.bus.on('player-hollowed', () => brandHud.setHollow(true));
  game.bus.on('player-rekindled', () => {
    brandHud.setHollow(false);
    brandHud.setEmbers(brand.embers);
  });

  // Dev-only: F9 saves the canvas as shot-<zone>-<timestamp>.png.
  const shots = installScreenshotKey({
    canvas: renderer.domElement,
    zone: () => zones.current,
  });

  // Dev-only escape hatch (?dev=1) so tooling/manual QA can poke at the
  // renderer and zone manager (e.g. verify renderer.info doesn't grow
  // across zone transitions). Never present in normal play.
  if (hud) {
    (window as unknown as Record<string, unknown>).__oathbrand = {
      renderer,
      zones,
      scene,
      game,
      controller,
      brand,
      pipeline,
    };
    // Dev-only brand test keys (until combat/banners land): H burns an
    // ember, R kneels at a phantom banner. Manual QA for hollowing/desat.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH') brand.damage(1);
      else if (e.code === 'KeyR') brand.rekindle('dev-banner');
    });
  }

  // Until Task 18's menus land, jump straight into play so the room is
  // immediately walkable (boot → title → playing).
  game.transition('title');
  game.transition('playing');

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

    // Simulation is gated on 'playing' (pause freezes world + player);
    // rendering continues so the paused frame stays on screen.
    if (game.state === 'playing') {
      game.update(dt);
      controller.update(dt, built.collider);
      brandHud.setPulse(brand.pulse, brand.blueFlicker);
      const target = interactor.nearest(interactables);
      if (target) showPrompt(target.verb, target.label);
      else hidePrompt();
    }

    camera.rotation.y = controller.yaw;
    camera.rotation.x = controller.pitch;
    camera.position.set(controller.pos.x, controller.pos.y + eyeY, controller.pos.z);

    hud?.begin();
    pipeline.render(scene, camera);
    shots?.afterRender();
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
