/**
 * Brand HUD (final pass, Task 18) — the bottom-centre oath-sigil that IS the
 * health display. A flame mark over a row of ember-slivers: lit slivers = embers
 * left, spent ones burn down to a cold ash outline. The mark swells and blooms
 * with threat, tints blue near a hidden way, and greys out entirely when
 * hollowed. Diegetic: no panel, no border — it reads as a brand on the world.
 *
 * Structure is final and cheap: plain DOM, styled from style.css tokens, state
 * pushed through the returned handle, and per-frame `setPulse` calls only touch
 * the DOM when a value actually changed (change-detection below).
 */
import { TUNING } from '../content/tuning';

export interface BrandHud {
  root: HTMLElement;
  /** How many embers are lit (0..maxEmbers). */
  setEmbers(embers: number): void;
  /** Hollow: grey the whole sigil out. */
  setHollow(hollow: boolean): void;
  /** Per-frame pulse: 0..1 intensity swells/blooms the sigil; blue tints it. */
  setPulse(intensity: number, blue: boolean): void;
  dispose(): void;
}

/** Two-layer flame mark; the inner cutout reads as a sigil, not a blob. */
function flameSvg(): string {
  return `
<svg class="sigil" viewBox="0 0 24 32" width="40" height="53" aria-hidden="true">
  <path fill="currentColor"
    d="M12 1 C14.5 7.5 20 10.5 20 18.5 A8 9 0 1 1 4 18.5 C4 10.5 9.5 7.5 12 1 Z"/>
  <path fill="#0b0b0e"
    d="M12 12 C13.6 15.6 16 17.2 16 21 A4 4.6 0 1 1 8 21 C8 17.2 10.4 15.6 12 12 Z"/>
</svg>`;
}

export function createBrandHud(maxEmbers: number = TUNING.brand.maxEmbers): BrandHud {
  const root = document.createElement('div');
  root.className = 'brand-hud';
  root.setAttribute('aria-hidden', 'true'); // decorative mirror of ember state
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
      // Swell up to +28% and bloom as the threat closes in.
      sigil.style.transform = `scale(${(1 + 0.28 * i).toFixed(3)})`;
      sigil.style.filter =
        i > 0
          ? `drop-shadow(0 0 ${Math.round(4 + 12 * i)}px var(--hud-ember))`
          : 'drop-shadow(0 0 5px rgba(196,80,30,0.5))';
    },
    dispose(): void {
      root.remove();
    },
  };
}
