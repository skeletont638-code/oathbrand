/**
 * Zone 3 — THE UNDERCROFT (Task 12). The crypt beneath the hall: the
 * darkest room in the vigil. You do not walk in — you DROP in, through a
 * hole the hall's north floor gives way to (great-hall door 2, a one-way
 * drop); the only way back up is the broken stair (door 1). The west half
 * keeps two guttering torches; the EAST half has none — pitch black — and
 * that is where the brand-wraiths haunt (Clip #2): invisible until the
 * Oath-Brand's pulse thins their veil as you close. On the east pedestal
 * rests the Gatekey of Vael, which opens the hall's Throne approach. A
 * false wall in the west (door 5) hides the Queen's Garden — sealed until
 * NG+ reveals it (T16); the brand flickers blue as you near it.
 *
 * Grid is the authored layout from the plan — copied faithfully. Letter
 * tiles: `W` marks the wraith haunt (three spawns placed below, one on the
 * cell), `K` the Gatekey pedestal (both plain floor). Annotations honored:
 * door 1 → great-hall (broken stair, pairs the hall's drop) · door 5 →
 * queens-garden (illusory, sealed) · banner (vision 3, T14) · 4 lore ·
 * 3 wraiths (NG+ 4) · 2 torches, WEST half only · ambient floor 0.06.
 */
import type { ZoneDef } from '../../world/zoneDef';

export const UNDERCROFT: ZoneDef = {
  id: 'undercroft',
  grid: [
    '##############',
    '#....#...#...#',
    '#.5..#.W.#.K.#',
    '#.####...###.#',
    '#....#.#.....#',
    '#.B..#.#..####',
    '#....1.#...S.#',
    '##############',
  ],
  cell: 2,
  // W = wraith haunt, K = Gatekey pedestal — both walkable floor (spawns and
  // the pickup are placed via the satellite arrays, as every zone does).
  tiles: { W: 'floor', K: 'floor' },
  props: [
    // Banner post (cell [5,2] has no adjacent wall — see ashen-gate/hall).
    { kind: 'pillar', at: [4, 2] },
    // The Gatekey's plinth: the pedestal under the pickup on the east cell.
    { kind: 'pillar', at: [2, 11] },
    { kind: 'rubble', at: [5, 8], rotY: 1.2 },
    { kind: 'crate', at: [1, 7], rotY: -0.5 },
  ],
  lights: [
    // Two torches, WEST half only — the east half stays black on purpose so
    // the wraiths can only be found by the brand's pulse (Clip #2).
    { at: [1, 1] },
    { at: [4, 1] },
  ],
  enemies: [
    // Three wraiths haunt the unlit east half; they never render until the
    // pulse burns past WRAITH_VISIBLE_PULSE, so the room reads empty.
    { kind: 'wraith', at: [2, 7] },
    { kind: 'wraith', at: [1, 10] },
    { kind: 'wraith', at: [4, 10] },
  ],
  banner: { at: [5, 2], name: 'Banner of the Undercroft' },
  // Inscriptions (Task 13). Text resolves by id in src/content/lore.ts.
  lore: [
    { id: 'maren-litany', at: [1, 3] }, // the litany scratched into the crypt wall
    { id: 'undercroft-ossuary', at: [4, 3] }, // the ossuary shelf of branded skulls
    { id: 'vael-plinth', at: [1, 11] }, // the Gatekey plinth (east)
    { id: 'brand-scoring', at: [4, 8] }, // the blind gouges near the wraith haunt
    { id: 'lending-rite', at: [4, 4] }, // the rite of the borrowed fire (west)
    { id: 'hollow-marker', at: [4, 11] }, // a named hollow's fresh grave (east)
    { id: 'garden-seal', at: [2, 1] }, // beside the sealed Queen's Garden wall
  ],
  items: [
    {
      id: 'gatekey-vael',
      at: [2, 11],
      flag: 'gatekey',
      card: 'The Gatekey of Vael — cold iron, still warm.',
    },
  ],
  doors: [
    // Illusory west wall → Queen's Garden (T16). Sealed this task: garden is
    // unbuilt AND the lock needs 'garden-found'. No pair yet (single-ended
    // future edge; T16 wires the return).
    { id: 'undercroft-illusory', at: [2, 2], to: 'queens-garden', lock: 'illusory' },
    // Broken stair back up to the hall. Shares the hall drop's pair edge, so
    // dropping in lands the player here and climbing out lands them at the
    // hall's door 2 (great-hall's 'hall-to-undercroft').
    { id: 'undercroft-stair', at: [6, 5], to: 'great-hall', pair: 'hall-undercroft' },
  ],
  ambience: ['amb-crypt-drip', 'amb-wraith-whisper'],
  ambientFloor: 0.06,
  ngPlus: {
    // The promised extra wraith (four now), one holding the stair itself.
    enemies: [
      { kind: 'wraith', at: [2, 7] },
      { kind: 'wraith', at: [1, 10] },
      { kind: 'wraith', at: [4, 10] },
      { kind: 'wraith', at: [6, 9] },
    ],
  },
};
