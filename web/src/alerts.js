// Getting your attention from another tab: the title, the tab icon, a sound, a notification, a buzz.
const baseTitle = 'Fish All Day';
let flashTimer = null, ctx = null, noteAsked = false, muted = false;
export function setMuted(m) { muted = !!m; }

function icon(bg, fg) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = fg; g.beginPath(); g.ellipse(30, 34, 17, 10, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(44, 34); g.lineTo(56, 24); g.lineTo(56, 44); g.closePath(); g.fill();
  g.fillStyle = bg; g.beginPath(); g.arc(23, 31, 2.6, 0, Math.PI * 2); g.fill();
  return c.toDataURL();
}
const ICON_CALM = icon('#2f6b5a', '#fff8ec'), ICON_BITE = icon('#ff5a36', '#ffffff');
export function setIcon(bite) { const f = document.getElementById('favicon'); if (f) f.href = bite ? ICON_BITE : ICON_CALM; }
setIcon(false);

export function unlockSound() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } ctx?.resume?.(); }
// a little bell and a reel ratchet, drawn in code until the recorded sounds are in
export function bell() {
  if (!ctx || muted) return; const t = ctx.currentTime;
  for (const [f, d, v] of [[1318.5, 0, 0.22], [1975.5, 0.12, 0.16], [1318.5, 0.5, 0.18], [1975.5, 0.62, 0.12]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(v, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.1);
    o.connect(g).connect(ctx.destination); o.start(t + d); o.stop(t + d + 1.2);
  }
}
export function tick(volume = 0.05) {
  if (!ctx || muted) return; const t = ctx.currentTime, b = ctx.createBuffer(1, 600, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 90);
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = volume; s.connect(g).connect(ctx.destination); s.start(t);
}
export function splash(volume = 0.25) {
  if (!ctx || muted) return; const t = ctx.currentTime, n = ctx.sampleRate * 0.6, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 1400;
  s.buffer = b; g.gain.value = volume; s.connect(f).connect(g).connect(ctx.destination); s.start(t);
}

export function startAlert(fishName) {
  setIcon(true); bell();
  let on = false; clearInterval(flashTimer);
  flashTimer = setInterval(() => { on = !on; document.title = on ? '🎣 BITE! 🎣' : '🐟 Quick! 🐟'; setIcon(on); }, 600);
  if (navigator.vibrate) try { navigator.vibrate([200, 100, 200, 100, 400]); } catch {}
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { const n = new Notification('Something is biting!', { body: 'Come back and reel it in. Ten seconds.', tag: 'bite', requireInteraction: false, silent: false });
      n.onclick = () => { window.focus(); n.close(); }; setTimeout(() => n.close(), 10000); } catch {}
  }
}
export function stopAlert() { clearInterval(flashTimer); flashTimer = null; document.title = baseTitle; setIcon(false); }
// asked once, after the first catch, never on arrival
export async function askNotify() {
  if (noteAsked || !('Notification' in window) || Notification.permission !== 'default') return; noteAsked = true;
  try { await Notification.requestPermission(); } catch {}
}
