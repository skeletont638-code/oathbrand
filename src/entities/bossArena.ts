/**
 * The throne arena gate (Task 15) — the pure state machine behind the portcullis
 * that seals the player in with the Forsworn. No three.js: `main.ts` feeds it the
 * player's whereabouts each frame and acts on the event it returns (toggle the
 * doorway collision, swing the mesh, raise the boss title card).
 *
 * The rules:
 *  - A LIT knight stepping into the arena SEALS the gate ('seal').
 *  - Hollowing mid-fight is the MERCY: the gate opens ('mercy-open') so the
 *    beaten knight can walk out to the banner and rekindle. The Forsworn will
 *    not strike a hollow foe (that lives in Enemy/Forsworn, not here).
 *  - Rekindling respawns the boss fresh (the bonfire rule), and stepping back in
 *    reseals ('seal') — a clean restart of the duel.
 *  - The Forsworn's death opens the gate for good ('death-open'); it never seals
 *    again (the fight is over).
 *  - A HOLLOW knight is never sealed in — the boss has no quarrel with the dark.
 */

export type ArenaEvent = 'seal' | 'mercy-open' | 'death-open';

/** The per-frame world view the arena gate reads. */
export interface ArenaFrame {
  /** Player standing inside the arena bounds (north of the gate). */
  playerInArena: boolean;
  playerHollow: boolean;
  /** The Forsworn is down (flag 'forsworn-dead'). */
  bossDead: boolean;
}

export class BossArena {
  /** True while the gate blocks the doorway. */
  sealed = false;

  /** Advance one frame; returns the transition that just fired, or null. */
  update(f: ArenaFrame): ArenaEvent | null {
    if (f.bossDead) {
      if (this.sealed) {
        this.sealed = false;
        return 'death-open';
      }
      return null;
    }
    if (this.sealed) {
      if (f.playerHollow) {
        this.sealed = false;
        return 'mercy-open';
      }
      return null;
    }
    // Open, boss alive: a lit knight crossing in slams the gate shut.
    if (f.playerInArena && !f.playerHollow) {
      this.sealed = true;
      return 'seal';
    }
    return null;
  }
}
