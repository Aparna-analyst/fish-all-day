// Lux3D rigs him and gives him moves from its own library, on her account.
// usage: node aholo-rig.mjs <name>   (reads models/<name>/task.json for the model's address)
// writes models/<name>/rig.glb, then anims-<k>.glb for each list below (clips come back as animation_1..N in this order)
import { config } from 'dotenv';
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { readFileSync, writeFileSync } from 'node:fs';
import { download } from './dl.mjs';
const root = new URL('../', import.meta.url).pathname;
config({ path: root + '.env', quiet: true, override: true });
const name = process.argv[2] || 'oldman', dir = `${root}models/${name}/`;
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY.trim(), region: 'com' });
const LISTS = {
  a: ['Walk_Carry_Loop', 'Walk_Loop', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit', 'Consume', 'OverhandThrow', 'Idle_Loop', 'Yes', 'Chest_Open'],
  b: ['Dance_Loop', 'Hit_Knockback', 'Swim_Idle_Loop', 'ClimbUp_1m', 'Idle_Lantern_Loop', 'Idle_No_Loop', 'Sitting_Talking_Loop', 'Crouch_Idle_Loop', 'Fixing_Kneeling', 'LayToIdle'],
};
const log = (m) => console.log(`[${name}] ${m}`);
// the reply nests JSON in a string: read it properly, never by pattern on the escaped text
const glbOf = (done) => { for (const o of done.outputs || []) { const c = o.content || ''; if (/^https?:/.test(c)) return c; try { const j = JSON.parse(c); const a = (j.actions || []).find(x => x.status === 'success'); if (a) return a.animationGlbUrl; } catch {} } return null; };
async function run(label, create) {
  const t0 = Date.now(), id = await create(); log(`${label}: task ${id} started`);
  const done = await lux3d.tasks.waitFor(id, { timeoutMs: 20 * 60 * 1000 }).catch(e => ({ error: String(e?.message || e) }));
  const url = glbOf(done), secs = Math.round((Date.now() - t0) / 1000);
  if (done.error || !url) throw new Error(`${label} failed after ${secs}s: ${done.error || JSON.stringify(done).slice(0, 300)}`);
  log(`${label}: done in ${secs}s`); return { id, url, secs };
}
const meta = JSON.parse(readFileSync(dir + 'task.json', 'utf8'));
const out = { model: meta.url };
const rig = await run('auto-rig', () => lux3d.humanoidAutoRig.create({ modelUrl: meta.url }));
writeFileSync(dir + 'rig.glb', await download(rig.url)); out.rig = rig;
await Promise.all(Object.entries(LISTS).map(async ([k, ids]) => {
  const a = await run(`moves ${k}`, () => lux3d.humanoidAnimationRetarget.create({ rigModelUrl: rig.url, animationIds: ids, animationOutputMode: 'combined', outFormat: 'glb', animateInPlace: true }));
  writeFileSync(`${dir}anims-${k}.glb`, await download(a.url)); out[`anims-${k}`] = { ...a, clips: ids };
}));
writeFileSync(dir + 'rig.json', JSON.stringify(out, null, 2));
log('ALL DONE');
