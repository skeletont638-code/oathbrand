import type { EnemySpawn, ZoneDef } from './zoneDef';

/** Kinds that may drift to a neighbouring cell on each (re)spawn.
 *  The Forsworn arena is authored; a Kneeling Hollow that moved apart from
 *  its inert twin would mark which one is real. */
export const SCATTER_KINDS: ReadonlySet<string> = new Set(['soldier', 'archer', 'wraith', 'hound']);

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

/** Scatter targets are strictly plain floor — never doors, banners, the
 *  player spawn, void, or zone-letter tiles that aren't mapped to floor. */
function plainFloor(def: ZoneDef, row: number, col: number): boolean {
  const ch = def.grid[row]?.[col];
  if (ch === undefined) return false;
  return ch === '.' || def.tiles[ch] === 'floor';
}

/** The Amnesia countermeasure: re-deal each common enemy onto its own cell or
 *  a plain-floor neighbour so no two attempts replay the learned roster.
 *  Exactly one rng draw per scatterable spawn; the authored cell is kept when
 *  nothing nearby is free. Order (and therefore enemy ids) is preserved. */
export function scatterSpawns(def: ZoneDef, rng: () => number): EnemySpawn[] {
  const key = (r: number, c: number): string => `${r},${c}`;
  const taken = new Set<string>();
  for (const s of def.enemies) {
    if (!SCATTER_KINDS.has(s.kind)) taken.add(key(s.at[0], s.at[1]));
  }
  return def.enemies.map((spawn) => {
    if (!SCATTER_KINDS.has(spawn.kind)) return spawn;
    const [r, c] = spawn.at;
    const candidates: Array<readonly [number, number]> = NEIGHBOURS
      .map(([dr, dc]) => [r + dr, c + dc] as const)
      .filter(([nr, nc]) => plainFloor(def, nr, nc) && !taken.has(key(nr, nc)));
    if (plainFloor(def, r, c) && !taken.has(key(r, c))) candidates.push([r, c] as const);
    const roll = rng();
    if (candidates.length === 0) {
      taken.add(key(r, c));
      return spawn;
    }
    const [nr, nc] = candidates[Math.floor(roll * candidates.length) % candidates.length];
    taken.add(key(nr, nc));
    return { ...spawn, at: [nr, nc] as EnemySpawn['at'] };
  });
}
