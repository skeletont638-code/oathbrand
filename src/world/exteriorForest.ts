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
 * geometry here caps the dense pine at ~25 tris and bakes the OATHBRAND ash
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

/** A cone with its base sitting at `baseY` (three centres cones on the origin). */
function coneAt(radius: number, height: number, baseY: number, hex: number): BufferGeometry {
  const g = new ConeGeometry(radius, height, SEG, 1, true); // open-ended: skip the base cap
  g.translate(0, baseY + height / 2, 0);
  return paint(g, hex);
}

/** A trunk cylinder with its base at y = 0. */
function trunk(radiusTop: number, radiusBottom: number, height: number, hex: number): BufferGeometry {
  const g = new CylinderGeometry(radiusTop, radiusBottom, height, SEG, 1, true); // open-ended sides
  g.translate(0, height / 2, 0);
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
 * A dead pine: a short trunk under three stacked needle cones. ~25 tris, ~3.1 m.
 * The dense treeline/field-border instance (blocks; renders where `T`/`#`).
 */
export function pineGeometry(): BufferGeometry {
  return merge([
    trunk(0.11, 0.15, 0.7, BARK),
    coneAt(0.9, 1.2, 0.5, NEEDLE),
    coneAt(0.68, 1.1, 1.3, NEEDLE),
    coneAt(0.46, 1.0, 2.1, NEEDLE),
  ]);
}

/**
 * A bare/sparse trunk with a thin crown — the walkable, partial-occlusion
 * instance (`t` cells). Tall and mostly bald: you can see (and walk) past it.
 */
export function trunkGeometry(): BufferGeometry {
  return merge([
    trunk(0.13, 0.17, 1.9, BARK),
    coneAt(0.5, 0.9, 1.7, NEEDLE),
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
    g.rotateY((i * Math.PI) / 3);
    blades.push(paint(g, BLADE));
  }
  return merge(blades);
}
