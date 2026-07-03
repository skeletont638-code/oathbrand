/**
 * Procedural prop geometry (Task 9). Each prop is a low-poly, vertex-coloured
 * `BufferGeometry` built in pure three.js (no WebGL) so it renders as the
 * flat-shaded PS1 look and is safe under vitest. Orientation/UV assertions
 * follow the Task-6 lesson: a hand-authored geometry gets a real grounded/
 * tri-cap assertion, never just "defined".
 */
import { describe, it, expect } from 'vitest';
import { gibbetGeometry, roofWedgeGeometry } from '../exteriorProps';
import type { BufferGeometry } from 'three';

function tris(g: BufferGeometry): number {
  const p = g.getAttribute('position');
  return (g.index ? g.index.count : p.count) / 3;
}
function minY(g: BufferGeometry): number {
  const p = g.getAttribute('position');
  let m = Infinity;
  for (let i = 0; i < p.count; i++) m = Math.min(m, p.getY(i));
  return m;
}

describe('exterior props', () => {
  for (const [name, build, cap] of [['gibbet', gibbetGeometry, 120], ['roof-wedge', roofWedgeGeometry, 24]] as const) {
    it(`${name}: low-poly, vertex-coloured, grounded base`, () => {
      const g = build();
      expect(g.getAttribute('color')).toBeDefined();
      expect(tris(g)).toBeGreaterThan(0);
      expect(tris(g)).toBeLessThanOrEqual(cap);
      expect(minY(g)).toBeGreaterThanOrEqual(-0.001);
      g.dispose();
    });
  }
});
