/**
 * THE WATCHTOWER — GROUND (World Expansion v1.2, Task 6) — the base of the Gate
 * Fields watchtower, entered off the fields through the `Tower Door` (unlocked).
 * A ruined guardroom: the field-watch stood their shifts here, spears racked and
 * helms hung by the stair, until the night the gate went still. Rubble and
 * fallen crates litter the floor; a single hollow soldier still keeps a dead
 * man's watch. The stairwell climbs UP (the `Stair Door`) to the roof-walk.
 *
 * Interior kit (Task 2): `dreadInterior` opts the guardroom into the
 * DreadDirector; ambient stays low so the three wall-torches read as pools of
 * safety over the two doors and the room's centre (spec §2). No banner — the
 * tower is a landmark to climb, not a checkpoint (the field keeps that).
 *
 * The two doors are declared HERE (one side per edge): the `Tower Door` (gate
 * '1', the fields edge) and the `Stair Door` (gate '2', up to towerUpper), so
 * the far sides render the same doors automatically. One Act-I inscription
 * carries the muster/watch tone, turned forward-dread toward the roof above.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const TOWER_GROUND: ZoneDef = {
  id: 'tower-ground',
  grid: [
    '###2##', // 0  N wall — Stair Door '2' [0,3] → tower-upper (UP)
    '#....#', // 1  guardroom
    '#....#', // 2  guardroom — the racked spears, the watch-roster [2,1]
    '#....#', // 3  guardroom
    '#.S..#', // 4  guardroom — spawn [4,2] (fallback; arrival is the Tower Door)
    '###1##', // 5  S wall — Tower Door '1' [5,3] → gate-fields (unlocked)
  ],
  cell: 2,
  tiles: {},
  props: [
    // A ruined guardroom: fallen crates and rubble, spears long since taken down.
    { kind: 'crate', at: [4, 4], rotY: 0.3 },
    { kind: 'crate', at: [3, 1], rotY: -0.5 },
    { kind: 'rubble', at: [2, 4], rotY: 0.8 },
  ],
  // The interior wall-torches carry the light; no v1 braziers (lights empty, well
  // inside the ≤4 budget).
  lights: [],
  // Three wall-torches (interior kit): flanking the stair (N) and by the field
  // door (SW) — pools of safety over both ways out.
  torches: [
    { at: [1, 1] }, // W wall, by the stair
    { at: [1, 4] }, // E wall, by the stair
    { at: [4, 1] }, // W wall, by the Tower Door
  ],
  enemies: [
    // One hollow soldier still keeps the dead watch at the room's heart.
    { kind: 'soldier', at: [2, 3] },
  ],
  // Inscription (Act I — the field-watch's muster/watch, turned forward-dread).
  lore: [
    { id: 'act1-tower-a', at: [2, 1] }, // the watch-roster on the west wall
  ],
  doors: [
    // Out onto the Gate Fields — the paired other end of the fields' new gate '6'
    // ('gf-to-tower'). Unlocked; the 'Tower Door' decoration is declared HERE
    // (one side per edge), so the fields render the same door automatically.
    { id: 'tower-ground-to-fields', at: [5, 3], to: 'gate-fields', pair: 'tower-door' },
    // Up the stair to the roof-walk (towerUpper) — the paired other end of the
    // upper room's stairwell gate. Unlocked; the 'Stair Door' decoration is here.
    { id: 'tower-ground-to-upper', at: [0, 3], to: 'tower-upper', pair: 'tower-stair' },
  ],
  gateDoors: [
    { gate: '1', label: 'Tower Door' }, // the gate-fields edge (unlocked)
    { gate: '2', label: 'Stair Door' }, // up to the roof-walk
  ],
  ambience: ['amb-hall-drone', 'amb-ember-hum'],
  ambientFloor: 0.1,
  dreadInterior: true,
  ngPlus: {
    // The Second Vigil sets a wraith among the rubble with the hollow guard.
    enemies: [
      { kind: 'soldier', at: [2, 3] },
      { kind: 'wraith', at: [3, 3] },
    ],
  },
};
