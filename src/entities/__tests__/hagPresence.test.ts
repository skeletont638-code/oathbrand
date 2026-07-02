/**
 * The Hag of the Fog-Line (Greater Vael Drop 1, Task 5) — a never-fighting,
 * never-chasing PRESENCE. Headless FSM coverage:
 *   - glimpse() shows her at the fog-line;
 *   - glimpsed, she recedes the instant the player approaches within recedeM
 *     (the same contract as the Watcher);
 *   - reaching the cairn (hagThreshold.at) makes her threshold-present (the
 *     bargain is available), and she never recedes there;
 *   - she never fights (no takeHit) and never steps toward the player.
 */
import { describe, it, expect } from 'vitest';
import { TUNING } from '../../content/tuning';
import { HagPresence } from '../HagPresence';
import type { HagThresholdDef, GridPos } from '../../world/zoneDef';

const HG = TUNING.greaterVael.hag;
const CELL = 2;

const THRESHOLD: HagThresholdDef = {
  at: [6, 5],
  glimpseCells: [
    [6, 2],
    [6, 3],
  ],
};

/** World XZ of a grid cell centre (2 m grid), for the far/near player poses. */
function world(cell: GridPos): { x: number; z: number } {
  return { x: (cell[1] + 0.5) * CELL, z: (cell[0] + 0.5) * CELL };
}

const FAR = { x: 9999, z: 9999 };

describe('HagPresence — the bargain, not the battle', () => {
  it('glimpse() shows her at the fog-line', () => {
    const h = new HagPresence(THRESHOLD, CELL);
    expect(h.state).toBe('absent');
    h.glimpse();
    expect(h.state).toBe('glimpsed');
    expect(h.present).toBe(true);
  });

  it('recedes the instant the player approaches within recedeM', () => {
    const h = new HagPresence(THRESHOLD, CELL);
    h.glimpse();
    const wp = h.worldPos();
    const near = { x: wp.x + (HG.recedeM - 1), z: wp.z };
    h.update(near, [0, 0]); // not at the cairn, and inside the recede ring
    expect(h.state).toBe('absent');
  });

  it('stays glimpsed while the player keeps his distance', () => {
    const h = new HagPresence(THRESHOLD, CELL);
    h.glimpse();
    h.update(FAR, [0, 0]);
    expect(h.state).toBe('glimpsed');
  });

  it('reaching the cairn makes her threshold-present (bargain available)', () => {
    const h = new HagPresence(THRESHOLD, CELL);
    expect(h.atThreshold(THRESHOLD.at)).toBe(true);
    expect(h.atThreshold([0, 0])).toBe(false);
    // Walking onto the cairn cell from anywhere presents the threshold — even
    // standing right on it (dist ~0), she does NOT recede there.
    h.update(world(THRESHOLD.at), THRESHOLD.at);
    expect(h.state).toBe('threshold');
    expect(h.present).toBe(true);
  });

  it('stepping off the cairn drops back to a fog-line glimpse', () => {
    const h = new HagPresence(THRESHOLD, CELL);
    h.update(world(THRESHOLD.at), THRESHOLD.at);
    expect(h.state).toBe('threshold');
    h.update(FAR, [0, 0]); // stepped away, keeping distance
    expect(h.state).toBe('glimpsed');
  });

  it('is not a combat entity — she never fights (no takeHit / hp)', () => {
    const h = new HagPresence(THRESHOLD, CELL);
    expect((h as unknown as { takeHit?: unknown }).takeHit).toBeUndefined();
    expect((h as unknown as { hp?: unknown }).hp).toBeUndefined();
  });
});
