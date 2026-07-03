/**
 * The Watcher (Greater Vael Drop 1, Task 5) — a never-killable, never-
 * approaching PRESENCE (not an Enemy). Headless FSM coverage of the binding
 * rules the spec pins:
 *   - it manifests ONLY at authored anchors, counting a sighting;
 *   - it is FROZEN while observed — it teleport-repositions ONLY when the
 *     player is NOT looking (never seen mid-stride);
 *   - it despawns the instant the player closes within despawnM;
 *   - it auto-recedes after maxVisibleSec;
 *   - the per-drop sighting budget (watcherPerDropMax) is respected + clamped.
 * The `view` (a frustum test) is injected as a stub — no three.js, no DOM.
 */
import { describe, it, expect } from 'vitest';
import { TUNING } from '../../content/tuning';
import { WatcherPresence } from '../WatcherPresence';
import type { ViewTest } from '../WatcherPresence';
import type { GridPos } from '../../world/zoneDef';

const W = TUNING.greaterVael.watcher;
const D = TUNING.greaterVael.dread;
const CELL = 2;

/** Two far backdrop anchors, well apart so a reposition is unambiguous. */
const ANCHORS: GridPos[] = [
  [1, 40],
  [1, 1],
];

const SEEN: ViewTest = { contains: () => true }; // inside the frustum → frozen
const UNSEEN: ViewTest = { contains: () => false }; // off-screen → repositionable

/** A player position far from every anchor (so despawn never trips). */
const FAR = { x: 9999, z: 9999 };

describe('WatcherPresence — the thing at the fog-line', () => {
  it('manifest raises it at the anchor and counts a sighting', () => {
    const w = new WatcherPresence(ANCHORS, CELL, 0);
    expect(w.state).toBe('absent');
    expect(w.present).toBe(false);
    expect(w.visibleSightings).toBe(0);

    w.manifest(ANCHORS[0]);
    expect(w.state).toBe('manifest');
    expect(w.present).toBe(true);
    expect(w.cell).toEqual(ANCHORS[0]);
    expect(w.visibleSightings).toBe(1);
  });

  it('teleport-repositions ONLY while unobserved (never seen mid-stride)', () => {
    const w = new WatcherPresence(ANCHORS, CELL, 0);
    w.manifest(ANCHORS[0]);
    // Observed + far: frozen. The anchor never changes under your gaze.
    w.update(16, FAR, SEEN);
    expect(w.state).toBe('manifest');
    expect(w.cell).toEqual(ANCHORS[0]);
    // Look away: it has moved when you look back.
    w.update(16, FAR, UNSEEN);
    expect(w.cell).toEqual(ANCHORS[1]);
  });

  it('steps ONCE per look-away (an edge, not a per-frame cycle)', () => {
    const w = new WatcherPresence(ANCHORS, CELL, 0);
    w.manifest(ANCHORS[0]);
    w.update(16, FAR, SEEN); // gaze lands on it
    w.update(16, FAR, UNSEEN); // gaze leaves → ONE deliberate step
    expect(w.cell).toEqual(ANCHORS[1]);
    // Staying unobserved does NOT keep it cycling anchors frame by frame.
    w.update(16, FAR, UNSEEN);
    w.update(16, FAR, UNSEEN);
    expect(w.cell).toEqual(ANCHORS[1]);
    // Look back, look away again → the next single step.
    w.update(16, FAR, SEEN);
    w.update(16, FAR, UNSEEN);
    expect(w.cell).toEqual(ANCHORS[0]);
  });

  it('dismiss() drops it to absent without refunding the sighting', () => {
    const w = new WatcherPresence(ANCHORS, CELL, 0);
    w.manifest(ANCHORS[0]);
    expect(w.visibleSightings).toBe(1);
    w.dismiss();
    expect(w.state).toBe('absent');
    expect(w.present).toBe(false);
    expect(w.visibleSightings).toBe(1); // spent stays spent
  });

  it('never steps toward the player — it only ever stands on an anchor', () => {
    const w = new WatcherPresence(ANCHORS, CELL, 0);
    w.manifest(ANCHORS[0]);
    for (let i = 0; i < 6 && w.state === 'manifest'; i += 1) {
      w.update(16, FAR, UNSEEN);
      if (w.state !== 'manifest') break;
      const onAnchor = ANCHORS.some(([r, c]) => r === w.cell[0] && c === w.cell[1]);
      expect(onAnchor).toBe(true);
    }
  });

  it('despawns (absent) the instant the player closes within despawnM', () => {
    const w = new WatcherPresence(ANCHORS, CELL, 0);
    w.manifest(ANCHORS[0]);
    const wp = w.worldPos();
    const near = { x: wp.x + (W.despawnM - 1), z: wp.z }; // inside the recede ring
    w.update(16, near, SEEN); // despawn wins even while observed
    expect(w.state).toBe('absent');
    expect(w.present).toBe(false);
  });

  it('auto-recedes after maxVisibleSec, even observed and far', () => {
    const w = new WatcherPresence(ANCHORS, CELL, 0);
    w.manifest(ANCHORS[0]);
    const ticks = Math.ceil((W.maxVisibleSec * 1000) / 16) + 1;
    for (let i = 0; i < ticks && w.state === 'manifest'; i += 1) w.update(16, FAR, SEEN);
    expect(w.state).toBe('absent');
  });

  it('respects a passed-in sighting count and never exceeds the per-drop budget', () => {
    const maxed = new WatcherPresence(ANCHORS, CELL, D.watcherPerDropMax);
    expect(maxed.visibleSightings).toBe(D.watcherPerDropMax);
    maxed.manifest(ANCHORS[0]);
    expect(maxed.visibleSightings).toBe(D.watcherPerDropMax); // clamped — never 7

    const partial = new WatcherPresence(ANCHORS, CELL, 3);
    expect(partial.visibleSightings).toBe(3);
    partial.manifest(ANCHORS[0]);
    expect(partial.visibleSightings).toBe(4);
  });

  it('setAnchors re-scopes reposition to the active zone (no cross-zone wander, T5 review)', () => {
    // Enter zone A, then re-scope to zone B's anchors: a reposition can only land
    // on a B anchor, never zone A's old backdrop cell.
    const w = new WatcherPresence([[1, 40]], CELL, 0); // zone A anchor
    const zoneB: GridPos[] = [[2, 2], [3, 3]];
    w.setAnchors(zoneB); // enter zone B
    w.manifest(zoneB[0]);
    w.update(16, FAR, SEEN); // gaze lands
    w.update(16, FAR, UNSEEN); // gaze leaves → one deliberate step
    const onZoneB = zoneB.some(([r, c]) => r === w.cell[0] && c === w.cell[1]);
    expect(onZoneB).toBe(true);
    expect(w.cell).not.toEqual([1, 40]); // never zone A's anchor
  });

  it('is not a combat entity — it has no takeHit / hp surface', () => {
    const w = new WatcherPresence(ANCHORS, CELL, 0);
    expect((w as unknown as { takeHit?: unknown }).takeHit).toBeUndefined();
    expect((w as unknown as { hp?: unknown }).hp).toBeUndefined();
  });
});
