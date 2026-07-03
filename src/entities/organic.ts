/**
 * Curves pass (C1, spec §11): the shared organic geometry vocabulary for the
 * entity views — tapered lathe capsules, bent limbs, crunched blob heads.
 * Real PS1 characters were low-poly but ORGANIC; these replace the box
 * vocabulary so silhouettes read tapered/attenuated, never Minecraft — and
 * MORE unsettling, not cuddly: every shape is narrower than its box (underfed)
 * and bowed (wrong). All shapes generate UVs natively (lathe/cylinder/sphere),
 * so the hound-hide / kneeler-cloth detail maps bind unchanged. Deterministic
 * (blob displacement is seeded). Pure three.js construction — vitest-safe.
 */
import { BufferGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, Vector2 } from 'three';
import { displaceRadial } from '../world/noise';

/** Radial resolution — deliberately low; a heptagon column reads round at 320×240. */
const RADIAL = 7;

/**
 * A vertically-tapered capsule authored base-at-y0 → top at `len` (rounded
 * caps, straight tapered flank). rBottom ≠ rTop = attenuation.
 */
export function taperedCapsule(rBottom: number, rTop: number, len: number, radial = RADIAL): BufferGeometry {
  const pts: Vector2[] = [];
  const CAP = 3;
  for (let i = 0; i <= CAP; i++) {
    const a = (i / CAP) * (Math.PI / 2); // bottom pole → equator
    pts.push(new Vector2(Math.sin(a) * rBottom, rBottom - Math.cos(a) * rBottom));
  }
  for (let i = 1; i <= CAP; i++) {
    const a = (i / CAP) * (Math.PI / 2); // top equator → pole
    pts.push(new Vector2(Math.cos(a) * rTop, len - rTop + Math.sin(a) * rTop));
  }
  return new LatheGeometry(pts, radial);
}

/** `taperedCapsule` re-authored CENTRED on the origin — a drop-in where a
 *  centred BoxGeometry stood (same position math in the constructors). */
export function centredCapsule(rBottom: number, rTop: number, len: number, radial = RADIAL): BufferGeometry {
  return taperedCapsule(rBottom, rTop, len, radial).translate(0, -len / 2, 0);
}

/**
 * A limb hanging DOWN from its pivot origin (the `segment()` convention):
 * a tapered open cylinder bowed by `bowM` at mid-length (both ends fixed),
 * so legs/arms read bent, never straight prisms.
 */
export function bentLimb(len: number, rTop: number, rBottom: number, bowM: number, radial = 6, segs = 3): BufferGeometry {
  const g = new CylinderGeometry(rTop, rBottom, len, radial, segs, true);
  g.translate(0, -len / 2, 0); // pivot (top) at y=0, extremity at −len
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = -pos.getY(i) / len; // 0 at the pivot → 1 at the extremity
    pos.setZ(i, pos.getZ(i) + Math.sin(Math.PI * t) * bowM);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** A crunched, faceless blob head: a low-poly sphere, seeded radial
 *  displacement ~18% of r — a lumpy skull-shape, never a readable face. */
export function blobHead(r: number, seed: number): BufferGeometry {
  return displaceRadial(new SphereGeometry(r, 7, 5), r * 0.18, seed);
}

/** A lathe from an `[radius, y]` profile (robes, shrouds, columns). */
export function latheShape(profile: readonly (readonly [number, number])[], radial = 8): BufferGeometry {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), radial);
}
