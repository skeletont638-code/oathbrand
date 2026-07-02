import { describe, it, expect } from 'vitest';
import { TUNING } from '../tuning';

describe('TUNING.greaterVael', () => {
  it('dread cadence: ≥90 s between scares', () => {
    expect(TUNING.greaterVael.dread.minScareGapSec).toBe(90);
  });

  it('the Watcher is the deliberate 3.0 m exception', () => {
    expect(TUNING.greaterVael.watcher.heightM).toBe(3.0);
  });

  it('the hound flanks with a random circle side', () => {
    expect(TUNING.greaterVael.hound.circle.flankRandom).toBe(true);
  });

  it('exterior fog defaults to the v1 16 m far-plane', () => {
    expect(TUNING.greaterVael.exterior.fogFarDefaultM).toBe(16);
  });
});
