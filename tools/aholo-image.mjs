// Aholo's image tool (Lux3D multimodal to image), on her account.
// usage: node aholo-image.mjs <name> <reference.jpg | -> <prompt.txt>
// writes design/aholo/<name>/<name>.<ext> and task.json; prints the time and the credits are on labs.aholo.ai/usage
import { config } from 'dotenv';
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { download } from './dl.mjs';
const root = new URL('../', import.meta.url).pathname;
config({ path: root + '.env', quiet: true, override: true });
const [name, ref, promptFile] = process.argv.slice(2);
const prompt = readFileSync(promptFile, 'utf8').trim();
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY.trim(), region: 'com' });
const dir = `${root}design/aholo/${name}/`; mkdirSync(dir, { recursive: true });
const t0 = Date.now();
const taskId = ref && ref !== '-' ? await lux3d.multimodalToImage.createFromFile(ref, { prompt })
                                   : await lux3d.multimodalToImage.create({ prompt });
console.log(`[${name}] task ${taskId} started`);
const done = await lux3d.tasks.waitFor(taskId, { timeoutMs: 10 * 60 * 1000 }).catch(e => ({ error: String(e?.message || e) }));
const secs = Math.round((Date.now() - t0) / 1000);
writeFileSync(dir + 'task.json', JSON.stringify({ name, ref, prompt, taskId, secs, result: done }, null, 2));
if (done.error) { console.log(`[${name}] FAILED after ${secs}s: ${done.error}`); process.exit(1); }
const url = (JSON.stringify(done).match(/https?:[^"]+?\.(png|jpe?g|webp)[^"]*/i) || [])[0];
if (!url) { console.log(`[${name}] no picture in result: ${JSON.stringify(done).slice(0, 300)}`); process.exit(1); }
const ext = (url.match(/\.(png|jpe?g|webp)/i) || ['.png'])[0];
let b; try { b = await download(url); } catch (e) { console.log(`[${name}] download failed: ${e.message}`); }
if (!b) { console.log(`[${name}] FAILED to download ${url}`); process.exit(1); } writeFileSync(dir + name + ext, b);
console.log(`[${name}] done in ${secs}s -> design/aholo/${name}/${name}${ext}`);
