# World Expansion (v1.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Vael into a full explorable world — real doors between areas, multi-level castle + three enterable landscape ruins, interior torchlight, and a three-act ghost-echo storyline.

**Architecture:** Doors decorate existing zoneGraph gate cells (one mechanism: presentation + lock bit on top of transitions). Vertical space = heightGrid slopes within zones + separate floor-zones joined by stairwell doors. Story = data-driven EchoScene engine replaying silent apparition moments with existing rigs + ghost material. Everything additive; v1.1 saves load unchanged.

**Tech Stack:** Three.js + Vite + TS, vitest, Playwright e2e. Content pattern: `src/content/zones/*.ts` ZoneDefs.

**Spec:** `docs/superpowers/specs/2026-07-06-world-expansion-design.md` (owner-approved). Read it before any task.

## Global Constraints

- PS1 render-path byte-pin stays green (`npm test` includes the pin); HD semantics untouched.
- ≤100 draw calls per zone; flicker-safe cap respected (torches use the shared flicker pool, 3-6 per zone).
- gzip growth ≤ +40 KB total for the branch.
- v1.1 save fixture loads clean; ALL save-schema additions are additive with `[]`/absent defaults.
- No nav UI, no quest markers, no fast travel, no new enemy kinds, no combat changes.
- Interior ambient stays near void-black — torches are pools, not general lighting.
- Zone ids in spec §3/§4 are canonical: `hallGallery`, `hallBarracks`, `keepChapel`, `towerGround`, `towerUpper`, `chapelNave`, `chapelCrypt`, `manorGround`, `manorUpper`.
- Named cast (provisional, owner may veto at playtest): King **Osric**, Queen **Maren** (canon, corrected T5), **Callun, the First Sworn** (canon, corrected T9) (= Forsworn). Player-knight nameless.
- Commit style: existing conventional-commit voice (see `git log`); every task ends green: `npx tsc --noEmit && npx vitest run` before commit.

---

### Task 1: Door system kit

**Files:**
- Create: `src/world/doors.ts`, `src/world/__tests__/doors.test.ts`, `src/world/__tests__/reachability.test.ts`
- Modify: `src/world/zoneDef.ts` (add `doors?`), `src/world/zoneGraph.ts` (expose edge lookup if not already public), `src/engine/save.ts` (or the module holding the save schema — find with `grep -rn "doorsOpened\|SaveData" src` first; add `doorsOpened: string[]`), `src/main.ts` (gate-cell transition path: barred check + OPEN interactable + fade), `src/world/ZoneBuilder.ts` (door prop placement at decorated gates)
- Test: files above

**Interfaces (produces — later tasks rely on these exact names):**

```ts
// zoneDef.ts addition
export interface ZoneDoorDef {
  gate: string;              // gate digit this door decorates, e.g. '1'
  label: string;             // "Iron Door" | "Postern Gate" | "Stair Door" | ...
  locked?: 'far-side';       // passable ONLY from the defining zone until first passage
}
// ZoneDef gains: gateDoors?: ZoneDoorDef[] // NOTE: renamed from doors — that name was taken by the existing transition table (T1 deviation, approved);

// doors.ts
export function doorEdgeId(zoneA: string, zoneB: string, gate: string): string;
// → lexicographic: doorEdgeId('undercroft','gateFields','2') === 'gateFields-undercroft:2'

export interface DoorInstance {
  edgeId: string;
  label: string;
  definedIn: string;         // zone id whose ZoneDef carries the entry
  gate: string;
  lockedFarSide: boolean;
}
export function collectDoors(zones: ZoneDef[]): Map<string, DoorInstance>; // by edgeId; throws on duplicate edge definitions
export function isBarred(door: DoorInstance, approachingFrom: string, opened: ReadonlySet<string>): boolean;
// barred ⇔ lockedFarSide && approachingFrom !== definedIn && !opened.has(edgeId)
```

**Behavior wired in main.ts:** a decorated gate no longer transitions on walk-in — the gate cell is blocked (panel collides) and registers an `Interactable { verb: 'OPEN', label }` (Interactor already supports OPEN). On E: if barred → transient caption `Barred from the other side.` (reuse inscription/caption UI); else hinge SFX (synth fallback pattern from `src/audio/`) → 400 ms black fade (reuse existing death/transition fade if present — `grep -rn "fade" src/ui src/main.ts`) → run the normal zone transition to the paired gate → add edgeId to `doorsOpened` set (persist via save).

- [ ] **Step 1: Failing tests** — `doors.test.ts`: edgeId lexicographic ordering; collectDoors dedup/throw; isBarred truth table (4 cases: defining side always passes; far side barred before open, passes after; unlocked door never barred). `reachability.test.ts`: BFS over zoneGraph from the start zone treating far-side-barred edges as one-way (passable only from `definedIn`); assert EVERY zone reachable AND the finale zone reachable. (This test also guards all future content tasks.)
- [ ] **Step 2: Run, verify fails** — `npx vitest run src/world/__tests__/doors.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `doors.ts` + zoneDef field + save field (additive: absent → `[]`).
- [ ] **Step 4: Wire main.ts + ZoneBuilder** — door prop (stone frame + iron-studded panel ≤120 tris, shared geometry, PS1-crunch texture via existing pack pipeline), placed/oriented at decorated gates on BOTH sides of the edge; OPEN interactable; barred caption; fade+transition+persist.
- [ ] **Step 5: All green** — `npx tsc --noEmit && npx vitest run` (837+ existing must stay green; reachability passes trivially — no doors defined yet).
- [ ] **Step 6: Commit** — `feat(world): door system — doors decorate gates, far-side bars, reachability guard`

### Task 2: Interior kit — torches, dread opt-in, stair conventions

**Files:**
- Create: `src/world/__tests__/interiorKit.test.ts`
- Modify: `src/world/zoneDef.ts` (add `dreadInterior?: boolean`, `torches?: { at: GridPos; rotY?: number }[]`), `src/main.ts` (dread gate: `def.kind === 'exterior' || def.dreadInterior`), `src/world/ZoneBuilder.ts` + props module (torch prop kind), `src/world/lighting.ts` (torch flicker pool)

**Interfaces (produces):**
- ZoneDef additions: `dreadInterior?: boolean` · `torches?: { at: GridPos; rotY?: number }[]`
- Torch = bracket + flame quad + warm PointLight on the existing flicker pattern, drawn from a shared pool; content review bound 3-6/zone enforced by test `torches.length <= 6`.
- **Stair convention (doc + example, no new engine):** walkable stairs are heightGrid slopes rising ≤0.45 m/cell with the existing `stairs` prop aligned on top as the visual; landings are flat cells carrying a stairwell door gate. Document in a comment block at top of `zoneDef.ts`.

- [ ] **Step 1: Failing tests** — torch cap per zone; dread gate honors `dreadInterior` (unit-test the predicate — extract `dreadEligible(def)` helper into `src/engine/DreadDirector.ts` or a small util and test it directly); flicker pool never exceeds flicker-safe cap with 6 torches.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement + wire.** Draw-call check: extend the existing draw-call budget test pattern (find with `grep -rn "draw call\|drawCall" src`) to a zone with 6 torches.
- [ ] **Step 4: Green** — full suite.
- [ ] **Step 5: Commit** — `feat(world): interior kit — pooled torchlight, dread opt-in for interiors, stair convention`

### Task 3: EchoScene engine

**Files:**
- Create: `src/engine/EchoScene.ts`, `src/engine/__tests__/echoScene.test.ts`, `src/content/echoes/index.ts` (empty registry now)
- Modify: save module (`echoesWitnessed: string[]` additive), `src/main.ts` (per-frame update + trigger check), ghost material source (locate: `grep -rn "vision-ghost\|CrossingSilhouette" src`)

**Interfaces (produces — Task 9 authors content against these):**

```ts
export interface EchoActorDef {
  rig: 'soldier' | 'archer' | 'kneeler' | 'king' | 'queen' | 'knight'; // king/queen/knight = soldier rig + tint/crown variant
  at: GridPos;
  facing?: number;
  keyframes?: { tMs: number; at?: GridPos; facing?: number }[]; // linear walk between keyframed cells
}
export interface EchoSceneDef {
  id: string;                 // e.g. 'act1-oath'
  zone: string;               // zone id it plays in
  act: 1 | 2 | 3;
  triggerCells: GridPos[];    // player enters any → scene starts (once per run; re-arm in NG+ only)
  durationMs: number;         // 10000-20000
  actors: EchoActorDef[];
}
export class EchoSceneSystem {
  constructor(scenes: EchoSceneDef[], deps: { witnessed: Set<string>; onWitness(id: string): void; brandPulse(): void });
  enterZone(zoneId: string): void;
  update(dtMs: number, playerCell: GridPos): void;  // trigger check + actor interpolation
  activeActors(): { rig: string; x: number; z: number; facing: number; opacity: number }[]; // renderer consumes
}
```

Fade envelope: 1.5 s in → hold → 1.5 s out, opacity ≤0.45, brand pulses while active. Player control NEVER taken. Silent (no SFX beyond existing ambient).

- [ ] **Step 1: Failing tests** — trigger fires on cell entry & only once; witnessed persists via `onWitness`; keyframe interpolation position math; fade envelope opacity at t=0/mid/end; NG+ re-arm (witnessed cleared on NG+ start — follow the existing NG+ reset pattern, `grep -rn "ngplus" src/world`).
- [ ] **Step 2: Verify fail.** — `npx vitest run src/engine/__tests__/echoScene.test.ts`
- [ ] **Step 3: Implement** — pure-math system (no three.js in the class; renderer adapter in main.ts using ghost material + rigs).
- [ ] **Step 4: Renderer adapter in main.ts** — pool ghost meshes per rig kind; king = soldier rig + crown cone + pale tint; queen = kneeler rig + pale tint; knight = soldier rig untinted.
- [ ] **Step 5: Green; commit** — `feat(engine): EchoScene system — silent apparition replays with witnessed persistence`

### Task 4: The keep, upper floors — hallGallery + hallBarracks

**Files:**
- Create: `src/content/zones/hallGallery.ts`, `src/content/zones/hallBarracks.ts`
- Modify: `src/content/zones/greatHall.ts` (2 new gate cells: stairwell up to gallery, side door to barracks), `src/content/zones/ramparts.ts` (gate to gallery), `src/content/zones/index.ts` (register)

**Requirements (pattern: copy structure of `ramparts.ts` — grid + heightGrid + props + enemies + inscriptions):**
- `hallGallery` (~10×14): ring-gallery layout overlooking the hall — outer walkable ring, inner rail cells (non-walk, see-through to void-black below reads as the hall). heightGrid flat. Doors: `Stair Door` gate ↔ greatHall (unlocked), gate ↔ ramparts labeled `Gallery Door` (unlocked — this is shortcut loop #2). Torches ×4. Enemies: 2 soldiers + 1 archer (NG+: +1 wraith). Scene 6 trigger space reserved: keep cells `[4,6]-[5,7]` clear of props. Inscriptions: 2 (Act III slots, placeholder ids `act3-gallery-a/b` — Task 9 writes prose).
- `hallBarracks` (~8×8): bunks (crate props re-dressed) + armory clutter; 1 soldier; torches ×3; inscriptions: 2 Act I muster-flavor slots. Door ↔ greatHall `Barracks Door`.
- [ ] **Steps:** structural tests green (gates pair, props on floor cells, reachability incl. new zones) → zones render (dev-server eyeball) → torch/draw-call budgets green → full suite → commit `feat(content): the keep grows — gallery above the great hall, barracks off it`

### Task 5: The keep, chapel + the postern payoff

**Files:**
- Create: `src/content/zones/keepChapel.ts`
- Modify: `src/content/zones/ramparts.ts` (chapel gate), `src/content/zones/undercroft.ts` + `src/content/zones/gateFields.ts` (postern edge), zone index

**Requirements:**
- `keepChapel` (~7×9): raised altar via heightGrid slope (stair convention), pews (crate rows), kneeler at altar, torches ×3, 2 Act II inscription slots (queen lore tie-in — prose in Task 9). Door ↔ ramparts `Chapel Door`.
- **Postern:** new gate pair undercroft↔gateFields; undercroft side defines `{ gate, label: 'Postern Gate', locked: 'far-side' }` → barred from Gate Fields until first passage from inside. Reachability test must stay green WITHOUT the postern (it's a shortcut, not a route).
- [ ] **Steps:** failing structural/reachability additions → implement → full suite → commit `feat(content): keep chapel; the postern — Vael lets you out before it lets you in`

### Task 6: The Watchtower (Gate Fields)

**Files:**
- Create: `src/content/zones/towerGround.ts`, `src/content/zones/towerUpper.ts`
- Modify: `src/content/zones/gateFields.ts` (tower door gate at a sensible field cell + tower silhouette prop at that cell's block), zone index

**Requirements:**
- Entry: `Tower Door` on gateFields (unlocked). `towerGround` (~6×6): ruined guardroom, torches ×3, 1 soldier, 1 Act I inscription slot, stairwell door up.
- `towerUpper` (~6×8): upper room + **roof walk via heightGrid slope** (parapet cells at top height, wind-exposed — vista of the fields; reuse exterior sky since zone reads open-air: `kind: 'exterior'`, dread default). 1 archer on the roof. Scene 2 trigger cells reserved on the roof. 1 Act I inscription slot.
- [ ] **Steps:** structural + reachability green → eyeball → budgets → commit `feat(content): the watchtower stands — ground, stair, roof walk over the fields`

### Task 7: The Sunken Chapel (Ashen Forest N)

**Files:**
- Create: `src/content/zones/chapelNave.ts`, `src/content/zones/chapelCrypt.ts`
- Modify: `src/content/zones/ashenForestN.ts` (chapel door gate + shell silhouette), zone index

**Requirements:**
- `chapelNave` (~7×11): half-collapsed nave, raised altar (heightGrid), torches ×3 (some unlit — prop without light), Scene 5 trigger down the aisle, 2 Act II inscription slots, stair-door DOWN to crypt (`Crypt Stair`).
- `chapelCrypt` (~6×7): `dreadInterior: true`, near-black, torches ×2, **1 wraith**, 1 Act II inscription slot, bones scatter.
- [ ] **Steps:** structural + reachability → eyeball → budgets → commit `feat(content): the sunken chapel — nave above, crypt below, the queen walked here`

### Task 8: The Burnt Manor (Cinder Village)

**Files:**
- Create: `src/content/zones/manorGround.ts`, `src/content/zones/manorUpper.ts`
- Modify: `src/content/zones/cinderVillage.ts` (manor door gate + facade), zone index

**Requirements:**
- `manorGround` (~8×9): fire-gutted hall, collapsed-beam props (rubble), kneeler vigil by the hearth, torches ×3, Scene 4 trigger at the hearth, 1 Act II inscription slot, stairwell door up.
- `manorUpper` (~8×7): gallery with **missing-floor cells** (non-walk holes reading down into ground floor — void-black, matches undercroft treatment), 1 soldier, 1 Act II inscription slot, torch ×2.
- [ ] **Steps:** structural + reachability → eyeball → budgets → commit `feat(content): the burnt manor — they chose the fire`

### Task 9: The story lands — 7 echo scenes + inscription re-arc + banner memories

**Files:**
- Create: `src/content/echoes/act1.ts`, `act2.ts`, `act3.ts` (EchoSceneDefs per Task 3 interface), `src/content/echoes/__tests__/echoes.test.ts`
- Modify: `src/content/echoes/index.ts` (register all 7), inscription content files (locate: `grep -rn "inscription" src/content --include=*.ts -l`), banner-kneel text source (`grep -rn "kneel" src/content src/ui -l`)

**Requirements:**
- The 7 scenes exactly as spec §5 table (ids `act1-oath`, `act1-muster`, `act2-betrayal`, `act2-burning`, `act2-queens-walk`, `act3-king-hollows`, `act3-crown-down`), zones: gateFields, towerUpper, ashenGate, manorGround, chapelNave, hallGallery, undercroft. 3-8 actors each, 10-20 s, staging tells the moment silently (e.g. oath: 5 knights kneel before Osric; betrayal: Carrow walks to the gate and stands as it opens).
- Inscription re-arc: re-sequence/edit existing 58 so each zone's set carries its act; fill the new slots from Tasks 4-8 (12 new inscriptions); named cast used consistently; forward-dread rule (warn, don't only mourn) preserved. Voice: match existing inscription prose exactly (read 10+ before writing).
- Banner-kneel memories: 3 lines (one per act), rotating by the banner's zone act.
- Tests: all 7 scenes reference REAL zone ids + in-bounds trigger/actor cells (validate against ZoneDefs); every act has ≥2 zones carrying it; new inscription ids unique.
- [ ] **Steps:** failing content-validation tests → author scenes + prose → green → commit `feat(story): three acts of Vael — oath, betrayal, hollowing — told in ghosts and stone`

### Task 10: Skyline + verification sweep

**Files:**
- Modify: exterior zones (2-3 silhouette ruin shells at vista distance — instanced, ≤60 tris each), `e2e/` smoke (extend: open one door, witness one echo — follow existing Playwright pattern), save-fixture test (v1.1 fixture json → loads, doors/echoes default empty)
- Create: `src/world/__tests__/saveMigration.test.ts` (if no equivalent exists)

- [ ] **Steps:** silhouettes placed (eyeball) → e2e extended + green locally ×3 → save fixture green → **budgets audit**: draw calls per new zone logged + asserted, gzip delta measured (`npm run build` + compare) ≤ +40 KB → full suite + tsc → commit `feat(world): skyline ruins; e2e opens a door and meets a ghost; v1.1 saves verified`

### Task 11: Whole-branch review + ship

- [ ] Whole-branch Opus review (`git diff dev...feat/world`) — 0 Critical to proceed; fix wave if needed (per-finding commits).
- [ ] Merge `feat/world` → `dev`, push (UNSANDBOXED — sandboxed push fakes success; verify `git ls-remote origin dev`).
- [ ] Owner playtest 7/7 evening (PLAYTEST.md addendum: doors feel, stairs read, torch pools, echo scenes land, get-lost-find-out loop, budgets on real GPU).
- [ ] On owner GO: push `dev:main`, tag `v1.2.0`, `gh release create` — unsandboxed + ls-remote verify.

---

## Self-review (done at planning time)

- **Spec coverage:** §1→T1 · §2→T2 · §3→T4,T5 · §4→T6,T7,T8,T10 · §5→T3,T9 · §6→T1 reachability + T5 postern · §7→T10,T11 + global constraints. Cut-order maps to task order: T8 → chapelCrypt (in T7) → keepChapel (in T5) → T10 silhouettes.
- **Type consistency:** `ZoneDoorDef`/`doorEdgeId`/`isBarred` (T1) consumed by T4-T8 content; `EchoSceneDef`/`EchoActorDef` (T3) consumed by T9; `dreadInterior`/`torches` (T2) consumed by T4-T8. Names checked for drift.
- **Placeholder scan:** content prose deferred to T9 is explicit *scoped work with acceptance tests*, not a TBD; zone grids are specified by dims/contents/pattern-file with structural tests as the acceptance gate (established codebase pattern — implementers iterate against tests, reviewers gate).
