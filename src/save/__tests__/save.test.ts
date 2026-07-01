import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveGame, loadGame, clearSave, SAVE_KEY } from '../save';
import type { SaveData } from '../save';

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

const SAMPLE: SaveData = {
  version: 1,
  zone: 'great-hall',
  bannerId: 'banner-hall',
  embers: 3,
  flags: ['gatekey', 'shortcut-open'],
  endingsSeen: [1],
  loreRead: ['crate-note'],
  visionsSeen: ['vision-oath'],
  ngPlus: false,
};

describe('save round-trip', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorageStub());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadGame returns exactly what saveGame stored', () => {
    saveGame(SAMPLE);
    expect(loadGame()).toEqual(SAMPLE);
  });

  it('writes under the oathbrand.save.v1 key', () => {
    saveGame(SAMPLE);
    expect(SAVE_KEY).toBe('oathbrand.save.v1');
    expect(localStorage.getItem('oathbrand.save.v1')).not.toBeNull();
  });

  it('loadGame with no save returns null', () => {
    expect(loadGame()).toBeNull();
  });

  it('clearSave removes the save', () => {
    saveGame(SAMPLE);
    clearSave();
    expect(loadGame()).toBeNull();
  });

  it('corrupted JSON returns null, never throws', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1,"zone":'); // truncated
    expect(loadGame()).toBeNull();
  });

  it('unknown version returns null (fresh start)', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...SAMPLE, version: 99 }));
    expect(loadGame()).toBeNull();
  });

  it('non-object payloads return null', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify('not a save'));
    expect(loadGame()).toBeNull();
    localStorage.setItem(SAVE_KEY, 'null');
    expect(loadGame()).toBeNull();
  });

  it('version-1 payload missing required fields returns null', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, zone: 'throne' }));
    expect(loadGame()).toBeNull();
  });
});

describe('save resilience', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never throws when localStorage itself throws (quota/security)', () => {
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
    expect(() => saveGame(SAMPLE)).not.toThrow();
    expect(loadGame()).toBeNull();
    expect(() => clearSave()).not.toThrow();
  });

  it('never throws when localStorage is absent (node)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveGame(SAMPLE)).not.toThrow();
    expect(loadGame()).toBeNull();
    expect(() => clearSave()).not.toThrow();
  });
});
