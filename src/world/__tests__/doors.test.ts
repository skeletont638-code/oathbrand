import { describe, it, expect } from 'vitest';
import {
  collectDoors,
  doorEdgeId,
  isBarred,
  resolveDoorInstances,
  type DoorInstance,
} from '../doors';
import type { ZoneDef, ZoneDoorDef } from '../zoneDef';
import type { ZoneId } from '../../content/types';

/** Minimal ZoneDef; callers override grid/doors/gateDoors. */
function zone(id: ZoneId, partial: Partial<ZoneDef>): ZoneDef {
  return {
    id,
    grid: ['###', '#.#', '###'],
    cell: 2,
    tiles: {},
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
    ...partial,
  };
}

/** A DoorInstance built by hand (for the isBarred truth table). */
function instance(over: Partial<DoorInstance> = {}): DoorInstance {
  return {
    edgeId: 'a-b:1',
    label: 'Iron Door',
    definedIn: 'undercroft',
    gate: '1',
    lockedFarSide: false,
    ...over,
  };
}

describe('doorEdgeId', () => {
  it('orders the two zone ids lexicographically (brief example)', () => {
    // 'gateFields' < 'undercroft', so the id sorts the same either way.
    expect(doorEdgeId('undercroft', 'gateFields', '2')).toBe('gateFields-undercroft:2');
    expect(doorEdgeId('gateFields', 'undercroft', '2')).toBe('gateFields-undercroft:2');
  });

  it('is stable regardless of argument order (kebab ids)', () => {
    expect(doorEdgeId('great-hall', 'undercroft', '1')).toBe('great-hall-undercroft:1');
    expect(doorEdgeId('undercroft', 'great-hall', '1')).toBe('great-hall-undercroft:1');
  });

  it('appends the gate digit verbatim', () => {
    expect(doorEdgeId('a', 'b', '9')).toBe('a-b:9');
  });
});

describe('collectDoors', () => {
  // undercroft's '2' gate → the Postern into the Fields; declared far-side.
  const postern: ZoneDoorDef = { gate: '2', label: 'Postern Gate', locked: 'far-side' };
  const undercroft = zone('undercroft', {
    grid: ['#2#', '#.#', '###'],
    doors: [{ id: 'uc-postern', at: [0, 1], to: 'gate-fields', pair: 'postern' }],
    gateDoors: [postern],
  });
  const gateFields = zone('gate-fields', {
    grid: ['#5#', '#.#', '###'],
    doors: [{ id: 'gf-postern', at: [0, 1], to: 'undercroft', pair: 'postern' }],
  });

  it('builds one edge-keyed DoorInstance per gateDoors entry', () => {
    const map = collectDoors([undercroft, gateFields]);
    expect(map.size).toBe(1);
    const inst = map.get('gate-fields-undercroft:2');
    expect(inst).toBeDefined();
    expect(inst).toMatchObject({
      edgeId: 'gate-fields-undercroft:2',
      label: 'Postern Gate',
      definedIn: 'undercroft',
      gate: '2',
      lockedFarSide: true,
    });
  });

  it('an unlocked door reports lockedFarSide false', () => {
    const a = zone('great-hall', {
      grid: ['#1#', '#.#', '###'],
      doors: [{ id: 'gh-stair', at: [0, 1], to: 'undercroft' }],
      gateDoors: [{ gate: '1', label: 'Stair Door' }],
    });
    const b = zone('undercroft', {
      grid: ['#1#', '#.#', '###'],
      doors: [{ id: 'uc-stair', at: [0, 1], to: 'great-hall' }],
    });
    const inst = collectDoors([a, b]).get('great-hall-undercroft:1');
    expect(inst?.lockedFarSide).toBe(false);
  });

  it('throws when two zones both define a door for the same edge', () => {
    const a = zone('undercroft', {
      grid: ['#2#', '#.#', '###'],
      doors: [{ id: 'uc-postern', at: [0, 1], to: 'gate-fields', pair: 'postern' }],
      gateDoors: [postern],
    });
    const b = zone('gate-fields', {
      grid: ['#2#', '#.#', '###'],
      doors: [{ id: 'gf-postern', at: [0, 1], to: 'undercroft', pair: 'postern' }],
      gateDoors: [{ gate: '2', label: 'Postern Gate' }], // duplicate on the same edge
    });
    expect(() => collectDoors([a, b])).toThrow(/duplicate|edge/i);
  });

  it('throws when a gateDoors entry names a gate digit with no matching door', () => {
    const a = zone('undercroft', {
      grid: ['#2#', '#.#', '###'],
      doors: [{ id: 'uc-postern', at: [0, 1], to: 'gate-fields' }],
      gateDoors: [{ gate: '7', label: 'Nowhere Door' }], // no door on gate '7'
    });
    expect(() => collectDoors([a])).toThrow(/gate|'7'/i);
  });

  it('ignores zones with no gateDoors (v1 zones — open borders)', () => {
    const plain = zone('great-hall', {
      grid: ['#1#', '#.#', '###'],
      doors: [{ id: 'gh-x', at: [0, 1], to: 'undercroft' }],
    });
    expect(collectDoors([plain]).size).toBe(0);
  });
});

describe('isBarred (truth table)', () => {
  const opened = new Set<string>();

  it('an unlocked door is NEVER barred, from either side', () => {
    const d = instance({ lockedFarSide: false, definedIn: 'undercroft' });
    expect(isBarred(d, 'undercroft', opened)).toBe(false);
    expect(isBarred(d, 'gate-fields', opened)).toBe(false);
  });

  it('the DEFINING side always passes a far-side door', () => {
    const d = instance({ lockedFarSide: true, definedIn: 'undercroft', edgeId: 'gate-fields-undercroft:2' });
    expect(isBarred(d, 'undercroft', opened)).toBe(false);
  });

  it('the FAR side is barred while unopened', () => {
    const d = instance({ lockedFarSide: true, definedIn: 'undercroft', edgeId: 'gate-fields-undercroft:2' });
    expect(isBarred(d, 'gate-fields', opened)).toBe(true);
  });

  it('the FAR side passes once the edge has been opened', () => {
    const d = instance({ lockedFarSide: true, definedIn: 'undercroft', edgeId: 'gate-fields-undercroft:2' });
    expect(isBarred(d, 'gate-fields', new Set(['gate-fields-undercroft:2']))).toBe(false);
  });
});

describe('resolveDoorInstances', () => {
  const undercroft = zone('undercroft', {
    grid: ['#2#', '#.#', '###'],
    doors: [{ id: 'uc-postern', at: [0, 1], to: 'gate-fields', pair: 'postern' }],
    gateDoors: [{ gate: '2', label: 'Postern Gate', locked: 'far-side' }],
  });
  const gateFields = zone('gate-fields', {
    grid: ['#5#', '#.#', '###'],
    doors: [{ id: 'gf-postern', at: [0, 1], to: 'undercroft', pair: 'postern' }],
  });

  it('maps BOTH ends of a decorated edge (defining + far) to the same instance', () => {
    const byId = resolveDoorInstances([undercroft, gateFields]);
    const a = byId.get('uc-postern');
    const b = byId.get('gf-postern');
    expect(a).toBeDefined();
    expect(a).toBe(b); // same DoorInstance object on both ends
    expect(a?.definedIn).toBe('undercroft');
    expect(a?.edgeId).toBe('gate-fields-undercroft:2');
  });

  it('the far-end door def is barred from its own zone until the edge opens', () => {
    const byId = resolveDoorInstances([undercroft, gateFields]);
    const inst = byId.get('gf-postern')!;
    // gf-postern lives in gate-fields (the far side) → barred before opening.
    expect(isBarred(inst, 'gate-fields', new Set())).toBe(true);
    // uc-postern lives in undercroft (the defining side) → always passes.
    expect(isBarred(byId.get('uc-postern')!, 'undercroft', new Set())).toBe(false);
  });
});
