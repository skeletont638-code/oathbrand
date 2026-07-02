/**
 * Zone 5 — THE THRONE ROOM (Task 15). The last door, and the arena behind it.
 *
 * You enter from the Great Hall (door 1, the Gatekey-locked throne approach),
 * into a low ANTECHAMBER that holds the checkpoint banner — kneel here and the
 * fifth vision plays (the herald who ran the wrong way). North of the banner a
 * two-cell doorway (row 7, cols 4–5) opens into the ARENA: ~16×12 m (8×6 cells),
 * the dead throne of Vael on its plinth at the far wall, and THE FORSWORN
 * waiting on it.
 *
 * The arena GATE is not a DoorDef — it is an internal portcullis (main.ts): the
 * doorway is plain floor until a lit knight crosses in, then it SLAMS shut
 * (BossArena) and the duel begins. It reopens only as the mercy (hollow) or when
 * the Forsworn falls. Beyond the throne, door 2 (the summit stair) is sealed by
 * the 'forsworn' lock — it opens the moment 'forsworn-dead' is set.
 *
 * The Ash-Priest is NOT here (he waits at the summit stair). No inscriptions —
 * the vision, the boss, and the endings carry this room.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const THRONE: ZoneDef = {
  id: 'throne',
  grid: [
    '#######2##', // 0  north wall + summit stair (door 2, lock forsworn)
    '#........#', // 1  arena — the throne plinth stands here
    '#........#', // 2
    '#........#', // 3  the Forsworn waits mid-arena
    '#........#', // 4
    '#........#', // 5
    '#........#', // 6  arena, just north of the gate
    '####..####', // 7  divider wall + the arena gate doorway (cols 4–5)
    '#..B.....#', // 8  antechamber + the checkpoint banner (vision 5)
    '#........#', // 9  antechamber
    '#...S....#', // 10 antechamber (S: dev-jump / fallback spawn)
    '####1#####', // 11 south wall + entry from the Great Hall (door 1)
  ],
  cell: 2,
  tiles: {},
  props: [
    // The dead throne of Vael, on its own plinth (throne.glb = plinth+seat+
    // columns, faces +z). Set against the north wall, facing the arena. This is
    // the T5 composite finally placed in-game — EYEBALL + screenshot it.
    { kind: 'throne', at: [1, 4], rotY: 0 },
    // Flank the throne with the last two standing pillars of the hall.
    { kind: 'pillar', at: [1, 2] },
    { kind: 'pillar', at: [1, 7] },
  ],
  lights: [
    // Four braziers ring the arena — they light the duel in P1/P2, then the
    // Forsworn snuffs them in P3 (main.ts lerps these toward tuning.torchOut).
    { at: [2, 1] },
    { at: [2, 8] },
    { at: [5, 1] },
    { at: [5, 8] },
  ],
  enemies: [
    // THE FORSWORN, first knight of Vael. One boss, mid-arena.
    { kind: 'forsworn', at: [3, 4] },
  ],
  banner: { at: [8, 3], name: 'Banner of the Throne' },
  lore: [],
  doors: [
    // Entry from the Great Hall — the far end of the Gatekey-locked throne road.
    { id: 'throne-to-hall', at: [11, 4], to: 'great-hall', pair: 'hall-throne' },
    // The summit stair — sealed until the Forsworn falls (lock 'forsworn').
    { id: 'throne-to-summit', at: [0, 7], to: 'summit', lock: 'forsworn', pair: 'throne-summit' },
  ],
  ambience: ['amb-throne-hush', 'amb-ember-hum'],
  ngPlus: {
    // The boss is not remixed — the Forsworn duel is the duel. But on a Second
    // Vigil his reason is set down in the antechamber: why the first knight
    // unswore, read within sight of the throne he barred (T16 ngOnly).
    addedLore: [{ id: 'ng-callun-reason', at: [9, 5] }],
  },
};
