// His voice: one recorded clip per line, played while his bubble shows. The clips and their index are made from the
// dialogue list by tools/voice-lines.py into assets/voice/ (index.json: key of the line -> file). A line with no clip
// stays silent. Off from the menu bar ("His voice"), and quiet whenever all sound is off.
import * as sfx from './sfx.js';

let on = true, index = null, seq = 0, cur = null; const cache = {};
fetch('./assets/voice/index.json').then(r => (r.ok ? r.json() : {})).then(j => { index = j; }).catch(() => { index = {}; });

// the same key the maker uses: letters and digits only, lower case, FNV-1a in base 36
export function keyOf(text) {
  let h = 2166136261; for (const c of text.toLowerCase().replace(/[^a-z0-9]/g, '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
export function setOn(v) { on = !!v; if (!on) stop(); }
export function isOn() { return on; }
export function stop() { seq++; if (cur) { try { cur.stop(); } catch {} cur = null; } }
// plays the line's clip; resolves to its length in seconds (0 when there is none or the voice is off)
export async function say(text) {
  stop(); const mine = seq; const ctx = sfx.context();
  if (!on || sfx.isMuted() || !ctx || !index) return 0; const f = index[keyOf(text)]; if (!f) return 0; window.__fadLog?.('say', f, text);
  const b = cache[f] ?? (cache[f] = await fetch('./assets/voice/' + f).then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).catch(() => null));
  if (!b || mine !== seq || !on) return 0;
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = 0.95; s.connect(g).connect(ctx.destination); s.start();
  cur = s; s.onended = () => { if (cur === s) cur = null; }; return b.duration;
}
