// More moves from Lux3D's library for the rig he already has, on her account.
// usage: node tools/aholo-moves.mjs <name> <key> <Move,Move,...>   writes models/<name>/anims-<key>.glb and adds it to rig.json
import { config } from 'dotenv';
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { readFileSync, writeFileSync } from 'node:fs';
import { download } from './dl.mjs';
const root = new URL('../', import.meta.url).pathname;
config({ path: root + '.env', quiet: true, override: true });
const [name, key, list] = process.argv.slice(2), dir = `${root}models/${name}/`, ids = list.split(',');
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY.trim(), region: 'com' });
const glbOf = (done) => { for (const o of done.outputs || []) { const c = o.content || ''; if (/^https?:/.test(c)) return c; try { const j = JSON.parse(c); const a = (j.actions || []).find(x => x.status === 'success'); if (a) return a.animationGlbUrl; } catch {} } return null; };
const rj = JSON.parse(readFileSync(dir + 'rig.json', 'utf8'));
// the rig's address: kept in rig.json, or read back from the finished rig task (no new credits)
if (!rj.rig?.url) {
  const t = await lux3d.tasks.retrieve(+rj.rigTask); const u = (JSON.stringify(t).match(/https?:[^"\\]+?\.glb[^"\\]*/) || [])[0];
  if (!u) { console.log('no rig address in task', rj.rigTask, JSON.stringify(t).slice(0, 300)); process.exit(1); }
  rj.rig = { task: rj.rigTask, url: u };
}
const t0 = Date.now();
const id = await lux3d.humanoidAnimationRetarget.create({ rigModelUrl: rj.rig.url, animationIds: ids, animationOutputMode: 'combined', outFormat: 'glb', animateInPlace: true });
console.log(`[${name}] moves ${key}: task ${id} started`);
const done = await lux3d.tasks.waitFor(id, { timeoutMs: 20 * 60 * 1000 }).catch(e => ({ error: String(e?.message || e) }));
const url = glbOf(done), secs = Math.round((Date.now() - t0) / 1000);
if (done.error || !url) { console.log(`[${name}] moves ${key} FAILED after ${secs}s: ${done.error || JSON.stringify(done).slice(0, 400)}`); process.exit(1); }
writeFileSync(`${dir}anims-${key}.glb`, await download(url));
rj[`anims-${key}`] = { task: id, url, secs, clips: ids }; writeFileSync(dir + 'rig.json', JSON.stringify(rj, null, 2));
console.log(`[${name}] moves ${key}: done in ${secs}s -> models/${name}/anims-${key}.glb`);
