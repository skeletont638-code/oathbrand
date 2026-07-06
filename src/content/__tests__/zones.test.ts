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
import { buildHeightRamps, gridToPlacements } from '../../world/ZoneBuilder';
import { doorEntry, doorSpan, pairedDoor } from '../../world/zoneGraph';
import { resolveDoorInstances } from '../../world/doors';
import { FUTURE_ZONE_IDS, ZONES, hasZone, zoneOrThrow } from '../zones';
import { UNDERCROFT } from '../zones/undercroft';
import { GREAT_HALL } from '../zones/greatHall';
import { LORE } from '../lore';
import { TUNING } from '../tuning';
import { isQuietSighting } from '../../engine/DreadDirector';

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

/** Flood-fill the set of walkable cells reachable from the zone's spawn, moving
 *  orthogonally across walkable cells only (void `~` and walls block). Used to
 *  prove a route exists around missing-floor holes. Keys are `String([r,c])`. */
function walkableReach(def: ZoneDef): Set<string> {
  let start: GridPos | undefined;
  def.grid.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === 'S') start = [r, c];
  });
  const seen = new Set<string>();
  if (!start) return seen;
  const queue: GridPos[] = [start];
  seen.add(String(start));
  while (queue.length > 0) {
    const [r, c] = queue.shift() as GridPos;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as GridPos[]) {
      const next: GridPos = [r + dr, c + dc];
      if (seen.has(String(next))) continue;
      if (!isWalkable(def, next)) continue;
      seen.add(String(next));
      queue.push(next);
    }
  }
  return seen;
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
  });

  it('registers the third Greater Vael exterior — the Cinder Village (Task 11)', () => {
    expect(ZONES['cinder-village']).toBeDefined();
  });

  it('registers the fourth Greater Vael exterior — the Pilgrim\'s Descent (Task 12)', () => {
    expect(ZONES['pilgrims-descent']).toBeDefined();
  });

  it('registers the keep\'s upper floors — the Hall Gallery + Hall Barracks (Task 4)', () => {
    // World Expansion v1.2: the keep grows upward (gallery) and outward
    // (barracks).
    expect(ZONES['hall-gallery']).toBeDefined();
    expect(ZONES['hall-barracks']).toBeDefined();
  });

  it('registers the keep chapel (Task 5), the phase\'s postern-payoff room', () => {
    // World Expansion v1.2: the chapel off the Ramparts (the raised altar + the
    // kneeler).
    expect(ZONES['keep-chapel']).toBeDefined();
  });

  it('registers the Gate Fields watchtower — ground + roof-walk (Task 6)', () => {
    // World Expansion v1.2: the first landscape ruin.
    expect(ZONES['tower-ground']).toBeDefined();
    expect(ZONES['tower-upper']).toBeDefined();
  });

  it('registers the Sunken Chapel — nave + crypt (Task 7)', () => {
    // World Expansion v1.2: the second landscape ruin.
    expect(ZONES['chapel-nave']).toBeDefined();
    expect(ZONES['chapel-crypt']).toBeDefined();
  });

  it('registers the Burnt Manor — ground + upper (Task 8)', () => {
    // World Expansion v1.2: the third and final landscape ruin. The 18 prior zones
    // + the manor's gutted hall & burnt gallery = 20.
    expect(ZONES['manor-ground']).toBeDefined();
    expect(ZONES['manor-upper']).toBeDefined();
    expect(Object.keys(ZONES)).toHaveLength(20);
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
    // pairing). Tasks 10–12 shipped ashen-forest-n, cinder-village and pilgrims-
    // descent, so all three are gone from the list — only the Drop-2 salt-road
    // (the Cinder Village + Pilgrim's Descent sealed arches point at it) remains.
    expect([...FUTURE_ZONE_IDS].sort()).toEqual([
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
    // Both ends share the fields spoke passage edge.
    expect(gfToForest!.pair).toBe('gf-forest');
    expect(afToFields!.pair).toBe('gf-forest');
    // The forest now carries TWO doors: the fields spoke (this) + the Chapel Door
    // (Task 7). The road-end fog-line is still the dead-end.
    expect(forest.doors).toHaveLength(2);
    // Walking the road lands the player at the OTHER zone's paired door.
    expect(pairedDoor('gate-fields', gfToForest!, forest)?.to).toBe('gate-fields');
    expect(pairedDoor('ashen-forest-n', afToFields!, fields)?.to).toBe('ashen-forest-n');
  });

  it('the Gate Fields W road pairs both ways with the Cinder Village (Task 11)', () => {
    const fields = zoneOrThrow('gate-fields');
    const village = zoneOrThrow('cinder-village');
    const gfToVillage = fields.doors.find((d) => d.id === 'gf-to-village');
    const cvToFields = village.doors.find((d) => d.id === 'cv-to-fields');
    expect(gfToVillage, 'gate-fields is missing the gf-to-village road').toBeDefined();
    expect(cvToFields, 'cinder-village is missing the cv-to-fields road').toBeDefined();
    // Both ends share the single passage edge into the village.
    expect(gfToVillage!.pair).toBe('gf-village');
    expect(cvToFields!.pair).toBe('gf-village');
    // Walking the road lands the player at the OTHER zone's paired door.
    expect(pairedDoor('gate-fields', gfToVillage!, village)?.to).toBe('gate-fields');
    expect(pairedDoor('cinder-village', cvToFields!, fields)?.to).toBe('cinder-village');
  });

  it('the Gate Fields S road pairs both ways with the Pilgrim\'s Descent (Task 12)', () => {
    const fields = zoneOrThrow('gate-fields');
    const descent = zoneOrThrow('pilgrims-descent');
    const gfToDescent = fields.doors.find((d) => d.id === 'gf-to-descent');
    const pdToFields = descent.doors.find((d) => d.id === 'pd-to-fields');
    expect(gfToDescent, 'gate-fields is missing the gf-to-descent road').toBeDefined();
    expect(pdToFields, 'pilgrims-descent is missing the pd-to-fields road').toBeDefined();
    // Both ends share the single passage edge down the gorge.
    expect(gfToDescent!.pair).toBe('gf-descent');
    expect(pdToFields!.pair).toBe('gf-descent');
    // Walking the road lands the player at the OTHER zone's paired door.
    expect(pairedDoor('gate-fields', gfToDescent!, descent)?.to).toBe('gate-fields');
    expect(pairedDoor('pilgrims-descent', pdToFields!, fields)?.to).toBe('pilgrims-descent');
  });

  it('the Pilgrim\'s Descent sealed way targets the Drop-2 salt-road (Task 12)', () => {
    const descent = zoneOrThrow('pilgrims-descent');
    const sealed = descent.doors.find((d) => d.id === 'pd-to-saltroad');
    expect(sealed, 'pilgrims-descent is missing the pd-to-saltroad sealed way').toBeDefined();
    expect(sealed!.to).toBe('salt-road');
    expect(sealed!.lock).toBe('greatervael');
    // The target is authored-but-unbuilt: a sealed arch this drop, never a live edge.
    expect(hasZone('salt-road')).toBe(false);
    expect(FUTURE_ZONE_IDS.has('salt-road')).toBe(true);
  });
});

describe('Pilgrim\'s Descent height layer (Task 12)', () => {
  const def = zoneOrThrow('pilgrims-descent');

  it('carries a heightGrid the exact dims of its grid (12 rows × 13 chars)', () => {
    expect(def.heightGrid, 'pilgrims-descent has no heightGrid').toBeDefined();
    expect(def.heightGrid!.length).toBe(def.grid.length);
    expect(def.heightGrid!.length).toBe(12);
    for (let r = 0; r < def.heightGrid!.length; r++) {
      expect(def.heightGrid![r].length, `heightGrid row ${r}`).toBe(def.grid[r].length);
      expect(def.heightGrid![r].length, `heightGrid row ${r} width`).toBe(13);
    }
  });

  it('the terraced descent yields exactly three ramps on the Δ1 seams', () => {
    const seams = buildHeightRamps(def);
    const ramps = seams.filter((s) => s.kind === 'ramp');
    expect(ramps).toHaveLength(3);
    // The single serpentine's three steps down: col10 [2→3] (band 3→2),
    // col1 [5→6] (band 2→1), col10 [8→9] (band 1→0).
    expect(ramps).toContainEqual({ a: [2, 10], b: [3, 10], kind: 'ramp' });
    expect(ramps).toContainEqual({ a: [5, 1], b: [6, 1], kind: 'ramp' });
    expect(ramps).toContainEqual({ a: [8, 10], b: [9, 10], kind: 'ramp' });
  });

  it('renders the gorge as cliff faces (path vs void Δ≥2)', () => {
    const cliffs = buildHeightRamps(def).filter((s) => s.kind === 'cliff');
    expect(cliffs.length).toBeGreaterThanOrEqual(1);
  });

  it('the PD-1 Watcher anchor sits beyond the min sighting range from EVERY vista trigger cell', () => {
    // Regression (rule 10): PD-1's `showsWatcher` fires on the vista, whose trigger
    // cells span the top ledge. The manifest anchor must sit ≥ sightingRangeMinM
    // (16 m) from every one of them, or the DreadDirector voids the sighting and
    // the hero beat "across it, the watcher, waiting" shows nothing. The old
    // anchor [1,-3] was only 8 m from [1,1] — it manifested-and-receded unseen.
    const minM = TUNING.greaterVael.watcher.sightingRangeMinM;
    expect(def.watcherAnchors?.length ?? 0).toBeGreaterThan(0);
    expect(def.vista?.cells.length ?? 0).toBeGreaterThan(0);
    for (const anchor of def.watcherAnchors!) {
      for (const cell of def.vista!.cells) {
        const distM = Math.hypot(anchor[0] - cell[0], anchor[1] - cell[1]) * def.cell;
        expect(
          distM,
          `Watcher anchor ${String(anchor)} is ${distM} m from vista cell ${String(cell)} — must be ≥ ${minM} m`,
        ).toBeGreaterThanOrEqual(minM);
      }
    }
  });

  it('the PD-1 Watcher anchor is unreachable and elevated onto the far cliff', () => {
    // Round-2 visibility fix: the "across it, the watcher" anchor must (a) be a
    // place the player can never STAND — off-grid, or a gorge-void `~` / border
    // `#` cell (a void cell is a lethal fall → reset, so it is unreachable) — and
    // (b) carry an ELEVATION that stands it near/above the band-3 vista ledge
    // (4.5 m), so its 3 m silhouette breaks the horizon against the sky instead of
    // sitting on the y=0 gorge floor (round 1: ~4.5 m below the ledge sill →
    // occluded + fog-dissolved, zero pixel delta).
    const rows = def.grid.length;
    const cols = def.grid[0].length;
    const LEDGE_M = 4.5; // band 3 (heightGrid digit 3 × 1.5 m/level)
    for (const anchor of def.watcherAnchors!) {
      const [r, c, elevM] = anchor;
      const offGrid = r < 0 || r >= rows || c < 0 || c >= cols;
      const cell = offGrid ? undefined : def.grid[r][c];
      const unreachable = offGrid || cell === '~' || cell === '#';
      expect(
        unreachable,
        `Watcher anchor ${String(anchor)} must be unreachable (off-grid, void '~', or wall '#') — got cell '${cell}'`,
      ).toBe(true);
      expect(
        elevM ?? 0,
        `Watcher anchor ${String(anchor)} must carry an elevation ≥ ~the vista ledge (${LEDGE_M} m)`,
      ).toBeGreaterThanOrEqual(LEDGE_M);
    }
  });
});

describe('Greater Vael Watcher sightings (finding 2)', () => {
  const minM = TUNING.greaterVael.watcher.sightingRangeMinM;
  const exterior = entries.filter(([, d]) => d.kind === 'exterior');

  it('both quiet sightings are authored as watcher beats (Gate Fields quiet + Cinder rooftop)', () => {
    // A "quiet" sighting = a showsWatcher beat with NO screen gimmick. The review
    // found these two were anchor-only (no beat carried them) so they never fired.
    const gf = (zoneOrThrow('gate-fields').scares ?? []).filter((s) => s.showsWatcher && s.gimmick === null);
    const cv = (zoneOrThrow('cinder-village').scares ?? []).filter((s) => s.showsWatcher && s.gimmick === null);
    expect(gf.length, 'Gate Fields is missing its quiet Watcher beat').toBe(1);
    expect(cv.length, 'Cinder Village is missing its rooftop Watcher beat').toBe(1);
  });

  it('the drop authors exactly 4 Watcher sightings (2 gimmick-beat riders + 2 quiet), within the 6 budget', () => {
    const ids = exterior.flatMap(([, d]) => d.scares ?? []).filter((s) => s.showsWatcher).map((s) => s.id);
    expect(ids.sort()).toEqual(['AF-2', 'CV-4', 'GF-3', 'PD-1']);
    expect(ids.length).toBeLessThanOrEqual(TUNING.greaterVael.watcher.sightingsPerDrop.max);
  });

  it('ceiling arithmetic is consistent: ceiling-COUNTING beats fit maxBeatsPerDrop exactly (quiet sightings exempt)', () => {
    // Finding-2 resolution (owner, option b): quiet watcher-only sightings are
    // exempt from the beat ceiling — asserted with the scheduler's OWN predicate
    // (isQuietSighting), so authoring and enforcement can never diverge. The
    // drop authors 12 beats = 10 counting (spec §5's gimmick table) + 2 quiet
    // (GF-3, CV-4); a future beat addition that breaks the 10 cap fails HERE.
    const all = exterior.flatMap(([, d]) => d.scares ?? []);
    const quiet = all.filter((s) => isQuietSighting(s));
    const counting = all.length - quiet.length;
    expect(quiet.map((s) => s.id).sort()).toEqual(['CV-4', 'GF-3']);
    expect(counting).toBeLessThanOrEqual(TUNING.greaterVael.dread.maxBeatsPerDrop);
    expect(counting).toBe(10); // the exact §5 table
  });

  it('every showsWatcher beat manifests only BEYOND the min sighting range from each of its trigger cells', () => {
    // DreadDirector rule 10 voids a sighting fired from within sightingRangeMinM
    // (16 m) of the anchor — so a quiet sighting authored too close manifests and
    // recedes UNSEEN. Assert every cellEnter/approach trigger cell of every
    // showsWatcher beat is ≥16 m from every anchor in its zone. (PD-1 fires on a
    // `vista` trigger, covered by the Pilgrim's Descent anchor test above.)
    let checked = 0;
    for (const [, def] of exterior) {
      const anchors = def.watcherAnchors ?? [];
      for (const beat of def.scares ?? []) {
        if (!beat.showsWatcher) continue;
        const t = beat.trigger;
        const cells: GridPos[] = t.on === 'cellEnter' ? t.cells : t.on === 'approach' ? [t.at] : [];
        for (const cell of cells) {
          for (const anchor of anchors) {
            const distM = Math.hypot(anchor[0] - cell[0], anchor[1] - cell[1]) * def.cell;
            expect(
              distM,
              `${def.id} beat ${beat.id}: anchor ${String(anchor)} is ${distM} m from trigger ${String(cell)} — must be ≥ ${minM} m`,
            ).toBeGreaterThanOrEqual(minM);
            checked += 1;
          }
        }
      }
    }
    expect(checked, 'no showsWatcher trigger cells were checked').toBeGreaterThan(0);
  });
});

describe('The Watchtower (Task 6) — entry, stair, and roof-walk', () => {
  const fields = zoneOrThrow('gate-fields');
  const ground = zoneOrThrow('tower-ground');
  const upper = zoneOrThrow('tower-upper');

  it('the Tower Door pairs both ways between the Gate Fields and the guardroom', () => {
    const gfToTower = fields.doors.find((d) => d.id === 'gf-to-tower');
    const towerToFields = ground.doors.find((d) => d.id === 'tower-ground-to-fields');
    expect(gfToTower, 'gate-fields is missing the gf-to-tower door').toBeDefined();
    expect(towerToFields, 'tower-ground is missing the tower-ground-to-fields door').toBeDefined();
    expect(gfToTower!.pair).toBe('tower-door');
    expect(towerToFields!.pair).toBe('tower-door');
    expect(gfToTower!.lock, 'the Tower Door is unlocked').toBeUndefined();
    // The new gate cell '6' sits on the fields grid, not on any prior gate digit.
    expect(charAt(fields, [3, 0])).toBe('6');
    expect(pairedDoor('gate-fields', gfToTower!, ground)?.to).toBe('gate-fields');
    expect(pairedDoor('tower-ground', towerToFields!, fields)?.to).toBe('tower-ground');
  });

  it('the new Tower Door gate does not disturb any Gate Fields contract cell', () => {
    // The postern gate '5' (T5) and every other gate/spawn/banner keep their cells.
    expect(charAt(fields, [0, 4])).toBe('5'); // T5 postern, untouched
    expect(charAt(fields, [0, 7])).toBe('1'); // ashen-gate gate 11
    expect(charAt(fields, [13, 7])).toBe('4'); // pilgrims-descent gate 44
    expect(fields.banner?.at).toEqual([7, 7]);
    // Every fields lore/enemy/beat/scatter/planted-trunk id is unchanged, and the
    // Tower Door's inward entry cell is clean floor (not a scatter/lore/enemy cell).
    const entry = doorEntry(fields, fields.doors.find((d) => d.id === 'gf-to-tower')!);
    const [er, ec] = [Math.floor(entry.z / fields.cell), Math.floor(entry.x / fields.cell)];
    expect([er, ec]).toEqual([3, 1]);
    expect(isPlainFloor(fields, [3, 1])).toBe(true);
  });

  it('the Stair Door pairs both ways between the two tower floors', () => {
    const groundUp = ground.doors.find((d) => d.id === 'tower-ground-to-upper');
    const upperDown = upper.doors.find((d) => d.id === 'tower-upper-to-ground');
    expect(groundUp?.pair).toBe('tower-stair');
    expect(upperDown?.pair).toBe('tower-stair');
    expect(pairedDoor('tower-ground', groundUp!, upper)?.to).toBe('tower-ground');
    expect(pairedDoor('tower-upper', upperDown!, ground)?.to).toBe('tower-upper');
  });

  it('the guardroom is a dread interior with 3 torches, 1 soldier, 1 Act-I inscription', () => {
    expect(ground.dreadInterior).toBe(true);
    expect(ground.kind ?? 'interior').toBe('interior');
    expect(ground.torches?.length).toBe(3);
    expect(ground.enemies.filter((e) => e.kind === 'soldier')).toHaveLength(1);
    expect(ground.lore.map((l) => l.id)).toContain('act1-tower-a');
    expect(LORE['act1-tower-a']).toBeDefined();
  });

  it('the roof-walk is an exterior (sky/moon) with a flat-band heightGrid rising to the parapet', () => {
    // Roof-kind choice (see towerUpper docstring): exterior for the open-air
    // sky/moon + dread default; FLAT heightGrid bands (PD precedent) so the
    // undulation never fights the tower floor.
    expect(upper.kind).toBe('exterior');
    expect(upper.exteriorSky).toBe('field');
    expect(upper.heightGrid, 'tower-upper needs a heightGrid').toBeDefined();
    expect(upper.heightGrid!.length).toBe(upper.grid.length);
    for (let r = 0; r < upper.heightGrid!.length; r++) {
      expect(upper.heightGrid![r].length).toBe(upper.grid[r].length);
    }
    // The room→roof rise auto-generates walkable ramps on the Δ1 seam, and the
    // roof's band-2 lip drops to the surrounding `~` void as cliff faces.
    const seams = buildHeightRamps(upper);
    expect(seams.some((s) => s.kind === 'ramp'), 'the roof-walk step is a ramp').toBe(true);
    expect(seams.some((s) => s.kind === 'cliff'), 'the parapet lip drops to void as a cliff').toBe(true);
    // One archer holds the roof; one Act-I inscription reads the watcher's tally.
    expect(upper.enemies.filter((e) => e.kind === 'archer')).toHaveLength(1);
    expect(upper.lore.map((l) => l.id)).toContain('act1-tower-b');
  });

  it('reserves the 2×2 muster-echo roof block prop-free (Task 9)', () => {
    const reserved: GridPos[] = [[2, 2], [2, 3], [3, 2], [3, 3]];
    const occupied = new Set<string>([
      ...upper.props.map((p) => String(p.at)),
      ...upper.enemies.map((e) => String(e.at)),
      ...upper.lore.map((l) => String(l.at)),
    ]);
    for (const cell of reserved) {
      expect(isWalkable(upper, cell), `echo cell ${String(cell)} must be walkable roof`).toBe(true);
      expect(occupied.has(String(cell)), `echo cell ${String(cell)} must stay prop-free`).toBe(false);
    }
  });

  it('both Tower doors resolve to labelled DoorInstances (Tower Door + Stair Door)', () => {
    const byId = resolveDoorInstances(entries.map(([, d]) => d));
    expect(byId.get('gf-to-tower')?.label).toBe('Tower Door');
    expect(byId.get('tower-ground-to-fields')?.label).toBe('Tower Door');
    expect(byId.get('tower-ground-to-upper')?.label).toBe('Stair Door');
    expect(byId.get('tower-upper-to-ground')?.label).toBe('Stair Door');
  });
});

describe('The Sunken Chapel (Task 7) — entry, echo aisle, and crypt', () => {
  const forest = zoneOrThrow('ashen-forest-n');
  const nave = zoneOrThrow('chapel-nave');
  const crypt = zoneOrThrow('chapel-crypt');

  it('the Chapel Door pairs both ways between the Ashen Forest and the nave', () => {
    const afToChapel = forest.doors.find((d) => d.id === 'af-to-chapel');
    const naveToForest = nave.doors.find((d) => d.id === 'nave-to-forest');
    expect(afToChapel, 'ashen-forest-n is missing the af-to-chapel door').toBeDefined();
    expect(naveToForest, 'chapel-nave is missing the nave-to-forest door').toBeDefined();
    expect(afToChapel!.pair).toBe('chapel-door');
    expect(naveToForest!.pair).toBe('chapel-door');
    expect(afToChapel!.lock, 'the Chapel Door is unlocked').toBeUndefined();
    // The new gate cell '4' sits on the forest N wall, not on any prior gate digit.
    expect(charAt(forest, [0, 3])).toBe('4');
    expect(pairedDoor('ashen-forest-n', afToChapel!, nave)?.to).toBe('ashen-forest-n');
    expect(pairedDoor('chapel-nave', naveToForest!, forest)?.to).toBe('chapel-nave');
  });

  it('the new Chapel Door gate does not disturb any Ashen Forest contract cell', () => {
    // The forest's spawn/spoke-door/banner and every beat/threshold cell keep theirs.
    expect(charAt(forest, [2, 2])).toBe('S'); // spawn, untouched
    expect(charAt(forest, [1, 0])).toBe('3'); // the fields spoke door
    expect(forest.banner?.at).toEqual([5, 6]); // banner at the fog-line
    // The hounds, the Hag cairn/threshold and every AF beat trigger keep their cells.
    expect(forest.enemies.map((e) => String(e.at)).sort()).toEqual(['6,8', '9,10']);
    expect(forest.hagThreshold?.at).toEqual([8, 9]);
    expect(forest.lore.map((l) => l.id)).toContain('gv-forest-hag-cairn');
    // The Chapel Door's inward entry cell is clean road floor (not a lore/beat cell).
    const entry = doorEntry(forest, forest.doors.find((d) => d.id === 'af-to-chapel')!);
    const [er, ec] = [Math.floor(entry.z / forest.cell), Math.floor(entry.x / forest.cell)];
    expect([er, ec]).toEqual([1, 3]);
    expect(isWalkable(forest, [1, 3])).toBe(true);
  });

  it('the Crypt Stair pairs both ways between the nave and the crypt', () => {
    const naveDown = nave.doors.find((d) => d.id === 'nave-to-crypt');
    const cryptUp = crypt.doors.find((d) => d.id === 'crypt-to-nave');
    expect(naveDown?.pair).toBe('chapel-crypt-stair');
    expect(cryptUp?.pair).toBe('chapel-crypt-stair');
    expect(pairedDoor('chapel-nave', naveDown!, crypt)?.to).toBe('chapel-nave');
    expect(pairedDoor('chapel-crypt', cryptUp!, nave)?.to).toBe('chapel-crypt');
  });

  it('the nave is a dread interior with a raised altar, 2 lit torches, 2 Act-II inscriptions', () => {
    expect(nave.dreadInterior).toBe(true);
    expect(nave.kind ?? 'interior').toBe('interior');
    // The raised altar dais rides one band above the nave; the row2↔row3 seam is
    // the walkable ramp (mechanism A), the `stairs` prop the visible treads.
    expect(nave.heightGrid, 'chapel-nave needs a heightGrid').toBeDefined();
    expect(nave.heightGrid!.length).toBe(nave.grid.length);
    for (let r = 0; r < nave.heightGrid!.length; r++) {
      expect(nave.heightGrid![r].length).toBe(nave.grid[r].length);
    }
    expect(buildHeightRamps(nave).some((s) => s.kind === 'ramp'), 'the altar step is a ramp').toBe(true);
    // Two LIT torches (the kit's `torches`) flank the altar; the unlit read is a
    // bare `torch` bracket in `props` (no kit extension), at the collapsed south end.
    expect(nave.torches?.length).toBe(2);
    expect(nave.props.filter((p) => p.kind === 'torch')).toHaveLength(1);
    expect(nave.lore.map((l) => l.id).sort()).toEqual(['act2-nave-a', 'act2-nave-b']);
    expect(LORE['act2-nave-a']).toBeDefined();
    expect(LORE['act2-nave-b']).toBeDefined();
  });

  it('reserves the 4 contiguous aisle cells prop/enemy-free for the queen\'s-walk echo (Task 9)', () => {
    const reserved: GridPos[] = [[4, 3], [5, 3], [6, 3], [7, 3]];
    const occupied = new Set<string>([
      ...nave.props.map((p) => String(p.at)),
      ...nave.enemies.map((e) => String(e.at)),
      ...(nave.ngPlus?.enemies ?? []).map((e) => String(e.at)),
      ...nave.lore.map((l) => String(l.at)),
    ]);
    for (const cell of reserved) {
      expect(isWalkable(nave, cell), `echo cell ${String(cell)} must be walkable aisle`).toBe(true);
      expect(occupied.has(String(cell)), `echo cell ${String(cell)} must stay clear`).toBe(false);
    }
  });

  it('the crypt is a near-black dread interior with 2 torches, 1 wraith, bones, 1 inscription', () => {
    expect(crypt.dreadInterior).toBe(true);
    expect(crypt.kind ?? 'interior').toBe('interior');
    expect(crypt.ambientFloor).toBe(0.06); // the Undercroft's darkest precedent
    expect(crypt.keyLightIntensity).toBe(0); // never defeat the wraith showcase
    expect(crypt.torches?.length).toBe(2);
    expect(crypt.enemies.filter((e) => e.kind === 'wraith')).toHaveLength(1);
    expect((crypt.scatter ?? []).some((s) => s.kind === 'bones')).toBe(true);
    expect(crypt.lore.map((l) => l.id)).toEqual(['act2-crypt-a']);
    expect(LORE['act2-crypt-a']).toBeDefined();
  });

  it('both chapel doors resolve to labelled DoorInstances (Chapel Door + Crypt Stair)', () => {
    const byId = resolveDoorInstances(entries.map(([, d]) => d));
    expect(byId.get('af-to-chapel')?.label).toBe('Chapel Door');
    expect(byId.get('nave-to-forest')?.label).toBe('Chapel Door');
    expect(byId.get('nave-to-crypt')?.label).toBe('Crypt Stair');
    expect(byId.get('crypt-to-nave')?.label).toBe('Crypt Stair');
  });
});

describe('The Burnt Manor (Task 8) — entry, hearth vigil, and burnt gallery', () => {
  const village = zoneOrThrow('cinder-village');
  const ground = zoneOrThrow('manor-ground');
  const upper = zoneOrThrow('manor-upper');

  it('the Manor Door pairs both ways between the Cinder Village and the gutted hall', () => {
    const cvToManor = village.doors.find((d) => d.id === 'cv-to-manor');
    const manorToVillage = ground.doors.find((d) => d.id === 'manor-ground-to-village');
    expect(cvToManor, 'cinder-village is missing the cv-to-manor door').toBeDefined();
    expect(manorToVillage, 'manor-ground is missing the manor-ground-to-village door').toBeDefined();
    expect(cvToManor!.pair).toBe('manor-door');
    expect(manorToVillage!.pair).toBe('manor-door');
    expect(cvToManor!.lock, 'the Manor Door is unlocked').toBeUndefined();
    // The new gate cell '1' sits in the central-plaza pocket, not on any prior gate.
    expect(charAt(village, [3, 8])).toBe('1');
    expect(pairedDoor('cinder-village', cvToManor!, ground)?.to).toBe('cinder-village');
    expect(pairedDoor('manor-ground', manorToVillage!, village)?.to).toBe('manor-ground');
  });

  it('the new Manor Door gate does not disturb any Cinder Village contract cell', () => {
    // The spawn/roads/banner and the frozen-procession cells keep theirs.
    expect(charAt(village, [4, 1])).toBe('S'); // spawn, untouched
    expect(charAt(village, [4, 0])).toBe('3'); // the fields road
    expect(charAt(village, [4, 14])).toBe('D'); // the sealed east arch
    expect(village.banner?.at).toEqual([4, 7]); // the plaza banner
    // The live kneeler, both inert procession statues, and the gibbet keep their cells.
    expect(village.enemies.map((e) => String(e.at)).sort()).toEqual(['4,9', '5,11']);
    const statues = village.props.filter((p) => p.kind === 'statue-knight').map((p) => String(p.at)).sort();
    expect(statues).toEqual(['4,11', '4,3']);
    expect(village.props.some((p) => p.kind === 'gibbet' && String(p.at) === '2,7')).toBe(true);
    // The tithe-ledger item + its lore read + every scatter clump keep their cells.
    expect(village.items?.map((i) => String(i.at))).toEqual(['3,4']);
    expect(village.lore.map((l) => l.id)).toContain('gv-village-tithe-ledger');
    const scatterCells = new Set((village.scatter ?? []).flatMap((s) => s.cells.map((c) => String(c))));
    expect(scatterCells.has('3,8'), 'the gate cell must not sit on a scatter cell').toBe(false);
    // The Manor Door's inward entry cell is clean plaza-spine street (not a door cell).
    const entry = doorEntry(village, village.doors.find((d) => d.id === 'cv-to-manor')!);
    const [er, ec] = [Math.floor(entry.z / village.cell), Math.floor(entry.x / village.cell)];
    expect([er, ec]).toEqual([4, 8]);
    expect(isPlainFloor(village, [4, 8])).toBe(true);
  });

  it('the Stair Door pairs both ways between the two manor floors', () => {
    const groundUp = ground.doors.find((d) => d.id === 'manor-ground-to-upper');
    const upperDown = upper.doors.find((d) => d.id === 'manor-upper-to-ground');
    expect(groundUp?.pair).toBe('manor-stair');
    expect(upperDown?.pair).toBe('manor-stair');
    expect(pairedDoor('manor-ground', groundUp!, upper)?.to).toBe('manor-ground');
    expect(pairedDoor('manor-upper', upperDown!, ground)?.to).toBe('manor-upper');
  });

  it('the gutted hall is a dread interior with a kneeler vigil, 3 torches (2 lit + 1 unlit), 1 Act-II inscription', () => {
    expect(ground.dreadInterior).toBe(true);
    expect(ground.kind ?? 'interior').toBe('interior');
    // The sanctioned kneeler-vigil (T5) knelt by the hearth.
    expect(ground.enemies.filter((e) => e.kind === 'kneeler')).toHaveLength(1);
    // Torches ×3 as a mix: 2 LIT kit torches + 1 UNLIT bare `torch` bracket prop.
    expect(ground.torches?.length).toBe(2);
    expect(ground.props.filter((p) => p.kind === 'torch')).toHaveLength(1);
    // The hearth read = a prop cluster (hearth-breast pillar + fallen chimney rubble).
    expect(ground.props.some((p) => p.kind === 'pillar' && String(p.at) === '4,1')).toBe(true);
    expect(ground.lore.map((l) => l.id)).toEqual(['act2-manor-a']);
    expect(LORE['act2-manor-a']).toBeDefined();
  });

  it('reserves the 2×2 burning-echo block by the hearth prop/enemy-free (Scene 4, Task 9)', () => {
    const reserved: GridPos[] = [[3, 3], [3, 4], [4, 3], [4, 4]];
    const occupied = new Set<string>([
      ...ground.props.map((p) => String(p.at)),
      ...ground.enemies.map((e) => String(e.at)),
      ...(ground.ngPlus?.enemies ?? []).map((e) => String(e.at)),
      ...ground.lore.map((l) => String(l.at)),
    ]);
    for (const cell of reserved) {
      expect(isWalkable(ground, cell), `echo cell ${String(cell)} must be walkable hall`).toBe(true);
      expect(occupied.has(String(cell)), `echo cell ${String(cell)} must stay clear`).toBe(false);
    }
  });

  it('the burnt gallery is a dread interior with missing-floor void, 1 soldier, 2 torches, 1 inscription', () => {
    expect(upper.dreadInterior).toBe(true);
    expect(upper.kind ?? 'interior').toBe('interior');
    // The burned-through hole is authored as `~` void cells reading DOWN.
    const voidCells = upper.grid.flatMap((row, r) =>
      [...row].flatMap((ch, c) => (ch === '~' ? [[r, c] as GridPos] : [])),
    );
    expect(voidCells.length, 'the gallery needs missing-floor void cells').toBeGreaterThan(0);
    // A walkable route reaches every content cell without crossing the hole: BFS
    // the walkable cells from the spawn and assert each door/enemy/lore/torch cell
    // (or a walkable orthogonal neighbour, for wall-hung torches) is reached.
    const reach = walkableReach(upper);
    const near = (at: GridPos): boolean =>
      reach.has(String(at)) ||
      [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => reach.has(String([at[0] + dr, at[1] + dc])));
    for (const d of upper.doors) expect(near(d.at), `door ${d.id} unreachable`).toBe(true);
    for (const e of upper.enemies) expect(near(e.at), `enemy @ ${String(e.at)} unreachable`).toBe(true);
    for (const l of upper.lore) expect(near(l.at), `lore ${l.id} unreachable`).toBe(true);
    for (const t of upper.torches ?? []) expect(near(t.at), `torch @ ${String(t.at)} unreachable`).toBe(true);
    expect(upper.enemies.filter((e) => e.kind === 'soldier')).toHaveLength(1);
    expect(upper.torches?.length).toBe(2);
    expect(upper.lore.map((l) => l.id)).toEqual(['act2-manor-b']);
    expect(LORE['act2-manor-b']).toBeDefined();
  });

  it('both manor doors resolve to labelled DoorInstances (Manor Door + Stair Door)', () => {
    const byId = resolveDoorInstances(entries.map(([, d]) => d));
    expect(byId.get('cv-to-manor')?.label).toBe('Manor Door');
    expect(byId.get('manor-ground-to-village')?.label).toBe('Manor Door');
    expect(byId.get('manor-ground-to-upper')?.label).toBe('Stair Door');
    expect(byId.get('manor-upper-to-ground')?.label).toBe('Stair Door');
  });
});

describe('Undercroft wraith-showcase guard (realism pass)', () => {
  it('the undercroft zeroes its realism-pass key light (wraith showcase guard)', () => {
    expect(UNDERCROFT.keyLightIntensity).toBe(0);
  });
});

describe('Great Hall statue overlap fix (realism pass, Task 9)', () => {
  it('the great-hall statue no longer overlaps the inner-chamber wall', () => {
    const s = GREAT_HALL.props.find((p) => p.kind === 'statue-knight');
    expect(s?.at).toEqual([1, 13]); // moved off [2,13] (abutting the [3,13] wall block)
  });
});

// Realism density pass (map-gaps EMPTINESS §2): the owner reported the world felt
// empty. The read-only investigator scored gate-fields as barren (~55–65% empty),
// cinder-village as moderate/incoherent, pilgrims-descent as bare-but-vista-carried.
// This pass raises ground clutter + landmark props (all NON-colliding — scatter is
// instanced, props carry no collider, and `t`/`,` are both walkable floor) so the
// dead flanks read as inhabited dead-kingdom fields. NONE of these additions move a
// beat/anchor/banner/spawn/lore/item/enemy/crossing cell (asserted below + by the
// per-zone contract tests above/below).
describe('Realism density pass — inhabited dead-kingdom fields (map-gaps EMPTINESS §2)', () => {
  const SCATTER_CAP = 40; // mirrors ZoneBuilder's clamp; density stays well under it
  const scatterCount = (def: ZoneDef): number =>
    (def.scatter ?? []).reduce((n, s) => n + s.cells.length, 0);

  it('all ground clutter game-wide sits on walkable cells and stays within SCATTER_CAP', () => {
    for (const [id, def] of entries) {
      for (const clump of def.scatter ?? []) {
        for (const cell of clump.cells) {
          expect(isWalkable(def, cell), `${id} scatter ${clump.kind} @ ${String(cell)} is off a walkable cell`).toBe(true);
        }
      }
      expect(scatterCount(def), `${id} scatter exceeds SCATTER_CAP`).toBeLessThanOrEqual(SCATTER_CAP);
    }
  });

  it('gate-fields (worst offender) — clutter raised 8 → 19, W/SE trunks planted, sightline props added', () => {
    const gf = zoneOrThrow('gate-fields');
    expect(scatterCount(gf)).toBe(19);
    // planted `,`→`t` sparse trunks for vertical relief in the NW + SE dead
    // quadrants (both still walkable floor; away from the GF-3 eastward sightline
    // and the GF-2 crossing spine).
    for (const cell of [[2, 4], [4, 4], [10, 11], [11, 12]] as GridPos[]) {
      expect(charAt(gf, cell), `gate-fields planted trunk missing @ ${String(cell)}`).toBe('t');
    }
    expect(gf.props.length).toBe(11); // 6 base + 4 density landmarks + 1 Task-6 tower-shell silhouette
    // Contract: the scarecrow-ward statue-knights survive byte-for-byte.
    const statues = gf.props.filter((p) => p.kind === 'statue-knight').map((p) => p.at);
    expect(statues).toContainEqual([9, 5]);
    expect(statues).toContainEqual([8, 4]);
  });

  it('cinder-village — alley clutter raised 5 → 11, plaza/spine props added, procession intact', () => {
    const cv = zoneOrThrow('cinder-village');
    expect(scatterCount(cv)).toBe(11);
    expect(cv.props.length).toBe(7); // was 2: +5 plaza/alley/spine props
    // Contract: the frozen-procession statues stay exactly where CV-1 wakes read.
    const statues = cv.props.filter((p) => p.kind === 'statue-knight').map((p) => p.at);
    expect(statues).toContainEqual([4, 3]);
    expect(statues).toContainEqual([4, 11]);
  });

  it('pilgrims-descent — light touch: switchback clutter (0 → 4) + one shrine cairn', () => {
    const pd = zoneOrThrow('pilgrims-descent');
    expect(scatterCount(pd)).toBe(4); // scatter was absent (sparseness is partly design)
    expect(pd.props.length).toBe(1); // was []: a single wayside-shrine cairn
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
