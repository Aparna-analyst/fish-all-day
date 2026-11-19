// refetch-glb.mjs <taskId> <out.glb> : download a finished Lux3D model again (no new job)
import { config } from 'dotenv'; import { createLux3dClient } from '@manycore/aholo-sdk-lux3d'; import { writeFileSync } from 'node:fs'; import { download } from './dl.mjs';
const root = new URL('../', import.meta.url).pathname; config({ path: root + '.env', quiet: true, override: true });
const [id, out] = process.argv.slice(2);
const c = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY.trim(), region: 'com' });
const t = await c.tasks.retrieve(+id); const url = (JSON.stringify(t).match(/https?:[^"]+?\.glb[^"]*/) || [])[0];
for (let i = 0; i < 3; i++) { try { const b = await download(url); writeFileSync(out, b); console.log(out, (b.length / 1e6).toFixed(1), 'MB'); process.exit(0); } catch (e) { console.log('try', i + 1, String(e.status || e.message).slice(0, 80)); } }
process.exit(1);
