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
 * Curves pass (C4): the gibbet is REBUILT from rounded rods/rings/blob (no box
 * bars) and the ground-clutter geometry — `stoneGeometry`/`bonePileGeometry`/
 * `stumpGeometry` — is ADDED here, consumed by Task 10's scatter `CLUTTER` map.
 */
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { displaceRadial, seededAt } from './noise';

const IRON = 0x2a2724; // rusted dark iron
const BONE = 0x6b6252; // the occupant bundle
const ROOF = 0x2e2622; // charred timber
const STONE = 0x3a3733; // weathered watchtower masonry

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

/** A rounded iron rod (6-sided cylinder), authored along y, centred at (x, y, z). */
function rod(r: number, len: number, y: number, x: number, z: number, hex: number): BufferGeometry {
  const g = new CylinderGeometry(r, r, len, 6, 1);
  g.translate(x, y, z);
  return paint(g, hex);
}

/** A cage ring — a low-poly torus lying flat at height y. */
function ring(r: number, tube: number, y: number, hex: number): BufferGeometry {
  const g = new TorusGeometry(r, tube, 4, 10);
  g.rotateX(Math.PI / 2);
  g.translate(0, y, 0);
  return paint(g, hex);
}

/** A rusted iron cage hung high (rusted open — lore card), with a slumped bone
 *  occupant. C4: ROUNDED — rod uprights, torus rings, a displaced bone blob;
 *  no box bars. Same footprint/heights as the shipped box version. ~370 tris. */
export function gibbetGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const yTop = 2.6;
  const cage = 1.0;
  const half = 0.28;
  parts.push(rod(0.03, 0.4, yTop + 0.2, 0, 0, IRON)); // hanger stem
  parts.push(ring(0.34, 0.028, yTop, IRON)); // top ring
  parts.push(ring(0.34, 0.028, yTop - cage, IRON)); // bottom ring
  for (const [x, z] of [[half, half], [-half, half], [half, -half], [-half, -half]] as const) {
    parts.push(rod(0.024, cage, yTop - cage / 2, x, z, IRON)); // four rounded uprights
  }
  // The slumped occupant — a displaced bone blob, not a box.
  const bone = displaceRadial(new SphereGeometry(0.17, 7, 5), 0.05, 0xb0e);
  bone.scale(1, 1.4, 1);
  bone.translate(0, yTop - cage + 0.38, 0);
  parts.push(paint(bone, BONE));
  return merge(parts);
}

// --- C4 ground clutter (consumed by Task 10's scatter `CLUTTER` map) ---------

/** A lumpy field stone (~0.5 m) — a seeded noise-displaced icosahedron,
 *  squashed and SETTLED into the ash (embedded a few cm; never floating). */
export function stoneGeometry(): BufferGeometry {
  const g = displaceRadial(new IcosahedronGeometry(0.26, 1), 0.07, 0x57e);
  g.scale(1.1, 0.62, 0.95);
  g.translate(0, 0.14, 0);
  return paint(g, 0x4a4640);
}

/** A small bone pile — three tumbled rounded long-bones over a low ash mound. */
export function bonePileGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const bone = (len: number, y: number, yaw: number, seed: number): BufferGeometry => {
    const g = new CylinderGeometry(0.03, 0.042, len, 5, 1);
    g.rotateZ(Math.PI / 2 - 0.12);
    g.rotateY(yaw);
    g.translate((seededAt(seed, 0, 0, 3) - 0.5) * 0.2, y, (seededAt(0, seed, 0, 3) - 0.5) * 0.2);
    return paint(g, BONE);
  };
  parts.push(bone(0.52, 0.05, 0.3, 1), bone(0.44, 0.1, 1.7, 2), bone(0.38, 0.15, 2.6, 3));
  const mound = displaceRadial(new SphereGeometry(0.2, 6, 4), 0.05, 0x60e);
  mound.scale(1.3, 0.45, 1.2);
  mound.translate(0, 0.05, 0);
  parts.push(paint(mound, BONE));
  return merge(parts);
}

/** A cut stump (~0.5 m) — a lathe with a root flare, lumpy bark, capped top. */
export function stumpGeometry(): BufferGeometry {
  const g = new LatheGeometry(
    [new Vector2(0.34, 0), new Vector2(0.24, 0.09), new Vector2(0.2, 0.28), new Vector2(0.22, 0.48), new Vector2(0.02, 0.5)],
    7,
  );
  displaceRadial(g, 0.03, 0x7a2);
  return paint(g, 0x3b322a);
}

/**
 * THE WATCHTOWER SHELL (World Expansion v1.2, Task 6) — the exterior SILHOUETTE
 * of the Gate Fields watchtower: a tapered octagonal masonry shaft rising to an
 * open, crenellated crown (a roof-WALK, not a spire — one merlon is missing for
 * the ruined read). Placed as an OFF-GRID backdrop prop behind the Tower Door in
 * the fields' treeline, so the tower READS from every field cell without being an
 * enterable structure in the exterior grid (the real interior is towerGround /
 * towerUpper). Cheap: ~84 tris, one draw call, vertex-coloured for the flat PS1
 * look; base at y0 (never floats). Declared CC0 in assets/LICENSES.md. */
export function towerShellGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const shaftH = 6.5;
  // Tapered octagonal shaft, base seated at y0.
  const shaft = new CylinderGeometry(1.0, 1.25, shaftH, 8, 1);
  shaft.translate(0, shaftH / 2, 0);
  parts.push(paint(shaft, STONE));
  // The parapet crown — an open-topped ring (the roof-walk you climb to inside).
  const crownH = 0.7;
  const crown = new CylinderGeometry(1.15, 1.15, crownH, 8, 1, true);
  crown.translate(0, shaftH + crownH / 2, 0);
  parts.push(paint(crown, STONE));
  // Battlement merlons on the crown (E/W/S faces, +x/−x/+z); the NORTH one
  // (−z, the [0,-r] slot) is deliberately omitted — the fallen-merlon ruin gap.
  const merlonY = shaftH + crownH + 0.3;
  const r = 1.05;
  for (const [x, z] of [[r, 0], [-r, 0], [0, r]] as const) {
    const m = new BoxGeometry(0.5, 0.6, 0.5);
    m.translate(x, merlonY, z);
    parts.push(paint(m, STONE));
  }
  return merge(parts);
}

/**
 * THE SUNKEN CHAPEL SHELL (World Expansion v1.2, Task 7) — the exterior
 * SILHOUETTE of the half-collapsed chapel in the Ashen Forest: a tall stone
 * nave box whose SOUTH half has lost its roof (the collapse), a pitched gable
 * over the tended NORTH end, and a leaning cross at the peak — the one shape
 * that reads "chapel" across a dark treeline where a bare box would not. Placed
 * as an OFF-GRID backdrop prop behind the Chapel Door in the forest, so the ruin
 * READS from the road without being an enterable structure in the exterior grid
 * (the real interior is chapelNave / chapelCrypt, the tower-shell pattern). Cheap:
 * ~46 tris, one draw call, vertex-coloured for the flat PS1 look; base at y0
 * (never floats). Declared CC0 in assets/LICENSES.md. */
export function chapelShellGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const naveW = 3.0, naveD = 5.2, wallH = 4.2;
  // The nave walls — a tall weathered-stone box, base seated at y0.
  const body = new BoxGeometry(naveW, wallH, naveD);
  body.translate(0, wallH / 2, 0);
  parts.push(paint(body, STONE));
  // A pitched gable capping the NORTH half only (the tended end); the south
  // half stays roofless — the collapse. A squashed 4-sided pyramid reads as a
  // ridge from a distance, elongated along z over that half.
  const roofH = 1.5;
  const roof = new ConeGeometry(naveW * 0.72, roofH, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale(1, 1, (naveD * 0.5) / (naveW * 0.72)); // elongate into a ridge over the north half
  roof.translate(0, wallH + roofH / 2, -naveD * 0.25);
  parts.push(paint(roof, ROOF));
  // The leaning cross at the gable peak — the chapel signifier, tilted for the
  // ruined read. Two thin stone members, built about the origin so the lean is
  // compact, then seated above the north gable.
  const crossY = wallH + roofH + 0.7;
  const crossZ = -naveD * 0.25;
  const post = new BoxGeometry(0.16, 1.3, 0.16);
  const arm = new BoxGeometry(0.86, 0.16, 0.16);
  arm.translate(0, 0.22, 0); // the crossbar, high on the upright
  const cross = merge([paint(post, STONE), paint(arm, STONE)]);
  cross.rotateZ(0.12); // the lean, about the cross's own centre
  cross.translate(0, crossY, crossZ);
  parts.push(cross);
  return merge(parts);
}

/** A pitched, charred roof wedge capping an H/A house cell (~2 m footprint). */
export function roofWedgeGeometry(): BufferGeometry {
  const g = new ConeGeometry(1.5, 1.1, 4, 1, false); // a 4-sided pyramid reads as a pitched roof
  g.rotateY(Math.PI / 4);
  g.translate(0, 2.0 + 0.55, 0); // sits atop the 2 m wall block
  return paint(g, ROOF);
}
