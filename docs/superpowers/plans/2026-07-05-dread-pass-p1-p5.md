# Dread Pass P1–P5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the five small/high-severity dread fixes from `~/oathbrand-dread-gap-report.md`: post-respawn spawn scatter (P1), no mid-fight ember healing (P2), Ash-Hound committed pursuit (P3), six forward-dread inscriptions (P4), HD scare-parity riders + settings caption (P5).

**Architecture:** Pure logic goes in new/existing modules under `src/world`, `src/player`, `src/entities`, `src/engine`, `src/content` with vitest coverage; `src/main.ts` gets thin wiring only (it has no test seam). No new dependencies, no save-format changes, no changes to the PS1 shader path.

**Tech Stack:** TypeScript (strict), Three.js, Vite, vitest. Repo: worktree `~/oathbrand-worktrees/feat-dread`, branch `feat/dread` (stacked on `feat/realism` @ add02a9).

## Global Constraints

- Work ONLY in `~/oathbrand-worktrees/feat-dread`. Never touch `~/oathbrand` (owner's checkout, review-frozen).
- `npm test` (vitest, 815 tests at baseline) must pass after every task. The ONLY pinned tests a task may edit are named in that task (Task 4 edits lore counts; Task 2 edits the Brand ember-wisp asserts in `fsm.test.ts`).
- PS1 render path stays byte-identical: do NOT touch `src/ps1/patchMaterial.ts` or the PS1 branch of `src/ps1/upscale.frag.ts` (pinned by `src/ps1/__tests__/patchMaterial.test.ts:179`).
- HD baseline look is UNCHANGED (owner's PS1-vs-HD A/B verdict is pending). Only frames where a scare beat is actively holding may differ in HD (Task 5).
- No strobing effects: new visual riders must be held envelopes (≥500 ms), honoring the existing Reduced-flicker discipline.
- All new tunable numbers live in `src/content/tuning.ts` (repo convention), not inline magic numbers.
- Enemy ids keep the `${zone}-${kind}-${index}` shape (saves/flags depend on `forsworn-dead` only, but don't churn ids).
- Test conventions: real `EventBus`, real `GridCollider` built from an inline `ZoneDef`, deterministic rng (fake array-driven or `mulberry32(seed)`), fixed 16 ms step loops. See `src/entities/__tests__/ashHound.test.ts` and `src/entities/__tests__/fsm.test.ts`.
- Conventional commits, one per task, style matches repo history (`feat(world): …`).
- Do not run the Playwright e2e suite per task (final gate only).

---

### Task 1 (P1): Spawn scatter on every (re)spawn

Every `spawnEnemies()` call currently rebuilds byte-identical rosters at authored cells (`src/main.ts:1563-1657`), so each retry is a memorized script. Add a pure scatter pass — each common enemy lands on its authored cell or a plain-floor neighbor, from an rng re-seeded per spawn wave.

**Files:**
- Create: `src/world/spawnScatter.ts`
- Test: `src/world/__tests__/spawnScatter.test.ts`
- Modify: `src/main.ts` (near line 555, and inside `spawnEnemies` at 1563-1657)

**Interfaces:**
- Consumes: `EnemySpawn`, `ZoneDef` from `src/world/zoneDef.ts`; `mulberry32` (already in `src/main.ts:201`).
- Produces: `scatterSpawns(def: ZoneDef, rng: () => number): EnemySpawn[]` and `SCATTER_KINDS` — used only by `src/main.ts`.

- [ ] **Step 1: Write the failing tests** — `src/world/__tests__/spawnScatter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scatterSpawns, SCATTER_KINDS } from '../spawnScatter';
import type { EnemySpawn, ZoneDef } from '../zoneDef';

function def(grid: string[], enemies: EnemySpawn[]): ZoneDef {
  return {
    id: 'ashen-gate', grid, cell: 2, tiles: {}, props: [],
    lights: [], enemies, lore: [], doors: [], ambience: [],
  } as unknown as ZoneDef;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const OPEN = ['#######', '#.....#', '#.....#', '#.....#', '#######'];

describe('scatterSpawns', () => {
  it('never moves the forsworn or a kneeler', () => {
    const spawns: EnemySpawn[] = [
      { kind: 'forsworn', at: [2, 3] },
      { kind: 'kneeler', at: [1, 1] },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const out = scatterSpawns(def(OPEN, spawns), mulberry32(seed));
      expect(out[0].at).toEqual([2, 3]);
      expect(out[1].at).toEqual([1, 1]);
    }
  });

  it('keeps every scattered enemy on a plain floor cell within one cell of home', () => {
    const spawns: EnemySpawn[] = [{ kind: 'soldier', at: [2, 3] }];
    for (let seed = 1; seed <= 20; seed++) {
      const [s] = scatterSpawns(def(OPEN, spawns), mulberry32(seed));
      const [r, c] = s.at;
      expect(Math.abs(r - 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(c - 3)).toBeLessThanOrEqual(1);
      expect(OPEN[r][c]).toBe('.');
    }
  });

  it('never lands on walls, banners, spawn cells, doors, or void', () => {
    // Soldier at the centre of a ring of forbidden tiles: only home is legal.
    const grid = ['#####', '#B5S#', '#~.~#', '#####'];
    const spawns: EnemySpawn[] = [{ kind: 'soldier', at: [2, 2] }];
    for (let seed = 1; seed <= 20; seed++) {
      const [s] = scatterSpawns(def(grid, spawns), mulberry32(seed));
      expect(s.at).toEqual([2, 2]);
    }
  });

  it('produces at least two distinct placements across seeds (the anti-memorization point)', () => {
    const spawns: EnemySpawn[] = [{ kind: 'wraith', at: [2, 3] }];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const [s] = scatterSpawns(def(OPEN, spawns), mulberry32(seed));
      seen.add(`${s.at[0]},${s.at[1]}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('never stacks two spawns on one cell', () => {
    const spawns: EnemySpawn[] = [
      { kind: 'soldier', at: [1, 1] },
      { kind: 'soldier', at: [1, 2] },
      { kind: 'hound', at: [2, 1] },
      { kind: 'kneeler', at: [2, 2] },
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const out = scatterSpawns(def(OPEN, spawns), mulberry32(seed));
      const cells = out.map((s) => `${s.at[0]},${s.at[1]}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it('stays home when boxed in, and is deterministic for a given seed', () => {
    const boxed = ['#####', '#.#.#', '###.#', '#####'];
    const spawns: EnemySpawn[] = [{ kind: 'archer', at: [1, 1] }];
    const [s] = scatterSpawns(def(boxed, spawns), mulberry32(7));
    expect(s.at).toEqual([1, 1]);

    const open: EnemySpawn[] = [{ kind: 'soldier', at: [2, 3] }, { kind: 'hound', at: [1, 1] }];
    const a = scatterSpawns(def(OPEN, open), mulberry32(42));
    const b = scatterSpawns(def(OPEN, open), mulberry32(42));
    expect(a).toEqual(b);
  });

  it('preserves kind, patrol, and every other authored field', () => {
    const spawns: EnemySpawn[] = [{ kind: 'soldier', at: [2, 3], patrol: [[1, 1], [3, 3]] }];
    const [s] = scatterSpawns(def(OPEN, spawns), mulberry32(3));
    expect(s.kind).toBe('soldier');
    expect(s.patrol).toEqual([[1, 1], [3, 3]]);
  });

  it('scatter set is exactly the common roster', () => {
    expect([...SCATTER_KINDS].sort()).toEqual(['archer', 'hound', 'soldier', 'wraith']);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/world/__tests__/spawnScatter.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `src/world/spawnScatter.ts`:

```ts
import type { EnemySpawn, ZoneDef } from './zoneDef';

/** Kinds that may drift to a neighbouring cell on each (re)spawn.
 *  The Forsworn arena is authored; a Kneeling Hollow that moved apart from
 *  its inert twin would mark which one is real. */
export const SCATTER_KINDS: ReadonlySet<string> = new Set(['soldier', 'archer', 'wraith', 'hound']);

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

/** Scatter targets are strictly plain floor — never doors, banners, the
 *  player spawn, void, or zone-letter tiles that aren't mapped to floor. */
function plainFloor(def: ZoneDef, row: number, col: number): boolean {
  const ch = def.grid[row]?.[col];
  if (ch === undefined) return false;
  return ch === '.' || def.tiles[ch] === 'floor';
}

/** The Amnesia countermeasure: re-deal each common enemy onto its own cell or
 *  a plain-floor neighbour so no two attempts replay the learned roster.
 *  Exactly one rng draw per scatterable spawn; the authored cell is kept when
 *  nothing nearby is free. Order (and therefore enemy ids) is preserved. */
export function scatterSpawns(def: ZoneDef, rng: () => number): EnemySpawn[] {
  const key = (r: number, c: number): string => `${r},${c}`;
  const taken = new Set<string>();
  for (const s of def.enemies) {
    if (!SCATTER_KINDS.has(s.kind)) taken.add(key(s.at[0], s.at[1]));
  }
  return def.enemies.map((spawn) => {
    if (!SCATTER_KINDS.has(spawn.kind)) return spawn;
    const [r, c] = spawn.at;
    const candidates: Array<readonly [number, number]> = NEIGHBOURS
      .map(([dr, dc]) => [r + dr, c + dc] as const)
      .filter(([nr, nc]) => plainFloor(def, nr, nc) && !taken.has(key(nr, nc)));
    if (plainFloor(def, r, c) && !taken.has(key(r, c))) candidates.push([r, c] as const);
    const roll = rng();
    if (candidates.length === 0) {
      taken.add(key(r, c));
      return spawn;
    }
    const [nr, nc] = candidates[Math.floor(roll * candidates.length) % candidates.length];
    taken.add(key(nr, nc));
    return { ...spawn, at: [nr, nc] as EnemySpawn['at'] };
  });
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/world/__tests__/spawnScatter.test.ts` → PASS (8 tests).

- [ ] **Step 5: Wire into main.ts.** Next to `houndRng` (`src/main.ts:555`) add a per-wave rng factory:

```ts
// P1: every spawn wave (zone entry AND kneel respawn) deals from a fresh
// stream so a retry never replays the roster the player just memorized.
let spawnWave = 0;
const nextScatterRng = (): (() => number) =>
  mulberry32((runSeed ^ (++spawnWave * 0x9e3779b9)) >>> 0);
```

Inside `spawnEnemies()` (`src/main.ts:1563`), replace `built.spawns.forEach((spawn, i) => {` with:

```ts
const spawns = scatterSpawns(activeDef, nextScatterRng());
spawns.forEach((spawn, i) => {
```

(`activeDef` is the current `ZoneDef`; `enterZone` assigns it before calling `spawnEnemies`, and the kneel-respawn path runs inside an active zone. `built.spawns === activeDef.enemies` — verify this assumption holds at both call sites before committing; if `built.spawns` can diverge from `activeDef.enemies`, scatter `built.spawns`' owning def instead.) Add the import: `import { scatterSpawns } from './world/spawnScatter';`

- [ ] **Step 6: Full suite** — `npm test` → 815 + 8 new pass. `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/world/spawnScatter.ts src/world/__tests__/spawnScatter.test.ts src/main.ts
git commit -m "feat(world): scatter common spawns on every wave — no memorized retries (P1)"
```

---

### Task 2 (P2): Ember wisps bank until the brand quiets

`Brand.onEnemySlain` (`src/player/Brand.ts:102-109`) currently grants +1 ember every 3rd kill immediately — sustained fighting heals the player mid-fight, inverting the vulnerability curve. Keep the economy identical but defer the payout until the threat pulse is silent.

**Files:**
- Modify: `src/player/Brand.ts`
- Test: `src/player/__tests__/brand.test.ts` (add cases), `src/entities/__tests__/fsm.test.ts:342-383` (update the `Brand — ember wisp counter` suite: payouts now require a quiet tick)

**Interfaces:**
- Consumes: existing `Brand` fields `pulse`, `kills`, `embers`, `cap()`, `applyDesaturation()`; bus event `enemy-slain` (self-subscribed in ctor — do NOT add another subscription).
- Produces: no API change. New private state `pendingEmbers`. Payout happens inside `tick()`.

- [ ] **Step 1: Write the failing tests** — append to `src/player/__tests__/brand.test.ts` (reuse the file's `makeBrand()` helper; filter `events` by type since `tick` also emits `brand-pulse`):

```ts
const gained = (events: Array<{ type: string }>) => events.filter((e) => e.type === 'ember-gained');

describe('ember wisps bank until the brand quiets (P2)', () => {
  it('the third kill banks while a threat pulses, pays out on the first quiet tick', () => {
    const { brand, events, bus } = makeBrand();
    brand.damage(2); // 3 of 5 — room to gain
    brand.tick(16, 6, null); // enemy at 6 m: pulse > 0, combat is live
    for (let i = 0; i < 3; i++) bus.emit({ type: 'enemy-slain' });
    expect(brand.embers).toBe(3); // no mid-fight heal
    brand.tick(16, 6, null);
    expect(brand.embers).toBe(3); // still pulsing, still banked
    brand.tick(16, null, null); // threat gone — the wisp arrives
    expect(brand.embers).toBe(4);
    expect(gained(events)).toEqual([{ type: 'ember-gained', total: 4 }]);
  });

  it('pays out immediately on a quiet tick when no threat was near', () => {
    const { brand, events, bus } = makeBrand();
    brand.damage(1);
    for (let i = 0; i < 3; i++) bus.emit({ type: 'enemy-slain' });
    expect(brand.embers).toBe(4); // not yet — payout is tick-driven
    brand.tick(16, null, null);
    expect(brand.embers).toBe(5);
    expect(gained(events)).toEqual([{ type: 'ember-gained', total: 5 }]);
  });

  it('two banked wisps pay out together when the fight ends', () => {
    const { brand, bus } = makeBrand();
    brand.damage(3); // 2 of 5
    brand.tick(16, 4, null);
    for (let i = 0; i < 6; i++) bus.emit({ type: 'enemy-slain' });
    expect(brand.embers).toBe(2);
    brand.tick(16, null, null);
    expect(brand.embers).toBe(4);
  });

  it('a wisp gutters out if the brand is already full when it would arrive', () => {
    const { brand, events, bus } = makeBrand();
    for (let i = 0; i < 3; i++) bus.emit({ type: 'enemy-slain' });
    brand.tick(16, null, null); // full at 5 — wisp discarded, not carried
    expect(brand.embers).toBe(5);
    expect(gained(events)).toEqual([]);
    brand.damage(1);
    brand.tick(16, null, null); // the discarded wisp must NOT arrive late
    expect(brand.embers).toBe(4);
  });

  it('rekindle clears any banked wisps', () => {
    const { brand, events, bus } = makeBrand();
    brand.damage(2);
    brand.tick(16, 6, null);
    for (let i = 0; i < 3; i++) bus.emit({ type: 'enemy-slain' });
    brand.rekindle('test-banner');
    brand.damage(1);
    brand.tick(16, null, null);
    expect(brand.embers).toBe(4); // no stale wisp from before the kneel
    expect(gained(events)).toEqual([]);
  });
});
```

(If `makeBrand()` doesn't return `bus`, extend the helper to return it — it already constructs one.)

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/player/__tests__/brand.test.ts` → new cases FAIL (embers gained immediately).

- [ ] **Step 3: Implement** — in `src/player/Brand.ts`:

Add field next to `kills` (line ~62):

```ts
/** Wisps earned in combat but not yet granted — they arrive only once the
 *  brand falls silent, so fighting never heals you mid-fight (P2). */
private pendingEmbers = 0;
```

Replace `onEnemySlain` (102-109) with:

```ts
onEnemySlain(): void {
  this.kills += 1;
  if (this.kills % 3 !== 0) return;
  this.pendingEmbers += 1;
}
```

Add the redeem step inside `tick()` immediately after `this.pulse` is assigned:

```ts
if (this.pendingEmbers > 0 && this.pulse === 0) this.redeemWisps();
```

Add the private method:

```ts
/** Grant banked wisps now that the brand is quiet. A wisp that arrives while
 *  the knight is hollow or already full gutters out — same discard the old
 *  instant-grant applied at kill time. */
private redeemWisps(): void {
  while (this.pendingEmbers > 0) {
    this.pendingEmbers -= 1;
    if (this.hollowed || this.embers >= this.cap()) continue;
    this.embers += 1;
    this.deps.bus.emit({ type: 'ember-gained', total: this.embers });
    this.applyDesaturation();
  }
}
```

In `rekindle()` add `this.pendingEmbers = 0;` alongside the existing resets.

- [ ] **Step 4: Update the cross-module suite** — `src/entities/__tests__/fsm.test.ts:342-383` (`Brand — ember wisp counter`): after each batch of Soldier kills, add a quiet tick `brand.tick(16, null, null);` before asserting ember totals (payout is now tick-driven). Keep the suite's intent (3 kills → +1, cap respected) — only insert the quiet ticks and, if a case kills with a live threat nearby, assert the pre-tick total is unchanged first.

- [ ] **Step 5: Run** — `npx vitest run src/player/__tests__/brand.test.ts src/entities/__tests__/fsm.test.ts` → PASS. Then `npm test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/player/Brand.ts src/player/__tests__/brand.test.ts src/entities/__tests__/fsm.test.ts
git commit -m "feat(player): ember wisps bank until the brand quiets — no mid-fight healing (P2)"
```

---

### Task 3 (P3): Ash-Hound committed pursuit after recover

Player walkSpeed 3.2 (`src/content/tuning.ts:4`) out-walks every base enemy — retreat is a universal free answer. After its lunge recover, the hound now commits to a bounded pursuit faster than a walking player.

**Files:**
- Modify: `src/content/tuning.ts` (hound block, lines 79-84), `src/entities/AshHound.ts`, the `EnemyState` union (in `src/entities/Enemy.ts` — confirm exact location by reading the union), `src/entities/HoundView.ts` (or wherever `HoundView` maps `logic.state` → animation clip)
- Test: `src/entities/__tests__/ashHound.test.ts` (add cases)

**Interfaces:**
- Consumes: `stepToward(...)` (AshHound.ts:201-208 — mirror the exact call the `approach` branch makes at ~line 107), `enterCircle()`, `LEASH_M`, existing FSM switch in `think()`.
- Produces: new tuning `TUNING.greaterVael.hound.pursuit = { speedM: 3.7, maxMs: 2200 }`; new FSM state literal `'pursuit'`.

- [ ] **Step 1: Write the failing tests** — append to `src/entities/__tests__/ashHound.test.ts`, reusing that file's existing `collider`/`ctx`/`run`/`until` helpers and its fake-rng pattern. The player position is whatever the test's `ctx` provides — move it between steps to control distance:

```ts
describe('pursuit after recover (P3)', () => {
  it('leaves recover into pursuit, and pursuit outruns the player walk', () => {
    // (build hound + ctx exactly as the existing attack-cycle tests do,
    //  drive to 'attack' with until(), hold the player ~5 m away, then:)
    until(h, ctx, 'recover');
    run(h, ctx, TUNING.greaterVael.hound.lunge.recoverMs);
    expect(h.state).toBe('pursuit');
    const before = { x: h.pos.x, z: h.pos.z };
    h.update(16, ctx);
    const step = Math.hypot(h.pos.x - before.x, h.pos.z - before.z);
    expect(step).toBeCloseTo(TUNING.greaterVael.hound.pursuit.speedM * (16 / 1000), 3);
    expect(TUNING.greaterVael.hound.pursuit.speedM).toBeGreaterThan(TUNING.player.walkSpeed);
  });

  it('pursuit collapses into the circle when it closes to circle radius', () => {
    // enter pursuit as above, then teleport the player to ~5 m (inside
    // circle.radiusM 6): next update must call enterCircle → state 'circle'
  });

  it('pursuit gives up after maxMs and resumes approach', () => {
    // enter pursuit, then each 16 ms step teleport the player so distance
    // stays ~10 m (outside circle radius, inside leash 19.5); after
    // pursuit.maxMs total the state must be 'approach'
  });

  it('pursuit leashes to idle beyond LEASH_M', () => {
    // enter pursuit, teleport the player to 25 m: next update → 'idle'
  });
});
```

Write the four cases fully — the comments above define the exact scenario each must construct with the file's existing helpers; no new helper style.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/entities/__tests__/ashHound.test.ts` → FAIL (`pursuit` tuning/state missing; hound goes recover → approach).

- [ ] **Step 3: Implement.**

`src/content/tuning.ts` — inside the `hound` block after `lunge` (line 82):

```ts
/** P3: bounded committed chase after a missed pounce — the one common
 *  threat a walking player cannot simply out-walk (player walkSpeed 3.2). */
pursuit: { speedM: 3.7, maxMs: 2200 },
```

`src/entities/AshHound.ts`:
- Alias next to the others (~36-42): `const P = H.pursuit;`
- Field: `private pursuitT = 0;`
- `recover` branch (176-182): on completion set `this.pursuitT = 0; this.state = 'pursuit';` (was `'approach'`).
- New branch in `think()`:

```ts
case 'pursuit': {
  if (dist > LEASH_M) { this.state = 'idle'; break; }
  if (dist <= C.radiusM) { this.enterCircle(); break; }
  this.pursuitT += dt;
  if (this.pursuitT >= P.maxMs) { this.state = 'approach'; break; }
  // mirror the approach branch's exact stepToward + pant calls, at P.speedM
  break;
}
```

- Add `'pursuit'` to the `EnemyState` union (read `src/entities/Enemy.ts` to find it; if the union is elsewhere, follow the import).
- `HoundView`: wherever it maps `state` → animation, treat `'pursuit'` exactly like `'approach'` (run clip, same pant cadence).

- [ ] **Step 4: Run** — `npx vitest run src/entities/__tests__/ashHound.test.ts` → PASS. Then `npm test` → all pass (watch for other exhaustive-switch sites over `EnemyState`; fix each by treating `'pursuit'` like `'approach'`).

- [ ] **Step 5: Commit**

```bash
git add src/content/tuning.ts src/entities/AshHound.ts src/entities/Enemy.ts src/entities/HoundView.ts src/entities/__tests__/ashHound.test.ts
git commit -m "feat(entities): ash-hound commits to a pursuit after recover — retreat is no longer free (P3)"
```

---

### Task 4 (P4): Six forward-dread inscriptions

The 44-entry base corpus is elegiac; the Watcher is seeded by ONE off-path line; Summit and Throne have `lore: []`. Add six present-tense, threat-ahead entries in the house voice ("image, then a turn that darkens it" — see `src/content/lore.ts:1-26` canon comment).

**Files:**
- Modify: `src/content/lore.ts` (6 new entries), `src/content/zones/summit.ts:48`, `src/content/zones/throne.ts:64`, `src/content/zones/gateFields.ts:109-115`, `src/content/zones/cinderVillage.ts:105-111`, `src/content/zones/pilgrimsDescent.ts:103-108`, `src/content/zones/greatHall.ts:68-75` (one `LoreSpot` each)
- Test: `src/content/__tests__/lore.test.ts:27-34` (counts 44→50 base, 52→58 total)

**Interfaces:**
- Consumes: `LORE: Record<string, LoreEntry>` and `LoreSpot { id, at }`. Structural tests enforce: unique ids, every base entry placed, spots on plain floor cells (`zones.test.ts:159-167, 595-603`).
- Produces: six new ids (below) — nothing else consumes them by name.

- [ ] **Step 1: Update the count test first (failing)** — `src/content/__tests__/lore.test.ts:27-34`: base `44`→`50`, total `52`→`58`. Run `npx vitest run src/content/__tests__/lore.test.ts` → FAIL (counts).

- [ ] **Step 2: Add the six entries to `src/content/lore.ts`** (exact prose — do not rewrite; place near their zones' existing blocks):

```ts
'summit-climbers-cairn': {
  title: 'A Cairn of Helms',
  body: 'Seven helms stacked beside the stair, each older than the last, polished by wind where hands once polished them. Seven knights climbed past this stone to ask the Flame for more time. The stair remembers no one coming down. Count the helms again before you climb.',
},
'throne-doors-scored': {
  title: 'The Scored Doors',
  body: 'The doors to the throne hang scored from the inside — long, patient grooves at the height of a kneeling man, worn smooth as the oath-stone. Whatever asked to be let out did not shout. It knelt, and it scratched, and it waited to be heard. It is quieter now than it has ever been.',
},
'gv-fields-standing-stone': {
  title: 'The Standing Stone',
  body: 'A waystone for pilgrims, its distances chiselled and sure: THE VILLAGE, ONE MILE. THE FORGE-ROAD, TWO. Beneath, in newer cuts that wander like a man walking backward: it stands where the fog begins. it was nearer when i finished this line than when i began it.',
},
'gv-village-shutter-tally': {
  title: 'A Tally on the Shutter',
  body: 'Someone kept count on the shutter of the last lit house: four days, eleven marks. The marks are not of days. The last one is cut deeper, dragged, as if the counter looked up mid-stroke and did not look down again. The shutter faces the fog.',
},
'gv-descent-hold-the-rail': {
  title: "The Pilgrim's Rail",
  body: "The rope rail is knotted every arm's length, each knot worn black by a hundred descending hands. Some knots are worn from the underside. Something has climbed this descent from below, hand over hand, more than once. If the rail trembles, it is not the wind. Do not look down to check.",
},
'hall-set-places': {
  title: 'The Set Places',
  body: 'The long table is laid for a feast no one ate — bowls, knives, a cup at every place. But the benches are pushed back all on one side, in one motion, the way men stand when a door opens that they did not expect. The door they watched is the one you are about to use.',
},
```

- [ ] **Step 3: Place one `LoreSpot` per zone.** Read each zone's `grid` and choose a plain `'.'` floor cell ON or immediately beside the main path (NOT off-path — that was the audit's complaint): `summit-climbers-cairn` → `summit.ts` (`lore: []` → one spot near the stair approach); `throne-doors-scored` → `throne.ts` (before the throne doors); `gv-fields-standing-stone` → `gateFields.ts`; `gv-village-shutter-tally` → `cinderVillage.ts`; `gv-descent-hold-the-rail` → `pilgrimsDescent.ts`; `hall-set-places` → `greatHall.ts`. The structural tests reject non-floor cells and orphans — let them validate your choices.

- [ ] **Step 4: Run** — `npx vitest run src/content/__tests__/lore.test.ts src/content/__tests__/zones.test.ts` → PASS. Then `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/lore.ts src/content/zones/*.ts src/content/__tests__/lore.test.ts
git commit -m "feat(content): six forward-dread inscriptions — the lore now warns, not only mourns (P4)"
```

---

### Task 5 (P5): HD scare parity + settings caption

In HD, snap-spike and res-drop scares silently no-op (`src/main.ts:2628-2653`) — the beat fires, nothing renders. Give HD held fog+desat riders (scene fog and the desat uniform both survive HD), and caption the Graphics toggle in-fiction. HD's baseline (non-scare) look must not change.

**Files:**
- Modify: `src/engine/ScreenScareKit.ts` (constants + pure helper), `src/main.ts` (fog site ~2607-2614, desat site ~2656, hoist `hdMode` from 2627), `src/ui/settings.ts` (caption under the Graphics seg row, ~411-424)
- Test: the ScreenScareKit test file under `src/engine/__tests__/` (add `hdScareRider` cases)

**Interfaces:**
- Consumes: `scareKit.snapRes(): [number,number]|null`, `scareKit.renderDrop(): boolean` (pure getters, safe to call twice per frame); `fog.far` clamp pattern at `main.ts:2611-2614`; `pipeline.setDesaturation(...)` line 2656.
- Produces: `hdScareRider(snapActive: boolean, dropActive: boolean): { fogFar: number | null; desatFloor: number }` + exported constants.

- [ ] **Step 1: Write the failing tests** — in the ScreenScareKit test file:

```ts
import { hdScareRider, HD_SNAP_FOG_FAR, HD_DROP_FOG_FAR, HD_SNAP_DESAT, HD_DROP_DESAT } from '../ScreenScareKit';

describe('hdScareRider (P5)', () => {
  it('is inert when no scare holds', () => {
    expect(hdScareRider(false, false)).toEqual({ fogFar: null, desatFloor: 0 });
  });
  it('res-drop rides on fog and desat', () => {
    expect(hdScareRider(false, true)).toEqual({ fogFar: HD_DROP_FOG_FAR, desatFloor: HD_DROP_DESAT });
  });
  it('snap rides harder than the drop', () => {
    expect(hdScareRider(true, false)).toEqual({ fogFar: HD_SNAP_FOG_FAR, desatFloor: HD_SNAP_DESAT });
    expect(HD_SNAP_FOG_FAR).toBeLessThan(HD_DROP_FOG_FAR);
    expect(HD_SNAP_DESAT).toBeGreaterThan(HD_DROP_DESAT);
  });
  it('overlapping holds take the harder of each channel', () => {
    expect(hdScareRider(true, true)).toEqual({ fogFar: HD_SNAP_FOG_FAR, desatFloor: HD_SNAP_DESAT });
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement in `src/engine/ScreenScareKit.ts`:

```ts
/** P5 — HD riders. In HD the snap/res-drop PS1 artifice cannot render, so the
 *  beat leans on what survives HD: scene fog and the desaturation uniform.
 *  Held envelopes (the kit's ≥500 ms holds), never strobed — flicker-safe by
 *  construction. Baseline (non-scare) HD frames are untouched. */
export const HD_SNAP_FOG_FAR = 7;   // m — hard pull-in while the snap holds
export const HD_DROP_FOG_FAR = 9;   // m — softer pull-in for the res-drop beat
export const HD_SNAP_DESAT = 0.35;
export const HD_DROP_DESAT = 0.25;

export interface HdScareRider { fogFar: number | null; desatFloor: number }

export function hdScareRider(snapActive: boolean, dropActive: boolean): HdScareRider {
  let fogFar: number | null = null;
  let desatFloor = 0;
  if (dropActive) { fogFar = HD_DROP_FOG_FAR; desatFloor = HD_DROP_DESAT; }
  if (snapActive) {
    fogFar = fogFar === null ? HD_SNAP_FOG_FAR : Math.min(fogFar, HD_SNAP_FOG_FAR);
    desatFloor = Math.max(desatFloor, HD_SNAP_DESAT);
  }
  return { fogFar, desatFloor };
}
```

- [ ] **Step 3: Wire main.ts.** Hoist the existing `const hdMode = pipeline.getRenderMode() === 'hd';` (line 2627) ABOVE the fog application block (~2607) and delete the original. After the existing low-fog scare-band clamp (2611-2614):

```ts
// P5: in HD the snap/res-drop artifice can't render — ride the beat on fog
// + desat instead (both survive HD). PS1 behaviour below is unchanged.
const hdRider = hdMode ? hdScareRider(scareKit.snapRes() !== null, scareKit.renderDrop()) : null;
if (hdRider?.fogFar != null) fog.far = Math.min(fog.far, hdRider.fogFar);
```

Change the desat line (2656) to:

```ts
pipeline.setDesaturation(Math.max(pipeline.getDesaturation(), scareKit.desatBoost(), hdRider?.desatFloor ?? 0));
```

The `!hdMode` gates on the PS1 branches (2628-2653) stay exactly as they are. Import `hdScareRider` from the kit.

- [ ] **Step 4: Settings caption** — `src/ui/settings.ts`. Settings rows have no description infra (labels only). Add a small private helper matching the panel's existing inline-style idiom (read the neighbouring row/group builders and reuse their font/color variables) and append it directly under the Graphics seg row (~411-424):

```ts
picture.append(
  this.segRow('Graphics', [ /* …unchanged PS1/HD options… */ ]),
  this.caption('The fog thins in HD, and so does the dread. The Vigil burns truest on PS1.'),
  /* …rest unchanged… */
```

```ts
/** One-line in-fiction caption under a control (first use: Graphics). */
private caption(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'font-size:11px;line-height:1.5;opacity:.55;letter-spacing:.04em;margin:-4px 0 10px;';
  return el;
}
```

- [ ] **Step 5: Run** — `npx vitest run src/engine src/ui/__tests__/settings.test.ts` → PASS; `npm test` → all pass; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/ScreenScareKit.ts src/main.ts src/ui/settings.ts src/engine/__tests__/*
git commit -m "feat(render): HD scare riders on fog+desat, in-fiction Graphics caption (P5)"
```

---

## Final gate (after all five tasks)

- `npm test` — full unit suite green.
- `npx tsc --noEmit` and `npm run build` — clean.
- Whole-branch review (superpowers:requesting-code-review), then STOP: merge/ship is the owner's call (feat/realism merge is still pending its own playtest).
