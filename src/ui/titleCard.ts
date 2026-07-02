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

  const title = document.createElement('div');
  title.style.cssText = [
    "font:700 clamp(28px,6vw,64px)/1.1 'Georgia',ui-serif,serif",
    'letter-spacing:0.14em',
    'text-transform:uppercase',
    'color:#e9dcbb',
    'text-shadow:0 2px 0 #000,0 0 40px rgba(180,120,60,0.35)',
    'margin:0 6vw',
  ].join(';');

  const sub = document.createElement('div');
  sub.style.cssText = [
    "font:italic 400 clamp(14px,2.4vw,22px)/1.5 'Georgia',ui-serif,serif",
    'letter-spacing:0.06em',
    'color:#c8b892',
    'text-shadow:0 2px 6px #000',
    'margin:22px 8vw 0',
    'max-width:40ch',
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
