// Replays the bugs found in review against the real page (desk.html, headless), and fails if any comes back.
// node tools/check/desk-bugs.mjs        (needs the dev server: cd web && npx vite --port 5180)
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5180/desk.html?demo&mute';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
const ok = (name, pass, detail = '') => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!pass) failed++; };

async function open(init = '') {
  const p = await b.newPage({ viewport: { width: 1440, height: 420 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // stand in for the Mac app: keep what the page posts to it
  await p.addInitScript(`window.__posted = []; window.webkit = { messageHandlers: { fad: { postMessage: (m) => window.__posted.push(m) } } }; ${init}`);
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__desk?.man?.visible && window.__desk.game, null, { timeout: 120000 });
  return { p, errs };
}
// step the simulation until a condition holds (at most `max` seconds of his time)
const until = (p, cond, max = 60) => p.evaluate(({ cond, max }) => {
  const d = window.__desk, f = new Function('man', 'game', `return (${cond})`); const seen = [];
  for (let s = 0; s < max; s += 0.2) { if (f(d.man, d.game)) return { ok: true, s: +s.toFixed(1), seen }; d.skip(0.2); if (seen.at(-1) !== d.man.phase) seen.push(d.man.phase); }
  return { ok: false, phase: d.man.phase, seen };
}, { cond, max });

{
  const { p, errs } = await open();
  await p.evaluate(() => { const m = window.__desk.man, o = m.emit; window.__ev = []; m.emit = (n, d) => { window.__ev.push(n); o(n, d); }; });

  // 1. a click in the seconds after he first sits must not cancel the beer ritual
  let r = await until(p, `man.phase === 'settling'`);
  ok('he reaches the settling step after the first sit', r.ok, JSON.stringify(r.seen));
  const poked = await p.evaluate(() => {
    const m = window.__desk.man, opts = { bubbles: true, clientX: 700, clientY: 200, pointerId: 1 };
    dispatchEvent(new PointerEvent('pointerdown', opts)); dispatchEvent(new PointerEvent('pointerup', opts));
    return m.act('poke');
  });
  ok('a poke while he settles is refused', poked === false);
  r = await until(p, `man.phase === 'broke'`, 30);
  ok('he still gets up and asks for money', r.ok && (await p.evaluate(() => window.__ev.includes('askMoney'))), JSON.stringify(r.seen));

  // pay, back from the shop, seated
  await p.evaluate(() => window.fad.pay());
  r = await until(p, `man.phase === 'seated'`, 60);
  ok('paid: he comes back and sits', r.ok && (await p.evaluate(() => window.__ev.includes('back'))), JSON.stringify(r.seen));

  // 5. a mood that breaks into a doze stops the snore
  const woke = await p.evaluate(() => { const m = window.__desk.man; window.__ev.length = 0; m.mood = 'doze'; m.doze = 1; m.act('talk'); return window.__ev.includes('wake') && m.mood === null; });
  ok('breaking into a doze wakes him (the snore stops)', woke);
  await until(p, `man.phase === 'seated'`, 10);

  // 3. while he stands up for a stone, neither a poke nor a bite may break in, and nothing throws
  const stood = await p.evaluate(() => { const d = window.__desk, m = d.man; const a = m.act('stone'); d.skip(0.3); return { a, phase: m.phase, poke: m.act('poke'), bite: m.bite() }; });
  ok('standing up for a stone is not interrupted', stood.a && stood.phase === 'standing' && stood.poke === false && stood.bite === false, JSON.stringify(stood));
  r = await until(p, `man.phase === 'seated'`, 20);
  ok('he sits back down after the stone', r.ok, JSON.stringify(r.seen));
  const layered = await p.evaluate(() => { const c = window.__desk.man.ch; try { c.play('Sitting_Exit', { once: true }); c.layer({ up: 'Hit_Chest', once: true }); c.layer({ low: 'Sitting_Idle_Loop', up: 'Sitting_Idle_Loop' }); return 'ok'; } catch (e) { return e.message; } });
  ok('an upper-body move over a whole-body move does not throw', layered === 'ok', layered);

  // 4 + 2. forced bites while one is on are ignored; the wide grab area stops at the top of the Dock
  const bit = await p.evaluate(() => { const d = window.__desk, g = d.game; window.fad.bite(); const s1 = g.state; window.fad.bite(); window.fad.bite(); window.fad.bite();
    const rs = g.rects(), wide = rs.at(-1), dockTop = innerHeight - d.L.floor; return { s1, s2: g.state, bottom: Math.round(wide[1] + wide[3]), dockTop }; });
  ok('A bite now starts a bite', bit.s1 === 'bite');
  ok('the grab area ends at the top of the Dock', bit.bottom <= bit.dockTop, JSON.stringify(bit));

  // 7. a landed catch frees its meshes
  await p.evaluate(() => { const T = window.__desk.THREE; window.__disposed = 0; for (const C of [T.BufferGeometry, T.Material]) { const o = C.prototype.dispose; C.prototype.dispose = function () { window.__disposed++; return o.call(this); }; }
    dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.__desk.game.landNow(); });          // hold the reel, or the fish gets away
  r = await until(p, `game.state !== 'fight'`, 10); await p.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })));
  ok('held to the end, the fish is landed', r.ok && r.seen.includes('landing'), JSON.stringify(r.seen));
  r = await until(p, `man.phase === 'seated' && game.state === 'idle'`, 40);
  const disposed = await p.evaluate(() => window.__disposed);
  ok('landed, back in his chair, the game idle', r.ok, JSON.stringify(r.seen));
  ok('the catch\'s meshes are freed', disposed > 0, `${disposed} shapes and materials`);
  // the extra "A bite now" calls left no timer behind: no bite in the next 7 s (a normal one is 20 s or more away)
  await p.waitForTimeout(7000);
  ok('no stray bite after the catch', (await p.evaluate(() => window.__desk.game.state)) === 'idle');

  // 10. after midnight the count starts again without waiting for a catch
  const rolled = await p.evaluate(async () => {
    const Real = Date; window.__posted.length = 0;
    globalThis.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + 86400000])); } static now() { return Real.now() + 86400000; } };
    await new Promise(res => setTimeout(res, 2600)); globalThis.Date = Real;
    return window.__posted.some(m => m === '{"today":0}');
  });
  ok('a new day resets today\'s count', rolled);
  ok('no page errors in the run', errs.length === 0, errs.slice(0, 3).join(' | '));
  await p.close();
}

// 6. bad saved records must not stop the game from starting
for (const bad of ['null', '{broken']) {
  const { p, errs } = await open(`try { localStorage.setItem('fad.v1', ${JSON.stringify(bad)}); } catch (e) {}`);
  const fine = await p.evaluate(() => !!window.__desk.game && typeof window.__desk.game.bite === 'function');
  ok(`saved record ${JSON.stringify(bad)}: the game still starts`, fine && errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

await b.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
