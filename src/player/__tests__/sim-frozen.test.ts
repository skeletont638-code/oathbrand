/**
 * Task 13 review obligation (tracked into T14): the simulation must FREEZE
 * while an overlay owns the screen. Movement is the canary — `Controller.update`
 * is the lock, and it must no-op whenever the game is not in `playing`
 * (`reading`, `dialogue`, `vision`, `paused`). This is a logic-level test of
 * that gate: it drives a real `Controller` against a fake collider that would
 * always move the player, and asserts the position only changes in `playing`.
 *
 * The Controller wires window/document/canvas listeners in its constructor;
 * vitest runs in node, so we stub the minimum DOM surface it touches (no
 * `ontouchstart`, so the touch UI path is skipped).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Game } from '../../engine/Game';
import { Controller } from '../Controller';
import type { GameState } from '../../engine/Game';

const noopListeners = { addEventListener: () => {}, removeEventListener: () => {} };

/** A collider that always slides the player exactly by the requested delta —
 *  so any movement the controller attempts is visible in `pos`. */
const OPEN_COLLIDER = {
  slide: (from: { x: number; z: number }, dir: { x: number; z: number }) => ({
    x: from.x + dir.x,
    z: from.z + dir.z,
  }),
} as never;

function playingGame(): Game {
  const g = new Game();
  g.transition('title');
  g.transition('playing');
  return g;
}

describe('sim frozen while an overlay is up (movement gate)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { ...noopListeners });
    vi.stubGlobal('document', { ...noopListeners, pointerLockElement: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  function movedZ(state: GameState): number {
    const game = playingGame();
    const controller = new Controller({
      game,
      canvas: { ...noopListeners } as unknown as HTMLCanvasElement,
    });
    controller.pos.set(0, 0, 0);
    controller.input.forward = true; // wants to walk toward -z
    if (state !== 'playing') game.transition(state);
    controller.update(1000, OPEN_COLLIDER);
    return controller.pos.z;
  }

  it('moves while playing', () => {
    expect(movedZ('playing')).toBeLessThan(0); // walked forward
  });

  it('is frozen while reading (inscription plate up)', () => {
    expect(movedZ('reading')).toBe(0);
  });

  it('is frozen during a dialogue', () => {
    expect(movedZ('dialogue')).toBe(0);
  });

  it('is frozen during a vision (the kneel memory)', () => {
    expect(movedZ('vision')).toBe(0);
  });

  it('is frozen while paused', () => {
    expect(movedZ('paused')).toBe(0);
  });
});
