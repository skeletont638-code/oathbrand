import type { EnemyKind, ZoneId, EndingId } from '../content/types';

export type GameEvent =
  | { type: 'ember-lost'; remaining: number }
  | { type: 'ember-gained'; total: number }
  | { type: 'player-hollowed' }
  | { type: 'player-rekindled'; bannerId: string }
  | { type: 'brand-pulse'; intensity: number }
  | { type: 'enemy-slain'; enemyId: string; kind: EnemyKind }
  | { type: 'player-hit'; damage: number }
  | { type: 'zone-entered'; zone: ZoneId }
  | { type: 'door-opened'; doorId: string }
  | { type: 'lore-read'; loreId: string }
  | { type: 'vision-played'; visionId: string }
  // A named audio/motif cue for the sound layer (Task 17) — e.g. 'motif-kneel'
  // fired at the settle beat of a kneel. Purely a string handle; nothing
  // gameplay reads it, so new cue ids never touch this union again.
  | { type: 'cue'; id: string }
  | { type: 'ending-reached'; ending: EndingId };

type Handler<T extends GameEvent['type']> = (e: Extract<GameEvent, { type: T }>) => void;

// Bottom-typed parameter so any specific Handler is storable without a
// distributive Extract union (which TS cannot reconcile with a concrete event).
type StoredHandler = (e: never) => void;

export class EventBus {
  private readonly handlers = new Map<GameEvent['type'], StoredHandler[]>();

  /** Subscribe to one event type. Returns an unsubscribe function. */
  on<T extends GameEvent['type']>(type: T, fn: Handler<T>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn as StoredHandler);
    this.handlers.set(type, list);
    return () => {
      const arr = this.handlers.get(type);
      if (!arr) return;
      const i = arr.indexOf(fn as StoredHandler);
      if (i !== -1) arr.splice(i, 1);
    };
  }

  /** Deliver an event to every handler registered for its type. */
  emit(e: GameEvent): void {
    const list = this.handlers.get(e.type);
    if (!list) return;
    // Copy so a handler that (un)subscribes during dispatch is safe.
    for (const fn of list.slice()) (fn as (ev: GameEvent) => void)(e);
  }
}
