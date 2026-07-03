/**
 * The Hag bargain (Greater Vael Drop 1, Task 5) — a PURE state machine (no
 * three.js, no DOM, no side effects). Encodes spec §6.4's bargain table EXACTLY:
 * each offering's cost (on the ember cap), its boon, and the flag(s) it sets.
 * The function NEVER mutates its input state — every result is a fresh object.
 */
import { describe, it, expect } from 'vitest';
import { TUNING } from '../tuning';
import { offerToHag, restoreEmberCap, zoneVisitFogFarM, FOGLINE_PART_M } from '../hagBargain';
import type { HagState } from '../hagBargain';

const base: HagState = { maxEmberCap: TUNING.brand.maxEmbers, bargains: [] };

describe('offerToHag — the bargain table', () => {
  it('ember tithe lowers the cap by 1 and sets hag-tithed, fogline boon', () => {
    const r = offerToHag('ember', base, false);
    expect(r.state.maxEmberCap).toBe(4);
    expect(r.flagsSet).toEqual(['hag-tithed']);
    expect(r.boon).toEqual({ kind: 'fogline-part' });
    expect(base.maxEmberCap).toBe(5); // input untouched (pure)
  });

  it('ledger requires the ledger; without it, no-op', () => {
    expect(offerToHag('ledger', base, false).boon).toEqual({ kind: 'none' });
    expect(offerToHag('ledger', base, false).flagsSet).toEqual([]);
    expect(offerToHag('ledger', base, true).boon).toEqual({
      kind: 'play-vision',
      visionId: 'gv-vision-hag',
    });
    expect(offerToHag('ledger', base, true).flagsSet).toEqual(['hag-ledger-given']);
  });

  it('ledger given costs no ember (the cap is untouched)', () => {
    const r = offerToHag('ledger', base, true);
    expect(r.state.maxEmberCap).toBe(5);
  });

  it('kneel seeds hag-kneeled with no immediate cost', () => {
    const r = offerToHag('kneel', base, false);
    expect(r.flagsSet).toEqual(['hag-kneeled']);
    expect(r.state.maxEmberCap).toBe(5);
    expect(r.boon).toEqual({ kind: 'answer-watcher' });
  });

  it('decline is a pure no-op', () => {
    expect(offerToHag('decline', base, false)).toMatchObject({
      boon: { kind: 'none' },
      flagsSet: [],
    });
    expect(offerToHag('decline', base, false).state.maxEmberCap).toBe(5);
  });

  it('records each struck bargain in state.bargains (mirrors the save)', () => {
    const tithed = offerToHag('ember', base, false).state;
    expect(tithed.bargains).toEqual(['hag-tithed']);
    // A second bargain on top of the first accumulates (append, never replace).
    const knelt = offerToHag('kneel', tithed, false).state;
    expect(knelt.bargains).toEqual(['hag-tithed', 'hag-kneeled']);
    // ...and never mutates the earlier state.
    expect(tithed.bargains).toEqual(['hag-tithed']);
  });

  it('a tithe on an already-lowered cap keeps dropping (persists for Drop 1)', () => {
    const once = offerToHag('ember', base, false).state;
    const twice = offerToHag('ember', once, false).state;
    expect(twice.maxEmberCap).toBe(3);
  });
});

describe('zoneVisitFogFarM — the fog-line boost applies once per visit (T10 guard)', () => {
  it('adds the boost only in Ashen Forest N (every other zone ignores it)', () => {
    expect(zoneVisitFogFarM({ zone: 'ashen-forest-n', zoneBaseFarM: 16, forestBoostM: FOGLINE_PART_M })).toBe(22);
    // The boon is armed run-wide, but it only opens the forest's own far-plane.
    expect(zoneVisitFogFarM({ zone: 'gate-fields', zoneBaseFarM: 16, forestBoostM: FOGLINE_PART_M })).toBe(16);
    // Unarmed → the plain zone base, in the forest too.
    expect(zoneVisitFogFarM({ zone: 'ashen-forest-n', zoneBaseFarM: 16, forestBoostM: 0 })).toBe(16);
  });

  it('is idempotent under a repeat in-zone tithe (recompute from base, never +=)', () => {
    // main.ts arms forestBoost = FOGLINE_PART_M on the FIRST tithe, then RECOMPUTES
    // baseFogFar from the un-boosted zone base on EVERY tithe. Tithing again in the
    // same visit (reachable here — the threshold lives in this zone) re-arms the
    // same value and re-derives base+6 — it must never accumulate to base+12.
    const zoneBaseFarM = 16;
    let forestBoostM = 0;
    forestBoostM = FOGLINE_PART_M; // 1st tithe arms the boost
    const first = zoneVisitFogFarM({ zone: 'ashen-forest-n', zoneBaseFarM, forestBoostM });
    forestBoostM = FOGLINE_PART_M; // 2nd tithe re-arms (no change) and recomputes
    const second = zoneVisitFogFarM({ zone: 'ashen-forest-n', zoneBaseFarM, forestBoostM });
    expect(first).toBe(22);
    expect(second).toBe(22); // NOT 28 — the +6 never stacks
  });

  it('re-entry recomputes from the base (never carries a doubled far)', () => {
    // enterZone re-derives from the zone base each visit, so leaving and returning
    // with the boost still armed yields base+6, not base+12.
    expect(zoneVisitFogFarM({ zone: 'ashen-forest-n', zoneBaseFarM: 16, forestBoostM: FOGLINE_PART_M })).toBe(22);
  });
});

describe('restoreEmberCap — leaving Greater Vael / the next Vigil', () => {
  it('lifts the cap back to the full brand', () => {
    expect(restoreEmberCap({ maxEmberCap: 4, bargains: ['hag-tithed'] }).maxEmberCap).toBe(
      TUNING.brand.maxEmbers,
    );
  });

  it('keeps the struck bargains and never mutates its input', () => {
    const spent: HagState = { maxEmberCap: 2, bargains: ['hag-tithed', 'hag-kneeled'] };
    const restored = restoreEmberCap(spent);
    expect(restored.bargains).toEqual(['hag-tithed', 'hag-kneeled']);
    expect(spent.maxEmberCap).toBe(2); // input untouched
    expect(restored).not.toBe(spent);
  });
});
