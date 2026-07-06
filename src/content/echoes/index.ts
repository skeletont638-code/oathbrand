/**
 * Echo-scene registry (world-expansion v1.2, Task 3) — the authored, silent
 * apparition replays that tell the three-act story (spec §5). Task 9 populates
 * this with the seven scenes (the oath, the muster, the betrayal, the burning,
 * the queen's walk, the king hollows, the crown carried down), staged against
 * the `EchoSceneDef` contract in `src/engine/EchoScene.ts`.
 *
 * SHIPS EMPTY this task: the engine + save field + renderer adapter land now so
 * the PS1 byte-pin stays green (no scenes ⇒ no apparitions ⇒ dormant renderer)
 * and gzip growth is near-zero. `main.ts` builds `new EchoSceneSystem(ECHOES, …)`,
 * so wiring is live and inert until content arrives.
 */
import type { EchoSceneDef } from '../../engine/EchoScene';

/** Every authored echo scene, keyed nowhere — the system filters by `zone`. */
export const ECHOES: EchoSceneDef[] = [];
