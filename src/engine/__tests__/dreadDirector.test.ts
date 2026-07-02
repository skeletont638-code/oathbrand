/**
 * Task 3 — the DreadDirector scheduler ("the engine notices IT").
 *
 * Pure, headless coverage (no three.js / no DOM) of the scare scheduler and
 * every binding rule it MUST enforce (spec §7, TUNING.greaterVael.dread):
 *   1. a single ≥90 s cooldown shared across ALL scare types,
 *   2. no scare ever fires while the player is in combat,
 *   3. activations carry no damage (the type makes it unrepresentable),
 *   4. no code path spoofs the player's banner/kneel,
 *   5. a per-gimmick usage cap (2×/drop),
 *   6. a hard ceiling of 10 fired beats per drop,
 *   7. a false brand-pulse only on the run-seeded clearing crossing,
 *   8. fidelity scarcity — a repeat gimmick is flagged `everSeen`,
 *   9. a Watcher-sighting budget (6/drop).
 *
 * The clock is the `dtMs` the caller feeds `update`; randomness is the injected
 * `rng` — so the whole thing is deterministic under a scripted rng + fake clock.
 */
import { describe, it, expect } from 'vitest';
import { DreadDirector } from '../DreadDirector';
import type { DreadCtx } from '../DreadDirector';
import type { ScareBeat } from '../../world/zoneDef';
import { TUNING } from '../../content/tuning';

const D = TUNING.greaterVael.dread;

/** The brief's two hand-built beats: an approach silence-spike + a seeded false-pulse. */
const beats: ScareBeat[] = [
  { id: 'A', zone: 'gate-fields', trigger: { on: 'approach', at: [9, 3], withinM: 3 }, gimmick: 'silence-spike', oneLine: 'x' },
  { id: 'B', zone: 'gate-fields', trigger: { on: 'seededClearing', cells: [[6, 7]] }, gimmick: 'false-pulse', oneLine: 'y' },
];

/** A DreadCtx factory (defaults: exterior, no combat, no events). */
function ctx(cell: [number, number], over: Partial<DreadCtx> = {}): DreadCtx {
  return {
    zone: 'gate-fields', cell, dtMs: 16, inCombat: false, brandPulse: 0,
    events: { kind: 'none' }, ...over,
  };
}

/** Move to a neutral cell AND burn the full shared cooldown in one step. */
function cooldownOut(d: DreadDirector): void {
  d.update(ctx([9, 9], { dtMs: D.minScareGapSec * 1000 + 1000 }));
}

describe('DreadDirector — scheduling rules', () => {
  it('fires A on approach, then holds the 90s cooldown', () => {
    const d = new DreadDirector(beats, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    const near = ctx([9, 3]);
    expect(d.update(near).map((a) => a.kind)).toEqual(['silence-spike']);
    expect(d.cooldownRemainingSec).toBeCloseTo(90);
    expect(d.update(near)).toEqual([]); // still cooling
  });

  it('never fires in combat, and does not consume the cooldown', () => {
    const d = new DreadDirector(beats, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    expect(d.update(ctx([9, 3], { inCombat: true }))).toEqual([]);
    expect(d.cooldownRemainingSec).toBe(0); // suppressed, not consumed
  });

  it('activations carry no damage field (a damaging scare is unrepresentable)', () => {
    const d = new DreadDirector(beats, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    const [a] = d.update(ctx([9, 3]));
    expect(a).toBeDefined();
    expect(Object.keys(a)).not.toContain('damage');
  });

  it('caps each gimmick at 2 and never exceeds 10 beats per drop', () => {
    const desat: ScareBeat[] = [1, 2, 3].map((n) => ({
      id: `D${n}`, zone: 'gate-fields',
      trigger: { on: 'cellEnter', cells: [[n, n]] as [number, number][] },
      gimmick: 'desaturation', oneLine: String(n),
    }));
    const d = new DreadDirector(desat, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    d.update(ctx([0, 0]));                                             // establish baseline
    expect(d.update(ctx([1, 1])).map((a) => a.kind)).toEqual(['desaturation']); // D1
    cooldownOut(d);
    expect(d.update(ctx([2, 2])).map((a) => a.kind)).toEqual(['desaturation']); // D2 (use 2/2)
    cooldownOut(d);
    expect(d.update(ctx([3, 3]))).toEqual([]);                        // D3 suppressed by cap
    expect(d.beatsFired).toBe(2);
    expect(d.beatsFired).toBeLessThanOrEqual(D.maxBeatsPerDrop);
  });

  it('flags a repeat gimmick everSeen; a first fire is not everSeen', () => {
    const desat: ScareBeat[] = [1, 2].map((n) => ({
      id: `D${n}`, zone: 'gate-fields',
      trigger: { on: 'cellEnter', cells: [[n, n]] as [number, number][] },
      gimmick: 'desaturation', oneLine: String(n),
    }));
    const d = new DreadDirector(desat, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    d.update(ctx([0, 0]));
    const [first] = d.update(ctx([1, 1]));
    expect(first.kind).toBe('desaturation');
    expect((first as { everSeen?: boolean }).everSeen).toBe(false);
    cooldownOut(d);
    const [second] = d.update(ctx([2, 2]));
    expect((second as { everSeen?: boolean }).everSeen).toBe(true);
    expect(d.snapshot().glitchSeen).toContain('desaturation');
  });

  it('honours glitchSeen seeded from a prior save (everSeen true on the first fire)', () => {
    const desat: ScareBeat[] = [{
      id: 'D1', zone: 'gate-fields',
      trigger: { on: 'cellEnter', cells: [[1, 1]] }, gimmick: 'desaturation', oneLine: '1',
    }];
    const d = new DreadDirector(desat, [], undefined, { glitchSeen: ['desaturation'], watcherSightings: 0 }, () => 0);
    d.update(ctx([0, 0]));
    const [a] = d.update(ctx([1, 1]));
    expect((a as { everSeen?: boolean }).everSeen).toBe(true);
  });

  it('fires the false-pulse only on the seeded clearing crossing', () => {
    // rng 0.5 → the middle of a 3-visit window → target crossing 2.
    const d = new DreadDirector([beats[1]], [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0.5);
    d.update(ctx([0, 0]));                              // baseline
    expect(d.update(ctx([6, 7]))).toEqual([]);          // crossing 1 — not the seed
    cooldownOut(d);
    expect(d.update(ctx([6, 7])).map((a) => a.kind)).toEqual(['false-pulse']); // crossing 2 — fires
    cooldownOut(d);
    expect(d.update(ctx([6, 7]))).toEqual([]);          // crossing 3 — not the seed
    expect(d.beatsFired).toBe(1);                        // ≤ falsePulsePerZoneMax
  });

  it('increments Watcher sightings and caps them at 6', () => {
    const watchers: ScareBeat[] = Array.from({ length: 7 }, (_, i) => ({
      id: `W${i}`, zone: 'gate-fields',
      trigger: { on: 'cellEnter', cells: [[i, 0]] as [number, number][] },
      gimmick: 'watcher', oneLine: 'w',
    }));
    const d = new DreadDirector(watchers, [[3, 3]], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    for (let i = 0; i < 7; i++) {
      cooldownOut(d);            // neutral cell + full cooldown between each
      d.update(ctx([i, 0]));     // crossing into Wi's cell
    }
    expect(d.watcherSightings).toBe(D.watcherPerDropMax); // 6, not 7
    expect(d.snapshot().watcherSightings).toBe(6);
  });

  it('a showsWatcher beat returns BOTH its gimmick and a watcher, once', () => {
    const beat: ScareBeat[] = [{
      id: 'AF-2', zone: 'gate-fields',
      trigger: { on: 'cellEnter', cells: [[4, 4]] }, gimmick: 'snap-grid', showsWatcher: true, oneLine: 'z',
    }];
    const d = new DreadDirector(beat, [[2, 2]], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    d.update(ctx([0, 0]));
    const out = d.update(ctx([4, 4]));
    expect(out.map((a) => a.kind).sort()).toEqual(['snap-grid', 'watcher']);
    expect(d.watcherSightings).toBe(1);
    expect(d.beatsFired).toBe(1); // one beat, even though two entries returned
  });

  it('fires a timer beat only after minSec of dwell near its spot', () => {
    const timer: ScareBeat[] = [{
      id: 'T', zone: 'gate-fields',
      trigger: { on: 'timer', at: [5, 5], minSec: 2 }, gimmick: 'snap-grid', oneLine: 't',
    }];
    const d = new DreadDirector(timer, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    // Standing near [5,5] but only 1s in → not yet.
    expect(d.update(ctx([5, 5], { dtMs: 1000 }))).toEqual([]);
    // Another 1s (2s total) → fires.
    expect(d.update(ctx([5, 5], { dtMs: 1000 })).map((a) => a.kind)).toEqual(['snap-grid']);
  });

  it('glimpses the Hag on crossing her threshold (consuming the shared cooldown)', () => {
    const hag = { at: [8, 8] as [number, number], glimpseCells: [[8, 8]] as [number, number][] };
    const d = new DreadDirector([], [], hag, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    d.update(ctx([0, 0]));                                  // baseline (not on the threshold)
    expect(d.update(ctx([8, 8])).map((a) => a.kind)).toEqual(['hag-glimpse']);
    expect(d.cooldownRemainingSec).toBeCloseTo(90);        // rule 1: it consumes the cooldown
    expect(d.beatsFired).toBe(0);                           // a threshold glimpse is not a beat
  });

  it('only evaluates beats belonging to the current zone', () => {
    const cross: ScareBeat[] = [{
      id: 'X', zone: 'ashen-forest-n',
      trigger: { on: 'approach', at: [9, 3], withinM: 3 }, gimmick: 'desaturation', oneLine: 'q',
    }];
    const d = new DreadDirector(cross, [], undefined, { glitchSeen: [], watcherSightings: 0 }, () => 0);
    expect(d.update(ctx([9, 3]))).toEqual([]);            // wrong zone → inert
    expect(d.update(ctx([9, 3], { zone: 'ashen-forest-n' })).map((a) => a.kind)).toEqual(['desaturation']);
  });
});
