/**
 * The end matter (Task 15): the full-screen blackout the endings fade through,
 * the credits crawl, and the interim 'THE VIGIL CONTINUES' restart card that
 * stands in until the real title screen lands (T18). Pure DOM; the ending
 * director/main.ts drive them.
 */
import { CREDITS_LINES, ENDING_NAME } from '../content/endings';
import type { EndingId } from '../content/types';

// ─── the blackout the endings fade through ─────────────────────────────────

let blackoutEl: HTMLDivElement | null = null;

function ensureBlackout(): HTMLDivElement {
  if (blackoutEl) return blackoutEl;
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:1090',
    'background:#000',
    'pointer-events:none',
    'opacity:0',
  ].join(';');
  document.body.appendChild(el);
  blackoutEl = el;
  return el;
}

/** Set the full-screen black overlay alpha (0..1). */
export function setBlackout(alpha: number): void {
  ensureBlackout().style.opacity = String(Math.min(1, Math.max(0, alpha)));
}

// ─── the credits crawl ──────────────────────────────────────────────────────

let creditsEl: HTMLDivElement | null = null;

/**
 * Roll the credits over black. `%ENDING%` in the crawl is filled with the
 * reached ending's name. Interactive (pointer/keys pass through to the page);
 * `onDone` fires when the scroll has run its course (or the player skips with E).
 */
export function rollCredits(ending: EndingId, onDone: () => void): void {
  setBlackout(1);
  if (creditsEl) creditsEl.remove();

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:1095',
    'overflow:hidden',
    'background:#000',
    'cursor:pointer',
  ].join(';');

  const crawl = document.createElement('div');
  crawl.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'top:100%',
    'text-align:center',
    "font:400 20px/2.1 'Georgia',ui-serif,serif",
    'color:#e6dcc2',
    'text-shadow:0 2px 6px #000',
    'letter-spacing:0.05em',
  ].join(';');

  for (const raw of CREDITS_LINES) {
    const line = raw.replace('%ENDING%', ENDING_NAME[ending]);
    const p = document.createElement('div');
    if (line === '') {
      p.style.height = '1.4em';
    } else if (line === 'OATHBRAND') {
      p.textContent = line;
      p.style.cssText = "font:700 40px/1.4 'Georgia',ui-serif,serif;letter-spacing:0.2em;color:#efe3c3;margin-bottom:8px";
    } else if (line === ENDING_NAME[ending]) {
      p.textContent = line;
      p.style.cssText = "font:700 26px/1.5 'Georgia',ui-serif,serif;letter-spacing:0.16em;color:#d8b878;text-transform:uppercase";
    } else {
      p.textContent = line;
    }
    crawl.appendChild(p);
  }

  overlay.appendChild(crawl);
  document.body.appendChild(overlay);
  creditsEl = overlay;

  // Scroll the crawl up from below the screen to fully off the top.
  const DURATION_MS = 22000;
  const start = performance.now();
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    overlay.remove();
    if (creditsEl === overlay) creditsEl = null;
    document.removeEventListener('keydown', onKey, true);
    onDone();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Escape') finish();
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', finish);

  const tick = (now: number): void => {
    if (finished) return;
    const t = (now - start) / DURATION_MS;
    const travel = crawl.offsetHeight + window.innerHeight;
    crawl.style.transform = `translateY(${-t * travel}px)`;
    if (t >= 1) finish();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ─── the interim restart card ───────────────────────────────────────────────

let vigilEl: HTMLDivElement | null = null;

/**
 * The stand-in for a title screen (until T18): 'THE VIGIL CONTINUES' with a
 * prompt to begin again. `onBegin` fires on E / click.
 */
export function showVigilContinues(onBegin: () => void): void {
  setBlackout(1);
  if (vigilEl) vigilEl.remove();

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
    'background:#000',
    'cursor:pointer',
    'opacity:0',
    'transition:opacity 1200ms ease',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'THE VIGIL CONTINUES';
  title.style.cssText = "font:700 clamp(24px,5vw,48px)/1.2 'Georgia',ui-serif,serif;letter-spacing:0.16em;color:#e9dcbb;text-shadow:0 2px 0 #000";

  const hint = document.createElement('div');
  hint.textContent = 'press E to begin again';
  hint.style.cssText = "font:600 13px/1 'Courier New',ui-monospace,monospace;letter-spacing:0.28em;color:rgba(200,170,110,0.7);margin-top:34px;text-transform:uppercase";

  el.append(title, hint);
  document.body.appendChild(el);
  vigilEl = el;
  void el.offsetHeight;
  el.style.opacity = '1';

  let began = false;
  const begin = (): void => {
    if (began) return;
    began = true;
    document.removeEventListener('keydown', onKey, true);
    onBegin();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE' || e.code === 'Enter') begin();
  };
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('click', begin);
}
