/**
 * Pure-math tests for the player controller (Task 7). No three.js, no DOM:
 * `movement.ts` and `Interactor.ts` are plain math so they run in vitest
 * without WebGL.
 */
import { describe, it, expect } from 'vitest';
import { moveVector, clampPitch, PITCH_LIMIT, type InputState } from '../movement';
import { Interactor, type Interactable } from '../Interactor';
import { TUNING } from '../../content/tuning';

const DEG = Math.PI / 180;

function input(partial: Partial<InputState> = {}): InputState {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    stickX: 0,
    stickY: 0,
    interact: false,
    ...partial,
  };
}

function move(partial: Partial<InputState>, yaw: number): { x: number; z: number } {
  return moveVector(input(partial), yaw, { x: 0, z: 0 });
}

describe('moveVector — WASD relative to yaw', () => {
  it('yaw=0 + w moves toward -z (camera default facing)', () => {
    const v = move({ forward: true }, 0);
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.z).toBeCloseTo(-1, 6);
  });

  it('yaw=90° + w moves toward -x', () => {
    const v = move({ forward: true }, 90 * DEG);
    expect(v.x).toBeCloseTo(-1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('yaw=0 + s moves toward +z, + d strafes toward +x, + a toward -x', () => {
    const s = move({ back: true }, 0);
    expect(s.x).toBeCloseTo(0, 6);
    expect(s.z).toBeCloseTo(1, 6);
    const d = move({ right: true }, 0);
    expect(d.x).toBeCloseTo(1, 6);
    expect(d.z).toBeCloseTo(0, 6);
    const a = move({ left: true }, 0);
    expect(a.x).toBeCloseTo(-1, 6);
    expect(a.z).toBeCloseTo(0, 6);
  });

  it('diagonal (w+d) is normalized to unit length', () => {
    const v = move({ forward: true, right: true }, 0);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1, 6);
    expect(v.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(v.z).toBeCloseTo(-Math.SQRT1_2, 6);
  });

  it('opposing keys cancel to zero', () => {
    const v = move({ forward: true, back: true }, 0);
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.z).toBeCloseTo(0, 12);
  });

  it('touch stick: push up moves forward, analog magnitude preserved', () => {
    const full = move({ stickX: 0, stickY: -1 }, 0);
    expect(full.x).toBeCloseTo(0, 6);
    expect(full.z).toBeCloseTo(-1, 6);
    const half = move({ stickX: 0, stickY: -0.5 }, 0);
    expect(Math.hypot(half.x, half.z)).toBeCloseTo(0.5, 6);
  });

  it('touch stick rotates with yaw too (yaw=90°, up → -x)', () => {
    const v = move({ stickX: 0, stickY: -1 }, 90 * DEG);
    expect(v.x).toBeCloseTo(-1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('writes into and returns the caller-provided vector (no allocation)', () => {
    const out = { x: 99, z: 99 };
    const ret = moveVector(input({ forward: true }), 0, out);
    expect(ret).toBe(out);
    expect(out.z).toBeCloseTo(-1, 6);
  });
});

describe('clampPitch — ±75°', () => {
  it('passes through values inside the limit', () => {
    expect(clampPitch(0.5)).toBe(0.5);
    expect(clampPitch(-1.2)).toBe(-1.2);
    expect(clampPitch(0)).toBe(0);
  });

  it('clamps to exactly ±75° beyond the limit', () => {
    expect(PITCH_LIMIT).toBeCloseTo(75 * DEG, 9);
    expect(clampPitch(2)).toBeCloseTo(75 * DEG, 9);
    expect(clampPitch(-2)).toBeCloseTo(-75 * DEG, 9);
    expect(clampPitch(Math.PI)).toBeCloseTo(PITCH_LIMIT, 9);
  });
});

describe('Interactor.nearest — range + 60° facing cone', () => {
  const item = (id: string, x: number, z: number): Interactable => ({
    id,
    verb: 'READ',
    x,
    z,
  });

  it('picks the nearest in-cone item, not a nearer out-of-cone one', () => {
    // Pose at origin, yaw=0 → facing -z. Cone = ±30° around (0,-1).
    const it9 = new Interactor({ pos: { x: 0, z: 0 }, yaw: 0 });
    const near = item('near', 0.3, -1); // ~16.7° off axis, dist ~1.04 → in cone
    const far = item('far', 0, -2); // dead ahead, dist 2 → in cone but farther
    const behind = item('behind', 0, 0.5); // dist 0.5 but 180° off → excluded
    expect(it9.nearest([behind, far, near])?.id).toBe('near');
  });

  it('excludes items beyond interactRangeM even when in the cone', () => {
    const it9 = new Interactor({ pos: { x: 0, z: 0 }, yaw: 0 });
    const tooFar = item('tooFar', 0, -(TUNING.player.interactRangeM + 0.1));
    expect(it9.nearest([tooFar])).toBeNull();
    const atRange = item('atRange', 0, -(TUNING.player.interactRangeM - 0.01));
    expect(it9.nearest([atRange])?.id).toBe('atRange');
  });

  it('excludes items outside the 30° half-angle, includes inside it', () => {
    const it9 = new Interactor({ pos: { x: 0, z: 0 }, yaw: 0 });
    // 45° off facing — outside the 60°-total cone.
    const off45 = item('off45', Math.sin(45 * DEG), -Math.cos(45 * DEG));
    expect(it9.nearest([off45])).toBeNull();
    // 20° off facing — inside.
    const off20 = item('off20', Math.sin(20 * DEG), -Math.cos(20 * DEG));
    expect(it9.nearest([off20])?.id).toBe('off20');
  });

  it('the cone rotates with yaw (yaw=90° faces -x)', () => {
    const it9 = new Interactor({ pos: { x: 0, z: 0 }, yaw: 90 * DEG });
    const west = item('west', -1, 0);
    const north = item('north', 0, -1); // 90° off the -x facing → excluded
    expect(it9.nearest([north, west])?.id).toBe('west');
    expect(it9.nearest([north])).toBeNull();
  });

  it('reads the pose live (moving the player changes the result)', () => {
    const pose = { pos: { x: 0, z: 0 }, yaw: 0 };
    const it9 = new Interactor(pose);
    const spot = item('spot', 0, -1.5);
    expect(it9.nearest([spot])?.id).toBe('spot');
    pose.pos.x = 50; // walk away
    expect(it9.nearest([spot])).toBeNull();
  });

  it('returns null for an empty list', () => {
    const it9 = new Interactor({ pos: { x: 0, z: 0 }, yaw: 0 });
    expect(it9.nearest([])).toBeNull();
  });
});
