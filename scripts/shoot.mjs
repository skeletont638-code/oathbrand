// Usage:
//   1) start a headed Chrome once (owner/executor shell):
//        google-chrome-stable --headless=new --remote-debugging-port=9222 \
//          --window-size=1280,960 --hide-scrollbars about:blank &
//      (or a headed Chrome on DISPLAY=:1 if the sandbox kills --headless — see the memo).
//   2) start the dev server:  npm run dev  (serves http://localhost:5173/oathbrand/)
//   3) node scripts/shoot.mjs <zoneId> <outName> [freeze]
import { writeFileSync } from 'node:fs';

const [, , zone = 'gate-fields', outName = `realism-${zone}`, freeze = '1'] = process.argv;
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
// pump a few frames (rAF is throttled headless), then freeze for a clean plate
for (let i = 0; i < 30; i++) { await evalJs('window.__oathbrand.stepFrame(16)'); }
if (freeze === '1') { await evalJs("window.__oathbrand.game.transition('reading')"); await evalJs('window.__oathbrand.stepFrame(16)'); }
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(`docs/shots/${outName}.png`, Buffer.from(shot.result.data, 'base64'));
console.log(`wrote docs/shots/${outName}.png`);
ws.close();
