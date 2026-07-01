import { EventBus } from './events';

export type GameState =
  | 'boot'
  | 'title'
  | 'playing'
  | 'paused'
  | 'reading'
  | 'vision'
  | 'dialogue'
  | 'ending';

/** A tickable game subsystem, updated once per frame in registration order. */
export interface Subsystem {
  update(dtMs: number): void;
}

/**
 * Legal state transitions. Any (from → to) pair not listed here is rejected.
 * boot→title; title→playing; playing↔paused; playing→reading|vision|dialogue
 * (and each back to playing); playing→ending; ending→title.
 */
const LEGAL: Record<GameState, readonly GameState[]> = {
  boot: ['title'],
  title: ['playing'],
  playing: ['paused', 'reading', 'vision', 'dialogue', 'ending'],
  paused: ['playing'],
  reading: ['playing'],
  vision: ['playing'],
  dialogue: ['playing'],
  ending: ['title'],
};

export class Game {
  state: GameState = 'boot';
  readonly bus = new EventBus();
  private readonly subsystems: Subsystem[] = [];

  /** Register a subsystem to be ticked by `update` in registration order. */
  register(sub: Subsystem): void {
    this.subsystems.push(sub);
  }

  /** Attempt a state change. Returns false (never throws) on an illegal move. */
  transition(to: GameState): boolean {
    if (!LEGAL[this.state].includes(to)) return false;
    this.state = to;
    return true;
  }

  /** Tick every registered subsystem, in the order they were registered. */
  update(dtMs: number): void {
    for (const sub of this.subsystems) sub.update(dtMs);
  }
}
