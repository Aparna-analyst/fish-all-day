// Stills of real moments for the landing page (desk.html in its browser preview: wallpaper and Dock), headless.
// node tools/check/site-stills.mjs site/media        (needs the dev server: cd web && npx vite --port 5180)
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const out = process.argv[2] || 'site/media';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:5180/desk.html?${process.env.CLEAR ? 'clear' : 'preview'}&demo&mute&ppm=190&floor=86&spot=0.46`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__desk?.man?.visible && window.__desk.game, null, { timeout: 120000 });
await p.evaluate(() => { const m = window.__desk.man, o = m.emit; window.__ev = {}; m.emit = (n, d) => { window.__ev[n] = 1; o(n, d); }; });
const until = (cond, max = 60) => p.evaluate(({ cond, max }) => { const d = window.__desk, f = new Function('man', 'game', `return (${cond})`);
  for (let s = 0; s < max; s += 0.1) { if (f(d.man, d.game)) return true; d.skip(0.1); } return false; }, { cond, max });
const shot = async (name) => { await p.evaluate(() => document.querySelectorAll('.card').forEach(c => c.hidden = true)); await (process.env.CLEAR ? p.screenshot({ path: `${out}/${name}.png`, omitBackground: true }) : p.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 86 })); console.log('wrote', name); };

await until(`man.phase === 'broke'`, 80); await p.waitForTimeout(900); await shot('beg');                       // forgot his beer: $5, kid
await p.evaluate(() => window.fad.pay()); await until(`man.phase === 'seated'`, 80); await p.waitForTimeout(300);
await p.evaluate(() => { window.fad.bite(); window.__desk.skip(0.5); }); await p.waitForTimeout(400); await shot('reel');   // a bite!
await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.__desk.game.landNow(); });
const danced = await until(`window.__ev.dance`, 30); await until(`false`, 1.6); await p.waitForTimeout(500);
console.log('dance seen', danced, await p.evaluate(() => window.__desk.man.phase + ' ' + Object.keys(window.__ev).join(','))); await shot('dance');
await p.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })));
await until(`man.phase === 'seated' && game.state === 'idle'`, 40);
await p.evaluate(() => window.__desk.man.act('stone')); await until(`man.phase === 'seated'`, 20); await p.waitForTimeout(900); await shot('stone');
await until(`false`, 6); await p.waitForTimeout(2500);
await p.mouse.move(400, 330); await p.mouse.move(415, 345); await p.waitForTimeout(400); await shot('controls');   // hover: his little toolbar
console.log(errs.length ? errs.slice(0, 3).join('\n') : 'no page errors'); await b.close();
