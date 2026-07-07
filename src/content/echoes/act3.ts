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
 * Cells are authored against great-hall / undercroft. Task 14 merged the Hall
 * Gallery into the Great Hall as a mezzanine, so the king-hollows now stages on
 * the gallery BALCONY: its echo dais [3,20],[3,21],[4,20],[4,21] (at the overlook
 * rail, band 3) is kept prop/enemy/lore-free by great-hall — the king sets the
 * crown down at the rail over the hall he can no longer place himself in. The
 * crown-down stages in the undercroft's lit WEST half, clear of the east-half
 * wraith spawns ([2,7],[1,10],[4,10]) and every prop; its inscription
 * (`act3-undercroft-a`) carries the same beat in stone.
 */
import type { EchoSceneDef } from '../../engine/EchoScene';

const N = Math.PI;
const S = 0;
const E = Math.PI / 2;
const W = -Math.PI / 2;

/**
 * ACT3-KING-HOLLOWS — the Great Hall's gallery balcony (band 3). King Osric
 * stands at the overlook rail above the hall he ruled, then turns from it,
 * wanders up the walk, and looks back — lost, the crown still on him, the faces
 * below no longer his to know. Two hollow soldiers hold the walk he no longer
 * recognises; one of the sworn kneels at the overlook where the crown was set.
 * Staged on the reserved echo dais at the rail; trigger cells ARE the dais.
 * (The rail is the balcony's WEST edge (col 20) over the overlook well — W faces
 * the hall.)
 */
export const ACT3_KING_HOLLOWS: EchoSceneDef = {
  id: 'act3-king-hollows',
  zone: 'great-hall',
  act: 3,
  triggerCells: [
    [3, 20],
    [3, 21],
    [4, 20],
    [4, 21],
  ],
  durationMs: 15000,
  actors: [
    // Osric: at the rail (W, looking down into the hall), then turns and drifts
    // north up the walk, then looks back — forgotten.
    {
      rig: 'king',
      at: [4, 20],
      facing: W,
      keyframes: [
        { tMs: 5000, at: [3, 20], facing: N }, // turns from the rail, north up the walk
        { tMs: 9000, at: [1, 20] }, // wanders up the gallery
        { tMs: 11000, facing: S }, // looks back, lost
      ],
    },
    // A hollow knelt at the overlook where the crown was set down.
    { rig: 'kneeler', at: [4, 21], facing: W },
    // Two of the hollowed court, holding the walk he no longer knows.
    { rig: 'soldier', at: [1, 21], facing: S },
    { rig: 'soldier', at: [6, 21], facing: N },
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
