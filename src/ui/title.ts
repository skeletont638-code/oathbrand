/**
 * Title screen (Task 18) — the altar. The OATHBRAND wordmark over the live-but-
 * still world, a column of oaths for a menu (the lit word is where the brand
 * looks — no boxes), ash-embers drifting up, and the endings tracker beneath.
 *
 * The menu composition is a pure function of two facts — is there a vigil to
 * resume (a save), and has any ending been witnessed — so it is unit-tested
 * headless. Everything DOM lives on the class.
 *
 *   CONTINUE   resume this vigil        (only when a save exists)
 *   BEGIN      a fresh vigil            (BEGIN ANEW + confirm when a save exists)
 *   KEEP THE VIGIL AGAIN   the Second Vigil / NG+   (only once an ending is seen)
 *   SETTINGS   the reckoning
 */
import type { EndingId } from '../content/types';
import { renderEndingsTracker } from './endingsTracker';

export type TitleActionId = 'continue' | 'begin' | 'keep-vigil' | 'settings';

export interface TitleMenuItem {
  id: TitleActionId;
  label: string;
  /** Destructive → hold the first press for a confirm before it fires. */
  confirm: boolean;
  /** Render in the rebuke colour (the fresh-start that abandons a vigil). */
  danger: boolean;
}

export interface TitleState {
  /** A resumable vigil exists in the save slot. */
  hasSave: boolean;
  /** At least one ending has been witnessed (endingsSeen non-empty). */
  anyEndingSeen: boolean;
}

/**
 * The title menu for a given run state. Pure. Order is by prominence:
 * resume first, then the fresh starts, then settings.
 */
export function titleMenuModel(state: TitleState): TitleMenuItem[] {
  const items: TitleMenuItem[] = [];
  if (state.hasSave) {
    items.push({ id: 'continue', label: 'CONTINUE', confirm: false, danger: false });
  }
  items.push({
    id: 'begin',
    label: state.hasSave ? 'BEGIN ANEW' : 'BEGIN',
    confirm: state.hasSave, // abandoning an existing vigil asks twice
    danger: state.hasSave,
  });
  if (state.anyEndingSeen) {
    items.push({ id: 'keep-vigil', label: 'KEEP THE VIGIL AGAIN', confirm: false, danger: false });
  }
  items.push({ id: 'settings', label: 'SETTINGS', confirm: false, danger: false });
  return items;
}

export interface TitleHandlers {
  onContinue(): void;
  onBegin(): void;
  onKeepVigil(): void;
  onSettings(): void;
}

const CONFIRM_NOTE = 'abandons your vigil · again';

export class TitleScreen {
  private root: HTMLDivElement | null = null;
  private buttons: { item: TitleMenuItem; el: HTMLButtonElement }[] = [];
  private activeIndex = 0;
  private pendingConfirm: TitleActionId | null = null;
  private open_ = false;
  private suspended = false;
  private ash: AshEmbers | null = null;

  constructor(private readonly handlers: TitleHandlers) {}

  get isOpen(): boolean {
    return this.open_;
  }

  /** Stop / resume responding to keyboard nav while a panel is stacked over it
   *  (settings). Keeps the title visible behind the panel without stealing keys. */
  suspend(): void {
    this.suspended = true;
  }
  resume(): void {
    this.suspended = false;
  }

  /** Build (or rebuild) + raise the title for the given run state. */
  show(state: TitleState, endingsSeen: readonly EndingId[]): void {
    this.build(state, endingsSeen);
    this.open_ = true;
    const el = this.root!;
    el.classList.remove('is-leaving');
    void el.offsetHeight;
    el.classList.add('is-shown');
    document.addEventListener('keydown', this.onKey, true);
    this.ash?.start();
    this.setActive(0);
  }

  /** Fade out + tear down listeners (the world takes over). */
  hide(): void {
    if (!this.open_) return;
    this.open_ = false;
    document.removeEventListener('keydown', this.onKey, true);
    this.ash?.stop();
    const el = this.root;
    if (el) {
      el.classList.remove('is-shown');
      el.classList.add('is-leaving');
    }
  }

  private build(state: TitleState, endingsSeen: readonly EndingId[]): void {
    // A fresh build each show keeps the menu honest to the current save state.
    if (this.root) {
      this.root.remove();
      this.ash?.stop();
    }
    const root = document.createElement('div');
    root.className = 'ob-title';

    const canvas = document.createElement('canvas');
    canvas.className = 'ob-ash-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    root.appendChild(canvas);
    this.ash = new AshEmbers(canvas);

    const inner = document.createElement('div');
    inner.className = 'ob-title-inner';

    const wordmark = document.createElement('h1');
    wordmark.className = 'ob-wordmark';
    wordmark.textContent = 'OATHBRAND';

    const tagline = document.createElement('div');
    tagline.className = 'ob-tagline';
    tagline.textContent = 'keep the last light of Vael';

    const rule = document.createElement('div');
    rule.className = 'ob-title-rule';
    const diamond = document.createElement('span');
    diamond.className = 'ob-diamond';
    rule.appendChild(diamond);

    const menu = document.createElement('nav');
    menu.className = 'ob-menu';
    menu.setAttribute('aria-label', 'Title menu');
    this.buttons = [];
    for (const item of titleMenuModel(state)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ob-menu-item${item.danger ? ' is-danger' : ''}`;
      const label = document.createElement('span');
      label.textContent = item.label;
      btn.appendChild(label);
      btn.addEventListener('click', () => this.activate(item, btn));
      btn.addEventListener('mouseenter', () => this.setActive(this.buttons.findIndex((b) => b.el === btn)));
      menu.appendChild(btn);
      this.buttons.push({ item, el: btn });
    }

    inner.append(wordmark, tagline, rule, menu, renderEndingsTracker(endingsSeen));
    root.appendChild(inner);
    document.body.appendChild(root);
    this.root = root;
    this.activeIndex = 0;
    this.pendingConfirm = null;
  }

  private setActive(index: number): void {
    if (index < 0 || index >= this.buttons.length) return;
    this.activeIndex = index;
    this.buttons.forEach((b, i) => b.el.classList.toggle('is-active', i === index));
    // A pending confirm only holds while its own item stays focused.
    this.buttons.forEach((b) => {
      if (b.item.id !== this.buttons[index].item.id) this.clearConfirm(b);
    });
    this.buttons[index].el.focus();
  }

  private move(delta: number): void {
    const n = this.buttons.length;
    if (n === 0) return;
    this.setActive((this.activeIndex + delta + n) % n);
  }

  private clearConfirm(entry: { item: TitleMenuItem; el: HTMLButtonElement }): void {
    if (this.pendingConfirm === entry.item.id) this.pendingConfirm = null;
    entry.el.querySelector('.ob-confirm-note')?.remove();
  }

  private activate(item: TitleMenuItem, el: HTMLButtonElement): void {
    if (item.confirm && this.pendingConfirm !== item.id) {
      this.pendingConfirm = item.id;
      if (!el.querySelector('.ob-confirm-note')) {
        const note = document.createElement('span');
        note.className = 'ob-confirm-note';
        note.textContent = CONFIRM_NOTE;
        el.appendChild(note);
      }
      return;
    }
    this.pendingConfirm = null;
    switch (item.id) {
      case 'continue':
        this.handlers.onContinue();
        return;
      case 'begin':
        this.handlers.onBegin();
        return;
      case 'keep-vigil':
        this.handlers.onKeepVigil();
        return;
      case 'settings':
        this.handlers.onSettings();
        return;
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    if (this.suspended) return;
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        this.move(-1);
        return;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        this.move(1);
        return;
      case 'Enter':
      case 'Space': {
        e.preventDefault();
        const entry = this.buttons[this.activeIndex];
        if (entry) this.activate(entry.item, entry.el);
        return;
      }
      default:
        return;
    }
  };
}

// ── ash-embers ───────────────────────────────────────────────────────────────
/**
 * Warm motes drifting UP across the void — the game's own ember-rise, borrowed
 * for the title. A single small canvas, ~64 embers; it honours
 * prefers-reduced-motion by holding still. Starts/stops with the screen so no
 * rAF outlives the menu.
 */
interface Mote {
  x: number;
  y: number;
  vy: number;
  drift: number;
  phase: number;
  size: number;
  alpha: number;
}

class AshEmbers {
  private ctx: CanvasRenderingContext2D | null;
  private motes: Mote[] = [];
  private raf = 0;
  private running = false;
  private readonly reduce: boolean;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.reduce =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  start(): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.resize();
    const w = this.canvas.width || window.innerWidth;
    const h = this.canvas.height || window.innerHeight;
    const count = this.reduce ? 22 : 64;
    this.motes = Array.from({ length: count }, () => this.spawn(w, h, true));
    if (this.reduce) {
      this.paintStatic();
    } else {
      this.raf = requestAnimationFrame(this.tick);
    }
    window.addEventListener('resize', this.resize);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private spawn(w: number, h: number, anywhere: boolean): Mote {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = w / dpr;
    const vh = h / dpr;
    return {
      x: Math.random() * vw,
      y: anywhere ? Math.random() * vh : vh + 8,
      vy: 8 + Math.random() * 18, // px/s upward
      drift: (Math.random() - 0.5) * 10,
      phase: Math.random() * Math.PI * 2,
      size: 0.6 + Math.random() * 1.6,
      alpha: 0.15 + Math.random() * 0.4,
    };
  }

  private draw(m: Mote): void {
    const ctx = this.ctx!;
    ctx.globalAlpha = m.alpha;
    ctx.fillStyle = '#c4501e';
    ctx.beginPath();
    ctx.arc(m.x + Math.sin(m.phase) * 3, m.y, m.size, 0, Math.PI * 2);
    ctx.fill();
  }

  private paintStatic(): void {
    const ctx = this.ctx!;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const m of this.motes) this.draw(m);
    ctx.globalAlpha = 1;
  }

  private tick = (): void => {
    if (!this.running || !this.ctx) return;
    const ctx = this.ctx;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    ctx.clearRect(0, 0, vw, vh);
    const dt = 1 / 60;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.y -= m.vy * dt;
      m.phase += dt * 1.4;
      m.x += m.drift * dt;
      if (m.y < -8) this.motes[i] = this.spawn(vw, vh, false);
      this.draw(m);
    }
    ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame(this.tick);
  };
}
