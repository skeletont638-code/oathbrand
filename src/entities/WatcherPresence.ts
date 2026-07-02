/**
 * THE WATCHER (Greater Vael Drop 1, Task 5) — the never-killable, never-
 * approaching presence at the edge of sight. It is NOT an `Enemy`/`EnemyKind`:
 * it has no hp, no `takeHit`, no attack, no path toward the player, and it
 * shares NO door/corridor geometry the player can reach. It is a DreadDirector
 * presence — the director owns the budget/cooldown and CALLS `manifest`; this
 * class only renders + repositions the silhouette it is told to show.
 *
 * FSM (from `TUNING.greaterVael.watcher`):
 *   absent → manifest (a dark vertical beyond the far-plane at an authored
 *            anchor, FROZEN while inside the view frustum) → recede/despawn.
 * It recedes when: the player closes within `despawnM` (10 m — simply gone), or
 * `maxVisibleSec` (4 s) elapses. It teleport-repositions to another anchor ONLY
 * while UNOBSERVED — it is never seen mid-stride (`animFps 0`); the tell is that
 * it has MOVED when you look back. Height is the deliberate 3.0 m exception.
 *
 * Its IDENTITY is held for Drop 3: reference the mystery, never the answer.
 */
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Material } from 'three';
import { TUNING } from '../content/tuning';
import { patchMaterial } from '../ps1/patchMaterial';
import type { GridPos } from '../world/zoneDef';
import type { EntityView } from './animator';

const W = TUNING.greaterVael.watcher;
const D = TUNING.greaterVael.dread;

/** A plain XZ pose (the Controller satisfies it). */
export interface Vec2Like {
  x: number;
  z: number;
}
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Whatever can answer "is this world point on screen?". THREE.Frustum satisfies
 * it via `containsPoint`; headless tests inject a `{ contains }` stub. The
 * Watcher freezes while its silhouette is contained (observed) and may only
 * reposition while it is NOT.
 */
export interface ViewTest {
  contains(worldPos: Vec3Like): boolean;
}

export type WatcherState = 'absent' | 'manifest';

export class WatcherPresence {
  private st: WatcherState = 'absent';
  /** Index into `anchors` of the CURRENT stand — advanced on a reposition. */
  private idx = 0;
  private cur: GridPos;
  private visibleMs = 0;
  private observed = false;
  private sightings: number;

  /**
   * @param anchors authored sighting positions (may be off-grid backdrop cells).
   * @param cellM   grid cell size in metres (2), for the anchor→world mapping.
   * @param seedSightings sightings already spent this drop (from the save) —
   *   respected and clamped to the per-drop budget.
   */
  constructor(
    private readonly anchors: GridPos[],
    private readonly cellM: number,
    seedSightings = 0,
  ) {
    this.cur = anchors[0] ?? [0, 0];
    this.sightings = Math.min(D.watcherPerDropMax, Math.max(0, seedSightings));
  }

  get state(): WatcherState {
    return this.st;
  }

  /** True while the silhouette should render. */
  get present(): boolean {
    return this.st === 'manifest';
  }

  /** Sightings spent this drop (never exceeds `watcherPerDropMax`). */
  get visibleSightings(): number {
    return this.sightings;
  }

  /** The anchor it currently stands on. */
  get cell(): GridPos {
    return this.cur;
  }

  /** World-space centre of the current anchor (a 3 m-tall silhouette's mid-body). */
  worldPos(): Vec3Like {
    const [row, col] = this.cur;
    return { x: (col + 0.5) * this.cellM, y: W.heightM * 0.5, z: (row + 0.5) * this.cellM };
  }

  /**
   * Manifest at `anchor` (a DreadDirector `watcher` activation). Counts one
   * sighting (clamped to the budget) and stands FROZEN. `observed` seeds whether
   * the anchor is currently in view; `update` refreshes it from the live frustum.
   */
  manifest(anchor: GridPos, observed = false): void {
    this.cur = anchor;
    const i = this.anchors.findIndex(([r, c]) => r === anchor[0] && c === anchor[1]);
    this.idx = i < 0 ? 0 : i;
    this.st = 'manifest';
    this.visibleMs = 0;
    this.observed = observed;
    this.sightings = Math.min(D.watcherPerDropMax, this.sightings + 1);
  }

  /**
   * Per frame while manifest: recede when the player closes within `despawnM`
   * or `maxVisibleSec` elapses; otherwise teleport-reposition ONLY on the
   * observed → unobserved EDGE — one deliberate step the instant the gaze
   * leaves it, never a per-frame cycle (the anchor it is found on must not
   * depend on how many frames the player looked away). Never moves toward the
   * player — it only ever jumps between authored anchors.
   */
  update(dtMs: number, playerPos: Vec2Like, view: ViewTest): void {
    if (this.st !== 'manifest') return;
    this.visibleMs += dtMs;
    const wp = this.worldPos();
    const was = this.observed;
    this.observed = view.contains(wp);
    const distM = Math.hypot(playerPos.x - wp.x, playerPos.z - wp.z);
    // Despawn wins even while observed: get close and it is simply gone.
    if (distM <= W.despawnM) return this.recede();
    // Hard cap: after maxVisibleSec it auto-recedes regardless of gaze.
    if (this.visibleMs >= W.maxVisibleSec * 1000) return this.recede();
    // The tell: it steps once, in the instant your attention leaves it.
    if (was && !this.observed) this.reposition();
  }

  /** Dismiss without a sighting refund — main calls this on every zone entry,
   *  so a manifest never leaks across a zone transition (views are zone-scoped;
   *  a stale manifest would otherwise pop back in on re-entry, unpaid-for). */
  dismiss(): void {
    this.st = 'absent';
  }

  private reposition(): void {
    if (this.anchors.length === 0) return;
    this.idx = (this.idx + 1) % this.anchors.length;
    this.cur = this.anchors[this.idx];
  }

  private recede(): void {
    this.st = 'absent';
  }
}

// ---------------------------------------------------------------------------
// View: a flat-black, unlit vertical silhouette — a too-tall thin humanoid
// (~3.0 m) built from dark boxes, run through the same PS1 material patch the
// zones use, `fog:true` so it reads as a DARK VERTICAL dissolving into the fog
// gradient rather than a lit body. It is `animFps 0` — never posed, never
// stepped: the view only syncs visibility + world position from the presence.
// No texture, no new light. The shape is deliberately a clean COLUMN so its
// silhouette can never be mistaken for the Hag's stooped one.
// ---------------------------------------------------------------------------

function darkMat(sink: MeshStandardMaterial[]): MeshStandardMaterial {
  // Pure black diffuse + black emissive → reflects no light → an unlit
  // silhouette under any zone ambient; fog tints it toward the sky horizon.
  const mat = new MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0 });
  mat.emissive = new Color(0x000000);
  patchMaterial(mat);
  sink.push(mat);
  return mat;
}

function box(w: number, h: number, d: number, mat: Material): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), mat);
}

/** Build the ~3.0 m column-humanoid. y=0 is the ground; it rises to heightM. */
function buildWatcher(mats: MeshStandardMaterial[]): Group {
  const g = new Group();
  const H = W.heightM; // 3.0
  // A single unnaturally long, thin trunk (legs fused) — most of the height.
  const legLen = H * 0.58;
  const legs = box(0.34, legLen, 0.26, darkMat(mats));
  legs.position.set(0, legLen / 2, 0);
  g.add(legs);
  // A narrow torso, barely wider than the trunk — the frame stays a column.
  const torsoH = H * 0.26;
  const torso = box(0.5, torsoH, 0.3, darkMat(mats));
  torso.position.set(0, legLen + torsoH / 2, 0);
  g.add(torso);
  // A long thin neck.
  const neckH = H * 0.1;
  const neck = box(0.14, neckH, 0.14, darkMat(mats));
  neck.position.set(0, legLen + torsoH + neckH / 2, 0);
  g.add(neck);
  // A small crunched head capping the column — no readable face at distance.
  const head = box(0.28, H * 0.06, 0.26, darkMat(mats));
  head.position.set(0, legLen + torsoH + neckH + H * 0.03, 0);
  g.add(head);
  return g;
}

export class WatcherView implements EntityView {
  readonly root: Group;
  private readonly figure: Group;
  private readonly mats: MeshStandardMaterial[] = [];

  constructor(private readonly watcher: WatcherPresence) {
    this.root = new Group();
    this.root.name = 'watcher';
    this.figure = buildWatcher(this.mats);
    this.root.add(this.figure);
    this.root.visible = false;
  }

  /** Sync visibility + position only — the Watcher is never animated. */
  update(_dtMs: number): void {
    const present = this.watcher.present;
    this.root.visible = present;
    if (!present) return;
    const wp = this.watcher.worldPos();
    this.root.position.set(wp.x, 0, wp.z);
  }

  dispose(): void {
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}
