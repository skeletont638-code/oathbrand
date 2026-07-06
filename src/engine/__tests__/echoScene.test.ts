/**
 * EchoScene engine (world-expansion v1.2, Task 3) — silent apparition replays.
 *
 * Pure-math coverage (no three.js, no DOM): a scene arms on zone entry, fires
 * once when the player steps onto a trigger cell, marks itself witnessed (so it
 * never re-fires this run), interpolates its actors along keyframed walks,
 * fades in/holds/out under a 1.5 s envelope capped at 0.45 opacity, and pulses
 * the brand only while live. NG+ re-arm is proven by an emptied witnessed set.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  EchoSceneSystem,
  echoOpacity,
  actorPoseAt,
  ECHO_FADE_MS,
  ECHO_PEAK_OPACITY,
  type EchoSceneDef,
  type EchoActorDef,
} from '../EchoScene';

/** Cell size the engine converts [row,col] → world XZ with (mirrors CELL_M=2). */
const CELL_M = 2;

/** Canonical Act I oath scene fixture used across the trigger/pulse suites. */
function oathScene(over: Partial<EchoSceneDef> = {}): EchoSceneDef {
  return {
    id: 'act1-oath',
    zone: 'gate-fields',
    act: 1,
    triggerCells: [
      [5, 5],
      [5, 6],
    ],
    durationMs: 12000,
    actors: [
      { rig: 'king', at: [3, 5], facing: 0 },
      // A knight who walks two cells east over the first 6 s of the scene.
      { rig: 'knight', at: [4, 5], facing: Math.PI, keyframes: [{ tMs: 6000, at: [4, 7] }] },
    ],
    ...over,
  };
}

function makeSystem(scenes: EchoSceneDef[], witnessed: Set<string> = new Set()) {
  const onWitness = vi.fn();
  const brandPulse = vi.fn();
  const sys = new EchoSceneSystem(scenes, { witnessed, onWitness, brandPulse });
  return { sys, onWitness, brandPulse, witnessed };
}

describe('echoOpacity — 1.5 s in → hold → 1.5 s out, ≤ 0.45', () => {
  const D = 12000;
  it('is 0 at the very start and the very end (fully faded)', () => {
    expect(echoOpacity(0, D)).toBe(0);
    expect(echoOpacity(D, D)).toBe(0);
    expect(echoOpacity(-100, D)).toBe(0);
    expect(echoOpacity(D + 100, D)).toBe(0);
  });

  it('reaches exactly the peak (0.45) at the top of the fade-in', () => {
    expect(echoOpacity(ECHO_FADE_MS, D)).toBeCloseTo(ECHO_PEAK_OPACITY, 6);
    expect(ECHO_PEAK_OPACITY).toBe(0.45);
  });

  it('holds at the peak through the middle', () => {
    expect(echoOpacity(D / 2, D)).toBeCloseTo(0.45, 6);
    expect(echoOpacity(D - ECHO_FADE_MS, D)).toBeCloseTo(0.45, 6);
  });

  it('is half-peak halfway through each fade ramp', () => {
    expect(echoOpacity(ECHO_FADE_MS / 2, D)).toBeCloseTo(0.225, 6); // rising
    expect(echoOpacity(D - ECHO_FADE_MS / 2, D)).toBeCloseTo(0.225, 6); // falling
  });

  it('never exceeds the peak even for a short scene (fade-in meets fade-out)', () => {
    const short = 2000; // < 2 * ECHO_FADE_MS — the ramps overlap
    for (let t = 0; t <= short; t += 100) {
      expect(echoOpacity(t, short)).toBeLessThanOrEqual(ECHO_PEAK_OPACITY + 1e-9);
    }
    expect(echoOpacity(short / 2, short)).toBeLessThan(ECHO_PEAK_OPACITY); // apex clipped
  });
});

describe('actorPoseAt — keyframe interpolation (cell → world, CELL_M = 2)', () => {
  it('a stationary actor sits at its cell centre for all t', () => {
    const king: EchoActorDef = { rig: 'king', at: [3, 5], facing: 0 };
    const pose = actorPoseAt(king, 4000);
    expect(pose.x).toBeCloseTo((5 + 0.5) * CELL_M, 6); // col → x
    expect(pose.z).toBeCloseTo((3 + 0.5) * CELL_M, 6); // row → z
    expect(pose.facing).toBe(0);
  });

  it('linearly interpolates position along a keyframed walk', () => {
    const knight: EchoActorDef = {
      rig: 'knight',
      at: [4, 5],
      facing: 0,
      keyframes: [{ tMs: 6000, at: [4, 7] }],
    };
    // Half-way through the 6 s walk: col 5 → 7 ⇒ col 6.
    const mid = actorPoseAt(knight, 3000);
    expect(mid.x).toBeCloseTo((6 + 0.5) * CELL_M, 6);
    expect(mid.z).toBeCloseTo((4 + 0.5) * CELL_M, 6);
  });

  it('clamps to the first keyframe before it and the last keyframe after it', () => {
    const knight: EchoActorDef = {
      rig: 'knight',
      at: [4, 5],
      facing: 0,
      keyframes: [{ tMs: 6000, at: [4, 7] }],
    };
    expect(actorPoseAt(knight, 0).x).toBeCloseTo((5 + 0.5) * CELL_M, 6); // at start cell
    expect(actorPoseAt(knight, 99999).x).toBeCloseTo((7 + 0.5) * CELL_M, 6); // held at last
  });

  it('interpolates facing across keyframes and inherits an omitted at', () => {
    const walker: EchoActorDef = {
      rig: 'queen',
      at: [2, 2],
      facing: 0,
      keyframes: [{ tMs: 1000, facing: Math.PI }], // turns in place (no `at`)
    };
    const pose = actorPoseAt(walker, 500);
    expect(pose.facing).toBeCloseTo(Math.PI / 2, 6);
    expect(pose.x).toBeCloseTo((2 + 0.5) * CELL_M, 6); // inherited at
    expect(pose.z).toBeCloseTo((2 + 0.5) * CELL_M, 6);
  });
});

describe('EchoSceneSystem — trigger, once-per-run, witnessed persistence', () => {
  it('does not fire until the active zone is entered', () => {
    const { sys, onWitness } = makeSystem([oathScene()]);
    sys.update(16, [5, 5]); // on a trigger cell but no zone armed
    expect(sys.activeActors()).toEqual([]);
    expect(onWitness).not.toHaveBeenCalled();
  });

  it('does not fire off a trigger cell', () => {
    const { sys, onWitness } = makeSystem([oathScene()]);
    sys.enterZone('gate-fields');
    sys.update(16, [0, 0]);
    expect(sys.activeActors()).toEqual([]);
    expect(onWitness).not.toHaveBeenCalled();
  });

  it('fires when the player steps onto ANY trigger cell', () => {
    const { sys, onWitness } = makeSystem([oathScene()]);
    sys.enterZone('gate-fields');
    sys.update(16, [5, 6]); // the second trigger cell
    expect(onWitness).toHaveBeenCalledExactlyOnceWith('act1-oath');
    // A live scene raises all its actors.
    expect(sys.activeActors().map((a) => a.rig)).toEqual(['king', 'knight']);
  });

  it('marks the scene witnessed immediately and never re-fires this run', () => {
    const { sys, onWitness, witnessed } = makeSystem([oathScene()]);
    sys.enterZone('gate-fields');
    sys.update(0, [5, 5]); // trigger
    expect(witnessed.has('act1-oath')).toBe(true);
    // Run the whole scene out.
    sys.update(12000, [5, 5]);
    expect(sys.activeActors()).toEqual([]);
    // Standing back on the trigger cell must NOT replay it.
    sys.update(16, [5, 5]);
    expect(sys.activeActors()).toEqual([]);
    expect(onWitness).toHaveBeenCalledTimes(1);
  });

  it('a scene already in the witnessed set never fires (persisted from a prior load)', () => {
    const { sys, onWitness } = makeSystem([oathScene()], new Set(['act1-oath']));
    sys.enterZone('gate-fields');
    sys.update(16, [5, 5]);
    expect(sys.activeActors()).toEqual([]);
    expect(onWitness).not.toHaveBeenCalled();
  });

  it('only plays scenes belonging to the entered zone', () => {
    const other = oathScene({ id: 'elsewhere', zone: 'undercroft' });
    const { sys, onWitness } = makeSystem([other]);
    sys.enterZone('gate-fields'); // wrong zone for `elsewhere`
    sys.update(16, [5, 5]);
    expect(onWitness).not.toHaveBeenCalled();
  });

  it('ends the running scene when the player leaves the zone', () => {
    const { sys } = makeSystem([oathScene()]);
    sys.enterZone('gate-fields');
    sys.update(0, [5, 5]);
    sys.update(2000, [5, 5]);
    expect(sys.activeActors().length).toBe(2);
    sys.enterZone('undercroft'); // walked out mid-scene
    expect(sys.activeActors()).toEqual([]);
  });
});

describe('EchoSceneSystem — fade envelope + brand pulse while live', () => {
  it('actor opacity follows the shared envelope and caps at 0.45', () => {
    const { sys } = makeSystem([oathScene()]);
    sys.enterZone('gate-fields');
    sys.update(0, [5, 5]); // trigger, elapsed 0
    expect(sys.activeActors()[0].opacity).toBe(0); // fully faded in at start
    sys.update(ECHO_FADE_MS, [5, 5]); // elapsed 1500 → peak
    expect(sys.activeActors()[0].opacity).toBeCloseTo(0.45, 6);
    sys.update(4500, [5, 5]); // elapsed 6000 → mid hold
    expect(sys.activeActors()[0].opacity).toBeCloseTo(0.45, 6);
  });

  it('pulses the brand ONLY while a scene is live, never when idle', () => {
    const { sys, brandPulse } = makeSystem([oathScene()]);
    sys.enterZone('gate-fields');
    sys.update(16, [0, 0]); // idle
    expect(brandPulse).not.toHaveBeenCalled();
    sys.update(16, [5, 5]); // trigger frame
    expect(brandPulse).toHaveBeenCalledTimes(1);
    sys.update(16, [5, 5]); // still live
    expect(brandPulse).toHaveBeenCalledTimes(2);
    sys.update(12000, [5, 5]); // this tick ends the scene → no pulse on the end frame
    expect(brandPulse).toHaveBeenCalledTimes(2);
    sys.update(16, [5, 5]); // idle again (witnessed)
    expect(brandPulse).toHaveBeenCalledTimes(2);
  });

  it('never takes player control — the system exposes no input/lock surface', () => {
    const { sys } = makeSystem([oathScene()]);
    // The only public methods are enterZone/update/activeActors — a silent,
    // passive overlay. Assert the shape so a future edit can't add a lock hook.
    expect(typeof (sys as unknown as Record<string, unknown>).lockInput).toBe('undefined');
    expect(typeof sys.activeActors).toBe('function');
  });
});

describe('EchoSceneSystem — NG+ re-arm', () => {
  it('re-fires a previously-witnessed scene when the witnessed set is emptied', () => {
    // Simulate a first run that witnessed the oath.
    const witnessed = new Set<string>(['act1-oath']);
    const first = makeSystem([oathScene()], witnessed);
    first.sys.enterZone('gate-fields');
    first.sys.update(16, [5, 5]);
    expect(first.sys.activeActors()).toEqual([]); // already witnessed → silent

    // NG+ (secondVigilSave drops echoesWitnessed) ⇒ a fresh empty set.
    const ngPlus = makeSystem([oathScene()], new Set());
    ngPlus.sys.enterZone('gate-fields');
    ngPlus.sys.update(16, [5, 5]);
    expect(ngPlus.onWitness).toHaveBeenCalledExactlyOnceWith('act1-oath'); // re-armed
    expect(ngPlus.sys.activeActors().length).toBe(2);
  });
});
