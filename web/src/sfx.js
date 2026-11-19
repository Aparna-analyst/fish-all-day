// His sounds (CC0, from Freesound via Openverse; see assets/sfx/CREDITS.json): loaded once, played through Web Audio.
const FILES = { bell: 0.55, plop: 0.5, reel: 0.35, splash: 0.5, burp: 0.6, snore: 0.32, crack: 0.6, cash: 0.45, banjo: 0.4,
  canopen: 0.5, creak: 0.35, step1: 0.12, step2: 0.12, whoosh: 0.45, bigsplash: 0.6, gulp: 0.4, fart1: 0.55, fart2: 0.55, fart3: 0.55 };
let ctx = null, muted = false; const buf = {}, loops = {};
export function unlock() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    for (const n of Object.keys(FILES)) fetch(`./assets/sfx/${n}.mp3`).then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { buf[n] = b; }).catch(() => {}); }
  ctx.resume?.();
}
export function setMuted(m) { muted = !!m; if (muted) for (const n of Object.keys(loops)) stop(n); }
export const isMuted = () => muted, context = () => ctx;          // for his voice, which shares the audio and the mute
// one shot; rate shifts the pitch a little so repeats are not identical
export function play(name, { gain = 1, rate = 1 } = {}) {
  if (muted || !ctx || !buf[name]) return null;
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf[name]; s.playbackRate.value = rate; g.gain.value = FILES[name] * gain;
  s.connect(g).connect(ctx.destination); s.start(); window.__fadLog?.('sfx', name, +(FILES[name] * gain).toFixed(3), +rate.toFixed(3)); return { s, g };
}
// a sound that keeps going until stopped (snoring, the reel, the banjo), faded in and out
export function loop(name, { gain = 1, rate = 1 } = {}) {
  if (muted || !ctx || !buf[name] || loops[name]) return;
  const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime; s.buffer = buf[name]; s.loop = true; s.playbackRate.value = rate;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(FILES[name] * gain, t + 0.25); s.connect(g).connect(ctx.destination); s.start(); loops[name] = { s, g }; window.__fadLog?.('loop', name, +(FILES[name] * gain).toFixed(3), +rate.toFixed(3));
}
export function rate(name, r) { if (loops[name]) loops[name].s.playbackRate.value = r; }
export function stop(name, fade = 0.4) {
  const l = loops[name]; if (!l || !ctx) return; delete loops[name]; const t = ctx.currentTime; window.__fadLog?.("stop", name, fade);
  l.g.gain.cancelScheduledValues(t); l.g.gain.setValueAtTime(l.g.gain.value, t); l.g.gain.linearRampToValueAtTime(0, t + fade); l.s.stop(t + fade + 0.05);
}
