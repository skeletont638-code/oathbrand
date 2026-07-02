import * as THREE from 'three';
import { TUNING } from './content/tuning';
import { Game } from './engine/Game';
import { installScreenshotKey } from './engine/screenshot';
import { ARCHER_CLIPS, EnemyView, WraithView, loadSkeleton } from './entities/animator';
import { Archer } from './entities/Archer';
import type { Enemy, EnemyCtx } from './entities/Enemy';
import { Projectile, ProjectilePool } from './entities/Projectile';
import { Soldier } from './entities/Soldier';
import { Wraith } from './entities/Wraith';
import { Brand } from './player/Brand';
import { Combat, inArc } from './player/Combat';
import { Controller } from './player/Controller';
import { Interactor } from './player/Interactor';
import type { Interactable } from './player/Interactor';
import { moveVector } from './player/movement';
import { PS1Pipeline } from './ps1/PS1Pipeline';
import { loadGame, saveGame } from './save/save';
import type { SaveData } from './save/save';
import { kitPieceUrl } from './world/assets';
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
 * Hardcoded TEST zone until authored zone data lands: a 6×12 torch-lit hall
 * holding the full common-enemy roster (Task 10), one per far corner so each
 * fight starts on the player's approach from the south spawn:
 * - Hollow Soldier (mid-west, ~14m): aggro → telegraph → swing (Task 9).
 * - Hollow Archer (NE corner, ~16m): keeps range, telegraphed crossbow
 *   bolts, backs off when crowded.
 * - Brand-Wraith (NW corner, ~16m): invisible until the brand's pulse
 *   thins the veil; dashes into a lunge up close.
 * Exercises ASCII grid → merged `patchMaterial` kit meshes → PS1Pipeline,
 * plus both skinned-enemy GLBs (warrior + archer) through entities/animator.
 */
const TEST_ZONE: ZoneDef = {
  id: 'ashen-gate',
  grid: [
    '######',
    '#....#',
    '#....#',
    '#....#',
    '#....#',
    '#....#',
    '#....#',
    '#....#',
    '#....#',
    '#..S.#',
    '#....#',
    '######',
  ],
  cell: 2,
  tiles: {},
  props: [{ kind: 'crate', at: [8, 1], rotY: 0.35 }],
  lights: [{ at: [1, 2] }, { at: [5, 1] }, { at: [9, 4] }],
  enemies: [
    { kind: 'soldier', at: [2, 2] },
    { kind: 'archer', at: [1, 4] },
    { kind: 'wraith', at: [1, 1] },
  ],
  // A readable note on the crate so the interact prompt has a live target.
  lore: [{ id: 'crate-note', at: [8, 1], text: 'The ash keeps no oaths.' }],
  doors: [],
  ambience: [],
};

/** KayKit skeletons are 2.6m tall at scale 1 — 0.7 fits the 2m-wall halls. */
const ENEMY_SCALE = 0.7;
/** Ember-wisp lifetime (death mote drifting up from a slain enemy), ms. */
const WISP_MS = 1200;

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

  // Player combat kit (Task 9): LMB light / RMB heavy / Shift guard / Space
  // quick-step. The step steers along the current move input; with no input
  // Combat falls back to a backstep.
  const combat = new Combat({
    pose: controller,
    collider: () => built.collider,
    stepDir: (out) => moveVector(controller.input, controller.yaw, out),
  });

  // Zone-shared crossbow bolts (Task 10): one pool serves every archer, and
  // the player's guard blocks bolts exactly like melee (frontal, 0 embers).
  const bolts = new ProjectilePool({ bus: game.bus, defense: combat });

  // Enemy roster — declared before the Brand so its nearest-enemy poll can
  // close over the array; populated right after the Brand exists (wraiths
  // need `() => brand.pulse` for their veil).
  const enemies: { logic: Enemy; view: EnemyView }[] = [];

  // The Oath-Brand: embers-as-health, threat pulse, hollowing desaturation,
  // and the rekindle→save checkpoint loop. The pulse now tracks the nearest
  // living enemy for real.
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
    nearestEnemyM: () => {
      let best: number | null = null;
      for (const { logic } of enemies) {
        if (!logic.alive) continue;
        let d = Math.hypot(logic.pos.x - controller.pos.x, logic.pos.z - controller.pos.z);
        // Wraiths ALWAYS pulse: they report a distance capped just inside
        // the pulse range, so the brand whispers while one stalks the zone.
        if (logic instanceof Wraith) d = logic.pulseDistM(d);
        if (best === null || d < best) best = d;
      }
      return best;
    },
    nearestIllusoryM: () => null,
  });
  game.register(brand);

  // Enemies: logic FSM + view (skinned GLB clone driven by the animator).
  // The player's guard is injected as every enemy's MeleeDefense. Wraiths
  // wear the warrior rig as a ghost (WraithView); archers get the crossbow
  // clip set and fire into the shared bolt pool.
  {
    const [warriorTemplate, archerTemplate] = await Promise.all([
      loadSkeleton(await kitPieceUrl('skeleton-warrior')),
      loadSkeleton(await kitPieceUrl('skeleton-archer')),
    ]);
    const soldierAttack = TUNING.enemies.soldier.attack;
    const lunge = TUNING.enemies.wraith.lunge;
    built.spawns.forEach((spawn, i) => {
      const id = `${zones.current}-${spawn.kind}-${i}`;
      let logic: Enemy;
      let view: EnemyView;
      if (spawn.kind === 'archer') {
        const archer = new Archer({ id, bus: game.bus, defense: combat, shots: bolts });
        view = new EnemyView(
          archer,
          archerTemplate,
          ENEMY_SCALE,
          TUNING.enemies.archer.shot.windupMs,
          ARCHER_CLIPS,
        );
        logic = archer;
      } else if (spawn.kind === 'wraith') {
        const wraith = new Wraith({
          id,
          bus: game.bus,
          defense: combat,
          pulse: () => brand.pulse,
        });
        view = new WraithView(wraith, warriorTemplate, ENEMY_SCALE, lunge.windupMs + lunge.activeMs);
        logic = wraith;
      } else {
        // 'soldier' (the forsworn boss arrives in a later task).
        const soldier = new Soldier({ id, bus: game.bus, defense: combat });
        view = new EnemyView(
          soldier,
          warriorTemplate,
          ENEMY_SCALE,
          soldierAttack.windupMs + soldierAttack.activeMs,
        );
        logic = soldier;
      }
      const [row, col] = spawn.at;
      logic.pos.set((col + 0.5) * TEST_ZONE.cell, 0, (row + 0.5) * TEST_ZONE.cell);
      scene.add(view.root);
      enemies.push({ logic, view });
    });
  }

  // Bolt views: one small unlit quarrel per pooled projectile, lazily grown
  // (the pool itself recycles — steady-state combat allocates nothing).
  const boltGeo = new THREE.BoxGeometry(0.07, 0.07, 0.55);
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xe8d8b0 });
  const boltMeshes: THREE.Mesh[] = [];
  function syncBolts(pool: ProjectilePool): void {
    while (boltMeshes.length < pool.items.length) {
      const mesh = new THREE.Mesh(boltGeo, boltMat);
      mesh.visible = false;
      scene.add(mesh);
      boltMeshes.push(mesh);
    }
    pool.items.forEach((bolt: Projectile, i: number) => {
      const mesh = boltMeshes[i];
      mesh.visible = bolt.active;
      if (bolt.active) {
        mesh.position.copy(bolt.pos);
        mesh.rotation.y = Math.atan2(bolt.dir.x, bolt.dir.z);
      }
    });
  }

  // Enemy hits (already guard-filtered by Combat) burn embers; every 3rd
  // kill returns one as a wisp (Brand self-subscribes to enemy-slain).
  game.bus.on('player-hit', (e) => brand.damage(e.damage));
  game.bus.on('ember-gained', (e) => brandHud.setEmbers(e.total));

  // Ember wisp: a small hot mote rises from each slain enemy — the visible
  // half of the +1-per-3-kills rule (the counter itself lives in Brand).
  const wispGeo = new THREE.SphereGeometry(0.09, 6, 5);
  const wisps: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; ttl: number }[] = [];
  game.bus.on('enemy-slain', (e) => {
    const source = enemies.find((en) => en.logic.id === e.enemyId);
    if (!source) return;
    const material = new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true });
    const mesh = new THREE.Mesh(wispGeo, material);
    mesh.position.set(source.logic.pos.x, 1.0, source.logic.pos.z);
    scene.add(mesh);
    wisps.push({ mesh, material, ttl: WISP_MS });
  });

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
      combat,
      enemies,
      bolts,
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

  // Per-swing hit bookkeeping + a reusable enemy context (no per-frame allocs).
  let lastSwing = 0;
  const hitThisSwing = new Set<Enemy>();
  const enemyCtx: EnemyCtx = {
    playerPos: controller.pos,
    playerHollow: false,
    collider: built.collider,
    canSeePlayer: false,
  };

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

      // Combat: guard mirrors the held button; latched presses start actions.
      combat.tryGuard(controller.input.guardHeld);
      if (controller.consumeLight()) combat.tryLight();
      if (controller.consumeHeavy()) combat.tryHeavy();
      if (controller.consumeStep()) combat.tryStep();
      combat.update(dt);

      // Player swing sweeps enemies (once per enemy per swing) BEFORE they
      // think — a killing blow cancels the victim's simultaneous hit.
      const arc = combat.hitArc();
      if (arc && combat.swingId !== lastSwing) {
        lastSwing = combat.swingId;
        hitThisSwing.clear();
      }
      for (const { logic } of enemies) {
        if (!logic.alive) continue;
        if (arc && !hitThisSwing.has(logic) && inArc(arc, logic.pos, logic.radius)) {
          hitThisSwing.add(logic);
          logic.takeHit(arc.damage);
        }
        enemyCtx.playerHollow = brand.hollow;
        enemyCtx.canSeePlayer = !built.collider.raycastWall(logic.pos, controller.pos);
        logic.update(dt, enemyCtx);
      }
      // Bolts fly after the archers think (a fresh shot moves next frame);
      // enemyCtx doubles as the ProjectileCtx (playerPos + collider).
      bolts.update(dt, enemyCtx);
      syncBolts(bolts);

      for (const { view } of enemies) view.update(dt); // incl. death anims

      // Wisps drift up and gutter out.
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i];
        w.ttl -= dt;
        w.mesh.position.y += dt / 1000;
        w.material.opacity = Math.max(0, w.ttl / WISP_MS);
        if (w.ttl <= 0) {
          scene.remove(w.mesh);
          w.material.dispose();
          wisps.splice(i, 1);
        }
      }

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
