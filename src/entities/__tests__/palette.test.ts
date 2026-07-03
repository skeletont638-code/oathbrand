import { describe, it, expect } from 'vitest';
import { HOUND_TINT, KNEELER_TINT, WATCHER_TINT, HAG_TINT } from '../palette';

describe('entity tint invariants (spec §3)', () => {
  it('the Watcher and the Hag stay PURE BLACK', () => {
    expect(WATCHER_TINT).toBe(0x000000);
    expect(HAG_TINT).toBe(0x000000);
  });
  it('the Hound and Kneeler stay dark-but-formed (not black, low luma)', () => {
    for (const c of [HOUND_TINT, KNEELER_TINT]) {
      const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      expect(luma).toBeGreaterThan(8);   // not void
      expect(luma).toBeLessThan(60);     // still dark
    }
  });
});
