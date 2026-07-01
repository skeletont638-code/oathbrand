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

function ensure(): HTMLDivElement {
  if (el) return el;
  el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:15%',
    'transform:translateX(-50%)',
    'z-index:950',
    'pointer-events:none',
    "font:600 15px/1.2 'Courier New',ui-monospace,monospace",
    'letter-spacing:0.14em',
    'color:#e8dfc8',
    'text-shadow:0 2px 0 #000',
    'background:rgba(12,10,8,0.62)',
    'border:1px solid rgba(200,170,110,0.35)',
    'padding:7px 14px',
    'white-space:nowrap',
    'display:none',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

/** Show (or retext) the prompt: `[E] VERB` or `[E] VERB — target`. */
export function showPrompt(verb: InteractVerb, target?: string): void {
  const node = ensure();
  const text = target ? `[E] ${verb} — ${target}` : `[E] ${verb}`;
  if (text !== lastText) {
    node.textContent = text;
    lastText = text;
  }
  if (!visible) {
    node.style.display = 'block';
    visible = true;
  }
}

/** Hide the prompt. Safe to call every frame / before first show. */
export function hidePrompt(): void {
  if (!visible || !el) return;
  el.style.display = 'none';
  visible = false;
}
