/**
 * The Ash-Priest's dialogues (Task 13). Three encounters, spoken lines only —
 * the DOM box (ui/inscription.ts) plays them a line at a time on E/click while
 * the game sits in the `dialogue` state.
 *
 * He is the one voice in a dead kingdom. Weary, kind, and plainly older than
 * the walls — he buried the vigil himself, one skull at a time (see the
 * undercroft ossuary), and he remembers the player from before. He knows more
 * than he says, and says it gently, because the player still has to walk the
 * rest of the way alone.
 *
 *   1 — Ashen Gate: a cryptic welcome. He remembers your face.
 *   2 — Ramparts: the Guttering as he saw it, and the first doubt about Edda.
 *   3 — Summit stair (zone unbuilt until T15/T16): the lead-in is fixed; his
 *       FINAL line varies by which ending the run is bound for (endings.ts).
 *
 * VOICE-MATCHES the inscriptions: terse, litany-like, an image then a turn.
 */
import type { GameFlag } from './types';
import { endingPending } from './endings';
import type { EndingTrack } from './endings';

/** One spoken line: who says it, and what. */
export interface DialogueLine {
  speaker: string;
  text: string;
}

/** The Ash-Priest encounters. Summit (3) is assembled by `dialogueSequence`. */
export type DialogueId = 'ashpriest-1' | 'ashpriest-2' | 'ashpriest-3';

/** The only speaker in Task 13 — kept as a constant so the box, the tests, and
 *  every line agree on the exact string. */
export const SPEAKER_ASH_PRIEST = 'THE ASH-PRIEST';

const line = (text: string): DialogueLine => ({ speaker: SPEAKER_ASH_PRIEST, text });

/** Encounters 1 and 2 are fixed sequences. Encounter 3 is built per-run. */
export const DIALOGUE: Record<'ashpriest-1' | 'ashpriest-2', DialogueLine[]> = {
  'ashpriest-1': [
    line('So. The last brand comes walking out of the ash — a hundred years too late to be early.'),
    line('Do not kneel to me, knight. I am no banner, and I have no fire to give you back.'),
    line('I knew your face when it was young and certain. It is neither now. Good. Certainty is what emptied this place.'),
    line('I keep the gate the way a man keeps a grave: by staying, and by remembering who is under it.'),
    line('Go in, then. Every door here opens on the same night. Try not to hate the things you meet — they were your friends, and they cannot help wearing your friends’ faces.'),
    line('When you have need of me, I will be further up. I am always further up.'),
  ],
  'ashpriest-2': [
    line('You have seen the walls now. You have seen what holds them: nothing. Habit, and the wind.'),
    line('I stood here the night the fire went out. It did not roar. It simply stopped being warm, the way a voice stops mid-word — and every brand on this wall went dark between one breath and the next.'),
    line('The Queen gave a last command, they tell you. Carried out to you by the herald Edda, faithful to the end.'),
    line('I buried Edda, knight. With these hands, at the gate, three days before she is said to have spoken to you. I know my own graves.'),
    line('So ask it of yourself, gently, on the walk up: whose words are you carrying? And whose errand do they serve?'),
    line('No — do not answer here. Some questions you must carry all the way to the top before you set them down.'),
  ],
};

/** The fixed lead-in for the summit encounter; the final line follows. */
export const ASHPRIEST_3_LEAD: DialogueLine[] = [
  line('This is as far up as I go. Beyond the stair, the warmth you have felt in every stone since the gate — that is Vhaelis, waking.'),
  line('You carry a crown to a fire that lent it. An old debt, come round at last. I will not tell you it is wrong; I have kept the graves of everyone who was certain it was.'),
  line('I only wanted you to reach this place with your eyes open. A knight who obeys blind is just a colder kind of hollow.'),
  line('The Queen’s herald walks the mountain still, they say — the one who set your feet on this road. If you meet her at the top, look at her hands. The dead do not chalk their marks in white.'),
];

/**
 * The Ash-Priest's LAST word at the summit, by ending track. T16 widens
 * `EndingTrack` to include 4 (the Queen's Brand), which will force a fourth
 * arm here — deliberately, so the branch cannot be forgotten.
 */
export const ASHPRIEST_3_FINAL: Record<EndingTrack, DialogueLine> = {
  1: line('You mean to give it back, then — to close the account, the way she asked. Go on, keeper. Set the crown in the flame, and let Vael end as Vael, and not as some thing wearing its face. I will remember you kept faith. Someone should.'),
  2: line('So you will not give it back. You will keep the crown, and the debt, and the long slow falling that comes with it. I understand it; the living always choose more time. Go up, then, and buy Vael its hundred more years. I will keep the graves that pays for. I have the room.'),
  3: line('...Ah. There is no fire left in you to hear me by. You reached the stair, and the stair is all that is left to you. Come, then — give me your hand. Even a dark brand deserves to be carried the last of the way by someone who remembers its name. I remember. I always remember.'),
};

/**
 * The full line sequence for an encounter. Encounters 1 and 2 are static; the
 * summit (3) is the fixed lead-in plus the final line for the run's current
 * ending track (endings.ts).
 */
export function dialogueSequence(
  id: DialogueId,
  flags: ReadonlySet<GameFlag>,
  brandHollow: boolean,
): DialogueLine[] {
  if (id === 'ashpriest-3') {
    return [...ASHPRIEST_3_LEAD, ASHPRIEST_3_FINAL[endingPending(flags, brandHollow)]];
  }
  return DIALOGUE[id];
}

/**
 * Advancing cursor over a line sequence — the pure half of the dialogue box
 * (the DOM half just renders `current`). `advance` steps to the next line and
 * returns whether any remain: false is the box's cue to close.
 */
export class DialogueRunner {
  index = 0;

  constructor(readonly lines: readonly DialogueLine[]) {}

  /** The line to show now, or undefined once the sequence is exhausted. */
  get current(): DialogueLine | undefined {
    return this.lines[this.index];
  }

  /** True once every line has been shown. */
  get done(): boolean {
    return this.index >= this.lines.length;
  }

  /** Step to the next line. Returns true while lines remain, false when the
   *  sequence has just finished (the caller then closes the box). */
  advance(): boolean {
    this.index += 1;
    return !this.done;
  }
}
