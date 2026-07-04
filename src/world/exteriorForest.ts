/**
 * Procedural low-poly forest geometry for the Greater Vael exterior zones
 * (Task 2). Three instance kinds — a grass tuft, a bare/sparse trunk, and a
 * dense pine — each returned as a SINGLE merged `BufferGeometry` (position +
 * normal + `color`) so the ZoneBuilder can stamp it into one `InstancedMesh`
 * (= 1 draw call per kind, no matter how many trees a zone plants).
 *
 * WHY GENERATED, NOT A FETCHED GLB: instancing multiplies a mesh's triangles
 * by its population, so the forest must be *very* low-poly to hold the drop's
 * `tris < 100k visible` budget across dozens of trees (a fetched CC0 pine we
 * evaluated was ~1.7k tris — ~40 of them alone would blow it). Authoring the
 * geometry here caps the dense pine at ~74 tris (crooked rebuild, C3; budget
 * guard 160) and bakes the OATHBRAND ash
 * palette straight into vertex colours (no texture, no download, ~0 bundle
 * weight) — the flat-shaded PS1 look the whole game targets. These meshes are
 * original CC0 work (see assets/LICENSES.md → "Procedural geometry").
 *
 * Pure: three.js object construction only, no WebGL — safe under vitest. All
 * geometry has its base at y = 0, so an instance matrix places the trunk on
 * the ground at that cell's height.
 */
import { BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { displaceRadial } from './noise';

// Dark, desaturated ash/forest palette (the world is dead; nothing is lush).
// Rebalanced under the moon key light (Task 3): the old values were darkened
// to survive the flat ambient-only model; with the key giving face-to-face
// variation they lift a touch so trunk/needle faces catch the moon — form
// visible within ~8 m, silhouette against fog unchanged at range (spec §3).
const BARK = 0x463a30; // was 0x3b322a — a touch lifted so trunk faces catch the moon
const NEEDLE = 0x59614c; // was 0x4a5340
const BLADE = 0x5b6050; // was 0x4d5140

/** Low radial resolution — a pentagon prism/cone reads perfectly at PS1 res. */
const SEG = 5;

/** Smooth wind sway params (spec §6: a few cm, world stays smooth — never stepped). */
export const WIND = { ampM: 0.06, freqHz: 1.1, heightRefM: 3 } as const;

/** Paint every vertex of `geo` one flat colour (adds a `color` attribute). */
function paint(geo: BufferGeometry, hex: number): BufferGeometry {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  const n = geo.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

/** A trunk bowed toward +x with a progressive (t²) lean — base planted, crown
 *  carried sideways. 2 height segments = 3 lean stations: the low-poly PS1
 *  "segmented bend", not a smooth arc. Open-ended like the old `trunk()`. */
function bentTrunk(radiusTop: number, radiusBottom: number, height: number, leanM: number, hex: number): BufferGeometry {
  const g = new CylinderGeometry(radiusTop, radiusBottom, height, SEG, 2, true);
  g.translate(0, height / 2, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / height;
    pos.setX(i, pos.getX(i) + leanM * t * t);
  }
  pos.needsUpdate = true;
  return paint(g, hex);
}

/** A needle cone with seeded lumpy displacement, its axis carried `xOff` off
 *  the root line (following the trunk's lean) — the asymmetric dead canopy. */
function crookedCone(radius: number, height: number, baseY: number, wobbleM: number, seed: number, xOff: number, hex: number): BufferGeometry {
  const g = new ConeGeometry(radius, height, SEG + 1, 2, true);
  displaceRadial(g, wobbleM, seed);
  g.translate(xOff, baseY + height / 2, 0);
  return paint(g, hex);
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('exteriorForest: mergeGeometries returned null');
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * A dead pine, CROOKED (C3): a bowed trunk under three lumpy, offset needle
 * cones — the crown carried ~0.22 m off the root line. ~74 tris (cap 160), ~3.1 m.
 * The dense treeline/field-border instance (blocks; renders where `T`/`#`).
 */
export function pineGeometry(): BufferGeometry {
  const LEAN = 0.22;
  const at = (y: number): number => LEAN * (y / 3.1) ** 2; // the trunk's lean at height y
  return merge([
    bentTrunk(0.1, 0.16, 0.9, at(0.9), BARK),
    crookedCone(0.92, 1.2, 0.5, 0.11, 0xf1, at(1.1), NEEDLE),
    crookedCone(0.66, 1.1, 1.3, 0.1, 0xf2, at(1.85), NEEDLE),
    crookedCone(0.44, 1.0, 2.1, 0.09, 0xf3, at(2.6), NEEDLE),
  ]);
}

/**
 * A bare/sparse trunk, CROOKED: a hard 0.28 m bow with one thin lumpy crown.
 * ~38 tris (cap 120). The walkable, partial-occlusion instance (`t` cells) —
 * tall and mostly bald: you can see (and walk) past it, as before.
 */
export function trunkGeometry(): BufferGeometry {
  const LEAN = 0.28;
  return merge([
    bentTrunk(0.12, 0.18, 1.9, LEAN, BARK),
    crookedCone(0.5, 0.9, 1.7, 0.08, 0xf4, LEAN * 0.8, NEEDLE),
  ]);
}

/**
 * A tuft of dry grass — three crossed blades fanning up from the ground.
 * ~6 tris, ~0.45 m. Scattered on `,` cells for ground texture.
 */
export function grassGeometry(): BufferGeometry {
  const blades: BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    // A thin tapering quad (two tris), leaning slightly, then yaw-rotated.
    const g = new BufferGeometry();
    const w = 0.14;
    const h = 0.45;
    const verts = new Float32Array([
      -w, 0, 0, w, 0, 0, 0.02, h, 0, // front
      w, 0, 0, -w, 0, 0, 0.02, h, 0, // back (wound the other way)
    ]);
    g.setAttribute('position', new Float32BufferAttribute(verts, 3));
    // Per-blade UVs so the affine bark map (a multiply over the BLADE tint)
    // has coordinates to sample — cones/cylinders carry their own UVs, but a
    // hand-built quad does not. One texture span per blade (base→tip),
    // vertex order matched to `verts` above (front tri, then back tri).
    g.setAttribute('uv', new Float32BufferAttribute(new Float32Array([
      0, 0, 1, 0, 0.5, 1, // front tri
      1, 0, 0, 0, 0.5, 1, // back tri
    ]), 2));
    g.rotateY((i * Math.PI) / 3);
    blades.push(paint(g, BLADE));
  }
  return merge(blades);
}
