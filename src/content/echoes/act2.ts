/**
 * ACT II — THE FALL (world-expansion v1.2, Task 9). The breaking of Vael, told
 * in three silent replays: the first knight walks to the gate and opens it while
 * the sworn keep their vigil (`act2-betrayal`); the villagers of Cinder gather at
 * the hearth and take the fire rather than be counted (`act2-burning`); and Queen
 * Maren paces the sunken chapel's aisle, altar to door and back, keeping her last
 * vigil alone (`act2-queens-walk`). All wordless; player control is never taken.
 *
 * FACING (yaw, radians) — mesh.rotation.y (owner eyeballs the exact axis):
 *   N (−row) = Math.PI · S (+row) = 0 · E (+col) = Math.PI / 2 · W (−col) = −Math.PI / 2
 *
 * CAST. The first knight is the Forsworn — named CALLUN everywhere else in the
 * codebase (Forsworn.ts / Combat / save / lore); this file follows that canon.
 * Queen MAREN is the queen's-walk figure (queen rig = kneeler rig, pale). The
 * villagers reuse the soldier/kneeler rigs the manor's own vigil already uses.
 *
 * Cells are authored against ashenGate / manorGround / chapelNave and their
 * test-locked reservations: the manor hearth block [3,3],[3,4],[4,3],[4,4] and
 * the nave aisle [4,3],[5,3],[6,3],[7,3] are kept prop-free by Tasks 7–8, so the
 * burning and the queen's walk stage there.
 */
import type { EchoSceneDef } from '../../engine/EchoScene';

const N = Math.PI;
const S = 0;
const W = -Math.PI / 2;

/**
 * ACT2-BETRAYAL — the Ashen Gate court. Three of the sworn kneel at their vigil,
 * facing the keep; the first knight (Callun) walks the open east lane down to the
 * royal gate and stands before it as it opens at their backs — the trusted hand
 * unbarring the door to the dark. Trigger cells ring the gate approach (`11` at
 * [7,5],[7,6]), clear of the court's lore/enemies/banner.
 */
export const ACT2_BETRAYAL: EchoSceneDef = {
  id: 'act2-betrayal',
  zone: 'ashen-gate',
  act: 2,
  triggerCells: [
    [6, 3],
    [6, 4],
    [6, 7],
    [6, 8],
    [7, 4],
    [7, 7],
  ],
  durationMs: 13000,
  actors: [
    // The sworn at vigil, backs to the gate, facing the keep — they do not see.
    { rig: 'kneeler', at: [3, 5], facing: N },
    { rig: 'kneeler', at: [4, 2], facing: N },
    { rig: 'kneeler', at: [4, 9], facing: N },
    // Callun walks the east lane down to the gate and stands as it opens.
    {
      rig: 'knight',
      at: [2, 9],
      facing: S,
      keyframes: [
        { tMs: 6000, at: [6, 9] },
        { tMs: 10000, at: [6, 7] },
      ],
    },
  ],
};

/**
 * ACT2-BURNING — the Burnt Manor's tithe-hall. The villagers gather before the
 * caved hearth (the `pillar`/`rubble` cluster on the W wall) as the fire takes
 * the hall; one kneels to be counted rather than burn (echoing the manor's own
 * sanctioned kneeler at [4,2]); a last villager steps in from the south. Staged
 * on the hearth block reserved by Task 8 (kept prop-free); trigger cells sit ON
 * the block, the tread up from the Manor Door.
 */
export const ACT2_BURNING: EchoSceneDef = {
  id: 'act2-burning',
  zone: 'manor-ground',
  act: 2,
  triggerCells: [
    [3, 3],
    [3, 4],
    [4, 3],
    [4, 4],
  ],
  durationMs: 14000,
  actors: [
    // Villagers gathered at the warmth, facing the hearth on the west wall.
    { rig: 'soldier', at: [3, 3], facing: W },
    { rig: 'soldier', at: [3, 4], facing: W },
    { rig: 'soldier', at: [4, 4], facing: W },
    // The one who knelt to be counted rather than take the fire.
    { rig: 'kneeler', at: [4, 3], facing: W },
    // A last villager steps up toward the pyre from the door.
    { rig: 'soldier', at: [6, 3], facing: N, keyframes: [{ tMs: 6000, at: [5, 3] }] },
  ],
};

/**
 * ACT2-QUEENS-WALK — the Sunken Chapel nave. Queen Maren (queen rig, pale) paces
 * the central aisle her feet wore smooth: altar-ward to the foot of the dais,
 * then turns and walks back — turning before she reaches the door, as the nave's
 * inscription says. Two of the vigil's dead kneel on the dais she walks toward.
 * Staged on the aisle reserved by Task 7 (kept prop-free); trigger cells ARE the
 * aisle, so the walk begins as the keeper steps onto it.
 */
export const ACT2_QUEENS_WALK: EchoSceneDef = {
  id: 'act2-queens-walk',
  zone: 'chapel-nave',
  act: 2,
  triggerCells: [
    [4, 3],
    [5, 3],
    [6, 3],
    [7, 3],
  ],
  durationMs: 13000,
  actors: [
    // Maren, pacing altar to door and back; turns before she reaches the door.
    {
      rig: 'queen',
      at: [7, 3],
      facing: N,
      keyframes: [
        { tMs: 6000, at: [4, 3] }, // reaches the foot of the altar dais
        { tMs: 6500, facing: S }, // turns
        { tMs: 12000, at: [7, 3] }, // walks back toward the door
      ],
    },
    // Two of the vigil's dead, knelt on the dais toward the altar.
    { rig: 'kneeler', at: [2, 2], facing: N },
    { rig: 'kneeler', at: [2, 4], facing: N },
  ],
};

export const ACT2_ECHOES: EchoSceneDef[] = [ACT2_BETRAYAL, ACT2_BURNING, ACT2_QUEENS_WALK];
