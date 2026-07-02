/**
 * Grid collision — circle vs tile AABBs, pure 2D top-down math.
 * NO three.js imports: must run in vitest without WebGL.
 *
 * World mapping: cell size is `def.cell` meters (always 2). Grid row 0
 * covers z ∈ [0, cell), col 0 covers x ∈ [0, cell). y (up) is handled by
 * the zone floor height elsewhere.
 */
import type { ZoneDef, TileKind } from './zoneDef';

/** Top-down position; x/z match three.js world XZ (y is up, handled elsewhere). */
export interface Vec2 {
  x: number;
  z: number;
}

/** Collision meaning of a grid char (built-ins first, then zone `tiles`). */
function tileKind(ch: string, tiles: Record<string, TileKind>): TileKind {
  switch (ch) {
    case '#':
      return 'wall';
    case '.':
    case 'B': // banner
    case 'S': // player spawn
    case 'D': // door anchor
      return 'floor';
    case '~':
      return 'void';
  }
  if (ch >= '1' && ch <= '9') return 'floor'; // bare-digit door anchor
  // Zone-specific letters (K, W, V, …); unmapped chars fail closed as wall.
  return tiles[ch] ?? 'wall';
}

export class GridCollider {
  private readonly cell: number;
  private readonly rows: number;
  private readonly cols: number;
  /** solid[row][col] — true blocks movement and sight. */
  private readonly solid: boolean[][];

  constructor(def: ZoneDef) {
    this.cell = def.cell;
    this.rows = def.grid.length;
    this.cols = def.grid.reduce((m, row) => Math.max(m, row.length), 0);
    this.solid = def.grid.map((row) =>
      Array.from({ length: this.cols }, (_, col) => {
        const ch = row[col];
        // Short rows fail closed: missing cells are solid.
        return ch === undefined ? true : tileKind(ch, def.tiles) === 'wall';
      }),
    );
  }

  /** Out-of-bounds is solid — nothing leaves the grid. */
  private isSolid(row: number, col: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true;
    return this.solid[row][col];
  }

  /**
   * Toggle a single cell's solidity at runtime — the throne arena gate (Task
   * 15) seals a floor doorway behind the player, then re-opens it. Out-of-range
   * cells are ignored. Movement AND sight (`raycastWall`) respect the change.
   */
  setSolid(row: number, col: number, solid: boolean): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    this.solid[row][col] = solid;
  }

  /**
   * Move a circle by `delta`, sliding along walls. Axis-separated (X then
   * Z per substep) so contact with a wall preserves tangential motion and
   * absorbs only the normal component. Substeps whenever |delta| > radius
   * so a single large step cannot tunnel through a wall tile.
   */
  slide(pos: Vec2, delta: Vec2, radius: number): Vec2 {
    const p: Vec2 = { x: pos.x, z: pos.z };
    const len = Math.hypot(delta.x, delta.z);
    if (len === 0) return p;
    const steps = len > radius ? Math.ceil(len / radius) : 1;
    const sx = delta.x / steps;
    const sz = delta.z / steps;
    for (let i = 0; i < steps; i++) {
      this.moveAxis(p, sx, 'x', radius);
      this.moveAxis(p, sz, 'z', radius);
    }
    return p;
  }

  /** Advance one axis by `d`, pushing the circle out of any solid tile. */
  private moveAxis(p: Vec2, d: number, axis: 'x' | 'z', radius: number): void {
    if (d === 0) return;
    p[axis] += d;
    const c = this.cell;
    const minCol = Math.floor((p.x - radius) / c);
    const maxCol = Math.floor((p.x + radius) / c);
    const minRow = Math.floor((p.z - radius) / c);
    const maxRow = Math.floor((p.z + radius) / c);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!this.isSolid(row, col)) continue;
        const x0 = col * c;
        const x1 = x0 + c;
        const z0 = row * c;
        const z1 = z0 + c;
        // Circle vs AABB: closest point on the tile to the circle center.
        const dx = p.x - Math.min(Math.max(p.x, x0), x1);
        const dz = p.z - Math.min(Math.max(p.z, z0), z1);
        if (dx * dx + dz * dz >= radius * radius) continue;
        // Resolve along the moved axis only, just enough to break contact
        // (sqrt term keeps corners round instead of snagging a full radius).
        if (axis === 'x') {
          const off = Math.sqrt(Math.max(0, radius * radius - dz * dz));
          p.x = d > 0 ? x0 - off : x1 + off;
        } else {
          const off = Math.sqrt(Math.max(0, radius * radius - dx * dx));
          p.z = d > 0 ? z0 - off : z1 + off;
        }
      }
    }
  }

  /**
   * True if the open segment a→b crosses any wall tile (Amanatides–Woo
   * grid traversal). Void and floor never block; out-of-bounds does.
   */
  raycastWall(a: Vec2, b: Vec2): boolean {
    const c = this.cell;
    let col = Math.floor(a.x / c);
    let row = Math.floor(a.z / c);
    const colEnd = Math.floor(b.x / c);
    const rowEnd = Math.floor(b.z / c);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const stepCol = dx > 0 ? 1 : -1;
    const stepRow = dz > 0 ? 1 : -1;
    let tMaxX = dx !== 0 ? ((dx > 0 ? col + 1 : col) * c - a.x) / dx : Infinity;
    let tMaxZ = dz !== 0 ? ((dz > 0 ? row + 1 : row) * c - a.z) / dz : Infinity;
    const tDeltaX = dx !== 0 ? Math.abs(c / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(c / dz) : Infinity;
    // The segment visits at most |Δcol| + |Δrow| + 1 cells.
    const maxSteps = Math.abs(colEnd - col) + Math.abs(rowEnd - row);
    for (let i = 0; i <= maxSteps; i++) {
      if (this.isSolid(row, col)) return true;
      if (col === colEnd && row === rowEnd) return false;
      if (tMaxX < tMaxZ) {
        col += stepCol;
        tMaxX += tDeltaX;
      } else {
        row += stepRow;
        tMaxZ += tDeltaZ;
      }
    }
    return false;
  }
}
