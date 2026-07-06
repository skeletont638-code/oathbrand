/**
 * Task 13 — the story systems. Content + the pure logic that drives the
 * inscription overlay, the Ash-Priest dialogues, and the ending-track gate.
 * All headless: no DOM, no renderer. The zone-placement bijection (every
 * LoreSpot resolves; no orphaned base entry) is enforced in zones.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { LORE } from '../lore';
import type { LoreEntry } from '../lore';
import { endingPending } from '../endings';
import type { EndingTrack } from '../endings';
import {
  DIALOGUE,
  DialogueRunner,
  SPEAKER_ASH_PRIEST,
  dialogueSequence,
} from '../dialogue';
import type { DialogueId, DialogueLine } from '../dialogue';
import type { GameFlag } from '../types';
import { markRead, typedChars } from '../../ui/inscription';

const loreEntries = Object.entries(LORE) as [string, LoreEntry][];
const base = loreEntries.filter(([, e]) => !e.ngOnly);
const ng = loreEntries.filter(([, e]) => e.ngOnly);

describe('LORE content', () => {
  it('writes 50 placed base inscriptions + 8 NG+ inscriptions (58 total)', () => {
    // 25 castle-campaign base entries + the 5 Gate Fields inscriptions (Task 9)
    // + the 5 Ashen Forest N inscriptions (Task 10) + the 5 Cinder Village
    // inscriptions (Task 11) + the 4 Pilgrim's Descent inscriptions (Task 12)
    // + the 6 forward-dread inscriptions (P4 dread pass) — the lore now warns,
    // not only mourns.
    expect(base.length).toBe(50);
    expect(ng.length).toBe(8);
    expect(loreEntries.length).toBe(58);
  });

  it('every entry has a real title and body (no leftover placeholders)', () => {
    for (const [id, e] of loreEntries) {
      expect(e.title.trim().length, `${id} title`).toBeGreaterThan(0);
      expect(e.body.trim().length, `${id} body`).toBeGreaterThan(0);
      expect(e.body, `${id} still a placeholder`).not.toMatch(/T13|real content|placeholder/i);
    }
  });

  it('every id is unique (Record keys, so trivially — guards a paste error)', () => {
    expect(new Set(loreEntries.map(([id]) => id)).size).toBe(loreEntries.length);
  });
});

describe('endingPending — the four-track truth table (T16)', () => {
  const flags = (...f: GameFlag[]): Set<GameFlag> => new Set(f);

  it('a hollow brand is always track 3, whatever else is carried', () => {
    expect(endingPending(flags(), true)).toBe(3);
    // Hollow dominates even the secret Queen's-Brand path — a dark brand cannot answer.
    expect(endingPending(flags('gatekey', 'queens-brand', 'ng-plus'), true)).toBe(3);
  });

  it('an unhollowed run is track 1 (kept course) by default', () => {
    expect(endingPending(flags(), false)).toBe(1);
  });

  it('carrying the queen’s brand routes an unhollowed run to track 4 (T16)', () => {
    expect(endingPending(flags('queens-brand'), false)).toBe(4);
    expect(endingPending(flags('queens-brand', 'garden-found', 'ng-plus'), false)).toBe(4);
  });

  it('ordinary progress flags leave an unhollowed run on track 1', () => {
    const combos: GameFlag[][] = [
      ['gatekey'],
      ['shortcut-open'],
      ['gatekey', 'forsworn-dead'],
      ['garden-found', 'ng-plus'], // in the garden, but the brand not yet taken
    ];
    for (const c of combos) expect(endingPending(flags(...c), false)).toBe(1);
  });

  it('never returns track 2 for any current input (give-vs-keep is a live choice)', () => {
    const all: GameFlag[] = [
      'gatekey',
      'shortcut-open',
      'throne-open',
      'forsworn-dead',
      'forsworn-noguard',
      'queens-brand',
      'garden-found',
      'ng-plus',
      'callun-tachi',
      'wraith-hunt-done',
    ];
    for (const hollow of [false, true]) {
      expect([1, 2, 3, 4]).toContain(endingPending(new Set(all), hollow));
      expect(endingPending(new Set(all), hollow)).not.toBe(2);
    }
  });
});

describe('Ash-Priest dialogue', () => {
  const both: ('ashpriest-1' | 'ashpriest-2')[] = ['ashpriest-1', 'ashpriest-2'];

  it('encounters 1 and 2 are 4–7 lines, all spoken by the Ash-Priest', () => {
    for (const id of both) {
      const lines = DIALOGUE[id];
      expect(lines.length, `${id} length`).toBeGreaterThanOrEqual(4);
      expect(lines.length, `${id} length`).toBeLessThanOrEqual(7);
      for (const l of lines) {
        expect(l.speaker).toBe(SPEAKER_ASH_PRIEST);
        expect(l.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('dialogueSequence returns the static sequence for encounters 1 and 2', () => {
    for (const id of both) {
      expect(dialogueSequence(id, new Set(), false)).toEqual(DIALOGUE[id]);
    }
  });

  it('encounter 3 is 4–7 lines and its final line varies by ending track', () => {
    const kept = dialogueSequence('ashpriest-3', new Set(), false); // track 1
    const hollow = dialogueSequence('ashpriest-3', new Set(), true); // track 3
    for (const seq of [kept, hollow]) {
      expect(seq.length).toBeGreaterThanOrEqual(4);
      expect(seq.length).toBeLessThanOrEqual(7);
      for (const l of seq) expect(l.speaker).toBe(SPEAKER_ASH_PRIEST);
    }
    // Same lead-in, different last word.
    expect(kept.slice(0, -1)).toEqual(hollow.slice(0, -1));
    const lastKept = kept[kept.length - 1].text;
    const lastHollow = hollow[hollow.length - 1].text;
    expect(lastKept).not.toBe(lastHollow);
  });

  it('the varying final line matches endingPending for each track', () => {
    const seqFor = (flags: Set<GameFlag>, h: boolean): DialogueLine =>
      dialogueSequence('ashpriest-3', flags, h).slice(-1)[0];
    const t1 = seqFor(new Set(), false);
    const t3 = seqFor(new Set(), true);
    const trackOf: EndingTrack = endingPending(new Set(), false);
    expect(trackOf).toBe(1);
    expect(t1).not.toEqual(t3);
  });
});

describe('DialogueRunner advance logic', () => {
  const lines: DialogueLine[] = [
    { speaker: SPEAKER_ASH_PRIEST, text: 'one' },
    { speaker: SPEAKER_ASH_PRIEST, text: 'two' },
    { speaker: SPEAKER_ASH_PRIEST, text: 'three' },
  ];

  it('starts on the first line, not done', () => {
    const r = new DialogueRunner(lines);
    expect(r.index).toBe(0);
    expect(r.current).toEqual(lines[0]);
    expect(r.done).toBe(false);
  });

  it('advance walks the sequence and reports when it just finished', () => {
    const r = new DialogueRunner(lines);
    expect(r.advance()).toBe(true); // → line 1 (two)
    expect(r.current).toEqual(lines[1]);
    expect(r.advance()).toBe(true); // → line 2 (three)
    expect(r.current).toEqual(lines[2]);
    expect(r.advance()).toBe(false); // past the end → finished
    expect(r.done).toBe(true);
    expect(r.current).toBeUndefined();
  });

  it('an id round-trips through dialogueSequence into a runnable runner', () => {
    const id: DialogueId = 'ashpriest-1';
    const r = new DialogueRunner(dialogueSequence(id, new Set(), false));
    expect(r.done).toBe(false);
    let count = 1;
    while (r.advance()) count += 1;
    expect(count).toBe(DIALOGUE[id].length);
  });
});

describe('inscription pure parts', () => {
  it('typedChars reveals characters over time and caps at the total', () => {
    expect(typedChars(20, 0, 10)).toBe(0);
    expect(typedChars(20, 55, 10)).toBe(5);
    expect(typedChars(20, 10_000, 10)).toBe(20); // never overshoots
    expect(typedChars(20, -5, 10)).toBe(0); // never negative
  });

  it('markRead fires once per id, then never again', () => {
    const read = new Set<string>();
    expect(markRead(read, 'gate-plaque')).toBe(true);
    expect(markRead(read, 'gate-plaque')).toBe(false);
    expect(markRead(read, 'hall-mural')).toBe(true);
    expect(read.has('gate-plaque')).toBe(true);
    expect(read.size).toBe(2);
  });

  it('a save-seeded read-set suppresses the first-read emit', () => {
    const read = new Set<string>(['gate-plaque']); // already read last session
    expect(markRead(read, 'gate-plaque')).toBe(false);
  });
});
