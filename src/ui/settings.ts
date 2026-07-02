/**
 * Settings (Task 18) — the eight-plus dials the player keeps, persisted to
 * localStorage and applied LIVE the instant they change.
 *
 * The persisted shape and its validation follow the save system's discipline
 * (src/save/save.ts): reads NEVER throw, and a missing / corrupt / tampered
 * blob degrades to defaults. Validation is per-field and range-aware — a bad
 * value for one dial falls back to that dial's default without discarding the
 * rest, and every number is clamped into its legal domain on the way in.
 *
 * `applySettings` pushes a whole Settings object at the injected sinks (the T2
 * PS1 pipeline, the T17 audio mixer, the T7 controller, and the DOM text
 * scale); the panel calls the same sinks per-dial as they move. The pure parts
 * (sanitize / load / save / ranges) carry no DOM and are unit-tested headless.
 */

// ── the persisted shape ─────────────────────────────────────────────────────

/** Internal render height of the PS1 pipeline: 240 → 320×240, 360 → 480×360. */
export type RenderHeight = 240 | 360;

export interface Settings {
  /** Final output trim (0..1), a multiplier over the tuned master gain. */
  volMaster: number;
  /** Ambience-bed volume (0..1). */
  volAmbience: number;
  /** One-shot SFX volume (0..1). */
  volSfx: number;
  /** Look sensitivity multiplier (SENS_MIN..SENS_MAX; 1 = the tuned default). */
  sensitivity: number;
  /** Invert vertical look. */
  invertY: boolean;
  /** PS1 render height (drives the pipeline render target). */
  renderHeight: RenderHeight;
  /** CRT scanline/vignette/grain pass. */
  crt: boolean;
  /** Reduced-flicker: disables the CRT pass's grain + shimmer (photosensitivity). */
  flickerSafe: boolean;
  /** UI text scale (one of TEXT_SCALES; multiplies overlay type via --ui-scale). */
  textScale: number;
}

export const SETTINGS_KEY = 'oathbrand.settings.v1';

/** Look-sensitivity domain (multiplier over the controller's base radians/px). */
export const SENS_MIN = 0.4;
export const SENS_MAX = 2.0;

/** The three UI text scales offered (small · normal · large). */
export const TEXT_SCALES = [0.9, 1, 1.15] as const;

export const DEFAULT_SETTINGS: Settings = {
  volMaster: 0.9,
  volAmbience: 0.9,
  volSfx: 1.0,
  sensitivity: 1.0,
  invertY: false,
  renderHeight: 240,
  crt: false,
  flickerSafe: false,
  textScale: 1,
};

// ── pure range helpers ──────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** The pipeline render height (240/360) → the width the UI names it by (320/480). */
export function renderHeightToWidth(h: RenderHeight): 320 | 480 {
  return h === 240 ? 320 : 480;
}

// ── validation (per-field, range-aware; never throws) ───────────────────────

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/**
 * Coerce any parsed value into a fully-valid Settings. A non-object, or any
 * out-of-range / wrong-typed field, degrades to that field's default — the
 * rest of a partly-valid blob survives. Numbers are clamped to their domains.
 */
export function sanitizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };
  const o = raw as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    volMaster: num(o.volMaster, d.volMaster, 0, 1),
    volAmbience: num(o.volAmbience, d.volAmbience, 0, 1),
    volSfx: num(o.volSfx, d.volSfx, 0, 1),
    sensitivity: num(o.sensitivity, d.sensitivity, SENS_MIN, SENS_MAX),
    invertY: bool(o.invertY, d.invertY),
    renderHeight: o.renderHeight === 360 ? 360 : o.renderHeight === 240 ? 240 : d.renderHeight,
    crt: bool(o.crt, d.crt),
    flickerSafe: bool(o.flickerSafe, d.flickerSafe),
    textScale:
      typeof o.textScale === 'number' && (TEXT_SCALES as readonly number[]).includes(o.textScale)
        ? o.textScale
        : d.textScale,
  };
}

// ── persistence (mirrors save.ts: property access itself can throw) ─────────

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    return typeof localStorage === 'undefined' || localStorage === undefined ? null : localStorage;
  } catch {
    return null;
  }
}

/** Load + validate settings; a missing/corrupt blob returns the defaults. */
export function loadSettings(): Settings {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings (sanitized first, so only legal values ever land). */
export function saveSettings(s: Settings): void {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(s)));
  } catch {
    /* quota/security: drop the write, keep the in-memory value */
  }
}

// ── live application ─────────────────────────────────────────────────────────

/** The live targets a settings change drives — the real setters on the T2/T7/
 *  T17 systems, plus the DOM text scale. Injected by main so this module never
 *  reaches into a subsystem itself. */
export interface SettingsSinks {
  setMasterVolume(v: number): void;
  setAmbienceVolume(v: number): void;
  setSfxVolume(v: number): void;
  setSensitivity(v: number): void;
  setInvertY(b: boolean): void;
  setRenderHeight(h: RenderHeight): void;
  setCrt(b: boolean): void;
  setFlickerSafe(b: boolean): void;
  setTextScale(v: number): void;
}

/** Push every dial of `s` at the sinks (used at boot and after a load). */
export function applySettings(sinks: SettingsSinks, s: Settings): void {
  sinks.setMasterVolume(s.volMaster);
  sinks.setAmbienceVolume(s.volAmbience);
  sinks.setSfxVolume(s.volSfx);
  sinks.setSensitivity(s.sensitivity);
  sinks.setInvertY(s.invertY);
  sinks.setRenderHeight(s.renderHeight);
  sinks.setCrt(s.crt);
  sinks.setFlickerSafe(s.flickerSafe);
  sinks.setTextScale(s.textScale);
}

/** Set the DOM UI text scale (the default `setTextScale` sink). */
export function applyTextScale(v: number): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--ui-scale', String(v));
  }
}

// ── the panel (DOM; state-agnostic, opened from title AND pause) ─────────────

export class SettingsPanel {
  private root: HTMLDivElement | null = null;
  private closeCb: (() => void) | null = null;
  private open_ = false;
  private readonly s: Settings;

  constructor(
    private readonly sinks: SettingsSinks,
    initial: Settings,
  ) {
    this.s = { ...initial };
  }

  get isOpen(): boolean {
    return this.open_;
  }

  /** Raise the panel over whatever is behind it; `onClose` returns control. */
  open(onClose: () => void): void {
    if (this.open_) return;
    this.open_ = true;
    this.closeCb = onClose;
    const el = this.ensure();
    el.classList.add('is-shown');
    document.addEventListener('keydown', this.onKey, true);
    // Focus the first control for keyboard players.
    el.querySelector<HTMLElement>('.ob-slider, .ob-toggle, .ob-seg-opt')?.focus();
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    document.removeEventListener('keydown', this.onKey, true);
    this.root?.classList.remove('is-shown');
    const cb = this.closeCb;
    this.closeCb = null;
    cb?.();
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  };

  /** Commit a changed field: store it, apply it live, persist it. */
  private commit<K extends keyof Settings>(key: K, value: Settings[K], apply: () => void): void {
    this.s[key] = value;
    apply();
    saveSettings(this.s);
  }

  // — control builders ——————————————————————————————————————————————————————

  private row(label: string, control: HTMLElement): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'ob-row';
    const l = document.createElement('span');
    l.className = 'ob-row-label';
    l.textContent = label;
    const c = document.createElement('div');
    c.className = 'ob-row-control';
    c.appendChild(control);
    row.append(l, c);
    return row;
  }

  private sliderRow(
    label: string,
    get: () => number,
    lo: number,
    hi: number,
    onInput: (v: number) => void,
    format: (v: number) => string,
  ): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'ob-row-control';
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'ob-slider';
    input.min = String(lo);
    input.max = String(hi);
    input.step = String((hi - lo) / 100);
    input.value = String(get());
    input.setAttribute('aria-label', label);
    const val = document.createElement('span');
    val.className = 'ob-slider-val';
    const paint = (): void => {
      const v = Number(input.value);
      val.textContent = format(v);
      input.style.setProperty('--fill', `${((v - lo) / (hi - lo)) * 100}%`);
    };
    input.addEventListener('input', () => {
      onInput(Number(input.value));
      paint();
    });
    paint();
    wrap.append(input, val);
    return this.rowFrom(label, wrap);
  }

  private rowFrom(label: string, control: HTMLElement): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'ob-row';
    const l = document.createElement('span');
    l.className = 'ob-row-label';
    l.textContent = label;
    row.append(l, control);
    return row;
  }

  private toggleRow(
    label: string,
    get: () => boolean,
    onChange: (b: boolean) => void,
    onText = 'KEPT',
    offText = 'SPENT',
  ): HTMLDivElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ob-toggle';
    btn.setAttribute('role', 'switch');
    const paint = (): void => {
      const on = get();
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.textContent = on ? onText : offText;
    };
    btn.addEventListener('click', () => {
      onChange(!get());
      paint();
    });
    paint();
    return this.row(label, btn);
  }

  private segRow(
    label: string,
    options: { text: string; active: () => boolean; pick: () => void }[],
  ): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'ob-seg';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    const buttons: HTMLButtonElement[] = [];
    const paint = (): void => {
      options.forEach((opt, i) =>
        buttons[i].setAttribute('aria-pressed', opt.active() ? 'true' : 'false'),
      );
    };
    options.forEach((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ob-seg-opt';
      b.textContent = opt.text;
      b.addEventListener('click', () => {
        opt.pick();
        paint();
      });
      buttons.push(b);
      group.appendChild(b);
    });
    paint();
    return this.row(label, group);
  }

  private group(label: string): HTMLDivElement {
    const g = document.createElement('div');
    g.className = 'ob-set-group';
    const h = document.createElement('span');
    h.className = 'ob-eyebrow';
    h.textContent = label;
    g.appendChild(h);
    return g;
  }

  private ensure(): HTMLDivElement {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'ob-settings';

    const plate = document.createElement('div');
    plate.className = 'ob-settings-plate';

    const head = document.createElement('div');
    head.className = 'ob-settings-head';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'ob-eyebrow';
    eyebrow.textContent = 'THE VIGIL';
    const title = document.createElement('h2');
    title.className = 'ob-settings-title';
    title.textContent = 'SETTINGS';
    head.append(eyebrow, title);
    plate.appendChild(head);

    const pct = (v: number): string => `${Math.round(v * 100)}%`;

    // — Sound —
    const sound = this.group('SOUND');
    sound.append(
      this.sliderRow('Master', () => this.s.volMaster, 0, 1, (v) =>
        this.commit('volMaster', v, () => this.sinks.setMasterVolume(v)), pct),
      this.sliderRow('Ambience', () => this.s.volAmbience, 0, 1, (v) =>
        this.commit('volAmbience', v, () => this.sinks.setAmbienceVolume(v)), pct),
      this.sliderRow('Effects', () => this.s.volSfx, 0, 1, (v) =>
        this.commit('volSfx', v, () => this.sinks.setSfxVolume(v)), pct),
    );
    plate.appendChild(sound);

    // — Look —
    const look = this.group('LOOK');
    look.append(
      this.sliderRow('Sensitivity', () => this.s.sensitivity, SENS_MIN, SENS_MAX, (v) =>
        this.commit('sensitivity', v, () => this.sinks.setSensitivity(v)),
        (v) => `${v.toFixed(2)}×`),
      this.toggleRow('Invert look', () => this.s.invertY, (b) =>
        this.commit('invertY', b, () => this.sinks.setInvertY(b)), 'INVERTED', 'NORMAL'),
    );
    plate.appendChild(look);

    // — Picture —
    const picture = this.group('PICTURE');
    picture.append(
      this.segRow('Render scale', [
        {
          text: '320',
          active: () => this.s.renderHeight === 240,
          pick: () => this.commit('renderHeight', 240, () => this.sinks.setRenderHeight(240)),
        },
        {
          text: '480',
          active: () => this.s.renderHeight === 360,
          pick: () => this.commit('renderHeight', 360, () => this.sinks.setRenderHeight(360)),
        },
      ]),
      this.toggleRow('CRT', () => this.s.crt, (b) =>
        this.commit('crt', b, () => this.sinks.setCrt(b)), 'ON', 'OFF'),
      this.toggleRow('Reduced flicker', () => this.s.flickerSafe, (b) =>
        this.commit('flickerSafe', b, () => this.sinks.setFlickerSafe(b)), 'ON', 'OFF'),
    );
    plate.appendChild(picture);

    // — Reading —
    const reading = this.group('READING');
    reading.append(
      this.segRow('Text size', [
        { text: 'Small', active: () => this.s.textScale === 0.9, pick: () => this.pickText(0.9) },
        { text: 'Normal', active: () => this.s.textScale === 1, pick: () => this.pickText(1) },
        { text: 'Large', active: () => this.s.textScale === 1.15, pick: () => this.pickText(1.15) },
      ]),
    );
    plate.appendChild(reading);

    // — Foot —
    const foot = document.createElement('div');
    foot.className = 'ob-settings-foot';
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'ob-menu-item';
    done.innerHTML = '<span>KEEP THE VIGIL</span>';
    done.addEventListener('click', () => this.close());
    foot.appendChild(done);
    plate.appendChild(foot);

    root.appendChild(plate);
    // A click on the scrim (outside the plate) also closes.
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close();
    });
    document.body.appendChild(root);
    this.root = root;
    return root;
  }

  private pickText(v: number): void {
    this.commit('textScale', v, () => this.sinks.setTextScale(v));
  }
}
