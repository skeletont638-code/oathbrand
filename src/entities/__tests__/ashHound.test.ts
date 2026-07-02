/**
 * Ash-Hound (Greater Vael Drop 1, Task 4) — pure fixed-step FSM tests, no
 * renderer. Real GridCollider for steering, real EventBus, a deterministic
 * fake rng so the RANDOMIZED flank + circle duration are asserted exactly.
 *
 * The hound is the new 'circle' behaviour: it approaches to the fog edge
 * (circle.radiusM), stalks a rolled duration on a rolled flank while spiralling
 * inward, then LUNGES from that flank — windup → active pounce → recover — and
 * re-approaches, or leashes past 1.5×aggro.
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TUNING } from '../../content/tuning';
import { EventBus } from '../../engine/events';
import type { GameEvent } from '../../engine/events';
import { GridCollider } from '../../world/collision';
import type { ZoneDef } from '../../world/zoneDef';
import type { EnemyCtx, EnemyState } from '../Enemy';
import { AshHound } from '../AshHound';

const H = TUNING.greaterVael.hound;
const CIRCLE = H.circle;
const LUNGE = H.lunge;

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

/** Open room: floor spans x ∈ (2, 2(cols-1)), z ∈ (2, 2(rows-1)). */
function openRoom(cols: number, rows: number): GridCollider {
  const wall = '#'.repeat(cols);
  const mid = `#${'.'.repeat(cols - 2)}#`;
  return collider([wall, ...Array.from({ length: rows - 2 }, () => mid), wall]);
}

// Big enough that a 1.5×aggro (19.5 m) leash gap fits with both bodies inside.
const BIG = openRoom(24, 24); // x ∈ (2, 46), z ∈ (2, 46)

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

function makeHound(
  w: World,
  x: number,
  z: number,
  rng: () => number = () => 0.5,
  pantCue: () => void = () => {},
): AshHound {
  const h = new AshHound({ id: 'h1', bus: w.bus, rng, pantCue });
  h.pos.set(x, 0, z);
  return h;
}

function run(h: AshHound, ctx: EnemyCtx, ms: number): void {
  for (let t = 0; t < ms; t += 16) h.update(16, ctx);
}

function until(h: AshHound, ctx: EnemyCtx, state: EnemyState, maxMs = 12_000): void {
  let t = 0;
  while (h.state !== state && t < maxMs) {
    h.update(16, ctx);
    t += 16;
  }
  expect(h.state).toBe(state);
}

/** Drive until the NEXT fresh entry into 'circle' and return the rolled cycle. */
function nextCircle(h: AshHound, ctx: EnemyCtx, maxMs = 15_000): { side: number; ms: number } {
  let t = 0;
  while (t < maxMs) {
    const prev = h.state;
    h.update(16, ctx);
    t += 16;
    if (h.state === 'circle' && prev !== 'circle') return { side: h.circleSide, ms: h.circleMs };
  }
  throw new Error(`no circle entry within ${maxMs}ms (state=${h.state})`);
}

describe('Ash-Hound — the circle behaviour', () => {
  it('idle → alert → approach → circle, re-rolling flank+duration each cycle', () => {
    const w = makeWorld();
    // Two draws per circle entry: [side, duration]. Cycle 1 = right+short,
    // cycle 2 = left+long — both fields must differ across the cycles.
    const seq = [0.2, 0.1, 0.9, 0.95];
    const h = makeHound(w, 24, 20, () => seq.shift() ?? 0.5);
    const ctx = makeCtx(BIG, 24, 24); // 4 m: inside aggro AND inside the circle radius

    expect(h.state).toBe('idle');
    until(h, ctx, 'alert');
    until(h, ctx, 'approach', H.alertMs + 200);

    const c1 = nextCircle(h, ctx);
    const c2 = nextCircle(h, ctx);
    expect(c1.side).not.toBe(c2.side); // flank re-rolled
    expect(c1.ms).not.toBe(c2.ms); // duration re-rolled
    // And the rolled values track the tuning window.
    expect(c1.ms).toBeGreaterThanOrEqual(CIRCLE.minMs);
    expect(c1.ms).toBeLessThanOrEqual(CIRCLE.maxMs);
  });

  it('lunges from the circle at rangeM, then recovers and re-approaches', () => {
    const w = makeWorld();
    const h = makeHound(w, 24, 20);
    const ctx = makeCtx(BIG, 24, 24);
    until(h, ctx, 'circle');
    until(h, ctx, 'attack', 6000);
    // No connect during the windup telegraph.
    run(h, ctx, LUNGE.windupMs - 48);
    expect(w.hits).toHaveLength(0);
    // The pounce lands exactly once in the active window.
    until(h, ctx, 'recover', LUNGE.windupMs + LUNGE.activeMs + 200);
    expect(w.hits).toHaveLength(1);
    expect(w.hits[0]).toEqual({ type: 'player-hit', damage: LUNGE.damage });
    // Recovery, then it comes round again.
    until(h, ctx, 'approach', LUNGE.recoverMs + 200);
  });

  it('lunge dashes forward along the committed flank facing', () => {
    const w = makeWorld();
    const h = makeHound(w, 24, 20);
    const ctx = makeCtx(BIG, 24, 24);
    until(h, ctx, 'attack', 8000);
    const before = new Vector3().copy(h.pos);
    run(h, ctx, LUNGE.windupMs + LUNGE.activeMs);
    // It surged (net displacement over the pounce), not stood still.
    expect(h.pos.distanceTo(before)).toBeGreaterThan(0.5);
  });

  it('leashes to idle past 1.5×aggroM', () => {
    const w = makeWorld();
    const h = makeHound(w, 24, 10);
    const ctx = makeCtx(BIG, 24, 22); // 12 m: inside aggro
    until(h, ctx, 'approach');
    // Player bolts well past the leash ring measured from the hound's spot.
    ctx.playerPos.set(24, 0, h.pos.z + H.aggroM * H.leashMul + 2);
    run(h, ctx, 64);
    expect(h.state).toBe('idle');
  });

  it('a hollow player collapses the hunt to idle', () => {
    const w = makeWorld();
    const h = makeHound(w, 24, 20);
    const ctx = makeCtx(BIG, 24, 24);
    until(h, ctx, 'circle');
    ctx.playerHollow = true;
    run(h, ctx, 32);
    expect(h.state).toBe('idle');
  });

  it('takeHit(hp) → dead + enemy-slain exactly once', () => {
    const w = makeWorld();
    const h = makeHound(w, 24, 24);
    h.takeHit(H.hp);
    expect(h.state).toBe('dead');
    expect(w.slain).toEqual([{ type: 'enemy-slain', enemyId: 'h1', kind: 'hound' }]);
    h.takeHit(1);
    expect(w.slain).toHaveLength(1);
  });
});
