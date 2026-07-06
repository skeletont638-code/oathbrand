/**
 * EchoScene engine (world-expansion v1.2, Task 3) — the silent apparition
 * replays that carry the three-act story. Trigger cells arm; when the player
 * steps onto one, translucent ghost actors (entity rigs + the vision-ghost
 * material) fade in, play a staged, wordless ~10–20 s moment, and fade out.
 * The player NEVER loses control; the brand pulses while a scene is live.
 *
 * PURE MATH — no three.js, no DOM. `main.ts` owns the renderer adapter (pooled
 * ghost meshes per rig kind) and feeds this system `update(dtMs, playerCell)`
 * each frame, then reads `activeActors()` to place/tint the meshes. This keeps
 * the timeline + trigger logic vitest-testable without WebGL, mirroring the
 * DreadDirector / VisionPlayer split already in the codebase.
 *
 * Persistence: each scene marks `echoesWitnessed` (additive save field) via the
 * injected `onWitness` the instant it fires, so it plays once per run. NG+
 * (`secondVigilSave` drops the field) hands this system a fresh empty
 * `witnessed` set ⇒ every scene re-arms — the one and only replay condition.
 */
import type { GridPos } from '../world/zoneDef';

/**
 * One apparition in a scene. `king`/`queen`/`knight` are the base rigs restyled
 * by the renderer (king = soldier + crown + pale tint, queen = kneeler + pale
 * tint, knight = soldier untinted); the engine passes the rig name through
 * untouched. Position is authored in grid cells; the engine converts to world
 * XZ. A stationary actor omits `keyframes`; a walking one lists cells + times.
 */
export interface EchoActorDef {
  rig: 'soldier' | 'archer' | 'kneeler' | 'king' | 'queen' | 'knight';
  at: GridPos;
  facing?: number;
  /** Linear walk: the actor lerps between keyframed cells (and facings) over
   *  time. An implicit keyframe at tMs 0 holds the base `at`/`facing`. */
  keyframes?: { tMs: number; at?: GridPos; facing?: number }[];
}

/** A whole staged moment. `id` is the string persisted in `echoesWitnessed`. */
export interface EchoSceneDef {
  id: string; // e.g. 'act1-oath'
  zone: string; // zone id it plays in
  act: 1 | 2 | 3;
  triggerCells: GridPos[]; // player enters any → scene starts (once per run)
  durationMs: number; // 10000-20000
  actors: EchoActorDef[];
}

/** What the renderer consumes for one live apparition, in world space. */
export interface EchoActorState {
  rig: string;
  x: number;
  z: number;
  facing: number;
  opacity: number;
}

interface EchoSceneDeps {
  /** Ids witnessed already (seeded from the save; shared + mutated in place so
   *  the checkpoint write sees new witnesses). Empty in NG+ ⇒ every scene re-arms. */
  witnessed: Set<string>;
  /** Called once, the instant a scene fires, with its id (main appends it to
   *  the live `echoesWitnessed` set so the next checkpoint persists it). */
  onWitness(id: string): void;
  /** Pulse the brand — invoked every frame a scene is live. Main wires this to
   *  the existing brand-pulse channel; the engine never touches player internals. */
  brandPulse(): void;
}

/** Grid cell size in metres (mirrors DreadDirector CELL_M / ZoneBuilder cellM). */
const CELL_M = 2;

/** Fade envelope: 1.5 s in → hold → 1.5 s out. */
export const ECHO_FADE_MS = 1500;
/** Peak apparition opacity — a memory, never solid. */
export const ECHO_PEAK_OPACITY = 0.45;

/**
 * Whole-scene fade opacity at `tMs` into a `durationMs` scene: 0 → peak over
 * the first 1.5 s, hold at the peak, peak → 0 over the last 1.5 s. `Math.min`
 * of the two ramps means a scene shorter than 2·fade never over-brightens — the
 * ramps meet below the peak instead of clipping. Clamped to [0, peak].
 */
export function echoOpacity(tMs: number, durationMs: number): number {
  if (tMs <= 0 || tMs >= durationMs) return 0;
  const rise = Math.min(tMs, ECHO_FADE_MS) / ECHO_FADE_MS;
  const fall = Math.min(durationMs - tMs, ECHO_FADE_MS) / ECHO_FADE_MS;
  return ECHO_PEAK_OPACITY * Math.min(rise, fall);
}

/** A resolved keyframe: concrete cell + facing at a point in scene time. */
interface Keyframe {
  tMs: number;
  row: number;
  col: number;
  facing: number;
}

/** Build the actor's full timeline: an implicit t=0 keyframe (its base pose)
 *  followed by the authored keyframes, sorted, each inheriting the prior cell /
 *  facing for any field it omits. */
function timeline(actor: EchoActorDef): Keyframe[] {
  const frames: Keyframe[] = [
    { tMs: 0, row: actor.at[0], col: actor.at[1], facing: actor.facing ?? 0 },
  ];
  const authored = [...(actor.keyframes ?? [])].sort((a, b) => a.tMs - b.tMs);
  for (const kf of authored) {
    const prev = frames[frames.length - 1];
    frames.push({
      tMs: kf.tMs,
      row: kf.at ? kf.at[0] : prev.row,
      col: kf.at ? kf.at[1] : prev.col,
      facing: kf.facing ?? prev.facing,
    });
  }
  return frames;
}

/**
 * The actor's world pose at `tMs`: linearly interpolate cell + facing between
 * the bracketing keyframes (clamped to the first/last outside the range), then
 * convert the cell to world XZ (cell centre · CELL_M). Pure — exported for the
 * keyframe-math tests and reused by `activeActors`.
 */
export function actorPoseAt(
  actor: EchoActorDef,
  tMs: number,
): { x: number; z: number; facing: number } {
  const frames = timeline(actor);
  let row: number;
  let col: number;
  let facing: number;
  if (tMs <= frames[0].tMs) {
    ({ row, col, facing } = frames[0]);
  } else if (tMs >= frames[frames.length - 1].tMs) {
    ({ row, col, facing } = frames[frames.length - 1]);
  } else {
    let i = 0;
    while (i < frames.length - 1 && frames[i + 1].tMs <= tMs) i += 1;
    const a = frames[i];
    const b = frames[i + 1];
    const span = b.tMs - a.tMs;
    const f = span > 0 ? (tMs - a.tMs) / span : 0;
    row = a.row + (b.row - a.row) * f;
    col = a.col + (b.col - a.col) * f;
    facing = a.facing + (b.facing - a.facing) * f;
  }
  return { x: (col + 0.5) * CELL_M, z: (row + 0.5) * CELL_M, facing };
}

/** True when `cell` equals any of `cells` ([row,col] exact match). */
function inCells(cell: GridPos, cells: GridPos[]): boolean {
  return cells.some((c) => c[0] === cell[0] && c[1] === cell[1]);
}

/**
 * Drives at most one live scene at a time. `enterZone` scopes the candidate
 * list to the current zone (and ends any scene left running when the player
 * walks out); `update` advances the live scene or checks for a fresh trigger;
 * `activeActors` reports the current apparitions for the renderer.
 */
export class EchoSceneSystem {
  private activeZone: string | null = null;
  private zoneScenes: EchoSceneDef[] = [];
  private active: { def: EchoSceneDef; elapsedMs: number } | null = null;

  constructor(
    private readonly scenes: EchoSceneDef[],
    private readonly deps: EchoSceneDeps,
  ) {}

  /** Arm the scenes that belong to `zoneId`; end any scene from the old zone
   *  (an echo does not follow the player through a door). */
  enterZone(zoneId: string): void {
    this.activeZone = zoneId;
    this.zoneScenes = this.scenes.filter((s) => s.zone === zoneId);
    this.active = null;
  }

  /**
   * Per-frame tick. If a scene is live, advance it (ending it when it runs out)
   * and pulse the brand; otherwise scan the zone's un-witnessed scenes and fire
   * the first whose trigger cell the player occupies — marking it witnessed the
   * same instant so it can never re-fire this run.
   */
  update(dtMs: number, playerCell: GridPos): void {
    if (this.active) {
      this.active.elapsedMs += dtMs;
      if (this.active.elapsedMs >= this.active.def.durationMs) {
        this.active = null; // scene ran out this frame — fall through, stay idle
      } else {
        this.deps.brandPulse();
        return; // one scene at a time; never trigger while one is live
      }
    }
    if (this.activeZone === null) return;
    for (const scene of this.zoneScenes) {
      if (this.deps.witnessed.has(scene.id)) continue;
      if (inCells(playerCell, scene.triggerCells)) {
        this.active = { def: scene, elapsedMs: 0 };
        this.deps.witnessed.add(scene.id);
        this.deps.onWitness(scene.id);
        this.deps.brandPulse();
        return;
      }
    }
  }

  /** The live apparitions (empty when no scene is playing) for the renderer. */
  activeActors(): EchoActorState[] {
    if (!this.active) return [];
    const { def, elapsedMs } = this.active;
    const opacity = echoOpacity(elapsedMs, def.durationMs);
    return def.actors.map((a) => {
      const pose = actorPoseAt(a, elapsedMs);
      return { rig: a.rig, x: pose.x, z: pose.z, facing: pose.facing, opacity };
    });
  }
}
