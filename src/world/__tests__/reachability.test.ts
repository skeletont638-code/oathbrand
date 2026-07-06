/**
 * World reachability guard (world-expansion v1.2 §1). BFS the zoneGraph from
 * the game-start zone, treating a far-side-barred door as ONE-WAY (passable
 * only from its defining zone), and assert EVERY built zone — and the finale —
 * is reachable unaided. This is the phase-wide guard: every later content task
 * that adds a zone or a locked door must keep this green, or a player could be
 * sealed out of part of the world with no way in.
 *
 * Other lock kinds (gatekey / throne / illusory) are in-play keys you can
 * always earn, not topological cuts, so this connectivity test treats them as
 * open edges — only the far-side bar is directional here.
 */
import { describe, it, expect } from 'vitest';
import { ZONES, hasZone } from '../../content/zones';
import { isBarred, resolveDoorInstances } from '../doors';
import type { ZoneDef } from '../zoneDef';
import type { ZoneId } from '../../content/types';

const START: ZoneId = 'ashen-gate';
const FINALE: ZoneId = 'summit';

const builtZones = Object.values(ZONES).filter((z): z is ZoneDef => z !== undefined);
const byDefId = resolveDoorInstances(builtZones);
/** Fresh save: no far-side door has been opened yet. */
const opened = new Set<string>();

function neighbors(id: ZoneId): ZoneId[] {
  const def = ZONES[id];
  if (!def) return [];
  const out: ZoneId[] = [];
  for (const d of def.doors) {
    if (!hasZone(d.to)) continue; // target not built yet (FUTURE_ZONE_IDS)
    const inst = byDefId.get(d.id);
    if (inst && isBarred(inst, id, opened)) continue; // far side of a far-side bar
    out.push(d.to);
  }
  return out;
}

function reachableFrom(start: ZoneId): Set<ZoneId> {
  const seen = new Set<ZoneId>([start]);
  const queue: ZoneId[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as ZoneId;
    for (const n of neighbors(cur)) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

describe('world reachability', () => {
  const reached = reachableFrom(START);
  const allZones = Object.keys(ZONES) as ZoneId[];

  it('every built zone is reachable from the game start, unaided', () => {
    const unreached = allZones.filter((z) => !reached.has(z));
    expect(unreached, `unreachable zones: ${unreached.join(', ') || '(none)'}`).toEqual([]);
  });

  it('the finale zone (summit) is reachable from the start', () => {
    expect(reached.has(FINALE)).toBe(true);
  });

  it('BFS covers the whole registry (no zone trapped behind a far-side bar)', () => {
    expect(reached.size).toBe(allZones.length);
  });
});
