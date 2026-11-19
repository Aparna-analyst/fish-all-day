// His voice and the bubble's x, headless: a line with a clip plays and keeps the bubble up; x closes it and stops him;
// "His voice" off keeps him silent. node tools/check/desk-voice.mjs (needs vite on :5180 and at least one clip made)
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1440, height: 420 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
let failed = 0; const ok = (n, pass, d = '') => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!pass) failed++; };
await p.goto('http://127.0.0.1:5180/desk.html?seated', { waitUntil: 'load' });
await p.waitForFunction(() => window.__desk?.game, null, { timeout: 120000 });
const r = await p.evaluate(async () => {
  const { sfx, voice } = window.__desk; sfx.unlock();
  const idx = await (await fetch('./assets/voice/index.json')).json(); const text = Object.values(idx._lines || {})[0]; if (!text) return { text: null, d: 0 };
  await new Promise(res => setTimeout(res, 500));
  const d = await voice.say(text); return { text, d: +d.toFixed(2) };
});
if (r.text) ok('a line with a clip plays', r.d > 0.5, JSON.stringify(r)); else console.log('SKIP  a line with a clip plays (no clips made yet)');
// the real bubble: start begging so the money bubble (with its x) shows, then close it
const shown = await p.evaluate(() => { window.__desk.man.emit('askMoney'); const s = document.querySelector('.say'); return { hidden: s.hidden, x: !!s.querySelector('button.x'), pay: !!s.querySelector('button:not(.x)') }; });
ok('his bubble shows an x (and the pay button)', !shown.hidden && shown.x && shown.pay, JSON.stringify(shown));
await p.click('.say button.x');
const closed = await p.evaluate(() => document.querySelector('.say').hidden);
ok('the x closes the bubble', closed);
const off = await p.evaluate(async () => { const { voice } = window.__desk; window.fad.voice(false); const idx = await (await fetch('./assets/voice/index.json')).json();
  const t = Object.values(idx._lines || {})[0]; if (!t) { window.fad.voice(true); return null; } const d = await voice.say(t); window.fad.voice(true); return d; });
if (off !== null) ok('"His voice" off: silent', off === 0); else console.log('SKIP  "His voice" off: silent (no clips made yet)');
// his toolbar: hovering him shows it; the voice button turns his voice off; the house sends him home (no bites)
await p.evaluate(() => dispatchEvent(new PointerEvent('pointermove', { clientX: 900, clientY: 300 })));
await p.waitForTimeout(400);
const chip = await p.evaluate(() => { const c = document.querySelector('.chip'); return { shown: !c.hidden, n: c.querySelectorAll('button').length }; });
ok('his toolbar shows when the mouse is on him', chip.shown && chip.n === 4, JSON.stringify(chip));
await p.click('.chip [data-k=voice]');
const v = await p.evaluate(() => ({ sw: window.__desk.game.switches.voice, on: window.__desk.voice.isOn(), off: document.querySelector('.chip [data-k=voice]').classList.contains('off') }));
ok('the voice button turns his voice off (and shows it)', v.sw === false && v.on === false && v.off, JSON.stringify(v));
await p.click('.chip [data-k=voice]');
await p.click('.chip [data-k=hide]');
const home = await p.evaluate(() => { const g = window.__desk.game; const before = g.state; window.fad.bite(); return { before, after: g.state, chipHidden: document.querySelector('.chip').hidden }; });
ok('sent home: a bite does not start', home.after === 'idle' && home.chipHidden, JSON.stringify(home));
await p.evaluate(() => window.fad.hidden(false));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await b.close(); console.log(failed ? `${failed} failed` : 'all passed'); process.exit(failed ? 1 : 0);
