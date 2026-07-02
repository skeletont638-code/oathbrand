/**
 * Pause overlay (Task 18) — the vigil held. Shown while the game sits in the
 * `paused` state (main watches for the transition). The world dims behind a
 * quiet column: resume, settings, or lay the watch down and return to the
 * title. Same ember-menu language as the title; no boxes.
 */

export type PauseActionId = 'resume' | 'settings' | 'quit';

export interface PauseMenuItem {
  id: PauseActionId;
  label: string;
  danger: boolean;
}

/** The pause menu is fixed, but kept as data so the DOM stays a projection. */
export function pauseMenuModel(): PauseMenuItem[] {
  return [
    { id: 'resume', label: 'RESUME', danger: false },
    { id: 'settings', label: 'SETTINGS', danger: false },
    { id: 'quit', label: 'LAY DOWN THE WATCH', danger: true },
  ];
}

export interface PauseHandlers {
  onResume(): void;
  onSettings(): void;
  onQuit(): void;
}

export class PauseScreen {
  private root: HTMLDivElement | null = null;
  private buttons: { item: PauseMenuItem; el: HTMLButtonElement }[] = [];
  private activeIndex = 0;
  private open_ = false;
  private suspended = false;

  constructor(private readonly handlers: PauseHandlers) {}

  get isOpen(): boolean {
    return this.open_;
  }

  /** Yield / reclaim keyboard nav while settings is stacked over the pause menu. */
  suspend(): void {
    this.suspended = true;
  }
  resume(): void {
    this.suspended = false;
  }

  show(): void {
    const el = this.ensure();
    this.open_ = true;
    el.classList.add('is-shown');
    document.addEventListener('keydown', this.onKey, true);
    this.setActive(0);
  }

  hide(): void {
    if (!this.open_) return;
    this.open_ = false;
    document.removeEventListener('keydown', this.onKey, true);
    this.root?.classList.remove('is-shown');
  }

  private ensure(): HTMLDivElement {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'ob-pause';

    const title = document.createElement('div');
    title.className = 'ob-pause-title';
    title.textContent = 'THE VIGIL HOLDS';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'ob-eyebrow';
    eyebrow.textContent = 'PAUSED';

    const menu = document.createElement('nav');
    menu.className = 'ob-menu';
    menu.setAttribute('aria-label', 'Pause menu');
    this.buttons = [];
    for (const item of pauseMenuModel()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ob-menu-item${item.danger ? ' is-danger' : ''}`;
      const label = document.createElement('span');
      label.textContent = item.label;
      btn.appendChild(label);
      btn.addEventListener('click', () => this.activate(item));
      btn.addEventListener('mouseenter', () =>
        this.setActive(this.buttons.findIndex((b) => b.el === btn)),
      );
      menu.appendChild(btn);
      this.buttons.push({ item, el: btn });
    }

    root.append(eyebrow, title, menu);
    document.body.appendChild(root);
    this.root = root;
    return root;
  }

  private setActive(index: number): void {
    if (index < 0 || index >= this.buttons.length) return;
    this.activeIndex = index;
    this.buttons.forEach((b, i) => b.el.classList.toggle('is-active', i === index));
    this.buttons[index].el.focus();
  }

  private move(delta: number): void {
    const n = this.buttons.length;
    if (n === 0) return;
    this.setActive((this.activeIndex + delta + n) % n);
  }

  private activate(item: PauseMenuItem): void {
    switch (item.id) {
      case 'resume':
        this.handlers.onResume();
        return;
      case 'settings':
        this.handlers.onSettings();
        return;
      case 'quit':
        this.handlers.onQuit();
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
      case 'Space':
        e.preventDefault();
        this.activate(this.buttons[this.activeIndex].item);
        return;
      case 'Escape':
        // Esc closes the pause menu the same as RESUME (a predictable back).
        e.preventDefault();
        this.handlers.onResume();
        return;
      default:
        return;
    }
  };
}
