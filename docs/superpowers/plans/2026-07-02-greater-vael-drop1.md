# Greater Vael Drop 1 — The Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Greater Vael Drop 1 — "The Fields": four exterior zones (~35–45 min) that attach to the beaten castle at the Ashen Gate, an outdoor zone engine (height layer, instanced forests, sky/moon/ash), a data-driven `DreadDirector` scare system with a four-tool screen-effect kit, two new killable enemies (Ash-Hound, Kneeling Hollow), two never-killable presences (the Watcher, the Hag of the Fog-Line), the tithe story spine, a v1→v2 save migration, and two hero clips — all on branch `feat/greater-vael`.

**Architecture:** Additive to v1. New content is pure-data (ZoneDefs + satellites) + pure-logic classes (DreadDirector, WatcherPresence, HagBargain, AshHound, KneelingHollow FSMs) that are vitest-tested headless, plus thin renderer/main wiring. The scare language is one glitch metaphor ("the engine notices IT") driven ONLY through the existing `PS1Pipeline` / `patchMaterial` / `mixer` setters — no new render pass. Collision stays the v1 2D 2 m `GridCollider` (no jump); the height layer is a visual y-lerp. Castle zones are byte-for-byte untouched.

**Tech Stack:** three@^0.183, vite@^6, typescript@^5 (strict), vitest@^3, playwright (CI smoke). No new runtime dependency; all new audio synthesized on the existing `AudioManager`; all new art from CC0 kits (KayKit/Quaternius pine) declared in `assets/LICENSES.md`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-greater-vael-drop1-design.md` — every task obeys it; the implementer never re-reads it (all content is copied into the tasks below).
- **Perf budgets unchanged from v1 §12 / spec §11:** <100 draw calls; ≤4 dynamic lights per zone; no realtime shadows; 320×240 render target (setting 480×360); visible tris <100k. Instanced trees/grass = 1 draw call per kind; fog culls the far field.
- **Fog rules (spec §4):** exterior `fogFarM` default = 16 (the existing `DEFAULT_FOG_FAR`); Ashen Gate stays 12 (untouched); dense-forest cells stack toward ~13 via tree occlusion; `fogCells` low-fog scare cells are 10–12 m and are the ONLY places aggro may exceed visual range — each MUST pair with an audio tell.
- **DreadDirector hard rules (spec §5, all enforced in code + unit-tested):** (1) ≥90 s between ANY two scares — one shared cooldown across all types incl. Watcher/Hag; (2) never during combat (no enemy in alert/approach/attack near player); (3) scares never deal damage — `damage === 0` always; (4) banners / kneel-safety NEVER spoofed; (5) each gimmick used 1–2×/drop (usage counters, capped); (6) ~10 scare beats total; (7) false brand-pulse ≤1–2/zone, which visit is per-run seeded; (8) every screen-effect scare has a reduced-flicker fallback (keeps the held component, strips per-frame-random); (9) one glitch metaphor — vertex-snap spike, one-frame resolution drop, desaturation stab, silence spike — driven through the existing PS1/patchMaterial/mixer APIs only.
- **Tall-entity directive (spec §6, every new humanoid):** height 2.3–2.65 m vs 1.7 m player (Watcher is the deliberate 3.0 m exception); elongation in limbs/neck not torso; underfed frames; faces crunched/obscured, never almost-real; stepped ~12 fps animation while the world renders smooth; must pass the silhouette test (flat-black vs fog color at intended sighting distance reads "person-shaped but wrong").
- **Flicker-safe requirement (spec §11):** all four gimmicks are held/static timelines (coarse-grid held, render-step held, colour-grade held, silence held) — `setFlickerSafe(true)` strips any per-frame-random layer; the false brand-pulse respects the existing reduced-flicker flash cap; stepped 12 fps entity animation is motion not strobe (not gated).
- **CC0-only art / MIT code:** every new asset gets a row in `assets/LICENSES.md` (source URL + license). Trees darkened toward the ash/ember palette.
- **TS strict; no `any`** except three.js shader `onBeforeCompile` internals. Bundle stays <1.5 MB gz excl. assets.
- **All tuning in `src/content/tuning.ts`** — the `TUNING.greaterVael` block (Task 1). Timeline constants for the scare kit live as named module consts (matching `world/vista.ts`'s `VISTA_*` convention), never as magic numbers in systems.
- **Supersession (spec §2):** the v1 non-goal "jump-scare horror design" is superseded FOR GREATER VAEL ZONES ONLY. Castle zones (ashen-gate, great-hall, undercroft, ramparts, throne, summit, queens-garden) keep v1 behavior exactly — no scares, no DreadDirector, no fog changes.
- **Commits:** conventional (`feat:`, `fix:`, `test:`, `content:`, `chore:`, `docs:`); commit after every green test cycle; each exact message is given per task.
- **Screenshots:** every zone/scene task ends with a screenshot saved to `docs/shots/` (dev screenshot key F9) and a 9:16 crop sanity check for clip-bearing zones.

## Core shared interfaces (defined once in Task 1, consumed by all later tasks)

```ts
// src/content/types.ts — ADD to the existing unions (never renumber v1 members)
export type ZoneId =
  | 'ashen-gate' | 'great-hall' | 'undercroft' | 'ramparts' | 'throne' | 'summit' | 'queens-garden'
  | 'gate-fields' | 'ashen-forest-n' | 'cinder-village' | 'pilgrims-descent'  // Drop 1
  | 'salt-road';                                                              // Drop 2 target (FUTURE_ZONE_IDS)
export type EnemyKind = 'soldier' | 'archer' | 'wraith' | 'forsworn' | 'hound' | 'kneeler';
export type GameFlag =
  | 'gatekey' | 'shortcut-open' | 'throne-open' | 'forsworn-dead' | 'forsworn-noguard'
  | 'queens-brand' | 'garden-found' | 'ng-plus' | 'callun-tachi' | 'wraith-hunt-done'
  | 'greater-vael-open' | 'hag-tithed' | 'hag-ledger-given' | 'hag-kneeled' | 'tithe-ledger';

// src/world/zoneDef.ts — NEW satellite types + ZoneDef fields (defaults keep v1 zones identical)
export type ExteriorSky = 'field' | 'forest' | 'gorge';
export interface FogCellBand { cells: GridPos[]; farM: number; }        // low-fog scare cells (10–12 m)
export type ScareGimmick = 'snap-grid' | 'resolution-drop' | 'desaturation' | 'silence-spike'
  | 'false-pulse' | 'watcher' | 'hag-glimpse' | null;                    // null = pure-visual
export type ScareTrigger =
  | { on: 'cellEnter'; cells: GridPos[] }
  | { on: 'approach'; at: GridPos; withinM: number }
  | { on: 'brandPulse'; at: GridPos; withinM: number }
  | { on: 'kneel'; at?: GridPos }
  | { on: 'loreRead'; loreId: string }
  | { on: 'timer'; at: GridPos; minSec: number }
  | { on: 'seededClearing'; cells: GridPos[] }   // GF-2 per-run seeded false pulse
  | { on: 'vista'; vistaId: string };            // PD-1
export interface ScareBeat {
  id: string;                 // 'GF-1' … 'PD-2'
  zone: ZoneId;
  trigger: ScareTrigger;
  gimmick: ScareGimmick;
  showsWatcher?: boolean;     // AF-2, PD-1 manifest the Watcher when they fire
  oneLine: string;
}
export interface HagThresholdDef { at: GridPos; glimpseCells: GridPos[]; }
// ZoneDef gains (all optional; absent ⇒ v1 behavior):
//   kind?: 'interior' | 'exterior';           default 'interior'
//   heightGrid?: string[];                     same dims as grid, one digit '0'–'3' per cell
//   fogCells?: FogCellBand[];
//   exteriorSky?: ExteriorSky;
//   scares?: ScareBeat[];
//   watcherAnchors?: GridPos[];                sighting positions (may be off-grid backdrop)
//   hagThreshold?: HagThresholdDef;
```

Game states are unchanged (`'boot'|'title'|'playing'|'paused'|'reading'|'vision'|'dialogue'|'ending'`); the Hag bargain and scares run inside `'playing'`.

---

### Task 1: Types, tuning & exterior ZoneDef surface

**Files:**
- Modify: `src/content/types.ts` (extend `ZoneId`, `EnemyKind`, `GameFlag` exactly as in the shared-interfaces block above)
- Modify: `src/world/zoneDef.ts` (add `ExteriorSky`, `FogCellBand`, `ScareGimmick`, `ScareTrigger`, `ScareBeat`, `HagThresholdDef` types; add the seven optional `ZoneDef` fields)
- Modify: `src/world/zoneGraph.ts` (add lock kind `'greatervael'` → flag `'greater-vael-open'` in `LOCK_FLAG`)
- Modify: `src/content/tuning.ts` (append the `greaterVael` block, verbatim below)
- Modify: `src/content/zones/index.ts` (add `'salt-road'` to `FUTURE_ZONE_IDS`)
- Test: `src/content/__tests__/tuning-greatervael.test.ts`, extend `src/world/__tests__/zoneGraph.test.ts`

**Interfaces:**
- Produces: the extended unions + `ZoneDef` surface consumed by every later task; `TUNING.greaterVael` (below); `canPass(door, flags)` accepts a `'greatervael'`-locked door when `flags.has('greater-vael-open')`.
- Consumes: nothing new.

Append to `TUNING` (copy VERBATIM — names are load-bearing across Tasks 3–5):

```ts
  greaterVael: {
    hound: {
      hp: 2, speed: 2.6, aggroM: 13, alertMs: 500, leashMul: 1.5, heightM: 2.3,
      circle: { speedM: 3.4, radiusM: 6, minMs: 1400, maxMs: 3200, flankRandom: true },
      lunge:  { windupMs: 380, activeMs: 220, recoverMs: 900, speedM: 6.5, damage: 1, rangeM: 2.4 },
      animFps: 12,
    },
    kneeler: {
      hp: 3, speed: 1.7, aggroM: 10, wake: 'brand-pulse', heightM: 2.35,
      idle:  { breathScalePct: 0.8, headTiltMaxDeg: 6, tiltPeriodMs: 5200 },
      rise:  { holdMs: 700, firstStepMs: 900 },
      attack:{ windupMs: 700, activeMs: 200, recoverMs: 900, damage: 1, rangeM: 2.0 },
      inertRatio: 3, animFps: 12,
    },
    watcher: {
      heightM: 3.0, sightingRangeMinM: 16, despawnM: 10, maxVisibleSec: 4,
      sightingsPerDrop: { min: 3, max: 6 }, frozenWhileObserved: true,
      sharesScareCooldown: true, damage: 0, animFps: 0,
    },
    hag: {
      heightM: 2.5, glimpseRangeMinM: 16, recedeM: 10, damage: 0,
      fights: false, chases: false, speaks: false,
      animFps: 12,
    },
    dread: {
      minScareGapSec: 90, maxBeatsPerDrop: 10, falsePulsePerZoneMax: 2,
      gimmickUseMax: 2, watcherPerDropMax: 6,
    },
    exterior: { fogFarDefaultM: 16, lowFogCellM: 11, maxHeightStep: 3 },
  } as const,
```

- [ ] **Step 1:** Failing tests. `tuning-greatervael.test.ts`: `TUNING.greaterVael.dread.minScareGapSec === 90`; `.watcher.heightM === 3.0`; `.hound.circle.flankRandom === true`; `.exterior.fogFarDefaultM === 16`. Extend `zoneGraph.test.ts`: `canPass({id:'x',at:[0,0],to:'gate-fields',lock:'greatervael'}, new Set())` is `false`; with `new Set(['greater-vael-open'])` is `true`; `lockFlag('greatervael') === 'greater-vael-open'`.
- [ ] **Step 2:** Run `npx vitest run src/content/__tests__/tuning-greatervael.test.ts src/world/__tests__/zoneGraph.test.ts` → FAIL. Add the type members, the `LOCK_FLAG` entry, and the tuning block. Add `'salt-road'` to `FUTURE_ZONE_IDS` (so a Drop-2-targeting door validates before Salt Road ships). Run → PASS.
- [ ] **Step 3:** Add the new `ZoneDef` optional fields and satellite types (no default zone touches them, so `npx vitest run src/content/__tests__/zones.test.ts` stays green — verify). Run `npm run typecheck` → clean.
- [ ] **Step 4:** Commit `feat(world): exterior zonedef surface, greater-vael types + tuning`.

### Task 2: Exterior rendering — instanced forests, height ramps, sky/moon/ash

**Files:**
- Modify: `src/world/ZoneBuilder.ts` (exterior branch: tile→instance mapping, sky/moon, height ramps; `buildHeightRamps` pure helper)
- Modify: `src/world/ZoneManager.ts` (dispose `Points`/`Sprite`/`InstancedMesh` children so exterior ash/instances never leak; per-frame cell-height query)
- Create: `src/world/exteriorSky.ts` (gradient dome + moon + ash-fall builder)
- Modify: `src/main.ts` (player/camera y lerps to current cell height; apply `fogCells` per-cell fog; select sky preset)
- Modify: `assets/LICENSES.md` (KayKit/Quaternius pine + rock rows)
- Test: extend `src/world/__tests__/zoneBuilder.test.ts`; `src/world/__tests__/heightRamps.test.ts`

**Interfaces:**
- Produces:
  - Exterior tile→render convention (for `def.kind === 'exterior'`; collision is UNCHANGED — `def.tiles` still maps `,`/`p`/`t`→`floor`, `T`→`wall`):

    | Char | Collision (`def.tiles`) | Rendered as |
    |---|---|---|
    | `,` | floor | bare floor + one **grass** instance |
    | `p` | floor | bare floor, worn-path texture (no instance) |
    | `.` | floor | bare floor |
    | `t` | floor | bare floor + one **sparse-trunk** instance (walkable, partial occlusion) |
    | `T` | wall  | one **dense-tree** instance (blocks; NO castle `wall.glb`) |
    | `#` | wall  | one **dense-tree** instance (the treeline/field border; NO `wall.glb`) |
    | `H` | wall  | `wall.glb` ruin block (Cinder Village house block — a built structure) |
    | `~` | void  | nothing (the gorge) |

  - `buildHeightRamps(def: ZoneDef): { a: GridPos; b: GridPos; kind: 'ramp' | 'cliff' }[]` — pure. For each pair of orthogonally-adjacent cells where BOTH resolve to floor/door (walkable) and `|Δheight| === 1` → `ramp`; where `|Δheight| >= 2` (typically a walkable cell against a `~`/lower cell) → `cliff`. Height digit read from `def.heightGrid?.[r]?.[c] ?? '0'`. World y of a cell = `Number(digit) * HEIGHT_LEVEL_M`.
  - `ZoneBuilder.build` (exterior): after the (H/# handled) architecture pass, one grid scan emits three `InstancedMesh`es (grass, sparse-trunk, dense-tree) — 1 draw call each — parented to `built.group`; ramps/cliffs merged into a terrain bucket; `exteriorSky.ts` adds a gradient dome mesh + moon quad (both `Mesh`, `fog:false`) + an `AshFall` `Points` system, all children of `built.group`.
  - `built` gains `cellHeightM(row,col): number` (or expose `heightGrid`) so `main` lerps player/camera y.
- Consumes: Task 1 `ZoneDef` fields; existing `patchMaterial`, `mergeGeometries`, `GridCollider`.

Pin these module consts in `ZoneBuilder.ts` (no magic numbers):
```ts
const HEIGHT_LEVEL_M = 1.5;          // meters per height level (max 3 → 4.5 m descent)
const GRASS_KIND = 'grass-tuft';     // Quaternius/KayKit CC0 low-poly tuft
const TRUNK_KIND = 'pine-sparse';
const TREE_KIND = 'pine-dense';
```

- [ ] **Step 1:** Failing tests. `heightRamps.test.ts`: a 3×3 all-floor def with `heightGrid ['111','122','222']` yields a `ramp` on the single Δ1 seam and no `cliff`; a floor cell (h2) beside a `~` void cell (h0) yields a `cliff`; a flat `heightGrid` (all '0', the default) yields `[]`. Extend `zoneBuilder.test.ts`: an exterior def with `,`/`t`/`T` chars builds without throwing and produces exactly 3 instanced meshes named `grass-tuft`/`pine-sparse`/`pine-dense`; a `T` cell produces NO `merged:*` wall from `wall.glb`.
- [ ] **Step 2:** Run `npx vitest run src/world/__tests__/heightRamps.test.ts src/world/__tests__/zoneBuilder.test.ts` → FAIL. Implement `buildHeightRamps`, the exterior branch, `exteriorSky.ts`. Run → PASS.
- [ ] **Step 3:** `ZoneManager.disposeCurrent`: the anomalies.ts note warns the current teardown handles `Mesh + PointLight` only — extend it to also dispose `Points` and `Sprite` children (`geometry.dispose()` + material dispose), so exterior ash/instances never leak `renderer.info`. Add a unit test: build a stub `BuiltZone` whose group has a `Points` child with a spied `geometry.dispose`; `disposeCurrent` (via a `load`→`load` transition) calls it. (`InstancedMesh.isMesh === true`, already covered.)
- [ ] **Step 4:** `main.ts`: each frame set player eye y and camera y to lerp toward `built.cellHeightM(playerRow, playerCol) + TUNING.player.height` (collision xz unchanged — no jump); apply `def.fogCells` by overriding the scene fog far to the cell's `farM` while the player stands on a listed cell (paired audio tell is Task 6/10/12); pick the sky preset from `def.exteriorSky`.
- [ ] **Step 5:** Add CC0 pine/rock/grass rows to `assets/LICENSES.md`; darken tree textures toward the ash/ember palette in the existing `scripts/downsample-textures.mjs` pass. `npm run build` stays <1.5 MB gz (code). Commit `feat(world): exterior forests, height ramps, sky+moon+ash`.

---

### Task 3: DreadDirector + screen-effect scare kit ("the engine notices IT")

**Files:**
- Create: `src/engine/DreadDirector.ts` (pure scheduler — no three.js), `src/engine/ScreenScareKit.ts` (per-frame gimmick timelines — `Subsystem`)
- Modify: `src/engine/events.ts` — no union change needed (scares route through the open `{type:'cue';id}` handle + direct setter calls); add nothing.
- Modify: `src/main.ts` (tick both; composite desat; drive `setSnapResolution` / `setRenderScale` / `duckToSilence`; forced false-pulse)
- Test: `src/engine/__tests__/dreadDirector.test.ts`, `src/engine/__tests__/screenScareKit.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // ScreenScareKit — held/static timelines only (flicker-safe by construction).
  const SNAP_COARSE: [number, number] = [96, 72];  // spec §7 "320×240 → 96×72"
  const SNAP_MS = 500;                              // vertex-snap spike hold
  const RESDROP_MS = 900;                           // one-frame-drop beat hold
  const DESAT_PEAK = 0.9, DESAT_STAB_MS = 120, DESAT_EASE_MS = 1400; // stab then ease
  class ScreenScareKit implements Subsystem {
    snap(): void; resDrop(): void; desatStab(): void;
    update(dtMs: number): void;
    snapRes(): [number, number] | null;   // non-null while a snap is active
    renderDrop(): boolean;                 // true while a res-drop beat holds
    desatBoost(): number;                  // 0..1 envelope (peak then eased)
    setFlickerSafe(b: boolean): void;      // held components stay; strips any layered per-frame random
  }
  // DreadDirector — pure. rng is per-run seeded (main: mulberry32(runSeed)).
  interface DreadCtx {
    zone: ZoneId; cell: GridPos; dtMs: number;
    inCombat: boolean; brandPulse: number;
    events: { kind: 'loreRead'; loreId: string } | { kind: 'kneel' } | { kind: 'none' };
    vistaFiredId?: string;                 // set the frame a VistaDef fires (for PD-1)
  }
  type ScareActivation =
    | { kind: 'snap-grid' | 'resolution-drop' | 'desaturation' | 'silence-spike' | 'false-pulse'; beatId: string; oneLine: string }
    | { kind: 'pure-visual'; beatId: string; oneLine: string }
    | { kind: 'watcher'; anchor: GridPos; beatId?: string }
    | { kind: 'hag-glimpse'; beatId: string };
  class DreadDirector {
    constructor(
      scares: ScareBeat[], watcherAnchors: GridPos[], hag: HagThresholdDef | undefined,
      state: { glitchSeen: string[]; watcherSightings: number }, rng: () => number,
    );
    update(ctx: DreadCtx): ScareActivation[];   // 0 or 1 activation/frame (shared cooldown)
    get cooldownRemainingSec(): number;
    get beatsFired(): number;                    // ledger beats fired (cap maxBeatsPerDrop)
    get watcherSightings(): number;              // cap watcherPerDropMax
    snapshot(): { glitchSeen: string[]; watcherSightings: number }; // for the save
  }
  ```
- Consumes: `TUNING.greaterVael.dread`; `ScareBeat`/`HagThresholdDef` (Task 1); the existing `PS1Pipeline.setRenderScale/getRenderScale/setDesaturation/getDesaturation/setFlickerSafe`, `patchMaterial.setSnapResolution`, and a new `AudioManager.duckToSilence` (Task 6).

Scheduling rules the `DreadDirector` MUST enforce (each an assertion in Step 1):
1. **Shared cooldown:** after any activation, `cooldownRemainingSec = minScareGapSec (90)`; nothing fires while `> 0`. Watcher sightings and Hag glimpses consume it too.
2. **Never in combat:** `ctx.inCombat === true` suppresses ALL activations (cooldown not consumed).
3. **damage 0:** activations carry no damage field; the type makes a damaging scare unrepresentable.
4. **Banner never spoofed:** the director has no code path that targets a banner/kneel; assert no `ScareBeat` in a zone's `scares[]` may use a `{on:'kneel'}` trigger to spoof safety (a `kneel` trigger only *reads* the completed kneel; PD-2's false-ignition targets set-dressing across the gorge, never the player's banner — enforced by the beat data, not the director).
5. **Gimmick cap:** per-gimmick usage counter; a screen gimmick (`snap-grid`/`resolution-drop`/`desaturation`/`silence-spike`/`false-pulse`) at `gimmickUseMax (2)` cannot fire again.
6. **Beat ceiling:** `beatsFired` never exceeds `maxBeatsPerDrop (10)`.
7. **False-pulse:** `{on:'seededClearing'}` fires at most `falsePulsePerZoneMax` per zone AND only on the crossing the seed selects (`rng()`-chosen visit index); assert with a fixed rng it fires on the chosen visit and not others.
8. **Fidelity scarcity:** first fire of a gimmick records its id in `glitchSeen`; a repeat is still allowed (up to the cap) but flagged `everSeen` in the activation so the kit can render it shorter/weaker (main passes `everSeen` to shorten the hold ~30%).
9. **Watcher budget:** `watcherSightings` caps at `watcherPerDropMax (6)`; a `watcher` activation increments it; `showsWatcher` beats (AF-2, PD-1) increment it AND fire their gimmick in the same activation frame (two entries returned that one frame is allowed — they are the same beat).

- [ ] **Step 1:** Failing `dreadDirector.test.ts` (fixed rng, hand-built `ScareBeat[]`):
  ```ts
  const beats: ScareBeat[] = [
    { id: 'A', zone: 'gate-fields', trigger: { on: 'approach', at: [9, 3], withinM: 3 }, gimmick: 'silence-spike', oneLine: 'x' },
    { id: 'B', zone: 'gate-fields', trigger: { on: 'seededClearing', cells: [[6, 7]] }, gimmick: 'false-pulse', oneLine: 'y' },
  ];
  it('fires A on approach, then holds the 90s cooldown', () => {
    const d = new DreadDirector(beats, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    const near = { zone: 'gate-fields', cell: [9, 3], dtMs: 16, inCombat: false, brandPulse: 0, events: { kind: 'none' } } as const;
    expect(d.update(near).map(a => a.kind)).toEqual(['silence-spike']);
    expect(d.cooldownRemainingSec).toBeCloseTo(90);
    expect(d.update(near)).toEqual([]);            // still cooling
  });
  it('never fires in combat', () => {
    const d = new DreadDirector(beats, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    expect(d.update({ zone: 'gate-fields', cell: [9, 3], dtMs: 16, inCombat: true, brandPulse: 0, events: { kind: 'none' } })).toEqual([]);
    expect(d.cooldownRemainingSec).toBe(0);        // suppressed, not consumed
  });
  it('caps each gimmick at 2 and the drop at 10 beats', () => { /* fire 3 desat beats past 180s → third suppressed; beatsFired never > 10 */ });
  it('false-pulse fires only on the seeded visit', () => { /* rng picks visit 2; crossings 1,3 do not fire, 2 does; ≤ falsePulsePerZoneMax */ });
  it('watcher sightings increment and cap at 6', () => { /* 7 watcher activations → watcherSightings === 6 */ });
  ```
  Failing `screenScareKit.test.ts`: `snap()` → `snapRes()` returns `[96,72]` for `SNAP_MS`, then `null`; `resDrop()` → `renderDrop()` true for `RESDROP_MS`; `desatStab()` → `desatBoost()` rises to `DESAT_PEAK` within `DESAT_STAB_MS`, decays toward 0 over `DESAT_EASE_MS`, monotonic after peak; `setFlickerSafe(true)` leaves the held snap/res/desat values byte-identical (no per-frame random term to strip → assert two successive frames at the same elapsed produce equal outputs).
- [ ] **Step 2:** Run `npx vitest run src/engine/__tests__/dreadDirector.test.ts src/engine/__tests__/screenScareKit.test.ts` → FAIL. Implement both. Run → PASS.
- [ ] **Step 3:** `main.ts` wiring (integration, no new test — covered by Task 13 e2e):
  - Register `ScreenScareKit` as a `Subsystem`. Each frame, AFTER `Brand.tick` (which writes `pipeline.setDesaturation(brandRamp)`), composite: `pipeline.setDesaturation(Math.max(pipeline.getDesaturation(), kit.desatBoost()))`.
  - Compute the current snap target from `pipeline.getRenderScale()` (`240→[320,240]`, `360→[480,360]`) and call `setSnapResolution(...(kit.snapRes() ?? currentTarget))` each frame.
  - `renderDrop()` true → `pipeline.setRenderScale(240)` for the beat then restore prior scale (a no-op at the default 240 — the paired diegetic guttering carries CV-2; honest, harmless).
  - Route `DreadDirector.update(ctx)` activations: `snap-grid`→`kit.snap()`; `resolution-drop`→`kit.resDrop()`; `desaturation`→`kit.desatStab()`; `silence-spike`→`audio.duckToSilence(1200)`; `false-pulse`→ emit one `{type:'brand-pulse',intensity:1}` frame + `audio.setThreat(1)` (respects the reduced-flicker HUD flash cap); `pure-visual`→ show the authored one-shot (per-zone, Tasks 9–12); `watcher`→ `watcherPresence.manifest(anchor)` (Task 5); `hag-glimpse`→ `hag.glimpse()` (Task 5). Wire `setFlickerSafe` from the settings toggle into `kit.setFlickerSafe`.
  - Persist `director.snapshot()` into `save.greaterVael.glitchSeen`/`watcherSightings` at each kneel checkpoint.
- [ ] **Step 4:** Commit `feat(dread): dreaddirector scheduler + screen-effect scare kit`.

---

### Task 4: Killable enemies — Ash-Hound + Kneeling Hollow

**Files:**
- Modify: `src/entities/Enemy.ts` (add `'circle'` to the `EnemyState` union — additive; no v1 enemy references it, so v1 FSMs are unaffected)
- Create: `src/entities/AshHound.ts`, `src/entities/KneelingHollow.ts`
- Modify: `src/entities/animator.ts` (map `hound`/`kneeler` FSM states → clip names; stepped 12 fps sampling)
- Test: `src/entities/__tests__/ashHound.test.ts`, `src/entities/__tests__/kneelingHollow.test.ts`

**Interfaces:**
- Produces:
  - `class AshHound extends Enemy` — `EnemyKind 'hound'`, hp 2, all numbers from `TUNING.greaterVael.hound`. FSM: `idle → alert (alertMs) → approach → circle (minMs..maxMs, radiusM, RANDOMIZED side each cycle) → attack (lunge from the randomized flank, windup→active dash→recover) → (re-approach | leash at 1.5× aggroM)`. `circle` re-rolls side (`rng() < 0.5 ? +1 : -1`) and duration (`minMs + rng()*(maxMs-minMs)`) every cycle. Takes `rng: () => number` + `pantCue()` deps (main wires a distinct panting/footfall cue that does NOT scale with the brand-pulse, spec §9). Silhouette test (Step 4): flat-black at 13 m fog reads as a wrong four-legged thing with a too-long stride.
  - `class KneelingHollow extends Enemy` — `EnemyKind 'kneeler'`, hp 3, from `TUNING.greaterVael.kneeler`. FSM (mapped onto the base states): `idle`(dormant: near-imperceptible idle micro-motion — 0.8% breath-scale, 6° head-tilt every 5.2 s, driven in the view) `→ alert`(the RISE beat: `holdMs (700)` stillness at full height, then a wrong-tempo `firstStepMs (900)` first step) `→ approach`(pursue) `→ attack`(mirrors the soldier: windup 700 / active 200 / recover 900, damage 1, range 2.0) `→ recover`. Wakes on brand-pulse: exposes `wake()` (the scare beat calls it) AND auto-wakes when `pulse() > 0.15 && dist <= aggroM`. Takes `pulse: () => number` + `creakCue()` deps (a low bone-creak one-shot on rise). The **scarecrow variant** (Gate Fields GF-1) is the SAME class dressed as a field-ward — inert (stays `idle`) unless the brand pulses; zero new asset cost. Ratio rule (enforced in zone data, Tasks 9/11): ~1 live `kneeler` spawn per 2–3 inert kneeling PROPS; a checkpoint-banner kneel silhouette is NEVER a `kneeler`.
- Consumes: `Enemy` base (`EnemyCtx`, `EnemyDeps`, `MeleeDefense`), `GridCollider.slide`, `TUNING.greaterVael`.

- [ ] **Step 1:** Failing `ashHound.test.ts` (fixed-step, deterministic rng):
  ```ts
  it('idle → alert → approach → circle, re-rolling flank+duration each cycle', () => {
    const seq = [0.2, 0.9];                          // rng: first cycle left+short, next right+long
    const h = new AshHound({ id: 'h1', bus, hp: 2, rng: () => seq.shift() ?? 0.5, pantCue: () => {} });
    // ...drive alert (alertMs) → approach → circle; assert state==='circle', and that
    // the recorded circle side/duration differ between the two cycles (assert randomization).
  });
  it('lunges from the circle at rangeM, then recovers and re-approaches or leashes', () => { /* ... */ });
  it('leashes to idle past 1.5×aggroM', () => { /* ... */ });
  ```
  Failing `kneelingHollow.test.ts`:
  ```ts
  it('stays dormant (idle) until wake(): no attack while inert', () => {
    const k = new KneelingHollow({ id: 'k1', bus, hp: 3, pulse: () => 0, creakCue: () => {} });
    k.update(700, ctxNearPlayer); expect(k.state).toBe('idle');
    k.wake(); expect(k.state).toBe('alert');
  });
  it('rise holds holdMs still at full height, THEN takes the first step (alert → approach)', () => {
    const k = new KneelingHollow({ id: 'k2', bus, hp: 3, pulse: () => 0, creakCue: () => {} });
    k.wake();
    k.update(TUNING.greaterVael.kneeler.rise.holdMs - 16, ctxNearPlayer); expect(k.state).toBe('alert'); // still holding
    k.update(32 + TUNING.greaterVael.kneeler.rise.firstStepMs, ctxNearPlayer); expect(k.state).toBe('approach');
  });
  it('auto-wakes when the brand pulses within aggroM', () => { /* pulse:()=>0.5, dist<10 → alert */ });
  ```
- [ ] **Step 2:** Run `npx vitest run src/entities/__tests__/ashHound.test.ts src/entities/__tests__/kneelingHollow.test.ts` → FAIL. Add `'circle'` to `EnemyState`; implement both classes. Run → PASS. Confirm v1 enemy tests unaffected: `npx vitest run src/entities` → green.
- [ ] **Step 3:** Wire into `animator.ts` with KayKit skeleton/quadruped clips (verify exact clip names against the pack; correct the map): hound `idle/circle/attack` → a lope + lunge; kneeler `idle`(kneel-pose)/`alert`(rise)/`attack`. Sample every model frame to a stepped 12 fps grid (`Math.floor(t*12)/12`) so the entity stutters against the smooth world.
- [ ] **Step 4:** Silhouette-test both in a throwaway scene: render each flat-black against the fog color at its sighting distance (hound 13 m, kneeler ~6 m), confirm "person/beast-shaped but wrong" BEFORE any texture/rig polish; capture `docs/shots/gv-hound-silhouette.png`, `docs/shots/gv-kneeler-silhouette.png`. Proportions: elongate legs/neck, underfed frame, crunched face. Commit `feat(entities): ash-hound + kneeling hollow with tall-entity treatment`.

---

### Task 5: Never-killable presences — the Watcher + the Hag (bargain, not battle)

**Files:**
- Create: `src/entities/WatcherPresence.ts` (observation, not combat), `src/entities/HagPresence.ts` (glimpse + threshold), `src/content/hagBargain.ts` (pure bargain state machine)
- Test: `src/entities/__tests__/watcherPresence.test.ts`, `src/content/__tests__/hagBargain.test.ts`

**Interfaces:**
- Produces:
  - `class WatcherPresence` — NOT an `EnemyKind`; a DreadDirector presence. From `TUNING.greaterVael.watcher` (height 3.0 m — the deliberate exception; never approached, never shares door/corridor geometry). FSM: `absent → manifest (silhouette beyond the far-plane, FROZEN while inside the view frustum) → recede/despawn (player within despawnM 10, OR off-screen reposition)`. Never seen mid-stride (`animFps 0`, teleport-repositioned). Silhouette-only — a dark vertical against the fog gradient, never lit directly. `manifest(anchor: GridPos, observed: boolean): void`; `update(playerPos, camFrustum): void` (reposition ONLY when `!observed`; despawn when `distM <= despawnM`); `maxVisibleSec 4` auto-recede; `get visibleSightings(): number`. Identity is HELD for Drop 3 — reference the mystery, never the answer.
  - `class HagPresence` — NOT an `EnemyKind`. From `TUNING.greaterVael.hag` (height 2.5 m; `fights:false, chases:false, speaks:false`). FSM: `absent → glimpsed (at the fog-line; recedes if approached within recedeM 10 — same contract as the Watcher) → threshold-present (at the cairn `hagThreshold.at`: bargain available)`. Silent — communicates via carved inscriptions + gesture only (the Ash-Priest stays the only VOICE). Silhouette test: flat-black at 16 m reads as a stooped WOMAN, not a tall column — visually distinct from the Watcher's vertical. `glimpse(): void`; `atThreshold(playerCell: GridPos): boolean`.
  - `hagBargain.ts` — pure, tested:
    ```ts
    interface HagState { maxEmberCap: number; bargains: string[]; }   // mirrors save.greaterVael
    type Offering = 'ember' | 'ledger' | 'kneel' | 'decline';
    interface BargainResult {
      state: HagState;                       // NEW state (pure — never mutates input)
      boon:
        | { kind: 'fogline-part' }           // Ashen Forest N fogFar +6 m this visit + unseals PD lore cache
        | { kind: 'play-vision'; visionId: 'gv-vision-hag' }
        | { kind: 'answer-watcher' }         // resolves one held Drop-3 lore-line WITHOUT answering it
        | { kind: 'none' };
      flagsSet: GameFlag[];                  // 'hag-tithed' | 'hag-ledger-given' | 'hag-kneeled'
    }
    function offerToHag(offering: Offering, state: HagState, hasLedger: boolean): BargainResult;
    function restoreEmberCap(state: HagState): HagState;   // leaving Greater Vael / next Vigil → cap back to 5
    ```
- Consumes: `TUNING.greaterVael.watcher`/`.hag`; `HagThresholdDef` (Task 1); `VisionPlayer.play` + `gv-vision-hag` (Task 8); the brand's ember/max-ember state (`Brand`); `GameFlag`s.

The bargain table (spec §6.4 — encode each row EXACTLY):

| Offering | Cost | Boon | flagsSet |
|---|---|---|---|
| `ember` (place 1 live ember) | `maxEmberCap -= 1` (persists for Drop 1; `restoreEmberCap` on leaving Greater Vael / next Vigil) | `{kind:'fogline-part'}` — Ashen Forest N `fogFar +6` this visit + unseals the Pilgrim's Descent lore cache | `['hag-tithed']` |
| `ledger` (surrender the Cinder tithe-ledger; requires `hasLedger`) | ledger removed (its inscription already read; clears `tithe-ledger`) | `{kind:'play-vision',visionId:'gv-vision-hag'}` — colour bleeds back like a banner-vision | `['hag-ledger-given']` |
| `kneel` (kneel at the cairn with a full brand) | nothing now — seeds a Second-Vigil anomaly, legible only in hindsight | `{kind:'answer-watcher'}` — the next Watcher glimpse is "answered": resolves one held Drop-3 lore-line without answering it | `['hag-kneeled']` |
| `decline` (turn away) | nothing | `{kind:'none'}` — she recedes; the threshold remains for a later visit | `[]` |

- [ ] **Step 1:** Failing `hagBargain.test.ts`:
  ```ts
  const base: HagState = { maxEmberCap: 5, bargains: [] };
  it('ember tithe lowers the cap by 1 and sets hag-tithed, fogline boon', () => {
    const r = offerToHag('ember', base, false);
    expect(r.state.maxEmberCap).toBe(4); expect(r.flagsSet).toEqual(['hag-tithed']);
    expect(r.boon).toEqual({ kind: 'fogline-part' }); expect(base.maxEmberCap).toBe(5); // input untouched
  });
  it('ledger requires the ledger; without it, no-op', () => {
    expect(offerToHag('ledger', base, false).boon).toEqual({ kind: 'none' });
    expect(offerToHag('ledger', base, true).boon).toEqual({ kind: 'play-vision', visionId: 'gv-vision-hag' });
  });
  it('kneel seeds hag-kneeled with no immediate cost', () => {
    const r = offerToHag('kneel', base, false);
    expect(r.flagsSet).toEqual(['hag-kneeled']); expect(r.state.maxEmberCap).toBe(5);
  });
  it('decline is a pure no-op', () => { expect(offerToHag('decline', base, false)).toMatchObject({ boon: { kind: 'none' }, flagsSet: [] }); });
  it('restoreEmberCap lifts the cap back to 5 on leaving', () => { expect(restoreEmberCap({ maxEmberCap: 4, bargains: ['hag-tithed'] }).maxEmberCap).toBe(5); });
  ```
  Failing `watcherPresence.test.ts`: manifest then `visibleSightings` increments; a repositions ONLY when `observed === false`; despawns (state `absent`) when player within `despawnM`; `maxVisibleSec` elapses → auto-recede; a counter passed in as `watcherSightings` is respected and never exceeds `watcherPerDropMax`.
- [ ] **Step 2:** Run `npx vitest run src/content/__tests__/hagBargain.test.ts src/entities/__tests__/watcherPresence.test.ts` → FAIL. Implement all three. Run → PASS.
- [ ] **Step 3:** Wire into `main.ts`: `WatcherPresence` rendered as a flat-black tall vertical (`figure()`-style dark mesh, unlit, `fog:true`) parented to the zone group at the anchor cell (off-grid anchors allowed — backdrop, like Ashen Gate's negative-row props); `HagPresence` as a stooped woman-silhouette. The bargain is an `Interactor` target at `hagThreshold.at` (verbs: `TITHE` / `GIVE LEDGER` / `KNEEL` / turn away) — surface the carved-inscription gesture, apply `offerToHag`, set flags, persist, and on `fogline-part` bump Ashen Forest N `fogFarM += 6` for the visit. Max-ember cap: `Brand` reads `save.greaterVael.maxEmberCap` for its rekindle ceiling; `restoreEmberCap` fires on the door out of Greater Vael and on `secondVigilSave`.
- [ ] **Step 4:** Silhouette + capture: Watcher `docs/shots/gv-watcher-silhouette.png` (a dark vertical vs fog), Hag `docs/shots/gv-hag-silhouette.png` (stooped, unmistakably a different shape). Commit `feat(entities): the watcher + the hag bargain (silent, unresolved)`.

---

### Task 6: Audio additions — field/forest/village/descent beds, knock, silence-spike, pant/creak

**Files:**
- Modify: `src/audio/AudioManager.ts` (add `'knock'` bed kind + the eight `amb-*` BEDS; `duckToSilence(holdMs)`; new cue voices `pant`, `bone-creak`; keep everything synthesized — no sample payload)
- Modify: `src/audio/mixer.ts` (add a `silenceCurve()` duck-to-silence-and-hold helper alongside `crossfadeCurves`)
- Modify: `src/main.ts` (extend the `ambienceFor` registry with the four gv zones)
- Test: extend `src/audio/__tests__/mixer.test.ts`

**Interfaces:**
- Produces:
  - New BEDS (spec §9), each following the existing `BedSpec` pattern:
    - Gate Fields: `amb-field-wind` (kind `wind`, brighter than the castle), `amb-tithe-toll` (NEW kind `knock`: a single struck clapper at long, irregular, UNPREDICTABLE intervals — never a readable rhythm, never a full toll).
    - Ashen Forest N: `amb-forest-hush` (kind `wind`, positional range restricted aggressively), `amb-forest-wrong` (animal-wrongness one-shots: a bird call cut off mid-note, a livestock bell with no herd — heard once per spot, never repeated there).
    - Cinder Village: `amb-cinder-wind` (kind `wind`, through empty structures), `amb-cinder-knock` (kind `knock`, irregular single bell-knock).
    - Pilgrim's Descent: `amb-descent-drone` (kind `pad`, low gorge drone), `amb-descent-wind` (kind `wind`, updraft).
  - `'knock'` branch in `spawnBed`: like the `'drip'` scheduler but a single low bell partial (additive sines ~180/360/540 Hz, soft strike) at randomized long intervals (`4–11 s`, mulberry32-seeded), NEVER a repeating meter.
  - `AudioManager.duckToSilence(holdMs: number): void` — ramps `ambienceBus.gain` to ~0 over ~120 ms (via `mixer.silenceCurve`), HOLDS for `holdMs`, then restores to the current threat-driven target. Rides ON TOP of the continuous threat-duck (steeper/deeper), not replacing it. Used by the silence-spike gimmick (Task 3).
  - New cue ids in the `cue` switch: `pant` (distant panting/circling footfall — a non-heartbeat threat cue that does NOT scale cleanly with brand-pulse proximity, spec §2 #8), `bone-creak` (the Kneeling Hollow's rise). Both little oscillator/noise voices.
  - `mixer.silenceCurve(steps: number): Float32Array` — a monotonic ramp from the current ambience gain to ~0 (equal-power-consistent), pure + tested.
- Consumes: `TUNING.audio`; the existing bus `{type:'cue';id}` handle (Hound/Kneeler emit `pant`/`bone-creak`); `zone-entered` → `setZoneLayers` (unchanged).

- [ ] **Step 1:** Failing `mixer.test.ts` additions: `silenceCurve(8)` starts at the passed base, ends ~0, is monotonically non-increasing; `bpmToIntervalMs`/`ambienceGain` unchanged (regression). Assert `duckToSilence` restores toward `ambienceGain(threat)` after the hold (a small headless harness stubbing `AudioContext` current-time math, or assert via the pure curve helper only if the node path is untestable — mirror the existing mixer-only test style).
- [ ] **Step 2:** Run `npx vitest run src/audio/__tests__/mixer.test.ts` → FAIL. Add `silenceCurve`; add the `'knock'` kind + eight BEDS; add `duckToSilence`; add `pant`/`bone-creak` cue voices. Run → PASS.
- [ ] **Step 3:** Extend `main.ts` `ambienceFor` so each gv zone returns its two layer ids (`gate-fields`→`['amb-field-wind','amb-tithe-toll']`, etc.). Manual soundscape check in each zone (F9 not needed — listen): the knock never reads as a rhythm; the silence-spike lands as a hard drop then restore; the hound pant is audible without the heartbeat. Commit `feat(audio): greater vael beds, knock, silence-spike, pant/creak`.

### Task 7: Save schema v2 + v1→v2 migration

**Files:**
- Modify: `src/save/save.ts` (`SaveData.version: 1 | 2`; add the `greaterVael?` block; `isSaveData` accepts 1 or 2; `migrateV1toV2`; `secondVigilSave` bumps to version 2 + `restoreEmberCap`)
- Test: extend `src/save/__tests__/save.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SaveData {
    version: 2;
    zone: ZoneId; bannerId: string; embers: number;
    flags: GameFlag[]; endingsSeen: EndingId[]; loreRead: string[]; visionsSeen: string[]; ngPlus: boolean;
    greaterVael?: {
      open: boolean;              // mirrors the greater-vael-open flag (postern unsealed)
      maxEmberCap: number;        // 5 default; the Hag's ember-tithe lowers it for the drop
      hagBargains: string[];      // e.g. ['hag-tithed','hag-ledger-given','hag-kneeled']
      watcherSightings: number;   // running counter, capped at 6
      glitchSeen: string[];       // per-gimmick "already saw it" flags (fidelity scarcity)
    };
  }
  export function migrateV1toV2(v1: SaveDataV1): SaveData;   // pure, lossless, tested
  ```
  - `migrateV1toV2`: copies EVERY v1 field, sets `version: 2`, and defaults `greaterVael = { open: v1.endingsSeen.length > 0, maxEmberCap: 5, hagBargains: [], watcherSightings: 0, glitchSeen: [] }`. **Supersedes the v1 "discard on version mismatch" behavior for the v1→v2 step specifically** — a beaten-castle save must carry into Greater Vael, never be dropped. `loadGame` migrates a version-1 payload in place (writes the v2 back); an unknown version (≥3 or 0) still returns null; a v2 payload with a malformed `greaterVael` drops just that block (defaults it), never the whole save.
  - `isSaveData` accepts `version === 1 || version === 2`; when `2`, `greaterVael` (if present) must have the five fields of the right types.
  - `secondVigilSave` returns `version: 2` and `greaterVael` reset to `{ open: prev's open, maxEmberCap: 5, hagBargains: [], watcherSightings: 0, glitchSeen: [] }` (knowledge of the postern persists; the Hag debts reset — `restoreEmberCap`).
- Consumes: the extended `ZoneId`/`GameFlag` (Task 1).

- [ ] **Step 1:** Failing `save.test.ts` additions:
  ```ts
  it('migrateV1toV2 preserves every v1 field and defaults greaterVael', () => {
    const v1 = { version: 1, zone: 'great-hall', bannerId: 'b', embers: 3, flags: ['gatekey'], endingsSeen: [1], loreRead: ['x'], visionsSeen: ['v'], ngPlus: false } as const;
    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
    expect({ ...v2, version: 1, greaterVael: undefined }).toMatchObject({ zone: 'great-hall', embers: 3, flags: ['gatekey'], endingsSeen: [1] });
    expect(v2.greaterVael).toEqual({ open: true, maxEmberCap: 5, hagBargains: [], watcherSightings: 0, glitchSeen: [] });
  });
  it('a beaten-castle v1 save is migrated, never discarded', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, zone: 'summit', bannerId: '', embers: 5, flags: [], endingsSeen: [2], loreRead: [], visionsSeen: [], ngPlus: false }));
    const loaded = loadGame();
    expect(loaded?.version).toBe(2); expect(loaded?.greaterVael?.open).toBe(true);   // endingsSeen>0
  });
  it('open is false when no ending is seen yet', () => { expect(migrateV1toV2({ ...v1Fresh, endingsSeen: [] }).greaterVael?.open).toBe(false); });
  it('unknown version (99) still returns null; round-trips a v2 save', () => { /* v2 save-load equality; version 99 → null */ });
  it('a v2 save with a malformed greaterVael defaults just that block', () => { /* stored greaterVael:"nope" → loaded.greaterVael defaulted, other fields intact */ });
  ```
  Keep the existing v1-round-trip tests as regression (update the `SAMPLE` `version` handling so the v1 sample migrates rather than round-trips identically).
- [ ] **Step 2:** Run `npx vitest run src/save/__tests__/save.test.ts` → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(save): v2 schema + lossless v1→v2 migration`.

---

### Task 8: Narrative content — banner visions, the Hag vision & the Ash-Priest's voice

> **Why the inscriptions are NOT here:** the structural test suite (`zones.test.ts`) enforces a LORE bijection — "every placed id resolves" AND "no orphaned base entry." Those two force each inscription's prose to land in the SAME commit as its placement, so the 19 `gv-*` inscriptions are authored inside their zone tasks (9–12), full prose in the plan there. This task carries only the content with NO bijection constraint: the visions, the Hag vision, and the Ash-Priest's spoken lines.

**Files:**
- Modify: `src/content/visions.ts` (extend the `VISIONS` key union with the four gv banner zones; export `GV_VISION_HAG`)
- Modify: `src/content/dialogue.ts` (two new Ash-Priest sequences), `src/entities/AshPriest.ts` (Drop-1 placement hook — line set by zone)
- Test: extend `src/content/__tests__/lore.test.ts` (or a small `visions.test.ts`) — every gv vision id is unique and its steps open+close on ash

**Interfaces:**
- Produces: five visions (banner + Hag; colour-bleed replays in the v1 Second-Vigil grammar — open on ash `desatTo 0.82`, flood colour toward 0, last step SNAPS to ash). Sequenced by zone order, they assemble the tithe tragedy: *the tithe begins → a brand traded at the tree-line → the ledger's last page → pilgrims descending to repay → the sold woman at the cairn.* Full captions below (voice matches `lore.ts`/`visions.ts`: terse, image-then-turn).
- Consumes: `VisionDef` (`engine/VisionPlayer`); ghost `piece`s from the existing kit (`skeleton-warrior`, `statue-knight`).

Author these `VisionDef`s (captions are the actual content — copy verbatim):

- `gate-fields` → `id: 'vision-gate-fields'` — *the tithe begins*
  1. open ash (`desatTo 0.82`, `fogFar 9`, wait 700)
  2. `desatTo 0.5`, "Once the fields were given fire freely, and the harvest came up gold under the brand." (ghosts: `skeleton-warrior` [2,6], [3,7]) wait 1500
  3. `desatTo 0.15`, "Then a clerk set a price on the warmth, and called the price a kindness — fire, on loan." wait 1600
  4. `desatTo 0`, "The first ember sold was the first the fields never got back. They have been owing ever since." wait 1700
  5. snap `desatTo 0.82`, wait 500
- `ashen-forest-n` → `id: 'vision-ashen-forest'` — *a brand traded away at the tree-line*
  2. `desatTo 0.5`, "At the fog-line a woman knelt, and let them strike the fire from her brand." (ghost: `statue-knight` [5,6]) wait 1500
  3. `desatTo 0.15`, "It was carried off to warm a hall she would never enter, and counted as a debt half-paid." wait 1600
  4. `desatTo 0`, "The other half is still owed. Something in the trees took it up, so she would not have to die of it." wait 1700
- `cinder-village` → `id: 'vision-cinder-village'` — *the ledger's last page*
  2. `desatTo 0.5`, "The collector's hand moved down the column, name by name, ember by ember." (ghost: `statue-knight` [4,9]) wait 1500
  3. `desatTo 0.15`, "The last name had nothing left to give but itself, so beside it he wrote a single word." wait 1600
  4. `desatTo 0`, "ALL. Then the flame guttered, and there was no one left to collect, and no one left to pay." wait 1700
- `pilgrims-descent` → `id: 'vision-pilgrims-descent'` — *pilgrims descending to repay*
  2. `desatTo 0.5`, "They went down in a long line to give their embers back to the water, and be clean of the debt." (ghosts: `skeleton-warrior` [4,3], [7,4]) wait 1500
  3. `desatTo 0.15`, "The water took the embers. It did not give back the pilgrims." wait 1600
  4. `desatTo 0`, "The path down is deep-worn. No one has counted the ones who came up, because none did." wait 1700
- `GV_VISION_HAG` (exported standalone; played by the ledger bargain, not a banner) → `id: 'gv-vision-hag'` — *the sold woman, at the cairn*
  2. `desatTo 0.5`, "Here is what your ledger bought: a woman, kneeling, while strangers took her fire to sell." (ghost: `statue-knight` at the cairn cell [8,9]) wait 1500
  3. `desatTo 0.15`, "She did not curse them. She only asked who would carry the rest of what she owed." wait 1600
  4. `desatTo 0`, "The fog answered. It has been answering for her ever since — and now it knows your name too." wait 1700

Author the Ash-Priest sequences (`dialogue.ts`; his recurring-stranger grammar; he is the ONLY voice in Greater Vael):
- `ashpriest-gv-fields` (Gate Fields threshold — welcome/warning):
  1. "You crossed the gate. Few do, now — the kingdom you knew is behind you, and this is only what it owed."
  2. "Walk softly. The dead here did not fall in battle; they were spent, like coin, and they remember being spent."
  3. "There is a woman at the tree-line who deals in debts. Bring her nothing you are not ready to give away."
- `ashpriest-gv-descent` (Pilgrim's Descent, his Drop-1 final line — the tithe truth + a hint he knows more):
  1. "You have read the ledger by now. A kingdom lent its fire, then learned to sell the warmth and keep the ash."
  2. "The Flame did not take Vael. Vael sold Vael, ember by ember, for three hundred quiet years."
  3. "I carried the first ember up a road much like this one, once. I never asked what it would cost. That is the herald's mercy — we are spared the sums." (He will not say who he heralded, or when.)

- [ ] **Step 1:** Failing test: each of the five gv vision ids is unique game-wide; each vision's first step has `desatTo === 0.82` and its last step snaps back to `0.82`; `GV_VISION_HAG.id === 'gv-vision-hag'`.
- [ ] **Step 2:** Run `npx vitest run src/content/__tests__/lore.test.ts` (or the new `visions.test.ts`) → FAIL. Add the four banner visions + `GV_VISION_HAG` + the two dialogue sequences + the AshPriest per-zone line hook. Run → PASS. (No LORE entries added here → `zones.test.ts` bijection stays green.)
- [ ] **Step 3:** Commit `content(narrative): tithe visions, hag vision, ash-priest drop-1 voice`.

---

### Task 9: Zone — Gate Fields (hub) + the Ashen Gate postern + `greater-vael-open`

**Files:**
- Create: `src/content/zones/gateFields.ts`
- Modify: `src/content/zones/index.ts` (register `'gate-fields'`)
- Modify: `src/content/zones/ashenGate.ts` (**the single v1-canon file touched** — add the postern door + grid digit)
- Modify: `src/content/lore.ts` (add the 5 `gv-field-*` entries, full prose below)
- Modify: `src/main.ts` (on load, add `'greater-vael-open'` to the live flag set when `save.greaterVael?.open` / `endingsSeen.length > 0`)
- Test: `zones.test.ts` picks the zone up automatically (structural); add a targeted door-pair assertion

**Interfaces:** produces the hub zone (`kind:'exterior'`, `exteriorSky:'field'`, `fogFarM` omitted → 16) with four doors, the scarecrow-ward Kneeling Hollow (GF-1), the seeded false-pulse (GF-2), one Watcher anchor, GF's banner + 5 lore + the Ash-Priest. The Ashen Gate gains ONE new door `gate-to-fields` (lock `'greatervael'`, pair `'gate-fields-postern'`); nothing else in the castle changes.

Grid (16×14 — copy VERBATIM except row 7, corrected: the spec's row-7 string put `B` at col 8 while its annotation says [7,7]; use the corrected row below so `B` sits at [7,7] beneath the oak and the required `S` spawn sits at [7,6]. `tiles: { ',':'floor','p':'floor','t':'floor','T':'wall' }`):
```
'#######11#######'   0   N gate `11` [0,7],[0,8] → ashen-gate (pair 'gate-fields-postern')
'#t,,,,,pp,,,,,t#'   1
'#,,,,,,pp,,,,,,#'   2
'#,,,,t,pp,t,,,,#'   3
'#,,,,,pppp,,,,,#'   4
'#,,,ppp..ppp,,,#'   5
'3pppp,.TT.,pppp2'   6   W gate `3` [6,0] → cinder-village · E gate `2` [6,15] → ashen-forest-n · `TT` [6,7],[6,8] = oath-oak
'#,,,ppSB.ppp,,,#'   7   `S` spawn [7,6] · `B` banner [7,7] · [7,8] floor (gibbet lore)
'#,,,,,pppp,,,,,#'   8
'#,,t,,,pp,,,t,,#'   9
'#,,,,,,pp,,,,,,#'  10
'#t,,,,,pp,,,,,t#'  11
'#,,,,,,pp,,,,,,#'  12
'#######44#######'  13   S gate `44` [13,7],[13,8] → pilgrims-descent
```
Doors: `{id:'gf-to-gate', at:[0,7], to:'ashen-gate', lock:'greatervael', pair:'gate-fields-postern'}` · `{id:'gf-to-village', at:[6,0], to:'cinder-village', pair:'gf-village'}` · `{id:'gf-to-forest', at:[6,15], to:'ashen-forest-n', pair:'gf-forest'}` · `{id:'gf-to-descent', at:[13,7], to:'pilgrims-descent', pair:'gf-descent'}`.
Props: the oath-oak is the `TT` wall (rendered as one dense-tree pair); hang a `gibbet` prop (rusted-open iron cage) at [6,7]/[6,8] area; scatter `rubble`/`crate`. `exteriorSky:'field'`. `ambience:['amb-field-wind','amb-tithe-toll']`.
Banner: `{at:[7,7], name:'Banner of the Owed Field'}` — the one banner (orbit archetype; the oak is the single safe eye). Ash-Priest entity at ~[2,3] with `ashpriest-gv-fields`.
Enemies: `soldier` [4,11], `soldier` [10,4] (v1 staple); the scarecrow-ward = one `kneeler` spawn at [9,3] (dormant/inert until brand-pulse) + 2 inert kneeling PROPS nearby (ratio 1:2–3, never the banner silhouette).
Lore (5, on plain-floor cells — the grid uses `,`/`p` floors): `gv-field-boundary-stone` [2,3] · `gv-field-scarecrow-ward` [9,4] (beside the ward) · `gv-field-childs-shoe` [1,1] (NW secret) · `gv-field-gibbet` [7,8] (under the oak) · `gv-field-tithe-post` [12,7] (SE breadcrumb).

`scares` (GF-1, GF-2) + `watcherAnchors`:
```ts
scares: [
  { id:'GF-1', zone:'gate-fields', trigger:{on:'approach', at:[9,3], withinM:3}, gimmick:'silence-spike', oneLine:'The straw ward is a kneeling knight.' },
  { id:'GF-2', zone:'gate-fields', trigger:{on:'seededClearing', cells:[[6,6],[7,6],[6,9],[7,9]]}, gimmick:'false-pulse', oneLine:'The radar throbs once in the empty field.' },
],
watcherAnchors: [[6,16]],   // beyond the E treeline gap: distant, static, half-occluded by the oak (quiet sighting, no gimmick)
```
GF-1 note for the implementer: the silence-spike fires; the "straw ward" prop resolves to the `kneeler` at [9,3] (it stays inert — GF-1 does NOT wake it; the pure teaching beat). GF-2: one hard brand-pulse + heartbeat with nothing there, on the per-run-seeded clearing cross.

Add these to `LORE` (VERBATIM — terse, oath-haunted, image-then-turn):
```ts
'gv-field-boundary-stone': { title: 'The Boundary-Stone',
  body: 'Its old blessing is chiselled off, and a tally cut in the bare place. Past this mark the flame was not given to the fields — it was lent to them, at interest. The fields have been paying ever since, and the fields are bare.' },
'gv-field-scarecrow-ward': { title: 'The Straw Ward',
  body: 'It wears a soldier’s ruined brand for a face. When the fog first came off the tree-line the village had no ward against it but its own hollowed dead, so they knelt one here and called it a scarecrow. It has knelt a hundred years. It is still listening.' },
'gv-field-childs-shoe': { title: 'A Child’s Shoe',
  body: 'Ash-grey, pulled from a fallen chimney-throat. Scratched beside the hearth-door, a daisy-wheel — six petals in one unbroken line, to snare any evil that came down the flue. It snared nothing. The shoe is here and the child is not.' },
'gv-field-gibbet': { title: 'The Empty Gibbet',
  body: 'An iron cage hangs from the oak, rusted open, high where every road could see it. Something was kept in it once — a warning, or a payment left where the collector could find it. The cage is empty now. Nothing broke the lock from outside.' },
'gv-field-tithe-post': { title: 'The Tithe-Post',
  body: 'A toll-post at the crossing, its ledger-slot worn smooth by cold coin. Here a traveller bought back an hour of warmth against the fog, hearth-fire measured out by the finger-length. The Flame lent a kingdom its fire; the kingdom sold it on by the ember. None of the debt ran the other way.' },
```

Ashen Gate edit (the ONLY v1-file touch): in `ashenGate.ts`, change grid row 6 from `'#..........#'` to `'2..........#'` (door anchor `2` at [6,0], west wall, away from the vista/banner) and append to `doors`: `{ id: 'gate-to-fields', at: [6, 0], to: 'gate-fields', lock: 'greatervael', pair: 'gate-fields-postern' }`. Everything else in `ashenGate.ts` (grid rows, fog 12, enemies, lore, vista, NG+) stays byte-identical.

- [ ] **Step 1:** Add the 5 LORE entries + register the zone + edit the postern. The `S` spawn at [7,6] is baked into the grid above (the "exactly one S" structural test requires exactly one — every gv zone bakes its own; the player normally arrives via the postern, but the spawn is the fallback + satisfies the test). Run `npx vitest run src/content/__tests__/zones.test.ts src/content/__tests__/lore.test.ts` → the bijection + structural suites pass (equal-length 16-char rows; one `S`; banner [7,7] agrees with the grid `B`; lore/enemies on plain floor; all four doors target built zones or `FUTURE_ZONE_IDS`). Add a targeted test: `pairedDoor('ashen-gate', <gate-to-fields>, GATE_FIELDS)?.to === 'ashen-gate'` and the reverse.
- [ ] **Step 2:** `main.ts`: derive `'greater-vael-open'` into the live flag set from `save.greaterVael?.open ?? (save.endingsSeen.length > 0)`; the postern then passes `canPass`. Verify a fresh (no-ending) save leaves the postern sealed; a beaten-castle save opens it.
- [ ] **Step 3:** Browser checklist (F9 → `docs/shots/`): the oath-oak reads as the single tall silhouette from every cell; the gibbet swings empty; GF-1 silence-spike lands then the ward resolves as a kneeler; the four doors transition; the E-treeline Watcher shows once distant then is gone when neared. Capture **Clip #1** `gv-clip-oak.png` + 9:16 crop. Commit `content(zone): gate fields hub + ashen gate postern`.

---

### Task 10: Zone — Ashen Forest N (Ash-Hound showcase + the Hag's threshold)

**Files:**
- Create: `src/content/zones/ashenForestN.ts`
- Modify: `src/content/zones/index.ts` (register `'ashen-forest-n'`), `src/content/lore.ts` (5 `gv-forest-*` entries, prose below)
- Test: structural (auto)

**Interfaces:** produces the "audio-leads" forest (`kind:'exterior'`, `exteriorSky:'forest'`, tree-density stacks fog toward ~13 so the 12 m brand pulse and visibility converge). Contains 2 Ash-Hounds, three scares (AF-1/2/3), the Watcher (AF-2), and the Hag threshold at the cairn [8,9].

Grid (15×11 — VERBATIM except row 2 which bakes the required `S` spawn at [2,2]; letters: `t`→floor, `T`→wall, `p`→floor, `.`→floor. `tiles: { 't':'floor','T':'wall','p':'floor' }`):
```
'###############'   0
'3ppt..t..tTtTT#'   1   W door `3` [1,0] → gate-fields (pair 'gf-forest')
'#.Spt.t.tTTTTT#'   2   `S` spawn [2,2]
'#t.pp.t.T.tTTT#'   3
'#.t.pptt.TT.TT#'   4
'#tt.tpBpt.TtTT#'   5   `B` banner [5,6], at the density transition
'#.t..ppptTTtTT#'   6
'#t.tt..ppTtT.T#'   7
'#..t.tt.ppTTTT#'   8   Hag cairn (satellite) at [8,9]; road's end at the fog-line
'#t.tt.t..ptTTT#'   9
'###############'  10
```
Density ramp: cols 1–6 sparse (`t`/`.`), cols 8–13 dense (`T`); the `S` spawn is baked at [2,2] (plain floor, west road). `exteriorSky:'forest'`. `ambience:['amb-forest-hush','amb-forest-wrong']`.
Doors: `{id:'af-to-fields', at:[1,0], to:'gate-fields', pair:'gf-forest'}` — the single spoke door (the forest dead-ends at the fog-line / Hag cairn).
Banner: `{at:[5,6], name:'Banner at the Fog-Line'}` — placed BEFORE the hard dense section (kneel = release before the push into the dark).
Enemies: `hound` [6,8] (circles at the dense-fog edge — [6,8] is the `t` floor at the edge; the spec's [6,9] is a `T` thicket wall, so the spawn sits one cell into the walkable edge, same role), `hound` [9,10] (flanks from the deep trees — [9,10] is a `t` floor among the dense stand; the spec's [8,11] is a `T` wall). NO v1 enemies (the Hound's showcase).
Lore (5, all verified on `t`/`p`/`.` plain-floor cells): `gv-forest-fogline` [5,5] (`p` band) · `gv-forest-hag-cairn` [8,9] (`p`, the cairn) · `gv-forest-sold-brand` [9,1] (`t`, off-path) · `gv-forest-hound-kennels` [7,2] (`.`) · `gv-forest-watcher-note` [3,1] (`t`, off-path secret).
`hagThreshold: { at:[8,9], glimpseCells:[[6,6],[7,7],[8,8]] }` (all `p` floor).

`scares` + `watcherAnchors`:
```ts
scares: [
  { id:'AF-1', zone:'ashen-forest-n', trigger:{on:'cellEnter', cells:[[4,5]]}, gimmick:null, oneLine:'Something crosses between the trees, downrange.' },  // pure-visual; correlates with a real hound circling ~4s later
  { id:'AF-2', zone:'ashen-forest-n', trigger:{on:'cellEnter', cells:[[6,7]]}, gimmick:'snap-grid', showsWatcher:true, oneLine:'The tall watcher, and the world stutters around it.' },
  { id:'AF-3', zone:'ashen-forest-n', trigger:{on:'approach', at:[8,9], withinM:4}, gimmick:'desaturation', oneLine:'A woman, wrong-tall, gone when you near her.' },  // also glimpses the Hag
],
watcherAnchors: [[6,15]],   // off-grid backdrop beyond the dense treeline, past the far-plane (AF-2 anchor)
```
AF-3 also fires `hag.glimpse()` (the 2.5 m woman-shape at the fog-line turns and recedes). AF-1 is pure-visual (no screen gimmick): a tall shape crosses between two dense-tree cells at the fog's edge, gone if looked at / approached — teaches that silhouettes are a genuine warning (a real hound begins circling ~4 s after).

Add to `LORE` (VERBATIM):
```ts
'gv-forest-fogline': { title: 'The Fog-Line',
  body: 'The road ends where the trees begin, and the fog begins with them. This is the mark past which a tithe once went unpaid and was not forgiven. The debt did not lift. It put down roots, and learned to wait in the dark between the trunks.' },
'gv-forest-hag-cairn': { title: 'The Carved Cairn',
  body: 'A cairn of pale stones, and no words on any of them — only marks, cut by a hand that had stopped trusting words: an open palm, an ember, a line drawn out and away. She does not speak. She sets her meaning in the stone, and waits to see what you will lay down.' },
'gv-forest-sold-brand': { title: 'The Sold Brand',
  body: 'A brand-scar, cold, pressed into the bark like a seal in wax. A soldier’s oath-fire was struck from her the night the ledgers came due, and carried off to warm a hall she would never be let into. She did not hollow with the others. Something out here took up her debt, and will not let her die of it.' },
'gv-forest-hound-kennels': { title: 'The Loosed Kennels',
  body: 'Ring-bolts in a row, the leashes long rotted through. The collectors kept dogs to walk the tithe-roads, lean things fed on what the debtors could not pay. When the flame guttered and the collectors did not come back, no one loosed them. They loosed themselves. They are still collecting.' },
'gv-forest-watcher-note': { title: 'A Scratched Line',
  body: 'One line, cut at a running height by someone who did not stop to finish the letters: it does not come closer. it does not need to. Below it, in a steadier hand that had made its peace: so do not run. it likes the running.' },
```

- [ ] **Step 1:** Add the 5 LORE entries + register the zone. Run `npx vitest run src/content/__tests__/zones.test.ts src/content/__tests__/lore.test.ts` → PASS (verify: rows equal length 15; one `S`; lore/enemies on plain-floor; W door pairs back to gate-fields via `gf-forest`).
- [ ] **Step 2:** Wire the fogCell/audio contract: the dense cols carry no explicit `fogCells` (occlusion does the work), but confirm the two hounds' 13 m aggro reads fair inside the ~13 m occluded fog and the pant cue leads. The Hag threshold at [8,9] surfaces the `TITHE/GIVE LEDGER/KNEEL/turn away` interactor (Task 5); `hag-tithed` bumps this zone's `fogFarM += 6` for the visit.
- [ ] **Step 3:** Browser checklist (F9): AF-1 silhouette crosses then a hound circles; AF-2 snap-grid stutters while the far watcher holds beyond the fog, gone when neared; AF-3 desat stab as the Hag recedes; the density ramp shrinks sightlines as you advance. Capture **Clip #2** `gv-clip-watcher.png` + 9:16 crop, and `gv-clip-hag-bargain.png`. Commit `content(zone): ashen forest n — hound showcase + hag threshold`.

---

### Task 11: Zone — Cinder Village (the procession + the tithe-ledger)

**Files:**
- Create: `src/content/zones/cinderVillage.ts`
- Modify: `src/content/zones/index.ts` (register `'cinder-village'`), `src/content/lore.ts` (5 `gv-village-*` entries, prose below)
- Test: structural (auto)

**Interfaces:** produces the tithe's ground truth (`kind:'exterior'`, `exteriorSky:'field'` reused with village dressing) — a corridor-network in outdoor skin: `H` house blocks break sightlines, one long exposure street is the spine, alleys hide finds. Home of the Kneeling Hollow (the flagellant procession) and the surrenderable `tithe-ledger` item.

Grid (15×9 — VERBATIM; `tiles: { 'H':'wall','p':'floor','w':'floor' }`; `H` renders as `wall.glb` ruin block, `w` = the curdled well floor):
```
'###HHHHHHHHH###'   0
'#..H..H.wH.H..#'   1   `w` = curdled well [1,8]
'#.HHH.H.H.HHH.#'   2
'#....H.H.H....#'   3
'3SpppppBppppppD'   4   W door `3` [4,0] → gate-fields (pair 'gf-village') · `S` spawn [4,1] · `B` banner [4,7] · `D` sealed east arch [4,14] → salt-road (Drop 2)
'#....H.H.H....#'   5
'#.HHH.H.H.HHH.#'   6
'#..H..H..H.H..#'   7
'###HHHHHHHHH###'   8
```
The `S` spawn is baked at [4,1] (street floor, one cell in from the W door). Alleys are the `.` gaps in rows 1–3 / 5–7. `ambience:['amb-cinder-wind','amb-cinder-knock']`.
Doors: `{id:'cv-to-fields', at:[4,0], to:'gate-fields', pair:'gf-village'}` · `{id:'cv-to-saltroad', at:[4,14], to:'salt-road', lock:'greatervael'}` — the sealed east arch `D`; target `'salt-road'` is in `FUTURE_ZONE_IDS` so it validates as sealed (Drop 2). (A `lock` it can never satisfy this drop is fine — it reads as sealed set-dressing.)
Banner: `{at:[4,7], name:'Banner of the Cinder Plaza'}` — the only point with cover on both sides (plaza where N/S alleys meet the street).
Enemies: the flagellant procession = 3 kneeling-hollow presences along the street, of which EXACTLY ONE is a live `kneeler` spawn (at [4,9]) and TWO are permanently-inert PROPS (at [4,3], [4,11]) — real:inert 1-in-3. Plus 1 `archer` on a house-interior FLOOR at [5,11], firing across the exposure street (fair: 14 m aggro sits inside the 16 m fog). The spec's [2,12] is an `H` house-block wall — an enemy can't spawn on it, so the archer sits on the adjacent room floor [5,11], same tactical role. The checkpoint-banner kneel silhouette is NEVER used as a Hollow here.
Items: `{ id:'tithe-ledger', at:[3,3], flag:'tithe-ledger', card:'<the gv-village-tithe-ledger inscription>' }` — the carried ledger in a burned hearth-room alley; surrenderable to the Hag (Task 5).
Lore (5, all verified on plain floor): `gv-village-tithe-ledger` [3,3] (`.`, the item's read) · `gv-village-salt-line` [3,1] (`.`, an alley threshold — moved off [4,1] which now holds the `S` spawn) · `gv-village-collector-house` [3,11] (`.`, ward-marks scraped off) · `gv-village-well` [1,8] (`w`→floor) · `gv-village-procession` [4,5] (`p`, the kneeling line).

`scares` + `watcherAnchors`:
```ts
scares: [
  { id:'CV-1', zone:'cinder-village', trigger:{on:'brandPulse', at:[4,9], withinM:3}, gimmick:'silence-spike', oneLine:'The frozen procession — one of them rises.' },   // wakes the live kneeler ([4,9]); the two props stay kneeling
  { id:'CV-2', zone:'cinder-village', trigger:{on:'cellEnter', cells:[[4,5]]}, gimmick:'resolution-drop', oneLine:'The lights go out one by one, toward you.' },              // lit windows gutter out in sequence toward the player
  { id:'CV-3', zone:'cinder-village', trigger:{on:'approach', at:[1,8], withinM:3}, gimmick:null, oneLine:'The well-water has gone wrong; a name, scratched shaking.' },       // pure-visual, no combat
],
watcherAnchors: [[-1,13]],   // rooftop by the sealed east arch (elevated, brief; quiet sighting)
```
CV-1: on the beat, call `wake()` on the [4,9] `kneeler` (the live one rises; the two props do not) — teaches which kneelers are real. CV-2: the resolution-drop garnishes the diegetic guttering (lights die in sequence toward the player, ending near-dark) — telegraphs the plaza kneeler/archer. CV-3: the `gv-village-well` stone blames "her" in a shaking hand, never confirmed (small evil, plausibly the world's fault).

Add to `LORE` (VERBATIM):
```ts
'gv-village-tithe-ledger': { title: 'The Tithe-Ledger',
  body: 'Its spine cracks open to this page. A column of names down the left, a column of embers owed down the right, and the right column only ever grows. The last entry is a woman’s name, and the sum beside it is not a number — it is one word, pressed so hard the nib tore through: ALL.' },
'gv-village-salt-line': { title: 'The Salt Lines',
  body: 'Salt laid across every doorstone, grey and clotted with age — the old ward against what walks the fog. Every line is unbroken but one. That threshold’s salt is scuffed through from the inside, by something that wanted out, not in.' },
'gv-village-collector-house': { title: 'The Collector’s Door',
  body: 'The largest door in Cinder, and the only one with no ward at all. There were marks here once — you can see the scrape where they were taken off, corner to corner, deliberate. A house that fears no fog is a house the fog has already been paid to leave alone.' },
'gv-village-well': { title: 'The Curdled Well',
  body: 'The water has gone still and wrong, a skin on it the colour of a bruise. Cut into the coping, in a hand that shook: SHE POISONED IT. And lower, later, smaller, as if the hand had thought again: or the flame died, and the water died with it, and we needed a name that could hear us.' },
'gv-village-procession': { title: 'The Kneeling Line',
  body: 'A line worn into the street by knees that never rose. When the tithe could not be paid in embers, Cinder paid it in the hollowed — walked its own dead out and set them kneeling toward the fog, a penance-column. Count them as you pass. One of them is counting you.' },
```

- [ ] **Step 1:** Add the 5 LORE entries + register the zone. Run `npx vitest run src/content/__tests__/zones.test.ts src/content/__tests__/lore.test.ts` → PASS (verify: item `tithe-ledger` on plain floor with a non-empty card; the `D` sealed arch validates against `FUTURE_ZONE_IDS`; one live `kneeler`, two inert props; W door pairs to gate-fields).
- [ ] **Step 2:** Wire the `tithe-ledger` pickup (`takeItem` → `flag:'tithe-ledger'`, surfaces the inscription card) and its surrender path at the Hag cairn (Task 5 `offerToHag('ledger', …, hasLedger:true)` clears `tithe-ledger` + plays `gv-vision-hag`).
- [ ] **Step 3:** Browser checklist (F9): CV-1 silence into the single rise (props stay kneeling); CV-2 lights gutter toward you into near-dark; CV-3 the well reads subtly wrong; the rooftop Watcher shows once then is gone at the arch. Capture **Clip #4** `gv-clip-lights.png` + 9:16 crop. Commit `content(zone): cinder village — procession + tithe-ledger`.

---

### Task 12: Zone — Pilgrim's Descent (the height-layer showcase + vista terminus)

**Files:**
- Create: `src/content/zones/pilgrimsDescent.ts`
- Modify: `src/content/zones/index.ts` (register `'pilgrims-descent'`), `src/content/lore.ts` (4 `gv-descent-*` entries, prose below)
- Test: structural (auto)

**Interfaces:** produces the drop's terminus (`kind:'exterior'`, `exteriorSky:'gorge'`) — a switchback trail descending a gorge, showcasing the exterior height layer (3→0) and a vista foreshadow of the drowned lands (Drop 2). `~` fills the gorge (fall = ember loss + reset, existing void rule).

Grid (13×12 — VERBATIM except row 1 bakes the `S` spawn at [1,1]; `tiles: { 'p':'floor' }`; `~` is the built-in void, `#` the border):
```
'#############'   0
'1Sppppppppp~#'   1   N door `1` [1,0] → gate-fields (pair 'gf-descent') · `S` spawn [1,1]. Top ledge.
'#~~~~~~~~~p~#'   2
'#~~~~~~~~~p~#'   3
'#pppppppppp~#'   4   west run
'#p~~~~~~~~~~#'   5
'#p~~~~~~~~~~#'   6
'#pppppppppB~#'   7   `B` banner [7,10]
'#~~~~~~~~~p~#'   8
'#~~~~~~~~~p~#'   9
'#pppp44pppp~#'  10   `44` [10,5],[10,6] = sealed gate → salt-road (Drop 2). Bottom ledge.
'#############'  11
```
The single serpentine: row1(top) → col10 down → row4(west run) → col1 down → row7(+banner) → col10 down → row10(bottom, sealed). The `S` spawn is baked at [1,1] (top ledge, one cell in from the N door).

`heightGrid` (VERBATIM — same 13×12 dims; walkable path cells carry the band digit, `~`/`#` carry `0`; ramps auto-generate on the three Δ1 seams row2→3, row5→6, row8→9; path-vs-void `Δ≥2` renders the gorge cliff faces):
```
'0000000000000'   0
'3333333333300'   1   band 3
'0000000000300'   2   band 3 (col10 path)
'0000000000200'   3   band 2 (col10 path)
'0222222222200'   4   band 2 (west run)
'0200000000000'   5   band 2 (col1 path)
'0100000000000'   6   band 1 (col1 path)
'0111111111100'   7   band 1 (row7 + banner)
'0000000000100'   8   band 1 (col10 path)
'0000000000000'   9   band 0 (col10 path)
'0000000000000'  10   band 0 (bottom)
'0000000000000'  11
```
Doors: `{id:'pd-to-fields', at:[1,0], to:'gate-fields', pair:'gf-descent'}` · `{id:'pd-to-saltroad', at:[10,5], to:'salt-road', lock:'greatervael'}` (sealed; target in `FUTURE_ZONE_IDS`). `ambience:['amb-descent-drone','amb-descent-wind']`.
Banner: `{at:[7,10], name:'Banner Mid-Descent'}` — the exhale between the vista beat and the sealed bottom.
Enemies: 2 `hound` working the switchbacks (multi-angle threat where the void makes repositioning lethal) at [4,6] and [7,4].
`fogCells: [{ cells:[[1,1],[1,2]], farM: 11 }]` — the one scripted low-fog cell (spec §4, top-ledge), paired with a hound-snarl audio tell (a hound may be within its 13 m aggro but outside the 11 m sight — reads as dread, not a cheap hit).
`vista: { id:'vista-pilgrims-descent', cells:[[1,1],[1,2],[1,3],[1,4]] }` — first step onto the top ledge; fog opens 12→24 revealing the drowned lands (the existing `VistaDirector` swells the far plane).
Lore (4): `gv-descent-shrine` [4,3] · `gv-descent-pilgrim-marker` [1,5] · `gv-descent-sealed-gate` [10,4] (at the sealed gate) · `gv-descent-ash-priest` [7,3] (his Drop-1 final line + entity for `ashpriest-gv-descent`).

`scares`:
```ts
scares: [
  { id:'PD-1', zone:'pilgrims-descent', trigger:{on:'vista', vistaId:'vista-pilgrims-descent'}, gimmick:'snap-grid', showsWatcher:true, oneLine:'The chasm opens — across it, the watcher, waiting.' },
  { id:'PD-2', zone:'pilgrims-descent', trigger:{on:'approach', at:[7,10], withinM:3}, gimmick:'desaturation', oneLine:'A banner burns where you can’t reach; yours is safe.' },
],
watcherAnchors: [[1,-3]],   // far cliff across the chasm: far, elevated, unreachable (PD-1 anchor)
```
PD-1 (Clip #5, primary hero): the vista swells over the drowned lands AND, on the far cliff across the chasm, the Watcher stands — the snap-grid fires under the swell. PD-2: a DISTANT, unreachable banner on the far cliff appears ablaze and guttering wrong, then reads as ash — **the player's own checkpoint banner at [7,10] is never touched** (owner decision 8: kneel-safety never spoofed; kneeling there always works). The false read is on set-dressing across the gorge only.

Add to `LORE` (VERBATIM):
```ts
'gv-descent-shrine': { title: 'The Wayside Shrine',
  body: 'A shrine to Vhaelis, the Flame That Lends, its little niche still black with old smoke. Beneath the fresh carving, an older one is scratched to ruin — an earlier name, an earlier keeper of this crossing, unmade to make room for the fire. Every faith here is built on the scraped-out face of the one before.' },
'gv-descent-pilgrim-marker': { title: 'The Pilgrim-Marker',
  body: 'A marker at the head of the switchbacks, hung with the cold brands of those who passed it. They went down to the drowned lands to give their embers back to the water, and so be free of the debt. The path down is deep-worn. The path up has not been walked in a long time.' },
'gv-descent-sealed-gate': { title: 'The Sealed Way',
  body: 'The gate at the bottom is barred and swollen shut, and beyond it the sound of water where no water should be. The Salt Road ran on from here once, down to the sea-marches. It runs under them now. Something still tolls, far below the surface, keeping a count no one is left to owe.' },
'gv-descent-ash-priest': { title: 'The Ash-Priest, at the Gate',
  body: 'He has come down ahead of you, as he always has, and set his back to the sealed gate. "A kingdom given fire," he says, not turning, "and it learned to sell the warmth and keep the ash. I carried the first ember up a road much like this one. I never asked what it would cost." He will not say who he heralded, or when.' },
```

- [ ] **Step 1:** Add the 4 LORE entries + register the zone. Run `npx vitest run src/content/__tests__/zones.test.ts src/content/__tests__/lore.test.ts` → PASS. Add a targeted test: `def.heightGrid` rows equal `def.grid` dims (12 rows × 13 chars); `buildHeightRamps(PILGRIMS_DESCENT)` yields exactly three `ramp`s (on the col10 [2→3], col1 [5→6], col10 [8→9] seams) and ≥1 `cliff` (path vs void).
- [ ] **Step 2:** Wire the vista+fogCell: PD-1's `on:'vista'` trigger fires when `VistaDirector.enterCell` returns true for `vista-pilgrims-descent`; the snap-grid + Watcher manifest ride the same beat. Confirm the `fogCells` override applies only on [1,1]/[1,2] and the hound-snarl tell plays. Confirm a fall off a switchback = ember loss + reset (existing void rule, no new code).
- [ ] **Step 3:** Browser checklist (F9): the height layer descends visibly (player/camera y steps down the three ramps); the gorge cliff faces render; PD-1 vista + far watcher; PD-2 far banner burns while the real [7,10] banner stays ash + kneelable. Capture **Clip #5** `gv-clip-chasm.png` + 9:16 crop (primary hero — 9:16-composed). Commit `content(zone): pilgrim's descent — height layer + vista terminus`.

---

### Task 13: Integration — e2e exterior smoke, perf sweep, PLAYTEST Drop-1, clips

**Files:**
- Create: `e2e/greater-vael.spec.ts`; Modify: `e2e/smoke.spec.ts` (optional), `docs/PLAYTEST.md` (append a Drop-1 section)
- Modify: `.github/workflows/ci.yml` only if a new spec path needs wiring (the existing glob picks up `e2e/*.spec.ts`)

**Interfaces:** produces the CI proof that exterior zones load, render instanced forests, and hold the perf budget; the manual Drop-1 checklist; and the verified clip crops. Exposes a dev/E2E jump so the smoke can reach a gv zone without a beaten-castle playthrough.

- [ ] **Step 1:** In the E2E build (behind `VITE_E2E`, mirroring the existing `window.__oathbrand` handle), expose `window.__oathbrand.loadZone(id)` (dev/CI only; never in the shipped bundle) and `window.__oathbrand.drawCalls` (from `renderer.info.render.calls`). Add `e2e/greater-vael.spec.ts`:
  ```ts
  test('gate-fields (field) loads, instanced forest renders, draw calls < 100', async ({ page }) => {
    await page.goto('/oathbrand/');
    await page.evaluate(() => (window as any).__oathbrand.loadZone('gate-fields'));
    await expect.poll(() => page.evaluate(() => (window as any).__oathbrand.state)).toBe('playing');
    const calls = await page.evaluate(() => (window as any).__oathbrand.drawCalls);
    expect(calls).toBeLessThan(100);
  });
  test('ashen-forest-n (dense forest) holds the draw-call budget', async ({ page }) => { /* same, loadZone('ashen-forest-n'), calls < 100 */ });
  ```
  Run locally is sandbox-blocked (headless exit 144) — assert green in CI. `npm run typecheck` + `npx vitest run` all green.
- [ ] **Step 2:** Perf sweep: with the dev HUD (`?dev=1`), walk all four zones and confirm <100 draw calls (instanced grass/trunk/tree = 3 draws + ≤6 merged kit buckets + sky dome + moon + ash Points ≈ well under budget), ≤4 lights/zone, and that tightening fog during a scare only REDUCES draws. Note any zone near the ceiling for a merge pass.
- [ ] **Step 3:** Append the Drop-1 section to `docs/PLAYTEST.md` (checklist, spec §12): all 10 scare beats fire once each, none during combat, all ≥90 s apart; each of the 4 screen gimmicks + false-pulse used ≤2×; Watcher seen 3–6× (target 4: Gate Fields quiet, AF-2, Cinder rooftop, PD-1), despawns within 10 m, never approached; Hag bargain — each of the four rows exercisable, decline is a no-op, max-ember cap lowers on `ember` and restores on leaving Greater Vael; the player's checkpoint banner is NEVER spoofed (PD-2 far banner burns, [7,10] stays ash+kneelable); flicker-safe mode strips per-frame components on all four gimmicks; a v1 beaten-castle save migrates and the postern opens; **veteran difficulty is flagged owner-tunable** — capture ember-economy notes for retune (owner decision 6). Test every clip in a 9:16 crop.
- [ ] **Step 4:** Verify the five clip crops render in 9:16 (`gv-clip-oak`, `gv-clip-watcher`, `gv-clip-hag-bargain`, `gv-clip-lights`, `gv-clip-chasm`). Fix any P0 from the sweep in `tuning.ts` / zone data only. Commit `test(e2e): greater vael exterior smoke + perf + playtest drop-1`.

---

## Cut line (apply in this order if behind; mirrors v1's cut-line style)

Ship-when-ready (no hard deadline), but if scope must shrink, cut in this order — each cut leaves a coherent, testable drop:
1. **Pilgrim's Descent height layer → flat.** Ship the zone with a flat `heightGrid` (all `'0'`); keep the vista + PD-1/PD-2 + sealed gate. The gorge reads via fog + void, not elevation. (Biggest engineering saving; the height layer is the only genuinely new render surface.)
2. **CV-3 curdled-well pure-visual beat.** Drop the well beat (keep the `gv-village-well` inscription). Cinder Village still teaches with CV-1/CV-2.
3. **The two standalone quiet Watcher sightings** (Gate Fields treeline, Cinder rooftop). Keep the two hero sightings (AF-2, PD-1). Watcher count drops 4→2 — still inside the 3–6? No: below 3, so if cut, drop only ONE (keep three total).
4. **One second scare beat per zone** (GF-2 false-pulse, then AF-1 silhouette). The DreadDirector + kit stay; the ledger just carries fewer beats.

**NEVER cut:** the four zones existing + connected; the DreadDirector hard rules + their tests; the save v1→v2 migration; the Hag bargain (the drop's one interaction); the two hero clips (AF-2 watcher, PD-1 chasm); the tall-entity silhouette discipline.

## Deferred (NOT in this drop — checked against the spec)

- **NG+ / Second-Vigil anomalies for the Greater Vael zones.** The spec pins Drop-1 NG+ anomalies NOWHERE — §14 lists "NG+ anomalies +4 each" only as future-drop scope-setting (Drops 2–3), and §10/§11/§12 add no Drop-1 anomaly requirement. `secondVigilSave` resets to `ashen-gate` and the `anomaliesForZone` registry has no gv entries; both stay that way. Deferred deliberately; revisit when Drop-2/3 formalize the +4/drop cadence.
- **`EnemyPersistence` + weapon slots** (spec §10, §14) — Drop 2 (the Bell-Wight / Salt Brand). The v2 save schema intentionally omits them.

## Spec-coverage mapping (every spec section → task)

- §1 pillars, §2 supersession → Global Constraints (obeyed by all).
- §3 world map delta / postern → Task 9 (Gate Fields + Ashen Gate postern + `greater-vael-open`).
- §3.1 Gate Fields → Task 9 · §3.2 Ashen Forest N → Task 10 · §3.3 Cinder Village → Task 11 · §3.4 Pilgrim's Descent → Task 12.
- §4 exterior engine (kind/heightGrid/fogCells/exteriorSky/scares/watcherAnchors/hagThreshold, fog default 16) → Task 1 (surface) + Task 2 (rendering, ramps, sky/moon/ash).
- §5 DreadDirector (all 9 hard rules) → Task 3.
- §6 entity tuning block → Task 1 · §6.1 Ash-Hound + §6.2 Kneeling Hollow → Task 4 · §6.3 Watcher + §6.4 Hag bargain → Task 5.
- §7 screen-effect scare kit (4 tools + flicker-safe fallbacks) → Task 3.
- §8 tithe story spine → inscriptions in Tasks 9–12 (bijection-forced) + visions/Ash-Priest in Task 8.
- §9 audio (beds, knock, silence-spike, pant/creak) → Task 6.
- §10 save v1→v2 + migration → Task 7.
- §11 perf & accessibility (budgets, flicker-safe) → Global Constraints + Task 2 (instancing) + Task 3 (fallbacks) + Task 13 (perf sweep).
- §12 testing (unit + Playwright + PLAYTEST) → per-task TDD + Task 13.
- §13 clip moments (5) → Task 9 (#1 oak), Task 10 (#2 watcher, #3 hag), Task 11 (#4 lights), Task 12 (#5 chasm).
- §14 future drops → Deferred section (scope-setting only).
- §15 open items → none open; Watcher 3.0 m exception encoded in `TUNING.greaterVael.watcher` (Task 1); the single v1-file touch is Task 9's Ashen Gate postern.

## Self-review notes (done)

- **Spec coverage:** every §maps above; no section unassigned. The two "flagged for owner" items (Watcher height, the single v1-file touch) are decided, not open, and land in Tasks 1 and 9 respectively.
- **Placeholder scan:** no "TBD"/"similar to Task N"/"add error handling". All inscription prose (19 entries), vision captions (5), and Ash-Priest lines (2 sequences) are written in full; all tuning values are the spec's verbatim block; all grids are copied verbatim with door/pair/lore ids pinned.
- **Type/name consistency (Produces↔Consumes cross-checked):** `ZoneId` gv ids + `salt-road`; `EnemyKind 'hound'|'kneeler'` (Watcher/Hag are NOT EnemyKinds — presences); `GameFlag` gv set incl. `tithe-ledger`; lock `'greatervael'`→`'greater-vael-open'`; `SaveData.version 2` + `greaterVael` block matches Task 3's `director.snapshot()` (`glitchSeen`/`watcherSightings`) and Task 5's `HagState` (`maxEmberCap`/`bargains`↔`hagBargains`); `ScareBeat`/`ScareTrigger`/`ScareGimmick` identical in Task 1 (defn) and Tasks 3/9–12 (use); `pair` edge ids match across each door's two ends (`gate-fields-postern`, `gf-village`, `gf-forest`, `gf-descent`); vision ids (`vision-gate-fields`/`-ashen-forest`/`-cinder-village`/`-pilgrims-descent`, `gv-vision-hag`) unique; the DreadDirector's `duckToSilence`/`setSnapResolution`/`setRenderScale`/`setDesaturation` calls all resolve to real existing (or Task-6-added) setters.
- **Bijection safety:** inscription prose is authored inside each zone task (not a monolithic lore task) precisely so `zones.test.ts`'s "every placed id resolves" + "no orphaned base entry" stay green at every commit; Task 8 (visions/dialogue) touches no `LORE`, so it is green before the zones land.
- **Ordering is dependency-honest:** engine (1–2) → director/entities/content/save (3–8) → zones (9–12, which consume all prior) → integration (13).
