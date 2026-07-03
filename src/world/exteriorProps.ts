/**
 * Realism pass (Task 9): original CC0 procedural prop geometry — a hanging
 * gibbet cage (the drop's signature folk-horror motif) and a burnt roof wedge
 * (the Cinder Village houses). Low-poly, vertex-coloured for the flat-shaded
 * PS1 look, built in pure three.js (no WebGL — vitest-safe). Declared CC0 in
 * assets/LICENSES.md → "Procedural geometry".
 *
 * The gibbet HANGS (its base sits ~1.6 m up, the cage rusted open under the
 * oath-oak) and the roof wedge is pre-offset to cap a 2 m wall block, so the
 * `base at y0` convention of the forest kit is relaxed here: the only grounded
 * invariant the test guards is that nothing dips below the floor (minY ≥ 0).
 *
 * (Ground-clutter geometry — `stoneGeometry`/`bonePileGeometry`/`stumpGeometry`
 * — is ADDED in Task 10.)
 */
import { BoxGeometry, BufferGeometry, ConeGeometry, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const IRON = 0x2a2724; // rusted dark iron
const BONE = 0x6b6252; // the occupant bundle
const ROOF = 0x2e2622; // charred timber

/** Paint every vertex of `geo` one flat colour (adds a `color` attribute). */
function paint(geo: BufferGeometry, hex: number): BufferGeometry {
  const r = ((hex >> 16) & 0xff) / 255, g = ((hex >> 8) & 0xff) / 255, b = (hex & 0xff) / 255;
  const n = geo.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b; }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const m = mergeGeometries(parts, false);
  if (!m) throw new Error('exteriorProps: mergeGeometries returned null');
  for (const p of parts) p.dispose();
  m.computeVertexNormals();
  return m;
}

/** A painted box of size w×h×d, centred at (x, y, z). */
function bar(w: number, h: number, d: number, y: number, x: number, z: number, hex: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, hex);
}

/** A rusted iron cage hung high (rusted open — lore card), with a bone bundle
 *  inside. ~1.0 m cage, hung so its top bar sits ~2.6 m up. */
export function gibbetGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const yTop = 2.6, cage = 1.0, half = 0.28;
  parts.push(bar(0.06, 0.4, 0.06, yTop + 0.2, 0, 0, IRON));           // hanger stem
  parts.push(bar(0.7, 0.06, 0.7, yTop, 0, 0, IRON));                  // top ring
  parts.push(bar(0.7, 0.06, 0.7, yTop - cage, 0, 0, IRON));           // bottom ring
  for (const [x, z] of [[half, half], [-half, half], [half, -half], [-half, -half]] as const) {
    parts.push(bar(0.05, cage, 0.05, yTop - cage / 2, x, z, IRON));   // four uprights
  }
  parts.push(bar(0.22, 0.5, 0.22, yTop - cage + 0.35, 0, 0, BONE));   // slumped bone bundle
  return merge(parts);
}

/** A pitched, charred roof wedge capping an H/A house cell (~2 m footprint). */
export function roofWedgeGeometry(): BufferGeometry {
  const g = new ConeGeometry(1.5, 1.1, 4, 1, false); // a 4-sided pyramid reads as a pitched roof
  g.rotateY(Math.PI / 4);
  g.translate(0, 2.0 + 0.55, 0); // sits atop the 2 m wall block
  return paint(g, ROOF);
}
