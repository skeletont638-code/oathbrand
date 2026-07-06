# OATHBRAND World Expansion (v1.2) — Design Spec

**Date:** 2026-07-06 · **Owner-approved:** approach + all sections approved in session
**Deadline:** owner playtest 2026-07-07 evening → ship v1.2.0 before 2026-07-08 hard stop
**Branch:** `feat/world` off `dev` (dev == main == v1.1.0 @ `1c43076`)

## Goal (owner's words, distilled)

The world should feel *full*: walk **inside** the castle and find your way out unaided;
multiple levels with real stairs; interior light here and there; other multi-level
buildings throughout the landscape (medieval-creepy, not "a landscape with a castle on
top"); **doors** that carry you between places; and an **actual storyline**.

## Non-goals

- No new enemy kinds, no combat changes, no new endings.
- No nav UI / quest markers / objective arrows (freedom is the point).
- No fast-travel network (owner chose real doors over magic doors).
- No changes to the PS1 render path (byte-pin must stay green) or to HD-mode semantics.
- v1.1 saves must load unchanged (all save-schema additions are additive).

## Engine facts this design builds on (verified in-repo)

1. Zones connect via **gate cells** (digit chars in `grid`); `zoneGraph.ts` derives
   anchors/facing. Transitions are data, not code.
2. `Interactor` (`src/player/Interactor.ts`) already has an **`OPEN`** verb and a
   facing-cone targeting model. Doors need no new input plumbing.
3. Zones support **`heightGrid`** (Pilgrim's Descent terraces prove walkable in-zone
   elevation, incl. enemies standing on bands).
4. Ghost visuals precedent: vision-ghost / CrossingSilhouette materials; entity rigs are
   reusable for translucent apparitions.
5. Dread layer is currently gated to `kind === 'exterior'` (`main.ts`); new interiors
   **opt in** via an explicit flag rather than flipping the global gate.

## 1 · Door system

**Data.** `ZoneDef` gains optional `doors`, keyed to gate ids:

```ts
doors?: {
  gate: string;            // which gate digit this door decorates
  label: string;           // "Iron Door", "Postern Gate", "Stair Door"
  locked?: 'far-side';     // barred until opened from the destination side
}[];
```

A door **decorates an existing gate cell** — one transition mechanism, doors are
presentation + a lock bit on top. Gates without a `doors` entry behave exactly as today
(open-terrain borders stay seamless). **One door per edge:** a `doors` entry on either
zone's side defines the door for the whole zoneGraph edge; the destination side renders
the same door automatically. Canonical door id = `"<zoneA>-<zoneB>:<gate>"` with zone
ids in lexicographic order (this is the id stored in `doorsOpened`).

**Prop.** Stone frame + iron-studded plank panel, ≤120 tris, PS1-crunched texture from
the existing pack pipeline. Placed at the gate cell, oriented by the gate's derived
facing. One shared geometry, per-door instance.

**Behavior.** In range + cone → prompt `OPEN — <label>`. E: hinge-groan SFX (recorded
CC0 primary + synth fallback, per audio pattern) → 400 ms black fade → spawn at the
destination gate's inward cell, facing inward. Locked far-side doors prompt
`Barred from the other side.` and refuse; opening any door from its far side permanently
unbars it.

**Save.** `doorsOpened: string[]` (door ids), additive. v1.1 saves lacking the field
load with `[]`.

**Tests.** (a) Reachability: from game start, with no locked-door knowledge, every zone
is reachable AND the exit/finale is reachable — *guaranteed find-your-way-out*;
(b) far-side unbar round-trips through save/load; (c) door placement never lands on a
non-floor cell (extends existing structural tests); (d) v1.1 save fixture loads clean.

## 2 · Floors, stairs, interior light

**Within-zone elevation** (mechanism A): stone stairs/ramps as `heightGrid` slopes —
players *physically walk up* to mezzanines, wall-walks, raised altars. Reuses terrace
collision/enemy handling as-is.

**Floor-over-floor** (mechanism B): an upper floor is its **own zone** linked by a
stairwell door: climb real steps (heightGrid) to a landing → `OPEN — Stair Door` → fade
→ arrive mid-staircase in the upper zone and keep climbing. Reads continuous; rooms
cannot literally stack on one heightfield and we do not fight that.

**Wall-torch prop**: bracket + flame quad + warm point light with existing flicker
pattern. Budgets: flicker-safe cap respected; ≤100 draw calls/zone held; torch count
per zone bounded in content review (target 3-6). Interior ambient stays near
void-black — torches are pools of safety, not general lighting (dread research: darkness
carries the interior dread layer).

## 3 · Castle deepening (the keep becomes one building)

New floor-zones (small grids, existing content-file pattern):

| Zone id | What | Linked via |
|---|---|---|
| `hallGallery` | gallery ringing Great Hall above; rail overlook (vista of hall floor), king-hollows echo | stairwell door from Great Hall; door to Ramparts |
| `hallBarracks` | side room off Great Hall; bunks, armory clutter, muster lore | plain door off Great Hall |
| `keepChapel` | small chapel off Ramparts; queen lore tie-in (inscriptions only — the queen's-walk *echo* lives in the Sunken Chapel, §5), kneeler | plain door off Ramparts |

**Shortcut loops** (2): `undercroft → gateFields` postern (locked far-side — surfacing
outside after being lost inside is the payoff moment); `hallGallery → ramparts` (turns
the keep into a ring instead of a corridor).

Existing zone ids/content untouched; all additions are new zones + new gate cells on
existing grids (structural tests re-run).

## 4 · Landscape structures (multi-level, medieval-creepy, enterable)

| Ruin | Host zone | Levels | Inside |
|---|---|---|---|
| **Watchtower** | Gate Fields | ground (`towerGround`) → upper+roof walk (`towerUpper`, roof via heightGrid) | muster echo (Act I), archer nest, field vista from roof |
| **Sunken Chapel** | Ashen Forest N | nave w/ raised altar (`chapelNave`, heightGrid) → crypt (`chapelCrypt`, stair-door down) | queen's-walk echo (Act II), wraith in crypt, inscriptions |
| **Burnt Manor** | Cinder Village | ground (`manorGround`) → upper gallery (`manorUpper`) | burning echo (Act II), kneeler vigil, collapsed-floor peril reads |

Each is entered by a **real door** from the host exterior zone (new gate cell on host
grid). All six interior zones **opt in to the dread layer** (new `dreadInterior: true`
flag consumed where `kind === 'exterior'` is checked today).

**Skyline**: 2-3 non-enterable silhouette ruins (cheap instanced shells at vista
distance) placed during the content pass for "structures throughout" density.

## 5 · Story — three acts (ghost-echoes + re-arc'd inscriptions)

**EchoScene system** (`src/engine/EchoScene.ts` + content files): trigger cells →
apparitions fade in (entity rigs + ghost material), play a staged, silent ~10-20 s
moment, fade out; player keeps full control; brand pulses while a scene is live. Each
scene marks `echoesWitnessed` (additive save field). Scenes re-arm only in NG+.

**The seven scenes** (staging per-scene at task level):

| # | Act | Scene | Where |
|---|---|---|---|
| 1 | I | The oath sworn — knights kneel before the king; you are among them | Gate Fields |
| 2 | I | The muster — the watch lights the beacon as something crosses the fields | Watchtower upper |
| 3 | II | The betrayal at the gate — the First Sworn opens it from inside | Ashen Gate |
| 4 | II | The burning — villagers walk into the fire rather than hollow | Burnt Manor |
| 5 | II | The queen's walk — she passes through her garden toward the chapel, crowned | Sunken Chapel nave |
| 6 | III | The king hollows — he sets the crown down and forgets why | Hall Gallery |
| 7 | III | The crown carried down — a knight (you?) descends with it as the keep empties | Undercroft |

Dragon finale (existing) is the arc's resolution and is untouched.

**Named cast** (provisional — owner may veto names at playtest; used consistently across
scenes + inscriptions): **King Osric** · **Queen Maren (existing codebase canon — spec originally said Maelis, corrected T5)** · **Callun, the First Sworn** (existing codebase canon — spec originally said Carrow, corrected T9)
(= the Forsworn boss, retroactively named) · the player-knight stays nameless.

**Inscription re-arc**: existing 58 inscriptions re-sequenced/edited so each zone's set
tells its act (Act I: fields/forest/tower · Act II: gate/village/chapel · Act III:
keep/undercroft/summit); new inscriptions only where a beat has no carrier. Forward-dread
rule from the dread pass (warn, don't only mourn) is preserved.

**Banner-kneel memories**: one line per act, shown on kneel (rotates per act of the
banner's zone).

## 6 · Freedom

No new UI. Find-your-way-out is guaranteed by the reachability test (§1) and made *fun*
by the shortcut loops (§3) — wrong turns become discoveries, not dead ends. Tracker
('— — —') unchanged.

## 7 · Budgets, ship plan, cut-order

**Budgets/invariants:** PS1 byte-pin green · ≤100 draw calls/zone · flicker-safe cap ·
gzip growth target ≤ +40 KB (door/torch/echo geometry is shared+instanced; new zones are
data) · v1.1 save fixture loads · 60 fps held on the reference machine.

**Process:** SDD on `feat/world` (ledger `.superpowers/sdd/progress.md`), Opus
implementers + per-task Opus review, kit-first ordering: T1 doors kit → T2 stairs/torch
kit → then parallel content tracks (castle / ruins / story) → whole-branch review →
owner playtest 7/7 evening → merge → tag v1.2.0.

**Cut-order if time bites** (protected core: doors, stairs kit, story arc, castle):
1. Burnt Manor (fold its echo into Cinder Village street) → 2. Chapel crypt (keep nave)
→ 3. `keepChapel` side room (move queen echo fully to chapel nave / garden) →
4. skyline silhouettes.

## Out-of-scope backlog (file as issues post-v1.2)

Hound pulse-distance cap (dread watch-item) · 5 post-merge nits from v1.1 · localization
of new text · echo scenes in NG+ variants beyond re-arm.
