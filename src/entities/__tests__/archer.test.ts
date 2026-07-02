/**
 * Hollow Archer + Projectile (Task 10) — pure fixed-step tests, no renderer.
 * Real GridCollider for steering/LOS/bolt-blocking, real EventBus, real
 * Combat + Brand for the projectile guard-block chain.
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TUNING } from '../../content/tuning';
import { EventBus } from '../../engine/events';
import type { GameEvent } from '../../engine/events';
import { Brand } from '../../player/Brand';
import { Combat } from '../../player/Combat';
import { GridCollider } from '../../world/collision';
import type { ZoneDef } from '../../world/zoneDef';
import type { EnemyCtx, MeleeDefense } from '../Enemy';
import { Archer } from '../Archer';
import { ProjectilePool } from '../Projectile';

const R = TUNING.enemies.archer;
const SHOT = R.shot;
const { guardShoveM } = TUNING.player;

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

const OPEN = openRoom(24, 12); // x ∈ (2, 46), z ∈ (2, 22)

interface World {
  bus: EventBus;
  hits: GameEvent[];
}

function makeWorld(): World {
  const bus = new EventBus();
  const hits: GameEvent[] = [];
  bus.on('player-hit', (e) => hits.push(e));
  return { bus, hits };
}

function makeCtx(grid: GridCollider, x: number, z: number): EnemyCtx {
  return { playerPos: new Vector3(x, 0, z), playerHollow: false, collider: grid, canSeePlayer: true };
}

function makeArcher(w: World, x: number, z: number, defense?: MeleeDefense) {
  const pool = new ProjectilePool({ bus: w.bus, defense });
  const a = new Archer({ id: 'a1', bus: w.bus, defense, shots: pool });
  a.pos.set(x, 0, z);
  return { a, pool };
}

/** Advance archer AND its bolts in fixed 16ms steps for at least `ms`. */
function run(a: Archer, pool: ProjectilePool, ctx: EnemyCtx, ms: number): void {
  for (let t = 0; t < ms; t += 16) {
    a.update(16, ctx);
    pool.update(16, ctx);
  }
}

describe('Archer FSM — aggro + reposition', () => {
  it('idle → alert on LOS within aggroM', () => {
    const w = makeWorld();
    const { a } = makeArcher(w, 4, 8);
    const ctx = makeCtx(OPEN, 4 + R.aggroM - 0.5, 8);
    a.update(16, ctx);
    expect(a.state).toBe('alert');
  });

  it('stays idle beyond aggroM or without LOS', () => {
    const w = makeWorld();
    const { a, pool } = makeArcher(w, 4, 8);
    const far = makeCtx(OPEN, 4 + R.aggroM + 1, 8);
    run(a, pool, far, 500);
    expect(a.state).toBe('idle');
    const blocked = makeCtx(OPEN, 10, 8);
    blocked.canSeePlayer = false;
    run(a, pool, blocked, 500);
    expect(a.state).toBe('idle');
  });

  it('enters reposition when player < repositionM (TDD)', () => {
    const w = makeWorld();
    const { a, pool } = makeArcher(w, 8, 8);
    const ctx = makeCtx(OPEN, 8 + R.repositionM - 1, 8); // 4m — too close
    run(a, pool, ctx, 48); // idle → alert → reposition
    expect(a.state).toBe('reposition');
  });

  it('reposition backs away until range is restored, then re-engages', () => {
    const w = makeWorld();
    const { a, pool } = makeArcher(w, 20, 8);
    const ctx = makeCtx(OPEN, 20 - 3, 8); // player 3m west
    run(a, pool, ctx, 48);
    expect(a.state).toBe('reposition');
    run(a, pool, ctx, 3000);
    const dist = Math.hypot(a.pos.x - ctx.playerPos.x, a.pos.z - ctx.playerPos.z);
    expect(dist).toBeGreaterThanOrEqual(R.repositionM - 0.05);
    expect(a.state).not.toBe('reposition'); // back to the fight (alert/attack)
  });

  it('reposition strafes along a wall instead of pinning against it', () => {
    const w = makeWorld();
    const { a, pool } = makeArcher(w, 8, 2.6); // back to the north wall (z ≥ 2.5)
    const ctx = makeCtx(OPEN, 8, 5.5); // player 2.9m due south — straight back is blocked
    run(a, pool, ctx, 4000);
    expect(a.pos.z).toBeGreaterThanOrEqual(2.5 - 1e-6); // never tunneled
    expect(Math.abs(a.pos.x - 8)).toBeGreaterThan(1); // slid sideways
    const dist = Math.hypot(a.pos.x - ctx.playerPos.x, a.pos.z - ctx.playerPos.z);
    expect(dist).toBeGreaterThanOrEqual(R.repositionM - 0.05);
  });
});

describe('Archer — shooting', () => {
  it('telegraph: no bolt during windup, one bolt after windupMs', () => {
    const w = makeWorld();
    const { a, pool } = makeArcher(w, 4, 8);
    const ctx = makeCtx(OPEN, 12, 8); // 8m: inside aggro, outside reposition
    run(a, pool, ctx, 48); // idle → alert → attack (windup)
    expect(a.state).toBe('attack');
    run(a, pool, ctx, SHOT.windupMs - 96); // still winding up
    expect(pool.firedTotal).toBe(0);
    run(a, pool, ctx, 160); // crosses the windup boundary → loose
    expect(pool.firedTotal).toBe(1);
  });

  it('respects the shot cooldown between shots', () => {
    const w = makeWorld();
    const { a, pool } = makeArcher(w, 4, 8);
    const ctx = makeCtx(OPEN, 12, 8);
    run(a, pool, ctx, SHOT.windupMs + 100);
    expect(pool.firedTotal).toBe(1);
    run(a, pool, ctx, SHOT.cooldownMs - 300); // cooling down — no second shot yet
    expect(pool.firedTotal).toBe(1);
    run(a, pool, ctx, 300 + SHOT.windupMs + 200); // cooldown over + next windup
    expect(pool.firedTotal).toBe(2);
  });

  it('bolt flies straight at speedM and hits the player for shot damage', () => {
    const w = makeWorld();
    const { a, pool } = makeArcher(w, 4, 8);
    const ctx = makeCtx(OPEN, 12, 8);
    run(a, pool, ctx, SHOT.windupMs + 100);
    expect(pool.firedTotal).toBe(1);
    // 8m at speedM m/s — the hit lands around 8/speedM seconds after loose.
    run(a, pool, ctx, (8 / SHOT.speedM) * 1000 + 200);
    expect(w.hits).toEqual([{ type: 'player-hit', damage: SHOT.damage }]);
    expect(pool.activeCount()).toBe(0); // despawned on the hit
  });
});

describe('Projectile — walls, range, guard', () => {
  function fireBolt(w: World, defense?: MeleeDefense) {
    return new ProjectilePool({ bus: w.bus, defense });
  }

  function stepPool(pool: ProjectilePool, ctx: EnemyCtx, ms: number): void {
    for (let t = 0; t < ms; t += 16) pool.update(16, ctx);
  }

  it('is stopped by raycastWall (TDD)', () => {
    // Wall column between the bolt and the player.
    const grid = collider([
      '############',
      '#..........#',
      '#....##....#',
      '#..........#',
      '############',
    ]);
    const w = makeWorld();
    const pool = fireBolt(w);
    const ctx = makeCtx(grid, 18, 5); // player east of the wall
    pool.fire(4, 5, 1, 0, SHOT); // bolt flying +x from the west side
    stepPool(pool, ctx, 5000);
    expect(w.hits).toHaveLength(0);
    expect(pool.activeCount()).toBe(0); // died on the wall
    // Wall cols 5-6 span x ∈ [10, 14]: the bolt reaches the face, never crosses.
    expect(pool.items[0].pos.x).toBeGreaterThan(9);
    expect(pool.items[0].pos.x).toBeLessThan(10);
  });

  it('despawns at maxRangeM in the open', () => {
    const w = makeWorld();
    const pool = fireBolt(w);
    const ctx = makeCtx(OPEN, 4, 20); // player far off the flight path
    pool.fire(4, 8, 1, 0, SHOT);
    stepPool(pool, ctx, (SHOT.maxRangeM / SHOT.speedM) * 1000 + 200);
    expect(pool.activeCount()).toBe(0);
    expect(w.hits).toHaveLength(0);
    expect(pool.items[0].pos.x).toBeCloseTo(4 + SHOT.maxRangeM, 0);
  });

  it('guard blocks a frontal bolt: 0 embers, shove, bolt dies (TDD)', () => {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    w.bus.on('player-hit', (e) => brand.damage(e.damage));
    const playerPos = new Vector3(8, 0, 10);
    const combat = new Combat({ pose: { pos: playerPos, yaw: 0 }, collider: () => OPEN });
    combat.tryGuard(true);
    const pool = fireBolt(w, combat);
    const ctx: EnemyCtx = { playerPos, playerHollow: false, collider: OPEN, canSeePlayer: true };
    pool.fire(8, 5, 0, 1, SHOT); // bolt from due north — frontal for yaw 0 (faces -z)
    stepPool(pool, ctx, 2000);
    expect(w.hits).toHaveLength(0);
    expect(brand.embers).toBe(TUNING.brand.maxEmbers);
    expect(pool.activeCount()).toBe(0); // blocked bolt despawns
    expect(playerPos.z).toBeCloseTo(10 + guardShoveM, 4); // shoved away from the shooter
  });

  it('guard facing away does not block a bolt', () => {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    w.bus.on('player-hit', (e) => brand.damage(e.damage));
    const playerPos = new Vector3(8, 0, 10);
    const combat = new Combat({ pose: { pos: playerPos, yaw: Math.PI }, collider: () => OPEN });
    combat.tryGuard(true); // guarding, but facing +z — shooter is behind
    const pool = fireBolt(w, combat);
    const ctx: EnemyCtx = { playerPos, playerHollow: false, collider: OPEN, canSeePlayer: true };
    pool.fire(8, 5, 0, 1, SHOT);
    stepPool(pool, ctx, 2000);
    expect(w.hits).toEqual([{ type: 'player-hit', damage: SHOT.damage }]);
    expect(brand.embers).toBe(TUNING.brand.maxEmbers - 1);
    expect(playerPos.z).toBe(10); // no shove
  });

  it('pool reuses despawned bolts (no unbounded growth)', () => {
    const w = makeWorld();
    const pool = fireBolt(w);
    const ctx = makeCtx(OPEN, 4, 20);
    for (let i = 0; i < 5; i += 1) {
      pool.fire(4, 8, 1, 0, SHOT);
      stepPool(pool, ctx, (SHOT.maxRangeM / SHOT.speedM) * 1000 + 200);
      expect(pool.activeCount()).toBe(0);
    }
    expect(pool.items.length).toBe(1); // one bolt, fired five times
  });
});

describe('Archer — hollow player is beneath notice', () => {
  it('collapses to idle out of reposition and stops moving', () => {
    const w = makeWorld();
    const { a, pool } = makeArcher(w, 8, 8);
    const ctx = makeCtx(OPEN, 11, 8);
    run(a, pool, ctx, 48);
    expect(a.state).not.toBe('idle');
    ctx.playerHollow = true;
    a.update(16, ctx);
    expect(a.state).toBe('idle');
    const frozen = { x: a.pos.x, z: a.pos.z };
    run(a, pool, ctx, 500);
    expect(a.pos.x).toBe(frozen.x);
    expect(a.pos.z).toBe(frozen.z);
  });
});
