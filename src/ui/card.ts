/**
 * Inscription card (Task 12) — a brief centered plate shown when taking a
 * lettered world-item (the Gatekey) or on a small scripted reveal. Lazily
 * created on first use; auto-dismisses after CARD_MS. DOM-only (no per-frame
 * wiring), so it never touches the render loop.
 */
let el: HTMLDivElement | null = null;
let hideTimer = 0;

/** How long a card holds before it fades, ms. */
const CARD_MS = 4200;

function ensure(): HTMLDivElement {
  if (el) return el;
  el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:38%',
    'transform:translate(-50%,-50%)',
    'z-index:960',
    'pointer-events:none',
    'max-width:32ch',
    'text-align:center',
    "font:italic 500 18px/1.5 'Georgia',ui-serif,serif",
    'letter-spacing:0.02em',
    'color:#f0e4c4',
    'text-shadow:0 2px 4px #000',
    'background:linear-gradient(rgba(18,14,10,0.86),rgba(10,8,6,0.86))',
    'border:1px solid rgba(200,170,110,0.45)',
    'border-radius:2px',
    'padding:18px 26px',
    'opacity:0',
    'transition:opacity 480ms ease',
    'display:none',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

/** Show an inscription card with `text`; it fades itself away. */
export function showCard(text: string): void {
  const node = ensure();
  node.textContent = text;
  node.style.display = 'block';
  // Force a reflow so the opacity transition runs from 0 on re-show.
  void node.offsetHeight;
  node.style.opacity = '1';
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (el) el.style.opacity = '0';
  }, CARD_MS);
}
