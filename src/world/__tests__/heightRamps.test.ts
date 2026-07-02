/**
 * `buildHeightRamps` (Task 2) — pure grid → seam classifier. For every
 * orthogonally-adjacent pair of cells it emits a `ramp` (both walkable, one
 * height level apart) or a `cliff` (a walkable cell dropping ≥2 levels, e.g.
 * against a `~` gorge), and nothing across a flat seam or a treeline wall.
 * The height layer is visual only; this drives the terrain skirt geometry.
 */
import { describe, it, expect } from 'vitest';
import { buildHeightRamps } from '../ZoneBuilder';
import type { ZoneDef, TileKind } from '../zoneDef';

function zone(grid: string[], heightGrid?: string[], tiles: Record<string, TileKind> = {}): ZoneDef {
  return {
    id: 'gate-fields',
    grid,
    cell: 2,
    tiles,
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
    kind: 'exterior',
    heightGrid,
  };
}

describe('buildHeightRamps', () => {
  it('emits ramps on every Δ1 seam of an all-floor slope and no cliffs', () => {
    // The 1-region is an L (row0 + [1,0]); the 2-region the rest. Their shared
    // boundary crosses four cell edges — one connected Δ1 seam, four ramp pairs.
    const seams = buildHeightRamps(zone(['...', '...', '...'], ['111', '122', '222']));
    const ramps = seams.filter((s) => s.kind === 'ramp');
    const cliffs = seams.filter((s) => s.kind === 'cliff');
    expect(cliffs).toHaveLength(0);
    expect(ramps).toHaveLength(4);
    // The step down from [1,0] (h1) to [2,0] (h2) is one of them.
    expect(ramps).toContainEqual({ a: [1, 0], b: [2, 0], kind: 'ramp' });
  });

  it('classifies a walkable cell above a ~ void as a cliff (Δ≥2)', () => {
    // Floor h2 immediately east of a void cell whose height reads 0 → Δ2.
    const seams = buildHeightRamps(zone(['.~'], ['20']));
    expect(seams).toContainEqual({ a: [0, 0], b: [0, 1], kind: 'cliff' });
    expect(seams.filter((s) => s.kind === 'ramp')).toHaveLength(0);
  });

  it('a flat (all-0 / default) height grid yields no seams', () => {
    expect(buildHeightRamps(zone(['...', '...', '...'], ['000', '000', '000']))).toEqual([]);
    // …and an exterior def with NO heightGrid at all defaults every cell to 0.
    expect(buildHeightRamps(zone(['...', '...', '...']))).toEqual([]);
  });

  it('never emits a seam across a treeline wall (T/#) — only walkable ground', () => {
    // 'T' is a wall (dense tree); a big height gap beside it is not a cliff you
    // can stand at, so it is skipped. Left floor h0, right tree wall.
    const seams = buildHeightRamps(zone(['.T'], ['03'], { T: 'wall' }));
    expect(seams).toEqual([]);
  });
});
