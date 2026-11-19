// Him from any side, headless: orbit the camera round him (yaw degrees, 0 = from the front), zoom on a bone or his whole
// body. node tools/check/side-views.mjs <out.jpg> "<setup js>" "<view;view;...>"   view = yaw,zoom,bone (bone may be "body")
// (a view may end with ,seconds: his time steps on that far before the shot)
// e.g. node tools/check/side-views.mjs design/game/seat.jpg "d.skip(1)" "0,2.5,body;90,2.5,body;35,6,LeftHand"
import { createRequire } from 'module'; import { execSync } from 'child_process'; import fs from 'fs';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const [out, setup = '', views = '0,2.5,body;90,2.5,body'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 480, height: 420 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5180/desk.html?seated&mute&spot=0.5', { waitUntil: 'load' });
await p.waitForFunction(() => window.__desk?.man?.visible, null, { timeout: 120000 });
await p.evaluate((setup) => { const d = window.__desk; new Function('d', 'man', setup)(d, d.man); }, setup);
const dir = fs.mkdtempSync(require('os').tmpdir() + '/views-'); let i = 0;
for (const v of views.split(';')) {
  const [yaw, zoom, bone, skip = '0'] = v.split(',');
  if (+skip) await p.evaluate((s) => window.__desk.skip(s), +skip);
  await p.evaluate(({ yaw, zoom, bone }) => {
    const { THREE, camera, man } = window.__desk; window.__view = true;
    const t = bone === 'body' ? man.root.position.clone().add(new THREE.Vector3(0, 0.55, 0)) : man.ch.bone(bone).getWorldPosition(new THREE.Vector3());
    const a = THREE.MathUtils.degToRad(+yaw + THREE.MathUtils.radToDeg(man.yaw)), r = 6;
    camera.position.set(t.x + Math.sin(a) * r, t.y + r * Math.sin(0.19), t.z + Math.cos(a) * r); camera.lookAt(t);
    const h = 1.0 / +zoom, w = h * innerWidth / innerHeight; camera.left = -w; camera.right = w; camera.top = h; camera.bottom = -h; camera.zoom = 1; camera.updateProjectionMatrix();
  }, { yaw, zoom, bone });
  await p.waitForTimeout(500); await p.screenshot({ path: `${dir}/${String(i++).padStart(2, '0')}.png` });
}
execSync(`ffmpeg -loglevel error -y -pattern_type glob -i '${dir}/*.png' -filter_complex tile=${i}x1 -frames:v 1 ${out}`);
console.log(errs.length ? 'page errors: ' + errs.slice(0, 2).join(' | ') : 'wrote ' + out); await b.close();
