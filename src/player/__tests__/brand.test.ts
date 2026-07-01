import { describe, it, expect, vi } from 'vitest';
import { TUNING } from '../../content/tuning';
import { EventBus } from '../../engine/events';
import type { GameEvent } from '../../engine/events';
import { Brand } from '../Brand';

const { maxEmbers, pulseRangeM, hollowDesatRamp, illusoryFlickerRangeM } = TUNING.brand;

/** Brand wired to a fresh bus + recording desaturation stub. */
function makeBrand(onSave?: (bannerId: string) => void) {
  const bus = new EventBus();
  const events: GameEvent[] = [];
  bus.on('ember-lost', (e) => events.push(e));
  bus.on('player-hollowed', (e) => events.push(e));
  bus.on('player-rekindled', (e) => events.push(e));
  bus.on('brand-pulse', (e) => events.push(e));
  const desat: number[] = [];
  const pipeline = { setDesaturation: (v: number) => desat.push(v) };
  const brand = new Brand({ bus, pipeline, onSave });
  return { brand, bus, events, desat };
}

describe('Brand embers', () => {
  it('starts at maxEmbers and not hollow', () => {
    const { brand } = makeBrand();
    expect(brand.embers).toBe(maxEmbers);
    expect(brand.hollow).toBe(false);
  });

  it('damage(2) from 5 leaves 3 and emits ember-lost per ember with remaining', () => {
    const { brand, events } = makeBrand();
    brand.damage(2);
    expect(brand.embers).toBe(3);
    expect(events).toEqual([
      { type: 'ember-lost', remaining: 4 },
      { type: 'ember-lost', remaining: 3 },
    ]);
  });

  it('damage to 0 emits player-hollowed exactly once and sets hollow', () => {
    const { brand, events } = makeBrand();
    brand.damage(maxEmbers);
    expect(brand.embers).toBe(0);
    expect(brand.hollow).toBe(true);
    const hollowed = events.filter((e) => e.type === 'player-hollowed');
    expect(hollowed).toHaveLength(1);
    // Hollowed after the final ember-lost, not before.
    expect(events[events.length - 1]).toEqual({ type: 'player-hollowed' });
  });

  it('further damage while hollow is a no-op (beneath notice)', () => {
    const { brand, events } = makeBrand();
    brand.damage(maxEmbers);
    const countAtHollow = events.length;
    brand.damage(3);
    expect(brand.embers).toBe(0);
    expect(events).toHaveLength(countAtHollow); // no new events of any kind
  });

  it('overkill damage clamps at 0 and still hollowes exactly once', () => {
    const { brand, events } = makeBrand();
    brand.damage(999);
    expect(brand.embers).toBe(0);
    expect(events.filter((e) => e.type === 'ember-lost')).toHaveLength(maxEmbers);
    expect(events.filter((e) => e.type === 'player-hollowed')).toHaveLength(1);
  });
});

describe('Brand rekindle', () => {
  it('restores maxEmbers, clears hollow, emits player-rekindled, and fires save', () => {
    const onSave = vi.fn();
    const { brand, events } = makeBrand(onSave);
    brand.damage(maxEmbers);
    brand.rekindle('banner-gate');
    expect(brand.embers).toBe(maxEmbers);
    expect(brand.hollow).toBe(false);
    expect(events).toContainEqual({ type: 'player-rekindled', bannerId: 'banner-gate' });
    expect(onSave).toHaveBeenCalledExactlyOnceWith('banner-gate');
  });

  it('damage works again after rekindling from hollow', () => {
    const { brand } = makeBrand();
    brand.damage(maxEmbers);
    brand.rekindle('banner-gate');
    brand.damage(1);
    expect(brand.embers).toBe(maxEmbers - 1);
  });
});

describe('Brand pulse', () => {
  it('pulseFor(pulseRangeM) = 0 and pulseFor(null) = 0', () => {
    const { brand } = makeBrand();
    expect(brand.pulseFor(pulseRangeM)).toBe(0);
    expect(brand.pulseFor(null)).toBe(0);
  });

  it('pulseFor(0) = 1', () => {
    const { brand } = makeBrand();
    expect(brand.pulseFor(0)).toBe(1);
  });

  it('is monotonically non-increasing with distance', () => {
    const { brand } = makeBrand();
    let prev = Infinity;
    for (let d = 0; d <= pulseRangeM + 1; d += 0.5) {
      const v = brand.pulseFor(d);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
    // Strictly stronger closer-in, within range.
    expect(brand.pulseFor(2)).toBeGreaterThan(brand.pulseFor(8));
  });

  it('tick emits brand-pulse only when intensity > 0', () => {
    const { brand, events } = makeBrand();
    brand.tick(16, pulseRangeM + 1, null); // out of range: silent
    expect(events.filter((e) => e.type === 'brand-pulse')).toHaveLength(0);
    brand.tick(16, 4, null);
    const pulses = events.filter((e) => e.type === 'brand-pulse');
    expect(pulses).toHaveLength(1);
    expect(pulses[0]).toEqual({ type: 'brand-pulse', intensity: brand.pulseFor(4) });
  });
});

describe('Brand desaturation + blue flicker', () => {
  it('tick drives setDesaturation from the hollowDesatRamp by embers lost', () => {
    const { brand, desat } = makeBrand();
    brand.tick(16, null, null);
    expect(desat.at(-1)).toBe(hollowDesatRamp[0]); // 0 lost
    brand.damage(2);
    brand.tick(16, null, null);
    expect(desat.at(-1)).toBe(hollowDesatRamp[2]); // 2 lost
  });

  it('hollow forces desaturation to 1', () => {
    const { brand, desat } = makeBrand();
    brand.damage(maxEmbers);
    brand.tick(16, null, null);
    expect(desat.at(-1)).toBe(1);
  });

  it('sets the blue-flicker flag only when an illusory wall is nearer than the range', () => {
    const { brand } = makeBrand();
    brand.tick(16, null, illusoryFlickerRangeM - 1);
    expect(brand.blueFlicker).toBe(true);
    brand.tick(16, null, illusoryFlickerRangeM);
    expect(brand.blueFlicker).toBe(false);
    brand.tick(16, null, null);
    expect(brand.blueFlicker).toBe(false);
  });
});

describe('Brand as a Game subsystem', () => {
  it('update(dt) polls the distance providers and ticks', () => {
    const bus = new EventBus();
    const pulses: number[] = [];
    bus.on('brand-pulse', (e) => pulses.push(e.intensity));
    const brand = new Brand({
      bus,
      nearestEnemyM: () => 4,
      nearestIllusoryM: () => 1,
    });
    brand.update(16);
    expect(pulses).toEqual([brand.pulseFor(4)]);
    expect(brand.blueFlicker).toBe(true);
  });
});
