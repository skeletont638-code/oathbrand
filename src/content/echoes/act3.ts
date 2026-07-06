/**
 * ACT III — THE HOLLOWING (world-expansion v1.2, Task 9). The forgetting, told
 * in two silent replays: King Osric sets the crown down at the gallery rail and
 * cannot, after, remember which of the small figures below had once been him
 * (`act3-king-hollows`); and one of the sworn, given the crown to bear UP to the
 * flame, carries it the wrong way — DOWN into the undercroft, among the branded
 * dead — having forgotten there was ever an up (`act3-crown-down`). Both wordless;
 * player control is never taken.
 *
 * FACING (yaw, radians) — mesh.rotation.y (owner eyeballs the exact axis):
 *   N (−row) = Math.PI · S (+row) = 0 · E (+col) = Math.PI / 2 · W (−col) = −Math.PI / 2
 *
 * Cells are authored against hallGallery / undercroft. The gallery's echo dais
 * [4,6],[4,7],[5,6],[5,7] (the central spine over the wells) is kept prop-free by
 * Task 4 — the king-hollows stages there. The crown-down stages in the undercroft's
 * lit WEST half, clear of the east-half wraith spawns ([2,7],[1,10],[4,10]) and
 * every prop; its inscription (`act3-undercroft-a`) carries the same beat in stone.
 */
import type { EchoSceneDef } from '../../engine/EchoScene';

const N = Math.PI;
const S = 0;
const E = Math.PI / 2;
const W = -Math.PI / 2;

/**
 * ACT3-KING-HOLLOWS — the Hall Gallery spine. King Osric stands at the rail over
 * the hall he ruled, then turns from it, wanders up the spine, and looks back —
 * lost, the crown still on him, the faces below no longer his to know. Two hollow
 * soldiers hold the walkways he no longer recognises; one of the sworn kneels at
 * the overlook where the crown was set. Staged on the reserved echo dais; trigger
 * cells ARE the dais, reached from either walkway across the spine.
 */
export const ACT3_KING_HOLLOWS: EchoSceneDef = {
  id: 'act3-king-hollows',
  zone: 'hall-gallery',
  act: 3,
  triggerCells: [
    [4, 6],
    [4, 7],
    [5, 6],
    [5, 7],
  ],
  durationMs: 15000,
  actors: [
    // Osric: at the rail (looking down into the hall), then turns and drifts up
    // the spine, then looks back — forgotten.
    {
      rig: 'king',
      at: [5, 7],
      facing: E,
      keyframes: [
        { tMs: 5000, at: [5, 6], facing: N }, // turns from the rail
        { tMs: 9000, at: [3, 6] }, // wanders up the spine
        { tMs: 11000, facing: S }, // looks back, lost
      ],
    },
    // A hollow knelt at the overlook where the crown was set down.
    { rig: 'kneeler', at: [4, 6], facing: E },
    // Two of the hollowed court, holding the walkways he no longer knows.
    { rig: 'soldier', at: [2, 6], facing: S },
    { rig: 'soldier', at: [7, 6], facing: N },
  ],
};

/**
 * ACT3-CROWN-DOWN — the Undercroft, west half. A knight of the sworn descends
 * from the broken stair (`1` at [6,5]) carrying the crown, and walks it down into
 * the dark toward the ossuary and the banner — the wrong way, the command to bear
 * it UP already forgotten. Three of the branded dead kneel in the chamber and
 * watch him pass. All in the lit WEST half, well clear of the east-half wraith
 * haunt and every prop; trigger cells are the west-half approach to the banner.
 */
export const ACT3_CROWN_DOWN: EchoSceneDef = {
  id: 'act3-crown-down',
  zone: 'undercroft',
  act: 3,
  triggerCells: [
    [6, 3],
    [6, 4],
    [5, 3],
    [5, 4],
  ],
  durationMs: 15000,
  actors: [
    // The crown-bearer: down off the stair, west into the chamber, to the
    // ossuary/banner — carrying the crown the wrong way, down among the dead.
    {
      rig: 'knight',
      at: [6, 6],
      facing: W,
      keyframes: [
        { tMs: 4000, at: [6, 4] }, // west, off the stair into the chamber
        { tMs: 10000, at: [5, 3] }, // to the ossuary before the banner
      ],
    },
    // Three of the branded dead, knelt in the chamber, watching him pass.
    { rig: 'kneeler', at: [6, 1], facing: E },
    { rig: 'kneeler', at: [5, 1], facing: E },
    { rig: 'kneeler', at: [3, 1], facing: E },
  ],
};

export const ACT3_ECHOES: EchoSceneDef[] = [ACT3_KING_HOLLOWS, ACT3_CROWN_DOWN];
