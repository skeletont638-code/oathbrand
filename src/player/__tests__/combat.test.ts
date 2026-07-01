/**
 * Player combat kit (Task 9) — pure fixed-step tests, no renderer.
 * Timings/specs come from TUNING.player; the collider is a real GridCollider
 * so guard shoves and quick-steps resolve through walls exactly like in-game.
 */
import { describe, it, expect } from 'vitest';
import { TUNING } from '../../content/tuning';
import { GridCollider } from '../../world/collision';
import type { Vec2 } from '../../world/collision';
import type { ZoneDef } from '../../world/zoneDef';
import { Combat, inArc } from '../Combat';
import type { HitArc } from '../Combat';

const { light, heavy, stepDistM, stepMs, guardShoveM, radius } = TUNING.player;

function collider(grid: string[]): GridCollider {
  const def: ZoneDef = {
    id: 'ashen-gate',
    grid,
    cell: 2,
    tiles: {},
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
  };
  return new GridCollider(def);
}

/** 8×8 open room: floor spans x/z ∈ (2, 14). */
const OPEN = collider([
  '########',
  '#......#',
  '#......#',
  '#......#',
  '#......#',
  '#......#',
  '#......#',
  '########',
]);

function makeCombat(x = 8, z = 8, yaw = 0, stepDir?: (out: Vec2) => void) {
  const pose = { pos: { x, z }, yaw };
  const combat = new Combat({ pose, collider: () => OPEN, stepDir });
  return { combat, pose };
}

describe('Combat — light attack', () => {
  it('tryLight starts a windup with no hitArc (TDD: no hitArc during windup)', () => {
    const { combat } = makeCombat();
    expect(combat.tryLight()).toBe(true);
    expect(combat.state).toBe('windup');
    expect(combat.hitArc()).toBeNull();
    combat.update(light.windupMs - 1);
    expect(combat.state).toBe('windup');
    expect(combat.hitArc()).toBeNull();
  });

  it('hitArc appears during active with damage 1 and the tuned arc/range', () => {
    const { combat, pose } = makeCombat(8, 8, 0.5);
    combat.tryLight();
    combat.update(light.windupMs);
    expect(combat.state).toBe('active');
    const arc = combat.hitArc();
    expect(arc).not.toBeNull();
    expect(arc!.damage).toBe(1);
    expect(arc!.damage).toBe(light.damage);
    expect(arc!.arcDeg).toBe(light.arcDeg);
    expect(arc!.rangeM).toBe(light.rangeM);
    expect(arc!.dirYaw).toBe(pose.yaw);
    expect(arc!.origin.x).toBe(pose.pos.x);
    expect(arc!.origin.z).toBe(pose.pos.z);
  });

  it('active → recover → idle on the tuned timings; hitArc only during active', () => {
    const { combat } = makeCombat();
    combat.tryLight();
    combat.update(light.windupMs);
    combat.update(light.activeMs);
    expect(combat.state).toBe('recover');
    expect(combat.hitArc()).toBeNull();
    combat.update(light.recoverMs - 1);
    expect(combat.state).toBe('recover');
    combat.update(1);
    expect(combat.state).toBe('idle');
  });

  it('a second attack cannot start mid-swing', () => {
    const { combat } = makeCombat();
    combat.tryLight();
    expect(combat.tryLight()).toBe(false); // windup
    expect(combat.tryHeavy()).toBe(false);
    combat.update(light.windupMs);
    expect(combat.tryLight()).toBe(false); // active
    combat.update(light.activeMs);
    expect(combat.tryLight()).toBe(false); // recover
    combat.update(light.recoverMs);
    expect(combat.tryLight()).toBe(true); // idle again
  });

  it('one oversized update carries across the windup boundary into active', () => {
    const { combat } = makeCombat();
    combat.tryLight();
    combat.update(light.windupMs + 10);
    expect(combat.state).toBe('active');
    expect(combat.hitArc()).not.toBeNull();
    combat.update(light.activeMs - 10 + light.recoverMs);
    expect(combat.state).toBe('idle');
  });
});

describe('Combat — heavy attack', () => {
  it('tryHeavy deals damage 2 with heavy timings', () => {
    const { combat } = makeCombat();
    expect(combat.tryHeavy()).toBe(true);
    combat.update(heavy.windupMs - 1);
    expect(combat.state).toBe('windup');
    expect(combat.hitArc()).toBeNull();
    combat.update(1);
    const arc = combat.hitArc();
    expect(arc).not.toBeNull();
    expect(arc!.damage).toBe(2);
    expect(arc!.arcDeg).toBe(heavy.arcDeg);
    expect(arc!.rangeM).toBe(heavy.rangeM);
  });
});

describe('Combat — guard', () => {
  it('tryGuard toggles guard from idle and back; hitArc stays null', () => {
    const { combat } = makeCombat();
    combat.tryGuard(true);
    expect(combat.state).toBe('guard');
    expect(combat.hitArc()).toBeNull();
    combat.tryGuard(false);
    expect(combat.state).toBe('idle');
  });

  it('attacks cannot start from guard (release first)', () => {
    const { combat } = makeCombat();
    combat.tryGuard(true);
    expect(combat.tryLight()).toBe(false);
    expect(combat.tryHeavy()).toBe(false);
  });

  it('frontal hit while guarding blocks and shoves the player back guardShoveM', () => {
    // yaw 0 faces -z; attacker at lower z is dead ahead.
    const { combat, pose } = makeCombat(8, 8, 0);
    combat.tryGuard(true);
    const blocked = combat.blockMelee({ x: 8, z: 6 });
    expect(blocked).toBe(true);
    // Shoved directly away from the attacker (open floor: exact distance).
    expect(pose.pos.x).toBeCloseTo(8, 6);
    expect(pose.pos.z).toBeCloseTo(8 + guardShoveM, 6);
    expect(combat.state).toBe('guard'); // guard holds through the block
  });

  it('a hit from behind is NOT blocked (guard is frontal ±90° only)', () => {
    const { combat, pose } = makeCombat(8, 8, 0);
    combat.tryGuard(true);
    expect(combat.blockMelee({ x: 8, z: 10 })).toBe(false);
    expect(pose.pos.z).toBe(8); // no shove
  });

  it('an exactly-perpendicular attacker still counts as frontal (±90° inclusive)', () => {
    const { combat, pose } = makeCombat(8, 8, 0);
    combat.tryGuard(true);
    expect(combat.blockMelee({ x: 6, z: 8 })).toBe(true);
    expect(pose.pos.x).toBeCloseTo(8 + guardShoveM, 6);
  });

  it('no block when not guarding', () => {
    const { combat, pose } = makeCombat(8, 8, 0);
    expect(combat.blockMelee({ x: 8, z: 6 })).toBe(false);
    expect(pose.pos.z).toBe(8);
  });

  it('the shove resolves through the collider — a wall stops it', () => {
    // Player near the south wall (z=14); shove would land at 14.2 but the
    // collider clamps the circle to 14 - radius.
    const { combat, pose } = makeCombat(8, 13, 0);
    combat.tryGuard(true);
    expect(combat.blockMelee({ x: 8, z: 11 })).toBe(true);
    expect(pose.pos.z).toBeCloseTo(14 - radius, 3);
  });
});

describe('Combat — quick-step', () => {
  it('tryStep dashes stepDistM over stepMs then returns to idle (default backstep)', () => {
    const { combat, pose } = makeCombat(8, 8, 0);
    expect(combat.tryStep()).toBe(true);
    expect(combat.state).toBe('step');
    expect(combat.hitArc()).toBeNull();
    combat.update(stepMs);
    expect(combat.state).toBe('idle');
    // yaw 0 faces -z, so the backstep goes +z.
    expect(pose.pos.x).toBeCloseTo(8, 6);
    expect(pose.pos.z).toBeCloseTo(8 + stepDistM, 4);
  });

  it('displacement is proportional mid-step', () => {
    const { combat, pose } = makeCombat(8, 8, 0);
    combat.tryStep();
    combat.update(stepMs / 2);
    expect(combat.state).toBe('step');
    expect(pose.pos.z).toBeCloseTo(8 + stepDistM / 2, 4);
  });

  it('steps slide against walls — no tunneling', () => {
    const { combat, pose } = makeCombat(8, 13, 0); // backstep into the south wall
    combat.tryStep();
    combat.update(stepMs);
    expect(pose.pos.z).toBeCloseTo(14 - radius, 3);
  });

  it('a custom stepDir provider steers the step', () => {
    const { combat, pose } = makeCombat(8, 8, 0, (out) => {
      out.x = 1;
      out.z = 0;
    });
    combat.tryStep();
    combat.update(stepMs);
    expect(pose.pos.x).toBeCloseTo(8 + stepDistM, 4);
    expect(pose.pos.z).toBeCloseTo(8, 6);
  });

  it('tryStep is rejected mid-swing but allowed from guard', () => {
    const { combat } = makeCombat();
    combat.tryLight();
    expect(combat.tryStep()).toBe(false);
    combat.update(light.windupMs + light.activeMs + light.recoverMs);
    combat.tryGuard(true);
    expect(combat.tryStep()).toBe(true);
    expect(combat.state).toBe('step');
  });
});

describe('Combat — swingId', () => {
  it('increments once per successful attack, never on rejected tries', () => {
    const { combat } = makeCombat();
    const start = combat.swingId;
    combat.tryLight();
    expect(combat.swingId).toBe(start + 1);
    combat.tryLight(); // rejected mid-swing
    expect(combat.swingId).toBe(start + 1);
    combat.update(light.windupMs + light.activeMs + light.recoverMs);
    combat.tryHeavy();
    expect(combat.swingId).toBe(start + 2);
  });
});

describe('inArc — melee hit test', () => {
  const arc: HitArc = { origin: { x: 8, z: 8 }, dirYaw: 0, arcDeg: 70, rangeM: 1.9, damage: 1 };

  it('hits a target straight ahead within range', () => {
    expect(inArc(arc, { x: 8, z: 6.5 }, 0.5)).toBe(true);
  });

  it('misses behind the player', () => {
    expect(inArc(arc, { x: 8, z: 9.5 }, 0.5)).toBe(false);
  });

  it('misses beyond rangeM + target radius, grazes just inside it', () => {
    expect(inArc(arc, { x: 8, z: 8 - (1.9 + 0.5 + 0.01) }, 0.5)).toBe(false);
    expect(inArc(arc, { x: 8, z: 8 - (1.9 + 0.5 - 0.01) }, 0.5)).toBe(true);
  });

  it('respects the half-angle: 30° off-axis hits, 40° misses (70° total arc)', () => {
    const at = (deg: number): Vec2 => {
      const r = (deg * Math.PI) / 180;
      return { x: 8 + Math.sin(r) * 1.5, z: 8 - Math.cos(r) * 1.5 };
    };
    expect(inArc(arc, at(30), 0.5)).toBe(true);
    expect(inArc(arc, at(40), 0.5)).toBe(false);
  });

  it('a target on top of the origin always hits', () => {
    expect(inArc(arc, { x: 8, z: 8 }, 0.5)).toBe(true);
  });
});
