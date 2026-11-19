// His walks never pass through the chair or the cooler: arrival, to the shop and back, and the walk out to flop on his
// back. Samples his position every 0.1 s while a walk move plays; fails if his body (0.10 m core) enters a footprint.
// Writes a top-down map: design/game/paths.jpg.  node tools/check/desk-paths.mjs   (needs vite on :5180)
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 420 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5180/desk.html?demo&mute', { waitUntil: 'load' });
await p.waitForFunction(() => window.__desk?.man?.visible && window.__desk.game, null, { timeout: 120000 });
const r = await p.evaluate(() => {
  const d = window.__desk, m = d.man, F = m.footprints(), track = [], bad = [];
  const local = (o, x, z) => { const dx = x - o.cx, dz = z - o.cz, c = Math.cos(o.yaw), s = Math.sin(o.yaw); return [dx * c - dz * s - o.ox, dx * s + dz * c - o.oz]; };
  // the spot in front of the seat where he turns to sit is meant to touch the seat's edge: the last 0.15 m to it is exempt
  const sx = Math.sin(-0.35) * 0.27, sz = Math.cos(-0.35) * 0.27, near = (x, z) => Math.hypot(x - sx, z - sz) < 0.15;
  const hit = (x, z) => near(x, z) ? -1 : F.findIndex(o => { const [lx, lz] = local(o, x, z); return Math.abs(lx) < o.hx + 0.10 && Math.abs(lz) < o.hz + 0.10; });
  const step = (sec, label) => { for (let s = 0; s < sec; s += 0.1) { d.skip(0.1); const clip = m.ch.slots.all?.getClip().name || '';
    if (/Walk|Jog/.test(clip) && m.root.visible) { const k = hit(m.pos.x, m.pos.z); track.push([+m.pos.x.toFixed(3), +m.pos.z.toFixed(3), label]); if (k >= 0) bad.push({ label, x: +m.pos.x.toFixed(2), z: +m.pos.z.toFixed(2), into: k ? 'cooler' : 'chair' }); } } };
  const until = (cond, max, label) => { for (let s = 0; s < max && !cond(); s += 0.5) step(0.5, label); return cond(); };
  const arrived = until(() => m.phase === 'broke', 60, 'arrive');
  window.fad.pay(); const back = until(() => m.phase === 'seated', 80, 'shop');
  const R = Math.random; Math.random = () => 0.1; m.act('noFish');                 // the flop branch, for sure
  const flopped = until(() => m.phase === 'seated', 60, 'flop'); Math.random = R;
  const flopWalked = track.some(t => t[2] === 'flop');
  return { arrived, back, flopped: flopped && flopWalked, F, track, bad };
});
console.log(`${r.arrived && r.back && r.flopped ? 'PASS' : 'FAIL'}  every walk finished  ${JSON.stringify({ arrived: r.arrived, back: r.back, flopped: r.flopped })}`);
console.log(`${r.bad.length ? 'FAIL' : 'PASS'}  never inside the chair or cooler  (${r.track.length} samples)${r.bad.length ? ' ' + JSON.stringify(r.bad.slice(0, 5)) : ''}`);
// the map: footprints, his paths by colour
const S = 260, X = (x) => 720 + x * S, Z = (z) => 210 + z * S, col = { arrive: '#2563eb', shop: '#16a34a', flop: '#dc2626' };
const box = (o, pad, st) => { const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => { const lx = sx * (o.hx + pad) + o.ox, lz = sz * (o.hz + pad) + o.oz, c = Math.cos(o.yaw), s = Math.sin(o.yaw); return `${X(o.cx + lx * c + lz * s)},${Z(o.cz - lx * s + lz * c)}`; }); return `<polygon points="${pts.join(' ')}" ${st}/>`; };
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="420" style="background:#f4f1ea;font:14px sans-serif">
${r.F.map(o => box(o, 0.17, 'fill="none" stroke="#999" stroke-dasharray="5 4"') + box(o, 0, 'fill="#c8b8a0" stroke="#6b5b45"')).join('')}
${Object.keys(col).map(k => `<polyline fill="none" stroke="${col[k]}" stroke-width="3" points="${r.track.filter(t => t[2] === k).map(t => `${X(t[0])},${Z(t[1])}`).join(' ')}"/>`).join('')}
<text x="20" y="30">Top-down (camera at the bottom). Brown: chair (left) and cooler; dashed: his body margin. Blue: arrival · green: to the shop and back · red: walk out to flop.</text></svg>`;
await p.setContent(svg); await p.screenshot({ path: 'design/game/paths.jpg', type: 'jpeg', quality: 85 });
console.log(errs.length ? 'FAIL  page errors ' + errs.slice(0, 2).join(' | ') : 'PASS  no page errors'); console.log('wrote design/game/paths.jpg');
await b.close(); process.exit(r.bad.length || errs.length || !(r.arrived && r.back && r.flopped) ? 1 : 0);
