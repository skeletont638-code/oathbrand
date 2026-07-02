import { describe, it, expect } from 'vitest';
import { canPass, doorEntry, doorSpan, pairedDoor } from '../zoneGraph';
import type { DoorDef, ZoneDef } from '../zoneDef';
import type { GameFlag } from '../../content/types';

function door(lock?: DoorDef['lock']): DoorDef {
  return { id: 'test-door', at: [1, 2], to: 'great-hall', ...(lock ? { lock } : {}) };
}

/** Minimal ZoneDef for the pure door helpers. */
function zone(partial: Partial<ZoneDef>): ZoneDef {
  return {
    id: 'ashen-gate',
    grid: ['###', '#.#', '###'],
    cell: 2,
    tiles: {},
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
    ...partial,
  };
}

function flags(...f: GameFlag[]): Set<GameFlag> {
  return new Set(f);
}

describe('canPass', () => {
  it('unlocked door passes with no flags', () => {
    expect(canPass(door(), flags())).toBe(true);
  });

  it('unlocked door passes regardless of flags', () => {
    expect(canPass(door(), flags('gatekey', 'ng-plus'))).toBe(true);
  });

  it('gatekey lock blocks without the gatekey flag', () => {
    expect(canPass(door('gatekey'), flags())).toBe(false);
  });

  it('gatekey lock opens with the gatekey flag', () => {
    expect(canPass(door('gatekey'), flags('gatekey'))).toBe(true);
  });

  it('shortcut lock blocks without shortcut-open', () => {
    expect(canPass(door('shortcut'), flags())).toBe(false);
  });

  it('shortcut lock opens with shortcut-open', () => {
    expect(canPass(door('shortcut'), flags('shortcut-open'))).toBe(true);
  });

  it('throne lock blocks without throne-open', () => {
    expect(canPass(door('throne'), flags())).toBe(false);
  });

  it('throne lock opens with throne-open', () => {
    expect(canPass(door('throne'), flags('throne-open'))).toBe(true);
  });

  it('ngplus lock blocks without ng-plus', () => {
    expect(canPass(door('ngplus'), flags())).toBe(false);
  });

  it('ngplus lock opens with ng-plus', () => {
    expect(canPass(door('ngplus'), flags('ng-plus'))).toBe(true);
  });

  it('illusory lock blocks until the wall is revealed', () => {
    expect(canPass(door('illusory'), flags())).toBe(false);
  });

  it('illusory lock passes once garden-found is set', () => {
    expect(canPass(door('illusory'), flags('garden-found'))).toBe(true);
  });

  it('unrelated flags never open a lock', () => {
    expect(
      canPass(door('gatekey'), flags('shortcut-open', 'throne-open', 'ng-plus', 'garden-found')),
    ).toBe(false);
  });
});

describe('doorSpan', () => {
  it('single-cell door spans exactly its anchor', () => {
    const def = zone({ grid: ['#1#', '#.#', '###'] });
    const d: DoorDef = { id: 'd', at: [0, 1], to: 'great-hall' };
    expect(doorSpan(def, d)).toEqual([[0, 1]]);
  });

  it('multi-cell gate (repeated digit) spans every cell of the digit', () => {
    const def = zone({
      grid: ['######', '#....#', '#.11.#', '######'],
    });
    const d: DoorDef = { id: 'gate', at: [2, 2], to: 'great-hall' };
    expect(doorSpan(def, d)).toEqual([
      [2, 2],
      [2, 3],
    ]);
  });

  it('different digits stay separate spans', () => {
    const def = zone({ grid: ['#12#', '#..#', '####'] });
    const d1: DoorDef = { id: 'a', at: [0, 1], to: 'great-hall' };
    const d2: DoorDef = { id: 'b', at: [0, 2], to: 'undercroft' };
    expect(doorSpan(def, d1)).toEqual([[0, 1]]);
    expect(doorSpan(def, d2)).toEqual([[0, 2]]);
  });
});

describe('pairedDoor', () => {
  const gate: DoorDef = { id: 'gate-to-hall', at: [7, 5], to: 'great-hall', pair: 'gate-hall' };

  it('matches by explicit pair id first', () => {
    const hall = zone({
      id: 'great-hall',
      doors: [
        { id: 'hall-x', at: [1, 1], to: 'ashen-gate' }, // decoy (also points back)
        { id: 'hall-to-gate', at: [9, 9], to: 'ashen-gate', pair: 'gate-hall' },
      ],
    });
    expect(pairedDoor('ashen-gate', gate, hall)?.id).toBe('hall-to-gate');
  });

  it('falls back to the first door pointing back at the source zone', () => {
    const hall = zone({
      id: 'great-hall',
      doors: [
        { id: 'hall-to-ramparts', at: [1, 16], to: 'ramparts' },
        { id: 'hall-to-gate', at: [9, 9], to: 'ashen-gate' },
      ],
    });
    const unpaired: DoorDef = { id: 'gate-to-hall', at: [7, 5], to: 'great-hall' };
    expect(pairedDoor('ashen-gate', unpaired, hall)?.id).toBe('hall-to-gate');
  });

  it('returns undefined when the target has no return door', () => {
    const hall = zone({ id: 'great-hall', doors: [{ id: 'x', at: [1, 1], to: 'ramparts' }] });
    expect(pairedDoor('ashen-gate', gate, hall)).toBeUndefined();
  });
});

describe('doorEntry', () => {
  it('places the player one cell inward, facing into the room (north door)', () => {
    // Door on the north wall line; the room is south of it → face south (yaw π).
    const def = zone({ grid: ['#1#', '#.#', '###'] });
    const entry = doorEntry(def, { id: 'd', at: [0, 1], to: 'great-hall' });
    expect(entry.x).toBeCloseTo(3); // col 1 center
    expect(entry.z).toBeCloseTo(3); // row 1 center (one cell south of the anchor)
    expect(entry.yaw).toBeCloseTo(Math.PI);
  });

  it('faces north (yaw 0) when the room is north of the door', () => {
    const def = zone({ grid: ['###', '#.#', '#1#'] });
    const entry = doorEntry(def, { id: 'd', at: [2, 1], to: 'great-hall' });
    expect(entry.x).toBeCloseTo(3);
    expect(entry.z).toBeCloseTo(3);
    expect(entry.yaw).toBeCloseTo(0);
  });

  it('faces east (yaw -π/2) when the room is east of the door', () => {
    const def = zone({ grid: ['###', '1..', '###'] });
    const entry = doorEntry(def, { id: 'd', at: [1, 0], to: 'great-hall' });
    expect(entry.x).toBeCloseTo(3);
    expect(entry.z).toBeCloseTo(3);
    expect(entry.yaw).toBeCloseTo(-Math.PI / 2);
  });

  it('fails soft to the anchor cell itself when no floor neighbor exists', () => {
    const def = zone({ grid: ['###', '#1#', '###'] });
    const entry = doorEntry(def, { id: 'd', at: [1, 1], to: 'great-hall' });
    expect(entry.x).toBeCloseTo(3);
    expect(entry.z).toBeCloseTo(3);
    expect(entry.yaw).toBe(0);
  });
});
