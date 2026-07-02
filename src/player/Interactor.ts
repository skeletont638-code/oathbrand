/**
 * Interactor — picks which interactable (lore, banner, door, npc, pickup)
 * the player's context prompt should target: nearest item that is both
 * within `TUNING.player.interactRangeM` and inside a 60°-total facing cone.
 * Pure math, NO three.js/DOM — runs in vitest without WebGL.
 */
import { TUNING } from '../content/tuning';

export type InteractVerb = 'KNEEL' | 'READ' | 'TAKE' | 'OPEN' | 'SPEAK' | 'GIVE' | 'OFFER';

/** Something the player can target with the context action. */
export interface Interactable {
  id: string;
  verb: InteractVerb;
  /** World-space XZ position. */
  x: number;
  z: number;
  /** Optional display name shown after the verb in the prompt. */
  label?: string;
}

/** Live view of the player's position/facing (the Controller satisfies it). */
export interface Pose {
  pos: { x: number; z: number };
  yaw: number;
}

/** cos(half-angle) of the 60°-total facing cone. */
const COS_HALF_CONE = Math.cos((30 * Math.PI) / 180);

export class Interactor {
  constructor(private readonly pose: Pose) {}

  /** Nearest item in range AND inside the facing cone, else null. */
  nearest(items: Interactable[]): Interactable | null {
    const { pos, yaw } = this.pose;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const range = TUNING.player.interactRangeM;
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const item of items) {
      const dx = item.x - pos.x;
      const dz = item.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range || dist >= bestDist) continue;
      // dot(facing, to-item) ≥ cos(30°)·dist ⇔ angle ≤ 30°. At dist 0 the
      // comparison is 0 ≥ 0 — an item underfoot always qualifies.
      if (fx * dx + fz * dz < COS_HALF_CONE * dist) continue;
      best = item;
      bestDist = dist;
    }
    return best;
  }
}
