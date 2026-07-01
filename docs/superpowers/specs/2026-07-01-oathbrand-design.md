# OATHBRAND — Design Spec

**Date:** 2026-07-01
**Status:** Approved by owner (design conversation, this date)
**Tagline:** *The kingdom is dead. The oath is not.*

## 1. What this is

A ~30-minute, free, browser-playable, PS1-aesthetic dark fantasy game. First-person exploration with slow deliberate melee, set in the ruined castle of a dead kingdom. Companion piece to the owner's AI-animated dark fantasy series ("Iron Oath" working title — the game deliberately does NOT use that name; "The Iron Oath" is a live commercial Steam game).

**Purpose (in priority order):**
1. TikTok content engine + cross-pollination with the anime series (game clips feed the series algorithm; series lore feeds the game).
2. OSS portfolio piece — the repo itself is a deliverable (readable code, reusable PS1 shader module, exemplary README).
3. Genuinely playable, complete short game — the ENA: Dream BBQ model: an artifact of the world, not a product.

**Success criteria:**
- Playable start-to-credits in a desktop browser via a GitHub Pages URL, zero install, < 5s to gameplay from click.
- All three endings reachable; complete run 25–35 min blind, ~15 min routed.
- Runs 60fps on a mid-range laptop iGPU; playable (30fps+) on a mid-range phone.
- Contains the five engineered clip moments (§9) working as designed.
- CI green: typecheck + unit tests + build + deploy on every push to main.

**Constraints:**
- Deploys as a static site on GitHub Pages (no server, no COOP/COEP headers, no backend).
- All assets CC0 or self-generated (no artist; AI-generated textures via owner's Atlas Cloud pipeline are fine).
- Code MIT-licensed, public GitHub repo.
- Solo maintainer + AI; keep the codebase small enough to hold in one head.

## 2. Story & world

The kingdom of **Vael** fell in a single night — **the Guttering** — when the royal flame died and every sworn soldier's oath-brand died with it, leaving them hollow. The player is the last knight of Vael, away the night it fell. The queen's final command, delivered by a dying herald: *"Return the crown to the flame that forged it."* The royal line's fire was borrowed, generations ago, from the **dragon** that sleeps above the castle. The knight climbs through the ruin, carrying the crown, past hollow former comrades, to give it back — or not.

- **World flavor:** ronin-knight East×West blend. Plate-and-lamellar armor, tachi-style greatsword, tattered banners and torii-style shrine gates inside a ruined western castle. Ash falls like snow. Palette: ash grey, ember orange, dried-blood red, void black.
- **Enemies are former comrades.** Hollow soldiers whose brands guttered. Killing them is mercy; each releases a wisp of ember that flows to the player's brand.
- **The Forsworn** (mid/main boss): Vael's first knight, who broke his oath the night of the Guttering and let the dark in. Fought in the Throne Room.
- **The dragon is not a boss.** Final scene only: an ancient witness, half-seen — fog, one enormous eye, jaw, a wall of scales. It asks nothing. The player chooses.
- **Lore ties into the anime series:** ~15 readable inscriptions/items; several deliberately answer or seed questions from the series episodes (fan-theory fuel). Lore written so the series can inherit it as canon.

## 3. Signature mechanic — the Oath-Brand

No HP bar, no minimap, no compass. A burning sigil visible on the knight's hand/bracer at the bottom of frame. One system, four jobs:

1. **Health.** The brand holds **embers** (max 5). Taking a hit extinguishes 1 ember (heavy attacks: 2). As embers drop, the world desaturates in steps and the ambient mix thins. At 0 embers the player is **hollowed** (see 4 — not a death screen).
2. **Threat radar.** Within ~12m of any unhallowed entity, the brand pulses visually, with a heartbeat audio layer whose tempo rises with proximity. The body is the UI. (Brand-wraiths are additionally rendered visible only during pulses — see §6.)
3. **Checkpoint ritual.** Kneeling at a Vael banner (interact, ~4s uninterruptible animation) rekindles all embers, saves the game, and respawns previously-killed common enemies (bonfire rules). Banners are hand-placed, one per zone.
4. **Ending gate.** Reaching the Summit with a live brand allows the choice; arriving hollowed forces Ending 3.

**Hollowing (failure state):** at 0 embers the player does not die. Color drains fully (grayscale LUT), music stops, brand goes dark, enemies cease to attack (the player is beneath notice). Player keeps walking. Kneeling at a banner un-hollows (rekindles to full, this is the "continue"). If the player instead walks to the Summit hollow, they get Ending 3. Dying is impossible; *forgetting why you came* is the failure.

**If a boss-fight hit would hollow the player:** hollowing occurs mid-fight; the Forsworn stops attacking, turns his back, and the arena gate opens. Kneel and return.

## 4. Endings

1. **OATH KEPT** — place the crown in the flame. The brand releases (burns out gently). Ash-fall reverses into embers rising. Title card: *OATH KEPT*.
2. **OATH BROKEN** — turn away with the crown. Hard cut, title card: *OATH BROKEN*. Sets up series lore.
3. **HOLLOW** (hidden) — arrive with a dead brand. The dragon's eye does not open. Nothing happens. Slow fade. Title card: *(none — silence, then credits)*.

Endings screen shows which of 3 slots have been seen (?, ?, ?) to drive replay/theory content.

## 5. Map — six zones, interconnected

```
        [6 Summit — dragon, choice]
                 │ (Summit Stair)
        [5 Throne Room — Forsworn boss]
                 │ (opens with Gatekey)
[3 Undercroft]──[2 Great Hall (hub)]──[4 Ramparts]
   (Gatekey)     │        ▲                │
                 │        └─ shortcut gate ┘  ← kicks open from Ramparts side
        [1 Ashen Gate — courtyard, vista]
                 │
              [Start — outer path]
```

- **1 Ashen Gate:** outer courtyard. Scripted vista reveal on entry (§9). Tutorializes movement, first inscription, first banner.
- **2 Great Hall:** hub. Two locked exits (Throne — needs Gatekey; shortcut gate — opens from far side). First combat encounters.
- **3 Undercroft:** crypt, darkest zone, brand-pulse showcase, brand-wraiths. Contains **Gatekey**. Loops back up into the Great Hall via a broken stair (one-way drop in, stairs out).
- **4 Ramparts:** exterior, wind and banners, archers. Ends at the shortcut gate that kicks open into the Great Hall — the "it loops back!" moment.
- **5 Throne Room:** Forsworn boss arena. Banner immediately before it.
- **6 Summit:** dragon scene, choice, endings. No enemies.

Critical path: 1→2→3 (Gatekey)→2→4→2→5→6. ~15 lore pickups distributed across all zones; Undercroft and Ramparts each hold optional deep-lore items off the critical path.

## 6. Combat

Slow, readable, deliberately NOT a soulslike stack. No stamina, no parry timing windows, no i-frame rolls, no corpse runs, no leveling, no inventory management.

**Player kit:** light slash (fast, 1 dmg), heavy slash (slow windup, 2 dmg, staggers), guard (blocks frontal hits; blocked hits cost 0 embers but shove the player back), short side-step (quick reposition, no i-frames). Tachi-style greatsword, weighty animation timing.

**Enemies (four types):**
- **Hollow Soldier** — melee, slow telegraphed swings, 3 HP. The staple.
- **Hollow Archer** — ranged, slow visible projectile, 2 HP, repositions when approached.
- **Brand-Wraith** — invisible except when the brand pulses (fades in with pulse proximity), 2 HP, lunge attack. The Undercroft signature enemy.
- **The Forsworn** (boss) — 3 phases, pattern-based: (P1) mirror of player kit, slow duel; (P2) adds a delayed dark-flame trail on his swings; (P3) brand-out — he extinguishes the room's torches, and his position reads only via the player's brand pulses. ~24 HP total, checkpoint directly outside.

AI: simple finite state machines (idle → alert → approach → attack → recover; archer adds reposition). No pathfinding beyond navmesh-free straight-line steering with wall avoidance — rooms are designed open enough that this reads fine.

## 7. Aesthetic & rendering — the PS1 pipeline

- **Stack:** vanilla Three.js (WebGLRenderer) + Vite + TypeScript. Plain classes, no ECS framework, no React. Target bundle < 1.5MB gzip excluding assets.
- **Pipeline (shipped as documented, reusable `src/ps1/` module — a deliverable in itself):**
  - Render scene to a **320×240** (settings: 480×360) `WebGLRenderTarget`, `NearestFilter`, upscale to canvas.
  - **Vertex snapping** and **affine texture warp** injected via `onBeforeCompile`/ShaderChunk into standard materials.
  - **Per-vertex (Gouraud) lighting**, no realtime shadows anywhere; baked blob shadows under characters.
  - **4×4 Bayer ordered dithering + RGB555 quantization** in the upscale pass.
  - **Dense fog** (near cutoff) — doubles as draw-distance concealment and the perf strategy.
  - Post: scanlines, vignette, subtle chromatic aberration, film grain. All toggleable.
- **Textures:** 64–128px, NearestFilter, no mipmaps. Sources: KayKit atlases downsampled + darkened toward the ash/ember palette; grim seamless stone/wood generated via Atlas Cloud, downscaled + posterized.
- **Desaturation/hollowing effects** implemented as a LUT/uniform in the upscale pass (drives §3.1 world-drain and §3 hollow grayscale).

## 8. Assets & audio (all CC0 or self-generated)

**Models:** KayKit Dungeon Remastered (castle/dungeon modules, props), KayKit Skeletons + Character Animations (hollow soldiers/archers — retextured), Kenney Castle Kit / Graveyard Kit / Modular Dungeon Kit (supplements), Quaternius Ultimate Fantasy RTS (knight bits, props). Player arms + sword: assembled from kit pieces or minimal custom low-poly (≤1k tris). **Dragon:** silhouette-first — fog + one enormous eye, jaw, wall-of-scales close geometry; deliberately never fully visible (cheaper AND more reverent).

**Audio:**
- 2–3 looping dungeon-synth/dark-ambient layers per zone (OpenGameArt CC0 dark music/ambience packs; Sonniss GDC bundles for SFX), crossfaded by GainNodes.
- Brand heartbeat layer keyed to threat proximity; ambience ducks as heartbeat rises (the cheapest dread mechanic).
- `THREE.PositionalAudio` for torches, wind, enemy vocalizations; ConvolverNode stone-hall reverb; lowpass muffle through walls.
- One melodic motif reserved for banner-kneeling and the Summit — to be shared with the anime series (cross-media identity).
- AudioContext resumes on first user gesture (browser autoplay policy); the title screen's "BEGIN" click is that gesture.

## 9. The five engineered clips (build these as requirements, not accidents)

1. **Vista reveal** — Ashen Gate opens onto the ruined kingdom skyline, dungeon-synth swell, ash falling. (Scripted camera-friendly staging; the README GIF.)
2. **Brand pulse in the dark** — Undercroft corridor, no UI, heartbeat rising, wraith fades in. 
3. **Kneel ritual** — banner rekindle, embers flow, motif plays.
4. **Forsworn title card** — boss intro with FromSoft-grammar name card: *THE FORSWORN, FIRST KNIGHT OF VAEL*.
5. **The dragon's eye** — fog parts, an eye the size of a door opens. Title card: *OATHBRAND*.

Each must look right in a vertical phone crop (test at 9:16) since TikTok is the funnel.

## 10. UI / UX / accessibility

- Title screen (BEGIN / CONTINUE / SETTINGS), pause menu (resume / settings / quit to title), settings: master+music+SFX volume, look sensitivity, invert-Y, render scale (320×240 / 480×360), CRT effects toggle, **reduced-flicker mode** (photosensitivity: disables grain/scanline shimmer and caps brand-pulse flash), subtitle/inscription text size.
- Diegetic everything else: no health bar (brand), no minimap, no objective markers. Interact prompt is the sole floating UI ("KNEEL", "READ", "TAKE").
- Inscriptions render as full-screen readable text overlays (lore delivery).
- **Controls:** desktop keyboard+mouse with pointer lock (WASD, mouse look, LMB light, RMB heavy, Shift guard, Space side-step, E interact, Esc pause). **Mobile:** virtual left stick + swipe-look right half, context buttons; reduced enemy counts NOT needed (same content, perf handles it).
- Save: localStorage, single slot, autosave at banners + zone transitions + ending flags. "CONTINUE" resumes at last banner.

## 11. Architecture

```
src/
  main.ts            — boot, canvas, loop
  game.ts            — Game: state machine (title → playing → paused → ending), scene orchestration
  ps1/               — REUSABLE PS1 pipeline (renderer wrapper, material patcher, post pass, docs)
  world/             — Zone loader (GLTF per zone), zone graph/doors/gates, prop placement, culling by zone
  player/            — controller (pointer-lock + touch), combat kit, brand system
  entities/          — Entity base, HollowSoldier, HollowArcher, BrandWraith, Forsworn (FSMs)
  audio/             — AudioManager: layers, ducking, positional, reverb
  ui/                — title/pause/settings (DOM overlay, not in-canvas), interact prompts, inscriptions, title cards
  save/              — localStorage schema + versioning
  content/           — lore text, item defs, zone metadata (JSON/TS data, no logic)
assets/              — gltf/textures/audio (CC0 manifest with per-file source+license)
```

- **Data flow:** Game owns the loop; systems tick in fixed order (input → player → entities → brand → audio → render). Entities and the brand communicate via a tiny typed event bus (e.g., `EmberLost`, `EnemySlain`, `BrandPulse`) — no globals.
- **Zone streaming:** one zone's GLTF + neighbors preloaded; others disposed. Static geometry per zone merged at build time or load time to respect the <100 draw-call budget.
- **Error handling:** WebGL-support check with a graceful fallback page (screenshot + "your browser can't run this" + link); asset-load failures retry once then show a diegetic error ("the way is shut — reload"); save-schema version mismatch discards with notice rather than crashing; pointer-lock loss auto-pauses.

## 12. Performance budgets

- <100 draw calls, ≤4 dynamic lights (flickering torch points), no realtime shadows, visible tris <100k (trivial with kit assets at 300–2k tris each).
- 320×240 target makes fill rate a non-issue; `renderer.info` asserted in dev HUD.
- Fog far-plane cull + zone-based visibility. Test floor: mid-range Android phone + integrated-GPU laptop.

## 13. Testing & quality

- **Vitest** unit tests: brand ember math + hollowing transitions, enemy FSM transitions, save/load round-trip + version migration, zone-graph lock/key logic, ending-selection logic.
- **Playwright smoke test:** page loads, WebGL context created, title screen reachable, new game starts, first zone loads (headless WebGL via SwiftShader in CI).
- **Manual playtest checklist** in `docs/` (all endings, all clips, mobile pass, photosensitivity mode).
- **CI (GitHub Actions):** typecheck + vitest + build + Playwright smoke on PR; deploy to Pages on main.
- ⚠️ Local sandbox kills headless browsers (known env issue) — Playwright verification runs in CI, not locally.

## 14. Repo & release

- Public GitHub repo `oathbrand`, MIT license (code); `assets/LICENSES.md` manifest crediting each CC0 source.
- README as landing page: play link at the very top, GIF of clip #1 above the fold, screenshot strip, "how it was made" (AI pipeline + PS1 shader writeup), controls, ending count tease (no spoilers).
- GitHub Pages from Actions. itch.io mirror later (post-launch, owner's call).
- `src/ps1/` gets its own README (the starrable reusable artifact).

## 15. Out of scope (YAGNI — explicitly cut)

Multiplayer/leaderboards; gamepad support (post-launch nice-to-have); localization; difficulty settings; inventory/equipment systems; leveling/stats; procedural generation; corpse runs; jump-scare horror design; NPC dialogue trees (inscriptions only); Steam release; custom 3D character authoring; WebGPU/`retroPass` path (revisit when mobile Safari support matures).

## 16. Open questions

None blocking. Tuning values in §3/§6 are initial and expected to change in playtesting.
