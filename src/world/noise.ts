/**
 * Curves pass (C1/C2, spec §11): seeded, position-stable noise. ALL curve and
 * terrain randomness routes through here — mulberry32-seeded (the audio
 * knock-jitter precedent, AudioManager.ts:116), NEVER Math.random — so builds
 * are byte-reproducible and unit-testable. Pure math, no three.js render state.
 */
import type { BufferGeometry } from 'three';

/** The game's tiny seeded PRNG — same implementation as main.ts:201. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic [0,1) at an integer lattice point, per seed. */
export function seededAt(ix: number, iy: number, iz: number, seed: number): number {
  const h =
    (Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(iz | 0, 1274126177) ^ (seed | 0)) >>> 0;
  return mulberry32(h)();
}

/**
 * Seeded radial vertex displacement (±ampM along the vertex's direction from
 * the local origin). Keyed on the QUANTIZED POSITION (mm), not the vertex
 * index, so duplicated verts (non-indexed geometry, sphere seams) displace
 * identically — the surface stays watertight. Recomputes normals.
 */
export function displaceRadial(geo: BufferGeometry, ampM: number, seed: number): BufferGeometry {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, y, z);
    if (len < 1e-6) continue; // a vertex at the origin has no radial direction
    const n = seededAt(Math.round(x * 1000), Math.round(y * 1000), Math.round(z * 1000), seed) * 2 - 1;
    const k = 1 + (n * ampM) / len;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// --- C2: terrain undulation ------------------------------------------------
/** Max height offset of the exterior ground undulation, metres. Small enough
 *  that even an unsampled consumer could never visibly float — but every
 *  consumer DOES sample it (belt and braces). */
export const UNDULATION_AMP_M = 0.12;
/** NOT a multiple of the 2 m cell — the swell never reads as per-cell steps. */
const UNDULATION_WAVELENGTH_M = 3.7;
const UNDULATION_SEED = 0x51e7;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Smooth seeded value-noise height offset (m) at a world position — the ONE
 * undulation function: ground verts, skirt edges, placements, and every
 * view-y consumer sample IT, so feet can never drift from the surface.
 */
export function undulation(worldX: number, worldZ: number): number {
  const gx = worldX / UNDULATION_WAVELENGTH_M;
  const gz = worldZ / UNDULATION_WAVELENGTH_M;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const fx = smooth(gx - x0);
  const fz = smooth(gz - z0);
  const v = (ix: number, iz: number): number => seededAt(ix, 0, iz, UNDULATION_SEED) * 2 - 1;
  const a = mix(v(x0, z0), v(x0 + 1, z0), fx);
  const b = mix(v(x0, z0 + 1), v(x0 + 1, z0 + 1), fx);
  return mix(a, b, fz) * UNDULATION_AMP_M;
}
