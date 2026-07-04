import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SENS_MAX,
  SENS_MIN,
  SETTINGS_KEY,
  TEXT_SCALES,
  applySettings,
  loadSettings,
  renderHeightToWidth,
  sanitizeSettings,
  saveSettings,
} from '../settings';
import type { Settings, SettingsSinks } from '../settings';

/** Minimal in-memory localStorage stand-in (vitest runs in node, no DOM). */
function makeStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

const VALID: Settings = {
  volMaster: 0.5,
  volAmbience: 0.25,
  volSfx: 0.75,
  sensitivity: 1.4,
  invertY: true,
  renderHeight: 360,
  crt: true,
  flickerSafe: true,
  textScale: 1.15,
  graphics: 'hd',
};

describe('sanitizeSettings — shape', () => {
  it('passes a fully valid object through unchanged', () => {
    expect(sanitizeSettings(VALID)).toEqual(VALID);
  });

  it('a non-object degrades to all defaults', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(42)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('a partial object keeps valid fields and defaults the rest', () => {
    const out = sanitizeSettings({ volSfx: 0.3, crt: true });
    expect(out.volSfx).toBe(0.3);
    expect(out.crt).toBe(true);
    expect(out.volMaster).toBe(DEFAULT_SETTINGS.volMaster);
    expect(out.sensitivity).toBe(DEFAULT_SETTINGS.sensitivity);
  });

  it('wrong-typed fields fall back per field, not wholesale', () => {
    const out = sanitizeSettings({
      volMaster: 'loud',
      invertY: 'yes',
      renderHeight: '360',
      textScale: true,
      volSfx: 0.4, // this one is valid and must survive
    });
    expect(out.volMaster).toBe(DEFAULT_SETTINGS.volMaster);
    expect(out.invertY).toBe(DEFAULT_SETTINGS.invertY);
    expect(out.renderHeight).toBe(DEFAULT_SETTINGS.renderHeight);
    expect(out.textScale).toBe(DEFAULT_SETTINGS.textScale);
    expect(out.volSfx).toBe(0.4);
  });
});

describe('sanitizeSettings — ranges', () => {
  it('clamps volumes into [0,1]', () => {
    const hi = sanitizeSettings({ volMaster: 4, volAmbience: 9, volSfx: 100 });
    expect(hi.volMaster).toBe(1);
    expect(hi.volAmbience).toBe(1);
    expect(hi.volSfx).toBe(1);
    const lo = sanitizeSettings({ volMaster: -3, volAmbience: -0.01 });
    expect(lo.volMaster).toBe(0);
    expect(lo.volAmbience).toBe(0);
  });

  it('clamps sensitivity into [SENS_MIN, SENS_MAX]', () => {
    expect(sanitizeSettings({ sensitivity: 10 }).sensitivity).toBe(SENS_MAX);
    expect(sanitizeSettings({ sensitivity: 0.01 }).sensitivity).toBe(SENS_MIN);
    expect(sanitizeSettings({ sensitivity: 1.2 }).sensitivity).toBe(1.2);
  });

  it('rejects non-finite numbers (NaN / Infinity) to the default', () => {
    expect(sanitizeSettings({ volMaster: NaN }).volMaster).toBe(DEFAULT_SETTINGS.volMaster);
    expect(sanitizeSettings({ sensitivity: Infinity }).sensitivity).toBe(
      DEFAULT_SETTINGS.sensitivity,
    );
  });

  it('accepts only 240 or 360 for renderHeight', () => {
    expect(sanitizeSettings({ renderHeight: 240 }).renderHeight).toBe(240);
    expect(sanitizeSettings({ renderHeight: 360 }).renderHeight).toBe(360);
    expect(sanitizeSettings({ renderHeight: 480 }).renderHeight).toBe(DEFAULT_SETTINGS.renderHeight);
    expect(sanitizeSettings({ renderHeight: 241 }).renderHeight).toBe(DEFAULT_SETTINGS.renderHeight);
  });

  it('accepts only the allowed text scales', () => {
    for (const s of TEXT_SCALES) expect(sanitizeSettings({ textScale: s }).textScale).toBe(s);
    expect(sanitizeSettings({ textScale: 1.5 }).textScale).toBe(DEFAULT_SETTINGS.textScale);
    expect(sanitizeSettings({ textScale: 2 }).textScale).toBe(DEFAULT_SETTINGS.textScale);
  });

  it("graphics defaults to 'ps1' and accepts only 'ps1' | 'hd'", () => {
    expect(DEFAULT_SETTINGS.graphics).toBe('ps1');
    expect(sanitizeSettings({ graphics: 'hd' }).graphics).toBe('hd');
    expect(sanitizeSettings({ graphics: 'ps1' }).graphics).toBe('ps1');
    expect(sanitizeSettings({ graphics: 'ultra' }).graphics).toBe('ps1');
    expect(sanitizeSettings({ graphics: 1 }).graphics).toBe('ps1');
    expect(sanitizeSettings({}).graphics).toBe('ps1');
  });
});

describe('renderHeightToWidth', () => {
  it('maps the pipeline height to the width the UI names it by', () => {
    expect(renderHeightToWidth(240)).toBe(320);
    expect(renderHeightToWidth(360)).toBe(480);
  });
});

describe('persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorageStub());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips through localStorage under the versioned key', () => {
    saveSettings(VALID);
    expect(SETTINGS_KEY).toBe('oathbrand.settings.v1');
    expect(loadSettings()).toEqual(VALID);
  });

  it('no stored settings loads the defaults', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('corrupted JSON loads the defaults, never throws', () => {
    localStorage.setItem(SETTINGS_KEY, '{"volMaster":0.5,'); // truncated
    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('a tampered payload is clamped on load', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...VALID, volMaster: 99, sensitivity: -5, renderHeight: 720 }),
    );
    const out = loadSettings();
    expect(out.volMaster).toBe(1);
    expect(out.sensitivity).toBe(SENS_MIN);
    expect(out.renderHeight).toBe(DEFAULT_SETTINGS.renderHeight);
  });

  it('saveSettings sanitizes before writing (only legal values land)', () => {
    saveSettings({ ...VALID, volSfx: 50, textScale: 3 } as Settings);
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) as string) as Settings;
    expect(raw.volSfx).toBe(1);
    expect(raw.textScale).toBe(DEFAULT_SETTINGS.textScale);
  });
});

describe('persistence resilience', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never throws when localStorage throws (quota/security)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(() => saveSettings(VALID)).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('never throws when localStorage is absent (node)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveSettings(VALID)).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('applySettings', () => {
  it('pushes every dial at the sinks with the right value, once each', () => {
    const calls: Record<string, unknown> = {};
    const sinks: SettingsSinks = {
      setMasterVolume: (v) => (calls.master = v),
      setAmbienceVolume: (v) => (calls.ambience = v),
      setSfxVolume: (v) => (calls.sfx = v),
      setSensitivity: (v) => (calls.sens = v),
      setInvertY: (b) => (calls.invert = b),
      setRenderHeight: (h) => (calls.height = h),
      setCrt: (b) => (calls.crt = b),
      setFlickerSafe: (b) => (calls.flicker = b),
      setTextScale: (v) => (calls.text = v),
      setGraphics: (m) => (calls.graphics = m),
    };
    applySettings(sinks, VALID);
    expect(calls).toEqual({
      master: 0.5,
      ambience: 0.25,
      sfx: 0.75,
      sens: 1.4,
      invert: true,
      height: 360,
      crt: true,
      flicker: true,
      text: 1.15,
      graphics: 'hd',
    });
  });
});
