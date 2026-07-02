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
