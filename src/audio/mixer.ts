/**
 * Pure gain / threat / crossfade math for the dread mixer (Task 17).
 *
 * NO WebAudio, NO three.js — this is the arithmetic the AudioManager schedules
 * onto its GainNodes, split out so `mixer.test.ts` can verify it in plain node
 * without ever constructing (or mocking) an audio graph. The AudioManager is
 * the only place these numbers meet a real AudioContext.
 */
import { TUNING } from '../content/tuning';

const AUDIO = TUNING.audio;

/** Pin a value to the closed unit interval. */
export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Decibels → linear amplitude gain (0 dB = 1, −6 dB ≈ 0.5). */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Ambience bus gain for a threat level. Unity when nothing is near; ducked to
 * the tuned −9 dB (≈0.355) at full threat, interpolated linearly in LINEAR
 * gain space so it is monotone and lands exactly on the two contract points
 * (threat 0 → 1.0, threat 1 → 0.35).
 */
export function ambienceGain(threat: number): number {
  const t = clamp01(threat);
  const duck = dbToGain(AUDIO.duckDb);
  return 1 - t * (1 - duck);
}

/** Heartbeat bus gain: silent with no threat, full at the throat. */
export function heartGain(threat: number): number {
  return clamp01(threat);
}

/** Heartbeat rate in bpm, mapped from threat across the tuned 60→110 range. */
export function heartRateBpm(threat: number): number {
  const { min, max } = AUDIO.heartBpm;
  return min + clamp01(threat) * (max - min);
}

/** Milliseconds between beats at a given bpm. */
export function bpmToIntervalMs(bpm: number): number {
  return 60000 / bpm;
}

/**
 * Equal-power crossfade gains at fade progress `t` ∈ [0,1]: the outgoing layer
 * follows cos, the incoming follows sin, so out²+in² == 1 (constant perceived
 * loudness) and each is monotone. Used to render the value-curves the
 * AudioManager hands to `setValueCurveAtTime` for a 2 s zone crossfade.
 */
export function crossfadeGains(t: number): { out: number; in: number } {
  const a = clamp01(t) * (Math.PI / 2);
  return { out: Math.cos(a), in: Math.sin(a) };
}

/**
 * Sample the equal-power crossfade into two `steps`-long value-curves (out
 * 1→0, in 0→1), ready for `AudioParam.setValueCurveAtTime`.
 */
export function crossfadeCurves(steps: number): { out: Float32Array; in: Float32Array } {
  const out = new Float32Array(steps);
  const inC = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const g = crossfadeGains(steps === 1 ? 0 : i / (steps - 1));
    out[i] = g.out;
    inC[i] = g.in;
  }
  return { out, in: inC };
}

/**
 * Duck-to-silence-and-hold curve for the silence-spike (Task 6): a monotone
 * ramp from unity (the current ambience level) down to ~0, ready for
 * `AudioParam.setValueCurveAtTime` on a SEPARATE gain node that multiplies the
 * threat-ducked ambience bus (the `ambienceTrim` pattern — the spike never
 * fights the continuous threat-duck; the two nodes multiply). It is the same
 * cos law as the crossfade's OUT curve, so the collapse stays perceptually even
 * (equal-power-consistent), and it is a single held slope — no strobing gain.
 * The AudioManager holds the tail at ~0 for the spike's duration, then eases
 * the node back to unity, restoring the live threat-driven ambience target.
 */
export function silenceCurve(steps: number): Float32Array {
  const out = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    out[i] = crossfadeGains(steps === 1 ? 0 : i / (steps - 1)).out;
  }
  return out;
}
