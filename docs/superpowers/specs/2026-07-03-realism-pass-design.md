# OATHBRAND Realism Pass — Design Spec

Date: 2026-07-03 · Owner-approved (Approach A, defaults ratified)
Ships as part of **v1.1.0 "The Fields"** (dev → main after this phase). Hard stop: complete before 2026-07-07.

## 1. Goal

Make the world read as a **physical place** — grounded material, form, and motion — while staying strictly inside the PS1 aesthetic (320×240 target, flat shading, affine warp, dither, fog). "Realistic" here means *grounded low-fi*, not higher fidelity: a degraded photograph of a real place, not a modern render.

Priority order (owner-approved): **lighting → textures → props → atmosphere.** Lighting first because every other investment multiplies through it: under the current ambient-only model, flat shading yields zero face-to-face luminance variation, so nothing reads as form (the near-black-trees complaint).

## 2. Non-goals

- No shadow maps (existing hard rule, ZoneBuilder torches are `castShadow=false`).
- No PBR, normal maps, mipmaps, or texture filtering beyond `NearestFilter`.
- No render-resolution increase; 320×240/480×360 pipeline untouched.
- No abandoning `flatShading` or vertex snap/affine warp — the faceted look stays; lighting gives it life.
- No new zones, story content, enemies, or combat changes.
- No change to the four screen-scare gimmicks or flicker-safe behavior.

## 3. Lighting v2 — "the moon is a key light"

Real PS1 games did directional Gouraud lighting; ambient-only is *less* period-accurate than a key light. All values live in a new `TUNING.lighting` block (unit-testable, owner-tunable).

**Exteriors** (zone `kind === 'exterior'`):
- One `DirectionalLight` — the moon. Direction derived from the zone's sky preset moon placement (`exteriorSky.ts` hangs the moon toward the north horizon; the light vector must agree with the visible moon disc, or the world reads as stage-lit). Cold slate-blue (start ~`0x8fa3c8`), low intensity (start ~0.45). No shadows.
- One `HemisphereLight` — sky tint from the preset zenith color above, ash-ground tint (~`0x3a3632`) below, low intensity (start ~0.25). Kills the "void black" underside without flattening.
- Ambient floor drops to compensate (exteriors currently 0.5–0.6 flat; target ~0.25–0.35) so total scene luminance stays close to current — the *distribution* changes (form appears), not the overall brightness. Fog color/distance untouched.
- Per-preset values (`field` / `forest` / `gorge`) so the gorge reads ember-warm and the forest reads dead-cold.

**Interiors:** keep torch PointLight pools; add one faint cool `DirectionalLight` (~0.12) so unlit geometry has form instead of void. Undercroft keeps its 0.06 ambient darkness — its faint directional must not defeat the wraith showcase (cap or zero it there via zone def).

**Follow-on rebalance:** tree/bark/grass vertex colors in `exteriorForest.ts` were darkened to survive flat ambient; after the key light lands, re-balance them (target: silhouette against fog unchanged at range; form visible within ~8 m). Entity flat colors (Hound `0x2a2521`, Kneeler `0x232026`) re-checked under the new light — they must stay dark-but-formed. **Watcher and Hag stay pure black `0x000000`** (owner decision: their read IS the silhouette).

**Budget:** Directional + hemisphere lights are per-vertex, add zero draw calls, and do not count against `MAX_POINT_LIGHTS=4`. Rule: ≤1 directional + ≤1 hemisphere per zone, ever.

## 4. Texture realism — implementing owner decision 10

Photo-sourced CC0 textures (AmbientCG-class libraries), each with a `LICENSES.md` row, run through the existing `scripts/downsample-textures.py` crunch (128 px, palette-darkened, 5-bit posterize) and sampled `NearestFilter`/no-mipmaps through the existing `patchMaterial` affine warp. The register mismatch — degraded photo stretched over too-few polygons — is the realism *and* the horror (research §3.4).

Priority order:
1. **Exterior ground** — the largest on-screen surface. Trampled dirt/ash-soil texture on the exterior floor cells + terrain skirt (currently flat `0x2b2a2c`). UV scale chosen so texel density matches the KayKit atlas (~1 texel/1.5 cm at kit scale) — mismatched texel density between kit walls and new ground is the tell to avoid.
2. **Trees** — bark wrap on trunks, dead-needle/ash-canopy on cones. Vertex colors remain as a multiply tint so per-instance variation survives.
3. **Entity skins** — Hound (ash-crusted hide/bone), Kneeler (rotted cloth/robe). Photo-sourced, JPEG-crunch artifacts deliberately visible. Faceless treatment unchanged (committed wrongness — no face textures). Watcher/Hag excluded (pure black).
4. **Village/ruin variance** — only if time allows: a second wall-atlas variant so Cinder Village houses don't repeat the identical castle texture.

Rules: every texture ≤128 px, ≤~8 KB post-crunch; assets stay outside the JS bundle (no gzip-budget impact); merged-mesh count stays ≤6 per zone — new textures mean new material buckets, so ground+trees must not push a zone over (verify per zone in tests).

## 5. Prop fidelity

- **Gibbet cage** (Gate Fields `[7,8]`): kit-bash a hanging cage behind the existing pillar placement (zone data already anticipates this — "a future art pass can drop a cage mesh behind this same placement"). Bars from thin box primitives or kit lattice pieces; a suggestion of an occupant (bone bundle) per the lore card "iron cage rusted open." Signature folk-horror motif — highest prop priority.
- **Cinder Village houses**: differentiate from bare `wall.glb` segments — add roofline wedges and door voids from kit parts so they read as burnt homes, not castle wall.
- **Pilgrim's Descent banner `[7,10]`**: readability fix (scale/contrast/placement) so the kneel-checkpoint is findable; keep it weathered.
- **v1 hall-statue overlap**: fold in the known Great Hall statue placement overlap fix.

## 6. World grounding & atmosphere

The entities' scripted stillness/12 fps-stepped motion only reads as *wrong* if the world itself moves. **Rule: world micro-motion is smooth (full frame rate); ONLY entities are stepped.** (Deliberate inversion guard — do not step foliage at 12 fps or the entity contrast dies.)

- **Wind sway**: gentle smooth vertex wobble on the instanced grass tufts and tree canopies (per-instance phase offset; amplitude a few cm; implemented in the instanced mesh's patched vertex shader or per-frame instance matrix nudge — pick cheapest that holds 60 fps).
- **Banner cloth sway**: slow pendulum/skew on banner meshes, same smooth rule.
- **Ground clutter**: instanced scatter stamps (stones, bone piles, cart wheel, stumps) added to exterior zones via new scatter chars/prop lists, same InstancedMesh pattern as grass (1 draw call per kind). Sparse — a place lived in and died in, not a junkyard.
- **Particle layering per preset**: forest ash denser + slower; gorge gains sparse drifting ember flecks (warm points); field unchanged. All `Points`, all existing pattern.

## 7. Housekeeping (folded in, small)

From the GV re-review minors: (a) `main.ts` boot-persist reassigns in-memory `save` after ember-cap restore; (b) unit test for `CrossingSilhouette` despawn/lifecycle math; (c) comment on `ScareBeat` pointing future payload fields at the `isQuietSighting` predicate.

## 8. Constraints (all existing, all held)

<100 draw calls/zone and <100k tris (CI e2e asserts), ≤6 merged meshes/zone, ≤4 PointLights/zone (+ the new ≤1 directional/≤1 hemisphere rule), no shadow maps, flicker-safe semantics untouched, castle v1 gameplay untouched (visual-only changes are allowed now — everything ships as v1.1.0), every new asset CC0 with a LICENSES.md row, TDD per SDD conventions.

## 9. Process & verification

- Build each system **globally**, ratify on **Gate Fields** first: browser screenshots (raw-CDP method) before/after per system, owner eyeballs before the all-zone sweep.
- Per-zone evidence shots for the sweep; e2e budget assertions must stay green; new unit tests for `TUNING.lighting` wiring, texture-material bucketing counts, scatter caps, wind amplitude bounds.
- Owner playtest at the end (includes the outstanding hound 2.3 m eyeball) → ship v1.1.0.

## 10. Timeline

- **7/4** — Lighting v2 + vertex-color rebalance + Gate Fields ratification.
- **7/5** — Texture pass (ground → trees → entities), per-zone sweep.
- **7/6** — Props + atmosphere + housekeeping + owner playtest → merge → v1.1.0 release.
