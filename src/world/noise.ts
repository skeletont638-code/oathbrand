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
