import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveGame,
  loadGame,
  clearSave,
  migrateV1toV2,
  secondVigilSave,
  greaterVaelCheckpoint,
  SAVE_KEY,
} from '../save';
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
      firedBeatIds: [], // finding 1: one-shot beat ledger, defaulted empty
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
      firedBeatIds: [], // finding 1: absent on the pre-fix ledger ⇒ defaulted empty
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
      firedBeatIds: [], // finding 1: fresh ledger defaults it empty
    });
  });

  it('greaterVaelCheckpoint mirrors the live greater-vael-open flag into `open`', () => {
    // Task 13 (T7 obligation): main.ts checkpoints write the REAL flag state into
    // save.greaterVael.open — no longer an inert field the migration back-fills.
    expect(
      greaterVaelCheckpoint({
        open: true,
        glitchSeen: ['knock'],
        watcherSightings: 2,
        maxEmberCap: 3,
        bargains: ['hag-tithed'],
        firedBeatIds: ['GF-1', 'AF-2'],
      }),
    ).toEqual({
      open: true,
      glitchSeen: ['knock'],
      watcherSightings: 2,
      maxEmberCap: 3,
      bargains: ['hag-tithed'],
      firedBeatIds: ['GF-1', 'AF-2'], // finding 1: banked so a spent beat never re-arms
    });
    // Absent firedBeatIds defaults to an empty array (a pre-fire checkpoint).
    expect(
      greaterVaelCheckpoint({
        open: true, glitchSeen: [], watcherSightings: 0, maxEmberCap: 5, bargains: [],
      }).firedBeatIds,
    ).toEqual([]);
    // A still-sealed postern writes open:false, not an absent field.
    expect(
      greaterVaelCheckpoint({
        open: false,
        glitchSeen: [],
        watcherSightings: 0,
        maxEmberCap: 5,
        bargains: [],
      }).open,
    ).toBe(false);
  });

  it('a v2 save carrying firedBeatIds round-trips unchanged (finding 1 persistence)', () => {
    const data: SaveData = {
      ...SAMPLE_V2,
      greaterVael: greaterVaelCheckpoint({
        open: true,
        glitchSeen: ['knock'],
        watcherSightings: 2,
        maxEmberCap: 4,
        bargains: ['hag-tithed'],
        firedBeatIds: ['GF-1', 'GF-2', 'AF-2'],
      }),
    };
    saveGame(data);
    expect(loadGame()?.greaterVael?.firedBeatIds).toEqual(['GF-1', 'GF-2', 'AF-2']);
  });

  it('greaterVaelCheckpoint copies its arrays (a later source mutation never leaks)', () => {
    const glitchSeen = ['knock'];
    const bargains = ['hag-tithed'];
    const block = greaterVaelCheckpoint({
      open: true,
      glitchSeen,
      watcherSightings: 1,
      maxEmberCap: 4,
      bargains,
    });
    glitchSeen.push('creak');
    bargains.push('curdle');
    expect(block.glitchSeen).toEqual(['knock']);
    expect(block.bargains).toEqual(['hag-tithed']);
  });

  it('a v2 checkpoint block round-trips with NO migration rewrite (no v1↔v2 churn)', () => {
    // The T7 bug: main.ts wrote version:1, loadGame migrated to v2 on read and
    // rewrote in place → the payload oscillated every save/load. A v2 checkpoint
    // must load back byte-identical and leave the stored version at 2.
    const data: SaveData = {
      ...SAMPLE_V2,
      greaterVael: greaterVaelCheckpoint({
        open: true,
        glitchSeen: [],
        watcherSightings: 0,
        maxEmberCap: 5,
        bargains: [],
      }),
    };
    saveGame(data);
    expect(loadGame()).toEqual(data);
    const stored: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) as string);
    expect((stored as { version: number }).version).toBe(2); // not touched by migration
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

describe('doorsOpened (world-expansion v1.2, Task 1)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorageStub());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a far-side unbar round-trips through save/load', () => {
    const data: SaveData = { ...SAMPLE_V2, doorsOpened: ['gate-fields-undercroft:2'] };
    saveGame(data);
    expect(loadGame()).toEqual(data);
    expect(loadGame()?.doorsOpened).toEqual(['gate-fields-undercroft:2']);
  });

  it('a pre-v1.2 save (no doorsOpened) loads clean — absent is valid', () => {
    saveGame(SAMPLE_V2); // no doorsOpened field
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded?.doorsOpened).toBeUndefined(); // load site defaults it to []
  });

  it('a malformed doorsOpened is rejected (never crashes new Set(...))', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...SAMPLE_V2, doorsOpened: 5 }));
    expect(loadGame()).toBeNull();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...SAMPLE_V2, doorsOpened: [1, 2] }));
    expect(loadGame()).toBeNull();
  });

  it('secondVigilSave drops doorsOpened — the castle re-seals, far-side doors re-bar', () => {
    const prev: SaveData = { ...SAMPLE_V2, doorsOpened: ['gate-fields-undercroft:2'] };
    expect(secondVigilSave(prev, 5).doorsOpened).toBeUndefined();
  });
});

describe('echoesWitnessed (world-expansion v1.2, Task 3)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorageStub());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('witnessed echoes round-trip through save/load', () => {
    const data: SaveData = { ...SAMPLE_V2, echoesWitnessed: ['act1-oath', 'act2-burning'] };
    saveGame(data);
    expect(loadGame()).toEqual(data);
    expect(loadGame()?.echoesWitnessed).toEqual(['act1-oath', 'act2-burning']);
  });

  it('a pre-v1.2 save (no echoesWitnessed) loads clean — absent is valid', () => {
    saveGame(SAMPLE_V2); // no echoesWitnessed field
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded?.echoesWitnessed).toBeUndefined(); // load site defaults it to []
  });

  it('a malformed echoesWitnessed is rejected (never crashes new Set(...))', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...SAMPLE_V2, echoesWitnessed: 5 }));
    expect(loadGame()).toBeNull();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...SAMPLE_V2, echoesWitnessed: [1, 2] }));
    expect(loadGame()).toBeNull();
  });

  it('secondVigilSave drops echoesWitnessed — echoes re-arm in NG+', () => {
    const prev: SaveData = { ...SAMPLE_V2, echoesWitnessed: ['act1-oath'] };
    expect(secondVigilSave(prev, 5).echoesWitnessed).toBeUndefined();
  });
});
