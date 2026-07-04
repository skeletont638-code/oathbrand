// Usage:
//   1) start a headed Chrome once (owner/executor shell):
//        google-chrome-stable --headless=new --remote-debugging-port=9222 \
//          --window-size=1280,960 --hide-scrollbars about:blank &
//      (or a headed Chrome on DISPLAY=:1 if the sandbox kills --headless — see the memo).
//   2) start the dev server:  npm run dev  (serves http://localhost:5173/oathbrand/)
//   3) node scripts/shoot.mjs <zoneId> <outName> [freeze]
//      node scripts/shoot.mjs <zoneId> --drawcalls   (Task 12 Step 2: print the
//        settled per-frame draw-call count for <zoneId> instead of shooting a PNG;
//        used to confirm no exterior zone crosses the <100 draw-call budget)
import { writeFileSync } from 'node:fs';

const rawArgs = process.argv.slice(2);
const drawcallsMode = rawArgs.includes('--drawcalls');
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const [zone = 'gate-fields', outName = `realism-${zone}`, freeze = '1'] = positional;
const BASE = process.env.OATHBRAND_URL ?? 'http://localhost:5173/oathbrand/';
const CDP = process.env.CDP_URL ?? 'http://localhost:9222';

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
// pump a few frames (rAF is throttled headless) so the zone settles + paints.
// stepFrame runs the whole frame (sim + both PS1 passes + info.reset) synchronously,
// so renderer.info.render.calls holds the completed frame count after each call.
for (let i = 0; i < 30; i++) { await evalJs('window.__oathbrand.stepFrame(16)'); }

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
  ws.close();
} else {
  // freeze for a clean plate
  if (freeze === '1') { await evalJs("window.__oathbrand.game.transition('reading')"); await evalJs('window.__oathbrand.stepFrame(16)'); }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`docs/shots/${outName}.png`, Buffer.from(shot.result.data, 'base64'));
  console.log(`wrote docs/shots/${outName}.png`);
  ws.close();
}
