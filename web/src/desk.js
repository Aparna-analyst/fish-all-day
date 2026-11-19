// Fish All Day on the edge of your screen. The page fills a see-through window along the bottom of the screen; the floor
// he sits on is the top of the Dock. The Mac app tells the page where that is; in a browser, ?preview draws a wallpaper
// and a Dock so he can be seen as he will sit.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createDeskman, HEIGHT } from './deskman.js';
import { createDeskGame } from './desk-game.js';
import { setMuted, unlock } from './sfx.js';
import * as sfx from './sfx.js';
import * as voice from './voice.js';

const q = new URLSearchParams(location.search);
const native = !!window.webkit?.messageHandlers?.fad;
const framed = !native && window.parent !== window;     // living along the bottom of a web page (the landing page), not in the Mac app
const icon = q.has('icon');                 // the app icon: him on his chair in a rounded square (rendered once, by a script)
if (icon) document.body.classList.add('icon');
else if (q.has('preview') || (!native && !q.has('clear'))) document.body.classList.add('preview');

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.75;
const key = new THREE.DirectionalLight('#fff1dc', 2.6); key.position.set(-2.5, 4.5, 4); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -0.5, near: 0.5, far: 15 }); scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#cfe0ff', 0.9); rim.position.set(3, 2.5, -3); scene.add(rim);

// the layout: points per metre, the floor's height above the window's bottom, and where along the edge he sits
const L = icon ? { ppm: 370, floor: 250, spot: 0.5, w: innerWidth, h: innerHeight } : { ppm: +(q.get('ppm') || 118), floor: +(q.get('floor') || 70), spot: +(q.get('spot') || 0.78), w: innerWidth, h: innerHeight };
const PITCH = THREE.MathUtils.degToRad(11);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
function layout() {
  L.w = innerWidth; L.h = innerHeight; renderer.setSize(L.w, L.h, false);
  document.body.style.setProperty('--dock', Math.max(40, L.floor - 12) + 'px'); document.body.style.setProperty('--floor', L.floor + 'px');
  const spotPx = L.w * L.spot;
  camera.left = -spotPx / L.ppm; camera.right = (L.w - spotPx) / L.ppm;      // his spot is x = 0 in the world... (moved with the camp)
  camera.bottom = -L.floor / L.ppm; camera.top = (L.h - L.floor) / L.ppm;
  camera.position.set(0, Math.sin(PITCH) * 20, Math.cos(PITCH) * 20); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  if (man) { man.bottomY = camera.bottom / Math.cos(PITCH) - 0.2; man.rightX = camera.right + 0.3; man.setResolution(L.w, L.h); }
}
let man = null;
layout(); addEventListener('resize', layout);
const lay = (o) => { if (o) { Object.assign(L, o); layout(); } return L; };
if (native && q.has('demo')) window.__fadLog = (...a) => window.webkit.messageHandlers.fad.postMessage(JSON.stringify({ log: [Date.now(), ...a] }));   // filming: every sound, for the edit
const post = (o) => framed ? parent.postMessage({ fadPost: o }, location.origin) : window.webkit?.messageHandlers?.fad?.postMessage(JSON.stringify(o));
// his controls: in the Mac app the switches live in the app (menu bar and his toolbar agree); in a browser, here
let away = false;
function control(k) {
  if (native) { post({ control: k }); return; }
  const s = game.switches;
  if (k === 'voice') game.setSwitches({ voice: !s.voice });
  else if (k === 'sound') { game.setSwitches({ sound: !s.sound }); setMuted(s.sound); }
  else if (k === 'hide') window.fad.hidden(true);                  // on a web page, the page offers to bring him back
  else if (k === 'menu') game.openBook();                         // no menu bar in a browser: his book instead
  if (framed && k !== 'menu') post({ control: k });
}
let game = null;
// the Mac app calls these: when the screen, the Dock or his spot change; from the menu bar
window.fad = { layout: lay, voice: (on) => game?.voice(on), state: (o) => game?.setSwitches(o), hidden: (h) => { away = !!h; game?.pause(away); },
  book: () => game?.openBook(), sound: (on) => setMuted(!on), bite: () => game?.bite(), screen: (min) => game?.screen(min), act: (k) => game?.act(k),
  pay: () => document.querySelector('.say button')?.click(), land: () => game?.landNow(), unlock };

createDeskman(scene, {}).then(m => {
  man = m; m.demo = q.has('demo'); m.skipBeerRun = icon; layout();
  if (q.has('mute')) setMuted(true); if (native) unlock();          // the Mac app may play sound without a click first
  m.show(q.has('seated') || icon);
  if (!icon) game = createDeskGame({ man: m, camera, layout: lay, demo: q.has('demo'), post, control });
  game?.setSwitches({ voice: window.__fadVoice !== false, sound: !q.has('mute') });   // the Mac app remembers "His voice" off
  window.__desk = { THREE, scene, camera, renderer, man, L, voice, sfx, get game() { return game; }, skip(sec) { for (let i = 0; i < sec * 30; i++) { t += 1 / 30; man.update(1 / 30, t); game?.update(1 / 30); } } };
});

// where the mouse may touch him: his box on screen, sent to the Mac app a few times a second
const box = new THREE.Box3(), corners = Array.from({ length: 8 }, () => new THREE.Vector3());
function screenRect() {
  if (!man) return null; man.bounds(box); if (box.isEmpty()) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; let i = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = corners[i++].set(x, y, z).project(camera); const sx = (p.x + 1) / 2 * L.w, sy = (1 - p.y) / 2 * L.h;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  return { x: Math.round(x0 - 6), y: Math.round(y0 - 6), w: Math.round(x1 - x0 + 12), h: Math.round(y1 - y0 + 12) };
}
let lastSent = '';
setInterval(() => {
  const r = screenRect(); const msg = JSON.stringify({ hit: [...(r ? [[r.x, r.y, r.w, r.h]] : []), ...(game ? game.rects().map(a => a.map(Math.round)) : [])] });
  if (msg !== lastSent) { lastSent = msg; if (framed) parent.postMessage({ fad: msg }, location.origin); else window.webkit?.messageHandlers?.fad?.postMessage(msg); }
}, 200);
// on a web page the page above passes the mouse to us only over him; when it wanders off him (nothing held), hand it back
if (framed) {
  let down = false;
  addEventListener('pointerdown', () => { down = true; }, true); addEventListener('pointerup', () => { down = false; }, true);
  addEventListener('pointermove', (e) => {
    if (down || e.pointerType === 'touch') return;
    const hit = lastSent ? JSON.parse(lastSent).hit : [];
    if (!hit.some(([x, y, w, h]) => e.clientX >= x && e.clientX <= x + w && e.clientY >= y && e.clientY <= y + h)) parent.postMessage({ fadOut: 1 }, location.origin);
  });
}

// draw at 30 frames a second while he waits, 60 when something is happening; nothing while the screen sleeps
const clock = new THREE.Clock(); let t = 0, acc = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1); acc += dt;
  if (away) { acc = 0; return; }                                   // sent home: nothing moves, nothing is drawn
  const busy = man && (!['seated', 'broke'].includes(man.phase) || (game && game.state !== 'idle'));   // waiting or begging: the lighter rate
  if (!busy && acc < 1 / 30) return;
  const step = Math.min(acc, 0.1); acc = 0; t += step;
  man?.update(step, t); game?.update(step);
  renderer.render(scene, camera);
});
