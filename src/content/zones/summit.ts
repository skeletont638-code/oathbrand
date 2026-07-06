/**
 * Zone 6 — THE SUMMIT (Task 15). The top of the mountain, above the throne,
 * where VHAELIS — the Flame That Lends — sleeps. The finale stage.
 *
 * A short ledge in heavy fog (`fogFarM` 6): you arrive from the throne (door 1,
 * the stair), the checkpoint banner and the Ash-Priest at your back, the crown
 * offering-flame ahead. Beyond the flame, mostly hidden in the fog, a WALL OF
 * SCALES, a jaw, and one slow-opening EYE — the dragon, built in world/dragon.ts
 * and staged by main.ts (it is not a kit prop). There are NO enemies here and,
 * deliberately, NO banner vision (the memory of this place has not happened yet).
 *
 * The endings resolve here (engine/endings.ts): approach the flame to wake the
 * eye, then GIVE the crown or walk away and KEEP it — or arrive hollow, and the
 * eye never opens at all.
 *
 * The brazier flame, the dragon, and the eye's glow are all custom main.ts
 * meshes; the two wall torches only keep the ledge itself readable.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const SUMMIT: ZoneDef = {
  id: 'summit',
  grid: [
    '##########', // 0  the scale-wall / dragon loom beyond, in the fog
    '#........#', // 1
    '#........#', // 2  the crown offering-flame stands here (main.ts brazier)
    '#........#', // 3
    '#........#', // 4
    '#...S....#', // 5  (S: dev-jump / fallback spawn)
    '#B.......#', // 6  checkpoint banner + the Ash-Priest at the stair
    '####1#####', // 7  the stair down to the throne (door 1)
  ],
  cell: 2,
  tiles: {},
  props: [
    // Two broken pillars frame the approach to the flame and the dragon.
    { kind: 'pillar', at: [2, 2] },
    { kind: 'pillar', at: [2, 6] },
  ],
  lights: [
    // The last two torches on the mountain — enough to read the ledge; the
    // dragon's eye and the offering-flame carry the rest.
    { at: [4, 1] },
    { at: [4, 8] },
  ],
  enemies: [],
  banner: { at: [6, 1], name: 'Banner of the Summit' },
  // Forward-dread (P4): the cairn of helms beside the stair-head [6,4] (directly
  // above the entry door 1 [7,4]) — read as you climb from the throne toward the
  // offering-flame. On the main path, clear of the west-side banner/Ash-Priest.
  lore: [{ id: 'summit-climbers-cairn', at: [6, 5] }],
  doors: [
    // The stair back down to the throne (free — you fought your way up).
    { id: 'summit-to-throne', at: [7, 4], to: 'throne', pair: 'throne-summit' },
  ],
  ambience: ['amb-summit-wind', 'amb-dragon-breath'],
  fogFarM: 6,
};
