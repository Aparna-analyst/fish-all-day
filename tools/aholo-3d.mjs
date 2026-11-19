// Lux3D image to 3D on her account.  usage: node aholo-3d.mjs <name> <picture> <G1|G1-Turbo> [faceCount]
// writes models/<name>/model.glb, task.json (with the model's own address, which the rigging tool needs)
import { config } from 'dotenv';
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { download } from './dl.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
config({ path: root + '.env', quiet: true, override: true });
const [name, img, version = 'G1', faces = '60000'] = process.argv.slice(2);
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY.trim(), region: 'com' });
const dir = `${root}models/${name}/`; mkdirSync(dir, { recursive: true });
const t0 = Date.now();
const taskId = await lux3d.imgTo3d.createFromFile(img, { version, faceCount: +faces, outputFormat: ['glb'] });
console.log(`[${name}] ${version} task ${taskId} started`);
const done = await lux3d.tasks.waitFor(taskId, { timeoutMs: 20 * 60 * 1000 }).catch(e => ({ error: String(e?.message || e) }));
const secs = Math.round((Date.now() - t0) / 1000);
const url = (JSON.stringify(done).match(/https?:[^"]+?\.glb[^"]*/) || [])[0];
writeFileSync(dir + 'task.json', JSON.stringify({ name, img, version, faces: +faces, taskId, secs, url, result: done }, null, 2));
if (done.error || !url) { console.log(`[${name}] FAILED after ${secs}s: ${done.error || JSON.stringify(done).slice(0, 300)}`); process.exit(1); }
let b; try { b = await download(url); } catch (e) { console.log(`[${name}] download failed: ${e.message}`); }
if (!b) { console.log(`[${name}] FAILED to download ${url}`); process.exit(1); } writeFileSync(dir + 'model.glb', b);
console.log(`[${name}] done in ${secs}s, ${(b.length / 1e6).toFixed(1)} MB`);
