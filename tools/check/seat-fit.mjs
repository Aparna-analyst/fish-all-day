// How far his body goes into the chair, headless, in each seated pose. Finds the seat's top and fits the backrest's
// slope from the chair's own shape (in the chair's frame: it faces -Z, its back is +Z), skins every 6th vertex of his
// body, and reports the deepest point through the backrest and below the seat. node tools/check/seat-fit.mjs [--json]
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 320, height: 240 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5180/desk.html?seated&mute&spot=0.5', { waitUntil: 'load' });
await p.waitForFunction(() => window.__desk?.man?.visible, null, { timeout: 120000 });
const POSES = {
  idle: `d.skip(1.5)`,
  sip: `m.ch.layer({ up: 'Consume', once: true, fade: 0 }); d.skip(1.0)`,
  fight: `m.bite(); m.reel(1, 0.5); d.skip(0.6)`,
  beer: `m.show(true); d.skip(0.3); m.ch.layer({ up: 'Chest_Open', once: true, fade: 0 }); m.twist = 1; d.skip(0.7); m.twist = 1`,
  doze: `m.show(true); d.skip(0.3); m.doze = 1; d.skip(0.1); m.doze = 1`,
};
const res = {};
for (const [name, setup] of Object.entries(POSES)) {
  res[name] = await p.evaluate((setup) => {
    const d = window.__desk, m = d.man, { THREE } = d;
    m.twist = 0; m.doze = 0; m.lean = 0; m.show(true); d.skip(0.5); new Function('d', 'm', setup)(d, m);
    m.root.updateMatrixWorld(true);
    const chair = m.parts.chair, inv = new THREE.Matrix4().copy(chair.matrixWorld).invert(), v = new THREE.Vector3(), cv = [];
    chair.traverse(o => { if (o.isMesh) { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i += 2) cv.push(v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv).toArray()); } });
    const seatTop = Math.max(...cv.filter(([x, y, z]) => Math.abs(x) < 0.12 && z > -0.18 && z < 0.04 && y < 0.4).map(q => q[1]));
    // the backrest's front face: for each height band, the most forward (smallest z) chair point behind the seat, near the middle
    const back = []; for (let y = seatTop + 0.1; y < seatTop + 0.4; y += 0.02) { const band = cv.filter(q => Math.abs(q[0]) < 0.15 && q[1] >= y && q[1] < y + 0.02 && q[2] > 0.05); if (band.length) back.push([y + 0.01, Math.min(...band.map(q => q[2]))]); }
    const n = back.length, my = back.reduce((s, q) => s + q[0], 0) / n, mz = back.reduce((s, q) => s + q[1], 0) / n;
    const slope = back.reduce((s, q) => s + (q[0] - my) * (q[1] - mz), 0) / back.reduce((s, q) => s + (q[0] - my) ** 2, 0);
    const backZ = (y) => mz + slope * (y - my), top = back.at(-1)?.[0] ?? seatTop + 0.4;
    let worstBack = 0, worstSeat = 0, nb = 0, ns = 0;
    m.root.traverse(o => { if (o.isSkinnedMesh) { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i += 6) {
      o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld).applyMatrix4(inv); const [x, y, z] = v.toArray();
      if (Math.abs(x) < 0.2 && y > seatTop + 0.1 && y < top) { const dz = z - backZ(y); if (dz > 0.005) { nb++; worstBack = Math.max(worstBack, dz); } }
      if (Math.abs(x) < 0.18 && z > -0.2 && z < 0.05 && y < seatTop - 0.005 && y > seatTop - 0.15) { ns++; worstSeat = Math.max(worstSeat, seatTop - y); }
    } } });
    // his bottom (vertices skinned mostly to his hips) and his soles: the lowest of each
    let butt = 9, sole = 9;
    m.root.traverse(o => { if (o.isSkinnedMesh) { const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, a = o.geometry.attributes.position, bones = o.skeleton.bones;
      for (let i = 0; i < a.count; i += 3) { let k = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j; const bn = bones[si.getComponent(i, k)].name;
        if (/Hips$/.test(bn) || /UpLeg$/.test(bn) || /Foot$|Toe/.test(bn)) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); const wy = v.y; v.applyMatrix4(inv);
          if ((/Hips$/.test(bn) || /UpLeg$/.test(bn)) && Math.abs(v.x) < 0.2 && v.z > -0.08) butt = Math.min(butt, v.y); if (/Foot$|Toe/.test(bn)) sole = Math.min(sole, wy); } } } });
    const push_cm = +(m.backPush * 100).toFixed(1), gap_cm = +(m.backGap() * 100).toFixed(1);
    return { push_cm, gap_cm, butt_cm: +(butt * 100).toFixed(1), sole_cm: +(sole * 100).toFixed(1), phase: m.phase, seatTop: +seatTop.toFixed(3), backSlope: +slope.toFixed(2), throughBack_cm: +(worstBack * 100).toFixed(1), backVerts: nb, belowSeat_cm: +(worstSeat * 100).toFixed(1), seatVerts: ns };
  }, setup);
  console.log(name.padEnd(6), JSON.stringify(res[name]));
}
if (errs.length) console.log('page errors:', errs.slice(0, 3).join(' | '));
await b.close();
