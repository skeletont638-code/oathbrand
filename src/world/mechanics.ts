/**
 * Zone interaction mechanics (Task 12) — the two irreversible progression
 * beats: taking a lore-item (the Gatekey) and kicking a gate open (the
 * Ramparts shortcut). Both mutate the shared game-flag set exactly once and
 * report whether they actually changed anything, so the caller (main.ts)
 * knows when to surface a card, persist the save, and swing the visual.
 * Pure TS — no three.js/DOM — so the flag rules are unit-tested headless.
 */
import type { GameFlag } from '../content/types';
import type { DoorDef, ItemSpot } from './zoneDef';
import { lockFlag } from './zoneGraph';

/**
 * Take a lore-item pickup: set its flag once. Returns true on a fresh take,
 * false if it was already held (a second `TAKE` is a harmless no-op).
 */
export function takeItem(item: ItemSpot, flags: Set<GameFlag>): boolean {
  if (flags.has(item.flag)) return false;
  flags.add(item.flag);
  return true;
}

/**
 * Kick a gate open from its own side: set the door's lock flag once,
 * permanently unsealing both ends of the passage. Returns true only when it
 * newly opens — false for a door that is not a `kick` gate (e.g. the hall
 * twin of the shortcut, which can never open itself), an unlocked door
 * (nothing to unseal), or one already open.
 */
export function kickOpen(door: DoorDef, flags: Set<GameFlag>): boolean {
  if (!door.kick || door.lock === undefined) return false;
  const flag = lockFlag(door.lock);
  if (flags.has(flag)) return false;
  flags.add(flag);
  return true;
}
