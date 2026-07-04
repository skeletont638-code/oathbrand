// Usage:
//   1) start the dev server:  npm run dev  (serves http://localhost:5173/oathbrand/)
//   2) node scripts/shoot.mjs <zoneId> <outName> [freeze]
//      node scripts/shoot.mjs <zoneId> --drawcalls   (Task 12 Step 2: print the
//        settled per-frame draw-call count for <zoneId> instead of shooting a PNG;
//        used to confirm no exterior zone crosses the <100 draw-call budget)
//      node scripts/shoot.mjs <zoneId> <outName> --gpu   (render on the real GPU —
//        see below)
//
// BROWSER: if a CDP endpoint is already reachable (CDP_URL / CDP_PORT, default
// :9333) this connects to it; otherwise it LAUNCHES its own headless Chrome with
// the WebGL backend flags and kills it on exit. The backend is:
//   - default: SwiftShader (CPU) — `--use-gl=angle --use-angle=swiftshader
//     --enable-unsafe-swiftshader`. Portable; works sandboxed.
//   - `--gpu`: Vulkan on the real GPU — `--use-angle=vulkan
//     --enable-features=Vulkan`. VERIFIED to render on this box's RTX 5070, but
//     ONLY when the shoot command runs UNSANDBOXED. Pin the noise down with
//     `taskset -c 16-27` on the launch (owner is at the machine — fan-noise).
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const drawcallsMode = rawArgs.includes('--drawcalls');
// HD-Mode A/B prototype: flip the pipeline into native-res HD before capturing,
// via the dev handle (same camera/zone as the PS1 shot → a clean comparison).
const hdMode = rawArgs.includes('--hd');
// --gpu: swap the CPU SwiftShader backend for Vulkan on the real GPU (only when
// launching our own Chrome; a reused CDP endpoint keeps whatever it launched with).
const gpuMode = rawArgs.includes('--gpu');
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const [zone = 'gate-fields', outName = `realism-${zone}`, freeze = '1'] = positional;
const BASE = process.env.OATHBRAND_URL ?? 'http://localhost:5173/oathbrand/';
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);
const CDP = process.env.CDP_URL ?? `http://localhost:${CDP_PORT}`;

// WebGL backend flag sets: --gpu → Vulkan on the RTX; else CPU SwiftShader.
const GL_SWIFTSHADER = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const GL_VULKAN = ['--use-angle=vulkan', '--enable-features=Vulkan'];
const glFlags = gpuMode ? GL_VULKAN : GL_SWIFTSHADER;

/** Reachable CDP already? (a Chrome the owner started, or a prior run.) */
async function cdpUp() {
  try {
    const r = await fetch(`${CDP}/json/version`);
    return r.ok;
  } catch {
    return false;
  }
}

// Launch our own headless Chrome with the chosen backend unless one is already up.
let launched;
if (!(await cdpUp())) {
  const chrome = process.env.CHROME_BIN ?? 'google-chrome-stable';
  const userDataDir = mkdtempSync(join(tmpdir(), 'oathbrand-shoot-'));
  launched = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      '--window-size=1280,960',
      '--hide-scrollbars',
      '--no-sandbox',
      '--no-first-run',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      `--user-data-dir=${userDataDir}`,
      ...glFlags,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  launched.on('error', (e) => { console.error(`failed to launch chrome (${chrome}): ${e.message}`); process.exit(1); });
  // wait for the CDP endpoint to come up
  let up = false;
  for (let i = 0; i < 100; i++) {
    if (await cdpUp()) { up = true; break; }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!up) { console.error(`chrome CDP never came up on ${CDP}`); launched.kill('SIGKILL'); process.exit(1); }
  console.log(`launched ${gpuMode ? 'Vulkan/GPU' : 'SwiftShader/CPU'} Chrome on ${CDP}`);
}

const list = await (await fetch(`${CDP}/json`)).json();
const page = list.find((t) => t.type === 'page') ?? list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evalJs = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${BASE}?dev=1&zone=${zone}` });
// wait for the dev handle + 'playing' state
for (let i = 0; i < 200; i++) {
  const ok = await evalJs("!!window.__oathbrand && window.__oathbrand.game && window.__oathbrand.game.state==='playing'");
  if (ok) break;
  await new Promise((r) => setTimeout(r, 100));
}
// HD-Mode: flip render mode on the exposed pipeline BEFORE pumping frames, so the
// material recompile + native-res target rebuild settle during the warm-up.
if (hdMode) { await evalJs("window.__oathbrand.pipeline.setRenderMode('hd')"); }

// pump a few frames (rAF is throttled headless) so the zone settles + paints.
// stepFrame runs the whole frame (sim + both PS1 passes + info.reset) synchronously,
// so renderer.info.render.calls holds the completed frame count after each call.
for (let i = 0; i < 30; i++) { await evalJs('window.__oathbrand.stepFrame(16)'); }

/** Close the socket + kill any Chrome WE launched, then exit. */
function finish() {
  ws.close();
  if (launched) launched.kill('SIGKILL');
  process.exit(0);
}

if (drawcallsMode) {
  // Take the max over a few more settled frames (belt-and-braces; each read is
  // already a completed-frame count under the synchronous stepper).
  let calls = 0;
  for (let i = 0; i < 6; i++) {
    await evalJs('window.__oathbrand.stepFrame(16)');
    const n = await evalJs('window.__oathbrand.drawCalls');
    if (typeof n === 'number') calls = Math.max(calls, n);
  }
  console.log(`${zone}\t${calls}`);
  finish();
} else {
  // freeze for a clean plate
  if (freeze === '1') { await evalJs("window.__oathbrand.game.transition('reading')"); await evalJs('window.__oathbrand.stepFrame(16)'); }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`docs/shots/${outName}.png`, Buffer.from(shot.result.data, 'base64'));
  console.log(`wrote docs/shots/${outName}.png`);
  finish();
}
