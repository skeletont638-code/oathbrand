/**
 * Zone 7 — THE QUEEN'S GARDEN (Task 16). The hidden zone, reachable only on a
 * Second Vigil, and only after the undercroft's illusory west wall is revealed
 * (flag 'garden-found'). The one place in Vael the ash never reached: green in a
 * kingdom of grey, silent, and — alone among the seven zones — with NO enemies.
 * It is the composed stillness the whole game has been withholding.
 *
 * You arrive from the undercroft (door 1, the false wall's far side). On the
 * central axis: the Queen's guttered BRAND on its plinth (the pickup that sets
 * 'queens-brand' and opens the true ending), the checkpoint BANNER (the sixth
 * and last banner vision — the garden that kept her brand), and the arrival
 * spawn. Three ngOnly inscriptions here are Maren's: what she knew, her last
 * command entire, and where she sent you.
 *
 * GREEN-IN-ASH: the garden's colour is not a desaturation override (that channel
 * belongs to the brand's hollowing, and fighting it would grey the garden the
 * moment the knight took a hit). Instead main.ts tints the zone AmbientLight a
 * soft green and stages primitive green foliage/fill on entry (spawnGarden) —
 * the stone kit reads mossed and living, the way nowhere else in Vael does.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const QUEENS_GARDEN: ZoneDef = {
  id: 'queens-garden',
  grid: [
    '############', // 0
    '#..........#', // 1
    '#....K.....#', // 2  K = the Queen's guttered brand (plinth pickup)
    '#..........#', // 3
    '#..........#', // 4
    '#....B.....#', // 5  B = checkpoint banner (vision 6)
    '#..........#', // 6
    '#....S.....#', // 7  S = arrival spawn
    '#..........#', // 8
    '#####1######', // 9  door 1 → undercroft (the revealed wall's far side)
  ],
  cell: 2,
  // K = the brand plinth cell (walkable floor; the pickup + a plinth prop sit on it).
  tiles: { K: 'floor' },
  props: [
    // The brand's plinth, and a post behind the banner (banner cell [5,5] has no
    // adjacent wall — same freestanding-post trick the other zones use).
    { kind: 'pillar', at: [2, 5] },
    { kind: 'pillar', at: [4, 5] },
    // Broken stonework, softened by a century of growth.
    { kind: 'rubble', at: [3, 2], rotY: 0.6 },
    { kind: 'rubble', at: [6, 9], rotY: -0.4 },
    { kind: 'stairs', at: [1, 9], rotY: Math.PI }, // a mossed stair to nowhere
  ],
  lights: [
    // Two soft lights keep the lawn readable; main.ts adds the green fill.
    { at: [4, 1], color: 0x9fd08a, intensity: 5 },
    { at: [4, 10], color: 0x9fd08a, intensity: 5 },
  ],
  enemies: [], // a sanctuary — nothing haunts the garden
  banner: { at: [5, 5], name: "Banner of the Queen's Garden" },
  lore: [], // the garden's inscriptions are ngOnly — placed in `ngPlus.addedLore`
  items: [
    {
      id: 'queens-brand',
      at: [2, 5],
      flag: 'queens-brand',
      card: "The Queen's guttered brand — cold to the eye, but it leans toward your glove, and warms. She kept one coal back from every fire the dragon ever lent. This is it.",
    },
  ],
  doors: [
    // Back to the undercroft. Free (you have already walked all the way round);
    // pairs the illusory wall so the passage is a proper two-ended edge.
    { id: 'garden-to-undercroft', at: [9, 5], to: 'undercroft', pair: 'undercroft-garden' },
  ],
  ambience: ['amb-garden-hush', 'amb-ember-hum'],
  ngPlus: {
    // The garden exists ONLY on a Second Vigil, so its three inscriptions are
    // ngOnly and live here (never in the base `lore` array above). applyNgPlus
    // folds them in whenever the zone is loaded (it always is, in NG+).
    addedLore: [
      { id: 'ng-queen-knew', at: [2, 3] }, // beside the brand plinth — what she foresaw
      { id: 'ng-last-command', at: [5, 8] }, // the command entire, its unspoken second line
      { id: 'ng-the-away-knight', at: [7, 3] }, // where she sent you, and why
    ],
  },
};
