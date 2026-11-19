// The old fisherman: his model, his moves, and the rule that keeps his hands out of his own belly and beard.
// The moves come from Lux3D's library, made for a slim body; his belly and beard are far rounder. After every frame
// of a move, each arm is checked against the shape of his body (three ellipsoids that bend with his spine and head),
// and if a hand or forearm would sink in, the upper arm swings out just enough to rest it on the surface.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// his body in the model's own space as Lux3D made it (0.18 tall, facing +Z, Y up), measured slice by slice in Blender
const BODY = [
  { bone: 'Spine', c: [0, -0.012, 0.005], r: [0.041, 0.029, 0.036] },     // the belly
  { bone: 'Spine2', c: [0, 0.014, 0.004], r: [0.038, 0.02, 0.034] },      // the chest
  { bone: 'Head', c: [0, 0.048, 0.003], r: [0.037, 0.03, 0.038] },        // the beard and head
];
const MARGIN = 0.0065;     // a hand is this thick: keep its middle this far out

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4();

export async function loadOldman(url = '/assets/oldman.glb') {
  const g = await new GLTFLoader().loadAsync(url);
  const model = g.scene;
  model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.frustumCulled = false; } });
  const bone = (n) => { let b = null; model.traverse(o => { if (o.isBone && o.name.replace(/^mixamorig:?/, '') === n) b = o; }); return b; };
  model.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  // each ellipsoid remembers the bone it rides on, as that bone stood when the model was made
  const body = BODY.map(e => { const b = bone(e.bone); return { ...e, b, c: new THREE.Vector3(...e.c), r: new THREE.Vector3(...e.r).addScalar(MARGIN),
    bind: new THREE.Matrix4().multiplyMatrices(rootInv, b.matrixWorld) }; });
  const arms = ['Left', 'Right'].map(s => ({ arm: bone(s + 'Arm'), fore: bone(s + 'ForeArm'), hand: bone(s + 'Hand'), mid: bone(s + 'HandMiddle1') }));
  const mixer = new THREE.AnimationMixer(model);
  const clips = Object.fromEntries(g.animations.map(c => [c.name, c]));
  let fix = true, current = null;
  const spine = ['Spine', 'Spine1', 'Spine2'].map(bone), rest = spine.map(b => b.quaternion.clone());
  const BEND = { OverhandThrow: 0.45, Walk_Carry_Loop: 0.25, Chest_Open: 0.6 };      // how much of the move's own bend to keep
  function easeBend() {
    for (const a of [cur.all, cur.up]) {
      const k = a ? BEND[a.getClip().name.split('~')[0]] : undefined; if (k === undefined) continue;
      const w = a.getEffectiveWeight(); spine.forEach((b, i) => b.quaternion.slerp(rest[i], (1 - k) * w));
    }
  }

  // Halves of a move: '~up' is the spine and everything above it, '~low' the hips and legs. Sitting legs can then carry a
  // sip, a hum or a wave that was made standing.
  const upper = new Set(); spine[0].traverse(o => upper.add(o.name));
  const halves = {};
  function half(name, which) {
    const key = name + '~' + which; if (halves[key]) return halves[key]; const c = clips[name]; if (!c) return null;
    const tracks = c.tracks.filter(t => upper.has(t.name.slice(0, t.name.lastIndexOf('.'))) === (which === 'up'));
    return (halves[key] = new THREE.AnimationClip(key, c.duration, tracks));
  }
  const cur = { all: null, up: null, low: null };
  function start(slot, clip, { fade = 0.35, once = false, speed = 1 } = {}) {
    const a = mixer.clipAction(clip), old = cur[slot];
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.timeScale = speed;
    if (old !== a) { a.reset().setEffectiveWeight(1).fadeIn(fade).play(); old?.fadeOut(fade); }
    else if (once) a.reset().play();
    cur[slot] = a; return a;
  }
  const drop = (slot, fade) => { cur[slot]?.fadeOut(fade); cur[slot] = null; };

  // where a point would sit on his body as it was made, given how that part of the body has moved now
  function toBind(e, pWorld, out) {
    m1.copy(model.matrixWorld).invert(); out.copy(pWorld).applyMatrix4(m1);                       // into the model's space
    m2.multiplyMatrices(m1, e.b.matrixWorld).invert(); out.applyMatrix4(m2).applyMatrix4(e.bind);  // into the bone, then as it was made
    return out;
  }
  function fromBind(e, pBind, out) {
    m2.copy(e.bind).invert(); out.copy(pBind).applyMatrix4(m2).applyMatrix4(e.b.matrixWorld);
    return out;
  }
  function keepOut() {
    model.updateMatrixWorld(true);
    for (const a of arms) {
      for (let k = 0; k < 3; k++) {
        let worst = null;
        const pts = [a.fore, a.hand, a.mid].map(b => b.getWorldPosition(new THREE.Vector3()));
        pts.push(pts[0].clone().lerp(pts[1], 0.5));
        for (const p of pts) for (const e of body) {
          toBind(e, p, v1); v2.copy(v1).sub(e.c).divide(e.r); const d = v2.length();
          if (d < 1 && (!worst || 1 - d > worst.depth)) {
            v2.multiplyScalar(1.03 / Math.max(d, 1e-4)).multiply(e.r).add(e.c);
            worst = { depth: 1 - d, p, to: fromBind(e, v2, new THREE.Vector3()) };
          }
        }
        if (!worst) break;
        const s = a.arm.getWorldPosition(v3);
        v1.copy(worst.p).sub(s).normalize(); v2.copy(worst.to).sub(s).normalize();
        q1.setFromUnitVectors(v1, v2);                                           // the swing, in the world
        a.arm.parent.getWorldQuaternion(q2);
        const local = q2.clone().invert().multiply(q1).multiply(q2);              // the same swing, as the arm's parent sees it
        a.arm.quaternion.premultiply(local); a.arm.updateMatrixWorld(true);
      }
    }
  }
  return {
    model, mixer, clips, bone,
    set fix(v) { fix = v; }, get fix() { return fix; },
    // the whole body in one move
    play(name, opts = {}) {
      const c = clips[name]; if (!c) return null; const f = opts.fade ?? 0.35;
      drop('up', f); drop('low', f); return (current = start('all', c, opts));
    },
    // legs in one move, the upper body in another (either may be left out to keep what it has)
    layer({ low, up, fade = 0.35, once = false, speed = 1 } = {}) {
      if (cur.all) { const was = cur.all.getClip().name; drop('all', fade); low ??= was; up ??= was; }   // read the name before the slot is cleared
      if (low) start('low', half(low, 'low'), { fade, speed: 1 });
      if (up) current = start('up', half(up, 'up'), { fade, once, speed });
      return current;
    },
    get current() { return current; },
    get slots() { return cur; },
    update(dt) { mixer.update(dt); if (fix) { easeBend(); keepOut(); } },
    pose(name, t) { mixer.stopAllAction(); cur.up = cur.low = null; const c = clips[name]; if (!c) return false; current = cur.all = mixer.clipAction(c); current.play(); mixer.setTime(t * c.duration); if (fix) { easeBend(); keepOut(); } return true; },
  };
}
