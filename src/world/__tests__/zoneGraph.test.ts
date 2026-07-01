import { describe, it, expect } from 'vitest';
import { canPass } from '../zoneGraph';
import type { DoorDef } from '../zoneDef';
import type { GameFlag } from '../../content/types';

function door(lock?: DoorDef['lock']): DoorDef {
  return { id: 'test-door', at: [1, 2], to: 'great-hall', ...(lock ? { lock } : {}) };
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
