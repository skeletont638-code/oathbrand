# OATHBRAND — Playtest checklist (Task 19)

The full-run playtest for OATHBRAND, split into two passes:

- **AGENT-VERIFIED** — driven programmatically on **2026-07-02** against the
  production `vite build` (served by `vite preview`), using headless Chromium +
  the `?dev=1` `window.__oathbrand` handle and its deterministic `stepFrame()`.
  Every item below has an evidence pointer (a `docs/shots/task19-*` capture
  and/or the runtime assertion that passed). Re-run: `npm run build`, start
  `vite preview --port 4180`, then the sweep driver documented in
  `.superpowers/sdd/task-19-report.md`.
- **OWNER PASS** — items that need human hands or human judgement (a real phone,
  a real pointer-lock grant, ears on the mix, and ratifying feel/tuning). The
  agent does **not** sign these off.

**P0 policy:** a P0 is broken progression, a crash, a softlock, or save
corruption. The agent fixes P0s (commit per fix). Feel/tuning is **not** the
agent's to change — candidates are logged under OWNER PASS with evidence, except
a P0-severity tuning bug (none found).

**Sweep result: 20/20 agent checks passed · 0 P0s found.**

---

## AGENT-VERIFIED

### Playwright smoke (Step 1)
- [x] `e2e/smoke.spec.ts` (chromium): loads `/oathbrand/`, canvas present, a live
      WebGL context, click **BEGIN** → state `playing` within 10 s, **zero
      console errors**. **Executed locally — green** (`npx playwright test`), and
      wired into CI (`.github/workflows/ci.yml` job `e2e`; `deploy` needs
      `[build, e2e]`; deploy still only from `main`). `window.__oathbrand.state`
      is exposed under `?dev=1` **or** a `VITE_E2E=1` build only — never the
      shipped bundle.

### All four endings reachable
| # | Ending | Path driven | Result | Evidence |
|---|--------|-------------|--------|----------|
| E1 | OATH KEPT | summit, lit, **GIVE** the crown | `endingId === 1`, state `ending` | `task19-ending1-oath-kept.png` |
| E2 | OATH BROKEN | summit, two-press **KEEP** at the stair (1st press → confirm pending, 2nd → commit) | `endingId === 2` after 2nd press | `task19-ending2-oath-broken.png` |
| E3 | HOLLOW | summit, brand hollow, reach the flame | `endingId === 3`, `brand.hollow` | `task19-ending3-hollow.png` |
| E4 | THE FLAME THAT LENDS | **staged NG+ garden path** (`queens-brand` flag), **GIVE** the crown | `endingId === 4`, state `ending` | `task19-ending4-flame-that-lends.png` |

### All six banner visions trigger
Each: kneel at the zone banner on a fresh save → state `vision`, and the memory
id is **banked into `save.visionsSeen`** (proof it actually played, not just
started). Verified for all six:

- [x] `vision-ashen-gate` — `task19-vision-ashen-gate.png` (caption + ghosts visible)
- [x] `vision-great-hall` — `task19-vision-great-hall.png`
- [x] `vision-undercroft` — `task19-vision-undercroft.png`
- [x] `vision-ramparts` — `task19-vision-ramparts.png`
- [x] `vision-throne` — `task19-vision-throne.png` (boss suppressed via `forsworn-dead`)
- [x] `vision-queens-garden` — `task19-vision-queens-garden.png` (NG+ only)

> The **summit** banner is a plain checkpoint with **no** memory — correct by
> design (`VISIONS` has no `summit` entry); it is not one of the six.

### Progression mechanics
- [x] **Gatekey pickup** — `gatekey-vael` in the Undercroft → sets flag `gatekey`.
- [x] **Gatekey door** — `hall-throne-door` is **SEALED** without the flag
      (player stays in `great-hall`), and **opens to `throne`** with it. (Two
      staged-save runs: no-flag vs `['gatekey']`.)
- [x] **Shortcut loop** — the Ramparts kick-gate `ramparts-shortcut` → sets flag
      `shortcut-open` and swings open (`shortcutGate.opening === true`).
      `task19-shortcut-kicked.png`. *(Flag is `shortcut-open`, not `shortcut` —
      via `LOCK_FLAG` — the mechanic is correct.)*
- [x] **Illusory wall → Queen's Garden reveal** — `undercroft-illusory` on a NG+
      run → sets flag `garden-found` and transitions to `queens-garden`.
      `task19-illusory-garden-reveal.png`.

### Hollow-mid-boss behaviour (the Mercy)
- [x] Engaged the Forsworn in the throne arena (fight state reached `attack`),
      then hollowed the brand mid-fight → the Forsworn **collapses to `idle`**,
      **turns his back** (`yaw === π`, `FORSWORN_MERCY_YAW`), stays `alive`, and
      the arena gate reopens (`mercy-open`). `task19-hollow-mid-boss-mercy.png`.

### NG+ anomaly count (≥8 visible)
**12 anomalies** are authored across 6 zones (the Queen's Garden itself is the
seventh "wrong thing"). On a Second-Vigil boot, each zone's built scene gains
the anomaly objects — confirmed by the base→NG+ scene-object delta and captures:

| zone | anomalies | obj Δ (base→NG+) | shot |
|------|-----------|------------------|------|
| ashen-gate | banner-burning · herald-gone · torii-inverted | +6 | `task19-ngplus-ashen-gate.png` |
| great-hall | statue-turned · extra-door · kneeling-armor | +21 | `task19-ngplus-great-hall.png` |
| undercroft | still-wraith | +3 | `task19-ngplus-undercroft.png` |
| ramparts | second-moon · ghost-banners | +4 | `task19-ngplus-ramparts.png` |
| throne | ash-figure · black-torch | +4 | `task19-ngplus-throne.png` |
| summit | blue-flame | +2 | `task19-ngplus-summit.png` |
| queens-garden | *(the zone itself)* | +0 | `task19-ngplus-queens-garden.png` |

- [x] **12 ≥ 8** — anomaly presence confirmed in 6/7 zones (garden excluded by
      design), object delta +40.

### Performance per zone (dev HUD)
Steady-state, read from `renderer.info` + the `?dev=1` HUD. **Draw calls is the
GPU-independent budget metric and is the pass/fail gate.** FPS here is
**software-rendered** (Playwright's headless SwiftShader, no GPU) so it reads
depressed vs. a real GPU — judge by steady-state, per the known T11 capture
quirk.

| zone | draw calls | triangles | fps (SwiftShader) | shot |
|------|-----------:|----------:|------------------:|------|
| ashen-gate | 22 | 51,736 | 46 | `task19-perf-ashen-gate.png` |
| great-hall | 42 | 90,688 | 47 | `task19-perf-great-hall.png` |
| undercroft | 33 | 60,564 | 53 | `task19-perf-undercroft.png` |
| ramparts | 32 | 73,000 | 58 | `task19-perf-ramparts.png` |
| throne | 3 | 40,102 | 58 | `task19-perf-throne.png` |
| summit | 30 | 28,008 | 54 | `task19-perf-summit.png` |
| queens-garden | 6 | 37,674 | 60 | `task19-perf-queens-garden.png` |

- [x] **< 100 draw calls / zone** — max 42 (great-hall base; 59 in great-hall
      NG+ with anomalies — still under). ✅
- [x] **60 fps target** — every zone renders in real time even in *software* GL
      (46–60 fps, no GPU). On a real GPU this is comfortably 60. **Owner should
      still eyeball the on-device 60 fps** (see OWNER PASS).

### Reduced-flicker run
- [x] `pipeline.setFlickerSafe(true)` applied, then swept all 7 zones — **no
      crash, no console errors** in any zone. `task19-reduced-flicker-undercroft.png`.

### Save-quit-resume at EVERY banner
For each of the 7 banners: **kneel** (rekindle → `onSave`) writes the checkpoint,
then a plain reload → **CONTINUE** restores it. Domain-level intactness checked
(the validator is shape-only):

| banner zone | saved zone | vision banked | restored zone | embers | state |
|-------------|-----------|:-------------:|---------------|:------:|-------|
| ashen-gate | ashen-gate | ✅ | ashen-gate | 5 | playing |
| great-hall | great-hall | ✅ | great-hall | 5 | playing |
| undercroft | undercroft | ✅ | undercroft | 5 | playing |
| ramparts | ramparts | ✅ | ramparts | 5 | playing |
| throne | throne | ✅ | throne | 5 | playing |
| summit | summit | — (no memory) | summit | 5 | playing |
| queens-garden | queens-garden | ✅ | queens-garden | 5 | playing |

- [x] All 7 — save written with the correct zone + banked visions, CONTINUE
      lands back in that zone in `playing` with the brand rekindled. No save
      corruption.

---

## OWNER PASS (human hands / human judgement)

### Must be done on real hardware / by ear
- [ ] **Mobile device run** — a genuine phone: touch stick + drag-look + ACT
      button, portrait/landscape, thumb reach, no page scroll. (Agent verified
      responsive CSS in T18; the *device feel* is yours.)
- [ ] **Pointer-lock real grant** — click canvas → lock acquired, Esc → pause,
      click → resume+relock. (Agent runs headless; lock rejects there.)
- [ ] **Audio soundscape listen** — the dread mixer by ear: ambience bed, threat
      duck, heartbeat, positional cues, ending motifs, the P3 torch-death hush.
- [ ] **60 fps on the target device** — confirm steady 60 on real GPU (agent's
      fps was software-rendered).

### Feel / tuning ratification (NOT changed by the agent — decide & tune in `tuning.ts`)
- [ ] **Wraith lunge threat envelope** — currently ~**2× `rangeM`**. Ratify the
      generous reach or shrink it.
- [ ] **Crowded archer never fights back** — the archer in a pack is an
      intentional pressure valve (never melees). Confirm it reads as *intended*,
      not broken.
- [ ] **Mix levels set analytically** — the master/ambience/sfx trims were set
      by number, not by ear. Ratify or re-balance.
- [ ] **`— — —` endings-tracker mark** — the fourth (hidden) ending shows as
      `— — —` until witnessed (controller-ratified). Owner may veto the styling.
- [ ] **Overall feel pass** — pacing of each zone, boss difficulty curve,
      ember-economy tension, ending payoffs.

---
---

# OATHBRAND — Greater Vael Drop 1 (spec §12)

The Drop-1 exterior expansion playtest, driven programmatically on **2026-07-03**
against the `VITE_E2E` build (served by `vite preview`), using headless Chromium
+ the `window.__oathbrand` handle — its dev/CI-only `loadZone(id)` jump (so the
sweep reaches a Greater Vael zone without a beaten-castle playthrough), the
`drawCalls` reader (`renderer.info.render.calls`, whole-frame — the E2E build
turns `autoReset` off + resets per frame exactly like the `?dev=1` HUD), and the
deterministic `stepFrame()`. Re-run: `npx playwright test` (the four
`e2e/greater-vael.spec.ts` cases run headless in-sandbox and in CI).

**Split:** AGENT-VERIFIED items were executed now, each with an evidence pointer
(a passing e2e assertion, an integration-sweep `SWEEP` line, a cited unit test,
or a checked-in shot). OWNER PASS items need human hands or human judgement —
above all the owner's *"genuinely creepy"* bar for the tall entities, which the
agent does **not** sign off. **P0 policy unchanged** (broken progression / crash
/ softlock / save corruption → agent fixes + commits per fix; feel/tuning →
OWNER PASS, never `tuning.ts`).

**Drop-1 sweep result: 34/34 agent checks passed · 0 P0s found.** The one P0
adjacent to this task (main.ts wrote `version:1` checkpoints and never persisted
`greater-vael-open`) was the T7 controller obligation — fixed under commit
`fix(save): main.ts writes v2 checkpoints + persists greater-vael-open` (TDD).

---

## AGENT-VERIFIED

### Playwright exterior smoke (Step 1) — executed locally + CI
- [x] `e2e/greater-vael.spec.ts` (chromium, 4 cases): jumps to each exterior zone
      via `__oathbrand.loadZone(id)`, polls state → `playing`, waits for the
      renderer to draw the zone, and asserts the **whole-frame draw count < 100**.
      Gate Fields additionally asserts **zero console errors**. **Executed
      locally — green** (`npx playwright test`, 3× no flake), and wired into CI
      (the config's `e2e/*.spec.ts` glob already picks the new spec up; the
      `deploy` job still `needs: [build, e2e]`, main-only). `loadZone` /
      `drawCalls` are exposed only under `?dev=1` **or** a `VITE_E2E=1` build —
      never the shipped bundle.

### Performance sweep (Step 2) — all four exterior zones under budget
Steady-state, measured live via `__oathbrand.drawCalls` (whole frame, both PS1
pipeline passes) + a scene-graph light count. **Draw calls is the GPU-independent
pass/fail gate.** FPS is not tabled: Playwright's headless GL is SwiftShader (no
GPU), so it reads depressed — judge draws/tris/lights (per the T19 quirk note).

| zone | draw calls | triangles | lights | budget |
|------|-----------:|----------:|-------:|--------|
| gate-fields | 30 | 56,098 | 1 | ✅ <100 · <100k · ≤4 |
| ashen-forest-n | 7 | 20,013 | 1 | ✅ (instanced grass/trunk/canopy = 3 draws) |
| cinder-village | 16 | 54,420 | 1 | ✅ |
| pilgrims-descent | 7 | 13,709 | 1 | ✅ (height layer adds no draw surface) |

- [x] **< 100 draw calls / zone** — max **30** (gate-fields). ✅
- [x] **< 100k triangles / zone** — max **56,098** (gate-fields). ✅
- [x] **≤ 4 lights / zone** — **1** each (the scene `AmbientLight`; the moon +
      sky dome + ash-fall are meshes/`Points`, not lights — zone `lights: []`). ✅
- [x] **Tightening fog only reduces draws** — the fog far-plane is a *shader*
      pull-in (the camera far-plane, `100 m`, is the cull boundary and is
      constant); a scare spawns **no** new drawable, so the measured steady-state
      is the per-zone ceiling — a scare can only hold or drop it. No zone is near
      the ceiling, so **no merge pass is needed**.

### Full Drop-1 traverse + doors both ways (`SWEEP B`)
- [x] Every Greater Vael zone loads to `playing` and renders (`SWEEP B-*-live`),
      and every authored door resolves with the correct destination — both
      directions of all four pairs:
      ashen-gate↔gate-fields (`gate-to-fields`/`gf-to-gate`), and the hub's three
      spokes gate-fields↔{cinder-village, ashen-forest-n, pilgrims-descent}
      (`gf-to-*`/`*-to-fields`). The two Drop-2 arches (`cv-to-saltroad`,
      `pd-to-saltroad`) are present but target the **unbuilt** `salt-road` (still
      in `FUTURE_ZONE_IDS` → sealed). **Zero console errors** across the traverse
      (`SWEEP B-console-clean`).

### Postern seal → open + v1→v2 migration in place (`SWEEP A`)
- [x] A **fresh** boot (no save) leaves `greater-vael-open` unset — the postern
      is sealed (`SWEEP A1-fresh-sealed`). A staged **beaten-castle v1** save
      (`endingsSeen:[1]`) migrates to **v2 in place** on load, opens the postern
      (`greater-vael-open` derived into the live flag set), and the stored payload
      now reads `version:2` with `greaterVael.open:true` (`SWEEP A2-*`). Migration
      + round-trip stay green (`save.test.ts`, 20 cases).

### Hag bargain — all four offer paths wired (`SWEEP C`, Ashen Forest N threshold)
- [x] **Ember tithe** — `maxEmberCap` drops `5→4`, `hag-tithed` set, one live
      ember burns now (`SWEEP C-ember-tithe`). **Kneel** — `hag-kneeled` set, cap
      untouched (`SWEEP C-kneel`). **Give ledger** — requires `tithe-ledger`;
      sets `hag-ledger-given`, consumes the ledger, cap untouched
      (`SWEEP C-ledger`). **Turn away (decline)** — a pure no-op: cap + struck
      bargains unchanged (`SWEEP C-decline-noop`). The **max-ember cap lowers on
      `ember` and restores on leaving Greater Vael** is code-verified at the GV
      boundary (`main.ts` `goThrough`: exterior→interior calls `restoreEmberCap` +
      persists at once) and unit-proven (`hagBargain.test.ts` `restoreEmberCap`,
      + the fog-line-once-per-visit guard). The full §6.4 table (all four rows,
      decline no-op, tithe-keeps-dropping) is exhaustively unit-tested
      (`hagBargain.test.ts`, 14 cases).

### Checkpoint save-write at a gv banner (`SWEEP D`) — the T7 obligation, live
- [x] Kneeling (rekindle) in Cinder Village writes a checkpoint that is **v2
      directly** (no v1↔v2 oscillation), carries the current zone, and mirrors the
      real postern flag into `greaterVael.open:true` (`SWEEP D-v2/-zone/-gv-open`).
      A reload re-derives the postern-open from that save and the saved zone
      persists (`SWEEP D-resume-*`) — save-quit-resume intact at a gv banner.

### DreadDirector ledger + the hard rules
- [x] The run-scoped director boots with a **clean ledger** on drop entry —
      `watcherSightings:0`, empty `glitchSeen` (`SWEEP F-*`). The Drop-1 caps are
      proven exhaustively (deterministic timers) in **`dreadDirector.test.ts`**:
      **≤10 beats/drop & ≤2× per gimmick** (`caps each gimmick at 2 and never
      exceeds 10 beats`), **≥90 s cooldown** (`fires A on approach, then holds the
      90s cooldown`), **never in combat / no cooldown burn** (`never fires in
      combat…`), **no damage field** (a damaging scare is unrepresentable),
      **Watcher ≤6** (`increments Watcher sightings and caps them at 6`),
      **min-sighting-range rule 10**, and **per-zone anchor scoping** (T5/T10
      review guards). 17 cases, all green.
- [x] **Checkpoint banner never spoofed** — PD-2 is a `desaturation`-only beat
      (touches no banner mesh; zone data `oneLine` "A banner burns where you can't
      reach; yours is safe."); the player's OWN banner sits at `[7,10]` as a real
      placed `built.banner` (a KNEEL interactable), so kneeling there always works
      (owner decision 8). Structurally guaranteed by the zone data.
- [x] **Flicker-safe strips per-frame components on all four gimmicks** — the
      screen-scare kit is flicker-safe **by construction** (no per-frame-random
      term in any of snap-grid / resolution-drop / desaturation / false-pulse), so
      `setFlickerSafe(true)` has nothing to strip. Proven byte-identical
      (`screenScareKit.test.ts` — `produces byte-identical output at the same
      elapsed`). The pipeline + kit toggles are both driven off the one settings
      sink (`main.ts` `setFlickerSafe`).

### v1 castle regression spot-check (`SWEEP E`)
- [x] A **fresh boot targets the Ashen Gate** (v1 start), unchanged: **22 draw
      calls** — byte-for-byte the T19 baseline. A **castle-interior walk**
      (great-hall) still loads + renders clean at **42 draw calls** — again the
      exact T19 number. **Zero console errors.** (`SWEEP E-boot-ashen-gate`,
      `-great-hall`, `-console-clean`.)
- [x] **v1 vista clip #1 still fires** after T12's vista-fire relocation:
      standing on the Ashen Gate vista row (`[1,5]`) and stepping banks
      `vista-ashen-gate` into `vista.seenIds` (`SWEEP E-vista-clip1`). The
      relocation did not regress the castle's signature reveal.

### Clip crops — every clip renders in a 9:16 phone crop (Step 4)
- [x] All five hero/beat crops verified at **720×1280** (ratio 0.5625, chasm
      741×1318 ≈ 0.562):
      `docs/shots/gv-clip-oak-916.png` (#1 oak) ·
      `gv-clip-watcher-916.png` (#2 AF-2 Watcher, hero) ·
      `gv-clip-hag-bargain-916.png` (#3 Hag) ·
      `gv-clip-lights-916.png` (#4 procession) ·
      `gv-clip-chasm-916.png` (#5 PD-1 chasm, hero). The oak canonical-name crop
      and the missing Hag 9:16 crop were produced this pass from their landscape
      sources; the other three shipped in Tasks 9–12.

---

## OWNER PASS (human hands / human judgement)

### The creepy bar (the drop's whole reason)
- [ ] **The tall entities are *genuinely* creepy** — the Watcher (frozen 3 m
      silhouette, never approached, despawn ≤10 m) and the Hag at the fog-line
      must *unsettle*, not read as janky props. This is the owner's call; the
      agent verified the *discipline* (frustum-freeze, off-screen-only reposition,
      budget), not the *dread*.
- [ ] **Watcher sighting cadence & framing** — target **4** across the drop (Gate
      Fields treeline / AF-2 / Cinder rooftop / PD-1), within the 3–6 budget.
      Confirm each sighting lands where intended, holds menace, and never lets you
      close the distance. (Budget + range + despawn are code/unit-enforced; the
      *staging feel* is yours.)
- [ ] **Scare pacing by feel** — the ≥90 s / ≤10-beat / ≤2×-gimmick rules make it
      *safe*; only play tells you if the cadence reads as mounting dread rather
      than a metronome. Ratify or ask for a retune (values in `tuning.ts`).

### Must be done on real hardware / by ear
- [ ] **Audio soundscape listen** — the four gv beds (field-wind/tithe-toll,
      forest-hush/wrong, cinder-wind/knock, descent-drone/wind), the **knock**,
      the **silence-spike** duck-to-silence, and the pant/creak positional cues —
      all set analytically (T6). Ratify by ear.
- [ ] **Mobile device run** — the exterior zones on a real phone: touch stick +
      drag-look, portrait/landscape, the height ramps, no page scroll, 60 fps on
      a real GPU (agent's fps was SwiftShader).

### Feel / tuning ratification (NOT changed by the agent)
- [ ] **Veteran difficulty is owner-tunable (owner decision 6).** Ember-economy
      retune notes for the owner: the Hag ember tithe is a **permanent −1 cap for
      the whole drop** (restored only on leaving Greater Vael / the next Vigil),
      the floor is `MIN_EMBER_CAP` and a tithe is refused at the floor or without
      a spare live ember (`canTithe`). On a beaten-castle entry the brand starts
      full (cap 5). If Drop 1 should bite harder on a veteran run, the levers are
      `TUNING.greaterVael` (fog defaults, Watcher range) + the ember-tithe
      cost/floor — all owner-side, none touched by this task.
- [ ] **Fog-line boon generosity** — an ember tithe parts Ashen Forest N's fog
      `+6 m` for the visit. Ratify the reach or shrink it.
- [ ] **Overall Drop-1 feel pass** — zone-to-zone pacing off the Gate Fields hub,
      the tithe story spine (inscriptions → visions → Ash-Priest), and whether the
      one interaction (the Hag) carries the drop.

---
---

# OATHBRAND — Realism pass (spec §11, `feat/realism`)

The realism-phase ratification (final sweep, Task 12), driven programmatically on
**2026-07-03** against the production `vite build` (served by `vite preview`) and
a `vite dev` server, using headless Chromium 148
(`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`) + the
`?dev=1` `window.__oathbrand` handle and its deterministic `stepFrame()`. The
realism diff spans lighting v2, photo-crunch textures, props, organic rigs (C1),
undulating terrain (C2), crooked trees (C3), boulder-ized props (C4), and
atmosphere (wind / banner sway / clutter / embers). Re-run: `npm run dev`, start
headless Chrome on `:9222`, then `node scripts/shoot.mjs <zone> realism-<zone>-sweep 1`
per zone (`node scripts/shoot.mjs <zone> --drawcalls` for the per-zone budget probe).

**Split:** AGENT-VERIFIED items were executed now, each with an evidence pointer
(the full unit suite, the e2e budget suite, a draw-call probe, or a checked-in
sweep shot the agent VIEWED). OWNER PASS items are eyeball/feel gates the agent
does **not** sign off. **P0 policy unchanged** — a P0 (broken progression / crash
/ softlock / save corruption) is agent-fixed in `tuning.ts` / zone data only;
feel/tuning is OWNER PASS.

**Realism sweep result: unit 776/776 · typecheck clean · build clean (233 KB gz)
· e2e 5/5 (3× no flake) · 4 exterior draw-call probes all < 100 · 7 sweep shots
ratified · 0 P0s found.**

---

## AGENT-VERIFIED

### Full unit suite + typecheck + build (Step 1)
- [x] `npx vitest run` — **776/776 passed**, 49 files (every realism task + curves
      C1–C4 + no regressions).
- [x] `npm run typecheck` (`tsc --noEmit`) — **clean**, exit 0.
- [x] `npm run build` — **clean**. Code bundle `dist/assets/index-*.js` =
      **842.87 kB / 233.28 kB gzip** (budget <1.5 MB gz — well under; ~code-size
      unchanged, textures live outside the JS). The seven crunched texture maps
      ship as **separate hashed `dist/assets/*.png`** (bark, ground-dirt, rock,
      hound-hide, kneeler-cloth, dungeon_texture, skeleton_texture — 2.4–8.7 kB
      each), **NOT inlined**: zero `data:image/png;base64` in the JS bundle. The
      4.85 MB `skeleton-warrior.glb` is an asset URL, also not in the JS.

### e2e draw-call budgets (Step 2)
- [x] `npm run e2e` (`playwright test`) — **5/5 passed, 3× consecutive no flake**,
      executed locally **in-sandbox** (headless Chrome was NOT blocked this run).
      Covers the smoke boot + the four `e2e/greater-vael.spec.ts` exterior
      draw-call budgets (each asserts `<100`; Gate Fields also asserts zero
      console errors). This is the CI gate as well.

### Per-zone draw-call probe (Step 2) — the realism diff did NOT breach the ceiling
Measured live via `scripts/shoot.mjs <zone> --drawcalls` (whole-frame count, max
over several settled `stepFrame`s), compared against the pre-realism GV Drop-1
sweep above.

| zone | draw calls (realism) | prev (Drop-1) | Δ | budget |
|------|---------------------:|--------------:|---:|--------|
| gate-fields | 35 | 30 | +5 | ✅ <100 |
| ashen-forest-n | 7 | 7 | 0 | ✅ <100 |
| cinder-village | 20 | 16 | +4 | ✅ <100 |
| pilgrims-descent | 9 | 7 | +2 | ✅ <100 |

- [x] The new static meshes (ground, skirt, roof-wedge, clutter, gibbet,
      standalone banner, gorge embers) added **+0…+5 draws** — under the ~8–10
      risk estimate. Max is **35** (gate-fields), 65 short of the ceiling. No zone
      is near budget; **no merge pass needed**.

### All-zone evidence sweep (Step 3) — every shot VIEWED by the agent
Seven `docs/shots/realism-<zone>-sweep.png`, each captured at the zone's
deterministic spawn (yaw 0) and frozen to a clean plate, then opened and read:

- [x] **gate-fields** (`realism-gate-fields-sweep.png`, 35 draws) — grounded foggy
      field at night: dithered dirt ground, a standalone checkpoint banner pole
      mid-frame, a rocky cliff at right, ash-fall + drifting clutter motes, brand
      HUD. Reads as a lit, textured place.
- [x] **ashen-forest-n** (`realism-ashen-forest-n-sweep.png`, 7 draws) — three
      crooked/asymmetric pines (C3: seeded trunk-bend + lumpy offset cones) with
      crunchy bark + needle maps, the forest-preset olive horizon band, embers.
- [x] **cinder-village** (`realism-cinder-village-sweep.png`, 20 draws) — crooked
      pines lining a winding path, a house with a procedural pitched roof-wedge +
      textured walls, a boulder prop (C4), fog depth, `[E] READ` prompt.
- [x] **pilgrims-descent** (`realism-pilgrims-descent-sweep.png`, 9 draws) — the
      gorge preset: reddish-brown fog gradient + drifting **gorge embers** (the
      new per-preset particle). The yaw-0 spawn frames the open chasm (matches the
      Task 10 `realism-gorge-embers.png` evidence exactly); the descent's
      terraces / boulder / archway geometry sits outside this frame but is proven
      by the 9 draws + the e2e pass + `gv-task12-descent.png`.
- [x] **ashen-gate** (`realism-ashen-gate-sweep.png`, 22 draws, interior) — stone
      brickwork with a warm torch-pool glow and the faint cool key filling the
      shadows without washing the pool out.
- [x] **great-hall** (`realism-great-hall-sweep.png`, 42 draws, interior) —
      hexagonal stone floor (crunch map), torch-lit pillars + wall blocks warm up
      front, the faint cool key filling the deep hall, the hall statue visible
      centre-back at `[1,13]`. Cool key present, torch pools intact.
- [x] **undercroft** (`realism-undercroft-sweep.png`, 33 draws, interior) — the
      **east half is held VOID-BLACK** (`keyLightIntensity 0`): only a faint near
      wall + a prop silhouette at top; the rest is pure black. The guard holds —
      the undercroft carries no key light and reads only by the player's brand.

- [x] **Visual expectations met:** exteriors read as grounded / lit / textured
      places; the undercroft east half is STILL void-black; castle interiors show
      the faint cool key without washing out the torch pools.

---

## OWNER PASS (eyeball / feel — NOT signed off by the agent)

### Entity scale & pose reads
- [ ] **Hound scale** — the C1 rig Box3-solves its ridge-top to **2.3 m** (unit
      test `hound: the heightM back-solve is preserved`, ±0.06 m), but the in-play
      read is **~2.1 m** vs the 2.3 m directive (spec §9). Whether to nudge the
      box/scale toward a stronger 2.3 read is the owner's call; the rig is authored
      to the box, so retune the box, not the pose.
- [ ] **C1 bent-leg read** — `bowM` (the `bentLimb` bow amount in
      `src/entities/organic.ts`) is available if the kneeler/hound bent legs want
      a stronger crooked read.

### Lighting / value reads
- [ ] **Kneeler luma vs terrain** — the kneeler reads luma **~18.8** ≈ terrain
      **~17.8**; if it should sit darker against the ground, the remedy is
      `TUNING.lighting` — **do NOT** double-darken (the entity already keeps the
      tint × map multiply on purpose).

### Motion feel (unit/CDP-verified smooth; the *feel* is an eyeball gate)
- [ ] **Wind sway + banner pole-sway at 60 fps** — verified smooth analytically
      (continuous sway; the banner pivots about its own pole, not the world origin
      — commit `015a6f3`) and in CDP; ratify that it *reads* smooth on real
      hardware rather than steppy.

### Brief Step-4 owner playtest (verbatim)
- [ ] All **10** Greater Vael scare beats still fire, **≥ 90 s apart**, none in
      combat.
- [ ] **Flicker-safe** still strips per-frame random components (held glitch
      timelines survive).
- [ ] The **checkpoint banner is never spoofed**.
- [ ] A **v1 beaten-castle save** still migrates.
- [ ] Owner walks all zones for the overall realism read (grounding, texture
      density, the tall-entity dread bar).
