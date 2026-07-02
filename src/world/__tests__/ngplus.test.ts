/**
 * The Second Vigil (Task 16) — the pure half of NG+.
 *
 *   - `applyNgPlus`: the pure ZoneDef→ZoneDef merge (enemy remix + injected
 *     ngOnly lore), which MUST be idempotent and non-mutating.
 *   - the anomaly registry's structural shape (unique ids, valid+registered
 *     zones, ≥1 per built zone).
 *   - the garden-door gating (ng-plus + garden-found) and the Ending-4 flag
 *     chain (ng-plus → garden-found → queens-brand → give → 4).
 *   - the Second-Vigil save semantics (what resets vs. what persists).
 *
 * All headless: no three.js, no DOM.
 */
import { describe, it, expect } from 'vitest';
import type { ZoneId } from '../../content/types';
import type { EnemySpawn, LoreSpot, ZoneDef } from '../zoneDef';
import { applyNgPlus } from '../ngplus';
import { ANOMALIES, anomaliesForZone } from '../../content/anomalies';
import { ZONES, hasZone, zoneOrThrow } from '../../content/zones';
import { QUEENS_GARDEN } from '../../content/zones/queensGarden';
import { canPass } from '../zoneGraph';
import { selectEnding } from '../../engine/endings';
import { secondVigilSave } from '../../save/save';
import type { SaveData } from '../../save/save';
import { LORE } from '../../content/lore';

function baseZone(overrides: Partial<ZoneDef> = {}): ZoneDef {
  return {
    id: 'ashen-gate',
    grid: ['#####', '#...#', '#.S.#', '#...#', '#####'],
    cell: 2,
    tiles: {},
    props: [],
    lights: [],
    enemies: [{ kind: 'soldier', at: [1, 1] }],
    lore: [{ id: 'gate-plaque', at: [2, 1] }],
    doors: [],
    ambience: ['amb-base'],
    ...overrides,
  };
}

describe('applyNgPlus — pure merge', () => {
  it('returns the def unchanged when it has no ngPlus variant', () => {
    const def = baseZone();
    expect(applyNgPlus(def)).toEqual(def);
  });

  it('swaps the whole enemy roster for the NG+ remix', () => {
    const remix: EnemySpawn[] = [
      { kind: 'wraith', at: [1, 1] },
      { kind: 'soldier', at: [3, 3] },
    ];
    const out = applyNgPlus(baseZone({ ngPlus: { enemies: remix } }));
    expect(out.enemies).toEqual(remix);
  });

  it('injects addedLore onto the base lore (base entries kept, order preserved)', () => {
    const added: LoreSpot[] = [{ id: 'ng-edda-lie', at: [3, 1] }];
    const out = applyNgPlus(baseZone({ ngPlus: { addedLore: added } }));
    expect(out.lore.map((l) => l.id)).toEqual(['gate-plaque', 'ng-edda-lie']);
  });

  it('does not mutate the input def', () => {
    const def = baseZone({ ngPlus: { enemies: [], addedLore: [{ id: 'ng-mercy', at: [1, 1] }] } });
    const beforeLore = def.lore.length;
    const beforeEnemies = def.enemies.length;
    applyNgPlus(def);
    expect(def.lore.length).toBe(beforeLore);
    expect(def.enemies.length).toBe(beforeEnemies);
  });

  it('is idempotent: applying twice equals applying once', () => {
    const def = baseZone({
      ngPlus: {
        enemies: [{ kind: 'wraith', at: [1, 1] }],
        addedLore: [{ id: 'ng-mercy', at: [3, 1] }],
        ambience: ['amb-ng'],
      },
    });
    const once = applyNgPlus(def);
    const twice = applyNgPlus(once);
    expect(twice).toEqual(once);
    // The injected lore is not doubled by a second pass.
    expect(twice.lore.filter((l) => l.id === 'ng-mercy')).toHaveLength(1);
  });

  it('overrides props / lights / doors / ambience when the variant sets them', () => {
    const out = applyNgPlus(
      baseZone({ ngPlus: { ambience: ['amb-ng'], props: [{ kind: 'pillar', at: [1, 1] }] } }),
    );
    expect(out.ambience).toEqual(['amb-ng']);
    expect(out.props).toEqual([{ kind: 'pillar', at: [1, 1] }]);
    // Untouched arrays fall through to the base.
    expect(out.enemies).toEqual([{ kind: 'soldier', at: [1, 1] }]);
  });
});

describe('anomaly registry (Exit-8 grammar)', () => {
  const builtZones = Object.keys(ZONES) as ZoneId[];

  it('authors exactly 12 anomalies', () => {
    expect(ANOMALIES).toHaveLength(12);
  });

  it('every anomaly id is unique', () => {
    const ids = ANOMALIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every anomaly targets a registered, built zone', () => {
    for (const a of ANOMALIES) {
      expect(hasZone(a.zone), `${a.id} → unbuilt zone ${a.zone}`).toBe(true);
    }
  });

  it('every anomaly exposes an apply(built) hook', () => {
    for (const a of ANOMALIES) expect(typeof a.apply).toBe('function');
  });

  it('every recontextualised base zone has at least one anomaly', () => {
    // The Queen's Garden is NG+-native — the reveal itself, not a haunted re-run
    // of a base zone — so it carries no anomaly by design (the withheld stillness).
    for (const zone of builtZones) {
      if (zone === 'queens-garden') continue;
      expect(anomaliesForZone(zone).length, `zone ${zone} has no anomaly`).toBeGreaterThanOrEqual(1);
    }
  });

  it('anomaliesForZone returns only anomalies for that zone', () => {
    for (const zone of builtZones) {
      for (const a of anomaliesForZone(zone)) expect(a.zone).toBe(zone);
    }
  });
});

describe('the Queen’s Garden', () => {
  it('is registered and reachable from the undercroft', () => {
    expect(hasZone('queens-garden')).toBe(true);
    expect(zoneOrThrow('queens-garden').id).toBe('queens-garden');
  });

  it('holds NO enemies (a sanctuary)', () => {
    expect(QUEENS_GARDEN.enemies).toHaveLength(0);
    expect(QUEENS_GARDEN.ngPlus?.enemies ?? []).toHaveLength(0);
  });

  it('offers the queen’s guttered brand → the queens-brand flag', () => {
    const brand = (QUEENS_GARDEN.items ?? []).find((i) => i.flag === 'queens-brand');
    expect(brand, 'no queens-brand pickup in the garden').toBeDefined();
  });

  it('carries the sixth banner vision', () => {
    expect(QUEENS_GARDEN.banner).toBeDefined();
  });
});

describe('garden door gating (ng-plus + garden-found)', () => {
  const undercroft = zoneOrThrow('undercroft');
  const illusory = undercroft.doors.find((d) => d.lock === 'illusory');

  it('the undercroft has an illusory door into the garden', () => {
    expect(illusory, 'no illusory door in the undercroft').toBeDefined();
    expect(illusory?.to).toBe('queens-garden');
  });

  it('stays SEALED until the wall is revealed (garden-found)', () => {
    expect(canPass(illusory!, new Set())).toBe(false);
    expect(canPass(illusory!, new Set(['ng-plus']))).toBe(false);
  });

  it('OPENS once garden-found is set', () => {
    expect(canPass(illusory!, new Set(['garden-found']))).toBe(true);
  });
});

describe('the Ending-4 flag chain (ng-plus → garden-found → queens-brand → give)', () => {
  const undercroft = zoneOrThrow('undercroft');
  const illusory = undercroft.doors.find((d) => d.lock === 'illusory')!;

  it('walks the whole state machine to the true ending', () => {
    // Second Vigil begins: ng-plus, castle re-sealed.
    const flags = new Set<import('../../content/types').GameFlag>(['ng-plus']);

    // The garden wall is still stone.
    expect(canPass(illusory, flags)).toBe(false);
    // Approach + reveal: garden-found is set, the wall opens.
    flags.add('garden-found');
    expect(canPass(illusory, flags)).toBe(true);

    // In the garden, take the queen's brand.
    flags.add('queens-brand');

    // At the flame, GIVE the crown → the secret ending.
    expect(selectEnding({ hollow: false, choice: 'give', hasQueensBrand: flags.has('queens-brand') })).toBe(4);
  });

  it('without the queen’s brand, GIVE is only the ordinary OATH KEPT (1)', () => {
    expect(selectEnding({ hollow: false, choice: 'give', hasQueensBrand: false })).toBe(1);
  });
});

describe('Second-Vigil save semantics (reset vs. persist)', () => {
  const prev: SaveData = {
    version: 1,
    zone: 'summit',
    bannerId: 'Banner of the Summit',
    embers: 2,
    flags: ['gatekey', 'shortcut-open', 'forsworn-dead', 'queens-brand', 'garden-found', 'callun-tachi'],
    endingsSeen: [1, 4],
    loreRead: ['gate-plaque', 'lending-rite'],
    visionsSeen: ['vision-ashen-gate', 'vista-ashen-gate'],
    ngPlus: false,
  };

  it('RESETS the run: all flags cleared, embers full, back to the gate', () => {
    const next = secondVigilSave(prev, 5);
    expect(next.flags).toEqual([]); // the castle re-seals
    expect(next.embers).toBe(5);
    expect(next.zone).toBe('ashen-gate');
    expect(next.bannerId).toBe('');
    expect(next.ngPlus).toBe(true);
  });

  it('PERSISTS knowledge: endings seen, lore read, visions seen', () => {
    const next = secondVigilSave(prev, 5);
    expect(next.endingsSeen).toEqual([1, 4]);
    expect(next.loreRead).toEqual(['gate-plaque', 'lending-rite']);
    expect(next.visionsSeen).toEqual(['vision-ashen-gate', 'vista-ashen-gate']);
  });

  it('a THIRD vigil is the same as the second (ngPlus stays true, knowledge persists)', () => {
    const second = secondVigilSave(prev, 5);
    const third = secondVigilSave(second, 5);
    expect(third.ngPlus).toBe(true);
    expect(third.flags).toEqual([]);
    expect(third.endingsSeen).toEqual(second.endingsSeen);
    expect(third.loreRead).toEqual(second.loreRead);
    expect(third.visionsSeen).toEqual(second.visionsSeen);
  });

  it('survives a null previous save (first-ever NG+ with no banked knowledge)', () => {
    const next = secondVigilSave(null, 5);
    expect(next.ngPlus).toBe(true);
    expect(next.endingsSeen).toEqual([]);
    expect(next.loreRead).toEqual([]);
    expect(next.visionsSeen).toEqual([]);
  });
});

describe('ngOnly lore placement (all 8 placed in ngPlus.addedLore only)', () => {
  const entries = Object.entries(ZONES) as [ZoneId, ZoneDef][];

  it('every ngOnly entry is placed exactly once across the zones’ NG+ variants', () => {
    const placed = entries.flatMap(([, def]) => (def.ngPlus?.addedLore ?? []).map((l) => l.id));
    const ngOnly = Object.entries(LORE).filter(([, e]) => e.ngOnly).map(([id]) => id);
    expect(new Set(placed).size).toBe(placed.length); // no double-placement
    expect(new Set(placed)).toEqual(new Set(ngOnly)); // bijection with the ngOnly set
  });
});
