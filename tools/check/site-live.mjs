// The landing page with him live on its Dock: his bubble's $5 button takes a real mouse click through the page, and the
// page's own Dock buttons under his strip still work. node tools/check/site-live.mjs [url]   (serve site/dist first)
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8820/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${x}`); if (!c) failed++; };
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(url, { waitUntil: 'load', timeout: 120000 });   // a busy Mac (other jobs) can take over 30 s
const fr = () => p.frame({ url: /\/desk\/desk/ });
await p.waitForFunction(() => document.getElementById('man').contentWindow.__desk?.man, null, { timeout: 120000 });
// the page's Dock button under his strip: "How to install" scrolls to the steps
await p.click('.dock a[href="#install"]'); await p.waitForTimeout(400);
ok('a Dock button under his strip still clicks', (await p.evaluate(() => location.hash)) === '#install');
await p.evaluate(() => scrollTo(0, 0));
// wait for him to beg, then press "Give him $5" with the real mouse
await fr().waitForFunction(() => window.__desk.man.phase === 'broke' && document.querySelector('.say button:not(.x)'), null, { timeout: 90000 });
await p.waitForTimeout(600);
const box = await fr().evaluate(() => { const r = document.querySelector('.say button:not(.x)').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
const off = await p.evaluate(() => { const r = document.getElementById('man').getBoundingClientRect(); return { x: r.left, y: r.top }; });
await p.mouse.move(off.x + box.x - 30, off.y + box.y - 30); await p.mouse.move(off.x + box.x, off.y + box.y, { steps: 5 }); await p.waitForTimeout(250);
await p.mouse.click(off.x + box.x, off.y + box.y); await p.waitForTimeout(150);
const paid = await fr().evaluate(() => ({ money: window.__desk.man.money, phase: window.__desk.man.phase }));
ok('his $5 button takes a real click through the page', paid.money === true, JSON.stringify(paid));
// the mouse leaves him: the page gets it back
await p.mouse.move(200, 300, { steps: 4 }); await p.waitForTimeout(300);
ok('away from him the page has the mouse again', (await p.evaluate(() => getComputedStyle(document.getElementById('man')).pointerEvents)) === 'none');
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await b.close(); console.log(failed ? `${failed} failed` : 'all passed'); process.exit(failed ? 1 : 0);
