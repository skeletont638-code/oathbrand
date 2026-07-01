/**
 * Dev-only screenshot hotkey. F9 downloads the canvas as
 * `shot-<zone>-<timestamp>.png` (drop it into docs/shots/). Active only
 * with `?dev=1`, mirroring the dev HUD gate.
 *
 * The WebGL drawing buffer is not preserved between frames, so the key
 * handler only flags a request; `afterRender()` — called by the main loop
 * immediately after the pipeline renders — does the actual read while the
 * buffer still holds this frame's pixels.
 */
export interface ScreenshotKey {
  /** Call right after rendering each frame; captures if F9 was pressed. */
  afterRender(): void;
}

export function installScreenshotKey(opts: {
  canvas: HTMLCanvasElement;
  /** Current zone id, resolved at capture time. */
  zone: () => string;
}): ScreenshotKey | null {
  if (new URLSearchParams(window.location.search).get('dev') !== '1') return null;

  let pending = false;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    e.preventDefault();
    pending = true;
  });

  return {
    afterRender(): void {
      if (!pending) return;
      pending = false;
      // 20260701-193000 — sortable, filename-safe.
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..*$/, '')
        .replace('T', '-');
      const name = `shot-${opts.zone()}-${stamp}.png`;
      // toBlob snapshots the bitmap synchronously (encoding is async), so
      // calling it here — same task as the render — captures this frame.
      opts.canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      });
    },
  };
}
