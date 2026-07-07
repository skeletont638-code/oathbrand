/**
 * Echo-scene CONTENT validation (world-expansion v1.2, Task 9). The engine math
 * is covered by `src/engine/__tests__/echoScene.test.ts`; THIS suite validates
 * the seven authored scenes as DATA against the live ZoneDefs and the story arc:
 *
 *   • exactly the seven canonical ids (spec §5), unique;
 *   • every scene plays in a REAL, registered zone;
 *   • every trigger / actor / keyframe cell is in-bounds AND walkable;
 *   • durations sit in the engine's 10–20 s window and acts match the id prefix;
 *   • trigger cells stay inside the reserved staging blocks earlier tasks locked
 *     (tower roof / manor hearth / nave aisle / gallery dais);
 *   • each act is carried by ≥2 zones' inscriptions (the arc reads in stone too);
 *   • the banner-kneel whisper rotates by the banner zone's act.
 *
 * A typo'd cell, a scene in an unbuilt zone, a duration the fade envelope can't
 * hold, or an act that loses its second inscription-carrier fails HERE.
 */
import { describe, it, expect, vi } from 'vitest';
import { ECHOES, bannerMemoryLine } from '../index';
import { EchoSceneSystem, ECHO_PEAK_OPACITY } from '../../../engine/EchoScene';
import type { EchoSceneDef } from '../../../engine/EchoScene';
import type { GridPos, ZoneDef } from '../../../world/zoneDef';
import type { ZoneId } from '../../types';
import { ZONES } from '../../zones';
import { LORE } from '../../lore';

/** The seven scenes the phase's narrative payoff is built from (spec §5). */
const CANONICAL_IDS = [
  'act1-oath',
  'act1-muster',
  'act2-betrayal',
  'act2-burning',
  'act2-queens-walk',
  'act3-king-hollows',
  'act3-crown-down',
] as const;

/** The staging blocks earlier tasks reserved (kept prop-free + test-locked); a
 *  scene in one of these zones must arm ONLY from cells inside its block. */
const RESERVED_BLOCK: Partial<Record<string, GridPos[]>> = {
  watchtower: [[2, 2], [2, 3], [3, 2], [3, 3]],
  // Task 15: the burning echo stages on the merged `burnt-manor` hearth block
  // (the manor-ground + manor-upper floor-zones are one continuous climb now).
  'burnt-manor': [[6, 3], [6, 4], [7, 3], [7, 4]],
  'chapel-nave': [[4, 3], [5, 3], [6, 3], [7, 3]],
  // Task 14: the king-hollows echo moved onto the Great Hall gallery mezzanine
  // (the Hall Gallery merged into great-hall); the dais rides the overlook rail.
  'great-hall': [[3, 20], [3, 21], [4, 20], [4, 21]],
};

/** Grid char at [row, col]; undefined when out of bounds. */
function charAt(def: ZoneDef, [row, col]: GridPos): string | undefined {
  return def.grid[row]?.[col];
}

/** Any walkable cell (floor, spawn, banner, door digit, or a zone letter mapped
 *  to floor). Mirrors the helper in zones.test.ts. Void (`~`) and walls fail. */
function isWalkable(def: ZoneDef, at: GridPos): boolean {
  const ch = charAt(def, at);
  if (ch === undefined) return false;
  if ('.SBD'.includes(ch) || (ch >= '1' && ch <= '9')) return true;
  return def.tiles[ch] === 'floor';
}

/** Every cell an actor occupies across the scene: its base `at` + each keyframe
 *  `at` (facing-only keyframes contribute no new cell). */
function actorCells(scene: EchoSceneDef): GridPos[] {
  const cells: GridPos[] = [];
  for (const actor of scene.actors) {
    cells.push(actor.at);
    for (const kf of actor.keyframes ?? []) if (kf.at) cells.push(kf.at);
  }
  return cells;
}

function sameCell(a: GridPos, b: GridPos): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

describe('echo-scene registry — the seven scenes (Task 9)', () => {
  it('registers exactly the seven canonical scenes, ids unique', () => {
    const ids = ECHOES.map((s) => s.id);
    expect(ids).toHaveLength(CANONICAL_IDS.length);
    expect(new Set(ids).size).toBe(ids.length); // unique
    expect(new Set(ids)).toEqual(new Set(CANONICAL_IDS));
  });

  it('every scene plays in a REAL, registered zone', () => {
    for (const scene of ECHOES) {
      expect(ZONES[scene.zone as ZoneId], `${scene.id} → zone "${scene.zone}"`).toBeDefined();
    }
  });

  it('3–8 actors, duration in the 10–20 s envelope, act matches the id prefix', () => {
    for (const scene of ECHOES) {
      expect(scene.actors.length, `${scene.id} actor count`).toBeGreaterThanOrEqual(3);
      expect(scene.actors.length, `${scene.id} actor count`).toBeLessThanOrEqual(8);
      expect(scene.durationMs, `${scene.id} duration`).toBeGreaterThanOrEqual(10000);
      expect(scene.durationMs, `${scene.id} duration`).toBeLessThanOrEqual(20000);
      expect(`act${scene.act}-`, `${scene.id} act prefix`).toBe(scene.id.slice(0, 5));
    }
  });
});

describe('echo-scene cells — in-bounds + walkable against the live ZoneDefs', () => {
  for (const scene of ECHOES) {
    it(`${scene.id}: every trigger cell is walkable`, () => {
      const def = ZONES[scene.zone as ZoneId] as ZoneDef;
      expect(scene.triggerCells.length).toBeGreaterThan(0);
      for (const cell of scene.triggerCells) {
        expect(isWalkable(def, cell), `${scene.id} trigger ${String(cell)}`).toBe(true);
      }
    });

    it(`${scene.id}: every actor + keyframe cell is walkable`, () => {
      const def = ZONES[scene.zone as ZoneId] as ZoneDef;
      for (const cell of actorCells(scene)) {
        expect(isWalkable(def, cell), `${scene.id} actor cell ${String(cell)}`).toBe(true);
      }
    });
  }
});

describe('echo-scene triggers — inside the reserved staging blocks', () => {
  it('trigger cells stay within the block earlier tasks reserved', () => {
    for (const scene of ECHOES) {
      const block = RESERVED_BLOCK[scene.zone];
      if (!block) continue; // ashen-gate / gate-fields / undercroft have no fixed block
      for (const cell of scene.triggerCells) {
        expect(
          block.some((b) => sameCell(b, cell)),
          `${scene.id} trigger ${String(cell)} must be in the reserved block`,
        ).toBe(true);
      }
    }
  });
});

describe('the three-act arc — each act carried by ≥2 zones in stone', () => {
  const zoneEntries = Object.entries(ZONES) as [ZoneId, ZoneDef][];

  it('every scene act is also carried by ≥2 zones of inscriptions', () => {
    for (const act of [1, 2, 3] as const) {
      const prefix = `act${act}-`;
      // The scene itself references a real inscription-carrying arc.
      expect(ECHOES.some((s) => s.act === act), `act ${act} has a scene`).toBe(true);
      const carriers = new Set<ZoneId>();
      for (const [zid, def] of zoneEntries) {
        if ((def.lore ?? []).some((l) => l.id.startsWith(prefix))) carriers.add(zid);
      }
      expect(carriers.size, `act ${act} inscription carriers: ${[...carriers].join(', ')}`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('every placed act-inscription id resolves to a real LORE entry', () => {
    for (const [, def] of zoneEntries) {
      for (const spot of def.lore ?? []) {
        if (/^act[123]-/.test(spot.id)) {
          expect(LORE[spot.id], `placed inscription ${spot.id}`).toBeDefined();
        }
      }
    }
  });
});

describe('end-to-end — each scene fires through the real EchoSceneSystem', () => {
  for (const scene of ECHOES) {
    it(`${scene.id}: arms in its zone, fires on its trigger, raises its actors, holds control`, () => {
      const onWitness = vi.fn();
      const brandPulse = vi.fn();
      const sys = new EchoSceneSystem(ECHOES, { witnessed: new Set(), onWitness, brandPulse });
      sys.enterZone(scene.zone);

      // Standing off every trigger cell: dormant, no witness, no pulse.
      sys.update(16, [-1, -1]);
      expect(sys.activeActors()).toEqual([]);
      expect(onWitness).not.toHaveBeenCalled();

      // Step onto the first trigger cell → this scene (and only this one) fires.
      sys.update(16, scene.triggerCells[0]);
      expect(onWitness).toHaveBeenCalledExactlyOnceWith(scene.id);

      // Mid-scene: every authored actor is a live apparition, at peak opacity,
      // with finite world coordinates — and the brand is pulsing (never control).
      sys.update(scene.durationMs / 2, scene.triggerCells[0]);
      const live = sys.activeActors();
      expect(live).toHaveLength(scene.actors.length);
      for (const a of live) {
        expect(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(a.facing)).toBe(true);
        expect(a.opacity).toBeGreaterThan(0);
        expect(a.opacity).toBeLessThanOrEqual(ECHO_PEAK_OPACITY + 1e-9);
      }

      // Runs out, and never re-fires this run.
      sys.update(scene.durationMs, scene.triggerCells[0]);
      expect(sys.activeActors()).toEqual([]);
      sys.update(16, scene.triggerCells[0]);
      expect(onWitness).toHaveBeenCalledTimes(1);
    });
  }
});

describe('banner-kneel whisper — rotates by the banner zone act', () => {
  it('the three banner+scene zones each whisper their act, one line apiece', () => {
    const fields = bannerMemoryLine('gate-fields');
    const gate = bannerMemoryLine('ashen-gate');
    const crypt = bannerMemoryLine('undercroft');
    for (const [zone, line] of [['gate-fields', fields], ['ashen-gate', gate], ['undercroft', crypt]] as const) {
      expect(line, `${zone} whisper`).toBeTruthy();
      expect((line as string).length, `${zone} whisper length`).toBeGreaterThan(20);
      // The whisper only fires where a banner AND a scene coincide.
      expect((ZONES[zone] as ZoneDef).banner, `${zone} has a banner`).toBeDefined();
    }
    // One distinct line per act (three acts ⇒ three lines).
    expect(new Set([fields, gate, crypt]).size).toBe(3);
  });

  it('the Great Hall now carries act III (the king-hollows echo merged in, Task 14)', () => {
    // Task 14 folded the king-hollows echo into the Great Hall (the gallery is a
    // mezzanine now), so the hub banner whispers the Act-III forgetting that
    // stages above it. It shares the Act-III line with the Undercroft.
    expect(bannerMemoryLine('great-hall')).toBe(bannerMemoryLine('undercroft'));
    expect(bannerMemoryLine('great-hall')).toBeTruthy();
  });

  it('a zone with no echo scene stays silent (undefined)', () => {
    expect(bannerMemoryLine('summit')).toBeUndefined(); // has no scene
    expect(bannerMemoryLine('not-a-zone')).toBeUndefined();
  });
});
