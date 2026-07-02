/**
 * Brand-Wraith (Task 10) — pure fixed-step tests, no renderer.
 *
 * The wraith is the brand's monster: it is rendered ONLY while the brand's
 * pulse burns above the visibility threshold (material opacity = intensity),
 * and it always feeds the pulse — even across the map it reports an
 * effective distance just inside pulseRangeM, so the brand never goes quiet
 * while a wraith stalks the zone.
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
import { Wraith, WRAITH_VISIBLE_PULSE } from '../Wraith';

const W = TUNING.enemies.wraith;
const L = W.lunge;
const { radius: playerRadius, guardShoveM } = TUNING.player;

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

function makeWraith(
  w: World,
  x: number,
  z: number,
  pulse: () => number = () => 0,
  defense?: MeleeDefense,
): Wraith {
  const wr = new Wraith({ id: 'w1', bus: w.bus, pulse, defense });
  wr.pos.set(x, 0, z);
  return wr;
}

function run(wr: Wraith, ctx: EnemyCtx, ms: number): void {
  for (let t = 0; t < ms; t += 16) wr.update(16, ctx);
}

function until(wr: Wraith, ctx: EnemyCtx, state: EnemyState, maxMs = 10_000): void {
  let t = 0;
  while (wr.state !== state && t < maxMs) {
    wr.update(16, ctx);
    t += 16;
  }
  expect(wr.state).toBe(state);
}

describe('Wraith — pulse-driven visibility', () => {
  it('opacity 0 and invisible when the pulse is 0 (TDD)', () => {
    const wr = makeWraith(makeWorld(), 8, 8, () => 0);
    expect(wr.visible).toBe(false);
    expect(wr.opacity).toBe(0);
  });

  it('visible ONLY above the pulse threshold; opacity = intensity', () => {
    let intensity = 0.1;
    const wr = makeWraith(makeWorld(), 8, 8, () => intensity);
    expect(wr.visible).toBe(false); // below threshold
    expect(wr.opacity).toBeCloseTo(0.1, 6);
    intensity = WRAITH_VISIBLE_PULSE; // exactly at threshold: still hidden (strict >)
    expect(wr.visible).toBe(false);
    intensity = 0.62;
    expect(wr.visible).toBe(true);
    expect(wr.opacity).toBeCloseTo(0.62, 6);
  });

  it('always pulses the brand: effective distance is capped inside pulseRangeM', () => {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    const wr = makeWraith(w, 8, 8);
    // Across the map: reports just inside the pulse range → intensity > 0.
    expect(wr.pulseDistM(999)).toBeLessThan(TUNING.brand.pulseRangeM);
    expect(brand.pulseFor(wr.pulseDistM(999))).toBeGreaterThan(0);
    // …but so faint it stays invisible until the player actually closes in.
    brand.tick(16, wr.pulseDistM(999), null);
    expect(brand.pulse).toBeGreaterThan(0);
    expect(brand.pulse).toBeLessThan(WRAITH_VISIBLE_PULSE);
    // Near distances pass through unchanged — proximity drives the fade-in.
    expect(wr.pulseDistM(4)).toBe(4);
    brand.tick(16, wr.pulseDistM(4), null);
    expect(brand.pulse).toBeGreaterThan(WRAITH_VISIBLE_PULSE);
  });
});

describe('Wraith — lunge', () => {
  it('lunges only from the alert chain WITH line of sight (TDD)', () => {
    const w = makeWorld();
    const wr = makeWraith(w, 4, 8);
    const ctx = makeCtx(OPEN, 12, 8); // 8m ≤ aggroM
    until(wr, ctx, 'alert');
    until(wr, ctx, 'approach');
    // LOS breaks: the wraith keeps hunting but must NOT lunge blind.
    ctx.canSeePlayer = false;
    const seen = new Set<EnemyState>();
    for (let t = 0; t < 5000; t += 16) {
      wr.update(16, ctx);
      seen.add(wr.state);
    }
    expect(seen.has('attack')).toBe(false);
    // LOS restored inside lunge range → the lunge comes.
    ctx.canSeePlayer = true;
    until(wr, ctx, 'attack', 1000);
  });

  it('telegraph: no hit during windup, exactly one in the active window, then recover', () => {
    const w = makeWorld();
    const wr = makeWraith(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 5 + L.rangeM - 0.4);
    until(wr, ctx, 'attack');
    run(wr, ctx, L.windupMs - 64);
    expect(w.hits).toHaveLength(0);
    run(wr, ctx, 128);
    expect(w.hits).toEqual([{ type: 'player-hit', damage: L.damage }]);
    until(wr, ctx, 'recover', L.activeMs + 100);
    until(wr, ctx, 'approach', L.recoverMs + 100);
    expect(w.hits).toHaveLength(1); // one connect per lunge
  });

  it('the lunge dashes forward along the committed facing', () => {
    const w = makeWorld();
    const wr = makeWraith(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 5 + L.rangeM - 0.4); // player due +z
    until(wr, ctx, 'attack');
    const zAtWindup = wr.pos.z;
    run(wr, ctx, L.windupMs + L.activeMs + 32);
    expect(wr.pos.z).toBeGreaterThan(zAtWindup + 1); // surged toward the player
  });

  it('guard blocks a frontal lunge: 0 embers + shove', () => {
    const w = makeWorld();
    const brand = new Brand({ bus: w.bus });
    w.bus.on('player-hit', (e) => brand.damage(e.damage));
    const playerPos = new Vector3(8, 0, 6.5);
    const combat = new Combat({ pose: { pos: playerPos, yaw: 0 }, collider: () => OPEN });
    combat.tryGuard(true);
    const wr = makeWraith(w, 8, 5, () => 1, combat); // 1.5m dead ahead of yaw-0 player
    const ctx: EnemyCtx = { playerPos, playerHollow: false, collider: OPEN, canSeePlayer: true };
    until(wr, ctx, 'attack');
    run(wr, ctx, L.windupMs + L.activeMs + 64);
    expect(w.hits).toHaveLength(0);
    expect(brand.embers).toBe(TUNING.brand.maxEmbers);
    expect(playerPos.z).toBeGreaterThanOrEqual(6.5 + guardShoveM - 1e-4); // shoved away
  });

  it('whiffs when the player steps beyond reach during the windup', () => {
    const w = makeWorld();
    const wr = makeWraith(w, 8, 5);
    const ctx = makeCtx(OPEN, 8, 5 + L.rangeM - 0.2);
    until(wr, ctx, 'attack');
    // Step FAR out: beyond lunge reach even after the dash closes rangeM.
    ctx.playerPos.z = 5 + L.rangeM * 2 + playerRadius + 1;
    run(wr, ctx, L.windupMs + L.activeMs + 64);
    expect(w.hits).toHaveLength(0);
  });
});

describe('Wraith — death', () => {
  it('takeHit(2) → dead + enemy-slain exactly once', () => {
    const w = makeWorld();
    const wr = makeWraith(w, 8, 8);
    wr.takeHit(W.hp);
    expect(wr.state).toBe('dead');
    expect(w.slain).toEqual([{ type: 'enemy-slain', enemyId: 'w1', kind: 'wraith' }]);
    wr.takeHit(1);
    expect(w.slain).toHaveLength(1);
  });
});
