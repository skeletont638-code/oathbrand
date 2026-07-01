/**
 * Zone lock-graph: which doors pass under which game flags.
 * Pure TS — no three.js.
 */
import type { GameFlag } from '../content/types';
import type { DoorDef } from './zoneDef';

/** The flag each lock kind requires before the door passes. */
const LOCK_FLAG: Record<NonNullable<DoorDef['lock']>, GameFlag> = {
  gatekey: 'gatekey',
  shortcut: 'shortcut-open',
  throne: 'throne-open',
  ngplus: 'ng-plus',
  illusory: 'garden-found', // illusory walls pass freely once revealed
};

/** No lock → always passes; otherwise the lock's flag must be set. */
export function canPass(door: DoorDef, flags: Set<GameFlag>): boolean {
  return door.lock === undefined || flags.has(LOCK_FLAG[door.lock]);
}
