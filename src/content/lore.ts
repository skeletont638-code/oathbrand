/**
 * All written lore of OATHBRAND (Task 13). Every inscription the player can
 * READ resolves through here by id; the zone files place the ids on the grid,
 * and the structural tests (zones.test.ts) enforce the bijection — every
 * placed id has an entry, every base entry is placed.
 *
 * VOICE: terse, litany-like, in the FromSoft item-description tradition. An
 * image, then a turn that darkens it. Ambiguity is intended; the game is a
 * companion to the "Iron Oath" series, so several inscriptions seed its
 * questions (the cliff of embers, the oath spoken, the ride to battle, the
 * Flame That Lends) and a few quietly refuse to add up (the herald Edda).
 *
 * CANON. Vael fell in one night — the GUTTERING — when the royal flame died
 * and every sworn soldier's oath-brand died with it. Queen MAREN gave a last
 * command: "Return the crown to the flame that forged it." The royal fire was
 * borrowed, generations ago, from the dragon VHAELIS, the Flame That Lends,
 * who sleeps in the peak above the castle. Ser CALLUN, the Forsworn, first
 * knight, broke his oath that night and let the dark in. The herald EDDA
 * carried the queen's last command to the player — and her account does not
 * add up. The player is the last knight, who was away that night. The hollow
 * things in the halls are former comrades; putting them down is mercy.
 *
 * `ngOnly` entries are written now but placed by T16 (the NG+ pass), where they
 * recontextualise everything above: the queen knew, Edda lied, Callun had a
 * reason. Until then the tests hold them as defined-but-unplaced.
 */

/** One readable inscription. `ngOnly` marks the NG+ recontextualisations. */
export interface LoreEntry {
  title: string;
  body: string;
  /** True for the T16 New-Game-Plus inscriptions (defined now, placed later). */
  ngOnly?: boolean;
}

export const LORE: Record<string, LoreEntry> = {
  // ─── THE ASHEN GATE ────────────────────────────────────────────────────
  'gate-plaque': {
    title: 'The Ashen Gate',
    body: 'Kneel, keeper of the brand. The kingdom you swore to is behind you now. What kept the oath waits ahead — and it does not forgive latecomers.',
  },
  'herald-corpse': {
    title: "The Herald's Remains",
    body: "A herald, long dead, his scroll-case fused to his ribs. The seal is the Queen's; the wax was never broken. Whatever Edda carried to you, she did not carry it from here.",
  },
  'torii-lintel': {
    title: 'The Broken Torii',
    body: 'The royal gate, split down its heart. They raised it facing the cliff of embers, so every soldier rode out beneath the fire that lent them their brand. None of them rode back.',
  },
  'gate-ash': {
    title: 'First Ash',
    body: 'The ash never settles here. It falls and falls, soft as first snow, and covers nothing. They named the night it began the Guttering. No one living has named the day it ends.',
  },
  'watchpost-ledger': {
    title: 'The Watch-Post Ledger',
    body: 'A muster-roll, its last page swollen stiff. Every name struck through but one: the herald Edda, marked ARRIVED — three days after the gate had already gone still. Three days no living thing had crossed it.',
  },

  // ─── THE GREAT HALL ────────────────────────────────────────────────────
  'hall-mural': {
    title: 'The Scoured Mural',
    body: "The Queen sets a burning brand into a kneeling knight's hands. Someone has scratched the knight's face down to bare stone — only his face, and only in this one telling of the tale.",
  },
  'cold-hearth': {
    title: 'The Cold Hearth',
    body: "The feast-fire, dead a hundred years. In the banked soot, small handprints — the servants' children hid in the warm ash while the oath broke above them. The prints lead in. None lead out.",
  },
  'kings-decree': {
    title: 'The Nailed Decree',
    body: 'Nailed to the floor with royal silver: NO FIRE SHALL PASS THE GATE. The hand is not the King’s. Beneath it, smaller and later, another hand has answered: and so, in the end, none did.',
  },
  'oath-spoken': {
    title: 'The Words of the Oath',
    body: 'Cut deep into the oath-stone, worn shallow again by a thousand kneelings: I burn that Vael need not. Hold to the flame, and the flame will hold to you. On the last night it held to no one.',
  },
  'feast-roster': {
    title: "The Vigil's Roster",
    body: 'The long table still keeps its places by name, and you knew every one. The things that wear those names shuffle the halls above now, and will not remember being called. Answer them once, kindly, with the blade.',
  },
  'throne-bar': {
    title: 'The Barred Approach',
    body: 'The throne road was sealed from within. Only the first knight held the right to bar it so — Ser Callun, sworn before all others, who that night unswore before all others. He locked the dark in with the crown. Or the crown in with the dark.',
  },
  // Forward-dread (P4): the feast hall does not only mourn — it warns.
  'hall-set-places': {
    title: 'The Set Places',
    body: 'The long table is laid for a feast no one ate — bowls, knives, a cup at every place. But the benches are pushed back all on one side, in one motion, the way men stand when a door opens that they did not expect. The door they watched is the one you are about to use.',
  },

  // ─── THE UNDERCROFT ────────────────────────────────────────────────────
  'maren-litany': {
    title: "Maren's Litany",
    body: 'Scratched a thousand times into the crypt wall, the same three words, each fainter than the last: the brand remembers. Then, once, in a steadier hand: but I do not.',
  },
  'undercroft-ossuary': {
    title: 'The Ossuary Shelf',
    body: 'The bones are stacked with terrible tenderness. Every skull bears a soldier’s brand-scar, cold and unlit. Someone carried each one down here, alone, in the dark, and set it gently among its sworn brothers.',
  },
  'vael-plinth': {
    title: "The Keeper's Plinth",
    body: 'To the keeper who reaches this stone unhollowed: the Gatekey is yours. Vael kept it warm against your coming. Vael kept nothing else warm at all.',
  },
  'brand-scoring': {
    title: 'The Blind Gouges',
    body: 'Long gouges rake the wall at a man’s shoulder height. Something struck here again and again in the pitch dark — at an enemy it could not see, or at itself, wanting to be free of the brand it could no longer feel.',
  },
  'lending-rite': {
    title: 'The Lending-Rite',
    body: 'The rite is graven plain. The royal fire was never Vael’s own; it was borrowed, ember by ember, from Vhaelis — the Flame That Lends — who sleeps in the peak above the castle. A lender may always call the loan.',
  },
  'hollow-marker': {
    title: "A Hollow's Marker",
    body: 'One grave down here is fresh-tended, its name still legible: BRIED, WHO STOOD THE EAST WALL. You drilled beside him. Should you meet him hollow in the halls above, be quicker than you will want to be.',
  },
  'garden-seal': {
    title: 'The Sealed Door',
    body: 'The wall here breathes cold, and your brand gutters blue against it, the way a flame leans toward an open window. Beyond is the Queen’s Garden, sealed the night she gave her last command. It opens only for those who have walked all the way round to the truth.',
  },

  // ─── THE RAMPARTS ──────────────────────────────────────────────────────
  'callun-post-log': {
    title: "Callun's Watch-Log",
    body: 'The first knight’s own hand, weathered to a whisper. Night forty: the wind carries the old oath back to us, and we do not answer it. Night forty-one: I have stopped counting what I owe.',
  },
  'rampart-watch': {
    title: "The Sentry's Tally",
    body: 'Hundreds of notches beside the arrow-slit, one for each night held — then a single deep gouge dragged through them all, ending the count. Nothing was worth the counting after the night the fire went out.',
  },
  'wind-scoured-oath': {
    title: 'The Worn Stone',
    body: 'This stretch of parapet is scoured smooth, as if a hand had gripped it every night for a hundred years, waiting for a certain gate to open. The gate you are about to open. He is still waiting.',
  },
  'callun-oath-broken': {
    title: "The Forsworn's Mark",
    body: 'A knight’s sigil struck from the wall, its bracket-holes left staring. Only one man’s arms were ever taken down in Vael — the Forsworn’s, who let the dark past the last door. They could not decide whether to curse his name or grieve it, so they only took it down.',
  },
  'beacon-cold': {
    title: 'The Cold Beacon',
    body: 'The signal-brazier crowns the bastion, its oil long since skinned to tar. It was lit the moment the royal flame died — a call for every sworn blade to ride home. You did not see it. You have never said where you were.',
  },
  'edda-passage': {
    title: "The Herald's Way",
    body: 'Chalk on the merlon: a herald’s route-mark, pointing out — away from the keep, the night everyone else was running in. Edda came to you with the Queen’s last words on her lips. This mark says she left before the Queen could have spoken them.',
  },
  'ride-to-battle': {
    title: 'The Muster-Ground',
    body: 'From here the whole vigil watched the last host form up and ride for the cliff of embers, banners like a second, redder dawn. Every brand in that column has since gone out. One brand was not in the column. Yours.',
  },

  // ─── THE THRONE & THE SUMMIT (P4 forward-dread) ────────────────────────
  // The last two rooms held `lore: []` — no inscription warned of what waits
  // ahead. These two do: the threat is not only behind you.
  'throne-doors-scored': {
    title: 'The Scored Doors',
    body: 'The doors to the throne hang scored from the inside — long, patient grooves at the height of a kneeling man, worn smooth as the oath-stone. Whatever asked to be let out did not shout. It knelt, and it scratched, and it waited to be heard. It is quieter now than it has ever been.',
  },
  'summit-climbers-cairn': {
    title: 'A Cairn of Helms',
    body: 'Seven helms stacked beside the stair, each older than the last, polished by wind where hands once polished them. Seven knights climbed past this stone to ask the Flame for more time. The stair remembers no one coming down. Count the helms again before you climb.',
  },

  // ─── GREATER VAEL DROP 1 — THE GATE FIELDS (Task 9) ────────────────────
  'gv-field-boundary-stone': {
    title: 'The Boundary-Stone',
    body: 'Its old blessing is chiselled off, and a tally cut in the bare place. Past this mark the flame was not given to the fields — it was lent to them, at interest. The fields have been paying ever since, and the fields are bare.',
  },
  'gv-field-scarecrow-ward': {
    title: 'The Straw Ward',
    body: 'It wears a soldier’s ruined brand for a face. When the fog first came off the tree-line the village had no ward against it but its own hollowed dead, so they knelt one here and called it a scarecrow. It has knelt a hundred years. It is still listening.',
  },
  'gv-field-childs-shoe': {
    title: 'A Child’s Shoe',
    body: 'Ash-grey, pulled from a fallen chimney-throat. Scratched beside the hearth-door, a daisy-wheel — six petals in one unbroken line, to snare any evil that came down the flue. It snared nothing. The shoe is here and the child is not.',
  },
  'gv-field-gibbet': {
    title: 'The Empty Gibbet',
    body: 'An iron cage hangs from the oak, rusted open, high where every road could see it. Something was kept in it once — a warning, or a payment left where the collector could find it. The cage is empty now. Nothing broke the lock from outside.',
  },
  'gv-field-tithe-post': {
    title: 'The Tithe-Post',
    body: 'A toll-post at the crossing, its ledger-slot worn smooth by cold coin. Here a traveller bought back an hour of warmth against the fog, hearth-fire measured out by the finger-length. The Flame lent a kingdom its fire; the kingdom sold it on by the ember. None of the debt ran the other way.',
  },
  // Forward-dread (P4): the waystone at the threshold of the Fields.
  'gv-fields-standing-stone': {
    title: 'The Standing Stone',
    body: 'A waystone for pilgrims, its distances chiselled and sure: THE VILLAGE, ONE MILE. THE FORGE-ROAD, TWO. Beneath, in newer cuts that wander like a man walking backward: it stands where the fog begins. it was nearer when i finished this line than when i began it.',
  },

  // ─── GREATER VAEL DROP 1 — THE ASHEN FOREST N (Task 10) ────────────────
  'gv-forest-fogline': {
    title: 'The Fog-Line',
    body: 'The road ends where the trees begin, and the fog begins with them. This is the mark past which a tithe once went unpaid and was not forgiven. The debt did not lift. It put down roots, and learned to wait in the dark between the trunks.',
  },
  'gv-forest-hag-cairn': {
    title: 'The Carved Cairn',
    body: 'A cairn of pale stones, and no words on any of them — only marks, cut by a hand that had stopped trusting words: an open palm, an ember, a line drawn out and away. She does not speak. She sets her meaning in the stone, and waits to see what you will lay down.',
  },
  'gv-forest-sold-brand': {
    title: 'The Sold Brand',
    body: 'A brand-scar, cold, pressed into the bark like a seal in wax. A soldier’s oath-fire was struck from her the night the ledgers came due, and carried off to warm a hall she would never be let into. She did not hollow with the others. Something out here took up her debt, and will not let her die of it.',
  },
  'gv-forest-hound-kennels': {
    title: 'The Loosed Kennels',
    body: 'Ring-bolts in a row, the leashes long rotted through. The collectors kept dogs to walk the tithe-roads, lean things fed on what the debtors could not pay. When the flame guttered and the collectors did not come back, no one loosed them. They loosed themselves. They are still collecting.',
  },
  'gv-forest-watcher-note': {
    title: 'A Scratched Line',
    body: 'One line, cut at a running height by someone who did not stop to finish the letters: it does not come closer. it does not need to. Below it, in a steadier hand that had made its peace: so do not run. it likes the running.',
  },

  // ─── GREATER VAEL DROP 1 — THE CINDER VILLAGE (Task 11) ────────────────
  'gv-village-tithe-ledger': { title: 'The Tithe-Ledger',
    body: 'Its spine cracks open to this page. A column of names down the left, a column of embers owed down the right, and the right column only ever grows. The last entry is a woman’s name, and the sum beside it is not a number — it is one word, pressed so hard the nib tore through: ALL.' },
  'gv-village-salt-line': { title: 'The Salt Lines',
    body: 'Salt laid across every doorstone, grey and clotted with age — the old ward against what walks the fog. Every line is unbroken but one. That threshold’s salt is scuffed through from the inside, by something that wanted out, not in.' },
  'gv-village-collector-house': { title: 'The Collector’s Door',
    body: 'The largest door in Cinder, and the only one with no ward at all. There were marks here once — you can see the scrape where they were taken off, corner to corner, deliberate. A house that fears no fog is a house the fog has already been paid to leave alone.' },
  'gv-village-well': { title: 'The Curdled Well',
    body: 'The water has gone still and wrong, a skin on it the colour of a bruise. Cut into the coping, in a hand that shook: SHE POISONED IT. And lower, later, smaller, as if the hand had thought again: or the flame died, and the water died with it, and we needed a name that could hear us.' },
  'gv-village-procession': { title: 'The Kneeling Line',
    body: 'A line worn into the street by knees that never rose. When the tithe could not be paid in embers, Cinder paid it in the hollowed — walked its own dead out and set them kneeling toward the fog, a penance-column. Count them as you pass. One of them is counting you.' },
  // Forward-dread (P4): the tally on the last lit house, facing the fog.
  'gv-village-shutter-tally': { title: 'A Tally on the Shutter',
    body: 'Someone kept count on the shutter of the last lit house: four days, eleven marks. The marks are not of days. The last one is cut deeper, dragged, as if the counter looked up mid-stroke and did not look down again. The shutter faces the fog.' },

  // ─── GREATER VAEL DROP 1 — THE PILGRIM'S DESCENT (Task 12) ─────────────
  'gv-descent-shrine': { title: 'The Wayside Shrine',
    body: 'A shrine to Vhaelis, the Flame That Lends, its little niche still black with old smoke. Beneath the fresh carving, an older one is scratched to ruin — an earlier name, an earlier keeper of this crossing, unmade to make room for the fire. Every faith here is built on the scraped-out face of the one before.' },
  'gv-descent-pilgrim-marker': { title: 'The Pilgrim-Marker',
    body: 'A marker at the head of the switchbacks, hung with the cold brands of those who passed it. They went down to the drowned lands to give their embers back to the water, and so be free of the debt. The path down is deep-worn. The path up has not been walked in a long time.' },
  'gv-descent-sealed-gate': { title: 'The Sealed Way',
    body: 'The gate at the bottom is barred and swollen shut, and beyond it the sound of water where no water should be. The Salt Road ran on from here once, down to the sea-marches. It runs under them now. Something still tolls, far below the surface, keeping a count no one is left to owe.' },
  'gv-descent-ash-priest': { title: 'The Ash-Priest, at the Gate',
    body: 'He has come down ahead of you, as he always has, and set his back to the sealed gate. "A kingdom given fire," he says, not turning, "and it learned to sell the warmth and keep the ash. I carried the first ember up a road much like this one. I never asked what it would cost." He will not say who he heralded, or when.' },
  // Forward-dread (P4): the knotted rail, worn from the underside.
  'gv-descent-hold-the-rail': { title: "The Pilgrim's Rail",
    body: "The rope rail is knotted every arm's length, each knot worn black by a hundred descending hands. Some knots are worn from the underside. Something has climbed this descent from below, hand over hand, more than once. If the rail trembles, it is not the wind. Do not look down to check." },

  // ─── NG+ (T16): the recontextualisations. Defined now, placed later. ────
  'ng-queen-knew': {
    ngOnly: true,
    title: 'What the Queen Knew',
    body: 'Maren knew the borrowed fire would gutter; the lending-rite had shown her the very night and hour. She let the vigil ride out regardless, and stayed to meet the dark alone — not to save Vael, but to be certain it was Vael that ended, and not some thing wearing its crown.',
  },
  'ng-edda-lie': {
    ngOnly: true,
    title: "Edda's True Errand",
    body: 'The herald did not survive the Guttering. Edda died at the gate with the rest, her seal unbroken — you have seen her bones. The Edda who found you with a queen’s command in her mouth was something that had learned the shape of a herald, and needed a knight who would carry a crown to a sleeping fire.',
  },
  'ng-callun-reason': {
    ngOnly: true,
    title: 'Why He Unswore',
    body: 'Callun did not let the dark in from cowardice. He read the same rite the Queen read, and made the other choice: that a debt this old should fall due all at once — the hollowing, the dark, the end of it — rather than be paid slowly, in children, for another hundred years. He broke one oath to keep a larger one.',
  },
  'ng-borrowed-flame': {
    ngOnly: true,
    title: 'The Cost of Borrowing',
    body: 'Every brand ever lit in Vael was a coal drawn from Vhaelis, and the lending was never free. Each ember cost the dragon a year — in sleep, in memory, in the slow forgetting of its own name. Vael did not fall in a night. It had been falling, quietly, for three hundred years.',
  },
  'ng-last-command': {
    ngOnly: true,
    title: 'The Last Command, Entire',
    body: 'Return the crown to the flame that forged it — so the heralds carried it. But Maren spoke a second line, and no herald carried that one: and when the flame wakes to take it back, let no oath-brand stand in its way. The command was never a rescue. It was a surrender, dressed as a duty a knight could bear.',
  },
  'ng-the-away-knight': {
    ngOnly: true,
    title: 'Where You Were',
    body: 'You were not lost on the road, nor late from some far siege. Maren sent you away herself, the day before — the one blade she would not let ride to the cliff — so that when every other brand went dark, one would remain to carry the crown up the mountain. You did not survive the Guttering. You were spent on the far side of it.',
  },
  'ng-vhaelis-wakes': {
    ngOnly: true,
    title: 'The Flame Stirs',
    body: 'Above the throne, past the summit stair, the great warmth turns in its sleep. Vhaelis does not hate Vael; a hearth does not hate the hand that it warms. It has only waited, patient as stone, for its embers to come home — and something has spent a hundred years making very sure a knight would bring them.',
  },
  'ng-mercy': {
    ngOnly: true,
    title: 'The Kindest Reading',
    body: 'You have called it mercy, every hollow you have put down. Keep calling it that; it is truer than you fear. They cannot be rekindled — the flame that lit them is being recalled, ember by ember — and each one you release goes home a little cleaner than it would have crawled. The last mercy is not theirs. It is the one you will ask for at the summit.',
  },
};
