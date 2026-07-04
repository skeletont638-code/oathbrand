/**
 * Regression (realism fixwave) — banner-vision ghosts must be GROUNDED on the
 * terrace they stand on, not planted at y=0.
 *
 * The bug: `buildGhosts` (src/main.ts) placed every vision ghost at a hardcoded
 * y=0 while every other view-y consumer on the branch (enemies, priests, camera)
 * was migrated to `built.groundYAt`. In Pilgrim's Descent the banner memory
 * spawns ghosts on raised terraces — cell [4,3] on band 2 (3.0 m) and [7,4] on
 * band 1 (1.5 m) — so at y=0 both were buried 1.5–3 m INSIDE the terrace.
 *
 * Two guards:
 *  1. content×builder — the authored descent ghost cells really do sit on raised
 *     bands, and the fix's grounding formula (`built.groundYAt`) lands each ghost
 *     on its terrace surface (well above 0). This pins the terrace heights and
 *     documents WHY grounding is required here.
 *  2. wiring — `buildGhosts` in main.ts derives the ghost's y from
 *     `built.groundYAt`, NOT a literal 0. The ghost placement lives in a private
 *     render closure that can't be exercised headlessly (it needs loaded GLB
 *     skeletons + a live scene), so this reads the source and asserts the seam
 *     directly — the one thing that is genuinely RED against the pre-fix code.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { ZoneBuilder } from '../../world/ZoneBuilder';
import { undulation } from '../../world/noise';
import type { AssetCache } from '../../world/assets';
import { PILGRIMS_DESCENT } from '../zones/pilgrimsDescent';
import { VISIONS } from '../visions';

/** A stand-in kit cache: every requested piece is a one-mesh Group. */
function fakeAssets(): AssetCache {
  const made = new Map<string, Group>();
  return {
    get(name: string): Group {
      let g = made.get(name);
      if (!g) {
        g = new Group();
        const mat = new MeshStandardMaterial();
        mat.name = name;
        g.add(new Mesh(new BoxGeometry(1, 1, 1), mat));
        g.updateMatrixWorld(true);
        made.set(name, g);
      }
      return g;
    },
  };
}

describe('banner-vision ghosts are grounded on their terrace (regression)', () => {
  const built = new ZoneBuilder().build(PILGRIMS_DESCENT, fakeAssets());
  const ghosts = VISIONS['pilgrims-descent'].steps.flatMap((s) => s.spawnGhosts ?? []);

  /** The ground y a grounded ghost gets — the FIX formula (main.ts buildGhosts). */
  const groundedY = ([row, col]: readonly [number, number]): number =>
    built.groundYAt((col + 0.5) * built.cellM, (row + 0.5) * built.cellM);

  it('the descent memory really places its ghosts on raised terrace bands', () => {
    // Premise guard: if these cells were band 0, y=0 would already be correct
    // and there would be nothing to fix.
    expect(ghosts.map((g) => `${g.at[0]},${g.at[1]}`).sort()).toEqual(['4,3', '7,4']);
    expect(built.cellHeightM(4, 3)).toBeCloseTo(3.0, 6); // band 2
    expect(built.cellHeightM(7, 4)).toBeCloseTo(1.5, 6); // band 1
  });

  it('grounds each descent ghost on its band surface — never the buried y=0', () => {
    for (const g of ghosts) {
      const [row, col] = g.at;
      const cx = (col + 0.5) * built.cellM;
      const cz = (row + 0.5) * built.cellM;
      // Lands on the terrace surface (band base + the terrain undulation)…
      expect(groundedY(g.at)).toBeCloseTo(built.cellHeightM(row, col) + undulation(cx, cz), 6);
      // …which, on these raised bands, is a full metre-plus ABOVE the old y=0.
      expect(groundedY(g.at)).toBeGreaterThan(1);
    }
  });
});

describe('main.ts buildGhosts wiring (RED against the pre-fix hardcoded y=0)', () => {
  const src = readFileSync(new URL('../../main.ts', import.meta.url), 'utf8');
  const start = src.indexOf('function buildGhosts');
  const body = src.slice(start, start + 1200);

  it('places each ghost with position.set, exposed for the seam check', () => {
    expect(start).toBeGreaterThan(0);
    expect(body).toContain('root.position.set(');
  });

  it("derives the ghost's y from built.groundYAt, not a literal 0", () => {
    // The buggy line was `root.position.set((col + 0.5) * built.cellM, 0, ...)`.
    const placement = body.slice(body.indexOf('root.position.set('), body.indexOf(');', body.indexOf('root.position.set(')));
    expect(placement).toContain('groundYAt');
    expect(placement).not.toMatch(/,\s*0\s*,/); // no hardcoded y=0 middle argument
  });
});
