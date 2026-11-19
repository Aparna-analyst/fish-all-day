// Stills from the running game, headless. node tools/check/shots.mjs "<query>" <out-prefix> <seconds...> [--phone] [--js "<code run before each still>"]
// e.g. node tools/check/shots.mjs "seated&cam=2&t=10" design/game/seated 4 8
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const a = process.argv.slice(2); const phone = a.includes('--phone'); const ji = a.indexOf('--js'); const js = ji >= 0 ? a[ji + 1] : null;
const pos = a.filter((x, i) => !x.startsWith('--') && (ji < 0 || i !== ji + 1));
const [query, prefix, ...times] = pos;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
await p.goto('http://127.0.0.1:5180/?' + query, { waitUntil: 'load' });
if (/play|seated/.test(query)) await p.waitForFunction(() => window.__fad?.fisher?.visible, null, { timeout: 90000 });
const t0 = Date.now();
for (const t of times.map(Number)) {
  const wait = t * 1000 - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait);
  if (js) await p.evaluate(js);
  const f = `${prefix}-${String(t).padStart(3, '0')}s${phone ? '-phone' : ''}.jpg`;
  await p.screenshot({ path: f, type: 'jpeg', quality: 82 }); console.log('wrote', f);
}
const info = await p.evaluate(() => { const f = window.__fad?.fisher; return f ? { phase: f.phase, pos: f.pos.toArray().map(x => +x.toFixed(2)), yaw: +f.yaw.toFixed(2), bob: f.bobState, can: f.canIn } : 'no fisher'; });
console.log('fisher', JSON.stringify(info)); if (errs.length) console.log(errs.slice(0, 12).join('\n'));
await b.close();
