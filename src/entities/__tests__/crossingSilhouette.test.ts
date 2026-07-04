import { describe, it, expect } from 'vitest';
import { CrossingSilhouette } from '../CrossingSilhouette';

// CrossingSilhouette's constructor takes no args (src/entities/CrossingSilhouette.ts:66);
// arm(from, to, durMs) and update(dtMs, playerPos) are the confirmed signatures.
function makeCrossing(): CrossingSilhouette {
  return new CrossingSilhouette();
}

describe('CrossingSilhouette lifecycle', () => {
  it('despawns (root hidden) at the end of the traverse', () => {
    const c = makeCrossing();
    c.arm({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1000);
    expect(c.root.visible).toBe(true);
    c.update(600, { x: 50, z: 50 }); // far away, mid-traverse
    expect(c.root.visible).toBe(true);
    c.update(600, { x: 50, z: 50 }); // u >= 1 → end of traverse
    expect(c.root.visible).toBe(false);
  });
  it('despawns early when the player closes within CROSS_DESPAWN_M ("gone if approached")', () => {
    const c = makeCrossing();
    c.arm({ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, 4000);
    c.update(16, { x: 0.5, z: 0 }); // player right on top of the start
    expect(c.root.visible).toBe(false);
  });
  it('is inert (no throw, stays hidden) before it is armed', () => {
    const c = makeCrossing();
    expect(() => c.update(16, { x: 0, z: 0 })).not.toThrow();
    expect(c.root.visible).toBe(false);
  });
});
