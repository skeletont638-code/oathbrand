/**
 * Kneeling Hollow (Greater Vael Drop 1, Task 4) — pure fixed-step FSM tests.
 *
 * The kneeler is dormant (idle) until the Oath-Brand pulses: the scare beat
 * calls `wake()`, OR it auto-wakes when the brand pulse crosses the wake line
 * within aggro. The RISE is a deliberate wrong-tempo beat — it holds `holdMs`
 * at full height, then takes a slow `firstStepMs` first step before it walks.
 * From there it mirrors the soldier's telegraphed swing.
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TUNING } from '../../content/tuning';
import { EventBus } from '../../engine/events';
import type { GameEvent } from '../../engine/events';
import { GridCollider } from '../../world/collision';
import type { ZoneDef } from '../../world/zoneDef';
import type { EnemyCtx, EnemyState } from '../Enemy';
import { KneelingHollow } from '../KneelingHollow';

const K = TUNING.greaterVael.kneeler;
const RISE = K.rise;
const ATK = K.attack;

function collider(grid: string[]): GridCollider {
  const def: ZoneDef = {
    id: 'gate-fields',
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

function makeKneeler(
  w: World,
  x: number,
  z: number,
  pulse: () => number = () => 0,
  creakCue: () => void = () => {},
): KneelingHollow {
  const k = new KneelingHollow({ id: 'k1', bus: w.bus, pulse, creakCue });
  k.pos.set(x, 0, z);
  return k;
}

function run(k: KneelingHollow, ctx: EnemyCtx, ms: number): void {
  for (let t = 0; t < ms; t += 16) k.update(16, ctx);
}

function until(k: KneelingHollow, ctx: EnemyCtx, state: EnemyState, maxMs = 12_000): void {
  let t = 0;
  while (k.state !== state && t < maxMs) {
    k.update(16, ctx);
    t += 16;
  }
  expect(k.state).toBe(state);
}

describe('Kneeling Hollow — dormant until the brand pulses', () => {
  it('stays dormant (idle) until wake(): no attack while inert', () => {
    const w = makeWorld();
    const k = makeKneeler(w, 8, 8, () => 0); // no pulse: it must never stir
    const ctx = makeCtx(OPEN, 8, 6); // player 2 m away, well inside would-be attack range
    // Even a long inert beat with the player point-blank leaves it kneeling.
    run(k, ctx, RISE.holdMs);
    expect(k.state).toBe('idle');
    expect(w.hits).toHaveLength(0);
    let creaked = 0;
    const k2 = makeKneeler(w, 8, 8, () => 0, () => (creaked += 1));
    k2.wake();
    expect(k2.state).toBe('alert');
    expect(creaked).toBe(1); // a single bone-creak on the rise
  });

  it('rise holds holdMs still at full height, THEN takes the first step (alert → approach)', () => {
    const w = makeWorld();
    const k = makeKneeler(w, 8, 8);
    const ctx = makeCtx(OPEN, 8, 4); // 4 m: past attack range, so it walks after rising
    k.wake();
    run(k, ctx, RISE.holdMs - 16);
    expect(k.state).toBe('alert'); // still holding at full height
    run(k, ctx, 32 + RISE.firstStepMs);
    expect(k.state).toBe('approach'); // the wrong-tempo first step is done
  });

  it('auto-wakes when the brand pulses within aggroM', () => {
    const w = makeWorld();
    const k = makeKneeler(w, 8, 8, () => 0.5); // brand throbbing
    const ctx = makeCtx(OPEN, 8, 6); // 2 m ≤ aggroM
    run(k, ctx, 32);
    expect(k.state).toBe('alert');
  });

  it('does NOT auto-wake past aggroM even with a strong pulse', () => {
    const w = makeWorld();
    const k = makeKneeler(w, 8, 8, () => 1);
    // Player far beyond aggroM: a distant pulse does not raise this one.
    const far = makeCtx(OPEN, 8, 8);
    far.playerPos.set(8, 0, 8 + K.aggroM + 5);
    run(k, far, 64);
    expect(k.state).toBe('idle');
  });

  it('once risen, mirrors the soldier swing: windup → one active hit → recover', () => {
    const w = makeWorld();
    const k = makeKneeler(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 5 + ATK.rangeM - 0.4);
    k.wake();
    until(k, ctx, 'attack', RISE.holdMs + RISE.firstStepMs + 4000);
    run(k, ctx, ATK.windupMs - 48);
    expect(w.hits).toHaveLength(0); // telegraph: nothing during windup
    run(k, ctx, 96);
    expect(w.hits).toEqual([{ type: 'player-hit', damage: ATK.damage }]);
    until(k, ctx, 'recover', ATK.activeMs + 100);
    until(k, ctx, 'approach', ATK.recoverMs + 100);
    expect(w.hits).toHaveLength(1); // one connect per swing
  });

  it('takeHit(hp) → dead + enemy-slain exactly once', () => {
    const w = makeWorld();
    const k = makeKneeler(w, 8, 8);
    k.takeHit(K.hp);
    expect(k.state).toBe('dead');
    expect(w.slain).toEqual([{ type: 'enemy-slain', enemyId: 'k1', kind: 'kneeler' }]);
    k.takeHit(1);
    expect(w.slain).toHaveLength(1);
  });
});
