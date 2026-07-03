import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveGame, loadGame, clearSave, migrateV1toV2, secondVigilSave, SAVE_KEY } from '../save';
import type { SaveData, SaveDataV1 } from '../save';

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

/** A canonical v2 save: round-trips through save/load with no migration. */
const SAMPLE_V2: SaveData = {
  version: 2,
  zone: 'great-hall',
  bannerId: 'banner-hall',
  embers: 3,
  flags: ['gatekey', 'shortcut-open'],
  endingsSeen: [1],
  loreRead: ['crate-note'],
  visionsSeen: ['vision-oath'],
  ngPlus: false,
  greaterVael: { open: true, glitchSeen: [], watcherSightings: 0, maxEmberCap: 5, bargains: [] },
};

/** A minimal, well-formed v1 payload (pre-Greater-Vael) for migration tests. */
const v1Sample = (over: Partial<SaveDataV1> = {}): SaveDataV1 => ({
  version: 1,
  zone: 'great-hall',
  bannerId: 'b',
  embers: 3,
  flags: ['gatekey'],
  endingsSeen: [1],
  loreRead: ['x'],
  visionsSeen: ['v'],
  ngPlus: false,
  ...over,
});

describe('save round-trip', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorageStub());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadGame returns exactly what saveGame stored (v2 round-trips unchanged)', () => {
    saveGame(SAMPLE_V2);
    expect(loadGame()).toEqual(SAMPLE_V2);
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

describe('save schema v2 + v1→v2 migration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorageStub());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('migrateV1toV2 preserves every v1 field and defaults greaterVael', () => {
    const v1 = v1Sample();
    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
    expect(v2).toMatchObject({
      zone: 'great-hall',
      bannerId: 'b',
      embers: 3,
      flags: ['gatekey'],
      endingsSeen: [1],
      loreRead: ['x'],
      visionsSeen: ['v'],
      ngPlus: false,
    });
    // Adopts the live Task-3/5 field names verbatim (`bargains`, not `hagBargains`).
    expect(v2.greaterVael).toEqual({
      open: true,
      maxEmberCap: 5,
      bargains: [],
      watcherSightings: 0,
      glitchSeen: [],
    });
  });

  it('open is false when no ending is seen yet', () => {
    expect(migrateV1toV2(v1Sample({ endingsSeen: [] })).greaterVael?.open).toBe(false);
  });

  it('a beaten-castle v1 save is migrated in place, never discarded', () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        zone: 'summit',
        bannerId: '',
        embers: 5,
        flags: [],
        endingsSeen: [2],
        loreRead: [],
        visionsSeen: [],
        ngPlus: false,
      }),
    );
    const loaded = loadGame();
    expect(loaded?.version).toBe(2);
    expect(loaded?.greaterVael?.open).toBe(true); // endingsSeen > 0
    // Migrated IN PLACE: the stored payload is now v2 for the next load.
    const reStored: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) as string);
    expect((reStored as { version: number }).version).toBe(2);
  });

  it('a v1 save preserves an existing greaterVael ledger through migration (lossless)', () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(
        v1Sample({
          greaterVael: {
            glitchSeen: ['knock'],
            watcherSightings: 3,
            maxEmberCap: 2,
            bargains: ['hag-tithed'],
          },
        }),
      ),
    );
    const loaded = loadGame();
    expect(loaded?.version).toBe(2);
    // Task-3/5 sub-fields carry over untouched; only `open` is newly derived.
    expect(loaded?.greaterVael).toEqual({
      open: true,
      glitchSeen: ['knock'],
      watcherSightings: 3,
      maxEmberCap: 2,
      bargains: ['hag-tithed'],
    });
  });

  it('unknown version (99) still returns null; round-trips a v2 save', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...SAMPLE_V2, version: 99 }));
    expect(loadGame()).toBeNull();
    saveGame(SAMPLE_V2);
    expect(loadGame()).toEqual(SAMPLE_V2);
  });

  it('a v2 save with a malformed greaterVael defaults just that block', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...SAMPLE_V2, greaterVael: 'nope' }));
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded?.zone).toBe('great-hall'); // the rest of the save is intact
    expect(loaded?.embers).toBe(3);
    expect(loaded?.greaterVael).toEqual({
      open: true,
      maxEmberCap: 5,
      bargains: [],
      watcherSightings: 0,
      glitchSeen: [],
    });
  });

  it('secondVigilSave bumps to v2 and DROPS greaterVael so the tithed cap restores', () => {
    const prev: SaveData = {
      ...SAMPLE_V2,
      greaterVael: {
        open: true,
        glitchSeen: ['knock'],
        watcherSightings: 4,
        maxEmberCap: 2, // a Hag tithe lowered the cap this drop
        bargains: ['hag-tithed'],
      },
    };
    const next = secondVigilSave(prev, 5);
    expect(next.version).toBe(2);
    // Dropped → save.greaterVael?.maxEmberCap is undefined → the full brand
    // (TUNING.brand.maxEmbers) is restored on the next load. Task 5 relies on this.
    expect(next.greaterVael).toBeUndefined();
    expect(next.flags).toEqual([]);
    expect(next.endingsSeen).toEqual(prev.endingsSeen);
  });
});
