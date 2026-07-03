# OATHBRAND Realism Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OATHBRAND's world read as a physical place — grounded material, form, and motion — while staying strictly inside the PS1 aesthetic (320×240, flat shading, affine warp, dither, fog); ships as **v1.1.0 "The Fields"**.

**Architecture:** Priority order **lighting → textures → props → atmosphere** (spec §1). Lighting v2 adds ONE shared `DirectionalLight` (the moon) + ONE shared `HemisphereLight`, rebound per zone from a new unit-tested `TUNING.lighting` block, so flat-shaded faces gain face-to-face luminance variation (form). Textures are CC0 photo maps crunched through the existing `scripts/downsample-textures.py` (128 px, palette-darkened, 5-bit posterize) and sampled `NearestFilter`/no-mipmaps through the existing `patchMaterial` affine warp — the degraded-photo-over-too-few-polygons register mismatch IS the realism and the horror. Props are kit-bash + procedural. Atmosphere is smooth per-instance wind sway (world micro-motion is SMOOTH; only entities are 12-fps stepped). Every change is visual-only; v1 gameplay/collision/scares are untouched.

**Tech Stack:** three@^0.183 (vanilla `WebGLRenderer`, no engine), vite@^6, typescript@^5 (strict), vitest@^3, playwright (CI e2e budgets). Texture crunch is a build-time python3 + Pillow script. No new runtime dependency. Assets CC0 (AmbientCG-class) with `assets/LICENSES.md` rows.

> **Amendment (spec §11, owner-approved 2026-07-03):** the **Curves pass C1–C4** is inserted after Task 9 and PRECEDES Task 10 — atmosphere then animates the curved shapes (atmosphere shrinks if time runs short; curves do not). Tasks 1–9 are already implemented on `feat/realism` (~`d865aa1`); C1–C4 are written against that LIVE code. Every hand-authored geometry keeps the phase policy: **orientation/UV assertions + tri accounting in unit tests** (Task 6's ground shipped invisible until an orientation test pinned the winding).

## Global Constraints

Copied verbatim from spec §8; every task's requirements implicitly include this section.

- **<100 draw calls/zone AND <100k visible tris** — CI e2e asserts (`e2e/greater-vael.spec.ts` reads `renderer.info.render.calls`; `exteriorForest.test.ts` guards tris).
- **≤6 merged meshes/zone** (`MAX_MERGED_MESHES = 6` in `ZoneBuilder.ts` — counts kit material buckets).
- **≤4 PointLights/zone** (`MAX_POINT_LIGHTS = 4`).
- **NEW RULE: ≤1 `DirectionalLight` + ≤1 `HemisphereLight` per zone, ever.** Implemented as ONE shared instance of each, added once to the scene and rebound per zone (like the existing shared `AmbientLight`) — structurally impossible to exceed. Both are per-vertex, add ZERO draw calls.
- **No shadow maps** — every light stays `castShadow = false`.
- **Flicker-safe semantics untouched** — the four screen-scare gimmicks and `setFlickerSafe` behavior are not modified.
- **320×240 render target untouched** (480×360 setting); NO render-resolution increase; no abandoning `flatShading` or vertex snap/affine warp.
- **World micro-motion is SMOOTH (full frame rate); ONLY entities are stepped ~12 fps.** Deliberate inversion guard — NEVER step foliage/banners/clutter, or the entity contrast dies.
- **Watcher and Hag stay pure black `0x000000`** (their read IS the silhouette). Hound (`0x2a2521`) and Kneeler (`0x232026`) stay dark-but-formed. Faceless treatment unchanged — no face textures.
- **Every new asset is CC0**, gets a row in `assets/LICENSES.md` (source URL + license), runs through `scripts/downsample-textures.py` (128 px, palette-darkened, 5-bit posterize), is **≤128 px / ≤~8 KB post-crunch**, and stays OUTSIDE the JS bundle (loaded as a hashed Vite URL — no gzip-budget impact). Bundle stays <1.5 MB gz (code); currently ~209 KB gz.
- **patchMaterial affine warp applies ONLY to the base `map` slot.** Any material that wants the warp MUST have `map` set before its first compile. `forceNearest` then `patchMaterial` after assigning `map`.
- **Instanced textured materials get the SAME `patchMaterial` treatment** (affine + snap), and the wind path is an option ON that patch — a textured instanced forest material is patched once with `{ wind }`.
- **All lighting values live in `TUNING.lighting`** (Task 1) — owner-tunable, unit-tested; systems never hardcode a light color/intensity.
- **TS strict; no `any`** except three.js `onBeforeCompile` shader internals. TDD per SDD conventions; conventional commits (`feat:`/`fix:`/`test:`/`content:`/`chore:`); commit after every green cycle; each exact message is given per task.
- **Process (spec §9):** build each system GLOBALLY, ratify on **Gate Fields first** (before/after browser shots via the raw-CDP method — `.superpowers/sdd/task-18-report.md`), then the all-zone sweep. Shots land in `docs/shots/realism-*`.

## Perf trap accounting (per-zone merge/draw budget after ALL tasks)

New textured materials create NEW merge buckets — this table proves ≤6 merged meshes and <100 draws hold. The exterior **ground** stops being kit `floor.glb` (removed from the shared `texture` bucket) and becomes ONE standalone textured mesh (Task 6), so the kit bucket count does not grow.

| Static merged kit buckets (counts vs ≤6) | Draw calls (informational, vs <100) |
|---|---|
| `merged:texture` (walls/doors/`H`+`A` ruin blocks/banner-if-merged/torch brackets/statue/pillar/crate/rubble) = **1 bucket** | 1 |
| `exterior-ground` (Task 6 — standalone Mesh, NOT a kit bucket) | 1 |
| `exterior-terrain` skirt (standalone Mesh) | 1 |
| 3× forest `InstancedMesh` (grass/sparse/dense) | 3 |
| roof-wedge `InstancedMesh` (Cinder only) + clutter `InstancedMesh` (≤2 kinds) | ≤3 |
| gibbet standalone prop (Gate Fields) | 1 |
| sky dome + moon + ash `Points` (+ gorge ember `Points`) | 3–4 |
| standalone banner (pulled from merge for sway, Task 10) | 1 |

**Kit buckets per exterior zone = 1** (≤6 ✔). **Total exterior draw calls ≈ 12–15** (<100 ✔). Cinder's optional second wall-atlas variant (spec §4.4, "only if time allows") is DEFERRED to keep the kit bucket at 1; door-void differentiation uses `wall-arch.glb` (same atlas → same bucket) instead.

**Curves-pass tri accounting (C1–C4 — zero new draw calls, tri deltas only):** entities ≤600 tris each (vs ~100 boxed; ~4 visible/zone ≈ 2.4k); ground ×4 tris from the 2×2 sub-quad undulation grid (worst zone ~200 floor cells → ~1.6k); crooked trees pine ≤160 / trunk ≤120 (guards, not targets — worst forest ~60 dense + 20 sparse ≈ 12k); boulder clutter ≤140/kind (instanced). Worst-case zone total ≈ 20–25k visible tris (<100k ✔, CI e2e still asserts).

---

## Core shared interfaces (defined in Tasks 1/5, consumed by later tasks)

```ts
// src/content/tuning.ts — appended to TUNING (Task 1). Names are load-bearing.
TUNING.lighting.exterior[preset: 'field'|'forest'|'gorge'] = {
  ambient: number; moon: { color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
};
TUNING.lighting.interior.directional = { color: number; intensity: number };

// src/world/zoneDef.ts — ADD one optional field (Task 1):
//   keyLightIntensity?: number;   // overrides the resolved directional intensity for this zone

// src/world/lighting.ts — pure resolver (Task 1):
export interface ZoneLighting {
  ambient: number;
  key: { color: number; intensity: number };      // the DirectionalLight
  hemi: { sky: number; ground: number; intensity: number };
}
export function resolveZoneLighting(def: ZoneDef): ZoneLighting;

// src/world/exteriorSky.ts — ADD (Task 1):
export function moonDirection(spanM: number): Vector3;   // unit dir from play-space centre TOWARD the moon disc
// ExteriorBackdrop gains: moonDir: Vector3;

// src/world/ZoneBuilder.ts — BuiltZone gains (Task 1):
//   moonDir?: Vector3;   // set on exterior builds; undefined on interiors

// src/world/textures.ts — (Task 5):
export type TexName = 'ground-dirt' | 'bark' | 'rock' | 'hound-hide' | 'kneeler-cloth';
export function configureTexture(tex: Texture): Texture;   // NearestFilter, no mipmaps, RepeatWrapping, sRGB
export function preloadTextures(): Promise<void>;           // loads all tex PNGs; missing → flat fallback, never throws
export function getTexture(name: TexName): Texture | undefined;  // sync; undefined until preloaded (tests → flat)

// src/world/exteriorProps.ts — (Task 9 SHIPPED; gibbet rounded + clutter added in C4):
export function gibbetGeometry(): BufferGeometry;      // hanging iron cage + bone bundle (C4: rods/rings, not boxes)
export function roofWedgeGeometry(): BufferGeometry;   // pitched burnt-roof cap over an H/A house cell (shipped)
export function stoneGeometry(): BufferGeometry;       // ground clutter (C4 — displaced icosahedron; consumed by Task 10 scatter)
export function bonePileGeometry(): BufferGeometry;    // ground clutter (C4)
export function stumpGeometry(): BufferGeometry;       // ground clutter (C4)

// src/entities/palette.ts — (Task 3):
export const HOUND_TINT = 0x2a2521, KNEELER_TINT = 0x232026, WATCHER_TINT = 0x000000, HAG_TINT = 0x000000;

// src/world/noise.ts — seeded, position-stable noise (C1 creates; C2 extends):
export function mulberry32(seed: number): () => number;                       // the game's PRNG (main.ts/AudioManager precedent)
export function seededAt(ix: number, iy: number, iz: number, seed: number): number; // deterministic [0,1) at a lattice point
export function displaceRadial(geo: BufferGeometry, ampM: number, seed: number): BufferGeometry; // watertight lumpiness (C1/C3/C4)
export const UNDULATION_AMP_M: number;                                        // 0.12 (C2)
export function undulation(worldX: number, worldZ: number): number;           // smooth seeded height offset, |out| ≤ AMP (C2)

// src/entities/organic.ts — curved-rig vocabulary (C1):
export function taperedCapsule(rBottom: number, rTop: number, len: number, radial?: number): BufferGeometry; // base-at-y0
export function centredCapsule(rBottom: number, rTop: number, len: number, radial?: number): BufferGeometry; // box drop-in
export function bentLimb(len: number, rTop: number, rBottom: number, bowM: number, radial?: number, segs?: number): BufferGeometry; // hangs from origin
export function blobHead(r: number, seed: number): BufferGeometry;            // crunched faceless skull-blob
export function latheShape(profile: readonly (readonly [number, number])[], radial?: number): BufferGeometry;

// src/world/ZoneBuilder.ts — BuiltZone gains (C2):
//   groundYAt(worldX: number, worldZ: number): number;  // cell height + undulation (exterior); flat cellHeightM (interior)
// stampForest signature after C3 (Task 10 extends the SAME opts object):
//   stampForest(group, name, geometry, spots, opts?: { tilt?: boolean; windMats?: MeshStandardMaterial[] })

// src/ps1/patchMaterial.ts — signature extended (Task 10, backward-compatible):
export interface WindOpts { ampM: number; freqHz: number; heightRefM: number; }
export function patchMaterial(mat: Material, opts?: { wind?: WindOpts }): void;

// src/world/zoneDef.ts — ADD one optional field (Task 10):
//   scatter?: { kind: 'stone'|'bones'|'stump'; cells: GridPos[] }[];
```

---

### Task 1: `TUNING.lighting` + exterior lighting v2 (the moon is a key light)

**Files:**
- Modify: `src/content/tuning.ts` (append the `lighting` block, verbatim below)
- Create: `src/world/lighting.ts` (pure `resolveZoneLighting`)
- Modify: `src/world/exteriorSky.ts:50-116` (export `moonDirection`; add `moonDir` to `ExteriorBackdrop`)
- Modify: `src/world/zoneDef.ts:236-284` (add `keyLightIntensity?: number` to `ZoneDef`)
- Modify: `src/world/ZoneBuilder.ts:72-92, 596-632` (add `moonDir?: Vector3` to `BuiltZone`; set it in the exterior branch)
- Modify: `src/main.ts:301-305` (add shared `moonLight` + `hemiLight`), `src/main.ts:1693-1706` (rebind lighting in `enterZone`)
- Test: `src/content/__tests__/tuning-lighting.test.ts`, `src/world/__tests__/lighting.test.ts`, extend `src/world/__tests__/exteriorSky.test.ts` (create if absent), extend `src/world/__tests__/zoneBuilder.test.ts`

**Interfaces:**
- Produces: `TUNING.lighting` (shape above); `resolveZoneLighting(def): ZoneLighting`; `moonDirection(spanM): Vector3`; `ExteriorBackdrop.moonDir`; `BuiltZone.moonDir?`; `ZoneDef.keyLightIntensity?`.
- Consumes: existing `ExteriorSky`, `ZoneDef`, `buildExteriorSky`, the shared `AmbientLight` pattern.

Append to `TUNING` in `tuning.ts` (copy VERBATIM — names load-bearing across Tasks 1–2):

```ts
  // --- Realism pass: lighting v2 — "the moon is a key light" (spec §3) ------
  // A DirectionalLight (the moon) + a HemisphereLight per exterior preset give
  // flat-shaded faces face-to-face luminance variation (FORM), with the ambient
  // floor dropped so total scene brightness stays ~constant — the DISTRIBUTION
  // changes, not the mean. Per-vertex lights: 0 draw calls, no shadow maps.
  // Rule: ≤1 directional + ≤1 hemisphere per zone (shared, rebound per zone).
  lighting: {
    exterior: {
      // moon.color = cold slate-blue key; low intensity. hemi.sky = a COOL tint
      // (a lightened sky read, NOT the near-black dome zenith, which would add ~0
      // — see "Ambiguities resolved"); hemi.ground = ash. ambient dropped from the
      // old 0.6 flat toward ~0.3 so form appears without lifting the mean.
      field:  { ambient: 0.30, moon: { color: 0x8fa3c8, intensity: 0.45 }, hemi: { sky: 0x3a4658, ground: 0x3a3632, intensity: 0.25 } },
      forest: { ambient: 0.28, moon: { color: 0x7f93b8, intensity: 0.38 }, hemi: { sky: 0x2b3428, ground: 0x33302c, intensity: 0.22 } },
      gorge:  { ambient: 0.32, moon: { color: 0xb2895f, intensity: 0.42 }, hemi: { sky: 0x3a2620, ground: 0x2e211c, intensity: 0.28 } },
    },
    // Interiors keep their torch pools; a faint cool directional gives unlit
    // geometry FORM instead of void. The Undercroft zeroes it (keyLightIntensity: 0
    // in its zone def, Task 2) so the wraith showcase's void-black east half survives.
    interior: { directional: { color: 0xa8b4c8, intensity: 0.12 } },
  } as const,
```

`src/world/lighting.ts` (full):

```ts
/**
 * Pure lighting resolver (realism pass, spec §3). Maps a ZoneDef to the shared
 * AmbientLight/DirectionalLight/HemisphereLight settings main rebinds per zone.
 * No three.js — unit-testable, owner-tunable (all numbers from TUNING.lighting).
 */
import { TUNING } from '../content/tuning';
import type { ZoneDef, ExteriorSky } from './zoneDef';

/** The v1 ambient floor when a zone sets none (mirrors main's DEFAULT_AMBIENT). */
const DEFAULT_AMBIENT = 0.35;

export interface ZoneLighting {
  ambient: number;
  key: { color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
}

export function resolveZoneLighting(def: ZoneDef): ZoneLighting {
  if (def.kind === 'exterior') {
    const preset: ExteriorSky = def.exteriorSky ?? 'field';
    const c = TUNING.lighting.exterior[preset];
    return {
      ambient: c.ambient,
      key: { color: c.moon.color, intensity: def.keyLightIntensity ?? c.moon.intensity },
      hemi: { sky: c.hemi.sky, ground: c.hemi.ground, intensity: c.hemi.intensity },
    };
  }
  const d = TUNING.lighting.interior.directional;
  return {
    ambient: def.ambientFloor ?? DEFAULT_AMBIENT,
    key: { color: d.color, intensity: def.keyLightIntensity ?? d.intensity },
    hemi: { sky: 0x000000, ground: 0x000000, intensity: 0 }, // interiors: no hemisphere
  };
}
```

`exteriorSky.ts` additions — add a `Vector3` import, a pure `moonDirection`, and expose it on the backdrop:

```ts
// (add Vector3 to the three import)
/** Moon world offset from play-space centre (matches the moon.position math below). */
function moonOffset(spanM: number): Vector3 {
  return new Vector3(-spanM * 0.2, MOON_RADIUS * 0.62, -MOON_RADIUS * 0.7);
}
/** Unit direction from the play-space centre TOWARD the visible moon disc. The
 *  DirectionalLight is oriented from this so the key light AGREES with the moon
 *  (or the world reads stage-lit — spec §3). Up (+y) and north (−z). */
export function moonDirection(spanM: number): Vector3 {
  return moonOffset(spanM).normalize();
}
```

In `buildExteriorSky`, replace the moon position line with `moonOffset` and add `moonDir` to the returned object:

```ts
  moon.position.copy(moonOffset(span)).add(new Vector3(cx, 0, cz)); // was moon.position.set(cx - span*0.2, ...)
  // ...
  return { dome, moon, ash, moonDir: moonDirection(span), update, dispose };
```

Add `moonDir: Vector3;` to the `ExteriorBackdrop` interface.

In `ZoneBuilder.ts`: add `moonDir?: Vector3;` to `BuiltZone` (after `updateExterior?`); declare `let moonDir: Vector3 | undefined;` near `updateExterior`; in the exterior `if` block set `moonDir = backdrop.moonDir;`; add `moonDir,` to the `built` object literal.

In `main.ts` `startScene` after the `ambient` light (≈ line 305), add the two shared lights + the directional target:

```ts
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
```

In `enterZone`, replace the `ambient.intensity = activeDef.ambientFloor ?? DEFAULT_AMBIENT;` line (≈1693) with the resolver-driven block (the garden override at 1704-1706 stays AFTER it):

```ts
    const lit = resolveZoneLighting(activeDef);
    ambient.intensity = lit.ambient;
    moonLight.color.setHex(lit.key.color);
    moonLight.intensity = lit.key.intensity;
    moonBaseIntensity = lit.key.intensity;
    const keyDir = built.moonDir ?? INTERIOR_KEY_DIR;
    moonLight.position.copy(keyDir).multiplyScalar(50);
    moonLight.target.position.set(0, 0, 0);
    hemiLight.color.setHex(lit.hemi.sky);
    hemiLight.groundColor.setHex(lit.hemi.ground);
    hemiLight.intensity = lit.hemi.intensity;
```

(Keep the existing garden block; append after it `if (gardenHere) ambient.intensity = 0.5;` unchanged — it intentionally overrides the ambient for the garden only.)

- [ ] **Step 0 (baseline evidence):** BEFORE any code change, capture the pre-lighting Gate Fields baseline for Task 4's before/after. Run the project's dev build and shoot Gate Fields (method + script are Task 4; if Task 4 is done first for the script, reuse it). Save `docs/shots/realism-gatefields-lighting-before.png`. If the sandbox blocks the headed Chrome (exit 144), note "baseline owner-captured" and proceed — the after shot in Task 4 is the gate.

- [ ] **Step 1: Write the failing tests.**

`src/content/__tests__/tuning-lighting.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { TUNING } from '../tuning';

describe('TUNING.lighting', () => {
  it('every exterior preset drops the ambient floor below the old 0.6 flat', () => {
    for (const p of ['field', 'forest', 'gorge'] as const) {
      expect(TUNING.lighting.exterior[p].ambient).toBeGreaterThanOrEqual(0.25);
      expect(TUNING.lighting.exterior[p].ambient).toBeLessThanOrEqual(0.35);
    }
  });
  it('the field moon is a cold, low-intensity key', () => {
    expect(TUNING.lighting.exterior.field.moon.color).toBe(0x8fa3c8);
    expect(TUNING.lighting.exterior.field.moon.intensity).toBeCloseTo(0.45);
  });
  it('the interior faint directional is 0.12', () => {
    expect(TUNING.lighting.interior.directional.intensity).toBeCloseTo(0.12);
  });
});
```

`src/world/__tests__/lighting.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveZoneLighting } from '../lighting';
import type { ZoneDef } from '../zoneDef';

const base = (o: Partial<ZoneDef>): ZoneDef => ({
  id: 'gate-fields', grid: ['.'], cell: 2, tiles: {}, props: [], lights: [],
  enemies: [], lore: [], doors: [], ambience: [], ...o,
});

describe('resolveZoneLighting', () => {
  it('an exterior field zone uses the field preset, dropped ambient + moon key', () => {
    const l = resolveZoneLighting(base({ kind: 'exterior', exteriorSky: 'field' }));
    expect(l.ambient).toBeCloseTo(0.30);
    expect(l.key.color).toBe(0x8fa3c8);
    expect(l.hemi.intensity).toBeCloseTo(0.25);
  });
  it('an interior zone gets the faint cool directional and NO hemisphere', () => {
    const l = resolveZoneLighting(base({ kind: undefined, ambientFloor: 0.35 }));
    expect(l.key.intensity).toBeCloseTo(0.12);
    expect(l.hemi.intensity).toBe(0);
  });
  it('keyLightIntensity overrides the resolved directional (Undercroft guard)', () => {
    const l = resolveZoneLighting(base({ ambientFloor: 0.06, keyLightIntensity: 0 }));
    expect(l.key.intensity).toBe(0);
  });
});
```

`src/world/__tests__/exteriorSky.test.ts` (create if absent):
```ts
import { describe, it, expect } from 'vitest';
import { moonDirection, buildExteriorSky } from '../exteriorSky';

describe('moon direction', () => {
  it('points UP and NORTH (−z) so the key agrees with the visible moon', () => {
    const d = moonDirection(40);
    expect(d.length()).toBeCloseTo(1);
    expect(d.y).toBeGreaterThan(0.4);
    expect(d.z).toBeLessThan(0);
  });
  it('the built backdrop exposes the same moonDir', () => {
    const b = buildExteriorSky('field', { spanM: 40 });
    expect(b.moonDir.y).toBeGreaterThan(0.4);
    b.dispose();
  });
});
```

Extend `src/world/__tests__/zoneBuilder.test.ts` — in the `ZoneBuilder.build (exterior)` describe:
```ts
  it('an exterior build exposes a moonDir; an interior build does not', () => {
    const ext = new ZoneBuilder().build(exteriorZone(['.,t', 'T#.']), fakeAssets());
    expect(ext.moonDir).toBeDefined();
    expect(ext.moonDir!.y).toBeGreaterThan(0);
    const int = new ZoneBuilder().build(zone(['###', '#.#', '###']), fakeAssets()); // `zone()` is the file's interior helper
    expect(int.moonDir).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/content/__tests__/tuning-lighting.test.ts src/world/__tests__/lighting.test.ts src/world/__tests__/exteriorSky.test.ts src/world/__tests__/zoneBuilder.test.ts`
Expected: FAIL — `TUNING.lighting` undefined, `resolveZoneLighting`/`moonDirection` not exported, `moonDir` undefined.

- [ ] **Step 3: Implement.** Append the `lighting` block to `tuning.ts`; create `lighting.ts`; add `moonDirection` + `moonDir` to `exteriorSky.ts`; add `moonDir` to `BuiltZone` + set it in `ZoneBuilder.build`; add `keyLightIntensity?` to `ZoneDef`. Do NOT wire `main.ts` yet (headless tests don't cover it).

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/content/__tests__/tuning-lighting.test.ts src/world/__tests__/lighting.test.ts src/world/__tests__/exteriorSky.test.ts src/world/__tests__/zoneBuilder.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire `main.ts`.** Add `import { resolveZoneLighting } from './world/lighting';`; add the shared `moonLight`/`hemiLight`/`INTERIOR_KEY_DIR`/`moonBaseIntensity` in `startScene`; replace the ambient line in `enterZone` with the resolver block above. Run `npm run typecheck` → clean. Run `npx vitest run` → all green (the whole suite, to confirm no regressions).

- [ ] **Step 6: Commit.**
```bash
git add src/content/tuning.ts src/world/lighting.ts src/world/exteriorSky.ts src/world/zoneDef.ts src/world/ZoneBuilder.ts src/main.ts src/content/__tests__/tuning-lighting.test.ts src/world/__tests__/lighting.test.ts src/world/__tests__/exteriorSky.test.ts src/world/__tests__/zoneBuilder.test.ts docs/shots/realism-gatefields-lighting-before.png
git commit -m "feat(lighting): TUNING.lighting block + exterior moon key + hemisphere fill"
```

---

### Task 2: Interior faint directional + Undercroft guard + Forsworn-P3 interaction

**Files:**
- Modify: `src/content/zones/undercroft.ts:89` (add `keyLightIntensity: 0`)
- Modify: `src/main.ts:2340-2349` (scale the moon/interior directional with the Forsworn P3 blackout)
- Test: extend `src/world/__tests__/lighting.test.ts`

**Interfaces:**
- Consumes: `resolveZoneLighting`, `ZoneDef.keyLightIntensity`, `moonBaseIntensity` (Task 1).
- Produces: no new exports — interiors now render with a faint cool key; the Undercroft stays void-black; the P3 blackout dims the directional in step with the ambient.

The faint interior directional already lands via Task 1's `resolveZoneLighting` interior branch (0.12) and the `INTERIOR_KEY_DIR` orientation. This task guards the two dark showcases:

`undercroft.ts` — add the field (keeps its 0.06 ambient darkness AND zeroes the key so the wraith showcase's east half stays black):
```ts
  ambientFloor: 0.06,
  keyLightIntensity: 0, // the faint interior directional must NOT defeat the wraith showcase (spec §3)
```

`main.ts` — the Forsworn P3 blackout (≈ line 2349) currently only dims `ambient`. Extend it so the interior directional dies with it (else the 0.12 key re-lights the near-black arena). Find:
```ts
        ambient.intensity = (activeDef.ambientFloor ?? DEFAULT_AMBIENT) * (1 - darkness * 0.9);
```
and add immediately after:
```ts
        moonLight.intensity = moonBaseIntensity * (1 - darkness * 0.9);
```

- [ ] **Step 1: Write the failing test.** Extend `lighting.test.ts`:
```ts
  it('the Undercroft floors ambient AND zeroes the key so the wraith void survives', () => {
    const l = resolveZoneLighting(base({ ambientFloor: 0.06, keyLightIntensity: 0 }));
    expect(l.ambient).toBeCloseTo(0.06);
    expect(l.key.intensity).toBe(0);
  });
```
Also add a targeted zone assertion in `src/content/__tests__/zones.test.ts` (near the existing per-zone loop):
```ts
  it('the undercroft zeroes its realism-pass key light (wraith showcase guard)', () => {
    expect(UNDERCROFT.keyLightIntensity).toBe(0); // import UNDERCROFT from the zones registry
  });
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/world/__tests__/lighting.test.ts src/content/__tests__/zones.test.ts`
Expected: FAIL — `undercroft.ts` has no `keyLightIntensity`.

- [ ] **Step 3: Implement.** Add `keyLightIntensity: 0` to `undercroft.ts`; add the `moonLight.intensity` line after the P3 ambient dim in `main.ts`.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/world/__tests__/lighting.test.ts src/content/__tests__/zones.test.ts` → PASS. Run `npm run typecheck` → clean.

- [ ] **Step 5: Commit.**
```bash
git add src/content/zones/undercroft.ts src/main.ts src/world/__tests__/lighting.test.ts src/content/__tests__/zones.test.ts
git commit -m "feat(lighting): faint interior key + undercroft guard + forsworn-p3 dim"
```

---

### Task 3: Vertex-color rebalance (forest) + entity tint re-check under the key light

**Files:**
- Modify: `src/world/exteriorForest.ts:27-29` (rebalance `BARK`/`NEEDLE`/`BLADE`)
- Create: `src/entities/palette.ts` (single source of truth for entity flat tints)
- Modify: `src/entities/AshHound.ts:243`, `src/entities/KneelingHollow.ts:225`, `src/entities/WatcherPresence.ts:188`, `src/entities/HagPresence.ts:114` (import the shared consts)
- Test: `src/entities/__tests__/palette.test.ts`, extend `src/world/__tests__/exteriorForest.test.ts`

**Interfaces:**
- Produces: `HOUND_TINT`/`KNEELER_TINT`/`WATCHER_TINT`/`HAG_TINT` (palette.ts); rebalanced forest palette consts (module-private, verified via a luminance test).
- Consumes: nothing new. The rebalance is UNDER the new key light (Task 1); the tree-texture pass (Task 7) multiplies these tints by the bark map, so Task 7 re-verifies the combined read.

Rebalance `exteriorForest.ts` — the old values were darkened to survive flat ambient; with the moon key giving face variation they can lift toward "form visible within ~8 m; silhouette against fog unchanged at range" (spec §3). Replace:
```ts
const BARK = 0x463a30;   // was 0x3b322a — a touch lifted so trunk faces catch the moon
const NEEDLE = 0x59614c; // was 0x4a5340
const BLADE = 0x5b6050;  // was 0x4d5140
```

`src/entities/palette.ts` (full):
```ts
/**
 * Realism pass (Task 3): the single source of truth for entity flat tints,
 * re-checked under the moon key light. Hound/Kneeler stay dark-but-formed;
 * the Watcher and the Hag stay PURE BLACK — their read IS the silhouette
 * (owner decision, spec §3). Task 8's photo skins MULTIPLY these tints.
 */
export const HOUND_TINT = 0x2a2521;
export const KNEELER_TINT = 0x232026;
export const WATCHER_TINT = 0x000000;
export const HAG_TINT = 0x000000;
```

In each entity, replace the literal `0x...` in the `new MeshStandardMaterial({ color: ... })` with the import:
- `AshHound.ts`: `import { HOUND_TINT } from './palette';` → `color: HOUND_TINT`.
- `KneelingHollow.ts`: `import { KNEELER_TINT } from './palette';` → `color: KNEELER_TINT`.
- `WatcherPresence.ts`: `import { WATCHER_TINT } from './palette';` → `color: WATCHER_TINT`.
- `HagPresence.ts`: `import { HAG_TINT } from './palette';` → `color: HAG_TINT`.

- [ ] **Step 1: Write the failing tests.**

`src/entities/__tests__/palette.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { HOUND_TINT, KNEELER_TINT, WATCHER_TINT, HAG_TINT } from '../palette';

describe('entity tint invariants (spec §3)', () => {
  it('the Watcher and the Hag stay PURE BLACK', () => {
    expect(WATCHER_TINT).toBe(0x000000);
    expect(HAG_TINT).toBe(0x000000);
  });
  it('the Hound and Kneeler stay dark-but-formed (not black, low luma)', () => {
    for (const c of [HOUND_TINT, KNEELER_TINT]) {
      const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      expect(luma).toBeGreaterThan(8);   // not void
      expect(luma).toBeLessThan(60);     // still dark
    }
  });
});
```

Extend `exteriorForest.test.ts` — assert the rebalanced palette reads as "form within range" (a luminance band on the vertex colors), by sampling the merged geometry's `color` attribute:
```ts
  it('rebalanced under the key light: vertex colours sit in the readable band', () => {
    for (const build of [pineGeometry, trunkGeometry, grassGeometry]) {
      const geo = build();
      const col = geo.getAttribute('color')!;
      let maxLuma = 0;
      for (let i = 0; i < col.count; i++) {
        const luma = 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
        maxLuma = Math.max(maxLuma, luma);
      }
      expect(maxLuma).toBeGreaterThan(0.20); // lifted from the old near-0.1 flat-ambient values
      expect(maxLuma).toBeLessThan(0.45);    // still a dead, desaturated forest
      geo.dispose();
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/entities/__tests__/palette.test.ts src/world/__tests__/exteriorForest.test.ts`
Expected: FAIL — `palette.ts` missing; forest luma below the new floor.

- [ ] **Step 3: Implement.** Create `palette.ts`; rebalance the three forest consts; swap the four entity color literals for imports.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/entities/__tests__/palette.test.ts src/world/__tests__/exteriorForest.test.ts src/entities` → PASS (the `src/entities` run confirms the four entity refactors didn't break existing entity tests). Run `npm run typecheck` → clean.

- [ ] **Step 5: Commit.**
```bash
git add src/world/exteriorForest.ts src/entities/palette.ts src/entities/AshHound.ts src/entities/KneelingHollow.ts src/entities/WatcherPresence.ts src/entities/HagPresence.ts src/entities/__tests__/palette.test.ts src/world/__tests__/exteriorForest.test.ts
git commit -m "feat(lighting): rebalance forest vertex colours + entity tints under the key light"
```

---

### Task 4: Gate Fields ratification — before/after browser evidence (raw-CDP)

**Files:**
- Create: `scripts/shoot.mjs` (dependency-free CDP screenshot driver — the `.superpowers/sdd/task-18-report.md` method)
- Create: `docs/shots/realism-gatefields-*.png`

**Interfaces:**
- Produces: the reusable capture script (Task 12 reuses it) and the owner-eyeball ratification shots. No code under test — this is the spec §9 "ratify on Gate Fields first, owner eyeballs before the all-zone sweep" gate.

`scripts/shoot.mjs` (full — Node 22 global `WebSocket`/`fetch`, no deps; drives the documented dev handle `?dev=1&zone=…`, `window.__oathbrand`, freezes the sim with `game.transition('reading')`, `stepFrame()`, then `Page.captureScreenshot` → PNG bytes to `docs/shots/`):

```js
// Usage:
//   1) start a headed Chrome once (owner/executor shell):
//        google-chrome-stable --headless=new --remote-debugging-port=9222 \
//          --window-size=1280,960 --hide-scrollbars about:blank &
//      (or a headed Chrome on DISPLAY=:1 if the sandbox kills --headless — see the memo).
//   2) start the dev server:  npm run dev  (serves http://localhost:5173/oathbrand/)
//   3) node scripts/shoot.mjs <zoneId> <outName> [freeze]
import { writeFileSync } from 'node:fs';

const [, , zone = 'gate-fields', outName = `realism-${zone}`, freeze = '1'] = process.argv;
const BASE = process.env.OATHBRAND_URL ?? 'http://localhost:5173/oathbrand/';
const CDP = process.env.CDP_URL ?? 'http://localhost:9222';

const list = await (await fetch(`${CDP}/json`)).json();
const page = list.find((t) => t.type === 'page') ?? list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evalJs = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${BASE}?dev=1&zone=${zone}` });
// wait for the dev handle + 'playing' state
for (let i = 0; i < 200; i++) {
  const ok = await evalJs("!!window.__oathbrand && window.__oathbrand.game && window.__oathbrand.game.state==='playing'");
  if (ok) break;
  await new Promise((r) => setTimeout(r, 100));
}
// pump a few frames (rAF is throttled headless), then freeze for a clean plate
for (let i = 0; i < 30; i++) { await evalJs('window.__oathbrand.stepFrame(16)'); }
if (freeze === '1') { await evalJs("window.__oathbrand.game.transition('reading')"); await evalJs('window.__oathbrand.stepFrame(16)'); }
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(`docs/shots/${outName}.png`, Buffer.from(shot.result.data, 'base64'));
console.log(`wrote docs/shots/${outName}.png`);
ws.close();
```

- [ ] **Step 1: Write the capture script.** Create `scripts/shoot.mjs` exactly as above.

- [ ] **Step 2: Capture the AFTER shots (post lighting + rebalance).** Start Chrome + `npm run dev`, then:
```bash
node scripts/shoot.mjs gate-fields realism-gatefields-lighting-after 1
```
Expected: `wrote docs/shots/realism-gatefields-lighting-after.png` and a Gate Fields frame where the oath-oak and tree-line now read as FORM (moon-lit north/top faces vs shadowed faces) rather than near-black slabs. If the sandbox kills Chrome (exit 144), the owner runs the same command; treat as an owner-eyeball gate.

- [ ] **Step 3: Owner ratification.** Place `realism-gatefields-lighting-before.png` (Task 1 Step 0) and `-after.png` side by side; owner confirms "reads as a physical place, still PS1, brightness ~unchanged, form appeared." Do NOT proceed to the all-zone texture sweep until confirmed (spec §9). Log the verdict in the task report.

- [ ] **Step 4: Commit.**
```bash
git add scripts/shoot.mjs docs/shots/realism-gatefields-lighting-after.png
git commit -m "test(evidence): gate fields lighting ratification shots + raw-CDP shoot script"
```

---

### Task 5: Texture acquisition + crunch pipeline (CC0 photo maps → assets/tex)

**Files:**
- Modify: `scripts/fetch-assets.sh` (curl the AmbientCG CC0 zips with a browser UA; unzip; stage the `_Color.jpg` maps into `.assets-cache/ambientcg/`)
- Modify: `scripts/downsample-textures.py` (add a `PHOTO_SOURCES` path → standalone 128 px crunched PNGs at `assets/tex/`, NO GLB embed; reuse `process_atlas`)
- Create: `assets/tex/{ground-dirt,bark,rock,hound-hide,kneeler-cloth}.png` (generated)
- Modify: `assets/LICENSES.md` (a row per source)
- Create: `src/world/textures.ts` (preload + sync accessor + pure `configureTexture`)
- Test: `src/world/__tests__/textures.test.ts`

**Interfaces:**
- Produces: `TexName`, `configureTexture(tex)`, `preloadTextures()`, `getTexture(name)` (signatures above). `getTexture` returns `undefined` until `preloadTextures` runs (so headless unit tests keep the flat fallback).
- Consumes: nothing new. Downstream: Tasks 6/7/8 read `getTexture`.

Concrete CC0 candidates (AmbientCG, all CC0, 1K JPG; the crunch is asset-agnostic — any `*_Color.jpg` works, so a 404 falls back to the alternate listed):

| `TexName` | AmbientCG asset (primary) | fallback | use |
|---|---|---|---|
| `ground-dirt` | `Ground037` (dry cracked dirt) | `Ground003` | exterior ground (Task 6) |
| `bark` | `Bark012` | `Bark006` | tree trunks + cones (Task 7) |
| `rock` | `Rock030` | `Rock023` | terrain skirt / cliff faces (Task 6) |
| `hound-hide` | `Leather011` | `Leather026` | Ash-Hound skin (Task 8) |
| `kneeler-cloth` | `Fabric030` | `Fabric042` | Kneeling Hollow robe (Task 8) |

Add to `scripts/fetch-assets.sh` (after the existing kit fetches; browser UA is REQUIRED per the AmbientCG note):
```sh
# --- Realism pass (Task 5): CC0 photo textures from AmbientCG (all CC0) -------
mkdir -p "$CACHE/ambientcg"
fetch_acg() { # $1 = asset id, $2 = local basename
  local zip="$CACHE/ambientcg/$1.zip"
  if [ ! -f "$CACHE/ambientcg/$2.jpg" ]; then
    echo "  AmbientCG $1 → $2.jpg"
    curl -fsSL -A "Mozilla/5.0" "https://ambientcg.com/get?file=${1}_1K-JPG.zip" -o "$zip" \
      || { echo "ERROR: AmbientCG $1 download failed (try the fallback id in LICENSES.md)" >&2; exit 1; }
    unzip -oq "$zip" "${1}_1K-JPG_Color.jpg" -d "$CACHE/ambientcg"
    mv "$CACHE/ambientcg/${1}_1K-JPG_Color.jpg" "$CACHE/ambientcg/$2.jpg"
  fi
}
fetch_acg Ground037 ground-dirt
fetch_acg Bark012    bark
fetch_acg Rock030    rock
fetch_acg Leather011 hound-hide
fetch_acg Fabric030  kneeler-cloth
```

Add to `scripts/downsample-textures.py` a standalone-photo path (reuses `process_atlas`, which already resizes→darken→posterize; no GLB re-embed):
```py
# Realism pass (Task 5): standalone photo textures → 128px crunched PNGs in
# assets/tex/ (NO GLB embed). basename in assets/tex/ -> cached source jpg.
PHOTO_SOURCES = {
    'ground-dirt':   os.path.join(CACHE, 'ambientcg', 'ground-dirt.jpg'),
    'bark':          os.path.join(CACHE, 'ambientcg', 'bark.jpg'),
    'rock':          os.path.join(CACHE, 'ambientcg', 'rock.jpg'),
    'hound-hide':    os.path.join(CACHE, 'ambientcg', 'hound-hide.jpg'),
    'kneeler-cloth': os.path.join(CACHE, 'ambientcg', 'kneeler-cloth.jpg'),
}
```
and in `main()`, after the atlas loop:
```py
    for name, src in PHOTO_SOURCES.items():
        if not os.path.exists(src):
            print(f'MISSING photo source: {src} — run scripts/fetch-assets.sh first.', file=sys.stderr)
            sys.exit(1)
        im = process_atlas(src)  # resize 128 → darken toward palette → posterize 5-bit
        data = png_bytes(im)
        out = os.path.join(TEX, f'{name}.png')
        with open(out, 'wb') as f:
            f.write(data)
        print(f'  assets/tex/{name}.png  ({im.size[0]}px, {len(data) / 1024:.1f} KB)')
```
(`process_atlas` opens RGBA and resizes to `SIZE`=128 — a 1024 JPG downsamples fine; `.convert('RGBA')` handles the no-alpha JPG.)

`src/world/textures.ts` (full):
```ts
/**
 * Realism pass (Task 5): standalone CC0 photo textures, crunched to 128px by
 * scripts/downsample-textures.py and sampled NearestFilter/no-mipmaps/RepeatWrapping
 * through patchMaterial's affine warp. Preloaded once at boot; getTexture is a
 * SYNC accessor (undefined until preloaded, so ZoneBuilder/entities fall back to
 * flat colour under vitest — no WebGL, no download in tests).
 */
import { NearestFilter, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';

export type TexName = 'ground-dirt' | 'bark' | 'rock' | 'hound-hide' | 'kneeler-cloth';

const FILES: Record<TexName, string> = {
  'ground-dirt': 'ground-dirt', bark: 'bark', rock: 'rock',
  'hound-hide': 'hound-hide', 'kneeler-cloth': 'kneeler-cloth',
};

// Vite emits each PNG as a hashed URL (outside the JS bundle — no gzip impact).
const TEX_URLS = import.meta.glob<string>('/assets/tex/*.png', { query: '?url', import: 'default' });

const cache = new Map<TexName, Texture>();
let loader: TextureLoader | undefined;

/** The crunchy PS1 sampler config: nearest, no mipmaps, repeat, sRGB. Pure. */
export function configureTexture(tex: Texture): Texture {
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Load + configure every tex PNG. Missing files → flat fallback (never throws). */
export async function preloadTextures(): Promise<void> {
  loader ??= new TextureLoader();
  await Promise.all(
    (Object.keys(FILES) as TexName[]).map(async (name) => {
      const resolve = TEX_URLS[`/assets/tex/${FILES[name]}.png`];
      if (!resolve) return;
      const tex = await loader!.loadAsync(await resolve());
      cache.set(name, configureTexture(tex));
    }),
  );
}

/** Sync accessor. Undefined until preloadTextures resolves (tests → flat). */
export function getTexture(name: TexName): Texture | undefined {
  return cache.get(name);
}
```

Wire the preload in `main.ts` `startScene`, right after `const save = loadGame();` (≈ line 312) and BEFORE the first `zones.load`:
```ts
  await preloadTextures(); // realism pass: ground/bark/rock/hide/cloth ready before the first zone builds
```
(add `import { preloadTextures } from './world/textures';`).

Add rows to `assets/LICENSES.md` under the source table:
```
| AmbientCG (CC0 texture library) | ambientCG (Lennart Demes) | <https://ambientcg.com> — assets CC0 1.0: Ground037, Bark012, Rock030, Leather011, Fabric030 (`_1K-JPG` Color maps) | CC0 | `tex/ground-dirt.png`, `tex/bark.png`, `tex/rock.png`, `tex/hound-hide.png`, `tex/kneeler-cloth.png` — each resized to 128 px, palette-darkened, 5-bit posterized by `scripts/downsample-textures.py` (≤~8 KB). Standalone maps (no GLB embed); loaded as hashed Vite URLs (outside the JS bundle). |
```

- [ ] **Step 1: Write the failing test.** `src/world/__tests__/textures.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Texture } from 'three';
import { NearestFilter, RepeatWrapping } from 'three';
import { configureTexture, getTexture } from '../textures';

describe('textures', () => {
  it('configureTexture applies the crunchy PS1 sampler settings', () => {
    const t = configureTexture(new Texture());
    expect(t.magFilter).toBe(NearestFilter);
    expect(t.minFilter).toBe(NearestFilter);
    expect(t.generateMipmaps).toBe(false);
    expect(t.wrapS).toBe(RepeatWrapping);
    expect(t.wrapT).toBe(RepeatWrapping);
  });
  it('getTexture returns undefined before preload (flat fallback in tests)', () => {
    expect(getTexture('ground-dirt')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/world/__tests__/textures.test.ts`
Expected: FAIL — `../textures` does not exist.

- [ ] **Step 3: Implement + generate assets.** Create `textures.ts`; extend `fetch-assets.sh` + `downsample-textures.py`; add the LICENSES row; wire `preloadTextures` in `main.ts`. Fetch + crunch:
```bash
bash scripts/fetch-assets.sh && python3 scripts/downsample-textures.py
```
Expected output includes five `assets/tex/<name>.png (128px, X.X KB)` lines, each ≤~8 KB. If any AmbientCG id 404s, swap to the fallback id in the script + LICENSES row and re-run.

- [ ] **Step 4: Run test + verify the crunched assets.**

Run: `npx vitest run src/world/__tests__/textures.test.ts` → PASS.
Run: `python3 -c "from PIL import Image; [print(n, Image.open(f'assets/tex/{n}.png').size) for n in ['ground-dirt','bark','rock','hound-hide','kneeler-cloth']]"`
Expected: each prints `(128, 128)`. Run `npm run typecheck` → clean.

- [ ] **Step 5: Commit.**
```bash
git add scripts/fetch-assets.sh scripts/downsample-textures.py assets/tex/ground-dirt.png assets/tex/bark.png assets/tex/rock.png assets/tex/hound-hide.png assets/tex/kneeler-cloth.png assets/LICENSES.md src/world/textures.ts src/main.ts src/world/__tests__/textures.test.ts
git commit -m "feat(tex): CC0 photo texture acquisition + 128px crunch pipeline + preload"
```

---

### Task 6: Exterior ground + terrain-skirt texturing (world-space planar UVs)

**Files:**
- Modify: `src/world/ZoneBuilder.ts` (exterior branch: floor cells → ONE textured `exterior-ground` mesh with planar UVs, REPLACING kit `floor.glb`; texture the terrain skirt with `rock`)
- Test: extend `src/world/__tests__/zoneBuilder.test.ts` (including UPDATING the existing `merged:floor` exterior assertion)

**Interfaces:**
- Produces: `planarUV(worldX, worldZ, tileM?): [number, number]` (exported for the test); an `exterior-ground` standalone Mesh (its own material bucket, NOT the kit `texture` bucket).
- Consumes: `getTexture('ground-dirt')`/`getTexture('rock')` (Task 5); existing `buildTerrainSkirt`, `patchMaterial`, `forceNearest`.

**HOW UVs get onto currently-untextured geometry:** the exterior ground is currently kit `floor.glb` tiles (their own atlas UVs) merged into the shared `texture` bucket. Realism ground needs a DIFFERENT map on the ground only, so we stop emitting kit floor tiles for exteriors and build ONE merged ground mesh whose UVs are **world-space planar** — `uv = (worldX / tileM, worldZ / tileM)` at each cell corner. Adjacent cells share continuous UVs (RepeatWrapping) so the texture tiles seamlessly with NO per-tile seam. `tileM = 2` (one repeat per 2 m) gives ~texel density matching the KayKit atlas at kit scale (spec §4.1 "mismatched texel density is the tell to avoid"). The affine warp needs a `map` + a `uv` attribute — the merged ground geometry carries both.

Add near the other exterior consts (`ZoneBuilder.ts` ~line 122):
```ts
/** One ground-texture repeat spans this many world metres (texel density ≈ kit atlas). */
const GROUND_TILE_M = 2;
/** Flat ground colour when the crunched dirt map is absent (tests / fetch not run). */
const GROUND_FLAT_HEX = 0x3a3632;

/** World-space planar UV for a ground point (pure; exported for the test). */
export function planarUV(worldX: number, worldZ: number, tileM = GROUND_TILE_M): [number, number] {
  return [worldX / tileM, worldZ / tileM];
}
```

Add a builder (near `buildTerrainSkirt`):
```ts
/** One merged textured ground mesh over the exterior floor cells, world-planar
 *  UV'd (seamless tiling), each cell quad at its terrain height. Replaces the kit
 *  floor tiles for exteriors so the ground carries the dirt map, NOT the wall atlas. */
function buildExteriorGround(cell: number, spots: ForestSpot[]): Mesh | null {
  if (spots.length === 0) return null;
  const pos: number[] = [];
  const uv: number[] = [];
  for (const { x, y, z } of spots) {
    const x0 = x - cell / 2, x1 = x + cell / 2, z0 = z - cell / 2, z1 = z + cell / 2;
    // two tris, CCW facing +y
    const corners: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]];
    for (const [cx, cz] of corners) {
      pos.push(cx, y, cz);
      const [u, v] = planarUV(cx, cz);
      uv.push(u, v);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new Float32BufferAttribute(new Float32Array(uv), 2));
  geo.computeVertexNormals();
  const map = getTexture('ground-dirt');
  const material = new MeshStandardMaterial({
    color: map ? 0xffffff : GROUND_FLAT_HEX, // white so the crunched map shows at its own brightness
    map, roughness: 1, metalness: 0, flatShading: true,
  });
  forceNearest(material);
  patchMaterial(material); // affine warp applies because `map` is set before compile
  const mesh = new Mesh(geo, material);
  mesh.name = 'exterior-ground';
  return mesh;
}
```
(add `getTexture` to the imports from `./textures`.)

In `ZoneBuilder.build`, collect ground cells and stop emitting kit floor tiles for exteriors. Add `const ground: ForestSpot[] = [];` beside `grass/sparse/dense`. Change `floorTile` in the exterior scan from `addPiece('floor', ...)` to:
```ts
          const floorTile = (): void => { ground.push({ x, y, z, row, col }); };
```
After the forest stamps (in the `if (def.kind === 'exterior')` block ~line 599), add:
```ts
      const groundMesh = buildExteriorGround(cell, ground);
      if (groundMesh) group.add(groundMesh);
```
Texture the terrain skirt — in `buildTerrainSkirt`, set the rock map before patch:
```ts
  const map = getTexture('rock');
  const material = new MeshStandardMaterial({
    color: map ? 0xffffff : TERRAIN_COLOR, map, roughness: 1, metalness: 0, side: DoubleSide, flatShading: true,
  });
  forceNearest(material);
  patchMaterial(material);
```
(The skirt geometry currently has NO `uv`; add planar UVs when pushing skirt verts — for each pushed vertex `(vx, vy, vz)`, push `planarUV(vx, vz)` into a parallel `uvArr`, and `geo.setAttribute('uv', new Float32BufferAttribute(new Float32Array(uvArr), 2))`. Vertical faces map by x/z footprint — acceptable at PS1 crunch.)

- [ ] **Step 1: Write the failing tests.** Extend `zoneBuilder.test.ts`. First, UPDATE the existing exterior assertion (line ~185) — exteriors no longer emit `merged:floor`:
```ts
    expect(mergedNames(built.group)).not.toContain('merged:floor'); // ground is now a textured mesh, not the kit atlas
```
Add a `meshNamed` helper + new tests:
```ts
function meshNamed(group: Group, name: string): Mesh | undefined {
  let found: Mesh | undefined;
  group.traverse((o) => { if (o instanceof Mesh && o.name === name) found = o; });
  return found;
}

it('an exterior build emits one exterior-ground mesh with a uv attribute', () => {
  const built = new ZoneBuilder().build(exteriorZone(['.,t', 'p#.']), fakeAssets());
  const g = meshNamed(built.group, 'exterior-ground');
  expect(g).toBeDefined();
  expect(g!.geometry.getAttribute('uv')).toBeDefined();
});
it('keeps the kit merge bucket count at 1 for an exterior zone (≤6 budget)', () => {
  const built = new ZoneBuilder().build(exteriorZone(['H,t', 'T#.']), fakeAssets());
  // only the wall/H atlas remains a kit bucket; ground/skirt/forest are separate meshes
  expect(mergedNames(built.group).length).toBeLessThanOrEqual(6);
  expect(mergedNames(built.group)).toContain('merged:wall'); // the H ruin block still buckets
  expect(mergedNames(built.group)).not.toContain('merged:floor');
});
```
And a `planarUV` unit assertion:
```ts
import { planarUV } from '../ZoneBuilder';
it('planarUV tiles seamlessly at 2 m per repeat', () => {
  expect(planarUV(0, 0)).toEqual([0, 0]);
  expect(planarUV(2, 4)).toEqual([1, 2]);
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/world/__tests__/zoneBuilder.test.ts`
Expected: FAIL — no `exterior-ground` mesh; `planarUV` not exported; the old `merged:floor` expectation now inverted.

- [ ] **Step 3: Implement.** Add `GROUND_TILE_M`/`GROUND_FLAT_HEX`/`planarUV`/`buildExteriorGround`; swap the exterior `floorTile` to collect `ground`; add the ground mesh; texture the skirt with planar UVs.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/world/__tests__/zoneBuilder.test.ts` → PASS. Run `npm run typecheck` → clean.

- [ ] **Step 5: Ratify + commit.** Shoot the after-ground plate (needs the fetched textures from Task 5):
```bash
node scripts/shoot.mjs gate-fields realism-gatefields-ground 1
```
Expected: the field floor reads as trampled dirt/ash-soil (crunched photo, affine-warped) instead of flat grey; texel density matches the kit walls. Then:
```bash
git add src/world/ZoneBuilder.ts src/world/__tests__/zoneBuilder.test.ts docs/shots/realism-gatefields-ground.png
git commit -m "feat(tex): exterior ground + terrain skirt textured via world-planar UVs"
```

---

### Task 7: Tree bark/canopy texturing (vertex-color multiply preserved) + grass UVs

**Files:**
- Modify: `src/world/exteriorForest.ts:99-115` (add a `uv` attribute to `grassGeometry`)
- Modify: `src/world/ZoneBuilder.ts:340-367` (`stampForest`: set the bark `map`, keep `vertexColors`)
- Test: extend `src/world/__tests__/exteriorForest.test.ts`, extend `src/world/__tests__/zoneBuilder.test.ts`

**Interfaces:**
- Consumes: `getTexture('bark')` (Task 5); the existing merged forest geometries (`pineGeometry`/`trunkGeometry` already carry cone/cylinder UVs; grass gets UVs here).
- Produces: no new exports — forest instanced materials now sample the crunched bark map MULTIPLIED by the baked BARK/NEEDLE/BLADE vertex tints (per-instance variation survives; spec §4.2). ONE map per instanced material (1 draw call/kind held).

**Why one map:** each forest kind is ONE `InstancedMesh` = ONE material = ONE `map`. The trunk+cone of a pine share that material, so a single crunchy organic bark map covers both; the baked NEEDLE vs BARK vertex colours (Task 3) provide the hue via `map × vertexColor` (three multiplies both into `diffuseColor`). This keeps 1 draw call/kind and the multiply-tint per-instance variation the spec requires.

`grassGeometry` — add a `uv` attribute to each blade quad so the affine map path has UVs (cones/cylinders already have them; grass is hand-built). In the blade loop, after `g.setAttribute('position', ...)`:
```ts
    g.setAttribute('uv', new Float32BufferAttribute(new Float32Array([
      0, 0, 1, 0, 0.5, 1, // front tri
      1, 0, 0, 0, 0.5, 1, // back tri
    ]), 2));
```

`stampForest` — set the bark map before `patchMaterial`; keep `vertexColors: true` (the multiply):
```ts
  const map = getTexture('bark');
  const material = new MeshStandardMaterial({
    vertexColors: true, map, roughness: 1, metalness: 0, flatShading: true,
  });
  forceNearest(material);
  patchMaterial(material); // affine applies (map set); vertexColors × map = tinted crunch
```
(add `getTexture` import if not already added in Task 6; it is, so this is a no-op there.)

- [ ] **Step 1: Write the failing tests.** Extend `exteriorForest.test.ts`:
```ts
it('grass has a uv attribute so the affine bark map can sample it', () => {
  const geo = grassGeometry();
  expect(geo.getAttribute('uv')).toBeDefined();
  geo.dispose();
});
it('pine/trunk already carry uv (cone/cylinder) for the map', () => {
  for (const build of [pineGeometry, trunkGeometry]) {
    const g = build();
    expect(g.getAttribute('uv')).toBeDefined();
    g.dispose();
  }
});
```
Extend `zoneBuilder.test.ts` (in the exterior describe):
```ts
it('forest instanced materials keep vertexColors (multiply tint) with a map slot', () => {
  const built = new ZoneBuilder().build(exteriorZone([',t', 'T#']), fakeAssets());
  let checked = 0;
  built.group.traverse((o) => {
    if (o instanceof InstancedMesh) {
      const m = o.material as MeshStandardMaterial;
      expect(m.vertexColors).toBe(true); // per-instance tint survives
      checked++;
    }
  });
  expect(checked).toBeGreaterThan(0);
});
```
(In tests `getTexture('bark')` returns `undefined` → `map` is undefined, but `vertexColors` stays true; the assertion holds regardless of texture presence.)

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/world/__tests__/exteriorForest.test.ts src/world/__tests__/zoneBuilder.test.ts`
Expected: FAIL — grass has no `uv` attribute.

- [ ] **Step 3: Implement.** Add grass UVs; set `map` in `stampForest`.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/world/__tests__/exteriorForest.test.ts src/world/__tests__/zoneBuilder.test.ts` → PASS. Run `npm run typecheck` → clean.

- [ ] **Step 5: Ratify (combined brightness) + commit.** Shoot the trees; verify the bark map × vertex tint sits in the readable band (Task 3's rebalance may need a small texture-brightness note if the multiply reads too dark — the map is already palette-darkened, so re-check here, NOT re-tune blindly):
```bash
node scripts/shoot.mjs ashen-forest-n realism-forest-trees 1
```
Expected: trunks read as crunched bark; cones as matted dark foliage (bark map × NEEDLE tint); silhouette-against-fog unchanged at range. Then:
```bash
git add src/world/exteriorForest.ts src/world/ZoneBuilder.ts src/world/__tests__/exteriorForest.test.ts src/world/__tests__/zoneBuilder.test.ts docs/shots/realism-forest-trees.png
git commit -m "feat(tex): tree bark/canopy map with vertex-colour multiply tint + grass UVs"
```

---

### Task 8: Entity skins — Hound + Kneeler (photo-crunch, faceless preserved)

**Files:**
- Modify: `src/entities/AshHound.ts:242-248` (`houndMat`: set the hide `map`, keep `HOUND_TINT` as multiply)
- Modify: `src/entities/KneelingHollow.ts:224-228` (mat: set the cloth `map`, keep `KNEELER_TINT`)
- Test: extend `src/entities/__tests__/palette.test.ts` (a "no map when texture absent, tint preserved" assertion) — the map itself is browser-verified

**Interfaces:**
- Consumes: `getTexture('hound-hide')`/`getTexture('kneeler-cloth')` (Task 5); `HOUND_TINT`/`KNEELER_TINT` (Task 3).
- Produces: no new exports. Box geometries (`BoxGeometry`) carry UVs by default → the affine map path works with no geometry change. Faceless preserved — the head box samples the SAME skin (no face texture; committed wrongness unchanged). Watcher/Hag untouched (stay `0x000000`, no map).

`houndMat` (`AshHound.ts`) — set the hide map before `patchMaterial`, color stays the tint (tint × map):
```ts
function houndMat(sink: MeshStandardMaterial[]): MeshStandardMaterial {
  const map = getTexture('hound-hide');
  const mat = new MeshStandardMaterial({ color: HOUND_TINT, map, roughness: 1, metalness: 0 });
  mat.emissive = new Color(0x000000);
  patchMaterial(mat); // affine applies when map present; tint multiplies the crunched hide
  sink.push(mat);
  return mat;
}
```
(add `import { getTexture } from '../world/textures';`.)

`KneelerView` mat (`KneelingHollow.ts`):
```ts
    const map = getTexture('kneeler-cloth');
    this.mat = new MeshStandardMaterial({ color: KNEELER_TINT, map, roughness: 1, metalness: 0 });
    this.mat.emissive = new Color(0x000000);
    patchMaterial(this.mat);
```
(add `import { getTexture } from '../world/textures';`.)

- [ ] **Step 1: Write the regression test.** The skin adds a `map` but must NOT change the tint (the multiply base) — assert the invariants in `palette.test.ts` (the map itself is `undefined` headless, so it is browser-verified in Step 5). Add:
```ts
it('the entity skins keep their tint as the multiply base (Hound/Kneeler unchanged)', () => {
  expect(HOUND_TINT).toBe(0x2a2521);
  expect(KNEELER_TINT).toBe(0x232026);
});
```

- [ ] **Step 2: Run test to verify it passes as a regression.**

Run: `npx vitest run src/entities/__tests__/palette.test.ts src/entities`
Expected: PASS (the tint invariants hold; entity-construction tests stay green after the `map` addition). This is a regression guard — the visual skin is verified in Step 5.

- [ ] **Step 3: Implement.** Add the two `getTexture` maps.

- [ ] **Step 4: Run the entity suite.**

Run: `npx vitest run src/entities` → all green. Run `npm run typecheck` → clean.

- [ ] **Step 5: Ratify + commit.** Shoot the entities in-zone:
```bash
node scripts/shoot.mjs ashen-forest-n realism-hound-skin 0
node scripts/shoot.mjs cinder-village realism-kneeler-skin 0
```
Expected: the Hound reads as ash-crusted hide/bone (crunched photo, JPEG artifacts visible, faceless); the Kneeler as rotted robe; the tall-entity silhouette is unchanged. Then:
```bash
git add src/entities/AshHound.ts src/entities/KneelingHollow.ts src/entities/__tests__/palette.test.ts docs/shots/realism-hound-skin.png docs/shots/realism-kneeler-skin.png
git commit -m "feat(tex): ash-hound + kneeling hollow photo-crunch skins (faceless preserved)"
```

---

### Task 9: Props — gibbet cage, Cinder house differentiation, banner readability, hall-statue overlap

**Files:**
- Create: `src/world/exteriorProps.ts` (`gibbetGeometry`, `roofWedgeGeometry`)
- Modify: `src/world/ZoneBuilder.ts` (procedural-prop hook for `gibbet`; `A` grid char → `wall-arch` door-void ruin block; auto roof-wedge `InstancedMesh` over `H`/`A` house cells; larger exterior banner scale)
- Modify: `src/content/zones/gateFields.ts:58` (`pillar` [7,8] → `gibbet`)
- Modify: `src/content/zones/cinderVillage.ts` (swap 4 `H`→`A` for door voids)
- Modify: `src/content/zones/pilgrimsDescent.ts` (banner readability handled by the exterior banner-scale change; no data change needed beyond confirming the [7,10] placement)
- Modify: `src/content/zones/greatHall.ts:37` (statue-knight [2,13] → [1,13], overlap fix)
- Test: `src/world/__tests__/exteriorProps.test.ts`, extend `src/world/__tests__/zoneBuilder.test.ts`, extend `src/content/__tests__/zones.test.ts`

**Interfaces:**
- Produces: `gibbetGeometry()`, `roofWedgeGeometry()` (low-poly, base-at-y0, vertex-coloured `BufferGeometry`); the `A` cell kind (`wall-arch` ruin block); an auto `roof-wedge` `InstancedMesh` over house cells.
- Consumes: `patchMaterial`, `mergeGeometries`, existing `stampForest`-style instancing.

`src/world/exteriorProps.ts` (full — mirrors `exteriorForest.ts` conventions):
```ts
/**
 * Realism pass (Task 9/10): original CC0 procedural prop geometry — a hanging
 * gibbet cage (folk-horror motif), a burnt roof wedge (Cinder houses), and
 * ground clutter (Task 10). Low-poly, base at y=0, vertex-coloured for the
 * flat-shaded PS1 look. Pure three.js construction (no WebGL — vitest-safe).
 * Declared CC0 in assets/LICENSES.md → "Procedural geometry".
 */
import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const IRON = 0x2a2724;  // rusted dark iron
const BONE = 0x6b6252;  // the occupant bundle
const ROOF = 0x2e2622;  // charred timber

function paint(geo: BufferGeometry, hex: number): BufferGeometry {
  const r = ((hex >> 16) & 0xff) / 255, g = ((hex >> 8) & 0xff) / 255, b = (hex & 0xff) / 255;
  const n = geo.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b; }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}
function merge(parts: BufferGeometry[]): BufferGeometry {
  const m = mergeGeometries(parts, false);
  if (!m) throw new Error('exteriorProps: mergeGeometries returned null');
  for (const p of parts) p.dispose();
  m.computeVertexNormals();
  return m;
}
function bar(w: number, h: number, d: number, y: number, x: number, z: number, hex: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, hex);
}

/** A rusted iron cage hung high (rusted open — lore card), with a bone bundle
 *  inside. ~1.0 m cage, hung so its top bar sits ~2.6 m up. */
export function gibbetGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const yTop = 2.6, cage = 1.0, half = 0.28;
  parts.push(bar(0.06, 0.4, 0.06, yTop + 0.2, 0, 0, IRON));           // hanger stem
  parts.push(bar(0.7, 0.06, 0.7, yTop, 0, 0, IRON));                  // top ring
  parts.push(bar(0.7, 0.06, 0.7, yTop - cage, 0, 0, IRON));           // bottom ring
  for (const [x, z] of [[half, half], [-half, half], [half, -half], [-half, -half]] as const) {
    parts.push(bar(0.05, cage, 0.05, yTop - cage / 2, x, z, IRON));   // four uprights
  }
  parts.push(bar(0.22, 0.5, 0.22, yTop - cage + 0.35, 0, 0, BONE));   // slumped bone bundle
  return merge(parts);
}

/** A pitched, charred roof wedge capping an H/A house cell (~2 m footprint). */
export function roofWedgeGeometry(): BufferGeometry {
  const g = new ConeGeometry(1.5, 1.1, 4, 1, false); // a 4-sided pyramid reads as a pitched roof
  g.rotateY(Math.PI / 4);
  g.translate(0, 2.0 + 0.55, 0); // sits atop the 2 m wall block
  return paint(g, ROOF);
}
```
(`stoneGeometry`/`bonePileGeometry`/`stumpGeometry` are ADDED in Task 10.)

`ZoneBuilder.ts` changes:
1. Add `import { gibbetGeometry, roofWedgeGeometry } from './exteriorProps';` and a procedural-prop registry:
```ts
const PROCEDURAL_PROPS: Record<string, () => BufferGeometry> = { gibbet: gibbetGeometry };
```
2. In the props loop (~line 530), branch procedural kinds to a standalone vertex-coloured mesh instead of `addPiece`:
```ts
    for (const prop of def.props) {
      const [row, col] = prop.at;
      const px = col * cell + half, pz = row * cell + half, py = cellHeightM(row, col);
      const make = PROCEDURAL_PROPS[prop.kind];
      if (make) {
        const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
        patchMaterial(material);
        const mesh = new Mesh(make(), material);
        mesh.position.set(px, py, pz);
        mesh.rotation.y = prop.rotY ?? 0;
        mesh.name = `prop:${prop.kind}`;
        group.add(mesh);
        continue;
      }
      addPiece(prop.kind, px, py, pz, prop.rotY ?? 0, 1);
    }
```
3. Handle the `A` door-void house cell in `cellKind` (treat as a wall for collision) and in the exterior scan (render `wall-arch` instead of `wall`). In `cellKind`, add `case 'A': return 'wall';` (before the `def.tiles` lookup — but `A` also needs a floor tile under the arch). In the exterior branch, add an `else if (ch === 'A')` beside `'H'`:
```ts
          } else if (ch === 'A') {
            floorTile();
            houseCells.push([row, col]);
            // door-void ruin block: wall-arch instead of solid wall (same atlas → same bucket).
            // `x`/`z`/`y` are the cell-centre world coords already in scope in this exterior scan.
            const d = ORTHO.find(([dr, dc]) => kindAt(def, row + dr, col + dc) !== 'wall');
            const fl = half - (WALL_THICKNESS_M * KIT_SCALE) / 2;
            if (d) addPiece('wall-arch', x + d[1] * fl, y, z + d[0] * fl, Math.atan2(d[1], d[0]), KIT_SCALE);
            else addPiece('wall-arch', x, y, z, 0, KIT_SCALE);
          }
```
Also push `H` cells into `houseCells` in the existing `'H'` branch: add `houseCells.push([row, col]);` after its `addExteriorWall(...)` call. Add `'A': return 'wall';` to `cellKind`'s switch so collision treats it as solid (matching `H`, whose ruin block is a wall).
4. Declare `const houseCells: GridPos[] = [];` beside `grass/sparse/dense`. After the ground mesh, stamp roof wedges (1 draw call) over house cells:
```ts
      if (houseCells.length > 0) {
        const spots: ForestSpot[] = houseCells.map(([r, c]) => ({
          x: c * cell + half, y: cellHeightM(r, c), z: r * cell + half, row: r, col: c,
        }));
        stampForest(group, 'roof-wedge', roofWedgeGeometry(), spots);
      }
```
5. Larger exterior banner (readability, spec §5 Pilgrim's) — add a const and use it for exterior banners:
```ts
const BANNER_EXT_SCALE = 0.65; // exterior checkpoint banners render larger so the kneel-point is findable
```
In the banner block (~line 564), pick the scale by kind:
```ts
      const bScale = def.kind === 'exterior' ? BANNER_EXT_SCALE : KIT_SCALE;
      const setback = half - BANNER_BACK_M * bScale;
      addPiece('banner', cx + dc * setback, cellHeightM(row, col), cz + dr * setback, Math.atan2(dc, dr), bScale);
```

Zone data:
- `gateFields.ts`: `{ kind: 'pillar', at: [7, 8], rotY: 0.2 }` → `{ kind: 'gibbet', at: [7, 8], rotY: 0.2 }`.
- `cinderVillage.ts`: change four `H` house-block chars to `A` in the grid (concrete: the four house blocks flanking the plaza banner — pick cells that are currently `H` and border the street, e.g. rows 1 & 7 nearest the spine; verify each chosen cell is `H` in the current grid before editing, keep row lengths identical).
- `greatHall.ts`: `{ kind: 'statue-knight', at: [2, 13], rotY: Math.PI }` → `{ kind: 'statue-knight', at: [1, 13], rotY: Math.PI }` (back to the north wall, clear of the inner-chamber NE wall block at [3,11-14]).

- [ ] **Step 1: Write the failing tests.**

`src/world/__tests__/exteriorProps.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { gibbetGeometry, roofWedgeGeometry } from '../exteriorProps';
import type { BufferGeometry } from 'three';

function tris(g: BufferGeometry): number {
  const p = g.getAttribute('position');
  return (g.index ? g.index.count : p.count) / 3;
}
function minY(g: BufferGeometry): number {
  const p = g.getAttribute('position');
  let m = Infinity;
  for (let i = 0; i < p.count; i++) m = Math.min(m, p.getY(i));
  return m;
}

describe('exterior props', () => {
  for (const [name, build, cap] of [['gibbet', gibbetGeometry, 120], ['roof-wedge', roofWedgeGeometry, 24]] as const) {
    it(`${name}: low-poly, vertex-coloured, grounded base`, () => {
      const g = build();
      expect(g.getAttribute('color')).toBeDefined();
      expect(tris(g)).toBeGreaterThan(0);
      expect(tris(g)).toBeLessThanOrEqual(cap);
      expect(minY(g)).toBeGreaterThanOrEqual(-0.001);
      g.dispose();
    });
  }
});
```
Extend `zoneBuilder.test.ts`:
```ts
it('a gibbet prop builds as a standalone procedural mesh, not a kit piece', () => {
  const built = new ZoneBuilder().build(
    exteriorZone(['..', '..'], { props: [{ kind: 'gibbet', at: [0, 0] }] }), fakeAssets());
  let found = false;
  built.group.traverse((o) => { if ((o as Mesh).name === 'prop:gibbet') found = true; });
  expect(found).toBe(true);
});
it('H/A house cells get a roof-wedge instanced cap (1 draw call)', () => {
  const built = new ZoneBuilder().build(exteriorZone(['H.', 'A.']), fakeAssets());
  expect(instancedNames(built.group)).toContain('roof-wedge');
});
```
Extend `zones.test.ts`:
```ts
it('the great-hall statue no longer overlaps the inner-chamber wall', () => {
  const s = GREAT_HALL.props.find((p) => p.kind === 'statue-knight');
  expect(s?.at).toEqual([1, 13]); // moved off [2,13] (over the [3,13] wall block)
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/world/__tests__/exteriorProps.test.ts src/world/__tests__/zoneBuilder.test.ts src/content/__tests__/zones.test.ts`
Expected: FAIL — `exteriorProps` missing; no `prop:gibbet`/`roof-wedge`; statue still at [2,13].

- [ ] **Step 3: Implement.** Create `exteriorProps.ts`; add the procedural-prop hook, `A` handling, `houseCells` + roof-wedge stamp, and `BANNER_EXT_SCALE` to `ZoneBuilder.ts`; edit the four zone data files. Ensure the Cinder `A` swaps keep every grid row the SAME length (structural test enforces this).

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/world/__tests__/exteriorProps.test.ts src/world/__tests__/zoneBuilder.test.ts src/content/__tests__/zones.test.ts` → PASS. Run `npm run typecheck` → clean. Run `npx vitest run` → whole suite green (the Cinder grid edit must not break the bijection/structural suites).

- [ ] **Step 5: Ratify + commit.** Shoot the props:
```bash
node scripts/shoot.mjs gate-fields realism-gibbet 1
node scripts/shoot.mjs cinder-village realism-cinder-houses 1
node scripts/shoot.mjs pilgrims-descent realism-banner 1
```
Expected: the gibbet hangs empty under the oak; Cinder houses read as burnt homes (roofline + door voids), not castle wall; the Pilgrim's banner is findable. Owner also eyeballs the Great Hall statue in-game. Then:
```bash
git add src/world/exteriorProps.ts src/world/ZoneBuilder.ts src/content/zones/gateFields.ts src/content/zones/cinderVillage.ts src/content/zones/greatHall.ts src/world/__tests__/exteriorProps.test.ts src/world/__tests__/zoneBuilder.test.ts src/content/__tests__/zones.test.ts docs/shots/realism-gibbet.png docs/shots/realism-cinder-houses.png docs/shots/realism-banner.png
git commit -m "feat(props): gibbet cage, cinder house rooflines/door-voids, banner scale, hall-statue fix"
```

---

## Curves pass (spec §11) — C1–C4, owner-approved: these four tasks run AFTER Task 9 and BEFORE Task 10

Owner verdict on the lit build: geometry is the remaining "Minecraft" tell — box rigs and perfect cones read voxel-game, not PS1. Real PS1 characters were low-poly but ORGANIC (tapered limbs, bent trunks, lumpy ground). All randomness is **seeded (mulberry32, the audio knock-jitter precedent) — never `Math.random`** — so every build is byte-reproducible and testable. Every hand-authored geometry carries orientation/UV assertions + tri accounting (the phase policy).

### Task C1: Organic entities — curved rigs, same joints, same numbers

**Files:**
- Create: `src/world/noise.ts` (seeded `mulberry32`/`seededAt`/`displaceRadial` — C2 extends it with `undulation`)
- Create: `src/entities/organic.ts` (`taperedCapsule`/`centredCapsule`/`bentLimb`/`blobHead`/`latheShape`)
- Modify: `src/entities/AshHound.ts:284-328` (`HoundView` constructor geometry ONLY — `update()` at 330-394 untouched)
- Modify: `src/entities/KneelingHollow.ts:196-288` (`segment()` helper + `KneelerView` constructor ONLY — `update()` at 290-378 untouched)
- Modify: `src/entities/WatcherPresence.ts:196-224` (`buildWatcher` — now exported for the test)
- Modify: `src/entities/HagPresence.ts:122-163` (`buildHag` — now exported for the test)
- Modify: `src/entities/CrossingSilhouette.ts:41-93` (`leg()` helper + constructor ONLY — `arm()`/`update()` untouched)
- Test: `src/world/__tests__/noise.test.ts`, `src/entities/__tests__/organic.test.ts`

**Interfaces:**
- Produces: `noise.ts` + `organic.ts` exports (exact signatures in the Core shared interfaces block); `buildWatcher`/`buildHag` now exported. C3/C4 consume `displaceRadial`/`seededAt`; C2 extends `noise.ts`.
- Consumes: the LIVE view classes. **Load-bearing joint/group audit (verified against the code — these names/pivots are what `update()` animates and MUST survive byte-identical):**
  - `HoundView`: `body` (Group — death topple rot z / lean rot x / pos y), `torso` (**Mesh** — `position.y = HOUND_TORSO_Y + bob`), `neck` (Group at `(0, HOUND_TORSO_Y+0.22, 1.25)`, `rotation.x = 0.9`, update sets `rotation.y`), `hips[0..3]` (Groups at `(±0.2, HOUND_HIP_Y, ±1.05)`, update sets `rotation.x`). Back-solve preserved: ridge-top = `HOUND_LEG_LEN + HOUND_BACK_RISE = H.heightM` (2.3).
  - `KneelerView`: `frame` (death), `hipG` (`position.y` kneel-lerp), `spine` (`rotation.x`), `neck` (`rotation.x/.z`), `torso` (**Mesh** — breath `scale`), `thighL/R`, `kneeL/R`, `shoulderL/R` (all `segment()` pivot Groups, update sets `rotation.x`). `segment()`'s contract: geometry hangs DOWN from the group origin.
  - `WatcherView`: static `figure` from `buildWatcher` — feet-at-0 rising to EXACTLY `W.heightM` (3.0; `update()` positions root at `wp.y − heightM*0.5`).
  - `HagView`: `buildHag` returns `{ root, hunch }`; `hunch` Group pivot `(0, 1.08, 0)`, base `rotation.x = 0.95` (update sways `hunch.rotation.x`).
  - `CrossingSilhouette`: `legL`/`legR` pivot Groups (update sets `rotation.x`); `figure.rotation.x = 0.12` lean.
  - Materials are UNTOUCHED: `houndMat` (HOUND_TINT × hound-hide map), `KneelerView.mat` (KNEELER_TINT × kneeler-cloth), `darkMat` (pure black 0x000000) — so the T8 luma band (hound body mean ~9, lit faces ~38 vs terrain ~13 vs Watcher ~0; `.superpowers/sdd/realism-task-8-report.md`) and the 12 fps `steppedTime` sampling are inherited, not re-implemented. Lathe/cylinder/sphere geometry all generate UVs natively, so the hide/cloth maps bind unchanged.

`src/world/noise.ts` (full):

```ts
/**
 * Curves pass (C1/C2, spec §11): seeded, position-stable noise. ALL curve and
 * terrain randomness routes through here — mulberry32-seeded (the audio
 * knock-jitter precedent, AudioManager.ts:116), NEVER Math.random — so builds
 * are byte-reproducible and unit-testable. Pure math, no three.js render state.
 */
import type { BufferGeometry } from 'three';

/** The game's tiny seeded PRNG — same implementation as main.ts:201. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic [0,1) at an integer lattice point, per seed. */
export function seededAt(ix: number, iy: number, iz: number, seed: number): number {
  const h =
    (Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(iz | 0, 1274126177) ^ (seed | 0)) >>> 0;
  return mulberry32(h)();
}

/**
 * Seeded radial vertex displacement (±ampM along the vertex's direction from
 * the local origin). Keyed on the QUANTIZED POSITION (mm), not the vertex
 * index, so duplicated verts (non-indexed geometry, sphere seams) displace
 * identically — the surface stays watertight. Recomputes normals.
 */
export function displaceRadial(geo: BufferGeometry, ampM: number, seed: number): BufferGeometry {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, y, z);
    if (len < 1e-6) continue; // a vertex at the origin has no radial direction
    const n = seededAt(Math.round(x * 1000), Math.round(y * 1000), Math.round(z * 1000), seed) * 2 - 1;
    const k = 1 + (n * ampM) / len;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
```

`src/entities/organic.ts` (full):

```ts
/**
 * Curves pass (C1, spec §11): the shared organic geometry vocabulary for the
 * entity views — tapered lathe capsules, bent limbs, crunched blob heads.
 * Real PS1 characters were low-poly but ORGANIC; these replace the box
 * vocabulary so silhouettes read tapered/attenuated, never Minecraft — and
 * MORE unsettling, not cuddly: every shape is narrower than its box (underfed)
 * and bowed (wrong). All shapes generate UVs natively (lathe/cylinder/sphere),
 * so the hound-hide / kneeler-cloth detail maps bind unchanged. Deterministic
 * (blob displacement is seeded). Pure three.js construction — vitest-safe.
 */
import { BufferGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, Vector2 } from 'three';
import { displaceRadial } from '../world/noise';

/** Radial resolution — deliberately low; a heptagon column reads round at 320×240. */
const RADIAL = 7;

/**
 * A vertically-tapered capsule authored base-at-y0 → top at `len` (rounded
 * caps, straight tapered flank). rBottom ≠ rTop = attenuation.
 */
export function taperedCapsule(rBottom: number, rTop: number, len: number, radial = RADIAL): BufferGeometry {
  const pts: Vector2[] = [];
  const CAP = 3;
  for (let i = 0; i <= CAP; i++) {
    const a = (i / CAP) * (Math.PI / 2); // bottom pole → equator
    pts.push(new Vector2(Math.sin(a) * rBottom, rBottom - Math.cos(a) * rBottom));
  }
  for (let i = 1; i <= CAP; i++) {
    const a = (i / CAP) * (Math.PI / 2); // top equator → pole
    pts.push(new Vector2(Math.cos(a) * rTop, len - rTop + Math.sin(a) * rTop));
  }
  return new LatheGeometry(pts, radial);
}

/** `taperedCapsule` re-authored CENTRED on the origin — a drop-in where a
 *  centred BoxGeometry stood (same position math in the constructors). */
export function centredCapsule(rBottom: number, rTop: number, len: number, radial = RADIAL): BufferGeometry {
  return taperedCapsule(rBottom, rTop, len, radial).translate(0, -len / 2, 0);
}

/**
 * A limb hanging DOWN from its pivot origin (the `segment()` convention):
 * a tapered open cylinder bowed by `bowM` at mid-length (both ends fixed),
 * so legs/arms read bent, never straight prisms.
 */
export function bentLimb(len: number, rTop: number, rBottom: number, bowM: number, radial = 6, segs = 3): BufferGeometry {
  const g = new CylinderGeometry(rTop, rBottom, len, radial, segs, true);
  g.translate(0, -len / 2, 0); // pivot (top) at y=0, extremity at −len
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = -pos.getY(i) / len; // 0 at the pivot → 1 at the extremity
    pos.setZ(i, pos.getZ(i) + Math.sin(Math.PI * t) * bowM);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** A crunched, faceless blob head: a low-poly sphere, seeded radial
 *  displacement ~18% of r — a lumpy skull-shape, never a readable face. */
export function blobHead(r: number, seed: number): BufferGeometry {
  return displaceRadial(new SphereGeometry(r, 7, 5), r * 0.18, seed);
}

/** A lathe from an `[radius, y]` profile (robes, shrouds, columns). */
export function latheShape(profile: readonly (readonly [number, number])[], radial = 8): BufferGeometry {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), radial);
}
```

**Rebuilds — each block REPLACES only the geometry construction; every group name, pivot position, and material call is byte-identical to the live code.**

`AshHound.ts` `HoundView` constructor (replace lines 284-328; add `import { bentLimb, blobHead, centredCapsule, taperedCapsule } from './organic';`; the `box()` helper at 260-262 becomes dead — delete it):

```ts
  constructor(private readonly hound: AshHound) {
    this.root = new Group();
    this.root.name = `hound:${hound.id}`;
    this.root.add(this.body);

    // Elongated, underfed torso — a narrow tapered capsule lying along z
    // (haunch thicker than the chest), centred like the box it replaces.
    // Radius 0.23 = the old box's half-height, so HOUND_TORSO_Y stacking and
    // the heightM back-solve are unchanged.
    this.torso = new Mesh(centredCapsule(0.23, 0.17, 2.6).rotateX(Math.PI / 2), houndMat(this.mats));
    this.torso.position.set(0, HOUND_TORSO_Y, 0);
    this.body.add(this.torso);
    // The gaunt ridge — a thin spindle along the spine; its thick end tops out
    // at +0.11 (the old box half-height): ridge-top = heightM back-solve HELD.
    const ridge = new Mesh(centredCapsule(0.11, 0.08, 1.9).rotateX(Math.PI / 2), houndMat(this.mats));
    ridge.position.set(0, HOUND_TORSO_Y + 0.3, -0.1);
    this.body.add(ridge);

    // Four over-long BENT thin legs (bowed at the wrong place — mid-shaft).
    // bentLimb hangs from the pivot origin, so no half-length offset mesh.
    const legX = 0.2;
    const legZ = 1.05;
    for (const [sx, sz] of [
      [legX, legZ],
      [-legX, legZ],
      [legX, -legZ],
      [-legX, -legZ],
    ] as const) {
      const hip = new Group();
      hip.position.set(sx, HOUND_HIP_Y, sz);
      hip.add(new Mesh(bentLimb(HOUND_LEG_LEN, 0.075, 0.045, 0.09), houndMat(this.mats)));
      this.body.add(hip);
      this.hips.push(hip);
    }

    // The long drooping neck — a tapered spindle authored 0..1.15 along +z
    // from the pivot (the old box spanned −0.08..1.08); same pivot, same pitch.
    this.neck.position.set(0, HOUND_TORSO_Y + 0.22, 1.25);
    this.neck.rotation.x = 0.9;
    this.neck.add(new Mesh(taperedCapsule(0.13, 0.09, 1.15).rotateX(Math.PI / 2), houndMat(this.mats)));
    const head = new Mesh(blobHead(0.19, 0xa5b), houndMat(this.mats));
    head.position.set(0, -0.14, 1.05);
    this.neck.add(head);
    this.body.add(this.neck);
  }
```

`KneelingHollow.ts` — replace the `box()`/`segment()` helpers (lines 196-207) and the `KneelerView` constructor geometry (244-287); add `import { bentLimb, blobHead, centredCapsule, taperedCapsule } from './organic';`:

```ts
/** A pivot Group with a BENT tapered limb hanging DOWN from its joint —
 *  the same contract the box version had (geometry below the origin). */
function segment(len: number, w: number, mat: Material): Group {
  const g = new Group();
  g.add(new Mesh(bentLimb(len, w * 0.55, w * 0.35, len * 0.07), mat));
  return g;
}
```

Constructor body replacements (pelvis/torso/neck/head only — the spine/shoulder/thigh wiring and every `position.set` stays as-is):

```ts
    // Pelvis + spine stack.
    const pelvis = new Mesh(centredCapsule(0.11, 0.11, 0.3).rotateZ(Math.PI / 2), m);
    pelvis.position.set(0, 0, 0);
    this.hipG.add(pelvis);
    this.spine.position.set(0, 0.08, 0);
    this.hipG.add(this.spine);

    // Underfed torso: hips 0.19 tapering to 0.13 at the shoulders. Centred,
    // full height = K_TORSO_H — the old box's exact vertical footprint, so the
    // breath-scale and every stacked offset are unchanged.
    this.torso = new Mesh(centredCapsule(0.19, 0.13, K_TORSO_H), m);
    this.torso.position.set(0, K_TORSO_H / 2, 0);
    this.spine.add(this.torso);

    // Long thin neck (authored 0..0.34 up from the pivot) + crunched blob head.
    this.neck.position.set(0, K_TORSO_H, 0);
    this.spine.add(this.neck);
    this.neck.add(new Mesh(taperedCapsule(0.07, 0.055, 0.34), m));
    const head = new Mesh(blobHead(0.16, 0x17e), m);
    head.position.set(0, 0.34 + 0.12, 0.03);
    this.neck.add(head);
```

(The arms/legs blocks — `segment(K_ARM_LEN, 0.12, m)`, `segment(K_THIGH, 0.15, m)`, `segment(K_SHIN, 0.14, m)` and their `position.set`/`add` wiring — are call-compatible and stay byte-identical; the rewritten `segment()` gives them bent limbs for free.)

`WatcherPresence.ts` — replace `buildWatcher` (lines 200-224; EXPORT it for the test; delete the dead `box()` helper; add `import { blobHead, latheShape } from './organic';`):

```ts
/** Build the ~3.0 m column-humanoid. y=0 is the ground; it rises to heightM.
 *  One continuous shrouded lathe column — curves, but STILL a clean vertical
 *  (never the Hag's stoop): a narrow hem, an attenuated waist, a barely-wider
 *  shoulder, a thin neck, a crunched blob head capping it at exactly heightM. */
export function buildWatcher(mats: MeshStandardMaterial[]): Group {
  const g = new Group();
  const H = W.heightM; // 3.0
  const column = new Mesh(
    latheShape([
      [0.2, 0], [0.24, H * 0.06], [0.15, H * 0.42], [0.19, H * 0.62],
      [0.21, H * 0.8], [0.12, H * 0.86], [0.055, H * 0.9], [0.05, H * 0.94],
    ]),
    darkMat(mats),
  );
  g.add(column);
  const headR = 0.11;
  const head = new Mesh(blobHead(headR, 0x3aa), darkMat(mats));
  head.position.set(0, H - headR, 0); // head top = H exactly (±18% blob crunch)
  g.add(head);
  return g;
}
```

`HagPresence.ts` — replace `buildHag` (lines 126-163; EXPORT it; delete the dead `box()` helper; add `import { blobHead, centredCapsule, latheShape } from './organic';` and `CylinderGeometry` to the three import):

```ts
/** Build the stooped crone. y=0 is the ground. Exported for the C1 tests. */
export function buildHag(mats: MeshStandardMaterial[]): { root: Group; hunch: Group } {
  const root = new Group();
  // The A-line robe as ONE lathe — a wide hem sweeping to a narrow waist
  // (a woman's skirted silhouette, unmistakably not the Watcher's column).
  const robe = new Mesh(
    latheShape([[0.5, 0], [0.44, 0.35], [0.3, 0.72], [0.24, 0.95], [0.26, 1.12]]),
    darkMat(mats),
  );
  root.add(robe);

  // The hunch: SAME pivot, SAME base pitch — HagView sways this group.
  const hunch = new Group();
  hunch.position.set(0, 1.08, 0);
  hunch.rotation.x = 0.95;
  root.add(hunch);

  // The humped upper back — a bent-read capsule, thick at the shoulders.
  const backT = new Mesh(centredCapsule(0.24, 0.18, 0.72), darkMat(mats));
  backT.position.set(0, 0.36, 0);
  hunch.add(backT);
  // The shawl bulk — a squashed seeded blob, the top of the hump.
  const shawl = new Mesh(blobHead(0.3, 0x9c1).scale(1.15, 0.55, 0.9), darkMat(mats));
  shawl.position.set(0, 0.64, 0.02);
  hunch.add(shawl);
  // Bowed, hooded head — low and pushed forward past the shoulders.
  const head = new Mesh(blobHead(0.17, 0x44d), darkMat(mats));
  head.position.set(0, 0.82, 0.16);
  hunch.add(head);

  // The long staff — a thin ROUNDED rod planted at her side.
  const staff = new Mesh(new CylinderGeometry(0.025, 0.035, 1.7, 6, 1), darkMat(mats));
  staff.position.set(0.46, 0.85, 0.16);
  staff.rotation.x = 0.12;
  root.add(staff);

  return { root, hunch };
}
```

`CrossingSilhouette.ts` — replace `leg()` (lines 46-52) and the constructor figure blocks (71-90); add `import { bentLimb, blobHead, centredCapsule, taperedCapsule } from './organic';`; delete the dead `box()` helper:

```ts
/** A pivot Group with a BENT thin leg hanging DOWN from its joint. */
function leg(len: number, mat: Material): Group {
  const g = new Group();
  g.add(new Mesh(bentLimb(len, 0.09, 0.055, len * 0.06), mat));
  return g;
}
```

```ts
    const legLen = FIG_H * 0.5;
    // Two over-long bent thin legs on a hip line (the stride sells "moving").
    this.legL = leg(legLen, darkMat(this.mats));
    this.legL.position.set(0.13, legLen, 0);
    this.legR = leg(legLen, darkMat(this.mats));
    this.legR.position.set(-0.13, legLen, 0);
    this.figure.add(this.legL, this.legR);
    // A narrow tapered torso, a thin neck spindle, a small crunched blob head.
    const torsoH = FIG_H * 0.3;
    const torso = new Mesh(centredCapsule(0.19, 0.13, torsoH), darkMat(this.mats));
    torso.position.set(0, legLen + torsoH / 2, 0);
    this.figure.add(torso);
    const neck = new Mesh(taperedCapsule(0.065, 0.05, FIG_H * 0.1), darkMat(this.mats));
    neck.position.set(0, legLen + torsoH, 0);
    this.figure.add(neck);
    const head = new Mesh(blobHead(0.12, 0x77c), darkMat(this.mats));
    head.position.set(0, legLen + torsoH + FIG_H * 0.13, 0.02);
    this.figure.add(head);
    this.figure.rotation.x = 0.12; // a slight forward lean along the travel
```

- [ ] **Step 1: Write the failing tests.**

`src/world/__tests__/noise.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SphereGeometry } from 'three';
import { displaceRadial, mulberry32, seededAt } from '../noise';

describe('seeded noise (C1)', () => {
  it('mulberry32 matches the game PRNG contract: deterministic, [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('seededAt is position-stable and seed-sensitive', () => {
    expect(seededAt(3, 0, 7, 1)).toBe(seededAt(3, 0, 7, 1));
    expect(seededAt(3, 0, 7, 1)).not.toBe(seededAt(3, 0, 7, 2));
  });
  it('displaceRadial keeps duplicated verts welded (watertight) and is deterministic', () => {
    const build = (): SphereGeometry => new SphereGeometry(0.3, 7, 5);
    const g1 = build().toNonIndexed();
    const g2 = build().toNonIndexed();
    displaceRadial(g1, 0.06, 9);
    displaceRadial(g2, 0.06, 9);
    const p1 = g1.getAttribute('position'), p2 = g2.getAttribute('position');
    // deterministic: same build + seed → identical arrays
    for (let i = 0; i < p1.count; i++) {
      expect(p1.getX(i)).toBe(p2.getX(i));
      expect(p1.getY(i)).toBe(p2.getY(i));
      expect(p1.getZ(i)).toBe(p2.getZ(i));
    }
    // watertight: verts that shared a position before displacement still do
    const byKey = new Map<string, [number, number, number]>();
    const orig = build().toNonIndexed().getAttribute('position');
    for (let i = 0; i < orig.count; i++) {
      const key = `${orig.getX(i).toFixed(5)},${orig.getY(i).toFixed(5)},${orig.getZ(i).toFixed(5)}`;
      const disp: [number, number, number] = [p1.getX(i), p1.getY(i), p1.getZ(i)];
      const prev = byKey.get(key);
      if (prev) {
        expect(disp[0]).toBeCloseTo(prev[0], 6);
        expect(disp[1]).toBeCloseTo(prev[1], 6);
        expect(disp[2]).toBeCloseTo(prev[2], 6);
      } else byKey.set(key, disp);
    }
  });
});
```

`src/entities/__tests__/organic.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import { EventBus } from '../../engine/events';
import { AshHound, HoundView } from '../AshHound';
import { KneelingHollow, KneelerView } from '../KneelingHollow';
import { buildWatcher } from '../WatcherPresence';
import { buildHag } from '../HagPresence';
import { CrossingSilhouette } from '../CrossingSilhouette';
import { blobHead } from '../organic';

/** Total triangles across every mesh under a root (the tri-accounting helper). */
function viewTris(root: Group): number {
  let tris = 0;
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    }
  });
  return tris;
}

/** Every mesh under the root carries a uv attribute (the map-bind guard). */
function allHaveUV(root: Group): boolean {
  let ok = true;
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && !m.geometry.getAttribute('uv')) ok = false;
  });
  return ok;
}

function houndView(): HoundView {
  return new HoundView(new AshHound({ id: 'h', bus: new EventBus(), rng: () => 0.5, pantCue: () => {} }));
}
function kneelerView(): KneelerView {
  return new KneelerView(new KneelingHollow({ id: 'k', bus: new EventBus(), pulse: () => 0, creakCue: () => {} }));
}

describe('C1 organic entities — tri accounting, UVs, preserved numbers', () => {
  it('hound: curved rig ≤600 tris (and clearly not boxes), every part UV-mapped', () => {
    const v = houndView();
    const t = viewTris(v.root);
    expect(t).toBeGreaterThan(200); // boxes were ~100 — proves the rebuild landed
    expect(t).toBeLessThanOrEqual(600);
    expect(allHaveUV(v.root)).toBe(true); // hound-hide map binds on every part
    v.dispose();
  });
  it('hound: the heightM back-solve is preserved — ridge-top at 2.3 m', () => {
    const v = houndView();
    v.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(v.root);
    expect(Math.abs(box.max.y - 2.3)).toBeLessThanOrEqual(0.06);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.12); // feet at the ground (bow ≤ 0.09 in z only)
    v.dispose();
  });
  it('kneeler: ≤600 tris, UV-mapped, update() still drives the same joints', () => {
    const v = kneelerView();
    const t = viewTris(v.root);
    expect(t).toBeGreaterThan(200);
    expect(t).toBeLessThanOrEqual(600);
    expect(allHaveUV(v.root)).toBe(true); // kneeler-cloth map binds on every part
    expect(() => v.update(16)).not.toThrow(); // the untouched update() animates the new rig
    v.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(v.root);
    expect(box.max.y).toBeGreaterThan(0.9); // kneeling pose, believable envelope
    expect(box.max.y).toBeLessThan(2.0);
    v.dispose();
  });
  it('watcher: still EXACTLY 3.0 m, still a clean column (never the Hag stoop)', () => {
    const mats: MeshStandardMaterial[] = [];
    const g = buildWatcher(mats);
    g.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g);
    expect(Math.abs(box.max.y - 3.0)).toBeLessThanOrEqual(0.06);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.02);
    expect(box.max.x).toBeLessThanOrEqual(0.3); // a column, not a skirt
    expect(viewTris(g)).toBeLessThanOrEqual(300);
    for (const m of mats) expect(m.color.getHex()).toBe(0x000000); // pure black held
  });
  it('hag: stooped woman silhouette — wide lathe hem, hunch pivot preserved', () => {
    const mats: MeshStandardMaterial[] = [];
    const { root, hunch } = buildHag(mats);
    expect(hunch.position.y).toBeCloseTo(1.08);
    expect(hunch.rotation.x).toBeCloseTo(0.95); // HagView's baseHunchX reads this
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    expect(box.max.x).toBeGreaterThanOrEqual(0.45); // the robe hem — NOT a column
    expect(viewTris(root)).toBeLessThanOrEqual(400);
    for (const m of mats) expect(m.color.getHex()).toBe(0x000000);
  });
  it('crossing silhouette: bent legs still animate, ≤400 tris', () => {
    const c = new CrossingSilhouette();
    expect(viewTris(c.root)).toBeLessThanOrEqual(400);
    c.arm({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1000);
    expect(() => c.update(16, { x: 50, y: 0, z: 50 })).not.toThrow();
    c.dispose();
  });
  it('blobHead is deterministic (seeded, never Math.random)', () => {
    const a = blobHead(0.2, 7).getAttribute('position');
    const b = blobHead(0.2, 7).getAttribute('position');
    for (let i = 0; i < a.count; i++) expect(a.getY(i)).toBe(b.getY(i));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/world/__tests__/noise.test.ts src/entities/__tests__/organic.test.ts`
Expected: FAIL — `../noise` and `../organic` do not exist; `buildWatcher`/`buildHag` not exported.

- [ ] **Step 3: Implement.** Create `noise.ts` + `organic.ts`; apply the five view rebuilds exactly as written (constructors/helpers only — every `update()` body untouched; verify with `git diff` that no diff hunk lands inside an `update()` method).

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/world/__tests__/noise.test.ts src/entities/__tests__/organic.test.ts` → PASS.
Run: `npx vitest run src/entities` → ALL green — the FSM suites (`ashHound`/`kneelingHollow`/`watcherPresence`/`hagPresence`/`crossingSilhouette`) and `palette.test.ts` (tint invariants + map-bind + flat fallback) prove animation/FSM/material contracts survived the rebuild.
Run: `npm run typecheck` → clean.

- [ ] **Step 5: Ratify + commit.** Re-shoot the T8 evidence angles (isolated entity, moon-axis vantage — method in `.superpowers/sdd/realism-task-8-report.md`):
```bash
node scripts/shoot.mjs ashen-forest-n realism-c1-hound 0
node scripts/shoot.mjs cinder-village realism-c1-kneeler 0
node scripts/shoot.mjs gate-fields realism-c1-watcher 0
```
Expected: tapered/bowed silhouettes — attenuated, underfed, faceless; the hound's bent too-long legs read WRONGER than the boxes; 12 fps stepping visibly unchanged; hound/kneeler luma still in the T8 band (body darker than terrain, lit faces ~35–40, never Watcher-black). Then:
```bash
git add src/world/noise.ts src/entities/organic.ts src/entities/AshHound.ts src/entities/KneelingHollow.ts src/entities/WatcherPresence.ts src/entities/HagPresence.ts src/entities/CrossingSilhouette.ts src/world/__tests__/noise.test.ts src/entities/__tests__/organic.test.ts docs/shots/realism-c1-hound.png docs/shots/realism-c1-kneeler.png docs/shots/realism-c1-watcher.png
git commit -m "feat(curves): organic entity rigs — tapered capsules, bent limbs, blob heads (joints/FSM untouched)"
```

---

### Task C2: Undulating terrain — seeded ground noise + smoothed risers + shared y-grounding

**Files:**
- Modify: `src/world/noise.ts` (add `UNDULATION_AMP_M` + `undulation`)
- Modify: `src/world/ZoneBuilder.ts` (`buildExteriorGround` 2×2 sub-quads + per-vertex undulation; skirt edges follow the undulation + midpoint subdivision; ALL exterior placements sample the surface; `BuiltZone.groundYAt`)
- Modify: `src/main.ts` (six `cellHeightM` view-y consumers → `groundYAt`)
- Test: extend `src/world/__tests__/noise.test.ts`, extend `src/world/__tests__/zoneBuilder.test.ts`

**Interfaces:**
- Produces: `undulation(worldX, worldZ): number` (|out| ≤ `UNDULATION_AMP_M` = 0.12) — **the ONE surface function**; `BuiltZone.groundYAt(worldX, worldZ): number`.
- Consumes: `seededAt`/`mulberry32` (C1); the live `buildExteriorGround`/`buildTerrainSkirt`/`cellHeightM`.

**Y-grounding decision (spec §11.2 — plan-writer decides): BOTH.** A shared noise function sampled by every view-y consumer AND a small amplitude (0.12 m) as belt-and-braces. `cellHeightM` (per-cell base height) stays; `groundYAt = cellHeightM + undulation` becomes the surface truth. Static placements sample it at build time inside ZoneBuilder; the three dynamic consumers (camera `groundY`, enemy-view `groundY`, Ash-Priest y) sample it at runtime via `built.groundYAt` — the existing `GROUND_EASE_MS` lerp smooths cell-crossings exactly as before. **Collision, `fogCells`, and all 2D grid logic untouched** (`logic.pos.y` stays 0; the collider never sees y).

Add to `noise.ts`:

```ts
// --- C2: terrain undulation ------------------------------------------------
/** Max height offset of the exterior ground undulation, metres. Small enough
 *  that even an unsampled consumer could never visibly float — but every
 *  consumer DOES sample it (belt and braces). */
export const UNDULATION_AMP_M = 0.12;
/** NOT a multiple of the 2 m cell — the swell never reads as per-cell steps. */
const UNDULATION_WAVELENGTH_M = 3.7;
const UNDULATION_SEED = 0x51e7;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Smooth seeded value-noise height offset (m) at a world position — the ONE
 * undulation function: ground verts, skirt edges, placements, and every
 * view-y consumer sample IT, so feet can never drift from the surface.
 */
export function undulation(worldX: number, worldZ: number): number {
  const gx = worldX / UNDULATION_WAVELENGTH_M;
  const gz = worldZ / UNDULATION_WAVELENGTH_M;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const fx = smooth(gx - x0);
  const fz = smooth(gz - z0);
  const v = (ix: number, iz: number): number => seededAt(ix, 0, iz, UNDULATION_SEED) * 2 - 1;
  const a = mix(v(x0, z0), v(x0 + 1, z0), fx);
  const b = mix(v(x0, z0 + 1), v(x0 + 1, z0 + 1), fx);
  return mix(a, b, fz) * UNDULATION_AMP_M;
}
```

`ZoneBuilder.ts` — replace the quad loop in `buildExteriorGround` (keep everything from `const geo = new BufferGeometry();` down unchanged; add `import { undulation } from './noise';` and the `GROUND_SUB` const near `GROUND_TILE_M`):

```ts
/** Ground sub-quads per cell axis: 1 m facets give the undulation edges to
 *  catch the moon under flatShading (2 m corners alone read as flat plates). */
const GROUND_SUB = 2;
```

```ts
  const pos: number[] = [];
  const uv: number[] = [];
  const subM = cell / GROUND_SUB;
  for (const { x, y, z } of spots) {
    const x0 = x - cell / 2;
    const z0 = z - cell / 2;
    for (let sx = 0; sx < GROUND_SUB; sx++) {
      for (let sz = 0; sz < GROUND_SUB; sz++) {
        const ax = x0 + sx * subM;
        const az = z0 + sz * subM;
        const bx = ax + subM;
        const bz = az + subM;
        // +y winding preserved (the Task 6 orientation guard keeps passing);
        // per-VERTEX undulation: shared corners sample the same world position
        // → the same offset → the sheet stays watertight across cells.
        const corners: [number, number][] = [
          [ax, az], [ax, bz], [bx, bz],
          [ax, az], [bx, bz], [bx, az],
        ];
        for (const [cx, cz] of corners) {
          pos.push(cx, y + undulation(cx, cz), cz);
          const [u, v] = planarUV(cx, cz);
          uv.push(u, v);
        }
      }
    }
  }
```

`buildTerrainSkirt` — replace the seam loop (smoothed risers: top/bottom edges follow the undulation; a midpoint splits each seam into two sub-quads, killing the razor-straight step):

```ts
  for (const { a, b } of seams) {
    const [ra, ca] = a;
    const [rb, cb] = b;
    const ylo = Math.min(cellHeightM(ra, ca), cellHeightM(rb, cb));
    const yhi = Math.max(cellHeightM(ra, ca), cellHeightM(rb, cb));
    // Both edges sample the SAME undulation as the ground at the shared world
    // positions (ends + midpoint) — the riser meets the displaced ground
    // watertight on both its lips (ground verts sit at 1 m spacing too).
    const pushQuad = (x0: number, z0: number, x1: number, z1: number): void => {
      const lo0 = ylo + undulation(x0, z0);
      const lo1 = ylo + undulation(x1, z1);
      const hi0 = yhi + undulation(x0, z0);
      const hi1 = yhi + undulation(x1, z1);
      v.push(x0, lo0, z0, x1, lo1, z1, x1, hi1, z1, x0, lo0, z0, x1, hi1, z1, x0, hi0, z0);
    };
    if (cb !== ca) {
      const bx = Math.max(ca, cb) * cell;
      const z0 = ra * cell;
      const zm = z0 + cell / 2;
      pushQuad(bx, z0, bx, zm);
      pushQuad(bx, zm, bx, z0 + cell);
    } else {
      const bz = Math.max(ra, rb) * cell;
      const x0 = ca * cell;
      const xm = x0 + cell / 2;
      pushQuad(x0, bz, xm, bz);
      pushQuad(xm, bz, x0 + cell, bz);
    }
  }
```

`ZoneBuilder.build` — the surface truth + settled placements. Add right after the `cellHeightM` definition:

```ts
    /** Surface height at a world point: cell base + the C2 undulation
     *  (exteriors; interiors stay flat). THE one function placements and
     *  view-y consumers use — exposed on BuiltZone as groundYAt. */
    const groundYAt = (worldX: number, worldZ: number): number => {
      const base = cellHeightM(Math.floor(worldZ / cell), Math.floor(worldX / cell));
      return def.kind === 'exterior' ? base + undulation(worldX, worldZ) : base;
    };
    /** Kit architecture settles slightly INTO the dirt — a block may sink a
     *  few cm on a swell but can never float on one (ruins sit, they don't hover). */
    const KIT_SETTLE_M = 0.05;
```

Then swap the exterior placement heights (each a one-line change; grep anchors given):
1. Forest/instance spots — `const spot = (): ForestSpot => ({ x, y, z, row, col });` → `({ x, y: groundYAt(x, z), z, row, col })` (the `ground` floor-cell spots KEEP base `y` — `buildExteriorGround` adds undulation per-vertex itself).
2. `addExteriorWall(row, col, x, y, z)` call sites (`H`, `A`, unknown-wall) and the exterior `addPiece('wall-door', x, y, …)` — pass `groundYAt(x, z) - KIT_SETTLE_M` instead of `y`.
3. Roof-wedge spots (`houseCells.map`) — `y: cellHeightM(r, c)` → `y: groundYAt(c * cell + half, r * cell + half) - KIT_SETTLE_M` (the SAME settle as the wall below, so roofs stay glued).
4. Props loop — `const py = cellHeightM(row, col);` → `const py = groundYAt(px, pz);` (covers kit props AND the `prop:gibbet` standalone mesh).
5. Torch mount — `const ty = cellHeightM(row, col);` → `const ty = groundYAt(cx, cz);`.
6. Banner — `addPiece('banner', …, cellHeightM(row, col), …)` → `groundYAt(cx + dc * setback, cz + dr * setback)`.

Add `groundYAt(worldX: number, worldZ: number): number;` to the `BuiltZone` interface (after `cellHeightM`) and `groundYAt,` to the `built` literal.

`main.ts` — swap the six view-y consumers (line anchors from the live code; each keeps its `GROUND_EASE_MS` lerp):
1. `main.ts:667` (crossing-silhouette arm height) — `y: built.cellHeightM(r, c),` → `y: built.groundYAt((c + 0.5) * built.cellM, (r + 0.5) * built.cellM),`
2. `main.ts:1348` (Ash-Priest) — `priest.root.position.y = built.cellHeightM(placement.at[0], placement.at[1]);` → `priest.root.position.y = built.groundYAt((placement.at[1] + 0.5) * built.cellM, (placement.at[0] + 0.5) * built.cellM);`
3. `main.ts:1647` (enemy spawn seed) — `enemies.push({ logic, view, groundY: built.cellHeightM(row, col) });` → `enemies.push({ logic, view, groundY: built.groundYAt((col + 0.5) * built.cellM, (row + 0.5) * built.cellM) });`
4. `main.ts:1727` (enterZone camera snap) — `groundY = built.cellHeightM(Math.floor(controller.pos.z / built.cellM), Math.floor(controller.pos.x / built.cellM));` → `groundY = built.groundYAt(controller.pos.x, controller.pos.z);`
5. `main.ts:2329` (per-frame enemy view ease) — `e.groundY += (built.cellHeightM(er, ec) - e.groundY) * Math.min(1, dt / GROUND_EASE_MS);` → `e.groundY += (built.groundYAt(e.logic.pos.x, e.logic.pos.z) - e.groundY) * Math.min(1, dt / GROUND_EASE_MS);`
6. `main.ts:2571` (per-frame camera ease) — `groundY += (built.cellHeightM(gRow, gCol) - groundY) * Math.min(1, dt / GROUND_EASE_MS);` → `groundY += (built.groundYAt(controller.pos.x, controller.pos.z) - groundY) * Math.min(1, dt / GROUND_EASE_MS);`
(Watcher anchors keep their own elevation contract — off-grid backdrop positions have no ground mesh under them; a 0.12 m offset at ≥16 m in fog is invisible. Interiors: `groundYAt` returns flat `cellHeightM` → 0, so every swap is a no-op indoors.)

- [ ] **Step 1: Write the failing tests.**

Extend `noise.test.ts`:
```ts
import { UNDULATION_AMP_M, undulation } from '../noise';

describe('terrain undulation (C2)', () => {
  it('is deterministic, bounded by the amplitude, and non-flat', () => {
    expect(undulation(3.2, 7.7)).toBe(undulation(3.2, 7.7));
    let spread = 0;
    for (let i = 0; i < 200; i++) {
      const u = undulation(i * 1.31, i * 2.17);
      expect(Math.abs(u)).toBeLessThanOrEqual(UNDULATION_AMP_M + 1e-9);
      spread = Math.max(spread, Math.abs(u));
    }
    expect(spread).toBeGreaterThan(UNDULATION_AMP_M * 0.3); // it actually varies
  });
  it('is smooth at view-y scale — no pops between close samples', () => {
    for (let i = 0; i < 50; i++) {
      const x = i * 0.83, z = i * 1.7;
      expect(Math.abs(undulation(x + 0.1, z) - undulation(x, z))).toBeLessThan(0.03);
    }
  });
});
```

Extend `zoneBuilder.test.ts` (exterior describe; `zone()`/`exteriorZone()`/`meshNamed` are the file's live helpers):
```ts
import { UNDULATION_AMP_M, undulation } from '../noise';

it('the ground undulates within the amplitude and stays watertight at shared corners', () => {
  const built = new ZoneBuilder().build(exteriorZone(['..', '..']), fakeAssets());
  const g = meshNamed(built.group, 'exterior-ground')!;
  const pos = g.geometry.getAttribute('position');
  let deviated = false;
  const atKey = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    expect(Math.abs(y)).toBeLessThanOrEqual(UNDULATION_AMP_M + 1e-6); // flat heightGrid ⇒ pure undulation
    if (Math.abs(y) > 0.01) deviated = true;
    const key = `${pos.getX(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    const prev = atKey.get(key);
    if (prev !== undefined) expect(y).toBeCloseTo(prev, 6); // duplicated corners weld
    atKey.set(key, y);
  }
  expect(deviated).toBe(true);
});
it('ground orientation still faces +y after the undulation (Task 6 guard extended)', () => {
  const built = new ZoneBuilder().build(exteriorZone(['..']), fakeAssets());
  const normal = meshNamed(built.group, 'exterior-ground')!.geometry.getAttribute('normal');
  for (let i = 0; i < normal.count; i++) expect(normal.getY(i)).toBeGreaterThan(0);
});
it('groundYAt = cell height + undulation on exteriors; flat on interiors', () => {
  const ext = new ZoneBuilder().build(exteriorZone(['..']), fakeAssets());
  expect(ext.groundYAt(1, 1)).toBeCloseTo(undulation(1, 1), 6);
  const int = new ZoneBuilder().build(zone(['###', '#.#', '###']), fakeAssets());
  expect(int.groundYAt(3, 3)).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/world/__tests__/noise.test.ts src/world/__tests__/zoneBuilder.test.ts`
Expected: FAIL — `undulation`/`UNDULATION_AMP_M` not exported; ground verts all exactly flat; `groundYAt` undefined.

- [ ] **Step 3: Implement.** Add `undulation` to `noise.ts`; apply the `GROUND_SUB` ground loop, the skirt `pushQuad` loop, `groundYAt` + `KIT_SETTLE_M` + the six placement swaps in `ZoneBuilder.build`; add `groundYAt` to `BuiltZone`; apply the six `main.ts` consumer swaps.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/world/__tests__/noise.test.ts src/world/__tests__/zoneBuilder.test.ts` → PASS (including the Task 6 orientation + Task 9 prop/roof tests, unchanged). Run `npm run typecheck` → clean. Run `npx vitest run` → whole suite green.

- [ ] **Step 5: Ratify + commit.** Shoot the terrain (feet-grounding is the thing to eyeball — walk near a tree/kneeler and confirm no float):
```bash
node scripts/shoot.mjs gate-fields realism-c2-terrain 1
node scripts/shoot.mjs pilgrims-descent realism-c2-risers 1
```
Expected: the field rolls gently (1 m moon-catching facets, never per-cell steps); Pilgrim's risers read as broken earth, not extruded rectangles; trees/props/enemies/camera all sit ON the displaced surface. Then:
```bash
git add src/world/noise.ts src/world/ZoneBuilder.ts src/main.ts src/world/__tests__/noise.test.ts src/world/__tests__/zoneBuilder.test.ts docs/shots/realism-c2-terrain.png docs/shots/realism-c2-risers.png
git commit -m "feat(curves): seeded terrain undulation + smoothed risers + shared groundYAt y-grounding"
```

---

### Task C3: Crooked trees — bent trunks, displaced canopies, asymmetric silhouettes

**Files:**
- Modify: `src/world/exteriorForest.ts` (`pineGeometry`/`trunkGeometry` rebuilt crooked; grass EXCLUDED — spec §11.3 names trunks/canopies; a 0.45 m blade is ~2 px at 320×240)
- Modify: `src/world/ZoneBuilder.ts` (`stampForest` gains `opts: { tilt?: boolean }` — per-instance seeded tilt + y-squash for TREE kinds only; roof wedges stay upright)
- Modify: `assets/LICENSES.md` (procedural-geometry paragraph: tri figures updated)
- Test: extend `src/world/__tests__/exteriorForest.test.ts`, extend `src/world/__tests__/zoneBuilder.test.ts`

**Interfaces:**
- Produces: crooked `pineGeometry`/`trunkGeometry` (same exports/signatures); `stampForest(group, name, geometry, spots, opts?: { tilt?: boolean })` — **Task 10 extends this SAME opts object with `windMats`**.
- Consumes: `displaceRadial`/`seededAt` (C1). Raised tri caps WITH accounting: pine 25→**≤160**, trunk 15→**≤120**, grass **≤12 unchanged**. Worst forest (~60 dense + 20 sparse) ≈ 12k tris — the <100k budget holds with 8× headroom (guards, not targets).

**Per-instance variation is resolved WITHOUT breaking 1 draw/kind:** true per-instance vertex displacement is impossible on a shared `InstancedMesh` geometry, so per-instance-ness comes from the INSTANCE MATRIX (seeded tilt ±0.08 rad on x/z + y-squash 0.88–1.16, on top of the existing yaw+scale jitter) over a strongly ASYMMETRIC base (bent trunk + offset lumpy cones): different yaws present different silhouettes, so no two neighbours read alike — still exactly 1 draw call per kind.

`exteriorForest.ts` — add `import { displaceRadial, seededAt } from './noise';`, replace `trunk()`/`coneAt()` usage in the two tree builders (the `trunk`/`coneAt` helpers stay for any other caller; add the two new helpers + rebuilt builders):

```ts
/** A trunk bowed toward +x with a progressive (t²) lean — base planted, crown
 *  carried sideways. 2 height segments = 3 lean stations: the low-poly PS1
 *  "segmented bend", not a smooth arc. Open-ended like `trunk()`. */
function bentTrunk(radiusTop: number, radiusBottom: number, height: number, leanM: number, hex: number): BufferGeometry {
  const g = new CylinderGeometry(radiusTop, radiusBottom, height, SEG, 2, true);
  g.translate(0, height / 2, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / height;
    pos.setX(i, pos.getX(i) + leanM * t * t);
  }
  pos.needsUpdate = true;
  return paint(g, hex);
}

/** A needle cone with seeded lumpy displacement, its axis carried `xOff` off
 *  the root line (following the trunk's lean) — the asymmetric dead canopy. */
function crookedCone(radius: number, height: number, baseY: number, wobbleM: number, seed: number, xOff: number, hex: number): BufferGeometry {
  const g = new ConeGeometry(radius, height, SEG + 1, 2, true);
  displaceRadial(g, wobbleM, seed);
  g.translate(xOff, baseY + height / 2, 0);
  return paint(g, hex);
}
```

```ts
/**
 * A dead pine, CROOKED (C3): a bowed trunk under three lumpy, offset needle
 * cones — the crown carried ~0.22 m off the root line. ~95 tris (cap 160), ~3.1 m.
 */
export function pineGeometry(): BufferGeometry {
  const LEAN = 0.22;
  const at = (y: number): number => LEAN * (y / 3.1) ** 2; // the trunk's lean at height y
  return merge([
    bentTrunk(0.1, 0.16, 0.9, at(0.9), BARK),
    crookedCone(0.92, 1.2, 0.5, 0.11, 0xf1, at(1.1), NEEDLE),
    crookedCone(0.66, 1.1, 1.3, 0.1, 0xf2, at(1.85), NEEDLE),
    crookedCone(0.44, 1.0, 2.1, 0.09, 0xf3, at(2.6), NEEDLE),
  ]);
}

/**
 * A bare/sparse trunk, CROOKED: a hard 0.28 m bow with one thin lumpy crown.
 * ~45 tris (cap 120). Walkable partial occlusion, as before.
 */
export function trunkGeometry(): BufferGeometry {
  const LEAN = 0.28;
  return merge([
    bentTrunk(0.12, 0.18, 1.9, LEAN, BARK),
    crookedCone(0.5, 0.9, 1.7, 0.08, 0xf4, LEAN * 0.8, NEEDLE),
  ]);
}
```

`ZoneBuilder.ts` — `stampForest` signature + compose loop (add `Euler` to the three import; the C3 diff to the LIVE function):

```ts
function stampForest(group: Group, name: string, geometry: BufferGeometry, spots: ForestSpot[], opts: { tilt?: boolean } = {}): void {
```
and inside the `spots.forEach` compose loop, replace the yaw/scale lines with:
```ts
    const yaw = cellNoise(spot.row, spot.col, 1) * Math.PI * 2;
    const scale = 0.85 + cellNoise(spot.row, spot.col, 2) * 0.35; // 0.85–1.2
    if (opts.tilt) {
      // Seeded per-instance lean + squash (C3): the instance matrix carries the
      // per-tree crookedness the shared geometry can't — 1 draw/kind held.
      const tx = (cellNoise(spot.row, spot.col, 4) - 0.5) * 0.16; // ±0.08 rad
      const tz = (cellNoise(spot.row, spot.col, 6) - 0.5) * 0.16;
      const squash = 0.88 + cellNoise(spot.row, spot.col, 5) * 0.28; // 0.88–1.16 y
      m.compose(p.set(spot.x, spot.y, spot.z), q.setFromEuler(euler.set(tx, yaw, tz)), s.set(scale, scale * squash, scale));
    } else {
      m.compose(p.set(spot.x, spot.y, spot.z), q.setFromAxisAngle(UP, yaw), s.set(scale, scale, scale));
    }
    mesh.setMatrixAt(i, m);
```
(declare `const euler = new Euler();` beside the existing `const q = new Quaternion();`). Call sites: the three forest stamps pass `{ tilt: true }`; the roof-wedge stamp passes nothing (roofs stay upright — asserted below).

`assets/LICENSES.md` — in the "Procedural geometry" paragraph, update the tri sentence: `caps the dense pine at ~25 tris` → `caps the dense pine at ~95 tris (crooked rebuild, C3; budget guard 160)`.

- [ ] **Step 1: Write the failing tests.**

Extend `exteriorForest.test.ts` — raise the cap table and add asymmetry/determinism:
```ts
  // C3 (spec §11.3): caps RAISED with accounting — guards, not targets.
  // Worst forest ≈ 60 dense + 20 sparse ⇒ ~12k tris; <100k holds with 8× headroom.
  for (const [name, build, triCap] of [
    ['pine (dense)', pineGeometry, 160],
    ['trunk (sparse)', trunkGeometry, 120],
    ['grass tuft', grassGeometry, 12],
  ] as const) {
```
(the loop body — position/color/base-at-y0 assertions — is unchanged), plus:
```ts
  it('C3: trees are asymmetric (bent trunk breaks mirror symmetry) and deterministic', () => {
    for (const build of [pineGeometry, trunkGeometry]) {
      const a = build();
      const pos = a.getAttribute('position');
      let minX = Infinity, maxX = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        minX = Math.min(minX, pos.getX(i));
        maxX = Math.max(maxX, pos.getX(i));
      }
      expect(Math.abs(minX + maxX)).toBeGreaterThan(0.05); // the lean: |minX| ≠ maxX
      const b = build();
      const pb = b.getAttribute('position');
      for (let i = 0; i < pos.count; i++) expect(pos.getX(i)).toBe(pb.getX(i)); // seeded, reproducible
      a.dispose();
      b.dispose();
    }
  });
```
Extend `zoneBuilder.test.ts` (add `Matrix4, Quaternion, Vector3` to the file's existing `three` import):
```ts
it('C3: tree instances carry seeded tilt; roof wedges stay upright', () => {
  const built = new ZoneBuilder().build(exteriorZone(['TH', 'T.']), fakeAssets());
  const m = new Matrix4(); const q = new Quaternion(); const p = new Vector3(); const s = new Vector3();
  let treeTilted = false;
  built.group.traverse((o) => {
    if (!(o instanceof InstancedMesh)) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.decompose(p, q, s);
      const tilted = Math.abs(q.x) > 1e-4 || Math.abs(q.z) > 1e-4;
      if (o.name === 'pine-dense' && tilted) treeTilted = true;
      if (o.name === 'roof-wedge') expect(tilted).toBe(false); // buildings never lean
    }
  });
  expect(treeTilted).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/world/__tests__/exteriorForest.test.ts src/world/__tests__/zoneBuilder.test.ts`
Expected: FAIL — trees still mirror-symmetric (|minX+maxX| ≈ 0); no instance tilt. (The raised caps alone would pass — the asymmetry assertion is what bites.)

- [ ] **Step 3: Implement.** Add `bentTrunk`/`crookedCone` + the two rebuilt builders to `exteriorForest.ts`; add the `opts.tilt` branch to `stampForest` + `{ tilt: true }` on the three forest call sites; update the LICENSES.md tri sentence.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/world/__tests__/exteriorForest.test.ts src/world/__tests__/zoneBuilder.test.ts` → PASS (including the untouched vertex-colour luma-band + UV tests — `bentTrunk`/`crookedCone` still `paint()` BARK/NEEDLE and CylinderGeometry/ConeGeometry carry UVs). Run `npm run typecheck` → clean.

- [ ] **Step 5: Ratify + commit.**
```bash
node scripts/shoot.mjs ashen-forest-n realism-c3-crooked-forest 1
```
Expected: the treeline reads as a dead, crooked stand — bowed trunks, lumpy offset crowns, no two neighbours alike, silhouette-against-fog still reads "pine". Then:
```bash
git add src/world/exteriorForest.ts src/world/ZoneBuilder.ts assets/LICENSES.md src/world/__tests__/exteriorForest.test.ts src/world/__tests__/zoneBuilder.test.ts docs/shots/realism-c3-crooked-forest.png
git commit -m "feat(curves): crooked trees — bent trunks, displaced canopies, seeded per-instance lean"
```

---

### Task C4: Boulder-ized props — rounded gibbet, lumpy rocks/bones/stumps

**Files:**
- Modify: `src/world/exteriorProps.ts` (gibbet rebuilt from rods/rings/blob — the shipped bars ARE boxes, verified `exteriorProps.ts:42-58`; ADD `stoneGeometry`/`bonePileGeometry`/`stumpGeometry` for Task 10's scatter)
- Test: extend `src/world/__tests__/exteriorProps.test.ts`

**Interfaces:**
- Produces: `stoneGeometry()`/`bonePileGeometry()`/`stumpGeometry()` — the EXACT zero-arg contract Task 10's `CLUTTER` map consumes; `gibbetGeometry()` same signature, rounded internals.
- Consumes: `displaceRadial`/`seededAt` (C1); the live `paint`/`merge` helpers in `exteriorProps.ts`.

Replace the `bar()`-based gibbet and add the clutter (add to the three import: `CylinderGeometry, IcosahedronGeometry, LatheGeometry, SphereGeometry, TorusGeometry, Vector2`; add `import { displaceRadial, seededAt } from './noise';` — keep `bar()` for `roofWedgeGeometry`'s neighbours if unused, else delete it):

```ts
/** A rounded iron rod (6-sided cylinder), authored along y, centred at (x, y, z). */
function rod(r: number, len: number, y: number, x: number, z: number, hex: number): BufferGeometry {
  const g = new CylinderGeometry(r, r, len, 6, 1);
  g.translate(x, y, z);
  return paint(g, hex);
}

/** A cage ring — a low-poly torus lying flat at height y. */
function ring(r: number, tube: number, y: number, hex: number): BufferGeometry {
  const g = new TorusGeometry(r, tube, 4, 10);
  g.rotateX(Math.PI / 2);
  g.translate(0, y, 0);
  return paint(g, hex);
}

/** A rusted iron cage hung high (rusted open — lore card), with a slumped bone
 *  occupant. C4: ROUNDED — rod uprights, torus rings, a displaced bone blob;
 *  no box bars. Same footprint/heights as the shipped box version. ~370 tris. */
export function gibbetGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const yTop = 2.6;
  const cage = 1.0;
  const half = 0.28;
  parts.push(rod(0.03, 0.4, yTop + 0.2, 0, 0, IRON)); // hanger stem
  parts.push(ring(0.34, 0.028, yTop, IRON)); // top ring
  parts.push(ring(0.34, 0.028, yTop - cage, IRON)); // bottom ring
  for (const [x, z] of [[half, half], [-half, half], [half, -half], [-half, -half]] as const) {
    parts.push(rod(0.024, cage, yTop - cage / 2, x, z, IRON)); // four rounded uprights
  }
  // The slumped occupant — a displaced bone blob, not a box.
  const bone = displaceRadial(new SphereGeometry(0.17, 7, 5), 0.05, 0xb0e);
  bone.scale(1, 1.4, 1);
  bone.translate(0, yTop - cage + 0.38, 0);
  parts.push(paint(bone, BONE));
  return merge(parts);
}

// --- C4 ground clutter (consumed by Task 10's scatter `CLUTTER` map) ---------

/** A lumpy field stone (~0.5 m) — a seeded noise-displaced icosahedron,
 *  squashed and SETTLED into the ash (embedded a few cm; never floating). */
export function stoneGeometry(): BufferGeometry {
  const g = displaceRadial(new IcosahedronGeometry(0.26, 1), 0.07, 0x57e);
  g.scale(1.1, 0.62, 0.95);
  g.translate(0, 0.14, 0);
  return paint(g, 0x4a4640);
}

/** A small bone pile — three tumbled rounded long-bones over a low ash mound. */
export function bonePileGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const bone = (len: number, y: number, yaw: number, seed: number): BufferGeometry => {
    const g = new CylinderGeometry(0.03, 0.042, len, 5, 1);
    g.rotateZ(Math.PI / 2 - 0.12);
    g.rotateY(yaw);
    g.translate((seededAt(seed, 0, 0, 3) - 0.5) * 0.2, y, (seededAt(0, seed, 0, 3) - 0.5) * 0.2);
    return paint(g, BONE);
  };
  parts.push(bone(0.52, 0.05, 0.3, 1), bone(0.44, 0.1, 1.7, 2), bone(0.38, 0.15, 2.6, 3));
  const mound = displaceRadial(new SphereGeometry(0.2, 6, 4), 0.05, 0x60e);
  mound.scale(1.3, 0.45, 1.2);
  mound.translate(0, 0.05, 0);
  parts.push(paint(mound, BONE));
  return merge(parts);
}

/** A cut stump (~0.5 m) — a lathe with a root flare, lumpy bark, capped top. */
export function stumpGeometry(): BufferGeometry {
  const g = new LatheGeometry(
    [new Vector2(0.34, 0), new Vector2(0.24, 0.09), new Vector2(0.2, 0.28), new Vector2(0.22, 0.48), new Vector2(0.02, 0.5)],
    7,
  );
  displaceRadial(g, 0.03, 0x7a2);
  return paint(g, 0x3b322a);
}
```

- [ ] **Step 1: Write the failing tests.** Extend `exteriorProps.test.ts` (the file's `tris`/`minY` helpers are live):
```ts
import { bonePileGeometry, stoneGeometry, stumpGeometry } from '../exteriorProps';

describe('C4 boulder-ized props', () => {
  it('the gibbet is rounded — the cylindrical/toroidal rebuild lands well above the box tri count', () => {
    const g = gibbetGeometry();
    expect(tris(g)).toBeGreaterThan(250); // the 7-part box cage was ~96 tris
    expect(tris(g)).toBeLessThanOrEqual(600);
    expect(minY(g)).toBeGreaterThanOrEqual(-0.001); // still hangs — nothing below the floor
    g.dispose();
  });
  for (const [name, build, cap] of [
    ['stone', stoneGeometry, 90],
    ['bone pile', bonePileGeometry, 140],
    ['stump', stumpGeometry, 120],
  ] as const) {
    it(`${name}: lumpy, low-poly (≤${cap} tris), vertex-coloured, settled (embedded ≤0.15 m, never floating)`, () => {
      const g = build();
      expect(g.getAttribute('color')).toBeDefined();
      expect(g.getAttribute('uv')).toBeDefined(); // phase policy: UV assertion on every hand geometry
      expect(tris(g)).toBeGreaterThan(0);
      expect(tris(g)).toBeLessThanOrEqual(cap);
      expect(minY(g)).toBeLessThanOrEqual(0.02); // touches/embeds the ground — no hover
      expect(minY(g)).toBeGreaterThanOrEqual(-0.15);
      g.dispose();
    });
  }
  it('clutter is deterministic (seeded, never Math.random)', () => {
    for (const build of [stoneGeometry, bonePileGeometry, stumpGeometry, gibbetGeometry]) {
      const a = build().getAttribute('position');
      const b = build().getAttribute('position');
      expect(a.count).toBe(b.count);
      for (let i = 0; i < a.count; i++) expect(a.getY(i)).toBe(b.getY(i));
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/world/__tests__/exteriorProps.test.ts`
Expected: FAIL — `stoneGeometry`/`bonePileGeometry`/`stumpGeometry` not exported; the box gibbet sits at ~96 tris (< 250).

- [ ] **Step 3: Implement.** Apply the `exteriorProps.ts` changes above.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/world/__tests__/exteriorProps.test.ts src/world/__tests__/zoneBuilder.test.ts` → PASS (the Task 9 `prop:gibbet` placement test is signature-compatible — same export, new internals). Run `npm run typecheck` → clean. Run `npx vitest run` → whole suite green.

- [ ] **Step 5: Ratify + commit.**
```bash
node scripts/shoot.mjs gate-fields realism-c4-gibbet 1
```
Expected: the gibbet reads as a rusted round cage (rods/rings) with a slumped occupant, not a box lattice. Then:
```bash
git add src/world/exteriorProps.ts src/world/__tests__/exteriorProps.test.ts docs/shots/realism-c4-gibbet.png
git commit -m "feat(curves): rounded gibbet + lumpy stone/bone/stump clutter geometry"
```

---

### Task 10: Atmosphere — smooth wind sway, banner sway, ground clutter, per-preset particles

**Files:**
- Modify: `src/ps1/patchMaterial.ts` (add the optional `{ wind }` opt — a SMOOTH vertex sway; distinct program cache key)
- Modify: `src/world/ZoneBuilder.ts` (`stampForest` sets per-instance `aWindPhase` + patches with wind; collect forest materials; advance `uWindTime` in `updateExterior`; render the banner STANDALONE for sway; stamp `def.scatter` clutter)
- Modify: `src/world/exteriorForest.ts` (export the `WIND` const only — clutter geometry shipped in C4, in `exteriorProps.ts`)
- Modify: `src/world/exteriorSky.ts` (per-preset ash count/speed + gorge ember `Points`)
- Modify: `src/world/zoneDef.ts` (add `scatter?` field)
- Modify: `src/content/zones/gateFields.ts`, `src/content/zones/cinderVillage.ts` (sparse `scatter` lists)
- Modify: `src/main.ts` (slow banner-mesh sway each frame — smooth)
- Test: `src/ps1/__tests__/patchMaterial.test.ts` (create/extend), extend `src/world/__tests__/zoneBuilder.test.ts`, extend `src/world/__tests__/exteriorSky.test.ts`

**Interfaces:**
- Produces: `WindOpts` + `patchMaterial(mat, { wind })`; the `WIND` amplitude const (exported for the bounds test); `ZoneDef.scatter?`; per-preset particle tuning.
- Consumes: `patchMaterial`, `stampForest` (with C3's `opts` object — this task EXTENDS it with `windMats`), `getTexture`, C4's `stoneGeometry`/`bonePileGeometry`/`stumpGeometry` (already shipped + tested), the existing `updateExterior` tick (ZoneManager registers `zones` as a Subsystem, so `updateExterior(dtMs)` runs every frame).

**Wind design (SMOOTH — never stepped, spec §6):** inject a sway into the forest instanced material's vertex shader at `#include <begin_vertex>` (before projection, so vertex-snap + affine still operate on the swayed clip position). Per-instance `aWindPhase` (an `InstancedBufferAttribute`) desyncs trees; `uWindTime` advances continuously; the sway weights by object-space height so trunk bases stay planted. Amplitude a few cm. **Reconciled against C3's crooked trees:** the sway weight is `transformed.y / uWindHeight`, pure object-space height — C3's bent trunks and displaced canopies keep y ∈ [0, ~3.1] in object space, so displaced crown verts simply inherit the full sway weight and bases stay planted; C3's per-instance tilt lives in the instance matrix, which multiplies AFTER `begin_vertex`, so tilted trees sway correctly along their leaned axes. No change needed — the assumptions hold by construction.

`patchMaterial.ts` — add the opt (backward-compatible; every existing `patchMaterial(mat)` call is unaffected):
```ts
export interface WindOpts {
  ampM: number;      // sway amplitude at the crown, metres (a few cm)
  freqHz: number;    // sway frequency
  heightRefM: number;// object-space height that reaches full sway weight
}

export function patchMaterial(mat: Material, opts: { wind?: WindOpts } = {}): void {
  patchedMaterials.add(new WeakRef(mat));
  const wind = opts.wind;

  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSnapRes = { value: new Vector2(defaultSnapResX, defaultSnapResY) };
    if (wind) {
      shader.uniforms.uWindTime = { value: 0 };
      shader.uniforms.uWindAmp = { value: wind.ampM };
      shader.uniforms.uWindFreq = { value: wind.freqHz };
      shader.uniforms.uWindHeight = { value: wind.heightRefM };
    }

    const vHead = ['uniform vec2 uSnapRes;', 'varying vec2 vAffine;', 'varying float vW;'];
    if (wind) vHead.push(
      'uniform float uWindTime;', 'uniform float uWindAmp;', 'uniform float uWindFreq;',
      'uniform float uWindHeight;', 'attribute float aWindPhase;',
    );
    vHead.push('void main() {');
    shader.vertexShader = shader.vertexShader.replace('void main() {', vHead.join('\n'));

    if (wind) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '  float wW = clamp(transformed.y / uWindHeight, 0.0, 1.0);',
          '  wW *= wW;', // ease: base planted, crown sways most
          '  transformed.x += sin(uWindTime * uWindFreq + aWindPhase) * uWindAmp * wW;',
          '  transformed.z += cos(uWindTime * uWindFreq * 0.73 + aWindPhase) * uWindAmp * wW * 0.6;',
        ].join('\n'),
      );
    }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      [
        '#include <project_vertex>',
        '  gl_Position.xy /= gl_Position.w;',
        '  gl_Position.xy = floor(gl_Position.xy * uSnapRes) / uSnapRes;',
        '  gl_Position.xy *= gl_Position.w;',
        '  vAffine = uv * gl_Position.w;',
        '  vW = gl_Position.w;',
      ].join('\n'),
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      ['varying vec2 vAffine;', 'varying float vW;', 'void main() {', '  vec2 uv = vAffine / vW;'].join('\n'),
    );
    if (shader.map) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        [
          '#ifdef USE_MAP',
          '  vec4 sampledDiffuseColor = texture2D( map, uv );',
          '  #ifdef DECODE_VIDEO_TEXTURE',
          '    sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );',
          '  #endif',
          '  diffuseColor *= sampledDiffuseColor;',
          '#endif',
        ].join('\n'),
      );
    }
    mat.userData.ps1Shader = shader;
  };

  mat.customProgramCacheKey = () => (wind ? 'ps1-patched-wind' : 'ps1-patched');
  mat.needsUpdate = true;
}
```

`exteriorForest.ts` — export the wind params so the bounds test can read them (add near the palette consts):
```ts
/** Smooth wind sway params (spec §6: a few cm, world stays smooth — never stepped). */
export const WIND = { ampM: 0.06, freqHz: 1.1, heightRefM: 3 } as const;
```

`ZoneBuilder.ts` — `stampForest`'s C3 `opts` object gains `windMats` (wind = per-instance phase + wind patch, applied ONLY when `windMats` is passed):
```ts
function stampForest(
  group: Group, name: string, geometry: BufferGeometry, spots: ForestSpot[],
  opts: { tilt?: boolean; windMats?: MeshStandardMaterial[] } = {},
): void {
  if (spots.length === 0) { geometry.dispose(); return; }
  // Shipped kinds keep their ratified bark×tint look (T7/T9); only the NEW
  // clutter kinds stay vertex-colour-only (a bark-wrapped stone reads wrong).
  const map = name.startsWith('clutter-') ? undefined : getTexture('bark');
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  if (map) material.map = map; // set BEFORE patchMaterial so the affine warp binds (live Task 7 pattern)
  forceNearest(material);
  patchMaterial(material, opts.windMats ? { wind: WIND } : {}); // SMOOTH sway on wind kinds only
  const mesh = new InstancedMesh(geometry, material, spots.length);
  if (opts.windMats) {
    // per-instance wind phase so trees desync
    const phase = new Float32Array(spots.length);
    spots.forEach((s, i) => { phase[i] = cellNoise(s.row, s.col, 3) * Math.PI * 2; });
    geometry.setAttribute('aWindPhase', new InstancedBufferAttribute(phase, 1));
    opts.windMats.push(material);
  }
  // ...(the C3 compose loop — yaw/scale + opts.tilt lean/squash — unchanged)...
  group.add(mesh);
}
```
(add `InstancedBufferAttribute` + `WIND` imports.) Call sites: the three forest stamps pass `{ tilt: true, windMats }` (a shared `const windMats: MeshStandardMaterial[] = [];`); the roof-wedge and clutter stamps pass nothing — buildings and stones never sway or lean.

Advance `uWindTime` in `updateExterior` — wrap the backdrop update:
```ts
      let windClockMs = 0;
      const backdropUpdate = backdrop.update;
      updateExterior = (dtMs: number): void => {
        backdropUpdate(dtMs);
        windClockMs += dtMs;
        for (const m of windMats) {
          const u = (m.userData.ps1Shader as { uniforms?: Record<string, { value: number }> } | undefined)?.uniforms?.uWindTime;
          if (u) u.value = windClockMs / 1000;
        }
      };
```

Banner standalone (for smooth sway) — `addPiece('banner', …)` merges the banner into the shared `texture` bucket, so it can't be transformed independently. For EXTERIOR zones, build the banner as a standalone mesh instead. Add `bannerMesh?: Mesh;` to `BuiltZone` (and to the `built` literal), declare `let bannerMeshRef: Mesh | undefined;`, and add a helper near `addPiece`:
```ts
    /** A standalone (un-merged) banner mesh so it can sway (exterior only). Clones
     *  the template's mesh geometry with the placement baked in + a patched material
     *  clone; the atlas texture stays shared with the template cache. */
    const buildStandaloneBanner = (x: number, y: number, z: number, rotY: number, scale: number): Mesh | undefined => {
      const template = assets.get('banner');
      const place = new Matrix4().compose(
        new Vector3(x, y, z), new Quaternion().setFromAxisAngle(UP, rotY), new Vector3(scale, scale, scale),
      );
      const geoms: BufferGeometry[] = [];
      let srcMat: Material | undefined;
      template.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        srcMat = mesh.material;
        const g = mesh.geometry.clone();
        g.applyMatrix4(new Matrix4().multiplyMatrices(place, mesh.matrixWorld));
        geoms.push(g);
      });
      if (geoms.length === 0 || !srcMat) return undefined;
      const geometry = mergeGeometries(normalizeForMerge(geoms), false);
      for (const g of geoms) g.dispose();
      if (!geometry) return undefined;
      const material = srcMat.clone();
      forceNearest(material);
      patchMaterial(material);
      const mesh = new Mesh(geometry, material);
      mesh.name = 'banner-standalone';
      return mesh;
    };
```
In the banner block, branch exteriors to it (the banner y is C2's `groundYAt` on exteriors — same expression the live banner `addPiece` uses after C2):
```ts
      if (def.kind === 'exterior') {
        bannerMeshRef = buildStandaloneBanner(cx + dc * setback, groundYAt(cx + dc * setback, cz + dr * setback), cz + dr * setback, Math.atan2(dc, dr), bScale);
        if (bannerMeshRef) group.add(bannerMeshRef);
      } else {
        addPiece('banner', cx + dc * setback, cellHeightM(row, col), cz + dr * setback, Math.atan2(dc, dr), bScale);
      }
```
Set `bannerMesh: bannerMeshRef,` in the `built` literal. (Interiors keep the merged banner — no sway indoors.)

Clutter geometry: `stoneGeometry`/`bonePileGeometry`/`stumpGeometry` shipped in **C4** (rounded/lumpy, tested there) — this task only wires the scatter.

`zoneDef.ts` — add the field (all optional; absent ⇒ no clutter):
```ts
  /** Realism pass (Task 10): sparse instanced ground clutter (1 draw call/kind). */
  scatter?: { kind: 'stone' | 'bones' | 'stump'; cells: GridPos[] }[];
```

`ZoneBuilder.ts` — stamp scatter (after the ground mesh, exterior branch; `groundYAt` is C2's surface function, so clutter sits ON the undulated dirt):
```ts
      const CLUTTER: Record<string, () => BufferGeometry> = {
        stone: stoneGeometry, bones: bonePileGeometry, stump: stumpGeometry,
      };
      for (const s of def.scatter ?? []) {
        const geo = CLUTTER[s.kind]();
        const spots: ForestSpot[] = s.cells.map(([r, c]) => ({
          x: c * cell + half, y: groundYAt(c * cell + half, r * cell + half), z: r * cell + half, row: r, col: c,
        }));
        stampForest(group, `clutter-${s.kind}`, geo, spots); // no opts — clutter never sways or leans
      }
```
(add `import { bonePileGeometry, stoneGeometry, stumpGeometry } from './exteriorProps';` — the `clutter-` map guard is already in the `stampForest` snippet above.) Add `SCATTER_CAP = 40` and warn/clamp if a zone's total scatter exceeds it.

`exteriorSky.ts` — per-preset particle tuning + gorge embers. Replace the fixed `ASH_COUNT`/`ASH_FALL_MPS` with a per-preset table and add an ember `Points` for `gorge`:
```ts
const ASH: Record<ExteriorSky, { count: number; fallMps: number }> = {
  field: { count: 220, fallMps: 0.55 },   // unchanged (spec §6)
  forest: { count: 320, fallMps: 0.38 },  // denser + slower
  gorge: { count: 180, fallMps: 0.6 },    // thinner ash; embers add the warmth below
};
```
Use `ASH[preset].count`/`.fallMps` in the ash build/update. For `gorge`, also build a sparse warm-ember `Points` drifting UP (spec §6), add `embers?: Points` to `ExteriorBackdrop`, include it in `update` (rise + wrap) + `dispose`, and in `ZoneBuilder` add it to the group when present.

`main.ts` — slow banner sway (smooth), in the exterior render tick (near line 2223 exterior block or the per-frame section):
```ts
      if (built.bannerMesh) {
        // slow pendulum skew — SMOOTH (never stepped); world micro-motion rule (spec §6)
        built.bannerMesh.rotation.z = Math.sin(nowMs * 0.0011) * 0.05;
      }
```
(`nowMs` = the frame's `performance.now()` already in scope, or `t`.)

- [ ] **Step 1: Write the failing tests.**

`src/ps1/__tests__/patchMaterial.test.ts` (create or extend):
```ts
import { describe, it, expect } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { patchMaterial } from '../patchMaterial';
import { WIND } from '../../world/exteriorForest';

describe('patchMaterial wind', () => {
  it('wind amplitude stays a few cm (smooth micro-motion, spec §6)', () => {
    expect(WIND.ampM).toBeLessThanOrEqual(0.12);
    expect(WIND.ampM).toBeGreaterThan(0);
  });
  it('a wind material gets a distinct program cache key (no cross-compile with static)', () => {
    const a = new MeshStandardMaterial(); patchMaterial(a, { wind: WIND });
    const b = new MeshStandardMaterial(); patchMaterial(b);
    expect(a.customProgramCacheKey!()).toBe('ps1-patched-wind');
    expect(b.customProgramCacheKey!()).toBe('ps1-patched');
  });
});
```
(Clutter geometry assertions live in C4's `exteriorProps.test.ts` extension — nothing to add here.)
Extend `zoneBuilder.test.ts`:
```ts
it('forest instanced geometry carries a per-instance aWindPhase attribute', () => {
  const built = new ZoneBuilder().build(exteriorZone([',t', 'T#']), fakeAssets());
  let hasPhase = false;
  built.group.traverse((o) => {
    if (o instanceof InstancedMesh && o.geometry.getAttribute('aWindPhase')) hasPhase = true;
  });
  expect(hasPhase).toBe(true);
});
it('scatter stamps one instanced mesh per kind (1 draw call each)', () => {
  const built = new ZoneBuilder().build(
    exteriorZone(['..', '..'], { scatter: [{ kind: 'stone', cells: [[0, 0], [1, 1]] }] }), fakeAssets());
  expect(instancedNames(built.group)).toContain('clutter-stone');
});
```
Extend `exteriorSky.test.ts`:
```ts
it('the gorge preset adds a warm ember Points system; field does not', () => {
  const gorge = buildExteriorSky('gorge', { spanM: 40 });
  expect(gorge.embers).toBeDefined();
  gorge.dispose();
  const field = buildExteriorSky('field', { spanM: 40 });
  expect(field.embers).toBeUndefined();
  field.dispose();
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run src/ps1/__tests__/patchMaterial.test.ts src/world/__tests__/zoneBuilder.test.ts src/world/__tests__/exteriorSky.test.ts`
Expected: FAIL — `WIND` unexported, no wind cache key, no `aWindPhase`, no `clutter-stone`, no gorge `embers`.

- [ ] **Step 3: Implement.** Add the wind opt to `patchMaterial`; `WIND` (in `exteriorForest.ts`) + wind wiring + scatter + standalone banner to `ZoneBuilder`; per-preset ash + gorge embers to `exteriorSky`; `scatter?` to `zoneDef`; sparse `scatter` lists to `gateFields`/`cinderVillage`; banner sway to `main`. (Clutter geometry: consume C4's exports as-is.)

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/ps1/__tests__/patchMaterial.test.ts src/world/__tests__/zoneBuilder.test.ts src/world/__tests__/exteriorSky.test.ts` → PASS. Run `npm run typecheck` → clean. Run `npx vitest run` → whole suite green.

- [ ] **Step 5: Ratify (60 fps + smooth) + commit.** Shoot a couple of frames to confirm sway is present and SMOOTH (not stepped), and check the dev HUD fps holds:
```bash
node scripts/shoot.mjs gate-fields realism-atmosphere 0
node scripts/shoot.mjs pilgrims-descent realism-gorge-embers 0
```
Expected: grass/canopy sway gently (per-instance out of phase), the banner skews slowly, stones/bones scatter sparsely, the gorge shows warm ember flecks; entities remain 12-fps stepped against the smooth world. Then:
```bash
git add src/ps1/patchMaterial.ts src/world/ZoneBuilder.ts src/world/exteriorForest.ts src/world/exteriorSky.ts src/world/zoneDef.ts src/content/zones/gateFields.ts src/content/zones/cinderVillage.ts src/main.ts src/ps1/__tests__/patchMaterial.test.ts src/world/__tests__/zoneBuilder.test.ts src/world/__tests__/exteriorSky.test.ts docs/shots/realism-atmosphere.png docs/shots/realism-gorge-embers.png
git commit -m "feat(atmosphere): smooth wind sway, banner sway, ground clutter, per-preset particles"
```

---

### Task 11: Housekeeping trio (spec §7)

**Files:**
- Modify: `src/main.ts:347-349` (reassign the in-memory `save` after the ember-cap restore rewrite)
- Create: `src/entities/__tests__/crossingSilhouette.test.ts` (despawn/lifecycle math)
- Modify: `src/world/zoneDef.ts:216-228` (a comment on `ScareBeat` pointing future payload fields at `isQuietSighting`)
- Test: the new `crossingSilhouette.test.ts`

**Interfaces:**
- Consumes: `CrossingSilhouette` (existing), `isQuietSighting` (existing, `DreadDirector.ts:98`).
- Produces: no new exports — three small correctness/clarity fixes carried over from the GV re-review minors.

(a) `main.ts` boot-persist — the restore rewrite (lines 347-349) writes the lifted cap to storage but leaves the in-memory `save` object stale. Reassign it so later reads (e.g. `save.greaterVael.bargains` at 350) see the corrected cap:
```ts
  if (save?.greaterVael && (save.greaterVael.maxEmberCap ?? emberCap) !== emberCap) {
    save = { ...save, greaterVael: { ...save.greaterVael, maxEmberCap: emberCap } };
    saveGame(save);
  }
```
(`save` is currently `const`; change its declaration at line 312 to `let save = loadGame();`.)

(b) `CrossingSilhouette` despawn/lifecycle test — cover the two despawn paths (end-of-traverse and player-closes-within-`CROSS_DESPAWN_M`) that the AF-1 beat relies on.

(c) `ScareBeat` comment — document that a future scare payload (damage-free, per the type) routes quiet Watcher-only sightings through `isQuietSighting` so authoring and enforcement can't diverge. Add above the `ScareBeat` interface in `zoneDef.ts`:
```ts
/**
 * Realism-pass note (spec §7c): future ScareBeat payload fields (extra visual
 * riders on a beat) must keep the `isQuietSighting` predicate (engine/DreadDirector.ts)
 * as the single gate for whether a beat consumes the shared cooldown / beat cap —
 * a quiet Watcher-only sighting stays exempt. Add payload data, not a second
 * "does this count?" code path.
 */
```

- [ ] **Step 1: Write the failing test.** `src/entities/__tests__/crossingSilhouette.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CrossingSilhouette } from '../CrossingSilhouette';

// CrossingSilhouette's constructor takes no args (src/entities/CrossingSilhouette.ts:66);
// arm(from, to, durMs) and update(dtMs, playerPos) are the confirmed signatures.
function makeCrossing(): CrossingSilhouette {
  return new CrossingSilhouette();
}

describe('CrossingSilhouette lifecycle', () => {
  it('despawns (root hidden) at the end of the traverse', () => {
    const c = makeCrossing();
    c.arm({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1000);
    expect(c.root.visible).toBe(true);
    c.update(600, { x: 50, y: 0, z: 50 }); // far away, mid-traverse
    expect(c.root.visible).toBe(true);
    c.update(600, { x: 50, y: 0, z: 50 }); // u >= 1 → end of traverse
    expect(c.root.visible).toBe(false);
  });
  it('despawns early when the player closes within CROSS_DESPAWN_M ("gone if approached")', () => {
    const c = makeCrossing();
    c.arm({ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, 4000);
    c.update(16, { x: 0.5, y: 0, z: 0 }); // player right on top of the start
    expect(c.root.visible).toBe(false);
  });
  it('is inert (no throw, stays hidden) before it is armed', () => {
    const c = makeCrossing();
    expect(() => c.update(16, { x: 0, y: 0, z: 0 })).not.toThrow();
    expect(c.root.visible).toBe(false);
  });
});
```
(`CrossingSilhouette` (`src/entities/CrossingSilhouette.ts`): `constructor()` no args, `readonly root: Group`, `arm(from, to, durMs)`, `update(dtMs, playerPos)`, `root.visible` — all confirmed.)

- [ ] **Step 2: Run test to verify it runs.**

Run: `npx vitest run src/entities/__tests__/crossingSilhouette.test.ts`
Expected: this is a characterization test of already-correct despawn math, so it PASSES on the existing code — it exists as the spec §7b regression guard the GV re-review asked for. Confirm it runs and asserts BOTH despawn paths (end-of-traverse and player-within-`CROSS_DESPAWN_M`).

- [ ] **Step 3: Implement.** Make the `main.ts` `save` `let` + reassign; add the `ScareBeat` comment. (The crossing test needs no production change unless it surfaces a real bug — if it does, fix per systematic-debugging and note it.)

- [ ] **Step 4: Run tests + typecheck.**

Run: `npx vitest run src/entities/__tests__/crossingSilhouette.test.ts` → PASS. Run `npm run typecheck` → clean.

- [ ] **Step 5: Commit.**
```bash
git add src/main.ts src/world/zoneDef.ts src/entities/__tests__/crossingSilhouette.test.ts
git commit -m "fix(housekeeping): persist restored ember-cap in memory, crossing lifecycle test, scarebeat note"
```

---

### Task 12: Final sweep — all-zone evidence, full suite, e2e budgets, build size

**Files:**
- Create: `docs/shots/realism-{gate-fields,ashen-forest-n,cinder-village,pilgrims-descent,ashen-gate,great-hall,undercroft}-sweep.png`
- Modify: `docs/PLAYTEST.md` (append a realism-pass section) — optional if the file exists
- No source changes expected (P0 fixes, if any, land in `tuning.ts` / zone data / this task's shots only)

**Interfaces:**
- Consumes: `scripts/shoot.mjs` (Task 4); the existing `e2e/greater-vael.spec.ts` draw-call/tris budgets.
- Produces: the all-zone ratification shots and the green-everything proof for the v1.1.0 merge.

- [ ] **Step 1: Full unit suite + typecheck + build size.**

Run: `npx vitest run`
Expected: all green (every task's tests + no regressions).
Run: `npm run typecheck`
Expected: clean.
Run: `npm run build`
Expected: clean; report `dist/assets/index-*.js` gzip size (must stay <1.5 MB gz; textures are hashed URLs OUTSIDE the JS bundle, so the code bundle should stay ~209 KB gz — confirm the tex PNGs appear as separate `dist/assets/*.png` files, not inlined).

- [ ] **Step 2: e2e draw-call/tris budgets.**

The four exterior budget tests live in `e2e/greater-vael.spec.ts` (each asserts `<100` draw calls). Local headless is sandbox-blocked (exit 144) — assert GREEN in CI. Confirm the new static meshes (ground, skirt, roof-wedge, clutter, gibbet, standalone banner, gorge embers) did NOT push any zone's draw calls to ≥100 by reading `window.__oathbrand.drawCalls` per zone via the shoot harness:
```bash
for z in gate-fields ashen-forest-n cinder-village pilgrims-descent; do
  node -e "process.env.OATHBRAND_URL||0" # (drive via shoot.mjs or a small drawCalls probe)
done
```
(Simplest: extend `scripts/shoot.mjs` with an optional `--drawcalls` mode that prints `await evalJs('window.__oathbrand.drawCalls')` after 30 frames; run per zone; expect each < 100.) If any zone is near the ceiling, note it for a merge pass — but per the accounting table it should sit ~12–15.

- [ ] **Step 3: All-zone evidence shots.**

Run the sweep (owner runs if the sandbox blocks Chrome):
```bash
for z in gate-fields ashen-forest-n cinder-village pilgrims-descent ashen-gate great-hall undercroft; do
  node scripts/shoot.mjs $z realism-$z-sweep 1
done
```
Expected: seven PNGs under `docs/shots/`. Verify: exteriors read as grounded, lit, textured, moving places; the Undercroft east half is STILL void-black (keyLightIntensity 0 held); castle interiors show the faint cool key without washing out torch pools.

- [ ] **Step 4: Owner playtest + commit.** Owner walks all zones (includes the outstanding hound 2.3 m eyeball, spec §9): all 10 GV scare beats still fire, ≥90 s apart, none in combat; flicker-safe still strips per-frame components; the checkpoint banner is never spoofed; a v1 beaten-castle save still migrates. Fix any P0 in `tuning.ts`/zone data only. Then:
```bash
git add docs/shots/realism-gate-fields-sweep.png docs/shots/realism-ashen-forest-n-sweep.png docs/shots/realism-cinder-village-sweep.png docs/shots/realism-pilgrims-descent-sweep.png docs/shots/realism-ashen-gate-sweep.png docs/shots/realism-great-hall-sweep.png docs/shots/realism-undercroft-sweep.png
git commit -m "test(evidence): all-zone realism sweep + full suite/e2e/build green"
```

---

## Ambiguities resolved

- **Hemisphere sky colour (spec §3 "the preset zenith colour above"):** the exterior dome zenith values are near-black (`0x0e1016`…), which as a `HemisphereLight` sky colour would contribute ~0 and defeat the intent ("kills the void-black underside without flattening"). RESOLVED: `TUNING.lighting.exterior[preset].hemi.sky` uses a lightened COOL tint per preset (field `0x3a4658`, forest `0x2b3428`, gorge `0x3a2620`) — the spec's stated purpose over its literal value. All values are owner-tunable in one block and ratified in Task 4.
- **Moon/key-light direction "agrees with the visible moon disc":** RESOLVED structurally — `moonDirection(spanM)` is computed from the SAME offset math that places the moon quad, exposed on the backdrop, and threaded to the shared `DirectionalLight` via `BuiltZone.moonDir`. One source of truth ⇒ the light can never drift from the disc.
- **Interior directional per-zone control (spec §3 "cap or zero it via zone def"):** RESOLVED with a single optional `ZoneDef.keyLightIntensity` (Undercroft sets `0`); it also serves as an exterior override if a zone ever needs a dimmer/brighter moon.
- **Tree bark vs canopy as two textures (spec §4.2):** RESOLVED — one `InstancedMesh` per kind = one material = one `map`, so a single crunchy bark map covers trunk+cones and the baked NEEDLE/BARK vertex tints (Task 3) supply the hue via `map × vertexColor`. Keeps 1 draw call/kind and the per-instance multiply-tint the spec requires. Grass stays vertex-colour only (too small to read a map at 320×240).
- **Cinder second wall-atlas variant (spec §4.4 "only if time allows"):** DEFERRED to hold the kit bucket at 1; house differentiation instead uses `wall-arch.glb` door voids (same atlas → same bucket) + a procedural roof-wedge instanced cap.
- **Banner readability (spec §5):** RESOLVED via an exterior-only larger banner scale (`BANNER_EXT_SCALE = 0.65`) rather than per-banner data fields — applies to Pilgrim's and every exterior checkpoint uniformly.
- **Great Hall statue overlap cell:** RESOLVED to `[1,13]` (back to the north wall, clear of the inner-chamber NE wall block at `[3,11-14]`); browser-eyeballed in Task 9/12.
- **C2 y-grounding (spec §11.2 "plan-writer decides"):** RESOLVED as BOTH options — one shared `undulation()` function is sampled by the ground mesh, skirt, every build-time placement, and every runtime view-y consumer (camera/enemy/priest via `BuiltZone.groundYAt`), AND the amplitude is capped at 0.12 m as belt-and-braces. Kit architecture additionally settles `KIT_SETTLE_M` (0.05 m) INTO the dirt so a block can sink on a swell but never float.
- **C3 "seeded per-instance canopy displacement" vs "1 draw/kind stays":** true per-instance vertex displacement is impossible on a shared `InstancedMesh` geometry. RESOLVED: seeded displacement is baked into the shared geometry (strongly asymmetric bent trunk + lumpy offset cones) and per-instance-ness comes from the instance matrix (seeded tilt ±0.08 rad + y-squash 0.88–1.16 + existing yaw/scale) — different yaws present different silhouettes; exactly 1 draw call per kind held.
- **C1 "same named joint-group structure":** the load-bearing joints were audited from the live `update()` bodies (hound `body`/`torso`/`neck`/`hips[4]`; kneeler `frame`/`hipG`/`spine`/`neck`/`torso`/`thighL/R`/`kneeL/R`/`shoulderL/R`; hag `hunch`; crossing `legL/R`) — the rebuilds replace only geometry inside those groups, `update()` diffs must be empty, and the FSM suites + a Box3 height test (hound 2.3 back-solve, Watcher 3.0) enforce it.
- **C3 grass excluded from the crook pass:** spec §11.3 names trunks/canopies; a 0.45 m blade is ~2 px at 320×240 — bending it is invisible cost. Grass caps stay 12.

## Risks flagged

- **AmbientCG asset IDs may 404 / change** (Ground037/Bark012/Rock030/Leather011/Fabric030). Mitigation: `fetch-assets.sh` hard-fails with a clear message; each row lists a fallback id; the crunch pipeline is asset-agnostic (any `*_Color.jpg`), and `getTexture` returns `undefined` on a missing file → the game falls back to flat colour, never crashes.
- **Browser capture in the sandbox** (headless Chrome exit 144, per memory + task-18-report). Mitigation: `scripts/shoot.mjs` targets a headed Chrome on `DISPLAY=:1`/remote-debug-port; if blocked, all evidence steps are owner-run — they are eyeball gates, not code gates.
- **Wind + affine + instancing shader interaction:** the wind injects at `#include <begin_vertex>` (before projection) so vertex-snap + affine still operate on the swayed clip position; a distinct `customProgramCacheKey` ('ps1-patched-wind') prevents a wind material from sharing a compiled program with a static one. Verified only headlessly (cache key + attribute presence) — the 60 fps/smooth read is a Task 10/12 browser gate.
- **Draw-call creep on exteriors:** new static meshes (ground, skirt, roof-wedge, clutter, gibbet, standalone banner, gorge embers) add ~8–10 draws; the accounting table lands each zone ~12–15 (<100). Task 12 Step 2 probes `drawCalls` per zone to confirm before merge.
- **Texture × vertex-colour double-darkening:** the crunched maps are already palette-darkened AND multiply the vertex tint — trees/ground could read too dark. Task 3 lifts vertex tints first; Tasks 7/8 use `color: 0xffffff` for map-bearing ground so the map shows at its own brightness; entities keep the tint as a deliberate multiply. Re-checked in the Task 7/8/12 browser ratify (re-tune the crunch darkening, not blindly).
- **C1 rig regression risk (curves under an untouched `update()`):** a capsule that mismatches its box's pivot/extent by even a few cm skews every animated pose. Mitigation: each replacement is authored to the box's exact vertical footprint (capsule radius = box half-height; `segment()`/`leg()` keep the hang-from-origin contract), the Box3 tests pin the hound 2.3/Watcher 3.0 envelopes, and the untouched FSM suites must stay green. Final read is the C1 Step 5 eyeball.
- **C2 float/sink at structure edges:** a 2 m kit block on a 3.7 m-wavelength swell can deviate from the surface at its corners (max ~±0.07 m at amp 0.12). Mitigation: `KIT_SETTLE_M` embeds blocks 0.05 m (ruins sit, never hover); sinking a few cm reads as settled ruin — floating is the visible bug and is bounded out. Eyeballed in C2 Step 5.
- **C2 watertightness at ground/skirt lips:** both sample the SAME `undulation()` at the same 1 m-spaced world positions, so seams weld by construction — and the zoneBuilder weld test asserts it (the Task 6 "invisible ground" lesson, applied).
- **C4/Task-9 gibbet test coupling:** `gibbetGeometry` keeps its export signature and hanging envelope (`minY ≥ 0`), so Task 9's placement test (`prop:gibbet`) passes unchanged; only tri counts move (asserted 250–600 in C4).

## Spec-coverage mapping (every spec section → task)

- §1 goal / priority order (lighting→textures→props→atmosphere) → task ordering.
- §2 non-goals (no shadows/PBR/mipmaps/res increase/flatShading removal) → Global Constraints (obeyed by all).
- §3 lighting v2 (moon directional, hemisphere, ambient floors, per-preset, interior faint key, undercroft guard, vertex/entity rebalance, Watcher/Hag black) → Tasks 1, 2, 3.
- §4 texture realism (crunch pipeline, ground→trees→entities, texel density, ≤6 buckets, CC0+LICENSES) → Tasks 5, 6, 7, 8.
- §5 prop fidelity (gibbet, Cinder houses, Pilgrim's banner, hall statue) → Task 9.
- §6 world grounding & atmosphere (smooth wind, banner sway, clutter scatter, per-preset particles; world smooth/entities stepped) → Task 10.
- §7 housekeeping trio (boot-persist reassign, CrossingSilhouette test, ScareBeat comment) → Task 11.
- §8 constraints → Global Constraints + Perf trap accounting (obeyed by all).
- §9 process & verification (Gate Fields ratify first, per-zone sweep, e2e green, new unit tests) → Task 4 (ratify), Task 12 (sweep + budgets) + per-task TDD.
- §10 timeline → informational; the task order matches 7/4 lighting → 7/5 textures → 7/6 props+atmosphere+housekeeping.
- **§11 curves addendum** → C1 (organic entities: §11.1), C2 (undulating terrain: §11.2), C3 (crooked trees: §11.3), C4 (boulder-ized props: §11.4); determinism (mulberry32, never Math.random) + the orientation/UV/tri phase policy → `noise.ts` + every C-task's tests; sequencing (after Task 9, before Task 10) → the header amendment + section placement.

## Self-review notes (done)

- **Spec coverage:** every §maps above; no section unassigned. The two spec-flagged design points (hemisphere sky colour, moon-direction agreement) are resolved, not open (Ambiguities section).
- **Placeholder scan:** no "TBD"/"similar to Task N"/"add error handling". Every code step shows complete code; every test step shows real assertions; all `TUNING.lighting` values, texture IDs, prop geometry, and shader injections are written out in full.
- **Type/name consistency (Produces↔Consumes cross-checked):** `TUNING.lighting.exterior[preset]` shape identical in Task 1 (defn) and `resolveZoneLighting`/tests; `moonDirection`/`ExteriorBackdrop.moonDir`/`BuiltZone.moonDir` names match across Tasks 1/10; `TexName` union + `getTexture`/`configureTexture`/`preloadTextures` identical in Task 5 (defn) and Tasks 6/7/8 (use); `patchMaterial(mat, { wind })` + `WindOpts`/`WIND` match Task 10 defn and its callers/tests; `planarUV`, `exterior-ground`, `roof-wedge`, `clutter-<kind>`, `prop:gibbet` mesh names match across builder + tests; `HOUND_TINT`/`KNEELER_TINT`/`WATCHER_TINT`/`HAG_TINT` identical in Task 3 (defn) and Task 8 (use); `keyLightIntensity`/`scatter` ZoneDef fields match defn (Tasks 1/10) and consumers (Task 2 undercroft, Task 10 zones).
- **Budget honesty:** the Perf trap accounting table proves ≤6 kit buckets (exterior = 1) and <100 draws per zone AFTER all tasks; the ground swap REMOVES kit floor tiles from the shared bucket rather than adding a bucket.
- **Ordering is dependency-honest:** lighting (1–2) → rebalance (3) → ratify (4) → texture pipeline (5) → ground/trees/entities texturing (6–8) → props (9) → **curves C1–C4** → atmosphere (10) → housekeeping (11) → final sweep (12). Task 5 gates 6/7/8; Task 4's `shoot.mjs` gates 12; C1's `noise.ts` gates C2/C3/C4; C3's `stampForest` opts + C4's clutter exports gate Task 10.
- **Curves-extension consistency (checked against the LIVE `feat/realism` code):** `noise.ts` exports (`mulberry32`/`seededAt`/`displaceRadial`/`undulation`/`UNDULATION_AMP_M`) identical in C1/C2 (defn) and C2/C3/C4 + tests (use); `organic.ts` exports match every constructor rebuild; `buildWatcher`/`buildHag` export names match the organic tests; `groundYAt` name identical on `BuiltZone`, in the six `main.ts` swaps, and in the Task 10 scatter/banner snippets; `stampForest` `opts: { tilt?, windMats? }` is ONE object across C3 (defn) and Task 10 (extension); `stoneGeometry`/`bonePileGeometry`/`stumpGeometry` zero-arg contract identical in C4 (defn) and Task 10's `CLUTTER` map; the C2 ground/skirt code was written against the SHIPPED `buildExteriorGround` (+y winding, `if (map)` conditional-assign pattern) and `buildTerrainSkirt`, not the superseded Task 6 text; Task 10's stale clutter/exteriorProps references were reconciled (clutter moved to C4; wind reconciled against bent trunks).
