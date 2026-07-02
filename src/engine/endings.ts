/**
 * The four-ending finale (Task 15).
 *
 * `selectEnding` is the pure truth table: it turns the run's final state into an
 * `EndingId`. `EndingDirector` is the timeline that plays the chosen ending's
 * on-screen sequence — desaturation, a slow blackout, the rising embers of a
 * kept oath, Vhaelis's one utterance — driven through injected effect callbacks
 * (no three.js / DOM here, exactly like VisionPlayer), then it hands off to the
 * credits.
 */
import type { EndingId } from '../content/types';
import { ENDING_CARD, VHAELIS_LINES } from '../content/endings';

/** The run state the summit resolves an ending from. */
export interface EndingInputs {
  /** The brand is out — track 3 dominates, the eye never opens. */
  hollow: boolean;
  /** The choice at the flame: give the crown back, keep it, or not yet chosen. */
  choice: 'give' | 'keep' | null;
  /** The knight also carries the Queen's own brand (T16 sets 'queens-brand'). */
  hasQueensBrand: boolean;
}

/**
 * Which ending a resolved summit yields. Pure — same inputs, same answer.
 *   hollow             → 3 (choice ignored; a dark brand cannot answer)
 *   give + queensBrand → 4 (the secret ending)
 *   give               → 1 (OATH KEPT)
 *   keep / null        → 2 (OATH BROKEN — walking away without giving IS keeping)
 */
export function selectEnding(i: EndingInputs): EndingId {
  if (i.hollow) return 3;
  if (i.choice === 'give') return i.hasQueensBrand ? 4 : 1;
  // 'keep', or the defensive `null` (the summit never resolves undecided).
  return 2;
}

// ─── the ending sequence director ──────────────────────────────────────────

/** Renderer-side effects the director drives; main.ts injects the real ones. */
export interface EndingEffects {
  /** 0 = full colour, 1 = ash. */
  setDesaturation: (v: number) => void;
  /** Full-screen black overlay alpha, 0..1. */
  setBlackout: (a: number) => void;
  /** Toggle the E1 particle inversion: embers rise, ash-fall reverses. */
  setEmberRise: (on: boolean) => void;
  /** Raise the ending's title card (no-op for the card-less hollow ending). */
  showCard: (title: string, subtitle: string) => void;
  /** One line of Vhaelis's utterance (E4), or null to clear it. */
  speakVhaelis: (line: string | null) => void;
  /** Named audio/motif cue for the sound layer. */
  cue: (id: string) => void;
}

/** Beat timings (ms). */
const E1_DESAT_MS = 2600; // colour floods back as the oath closes
const E1_CARD_AT = 2400;
const E3_FADE_MS = 5000; // the long silent fade of the hollow ending
const E2_CARD_AT = 500; // after the hard cut to black
const CARD_HOLD_MS = 3200; // how long a card holds before the credits
const E4_LINE_MS = 2900; // per line of Vhaelis
const E4_BLOOM_MS = 2200;

export class EndingDirector {
  private ending: EndingId = 1;
  private elapsed = 0;
  private fromDesat = 0;
  private running = false;
  private finished = false;
  private lastLine = -1;

  constructor(private readonly fx: EndingEffects) {}

  /** True once the on-screen sequence has fully played (credits may roll). */
  get done(): boolean {
    return this.finished;
  }

  get active(): boolean {
    return this.running;
  }

  /** Begin the sequence for `ending`; `fromDesat` is the current desaturation
   *  (so a kept oath can ease colour back from wherever the brand left it). */
  begin(ending: EndingId, fromDesat: number): void {
    this.ending = ending;
    this.fromDesat = fromDesat;
    this.elapsed = 0;
    this.running = true;
    this.finished = false;
    this.lastLine = -1;
    switch (ending) {
      case 1:
        this.fx.cue('ending-oath-kept');
        this.fx.setEmberRise(true); // embers rise, ash-fall reverses
        break;
      case 2:
        this.fx.cue('ending-oath-broken');
        this.fx.setBlackout(1); // hard cut to black
        break;
      case 3:
        this.fx.cue('ending-hollow');
        // eye stays shut (main never opens it); desat is already 1 (hollow).
        break;
      case 4:
        this.fx.cue('ending-flame');
        break;
    }
  }

  /** Advance the sequence; sets `done` when it is time to roll the credits. */
  update(dtMs: number): void {
    if (!this.running || this.finished) return;
    this.elapsed += dtMs;
    switch (this.ending) {
      case 1:
        this.tickOathKept();
        break;
      case 2:
        this.tickOathBroken();
        break;
      case 3:
        this.tickHollow();
        break;
      case 4:
        this.tickFlame();
        break;
    }
  }

  private end(): void {
    this.finished = true;
    this.running = false;
  }

  private tickOathKept(): void {
    const t = Math.min(1, this.elapsed / E1_DESAT_MS);
    this.fx.setDesaturation(this.fromDesat * (1 - t)); // ease to full colour
    if (this.elapsed >= E1_CARD_AT) {
      const card = ENDING_CARD[1]!;
      this.fx.showCard(card.title, card.subtitle);
    }
    if (this.elapsed >= E1_CARD_AT + CARD_HOLD_MS) this.end();
  }

  private tickOathBroken(): void {
    this.fx.setBlackout(1);
    if (this.elapsed >= E2_CARD_AT) {
      const card = ENDING_CARD[2]!;
      this.fx.showCard(card.title, card.subtitle);
    }
    if (this.elapsed >= E2_CARD_AT + CARD_HOLD_MS) this.end();
  }

  private tickHollow(): void {
    // Silence, and a slow fade to black. No title card, by design.
    this.fx.setBlackout(Math.min(1, this.elapsed / E3_FADE_MS));
    if (this.elapsed >= E3_FADE_MS) this.end();
  }

  private tickFlame(): void {
    // Vhaelis speaks her four lines, then colour blooms and the card rises.
    const line = Math.floor(this.elapsed / E4_LINE_MS);
    if (line < VHAELIS_LINES.length) {
      if (line !== this.lastLine) {
        this.lastLine = line;
        this.fx.speakVhaelis(VHAELIS_LINES[line]);
      }
      return;
    }
    const after = this.elapsed - VHAELIS_LINES.length * E4_LINE_MS;
    if (this.lastLine !== VHAELIS_LINES.length) {
      this.lastLine = VHAELIS_LINES.length;
      this.fx.speakVhaelis(null);
    }
    const t = Math.min(1, after / E4_BLOOM_MS);
    this.fx.setDesaturation(this.fromDesat * (1 - t));
    if (after >= E4_BLOOM_MS) {
      const card = ENDING_CARD[4]!;
      this.fx.showCard(card.title, card.subtitle);
    }
    if (after >= E4_BLOOM_MS + CARD_HOLD_MS) this.end();
  }
}
