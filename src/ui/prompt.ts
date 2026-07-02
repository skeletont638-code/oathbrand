/**
 * Context-action prompt — a single reusable DOM element ("[E] READ — …")
 * shown near the bottom of the screen while an interactable is targeted.
 * Lazily created on first show; show/hide are cheap to call every frame
 * (DOM is only touched when the text or visibility actually changes).
 */
import type { InteractVerb } from '../player/Interactor';

let el: HTMLDivElement | null = null;
let visible = false;
let lastText = '';
/** While now < deniedUntil the denied flash owns the element (Task 11). */
let deniedUntil = 0;

const BASE_COLOR = 'var(--parchment)';
const DENY_COLOR = 'var(--blood)';
/** How long the denied flash holds the prompt, ms. */
const DENY_MS = 800;

function ensure(): HTMLDivElement {
  if (el) return el;
  el = document.createElement('div');
  // Sits a fixed height ABOVE the brand HUD (bottom:18px, ~92px tall) so the
  // prompt — and the SEALED rebuke that borrows this element — never overlaps
  // the sigil (the T11 layout bug). The mechanism voice: mono, tracked, quiet.
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:128px',
    'transform:translateX(-50%)',
    'z-index:950',
    'pointer-events:none',
    'font-family:var(--font-mech)',
    'font-weight:600',
    'font-size:calc(14px * var(--ui-scale))',
    'line-height:1.2',
    'letter-spacing:0.16em',
    'color:var(--parchment)',
    'text-shadow:0 2px 0 #000,0 0 18px rgba(0,0,0,0.8)',
    'padding:6px 4px',
    'white-space:nowrap',
    'display:none',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

/** Show (or retext) the prompt: `[E] VERB` or `[E] VERB — target`. */
export function showPrompt(verb: InteractVerb, target?: string): void {
  if (performance.now() < deniedUntil) return; // the denied flash owns it
  const node = ensure();
  const text = target ? `[E] ${verb} — ${target}` : `[E] ${verb}`;
  if (text !== lastText) {
    node.textContent = text;
    node.style.color = BASE_COLOR; // restore after a denied flash
    lastText = text;
  }
  if (!visible) {
    node.style.display = 'block';
    visible = true;
  }
}

/** Hide the prompt. Safe to call every frame / before first show. */
export function hidePrompt(): void {
  if (performance.now() < deniedUntil) return; // let the flash finish
  if (!visible || !el) return;
  el.style.display = 'none';
  visible = false;
}

/**
 * Denied feedback (Task 11): flash the prompt as a short ember-red rebuke
 * — a locked door answers 'SEALED'. Holds the element for DENY_MS (show/
 * hide calls are ignored meanwhile), then normal per-frame prompt flow
 * resumes and restores text/color. Placeholder treatment; T18 polishes.
 */
export function flashDenied(text = 'SEALED'): void {
  const node = ensure();
  deniedUntil = performance.now() + DENY_MS;
  node.textContent = text;
  node.style.color = DENY_COLOR;
  node.style.display = 'block';
  visible = true;
  lastText = ''; // force the next showPrompt to rewrite text + color
}
