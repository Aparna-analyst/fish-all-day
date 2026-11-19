// Renders the app icon from the scene itself (desk.html?icon) and makes mac/AppIcon.icns. node tools/check/make-icon.mjs
import { createRequire } from 'module'; import { execSync } from 'child_process'; import fs from 'fs';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const root = new URL('../../', import.meta.url).pathname, png = root + 'mac/icon-1024.png', set = root + 'mac/AppIcon.iconset';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await p.goto('http://127.0.0.1:5180/desk.html?icon', { waitUntil: 'load' });
await p.waitForFunction(() => window.__desk?.man?.visible, null, { timeout: 90000 });
await p.evaluate(() => window.__desk.skip(2.5)); await p.waitForTimeout(1500);
await p.screenshot({ path: png, omitBackground: true }); await b.close();
fs.rmSync(set, { recursive: true, force: true }); fs.mkdirSync(set);
for (const s of [16, 32, 128, 256, 512]) {
  execSync(`sips -z ${s} ${s} "${png}" --out "${set}/icon_${s}x${s}.png" >/dev/null`);
  execSync(`sips -z ${s * 2} ${s * 2} "${png}" --out "${set}/icon_${s}x${s}@2x.png" >/dev/null`);
}
execSync(`iconutil -c icns "${set}" -o "${root}mac/AppIcon.icns"`); fs.rmSync(set, { recursive: true, force: true });
console.log('wrote', png, 'and mac/AppIcon.icns');
