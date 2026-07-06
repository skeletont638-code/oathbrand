/**
 * Enemy FSM base + Hollow Soldier (Task 9) — pure fixed-step tests, no
 * renderer. Real GridCollider for steering/LOS, real EventBus, real Brand
 * for the guard-block and ember-wisp chains.
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TUNING } from '../../content/tuning';
import { EventBus } from '../../engine/events';
import type { GameEvent } from '../../engine/events';
import { Brand } from '../../player/Brand';
import { Combat, inArc } from '../../player/Combat';
import { GridCollider } from '../../world/collision';
import type { ZoneDef } from '../../world/zoneDef';
import type { EnemyCtx, EnemyState } from '../Enemy';
import { Soldier } from '../Soldier';

const S = TUNING.enemies.soldier;
const { light, radius: playerRadius, guardShoveM } = TUNING.player;

function collider(grid: string[]): GridCollider {
  const def: ZoneDef = {
    id: 'ashen-gate',
    grid,
    cell: 2,
    tiles: {},
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
  };
  return new GridCollider(def);
}

/** Open room: floor spans x ∈ (2, 2(cols-1)), z ∈ (2, 2(rows-1)). */
function openRoom(cols: number, rows: number): GridCollider {
  const wall = '#'.repeat(cols);
  const mid = `#${'.'.repeat(cols - 2)}#`;
  return collider([wall, ...Array.from({ length: rows - 2 }, () => mid), wall]);
}

const OPEN = openRoom(14, 8); // x ∈ (2, 26), z ∈ (2, 14)

interface World {
  bus: EventBus;
  hits: GameEvent[];
  slain: GameEvent[];
  gained: GameEvent[];
}

function makeWorld(): World {
  const bus = new EventBus();
  const hits: GameEvent[] = [];
  const slain: GameEvent[] = [];
  const gained: GameEvent[] = [];
  bus.on('player-hit', (e) => hits.push(e));
  bus.on('enemy-slain', (e) => slain.push(e));
  bus.on('ember-gained', (e) => gained.push(e));
  return { bus, hits, slain, gained };
}

function makeCtx(grid: GridCollider, x: number, z: number): EnemyCtx {
  return { playerPos: new Vector3(x, 0, z), playerHollow: false, collider: grid, canSeePlayer: true };
}

/** Advance in fixed 16ms steps for at least `ms`. */
function run(s: Soldier, ctx: EnemyCtx, ms: number): void {
  for (let t = 0; t < ms; t += 16) s.update(16, ctx);
}

/** Step 16ms frames until `state` (asserts it is reached). Returns elapsed ms. */
function until(s: Soldier, ctx: EnemyCtx, state: EnemyState, maxMs = 10_000): number {
  let t = 0;
  while (s.state !== state && t < maxMs) {
    s.update(16, ctx);
    t += 16;
  }
  expect(s.state).toBe(state);
  return t;
}

function makeSoldier(world: World, x: number, z: number, defense?: { blockMelee(from: { x: number; z: number }): boolean }): Soldier {
  const s = new Soldier({ id: 's1', bus: world.bus, defense });
  s.pos.set(x, 0, z);
  return s;
}

describe('Soldier FSM — aggro', () => {
  it('idle → alert on LOS within aggroM (TDD)', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 4, 8);
    const ctx = makeCtx(OPEN, 4 + S.aggroM - 0.5, 8);
    s.update(16, ctx);
    expect(s.state).toBe('alert');
  });

  it('stays idle when the player is in range but LOS is blocked', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 4, 8);
    const ctx = makeCtx(OPEN, 4 + S.aggroM - 0.5, 8);
    ctx.canSeePlayer = false;
    run(s, ctx, 1000);
    expect(s.state).toBe('idle');
  });

  it('stays idle when the player is visible but beyond aggroM', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 4, 8);
    const ctx = makeCtx(OPEN, 4 + S.aggroM + 1, 8);
    run(s, ctx, 1000);
    expect(s.state).toBe('idle');
  });

  it('raycastWall-based LOS matches the wiring convention (wall blocks sight)', () => {
    // 2-cell wall pillar between soldier and player.
    const grid = collider([
      '##########',
      '#........#',
      '#...##...#',
      '#........#',
      '##########',
    ]);
    const s = makeSoldier(makeWorld(), 6, 5);
    const ctx = makeCtx(grid, 14, 5); // dist 8 ≤ aggroM, but a wall between
    ctx.canSeePlayer = !grid.raycastWall(s.pos, ctx.playerPos);
    expect(ctx.canSeePlayer).toBe(false);
    run(s, ctx, 1000);
    expect(s.state).toBe('idle');
  });
});

describe('Soldier FSM — approach + attack', () => {
  it('alert → approach after the alert beat, then closes distance at speed', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 4, 8);
    const ctx = makeCtx(OPEN, 12, 8);
    until(s, ctx, 'alert');
    until(s, ctx, 'approach', S.alertMs + 100);
    const before = ctx.playerPos.x - s.pos.x;
    run(s, ctx, 1000);
    const after = ctx.playerPos.x - s.pos.x;
    expect(after).toBeLessThan(before);
    expect(before - after).toBeCloseTo(S.speed, 1); // ~speed m/s straight line
  });

  it('→ attack when within attack range (TDD: attack in range)', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 5 + S.attack.rangeM - 0.4);
    until(s, ctx, 'attack');
    expect(s.state).toBe('attack');
  });

  it('telegraph: no player-hit during windup, exactly one at active, then recover', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 6.4); // dist 1.4 ≤ rangeM
    until(s, ctx, 'attack');
    run(s, ctx, S.attack.windupMs - 64); // still winding up
    expect(w.hits).toHaveLength(0);
    run(s, ctx, 128); // crosses into active → connect
    expect(w.hits).toEqual([{ type: 'player-hit', damage: S.attack.damage }]);
    until(s, ctx, 'recover', S.attack.activeMs + 100);
    until(s, ctx, 'approach', S.attack.recoverMs + 100);
  });

  it('hit test is circle-vs-player-radius: connects just inside rangeM + radius, whiffs beyond', () => {
    // Just inside the reach.
    const w1 = makeWorld();
    const s1 = makeSoldier(w1, 8, 5);
    const ctx1 = makeCtx(OPEN, 8, 5 + S.attack.rangeM - 0.01);
    until(s1, ctx1, 'attack');
    ctx1.playerPos.z = 5 + S.attack.rangeM + playerRadius - 0.05; // still in reach
    run(s1, ctx1, S.attack.windupMs + S.attack.activeMs + 64);
    expect(w1.hits).toHaveLength(1);

    // Player steps out during the windup → whiff.
    const w2 = makeWorld();
    const s2 = makeSoldier(w2, 8, 5);
    const ctx2 = makeCtx(OPEN, 8, 6.4);
    until(s2, ctx2, 'attack');
    ctx2.playerPos.z = 5 + S.attack.rangeM + playerRadius + 0.3; // out of reach
    run(s2, ctx2, S.attack.windupMs + S.attack.activeMs + 64);
    expect(w2.hits).toHaveLength(0);
    until(s2, ctx2, 'recover', 100);
  });

  it('re-attacks after recovery — one hit per attack cycle', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 6.4);
    until(s, ctx, 'attack');
    const cycle = S.attack.windupMs + S.attack.activeMs + S.attack.recoverMs;
    run(s, ctx, cycle * 2 + 200);
    expect(w.hits.length).toBe(2);
  });

  it('straight-line steer slides against walls and never tunnels', () => {
    // Wall row between soldier and player; steering runs into it and stops.
    const grid = collider([
      '########',
      '#......#',
      '######.#',
      '#......#',
      '########',
    ]);
    const w = makeWorld();
    const s = makeSoldier(w, 3, 3);
    const ctx = makeCtx(grid, 3, 7);
    ctx.canSeePlayer = true; // forced: the steering, not LOS, is under test
    run(s, ctx, 3000);
    expect(s.state).toBe('approach');
    expect(s.pos.z).toBeGreaterThan(3); // moved toward the player…
    expect(s.pos.z).toBeLessThanOrEqual(4 - s.radius + 1e-6); // …but stopped at the wall
  });
});

describe('Soldier FSM — hollow player is beneath notice', () => {
  it('collapses to idle mid-approach and stays there (TDD)', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 4, 8);
    const ctx = makeCtx(OPEN, 12, 8);
    until(s, ctx, 'approach');
    run(s, ctx, 200);
    expect(s.state).toBe('approach');
    ctx.playerHollow = true;
    s.update(16, ctx);
    expect(s.state).toBe('idle');
    const frozen = { x: s.pos.x, z: s.pos.z };
    run(s, ctx, 1000);
    expect(s.state).toBe('idle');
    expect(s.pos.x).toBe(frozen.x);
    expect(s.pos.z).toBe(frozen.z);
  });

  it('collapses out of an attack too, and re-alerts after rekindle', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 6.4);
    until(s, ctx, 'attack');
    ctx.playerHollow = true;
    run(s, ctx, S.attack.windupMs + S.attack.activeMs + 64);
    expect(s.state).toBe('idle');
    expect(w.hits).toHaveLength(0); // the swing was abandoned, not landed
    ctx.playerHollow = false;
    s.update(16, ctx);
    expect(s.state).toBe('alert');
  });
});

describe('Soldier — guard block chain (Combat + Brand)', () => {
  function guardScenario(guarding: boolean, yaw: number) {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    w.bus.on('player-hit', (e) => brand.damage(e.damage));
    // ONE live position shared by pose and ctx, exactly like main wiring.
    const playerPos = new Vector3(8, 0, 6.5);
    const pose = { pos: playerPos, yaw };
    const combat = new Combat({ pose, collider: () => OPEN });
    if (guarding) combat.tryGuard(true);
    const s = makeSoldier(w, 8, 5, combat); // 1.5m dead ahead of yaw-0 player
    const ctx: EnemyCtx = { playerPos, playerHollow: false, collider: OPEN, canSeePlayer: true };
    until(s, ctx, 'attack');
    run(s, ctx, S.attack.windupMs + S.attack.activeMs + 64);
    return { w, brand, playerPos };
  }

  it('guard during enemy active ⇒ 0 embers lost + shove guardShoveM (TDD)', () => {
    const { w, brand, playerPos } = guardScenario(true, 0); // yaw 0 faces -z → soldier frontal
    expect(brand.embers).toBe(TUNING.brand.maxEmbers);
    expect(w.hits).toHaveLength(0);
    // Shoved straight away from the attacker (+z), through open floor.
    expect(playerPos.x).toBeCloseTo(8, 6);
    expect(playerPos.z).toBeCloseTo(6.5 + guardShoveM, 4);
  });

  it('unguarded control: the same hit burns one ember', () => {
    const { w, brand, playerPos } = guardScenario(false, 0);
    expect(brand.embers).toBe(TUNING.brand.maxEmbers - 1);
    expect(w.hits).toEqual([{ type: 'player-hit', damage: S.attack.damage }]);
    expect(playerPos.z).toBe(6.5); // no shove
  });

  it('guard facing away does not block (frontal-only)', () => {
    const { brand, playerPos } = guardScenario(true, Math.PI); // facing +z, soldier behind
    expect(brand.embers).toBe(TUNING.brand.maxEmbers - 1);
    expect(playerPos.z).toBe(6.5);
  });
});

describe('Soldier — death', () => {
  it('takeHit(3) → dead and enemy-slain exactly once (TDD)', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 8, 8);
    s.takeHit(3);
    expect(s.state).toBe('dead');
    expect(s.hp).toBe(0);
    expect(w.slain).toEqual([{ type: 'enemy-slain', enemyId: 's1', kind: 'soldier' }]);
    s.takeHit(1); // beating a corpse does nothing
    expect(w.slain).toHaveLength(1);
    const ctx = makeCtx(OPEN, 9, 8);
    run(s, ctx, 500); // dead soldiers do not think
    expect(s.state).toBe('dead');
  });

  it('three takeHit(1) also kill; non-fatal hits flag hurtMs without changing state', () => {
    const w = makeWorld();
    const s = makeSoldier(w, 4, 8);
    const ctx = makeCtx(OPEN, 12, 8);
    until(s, ctx, 'approach');
    s.takeHit(1);
    expect(s.state).toBe('approach');
    expect(s.hurtMs).toBeGreaterThan(0);
    run(s, ctx, 1000);
    expect(s.hurtMs).toBe(0); // decays
    s.takeHit(1);
    s.takeHit(1);
    expect(s.state).toBe('dead');
    expect(w.slain).toHaveLength(1);
  });

  it('the full player kill loop: three light swings via hitArc + inArc', () => {
    const w = makeWorld();
    const pose = { pos: { x: 8, z: 8 }, yaw: 0 }; // facing -z
    const combat = new Combat({ pose, collider: () => OPEN });
    const s = makeSoldier(w, 8, 6.4); // 1.6m dead ahead
    for (let i = 0; i < 3; i++) {
      expect(combat.tryLight()).toBe(true);
      combat.update(light.windupMs);
      const arc = combat.hitArc();
      expect(arc).not.toBeNull();
      if (inArc(arc!, s.pos, s.radius)) s.takeHit(arc!.damage);
      combat.update(light.activeMs + light.recoverMs);
    }
    expect(s.state).toBe('dead');
    expect(w.slain).toEqual([{ type: 'enemy-slain', enemyId: 's1', kind: 'soldier' }]);
  });
});

describe('Brand — ember wisp counter (+1 per 3 kills)', () => {
  function killOne(w: World, id: string): void {
    const s = new Soldier({ id, bus: w.bus });
    s.takeHit(3);
  }

  it('every 3rd enemy-slain grants +1 ember when embers < max (on the next quiet tick)', () => {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    brand.damage(2); // 3/5 embers
    killOne(w, 'a');
    killOne(w, 'b');
    expect(brand.embers).toBe(3);
    expect(w.gained).toHaveLength(0);
    killOne(w, 'c');
    expect(brand.embers).toBe(3); // banked, not granted mid-fight
    expect(w.gained).toHaveLength(0);
    brand.tick(16, null, null); // brand falls silent — the wisp arrives
    expect(brand.embers).toBe(4);
    expect(w.gained).toEqual([{ type: 'ember-gained', total: 4 }]);
  });

  it('no gain at full embers (kills still count)', () => {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    killOne(w, 'a');
    killOne(w, 'b');
    killOne(w, 'c');
    brand.tick(16, null, null); // quiet — but full, so the wisp gutters out
    expect(brand.embers).toBe(TUNING.brand.maxEmbers);
    expect(w.gained).toHaveLength(0);
  });

  it('no gain while hollow — rekindling is the only way back', () => {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    brand.damage(TUNING.brand.maxEmbers);
    expect(brand.hollow).toBe(true);
    killOne(w, 'a');
    killOne(w, 'b');
    killOne(w, 'c');
    brand.tick(16, null, null); // quiet — but hollow, so no wisp arrives
    expect(brand.embers).toBe(0);
    expect(brand.hollow).toBe(true);
    expect(w.gained).toHaveLength(0);
  });
});
