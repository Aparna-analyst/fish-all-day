// refetch-anims.mjs <taskId> <out.glb> : the combined move file of a finished Lux3D animation job (no new job)
import { config } from 'dotenv'; import { createLux3dClient } from '@manycore/aholo-sdk-lux3d'; import { writeFileSync } from 'node:fs'; import { download } from './dl.mjs';
const root = new URL('../', import.meta.url).pathname; config({ path: root + '.env', quiet: true, override: true });
const [id, out] = process.argv.slice(2);
const c = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY.trim(), region: 'com' });
const t = await c.tasks.retrieve(+id); const o = JSON.parse(t.outputs[0].content);
const url = o.actions.find(a => a.status === 'success').animationGlbUrl;
const b = await download(url); writeFileSync(out, b); console.log(out, (b.length / 1e6).toFixed(1), 'MB', o.actions.map(a => a.animation_id).join(','));
