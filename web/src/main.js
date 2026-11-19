import * as THREE from 'three';
import { buildWorld, SPOT } from './world.js';
import { createFisher, COOLER } from './fisher.js';
import { makeChair, makeCooler } from './props.js';
import { unlockSound, splash } from './alerts.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 2000);
const world = buildWorld(scene, renderer);

// the views of him: name, camera position, where it looks
export const VIEWS = [
  ['Lakeside', new THREE.Vector3(4.6, 3.3, 4.8), new THREE.Vector3(-1.6, 1.2, -22)],
  ['From the water', new THREE.Vector3(-2.6, 1.25, -15.5), new THREE.Vector3(0.1, 1.15, -7.4)],
  ['Beside him', new THREE.Vector3(3.4, 1.7, -4.6), new THREE.Vector3(-0.4, 0.95, -8.6)],
];
let view = +(q.get('cam') ?? 0) % VIEWS.length;
const camTo = { p: VIEWS[view][1].clone(), t: VIEWS[view][2].clone() }, camLook = camTo.t.clone();
camera.position.copy(camTo.p);
function setView(i) { view = i % VIEWS.length; camTo.p.copy(VIEWS[view][1]); camTo.t.copy(VIEWS[view][2]); }
document.getElementById('bCam').onclick = () => setView(view + 1);

// the hour: the real clock, or ?t=18.5 to hold one
const fixedHour = q.has('t') ? +q.get('t') : null;
const hourNow = () => fixedHour ?? (new Date().getHours() + new Date().getMinutes() / 60);
world.setHour(hourNow());
setInterval(() => world.setHour(hourNow()), 60000);

// his chair and cooler (drawn in code until the Lux3D models are in), and him
const chair = makeChair(); chair.position.copy(SPOT.chair).add(new THREE.Vector3(0, 0, 0.04)); scene.add(chair);
const cooler = makeCooler(); cooler.position.copy(COOLER); scene.add(cooler);
let fisher = null, wantShow = false, following = false;
createFisher(scene, world, { sound: { splash } }).then(f => {
  fisher = f; f.demo = q.has('demo');
  if (q.has('seated')) f.show(true); else if (wantShow) f.show(false);
});

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); world.resize(); });

// walking in, the camera keeps him company a little behind and to his right; then it settles on the chosen view
function aim(snap = false) {
  if (fisher?.walking) {
    const p = fisher.root.position; following = true;
    camTo.p.set(p.x + 1.7, p.y + 1.35, p.z + 2.7); camTo.t.set(p.x - 0.2, p.y + 0.8, p.z - 1.5);
  } else if (following) { following = false; setView(view); }
  if (snap) { camera.position.copy(camTo.p); camLook.copy(camTo.t); camera.lookAt(camLook); }
}

const clock = new THREE.Clock(); let t = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1); t += dt;
  fisher?.update(dt, t);
  aim();
  camera.position.lerp(camTo.p, 1 - Math.exp(-dt * 2.2)); camLook.lerp(camTo.t, 1 - Math.exp(-dt * 2.2));
  camera.position.y += Math.sin(t * 0.25) * 0.0008; camera.lookAt(camLook);
  if (fisher?.bobState === 'floating' && Math.floor(t / 3.2) !== Math.floor((t - dt) / 3.2)) world.ripple(SPOT.bobber.x, SPOT.bobber.z, 0.6);
  world.update(t, camera);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

document.getElementById('bGo').onclick = () => {
  document.getElementById('start').hidden = true; document.getElementById('hud').hidden = false; unlockSound();
  if (fisher && !fisher.visible) fisher.show(q.has('seated')); else wantShow = true;
};
if (q.has('play')) document.getElementById('bGo').click();
window.__fad = { THREE, scene, camera, world, setView, VIEWS, get fisher() { return fisher; },
  skip(sec) { for (let i = 0; i < sec * 30; i++) { t += 1 / 30; fisher?.update(1 / 30, t); } aim(true); } };   // for checks: his day runs ahead
