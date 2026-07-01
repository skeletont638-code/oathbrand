import { describe, it, expect } from 'vitest';
import { gridToPlacements } from '../ZoneBuilder';
import type { ZoneDef, TileKind } from '../zoneDef';

const HALF_PI = Math.PI / 2;

function zone(grid: string[], tiles: Record<string, TileKind> = {}): ZoneDef {
  return {
    id: 'ashen-gate',
    grid,
    cell: 2,
    tiles,
    props: [],
    lights: [],
    enemies: [],
    lore: [],
    doors: [],
    ambience: [],
  };
}

describe('gridToPlacements', () => {
  it('3x3 room yields 8 walls facing inward + 1 floor', () => {
    const p = gridToPlacements(zone(['###', '#.#', '###']));
    const walls = p.filter((x) => x.piece === 'wall');
    const floors = p.filter((x) => x.piece === 'floor');
    expect(walls).toHaveLength(8);
    expect(floors).toHaveLength(1);
    expect(p).toHaveLength(9);

    // Floor sits at its cell center (cell 2m; row 1/col 1 center = (3, 3)).
    expect(floors[0]).toEqual({ piece: 'floor', x: 3, z: 3, rotY: 0 });

    // Edge walls face the open center cell (rotY = atan2(dx, dz) toward it)
    // and sit flush against the shared cell boundary: 2m cell, 0.5m-thick
    // wall (1m GLB at 0.5 kit scale) -> center offset 0.75m toward the open
    // neighbor, so the wall face lands exactly on the collider boundary.
    expect(walls).toContainEqual({ piece: 'wall', x: 3, z: 1.75, rotY: 0 }); // north wall faces +z
    expect(walls).toContainEqual({ piece: 'wall', x: 3, z: 4.25, rotY: Math.PI }); // south faces -z
    expect(walls).toContainEqual({ piece: 'wall', x: 1.75, z: 3, rotY: HALF_PI }); // west faces +x
    expect(walls).toContainEqual({ piece: 'wall', x: 4.25, z: 3, rotY: -HALF_PI }); // east faces -x

    // Corner walls have no orthogonal open neighbor: they face the open
    // diagonal's z-component (still "inward"), centered in their cell.
    expect(walls).toContainEqual({ piece: 'wall', x: 1, z: 1, rotY: 0 });
    expect(walls).toContainEqual({ piece: 'wall', x: 5, z: 1, rotY: 0 });
    expect(walls).toContainEqual({ piece: 'wall', x: 1, z: 5, rotY: Math.PI });
    expect(walls).toContainEqual({ piece: 'wall', x: 5, z: 5, rotY: Math.PI });
  });

  it('door digit yields a wall-door oriented across the passage, centered', () => {
    const p = gridToPlacements(zone(['#1#', '#.#', '###']));
    const doors = p.filter((x) => x.piece === 'wall-door');
    expect(doors).toHaveLength(1);
    // Faces the open floor cell to its south (+z), centered so the player
    // can walk through the opening.
    expect(doors[0]).toEqual({ piece: 'wall-door', x: 3, z: 1, rotY: 0 });
    // Door cells are walkable, so ground is placed under the doorway too.
    expect(p).toContainEqual({ piece: 'floor', x: 3, z: 1, rotY: 0 });
  });

  it("'D' is accepted as a door anchor like a digit", () => {
    const p = gridToPlacements(zone(['#D#', '#.#', '###']));
    expect(p.filter((x) => x.piece === 'wall-door')).toHaveLength(1);
  });

  it('unknown char throws with zone id and [row,col]', () => {
    expect(() => gridToPlacements(zone(['###', '#?#', '###']))).toThrowError(/ashen-gate/);
    expect(() => gridToPlacements(zone(['###', '#?#', '###']))).toThrowError(/\[1,1\]/);
    expect(() => gridToPlacements(zone(['###', '#?#', '###']))).toThrowError(/\?/);
  });

  it('zone-specific tile letters resolve through def.tiles', () => {
    // 'K' declared as wall, 'W' as floor: K behaves like '#', W like '.'.
    const p = gridToPlacements(zone(['KKK', 'KWK', 'KKK'], { K: 'wall', W: 'floor' }));
    expect(p.filter((x) => x.piece === 'wall')).toHaveLength(8);
    expect(p.filter((x) => x.piece === 'floor')).toHaveLength(1);
  });

  it('void cells get no floor piece (pits stay open)', () => {
    const p = gridToPlacements(zone(['###', '#~#', '###']));
    expect(p.filter((x) => x.piece === 'floor')).toHaveLength(0);
  });

  it('fully buried wall cells emit no geometry', () => {
    const p = gridToPlacements(zone(['#####', '#...#', '#.#.#', '#...#', '#####']));
    const walls = p.filter((x) => x.piece === 'wall');
    // 16 perimeter cells (4 corners face diagonals, 12 edges face the floor
    // ring) + the center pillar cell -> 17 wall placements, none skipped.
    expect(walls).toHaveLength(17);
    // Center pillar (row 2, col 2) faces its first open neighbor (north),
    // flush-offset 0.75 toward it: (5, 4.25).
    expect(walls).toContainEqual({ piece: 'wall', x: 5, z: 4.25, rotY: Math.PI });
    // ...but a 1x1 grid of just '#' has no open neighbor at all:
    expect(gridToPlacements(zone(['#']))).toHaveLength(0);
  });

  it('spawn and banner anchors are walkable floor', () => {
    const p = gridToPlacements(zone(['###', '#S#', '#B#', '###']));
    expect(p.filter((x) => x.piece === 'floor')).toHaveLength(2);
  });
});
