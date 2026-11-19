// refetch.mjs <name> <taskId> : download a finished Aholo picture again (no new job, no credits)
import { config } from 'dotenv'; import { createLux3dClient } from '@manycore/aholo-sdk-lux3d'; import { writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname; config({ path: root + '.env', quiet: true, override: true });
const [name, id] = process.argv.slice(2);
const c = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY.trim(), region: 'com' });
const t = await c.tasks.retrieve(+id); const url = (JSON.stringify(t).match(/https?:[^"]+?\.(png|jpe?g|webp)[^"]*/i) || [])[0];
if (!url) { console.log(name, 'no picture yet', JSON.stringify(t).slice(0, 200)); process.exit(1); }
const dir = `${root}design/aholo/${name}/`; mkdirSync(dir, { recursive: true });
for (let i = 0; i < 3; i++) { try { const b = Buffer.from(await (await fetch(url)).arrayBuffer()); writeFileSync(dir + name + (url.match(/\.(png|jpe?g|webp)/i) || ['.png'])[0], b); console.log(name, 'saved', b.length); break; } catch (e) { console.log(name, 'try', i + 1, String(e.cause?.code || e.message)); } }
