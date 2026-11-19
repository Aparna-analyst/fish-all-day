// The old fisherman's day at the lake. He walks in from the trees with his rod, takes a beer from the cooler, casts, sits
// down and waits: a sip now and then, a hum, a doze. The rod rests in a holder beside his chair until something bites.
// His day is a list of steps written as generators: each step runs a little every frame and hands over when it is done.
import * as THREE from 'three';
import { loadOldman } from './character.js';
import { makeRod, makeBobber, makeCan } from './props.js';
import { SPOT, DECK_Y, JETTY, PATH, heightAt } from './world.js';

const HEIGHT = 1.45;              // metres, hat to boots
const WALK_SPEED = 1.45;          // the library walk played this much faster (0.33 m/s at 1x: too slow for a long jetty)
const STEP = 0.04085;             // how far the walk carries him per second at 1x, in the model's own units (measured)
const SIT_SLIDE = 0.27;           // the sit swings his feet forward this far (m): he slides back as much, feet planted

const SEAT = SPOT.chair.clone();                                   // where his hips come to rest
const FACE_LAKE = Math.PI;                                         // yaw that faces the water (-Z)
const STAND = SEAT.clone().add(new THREE.Vector3(0, 0, -SIT_SLIDE)); // standing in front of the chair, back to it
export const COOLER = new THREE.Vector3(-0.68, DECK_Y, -7.9);      // at his left hand when he sits
export const HOLDER = new THREE.Vector3(0.36, DECK_Y, -8.78);      // the rod rests here, butt on the deck
// the walk in: the end of the footpath, down the jetty on the right of his chair, then round to stand in front of it
const ROUTE_IN = [...PATH.slice(4), [0.02, 0.4], [0.4, -5.6], [0.58, -7.7], [0.6, -8.36], [STAND.x, STAND.z]].map(([x, z]) => new THREE.Vector3(x, 0, z));

const up = new THREE.Vector3(0, 1, 0), Y = up;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const smooth = (t) => t * t * (3 - 2 * t);
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const rand = (a, b) => a + Math.random() * (b - a);

// ground under him: the planks on the jetty, the land elsewhere, a short ramp where the jetty meets the shore
function groundAt(x, z) {
  const land = heightAt(x, z);
  if (Math.abs(x) > JETTY.w / 2 + 0.1 || z < JETTY.z1) return land;
  if (z <= JETTY.z0) return DECK_Y;
  const t = Math.min(1, (z - JETTY.z0) / 1.2);
  return THREE.MathUtils.lerp(DECK_Y, land, smooth(t));
}

export async function createFisher(scene, world, { sound } = {}) {
  const ch = await loadOldman('/assets/oldman.glb');
  const model = ch.model; model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const root = new THREE.Group(); root.scale.setScalar(HEIGHT / (box.max.y - box.min.y));
  model.position.y = -box.min.y; root.add(model); scene.add(root);
  const S = root.scale.x, speed1 = STEP * S;                      // metres a second at 1x
  const B = (n) => ch.bone(n);
  const hand = { r: B('RightHand'), rf: B('RightForeArm'), rm: B('RightHandMiddle1'), l: B('LeftHand'), lm: B('LeftHandMiddle1') };
  const head = B('Head'), chest = B('Spine2'), spine = ['Spine', 'Spine1', 'Spine2'].map(B);

  const rod = makeRod(), bob = makeBobber(), can = makeCan(); scene.add(rod, bob, can);
  const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 28 }, () => new THREE.Vector3()));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4efe6', transparent: true, opacity: 0.75 }));
  line.frustumCulled = false; scene.add(line);
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.32, 8), new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.5, metalness: 0.6 }));
  holder.position.copy(HOLDER).setY(DECK_Y + 0.16); holder.rotation.x = -0.6; holder.castShadow = true; scene.add(holder);

  const me = {
    root, ch, yaw: FACE_LAKE, pos: SEAT.clone(),
    rodMode: 'hand', rodBlend: 1, rodFrom: { p: new THREE.Vector3(), q: new THREE.Quaternion() },
    bend: 0,                         // how far the rod bends toward the line (0 calm .. 1 hard pull)
    bobState: 'tucked', bobT: 0, bobFrom: new THREE.Vector3(), bobDip: 0,
    canIn: false, doze: 0, twist: 0, lean: 0, task: null, phase: 'away', onCast: null,
    visible: false,
  };
  root.visible = rod.visible = bob.visible = can.visible = line.visible = false;

  // ---- the steps of his day
  function* wait(t) { let e = 0; while (e < t) e += yield; }
  function* walk(route) {
    ch.play('Walk_Loop', { fade: 0.3, speed: WALK_SPEED }); const v = speed1 * WALK_SPEED;
    for (let i = 1; i < route.length; i++) {
      const to = route[i];
      while (true) {
        const dt = yield; v1.set(to.x - me.pos.x, 0, to.z - me.pos.z); const d = v1.length();
        const want = Math.atan2(v1.x, v1.z); me.yaw += angTo(me.yaw, want) * Math.min(1, dt * 5);
        if (d <= v * dt) { me.pos.x = to.x; me.pos.z = to.z; break; }
        v1.multiplyScalar(v * dt / d); me.pos.x += v1.x; me.pos.z += v1.z;
      }
    }
    ch.play('Idle_Loop', { fade: 0.3 });
  }
  function* turn(to) {
    ch.play('Idle_Loop', { fade: 0.25 });
    while (Math.abs(angTo(me.yaw, to)) > 0.01) { const dt = yield; const a = angTo(me.yaw, to); me.yaw += Math.sign(a) * Math.min(Math.abs(a), dt * 2.6); }
    me.yaw = to;
  }
  function* once(name, at = [], speed = 1) {        // one move to its end; at = [[fraction, fn], ...]
    const a = ch.play(name, { once: true, fade: 0.25, speed }); const d = a.getClip().duration / speed; let e = 0; const todo = at.slice();
    while (e < d) { e += yield; while (todo.length && e >= todo[0][0] * d) todo.shift()[1](); }
  }
  function rodTo(mode, time = 0.7) { if (mode === me.rodMode) return; me.rodFrom.p.copy(rod.position); me.rodFrom.q.copy(rod.quaternion); me.rodMode = mode; me.rodBlend = time > 0 ? 0 : 1; me.rodTime = time; }
  function castBobber() {
    me.bobState = 'flying'; me.bobT = 0; rod.userData.tip.getWorldPosition(me.bobFrom);
  }
  function* sit() {
    const a = ch.play('Sitting_Enter', { once: true, fade: 0.2 }); const d = a.getClip().duration; let e = 0; const from = me.pos.clone();
    while (e < d) { e += yield; const t = smooth(Math.min(1, e / (d * 0.8))); me.pos.lerpVectors(from, SEAT, t); }
    me.pos.copy(SEAT); ch.layer({ low: 'Sitting_Idle_Loop', up: 'Sitting_Idle_Loop', fade: 0.3 }); me.phase = 'seated';
  }
  function* seated(demo) {
    me.phase = 'seated';
    while (true) {
      yield* wait(demo ? rand(3, 7) : rand(14, 40));
      const r = Math.random();
      if (r < 0.45 && me.canIn) {                                   // a sip
        const a = ch.layer({ up: 'Consume', once: true, fade: 0.4 }); yield* wait(a.getClip().duration);
        ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.5 });
      } else if (r < 0.75) {                                         // humming to himself
        ch.layer({ up: 'Sitting_Talking_Loop', fade: 0.6 }); yield* wait(rand(5, 9));
        ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.8 });
      } else {                                                       // a doze: the head sinks, then a start
        let e = 0, d = rand(5, 9); while (e < d) { e += yield; me.doze = Math.min(1, e / 3); }
        let k = 0; while (k < 0.35) { k += yield; me.doze = Math.max(0, 1 - k / 0.25); }
        me.doze = 0;
      }
    }
  }
  function* arrive() {
    me.phase = 'arriving'; me.canIn = false; me.bobState = 'tucked'; rodTo('hand', 0);
    me.pos.copy(ROUTE_IN[0]); me.yaw = Math.atan2(ROUTE_IN[1].x - ROUTE_IN[0].x, ROUTE_IN[1].z - ROUTE_IN[0].z);
    yield* walk(ROUTE_IN);
    yield* turn(FACE_LAKE);
    me.phase = 'casting';
    yield* once('OverhandThrow', [[0.275, castBobber]]);
    rodTo('holder', 1.1);
    yield* sit();
    me.onSeated?.();
    yield* wait(1.2); yield* beer();
    yield* seated(me.demo);
  }
  function* beer() {                                                 // turns to the cooler at his left and takes a can
    const a = ch.layer({ up: 'Chest_Open', once: true, fade: 0.45 }); const d = a.getClip().duration; let e = 0;
    while (e < d + 0.6) { e += yield; me.twist = Math.sin(Math.min(1, e / (d + 0.6)) * Math.PI) * 1; if (e > d * 0.62) me.canIn = true; }
    me.twist = 0; ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.5 });
  }
  function* seatedNow() {                                            // straight to the chair, line already out
    me.pos.copy(SEAT); me.yaw = FACE_LAKE; me.canIn = true; rodTo('holder', 0); me.bobState = 'floating';
    ch.layer({ low: 'Sitting_Idle_Loop', up: 'Sitting_Idle_Loop', fade: 0 }); me.onSeated?.();
    yield* seated(me.demo);
  }
  function run(gen) { me.task = gen; gen.next(0); }

  // ---- posing what he holds, every frame after the mixer
  function facing(out) { return out.set(Math.sin(me.yaw), 0, Math.cos(me.yaw)); }
  function rightOf(out) { return out.set(-Math.cos(me.yaw), 0, Math.sin(me.yaw)); }
  // turn a bone by an angle about an axis given in the world
  function turnBone(b, axis, ang) {
    b.parent.getWorldQuaternion(q2); q1.setFromAxisAngle(axis, ang);
    const local = q2.clone().invert().multiply(q1).multiply(q2); b.quaternion.premultiply(local); b.updateMatrixWorld(true);
  }
  const rodWant = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  function rodPose(mode, out) {
    if (mode === 'hand') {
      const grip = hand.r.getWorldPosition(v1).lerp(hand.rm.getWorldPosition(v2), 0.55);
      const fore = v2.copy(grip).sub(hand.rf.getWorldPosition(v3)).normalize();
      const dir = v3.copy(fore).multiplyScalar(0.6).addScaledVector(facing(new THREE.Vector3()), 0.55).addScaledVector(up, 0.7).normalize();
      out.q.setFromUnitVectors(Y, dir); out.p.copy(grip).addScaledVector(dir, -0.3);
    } else {
      const to = v2.set(SPOT.bobber.x - HOLDER.x, 0, SPOT.bobber.z - HOLDER.z).normalize();
      const dir = v3.copy(to).addScaledVector(up, 0.85).normalize();
      out.q.setFromUnitVectors(Y, dir); out.p.copy(HOLDER).setY(DECK_Y + 0.02);
    }
    return out;
  }
  function placeRod(dt) {
    rodPose(me.rodMode, rodWant);
    if (me.rodBlend < 1) {
      me.rodBlend = Math.min(1, me.rodBlend + dt / me.rodTime); const t = smooth(me.rodBlend);
      rod.position.lerpVectors(me.rodFrom.p, rodWant.p, t); rod.quaternion.slerpQuaternions(me.rodFrom.q, rodWant.q, t);
    } else { rod.position.copy(rodWant.p); rod.quaternion.copy(rodWant.q); }
    const links = rod.userData.links, b = me.bend * 0.32 + 0.03;
    for (const l of links) l.rotation.x = -b;           // the rod's own +Z is its upper side: bend the other way, toward the water
  }
  function placeBob(dt, t) {
    const tip = rod.userData.tip.getWorldPosition(v1);
    if (me.bobState === 'tucked') bob.position.copy(tip).addScaledVector(up, -0.35);
    else if (me.bobState === 'flying') {
      me.bobT += dt / 1.05; const k = Math.min(1, me.bobT);
      bob.position.lerpVectors(me.bobFrom, SPOT.bobber, k); bob.position.y = THREE.MathUtils.lerp(me.bobFrom.y, 0.03, k) + Math.sin(k * Math.PI) * 2.2;
      if (k >= 1) { me.bobState = 'floating'; world.ripple(SPOT.bobber.x, SPOT.bobber.z, 1.4); sound?.splash?.(0.18); me.onCast?.(); }
    } else {
      bob.position.copy(SPOT.bobber); bob.position.y = 0.03 + Math.sin(t * 1.7) * 0.012 - me.bobDip;
      bob.rotation.z = Math.sin(t * 1.1) * 0.08;
    }
    // the line, sagging between the tip and the float
    const p = line.geometry.attributes.position, n = p.count, slack = me.bobState === 'tucked' ? 0 : 0.6 * (1 - me.bend);
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1); v2.lerpVectors(tip, bob.position, s); v2.y -= Math.sin(s * Math.PI) * slack * (me.bobState === 'flying' ? 0.2 : 1);
      if (i === n - 1) v2.y += 0.06; p.setXYZ(i, v2.x, v2.y, v2.z);
    }
    p.needsUpdate = true;
  }
  function placeCan() {
    can.visible = me.visible && me.canIn;
    if (!can.visible) return;
    const g = hand.l.getWorldPosition(v1).lerp(hand.lm.getWorldPosition(v2), 0.5);
    const lift = THREE.MathUtils.clamp((g.y - chest.getWorldPosition(v3).y + 0.05) / 0.22, 0, 1);   // how high the hand is: a sip tips it
    can.position.copy(g).addScaledVector(up, 0.07);                  // standing in his palm, not lost inside the fist
    rightOf(v2); q1.setFromAxisAngle(v2, lift * 1.7); can.quaternion.copy(q1);
  }

  me.parts = { rod, bob, can, line };
  Object.defineProperty(me, 'walking', { get: () => me.phase === 'arriving' });
  return Object.assign(me, {
    show(seatedNow_ = false) {
      me.visible = root.visible = rod.visible = bob.visible = line.visible = true;
      run(seatedNow_ ? seatedNow() : arrive());
    },
    headPos(out = new THREE.Vector3()) { return head.getWorldPosition(out); },
    update(dt, t) {
      if (!me.visible) return;
      if (me.task) { const r = me.task.next(dt); if (r.done) me.task = null; }
      root.position.set(me.pos.x, me.phase === 'seated' || me.phase === 'casting' ? DECK_Y : groundAt(me.pos.x, me.pos.z), me.pos.z);
      root.rotation.y = me.yaw; root.updateMatrixWorld(true);
      ch.update(dt);
      if (me.doze > 0) turnBone(head, rightOf(v3), -me.doze * 0.42);
      if (me.twist) for (const b of spine) turnBone(b, up, me.twist * 0.2);     // toward his left, about a third of a turn
      placeRod(dt); placeBob(dt, t); placeCan();
    },
  });
}
