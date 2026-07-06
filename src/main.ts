import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TUNING } from './content/tuning';
import type { GameFlag, ZoneId } from './content/types';
import { hasZone, zoneOrThrow, ZONES } from './content/zones';
import { skyFogColor } from './world/exteriorSky';
import { scatterSpawns } from './world/spawnScatter';
import { preloadTextures } from './world/textures';
import { Game } from './engine/Game';
import { DreadDirector } from './engine/DreadDirector';
import type { DreadCtx, ScareActivation } from './engine/DreadDirector';
import { ScreenScareKit, hdScareRider } from './engine/ScreenScareKit';
import { setSnapResolution } from './ps1/patchMaterial';
import { installScreenshotKey } from './engine/screenshot';
import { ARCHER_CLIPS, EnemyView, ForswornView, WraithView, loadSkeleton } from './entities/animator';
import type { EntityView } from './entities/animator';
import { Archer } from './entities/Archer';
import type { Enemy, EnemyCtx } from './entities/Enemy';
import { Projectile, ProjectilePool } from './entities/Projectile';
import { Soldier } from './entities/Soldier';
import { Wraith } from './entities/Wraith';
import { Forsworn } from './entities/Forsworn';
import { AshHound, HoundView } from './entities/AshHound';
import { KneelingHollow, KneelerView } from './entities/KneelingHollow';
import { WatcherPresence, WatcherView } from './entities/WatcherPresence';
import { CrossingSilhouette } from './entities/CrossingSilhouette';
import type { ViewTest } from './entities/WatcherPresence';
import { HagPresence, HagView } from './entities/HagPresence';
import { FOGLINE_PART_M, MIN_EMBER_CAP, bootEmberCap, offerToHag, restoreEmberCap, zoneVisitFogFarM } from './content/hagBargain';
import type { HagState, Offering, Boon } from './content/hagBargain';
import { BossArena, arenaWantsDark } from './entities/bossArena';
import { Brand } from './player/Brand';
import { Combat, inArc } from './player/Combat';
import { Controller } from './player/Controller';
import { Interactor } from './player/Interactor';
import type { Interactable } from './player/Interactor';
import { KneelRitual } from './player/Kneel';
import { moveVector } from './player/movement';
import { PS1Pipeline } from './ps1/PS1Pipeline';
import { clearSave, greaterVaelCheckpoint, loadGame, saveGame, secondVigilSave } from './save/save';
import type { SaveData } from './save/save';
import { VisionPlayer } from './engine/VisionPlayer';
import type { GhostSprite } from './engine/VisionPlayer';
import { visionForZone, GV_VISION_HAG } from './content/visions';
import { kitPieceUrl, loadKitPieces } from './world/assets';
import { createBrandHud } from './ui/brandHud';
import { createDevHud } from './ui/devHud';
import { DialogueBox, Inscription, showCard, showVisionCaption } from './ui/inscription';
import { flashDenied, hidePrompt, showPrompt } from './ui/prompt';
import { AshPriest, ashPriestsIn } from './entities/AshPriest';
import { dialogueSequence } from './content/dialogue';
import type { BuiltZone, PlacedDoor } from './world/ZoneBuilder';
import { doorPanelGeometry, doorPropPlacements } from './world/ZoneBuilder';
import { isBarred, resolveDoorInstances } from './world/doors';
import { getTexture } from './world/textures';
import { resolveZoneLighting } from './world/lighting';
import { ZoneManager } from './world/ZoneManager';
import { kickOpen, takeItem } from './world/mechanics';
import type { HagThresholdDef, ScareBeat, WatcherAnchor, ZoneDef } from './world/zoneDef';
import { canPass, doorEntry, doorSpan, lockFlag, pairedDoor } from './world/zoneGraph';
import { VistaDirector } from './world/vista';
import { buildDragon, disposeDragon } from './world/dragon';
import type { Dragon } from './world/dragon';
import { selectEnding, EndingDirector } from './engine/endings';
import type { EndingId } from './content/types';
import { showTitleCard, hideTitleCard } from './ui/titleCard';
import { setBlackout, rollCredits, showVigilContinues } from './ui/credits';
import { AudioManager } from './audio/AudioManager';
import { TitleScreen } from './ui/title';
import { PauseScreen } from './ui/pause';
import {
  SettingsPanel,
  loadSettings,
  applySettings,
  applyTextScale,
} from './ui/settings';
import type { SettingsSinks } from './ui/settings';
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

/** KayKit skeletons are 2.6m tall at scale 1 — 0.7 fits the 2m-wall halls. */
const ENEMY_SCALE = 0.7;
/** Ember-wisp lifetime (death mote drifting up from a slain enemy), ms. */
const WISP_MS = 1200;
/** Fog far-plane when a zone doesn't set its own `fogFarM`. */
const DEFAULT_FOG_FAR = 16;
/** The v1 interior fog/background tint (cold stone-grey). Exterior zones swap
 *  it for their sky's horizon tint so the fog dissolves into the backdrop. */
const INTERIOR_FOG_HEX = 0x1a1a1d;
/** Height-lerp time constant (ms) — the eye eases onto a new cell's terrain. */
const GROUND_EASE_MS = 120;
/** Ambient-light floor when a zone doesn't set its own `ambientFloor`. */
const DEFAULT_AMBIENT = 0.35;
/** Shortcut gate: how far it swings open (rad) and how fast (rad/s). */
const GATE_OPEN_ANGLE = -1.4;
const GATE_SWING_SPEED = 3.2;
/** Total black-fade through a decorated door (world-expansion v1.2, Task 1):
 *  half out to black (covering the zone load) + half back in. */
const DOOR_FADE_MS = 400;
/** Landing-dip on the undercroft drop: start crouch (m) + recovery (m/s). */
const FALL_DIP_M = 1.3;
const FALL_DIP_RECOVER = 2.4;

// --- Task 15: the throne arena + the summit finale -------------------------
/** Throne: the two doorway cells the portcullis seals [row, col]. */
const THRONE_GATE_CELLS: readonly [number, number][] = [
  [7, 4],
  [7, 5],
];
/** Throne: the player is "in the arena" (sealable) at or north of this row. */
const THRONE_ARENA_MAX_ROW = 6;
/** Portcullis travel: sealed y (down, blocking) → open y (up, in the lintel). */
const GATE_SEALED_Y = 1.1;
const GATE_OPEN_Y = 3.4;
const GATE_SLIDE_SPEED = 3.6; // m/s
/** P3 blackout: how fast the arena darkens/relights (fraction/s). */
const DARKEN_SPEED = 0.7;
/** Summit: the crown offering-flame cell [row, col], and the eye-wake radius. */
const SUMMIT_FLAME_CELL: readonly [number, number] = [2, 4];
const EYE_WAKE_RANGE_M = 5.5;
const EYE_OPEN_SPEED = 0.22; // per second — a slow waking

/**
 * The game starts at the Ashen Gate's `S`. Dev builds (`?dev=1`) may jump
 * straight to any registered zone with `&zone=<id>` — this replaced the
 * old hardcoded TEST_ZONE (Task 11); the real zones ARE the test content
 * now, and manual QA reaches each one directly.
 */
/** Resolve a zone def. Every reachable zone is a registered ZoneDef now — the
 *  Task-2 dev exterior scaffold is gone (Task 9 shipped the real Gate Fields). */
function resolveZone(id: ZoneId): ZoneDef {
  return zoneOrThrow(id);
}

/**
 * Greater Vael Drop 1 exterior ambience registry (Task 6). The Drop-1 gv zones
 * land task by task, so their two synth beds are authored here ahead of the
 * geometry — an unbuilt gv id (no ZoneDef yet) resolves to its pair of layers
 * below. Built zones keep their own def-declared ambience untouched.
 */
const GV_AMBIENCE: Partial<Record<ZoneId, string[]>> = {
  'gate-fields': ['amb-field-wind', 'amb-tithe-toll'],
  'ashen-forest-n': ['amb-forest-hush', 'amb-forest-wrong'],
  'cinder-village': ['amb-cinder-wind', 'amb-cinder-knock'],
  'pilgrims-descent': ['amb-descent-drone', 'amb-descent-wind'],
};

/** The two ambience layer ids for a zone: its def's own array when authored,
 *  else the Greater Vael registry. Never throws for an unbuilt gv zone — those
 *  have no ZoneDef yet, so `resolveZone` (which rejects unbuilt ids) is only
 *  consulted for a built zone. */
function resolveAmbience(id: ZoneId): string[] {
  if (hasZone(id)) {
    const def = resolveZone(id).ambience;
    if (def.length > 0) return def;
  }
  return GV_AMBIENCE[id] ?? [];
}

function startZoneId(): ZoneId {
  const params = new URLSearchParams(window.location.search);
  const zone = params.get('dev') === '1' ? params.get('zone') : null;
  if (zone && hasZone(zone as ZoneId)) return zone as ZoneId;
  return 'ashen-gate';
}

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

/** The low-fog far-plane (m) if [row,col] sits in one of the zone's `fogCells`
 *  scare bands, else undefined — exterior only (spec §4). */
function fogCellFar(def: ZoneDef, row: number, col: number): number | undefined {
  for (const band of def.fogCells ?? []) {
    for (const [r, c] of band.cells) {
      if (r === row && c === col) return band.farM;
    }
  }
  return undefined;
}

/** A tiny seeded PRNG (mulberry32) — the DreadDirector's per-run randomness
 *  (the false-pulse crossing the seed picks) is deterministic under it. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gather every EXTERIOR zone's scare authoring for one run-scoped DreadDirector
 *  (the per-drop caps — 10 beats, 2×/gimmick, 6 Watchers — must span the whole
 *  drop, so there is ONE director, not one per zone). Castle/interior zones
 *  contribute nothing, which is exactly why they never get scares.
 *
 *  Watcher anchors are kept KEYED BY ZONE (T5 review fix): the single run-scoped
 *  director spans every exterior zone, so a flat anchor list would let a beat in
 *  zone A manifest the Watcher at zone B's anchor. `anchorsByZone` scopes the
 *  pick to `beat.zone`; the WatcherPresence is re-scoped per entry (setAnchors)
 *  so an off-screen reposition can never wander into another zone's anchor. */
function exteriorScareData(): {
  scares: ScareBeat[];
  anchorsByZone: Partial<Record<ZoneId, WatcherAnchor[]>>;
  hag: HagThresholdDef | undefined;
} {
  const scares: ScareBeat[] = [];
  const anchorsByZone: Partial<Record<ZoneId, WatcherAnchor[]>> = {};
  let hag: HagThresholdDef | undefined;
  const defs: ZoneDef[] = Object.values(ZONES).filter((d): d is ZoneDef => d !== undefined);
  for (const def of defs) {
    if (def.kind !== 'exterior') continue;
    if (def.scares) scares.push(...def.scares);
    if (def.watcherAnchors && def.watcherAnchors.length > 0) {
      anchorsByZone[def.id] = [...(anchorsByZone[def.id] ?? []), ...def.watcherAnchors];
    }
    if (!hag && def.hagThreshold) hag = def.hagThreshold;
  }
  return { scares, anchorsByZone, hag };
}

/** Everything the context prompt can target in a built zone. Already-taken
 * items (their flag set) drop out so their prompt/mesh don't linger. The
 * Ash-Priests (T13) are static NPCs spawned alongside enemies, so their SPEAK
 * targets are folded in here. */
function collectInteractables(
  built: BuiltZone,
  flags: Set<GameFlag>,
  npcs: AshPriest[],
  /** A decorated door's prompt label, or undefined for a plain gate (Task 1). */
  doorLabel: (defId: string) => string | undefined,
): Interactable[] {
  const items: Interactable[] = built.lore.map((l) => ({
    id: l.spot.id,
    verb: 'READ',
    x: l.position.x,
    z: l.position.z,
  }));
  for (const item of built.items) {
    if (flags.has(item.spot.flag)) continue; // already taken
    items.push({ id: item.spot.id, verb: 'TAKE', x: item.position.x, z: item.position.z });
  }
  for (const priest of npcs) items.push(priest.interactable());
  for (const door of built.doors) {
    items.push({
      id: door.def.id,
      verb: 'OPEN',
      x: door.position.x,
      z: door.position.z,
      label: doorLabel(door.def.id), // "Iron Door" on a decorated gate, else undefined
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
  const fog = new THREE.Fog(0x1a1a1d, 2, DEFAULT_FOG_FAR);
  scene.fog = fog;
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

  // Faint ash-grey ambient so unlit geometry reads as shape, not void. The
  // intensity is rebound per zone in enterZone() (the Undercroft floors it to
  // 0.06 so its unlit east half stays black for the wraith showcase).
  const ambient = new THREE.AmbientLight(0x8a8a92, DEFAULT_AMBIENT);
  scene.add(ambient);

  // Realism pass (Task 1): the moon key light + a hemisphere fill — ONE shared
  // instance of each, rebound per zone in enterZone (≤1 directional/≤1 hemisphere,
  // ever). Per-vertex, no shadow maps, 0 draw calls.
  const moonLight = new THREE.DirectionalLight(0x8fa3c8, 0);
  moonLight.castShadow = false;
  scene.add(moonLight);
  scene.add(moonLight.target); // target must be in-scene; direction = position → target
  const hemiLight = new THREE.HemisphereLight(0x000000, 0x000000, 0);
  scene.add(hemiLight);
  /** Interior faint-key direction (a soft top/front cool wash) when there is no moon. */
  const INTERIOR_KEY_DIR = new THREE.Vector3(0.35, 1, 0.25).normalize();
  /** Base directional intensity for this zone (restored after the Forsworn P3 blackout, Task 2). */
  let moonBaseIntensity = 0;

  const game = new Game();

  // Run state seeded from the save: door-lock flags, NG+ remix, and the
  // vista seen-set (one-shots stay one-shot across reloads once banked at
  // a banner). Full save-restore (CONTINUE) lands with the menus (T18).
  let save = loadGame();
  await preloadTextures(); // realism pass: ground/bark/rock/hide/cloth ready before the first zone builds
  const flags = new Set<GameFlag>(save?.flags ?? []);
  // Greater Vael Drop 1 (Task 9): the Ashen Gate postern into the Fields opens
  // once the castle is beaten. Derive `greater-vael-open` into the LIVE flag set
  // from the v2 persisted mirror (`greaterVael.open`, Task 7), falling back to
  // "any ending seen" for older saves — so a beaten-castle save opens the postern
  // (`canPass`) even when the flag was never written into `flags`. A fresh,
  // no-ending save leaves it sealed.
  if (save?.greaterVael?.open ?? ((save?.endingsSeen?.length ?? 0) > 0)) {
    flags.add('greater-vael-open');
  }
  const ngPlus = save?.ngPlus ?? false;
  const vista = new VistaDirector(save?.visionsSeen ?? []);
  // Lore already read (seeded from the save); the inscription reader adds to
  // this set + emits `lore-read` on each first read, and it banks at the next
  // kneel (see Brand.onSave below).
  const loreRead = new Set<string>(save?.loreRead ?? []);

  // World-expansion v1.2 (Task 1): resolve every authored gate-door decoration
  // into an edge-keyed DoorInstance, indexed by DoorDef id so a targeted door
  // resolves on EITHER side of its edge. Empty while no zone declares
  // `gateDoors` — the mechanism is dormant and v1 gates stay open borders.
  const doorInstancesByDefId = resolveDoorInstances(
    Object.values(ZONES).filter((z): z is ZoneDef => z !== undefined),
  );
  // Far-side doors permanently unbarred (persisted, additive); seeded from save.
  const doorsOpened = new Set<string>(save?.doorsOpened ?? []);

  // --- Task 5: the Hag's ember cap + the bargains struck --------------------
  // The brand's rekindle CEILING reads `emberCap`; a tithe lowers it, persisting
  // across Drop 1 until the door out of Greater Vael / the next Vigil restores
  // it. `hagBargains` mirrors HagState.bargains (banked with the dread ledger).
  // Finding 3 (spec §6.4): the Hag-tithed cap persists ONLY within Greater Vael.
  // Boot/resume outside it — the resume zone (`save.zone`) is not an exterior GV
  // zone — restores the full brand, or a tithe → quit-in-castle → reload leaves
  // the castle capped forever. The GV boundary is `kind === 'exterior'` (pinned
  // in bootEmberCap). Unknown/absent zone ⇒ undefined kind ⇒ restore (fail safe).
  let emberCap = bootEmberCap({
    savedCap: save?.greaterVael?.maxEmberCap,
    resumeZoneKind: save && hasZone(save.zone) ? resolveZone(save.zone).kind : undefined,
  });
  // Persist the restore at once (finding 3 "+ persist"), so a second reload can't
  // resurrect the tithed cap: rewrite only maxEmberCap on the existing ledger,
  // leaving every other field byte-identical (additive/lossless). No-op unless a
  // lowered cap was actually lifted.
  if (save?.greaterVael && (save.greaterVael.maxEmberCap ?? emberCap) !== emberCap) {
    save = { ...save, greaterVael: { ...save.greaterVael, maxEmberCap: emberCap } };
    saveGame(save);
  }
  let hagBargains: string[] = [...(save?.greaterVael?.bargains ?? [])];
  /** Ashen-Forest-N fog-line boon (fogFar +6) armed by an ember tithe, applied
   *  for the visit; 0 when unarmed / after leaving Greater Vael. */
  let forestFogBoost = 0;
  /** Seeded by the `kneel` bargain: the next Watcher glimpse is "answered". */
  let watcherAnswered = false;

  // Zone registry (Task 11): real authored zones resolve through ZONES.
  const zones = new ZoneManager({ scene, bus: game.bus, resolve: resolveZone });
  game.register(zones);
  let built = await zones.load(startZoneId(), ngPlus);
  /** Authored def of the current zone (grid/cell/vista never vary in NG+). */
  let activeDef = resolveZone(zones.current);
  /** Current fog far baseline; the vista adds its boost on top per frame. */
  let baseFogFar = DEFAULT_FOG_FAR;
  /** The active zone's fog far WITHOUT the Hag fog-line boost (Task 10). `baseFogFar`
   *  is RECOMPUTED from this + `forestFogBoost` via `zoneVisitFogFarM`, never `+=`,
   *  so a repeat in-zone tithe (reachable at this zone's threshold) can't stack +6. */
  let zoneBaseFogFar = DEFAULT_FOG_FAR;
  /** Visual eye-height offset from the exterior terrain layer (0 in interiors);
   *  eased toward the current cell's `cellHeightM` each frame — camera only,
   *  collision is unchanged (no jump). */
  let groundY = 0;

  // First-person player. Camera reads the controller pose every frame;
  // 'YXZ' keeps yaw level when pitched (no roll creep).
  const controller = new Controller({ game, canvas: renderer.domElement });
  const spawn = findSpawn(activeDef);
  controller.pos.set(spawn.x, 0, spawn.z);
  camera.rotation.order = 'YXZ';
  const eyeY = TUNING.player.height * 0.9;

  const interactor = new Interactor(controller);
  let interactables: Interactable[] = [];

  // Inscription reader + dialogue box (Task 13). Opening either transitions the
  // game out of 'playing' (→ 'reading' / 'dialogue'), which freezes the whole
  // simulation in the frame loop — so combat and movement are blocked while a
  // plate or a conversation is up. `onClose` clears the interact latch so the
  // very E that closes an overlay cannot immediately re-fire an interaction,
  // and drops the lingering context prompt.
  const clearInteractLatch = (): void => {
    controller.input.interact = false;
    controller.input.light = false;
    controller.input.heavy = false;
    hidePrompt();
  };
  const inscription = new Inscription({
    game,
    bus: game.bus,
    readSet: loreRead,
    onClose: clearInteractLatch,
  });
  const dialogueBox = new DialogueBox({ game, onClose: clearInteractLatch });

  // Player combat kit (Task 9): LMB light / RMB heavy / Shift guard / Space
  // quick-step. The step steers along the current move input; with no input
  // Combat falls back to a backstep. `built` is rebound on every zone
  // transition, so the collider closure always sees the current zone.
  const combat = new Combat({
    pose: controller,
    collider: () => built.collider,
    stepDir: (out) => moveVector(controller.input, controller.yaw, out),
  });

  // Zone-shared crossbow bolts (Task 10): one pool serves every archer, and
  // the player's guard blocks bolts exactly like melee (frontal, 0 embers).
  // Recreated per zone (resetBolts) so no bolt survives a transition.
  let bolts = new ProjectilePool({ bus: game.bus, defense: combat });

  // Enemy roster — declared before the Brand so its nearest-enemy poll can
  // close over the array; REBUILT in place on every zone transition
  // (spawnEnemies), so every closure over `enemies` stays live.
  // `groundY` is the enemy VIEW's eased terrain height (Task 12 exterior height
  // layer): the enemy-side twin of the camera's `groundY`, so a spawn/patrol on a
  // raised terrace renders with its feet ON the terrace, not buried or floating.
  // Visual only — the flat 2D collider stays authoritative (logic.pos.y is 0).
  // Interior/flat zones report height 0 everywhere, so it stays 0 (no-op, v1-exact).
  const enemies: { logic: Enemy; view: EntityView; groundY: number }[] = [];

  // The Oath-Brand: embers-as-health, threat pulse, hollowing desaturation,
  // and the rekindle→save checkpoint loop. The pulse tracks the nearest
  // living enemy for real.
  const brandHud = createBrandHud(TUNING.brand.maxEmbers);
  const brand = new Brand({
    bus: game.bus,
    pipeline,
    // Task 5: the rekindle ceiling is the Hag-tithed ember cap (defaults to the
    // full brand until a tithe lowers it; restored on leaving Greater Vael).
    maxEmbers: () => emberCap,
    onSave: (bannerId) => {
      // Merge over any prior save so progression fields survive checkpoints.
      const prev = loadGame();
      const data: SaveData = {
        // Task 13 (T7): write the canonical v2 shape DIRECTLY — no more version-1
        // checkpoints that loadGame re-migrates + rewrites on every read (the
        // benign v1↔v2 oscillation). The save/load round-trip is now a no-op.
        version: 2,
        zone: zones.current,
        bannerId,
        embers: brand.embers,
        flags: [...flags],
        endingsSeen: prev?.endingsSeen ?? [],
        // Bank inscriptions read this run (union with any older save's set).
        loreRead: [...new Set([...(prev?.loreRead ?? []), ...loreRead])],
        // Bank fired vistas AND played banner visions (Task 14), keeping any
        // ids an older save already held. Both families share this set;
        // `vista-*` vs `vision-*` namespacing keeps them from colliding.
        visionsSeen: [
          ...new Set([...(prev?.visionsSeen ?? []), ...vista.seenIds, ...visionPlayer.seenIds]),
        ],
        ngPlus,
        // Greater Vael dread ledger (Task 3): the glitches seen + Watcher budget
        // spent this drop, so fidelity scarcity + the caps survive a reload.
        // Carries the prior save's ledger forward until an exterior run advances it.
        // Task 5: also banks the Hag ember cap + bargains struck this drop.
        // Task 13 (T7): mirror the REAL `greater-vael-open` flag into `open`, so
        // the postern derives from the save (authoritative), not just endingsSeen.
        greaterVael: greaterVaelCheckpoint({
          open: flags.has('greater-vael-open'),
          ...dread.snapshot(),
          maxEmberCap: emberCap,
          bargains: hagBargains,
        }),
        // Far-side doors unbarred for good (world-expansion v1.2, Task 1).
        doorsOpened: [...doorsOpened],
      };
      saveGame(data);
    },
    nearestEnemyM: () => {
      let best: number | null = null;
      for (const { logic } of enemies) {
        if (!logic.alive) continue;
        // A DORMANT kneeling hollow is beneath notice — it must not feed the
        // brand (which would let a field of them self-wake off their own pulse,
        // or throb the brand forever beside an inert field-ward). It joins the
        // reckoning the instant it rises.
        if (logic instanceof KneelingHollow && logic.dormant) continue;
        let d = Math.hypot(logic.pos.x - controller.pos.x, logic.pos.z - controller.pos.z);
        // Wraiths — and the Forsworn — ALWAYS pulse: they report a distance
        // capped just inside the pulse range, so the brand never goes quiet
        // while one stalks the zone (the only way to read the boss once the
        // torches die in his P3).
        if (logic instanceof Wraith || logic instanceof Forsworn) d = logic.pulseDistM(d);
        if (best === null || d < best) best = d;
      }
      return best;
    },
    // The brand guttering blue near a hidden way (spec §): fed from the
    // current zone's doors locked 'illusory' (the undercroft's false wall to
    // the Queen's Garden). Distance in XZ; nearest wins, null when none near.
    nearestIllusoryM: () => {
      let best: number | null = null;
      for (const door of built.doors) {
        if (door.def.lock !== 'illusory') continue;
        const d = Math.hypot(door.position.x - controller.pos.x, door.position.z - controller.pos.z);
        if (best === null || d < best) best = d;
      }
      return best;
    },
  });
  game.register(brand);

  // --- Task 3: the DreadDirector + screen-effect scare kit -----------------
  // "The engine notices IT." The kit holds the four glitch timelines (registered
  // as a Subsystem right AFTER the Brand, so it ticks once the Brand has written
  // its own per-frame desaturation — the step loop composites the two via max()).
  const scareKit = new ScreenScareKit();
  game.register(scareKit);
  // ONE run-scoped director for the whole drop (its per-drop caps span zones).
  // Seeded per run (mulberry32) so the false-pulse crossing replays; the ledger
  // (glitchSeen / watcherSightings) is seeded from the save so fidelity scarcity
  // and the Watcher budget persist across reloads.
  const runSeed = (Date.now() ^ 0x9e3779b9) >>> 0;
  const dreadData = exteriorScareData();
  const dread = new DreadDirector(
    dreadData.scares,
    dreadData.anchorsByZone,
    dreadData.hag,
    {
      glitchSeen: save?.greaterVael?.glitchSeen ?? [],
      watcherSightings: save?.greaterVael?.watcherSightings ?? 0,
      // Finding 1: beats already fired this drop stay spent across a reload.
      firedBeatIds: save?.greaterVael?.firedBeatIds ?? [],
    },
    mulberry32(runSeed),
  );
  // A separate seeded stream for Ash-Hound flank/duration rolls, so their
  // randomness is deterministic per run without perturbing the director's.
  const houndRng = mulberry32((runSeed ^ 0x5bd1e995) >>> 0);

  // P1: every spawn wave (zone entry AND kneel respawn) deals from a fresh
  // stream so a retry never replays the roster the player just memorized.
  let spawnWave = 0;
  const nextScatterRng = (): (() => number) =>
    mulberry32((runSeed ^ (++spawnWave * 0x9e3779b9)) >>> 0);

  // --- Task 5: the never-killable presences (the Watcher + the Hag) ---------
  // The WATCHER is run-scoped (its sighting budget spans the drop, like the
  // director); the HAG is zone-scoped (her threshold is a place — rebuilt in
  // enterZone from the active zone's own `hagThreshold` + cell size, so the
  // OFFER prompt, the silhouette, and `atThreshold` can never disagree across
  // zones). Their VIEWS are zone-scoped. The director owns the budget + shared
  // cooldown and CALLS manifest/glimpse via routeScare — these classes only
  // render + reposition. Castle/interior zones never build a view, so they
  // never see either. The Watcher's sighting seed comes from the same save
  // slice the director uses, so both counters stay in step.
  const PRESENCE_CELL_M = 2; // the universal 2 m grid (zoneDef: "always 2")
  // Constructed with no anchors — enterZone re-scopes it (setAnchors) to the
  // active exterior zone, so a reposition can never wander to another zone's.
  const watcherPresence = new WatcherPresence(
    [],
    PRESENCE_CELL_M,
    save?.greaterVael?.watcherSightings ?? 0,
  );
  /** The active exterior zone's Hag, or null (rebuilt per zone in enterZone). */
  let hagPresence: HagPresence | null = null;
  // Per-frame frustum scratch: the Watcher freezes while its silhouette is in
  // view and may only reposition off-screen. The observed test is a SPHERE
  // around the mid-body point sized to cover the whole 3 m column, so a figure
  // half on screen (midpoint straddling a frustum plane) still counts as
  // observed — it must never be caught teleporting while any of it shows.
  // The scratch objects are reused so the tick allocates nothing.
  const presenceFrustum = new THREE.Frustum();
  const presenceViewProj = new THREE.Matrix4();
  const presenceSphere = new THREE.Sphere(
    new THREE.Vector3(),
    TUNING.greaterVael.watcher.heightM * 0.6,
  );
  const presenceViewTest: ViewTest = {
    contains: (p) => {
      presenceSphere.center.set(p.x, p.y, p.z);
      return presenceFrustum.intersectsSphere(presenceSphere);
    },
  };
  // The reduced-flicker toggle drives the pipeline AND the kit (both strip their
  // per-frame-random layers; the kit's held timelines are unaffected).
  scareKit.setFlickerSafe(false);
  // Latest per-frame dread event (kneel / lore-read), consumed once by the tick.
  let dreadEvent: DreadCtx['events'] = { kind: 'none' };
  game.bus.on('lore-read', (e) => {
    dreadEvent = { kind: 'loreRead', loreId: e.loreId };
  });
  game.bus.on('player-rekindled', () => {
    dreadEvent = { kind: 'kneel' };
  });

  /** Route one DreadDirector activation to the systems that render it: the four
   *  screen gimmicks drive the ScreenScareKit; the false-pulse throbs the HUD +
   *  audio (finding 4b); the silence-spike ducks audio (and wakes CV-1); the
   *  Watcher/Hag manifest their presences; a pure-visual arms its authored
   *  one-shot (AF-1's crossing silhouette, finding 4a). None touch the banner. */
  function routeScare(a: ScareActivation): void {
    switch (a.kind) {
      case 'snap-grid':
        scareKit.snap(a.everSeen); // a repeat glitch holds ~30% shorter (rule 8)
        break;
      case 'resolution-drop':
        scareKit.resDrop(a.everSeen);
        break;
      case 'desaturation':
        scareKit.desatStab(a.everSeen);
        break;
      case 'silence-spike': {
        // Task 6 adds AudioManager.duckToSilence(ms); route it the moment it lands.
        const duck = (audio as { duckToSilence?: (ms: number) => void }).duckToSilence;
        duck?.call(audio, 1200);
        // CV-1 (Task 11): the frozen procession's ONE live kneeler rises on the
        // beat — the two statue-knight props never move. The zone spawns exactly
        // one `kneeler` ([4,9]), so waking every dormant Hollow wakes only it.
        // (GF-1's silence-spike leaves its ward inert — this is beat-id gated.)
        if (a.beatId === 'CV-1') {
          for (const { logic } of enemies) if (logic instanceof KneelingHollow) logic.wake();
        }
        break;
      }
      case 'false-pulse':
        // "The radar you trust, lying once" (spec §5): the HUD sigil visibly
        // throbs with nothing there. `spoofPulse` arms the one-shot swell main
        // max()-composites into brandHud.setPulse below (finding 4b — it was
        // audio-only before); the threat/heartbeat sell the lie in sound. The
        // spoof honours the reduced-flicker flash cap; the banner is untouched.
        scareKit.spoofPulse();
        game.bus.emit({ type: 'brand-pulse', intensity: 1 });
        audio.setThreat(1);
        break;
      case 'watcher':
        // A sighting: the Watcher manifests at the authored anchor (frozen,
        // never approached). Its silhouette + off-screen reposition + despawn
        // run in the exterior presence tick below.
        watcherPresence.manifest(a.anchor);
        break;
      case 'hag-glimpse':
        // The Hag appears at the fog-line, receding if approached.
        hagPresence?.glimpse();
        break;
      case 'pure-visual': {
        // AF-1 (finding 4a): a tall dark silhouette crosses between two dense-tree
        // cells downrange, then is gone. The two cells are authored on the beat
        // (`crossing`); convert to world centres (y on the terrain layer, 0 in the
        // flat forest) and arm the crossing. Other pure-visual beats (CV-3 the
        // curdled well) carry no `crossing` — the well's dread is environmental —
        // so they no-op here, exactly as before.
        const beat = activeDef.scares?.find((s) => s.id === a.beatId);
        const cross = beat?.crossing;
        if (cross && crossingSilhouette) {
          const world = ([r, c]: [number, number]): { x: number; y: number; z: number } => ({
            x: (c + 0.5) * built.cellM,
            y: built.groundYAt((c + 0.5) * built.cellM, (r + 0.5) * built.cellM),
            z: (r + 0.5) * built.cellM,
          });
          crossingSilhouette.arm(world(cross[0]), world(cross[1]));
        }
        break;
      }
    }
  }
  /** Latch so the per-frame vertex-snap override restores exactly once. */
  let snapOverridden = false;
  /** The render scale to restore after a resolution-drop beat ends (null ⇒ none). */
  let dropRestoreScale: 240 | 360 | null = null;

  // --- Task 17: the dread mixer -------------------------------------------
  // The whole soundscape (synth beds + threat heartbeat + stone reverb + SFX).
  // Registered LAST, so it ticks after the Brand each frame. It subscribes to
  // the bus itself (zone-entered → crossfade beds, brand-pulse → threat duck +
  // heartbeat, door-opened [deduped], player-hit, cues, vista swell). `occluded`
  // hands it the current zone's wall raycast for positional low-pass; `built`
  // is rebound per zone so the closure always sees the live collider.
  const audio = new AudioManager({
    bus: game.bus,
    ambienceFor: (zone) => resolveAmbience(zone as ZoneId),
    occluded: (sx, sz) => built.collider.raycastWall(controller.pos, { x: sx, z: sz }),
  });
  game.register(audio);
  // The AudioContext may only be created/resumed after a user gesture (autoplay
  // policy). Seed the opening zone's beds now — setZoneLayers buffers them until
  // the context is live — then wake the audio on the first pointer/key press
  // (the click-to-play / pointer-lock gesture).
  audio.setZoneLayers(resolveAmbience(zones.current));
  const wakeAudio = (): void => audio.init(true);
  window.addEventListener('pointerdown', wakeAudio, { once: true });
  window.addEventListener('keydown', wakeAudio, { once: true });

  // Skinned enemy templates, loaded ONCE — zone rebuilds re-clone from
  // these (wraiths wear the warrior rig as a ghost; archers get the
  // crossbow clip set and fire into the shared bolt pool).
  const [warriorTemplate, archerTemplate] = await Promise.all([
    loadSkeleton(await kitPieceUrl('skeleton-warrior')),
    loadSkeleton(await kitPieceUrl('skeleton-archer')),
  ]);

  // Ash-Priest mesh (Task 13): the statue-knight kit piece, cloned + retextured
  // ashen per instance. Loaded once here; ZoneBuilder shares the same cached
  // template, so this adds no extra download.
  const priestTemplate = (await loadKitPieces(['statue-knight'])).get('statue-knight');

  // --- banner visions + the kneel ritual (Task 14) -------------------------
  // Kneeling at a banner rekindles + checkpoints AND, on the first kneel per
  // banner, plays that banner's memory: colour bleeds back over spectral
  // courtiers/knights, then snaps to ash. Ghosts are clones of kit pieces made
  // additive + transparent (opacity 0.35) and billboarded to the camera; they
  // are torn down when the memory ends. The VisionPlayer owns desaturation +
  // fog while it runs (the Brand does not tick outside 'playing').
  const GHOST_OPACITY = 0.35;
  const visionGhosts: THREE.Object3D[] = [];
  /** Fog far-plane a vision requests; used in place of the vista/base fog while
   *  the memory plays. */
  let visionFogFar = DEFAULT_FOG_FAR;

  function ghostTemplate(piece: GhostSprite['piece']): THREE.Object3D {
    if (piece === 'skeleton-warrior') return cloneSkinned(warriorTemplate.scene);
    if (piece === 'skeleton-archer') return cloneSkinned(archerTemplate.scene);
    return priestTemplate.clone(true); // 'statue-knight' (default): robed silhouette
  }

  function buildGhosts(ghosts: GhostSprite[]): void {
    for (const g of ghosts) {
      const root = ghostTemplate(g.piece);
      root.scale.setScalar(ENEMY_SCALE);
      const [row, col] = g.at;
      // Ground the ghost on the terrain like every other view-y consumer
      // (enemies/priests/camera) — a hardcoded y=0 buries banner-vision ghosts
      // 1.5–3 m inside Pilgrim's Descent's raised terraces.
      root.position.set(
        (col + 0.5) * built.cellM,
        built.groundYAt((col + 0.5) * built.cellM, (row + 0.5) * built.cellM),
        (row + 0.5) * built.cellM,
      );
      root.rotation.y = g.rotY ?? 0;
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false; // skinned bounds don't follow the bones
        const src = mesh.material as THREE.Material | THREE.Material[];
        const mat = (Array.isArray(src) ? src[0] : src).clone() as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = GHOST_OPACITY;
        mat.depthWrite = false; // a memory, never occludes the present
        mat.blending = THREE.AdditiveBlending; // glowing — the past, alive
        mat.color.setHex(0xffe6b0); // warm ember-gold shade
        if (mat.emissive) mat.emissive.setHex(0x3a2a12);
        mesh.material = mat;
      });
      scene.add(root);
      visionGhosts.push(root);
    }
  }

  function clearGhosts(): void {
    for (const g of visionGhosts) {
      scene.remove(g);
      g.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) (mesh.material as THREE.Material).dispose();
      });
    }
    visionGhosts.length = 0;
  }

  /** Billboard the raised ghosts to face the camera each frame of a vision. */
  function faceGhostsToCamera(): void {
    for (const g of visionGhosts) {
      g.rotation.y = Math.atan2(
        camera.position.x - g.position.x,
        camera.position.z - g.position.z,
      );
    }
  }

  const visionPlayer = new VisionPlayer({
    game,
    setDesaturation: (v) => pipeline.setDesaturation(v),
    setFogFar: (m) => {
      visionFogFar = m;
    },
    spawnGhosts: (ghosts) => buildGhosts(ghosts),
    clearGhosts: () => clearGhosts(),
    showCaption: (t) => showVisionCaption(t),
    onPlayed: (id) => game.bus.emit({ type: 'vision-played', visionId: id }),
    seenIds: save?.visionsSeen ?? [],
  });

  const kneel = new KneelRitual({
    game,
    brand,
    visionPlayer,
    emitCue: (id) => game.bus.emit({ type: 'cue', id }),
    respawnEnemies: () => {
      // Bonfire rule: tear the roster down and rebuild it fresh — never a bare
      // clear. A fight in progress resets to spawn and re-aggros naturally.
      clearEnemies();
      resetBolts();
      spawnEnemies();
    },
  });

  // Bolt views: one small unlit quarrel per pooled projectile, lazily grown
  // (the pool itself recycles — steady-state combat allocates nothing).
  const boltGeo = new THREE.BoxGeometry(0.07, 0.07, 0.55);
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xe8d8b0 });
  const boltMeshes: THREE.Mesh[] = [];
  /** Prior active-state per pooled bolt, so a fresh shot (inactive→active) fires
   *  the positional bow twang once, at the firing archer (Task 17). */
  const boltWasActive: boolean[] = [];
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
        // Rising edge = a bolt just launched → a bow twang at its spawn (the
        // archer), 3-D panned and wall-occluded via AudioManager.positional.
        if (!boltWasActive[i]) audio.positional(mesh, 'bow');
      }
      boltWasActive[i] = bolt.active;
    });
  }

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

  // The Forsworn's fall (Task 15): set 'forsworn-dead' for good (the summit
  // stair unseals), and — if the player never once guarded — drop Callun's
  // broken tachi where he fell. The arena gate opens on the next frame
  // (BossArena reads the flag as 'death-open').
  game.bus.on('enemy-slain', (e) => {
    if (e.kind !== 'forsworn' || !activeForsworn) return;
    flags.add('forsworn-dead');
    if (activeForsworn.guardedNever) {
      flags.add('callun-tachi');
      dropTachi(activeForsworn.pos);
    }
    // Persist AFTER both flags are set so the kill-time save captures the
    // no-guard tachi reward too (it no longer rides the next save).
    persistProgress();
    rebuildInteractables();
  });

  // Gatekey glint: one shared emissive shape sits on each un-taken item's
  // pedestal (removed when the item is taken). Life-size-ish, ~waist height.
  const keyGeo = new THREE.BoxGeometry(0.14, 0.42, 0.14);
  const keyMat = new THREE.MeshBasicMaterial({ color: 0xffcf6a });

  // Per-swing hit bookkeeping + a reusable enemy context (no per-frame
  // allocs). `collider` is re-pointed at each new zone by enterZone().
  let lastSwing = 0;
  const hitThisSwing = new Set<Enemy>();
  const enemyCtx: EnemyCtx = {
    playerPos: controller.pos,
    playerHollow: false,
    collider: built.collider,
    canSeePlayer: false,
  };

  // --- zone-scoped state rebuild (Task 11 handoff obligation) -------------
  // Everything below is torn down and rebuilt on EVERY zone entry: enemy
  // logic+views (views disposed), the projectile pool + its meshes, wisps,
  // interactables, door trigger cells, and the enemyCtx collider.

  /** Door-span trigger cells of the current zone, "row,col" → placed door. */
  let doorCells = new Map<string, PlacedDoor>();

  // --- Decorated-door panels (world-expansion v1.2, Task 1) ----------------
  // ONE shared geometry + material for every door panel game-wide (instanced
  // per door → a couple of draw calls at most, well inside the ≤100/zone cap).
  // Textured through the PS1 pipeline (`rock`, crunched); flat colour in tests
  // where getTexture is undefined. Never disposed (shared for the session).
  const doorPanelGeo = doorPanelGeometry();
  const doorPanelMat = new THREE.MeshStandardMaterial({
    color: 0x3b3b40, // dark iron-in-stone
    map: getTexture('rock') ?? null,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  /** The current zone's door-panel meshes (rebuilt per zone). */
  let doorProps: THREE.Mesh[] = [];

  /** Glint meshes for the current zone's un-taken items, by item id. */
  let itemMeshes: { id: string; mesh: THREE.Mesh }[] = [];

  /** The current zone's kick-open gate leaf (hinged), or null when none / it
   *  is already open. Swings when `opening` is set. */
  let shortcutGate: {
    hinge: THREE.Group;
    leaf: THREE.Mesh;
    material: THREE.Material;
    opening: boolean;
    angle: number;
  } | null = null;

  /** Landing-dip camera offset (m), eased to 0 after the undercroft drop. */
  let fallDip = 0;

  // --- Task 15 zone-scoped state (throne arena + summit finale) ------------
  /** The live Forsworn in the current zone (throne only), or null. */
  let activeForsworn: Forsworn | null = null;
  /** The arena gate state machine (throne only). */
  let bossArena: BossArena | null = null;
  /** The portcullis: a sliding iron leaf + its target y (sealed/open). */
  let bossGate: { mesh: THREE.Mesh; material: THREE.Material; targetY: number } | null = null;
  /** P3 arena blackout, eased 0 (lit) → 1 (near-black). */
  let darkness = 0;
  /** Dark-flame trail quads, grown to match the Forsworn's live trails. */
  const trailMeshes: THREE.Mesh[] = [];
  /** Dropped Callun's-tachi pickup (no-guard reward), or null. */
  let droppedTachi: { position: THREE.Vector3; mesh: THREE.Mesh; taken: boolean } | null = null;

  /** VHAELIS, staged at the summit, or null off the summit. */
  let dragon: Dragon | null = null;
  /** How open the eye is (0..1). Summit only. */
  let eyeOpenT = 0;
  /** The crown offering-flame (mesh + light), or null off the summit. */
  let brazier: { light: THREE.PointLight; flame: THREE.Mesh } | null = null;
  /** The world position of the summit flame (for the eye-wake + GIVE prompt). */
  let flamePos: THREE.Vector3 | null = null;
  /** The running ending sequence, or null when not in an ending. */
  let endingDirector: EndingDirector | null = null;
  /** Which ending is playing (for the credits handoff). */
  let endingId: EndingId | null = null;
  /** Two-press KEEP confirm at the summit stair (walk away = keep the crown). */
  let keepConfirmPending = false;
  /** Ember-rise particles for the OATH KEPT ending (ash-fall reversed). */
  let emberRiseOn = false;
  /** The Queen's Garden's green foliage + fill (T16), or null outside it. */
  let gardenGroup: THREE.Group | null = null;

  /** The Watcher/Hag silhouette views for the current zone — null in castle
   *  (interior) zones, so those zones never render either presence (Task 5). */
  let watcherView: WatcherView | null = null;
  let hagView: HagView | null = null;
  /** AF-1's pure-visual crossing silhouette (finding 4a), or null off an
   *  exterior zone. Zone-scoped like the presence views. */
  let crossingSilhouette: CrossingSilhouette | null = null;
  /** True while the carved bargain is armed at the cairn (digit keys select). */
  let bargainArmed = false;

  function clearEnemies(): void {
    for (const { view } of enemies) {
      scene.remove(view.root);
      view.dispose();
    }
    enemies.length = 0;
    activeForsworn = null;
  }

  // --- Task 15: boss gate, dark-flame trails, the dragon, the brazier ------

  /** Build the throne arena portcullis (closed doorway leaf), starting OPEN
   *  (raised) — it seals when the player crosses in (BossArena). */
  function spawnBossGate(): void {
    if (zones.current !== 'throne') return;
    const [r0, c0] = THRONE_GATE_CELLS[0];
    const [, c1] = THRONE_GATE_CELLS[1];
    const width = (Math.abs(c1 - c0) + 1) * built.cellM;
    const midX = ((c0 + c1) / 2 + 0.5) * built.cellM;
    const z = (r0 + 0.5) * built.cellM;
    const material = new THREE.MeshStandardMaterial({ color: 0x1c1c20, metalness: 0.6, roughness: 0.5 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 2.4, 0.24), material);
    mesh.position.set(midX, GATE_OPEN_Y, z); // starts raised (open)
    scene.add(mesh);
    bossGate = { mesh, material, targetY: GATE_OPEN_Y };
  }

  function clearBossGate(): void {
    if (!bossGate) return;
    scene.remove(bossGate.mesh);
    bossGate.mesh.geometry.dispose();
    bossGate.material.dispose();
    bossGate = null;
  }

  /** Seal or open the portcullis: slide target + toggle the doorway collision. */
  function setGateSealed(sealed: boolean): void {
    if (bossGate) bossGate.targetY = sealed ? GATE_SEALED_Y : GATE_OPEN_Y;
    for (const [r, c] of THRONE_GATE_CELLS) built.collider.setSolid(r, c, sealed);
  }

  const trailGeo = new THREE.CircleGeometry(TUNING.enemies.forsworn.trail.radiusM, 12);
  const trailMat = new THREE.MeshBasicMaterial({
    color: 0x6a1e12,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });

  /** Grow/shrink the trail quads to match the Forsworn's live trails, laid flat
   *  on the floor and fading with their remaining life. */
  function syncTrails(): void {
    const trails = activeForsworn?.trails ?? [];
    while (trailMeshes.length < trails.length) {
      const mesh = new THREE.Mesh(trailGeo, trailMat.clone());
      mesh.rotation.x = -Math.PI / 2; // flat on the floor
      scene.add(mesh);
      trailMeshes.push(mesh);
    }
    trailMeshes.forEach((mesh, i) => {
      const tr = trails[i];
      if (tr) {
        mesh.visible = true;
        mesh.position.set(tr.x, 0.06, tr.z);
        (mesh.material as THREE.MeshBasicMaterial).opacity =
          0.7 * Math.min(1, tr.ttl / TUNING.enemies.forsworn.trail.lifetimeMs);
      } else {
        mesh.visible = false;
      }
    });
  }

  function clearTrailMeshes(): void {
    for (const m of trailMeshes) {
      scene.remove(m);
      (m.material as THREE.Material).dispose();
    }
    trailMeshes.length = 0;
  }

  const tachiGlintGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
  const tachiGlintMat = new THREE.MeshBasicMaterial({ color: 0xd8b878 });

  /** Drop Callun's broken tachi where the Forsworn fell (no-guard reward). */
  function dropTachi(at: THREE.Vector3): void {
    const mesh = new THREE.Mesh(tachiGlintGeo, tachiGlintMat);
    mesh.position.set(at.x, 0.6, at.z);
    mesh.rotation.z = 0.5;
    scene.add(mesh);
    droppedTachi = { position: mesh.position.clone(), mesh, taken: false };
  }

  function clearDroppedTachi(): void {
    if (droppedTachi) scene.remove(droppedTachi.mesh);
    droppedTachi = null;
  }

  /** Stage VHAELIS at the north of the summit, looming over the wall in fog. */
  function spawnDragon(): void {
    if (zones.current !== 'summit') return;
    dragon = buildDragon();
    // Centre on the room, behind the north wall (z ≈ 0), looming up.
    dragon.group.position.set((4.5) * built.cellM, 0, -0.5);
    scene.add(dragon.group);
    eyeOpenT = 0;
    dragon.setEyeOpen(0);
  }

  function clearDragon(): void {
    if (!dragon) return;
    scene.remove(dragon.group);
    disposeDragon(dragon.group);
    dragon = null;
  }

  /** The crown offering-flame: a bright emissive mote + a warm point light. On
   *  a Second Vigil it already burns cold blue (the summit-blue-flame anomaly). */
  function spawnBrazier(): void {
    if (zones.current !== 'summit') return;
    const [row, col] = SUMMIT_FLAME_CELL;
    const x = (col + 0.5) * built.cellM;
    const z = (row + 0.5) * built.cellM;
    flamePos = new THREE.Vector3(x, 0, z);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: ngPlus ? 0x6aa8ff : 0xffd27a }),
    );
    flame.position.set(x, 1.0, z);
    const light = new THREE.PointLight(ngPlus ? 0x4f8cff : 0xffb050, 6, 9);
    light.position.set(x, 1.3, z);
    scene.add(flame, light);
    brazier = { light, flame };
  }

  /** The Queen's Garden's green-in-ash palette (T16): primitive foliage and a
   *  soft green fill over the grey kit stone. The zone AmbientLight is tinted
   *  green in enterZone; this stages the living detail. */
  function spawnGarden(): void {
    if (zones.current !== 'queens-garden') return;
    const g = new THREE.Group();
    const leaf = new THREE.MeshStandardMaterial({
      color: 0x3f7a3a,
      emissive: 0x123a12,
      roughness: 0.9,
      metalness: 0,
    });
    // Low hedges lining the lawn, and a taller shrub in each far corner —
    // rounded boxes are plenty at PS1 fidelity.
    const hedge = (row: number, col: number, h: number): void => {
      const x = (col + 0.5) * built.cellM;
      const z = (row + 0.5) * built.cellM;
      const bush = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), leaf);
      bush.position.set(x, h / 2, z);
      g.add(bush);
    };
    hedge(1, 1, 0.9);
    hedge(1, 10, 0.9);
    hedge(8, 1, 0.9);
    hedge(8, 10, 0.9);
    hedge(4, 2, 1.6);
    hedge(6, 9, 1.6);
    // A soft green fill so the whole lawn reads living, not merely lit.
    const fill = new THREE.PointLight(0x86c878, 5, 22);
    fill.position.set(6 * built.cellM, 4.5, 5 * built.cellM);
    fill.castShadow = false;
    g.add(fill);
    scene.add(g);
    gardenGroup = g;
  }

  function clearGarden(): void {
    if (!gardenGroup) return;
    scene.remove(gardenGroup);
    gardenGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    gardenGroup = null;
  }

  function clearBrazier(): void {
    if (!brazier) return;
    scene.remove(brazier.flame, brazier.light);
    brazier.flame.geometry.dispose();
    (brazier.flame.material as THREE.Material).dispose();
    brazier.light.dispose();
    brazier = null;
    flamePos = null;
  }

  /** Ease `cur` toward `target` by at most `maxStep`. */
  function approach(cur: number, target: number, maxStep: number): number {
    const d = target - cur;
    return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
  }

  // --- the OATH KEPT rising embers (ash-fall reversed) ----------------------
  let emberField: THREE.Points | null = null;
  let emberPos: Float32Array | null = null;
  function updateEmberRise(dt: number): void {
    if (!emberField) {
      const N = 120;
      emberPos = new Float32Array(N * 3);
      const c = controller.pos;
      for (let i = 0; i < N; i++) {
        // A ring 1.8–7m out — never right on the camera (a too-close point
        // blows up into a huge quad at the PS1 render resolution).
        const a = Math.random() * Math.PI * 2;
        const r = 1.8 + Math.random() * 5.2;
        emberPos[i * 3] = c.x + Math.cos(a) * r;
        emberPos[i * 3 + 1] = Math.random() * 5;
        emberPos[i * 3 + 2] = c.z + Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
      emberField = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: 0xffb45a, size: 0.06, transparent: true, opacity: 0.9 }),
      );
      scene.add(emberField);
    }
    const rise = (dt / 1000) * 1.3;
    for (let i = 0; i < emberPos!.length; i += 3) {
      emberPos![i + 1] += rise;
      if (emberPos![i + 1] > 6) emberPos![i + 1] = 0; // wrap: a steady rising column
    }
    (emberField.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
  function clearEmberField(): void {
    if (!emberField) return;
    scene.remove(emberField);
    emberField.geometry.dispose();
    (emberField.material as THREE.Material).dispose();
    emberField = null;
    emberPos = null;
  }

  // --- the ending sequence orchestration ------------------------------------
  const endingEffects = {
    setDesaturation: (v: number) => pipeline.setDesaturation(v),
    setBlackout: (a: number) => setBlackout(a),
    setEmberRise: (on: boolean) => {
      emberRiseOn = on;
      if (!on) clearEmberField();
    },
    showCard: (title: string, subtitle: string) => showTitleCard(title, subtitle),
    speakVhaelis: (line: string | null) => showVisionCaption(line),
    cue: (id: string) => game.bus.emit({ type: 'cue', id }),
  };

  /** Begin an ending: freeze the sim ('ending' state) and start its sequence. */
  function beginEnding(ending: EndingId): void {
    if (endingId) return; // already resolving
    endingId = ending;
    keepConfirmPending = false;
    hidePrompt();
    if (game.state === 'playing') game.transition('ending');
    endingDirector = new EndingDirector(endingEffects);
    endingDirector.begin(ending, pipeline.getDesaturation());
    rebuildInteractables(); // the GIVE prompt is gone now
  }

  /** GIVE THE CROWN at the flame → OATH KEPT (or the secret ending). */
  function resolveGive(): void {
    beginEnding(
      selectEnding({
        hollow: brand.hollow,
        choice: 'give',
        hasQueensBrand: flags.has('queens-brand'),
      }),
    );
  }

  /** Two-press KEEP confirm at the stair: first press asks, second commits. */
  function handleKeepPress(): void {
    if (!keepConfirmPending) {
      keepConfirmPending = true;
      showCard('KEEP THE CROWN — LEAVE?   press E again');
      return;
    }
    beginEnding(
      selectEnding({
        hollow: brand.hollow,
        choice: 'keep',
        hasQueensBrand: flags.has('queens-brand'),
      }),
    );
  }

  /** Merge the reached ending into the save's endingsSeen (T18 renders it). */
  function persistEnding(ending: EndingId): void {
    // Beating the castle opens the Greater Vael postern (Task 9) — set it live so
    // a same-session return to the Ashen Gate finds it unsealed, and persist it
    // (it rides `flags` below, and load-time derivation catches it thereafter).
    flags.add('greater-vael-open');
    const prev = loadGame();
    const base: SaveData = prev ?? {
      // Task 13 (T7): the no-prior-save fallback writes the canonical v2 shape too.
      version: 2,
      zone: zones.current,
      bannerId: '',
      embers: brand.embers,
      flags: [...flags],
      endingsSeen: [],
      loreRead: [...loreRead],
      visionsSeen: [...new Set([...vista.seenIds, ...visionPlayer.seenIds])],
      ngPlus,
    };
    const endingsSeen = [...new Set([...(base.endingsSeen ?? []), ending])];
    saveGame({
      ...base,
      // Task 13 (T7): normalise a migrated-in prev to v2 and mirror the now-open
      // postern into save.greaterVael.open (the ending just unsealed it).
      version: 2,
      zone: zones.current,
      endingsSeen,
      flags: [...flags],
      ngPlus,
      greaterVael: greaterVaelCheckpoint({
        open: flags.has('greater-vael-open'),
        ...dread.snapshot(),
        maxEmberCap: emberCap,
        bargains: hagBargains,
      }),
      doorsOpened: [...doorsOpened], // world-expansion v1.2 (Task 1)
    });
  }

  /** Hand the finished ending off to the credits, then the restart card. */
  function finishEndingToCredits(ending: EndingId): void {
    game.bus.emit({ type: 'ending-reached', ending });
    persistEnding(ending);
    hideTitleCard();
    showVisionCaption(null);
    clearEmberField();
    emberRiseOn = false;
    rollCredits(ending, () => {
      showVigilContinues(() => {
        // KEEP THE VIGIL AGAIN → the Second Vigil (T16). The castle re-seals
        // (every flag reset) but the knowledge carries (endings/lore/visions),
        // ng-plus is set, and the brand is full — see secondVigilSave. A THIRD
        // Vigil is identical to the second (ngPlus stays true). startSecondVigil
        // writes it + the autostart marker and reloads clean, so the new run
        // begins in play at the Ashen Gate (not back at the title).
        startSecondVigil();
      });
    });
  }

  function clearWisps(): void {
    for (const w of wisps) {
      scene.remove(w.mesh);
      w.material.dispose();
    }
    wisps.length = 0;
  }

  function resetBolts(): void {
    for (const mesh of boltMeshes) scene.remove(mesh);
    boltMeshes.length = 0; // geometry/material are shared and live on
    bolts = new ProjectilePool({ bus: game.bus, defense: combat });
  }

  function clearItemMeshes(): void {
    for (const it of itemMeshes) scene.remove(it.mesh); // geo/mat are shared
    itemMeshes = [];
  }

  function clearGate(): void {
    if (!shortcutGate) return;
    scene.remove(shortcutGate.hinge);
    shortcutGate.leaf.geometry.dispose();
    shortcutGate.material.dispose();
    shortcutGate = null;
  }

  /** Drop the current zone's door panels (geometry/material are shared → kept). */
  function clearDoorProps(): void {
    for (const m of doorProps) scene.remove(m);
    doorProps = [];
  }

  /**
   * Place an iron door panel on every decorated gate cell (Task 1), oriented
   * with its wall-door frame, and SOLIDIFY the cell so the panel collides —
   * a decorated gate is a closed door you must OPEN, not a walk-through border.
   * No-op when the zone decorates no gate (every v1 zone → byte-identical).
   */
  function spawnDoorProps(decoratedGates: ReadonlySet<string>): void {
    for (const p of doorPropPlacements(activeDef, decoratedGates)) {
      const mesh = new THREE.Mesh(doorPanelGeo, doorPanelMat);
      mesh.position.set(p.x, built.groundYAt(p.x, p.z), p.z);
      mesh.rotation.y = p.rotY;
      scene.add(mesh);
      doorProps.push(mesh);
      built.collider.setSolid(p.row, p.col, true); // the panel blocks the cell
    }
  }

  /** The current zone's Ash-Priests (Task 13) — static SPEAK-able NPCs,
   *  rebuilt per zone exactly like enemies. */
  let ashPriests: AshPriest[] = [];

  function clearAshPriests(): void {
    for (const p of ashPriests) {
      scene.remove(p.root);
      p.dispose();
    }
    ashPriests = [];
  }

  function spawnAshPriests(): void {
    for (const placement of ashPriestsIn(zones.current)) {
      const priest = new AshPriest(priestTemplate, placement, built.cellM);
      // Exterior height layer (Task 12): ground the static priest on his terrace
      // — the Pilgrim's Descent stands him on band-1 floor. He never moves, so a
      // one-time set holds; flat/interior zones read 0 (v1-exact).
      priest.root.position.y = built.groundYAt((placement.at[1] + 0.5) * built.cellM, (placement.at[0] + 0.5) * built.cellM);
      scene.add(priest.root);
      ashPriests.push(priest);
    }
  }

  // --- Task 5: the presence views + the Hag's carved bargain ---------------

  function clearPresenceViews(): void {
    if (watcherView) {
      scene.remove(watcherView.root);
      watcherView.dispose();
      watcherView = null;
    }
    if (hagView) {
      scene.remove(hagView.root);
      hagView.dispose();
      hagView = null;
    }
    if (crossingSilhouette) {
      scene.remove(crossingSilhouette.root);
      crossingSilhouette.dispose();
      crossingSilhouette = null;
    }
    // A zone change ends any manifest/glimpse in progress: the views are zone-
    // scoped, so a stale presence would otherwise pop straight back in on the
    // next exterior entry, unpaid-for by any DreadDirector activation.
    watcherPresence.dismiss();
    watcherPresence.setAnchors([]); // drop this zone's anchors until the next entry re-scopes
    hagPresence = null;
  }

  /** Build the Watcher/Hag silhouettes for an EXTERIOR zone only (castle zones
   *  get no view, so they can never see either — a binding rule). The Hag is
   *  zone-scoped: built from THIS zone's `hagThreshold` + cell size, so her
   *  silhouette, `atThreshold`, and the OFFER prompt always agree. */
  function spawnPresenceViews(): void {
    if (activeDef.kind !== 'exterior') return;
    // Re-scope the run-scoped Watcher to THIS zone's anchors (T5 review): the
    // director picks its manifest anchor by beat.zone, and the presence may only
    // reposition among the active zone's anchors — never another zone's.
    watcherPresence.setAnchors(activeDef.watcherAnchors ?? []);
    watcherView = new WatcherView(watcherPresence);
    scene.add(watcherView.root);
    // AF-1's crossing silhouette (finding 4a) — one per exterior zone, armed by
    // routeScare when a pure-visual beat carries a `crossing`. Idle + invisible
    // until then; a zone with no such beat simply never arms it.
    crossingSilhouette = new CrossingSilhouette();
    scene.add(crossingSilhouette.root);
    if (activeDef.hagThreshold) {
      hagPresence = new HagPresence(activeDef.hagThreshold, built.cellM);
      hagView = new HagView(hagPresence);
      scene.add(hagView.root);
    }
  }

  /** Persist the dread ledger + the Hag slice into an EXISTING save (banks at
   *  the next kneel too; with no checkpoint yet the in-memory cap/flags gate the
   *  run). Uses the LIVE dread.snapshot() — never the save's stale ledger, or a
   *  bargain-time write would roll back sightings/glitches accrued since the
   *  last kneel (and re-open the Watcher budget on reload). No-op with no save. */
  function persistGreaterVael(): void {
    const prev = loadGame();
    if (!prev) return;
    saveGame({
      ...prev,
      flags: [...flags],
      // Bank any vista/vision one-shots fired this drop (Task 8: the Hag ledger
      // vision banks HERE, not at a kneel — the bargain has no checkpoint), so a
      // reload never replays them. `vista-*`/`vision-*` namespacing avoids clash.
      visionsSeen: [
        ...new Set([...(prev.visionsSeen ?? []), ...vista.seenIds, ...visionPlayer.seenIds]),
      ],
      // Task 13 (T7): mirror the live postern flag into `open` here too, so a
      // bargain-time write keeps the block authoritative.
      greaterVael: greaterVaelCheckpoint({
        open: flags.has('greater-vael-open'),
        ...dread.snapshot(),
        maxEmberCap: emberCap,
        bargains: hagBargains,
      }),
    });
  }

  /** Route a bargain boon to the world (the pure result carries which). Every
   *  line is a CARVED inscription — she never speaks. */
  function applyHagBoon(boon: Boon): void {
    switch (boon.kind) {
      case 'fogline-part':
        // Ashen Forest N fogFar +FOGLINE_PART_M for the visit (its lore cache
        // unseals with the zone, Tasks 9–12). Armed now; enterZone applies it on
        // entry, and immediately if already standing there. Task 10 stacking guard:
        // RECOMPUTE baseFogFar from the un-boosted zone base (never `+=`) so a
        // repeat in-zone tithe — reachable here, where the threshold lives — can't
        // stack the bump to +12. Re-entry is idempotent for the same reason.
        forestFogBoost = FOGLINE_PART_M;
        baseFogFar = zoneVisitFogFarM({
          zone: zones.current,
          zoneBaseFarM: zoneBaseFogFar,
          forestBoostM: forestFogBoost,
        });
        showCard('The fog-line parts. North, the ash thins — and a sealed cache gives up its word.');
        break;
      case 'play-vision':
        // Task 8: surrendering the ledger replays its tithe as a banner-style
        // memory — colour bleeds back, then snaps to ash (GV_VISION_HAG). It is
        // a one-shot (visionsSeen); if already seen, fall back to the carved line.
        if (!visionPlayer.play(GV_VISION_HAG)) {
          showCard('She takes the ledger. For a breath the world remembers its colour.');
        }
        break;
      case 'answer-watcher':
        watcherAnswered = true; // the next glimpse is "answered" (Drop-3 seed)
        showCard('She kneels beside you. The next time the tall thing is seen, it is — answered.');
        break;
      case 'none':
        showCard('She turns away. The threshold keeps, for a later visit.');
        break;
    }
  }

  /** Whether the ember tithe is offerable NOW: she never caps the brand below
   *  one ember, and "place 1 LIVE ember" needs a spare lit ember to place —
   *  she does not take your last (a tithe must never hollow the knight). */
  function canTithe(): boolean {
    return emberCap > MIN_EMBER_CAP && brand.embers >= 2 && !brand.hollow;
  }

  /** Apply an offering at the cairn: the pure bargain, then its world effects —
   *  set flags, lower/keep the ember cap, place the live ember, surrender the
   *  ledger, grant the boon, persist. Exposed on the dev handle for QA. */
  function applyHagOffer(offering: Offering): void {
    // Gate the tithe HERE (the pure table stays exactly §6.4): un-offerable
    // when the cap is already at its floor or no spare live ember remains.
    if (offering === 'ember' && !canTithe()) {
      showCard('Carved beneath: she will not take the last of a brand.');
      return;
    }
    const state: HagState = { maxEmberCap: emberCap, bargains: [...hagBargains] };
    const result = offerToHag(offering, state, flags.has('tithe-ledger'));
    emberCap = result.state.maxEmberCap;
    hagBargains = result.state.bargains;
    for (const f of result.flagsSet) flags.add(f);
    // "Place 1 live ember": the tithed ember leaves the brand NOW (the cap drop
    // makes it persist past the next rekindle) — the cost is visible at once.
    if (result.flagsSet.includes('hag-tithed')) brand.damage(1);
    // The ledger leaves the pack once given (its inscription already read).
    if (result.flagsSet.includes('hag-ledger-given')) flags.delete('tithe-ledger');
    applyHagBoon(result.boon);
    persistGreaterVael();
    rebuildInteractables();
  }

  /** Arm the carved bargain at the cairn: show the silent options; digit keys
   *  (1 tithe / 2 give-ledger / 3 kneel / 4 turn away) select. Rows that are
   *  un-offerable right now (no ledger, no spare ember) are simply not carved. */
  function openHagBargain(): void {
    bargainArmed = true;
    const tithe = canTithe() ? '  [1] TITHE AN EMBER' : '';
    const ledger = flags.has('tithe-ledger') ? '  [2] GIVE LEDGER' : '';
    showCard(
      `Carved at the cairn — she does not speak.${tithe}${ledger}  [3] KNEEL  [4] TURN AWAY`,
    );
  }

  /** Place a glint on each un-taken item's pedestal (skip taken ones). */
  function spawnItemMeshes(): void {
    for (const item of built.items) {
      if (flags.has(item.spot.flag)) continue;
      const mesh = new THREE.Mesh(keyGeo, keyMat);
      mesh.position.set(item.position.x, 1.3, item.position.z);
      scene.add(mesh);
      itemMeshes.push({ id: item.spot.id, mesh });
    }
  }

  /** Build the closed gate leaf for a `kick` door, unless it is already open.
   *  The leaf spans the doorway; kicking it swings the hinge (spawnGate is
   *  followed by an in-frame ease). */
  function spawnGate(): void {
    const kickDoor = built.doors.find((d) => d.def.kick);
    if (!kickDoor || kickDoor.def.lock === undefined) return;
    if (flags.has(lockFlag(kickDoor.def.lock))) return; // already open
    const hinge = new THREE.Group();
    hinge.position.set(kickDoor.position.x - built.cellM / 2, 0, kickDoor.position.z);
    const material = new THREE.MeshStandardMaterial({
      color: 0x26262b,
      metalness: 0.55,
      roughness: 0.5,
    });
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(built.cellM, 2.2, 0.16), material);
    leaf.position.set(built.cellM / 2, 1.1, 0); // pivot on the hinge edge
    hinge.add(leaf);
    scene.add(hinge);
    shortcutGate = { hinge, leaf, material, opening: false, angle: 0 };
  }

  /** Merge progression flags into an existing save the moment they change
   *  (gatekey taken / gate kicked). With no checkpoint yet nothing is written
   *  — the in-memory flag set still gates the whole run; the flags bank at the
   *  next kneel. */
  function persistProgress(): void {
    const prev = loadGame();
    if (!prev) return;
    saveGame({
      ...prev,
      zone: zones.current,
      flags: [...flags],
      ngPlus,
      doorsOpened: [...doorsOpened], // far-side doors unbarred this run (Task 1)
    });
  }

  function spawnEnemies(): void {
    const soldierAttack = TUNING.enemies.soldier.attack;
    const lunge = TUNING.enemies.wraith.lunge;
    // P1: re-deal the common roster onto plain-floor neighbours each wave so a
    // retry never replays the memorized layout. Scatter the BUILT roster, not
    // `activeDef.enemies`: in NG+ the Second Vigil's remixed enemies live on the
    // built def (built.spawns), while `activeDef` stays the base def — its
    // grid/tiles are identical (never varied in NG+), so borrow those and swap in
    // the built enemies as scatter's owning def.
    const spawns = scatterSpawns({ ...activeDef, enemies: built.spawns }, nextScatterRng());
    spawns.forEach((spawn, i) => {
      // The Forsworn stays dead once felled (flag 'forsworn-dead') — re-entering
      // the throne must not raise a fresh boss in a room already won. The mercy
      // reset (rekindle mid-fight) happens while he still lives, so it is unaffected.
      if (spawn.kind === 'forsworn' && flags.has('forsworn-dead')) return;
      const id = `${zones.current}-${spawn.kind}-${i}`;
      let logic: Enemy;
      let view: EntityView;
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
      } else if (spawn.kind === 'forsworn') {
        // The boss stays down for good: 'forsworn-dead' is permanent, so he
        // never respawns — not on re-entry, not on the bonfire rule.
        if (flags.has('forsworn-dead')) return;
        const forswornAttack = TUNING.enemies.forsworn.attack;
        const forsworn = new Forsworn({ id, bus: game.bus, defense: combat });
        // A touch larger than a soldier — the first knight still stands taller.
        view = new ForswornView(
          forsworn,
          warriorTemplate,
          ENEMY_SCALE * 1.2,
          forswornAttack.windupMs + forswornAttack.activeMs,
        );
        logic = forsworn;
        activeForsworn = forsworn;
      } else if (spawn.kind === 'hound') {
        // Ash-Hound (Greater Vael): the circler. `pantCue` is a footfall/pant
        // one-shot that does NOT scale with the brand pulse (spec §9). Task 6
        // wires the exterior positional voice: it plays at the hound's mesh,
        // panned + wall-muffled as the thing orbits the fog edge — the hound you
        // HEAR circling, distinct from the brand you feel.
        const hound = new AshHound({
          id,
          bus: game.bus,
          defense: combat,
          rng: houndRng,
          pantCue: () => audio.positional(houndView.root, 'pant'),
        });
        const houndView = new HoundView(hound);
        view = houndView;
        logic = hound;
      } else if (spawn.kind === 'kneeler') {
        // Kneeling Hollow (Greater Vael): dormant until the brand pulses. The
        // scare beat (Tasks 5–12) will call `wake()`; `creakCue` fires the low
        // bone-creak voice (Task 6) on the rise.
        const kneeler = new KneelingHollow({
          id,
          bus: game.bus,
          defense: combat,
          pulse: () => brand.pulse,
          creakCue: () => game.bus.emit({ type: 'cue', id: 'bone-creak' }),
        });
        view = new KneelerView(kneeler);
        logic = kneeler;
      } else {
        // 'soldier'.
        const soldier = new Soldier({ id, bus: game.bus, defense: combat });
        view = new EnemyView(
          soldier,
          warriorTemplate,
          ENEMY_SCALE,
          soldierAttack.windupMs + soldierAttack.activeMs,
        );
        logic = soldier;
      }
      // Spawn placement uses the BUILT zone's cell size (T9 review). The 2D
      // collider is authoritative for movement (pos.y stays 0); the VIEW's y is
      // grounded on the terrain — seed `groundY` at the spawn cell so a raised
      // spawn starts grounded (no pop-up on the first frame), then it eases.
      const [row, col] = spawn.at;
      logic.pos.set((col + 0.5) * built.cellM, 0, (row + 0.5) * built.cellM);
      scene.add(view.root);
      enemies.push({ logic, view, groundY: built.groundYAt((col + 0.5) * built.cellM, (row + 0.5) * built.cellM) });
    });
  }

  /** collectInteractables plus the Task-15 dynamic targets: the dropped tachi
   *  and the summit's GIVE-THE-CROWN flame. */
  function rebuildInteractables(): void {
    interactables = collectInteractables(
      built,
      flags,
      ashPriests,
      (defId) => doorInstancesByDefId.get(defId)?.label,
    );
    // Task 5: the Hag's cairn — a threshold OFFER target (silent bargain). The
    // presence tick decides whether she is glimpsed/present; the target itself
    // is always at the authored cell so the player can reach the bargain.
    if (activeDef.hagThreshold) {
      const [hr, hc] = activeDef.hagThreshold.at;
      interactables.push({
        id: 'hag-threshold',
        verb: 'OFFER',
        x: (hc + 0.5) * built.cellM,
        z: (hr + 0.5) * built.cellM,
        label: 'THE FOG-LINE',
      });
    }
    if (droppedTachi && !droppedTachi.taken) {
      interactables.push({
        id: 'callun-tachi',
        verb: 'TAKE',
        x: droppedTachi.position.x,
        z: droppedTachi.position.z,
        label: "CALLUN'S TACHI",
      });
    }
    // The offering: only while lit and not already resolving an ending.
    if (zones.current === 'summit' && flamePos && !brand.hollow && !endingId) {
      interactables.push({
        id: 'summit-flame',
        verb: 'GIVE',
        x: flamePos.x,
        z: flamePos.z,
        label: 'THE CROWN',
      });
    }
  }

  /** Bind all zone-scoped state to the freshly built `built`/`zones.current`. */
  function enterZone(): void {
    activeDef = resolveZone(zones.current);
    // Exterior zones (Greater Vael) fog into their sky and default to the tuned
    // 16 m dread range; interiors keep the v1 stone-grey haze byte-for-byte.
    const isExterior = activeDef.kind === 'exterior';
    const skyHex = isExterior ? skyFogColor(activeDef.exteriorSky ?? 'field') : INTERIOR_FOG_HEX;
    fog.color.setHex(skyHex);
    (scene.background as THREE.Color).setHex(skyHex);
    zoneBaseFogFar =
      activeDef.fogFarM ?? (isExterior ? TUNING.greaterVael.exterior.fogFarDefaultM : DEFAULT_FOG_FAR);
    // Task 5: an ember tithe parts the fog-line — Ashen Forest N's far-plane opens
    // +FOGLINE_PART_M for the visit (armed by the `fogline-part` boon). Task 10:
    // RECOMPUTE from the un-boosted zone base each visit (never accumulate), so
    // re-entry with the boost still armed re-derives base+6 rather than stacking.
    baseFogFar = zoneVisitFogFarM({
      zone: zones.current,
      zoneBaseFarM: zoneBaseFogFar,
      forestBoostM: forestFogBoost,
    });
    fog.far = baseFogFar;
    // Realism pass (Task 1): resolve this zone's ambient + moon key + hemisphere
    // fill and rebind the three shared lights. Exteriors orient the key from the
    // built moon direction; interiors use a faint fixed cool wash. moonBaseIntensity
    // banks the zone's base key level (the Forsworn P3 blackout restores it, Task 2).
    const lit = resolveZoneLighting(activeDef);
    ambient.intensity = lit.ambient;
    moonLight.color.setHex(lit.key.color);
    moonBaseIntensity = lit.key.intensity;
    moonLight.intensity = moonBaseIntensity;
    const keyDir = built.moonDir ?? INTERIOR_KEY_DIR;
    moonLight.position.copy(keyDir).multiplyScalar(50);
    moonLight.target.position.set(0, 0, 0);
    hemiLight.color.setHex(lit.hemi.sky);
    hemiLight.groundColor.setHex(lit.hemi.ground);
    hemiLight.intensity = lit.hemi.intensity;
    // Snap the visual ground height to the arrival cell so exterior entry does
    // not lerp up from 0 (interior zones are flat → this stays 0).
    groundY = built.groundYAt(controller.pos.x, controller.pos.z);
    // The Queen's Garden alone has colour (T16): a soft green ambient over the
    // ash-grey kit stone, so the whole zone reads living. Every other zone keeps
    // the cold grey. NOT a desaturation override — that channel is the brand's
    // hollowing, and overriding it would grey the garden the moment you were hit.
    const gardenHere = zones.current === 'queens-garden';
    ambient.color.setHex(gardenHere ? 0x6f9c62 : 0x8a8a92);
    if (gardenHere) ambient.intensity = 0.5;
    enemyCtx.collider = built.collider;
    // Walk-in transitions target these cells. A DECORATED gate (Task 1) is
    // excluded — its iron panel collides (below) and it opens only on E, never
    // by walking in — so it never lands in `doorCells`.
    doorCells = new Map();
    const decoratedGates = new Set<string>();
    for (const door of built.doors) {
      if (doorInstancesByDefId.has(door.def.id)) {
        const ch = activeDef.grid[door.def.at[0]]?.[door.def.at[1]];
        if (ch) decoratedGates.add(ch);
        continue; // decorated: opens on OPEN only, panel blocks the cell
      }
      for (const [row, col] of doorSpan(activeDef, door.def)) {
        doorCells.set(`${row},${col}`, door);
      }
    }
    clearDoorProps();
    spawnDoorProps(decoratedGates); // panels + solidified cells (no-op if none)
    clearWisps();
    clearItemMeshes();
    clearGate();
    clearEnemies();
    clearAshPriests();
    clearPresenceViews();
    // Task-15 teardown: nothing from throne/summit survives a zone change.
    clearBossGate();
    clearTrailMeshes();
    clearDroppedTachi();
    clearDragon();
    clearBrazier();
    clearGarden();
    bossArena = null;
    darkness = 0;
    zones.setTorchScale(1);
    resetBolts(); // before spawnEnemies — archers capture the new pool
    spawnEnemies();
    spawnItemMeshes();
    spawnGate();
    spawnAshPriests();
    spawnPresenceViews();
    // The player keeps Callun's tachi across zones once it's been taken.
    if (flags.has('callun-tachi')) combat.equipTachi();
    // Throne: the arena gate starts open; the portcullis seals on entry.
    if (zones.current === 'throne') {
      bossArena = new BossArena();
      spawnBossGate();
    }
    // Summit: stage the dragon + the crown flame; the finale runs from here.
    // A hollow arrival does NOT end instantly — the eye simply never opens,
    // the Ash-Priest still has his last word for a dark brand, and the fade
    // begins only when the hollow knight reaches the flame (per-frame check).
    if (zones.current === 'summit') {
      spawnDragon();
      spawnBrazier();
      endingDirector = null;
      endingId = null;
      keepConfirmPending = false;
      emberRiseOn = false;
    }
    // The Queen's Garden (T16): stage the green foliage + fill (green-in-ash).
    if (gardenHere) spawnGarden();
    // Priests are spawned before collecting so their SPEAK targets are in.
    rebuildInteractables();
  }

  // --- door transitions (Task 11) ------------------------------------------
  // Walking into any cell of a passable door's span (or pressing E on it)
  // loads the destination and places the player one cell inside its PAIRED
  // door (see DoorDef pairing docs in zoneDef.ts), facing into the room —
  // never on a door cell, so arrivals cannot chain-transition.
  let transitioning = false;
  /** Ease the full-screen blackout to `to` (0..1) over `ms`, from wherever it
   *  is now. Reuses the endings' blackout overlay (`ui/credits`). */
  let blackoutAlpha = 0;
  function rampBlackout(to: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const from = blackoutAlpha;
      const start = performance.now();
      const step = (now: number): void => {
        const t = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
        blackoutAlpha = from + (to - from) * t;
        setBlackout(blackoutAlpha);
        if (t >= 1) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // A decorated door (Task 1) passes `edgeToOpen`: it fades through black and
  // records the edge as unbarred-for-good on arrival. A plain gate omits it and
  // transitions instantly (v1 behavior, byte-identical).
  function goThrough(door: PlacedDoor, edgeToOpen?: string): void {
    if (transitioning) return;
    transitioning = true; // freezes simulation until the new zone is live
    hidePrompt();
    const fade = edgeToOpen !== undefined;
    const from = zones.current;
    game.bus.emit({ type: 'door-opened', doorId: door.def.id }); // hinge groan
    void (async () => {
      try {
        if (fade) await rampBlackout(1, DOOR_FADE_MS / 2); // to black, then load
        built = await zones.transition(door);
        const def = resolveZone(zones.current);
        // Task 5: the door OUT of Greater Vael restores the Hag-tithed ember cap
        // (leaving an exterior zone for a castle/interior one). The struck
        // bargains persist; only the brand's ceiling is lifted back to full —
        // and the restore is PERSISTED at once, or a reload before the next
        // kneel would resurrect the tithed cap inside the castle.
        if (resolveZone(from).kind === 'exterior' && def.kind !== 'exterior') {
          emberCap = restoreEmberCap({ maxEmberCap: emberCap, bargains: hagBargains }).maxEmberCap;
          forestFogBoost = 0;
          persistGreaterVael();
        }
        const paired = pairedDoor(from, door.def, def);
        if (paired) {
          const entry = doorEntry(def, paired);
          controller.pos.set(entry.x, 0, entry.z);
          controller.yaw = entry.yaw;
        } else {
          // One-way passage (no return door): arrive at the zone's S spawn.
          const s = findSpawn(def);
          controller.pos.set(s.x, 0, s.z);
        }
        controller.pitch = 0;
        enterZone();
        // A far-side door, once walked, is unbarred for good — record + persist.
        if (edgeToOpen !== undefined && !doorsOpened.has(edgeToOpen)) {
          doorsOpened.add(edgeToOpen);
          persistProgress();
        }
        // The undercroft is entered by DROPPING in from the hall — a brief
        // landing crouch that eases back up (spec's "one-way drop").
        if (zones.current === 'undercroft' && from === 'great-hall') fallDip = FALL_DIP_M;
        if (fade) await rampBlackout(0, DOOR_FADE_MS / 2); // back in
      } finally {
        transitioning = false;
      }
    })().catch((err: unknown) => {
      console.error(`OATHBRAND: transition through "${door.def.id}" failed:`, err);
    });
  }

  // Task 5: the Hag's carved bargain — digit keys select an offering while the
  // cairn is armed. SILENT (no dialogue system, no voice); the effect runs
  // through the pure `offerToHag` via `applyHagOffer`. Escape is left to pause.
  window.addEventListener('keydown', (e) => {
    if (!bargainArmed || game.state !== 'playing' || transitioning) return;
    let off: Offering | null = null;
    if (e.code === 'Digit1') off = canTithe() ? 'ember' : null;
    else if (e.code === 'Digit2') off = flags.has('tithe-ledger') ? 'ledger' : null;
    else if (e.code === 'Digit3') off = 'kneel';
    else if (e.code === 'Digit4') off = 'decline';
    if (!off) return;
    e.preventDefault();
    bargainArmed = false;
    applyHagOffer(off);
  });

  // Enemy hits (already guard-filtered by Combat) burn embers; every 3rd
  // kill returns one as a wisp (Brand self-subscribes to enemy-slain).
  game.bus.on('player-hit', (e) => brand.damage(e.damage));
  game.bus.on('ember-gained', (e) => brandHud.setEmbers(e.total));

  // Brand → HUD: embers/hollow are event-driven; pulse is pushed per frame
  // below (it decays to zero silently, which no event announces).
  game.bus.on('ember-lost', (e) => brandHud.setEmbers(e.remaining));
  game.bus.on('player-hollowed', () => {
    brandHud.setHollow(true);
    // The summit's GIVE target is lit-only — drop it while hollow.
    rebuildInteractables();
  });
  game.bus.on('player-rekindled', () => {
    brandHud.setHollow(false);
    brandHud.setEmbers(brand.embers);
    // A knight who arrived hollow and rekindled at the summit banner gets the
    // offering back (GIVE is excluded while hollow).
    rebuildInteractables();
  });

  // Dev-only: F9 saves the canvas as shot-<zone>-<timestamp>.png.
  const shots = installScreenshotKey({
    canvas: renderer.domElement,
    zone: () => zones.current,
  });

  // Dev-only escape hatch so tooling/manual QA can poke at the renderer and
  // zone manager (e.g. verify renderer.info doesn't grow across zone
  // transitions). Never present in the SHIPPED production bundle. The gate is
  // `?dev=1` (the dev HUD) OR a build compiled with VITE_E2E=1 — the latter is
  // the CI Playwright build only, so the smoke test can read the game state
  // without the dev HUD. Zone-scoped values are getters — rebound each transition.
  const exposeDevHandle = hud !== null || import.meta.env.VITE_E2E === '1';
  if (exposeDevHandle) {
    // The PS1 pipeline renders twice/frame (scene → low-res target, then the
    // upscale blit). With autoReset on, renderer.info.render would only ever show
    // the final 1-call blit — so `drawCalls` (below) would be a meaningless 1 in
    // the VITE_E2E build (which has no dev HUD). Turn autoReset off and reset once
    // per frame (the render section below) so `drawCalls` covers the WHOLE frame,
    // exactly as the ?dev=1 HUD does. Never runs in the shipped bundle.
    renderer.info.autoReset = false;
    (window as unknown as Record<string, unknown>).__oathbrand = {
      renderer,
      zones,
      scene,
      camera,
      game,
      controller,
      brand,
      pipeline,
      combat,
      audio,
      scareKit,
      dread,
      enemies,
      flags,
      vista,
      visionPlayer,
      // Task 5: the never-killable presences + the Hag bargain, for headless QA
      // (force a manifest, walk-to-despawn, drive the full bargain flow).
      watcherPresence,
      get hagPresence() {
        return hagPresence; // zone-scoped — rebound by every enterZone
      },
      applyHagOffer,
      openHagBargain,
      get emberCap() {
        return emberCap;
      },
      get hagBargains() {
        return hagBargains;
      },
      get watcherAnswered() {
        return watcherAnswered;
      },
      get watcherView() {
        return watcherView;
      },
      get hagView() {
        return hagView;
      },
      kneel,
      inscription,
      dialogueBox,
      loreRead,
      get visionGhosts() {
        return visionGhosts;
      },
      get ashPriests() {
        return ashPriests;
      },
      get built() {
        return built;
      },
      get bolts() {
        return bolts;
      },
      get interactables() {
        return interactables;
      },
      get transitioning() {
        return transitioning;
      },
      get itemMeshes() {
        return itemMeshes;
      },
      get shortcutGate() {
        return shortcutGate;
      },
      get fallDip() {
        return fallDip;
      },
      get activeForsworn() {
        return activeForsworn;
      },
      get bossArena() {
        return bossArena;
      },
      get dragon() {
        return dragon;
      },
      get endingId() {
        return endingId;
      },
      get eyeOpenT() {
        return eyeOpenT;
      },
      get darkness() {
        return darkness;
      },
      get droppedTachi() {
        return droppedTachi;
      },
      get gameState() {
        return game.state;
      },
      // T19: the Playwright smoke reads `state` (an alias of gameState) to
      // confirm BEGIN → 'playing'. Present in the VITE_E2E build and under ?dev=1.
      get state() {
        return game.state;
      },
      // Dev-only deterministic stepper for headless QA (throttled rAF).
      stepFrame: (dtMs = 16) => step(performance.now(), dtMs),
      // Task 13: dev/CI-only zone jump so the Greater Vael exterior smoke can
      // reach a gv zone without a beaten-castle playthrough. Loads the zone,
      // stands the knight at its spawn, and drops into play — the frame loop
      // then renders it (so `drawCalls` populates). Gated with the whole handle
      // behind `?dev=1` / VITE_E2E, so it is NEVER in the shipped bundle.
      loadZone: async (id: string): Promise<void> => {
        built = await zones.load(id as ZoneId, ngPlus);
        const s = findSpawn(resolveZone(id as ZoneId));
        controller.pos.set(s.x, 0, s.z);
        controller.yaw = 0;
        controller.pitch = 0;
        enterZone();
        beginPlay();
      },
      // Task 13: the renderer's last-frame draw-call count — the GPU-independent
      // perf budget the smoke asserts (< 100). Reads `renderer.info.render.calls`.
      get drawCalls() {
        return renderer.info.render.calls;
      },
    };
    // Dev-only brand test keys: H burns an ember, R kneels at a phantom
    // banner, K strikes the Forsworn for 4 (fast phase-forcing in QA).
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH') brand.damage(1);
      else if (e.code === 'KeyR') brand.rekindle('dev-banner');
      else if (e.code === 'KeyK') activeForsworn?.takeHit(4);
      // G raises every dormant kneeling hollow (QA the rise on demand).
      else if (e.code === 'KeyG') {
        for (const { logic } of enemies) if (logic instanceof KneelingHollow) logic.wake();
      }
    });
  }

  // Bind the initial zone (same path every transition takes).
  enterZone();

  // --- Task 18: settings, title, pause -------------------------------------
  // One-boot marker: BEGIN-ANEW / KEEP-THE-VIGIL reload the page (so the whole
  // run — the NG+ flag included — rebuilds from a fresh module) and set this so
  // boot drops straight into play instead of the title.
  const AUTOSTART_KEY = 'oathbrand.autostart';

  // Settings apply LIVE through the real setters on the T2 pipeline, the T17
  // mixer, the T7 controller, and the DOM text scale — never invented APIs.
  // The player's CRT preference, tracked independently of the render mode: CRT
  // is a PS1-era artifact, so HD forces it inert while REMEMBERING this choice
  // so returning to PS1 restores it (HD-mode brief, seam 4). Set by applySettings
  // (setCrt runs before setGraphics) before it's read.
  let userCrt = false;
  const settingsSinks: SettingsSinks = {
    setMasterVolume: (v) => audio.setMasterVolume(v),
    setAmbienceVolume: (v) => audio.setAmbienceVolume(v),
    setSfxVolume: (v) => audio.setSfxVolume(v),
    setSensitivity: (v) => {
      controller.lookSensitivity = v;
    },
    setInvertY: (b) => {
      controller.invertY = b;
    },
    setRenderHeight: (h) => pipeline.setRenderScale(h),
    setCrt: (b) => {
      userCrt = b;
      // Only light the CRT pass in PS1; HD keeps it inert (choice remembered).
      pipeline.setCrtEnabled(pipeline.getRenderMode() === 'ps1' ? b : false);
    },
    setFlickerSafe: (b) => {
      pipeline.setFlickerSafe(b);
      scareKit.setFlickerSafe(b); // held glitch timelines survive; random layers strip
    },
    setTextScale: (v) => applyTextScale(v),
    setGraphics: (m) => {
      // Rebuilds the render target, flips the upscale uHd gate, and flips
      // patchMaterial's compile-time mode (marking live materials for recompile).
      pipeline.setRenderMode(m);
      // Force CRT off in HD; restore the player's kept CRT choice on PS1 return.
      pipeline.setCrtEnabled(m === 'ps1' && userCrt);
    },
  };
  const settings = loadSettings();
  applySettings(settingsSinks, settings); // push the kept dials before first paint
  const settingsPanel = new SettingsPanel(settingsSinks, settings);

  const anyEndingSeen = (save?.endingsSeen?.length ?? 0) > 0;

  function requestLock(): void {
    try {
      void Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => undefined);
    } catch {
      /* older browsers throw synchronously; the canvas click will lock instead */
    }
  }

  /** Leave the menus and hand control to the world. The BEGIN/CONTINUE press is
   *  also the user gesture that wakes the audio (autoplay policy — T17). */
  function beginPlay(): void {
    audio.init(true);
    title.hide();
    pause.hide();
    if (game.state === 'title' || game.state === 'paused') game.transition('playing');
    requestLock();
  }

  /** CONTINUE: resume the saved vigil — load its zone (NG+ state already matches
   *  the boot save), stand the knight at that zone's banner, restore the brand,
   *  then play. Used by the title's CONTINUE and by the autostart boot path. */
  async function continueRestore(): Promise<void> {
    try {
      if (save && save.zone !== zones.current && hasZone(save.zone)) {
        built = await zones.load(save.zone, ngPlus);
        enterZone();
        if (built.banner) {
          controller.pos.set(built.banner.position.x, 0, built.banner.position.z);
        } else {
          const s = findSpawn(activeDef);
          controller.pos.set(s.x, 0, s.z);
        }
        controller.yaw = 0;
        controller.pitch = 0;
      }
      if (save) {
        const lost = TUNING.brand.maxEmbers - save.embers;
        if (lost > 0) brand.damage(lost); // faithful ember count (usually full)
      }
    } catch (err) {
      console.error('OATHBRAND: continue failed:', err);
    }
    beginPlay();
  }

  /** Write the Second Vigil save + the autostart marker, then reload clean. */
  function startSecondVigil(): void {
    saveGame(secondVigilSave(loadGame(), TUNING.brand.maxEmbers));
    try {
      sessionStorage.setItem(AUTOSTART_KEY, '1');
    } catch {
      /* no sessionStorage: the reload just lands on the title, still valid */
    }
    window.location.href = window.location.origin + window.location.pathname;
  }

  const title = new TitleScreen({
    onContinue: () => void continueRestore(),
    onBegin: () => {
      if (save) {
        // BEGIN ANEW (confirmed at the title): abandon the vigil and reload
        // clean so a fresh, non-NG+ run rebuilds; autostart drops into play.
        clearSave();
        try {
          sessionStorage.setItem(AUTOSTART_KEY, '1');
        } catch {
          /* ignore */
        }
        window.location.href = window.location.origin + window.location.pathname;
      } else {
        beginPlay(); // a fresh boot is already at a clean Ashen Gate
      }
    },
    onKeepVigil: () => startSecondVigil(),
    onSettings: () => {
      title.suspend();
      settingsPanel.open(() => title.resume());
    },
  });

  const pause = new PauseScreen({
    onResume: () => {
      pause.hide();
      if (game.state === 'paused') game.transition('playing');
      requestLock();
    },
    onSettings: () => {
      pause.suspend();
      settingsPanel.open(() => pause.resume());
    },
    onQuit: () => {
      // Lay down the watch → back to the title (progress banked at banners).
      window.location.href = window.location.origin + window.location.pathname;
    },
  });

  // Boot into the title — unless a reload asked to autostart, or a dev zone
  // jump (?dev=1&zone=…) wants to land straight in that room.
  game.transition('title');
  const bootParams = new URLSearchParams(window.location.search);
  const devJump = bootParams.get('dev') === '1' && !!bootParams.get('zone');
  let autostart = false;
  try {
    autostart = sessionStorage.getItem(AUTOSTART_KEY) === '1';
    sessionStorage.removeItem(AUTOSTART_KEY);
  } catch {
    /* no sessionStorage: fall through to the title */
  }
  /** The brand sigil belongs to the world, not the menus — show it only in the
   *  in-world states (playing / reading / vision / dialogue / ending). */
  function syncHudVisibility(): void {
    const inWorld =
      game.state === 'playing' ||
      game.state === 'reading' ||
      game.state === 'vision' ||
      game.state === 'dialogue' ||
      game.state === 'ending';
    brandHud.root.style.display = inWorld ? '' : 'none';
  }

  if (devJump) {
    beginPlay(); // stay in the dev-jumped zone, already built
  } else if (autostart) {
    void continueRestore(); // the just-written save (NG+/fresh) or the Ashen Gate
  } else {
    title.show({ hasSave: save !== null, anyEndingSeen }, save?.endingsSeen ?? []);
  }
  syncHudVisibility();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    pipeline.resize();
  });

  let last = performance.now();
  /** Watched so the pause overlay follows the paused state (Esc drops pointer
   *  lock → the Controller transitions to 'paused'; there is no state event). */
  let lastGameState = game.state;
  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(now - last, 100); // clamp tab-switch jumps
    last = now;
    step(now, dt);
  }

  // The per-frame body, split out so a dev build can drive it deterministically
  // (`__oathbrand.stepFrame`) when requestAnimationFrame is throttled — e.g. a
  // hidden/background tab under headless QA. Never scheduled directly in play.
  function step(now: number, dt: number): void {
    // The pause overlay follows the paused state. Losing pointer lock (Esc)
    // makes the Controller transition to 'paused'; RESUME / QUIT leave it.
    if (game.state !== lastGameState) {
      if (game.state === 'paused') pause.show();
      else if (lastGameState === 'paused') pause.hide();
      lastGameState = game.state;
      syncHudVisibility();
    }
    // Simulation is gated on 'playing' (pause freezes world + player) and
    // on not being mid-transition; rendering continues so the last frame
    // stays on screen while a zone swaps.
    if (game.state === 'playing' && !transitioning) {
      game.update(dt);
      controller.update(dt, built.collider);

      // Vista one-shot (clip #1 ashen-gate / PD-1 descent terminus): fire it
      // BEFORE the DreadDirector so an on:'vista' beat — and its Watcher rider —
      // ride the SAME frame the world opens (Task 12 wires PD-1). enterCell is
      // one-shot per save; interiors fire it too (the ashen-gate courtyard vista),
      // exteriors additionally feed the fired id to dread below.
      let vistaFiredId: string | undefined;
      {
        const vRow = Math.floor(controller.pos.z / built.cellM);
        const vCol = Math.floor(controller.pos.x / built.cellM);
        if (activeDef.vista && vista.enterCell(activeDef.vista, vRow, vCol)) {
          vistaFiredId = activeDef.vista.id;
          game.bus.emit({ type: 'vision-played', visionId: activeDef.vista.id });
        }
      }

      // --- Task 3: the DreadDirector ------------------------------------
      // Only exterior (Greater Vael) zones ever get scares — castle zones are
      // never handed to the director. It fires at most one beat/frame; main
      // routes each activation to the kit / mixer / (Tasks 5–12) presence.
      if (activeDef.kind === 'exterior') {
        if (built.bannerMesh) {
          // slow pendulum skew — SMOOTH (never stepped); world micro-motion rule (spec §6)
          built.bannerMesh.rotation.z = Math.sin(now * 0.0011) * 0.05;
        }
        const dRow = Math.floor(controller.pos.z / built.cellM);
        const dCol = Math.floor(controller.pos.x / built.cellM);
        const inCombat = enemies.some((e) => e.logic.alive && e.logic.state !== 'idle');
        for (const activation of dread.update({
          zone: zones.current,
          cell: [dRow, dCol],
          dtMs: dt,
          inCombat,
          brandPulse: brand.pulse,
          events: dreadEvent,
          // PD-1 (Task 12): the id set THIS frame when a VistaDef fires (above),
          // so the on:'vista' beat + its snap-grid + Watcher ride the same swell.
          vistaFiredId,
        })) {
          routeScare(activation);
        }
        dreadEvent = { kind: 'none' }; // consume this frame's event

        // Task 5: advance the never-killable presences. The frustum (from the
        // camera's last-frame pose — a 1-frame lag on "am I looking?" is
        // invisible here) tells the Watcher whether it is observed (frozen) or
        // may reposition off-screen; the Hag reads the player's cell for the
        // cairn threshold, and recedes if approached while merely glimpsed.
        // Neither ever touches the sim, the player, or damage.
        camera.updateMatrixWorld();
        presenceViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        presenceFrustum.setFromProjectionMatrix(presenceViewProj);
        watcherPresence.update(dt, controller.pos, presenceViewTest);
        hagPresence?.update(controller.pos, [dRow, dCol]);
        watcherView?.update(dt);
        hagView?.update(dt);
        // AF-1's crossing silhouette (finding 4a): lerp + despawn (end of
        // traverse, or the player closing within its despawn range).
        crossingSilhouette?.update(dt, controller.pos);
      }

      // Combat: guard mirrors the held button; latched presses start actions.
      combat.tryGuard(controller.input.guardHeld);
      // A cue fires only when the swing actually starts (tryLight/Heavy true).
      if (controller.consumeLight() && combat.tryLight()) audio.cue('swing-light');
      if (controller.consumeHeavy() && combat.tryHeavy()) audio.cue('swing-heavy');
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

      for (const e of enemies) {
        e.view.update(dt); // syncs root ← logic.pos (y=0); incl. death anims
        // Exterior height layer (Task 12): ease the enemy VIEW onto its current
        // cell's terrain height — the enemy-side twin of the camera's groundY, so
        // feet sit on the terrace (not buried/floating). Purely visual: the flat
        // 2D collider still owns movement. Flat/interior zones read 0 → no-op.
        e.groundY += (built.groundYAt(e.logic.pos.x, e.logic.pos.z) - e.groundY) * Math.min(1, dt / GROUND_EASE_MS);
        e.view.root.position.y += e.groundY;
      }

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

      // --- Task 15: the Forsworn's arena + the summit dragon ------------
      if (activeForsworn) {
        // Dark-flame floor trails burn the player once per touch (P2+).
        const trailDmg = activeForsworn.tickTrails(dt, controller.pos);
        if (trailDmg > 0) brand.damage(trailDmg);
        // A raised guard forfeits the no-guard tachi reward.
        if (combat.state === 'guard') activeForsworn.noteGuard();
      }
      syncTrails();

      if (zones.current === 'throne' && bossArena) {
        const inArena = Math.floor(controller.pos.z / built.cellM) <= THRONE_ARENA_MAX_ROW;
        const bossDead = flags.has('forsworn-dead') || !(activeForsworn?.alive ?? false);
        const evt = bossArena.update({
          playerInArena: inArena,
          playerHollow: brand.hollow,
          bossDead,
        });
        if (evt === 'seal') {
          setGateSealed(true);
          showTitleCard('THE FORSWORN', 'FIRST KNIGHT OF VAEL', 3400);
          game.bus.emit({ type: 'cue', id: 'card-boss' });
        } else if (evt === 'mercy-open' || evt === 'death-open') {
          setGateSealed(false);
        }
        // P3 blackout: the arena torches (and ambient) die as he snuffs them —
        // lerping to the tuned floor (torchOut ≈ 0.03 of their lit intensity).
        const torchOut = TUNING.enemies.forsworn.torchOut;
        // The dark belongs to the sealed fight only: during the mercy (gate open,
        // hollow player walking out) the torches relight, even at phase-3 hp.
        const bossInP3 = !!(activeForsworn?.alive && activeForsworn.currentPhase() === 3);
        const wantDark = arenaWantsDark(bossInP3, bossArena.sealed) ? 1 : 0;
        darkness = approach(darkness, wantDark, (DARKEN_SPEED * dt) / 1000);
        zones.setTorchScale(1 - darkness * (1 - torchOut));
        ambient.intensity = (activeDef.ambientFloor ?? DEFAULT_AMBIENT) * (1 - darkness * 0.9);
        moonLight.intensity = moonBaseIntensity * (1 - darkness * 0.9);
      }

      // Portcullis slide toward its target height (sealed down / open up).
      if (bossGate) {
        const dy = bossGate.targetY - bossGate.mesh.position.y;
        if (Math.abs(dy) > 1e-3) {
          bossGate.mesh.position.y +=
            Math.sign(dy) * Math.min(Math.abs(dy), (GATE_SLIDE_SPEED * dt) / 1000);
        }
      }

      // Summit: the eye wakes as the LIT knight nears the flame (a hollow one
      // never wakes it — Ending 3); the dragon breathes; the brazier flickers.
      // A hollow knight reaching the flame begins the silent fade instead.
      if (zones.current === 'summit') {
        if (dragon && flamePos && !brand.hollow && !endingId && eyeOpenT < 1) {
          const d = Math.hypot(controller.pos.x - flamePos.x, controller.pos.z - flamePos.z);
          if (d <= EYE_WAKE_RANGE_M) {
            if (eyeOpenT === 0) game.bus.emit({ type: 'cue', id: 'eye-open' });
            eyeOpenT = Math.min(1, eyeOpenT + (EYE_OPEN_SPEED * dt) / 1000);
          }
        }
        if (flamePos && brand.hollow && !endingId) {
          const d = Math.hypot(controller.pos.x - flamePos.x, controller.pos.z - flamePos.z);
          if (d <= TUNING.player.interactRangeM) beginEnding(3);
        }
        if (dragon) {
          dragon.setEyeOpen(eyeOpenT);
          dragon.update(dt);
        }
        if (brazier) brazier.flame.scale.setScalar(1 + Math.sin(now * 0.006) * 0.14);
      }

      // --- doors + vista (Task 11), keyed off the player's grid cell ----
      const pRow = Math.floor(controller.pos.z / built.cellM);
      const pCol = Math.floor(controller.pos.x / built.cellM);

      // Walking into a passable door's span transitions. Unbuilt targets
      // stay sealed. The summit's return door is NOT auto-walked — leaving
      // there is the KEEP choice, taken only by an explicit press (below).
      const doorHere = doorCells.get(`${pRow},${pCol}`);
      if (
        doorHere &&
        zones.current !== 'summit' &&
        canPass(doorHere.def, flags) &&
        hasZone(doorHere.def.to)
      ) {
        goThrough(doorHere);
      }

      // Vista (clip #1 / PD-1): the enterCell fire moved to the top of the frame
      // (before the DreadDirector) so an on:'vista' beat rides the same swell;
      // here we only advance the eased fog+camera envelope.
      vista.update(dt);

      // Shortcut gate swing (after a kick) + landing-dip recovery.
      if (shortcutGate?.opening && shortcutGate.angle > GATE_OPEN_ANGLE) {
        shortcutGate.angle = Math.max(
          GATE_OPEN_ANGLE,
          shortcutGate.angle - (GATE_SWING_SPEED * dt) / 1000,
        );
        shortcutGate.hinge.rotation.y = shortcutGate.angle;
      }
      if (fallDip > 0) fallDip = Math.max(0, fallDip - (FALL_DIP_RECOVER * dt) / 1000);

      // Composite the false-pulse spoof (finding 4b) over the real pulse via
      // max(), mirroring the desat-stab compositing — a GF-2 crossing throbs the
      // sigil once even with no threat in range, then eases back to the real read.
      brandHud.setPulse(Math.max(brand.pulse, scareKit.pulseBoost()), brand.blueFlicker);
      const target = interactor.nearest(interactables);
      // Walking off the summit stair cancels a pending KEEP confirm.
      if (keepConfirmPending && target?.id !== 'summit-to-throne') keepConfirmPending = false;
      // Stepping off the cairn disarms the Hag's carved bargain.
      if (bargainArmed && target?.id !== 'hag-threshold') bargainArmed = false;
      if (target) showPrompt(target.verb, target.label);
      else hidePrompt();

      // E on a target (Task 12: TAKE + kick-open; Task 13: READ + SPEAK):
      //  - READ: raise the full-screen inscription (enters 'reading', freezes
      //    the sim); the reader emits 'lore-read' once per id and banks it.
      //  - SPEAK: open the Ash-Priest's dialogue for this encounter (enters
      //    'dialogue'); his summit line varies by ending track.
      //  - TAKE: pick up a lore-item (the Gatekey), set its flag, show the
      //    inscription toast, remove the glint, persist.
      //  - OPEN a passable door: transition. A `kick` gate (the ramparts
      //    shortcut) sets its lock flag instead of denying — swings, unseals
      //    the hall twin for good, persists. Otherwise: ember-red 'SEALED'.
      const pressedE = controller.consumeAction();
      if (pressedE && target?.verb === 'KNEEL') {
        // The checkpoint ritual (Task 14): rekindle + save + motif cue + enemy
        // respawn, and — on the FIRST kneel here — this banner's memory. Locks
        // input (enters 'vision') for its ~4s (longer while the memory plays).
        if (kneel.start(zones.current, visionForZone(zones.current))) hidePrompt();
      } else if (pressedE && target?.verb === 'OFFER') {
        // The Hag's cairn (Task 5): arm the silent, carved bargain (digit keys
        // select). No damage, no fight — a bargain, not a battle.
        openHagBargain();
      } else if (pressedE && target?.verb === 'READ') {
        inscription.open(target.id);
      } else if (pressedE && target?.verb === 'SPEAK') {
        const priest = ashPriests.find((p) => p.id === target.id);
        if (priest) dialogueBox.open(dialogueSequence(priest.dialogueId, flags, brand.hollow));
      } else if (pressedE && target?.verb === 'TAKE' && target.id === 'callun-tachi') {
        // Callun's broken tachi (Task 15): the no-guard reward. Equip = swap.
        if (droppedTachi && !droppedTachi.taken) {
          droppedTachi.taken = true;
          scene.remove(droppedTachi.mesh);
          combat.equipTachi();
          showCard("Callun's broken tachi. Lighter than it looks, and hungrier — the windup barely there at all.");
          rebuildInteractables();
        }
      } else if (pressedE && target?.verb === 'TAKE') {
        const item = built.items.find((it) => it.spot.id === target.id);
        if (item && takeItem(item.spot, flags)) {
          showCard(item.spot.card);
          persistProgress();
          const glint = itemMeshes.find((x) => x.id === item.spot.id);
          if (glint) scene.remove(glint.mesh);
          itemMeshes = itemMeshes.filter((x) => x.id !== item.spot.id);
          rebuildInteractables();
        }
      } else if (pressedE && target?.verb === 'GIVE') {
        // GIVE THE CROWN at the summit flame → the oath is kept (Ending 1/4).
        resolveGive();
      } else if (pressedE && target?.verb === 'OPEN') {
        const door = built.doors.find((d) => d.def.id === target.id);
        if (door) {
          const inst = doorInstancesByDefId.get(door.def.id);
          // At the summit, the stair down is the KEEP choice, not a transition.
          if (inst) {
            // A decorated gate (world-expansion v1.2). Barred from the far side
            // until first opened from within; otherwise hinge-groan + black
            // fade + transition, and the far-side lock lifts for good.
            if (isBarred(inst, zones.current, doorsOpened)) {
              showCard('Barred from the other side.');
            } else if (canPass(door.def, flags) && hasZone(door.def.to)) {
              goThrough(door, inst.edgeId);
            } else flashDenied();
          } else if (zones.current === 'summit' && door.def.to === 'throne' && !endingId) {
            handleKeepPress();
          } else if (
            // The illusory wall to the Queen's Garden — revealable only on a
            // Second Vigil (T16). Interact once: the wall gives, 'garden-found'
            // is set (unsealing the door for good this run), and you step through.
            door.def.lock === 'illusory' &&
            ngPlus &&
            !flags.has('garden-found') &&
            hasZone(door.def.to)
          ) {
            flags.add('garden-found');
            persistProgress();
            showCard(
              'The wall was never stone. Your brand leans blue against the cold, and it breathes open — the Queen’s Garden, kept a hundred years for the one who walked all the way round.',
            );
            goThrough(door);
          } else if (canPass(door.def, flags) && hasZone(door.def.to)) goThrough(door);
          else if (kickOpen(door.def, flags)) {
            game.bus.emit({ type: 'door-opened', doorId: door.def.id });
            persistProgress();
            showCard('The gate gives with a shriek of iron. The hall waits below.');
            if (shortcutGate) shortcutGate.opening = true;
            rebuildInteractables();
          } else flashDenied();
        }
      }
    } else if (game.state === 'vision' && !transitioning) {
      // The kneel ritual + its banner memory (Task 14). Input is locked here
      // (the sim block above is skipped), so the Brand does not tick and the
      // VisionPlayer owns desaturation + fog. Ghosts billboard to the camera.
      kneel.update(dt);
      // A vision played OUTSIDE the kneel ritual — the Hag ledger bargain
      // (Task 8) — is ticked here directly; kneel.update is a no-op while its
      // ritual is idle, so the memory would otherwise freeze on its first beat.
      if (!kneel.active && visionPlayer.active) visionPlayer.update(dt);
      faceGhostsToCamera();
    } else if (game.state === 'ending' && !transitioning) {
      // A summit ending is playing (Task 15). The director drives desaturation,
      // the blackout, the card, and Vhaelis; the dragon keeps living behind it.
      endingDirector?.update(dt);
      if (dragon) {
        dragon.setEyeOpen(eyeOpenT);
        dragon.update(dt);
      }
      if (emberRiseOn) updateEmberRise(dt);
      if (endingDirector?.done && endingId !== null) {
        const reached = endingId;
        endingDirector = null;
        finishEndingToCredits(reached);
      }
    }

    camera.rotation.y = controller.yaw;
    camera.rotation.x = controller.pitch;
    // Exterior height layer (Task 2): the eye eases onto the current cell's
    // terrain height (visual only — collision xz is unchanged, so no jump).
    // Interiors report 0 everywhere, so `groundY` stays 0 and the camera math
    // is byte-identical to v1.
    const gRow = Math.floor(controller.pos.z / built.cellM);
    const gCol = Math.floor(controller.pos.x / built.cellM);
    groundY += (built.groundYAt(controller.pos.x, controller.pos.z) - groundY) * Math.min(1, dt / GROUND_EASE_MS);
    // The vista's lift rides on top of the eye height (0 when idle); the
    // undercroft drop subtracts a brief landing crouch (fallDip → 0); the
    // kneel sinks the eye ~0.5m to one knee (Task 14).
    camera.position.set(
      controller.pos.x,
      controller.pos.y + eyeY + groundY + vista.camLift - fallDip - kneel.camSink,
      controller.pos.z,
    );
    // Keep the audio listener on the camera every rendered frame (even in
    // endings/menus) so positional panning + occlusion stay true (Task 17).
    audio.setListener(controller.pos.x, camera.position.y, controller.pos.z, controller.yaw);
    // Hoisted for the P5 HD-scare rider below (also read by the PS1 snap/drop
    // branches further down): whether we're rendering in the HD path.
    const hdMode = pipeline.getRenderMode() === 'hd';
    // While a memory plays, its intimate fog replaces the vista/base far-plane.
    fog.far = visionPlayer.active ? visionFogFar : baseFogFar + vista.fogFarBoost;
    // Low-fog scare bands (Task 2 / spec §4): standing on a listed cell pulls
    // the fog far-plane in (the paired audio tell is Task 6/10/12). Never while
    // a memory owns the fog; interiors have no fogCells so this is skipped.
    if (activeDef.fogCells && !visionPlayer.active) {
      const near = fogCellFar(activeDef, gRow, gCol);
      if (near !== undefined) fog.far = Math.min(fog.far, near);
    }
    // P5: in HD the snap/res-drop artifice can't render — ride the beat on fog
    // + desat instead (both survive HD). PS1 behaviour below is unchanged.
    const hdRider = hdMode ? hdScareRider(scareKit.snapRes() !== null, scareKit.renderDrop()) : null;
    if (hdRider?.fogFar != null) fog.far = Math.min(fog.far, hdRider.fogFar);

    // --- Task 3: apply the screen-scare kit to the PS1 pipeline ----------
    // Read the held glitch timelines (advanced by game.update) and drive the
    // existing pipeline setters — no new render code, one glitch metaphor.
    //
    // HD-mode prototype (brief seam 3): the resolution-DROP and vertex-snap
    // SPIKE riders manipulate the render scale / snap grid, neither of which
    // exists in HD. While in HD both are NO-OPS — the DreadDirector still fires
    // the beat, the visual rider just doesn't render (same discipline as
    // flicker-safe suppression). The desat STAB below is PRESERVED (desat
    // survives in HD). The DROP *restore* stays ungated so any latch pending at
    // a mid-beat mode switch still clears cleanly. (`hdMode` is hoisted above
    // the fog block for the P5 HD-scare rider; both sites read the one const.)
    // 1) One-frame resolution DROP: force 240 for the beat, restore after (a
    //    no-op at the default 240 — the paired diegetic guttering carries it).
    if (!hdMode && scareKit.renderDrop()) {
      if (dropRestoreScale === null) {
        dropRestoreScale = pipeline.getRenderScale();
        pipeline.setRenderScale(240);
      }
    } else if (dropRestoreScale !== null) {
      pipeline.setRenderScale(dropRestoreScale);
      dropRestoreScale = null;
    }
    // 2) Vertex-snap SPIKE: override the snap grid while active, restore once.
    //    (setRenderScale above already re-syncs the grid, so compute the target
    //    from the CURRENT scale.) Skipped whole in HD (no snap grid; returning
    //    to PS1 re-syncs the grid via setRenderMode's target rebuild).
    if (!hdMode) {
      const snapTarget: [number, number] = pipeline.getRenderScale() === 240 ? [320, 240] : [480, 360];
      const snapNow = scareKit.snapRes();
      if (snapNow) {
        setSnapResolution(snapNow[0], snapNow[1]);
        snapOverridden = true;
      } else if (snapOverridden) {
        setSnapResolution(snapTarget[0], snapTarget[1]);
        snapOverridden = false;
      }
    }
    // 3) Desaturation STAB, composited with the Brand's per-frame hollowing via
    //    max() so the stab never fights (or is fought by) the ember ramp.
    pipeline.setDesaturation(Math.max(pipeline.getDesaturation(), scareKit.desatBoost(), hdRider?.desatFloor ?? 0));

    // Frame-start info reset so draw calls cover both pipeline passes. The dev
    // HUD does this in begin(); the VITE_E2E build (no HUD, handle exposed) needs
    // it too so `__oathbrand.drawCalls` reads the real per-frame count.
    if (hud) hud.begin();
    else if (exposeDevHandle) renderer.info.reset();
    pipeline.render(scene, camera);
    shots?.afterRender();
    hud?.end(zones.current);
  }
  requestAnimationFrame(frame);
}

// (dev stepper is registered on __oathbrand inside startScene)

if (hasWebGL()) {
  startScene().catch((err: unknown) => {
    console.error('OATHBRAND failed to start:', err);
    showFallback('The flame gutters — OATHBRAND could not load its world. See console.');
  });
} else {
  showFallback('It seems your browser cannot carry this flame. — OATHBRAND needs WebGL.');
}
