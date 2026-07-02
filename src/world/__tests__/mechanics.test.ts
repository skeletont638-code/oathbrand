import { describe, it, expect } from 'vitest';
import type { GameFlag } from '../../content/types';
import type { DoorDef, ItemSpot } from '../zoneDef';
import { kickOpen, takeItem } from '../mechanics';

const gatekey: ItemSpot = {
  id: 'gatekey-vael',
  at: [2, 11],
  flag: 'gatekey',
  card: 'The Gatekey of Vael — cold iron, still warm.',
};

/** The ramparts side of the shortcut passage: kicked open from here. */
const shortcut: DoorDef = {
  id: 'ramparts-shortcut',
  at: [2, 16],
  to: 'great-hall',
  lock: 'shortcut',
  pair: 'hall-shortcut',
  kick: true,
};

describe('takeItem', () => {
  it('sets the item flag and reports a fresh take', () => {
    const flags = new Set<GameFlag>();
    expect(takeItem(gatekey, flags)).toBe(true);
    expect(flags.has('gatekey')).toBe(true);
  });

  it('is idempotent — a second take is a no-op', () => {
    const flags = new Set<GameFlag>(['gatekey']);
    expect(takeItem(gatekey, flags)).toBe(false);
    expect(flags.size).toBe(1);
  });
});

describe('kickOpen', () => {
  it('opens a kick door, setting its lock flag once', () => {
    const flags = new Set<GameFlag>();
    expect(kickOpen(shortcut, flags)).toBe(true);
    expect(flags.has('shortcut-open')).toBe(true);
  });

  it('is idempotent once the gate stands open', () => {
    const flags = new Set<GameFlag>(['shortcut-open']);
    expect(kickOpen(shortcut, flags)).toBe(false);
  });

  it('refuses a non-kick door (the hall side never opens itself)', () => {
    const hallSide: DoorDef = {
      id: 'hall-shortcut',
      at: [7, 11],
      to: 'ramparts',
      lock: 'shortcut',
      pair: 'hall-shortcut',
    };
    const flags = new Set<GameFlag>();
    expect(kickOpen(hallSide, flags)).toBe(false);
    expect(flags.size).toBe(0);
  });

  it('refuses an unlocked kick door (nothing to open)', () => {
    const noLock: DoorDef = { id: 'x', at: [0, 0], to: 'great-hall', kick: true };
    expect(kickOpen(noLock, new Set<GameFlag>())).toBe(false);
  });
});
