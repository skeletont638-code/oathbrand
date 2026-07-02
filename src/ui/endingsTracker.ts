/**
 * Endings tracker (Task 18) — the vigil's record, shown on the title screen.
 * Four coals, one per ending; each lights as its ending is witnessed. The pure
 * `endingsTrackerModel` maps the save's `endingsSeen` set onto the four ordered
 * slots (deduped, unknown ids ignored, always length 4) and is unit-tested; the
 * DOM render is a thin projection of it.
 */
import type { EndingId } from '../content/types';
import { ENDING_NAME } from '../content/endings';

/** The four endings, in canonical display order. */
export const ENDING_ORDER: readonly EndingId[] = [1, 2, 3, 4];

export interface TrackerSlot {
  id: EndingId;
  seen: boolean;
  /** The ending's short name once seen; a drawn blank while it is not. */
  name: string;
}

/** Placeholder for an unwitnessed ending — never spoils the name. */
export const UNSEEN_MARK = '— — —';

/**
 * Project `endingsSeen` onto the four ordered tracker slots. Pure: same input,
 * same output. Ids outside 1..4 are ignored; duplicates collapse; the result is
 * always the four endings in order, each flagged seen/unseen.
 */
export function endingsTrackerModel(endingsSeen: readonly EndingId[]): TrackerSlot[] {
  const seen = new Set(endingsSeen);
  return ENDING_ORDER.map((id) => ({
    id,
    seen: seen.has(id),
    name: seen.has(id) ? ENDING_NAME[id] : UNSEEN_MARK,
  }));
}

/** How many distinct endings (of the four) have been witnessed. */
export function endingsSeenCount(endingsSeen: readonly EndingId[]): number {
  return endingsTrackerModel(endingsSeen).filter((s) => s.seen).length;
}

/** Build the tracker DOM for the title screen from an endings-seen list. */
export function renderEndingsTracker(endingsSeen: readonly EndingId[]): HTMLElement {
  const model = endingsTrackerModel(endingsSeen);
  const count = model.filter((s) => s.seen).length;

  const wrap = document.createElement('div');
  wrap.className = 'ob-tracker';

  const label = document.createElement('span');
  label.className = 'ob-eyebrow';
  label.textContent = count === 0 ? 'NO ENDING YET WITNESSED' : `${count} OF 4 ENDINGS WITNESSED`;
  wrap.appendChild(label);

  const coals = document.createElement('div');
  coals.className = 'ob-tracker-coals';
  for (const slot of model) {
    const coal = document.createElement('div');
    coal.className = `ob-coal${slot.seen ? ' is-seen' : ''}`;
    coal.setAttribute(
      'aria-label',
      slot.seen ? `Ending witnessed: ${slot.name}` : 'Ending not yet witnessed',
    );
    const mark = document.createElement('div');
    mark.className = 'mark';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = slot.name;
    coal.append(mark, name);
    coals.appendChild(coal);
  }
  wrap.appendChild(coals);
  return wrap;
}
