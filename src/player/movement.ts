/**
 * Player movement math — pure functions, NO three.js/DOM so vitest runs
 * them without WebGL. The Controller wires these to real input events.
 *
 * Conventions (matches three.js 'YXZ' first-person euler):
 *   yaw 0 faces -z; positive yaw turns left (toward -x at 90°).
 *   forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw) in XZ.
 */
import type { Vec2 } from '../world/collision';

/** Live input snapshot owned by the Controller, mutated by event handlers. */
export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  /** Virtual-stick vector, screen convention (+x right, +y down), |v| ≤ 1.
   *  Zero when the stick is idle; overrides WASD while past the deadzone. */
  stickX: number;
  stickY: number;
  /** Latched by E / the touch action button; the consumer clears it. */
  interact: boolean;
}

/** Stick displacements below this magnitude are treated as idle. */
export const STICK_DEADZONE = 0.15;

/** Pitch clamp: ±75° in radians. */
export const PITCH_LIMIT = (75 * Math.PI) / 180;

/** Clamp a pitch angle to the ±75° look limit. */
export function clampPitch(pitch: number): number {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch));
}

/**
 * Resolve the input state into a world-space XZ move direction for the
 * given yaw. Magnitude ≤ 1 (keys normalized; analog stick magnitude kept).
 * Writes into and returns `out` — the hot path allocates nothing.
 */
export function moveVector(input: InputState, yaw: number, out: Vec2): Vec2 {
  let strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let ahead = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  if (Math.hypot(input.stickX, input.stickY) > STICK_DEADZONE) {
    strafe = input.stickX;
    ahead = -input.stickY; // screen up = forward
  }
  const len = Math.hypot(strafe, ahead);
  if (len > 1) {
    strafe /= len;
    ahead /= len;
  }
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  out.x = cos * strafe - sin * ahead;
  out.z = -sin * strafe - cos * ahead;
  return out;
}
