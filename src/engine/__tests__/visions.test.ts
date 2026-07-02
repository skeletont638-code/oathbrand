/**
 * Task 14 — the banner kneel ritual + memory visions.
 *
 * Pure, headless coverage (no three.js / no DOM) of the three moving parts:
 *  - `VisionPlayer` — plays a `VisionDef` once per id (persisted via
 *    `SaveData.visionsSeen`), locks input (`vision` state), steps on fixed
 *    ticks, floods desaturation back toward color then snaps to ash.
 *  - `KneelRitual` — the ~4s uninterruptible checkpoint: input locked, camera
 *    sinks, brand rekindles (which saves), the `motif-kneel` cue fires, and
 *    the zone's enemies RESPAWN (bonfire rule) — never a bare clear. The first
 *    kneel per banner additionally plays that banner's vision.
 *  - `visions.ts` — the six authored visions (real litany captions).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Game } from '../Game';
import { VisionPlayer } from '../VisionPlayer';
import type { VisionDef } from '../VisionPlayer';
import { KneelRitual, KNEEL_SINK_M } from '../../player/Kneel';
import { VISIONS, visionForZone } from '../../content/visions';
import { saveGame, loadGame } from '../../save/save';
import type { SaveData } from '../../save/save';

/** A short two-caption vision: ash → full color → ash. */
const TEST_VISION: VisionDef = {
  id: 'vision-test',
  steps: [
    { desatTo: 0.82, waitMs: 400 },
    { desatTo: 0, caption: 'the flame stood', spawnGhosts: [{ at: [1, 1] }], waitMs: 1000 },
    { desatTo: 0.82, waitMs: 300 },
  ],
};

/** A Game already parked in `playing` (the only legal launch state). */
function playingGame(): Game {
  const g = new Game();
  g.transition('title');
  g.transition('playing');
  return g;
}

interface Spies {
  desat: number[];
  fog: number[];
  ghosts: number; // count of spawnGhosts calls
  cleared: number; // count of clearGhosts calls
  captions: (string | null)[];
  played: string[];
}

function makePlayer(game: Game, seen: string[] = []): { player: VisionPlayer; spies: Spies } {
  const spies: Spies = { desat: [], fog: [], ghosts: 0, cleared: 0, captions: [], played: [] };
  const player = new VisionPlayer({
    game,
    setDesaturation: (v) => spies.desat.push(v),
    setFogFar: (m) => spies.fog.push(m),
    spawnGhosts: () => (spies.ghosts += 1),
    clearGhosts: () => (spies.cleared += 1),
    showCaption: (t) => spies.captions.push(t),
    onPlayed: (id) => spies.played.push(id),
    seenIds: seen,
  });
  return { player, spies };
}

describe('VisionPlayer', () => {
  it('starts inert (inactive, seen only what was seeded)', () => {
    const { player } = makePlayer(playingGame(), ['vision-old']);
    expect(player.active).toBe(false);
    expect(player.hasSeen('vision-old')).toBe(true);
    expect(player.hasSeen('vision-test')).toBe(false);
  });

  it('play() locks input (enters vision state), activates, and emits played once', () => {
    const game = playingGame();
    const { player, spies } = makePlayer(game);
    expect(player.play(TEST_VISION)).toBe(true);
    expect(game.state).toBe('vision'); // input is locked while this runs
    expect(player.active).toBe(true);
    expect(spies.played).toEqual(['vision-test']);
  });

  it('never replays a vision whose id was already seen (persisted)', () => {
    const game = playingGame();
    const { player, spies } = makePlayer(game, ['vision-test']);
    expect(player.play(TEST_VISION)).toBe(false);
    expect(game.state).toBe('playing'); // stays in control — no lock
    expect(player.active).toBe(false);
    expect(spies.played).toEqual([]);
  });

  it('marks the id seen the first time (for the save merge)', () => {
    const { player } = makePlayer(playingGame(), ['vision-old']);
    player.play(TEST_VISION);
    expect([...player.seenIds].sort()).toEqual(['vision-old', 'vision-test']);
  });

  it('advances step-by-step on fixed ticks (waitMs cadence), then returns control', () => {
    const game = playingGame();
    const { player, spies } = makePlayer(game);
    player.play(TEST_VISION);
    expect(player.stepIndex).toBe(0);
    // A tick shorter than step 0's wait keeps us on step 0.
    player.update(200);
    expect(player.stepIndex).toBe(0);
    // Crossing step 0's 400ms wait advances to step 1.
    player.update(300);
    expect(player.stepIndex).toBe(1);
    expect(spies.ghosts).toBe(1); // step 1 spawned ghosts
    expect(spies.captions).toContain('the flame stood');
    // Cross step 1 (1000ms) → step 2, then step 2 (300ms) → finish.
    player.update(1000);
    expect(player.stepIndex).toBe(2);
    expect(player.active).toBe(true);
    player.update(300);
    expect(player.active).toBe(false);
    expect(game.state).toBe('playing'); // control returns
    expect(spies.cleared).toBe(1); // ghosts cleared on end
    expect(spies.captions.at(-1)).toBeNull(); // caption cleared
  });

  it('floods color BACK (desat reverses to 0) then snaps to ash at the end', () => {
    const { player, spies } = makePlayer(playingGame());
    player.play(TEST_VISION);
    expect(spies.desat[0]).toBeCloseTo(0.82, 5); // opens on ash
    player.update(400); // finish step 0, enter step 1 (target 0)
    player.update(1000); // step 1 done — color fully bled back
    const min = Math.min(...spies.desat);
    expect(min).toBeCloseTo(0, 5); // world briefly in full color (past alive)
    player.update(300); // final step snaps back to ash
    expect(spies.desat.at(-1)).toBeCloseTo(0.82, 5);
  });

  it('drives the fog far-plane from steps that set it', () => {
    const vision: VisionDef = {
      id: 'vision-fog',
      steps: [{ desatTo: 0.82, fogFar: 8, waitMs: 300 }, { desatTo: 0, waitMs: 300 }],
    };
    const { player, spies } = makePlayer(playingGame());
    player.play(vision);
    expect(spies.fog).toContain(8);
  });

  it('play() is a no-op while one is already playing', () => {
    const game = playingGame();
    const { player } = makePlayer(game);
    player.play(TEST_VISION);
    expect(player.play({ id: 'vision-other', steps: [{ waitMs: 100 }] })).toBe(false);
  });
});

describe('KneelRitual', () => {
  interface KneelSpies {
    rekindled: string[];
    cues: string[];
    respawns: number;
    enemies: string[]; // a stand-in enemy roster the respawn repopulates
  }

  function makeKneel(game: Game): {
    kneel: KneelRitual;
    player: VisionPlayer;
    spies: KneelSpies;
  } {
    const spies: KneelSpies = { rekindled: [], cues: [], respawns: 0, enemies: ['soldier-a', 'soldier-b'] };
    const { player } = makePlayer(game);
    const kneel = new KneelRitual({
      game,
      brand: { rekindle: (id) => spies.rekindled.push(id) },
      visionPlayer: player,
      emitCue: (id) => spies.cues.push(id),
      respawnEnemies: () => {
        // Bonfire rule: clear-then-respawn — the roster ends REPOPULATED, not empty.
        spies.enemies.length = 0;
        spies.enemies.push('soldier-a', 'soldier-b');
        spies.respawns += 1;
      },
    });
    return { kneel, player, spies };
  }

  it('locks input on start (enters vision state), refuses unless in play', () => {
    const game = playingGame();
    const { kneel } = makeKneel(game);
    expect(kneel.start('great-hall')).toBe(true);
    expect(game.state).toBe('vision');
    // Already active → no re-entry.
    expect(kneel.start('great-hall')).toBe(false);
  });

  it('refuses to start when the game is not playing', () => {
    const game = new Game();
    game.transition('title');
    const { kneel } = makeKneel(game);
    expect(kneel.start('great-hall')).toBe(false);
  });

  it('sinks the camera during the ritual and rises when it ends', () => {
    const game = playingGame();
    const { kneel } = makeKneel(game);
    expect(kneel.camSink).toBe(0);
    kneel.start('great-hall');
    kneel.update(2000); // well past the settle
    expect(kneel.camSink).toBeCloseTo(KNEEL_SINK_M, 5);
    kneel.update(4000); // past the full ritual → control returns
    expect(kneel.active).toBe(false);
    expect(kneel.camSink).toBe(0); // stood back up
  });

  it('rekindles (saves), fires motif-kneel, and RESPAWNS enemies — never a bare clear', () => {
    const game = playingGame();
    const { kneel, spies } = makeKneel(game);
    kneel.start('great-hall');
    kneel.update(2000); // reach the settle beat
    expect(spies.rekindled).toEqual(['great-hall']);
    expect(spies.cues).toEqual(['motif-kneel']);
    expect(spies.respawns).toBe(1);
    // Kneeling mid-combat does not empty the zone: enemies came back.
    expect(spies.enemies).toEqual(['soldier-a', 'soldier-b']);
  });

  it('a plain (no-vision) kneel returns control after the ~4s ritual', () => {
    const game = playingGame();
    const { kneel } = makeKneel(game);
    kneel.start('great-hall');
    kneel.update(1000);
    expect(game.state).toBe('vision'); // still locked mid-ritual
    kneel.update(4000);
    expect(game.state).toBe('playing'); // control returned
    expect(kneel.active).toBe(false);
  });

  it('FIRST kneel plays the banner vision; control returns only after it ends', () => {
    const game = playingGame();
    const { kneel, player, spies } = makeKneel(game);
    expect(kneel.start('great-hall', TEST_VISION)).toBe(true);
    kneel.update(2000); // settle → rekindle → hand off to the vision
    expect(spies.rekindled).toEqual(['great-hall']);
    expect(player.active).toBe(true); // the memory is playing
    expect(game.state).toBe('vision');
    // Drive the vision to completion (0.4 + 1.0 + 0.3s).
    kneel.update(400);
    kneel.update(1000);
    kneel.update(300);
    expect(player.active).toBe(false);
    expect(kneel.active).toBe(false);
    expect(game.state).toBe('playing'); // control returns after the vision
  });

  it('marks the vision SEEN before rekindle saves (so a reload never replays it)', () => {
    const game = playingGame();
    const { player } = makePlayer(game);
    let seenAtSave: boolean | null = null;
    const kneel = new KneelRitual({
      game,
      // The Brand's rekindle is what fires the save in main.ts; at that instant
      // the just-started vision's id MUST already be in visionsSeen.
      brand: { rekindle: () => (seenAtSave = player.hasSeen(TEST_VISION.id)) },
      visionPlayer: player,
      emitCue: () => {},
      respawnEnemies: () => {},
    });
    kneel.start('great-hall', TEST_VISION);
    kneel.update(2000); // cross the settle → play() then rekindle()
    expect(seenAtSave).toBe(true);
  });

  it('a SEEN vision does not replay on a later kneel (no double memory)', () => {
    const game = playingGame();
    const spies = { rekindled: [] as string[], cues: [] as string[], respawns: 0 };
    const { player } = makePlayer(game, ['vision-test']); // already seen
    const kneel = new KneelRitual({
      game,
      brand: { rekindle: (id) => spies.rekindled.push(id) },
      visionPlayer: player,
      emitCue: (id) => spies.cues.push(id),
      respawnEnemies: () => (spies.respawns += 1),
    });
    kneel.start('great-hall', TEST_VISION);
    kneel.update(2000); // settle → rekindle, but no vision (seen)
    expect(spies.rekindled).toEqual(['great-hall']);
    expect(player.active).toBe(false);
    kneel.update(4000);
    expect(game.state).toBe('playing'); // plain ~4s ritual, then control back
  });
});

describe('visions content (src/content/visions.ts)', () => {
  const BANNER_ZONES = ['ashen-gate', 'great-hall', 'undercroft', 'ramparts', 'throne', 'queens-garden'] as const;

  it('authors exactly one vision per banner zone', () => {
    for (const zone of BANNER_ZONES) {
      expect(visionForZone(zone), `vision for ${zone}`).toBeDefined();
    }
    expect(Object.keys(VISIONS).sort()).toEqual([...BANNER_ZONES].sort());
  });

  it('namespaces ids `vision-*` so they never collide with `vista-*`', () => {
    for (const zone of BANNER_ZONES) {
      const v = visionForZone(zone)!;
      expect(v.id).toMatch(/^vision-/);
    }
    const ids = BANNER_ZONES.map((z) => visionForZone(z)!.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it('every vision opens on ash, floods to full color, and snaps back to ash', () => {
    for (const zone of BANNER_ZONES) {
      const v = visionForZone(zone)!;
      const desats = v.steps.map((s) => s.desatTo).filter((d): d is number => d !== undefined);
      expect(v.steps[0].desatTo, `${zone} opens on ash`).toBeGreaterThan(0.5);
      expect(Math.min(...desats), `${zone} reaches full color`).toBeCloseTo(0, 5);
      expect(v.steps.at(-1)!.desatTo, `${zone} ends on ash`).toBeGreaterThan(0.5);
    }
  });

  it('every step waits a positive time and every caption is a real one-line litany', () => {
    for (const zone of BANNER_ZONES) {
      const v = visionForZone(zone)!;
      for (const step of v.steps) {
        expect(step.waitMs).toBeGreaterThan(0);
        if (step.caption !== undefined) {
          expect(step.caption.trim().length).toBeGreaterThan(0);
          expect(step.caption).not.toContain('\n'); // one line each
        }
      }
      // Each vision carries at least one caption (the tragedy beat).
      expect(v.steps.some((s) => s.caption)).toBe(true);
    }
  });
});

describe('visionsSeen save round-trip', () => {
  function makeStorageStub() {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    };
  }

  beforeEach(() => vi.stubGlobal('localStorage', makeStorageStub()));
  afterEach(() => vi.unstubAllGlobals());

  it('persists a seen-vision id set through save → load (reload = no replay)', () => {
    const data: SaveData = {
      version: 1,
      zone: 'great-hall',
      bannerId: 'great-hall',
      embers: 5,
      flags: [],
      endingsSeen: [],
      loreRead: [],
      visionsSeen: ['vista-ashen-gate', 'vision-ashen-gate', 'vision-great-hall'],
      ngPlus: false,
    };
    saveGame(data);
    const back = loadGame();
    expect(back?.visionsSeen).toEqual(data.visionsSeen);
    // A reloaded VisionPlayer seeded from the save refuses to replay.
    const game = playingGame();
    const player = new VisionPlayer({
      game,
      setDesaturation: () => {},
      seenIds: back?.visionsSeen ?? [],
    });
    expect(player.hasSeen('vision-great-hall')).toBe(true);
    expect(player.play({ id: 'vision-great-hall', steps: [{ waitMs: 1 }] })).toBe(false);
  });
});
