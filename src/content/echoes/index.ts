/**
 * Echo-scene registry (world-expansion v1.2, Task 3 engine, Task 9 content) —
 * the authored, silent apparition replays that tell the three-act story (spec
 * §5). The seven scenes — the oath and the muster (Act I), the betrayal, the
 * burning and the queen's walk (Act II), the king hollows and the crown carried
 * down (Act III) — are staged against the `EchoSceneDef` contract in
 * `src/engine/EchoScene.ts`. `main.ts` builds `new EchoSceneSystem(ECHOES, …)`;
 * the pooled renderer adapter (Task 3) draws the apparitions per rig.
 */
import type { EchoSceneDef } from '../../engine/EchoScene';
import { ACT1_ECHOES } from './act1';
import { ACT2_ECHOES } from './act2';
import { ACT3_ECHOES } from './act3';

/** Every authored echo scene, keyed nowhere — the system filters by `zone`. */
export const ECHOES: EchoSceneDef[] = [...ACT1_ECHOES, ...ACT2_ECHOES, ...ACT3_ECHOES];

/**
 * The act a zone carries, derived from the echo scene staged there (each of the
 * seven scenes lives in a distinct zone, one act apiece). Used for the banner
 * whisper below; a zone with no scene is absent from the map.
 */
const ZONE_ACT: ReadonlyMap<string, 1 | 2 | 3> = new Map(ECHOES.map((s) => [s.zone, s.act]));

/**
 * The banner-kneel memories (Task 9) — one whispered line per act, the three-act
 * story distilled to a breath, shown on kneel at a banner in a zone that carries
 * that act (the Gate Fields = I, the Ashen Gate = II, the Undercroft = III; every
 * other banner stays silent). A whisper, not a system: voice matches the T13
 * inscriptions — an image, then a turn that darkens it.
 */
const ACT_MEMORY: Readonly<Record<1 | 2 | 3, string>> = {
  1: 'They knelt in a field like this one and swore to burn, that Vael need not. The oath outlived every hand that kept it.',
  2: 'At a gate like this one, the first knight set his hand to the bar — and did not take it back. What he let in still wears the faces of his brothers.',
  3: 'A crown was carried down when the command was to bear it up, by one who had already forgotten which way was home. You kneel where the forgetting begins.',
};

/**
 * The banner-kneel whisper for `zoneId`, or undefined for a banner in a zone that
 * carries no act (existing kneel behaviour unchanged). Rotates by the zone's act,
 * so the same three lines recur across the campaign, one per act.
 */
export function bannerMemoryLine(zoneId: string): string | undefined {
  const act = ZONE_ACT.get(zoneId);
  return act === undefined ? undefined : ACT_MEMORY[act];
}
