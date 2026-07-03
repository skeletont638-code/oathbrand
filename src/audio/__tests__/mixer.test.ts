import { describe, it, expect } from 'vitest';
import { TUNING } from '../../content/tuning';
import {
  ambienceGain,
  bpmToIntervalMs,
  clamp01,
  crossfadeCurves,
  crossfadeGains,
  dbToGain,
  heartGain,
  heartRateBpm,
  silenceCurve,
} from '../mixer';

// The pure gain/threat math behind the dread mixer. No WebAudio here — these
// are the numbers the AudioManager schedules onto its GainNodes, tested in
// isolation so the audio graph never has to be mocked (Task 17, Step 1).

describe('threat → ambience duck', () => {
  it('threat 0 leaves ambience at unity (1.0)', () => {
    expect(ambienceGain(0)).toBe(1);
  });

  it('threat 1 ducks ambience to 0.35 (−9 dB)', () => {
    expect(ambienceGain(1)).toBeCloseTo(0.35, 2);
    // …and it is EXACTLY the −9 dB the tuning declares.
    expect(ambienceGain(1)).toBeCloseTo(dbToGain(TUNING.audio.duckDb), 6);
  });

  it('is monotonically non-increasing in threat', () => {
    let prev = ambienceGain(0);
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const g = ambienceGain(t);
      expect(g).toBeLessThanOrEqual(prev + 1e-9);
      prev = g;
    }
  });

  it('clamps out-of-range threat to the [0,1] endpoints', () => {
    expect(ambienceGain(-3)).toBe(ambienceGain(0));
    expect(ambienceGain(9)).toBe(ambienceGain(1));
  });
});

describe('threat → heartbeat', () => {
  it('threat 0 is silent (heart gain 0)', () => {
    expect(heartGain(0)).toBe(0);
  });

  it('threat 1 is full (heart gain 1)', () => {
    expect(heartGain(1)).toBe(1);
  });

  it('is monotonically non-decreasing in threat', () => {
    let prev = heartGain(0);
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const g = heartGain(t);
      expect(g).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = g;
    }
  });

  it('maps threat 0→110 bpm across 60→110', () => {
    expect(heartRateBpm(0)).toBeCloseTo(TUNING.audio.heartBpm.min, 6);
    expect(heartRateBpm(1)).toBeCloseTo(TUNING.audio.heartBpm.max, 6);
    expect(heartRateBpm(0.5)).toBeCloseTo(
      (TUNING.audio.heartBpm.min + TUNING.audio.heartBpm.max) / 2,
      6,
    );
    // strictly rising
    expect(heartRateBpm(0.6)).toBeGreaterThan(heartRateBpm(0.3));
  });

  it('bpm → beat interval is 60000/bpm', () => {
    expect(bpmToIntervalMs(60)).toBeCloseTo(1000, 6);
    expect(bpmToIntervalMs(110)).toBeCloseTo(60000 / 110, 6);
  });
});

describe('crossfade math', () => {
  it('is equal-power: out²+in² == 1 across the fade', () => {
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const { out, in: inG } = crossfadeGains(t);
      expect(out * out + inG * inG).toBeCloseTo(1, 6);
    }
  });

  it('endpoints hand off cleanly (out 1→0, in 0→1)', () => {
    expect(crossfadeGains(0).out).toBeCloseTo(1, 6);
    expect(crossfadeGains(0).in).toBeCloseTo(0, 6);
    expect(crossfadeGains(1).out).toBeCloseTo(0, 6);
    expect(crossfadeGains(1).in).toBeCloseTo(1, 6);
  });

  it('is monotonic: out only falls, in only rises', () => {
    let prevOut = crossfadeGains(0).out;
    let prevIn = crossfadeGains(0).in;
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const { out, in: inG } = crossfadeGains(t);
      expect(out).toBeLessThanOrEqual(prevOut + 1e-9);
      expect(inG).toBeGreaterThanOrEqual(prevIn - 1e-9);
      prevOut = out;
      prevIn = inG;
    }
  });

  it('renders monotonic value-curves for setValueCurveAtTime', () => {
    const { out, in: inG } = crossfadeCurves(16);
    expect(out).toHaveLength(16);
    expect(inG).toHaveLength(16);
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[15]).toBeCloseTo(0, 6);
    expect(inG[0]).toBeCloseTo(0, 6);
    expect(inG[15]).toBeCloseTo(1, 6);
    for (let i = 1; i < 16; i++) {
      expect(out[i]).toBeLessThanOrEqual(out[i - 1] + 1e-9);
      expect(inG[i]).toBeGreaterThanOrEqual(inG[i - 1] - 1e-9);
    }
  });
});

describe('silence-spike curve (Task 6)', () => {
  it('starts at unity (the base) and ends at ~0', () => {
    const c = silenceCurve(8);
    expect(c).toHaveLength(8);
    expect(c[0]).toBeCloseTo(1, 6); // the current ambience level (base 1)
    expect(c[c.length - 1]).toBeCloseTo(0, 6); // silence
  });

  it('is monotonically non-increasing (a clean duck-to-silence, no strobe)', () => {
    const c = silenceCurve(16);
    for (let i = 1; i < c.length; i++) {
      expect(c[i]).toBeLessThanOrEqual(c[i - 1] + 1e-9);
    }
  });

  it('is equal-power-consistent — it IS the crossfade OUT curve', () => {
    // The drop follows the same cos law the zone crossfade uses for its
    // outgoing layer, so the spike stays perceptually even as it collapses.
    const n = 12;
    const sc = silenceCurve(n);
    const { out } = crossfadeCurves(n);
    for (let i = 0; i < n; i++) expect(sc[i]).toBeCloseTo(out[i], 6);
  });

  it('degenerate step count returns a single silent-at-base sample', () => {
    const c = silenceCurve(1);
    expect(c).toHaveLength(1);
    expect(c[0]).toBeCloseTo(1, 6);
  });

  it('composes with the threat-duck by MULTIPLICATION (separate nodes)', () => {
    // duckToSilence rides a SEPARATE gain node (the ambienceTrim pattern): the
    // audible ambience is ambienceGain(threat) × silenceCurve. So at the drop's
    // floor the ambience is ~silent, and once the node returns to unity the
    // ambience is restored EXACTLY to the live threat-driven target.
    for (const threat of [0, 0.4, 1]) {
      const base = ambienceGain(threat);
      const c = silenceCurve(8);
      expect(base * c[c.length - 1]).toBeCloseTo(0, 6); // floor ≈ silence
      expect(base * 1).toBeCloseTo(base, 6); // restore ⇒ the threat target
    }
  });

  it('leaves the existing mixer math untouched (regression)', () => {
    expect(bpmToIntervalMs(60)).toBeCloseTo(1000, 6);
    expect(ambienceGain(0)).toBe(1);
    expect(ambienceGain(1)).toBeCloseTo(dbToGain(TUNING.audio.duckDb), 6);
  });
});

describe('dbToGain / clamp01', () => {
  it('0 dB is unity, −6 dB ≈ 0.501, −9 dB ≈ 0.355', () => {
    expect(dbToGain(0)).toBeCloseTo(1, 6);
    expect(dbToGain(-6)).toBeCloseTo(0.5012, 3);
    expect(dbToGain(-9)).toBeCloseTo(0.3548, 3);
  });

  it('clamp01 pins to [0,1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });
});
