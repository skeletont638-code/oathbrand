/**
 * THE HAG OF THE FOG-LINE (Greater Vael Drop 1, Task 5) — a never-fighting,
 * never-chasing presence. NOT an `Enemy`/`EnemyKind`: no hp, no `takeHit`, no
 * attack, no pursuit. She is SILENT — she communicates only through carved
 * inscriptions + gesture (the Ash-Priest stays the only VOICE in the world);
 * `main.ts` surfaces her bargain through the inscription/prompt surfaces and
 * the pure `content/hagBargain.ts` state machine.
 *
 * FSM (from `TUNING.greaterVael.hag`):
 *   absent → glimpsed (at the fog-line; recedes the instant the player
 *            approaches within `recedeM` 10 — the same contract as the Watcher)
 *          → threshold-present (standing at the cairn `hagThreshold.at`, where
 *            the bargain is available; there she does NOT recede).
 *
 * Her silhouette is a STOOPED WOMAN (2.5 m, bent) — visually distinct from the
 * Watcher's tall vertical column.
 */
import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { TUNING } from '../content/tuning';
import { patchMaterial } from '../ps1/patchMaterial';
import type { GridPos, HagThresholdDef } from '../world/zoneDef';
import { steppedTime } from './animator';
import type { EntityView } from './animator';
import type { Vec2Like, Vec3Like } from './WatcherPresence';
import { HAG_TINT } from './palette';
import { blobHead, centredCapsule, latheShape } from './organic';

const HG = TUNING.greaterVael.hag;

export type HagPhase = 'absent' | 'glimpsed' | 'threshold';

export class HagPresence {
  private st: HagPhase = 'absent';
  private cur: GridPos;

  constructor(
    private readonly threshold: HagThresholdDef,
    private readonly cellM: number,
  ) {
    this.cur = this.glimpseCell();
  }

  get state(): HagPhase {
    return this.st;
  }

  /** True while she should render (glimpsed at the fog-line OR at the cairn). */
  get present(): boolean {
    return this.st !== 'absent';
  }

  /** The cell she currently stands on. */
  get cell(): GridPos {
    return this.cur;
  }

  /** World-space centre of her current stand (mid-body of a 2.5 m silhouette). */
  worldPos(): Vec3Like {
    const [row, col] = this.cur;
    return { x: (col + 0.5) * this.cellM, y: HG.heightM * 0.5, z: (row + 0.5) * this.cellM };
  }

  /** True while the player stands on the cairn — the bargain is available. */
  atThreshold(playerCell: GridPos): boolean {
    return playerCell[0] === this.threshold.at[0] && playerCell[1] === this.threshold.at[1];
  }

  /** A DreadDirector `hag-glimpse`: she appears at the fog-line, receding. */
  glimpse(): void {
    if (this.st === 'threshold') return; // at the cairn she is already present
    this.st = 'glimpsed';
    this.cur = this.glimpseCell();
  }

  /**
   * Per frame: at the cairn she is threshold-present (never recedes there);
   * else, once glimpsed, she recedes the moment the player approaches within
   * `recedeM`. She NEVER steps toward the player — she only ever stands at the
   * fog-line or the cairn.
   */
  update(playerPos: Vec2Like, playerCell: GridPos): void {
    if (this.atThreshold(playerCell)) {
      this.st = 'threshold';
      this.cur = this.threshold.at;
      return;
    }
    if (this.st === 'threshold') {
      // Stepped off the cairn: back to a fog-line glimpse (still present).
      this.st = 'glimpsed';
      this.cur = this.glimpseCell();
    }
    if (this.st === 'glimpsed') {
      const wp = this.worldPos();
      const distM = Math.hypot(playerPos.x - wp.x, playerPos.z - wp.z);
      if (distM <= HG.recedeM) this.st = 'absent';
    }
  }

  private glimpseCell(): GridPos {
    return this.threshold.glimpseCells[0] ?? this.threshold.at;
  }
}

// ---------------------------------------------------------------------------
// View: a flat-black, unlit STOOPED-WOMAN silhouette (~2.5 m unbent), built
// from dark boxes and run through the same PS1 material patch, `fog:true`. A
// wide low robe + a forward-hunched upper back + a bowed hooded head + a long
// staff to the ground — so the flat-black shape at 16 m reads as a stooped
// woman, NEVER the Watcher's tall column. `animFps 12` per tuning, but her
// idle is a near-imperceptible sway; the view only breathes, never walks.
// No texture, no new light.
// ---------------------------------------------------------------------------

function darkMat(sink: MeshStandardMaterial[]): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: HAG_TINT, roughness: 1, metalness: 0 });
  mat.emissive = new Color(0x000000);
  patchMaterial(mat);
  sink.push(mat);
  return mat;
}

/** Build the stooped crone. y=0 is the ground. Exported for the C1 tests. */
export function buildHag(mats: MeshStandardMaterial[]): { root: Group; hunch: Group } {
  const root = new Group();
  // The A-line robe as ONE lathe — a wide hem sweeping to a narrow waist
  // (a woman's skirted silhouette, unmistakably not the Watcher's column).
  const robe = new Mesh(
    latheShape([[0.5, 0], [0.44, 0.35], [0.3, 0.72], [0.24, 0.95], [0.26, 1.12]]),
    darkMat(mats),
  );
  root.add(robe);

  // The hunch: SAME pivot, SAME base pitch — HagView sways this group.
  const hunch = new Group();
  hunch.position.set(0, 1.08, 0);
  hunch.rotation.x = 0.95;
  root.add(hunch);

  // The humped upper back — a bent-read capsule, thick at the shoulders.
  const backT = new Mesh(centredCapsule(0.24, 0.18, 0.72), darkMat(mats));
  backT.position.set(0, 0.36, 0);
  hunch.add(backT);
  // The shawl bulk — a squashed seeded blob, the top of the hump.
  const shawl = new Mesh(blobHead(0.3, 0x9c1).scale(1.15, 0.55, 0.9), darkMat(mats));
  shawl.position.set(0, 0.64, 0.02);
  hunch.add(shawl);
  // Bowed, hooded head — low and pushed forward past the shoulders.
  const head = new Mesh(blobHead(0.17, 0x44d), darkMat(mats));
  head.position.set(0, 0.82, 0.16);
  hunch.add(head);

  // The long staff — a thin ROUNDED rod planted at her side.
  const staff = new Mesh(new CylinderGeometry(0.025, 0.035, 1.7, 6, 1), darkMat(mats));
  staff.position.set(0.46, 0.85, 0.16);
  staff.rotation.x = 0.12;
  root.add(staff);

  return { root, hunch };
}

export class HagView implements EntityView {
  readonly root: Group;
  private readonly figure: Group;
  private readonly hunch: Group;
  private readonly mats: MeshStandardMaterial[] = [];
  private readonly baseHunchX: number;
  private clock = 0;

  constructor(private readonly hag: HagPresence) {
    this.root = new Group();
    this.root.name = 'hag';
    const built = buildHag(this.mats);
    this.figure = built.root;
    this.hunch = built.hunch;
    this.baseHunchX = this.hunch.rotation.x;
    this.root.add(this.figure);
    this.root.visible = false;
  }

  update(dtMs: number): void {
    const present = this.hag.present;
    this.root.visible = present;
    if (!present) return;
    const wp = this.hag.worldPos();
    this.root.position.set(wp.x, 0, wp.z);
    // A near-imperceptible breathing sway — she waits, she never walks. Sampled
    // off `steppedTime` (12 fps) like the sibling tall-entity views, so her pose
    // pops at the wrong tempo while the world renders smooth.
    this.clock += dtMs / 1000;
    const stepped = steppedTime(this.clock, HG.animFps);
    this.hunch.rotation.x = this.baseHunchX + Math.sin(stepped * 0.9) * 0.03;
  }

  dispose(): void {
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}
