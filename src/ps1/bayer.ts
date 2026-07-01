/**
 * Pure math for the PS1 pipeline's ordered-dither + color-quantize step.
 * No three.js / WebGL imports here on purpose — keeps this testable in plain
 * Node without a DOM/WebGL context.
 */

// Classic 4x4 Bayer (ordered-dither) matrix. Each integer 0..15 appears
// exactly once; dividing by 16 gives 16 distinct thresholds in [0, 1).
const BAYER_4X4_INT = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

/** Returns the 4x4 Bayer matrix (row-major, 16 entries) as thresholds in [0,1). */
export function bayer4x4(): number[] {
  return BAYER_4X4_INT.map((v) => v / 16);
}

// RGB555 = 5 bits per channel = 32 representable levels per channel (0..31).
const RGB555_LEVELS = 31;

/** Quantizes a single 0..1 color channel down to a 5-bit (32-level) step. */
export function quantizeRGB555(r: number): number {
  return Math.round(r * RGB555_LEVELS) / RGB555_LEVELS;
}
