/**
 * The full-bleed title card (Task 15) — a big, quiet, letterpressed name over a
 * darkening vignette. Used for the boss intro ('THE FORSWORN, FIRST KNIGHT OF
 * VAEL') and for the endings ('OATH KEPT', 'OATH BROKEN', …).
 *
 * It is a NON-BLOCKING overlay: the game state stays whatever it was
 * ('playing' for the boss intro), input keeps flowing, and the card just fades
 * over the top and (optionally) fades itself away. Pointer-events are off so it
 * never eats a click.
 */

let root: HTMLDivElement | null = null;
let titleEl: HTMLDivElement | null = null;
let subEl: HTMLDivElement | null = null;
let dismissTimer = 0;

function ensure(): HTMLDivElement {
  if (root) return root;
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:1100',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'text-align:center',
    'pointer-events:none',
    'background:radial-gradient(120% 120% at 50% 50%,rgba(4,3,3,0.35),rgba(2,2,2,0.86))',
    'opacity:0',
    'transition:opacity 900ms ease',
  ].join(';');

  // Carved-stone voice: the ending/boss name inscribed in Cinzel.
  const title = document.createElement('div');
  title.style.cssText = [
    "font:700 clamp(30px,6vw,66px)/1.08 var(--font-stone)",
    'letter-spacing:0.14em',
    'color:var(--parchment)',
    'text-shadow:0 2px 0 #000,0 0 44px rgba(196,80,30,0.4)',
    'margin:0 6vw',
  ].join(';');

  // Spoken-word voice: the line beneath, breathed in italic serif; scales with
  // the reader's text-size setting.
  const sub = document.createElement('div');
  sub.style.cssText = [
    'font-family:var(--font-spoken)',
    'font-style:italic',
    'font-weight:400',
    'font-size:calc(clamp(14px,2.4vw,22px) * var(--ui-scale))',
    'line-height:1.55',
    'letter-spacing:0.04em',
    'color:var(--gild)',
    'text-shadow:0 2px 6px #000',
    'margin:24px 8vw 0',
    'max-width:42ch',
  ].join(';');

  el.append(title, sub);
  document.body.appendChild(el);
  root = el;
  titleEl = title;
  subEl = sub;
  return el;
}

/**
 * Raise the title card. `holdMs` (when given) fades it out again after that
 * long; omit it to hold until `hideTitleCard()`.
 */
export function showTitleCard(title: string, subtitle = '', holdMs?: number): void {
  const el = ensure();
  titleEl!.textContent = title;
  subEl!.textContent = subtitle;
  subEl!.style.display = subtitle ? 'block' : 'none';
  void el.offsetHeight; // reflow so the fade runs from 0
  el.style.opacity = '1';
  window.clearTimeout(dismissTimer);
  if (holdMs !== undefined) {
    dismissTimer = window.setTimeout(() => hideTitleCard(), holdMs);
  }
}

/** Fade the card away. */
export function hideTitleCard(): void {
  window.clearTimeout(dismissTimer);
  if (root) root.style.opacity = '0';
}
