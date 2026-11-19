// A sheet of his moves, each held at a few moments. node tools/check/pose-sheet.mjs <out.jpg> <Move,Move,...> [t1,t2,...]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import fs from 'fs';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const [out, list, ts = '0.2,0.5,0.8'] = process.argv.slice(2), names = list.split(','), times = ts.split(',').map(Number);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 240, height: 300 } });
await p.goto('http://127.0.0.1:5180/poses.html'); await p.waitForFunction(() => window.ready, null, { timeout: 90000 });
const dir = fs.mkdtempSync(require('os').tmpdir() + '/poses-'); let i = 0;
for (const n of names) for (const t of times) {
  const ok = await p.evaluate(([n, t]) => window.pose(n, t), [n, t]); if (!ok) console.log('missing', n);
  await p.screenshot({ path: `${dir}/${String(i++).padStart(3, '0')}.png` });
}
await b.close();
execSync(`ffmpeg -v error -y -pattern_type glob -i '${dir}/*.png' -vf "tile=${times.length * 2}x${Math.ceil(names.length / 2)}" -frames:v 1 "${out}"`);
fs.rmSync(dir, { recursive: true, force: true }); console.log('wrote', out, names.length, 'moves x', times.length);
