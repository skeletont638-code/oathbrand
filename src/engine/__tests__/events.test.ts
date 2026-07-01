import { describe, it, expect } from 'vitest';
import { EventBus } from '../events';

describe('EventBus', () => {
  it('delivers a typed payload to the matching handler', () => {
    const bus = new EventBus();
    const seen: number[] = [];
    // e is narrowed to { type: 'ember-lost'; remaining: number } — accessing
    // e.remaining only compiles if the payload type is inferred correctly.
    bus.on('ember-lost', (e) => {
      seen.push(e.remaining);
    });
    bus.emit({ type: 'ember-lost', remaining: 3 });
    expect(seen).toEqual([3]);
  });

  it('routes only to handlers registered for the emitted type', () => {
    const bus = new EventBus();
    const lost: number[] = [];
    const gained: number[] = [];
    bus.on('ember-lost', (e) => lost.push(e.remaining));
    bus.on('ember-gained', (e) => gained.push(e.total));
    bus.emit({ type: 'ember-gained', total: 5 });
    expect(lost).toEqual([]);
    expect(gained).toEqual([5]);
  });

  it('invokes every handler registered for a type', () => {
    const bus = new EventBus();
    let a = 0;
    let b = 0;
    bus.on('brand-pulse', () => {
      a++;
    });
    bus.on('brand-pulse', () => {
      b++;
    });
    bus.emit({ type: 'brand-pulse', intensity: 1 });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const bus = new EventBus();
    let calls = 0;
    const off = bus.on('brand-pulse', () => {
      calls++;
    });
    bus.emit({ type: 'brand-pulse', intensity: 1 });
    off();
    bus.emit({ type: 'brand-pulse', intensity: 1 });
    expect(calls).toBe(1);
  });

  it('unsubscribe removes only the targeted handler', () => {
    const bus = new EventBus();
    let a = 0;
    let b = 0;
    const offA = bus.on('player-hit', () => {
      a++;
    });
    bus.on('player-hit', () => {
      b++;
    });
    offA();
    bus.emit({ type: 'player-hit', damage: 2 });
    expect(a).toBe(0);
    expect(b).toBe(1);
  });

  it('is a no-op to emit a type with no handlers', () => {
    const bus = new EventBus();
    expect(() => bus.emit({ type: 'player-hollowed' })).not.toThrow();
  });
});
