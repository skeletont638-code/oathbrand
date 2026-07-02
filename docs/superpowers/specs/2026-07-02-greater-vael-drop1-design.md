# GREATER VAEL — Drop 1: "The Fields" — Design Spec

**Date:** 2026-07-02
**Status:** Approved by owner (locked decisions below). Ship-when-ready.
**Branch:** `feat/greater-vael` (head = v1.0.0-ready).
**Tagline:** *The flame was lent. The kingdom sold it. Someone is still keeping the debt.*
**Supersedes (scoped):** the v1 non-goal "jump-scare horror design" — for Greater Vael zones only (see §2).

This spec pins Drop 1 to zero remaining design thinking (per the Pro-era task-shape constraint): four full zone layouts, every entity stat line, all ~10 scare beats, the Hag's full bargain table, all lore/inscription ids with briefs, and the drop's clip moments. The plan cut from this spec should require an implementer to make **no** creative choices.

---

## 1. Overview & pillars

Drop 1 is the first episode of Greater Vael — the dead kingdom **outside** the castle. Four zones (~35–45 min), an outdoor engine, two new killable enemies (Ash-Hound, Kneeling Hollow), two never-killable presences (the Watcher, the Hag of the Fog-Line), a `DreadDirector` scare system, and the "what did the kingdom DO with the lent flame" story spine (the tithe). It presumes the castle is beaten (§ owner decision 6).

**Design pillars (ranked):**

1. **Terror, not gore.** ~90% of runtime is dread; the drop cashes out in a shock rarely (~10 scare beats total, ≥90s apart) (per fear-psychology §1.1, §3.2). Folk horror is "almost entirely devoid of jump scares" — the pivot in §2 buys us the exceptions, not a budget to spend freely (per medieval-folk-horror §1.3).
2. **The world stays dead; one voice only.** No living NPC. The **Ash-Priest** remains the sole speaker (owner decision 2). Everything else is environmental storytelling and inscriptions — the folk-horror chain (landscape → isolation → skewed belief → the happening) told through found objects the player can read *ahead* of, not just about (per medieval-folk-horror §1.1, §1.3).
3. **Two watchers, never solved.** The Watcher and the Hag both watch, both recede when neared, both stay unresolved this drop — and they read as *visually distinct* so the player learns there are two things watching, not one (per stalker-tall-entities §7). The Hag is a **bargain, not a battle** (owner decision 3; per medieval-folk-horror §4).
4. **The engine notices IT.** The scare language is one consistent glitch metaphor — the render pipeline itself straining to represent the wrong thing — driven through the *existing* `PS1Pipeline` / `patchMaterial` / `mixer` APIs (per ps1-lowfi-horror §1.2, §6). Every new humanoid is silhouette-first, tall-and-underfed, stepped-animated (per stalker-tall-entities §2, §7; ps1-lowfi-horror §3).
5. **Exterior = exposure, not claustrophobia.** Fields read "I see it coming" (fog leads sight); forest reads "I feel it before I see it" (brand/audio leads) — the fog-vs-aggro mismatch is the content, not a bug to equalize (per forest-level-design §2, §6).

**Success criteria (Drop-1-specific, additive to v1 §1):**
- Four exterior zones playable from a beaten-castle save; migration from any v1 save works and is tested.
- Exactly ~10 scare beats fire, each ≥90s apart, none during combat, none dealing damage.
- Watcher seen 3–6 times, never approached, never explained.
- Perf budgets unchanged (<100 draw calls, ≤4 lights/zone, 320×240 target).
- At least two new clip moments (§8) work in a 9:16 crop.

---

## 2. Supersession note (jump-scare non-goal)

The v1 spec (`2026-07-01-oathbrand-design.md` §16) lists "jump-scare horror design" as an explicit non-goal. **This spec supersedes that line for Greater Vael zones only**, per owner-directed pivot (owner decision 7). The pivot is bounded:

- **Castle zones are untouched.** Ashen Gate, Great Hall, Undercroft, Ramparts, Throne, Summit, Queen's Garden keep their v1 behavior exactly — no new scares, no DreadDirector, no fog changes (Ashen Gate stays `fogFarM: 12`). The supersession does not reach back into shipped content.
- **The pivot is disciplined, not open season.** Scares are budgeted and rule-bound (§5). The research is unanimous that undisciplined jump-scares kill horror faster than anything (per fear-psychology §4; ps1-lowfi-horror §6) — so this spec spends the license on *earned* scares only (every beat carries a second payload: a lesson or a narrative reveal, per fear-psychology §3.1).

---

## 3. World map delta

Greater Vael attaches to the castle at the **Ashen Gate**. Drop 1 is a hub-and-spoke off **Gate Fields**:

```
                 [Castle Vael — v1, 7 zones]
                          │ (Ashen Gate — new south postern)
   [Cinder Village] ──── [Gate Fields] ──── [Ashen Forest N]
        (west)                │ (hub)             (east)
                         [Pilgrim's Descent]
                              (south) ──▶ sealed gate → Salt Road (Drop 2)
```

**The single v1-canon file touched (flagged for owner):** a new `DoorDef` `gate-to-fields` is added to `ASHEN_GATE`, on the courtyard's outer (down-path) wall, `lock: 'greatervael'`, gated by a new `GameFlag` `greater-vael-open`. That flag is set true when the player has seen any ending (`endingsSeen.length > 0`) — i.e., the postern opens once the castle is beaten (owner decision 6). No other v1 file changes. Ashen Gate's grid, fog, enemies, lore, and vista are otherwise unchanged.

**Zone-size sweet spots** are taken directly from forest-level-design §6 ("Zone-size sweet spot"):
- Gate Fields (fields archetype): **16×14** cells (32×28 m).
- Ashen Forest N (dense-cover archetype): **15×11** cells (30×22 m).
- Cinder Village (street archetype): **15×9** cells (30×18 m).
- Pilgrim's Descent (descent/gauntlet archetype): **13×12** cells (26×24 m).

Grid characters are the established `zoneDef.ts` set. New exterior tile letters are declared per zone in `tiles` (§4). Enemies, lore, scares, Watcher anchors, and the Hag threshold live in satellite arrays (as in `ashenGate.ts`), never in the grid.

---

### 3.1 Zone — GATE FIELDS (archetype: "The Orbit Clearing")

Open field, one dominant central landmark, a ring of minor anchors — the player orbits rather than beelines (per forest-level-design §6, Archetype 1). It is the hub: four doors (N→castle, E→forest, W→village, S→descent). Fields read "I see it coming" — default `fogFarM: 16` keeps the long sightlines and keeps enemies fair (per forest-level-design §6, fog-vs-aggro).

```
Grid (16×14):
'#######11#######'   0   N gate `11` → Ashen Gate (castle)
'#t,,,,,pp,,,,,t#'   1
'#,,,,,,pp,,,,,,#'   2
'#,,,,t,pp,t,,,,#'   3
'#,,,,,pppp,,,,,#'   4
'#,,,ppp..ppp,,,#'   5
'3pppp,.TT.,pppp2'   6   W gate `3` → Cinder Village · E gate `2` → Ashen Forest N · `TT` = the oath-oak (dense, blocks)
'#,,,ppp.Bppp,,,#'   7   `B` banner beneath the oak [7,7]
'#,,,,,pppp,,,,,#'   8
'#,,t,,,pp,,,t,,#'   9
'#,,,,,,pp,,,,,,#'  10
'#t,,,,,pp,,,,,t#'  11
'#,,,,,,pp,,,,,,#'  12
'#######44#######'  13   S gate `44` → Pilgrim's Descent
```
`tiles`: `,`→floor (tall grass, instanced), `p`→floor (worn path texture, Lynch "path" routing cue), `t`→floor (sparse tree, partial occlusion), `T`→wall (the dead oath-oak trunk / thicket).

**Landmark & orbit:** the oath-oak (`TT`, [6,7]–[6,8]) is the tall central silhouette visible from every cell (per forest-level-design §5, Lynch landmark; §6 "always one strong landmark in the forward 90°"). A rusted-open iron gibbet cage hangs from it — the emptiness is the scare (something was kept here, isn't now) (per medieval-folk-horror §3.4, #11).

**Banner:** one, at [7,7] under the oak. Rationale for one (vs. the 15+-cell "two banner" guideline): the orbit archetype makes the central landmark the single safe eye; the walked-path radius never exceeds ~8 cells, keeping kneel-cadence inside the 60–120 s target (per forest-level-design §6, banner spacing). A second banner would double-dip the brand-pulse radar.

**Discovery (5, within the 4–7 target):** `gv-field-boundary-stone` (near-path, [2,3]) · `gv-field-scarecrow-ward` (at the ward-scarecrow cluster, [9,3]) · `gv-field-childs-shoe` (off-path secret, NW corner [3,1], behind sparse trees) · `gv-field-gibbet` (the empty cage, at the oak) · `gv-field-tithe-post` (breadcrumb: a lone ember-light at [11,13] pulls toward the SE secret) (per forest-level-design §4 breadcrumb/off-path-risk-pricing).

**Enemies:** 2 Hollow Soldiers (v1 staple, so the field isn't only new-content) at [4,11] and [10,4]; the **scarecrow-ward** at [9,3] is an inert **Kneeling Hollow** (scare beat GF-1, not counted as a combat spawn until it wakes).

**Scare script (2 beats + 1 false-pulse):**
- **GF-1 — Scarecrow reveal.** Trigger: approach ≤3 m of the ward-scarecrow [9,3]. Gimmick: **silence-spike** (ambience → ~0 for ~1.2 s), then the "straw ward" resolves as a Kneeling Hollow in permanent genuflection — inert unless the brand pulses. *The villagers knelt their own hollowed as field-wards.* Payload: teaches the Kneeling Hollow silhouette before the village weaponizes it (per medieval-folk-horror §6 #1; stalker-tall-entities §1 "teach before you weaponize").
- **GF-2 — False brand-pulse (false-alarm #1, this zone's only one).** Trigger: crossing the central clearing with no enemy in range, on the run DreadDirector's per-run seed selects. Effect: one hard brand-pulse + heartbeat spike, nothing there. *The radar you trust, lying once.* (per fear-psychology §2, cap ≤1–2/zone; randomize which visit, §2 #2.)
- **Watcher sighting (quiet, no gimmick):** first look toward the E treeline gap — a distant tall silhouette beyond the far-plane, gone when neared. Counts toward the 3–6 drop budget (staging: distant, static, half-occluded by the oak) (per stalker-tall-entities §4, §7).

---

### 3.2 Zone — ASHEN FOREST N (archetype: "The Treeline Road")

A single winding road through an increasing tree-density ramp; sightlines shrink as the player advances (per forest-level-design §6, Archetype 2; Darkwood §1). Forest reads "I feel it before I see it": tree-density stacks the fog toward ~13 m so the brand pulse (12 m) and visibility converge — **audio leads sight** (per forest-level-design §6, brand-vs-fog). Contains the Ash-Hound, Watcher sightings, and **the Hag of the Fog-Line** (her threshold is the zone's terminus).

```
Grid (15×11):
'###############'   0
'3ppt..t..tTtTT#'   1   W door `3` → Gate Fields
'#.tpt.t.tTTTTT#'   2
'#t.pp.t.T.tTTT#'   3
'#.t.pptt.TT.TT#'   4
'#tt.tpBpt.TtTT#'   5   `B` banner [5,6], at the density transition
'#.t..ppptTTtTT#'   6
'#t.tt..ppTtT.T#'   7
'#..t.tt.ppTTTT#'   8   Hag cairn (satellite) at [8,9], road's end at the fog-line
'#t.tt.t..ptTTT#'   9
'###############'  10
```
`tiles`: `t`→floor (sparse tree), `T`→wall (dense thicket/treeline — the occlusion maze), `p`→floor (road). Density ramp: cols 1–6 sparse (`t`/`.`), cols 8–13 dense (`T`).

**Banner:** one, at [5,6], placed **at the density transition, before the hard section** — kneel is the release *before* the push into the dark, not a reward for surviving it (per forest-level-design §6, Archetype 2).

**Discovery (5):** `gv-forest-fogline` ([1,5]) · `gv-forest-hag-cairn` (the offering cairn, [8,9], carved/gestural — see §6.4) · `gv-forest-sold-brand` (off-path, [9,1]) · `gv-forest-hound-kennels` ([7,2]) · `gv-forest-watcher-note` (off-path secret, [3,12] past the dense wall) (per forest-level-design §4).

**Enemies:** 2 **Ash-Hounds** — one anchored at [6,9] (circles at the dense-fog edge), one at [8,11] (flanks from the deep trees). No v1 enemies here — the forest is the Hound's showcase.

**Scare script (3 beats):**
- **AF-1 — Silhouette crossing between trees.** Trigger: cell-enter [4,5] with line-of-sight down the road corridor. Effect (pure-visual, no screen gimmick): a tall shape crosses between two dense-tree cells at the fog's edge, gone if looked at directly / approached. Payload: correlates with a real Ash-Hound beginning to circle ~4 s later — the player learns silhouettes are a genuine warning, not noise (per fear-psychology §3 #3; forest-level-design §1 Darkwood "motion without confirmed cause").
- **AF-2 — Watcher sighting #1.** Trigger: reach the vantage at [6,7] and face the dense treeline; ≥90 s since last scare. Gimmick: **snap-grid spike** ("the engine notices IT") — `patchMaterial` snap grid coarsened for ~500 ms while the 3.0 m Watcher silhouette holds beyond the far-plane; despawns within 10 m. *The tall watcher at the tree-line, and the world stutters around it.* (per ps1-lowfi-horror §4.2, §6; stalker-tall-entities §7.)
- **AF-3 — Hag glimpse.** Trigger: first approach toward the cairn [8,9]. Gimmick: **desaturation stab** (`setDesaturation` → ~0.9 fast, then ease) as the 2.5 m woman-shape at the fog-line turns and recedes. *A second shape watches — a woman, wrong-tall, gone when you near her.* Payload: establishes there are TWO watchers and seeds the bargain (per stalker-tall-entities §7; medieval-folk-horror §5).

---

### 3.3 Zone — CINDER VILLAGE (archetype: "Dead Village Sightline Street")

A corridor-network wearing outdoor skin: house blocks make hard sightline breaks, one long exposure street is the spine, side alleys hide finds (per forest-level-design §6, Archetype 3; RE4 Village multi-plane). This is the tithe's ground truth (the ledger, the salt lines, the scraped ward-marks) and the Kneeling Hollow's home zone.

```
Grid (15×9):
'###HHHHHHHHH###'   0
'#..H..H.wH.H..#'   1   `w` = the curdled well [1,8]
'#.HHH.H.H.HHH.#'   2
'#....H.H.H....#'   3
'3ppppppBppppppD'   4   W door `3` → Gate Fields · `B` banner [4,7] · `D` = sealed east arch → Salt Road (Drop 2)
'#....H.H.H....#'   5
'#.HHH.H.H.HHH.#'   6
'#..H..H..H.H..#'   7
'###HHHHHHHHH###'   8
```
`tiles`: `H`→wall (house block), `p`→floor (street), `w`→floor (the well). Alleys are the `.` gaps between house blocks (rows 1–3 and 5–7); they break the street's sightline and hold the finds/secret (per forest-level-design §6, Archetype 3).

**Banner:** one, at [4,7], the plaza where the north and south alleys meet the street — the only point with cover on both sides, so kneeling reads as a legible safe-choice (per forest-level-design §6, Archetype 3).

**Discovery (5):** `gv-village-tithe-ledger` (carried item, in a burned hearth-room at alley [3,3]; surrenderable to the Hag) · `gv-village-salt-line` (threshold detail, [4,1]) · `gv-village-collector-house` (ward-marks scraped off, [6,10]) · `gv-village-well` (at `w` [1,8]) · `gv-village-procession` (the kneeling line along the street) (per medieval-folk-horror §6 #2, #3, #6, #14).

**Enemies:** the **flagellant procession** — 3 Kneeling Hollows arranged mid-genuflection along the street at [4,3], [4,7]-adjacent [3,7]?→ use [4,9] and [4,11]; real-threat ratio 1-in-3 (per fear-psychology §2 #10; medieval-folk-horror §6 #13). Exactly one is a live threat (wakes on brand-pulse); the other two are permanently inert dressing. Plus 1 Hollow Archer posted inside a house at [2,12], firing down the exposure street (fair: 14 m aggro sits inside the 16 m fog) (per forest-level-design §6, fog-vs-aggro).

**Scare script (3 beats):**
- **CV-1 — The procession wakes.** Trigger: the brand pulses (≤12 m) while passing the kneeling line. Gimmick: **silence-spike** into the stand. One Hollow rises (the live one); the other two stay kneeling. *The frozen procession — one of them rises.* Payload: an enemy encounter that teaches which kneelers are real (the checkpoint-banner kneel silhouette stays 100% trustworthy and is never used here) (per fear-psychology §2 #10; stalker-tall-entities §7 Kneeling Hollow).
- **CV-2 — Torches die toward the player.** Trigger: enter the plaza approach [4,5]. Gimmick: **resolution-drop** (`setRenderScale(240)` for the beat) as the village's few lit windows gutter out in sequence *toward* the player, ending near-dark. *The lights go out one by one, coming at you.* Payload: telegraphs the plaza's Kneeling Hollow / archer (per ps1-lowfi-horror §4.4 diegetic-flicker; §6.3).
- **CV-3 — The curdled well.** Trigger: approach the well [1,8]. Effect (pure-visual, no gimmick, no combat): the water is subtly wrong — discolored, too still; the `gv-village-well` stone blames "her" in a shaking hand, never confirmed. *Small evil, plausibly the world's fault, not hers.* (per medieval-folk-horror §3.6, §6 #6.)
- **Watcher sighting (rooftop, no gimmick):** a tall silhouette on the rooftops by the sealed east arch `D`, gone when the player reaches the arch. Counts toward the drop budget (staging: elevated, brief) (per stalker-tall-entities §4).

---

### 3.4 Zone — PILGRIM'S DESCENT (archetype: descent/gauntlet — the height-layer showcase)

The drop's terminus: a switchback trail descending a gorge toward the drowned lands (Drop 2). It showcases the exterior **height layer** (3→0) and a **vista foreshadow** of the destination (per forest-level-design §5 vista-foreshadowing; §6 sizing). `~` (void / cliff) fills the gorge — falling off a switchback = ember loss + reset (existing void rule, `zoneDef.ts`).

```
Grid (13×12):
'#############'   0
'1pppppppppp~#'   1   N door `1` → Gate Fields (S gate). Top ledge; east connector at col10.
'#~~~~~~~~~p~#'   2
'#~~~~~~~~~p~#'   3
'#pppppppppp~#'   4   west run
'#p~~~~~~~~~~#'   5
'#p~~~~~~~~~~#'   6
'#pppppppppB~#'   7   `B` banner [7,10]
'#~~~~~~~~~p~#'   8
'#~~~~~~~~~p~#'   9
'#pppp44pppp~#'  10   `44` = sealed gate → Salt Road (Drop 2). Bottom ledge.
'#############'  11
```
`tiles`: `p`→floor (path), `~`→void (cliff — fall = ember loss + reset). The single connected serpentine: row1 (top) → col10 down → row4 (west run) → col1 down → row7 (+banner) → col10 down → row10 (bottom, sealed gate).

**Height bands** (`heightGrid`, void cells = 0; the plan translates to a digit grid the same dims as `grid`): row1=3, row2=3, row3=2, row4=2, row5=2, row6=1, row7=1, row8=1, row9=0, row10=0. Ramps auto-generate on the three Δ1 seams (row2→3, row5→6, row8→9). Player y lerps to cell height; no jump (2D collider unchanged) (§4).

**Banner:** one, at [7,10], mid-descent — kneel as the exhale between the vista beat and the sealed bottom.

**Discovery (4):** `gv-descent-shrine` (a Vhaelis wayside shrine built over an older scratched-out one, [4,3]) · `gv-descent-pilgrim-marker` ([1,5]) · `gv-descent-sealed-gate` (at `44` [10,5]) · `gv-descent-ash-priest` (Ash-Priest's Drop-1 final placement, [7,3]) (per medieval-folk-horror §6 #11; owner decision 2).

**Enemies:** 2 Ash-Hounds working the switchbacks (multi-angle threat where the void makes repositioning lethal) at [4,6] and [7,4]. Archers/hounds are the weather-gated pair, but the descent's fog stays ≥16 by default; a single scripted low-fog cell (§4) sits at the top-ledge vista.

**Scare script (2 beats):**
- **PD-1 — Vista + Watcher across the gorge.** Trigger: first step onto the top ledge [1,1]–[1,4] (`VistaDef`). Gimmick: **snap-grid spike** under the swell as fog opens 12→24 revealing the drowned lands below AND, on the far cliff across the chasm, the Watcher standing (sighting #, staged: far, elevated, unreachable). *The descent opens — and across the chasm, the tall watcher, waiting.* Clip candidate (§8). (per forest-level-design §5 vista-foreshadow; stalker-tall-entities §5, §7.)
- **PD-2 — Distant banner false-ignition.** Trigger: approach the mid-descent banner [7,10]. Gimmick: **desaturation stab** as a *distant, unreachable* banner on the far cliff appears already ablaze and guttering wrong — then reads as ash. **The player's own checkpoint banner is never touched** (owner decision 8: kneel-safety never spoofed); the false read is on set-dressing across the gorge, and kneeling at [7,10] always works. *A banner burns where you can't reach — yours is only ash, and safe.* (per fear-psychology §2 #10; medieval-folk-horror §3.2 the bell/banner that means two things.)

---

## 4. Exterior engine requirements (the one real engineering surface)

The outdoor zone type. Collision model **unchanged** — same 2 m grid, same `GridCollider`, no jump (deliberate; keeps the collider 2D). Additions are visual/data layers, all instancing-cheap so the `<100` draw-call budget holds (per forest-level-design §6; ps1-lowfi-horror §1.3).

- **`ZoneDef.kind?: 'interior' | 'exterior'`** — default `'interior'`; zero change to existing zones.
- **`ZoneDef.heightGrid?: string[]`** — same dimensions as `grid`, one digit `0`–`3` per cell (default all `'0'`). Adjacent cells with Δheight = 1 auto-generate a low-poly terrain ramp between them; Δ ≥ 2 renders a step/cliff face. Player y lerps to the current cell's height each frame.
- **Tree density is carried by the tile letter, not a second grid:** `T`→wall + dense instanced trees (the occlusion "maze"); `t`→floor + sparse instanced trunks (partial occlusion, walkable); `,`→floor + instanced tall grass. One `InstancedMesh` per tree/grass kind per zone = 1 draw call each. Trees darkened toward the ash/ember palette (KayKit/Quaternius pine pieces; owner decision 10).
- **Fog:**
  - **Exterior `fogFarM` default = 16** (owner decision 9). This ≥16 default keeps every aggro radius fair (archer 14 m sits inside the fog) (per forest-level-design §6).
  - **Fog discrepancy resolved (per forest-level-design §6):** the DRAFT claimed "interior 12, exterior 16–22." The shipped code is the *inverse* — `DEFAULT_FOG_FAR = 16` (`main.ts`), and the one live outdoor v1 zone (Ashen Gate) is a deliberately tight `12`. This spec adopts: **exterior default 16**; Ashen Gate stays 12 (unchanged, castle-adjacent courtyard); dense-forest cells stack toward ~13 via tree occlusion (Ashen Forest N reads "audio-leads").
  - **`ZoneDef.fogCells?: { cells: GridPos[]; farM: number }[]`** — authored low-fog scare cells (10–12 m). These are the *only* places aggro may exceed visual range, and each MUST be paired with an audio tell (bowstring creak, hound snarl) so it reads as dread, not a cheap hit (per forest-level-design §6, Sea-of-Thieves cautionary tale). Used sparingly (Pilgrim's Descent top-ledge; none required in Fields).
- **Sky & particles:** exterior zones add a gradient sky-dome + a moon sprite + increased ash-fall particle density (reuse the existing particle system; per-zone `exteriorSky?: 'field' | 'forest' | 'gorge'` selects the gradient/particle preset). No new render pass.
- **Scare/anchor satellites (new content types, read by the DreadDirector, §5):**
  - `ZoneDef.scares?: ScareBeat[]` — `{ id; zone; trigger; gimmick?; at?/cells?; oneLine }`.
  - `ZoneDef.watcherAnchors?: GridPos[]` — sighting positions (may sit beyond the walkable border as backdrop, like Ashen Gate's negative-row vista props).
  - `ZoneDef.hagThreshold?: { at: GridPos; glimpseCells: GridPos[] }` — the cairn cell + the cells from which she is glimpsed.
- **Perf:** instancing + fog make forests cheaper than interiors, not more expensive; the PS1 aesthetic loves sparse fogged treescapes (per ps1-lowfi-horror §1.3). Budgets in §11 are unchanged.

---

## 5. DreadDirector system spec

A small, data-driven, per-zone scare scheduler. It reads each zone's `scares[]`, `watcherAnchors[]`, and `hagThreshold`, and fires beats subject to hard rules. It never touches combat, never deals damage, and never authors a scare that isn't in the data.

**Hard rules (owner decision 8; all enforced in code + unit-tested):**
1. **≥90 s between any two scares** — one shared cooldown timer across ALL scare types, *including* Watcher and Hag glimpses (they share the budget, they are not exceptions) (per fear-psychology §2; stalker-tall-entities §7).
2. **Never during combat** — a scare cannot fire while any enemy is in `alert`/`approach`/`attack` state near the player.
3. **Scares never deal damage** — `damage: 0`, always. A scare's cost is atmospheric/narrative, never a stat penalty (per fear-psychology §2 #11, #14).
4. **Banners / kneel-safety are never spoofed** — no scare makes the player's own checkpoint banner read as unsafe, ablaze, or non-functional; the kneel silhouette stays 100% trustworthy (per fear-psychology §2 #10).
5. **Each scare gimmick used 1–2× per drop** — tracked usage counters; a gimmick at its cap cannot be scheduled again (per fear-psychology §3.2; ps1-lowfi-horror §6).
6. **~10 scare beats total across the drop** (per stalker-tall-entities §4, §7; ~10 discrete "I saw it do something" beats is the sustainable ceiling for a whole drop).
7. **False brand-pulse ≤1–2 per zone**, and *which visit* fires the false pulse is per-run seeded so players can't learn "always the Nth time" (per fear-psychology §2 #2).
8. **Every screen-effect scare has a reduced-flicker fallback** (§7): the static/held component is kept, the per-frame-random component is stripped when `setFlickerSafe(true)` (per ps1-lowfi-horror §6, universal-fallback rule).
9. **One consistent glitch metaphor — "the engine notices IT":** the four tools are vertex-snap spike, one-frame resolution drop, desaturation stab, and silence spike, all driven through the existing `PS1Pipeline` / `patchMaterial` / `mixer` APIs (§7). Do not mix in unrelated screen effects (per ps1-lowfi-horror §1.2, §6 rule-of-media-consistency).

**Triggers supported (data-declared per beat):** `cellEnter`, `loreRead`, `kneelComplete`, `timerSinceLastScare`, `brandPulseProximity`, `directionOfTravel` (for backtrack-only re-triggers, per forest-level-design §3 backtrack-change; cheap).

**Fidelity-break scarcity (per ps1-lowfi-horror §6):** a per-entity-type "player has already seen this glitch" flag makes each glitch ever-diminishing after its first fire; the DreadDirector holds it in the Drop-1 save state (§9).

**Scare budget ledger for Drop 1 (10 beats; gimmick usage ≤2 each):**

| # | Zone | Trigger | Gimmick | One-line |
|---|------|---------|---------|----------|
| GF-1 | Gate Fields | approach ward-scarecrow [9,3] | silence-spike (×1) | The straw ward is a kneeling knight. |
| GF-2 | Gate Fields | cross clearing, no enemy (seeded) | false brand-pulse (zone 1/1) | The radar throbs once in the empty field. |
| AF-1 | Ashen Forest N | cellEnter [4,5], LoS down road | (pure-visual) | Something crosses between the trees, downrange. |
| AF-2 | Ashen Forest N | face treeline at [6,7], timer | snap-grid spike (×1) | The tall watcher, and the world stutters around it. |
| AF-3 | Ashen Forest N | approach cairn [8,9] | desaturation stab (×1) | A woman, wrong-tall, gone when you near her. |
| CV-1 | Cinder Village | brand pulses by the procession | silence-spike (×2) | The frozen procession — one of them rises. |
| CV-2 | Cinder Village | enter plaza approach [4,5] | resolution-drop (×1) | The lights go out one by one, toward you. |
| CV-3 | Cinder Village | approach well [1,8] | (pure-visual) | The well-water has gone wrong; a name, scratched shaking. |
| PD-1 | Pilgrim's Descent | first step on top ledge (vista) | snap-grid spike (×2) | The chasm opens — across it, the watcher, waiting. |
| PD-2 | Pilgrim's Descent | approach banner [7,10] | desaturation stab (×2) | A banner burns where you can't reach; yours is safe. |

Gimmick totals: silence-spike ×2, snap-grid ×2, desaturation stab ×2, resolution-drop ×1, false-pulse ×1, pure-visual ×2 — all within the 1–2× cap. **Watcher sightings across the drop = 4** (Gate Fields quiet, AF-2, Cinder rooftop, PD-1), inside the owner's 3–6 (owner decision 4) and research's ≤5 ceiling (per stalker-tall-entities §7 #15 — research suggested ≤4–5; owner's band is 3–6, adopted). Each is a distinct staging (distance, pose, despawn trigger), never repeated.

---

## 6. Entity specs

All new humanoids follow the tall-creepy directive (owner decision 5; per stalker-tall-entities §2, §7; ps1-lowfi-horror §3): **height 2.3–2.65 m** vs. the 1.7 m player, elongation in **limbs/neck not torso**, underfed frames, faces **crunched/obscured — never almost-real**, **stepped ~12 fps animation** while the world renders smooth, and every entity must pass the **silhouette test** (flat-black vs. fog color at intended sighting distance reads "person-shaped but wrong" before any texture/rig work). Built from low-poly kit parts + JPEG-crunched photo-sourced textures run through the existing `patchMaterial` affine warp (owner decision 10; per ps1-lowfi-horror §7).

Tuning lines below extend `TUNING` in the `tuning.ts` house style (a `greaterVael` block). Numbers are grounded in existing tuning (soldier hp3/speed1.6/aggro9; archer aggro14; wraith speed2.3/aggro11; player walk 3.2) and the research; **all are owner-tunable at playtest** (owner decision 6, veteran-assumed difficulty).

```ts
TUNING.greaterVael = {
  // --- Ash-Hound (Ashen Forest N, Pilgrim's Descent): first multi-angle threat.
  //     Circles at the dense-fog edge, lunges from a RANDOMIZED flank so veterans
  //     can't pattern it (per stalker-tall-entities §7 #5). Faster than walk while
  //     circling, outrun-able in a straight line — the dread is the orbit, not a race.
  hound: {
    hp: 2, speed: 2.6, aggroM: 13, alertMs: 500, leashMul: 1.5, heightM: 2.3, // low, distended, too-long legs
    circle: { speedM: 3.4, radiusM: 6, minMs: 1400, maxMs: 3200, flankRandom: true },
    lunge:  { windupMs: 380, activeMs: 220, recoverMs: 900, speedM: 6.5, damage: 1, rangeM: 2.4 },
    animFps: 12,
  },
  // --- Kneeling Hollow (Cinder Village + Gate Fields scarecrow variant): looks like
  //     a praying knight; wakes on brand-pulse. The stand-up transition is its whole
  //     "wrongness" budget (per stalker-tall-entities §7). Real:inert ratio 1:2–3.
  kneeler: {
    hp: 3, speed: 1.7, aggroM: 10, wake: 'brand-pulse', heightM: 2.35, // must path 2m interiors
    idle:  { breathScalePct: 0.8, headTiltMaxDeg: 6, tiltPeriodMs: 5200 }, // aliveness-in-stillness
    rise:  { holdMs: 700, firstStepMs: 900 }, // beat of stillness at full height, wrong-tempo first step
    attack:{ windupMs: 700, activeMs: 200, recoverMs: 900, damage: 1, rangeM: 2.0 }, // mirrors soldier
    inertRatio: 3, animFps: 12,
  },
  // --- THE WATCHER (all drop-1 exteriors): NOT killable, NOT an EnemyKind — a
  //     DreadDirector presence. Frozen while inside the view frustum; repositions
  //     only off-screen/beyond the far-plane (SCP-173 rule, stalker-tall-entities §7).
  //     Height is the deliberate exception to the 2.65m ceiling — see note below.
  watcher: {
    heightM: 3.0, sightingRangeMinM: 16, despawnM: 10, maxVisibleSec: 4,
    sightingsPerDrop: { min: 3, max: 6 }, frozenWhileObserved: true,
    sharesScareCooldown: true, damage: 0, animFps: 0, // never animated walking; teleport-repositioned
  },
  // --- HAG OF THE FOG-LINE (Ashen Forest N): silent witch, bargain not battle,
  //     never fights/chases. Woman-shape, distinct silhouette from the Watcher's
  //     vertical (per stalker-tall-entities §7). Present only at her threshold; a
  //     glimpse elsewhere recedes if approached, same contract as the Watcher.
  hag: {
    heightM: 2.5, glimpseRangeMinM: 16, recedeM: 10, damage: 0,
    fights: false, chases: false, speaks: false, // communicates by inscription/gesture only
    animFps: 12,
  },
  // --- DreadDirector constants (§5).
  dread: {
    minScareGapSec: 90, maxBeatsPerDrop: 10, falsePulsePerZoneMax: 2,
    gimmickUseMax: 2, watcherPerDropMax: 6,
  },
  // --- Exterior defaults (§4).
  exterior: { fogFarDefaultM: 16, lowFogCellM: 11, maxHeightStep: 3 },
} as const;
```

### 6.1 Ash-Hound — FSM
`idle → alert (alertMs) → approach → circle (minMs..maxMs, radiusM, randomized) → lunge (from randomized flank) → recover → (re-approach | leash)`. Circle side and duration are re-rolled each cycle (per stalker-tall-entities §7 #5). Leash at `1.5× aggroM` (soldier/archer convention). Distant panting/circling footfall is a **non-heartbeat** audio cue that does NOT scale cleanly with the brand-pulse system (per fear-psychology §2 #8). *Silhouette test:* flat-black at 13 m fog reads as a wrong four-legged thing with a too-long stride.

### 6.2 Kneeling Hollow (+ scarecrow variant) — FSM
`dormant (kneel, idle micro-motion) → rise (holdMs stillness → firstStepMs wrong-tempo) → pursue → attack → recover`. Idle is *near-imperceptible* aliveness (~0.8% breath-scale, occasional 6° head-tilt), the cheapest scare in the set (per stalker-tall-entities §7). **Scarecrow variant** = the same entity dressed as a field-ward in Gate Fields (GF-1) — inert unless the brand pulses; zero new asset cost (per medieval-folk-horror §6 #1). **Ratio rule:** roughly 1 live Hollow per 2–3 genuinely-inert kneeling props; a checkpoint banner's kneel silhouette is NEVER a Hollow (per fear-psychology §2 #10). Must path the 2 m grid, so height stays 2.35 m (per stalker-tall-entities §7).

### 6.3 The Watcher — FSM (observation, not combat)
`absent → manifest (silhouette beyond far-plane, frozen while observed) → recede/despawn (player within despawnM, OR off-screen reposition)`. Never seen mid-stride (teleport-repositioned; `animFps: 0`) (per stalker-tall-entities §7). Silhouette-only, never lit directly — a dark vertical against the fog gradient (per ps1-lowfi-horror §5; stalker-tall-entities §7). **Identity is HELD for Drop 3** — this spec references the mystery, not the answer (owner decision 4). Post-reveal, the in-engine silhouette rules never relax (per stalker-tall-entities §7 #15).

> **Flagged for owner (reconciliation, not an open item):** owner decision 4 pins the Watcher at "~3 m+"; owner decision 5 sets a 2.65 m ceiling for new humanoids. These are reconciled by treating the Watcher as the **deliberate exception** — it is never approached and never shares the game's door/corridor geometry, so it can exceed the ceiling (research explicitly allows the Watcher to run tallest, stalker-tall-entities §7). Spec value: **3.0 m**. If the owner wants strict 2.65 m uniformity, that is the one number to change.

### 6.4 The Hag of the Fog-Line — FSM (bargain, not battle)
`absent → glimpsed (fog-line, recedes if approached) → threshold-present (at the cairn [8,9]: bargain available)`. She is the **unpaid ember-tithe personified** — what's left of a woman whose brand was *sold* under the tithe system to warm someone else's hearth; something in the forest kept the debt on her behalf (owner decision 3; per medieval-folk-horror §6 #5). She **never speaks** — the Ash-Priest stays the only voice (owner decision 2); she communicates via **carved inscriptions and gesture** at the cairn. She never fights, never chases; **her deals cost** (per medieval-folk-horror §4, "a bargain always beats a battle").

**The bargain table (offering → cost → boon):**

| Offering (at the cairn) | Cost | Boon |
|---|---|---|
| **1 live ember** placed on the cairn | Max embers **−1** for the rest of Drop 1 (persisted; restored on leaving Greater Vael / next Vigil) | The fog-line parts: Ashen Forest N `fogFar +6 m` for the rest of the visit, and she carves the road onward — reveals a way-mark that unseals the Pilgrim's Descent lore cache. *(legible boon)* |
| **The Cinder-Village tithe-ledger** (carried item) | The ledger is surrendered (removed; its inscription already read) | The `gv-vision-hag` vision plays — color bleeds back like a banner-vision: the sold woman, at the cairn. *(narrative boon, no stat change)* |
| **Kneel at the cairn with a full brand** (offer the ritual itself) | Nothing paid now — but seeds a **Second-Vigil anomaly**, legible only in hindsight (per medieval-folk-horror §4 #4; v1 Second-Vigil grammar) | She gestures you east; the next Watcher glimpse is "answered" — resolves one held lore-line that seeds the Drop-3 mystery **without answering it** |
| **Turn away (decline)** | Nothing | Nothing — she recedes into the fog; the threshold remains for a later visit |

The bargain uses only existing systems (embers, max-ember cap as new minimal state, fog adjustment, vision player, lore reveal, flags). No new weapon or combat system (those are Drop 2). *Silhouette test:* flat-black at 16 m fog reads unmistakably as a stooped woman, not a tall column — distinct from the Watcher (per stalker-tall-entities §7).

---

## 7. Screen-effect scare kit ("the engine notices IT")

Four tools, all short scripted timelines driving the **existing** setters — no new render passes (per ps1-lowfi-horror §6, §7). Each has a `setFlickerSafe`-gated fallback that keeps the static/held component and strips the per-frame-random one.

| Tool | Driven via | Effect | Flicker-safe fallback |
|---|---|---|---|
| **Vertex-snap spike** | `patchMaterial.setSnapResolution(w,h)` coarser (e.g. 320×240 → 96×72) for ~500 ms, then restore | Geometry (incl. the entity) wobbles harder than the frame — the pipeline straining to draw IT | Held-coarse grid is static, not per-frame jitter — safe as-is; audit that the wobble doesn't read as high-frequency |
| **Resolution drop** | `PS1Pipeline.setRenderScale(240)` for the beat, then restore | Legibility drops exactly when tension peaks — withhold clarity, don't add it | Discrete step held for a duration — safe as-is |
| **Desaturation stab** | `PS1Pipeline.setDesaturation(~0.9)` fast, then ease back | The world goes grey the instant the entity is on-screen (distinct from the slow narrative desat easing) | Static color-grade shift — safe; only a layered grain/shimmer needs the existing `setFlickerSafe` gate |
| **Silence spike** | `mixer` duck-to-silence-and-hold curve (extend the `crossfadeCurves` helper), ambience bus → ~0 for 1–2 s before the beat | A hard cut to near-silence, deeper/steeper than the continuous threat-duck — the setup for the shock | Audio-only — no flicker concern |

Rules (per ps1-lowfi-horror §6): **scarcity** (each ≤2×/drop, ever-diminishing after first — DreadDirector flag), **proximity not visibility** (fire on threat/proximity crossing, so heard-not-seen still lands), **contrast** (never run any of these ambiently near an entity, or they stop reading as "the engine glitching because of IT"), **media consistency** (all four are the one "engine straining" metaphor — never add an unrelated VHS tear or CRT roll to these beats).

---

## 8. Story / lore spine — the tithe

**The drop's question (draft §5): what did the kingdom DO with the lent flame? Answer: it TAXED it.** The royal fire — lent by Vhaelis, the Flame That Lends — was rationed into a **tithe**: brand-fire sold as hearth-fire, a soldier's ember measured out to warm a lord's hall, a debt-column in a ledger that only ever grew and was never repaid. The lending stretched thin; the flame guttered thinner. This is the folk-horror chain made economic (per medieval-folk-horror §4 the Crones' "economic terror wearing a folkloric face"): the landscape (fields owed, not given) → isolation (a village that sold its own hearth-fire) → skewed belief (kneeling your own hollowed as field-wards; salt at every threshold) → the happening (the tithe personified comes to collect).

**The Hag is the tithe-ledger's unpaid column, personified** (owner decision 3; per medieval-folk-horror §6 #5) — thematically load-bearing (oaths as currency), not a fantasy-witch bolt-on. This ties the tithe angle directly to her (§6.4).

**The Ash-Priest — the only voice (owner decision 2):** two Drop-1 placements, mirroring his v1 recurring-stranger grammar. At **Gate Fields** (a welcome/warning at the threshold of the dead kingdom) and at **Pilgrim's Descent** [7,3] (his final Drop-1 line, at the sealed way down). His account tells the tithe truth and quietly seeds his own mystery — the draft's Drop-3 payoff (he was the First Oath's herald) is only *hinted* here, never stated.

**Inscription ids (one-line briefs; full prose authored at plan time; `gv-` namespace, resolves in `lore.ts`, terse FromSoft litany voice):**

*Gate Fields* — `gv-field-boundary-stone` (past here, the flame was owed, not given) · `gv-field-scarecrow-ward` (villagers knelt their own hollowed as field-wards against the fog) · `gv-field-childs-shoe` (a child's shoe from a collapsed chimney; a daisy-wheel scratched by the door — a charm, no combat) · `gv-field-gibbet` (the empty iron cage: something was kept here as a warning, and isn't now) · `gv-field-tithe-post` (a toll-post where hearth-fire was measured out to travelers).

*Ashen Forest N* — `gv-forest-fogline` (the tree-line where the tithe went unpaid; the fog keeps the debt) · `gv-forest-hag-cairn` (the cairn, carved not spoken — gesture-lore) · `gv-forest-sold-brand` (the woman whose brand was sold to warm a lord's hall — the Hag's origin) · `gv-forest-hound-kennels` (the ash-hounds were the tithe-collectors' dogs, loosed when the flame guttered) · `gv-forest-watcher-note` (a scratched line: "it does not come closer. it does not need to." — seeds the Watcher, answers nothing).

*Cinder Village* — `gv-village-tithe-ledger` (carried item: names and a debt-column that only grows; surrenderable to the Hag) · `gv-village-salt-line` (salt at every threshold — one broken from the inside) · `gv-village-collector-house` (the tithe-collector's door, ward-marks scraped off) · `gv-village-well` (the curdled well, "her" name in a shaking hand — never confirmed) · `gv-village-procession` (the village gave its hollowed to the road as penance).

*Pilgrim's Descent* — `gv-descent-shrine` (a Vhaelis wayside shrine built over an older, scratched-out one — flame-theology over something older) · `gv-descent-pilgrim-marker` (pilgrims went down to give their embers back and did not come up) · `gv-descent-sealed-gate` (the way down is shut; the Salt Road drowned below — Drop 2 seed) · `gv-descent-ash-priest` (his Drop-1 final line: the tithe, and a hint he knows more than he says).

**Visions (banner + Hag; color-bleed replays, v1 Second-Vigil grammar):** `gv-vision-fields` (the tithe begins — hearth-fire first sold) · `gv-vision-forest` (a brand traded away at the tree-line) · `gv-vision-village` (the ledger's last page) · `gv-vision-descent` (pilgrims descending to repay) · `gv-vision-hag` (the sold woman, at the cairn — offered on the ledger bargain). Five visions assemble the tithe tragedy; sequenced by zone order (per draft §5, ~6 across the expansion — Drop 1 takes 5).

**Anime sync point:** Drop 1's reveal (the tithe = the flame was sold, not spent) = an episode cold-open (draft §5).

---

## 9. Audio direction

Everything is synthesized (no sample payload) and mapped onto the existing `AudioManager` synth-voice layer system + `mixer` threat/duck math (per tuning.ts audio note; medieval-folk-horror §6 #15; fear-psychology §1.6). Bells carry two meanings and can never be fully trusted — but the **full toll is withheld for Drop 1** (the Bell-Wight and its toll are Drop 2); Drop 1 uses only single struck knocks (per medieval-folk-horror §3.2, §5).

**New ambience layers (`amb-*`, following the `AudioManager` voice-kind pattern):**
- **Gate Fields:** `amb-field-wind` (kind `wind`, open/brighter than the castle) + `amb-tithe-toll` (new kind `knock`: a single struck clapper at long, irregular, unpredictable intervals — never a readable rhythm, never a full toll) (per medieval-folk-horror §6 #15a).
- **Ashen Forest N:** `amb-forest-hush` (kind `wind`, positional range restricted aggressively — Darkwood technique) + `amb-forest-wrong` (animal-wrongness one-shots: a bird call cut off mid-note, a livestock bell with no visible herd — each heard once per spot and never repeated there) (per medieval-folk-horror §6 #15b; forest-level-design §1).
- **Cinder Village:** `amb-cinder-wind` (kind `wind`, through empty structures) + `amb-cinder-knock` (kind `knock`, irregular single bell-knock) (per medieval-folk-horror §6 #15a).
- **Pilgrim's Descent:** `amb-descent-drone` (kind `pad`, low sustained gorge drone) + `amb-descent-wind` (kind `wind`, updraft).

**Non-heartbeat threat cues (so the heartbeat isn't the only tell — per fear-psychology §2 #8):** Ash-Hound gets a new `pant` voice (distant panting/circling footfall) that does NOT scale cleanly with the brand-pulse proximity system. Kneeling Hollow's rise gets a low bone-creak one-shot.

**Silence as a tool:** the **silence-spike** (§7) extends `mixer` with a duck-to-silence-and-hold curve (steeper/deeper than the continuous `ambienceGain(threat)` duck), riding on top of the existing threat-duck, not replacing it (per ps1-lowfi-horror §5.2). Reserve sharp transients for the actual scare moment; the palette otherwise is low drones, long tails, distant impacts (per medieval-folk-horror §5).

**Existing layers reused unchanged:** the brand heartbeat (threat-keyed), the threat-duck, the stone reverb, positional occlusion, and the kneel/vista motifs.

---

## 10. Save schema delta + migration

**Minimal Drop-1 additions only** (owner decision 11). `EnemyPersistence` and weapon slots are **deferred to Drop 2** (the Bell-Wight is Drop 2). Bump `SaveData.version` 1 → 2 and add one optional block:

```ts
interface SaveDataV2 extends /* v1 fields */ {
  version: 2;
  greaterVael?: {
    open: boolean;              // the postern is unsealed (mirrors greater-vael-open flag)
    maxEmberCap: number;        // 5 by default; the Hag's ember-tithe lowers it for the drop
    hagBargains: string[];      // e.g. ['hag-tithed','hag-ledger-given','hag-kneeled']
    watcherSightings: number;   // running counter, capped at 6
    glitchSeen: string[];       // per-gimmick "already saw it" flags (fidelity-break scarcity, §5)
  };
}
```

**New `GameFlag`s:** `greater-vael-open`, `hag-tithed`, `hag-ledger-given`, `hag-kneeled`. **New item flag:** `tithe-ledger` (the Cinder-Village carried ledger).

**Migration (mandatory + tested — owner decision 11):** v1 → v2 upgrades in place. A v1 save loads, `greaterVael` is defaulted (`open` derived from `endingsSeen.length > 0`, `maxEmberCap: 5`, empty arrays, `watcherSightings: 0`), and `version` set to 2. **This supersedes the v1 "discard on version mismatch" behavior for the v1→v2 step specifically** — a beaten-castle save must carry into Greater Vael, never be dropped. `isSaveData` accepts version 1 or 2; a pure `migrateV1toV2()` is unit-tested for a lossless round-trip and for every v1 field surviving.

---

## 11. Performance & accessibility constraints

**Budgets unchanged from v1 §12:** <100 draw calls, ≤4 dynamic lights per zone, no realtime shadows, 320×240 (settings 480×360) render target, visible tris <100k. Exterior zones stay inside this because instanced trees/grass are 1 draw call per kind and fog culls the far field (per forest-level-design §6; ps1-lowfi-horror §1.3). Tightening fog during a scare is *free* perf (fewer draws) and more dread (per ps1-lowfi-horror §1.3).

**Accessibility (per ps1-lowfi-horror §6, universal-fallback rule):**
- Every screen-effect scare (§7) has a `setFlickerSafe`-gated fallback that keeps the static/held component and strips per-frame-random components — enumerated in the §7 table.
- The existing **reduced-flicker mode** (v1 §10) already caps the brand-pulse flash; the **false brand-pulse** (GF-2) respects that cap.
- Stepped 12 fps entity animation is motion, not a screen strobe — not a flicker risk (noted so it isn't mistakenly gated).
- Watcher/Hag/Hound are dark silhouettes against fog — no flash; no additional gating needed.
- Subtitles/inscription text-size, look sensitivity, invert-Y, render-scale toggles all unchanged and apply to exterior zones.

---

## 12. Testing expectations

**Unit (Vitest):**
- Save v1→v2 `migrateV1toV2()` round-trip; every v1 field preserved; a v1 save is never discarded.
- Hag-bargain state machine: each table row's cost/boon transition; decline is a no-op; max-ember cap lowers and restores on leaving Greater Vael.
- Watcher-sighting counter increments and caps at 6.
- DreadDirector rule enforcement: ≥90 s spacing (shared timer incl. Watcher/Hag), never-in-combat, `damage === 0` on all beats, gimmick usage ≤2, false-pulse ≤ per-zone cap, banner never flagged unsafe.
- New enemy FSMs: Ash-Hound `circle → lunge` with randomized flank/duration (assert the randomization); Kneeling Hollow `dormant → rise → pursue` (assert the holdMs stillness beat).
- Exterior engine: height-ramp auto-generation on Δ1 seams; `fogFarM` defaults to 16 for `kind: 'exterior'`; `fogCells` low-fog cells flagged.
- Zone structural tests (extend the existing `zones.test.ts` bijection): every row equal length; every `gv-*` lore/vision id resolves and every defined id is placed; all doors pair (Gate Fields ↔ its four neighbors; Ashen Gate's new postern pairs); sealed gates target Drop-2 zone ids held in `FUTURE_ZONE_IDS`.

**Playwright smoke (CI, per v1 §13):** each new exterior zone loads; instanced trees render; `renderer.info` draw calls <100 asserted in a field and a forest zone.

**Manual playtest checklist (extend `docs/`):** all 10 scare beats fire once each, none during combat, all ≥90 s apart; Watcher seen 3–6×, despawns within 10 m, never approached; Hag bargain each row exercisable; player's checkpoint banner never spoofed; flicker-safe mode strips per-frame components on all four gimmicks; **veteran difficulty is flagged owner-tunable** — capture ember-economy notes for retune (owner decision 6). Test every clip in a 9:16 crop.

---

## 13. Clip moments (TikTok-able, like v1's five)

1. **The oath-oak & the empty cage** (Gate Fields) — the field opens on the leaning oak, the gibbet swinging empty, ash falling; the scarecrow-ward turns out to kneel.
2. **The tall watcher at the tree-line** (Ashen Forest N, AF-2) — silhouette beyond the fog, the world snap-grid-stutters, gone when neared.
3. **The Hag's bargain** (Ashen Forest N) — an ember placed on the cairn, the fog-line parts, a woman-shape recedes.
4. **The lights die toward you** (Cinder Village, CV-2) — the village guttering out in sequence, ending in near-dark.
5. **The chasm & the far watcher** (Pilgrim's Descent, PD-1) — the vista swells over the drowned lands; across the gorge, the Watcher stands. *(Primary hero clip; 9:16-composed.)*

---

## 14. Future drops (one-pager, summary only)

Episodic, ship-when-ready (owner decision 1). Drops 2–3 are **not** designed here — this is scope-setting only.

- **Drop 2 — "The Salt Road" (Salt Road, Drowned Chapel, Ashen Forest S [night-only], Hermit's Tor):** the **Bell-Wight** (first cross-zone persistent stalker → needs the deferred `EnemyPersistence` save field + escape-valve/re-toll rules, per stalker-tall-entities §7); the **Salt Brand** weapon (formalize weapon slots — deferred from Drop 1); water/reflection tricks; night-gating as a difficulty layer over reused geometry (per forest-level-design §3, Archetype 4); the church-schism / swimming-test lore and the drowned-bell clip (per medieval-folk-horror §6 #7–#9). Save schema v3.
- **Drop 3 — "The Root-Crypt" (Char Marches, Root-Crypt [3 sub-zones]):** the expansion boss **The First Oath** (king-under-the-hill — patience, not menace; per medieval-folk-horror §6 #12); the **Watcher identity reveal** — narrative/cutscene only, recontextualize don't solve, in-engine silhouette rules never relax (per stalker-tall-entities §7 #15); the brand-eclipse P3 (Fatal-Frame confrontation-inversion, per fear-psychology §2 #12); Ending-4 canon tie. ~+8 lore each drop; NG+ anomalies +4 each.

---

## 15. Open items

**None.** Every zone, entity, scare, bargain row, lore id, and clip is pinned above. Two items are **flagged for owner attention** but are decided, not open:

1. **Watcher height 3.0 m** — the deliberate exception to the 2.65 m ceiling (owner decision 4 vs. 5), reconciled in §6.3. One number to change if strict uniformity is wanted.
2. **The single v1-file touch** — the new `gate-to-fields` postern + `greater-vael-open` flag on `ASHEN_GATE` (§3). The only modification to shipped v1 content; everything else in the castle is untouched.
