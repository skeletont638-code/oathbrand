/**
 * Brand HUD — the bottom-center oath-sigil that IS the health display.
 * A flame sigil ringed by ember segments: lit segments = embers left,
 * pulse scale/glow tracks threat intensity, blue tint = illusory wall
 * nearby, full grayscale = hollowed.
 *
 * PLACEHOLDER visual quality (Task 18 does the real design pass) but the
 * structure is final: plain DOM + CSS, state pushed in via the returned
 * handle, no canvas, no per-frame DOM writes unless a value changed.
 */
import { TUNING } from '../content/tuning';

export interface BrandHud {
  root: HTMLElement;
  /** How many embers are lit (0..maxEmbers). */
  setEmbers(embers: number): void;
  /** Hollow: gray the whole sigil out. */
  setHollow(hollow: boolean): void;
  /** Per-frame pulse: 0..1 intensity scales/glows the sigil; blue tints it. */
  setPulse(intensity: number, blue: boolean): void;
  dispose(): void;
}

const EMBER_COLOR = '#ff9d45';
const EMBER_BLUE = '#6db4ff';

const CSS = `
.brand-hud {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 900;
  pointer-events: none;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  --ember: ${EMBER_COLOR};
}
.brand-hud.blue { --ember: ${EMBER_BLUE}; }
.brand-hud .sigil {
  color: var(--ember);
  transition: color 120ms linear;
  will-change: transform, filter;
}
.brand-hud .embers { display: flex; gap: 7px; }
.brand-hud .ember {
  width: 9px;
  height: 13px;
  background: #2a2622;
  border: 1px solid rgba(200, 170, 110, 0.28);
  clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);
  transition: background 160ms linear, box-shadow 160ms linear;
}
.brand-hud .ember.lit {
  background: var(--ember);
  box-shadow: 0 0 6px var(--ember);
}
.brand-hud.hollow { filter: grayscale(1); opacity: 0.72; }
`;

let styleEl: HTMLStyleElement | null = null;

function ensureStyles(): void {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
}

/** Simple two-layer flame mark; inner cutout reads as a sigil, not a blob. */
function flameSvg(): string {
  return `
<svg class="sigil" viewBox="0 0 24 32" width="42" height="56" aria-hidden="true">
  <path fill="currentColor"
    d="M12 1 C14.5 7.5 20 10.5 20 18.5 A8 9 0 1 1 4 18.5 C4 10.5 9.5 7.5 12 1 Z"/>
  <path fill="#14120f"
    d="M12 12 C13.6 15.6 16 17.2 16 21 A4 4.6 0 1 1 8 21 C8 17.2 10.4 15.6 12 12 Z"/>
</svg>`;
}

export function createBrandHud(maxEmbers: number = TUNING.brand.maxEmbers): BrandHud {
  ensureStyles();

  const root = document.createElement('div');
  root.className = 'brand-hud';
  root.innerHTML = flameSvg();

  const row = document.createElement('div');
  row.className = 'embers';
  const segments: HTMLElement[] = [];
  for (let i = 0; i < maxEmbers; i += 1) {
    const seg = document.createElement('div');
    seg.className = 'ember lit';
    row.appendChild(seg);
    segments.push(seg);
  }
  root.appendChild(row);
  document.body.appendChild(root);

  const sigil = root.querySelector<SVGElement>('.sigil');

  // Change detection so per-frame setPulse calls don't churn the DOM.
  let lastEmbers = maxEmbers;
  let lastHollow = false;
  let lastIntensity = -1;
  let lastBlue = false;

  return {
    root,
    setEmbers(embers: number): void {
      const n = Math.max(0, Math.min(maxEmbers, Math.floor(embers)));
      if (n === lastEmbers) return;
      lastEmbers = n;
      segments.forEach((seg, i) => seg.classList.toggle('lit', i < n));
    },
    setHollow(hollow: boolean): void {
      if (hollow === lastHollow) return;
      lastHollow = hollow;
      root.classList.toggle('hollow', hollow);
    },
    setPulse(intensity: number, blue: boolean): void {
      if (blue !== lastBlue) {
        lastBlue = blue;
        root.classList.toggle('blue', blue);
      }
      const i = Math.max(0, Math.min(1, intensity));
      if (i === lastIntensity || !sigil) return;
      lastIntensity = i;
      // Swell up to +30% and bloom as the threat closes in.
      sigil.style.transform = `scale(${(1 + 0.3 * i).toFixed(3)})`;
      sigil.style.filter =
        i > 0 ? `drop-shadow(0 0 ${Math.round(12 * i)}px var(--ember))` : '';
    },
    dispose(): void {
      root.remove();
    },
  };
}
