/**
 * Ending resolution (Task 15) — the pure truth table that turns the run's
 * final state into one of the four endings. No renderer, no DOM.
 *
 *   hollow            → 3  (the choice is ignored; the eye never opens)
 *   give + queensBrand → 4  (the secret ending; T16 sets the flag)
 *   give              → 1  (OATH KEPT)
 *   keep              → 2  (OATH BROKEN)
 */
import { describe, it, expect } from 'vitest';
import { selectEnding } from '../endings';

describe('selectEnding — the four-ending truth table', () => {
  it('gives 1 (OATH KEPT) for a lit knight who gives the crown', () => {
    expect(selectEnding({ hollow: false, choice: 'give', hasQueensBrand: false })).toBe(1);
  });

  it('gives 2 (OATH BROKEN) for a lit knight who keeps the crown', () => {
    expect(selectEnding({ hollow: false, choice: 'keep', hasQueensBrand: false })).toBe(2);
  });

  it('gives 3 (HOLLOW) whenever the knight is hollow — choice ignored', () => {
    expect(selectEnding({ hollow: true, choice: null, hasQueensBrand: false })).toBe(3);
    expect(selectEnding({ hollow: true, choice: 'give', hasQueensBrand: false })).toBe(3);
    expect(selectEnding({ hollow: true, choice: 'keep', hasQueensBrand: false })).toBe(3);
    // Hollow dominates even the secret path: a dark brand cannot answer.
    expect(selectEnding({ hollow: true, choice: 'give', hasQueensBrand: true })).toBe(3);
  });

  it('gives 4 (THE FLAME THAT LENDS) for give + the queen’s brand', () => {
    expect(selectEnding({ hollow: false, choice: 'give', hasQueensBrand: true })).toBe(4);
  });

  it('the queen’s brand only matters when the crown is GIVEN, not kept', () => {
    expect(selectEnding({ hollow: false, choice: 'keep', hasQueensBrand: true })).toBe(2);
  });

  it('an undecided lit knight resolves to keep (2) — never reached in the flow', () => {
    // The summit never resolves an ending until the knight has chosen; this is
    // the defensive default (walking away without giving IS keeping).
    expect(selectEnding({ hollow: false, choice: null, hasQueensBrand: false })).toBe(2);
  });
});
