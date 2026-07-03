/**
 * Structural validation for EVERY registered zone (Task 11). New zones get
 * these checks for free the moment they land in `ZONES` — a typo'd grid,
 * an off-floor spawn, a dangling door target, or a duplicated lore id
 * fails HERE instead of in-game.
 *
 * Door-target allowlist: a door may point at a zone that hasn't shipped yet
 * (the campaign is built zone-by-zone); those ids must appear in
 * `FUTURE_ZONE_IDS`, which shrinks as T12/T15/T16 land their zones.
 */
import { describe, it, expect } from 'vitest';
import type { ZoneId } from '../types';
import type { GridPos, ZoneDef } from '../../world/zoneDef';
import { gridToPlacements } from '../../world/ZoneBuilder';
import { doorEntry, doorSpan, pairedDoor } from '../../world/zoneGraph';
import { FUTURE_ZONE_IDS, ZONES, hasZone, zoneOrThrow } from '../zones';
import { LORE } from '../lore';

const entries = Object.entries(ZONES) as [ZoneId, ZoneDef][];

/** Grid char at [row, col]; undefined when out of bounds. */
function charAt(def: ZoneDef, [row, col]: GridPos): string | undefined {
  return def.grid[row]?.[col];
}

/** Plain walkable floor ('.', or a zone letter mapped to floor). */
function isPlainFloor(def: ZoneDef, at: GridPos): boolean {
  const ch = charAt(def, at);
  if (ch === undefined) return false;
  return ch === '.' || def.tiles[ch] === 'floor';
}

/** Any walkable cell (floor, spawn, banner, door digit). */
function isWalkable(def: ZoneDef, at: GridPos): boolean {
  const ch = charAt(def, at);
  if (ch === undefined) return false;
  if ('.SBD'.includes(ch) || (ch >= '1' && ch <= '9')) return true;
  return def.tiles[ch] === 'floor';
}

/** True when the cell blocks movement (wall char, unmapped, or oob). */
function isWall(def: ZoneDef, row: number, col: number): boolean {
  const ch = charAt(def, [row, col]);
  if (ch === undefined) return true;
  if (ch === '#') return true;
  if ('.~SBD'.includes(ch) || (ch >= '1' && ch <= '9')) return false;
  return def.tiles[ch] !== 'floor' && def.tiles[ch] !== 'void';
}

describe('zone registry', () => {
  it('registers the two Task 11 zones', () => {
    expect(ZONES['ashen-gate']).toBeDefined();
    expect(ZONES['great-hall']).toBeDefined();
  });

  it('registers the two Task 12 zones', () => {
    expect(ZONES['undercroft']).toBeDefined();
    expect(ZONES['ramparts']).toBeDefined();
  });

  it('registers the two Task 15 zones', () => {
    expect(ZONES['throne']).toBeDefined();
    expect(ZONES['summit']).toBeDefined();
  });

  it('registers the Task 16 zone (queens-garden), completing the castle seven', () => {
    expect(ZONES['queens-garden']).toBeDefined();
  });

  it('registers the first Greater Vael exterior — the Gate Fields hub (Task 9)', () => {
    expect(ZONES['gate-fields']).toBeDefined();
  });

  it('registers the second Greater Vael exterior — the Ashen Forest N (Task 10)', () => {
    expect(ZONES['ashen-forest-n']).toBeDefined();
    // Seven castle zones + the Gate Fields hub + the Ashen Forest N.
    expect(Object.keys(ZONES)).toHaveLength(9);
  });

  it('zoneOrThrow returns every registered zone (the campaign is complete)', () => {
    expect(zoneOrThrow('ashen-gate').id).toBe('ashen-gate');
    expect(zoneOrThrow('queens-garden').id).toBe('queens-garden');
  });

  it('hasZone mirrors registration', () => {
    expect(hasZone('great-hall')).toBe(true);
    expect(hasZone('throne')).toBe(true);
    expect(hasZone('summit')).toBe(true);
    expect(hasZone('queens-garden')).toBe(true);
  });

  it('the future-zone allowlist holds only the unbuilt Greater Vael targets', () => {
    // Greater Vael Drop 1 re-arms the allowlist: the Gate Fields hub (Task 9)
    // opens roads into three zones that Tasks 10–12 build — cinder-village,
    // ashen-forest-n, pilgrims-descent — plus the Drop-2 salt-road forward ref.
    // Each is removed as its zone ships (the structural tests then demand a real
    // pairing). Task 10 shipped ashen-forest-n, so it is gone from the list.
    expect([...FUTURE_ZONE_IDS].sort()).toEqual([
      'cinder-village',
      'pilgrims-descent',
      'salt-road',
    ]);
    // No registered/built zone may ever sit in the allowlist…
    for (const [id] of entries) expect(FUTURE_ZONE_IDS.has(id)).toBe(false);
    // …and everything on the allowlist is genuinely unbuilt.
    for (const id of FUTURE_ZONE_IDS) expect(hasZone(id)).toBe(false);
  });

  it('lore ids are unique game-wide', () => {
    const ids = entries.flatMap(([, def]) => def.lore.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('door ids are unique game-wide', () => {
    const ids = entries.flatMap(([, def]) => def.doors.map((d) => d.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('item pickup ids are unique game-wide', () => {
    const ids = entries.flatMap(([, def]) => (def.items ?? []).map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pair edge id is two-ended between built zones (never triple)', () => {
    // A passage's `pair` id is shared by its two door ends. When both ends'
    // zones are built it must appear on exactly TWO doors; a lone end is only
    // allowed when it targets a not-yet-built zone (the hall's throne door
    // pairs 'hall-throne' with no partner until T15 builds the throne).
    const byPair = new Map<string, ZoneId[]>();
    for (const [, def] of entries) {
      for (const d of def.doors) {
        if (!d.pair) continue;
        byPair.set(d.pair, [...(byPair.get(d.pair) ?? []), d.to]);
      }
    }
    for (const [pair, targets] of byPair) {
      expect(targets.length, `pair "${pair}" reused on ${targets.length} doors`).toBeLessThanOrEqual(2);
      for (const to of targets) {
        if (hasZone(to)) {
          expect(targets.length, `pair "${pair}" targets built ${to} but is single-ended`).toBe(2);
        }
      }
    }
  });

  it('every placed LoreSpot id resolves to a base LORE entry (Task 13)', () => {
    // T12 left the spots referencing ids with placeholder text; T13 makes the
    // ids resolve into real, non-NG+ content.
    const placed = entries.flatMap(([, def]) => def.lore.map((l) => l.id));
    for (const id of placed) {
      const entry = LORE[id];
      expect(entry, `LoreSpot "${id}" has no LORE entry`).toBeDefined();
      expect(entry.ngOnly ?? false, `LoreSpot "${id}" placed a T16 NG+ entry`).toBe(false);
    }
  });

  it('no orphaned base LORE entries — every base entry is placed in a zone', () => {
    const placed = new Set(entries.flatMap(([, def]) => def.lore.map((l) => l.id)));
    for (const [id, entry] of Object.entries(LORE)) {
      if (entry.ngOnly) continue;
      expect(placed.has(id), `base LORE "${id}" is defined but never placed`).toBe(true);
    }
  });

  it('NG+ (ngOnly) LORE entries are placed only in ngPlus.addedLore, never base lore (T16)', () => {
    const basePlaced = new Set(entries.flatMap(([, def]) => def.lore.map((l) => l.id)));
    const ngPlaced = entries.flatMap(([, def]) => (def.ngPlus?.addedLore ?? []).map((l) => l.id));
    const ngOnly = Object.entries(LORE).filter(([, e]) => e.ngOnly).map(([id]) => id);
    expect(ngOnly.length).toBeGreaterThan(0);
    // No ngOnly entry leaks into a base lore array (base runs must never show them).
    for (const id of ngOnly) {
      expect(basePlaced.has(id), `ngOnly "${id}" leaked into base lore`).toBe(false);
    }
    // The bijection: every addedLore entry is an ngOnly one, resolves, placed once.
    expect(new Set(ngPlaced).size, 'an ngOnly entry is placed twice').toBe(ngPlaced.length);
    expect(new Set(ngPlaced)).toEqual(new Set(ngOnly));
    for (const id of ngPlaced) {
      expect(LORE[id], `addedLore "${id}" has no LORE entry`).toBeDefined();
      expect(LORE[id].ngOnly ?? false, `addedLore "${id}" is not an ngOnly entry`).toBe(true);
    }
  });

  it('vista ids are unique game-wide', () => {
    const ids = entries.flatMap(([, def]) => (def.vista ? [def.vista.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the game start zone (ashen-gate) carries the vista', () => {
    expect(ZONES['ashen-gate']?.vista?.id).toBeTruthy();
  });

  it('the Ashen Gate postern pairs both ways with the Gate Fields hub (Task 9)', () => {
    const gate = zoneOrThrow('ashen-gate');
    const fields = zoneOrThrow('gate-fields');
    const gateToFields = gate.doors.find((d) => d.id === 'gate-to-fields');
    const gfToGate = fields.doors.find((d) => d.id === 'gf-to-gate');
    expect(gateToFields, 'ashen-gate is missing the gate-to-fields postern').toBeDefined();
    expect(gfToGate, 'gate-fields is missing the gf-to-gate postern').toBeDefined();
    // Both ends share the passage edge and the Greater Vael lock.
    expect(gateToFields!.pair).toBe('gate-fields-postern');
    expect(gfToGate!.pair).toBe('gate-fields-postern');
    expect(gateToFields!.lock).toBe('greatervael');
    expect(gfToGate!.lock).toBe('greatervael');
    // Walking the postern lands the player at the OTHER zone's paired door.
    expect(pairedDoor('ashen-gate', gateToFields!, fields)?.to).toBe('ashen-gate');
    expect(pairedDoor('gate-fields', gfToGate!, gate)?.to).toBe('gate-fields');
  });

  it('the Gate Fields E road pairs both ways with the Ashen Forest N (Task 10)', () => {
    const fields = zoneOrThrow('gate-fields');
    const forest = zoneOrThrow('ashen-forest-n');
    const gfToForest = fields.doors.find((d) => d.id === 'gf-to-forest');
    const afToFields = forest.doors.find((d) => d.id === 'af-to-fields');
    expect(gfToForest, 'gate-fields is missing the gf-to-forest road').toBeDefined();
    expect(afToFields, 'ashen-forest-n is missing the af-to-fields road').toBeDefined();
    // Both ends share the single passage edge — the forest's only door.
    expect(gfToForest!.pair).toBe('gf-forest');
    expect(afToFields!.pair).toBe('gf-forest');
    expect(forest.doors).toHaveLength(1); // the forest dead-ends at the fog-line
    // Walking the road lands the player at the OTHER zone's paired door.
    expect(pairedDoor('gate-fields', gfToForest!, forest)?.to).toBe('gate-fields');
    expect(pairedDoor('ashen-forest-n', afToFields!, fields)?.to).toBe('ashen-forest-n');
  });
});

describe.each(entries)('zone %s', (id, def) => {
  it('registry key matches def.id', () => {
    expect(def.id).toBe(id);
  });

  it('uses the canonical 2m cell', () => {
    expect(def.cell).toBe(2);
  });

  it('grid rows are equal length and the grid is real', () => {
    expect(def.grid.length).toBeGreaterThanOrEqual(3);
    const width = def.grid[0].length;
    expect(width).toBeGreaterThanOrEqual(3);
    for (const row of def.grid) expect(row.length).toBe(width);
  });

  it('has exactly one S (player spawn)', () => {
    const count = def.grid.join('').split('S').length - 1;
    expect(count).toBe(1);
  });

  it('grid holds only known chars (gridToPlacements builds it)', () => {
    expect(() => gridToPlacements(def)).not.toThrow();
  });

  it('every door anchors on a door char, one door per digit, no orphan digits', () => {
    const seen = new Set<string>();
    for (const door of def.doors) {
      const ch = charAt(def, door.at);
      expect(ch, `door ${door.id} anchor char`).toMatch(/[1-9D]/);
      expect(seen.has(ch!), `digit ${ch} claimed twice`).toBe(false);
      seen.add(ch!);
    }
    for (const row of def.grid) {
      for (const ch of row) {
        if (ch >= '1' && ch <= '9') {
          expect(seen.has(ch), `grid digit ${ch} has no DoorDef`).toBe(true);
        }
      }
    }
  });

  it('door anchors sit on a wall line (>=1 orthogonal wall) and are enterable', () => {
    for (const door of def.doors) {
      const [r, c] = door.at;
      const wallSides = [
        isWall(def, r - 1, c),
        isWall(def, r + 1, c),
        isWall(def, r, c - 1),
        isWall(def, r, c + 1),
      ].filter(Boolean).length;
      expect(wallSides, `door ${door.id} not on a wall line`).toBeGreaterThanOrEqual(1);
      // And the paired-entry rule can place a player: the arrival cell must
      // be walkable and NOT another door cell (that would chain-transition).
      const entry = doorEntry(def, door);
      const [er, ec] = [Math.floor(entry.z / def.cell), Math.floor(entry.x / def.cell)];
      const ch = charAt(def, [er, ec]);
      expect(isWalkable(def, [er, ec]), `door ${door.id} entry not walkable`).toBe(true);
      expect(ch !== undefined && (ch >= '1' && ch <= '9'), `door ${door.id} entry on a door cell`).toBe(false);
    }
  });

  it('door targets are registered zones or on the future allowlist', () => {
    for (const door of def.doors) {
      expect(door.to === id, `door ${door.id} targets its own zone`).toBe(false);
      expect(
        hasZone(door.to) || FUTURE_ZONE_IDS.has(door.to),
        `door ${door.id} target ${door.to} neither built nor allowlisted`,
      ).toBe(true);
    }
  });

  it('doors into built zones pair back (a walkable return edge exists)', () => {
    for (const door of def.doors) {
      if (!hasZone(door.to)) continue;
      const target = zoneOrThrow(door.to);
      const paired = pairedDoor(id, door, target);
      expect(paired, `door ${door.id} has no paired door in ${door.to}`).toBeDefined();
      expect(paired?.to).toBe(id);
    }
  });

  it('door spans cover every cell of multi-cell gates', () => {
    for (const door of def.doors) {
      const span = doorSpan(def, door);
      expect(span.length).toBeGreaterThanOrEqual(1);
      const ch = charAt(def, door.at);
      for (const cell of span) expect(charAt(def, cell)).toBe(ch);
      // The anchor itself is in the span.
      expect(span).toContainEqual(door.at);
    }
  });

  it('banner def exists iff the grid has a B, and they agree', () => {
    const bCells: GridPos[] = [];
    def.grid.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === 'B') bCells.push([r, c]);
    });
    if (def.banner) {
      expect(bCells).toContainEqual(def.banner.at);
      expect(def.banner.name.length).toBeGreaterThan(0);
    } else {
      expect(bCells).toHaveLength(0);
    }
  });

  it('lore spots sit on plain floor cells (content resolves via LORE)', () => {
    for (const spot of def.lore) {
      expect(isPlainFloor(def, spot.at), `lore ${spot.id} off-floor`).toBe(true);
    }
  });

  it('NG+ addedLore spots (when present) sit on plain floor cells', () => {
    for (const spot of def.ngPlus?.addedLore ?? []) {
      expect(isPlainFloor(def, spot.at), `NG+ lore ${spot.id} off-floor`).toBe(true);
    }
  });

  it('item pickups (when present) sit on plain floor with an inscription', () => {
    for (const item of def.items ?? []) {
      expect(isPlainFloor(def, item.at), `item ${item.id} off-floor`).toBe(true);
      expect(item.card.length, `item ${item.id} has no card`).toBeGreaterThan(0);
    }
  });

  it('ambient floor (when set) is a 0..1 fraction', () => {
    if (def.ambientFloor === undefined) return;
    expect(def.ambientFloor).toBeGreaterThanOrEqual(0);
    expect(def.ambientFloor).toBeLessThanOrEqual(1);
  });

  it('enemy spawns (base and NG+) sit on plain floor cells', () => {
    const rosters = [def.enemies, def.ngPlus?.enemies ?? []];
    for (const roster of rosters) {
      for (const spawn of roster) {
        expect(isPlainFloor(def, spawn.at), `${spawn.kind} @ ${String(spawn.at)}`).toBe(true);
      }
    }
  });

  it('torches respect the 4-light budget and hang on a wall', () => {
    expect(def.lights.length).toBeLessThanOrEqual(4);
    for (const torch of def.lights) {
      const [r, c] = torch.at;
      // Out-of-grid torches are backdrop accents (e.g. the vista's distant
      // ember); out-of-bounds reads as wall so the builder mounts them fine.
      const outside = r < 0 || c < 0 || r >= def.grid.length || c >= def.grid[0].length;
      if (outside) continue;
      expect(isWalkable(def, torch.at), `torch @ ${String(torch.at)} inside a wall`).toBe(true);
      const wallSides =
        Number(isWall(def, r - 1, c)) +
        Number(isWall(def, r + 1, c)) +
        Number(isWall(def, r, c - 1)) +
        Number(isWall(def, r, c + 1));
      expect(wallSides, `torch @ ${String(torch.at)} has no wall to hang on`).toBeGreaterThanOrEqual(1);
    }
  });

  it('props sit on walkable cells, or fully outside the grid (backdrop)', () => {
    // Out-of-grid props are unreachable set-dressing (the collider treats
    // out-of-bounds as solid): e.g. the ashen-gate vista's ruined skyline
    // beyond the north wall. On-grid props must sit on walkable cells.
    for (const prop of def.props) {
      const [row, col] = prop.at;
      const outside =
        row < 0 || col < 0 || row >= def.grid.length || col >= def.grid[0].length;
      if (outside) continue;
      expect(isWalkable(def, prop.at), `prop ${prop.kind} @ ${String(prop.at)}`).toBe(true);
    }
  });

  it('vista trigger cells (when present) are walkable', () => {
    if (!def.vista) return;
    expect(def.vista.id.length).toBeGreaterThan(0);
    expect(def.vista.cells.length).toBeGreaterThan(0);
    for (const cell of def.vista.cells) {
      expect(isWalkable(def, cell), `vista cell ${String(cell)}`).toBe(true);
    }
  });

  it('declares ambience layer ids for the audio task', () => {
    expect(def.ambience.length).toBeGreaterThan(0);
    for (const layer of def.ambience) expect(layer.length).toBeGreaterThan(0);
  });
});
