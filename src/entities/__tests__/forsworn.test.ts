/**
 * THE FORSWORN (Task 15) — the boss FSM, its phase turns, its dark-flame
 * trails, the no-guard reward tracking, and the arena-gate seal/reseal logic.
 * Pure fixed-step tests, no renderer (same harness as the soldier/wraith).
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
import type { EnemyCtx, EnemyState, MeleeDefense } from '../Enemy';
import { Forsworn, FORSWORN_MERCY_YAW } from '../Forsworn';
import { BossArena, arenaWantsDark } from '../bossArena';

const F = TUNING.enemies.forsworn;
const A = F.attack;

function collider(grid: string[]): GridCollider {
  const def: ZoneDef = {
    id: 'throne', grid, cell: 2, tiles: {}, props: [], lights: [],
    enemies: [], lore: [], doors: [], ambience: [],
  };
  return new GridCollider(def);
}

function openRoom(cols: number, rows: number): GridCollider {
  const wall = '#'.repeat(cols);
  const mid = `#${'.'.repeat(cols - 2)}#`;
  return collider([wall, ...Array.from({ length: rows - 2 }, () => mid), wall]);
}

const OPEN = openRoom(14, 10); // x ∈ (2, 26), z ∈ (2, 18)

interface World {
  bus: EventBus;
  hits: GameEvent[];
  slain: GameEvent[];
}

function makeWorld(): World {
  const bus = new EventBus();
  const hits: GameEvent[] = [];
  const slain: GameEvent[] = [];
  bus.on('player-hit', (e) => hits.push(e));
  bus.on('enemy-slain', (e) => slain.push(e));
  return { bus, hits, slain };
}

function makeCtx(grid: GridCollider, x: number, z: number): EnemyCtx {
  return { playerPos: new Vector3(x, 0, z), playerHollow: false, collider: grid, canSeePlayer: true };
}

function makeForsworn(w: World, x: number, z: number, defense?: MeleeDefense): Forsworn {
  const f = new Forsworn({ id: 'forsworn', bus: w.bus, defense });
  f.pos.set(x, 0, z);
  return f;
}

function run(f: Forsworn, ctx: EnemyCtx, ms: number): void {
  for (let t = 0; t < ms; t += 16) f.update(16, ctx);
}

function until(f: Forsworn, ctx: EnemyCtx, state: EnemyState, maxMs = 10_000): void {
  let t = 0;
  while (f.state !== state && t < maxMs) {
    f.update(16, ctx);
    t += 16;
  }
  expect(f.state).toBe(state);
}

describe('Forsworn — phases turn at the tuned hp thresholds', () => {
  it('starts at full hp in phase 1', () => {
    const f = makeForsworn(makeWorld(), 8, 8);
    expect(f.hp).toBe(F.hp);
    expect(f.currentPhase()).toBe(1);
  });

  it('phase 2 begins at hp <= 16, phase 3 at hp <= 8 (TDD)', () => {
    const f = makeForsworn(makeWorld(), 8, 8);
    f.takeHit(F.hp - 17); // 24 → 17: still phase 1
    expect(f.currentPhase()).toBe(1);
    f.takeHit(1); // 17 → 16: phase 2 opens
    expect(f.currentPhase()).toBe(2);
    f.takeHit(7); // 16 → 9: still phase 2
    expect(f.currentPhase()).toBe(2);
    f.takeHit(1); // 9 → 8: phase 3 opens (this is where the torches go out)
    expect(f.currentPhase()).toBe(3);
  });

  it('the torch-out only belongs to phase 3', () => {
    const f = makeForsworn(makeWorld(), 8, 8);
    for (let hp = F.hp; hp > 8; hp--) expect(f.currentPhase()).not.toBe(3), f.takeHit(1);
    expect(f.hp).toBe(8);
    expect(f.currentPhase()).toBe(3);
  });
});

describe('Forsworn — the duel telegraph (mirrors the player heavy)', () => {
  it('winds up ~heavy, no hit during windup, exactly one in the active window', () => {
    const w = makeWorld();
    const f = makeForsworn(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 5 + A.rangeM - 0.4);
    until(f, ctx, 'attack');
    expect(A.windupMs).toBeGreaterThanOrEqual(500); // fair: telegraph ≥ 500ms
    run(f, ctx, A.windupMs - 64);
    expect(w.hits).toHaveLength(0);
    run(f, ctx, 128);
    expect(w.hits).toEqual([{ type: 'player-hit', damage: A.damage }]);
    until(f, ctx, 'recover', A.activeMs + 100);
    expect(w.hits).toHaveLength(1);
  });

  it('a hollow player is beneath the Forsworn — he stops and turns his back (the mercy)', () => {
    const w = makeWorld();
    const f = makeForsworn(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 8);
    until(f, ctx, 'approach');
    ctx.playerHollow = true;
    f.update(16, ctx);
    expect(f.state).toBe('idle');
    expect(f.yaw).toBe(FORSWORN_MERCY_YAW); // turned away
    run(f, ctx, 1000);
    expect(f.state).toBe('idle');
    expect(w.hits).toHaveLength(0);
  });
});

describe('Forsworn — dark-flame trails (phase 2+)', () => {
  it('leaves NO trail in phase 1', () => {
    const w = makeWorld();
    const f = makeForsworn(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 5 + A.rangeM - 0.4);
    until(f, ctx, 'attack');
    run(f, ctx, A.windupMs + A.activeMs + 32);
    expect(f.trails).toHaveLength(0);
  });

  it('lays a trail when a phase-2 swing goes active', () => {
    const w = makeWorld();
    const f = makeForsworn(w, 8, 5);
    f.takeHit(F.hp - 16); // drop to phase 2
    expect(f.currentPhase()).toBe(2);
    const ctx = makeCtx(OPEN, 8, 5 + A.rangeM - 0.4);
    until(f, ctx, 'attack');
    run(f, ctx, A.windupMs + 32); // just into the active window
    expect(f.trails.length).toBeGreaterThanOrEqual(1);
  });

  it('a trail damages once per touch, and expires after its lifetime', () => {
    const w = makeWorld();
    const f = makeForsworn(w, 8, 5);
    f.takeHit(F.hp - 16);
    const ctx = makeCtx(OPEN, 8, 5 + A.rangeM - 0.4);
    until(f, ctx, 'attack');
    run(f, ctx, A.windupMs + 32);
    const trail = f.trails[0];
    const inside = { x: trail.x, z: trail.z };
    const outside = { x: trail.x + 5, z: trail.z + 5 };
    // Entering deals its damage once; standing in it does NOT re-deal.
    expect(f.tickTrails(16, inside)).toBe(F.trail.damage);
    expect(f.tickTrails(16, inside)).toBe(0);
    // Stepping out then back in deals again (once per touch).
    expect(f.tickTrails(16, outside)).toBe(0);
    expect(f.tickTrails(16, inside)).toBe(F.trail.damage);
    // It burns out after its lifetime.
    f.tickTrails(F.trail.lifetimeMs, outside);
    expect(f.trails).toHaveLength(0);
  });
});

describe('Forsworn — the no-guard reward (guardedNever)', () => {
  it('begins untouched: guardedNever is true', () => {
    expect(makeForsworn(makeWorld(), 8, 8).guardedNever).toBe(true);
  });

  it('flips false the first time the player raises guard (noteGuard)', () => {
    const f = makeForsworn(makeWorld(), 8, 8);
    f.noteGuard();
    expect(f.guardedNever).toBe(false);
    f.noteGuard(); // idempotent
    expect(f.guardedNever).toBe(false);
  });

  it('a blocked swing also counts as a guard (0 embers + noguard forfeit)', () => {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    w.bus.on('player-hit', (e) => brand.damage(e.damage));
    const playerPos = new Vector3(8, 0, 6.5);
    const combat = new Combat({ pose: { pos: playerPos, yaw: 0 }, collider: () => OPEN });
    combat.tryGuard(true);
    const f = makeForsworn(w, 8, 5, combat); // 1.5m dead ahead of the yaw-0 player
    const ctx: EnemyCtx = { playerPos, playerHollow: false, collider: OPEN, canSeePlayer: true };
    until(f, ctx, 'attack');
    run(f, ctx, A.windupMs + A.activeMs + 64);
    expect(w.hits).toHaveLength(0);
    expect(brand.embers).toBe(TUNING.brand.maxEmbers);
    expect(f.guardedNever).toBe(false); // the block forfeits the tachi
  });
});

describe('Forsworn — always a pulse source (read him in the dark)', () => {
  it('caps its reported distance just inside pulseRangeM, like a wraith', () => {
    const f = makeForsworn(makeWorld(), 8, 8);
    expect(f.pulseDistM(999)).toBeLessThan(TUNING.brand.pulseRangeM);
    expect(f.pulseDistM(3)).toBe(3); // near distances pass through
  });
});

describe('Forsworn — death', () => {
  it('takeHit(hp) → dead + enemy-slain once, with the forsworn kind', () => {
    const w = makeWorld();
    const f = makeForsworn(w, 8, 8);
    f.takeHit(F.hp);
    expect(f.state).toBe('dead');
    expect(w.slain).toEqual([{ type: 'enemy-slain', enemyId: 'forsworn', kind: 'forsworn' }]);
    f.takeHit(1);
    expect(w.slain).toHaveLength(1);
  });
});

describe('BossArena — the gate seals behind you and reopens as mercy', () => {
  const alive = { playerInArena: true, playerHollow: false, bossDead: false };

  it('seals when a lit knight steps into the arena, then holds', () => {
    const arena = new BossArena();
    expect(arena.sealed).toBe(false);
    expect(arena.update(alive)).toBe('seal');
    expect(arena.sealed).toBe(true);
    expect(arena.update(alive)).toBe(null); // already sealed
  });

  it('opens as mercy when the player hollows mid-fight, then reseals on re-entry', () => {
    const arena = new BossArena();
    arena.update(alive); // seal
    expect(arena.update({ ...alive, playerHollow: true })).toBe('mercy-open');
    expect(arena.sealed).toBe(false);
    // Walk out hollow, then rekindle in the antechamber — no reseal yet.
    expect(arena.update({ playerInArena: false, playerHollow: true, bossDead: false })).toBe(null);
    expect(arena.update({ playerInArena: false, playerHollow: false, bossDead: false })).toBe(null);
    // Step back into the arena lit → the gate slams again.
    expect(arena.update(alive)).toBe('seal');
    expect(arena.sealed).toBe(true);
  });

  it('never seals a hollow knight in (the boss will not fight the dark)', () => {
    const arena = new BossArena();
    expect(arena.update({ playerInArena: true, playerHollow: true, bossDead: false })).toBe(null);
    expect(arena.sealed).toBe(false);
  });

  it('opens for good on the Forsworn’s death and never reseals', () => {
    const arena = new BossArena();
    arena.update(alive); // seal
    expect(arena.update({ ...alive, bossDead: true })).toBe('death-open');
    expect(arena.sealed).toBe(false);
    expect(arena.update({ ...alive, bossDead: true })).toBe(null);
  });
});

describe('arenaWantsDark — the P3 blackout is a mechanic of the sealed fight', () => {
  const alive = { playerInArena: true, playerHollow: false, bossDead: false };

  /** Fold the main.ts boss side: alive AND phase 3. */
  const bossInP3 = (f: Forsworn) => f.alive && f.currentPhase() === 3;

  it('phase 3 while sealed → dark; the mercy unseals → the dark lifts', () => {
    const f = makeForsworn(makeWorld(), 8, 8);
    f.takeHit(F.hp - 8); // → phase 3 (torch-out territory)
    expect(f.currentPhase()).toBe(3);
    const arena = new BossArena();
    arena.update(alive); // seal — the fight is on

    // P3 + sealed → the torches die.
    expect(arenaWantsDark(bossInP3(f), arena.sealed)).toBe(true);

    // Hollowing mid-fight opens the mercy — even at phase-3 hp the dark lifts.
    expect(arena.update({ ...alive, playerHollow: true })).toBe('mercy-open');
    expect(arenaWantsDark(bossInP3(f), arena.sealed)).toBe(false);

    // Rekindle + step back in → reseal → the P3 darkness returns unchanged.
    arena.update({ playerInArena: false, playerHollow: false, bossDead: false });
    expect(arena.update(alive)).toBe('seal');
    expect(arenaWantsDark(bossInP3(f), arena.sealed)).toBe(true);
  });

  it('stays lit below phase 3 even while sealed (torch-out is P3-only)', () => {
    const f = makeForsworn(makeWorld(), 8, 8);
    f.takeHit(F.hp - 16); // → phase 2
    expect(f.currentPhase()).toBe(2);
    const arena = new BossArena();
    arena.update(alive); // sealed fight, but not yet P3
    expect(arenaWantsDark(bossInP3(f), arena.sealed)).toBe(false);
  });

  it('lifts on death even at phase-3 hp (gate open for good)', () => {
    const w = makeWorld();
    const f = makeForsworn(w, 8, 8);
    const arena = new BossArena();
    arena.update(alive); // seal
    f.takeHit(F.hp); // fell at phase 3
    expect(f.alive).toBe(false);
    arena.update({ ...alive, bossDead: true }); // death-open → unsealed
    expect(arenaWantsDark(bossInP3(f), arena.sealed)).toBe(false);
  });
});
