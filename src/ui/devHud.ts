/**
 * Dev-only HUD overlay: fps, renderer draw calls, current zone. Active only
 * when the page URL carries `?dev=1` — returns null otherwise, and the game
 * loop's `hud?.` calls become no-ops.
 */
import type { WebGLRenderer } from 'three';

export interface DevHud {
  /** Call at frame start, before any rendering. */
  begin(): void;
  /** Call after rendering, with the current zone id. */
  end(zone: string): void;
}

const UPDATE_INTERVAL_MS = 500;

export function createDevHud(renderer: WebGLRenderer): DevHud | null {
  if (new URLSearchParams(window.location.search).get('dev') !== '1') return null;

  // The PS1 pipeline renders twice per frame (scene → low-res target, then
  // the upscale blit). With autoReset, renderer.info would only ever show
  // the final 1-call blit; resetting manually in begin() makes `calls`
  // cover the whole frame.
  renderer.info.autoReset = false;

  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'top:8px',
    'left:8px',
    'z-index:1000',
    'font:12px/1.5 ui-monospace,Menlo,Consolas,monospace',
    'color:#cfe8cf',
    'background:rgba(10,10,12,0.72)',
    'padding:4px 8px',
    'pointer-events:none',
    'white-space:pre',
  ].join(';');
  el.textContent = 'dev hud';
  document.body.appendChild(el);

  let frames = 0;
  let windowStart = performance.now();

  return {
    begin(): void {
      renderer.info.reset();
    },
    end(zone: string): void {
      frames += 1;
      const now = performance.now();
      const elapsed = now - windowStart;
      if (elapsed < UPDATE_INTERVAL_MS) return;
      const fps = Math.round((frames * 1000) / elapsed);
      frames = 0;
      windowStart = now;
      el.textContent = `${fps} fps\n${renderer.info.render.calls} calls\nzone: ${zone}`;
    },
  };
}
