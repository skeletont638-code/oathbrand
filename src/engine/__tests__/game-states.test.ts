import { describe, it, expect } from 'vitest';
import { Game } from '../Game';
import { EventBus } from '../events';

describe('Game state machine', () => {
  it('starts in the boot state', () => {
    expect(new Game().state).toBe('boot');
  });

  it('exposes an EventBus', () => {
    expect(new Game().bus).toBeInstanceOf(EventBus);
  });

  it('follows the legal boot→title→playing path', () => {
    const g = new Game();
    expect(g.transition('title')).toBe(true);
    expect(g.state).toBe('title');
    expect(g.transition('playing')).toBe(true);
    expect(g.state).toBe('playing');
  });

  it('rejects an illegal title→ending move without throwing or mutating state', () => {
    const g = new Game();
    g.transition('title');
    expect(() => g.transition('ending')).not.toThrow();
    expect(g.transition('ending')).toBe(false);
    expect(g.state).toBe('title');
  });

  it('allows playing→vision→playing', () => {
    const g = new Game();
    g.transition('title');
    g.transition('playing');
    expect(g.transition('vision')).toBe(true);
    expect(g.state).toBe('vision');
    expect(g.transition('playing')).toBe(true);
    expect(g.state).toBe('playing');
  });

  it('allows the playing↔paused round trip', () => {
    const g = new Game();
    g.transition('title');
    g.transition('playing');
    expect(g.transition('paused')).toBe(true);
    expect(g.state).toBe('paused');
    expect(g.transition('playing')).toBe(true);
    expect(g.state).toBe('playing');
  });

  it('allows playing→ending→title but not ending→playing', () => {
    const g = new Game();
    g.transition('title');
    g.transition('playing');
    expect(g.transition('ending')).toBe(true);
    expect(g.transition('playing')).toBe(false);
    expect(g.transition('title')).toBe(true);
    expect(g.state).toBe('title');
  });
});

describe('Game subsystem tick loop', () => {
  it('ticks registered subsystems in registration order', () => {
    const g = new Game();
    const calls: string[] = [];
    for (const name of ['input', 'player', 'entities', 'brand', 'audio']) {
      g.register({ update: () => calls.push(name) });
    }
    g.update(16);
    expect(calls).toEqual(['input', 'player', 'entities', 'brand', 'audio']);
  });

  it('passes dtMs through to each subsystem', () => {
    const g = new Game();
    const dts: number[] = [];
    g.register({ update: (dt) => dts.push(dt) });
    g.register({ update: (dt) => dts.push(dt) });
    g.update(16);
    expect(dts).toEqual([16, 16]);
  });
});
