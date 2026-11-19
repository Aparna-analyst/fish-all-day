// Close-ups of his left hand and the can, headless: seated, mid-sip, and walking with it.  node tools/check/hand-closeup.mjs <out-prefix>
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const out = process.argv[2] || 'design/game/hand';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 560, height: 420 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5180/desk.html?seated&mute&spot=0.5', { waitUntil: 'load' });
await p.waitForFunction(() => window.__desk?.man?.visible, null, { timeout: 120000 });
const shot = async (name, setup) => {
  await p.evaluate(({ setup }) => {
    const d = window.__desk, { THREE, camera, man } = d; new Function('d', 'man', setup)(d, man);
    camera.zoom = 1; camera.updateProjectionMatrix(); d.skip(0.05);
    const h = man.ch.bone('LeftHand').getWorldPosition(new THREE.Vector3()), q = h.clone().project(camera);
    const hw = (camera.right - camera.left) / 2, hh = (camera.top - camera.bottom) / 2;
    const R = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), U = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.addScaledVector(R, q.x * hw).addScaledVector(U, q.y * hh); camera.zoom = 7; camera.updateProjectionMatrix();
  }, { setup });
  await p.waitForTimeout(600); await p.screenshot({ path: `${out}-${name}.jpg`, type: 'jpeg', quality: 85 });
  await p.evaluate(() => { const { camera } = window.__desk; camera.zoom = 1; camera.position.set(camera.userData.home?.x ?? camera.position.x, camera.position.y, camera.position.z); });
};
await p.evaluate(() => { const c = window.__desk.camera; c.userData.home = c.position.clone(); });
const home = `const c = d.camera; c.position.copy(c.userData.home);`;
await shot('seated', home + `d.skip(1);`);
await shot('sip', home + `man.ch.layer({ up: 'Consume', once: true, fade: 0 }); d.skip(1.0);`);
await shot('sip-late', home + `d.skip(0.6);`);
console.log(errs.length ? 'page errors: ' + errs.slice(0, 2).join(' | ') : 'ok', `${out}-*.jpg`);
await b.close();
