import { describe, expect, it } from 'vitest';
import { scatterSpawns, SCATTER_KINDS } from '../spawnScatter';
import type { EnemySpawn, ZoneDef } from '../zoneDef';

function def(grid: string[], enemies: EnemySpawn[]): ZoneDef {
  return {
    id: 'ashen-gate', grid, cell: 2, tiles: {}, props: [],
    lights: [], enemies, lore: [], doors: [], ambience: [],
  } as unknown as ZoneDef;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const OPEN = ['#######', '#.....#', '#.....#', '#.....#', '#######'];

describe('scatterSpawns', () => {
  it('never moves the forsworn or a kneeler', () => {
    const spawns: EnemySpawn[] = [
      { kind: 'forsworn', at: [2, 3] },
      { kind: 'kneeler', at: [1, 1] },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const out = scatterSpawns(def(OPEN, spawns), mulberry32(seed));
      expect(out[0].at).toEqual([2, 3]);
      expect(out[1].at).toEqual([1, 1]);
    }
  });

  it('keeps every scattered enemy on a plain floor cell within one cell of home', () => {
    const spawns: EnemySpawn[] = [{ kind: 'soldier', at: [2, 3] }];
    for (let seed = 1; seed <= 20; seed++) {
      const [s] = scatterSpawns(def(OPEN, spawns), mulberry32(seed));
      const [r, c] = s.at;
      expect(Math.abs(r - 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(c - 3)).toBeLessThanOrEqual(1);
      expect(OPEN[r][c]).toBe('.');
    }
  });

  it('never lands on walls, banners, spawn cells, doors, or void', () => {
    // Soldier at the centre of a ring of forbidden tiles: only home is legal.
    const grid = ['#####', '#B5S#', '#~.~#', '#####'];
    const spawns: EnemySpawn[] = [{ kind: 'soldier', at: [2, 2] }];
    for (let seed = 1; seed <= 20; seed++) {
      const [s] = scatterSpawns(def(grid, spawns), mulberry32(seed));
      expect(s.at).toEqual([2, 2]);
    }
  });

  it('produces at least two distinct placements across seeds (the anti-memorization point)', () => {
    const spawns: EnemySpawn[] = [{ kind: 'wraith', at: [2, 3] }];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const [s] = scatterSpawns(def(OPEN, spawns), mulberry32(seed));
      seen.add(`${s.at[0]},${s.at[1]}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('never stacks two spawns on one cell', () => {
    const spawns: EnemySpawn[] = [
      { kind: 'soldier', at: [1, 1] },
      { kind: 'soldier', at: [1, 2] },
      { kind: 'hound', at: [2, 1] },
      { kind: 'kneeler', at: [2, 2] },
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const out = scatterSpawns(def(OPEN, spawns), mulberry32(seed));
      const cells = out.map((s) => `${s.at[0]},${s.at[1]}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it('stays home when boxed in, and is deterministic for a given seed', () => {
    const boxed = ['#####', '#.#.#', '###.#', '#####'];
    const spawns: EnemySpawn[] = [{ kind: 'archer', at: [1, 1] }];
    const [s] = scatterSpawns(def(boxed, spawns), mulberry32(7));
    expect(s.at).toEqual([1, 1]);

    const open: EnemySpawn[] = [{ kind: 'soldier', at: [2, 3] }, { kind: 'hound', at: [1, 1] }];
    const a = scatterSpawns(def(OPEN, open), mulberry32(42));
    const b = scatterSpawns(def(OPEN, open), mulberry32(42));
    expect(a).toEqual(b);
  });

  it('preserves kind, patrol, and every other authored field', () => {
    const spawns: EnemySpawn[] = [{ kind: 'soldier', at: [2, 3], patrol: [[1, 1], [3, 3]] }];
    const [s] = scatterSpawns(def(OPEN, spawns), mulberry32(3));
    expect(s.kind).toBe('soldier');
    expect(s.patrol).toEqual([[1, 1], [3, 3]]);
  });

  it('scatter set is exactly the common roster', () => {
    expect([...SCATTER_KINDS].sort()).toEqual(['archer', 'hound', 'soldier', 'wraith']);
  });
});
