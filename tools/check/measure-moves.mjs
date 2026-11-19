// Measures his moves in a headless browser: walking speed from the planted foot, and where the feet go when he sits.
// node tools/check/measure-moves.mjs   (dev server on :5180)
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.goto('http://127.0.0.1:5180/look.html', { waitUntil: 'load' });
const out = await p.evaluate(async () => {
  const THREE = await import('/node_modules/three/build/three.module.js');
  const { loadOldman } = await import('/src/character.js');
  const ch = await loadOldman('/assets/oldman.glb');
  const m = ch.model; m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m);
  const P = (n) => { const b = ch.bone(n); return b.getWorldPosition(new THREE.Vector3()); };
  const at = (name, t) => { ch.pose(name, t); m.updateMatrixWorld(true); return { hips: P('Hips'), lf: P('LeftFoot'), rf: P('RightFoot'), lt: P('LeftToeBase') ?? P('LeftFoot'), rt: P('RightToeBase') ?? P('RightFoot'), rh: P('RightHand'), lh: P('LeftHand'), head: P('Head') }; };
  const r = { box: [box.min.toArray(), box.max.toArray()], dur: Object.fromEntries(Object.entries(ch.clips).map(([k, c]) => [k, c.duration])) };
  // walk: the lower foot is planted; how fast does it slide back?
  const N = 60, w = []; for (let i = 0; i <= N; i++) w.push(at('Walk_Loop', i / N));
  let sum = 0, n = 0; const dt = ch.clips.Walk_Loop.duration / N;
  for (let i = 0; i < N; i++) { const a = w[i], c = w[i + 1]; const left = a.lf.y < a.rf.y; const f0 = left ? a.lf : a.rf, f1 = left ? c.lf : c.rf; const v = (f1.z - f0.z) / dt; if (v < 0) { sum += -v; n++; } }
  r.walkSpeed = sum / n; r.footMinY = Math.min(...w.map(s => Math.min(s.lf.y, s.rf.y)));
  for (const nm of ['Idle_Loop', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Consume', 'OverhandThrow', 'Chest_Open', 'Crouch_Idle_Loop', 'Idle_Lantern_Loop']) {
    const s = at(nm, 0.5); r[nm] = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.toArray().map(x => +x.toFixed(4))]));
  }
  // the cast: when does the right hand move fastest forward (the release)?
  let best = 0, bt = 0, prev = at('OverhandThrow', 0).rh; for (let i = 1; i <= 40; i++) { const h = at('OverhandThrow', i / 40).rh; const v = h.z - prev.z; if (v > best) { best = v; bt = i / 40; } prev = h; } r.castRelease = bt;
  return r;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
