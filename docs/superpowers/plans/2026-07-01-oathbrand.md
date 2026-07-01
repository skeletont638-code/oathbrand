# OATHBRAND Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OATHBRAND — a ~30-min, browser-playable, PS1-aesthetic 3D dark fantasy game with 4 endings and NG+ — live on GitHub Pages with a portfolio-grade repo, by 2026-07-09.

**Architecture:** Vanilla Three.js + Vite + TypeScript, plain classes, no ECS. A fixed-order game loop (input → player → entities → brand → audio → render) over a typed event bus. Zones are data-authored ASCII-grid layouts kit-bashed from CC0 GLTF packs, merged per-zone for draw-call budget, rendered through a reusable PS1 pipeline (320×240 target, vertex snap, affine UVs, Bayer dither, fog). All game logic (brand, FSMs, zone graph, saves, endings, NG+ variants) is pure-TS and vitest-tested; scenes are verified by screenshot checkpoints.

**Tech Stack:** three@^0.183, vite@^6, typescript@^5 (strict), vitest@^3, playwright (CI smoke), GitHub Actions → GitHub Pages.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-oathbrand-design.md` — every task implicitly obeys it.
- **Deadline 2026-07-09.** Cut line if behind (in cut order): wraith-hunt secret → mobile touch polish → anomaly count 14→8 → Ash-Priest third encounter. NEVER cut: 4 endings, NG+, the five clips, tests, README.
- Static site only; GitHub Pages base path `/oathbrand/` (`vite.config.ts` `base`). No server, no COOP/COEP.
- All assets CC0, every file listed in `assets/LICENSES.md` (source URL + license). Code MIT.
- Perf: no realtime shadows; ≤4 dynamic lights/zone; <100 draw calls; textures ≤128px NearestFilter no mipmaps; render target 320×240 (setting: 480×360).
- TS strict; no `any` except three.js shader `onBeforeCompile` internals; bundle <1.5MB gzip excl. assets.
- Diegetic UI only in-world (brand, prompts); DOM overlay for menus/inscriptions/title-cards.
- Commit after every green test cycle. Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `content:`).
- Every zone/scene task ends with a screenshot saved to `docs/shots/` (dev screenshot key F9 from Task 7) and a 9:16 crop sanity check for clip-bearing zones.
- Tuning values (damage, ranges, timings) live in `src/content/tuning.ts` — single file, typed, no magic numbers in systems.

## Core shared interfaces (defined once, used by all tasks)

```ts
// src/engine/events.ts
export type GameEvent =
  | { type: 'ember-lost'; remaining: number }
  | { type: 'ember-gained'; total: number }
  | { type: 'player-hollowed' }
  | { type: 'player-rekindled'; bannerId: string }
  | { type: 'brand-pulse'; intensity: number }        // 0..1, emitted per tick when >0
  | { type: 'enemy-slain'; enemyId: string; kind: EnemyKind }
  | { type: 'player-hit'; damage: number }
  | { type: 'zone-entered'; zone: ZoneId }
  | { type: 'door-opened'; doorId: string }
  | { type: 'lore-read'; loreId: string }
  | { type: 'vision-played'; visionId: string }
  | { type: 'ending-reached'; ending: EndingId };
export class EventBus {
  on<T extends GameEvent['type']>(type: T, fn: (e: Extract<GameEvent, {type: T}>) => void): () => void;
  emit(e: GameEvent): void;
}

// src/content/types.ts
export type ZoneId = 'ashen-gate'|'great-hall'|'undercroft'|'ramparts'|'throne'|'summit'|'queens-garden';
export type EnemyKind = 'soldier'|'archer'|'wraith'|'forsworn';
export type EndingId = 1|2|3|4;
export type GameFlag = 'gatekey'|'shortcut-open'|'throne-open'|'forsworn-dead'|'forsworn-noguard'
  |'queens-brand'|'garden-found'|'ng-plus'|'callun-tachi'|'wraith-hunt-done';
```

Game states: `'boot'|'title'|'playing'|'paused'|'reading'|'vision'|'dialogue'|'ending'`.

---

### Task 1: Scaffold, CI, deployed hello-scene

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/style.css`, `.gitignore`, `LICENSE` (MIT), `.github/workflows/ci.yml`, `README.md` (stub: title + "in development")
- Test: `src/engine/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: running `npm run dev` serves a fog-grey three.js scene with one lit cube; `npm test`, `npm run typecheck`, `npm run build` all green; pushes to `main` deploy to Pages.

- [ ] **Step 1:** `npm create vite@latest . -- --template vanilla-ts`, then `npm i three@^0.183 && npm i -D vitest @types/three`. Set `"base": "/oathbrand/"` in `vite.config.ts`. Scripts: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`.
- [ ] **Step 2:** Write failing smoke test:

```ts
// src/engine/__tests__/smoke.test.ts
import { describe, it, expect } from 'vitest';
import { APP_NAME } from '../constants';
describe('scaffold', () => { it('names the app', () => { expect(APP_NAME).toBe('OATHBRAND'); }); });
```

- [ ] **Step 3:** Run `npm test` → FAIL (module missing). Create `src/engine/constants.ts` with `export const APP_NAME = 'OATHBRAND';` → PASS.
- [ ] **Step 4:** `src/main.ts`: fullscreen canvas, `WebGLRenderer`, `PerspectiveCamera`, one `BoxGeometry` + `MeshLambertMaterial`, one `PointLight`, `THREE.Fog(0x1a1a1d, 1, 12)`, render loop. WebGL-support guard: if `!WebGLRenderingContext` or context creation throws, replace body with fallback div (`It seems your browser cannot carry this flame. — OATHBRAND needs WebGL.`).
- [ ] **Step 5:** `.github/workflows/ci.yml`: on PR + push-main → `npm ci`, typecheck, vitest, build; on main additionally deploy `dist/` via `actions/deploy-pages@v4` (+ `actions/upload-pages-artifact@v3`, permissions `pages: write, id-token: write`).
- [ ] **Step 6:** `gh repo create oathbrand --public --source . --push` (confirm owner login first with `gh auth status`). Enable Pages via `gh api repos/{owner}/oathbrand/pages -X POST -f build_type=workflow` (ignore 409 if exists). Verify Actions run green and the Pages URL serves the cube.
- [ ] **Step 7:** Commit `chore: scaffold vite+three+vitest, CI to Pages`.

### Task 2: PS1 pipeline (`src/ps1/` — the reusable module)

**Files:**
- Create: `src/ps1/PS1Pipeline.ts`, `src/ps1/patchMaterial.ts`, `src/ps1/upscale.frag.ts`, `src/ps1/bayer.ts`, `src/ps1/README.md`
- Modify: `src/main.ts` (route hello-scene through pipeline)
- Test: `src/ps1/__tests__/bayer.test.ts`

**Interfaces:**
- Produces:
  - `class PS1Pipeline { constructor(renderer: WebGLRenderer, opts?: {width?: 240|360}); render(scene: Scene, cam: Camera): void; setDesaturation(v: number): void; /* 0 = full color, 1 = grayscale */ setCrtEnabled(b: boolean): void; setFlickerSafe(b: boolean): void; resize(): void; }`
  - `patchMaterial(mat: Material): void` — injects vertex snapping (`snapRes` uniform vec2, default render-target size) + affine UV (`vUv * w` / divide in FS) via `onBeforeCompile`.
  - `bayer4x4(): number[]` (16 values 0..1) and `quantizeRGB555(r: number): number` — pure, tested.
- Consumes: Task 1 renderer.

- [ ] **Step 1:** Failing tests:

```ts
// src/ps1/__tests__/bayer.test.ts
import { bayer4x4, quantizeRGB555 } from '../bayer';
it('bayer matrix has 16 unique thresholds in [0,1)', () => {
  const b = bayer4x4(); expect(b).toHaveLength(16);
  expect(new Set(b).size).toBe(16); b.forEach(v => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); });
});
it('RGB555 quantizes to 32 levels', () => {
  expect(quantizeRGB555(0)).toBe(0); expect(quantizeRGB555(1)).toBe(1);
  expect(quantizeRGB555(0.5)).toBeCloseTo(Math.round(0.5*31)/31, 5);
});
```

- [ ] **Step 2:** Run → FAIL. Implement `bayer.ts` (classic 4×4 Bayer `/16`), run → PASS. Commit `feat(ps1): bayer + rgb555 math`.
- [ ] **Step 3:** `PS1Pipeline`: `WebGLRenderTarget(320,240,{minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:true})`; fullscreen triangle + `RawShaderMaterial` upscale pass implementing: RGB555 quantize + Bayer dither (threshold from a 4×4 DataTexture) + desaturation mix (uniform `uDesat`) + optional scanlines/vignette/grain (uniform `uCrt`, `uFlickerSafe` gates grain/shimmer). Vertex snap in `patchMaterial`:

```glsl
// injected after project_vertex
gl_Position.xy /= gl_Position.w;
gl_Position.xy = floor(gl_Position.xy * uSnapRes) / uSnapRes;
gl_Position.xy *= gl_Position.w;
```

  Affine UV: VS `vAffine = uv * gl_Position.w;` FS `vec2 uv = vAffine / vW;` (pass `vW = gl_Position.w` as varying).
- [ ] **Step 4:** Route main.ts through pipeline. Manual check: cube renders chunky/dithered; `setDesaturation(1)` grays it. Commit `feat(ps1): render pipeline with dither, snap, affine, desat`.
- [ ] **Step 5:** Write `src/ps1/README.md` (what it is, the three tricks with code excerpts, usage snippet, MIT note) — this is the starrable artifact; write it properly (~80 lines).

### Task 3: Event bus + game state machine + fixed loop

**Files:**
- Create: `src/engine/events.ts`, `src/engine/Game.ts`, `src/content/types.ts`, `src/content/tuning.ts`
- Modify: `src/main.ts`
- Test: `src/engine/__tests__/events.test.ts`, `src/engine/__tests__/game-states.test.ts`

**Interfaces:**
- Produces: `EventBus` + `GameEvent` exactly as in Global Constraints header; `class Game { state: GameState; transition(to: GameState): boolean; update(dtMs: number): void; readonly bus: EventBus; }` — `transition` enforces the legality table below and returns false on illegal moves (never throws).
- Legal transitions: boot→title; title→playing; playing↔paused; playing→reading|vision|dialogue (and each back to playing); playing→ending; ending→title. Everything else illegal.

- [ ] **Step 1:** Failing tests: bus delivers typed payload; `off()` unsubscribes; Game rejects `title→ending`, allows `playing→vision→playing`; `update` ticks subsystem hooks in registered order (spy array `['input','player','entities','brand','audio']`).
- [ ] **Step 2:** Run → FAIL. Implement minimal bus (Map of arrays) + Game with transition table + ordered tick registry. Run → PASS.
- [ ] **Step 3:** `tuning.ts` initial values (all consumed later — keep names EXACT):

```ts
export const TUNING = {
  brand: { maxEmbers: 5, pulseRangeM: 12, hollowDesatRamp: [0, .18, .38, .60, .82, 1] as const, // index = embers lost
           illusoryFlickerRangeM: 3 },
  player: { walkSpeed: 3.2, radius: 0.4, height: 1.7, interactRangeM: 2.2,
            light: { damage: 1, windupMs: 260, activeMs: 180, recoverMs: 420, arcDeg: 70, rangeM: 1.9 },
            heavy: { damage: 2, windupMs: 620, activeMs: 220, recoverMs: 700, arcDeg: 90, rangeM: 2.2 },
            stepDistM: 2.4, stepMs: 240, guardShoveM: 1.2 },
  enemies: {
    soldier: { hp: 3, speed: 1.6, aggroM: 9, attack: { damage: 1, windupMs: 700, activeMs: 200, recoverMs: 900, rangeM: 1.8 } },
    archer:  { hp: 2, speed: 1.4, aggroM: 14, repositionM: 5, shot: { damage: 1, speedM: 7, windupMs: 900, cooldownMs: 2200 } },
    wraith:  { hp: 2, speed: 2.3, aggroM: 11, lunge: { damage: 1, windupMs: 500, activeMs: 260, recoverMs: 1100, rangeM: 2.6 } },
    forsworn:{ hp: 24, phaseAt: [16, 8], speed: 1.9 },
  },
} as const;
```

- [ ] **Step 4:** Commit `feat(engine): event bus, game state machine, tuning table`.

### Task 4: Zone data format, grid collision, zone graph

**Files:**
- Create: `src/world/zoneDef.ts`, `src/world/collision.ts`, `src/world/zoneGraph.ts`
- Test: `src/world/__tests__/collision.test.ts`, `src/world/__tests__/zoneGraph.test.ts`

**Interfaces:**
- Produces:
  - `interface ZoneDef { id: ZoneId; grid: string[]; cell: number /* meters, always 2 */; tiles: Record<string, TileKind>; props: Prop[]; lights: Torch[]; enemies: EnemySpawn[]; banner?: Banner; lore: LoreSpot[]; doors: DoorDef[]; illusory?: IllusoryWall[]; ambience: string[]; ngPlus?: NgPlusVariant; }`
  - Grid chars: `#` wall, `.` floor, `~` void (fall = ember loss + reset to zone entry), `D`+digit door anchor, `B` banner, `S` player spawn.
  - `class GridCollider { constructor(def: ZoneDef); slide(pos: Vec2, delta: Vec2, radius: number): Vec2; raycastWall(a: Vec2, b: Vec2): boolean; }` — circle-vs-tile-AABB with axis-separated slide.
  - `interface DoorDef { id: string; at: [number, number]; to: ZoneId; lock?: 'gatekey'|'shortcut'|'throne'|'ngplus'|'illusory'; }`
  - `canPass(door: DoorDef, flags: Set<GameFlag>): boolean` — gatekey needs `'gatekey'`; shortcut/throne need their flags; ngplus needs `'ng-plus'`; illusory always passes once revealed (flag `garden-found` for the garden wall).
- Consumes: types from Task 3.

- [ ] **Step 1:** Failing tests: slide along wall preserves tangent motion and zeroes normal component; can't tunnel a 2m wall in one 0.5m step; raycastWall true through `#`, false across open floor; `canPass` truth table for all five lock kinds (8 cases).
- [ ] **Step 2:** Run → FAIL. Implement (pure TS, no three.js imports — collision is 2D top-down; Y handled by zone floor height). Run → PASS. Commit `feat(world): zone format, grid collider, lock graph`.

### Task 5: Asset acquisition + build pipeline

**Files:**
- Create: `assets/` (git-tracked, curated subset only), `assets/LICENSES.md`, `scripts/fetch-assets.sh`, `scripts/downsample-textures.mjs`
- Test: manual — `npm run build` stays <1.5MB gz for code; assets lazy-load per zone.

**Interfaces:**
- Produces: `assets/kit/` GLTF modules with EXACT names used by all zone tasks: `wall.glb, wall-door.glb, wall-arch.glb, floor.glb, stairs.glb, pillar.glb, banner.glb, torch.glb, throne.glb, crate.glb, rubble.glb, statue-knight.glb, gate.glb, torii.glb (built from pillar+lintel if no kit piece), skeleton-warrior.glb, skeleton-archer.glb, crown.glb (kit goblet/crown or low-poly authored)`; `assets/tex/` ≤128px darkened textures; `assets/audio/` placeholder dir.
- Consumes: nothing.

- [ ] **Step 1:** `scripts/fetch-assets.sh`: clone `https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0` to a temp dir; also fetch KayKit Skeletons + Character Animations packs (itch/GitHub — check `github.com/KayKit-Game-Assets` listing; if a pack is itch-only, print manual-download instructions and exit 1 for that pack). Copy ONLY the needed pieces into `assets/kit/` under the canonical names above.
- [ ] **Step 2:** `scripts/downsample-textures.mjs` (sharp or canvas): resize atlas textures to 128px, multiply toward palette (ash `#8a8a92`, ember `#c4501e`, blood `#5e1f1f`, void `#0d0d10`), posterize 5 bits. Run on all copied textures.
- [ ] **Step 3:** Write `assets/LICENSES.md`: one row per source pack (KayKit ×3, Kenney if used, Quaternius if used, audio TBD-by-Task-17 rows added then) — name, URL, license (CC0), files taken. NO file enters `assets/` without a row.
- [ ] **Step 4:** Verify each GLB loads in a throwaway three.js scene (script `scripts/verify-gltf.mjs` walks `assets/kit/*.glb` via `GLTFLoader` + `node --experimental-*` or a browser check page `/dev/kit.html` listing all pieces). Commit `chore(assets): CC0 kit, textures darkened, license manifest`.

### Task 6: ZoneBuilder — grid → merged three.js scene

**Files:**
- Create: `src/world/ZoneBuilder.ts`, `src/world/ZoneManager.ts`
- Modify: `src/main.ts` (load a test zone)
- Test: `src/world/__tests__/zoneBuilder.test.ts` (pure parts)

**Interfaces:**
- Produces:
  - `class ZoneBuilder { build(def: ZoneDef, assets: AssetCache): BuiltZone }` — instantiates kit pieces per grid char, merges static geometry with `BufferGeometryUtils.mergeGeometries` per material (≤6 merged meshes/zone), patches all materials via `patchMaterial`, places props/torch PointLights (≤4, flicker via sin-noise intensity), returns `{ group: Group, collider: GridCollider, spawns: EnemySpawn[], doors: PlacedDoor[], banner?: PlacedBanner, lore: PlacedLore[] }`.
  - `class ZoneManager { load(id: ZoneId, ng: boolean): Promise<BuiltZone>; current: ZoneId; transition(door: PlacedDoor): Promise<void>; }` — disposes previous zone geometry/textures; fires `zone-entered`.
  - Pure helper tested: `gridToPlacements(def: ZoneDef): Placement[]` (`{piece, x, z, rotY}` per cell — walls auto-orient to face open neighbors; door cells get `wall-door`).
- Consumes: Task 4 `ZoneDef`/`GridCollider`, Task 5 asset names, Task 2 `patchMaterial`.

- [ ] **Step 1:** Failing test on `gridToPlacements`: 3×3 room grid yields 8 wall placements w/ correct rotY facing inward, 1 floor; door char yields `wall-door` piece; unknown char throws with zone id + coords in message.
- [ ] **Step 2:** Run → FAIL → implement → PASS. Commit.
- [ ] **Step 3:** Implement builder merge + manager dispose (track `renderer.info.render.calls` in a dev HUD overlay `?dev=1`: fps, calls, zone). Test zone in main.ts: 6×6 room, 2 torches. Manual: <30 draw calls, chunky PS1 look. Commit `feat(world): zone builder + manager with dev HUD`.

### Task 7: Player controller (pointer-lock + touch), interact prompts, dev screenshot

**Files:**
- Create: `src/player/Controller.ts`, `src/player/Interactor.ts`, `src/ui/prompt.ts`, `src/engine/screenshot.ts`
- Modify: `src/main.ts`
- Test: `src/player/__tests__/controller.test.ts`

**Interfaces:**
- Produces: `class Controller { update(dt: number, collider: GridCollider): void; pos: Vector3; yaw: number; pitch: number; readonly input: InputState; }` — WASD relative to yaw, slide via collider, pointer-lock mouse look (pitch clamp ±75°), auto-pause on pointerlock loss (emit via Game.transition('paused')). Touch: left-half virtual stick, right-half drag-look, context action buttons (DOM). `class Interactor { nearest(items: Interactable[]): Interactable|null }` — range `TUNING.player.interactRangeM`, facing-cone 60°. `prompt.ts`: single DOM element, `showPrompt(verb: 'KNEEL'|'READ'|'TAKE'|'OPEN'|'SPEAK', target?: string)` / `hidePrompt()`. F9 = `screenshot.ts` downloads canvas PNG to `docs/shots/` naming `shot-<zone>-<timestamp>.png` (dev only).
- Consumes: Task 4 collider, Task 3 Game/bus.

- [ ] **Step 1:** Failing tests (pure math): WASD vector rotates with yaw (yaw=90° + 'w' → -x motion); pitch clamps; interactor picks nearest in-cone item only.
- [ ] **Step 2:** Run → FAIL → implement → PASS.
- [ ] **Step 3:** Wire into main.ts test zone; manual walk-around; commit `feat(player): fp controller, interactor, prompts`.

### Task 8: Brand system (embers, pulse, hollowing, kneel) + save

**Files:**
- Create: `src/player/Brand.ts`, `src/save/save.ts`, `src/ui/brandHud.ts`
- Test: `src/player/__tests__/brand.test.ts`, `src/save/__tests__/save.test.ts`

**Interfaces:**
- Produces:
  - `class Brand { embers: number; readonly hollow: boolean; damage(n: number): void; rekindle(bannerId: string): void; pulseFor(distM: number|null): number; tick(dt: number, nearestEnemyM: number|null, nearestIllusoryM: number|null): void; }` — damage emits `ember-lost` per ember then `player-hollowed` at 0; hollow blocks damage (beneath notice); `pulseFor`: 0 beyond `pulseRangeM`, else `1 - d/range` eased, drives `brand-pulse` events + `PS1Pipeline.setDesaturation(hollow ? 1 : hollowDesatRamp[maxEmbers - embers])`; illusory proximity < `illusoryFlickerRangeM` sets `pulse.blue = true` on the HUD.
  - `interface SaveData { version: 1; zone: ZoneId; bannerId: string; embers: number; flags: GameFlag[]; endingsSeen: EndingId[]; loreRead: string[]; visionsSeen: string[]; ngPlus: boolean; }`
  - `saveGame(d: SaveData): void; loadGame(): SaveData|null; clearSave(): void` — localStorage key `oathbrand.save.v1`; unknown version → return null (fresh start), never throw.
  - `brandHud.ts`: bottom-center sigil (SVG flame with N ember segments), pulse animation scale/glow by intensity, blue tint flag, grayscale when hollow. (Placeholder visual now; frontend-design pass in Task 18.)
- Consumes: bus (Task 3), pipeline desat (Task 2).

- [ ] **Step 1:** Failing tests: 5 embers → damage(2) → 3 + two `ember-lost`; damage to 0 → `player-hollowed`, hollow=true, further damage no-ops; rekindle restores 5 + emits `player-rekindled` + saves; pulseFor(12)=0, pulseFor(0)=1, monotonic; save round-trip equality; corrupted JSON → null; version 99 → null.
- [ ] **Step 2:** Run → FAIL → implement → PASS. Commit `feat(brand): ember health, pulse radar, hollowing, saves`.

### Task 9: Combat kit + enemy FSM base + Hollow Soldier

**Files:**
- Create: `src/player/Combat.ts`, `src/entities/Enemy.ts`, `src/entities/Soldier.ts`, `src/entities/animator.ts`
- Test: `src/player/__tests__/combat.test.ts`, `src/entities/__tests__/fsm.test.ts`

**Interfaces:**
- Produces:
  - `class Combat { update(dt): void; tryLight(): boolean; tryHeavy(): boolean; tryGuard(down: boolean): void; tryStep(): boolean; state: 'idle'|'windup'|'active'|'recover'|'guard'|'step'; hitArc(): {origin: Vec2, dirYaw: number, arcDeg: number, rangeM: number, damage: number}|null; }` — timings/specs from `TUNING.player`; `hitArc()` non-null only during `active`.
  - `abstract class Enemy { state: 'idle'|'alert'|'approach'|'attack'|'recover'|'reposition'|'dead'; hp: number; pos: Vector3; update(dt, ctx: EnemyCtx): void; takeHit(damage: number): void; }` where `EnemyCtx = { playerPos: Vector3; playerHollow: boolean; collider: GridCollider; canSeePlayer: boolean }` — hollow player ⇒ all states collapse to `idle` (beneath notice). Death emits `enemy-slain` + spawns ember wisp (`ember-gained` if embers<max: +1 per 3 kills, counter in Brand).
  - `Soldier extends Enemy` — straight-line steer with wall-slide (reuse `GridCollider.slide`), aggro on sight within `aggroM` (raycastWall los), telegraphed attack (windup→active hit-test circle vs player radius→recover).
  - `animator.ts`: `playClip(mixer, name, fadeMs)` mapping FSM state→KayKit clip names (`Idle`, `Walking_A`, `1H_Melee_Attack_Chop`, `Hit_A`, `Death_A` — verify exact names against the pack in Step 3 and correct the map).
- Consumes: tuning (T3), collider (T4), bus (T3), brand (T8 — player-hit → `brand.damage`).

- [ ] **Step 1:** Failing tests (fixed-step, no three renderer): light attack: no hitArc during windup, hitArc during active with damage 1; guard while enemy active-hit ⇒ player takes 0 embers and gets shoved `guardShoveM`; soldier FSM: idle→alert on los+range, →attack in range, →idle when player hollow mid-approach; takeHit(3)→dead emits enemy-slain exactly once.
- [ ] **Step 2:** Run → FAIL → implement → PASS. Commit.
- [ ] **Step 3:** Wire soldier w/ skeleton GLB + animation map into test zone; manual fight check (feel pass: adjust tuning only in tuning.ts). Commit `feat(combat): player kit + soldier`.

### Task 10: Archer, projectile, Brand-Wraith

**Files:**
- Create: `src/entities/Archer.ts`, `src/entities/Wraith.ts`, `src/entities/Projectile.ts`
- Test: `src/entities/__tests__/archer.test.ts`, `src/entities/__tests__/wraith.test.ts`

**Interfaces:**
- Produces: `Archer extends Enemy` (keeps `repositionM` distance, `reposition` state strafes to maintain range, shot = `Projectile` {pos, dir, speedM, damage} straight-line, blocked by walls, guardable); `Wraith extends Enemy` — `visible` getter driven by brand pulse intensity >0.15 (material opacity = intensity), lunge attack, always triggers pulse regardless of range cap (`pulseFor` override: wraiths report min(dist, pulseRangeM-ε)).
- Consumes: Enemy base (T9), Brand pulse (T8).

- [ ] **Step 1:** Failing tests: archer enters reposition when player < repositionM; projectile stopped by `raycastWall`; wraith opacity 0 when pulse 0; wraith lunge only from alert with los.
- [ ] **Step 2:** FAIL → implement → PASS → commit `feat(entities): archer + brand-wraith`.

### Task 11: Zones 1–2 — Ashen Gate (vista) + Great Hall (hub)

**Files:**
- Create: `src/content/zones/ashenGate.ts`, `src/content/zones/greatHall.ts`, `src/content/zones/index.ts`
- Test: `src/content/__tests__/zones.test.ts` (structural validation for ALL zones as they land)

**Interfaces:**
- Produces: `ZONES: Record<ZoneId, ZoneDef>`; structural test suite validates every registered zone: exactly one `S`, grid rows equal length, all door `to` targets exist, banner present where spec requires, lore ids unique game-wide.
- Consumes: ZoneDef (T4), builder (T6).

Zone layouts (grids are the actual content — copy verbatim; `1`..`4` = door anchors keyed in each def):

```
ashen-gate (outdoor court; vista trigger at V-row facing north)
############
#..........#
#..S....B..#
#..........#     doors: 1→great-hall
#...####...#     lore: gate-plaque, herald-corpse (2)
#...#..#...#     enemies: 2 soldiers (NG+: 3, moved)
#..........#     vista: entering row 1 cols 3-8 first time → scripted 2.5s
#....11....#            camera raise + fog far 12→28 ease + music swell
############

great-hall (hub)
##################
#....2..........3#
#................#   doors: 1→ashen-gate  2→undercroft(drop)  3→ramparts(stairs)
#..####....####..#          4→throne (lock 'throne')  5→shortcut from ramparts
#..#..........#..#          (lock 'shortcut', opens Great-Hall side on flag)
#..#....B.....#..#   banner: yes (vision 2)
#..####....####..#   lore: 3 · enemies: 3 soldiers + 1 archer (NG+: +1 wraith)
#.....4....5.....#
#........S.......#
#........1.......#
##################
```

- [ ] **Step 1:** Failing structural tests → register both zones → PASS.
- [ ] **Step 2:** Stage the **vista (Clip #1)**: scripted `VistaDirector` in ashenGate def (`onFirstEnter` hook in ZoneDef, generic `scripted?: ScriptStep[]` field) — fog far-plane lerp, camera Y +0.8, ambience layer swell trigger. Manual: capture `docs/shots/clip1-vista.png` + 9:16 crop check.
- [ ] **Step 3:** Commit `content(zones): ashen gate + great hall with vista direction`.

### Task 12: Zones 3–4 — Undercroft (Gatekey, wraiths) + Ramparts (shortcut)

**Files:**
- Create: `src/content/zones/undercroft.ts`, `src/content/zones/ramparts.ts`

**Interfaces:** consumes everything prior; produces flags `gatekey` (lore-item pickup type `key`), `shortcut-open` (door-open event on ramparts side sets flag → great-hall door 5 unlocks permanently).

```
undercroft (dark: no torches in E half; wraith showcase = Clip #2)
##############
#....#...#...#
#.5..#.W.#.K.#   K = Gatekey pedestal · W = wraith spawns ×3 (NG+ ×4)
#.####...###.#   5 = illusory wall → queens-garden (lock 'illusory' + 'ngplus')
#....#.#.....#   banner near entry (vision 3) · lore: 4 (incl. maren-litany)
#.B..#.#..####   door 1 = broken-stair up to great-hall (one-way in via drop)
#....1.#...S.#   torch lights: 2, W-half only. Ambient light floor: 0.06
##############

ramparts (exterior wind; archers; ends at shortcut gate = the loop-back)
####################
#S...........#.....#
#...#####....#..5..#   5 = shortcut gate (kick-open interact, sets 'shortcut-open',
#...#...#....#.....#       one-way until opened) → Clip: gate kick + hall reveal
#.B.#...#..........#   banner (vision 4) · enemies: 2 archers + 1 soldier
#...#####......###.#   lore: 3 (incl. callun-post-log) · wind ambience, banner cloth
#..................#   props: banner.glb ×6 along south wall
####################
```

- [ ] **Step 1:** Register zones, structural tests PASS. Wire Gatekey pickup (`TAKE` → flag + inscription card) and shortcut interact (`OPEN` → flag, door swings, emit door-opened).
- [ ] **Step 2:** Undercroft darkness pass: verify wraith fade-in against pulse (Clip #2) — shot `clip2-pulse.png`. Ramparts loop-back manual run: gate → hall in <10s walk. Commit `content(zones): undercroft + ramparts, gatekey + shortcut loop`.

### Task 13: Inscription/lore system + all lore content + Ash-Priest dialogue

**Files:**
- Create: `src/ui/inscription.ts`, `src/content/lore.ts`, `src/entities/AshPriest.ts`, `src/content/dialogue.ts`
- Test: `src/content/__tests__/lore.test.ts`

**Interfaces:**
- Produces: `LORE: Record<string, {title: string, body: string, ngOnly?: boolean}>` — **write all ~25 entries + 8 NG+ entries as real content** (voice: terse, litany-like; several explicitly reference series beats: the cliff of embers, the oath spoken, the ride to battle). `inscription.ts`: full-screen DOM overlay (Game state `reading`), typewriter-in, `lore-read` on close. `AshPriest`: static robed figure (statue-knight.glb retextured), interact `SPEAK` → `dialogue.ts` sequences `ashpriest-1|2|3` (state `dialogue`), placement per spec zones; line 3 varies by `endingPending(flags)` helper (returns 1|2|3-track).
- Consumes: prompt/interactor (T7), Game states (T3).

- [ ] **Step 1:** Failing tests: every zone `LoreSpot.loreId` resolves into `LORE`; no duplicate ids; ngOnly entries only placed in `ngPlus` variant spots; `endingPending` truth table.
- [ ] **Step 2:** Write ALL lore + 3 dialogue sequences (content work — do it properly, ~700 words total). PASS tests. Commit `content(lore): 33 inscriptions + ash-priest dialogues`.

### Task 14: Banner kneel ritual + visions player

**Files:**
- Create: `src/player/Kneel.ts`, `src/engine/VisionPlayer.ts`, `src/content/visions.ts`
- Test: `src/engine/__tests__/visions.test.ts`

**Interfaces:**
- Produces: kneel interact at banners → 4s uninterruptible sequence (input locked, camera sinks 0.5m, brand rekindles, save fires, motif audio cue id `motif-kneel`); FIRST kneel per banner additionally plays its vision: `VisionPlayer.play(v: VisionDef)` where `VisionDef = { id: string; steps: Array<{desatTo?: number; fogFar?: number; spawnGhosts?: GhostSprite[]; caption?: string; waitMs: number }> }` — ghosts are billboard sprites of courtiers/knights (kit skeletons, additive material, opacity 0.35), color bleeds back via `setDesaturation` REVERSE (0.82→0) then snaps to ash on end. 6 visions authored in `visions.ts` (one per banner: gate, hall, undercroft, ramparts, throne, + queens-garden NG+) — **write real captions** (one line each, the tragedy in sequence: the flame guttered → the oaths died → Callun opened the gate → the queen knelt alone → the herald ran → the garden kept her brand).
- Consumes: Brand.rekindle (T8), PS1 desat (T2), Game state `vision` (T3).

- [ ] **Step 1:** Failing tests: vision plays once per id (persisted via save `visionsSeen`); kneel during combat allowed but does not clear enemies; input locked during vision; steps advance by waitMs on fixed ticks.
- [ ] **Step 2:** FAIL → implement → PASS. Stage **Clip #3** (kneel ritual at great-hall banner) — shot `clip3-kneel.png`. Commit `feat(ritual): kneel + banner visions`.

### Task 15: Throne Room + the Forsworn boss + Summit + endings

**Files:**
- Create: `src/content/zones/throne.ts`, `src/content/zones/summit.ts`, `src/entities/Forsworn.ts`, `src/engine/endings.ts`, `src/ui/titleCard.ts`
- Test: `src/entities/__tests__/forsworn.test.ts`, `src/engine/__tests__/endings.test.ts`

**Interfaces:**
- Produces:
  - `throne` zone: arena 16×12, banner immediately before arena gate (vision 5), boss gate locks behind player on entry until `forsworn-dead`.
  - `Forsworn extends Enemy`: phases from `TUNING.enemies.forsworn.phaseAt`; P1 mirrors player kit (light/heavy telegraphs); P2 adds dark-flame trail (persistent floor hazards 3s, damage 1 on touch); P3 extinguishes arena torches (lights lerp to 0.03) — his position readable ONLY via brand pulse; tracks `guardedNever: boolean` across fight → drops `callun-tachi` (flag + pickup) if player never guarded; on player hollow mid-fight: stops, faces away, arena gate opens (test this).
  - `titleCard.ts`: full-bleed DOM card (state stays `playing`, input free): used for boss intro `THE FORSWORN, FIRST KNIGHT OF VAEL` (**Clip #4**) and endings.
  - `endings.ts`: `selectEnding(i: {hollow: boolean; choice: 'give'|'keep'|null; hasQueensBrand: boolean}): EndingId` — hollow→3 (choice ignored); give+hasQueensBrand→4; give→1; keep→2. Summit scene: dragon staging (fog 6m; scale wall + jaw + one 2.2m eye w/ slow open animation = **Clip #5**; eye stays shut for ending 3), choice via two interactables (`GIVE THE CROWN` at the flame / walk-away trigger at the stair with confirm prompt), ending sequences (desat/embers-rise particle pass for E1; hard cut card E2; silence+fade E3; dragon-speaks caption sequence E4 — write the dragon's 4 lines), then credits roll (DOM), `ending-reached`, endings tracker persisted, return to title.
- Consumes: everything prior.

- [ ] **Step 1:** Failing tests: forsworn phase transitions at 16/8 hp; P3 only in P3 torches out; noguard tracking flips on first guard; endings truth table (6 cases incl. hollow+give→3, give+brand→4).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Stage + verify Clips #4 and #5 (`clip4-forsworn.png`, `clip5-dragon.png`, 9:16 checks). Full run: gate→ending 1 achievable. Commit `feat(boss+endings): forsworn, summit, four-ending logic`.

### Task 16: NG+ — Second Vigil variants, anomalies, Queen's Garden, Ending 4 path

**Files:**
- Create: `src/world/ngplus.ts`, `src/content/zones/queensGarden.ts`, `src/content/anomalies.ts`
- Test: `src/world/__tests__/ngplus.test.ts`

**Interfaces:**
- Produces:
  - `NgPlusVariant` (per-zone in ZoneDef): `{ enemySwaps: EnemySpawn[]; addedLore: LoreSpot[]; anomalies: AnomalyId[] }`; `applyNgPlus(def: ZoneDef): ZoneDef` pure merge, tested.
  - `anomalies.ts`: 12 hand-authored `Anomaly = {id, zone, apply(built: BuiltZone): void}` — statue rotY flip; second moon sprite (ramparts/summit skybox); pre-burning banner (gate); extra door silhouette that isn't passable (hall); throne occupied by ash figure; wraith standing still watching (undercroft); etc. Full list authored here with exact zone/positions.
  - `queens-garden` zone (12×10, no enemies, overgrown props, the queen's guttered brand pickup → flags `queens-brand`+`garden-found`, banner w/ NG+ vision 6, 3 ngOnly lore).
  - Title CONTINUE post-any-ending → "KEEP THE VIGIL AGAIN" → save resets zone/flags but keeps `endingsSeen`, `loreRead`, sets `ng-plus`.
- Consumes: zone defs (T11/12/15), lore ngOnly (T13), endings (T15).

- [ ] **Step 1:** Failing tests: applyNgPlus swaps enemies + injects lore, idempotent; garden door passable only with ng-plus flag; ending-4 reachable state machine walk (flags: ng-plus → garden-found → queens-brand → choice give → 4).
- [ ] **Step 2:** FAIL → implement → PASS. Manual NG+ run: ≥8 anomalies verified visible. Commit `feat(ngplus): second vigil, anomalies, queens garden, true ending`.

### Task 17: Audio — full pass

**Files:**
- Create: `src/audio/AudioManager.ts`, `scripts/fetch-audio.sh`, update `assets/LICENSES.md`
- Test: `src/audio/__tests__/mixer.test.ts` (pure gain math)

**Interfaces:**
- Produces: `AudioManager { init(afterGesture: true): void; setZoneLayers(ids: string[]): void; setThreat(t: number): void; cue(id: 'motif-kneel'|'swell-vista'|'card-boss'|'ending-1'|...): void; positional(mesh, id): void; }` — 2 ambient layers/zone crossfade 2s; `setThreat` (from brand pulse) ducks ambience −9dB and raises heartbeat layer rate 60→110bpm mapped to intensity; ConvolverNode stone reverb (generated impulse — script a 1.8s exponential-decay noise IR, no download needed); lowpass on occluded positional sources (raycastWall). Fetch CC0: OpenGameArt "Loopable Dungeon Ambience", "CC0 Dark Music" tracks, wind loop, sword/hit/bow SFX from Sonniss/freesound-CC0 — exact files chosen at fetch time, each row added to LICENSES.md. Heartbeat: synthesize (two-oscillator thump via WebAudio, no sample needed).
- Consumes: bus events (all), zones' `ambience` ids.

- [ ] **Step 1:** Failing tests: threat 0→ambience gain 1.0/heart 0; threat 1→ambience 0.35/heart 1; crossfade math monotonic.
- [ ] **Step 2:** FAIL → implement → PASS. Manual: full-run soundscape check. Commit `feat(audio): layered dread mixer + positional + cc0 pack`.

### Task 18: UI/UX polish phase — menus, HUD final, title cards, settings ⚠️ ANNOUNCE: owner re-enables ui-ux-pro-max NOW

**Files:**
- Create: `src/ui/title.ts`, `src/ui/pause.ts`, `src/ui/settings.ts`, `src/ui/endingsTracker.ts`; Modify: `src/ui/brandHud.ts`, `src/ui/titleCard.ts`, `src/ui/inscription.ts`, `src/style.css`

**Interfaces:**
- Consumes: everything; **REQUIRED SUB-SKILL: frontend-design** (and ui-ux-pro-max if enabled) for every surface in this task.
- Produces: title screen (OATHBRAND wordmark, BEGIN/CONTINUE/KEEP-THE-VIGIL-AGAIN/SETTINGS, ash particles, ember palette, ?/?/?/? endings tracker); pause (resume/settings/quit); settings (volumes ×3, sensitivity, invert-Y, render scale 320/480, CRT toggle, reduced-flicker, text size) persisted `oathbrand.settings.v1`; final brand HUD (replace placeholder); inscription + title-card typography pass. Design language: FromSoft restraint — serif smallcaps (embed one OFL font, add license row), thin rules, ember-on-void, NO buttons-with-borders.

- [ ] **Step 1:** Invoke frontend-design skill; design tokens first (CSS custom props: `--ash --ember --blood --void`, type scale), then each surface.
- [ ] **Step 2:** Settings apply live (pipeline width, CRT, flicker-safe wired to T2 setters; volumes to T17). Manual pass on all states + mobile layout. Commit `feat(ui): full interface pass`.

### Task 19: Playwright smoke + full playtest + tuning

**Files:**
- Create: `e2e/smoke.spec.ts`, `docs/PLAYTEST.md`; Modify: `.github/workflows/ci.yml`

- [ ] **Step 1:** Playwright (chromium, CI only — local sandbox kills headless): loads `/`, canvas present, WebGL context non-null, click BEGIN → state playing within 10s (expose `window.__oathbrand.state` in dev/CI builds), no console errors. Wire into CI before deploy.
- [ ] **Step 2:** `docs/PLAYTEST.md` checklist: all 4 endings; all 6 visions; gatekey + shortcut + illusory walls; hollow-mid-boss behavior; NG+ anomaly count ≥8 visible; mobile run; reduced-flicker run; save-quit-resume at every banner; 60fps + <100 calls per zone (dev HUD). Execute fully, fix all P0s, tune feel in tuning.ts. Commit per fix.

### Task 20: README, repo polish, release

**Files:**
- Create/Modify: `README.md`, `docs/shots/` finals, `.github/ISSUE_TEMPLATE/` (bug/feedback), repo topics/description.

- [ ] **Step 1:** README as landing page (frontend-design sensibility): PLAY link first (`https://<owner>.github.io/oathbrand/`), GIF of Clip #1 above fold (record via browser + gif tooling; ffmpeg palette pipeline), screenshot strip (clips 2–5), pitch (2 lines), controls table, "Four endings. The fourth is not on the first vigil." tease, HOW IT WAS MADE (PS1 pipeline link, AI-assisted pipeline note, series cross-link), license + credits (every CC0 pack).
- [ ] **Step 2:** `src/ps1/README.md` final pass; repo description "A 30-minute PS1-style dark fantasy. The kingdom is dead. The oath is not."; topics: threejs, ps1, game, dark-fantasy, webgl. Verify Pages build = final. Tag `v1.0.0`, GitHub Release with shots. Commit `docs: release-grade README`.

---

## Day map (Max window closes 2026-07-09)

- **D1 (7/1):** T1–T4 · **D2:** T5–T7 · **D3:** T8–T10 · **D4:** T11–T13 · **D5 (7/5):** T14–T15 · **D6:** T16–T17 · **D7:** T18–T19 · **D8 (7/8):** T19 finish–T20 + slack. Behind ⇒ apply cut line (Global Constraints).

## Self-review notes (done)

- Spec coverage: §3 brand→T8; §4/4b endings+NG+→T15/16; §5 zones→T11/12/15/16; §6 combat→T9/10/15; §7 pipeline→T2; §8 assets/audio→T5/17; §9 clips→T11(1) T12(2) T14(3) T15(4,5); §10 UI/access→T7/18; §11 arch→T3/4/6; §12 perf→T6 HUD+T19; §13 tests→per-task+T19; §14 repo→T1/T20. Gap check: none open.
- Type consistency: tuning names, event names, flag names, zone ids cross-checked across tasks.
- No placeholders: lore/visions/dialogue marked as REAL content work inside T13/T14 with word budgets; asset exact-names pinned in T5.
