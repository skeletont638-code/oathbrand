/**
 * The inscription surface (Task 13) — ONE renderer for every piece of written
 * word in OATHBRAND:
 *
 *  - `Inscription`  — the full-screen reader. READ a lore spot → the game
 *      enters the `reading` state, a stone plate rises, and the body types
 *      itself out; E / click / Esc completes the type, then closes back to
 *      `playing`, emitting `lore-read` once per unique id (persisted via the
 *      save's `loreRead`).
 *  - `DialogueBox`  — the Ash-Priest conversation overlay. SPEAK → `dialogue`
 *      state, one line at a time, advancing on E / click, closing on the last.
 *  - `showCard`     — the compact toast absorbed from T12's card.ts: item
 *      pickups (the Gatekey) and small scripted reveals fade one line and go.
 *
 * The pure parts (`typedChars`, `markRead`) are exported for headless tests;
 * everything DOM lives inside methods, so the module imports clean in node.
 */
import type { Game } from '../engine/Game';
import type { EventBus } from '../engine/events';
import { LORE } from '../content/lore';
import { DialogueRunner } from '../content/dialogue';
import type { DialogueLine } from '../content/dialogue';

/** Milliseconds per character of the typewriter reveal. */
const TYPE_CHAR_MS = 16;
/** Ignore close/advance input for this long after opening, so the very keypress
 *  that OPENED an overlay cannot also close it. */
const MIN_OPEN_MS = 220;

// ─── pure helpers (unit-tested headless) ──────────────────────────────────

/** How many characters of a `total`-length string are revealed after
 *  `elapsedMs`. Clamped to [0, total] — never negative, never overshoots. */
export function typedChars(total: number, elapsedMs: number, charMs = TYPE_CHAR_MS): number {
  if (elapsedMs <= 0) return 0;
  return Math.min(total, Math.floor(elapsedMs / charMs));
}

/** Record a lore id as read. Returns true only the FIRST time an id is seen,
 *  so `lore-read` (and the "new" chime later) fires exactly once. */
export function markRead(readSet: Set<string>, loreId: string): boolean {
  if (readSet.has(loreId)) return false;
  readSet.add(loreId);
  return true;
}

// ─── shared DOM helpers ───────────────────────────────────────────────────

/** Best-effort release of pointer lock so the reader/box can be read/clicked. */
function releasePointer(): void {
  try {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
  } catch {
    /* older browsers: nothing to do */
  }
}

// ─── the full-screen reader ───────────────────────────────────────────────

export interface InscriptionDeps {
  game: Game;
  bus: EventBus;
  /** Ids already read (seeded from the save); new reads are added + emitted. */
  readSet: Set<string>;
  /** Called after closing, so the caller can clear stale input / prompts. */
  onClose?: () => void;
}

export class Inscription {
  private root: HTMLDivElement | null = null;
  private titleEl!: HTMLDivElement;
  private bodyEl!: HTMLParagraphElement;
  private hintEl!: HTMLDivElement;

  private open_ = false;
  private body = '';
  private revealed = false;
  private openedAt = 0;
  private startedAt = 0;
  private raf = 0;

  constructor(private readonly deps: InscriptionDeps) {}

  get isOpen(): boolean {
    return this.open_;
  }

  /** READ a lore id: enter `reading` and raise the plate. No-op (false) for an
   *  unknown id or when the game will not leave `playing`. */
  open(loreId: string): boolean {
    if (this.open_) return false;
    const entry = LORE[loreId];
    if (!entry) return false;
    if (!this.deps.game.transition('reading')) return false;

    this.open_ = true;
    this.revealed = false;
    this.body = entry.body;
    this.openedAt = this.startedAt = now();

    const el = this.ensure();
    this.titleEl.textContent = entry.title;
    this.bodyEl.textContent = '';
    this.hintEl.textContent = '';
    el.style.display = 'flex';
    void el.offsetHeight; // reflow so the fade runs from 0
    el.style.opacity = '1';

    if (markRead(this.deps.readSet, loreId)) {
      this.deps.bus.emit({ type: 'lore-read', loreId });
    }

    releasePointer();
    document.addEventListener('keydown', this.onKey, true);
    el.addEventListener('click', this.onClick);
    this.tick();
    return true;
  }

  /** Leave `reading`, lower the plate, and hand control back. */
  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this.onKey, true);
    if (this.root) {
      this.root.removeEventListener('click', this.onClick);
      this.root.style.opacity = '0';
      const el = this.root;
      window.setTimeout(() => {
        if (!this.open_) el.style.display = 'none';
      }, 260);
    }
    this.deps.game.transition('playing');
    this.deps.onClose?.();
  }

  private tick = (): void => {
    if (!this.open_) return;
    const shown = this.revealed
      ? this.body.length
      : typedChars(this.body.length, now() - this.startedAt);
    this.bodyEl.textContent = this.body.slice(0, shown);
    const complete = shown >= this.body.length;
    if (complete && !this.revealed) this.revealed = true;
    this.hintEl.textContent = complete ? 'E / CLICK — rise' : '';
    if (!complete) this.raf = requestAnimationFrame(this.tick);
  };

  /** First input completes the type; a second closes. Guarded so the opening
   *  keypress cannot double as the close. */
  private advanceOrClose(): void {
    if (now() - this.openedAt < MIN_OPEN_MS) return;
    if (!this.revealed) {
      this.revealed = true;
      this.tick();
      return;
    }
    this.close();
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.advanceOrClose();
    }
  };

  private onClick = (): void => this.advanceOrClose();

  private ensure(): HTMLDivElement {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.style.cssText = OVERLAY_CSS;
    const plate = document.createElement('div');
    plate.style.cssText = PLATE_CSS;

    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = TITLE_CSS;
    this.bodyEl = document.createElement('p');
    this.bodyEl.style.cssText = BODY_CSS;
    this.hintEl = document.createElement('div');
    this.hintEl.style.cssText = HINT_CSS;

    plate.append(this.titleEl, this.bodyEl, this.hintEl);
    root.appendChild(plate);
    document.body.appendChild(root);
    this.root = root;
    return root;
  }
}

// ─── the dialogue box ─────────────────────────────────────────────────────

export interface DialogueBoxDeps {
  game: Game;
  onClose?: () => void;
}

export class DialogueBox {
  private root: HTMLDivElement | null = null;
  private speakerEl!: HTMLDivElement;
  private lineEl!: HTMLParagraphElement;
  private hintEl!: HTMLDivElement;

  private open_ = false;
  private runner: DialogueRunner | null = null;
  private text = '';
  private revealed = false;
  private openedAt = 0;
  private startedAt = 0;
  private raf = 0;

  constructor(private readonly deps: DialogueBoxDeps) {}

  get isOpen(): boolean {
    return this.open_;
  }

  /** Begin a conversation from a prepared line sequence (dialogueSequence). */
  open(lines: DialogueLine[]): boolean {
    if (this.open_ || lines.length === 0) return false;
    if (!this.deps.game.transition('dialogue')) return false;

    this.open_ = true;
    this.runner = new DialogueRunner(lines);
    this.openedAt = now();

    const el = this.ensure();
    el.style.display = 'flex';
    void el.offsetHeight;
    el.style.opacity = '1';

    releasePointer();
    document.addEventListener('keydown', this.onKey, true);
    el.addEventListener('click', this.onClick);
    this.showCurrent();
    return true;
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.runner = null;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this.onKey, true);
    if (this.root) {
      this.root.removeEventListener('click', this.onClick);
      this.root.style.opacity = '0';
      const el = this.root;
      window.setTimeout(() => {
        if (!this.open_) el.style.display = 'none';
      }, 260);
    }
    this.deps.game.transition('playing');
    this.deps.onClose?.();
  }

  private showCurrent(): void {
    const cur = this.runner?.current;
    if (!cur) {
      this.close();
      return;
    }
    this.text = cur.text;
    this.revealed = false;
    this.startedAt = now();
    this.speakerEl.textContent = cur.speaker;
    this.lineEl.textContent = '';
    this.hintEl.textContent = '';
    this.tick();
  }

  private tick = (): void => {
    if (!this.open_) return;
    const shown = this.revealed
      ? this.text.length
      : typedChars(this.text.length, now() - this.startedAt);
    this.lineEl.textContent = this.text.slice(0, shown);
    const complete = shown >= this.text.length;
    if (complete && !this.revealed) this.revealed = true;
    if (complete) {
      const last = this.runner?.done === false && this.runner.index === this.runner.lines.length - 1;
      this.hintEl.textContent = last ? 'E / CLICK — leave him' : 'E / CLICK — go on';
    } else {
      this.hintEl.textContent = '';
    }
    if (!complete) this.raf = requestAnimationFrame(this.tick);
  };

  private advance(): void {
    if (now() - this.openedAt < MIN_OPEN_MS) return;
    if (!this.revealed) {
      this.revealed = true;
      this.tick();
      return;
    }
    if (this.runner?.advance()) this.showCurrent();
    else this.close();
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.advance();
    }
  };

  private onClick = (): void => this.advance();

  private ensure(): HTMLDivElement {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.style.cssText = DIALOGUE_OVERLAY_CSS;
    const box = document.createElement('div');
    box.style.cssText = DIALOGUE_BOX_CSS;

    this.speakerEl = document.createElement('div');
    this.speakerEl.style.cssText = SPEAKER_CSS;
    this.lineEl = document.createElement('p');
    this.lineEl.style.cssText = DIALOGUE_LINE_CSS;
    this.hintEl = document.createElement('div');
    this.hintEl.style.cssText = HINT_CSS;

    box.append(this.speakerEl, this.lineEl, this.hintEl);
    root.appendChild(box);
    document.body.appendChild(root);
    this.root = root;
    return root;
  }
}

// ─── the compact toast (absorbed from T12's card.ts) ──────────────────────

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;
const TOAST_MS = 4200;

function ensureToast(): HTMLDivElement {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:38%',
    'transform:translate(-50%,-50%)',
    'z-index:960',
    'pointer-events:none',
    'max-width:32ch',
    'text-align:center',
    'font-family:var(--font-spoken)',
    'font-style:italic',
    'font-weight:500',
    'font-size:calc(18px * var(--ui-scale))',
    'line-height:1.5',
    'letter-spacing:0.02em',
    'color:var(--parchment)',
    'text-shadow:0 2px 4px #000',
    'background:linear-gradient(rgba(18,14,10,0.86),rgba(10,8,6,0.86))',
    'border-top:1px solid var(--rule)',
    'border-bottom:1px solid var(--rule)',
    'padding:18px 26px',
    'opacity:0',
    'transition:opacity 480ms ease',
    'display:none',
  ].join(';');
  document.body.appendChild(toastEl);
  return toastEl;
}

/** Show a one-line inscription toast (item pickups, small reveals); it fades
 *  itself away. Kept for main.ts's TAKE / kick-open beats. */
export function showCard(text: string): void {
  const node = ensureToast();
  node.textContent = text;
  node.style.display = 'block';
  void node.offsetHeight;
  node.style.opacity = '1';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toastEl) toastEl.style.opacity = '0';
  }, TOAST_MS);
}

// ─── the vision caption (Task 14) ─────────────────────────────────────────

let visionCapEl: HTMLDivElement | null = null;

function ensureVisionCaption(): HTMLDivElement {
  if (visionCapEl) return visionCapEl;
  visionCapEl = document.createElement('div');
  visionCapEl.style.cssText = [
    'position:fixed',
    'left:50%',
    // Lower-third, clear of a 9:16 phone crop's safe area.
    'bottom:22%',
    'transform:translateX(-50%)',
    'z-index:990',
    'pointer-events:none',
    'max-width:34ch',
    'text-align:center',
    'font-family:var(--font-spoken)',
    'font-style:italic',
    'font-weight:400',
    'font-size:calc(22px * var(--ui-scale))',
    'line-height:1.55',
    'letter-spacing:0.015em',
    'color:var(--parchment)',
    'text-shadow:0 2px 8px #000,0 0 24px rgba(0,0,0,0.7)',
    'opacity:0',
    'transition:opacity 700ms ease',
    'display:none',
  ].join(';');
  document.body.appendChild(visionCapEl);
  return visionCapEl;
}

/**
 * Show a single line of vision litany, or fade it away with `null`. The
 * VisionPlayer drives this once per step (Task 14); the memory ends by
 * passing `null`.
 */
export function showVisionCaption(text: string | null): void {
  const node = ensureVisionCaption();
  if (text === null || text === '') {
    node.style.opacity = '0';
    return;
  }
  node.textContent = text;
  node.style.display = 'block';
  void node.offsetHeight; // reflow so the fade runs from 0
  node.style.opacity = '1';
}

// ─── styling ──────────────────────────────────────────────────────────────

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

const OVERLAY_CSS = [
  'position:fixed',
  'inset:0',
  'z-index:1000',
  'display:none',
  'align-items:center',
  'justify-content:center',
  'background:radial-gradient(120% 120% at 50% 40%,rgba(8,7,6,0.72),rgba(4,3,3,0.94))',
  'opacity:0',
  'transition:opacity 300ms ease',
  'cursor:pointer',
].join(';');

const PLATE_CSS = [
  'max-width:46ch',
  'margin:0 6vw',
  'padding:34px 40px',
  'text-align:center',
  'background:linear-gradient(rgba(24,20,15,0.92),rgba(12,10,8,0.95))',
  'border-top:1px solid var(--rule)',
  'border-bottom:1px solid var(--rule)',
  'box-shadow:0 0 60px rgba(0,0,0,0.6),inset 0 0 40px rgba(0,0,0,0.5)',
].join(';');

// Carved-stone voice: the inscription's title, set in Cinzel.
const TITLE_CSS = [
  'font-family:var(--font-stone)',
  'font-weight:600',
  'font-size:calc(16px * var(--ui-scale))',
  'line-height:1.3',
  'letter-spacing:0.24em',
  'color:var(--gild)',
  'text-shadow:0 2px 0 #000',
  'margin-bottom:22px',
].join(';');

// Spoken-word voice: the body, breathed in italic serif; scales with text size.
const BODY_CSS = [
  'font-family:var(--font-spoken)',
  'font-style:italic',
  'font-weight:400',
  'font-size:calc(20px * var(--ui-scale))',
  'line-height:1.7',
  'letter-spacing:0.01em',
  'color:var(--parchment)',
  'text-shadow:0 2px 5px #000',
  'margin:0',
  'min-height:3.4em',
].join(';');

// The mechanism voice: the advance/close hint, in mono.
const HINT_CSS = [
  'font-family:var(--font-mech)',
  'font-weight:600',
  'font-size:calc(11px * var(--ui-scale))',
  'line-height:1',
  'letter-spacing:0.28em',
  'color:rgba(200,168,110,0.55)',
  'margin-top:26px',
  'min-height:1em',
].join(';');

const DIALOGUE_OVERLAY_CSS = [
  'position:fixed',
  'inset:0',
  'z-index:1000',
  'display:none',
  'align-items:flex-end',
  'justify-content:center',
  'background:linear-gradient(rgba(4,3,3,0) 55%,rgba(4,3,3,0.55))',
  'opacity:0',
  'transition:opacity 300ms ease',
  'cursor:pointer',
].join(';');

const DIALOGUE_BOX_CSS = [
  'width:min(72ch,88vw)',
  'margin-bottom:9vh',
  'padding:24px 34px 22px',
  'background:linear-gradient(rgba(22,18,14,0.94),rgba(10,9,7,0.96))',
  'border-top:1px solid var(--rule)',
  'border-bottom:1px solid var(--rule)',
  'box-shadow:0 0 50px rgba(0,0,0,0.7)',
].join(';');

// Carved-stone voice: the speaker's name, in Cinzel smallcaps.
const SPEAKER_CSS = [
  'font-family:var(--font-stone)',
  'font-weight:600',
  'font-size:calc(14px * var(--ui-scale))',
  'line-height:1',
  'letter-spacing:0.2em',
  'color:var(--gild)',
  'text-shadow:0 2px 0 #000',
  'margin-bottom:14px',
].join(';');

// Spoken-word voice: the line itself, in serif; scales with text size.
const DIALOGUE_LINE_CSS = [
  'font-family:var(--font-spoken)',
  'font-weight:400',
  'font-size:calc(19px * var(--ui-scale))',
  'line-height:1.65',
  'color:var(--parchment)',
  'text-shadow:0 2px 5px #000',
  'margin:0',
  'min-height:3.3em',
].join(';');
