import { describe, it, expect } from 'vitest';
import {
  ENDING_ORDER,
  UNSEEN_MARK,
  endingsSeenCount,
  endingsTrackerModel,
} from '../endingsTracker';
import { ENDING_NAME } from '../../content/endings';
import type { EndingId } from '../../content/types';

describe('endingsTrackerModel', () => {
  it('an empty history is four unwitnessed slots in canonical order', () => {
    const model = endingsTrackerModel([]);
    expect(model.map((s) => s.id)).toEqual([...ENDING_ORDER]);
    expect(model.every((s) => !s.seen)).toBe(true);
    expect(model.every((s) => s.name === UNSEEN_MARK)).toBe(true);
  });

  it('a witnessed ending lights its slot and reveals its name', () => {
    const model = endingsTrackerModel([2]);
    const broken = model.find((s) => s.id === 2)!;
    expect(broken.seen).toBe(true);
    expect(broken.name).toBe(ENDING_NAME[2]);
    // the others stay dark + blank
    expect(model.filter((s) => s.seen)).toHaveLength(1);
    expect(model.find((s) => s.id === 1)!.name).toBe(UNSEEN_MARK);
  });

  it('is order-stable and dedupes (order of the input never leaks through)', () => {
    const model = endingsTrackerModel([4, 1, 1, 4]);
    expect(model.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(model.filter((s) => s.seen).map((s) => s.id)).toEqual([1, 4]);
  });

  it('ignores ids outside the four endings', () => {
    const model = endingsTrackerModel([99 as EndingId, 2]);
    expect(model.filter((s) => s.seen).map((s) => s.id)).toEqual([2]);
  });

  it('all four witnessed lights every slot', () => {
    const model = endingsTrackerModel([1, 2, 3, 4]);
    expect(model.every((s) => s.seen)).toBe(true);
    expect(model.map((s) => s.name)).toEqual([1, 2, 3, 4].map((id) => ENDING_NAME[id as EndingId]));
  });
});

describe('endingsSeenCount', () => {
  it('counts distinct witnessed endings of the four', () => {
    expect(endingsSeenCount([])).toBe(0);
    expect(endingsSeenCount([3])).toBe(1);
    expect(endingsSeenCount([1, 1, 2])).toBe(2);
    expect(endingsSeenCount([1, 2, 3, 4])).toBe(4);
    expect(endingsSeenCount([7 as EndingId])).toBe(0);
  });
});
