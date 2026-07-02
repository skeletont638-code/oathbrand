/**
 * The Hag bargain (Greater Vael Drop 1, Task 5) — a PURE state machine (no
 * three.js, no DOM, no side effects). Encodes spec §6.4's bargain table EXACTLY:
 * each offering's cost (on the ember cap), its boon, and the flag(s) it sets.
 * The function NEVER mutates its input state — every result is a fresh object.
 */
import { describe, it, expect } from 'vitest';
import { TUNING } from '../tuning';
import { offerToHag, restoreEmberCap } from '../hagBargain';
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
