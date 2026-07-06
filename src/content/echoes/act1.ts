/**
 * ACT I — THE OATH (world-expansion v1.2, Task 9). The founding beat of Vael,
 * told in two silent apparition replays: the sworn kneel in the Gate Fields and
 * give their word before King Osric (`act1-oath`), and the field-watch muster on
 * the watchtower roof before the last host rides (`act1-muster`). Both are wordless
 * — the staging alone must read the moment. Player control is never taken.
 *
 * FACING (yaw, radians) — the renderer applies `facing` as mesh.rotation.y:
 *   N (up-grid, toward −row) = Math.PI · S (down-grid, +row) = 0
 *   E (+col) = Math.PI / 2      · W (−col) = −Math.PI / 2
 * Exact on-screen orientation is the owner's eyeball (the pooled rigs share a
 * forward axis); these values keep each tableau internally consistent.
 *
 * Cells are authored against the live ZoneDefs (gateFields / towerUpper) and the
 * reservations the earlier tasks test-locked: gate-fields keeps its dense arrays,
 * so the oath stages in the bare clearing '..' cells N of the oath-oak, clear of
 * every prop/enemy/lore/banner/scare; tower-upper's roof block [2,2],[2,3],[3,2],
 * [3,3] is the muster's reserved staging (kept prop-free by Task 6).
 */
import type { EchoSceneDef } from '../../engine/EchoScene';

const N = Math.PI;
const S = 0;

/**
 * ACT1-OATH — the Gate Fields, before the oath-oak. King Osric stands in the
 * clearing (crowned, pale) and five of the sworn kneel before him, giving the
 * oath cut into the stone above them: I burn that Vael need not. A still tableau
 * — the founding moment, held. Trigger cells are the bare clearing floor two
 * cells N of the oak (`[5,7]`,`[5,8]` — the '..' the field author left open),
 * the tread every keeper walks down from the castle gate toward the banner.
 */
export const ACT1_OATH: EchoSceneDef = {
  id: 'act1-oath',
  zone: 'gate-fields',
  act: 1,
  triggerCells: [
    [5, 7],
    [5, 8],
  ],
  durationMs: 12000,
  actors: [
    // King Osric, crowned and pale, presiding at the oath-oak's clearing.
    { rig: 'king', at: [3, 7], facing: S },
    // The five sworn, knelt in a shallow arc before him, heads to the king.
    { rig: 'kneeler', at: [4, 6], facing: N },
    { rig: 'kneeler', at: [4, 8], facing: N },
    { rig: 'kneeler', at: [4, 5], facing: N },
    { rig: 'kneeler', at: [4, 9], facing: N },
    { rig: 'kneeler', at: [5, 6], facing: N },
  ],
};

/**
 * ACT1-MUSTER — the watchtower roof-walk over the fields. The field-watch gather
 * at the north parapet and look out over the plain as the last host forms up
 * below; one soldier climbs up from the room to join them. Staged on the roof
 * block reserved by Task 6 (kept prop-free); trigger cells sit ON that block, the
 * step onto the parapet from the guardroom stair.
 */
export const ACT1_MUSTER: EchoSceneDef = {
  id: 'act1-muster',
  zone: 'tower-upper',
  act: 1,
  triggerCells: [
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3],
  ],
  durationMs: 14000,
  actors: [
    // The watch at the parapet edge, facing out over the plain (N).
    { rig: 'soldier', at: [1, 2], facing: N },
    { rig: 'soldier', at: [1, 4], facing: N },
    { rig: 'archer', at: [2, 4], facing: N },
    { rig: 'soldier', at: [2, 1], facing: N },
    // A latecomer climbs up from the guardroom to join the muster.
    { rig: 'soldier', at: [5, 2], facing: N, keyframes: [{ tMs: 7000, at: [3, 4] }] },
  ],
};

export const ACT1_ECHOES: EchoSceneDef[] = [ACT1_OATH, ACT1_MUSTER];
