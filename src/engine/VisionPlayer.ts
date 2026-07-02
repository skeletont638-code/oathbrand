/**
 * VisionPlayer (Task 14) — the memory of the night Vael fell, played the FIRST
 * time the player kneels at each banner. Pure timeline logic, NO three.js and
 * NO DOM: `main.ts` injects the renderer-side effects (desaturation, fog,
 * ghost sprites, caption text) as plain callbacks, so this runs in vitest.
 *
 * Shape of a vision (spec §, the T14 contract):
 *  - It puts the game into the `vision` state, which freezes movement and
 *    combat exactly like `reading`/`dialogue` — input is locked for its run.
 *  - It advances through `steps` on FIXED ticks: each step holds for its
 *    `waitMs`, then the next applies. `update(dt)` may cross several steps in
 *    one big tick (it consumes them in order) but normal 16ms frames cross one.
 *  - Colour BLEEDS BACK: desaturation runs in REVERSE — the vision opens on
 *    ash (`step[0].desatTo` ≈ 0.82), floods toward 0 (the past briefly alive,
 *    full colour), then the last step SNAPS back to ash. Within a step the
 *    value eases linearly from the previous applied desat to the step target,
 *    so a handful of authored steps read as a smooth flood, not a slideshow.
 *  - Ghost courtiers/knights spawn per step (billboarded kit skeletons, built
 *    by the renderer callback) and are cleared when the memory ends.
 *
 * One-shot per save: seen ids seed from `SaveData.visionsSeen` (the same set
 * the vista one-shots use — vision ids are namespaced `vision-*`, vista ids
 * `vista-*`, so they never collide) and merge back at the next kneel.
 */
import type { Game } from './Game';
import type { GridPos } from '../world/zoneDef';

/**
 * A single ghost to raise during a vision. A plain data descriptor — the
 * renderer clones the named kit piece, makes it spectral (additive +
 * transparent, opacity ~0.35), places it at the cell, and billboards it.
 */
export interface GhostSprite {
  /** Kit piece to raise as the ghost. Defaults to a robed 'statue-knight'
   *  silhouette (reads far better at PS1 fidelity than a bind-pose skeleton). */
  piece?: 'skeleton-warrior' | 'skeleton-archer' | 'statue-knight';
  /** Grid cell [row, col]; the renderer converts to world XZ via the cell size. */
  at: GridPos;
  /** Facing yaw (radians). Ignored while billboarding, kept for authoring. */
  rotY?: number;
}

/** One beat of a vision. Any field may be omitted; `waitMs` is required. */
export interface VisionStep {
  /** Desaturation target for this beat (0 = full colour, 1 = ash). */
  desatTo?: number;
  /** Fog far-plane (m) — visions pull the ash in close and intimate. */
  fogFar?: number;
  /** Ghosts to raise at the start of this beat. */
  spawnGhosts?: GhostSprite[];
  /** One line of litany shown for this beat (replaces the prior line). */
  caption?: string;
  /** How long this beat holds before the next applies. */
  waitMs: number;
}

/** A whole memory. `id` is persisted in `SaveData.visionsSeen`. */
export interface VisionDef {
  id: string;
  steps: VisionStep[];
}

export interface VisionPlayerDeps {
  game: Game;
  /** 0 = full colour, 1 = ash. Driven every tick while a vision runs. */
  setDesaturation: (v: number) => void;
  /** Fog far-plane in metres (optional). */
  setFogFar?: (m: number) => void;
  /** Raise the given ghosts (renderer builds + adds them). */
  spawnGhosts?: (ghosts: GhostSprite[]) => void;
  /** Tear down every raised ghost (called once when the vision ends). */
  clearGhosts?: () => void;
  /** Show a caption line, or clear it with `null`. */
  showCaption?: (text: string | null) => void;
  /** Fired once when a vision actually begins (emit `vision-played`, T17 cue). */
  onPlayed?: (visionId: string) => void;
  /** Seen vision ids from the save (one-shots stay one-shot across reloads). */
  seenIds?: Iterable<string>;
}

export class VisionPlayer {
  private readonly seen: Set<string>;
  private playing = false;
  private steps: VisionStep[] = [];
  private index = 0;
  private stepElapsed = 0;
  /** Desat at the start of the current step and its target (for the ease). */
  private fromDesat = 1;
  private toDesat = 1;
  /** Last value actually pushed to `setDesaturation`. */
  private appliedDesat = 1;

  constructor(private readonly deps: VisionPlayerDeps) {
    this.seen = new Set(deps.seenIds ?? []);
  }

  /** True while a memory is on screen (input is locked). */
  get active(): boolean {
    return this.playing;
  }

  /** Index of the beat currently holding (for tests / debug HUD). */
  get stepIndex(): number {
    return this.index;
  }

  /** Fired + seeded ids, for merging into `SaveData.visionsSeen`. */
  get seenIds(): readonly string[] {
    return [...this.seen];
  }

  hasSeen(id: string): boolean {
    return this.seen.has(id);
  }

  /**
   * Play a vision — unless it is already seen (one-shot) or one is already
   * running. Enters the `vision` state (from `playing`, or tolerates being
   * ALREADY in `vision` when a kneel drove the lock). Returns true iff it began.
   */
  play(v: VisionDef): boolean {
    if (this.playing) return false;
    if (this.seen.has(v.id)) return false;
    if (v.steps.length === 0) return false;
    if (this.deps.game.state !== 'vision' && !this.deps.game.transition('vision')) return false;

    this.seen.add(v.id);
    this.playing = true;
    this.steps = v.steps;
    this.index = 0;
    this.stepElapsed = 0;
    // Open ON the first step's ash (no ramp into it — a hard cut to the past).
    this.appliedDesat = v.steps[0].desatTo ?? 1;
    this.enterStep(0);
    this.pushDesat(0);
    this.deps.onPlayed?.(v.id);
    return true;
  }

  /** Advance the timeline (call only while `active`; a no-op otherwise). */
  update(dtMs: number): void {
    if (!this.playing) return;
    this.stepElapsed += dtMs;
    // Consume as many whole steps as this tick covers (usually none/one).
    while (this.playing && this.stepElapsed >= this.steps[this.index].waitMs) {
      this.stepElapsed -= this.steps[this.index].waitMs;
      this.pushDesat(1); // land exactly on the leaving step's target
      this.index += 1;
      if (this.index >= this.steps.length) {
        this.finish();
        return;
      }
      this.enterStep(this.index);
    }
    if (this.playing) {
      this.pushDesat(Math.min(1, this.stepElapsed / this.steps[this.index].waitMs));
    }
  }

  /** Apply a step's side-effects (fog, ghosts, caption) and arm its desat ease. */
  private enterStep(i: number): void {
    const s = this.steps[i];
    this.fromDesat = this.appliedDesat;
    this.toDesat = s.desatTo ?? this.appliedDesat;
    if (s.fogFar !== undefined) this.deps.setFogFar?.(s.fogFar);
    if (s.spawnGhosts) this.deps.spawnGhosts?.(s.spawnGhosts);
    this.deps.showCaption?.(s.caption ?? null);
  }

  /** Linear ease `fromDesat → toDesat` at fraction `t`, pushed to the pipeline. */
  private pushDesat(t: number): void {
    this.appliedDesat = this.fromDesat + (this.toDesat - this.fromDesat) * t;
    this.deps.setDesaturation(this.appliedDesat);
  }

  /** The memory ends: ghosts + caption clear, control returns to `playing`. */
  private finish(): void {
    this.playing = false;
    this.deps.clearGhosts?.();
    this.deps.showCaption?.(null);
    if (this.deps.game.state === 'vision') this.deps.game.transition('playing');
  }
}
