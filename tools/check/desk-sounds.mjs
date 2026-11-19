// Every new sound has a moment: walking, the chair, the can, a sip, the stone, falling in. Also checks each file loads.
// node tools/check/desk-sounds.mjs        (needs the dev server: cd web && npx vite --port 5180)
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 420 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(`window.webkit = { messageHandlers: { fad: { postMessage: () => {} } } };`);
await p.goto('http://127.0.0.1:5180/desk.html?demo&mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.__desk?.man?.visible && window.__desk.game, null, { timeout: 120000 });
const r = await p.evaluate(async () => {
  const d = window.__desk, m = d.man, o = m.emit, seen = {}; m.emit = (n, x) => { seen[n] = (seen[n] || 0) + 1; o(n, x); };
  const step = (cond, max) => { for (let s = 0; s < max; s += 0.1) { if (cond()) return true; d.skip(0.1); } return false; };
  step(() => m.phase === 'broke', 60); window.fad.pay(); step(() => m.phase === 'seated', 60);       // walk in, sit, can, beg, shop, back
  m.act('stone'); step(() => m.phase === 'seated' && seen.whoosh, 20);
  const R = Math.random; Math.random = () => 0.1; step(() => seen.gulp, 90); Math.random = R;      // a sip is a random mood: make the dice pick it
  step(() => m.phase === 'seated', 20); m.act('fart'); step(() => seen.fart, 3); step(() => false, 4);
  m.lose(); step(() => seen.bigSplash, 10);
  const files = {}; for (const n of ['canopen', 'creak', 'step1', 'step2', 'whoosh', 'bigsplash', 'gulp', 'fart1', 'fart2', 'fart3']) {
    try { const a = await (await fetch(`./assets/sfx/${n}.mp3`)).arrayBuffer(); const bf = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(a); files[n] = +bf.duration.toFixed(2); } catch (e) { files[n] = 'BAD ' + e.message; } }
  return { seen, files };
});
let failed = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${x}`); if (!c) failed++; };
for (const e of ['step', 'creak', 'canOpen', 'whoosh', 'fart']) ok(`he makes the ${e} sound`, r.seen[e] > 0, `${r.seen[e] || 0}x`);
ok('a sip makes a gulp', r.seen.gulp > 0, `${r.seen.gulp || 0}x`);
ok('falling in makes the big splash', r.seen.bigSplash > 0, `${r.seen.bigSplash || 0}x`);
for (const [n, v] of Object.entries(r.files)) ok(`${n}.mp3 decodes`, typeof v === 'number' && v > 0.05, `${v}s`);
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await b.close(); console.log(failed ? `${failed} failed` : 'all passed'); process.exit(failed ? 1 : 0);
