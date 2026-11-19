// The old fisherman on the edge of your screen. He walks in along the top of the Dock, sets his camp at his spot, casts so
// the float drops off the bottom of the screen, sits and waits: a sip, a hum, a doze. When something bites he leans into
// the rod; a catch comes up the line from below the screen; a big one can pull him off the edge, and he climbs back up.
// The floor (y = 0) is the line he sits on; the camera puts it on the top of the Dock. World units are metres.
import * as THREE from 'three';
import { loadOldman } from './character.js';
import { makeChair, makeCooler, makeRod, makeBobber, makeCan } from './props.js';
import { loadProps } from './props3d.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export const HEIGHT = 1.45;
export const YAW = -0.35;                 // he faces you, turned a little toward the left of the screen
const WALK_SPEED = 1.3, STEP = 0.04085;   // the library walk, a little faster; metres per second at 1x in model units
const SIT_SLIDE = 0.27;                   // the sit swings his feet forward this far: he slides back as much
const SEAT_LIFT = 0.075;                  // his sitting move puts his bottom 13 cm off the ground; the chair's cloth is at 24 cm (3 cm sag)
// (his legs are short: thigh 21 cm, shin 12 cm. The move holds them straight with the ankles behind his hips and the toes
// in the ground; sitting on the cloth his knees bend forward and his boots stand flat, FOOT_FWD in front of his hips)
const FOOT_FWD = 0.17;
const up = new THREE.Vector3(0, 1, 0), Y = up;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const smooth = (t) => t * t * (3 - 2 * t);
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const rand = (a, b) => a + Math.random() * (b - a);
const dirOf = (yaw, out = new THREE.Vector3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
const leftOf = (yaw, out = new THREE.Vector3()) => out.set(Math.cos(yaw), 0, -Math.sin(yaw));

function blob(w, d, opacity) {           // a soft round shadow on the floor
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.55, 'rgba(0,0,0,.45)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.renderOrder = -1; return m;
}

// his patch of ground: a small grassy island with a soil edge, so he sits on something instead of the air
function makePatch() {
  const g = new THREE.Group(), shape = new THREE.Shape(), N = 56;
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2, r = 1 + Math.sin(a * 5) * 0.035 + Math.sin(a * 3 + 1) * 0.05;
    const x = Math.cos(a) * 1.0 * r, y = Math.sin(a) * 0.5 * r; i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.05, bevelSegments: 3, curveSegments: 56 });
  geo.rotateX(Math.PI / 2);                                   // top face at y = 0, soil going down
  const grass = new THREE.MeshStandardMaterial({ color: '#6fae4a', roughness: 0.95 }), soil = new THREE.MeshStandardMaterial({ color: '#7a5634', roughness: 1 });
  const m = new THREE.Mesh(geo, [grass, soil]); m.position.y = -0.035; m.receiveShadow = true; g.add(m);
  const rnd = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  const blade = new THREE.ConeGeometry(0.018, 0.13, 3), bladeMat = new THREE.MeshStandardMaterial({ color: '#4f8f36', roughness: 0.9 });
  const tufts = new THREE.InstancedMesh(blade, bladeMat, 90), o = new THREE.Object3D(); let k = 0;
  while (k < 90) {
    const a = rnd() * Math.PI * 2, r = 0.55 + rnd() * 0.42; const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.5;
    for (let j = 0; j < 3 && k < 90; j++, k++) { o.position.set(x + (rnd() - 0.5) * 0.06, 0.05, z + (rnd() - 0.5) * 0.04); o.rotation.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5); o.scale.setScalar(0.7 + rnd() * 0.7); o.updateMatrix(); tufts.setMatrixAt(k, o.matrix); }
  }
  g.add(tufts);
  const petal = new THREE.SphereGeometry(0.02, 8, 6);
  for (const [x, z, c] of [[0.78, 0.12, '#ffffff'], [-0.62, -0.25, '#ffe36e'], [0.4, -0.38, '#ffffff'], [-0.35, 0.36, '#ff9fb2']]) { const f = new THREE.Mesh(petal, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); f.position.set(x, 0.03, z); g.add(f); }
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#9a958c', roughness: 0.9 });
  for (const [x, z, s] of [[0.92, 0.1, 0.06], [-0.9, 0.05, 0.05], [0.2, 0.47, 0.045]]) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneMat); st.position.set(x, 0.01, z); st.scale.y = 0.6; st.castShadow = true; g.add(st); }
  return g;
}

// what comes up the line: junk looks like what it is, anything else is a round cartoon fish
export function makeCatch(f, P = null) {
  if (P?.fish && !['keyboard', 'boot', 'can', 'duck'].includes(f.id)) return P.fish(f.colour);   // the Lux3D fish, tinted
  if (P?.can && f.id === 'can') { const c = P.can(); c.rotation.z = 0.5; c.userData.junk = c.userData.keep = true; return c; }   // shares everything with his own can: freed by nobody
  const m = (c, r = 0.5, mt = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt });
  const g = new THREE.Group(); let o;
  if (f.id === 'keyboard') {
    o = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.15), m('#3a3d44', 0.6)); g.add(o);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.014, 0.026), m(r === 3 && c > 3 && c < 9 ? '#d9d4ca' : '#eceae4', 0.5)); k.position.set(-0.18 + c * 0.033, 0.021, -0.05 + r * 0.033); if (!(r === 3 && c > 4 && c < 8)) g.add(k); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.026), m('#eceae4')); bar.position.set(0, 0.021, 0.05); g.add(bar);
    g.rotation.x = 0.9;
  } else if (f.id === 'boot') {
    o = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), m(f.colour, 0.8)); o.position.y = 0.05; g.add(o);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), m(f.colour, 0.8)); toe.position.set(0.05, -0.06, 0); g.add(toe);
  } else if (f.id === 'can') {
    o = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.13, 14), m(f.colour, 0.4, 0.7)); g.add(o); g.rotation.z = 0.5;
  } else if (f.id === 'duck') {
    o = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), m('#f5d22c', 0.3)); o.scale.set(1.25, 0.9, 1); g.add(o);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), m('#f5d22c', 0.3)); hd.position.set(0.05, 0.07, 0); g.add(hd);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 8), m('#f08a24', 0.4)); bk.rotation.z = -Math.PI / 2; bk.position.set(0.1, 0.065, 0); g.add(bk);
  } else return makeFish(f.colour);
  g.userData.junk = true; g.traverse(x => { if (x.isMesh) x.castShadow = true; }); return g;
}

export function makeFish(colour) {      // a round cartoon fish, nose along +X
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), mat); body.scale.set(1.5, 0.95, 0.55); g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.13, 4), mat); tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.25); tail.position.x = -0.2; g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 3), mat); fin.position.set(0.0, 0.1, 0); fin.scale.set(1.6, 1, 0.3); g.add(fin);
  const eyeW = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), eyeB = new THREE.MeshStandardMaterial({ color: '#1b1612', roughness: 0.2 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), eyeW); e.position.set(0.1, 0.025, s * 0.05); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeB); p.position.set(0.115, 0.028, s * 0.068); g.add(p);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}

export async function createDeskman(scene, opts = {}) {
  const [ch, P] = await Promise.all([loadOldman(opts.url || './assets/oldman.glb'), opts.props === false ? null : loadProps()]);
  const model = ch.model; model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const root = new THREE.Group(); root.scale.setScalar(HEIGHT / (box.max.y - box.min.y));
  model.position.y = -box.min.y; root.add(model); scene.add(root);
  const S = root.scale.x, speed1 = STEP * S;
  const B = (n) => ch.bone(n);
  const hand = { r: B('RightHand'), rf: B('RightForeArm'), rm: B('RightHandMiddle1'), l: B('LeftHand'), lm: B('LeftHandMiddle1') };
  // the left hand's fingers, for holding the can: [bone 1, 2, 3] for each finger, and the thumb
  const lf = Object.fromEntries(['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'].map(f => [f, [1, 2, 3].map(i => B('LeftHand' + f + i))]));
  const head = B('Head'), chest = B('Spine2'), spine = ['Spine', 'Spine1', 'Spine2'].map(B);

  // his camp: chair, cooler and their shadows, carried as one when he is moved along the edge
  const camp = new THREE.Group(); scene.add(camp);
  const patch = makePatch(); patch.position.set(0.15, 0, -0.05); camp.add(patch);
  const chair = P?.chair?.() ?? makeChair(); chair.rotation.y = Math.PI + YAW; camp.add(chair);
  const cooler = P?.cooler?.() ?? makeCooler(); cooler.position.copy(leftOf(YAW).multiplyScalar(0.6)).addScaledVector(dirOf(YAW), 0.06); cooler.rotation.y = YAW + Math.PI / 2; camp.add(cooler);
  camp.add(blob(0.95, 0.8, 0.32)); const cb = blob(0.6, 0.45, 0.28); cb.position.copy(cooler.position).setY(0.003); camp.add(cb);
  const manShadow = blob(0.7, 0.5, 0.3); scene.add(manShadow);

  const rod = makeRod(), bob = makeBobber(), can = P?.can?.() ?? makeCan(); scene.add(rod, bob, can);
  // the line: a light core inside a dark edge, so it shows on a dark screen and on a light one
  const line = new THREE.Group(), lineParts = [['#17130f', 3.4, 0.5], ['#fff6e6', 1.5, 0.95]].map(([c, w, op], i) => {
    const l = new Line2(new LineGeometry(), new LineMaterial({ color: c, linewidth: w, transparent: true, opacity: op, depthWrite: false }));
    l.frustumCulled = false; l.renderOrder = 2 + i; line.add(l); return l;
  });
  const linePts = new Float32Array(24 * 3); scene.add(line);
  let fish = null;

  const me = {
    root, ch, camp, yaw: YAW, pos: new THREE.Vector3(), spot: 0, bottomY: -1, rightX: 8,
    phase: 'away', task: null, canIn: false, sitK: 0, backPush: 0, doze: 0, twist: 0, lean: 0, bend: 0, jerk: 0, tension: 0,
    bobState: 'gone', bobT: 0, bobFrom: new THREE.Vector3(), fishK: 0, fishOn: false, visible: false, fall: null,
  };
  root.visible = rod.visible = can.visible = line.visible = bob.visible = manShadow.visible = false;
  const seat = () => v3.set(me.spot, 0, 0);
  const stand = () => seat().addScaledVector(dirOf(YAW), SIT_SLIDE);

  // ---- steps
  function* wait(t) { let e = 0; while (e < t) e += yield; }
  function* walkTo(x, z, clip = 'Walk_Loop', speed = WALK_SPEED, metres = null, stop = true) {
    ch.play(clip, { fade: 0.3, speed }); const v = metres ?? speed1 * speed;
    const stride = /Jog/.test(clip) ? 0.33 : 0.5 / speed; let st = stride * 0.5;
    while (true) {
      const dt = yield; v1.set(x - me.pos.x, 0, z - me.pos.z); const d = v1.length();
      if ((st -= dt) <= 0) { st += stride; emit('step', /Jog/.test(clip)); }
      me.yaw += angTo(me.yaw, Math.atan2(v1.x, v1.z)) * Math.min(1, dt * 6);
      if (d <= v * dt) { me.pos.set(x, 0, z); break; }
      me.pos.addScaledVector(v1, v * dt / d);
    }
    if (stop) ch.play('Idle_Loop', { fade: 0.3 });
  }
  // ---- where he may walk: the chair and the cooler are solid. Each is a box on the floor in its own frame; he keeps his
  // body (BODY_R) outside them and walks the shortest way round, by their corners, never through.
  const BODY_R = 0.17;
  function footprints() {
    return [chair, cooler].map(o => {
      const r = o.rotation.y; o.rotation.y = 0; o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); o.rotation.y = r; o.updateMatrixWorld(true);
      const w = o.getWorldPosition(new THREE.Vector3());
      return { cx: w.x, cz: w.z, yaw: r, ox: (b.min.x + b.max.x) / 2 - w.x, oz: (b.min.z + b.max.z) / 2 - w.z, hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2 };
    });
  }
  const local = (o, x, z) => { const dx = x - o.cx, dz = z - o.cz, c = Math.cos(o.yaw), s = Math.sin(o.yaw); return [dx * c - dz * s - o.ox, dx * s + dz * c - o.oz]; };
  const world = (o, lx, lz) => { lx += o.ox; lz += o.oz; const c = Math.cos(o.yaw), s = Math.sin(o.yaw); return [o.cx + lx * c + lz * s, o.cz - lx * s + lz * c]; };
  const inside = (F, x, z, inf) => F.some(o => { const [lx, lz] = local(o, x, z); return Math.abs(lx) < o.hx + inf && Math.abs(lz) < o.hz + inf; });
  function clear(F, a, b, inf) {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.02));
    for (let i = 1; i <= n; i++) { const t = i / n; if (inside(F, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, inf)) return false; }
    return true;
  }
  function escape(F, p, inf) {                            // a point inside the margin, pushed out the short way
    let q = p.slice(), moved = false;
    for (let k = 0; k < 3; k++) for (const o of F) {
      const [lx, lz] = local(o, q[0], q[1]), px = o.hx + inf - Math.abs(lx), pz = o.hz + inf - Math.abs(lz);
      if (px > 0 && pz > 0) { q = px < pz ? world(o, Math.sign(lx || 1) * (o.hx + inf + 0.02), lz) : world(o, lx, Math.sign(lz || 1) * (o.hz + inf + 0.02)); moved = true; }
    }
    return moved ? q : null;
  }
  function route(tx, tz) {                                // the way from where he stands to (tx, tz): a list of points
    const F = footprints(), inf = BODY_R, way = [];
    let a = [me.pos.x, me.pos.z]; const e1 = escape(F, a, inf); if (e1) { way.push(e1); a = e1; }
    const goal = [tx, tz], e2 = escape(F, goal, inf), g = e2 || goal;
    const nodes = [a, g, ...F.flatMap(o => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => world(o, sx * (o.hx + inf + 0.04), sz * (o.hz + inf + 0.04))))
      .filter(n => !inside(F, n[0], n[1], inf))];
    const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false); dist[0] = 0;
    for (;;) {                                            // Dijkstra over the corners he can see from each other
      let u = -1; for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === 1) break; done[u] = true;
      for (let v = 0; v < nodes.length; v++) if (!done[v] && clear(F, nodes[u], nodes[v], inf)) {
        const d = dist[u] + Math.hypot(nodes[v][0] - nodes[u][0], nodes[v][1] - nodes[u][1]); if (d < dist[v]) { dist[v] = d; prev[v] = u; }
      }
    }
    if (dist[1] < Infinity) { const path = []; for (let i = 1; i > 0; i = prev[i]) path.unshift(nodes[i]); way.push(...path); }
    else way.push(g);                                     // no way found (should not happen): go straight
    if (e2) way.push(goal);
    return way;
  }
  me.route = route; me.footprints = footprints; me.BODY_R = BODY_R;          // for the checks
  function* goTo(x, z, clip = 'Walk_Loop', speed = WALK_SPEED, metres = null) {
    const way = route(x, z);
    for (let i = 0; i < way.length; i++) yield* walkTo(way[i][0], way[i][1], clip, speed, metres, i === way.length - 1);
  }
  function* turn(to) {                                    // small steps on the spot while he turns, never a spin on his heels
    if (Math.abs(angTo(me.yaw, to)) > 0.35) ch.play('Walk_Loop', { fade: 0.2, speed: 0.75 });
    while (Math.abs(angTo(me.yaw, to)) > 0.01) { const dt = yield; const a = angTo(me.yaw, to); me.yaw += Math.sign(a) * Math.min(Math.abs(a), dt * 2.4); }
    me.yaw = to; ch.play('Idle_Loop', { fade: 0.3 });
  }
  function* once(name, at = [], speed = 1) {
    const a = ch.play(name, { once: true, fade: 0.25, speed }); const d = a.getClip().duration / speed; let e = 0; const todo = at.slice();
    while (e < d) { e += yield; while (todo.length && e >= todo[0][0] * d) todo.shift()[1](); }
  }
  function* sit() {
    const a = ch.play('Sitting_Enter', { once: true, fade: 0.2 }); const d = a.getClip().duration; let e = 0; const from = me.pos.clone(), to = seat().clone();
    while (e < d) { e += yield; const k = smooth(Math.min(1, e / (d * 0.8))); me.pos.lerpVectors(from, to, k); me.sitK = k; }
    me.pos.copy(to); me.sitK = 1; me.squash = 1; emit('creak'); ch.layer({ low: 'Sitting_Idle_Loop', up: 'Sitting_Idle_Loop', fade: 0.3 }); me.phase = 'seated';
  }
  function* beer() {
    const a = ch.layer({ up: 'Chest_Open', once: true, fade: 0.45 }); const d = a.getClip().duration; let e = 0;
    while (e < d + 0.6) { e += yield; me.twist = Math.sin(Math.min(1, e / (d + 0.6)) * Math.PI); if (e > d * 0.62 && !me.canIn) { me.canIn = true; emit('canOpen'); } }
    me.twist = 0; ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.5 });
  }
  function* seated(quiet = false) {
    me.phase = 'seated'; if (!quiet) me.onSeated?.();
    while (true) {
      yield* wait(me.demo ? rand(3, 6) : rand(12, 35));
      const r = Math.random();
      if (r < 0.45 && me.canIn) { me.mood = 'sip'; const a = ch.layer({ up: 'Consume', once: true, fade: 0.4 }); yield* wait(a.getClip().duration * 0.45); emit('gulp'); yield* wait(a.getClip().duration * 0.55); ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.5 }); if (Math.random() < 0.35) { yield* wait(0.5); emit('burp'); } }
      else if (r < 0.62) { me.mood = 'hum'; ch.layer({ up: 'Sitting_Talking_Loop', fade: 0.6 }); yield* wait(rand(5, 9)); ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.8 }); }
      else if (r < 0.8) { me.mood = 'fart'; yield* fart(); }
      else { me.mood = 'doze'; emit('doze'); let e = 0, d = rand(7, 14); while (e < d) { e += yield; me.doze = Math.min(1, e / 3); } emit('wake'); let k = 0; while (k < 0.3) { k += yield; me.doze = Math.max(0, 1 - k / 0.22); } me.doze = 0; }
      me.mood = null;
    }
  }
  function castBobber() { me.bobState = 'flying'; me.bobT = 0; rod.userData.tip.getWorldPosition(me.bobFrom); }
  function* arrive() {
    me.phase = 'arriving'; me.canIn = false; me.bobState = 'gone'; me.sitK = 0; me.backPush = 0;
    me.pos.set(me.rightX + 0.8, 0, 0.62); me.yaw = -Math.PI / 2;
    const s = stand().clone(); yield* goTo(s.x, s.z);
    yield* turn(YAW);
    me.phase = 'casting'; yield* once('OverhandThrow', [[0.275, castBobber]]);
    yield* sit(); me.phase = 'settling'; yield* wait(0.8);          // not 'seated' yet: nothing may break into the beer ritual
    if (me.skipBeerRun) { yield* beer(); yield* seated(); return; }
    yield* emptyCooler(); yield* askForMoney(); yield* beerRun(); yield* seated();
  }
  // he forgot the beer: the cooler is empty, he gets up and holds out his hand until you pay
  function* emptyCooler() {
    const a = ch.layer({ up: 'Chest_Open', once: true, fade: 0.45 }); const d = a.getClip().duration; let e = 0;
    while (e < d + 0.6) { e += yield; me.twist = Math.sin(Math.min(1, e / (d + 0.6)) * Math.PI); }
    me.twist = 0; ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.4 }); emit('noBeer'); yield* wait(2.4);
  }
  function* standUp() {
    me.phase = 'standing'; emit('creak');
    const a = ch.play('Sitting_Exit', { once: true, fade: 0.2 }); let k = 0; const d = a.getClip().duration, s0 = me.pos.clone(), s1 = stand().clone();
    while (k < d) { k += yield; const t = smooth(Math.min(1, k / d)); me.pos.lerpVectors(s0, s1, t); me.sitK = 1 - smooth(Math.min(1, k / (d * 0.6))); }
    me.sitK = 0;
  }
  function* askForMoney() {
    me.money = false; me.bobState = 'gone'; yield* standUp(); me.phase = 'broke'; emit('askMoney');
    let lastNag = me.t;
    while (!me.money) {
      yield* once('Interact'); if (me.money) break;
      ch.play('Idle_Loop', { fade: 0.3 }); let e = 0; while (e < 2.5 && !me.money) e += yield;
      if (me.t - lastNag > (me.demo ? 15 : 25) && !me.money) { lastNag = me.t; emit('nag'); yield* once('Idle_Rail_Call'); }
    }
    emit('thanks'); yield* once('Yes', [], 1.4);
  }
  function* beerRun() {                                   // off to the shop at a jog, back at a walk with a can
    me.phase = 'away'; yield* goTo(me.rightX + 1.0, 0.62, 'Jog_Fwd_Loop', 1, 1.6);                      // round the front of his cooler
    root.visible = rod.visible = false; yield* wait(me.demo ? 2.5 : 4);
    root.visible = rod.visible = true; me.canIn = true; me.phase = 'arriving';
    me.pos.set(me.rightX + 1.0, 0, 0.62); { const s = stand().clone(); yield* goTo(s.x, s.z); } yield* turn(YAW);
    me.phase = 'casting'; yield* once('OverhandThrow', [[0.275, castBobber]]); yield* sit(); emit('canOpen'); emit('back');     // seated, he cracks open the can he brought
  }
  // moments that break into his waiting; each ends back in his chair
  function* moment(kind) {
    me.mood = null; me.doze = 0;
    if (kind === 'scold') { yield* upOnce('Spell_Simple_Shoot'); yield* upFor('Sitting_Talking_Loop', 1.6); }
    else if (kind === 'attention') { emit('shake'); yield* upOnce('Idle_Rail_Call'); }
    else if (kind === 'talk') { yield* upFor('Sitting_Talking_Loop', 3); }
    else if (kind === 'fart') { yield* fart(); }
    else if (kind === 'poke') { yield* upOnce('Hit_Chest'); yield* upFor('Sitting_Talking_Loop', 1.4); }
    else if (kind === 'noFish') {
      yield* standUp();
      if (Math.random() < 0.5) {                          // flat on his back, then up again: out on open ground, never in the chair
        const F = footprints(), left = Math.min(...F.map(o => o.cx - Math.hypot(o.hx, o.hz))) - BODY_R - 0.25;
        yield* goTo(left, 0.35); yield* turn(Math.PI / 2); yield* once('Punch_Jab'); yield* once('Death01'); yield* wait(1.6); yield* once('LayToIdle');
        { const s = stand().clone(); yield* goTo(s.x, s.z); }
      } else yield* once('Punch_Jab');
      yield* turn(YAW); yield* sit();
    } else if (kind === 'stone') {
      yield* standUp(); ch.play('Idle_Loop', { fade: 0.2 }); yield* wait(0.4);
      yield* once('OverhandThrow', [[0.3, throwStone]]); yield* wait(0.4); yield* sit();
    }
    ch.layer({ low: 'Sitting_Idle_Loop', up: 'Sitting_Idle_Loop', fade: 0.4 }); me.phase = 'seated';
    yield* seated(true);
  }
  const puffMat = new THREE.MeshStandardMaterial({ color: '#a9c45a', emissive: '#4a5a10', roughness: 1, transparent: true, opacity: 0, depthWrite: false });
  const puffs = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), puffMat.clone()); m.visible = false; scene.add(m); return m; });
  function puff() {                                       // out from under the seat, on both sides of the chair, rising and fading
    const at = seat().clone(), side = leftOf(YAW), fwd = dirOf(YAW); let e = 0;
    puffs.forEach((m, i) => { const sgn = i % 2 ? 1 : -1, j = Math.floor(i / 2);
      m.userData.v = side.clone().multiplyScalar(sgn * (0.16 + j * 0.05)).addScaledVector(fwd, 0.04).setY(0.1 + j * 0.06);
      m.position.copy(at).addScaledVector(side, sgn * 0.2).addScaledVector(fwd, 0.06).setY(0.24 + j * 0.05); m.scale.setScalar(0.5); m.visible = true; });
    me.puff = (dt) => { e += dt; const k = Math.min(1, e / 2.2);
      puffs.forEach((m, i) => { m.position.addScaledVector(m.userData.v, dt); m.scale.setScalar(0.8 + k * (3 + (i % 3) * 0.6)); m.material.opacity = 0.6 * Math.sin(Math.min(1, k * 1.15) * Math.PI); });
      if (k >= 1) { puffs.forEach(m => { m.visible = false; }); me.puff = null; } };
  }
  function* fart() {
    me.squash = 1; yield* wait(0.12); emit('fart'); puff(); yield* wait(1.1);
    yield* upFor('Sitting_Talking_Loop', 2.4);                     // and it was you, apparently
  }
  function* upOnce(name) { const a = ch.layer({ up: name, once: true, fade: 0.3 }); yield* wait(a.getClip().duration * 0.95); ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.4 }); }
  function* upFor(name, sec) { ch.layer({ up: name, fade: 0.4 }); yield* wait(sec); ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.5 }); }
  // the stone: from his hand straight at you, growing as it comes, until it hits the glass
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ color: '#8d877c', roughness: 0.9 })); stone.visible = false; scene.add(stone);
  function throwStone() {
    hand.r.getWorldPosition(stone.position); stone.visible = true; emit('whoosh'); const from = stone.position.clone(); let e = 0;
    me.fly = (dt) => { e += dt; const k = Math.min(1, e / 0.45); stone.position.lerpVectors(from, v1.set(from.x - 1.7, from.y + 0.9, 9), k * k);    // up and to the left, at you stone.rotation.x += dt * 14; stone.scale.setScalar(1 + k * k * 6);
      if (k >= 1) { stone.visible = false; me.fly = null; emit('stoneHit', stone.position.clone().setZ(0.5)); } };
  }
  function* settled() { me.pos.copy(seat()); me.sitK = 1; me.yaw = YAW; me.canIn = true; me.bobState = 'down'; ch.layer({ low: 'Sitting_Idle_Loop', up: 'Sitting_Idle_Loop', fade: 0 }); yield* seated(); }
  function run(gen) { if (me.mood === 'doze') emit('wake'); me.mood = null; me.doze = 0; me.task = gen; gen.next(0); }
  function dropFish() {
    if (!fish) return; scene.remove(fish); if (fish.userData.keep) { fish = null; return; } const own = new Set();
    const shared = fish.userData.shared;
    fish.traverse(o => { if (o.isMesh) { if (!shared) own.add(o.geometry); [].concat(o.material).forEach(m => own.add(m)); } });
    for (const x of own) x.dispose(); fish = null;
  }
  const emit = (name, data) => me.emit?.(name, data);

  // ---- the bite and what follows (the game decides; he only acts)
  function* fight() {                                     // stays in his chair, leaning into the rod
    me.phase = 'fight'; me.doze = 0; ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.2 });
    while (true) yield;
  }
  function* landIt(f, big) {
    me.phase = 'landing'; me.fishOn = true; fish = makeCatch(f, P); if (!fish.userData.junk) fish.scale.setScalar(THREE.MathUtils.clamp(0.8 + (f.kg?.[1] ?? 1) * 0.04, 0.8, 1.7)); scene.add(fish);
    let e = 0;
    while (e < 1.8) { e += yield; me.fishK = smooth(Math.min(1, e / 1.8)); me.bend = 0.6 * (1 - e / 1.8) + 0.25; }
    const a = ch.play('Sitting_Exit', { once: true, fade: 0.2 }); let k = 0; const d = a.getClip().duration, s0 = me.pos.clone(), s1 = stand().clone();
    while (k < d) { k += yield; me.pos.lerpVectors(s0, s1, smooth(Math.min(1, k / d))); me.sitK = 1 - smooth(Math.min(1, k / (d * 0.6))); }
    me.sitK = 0;
    if (fish.userData.junk) { emit('junk'); yield* once('Punch_Jab'); }
    else { emit('dance'); yield* once('Jump_Start', [], 1.2); me.squash = 1; yield* once('Jump_Land', [], 1.2); ch.play('Dance_Loop', { fade: 0.2 }); yield* wait(big ? 5 : 3.5); emit('danced'); }
    // into the cooler
    let c = 0; const p0 = fish.position.clone(), p1 = cooler.getWorldPosition(new THREE.Vector3()).setY(0.45);
    me.fishOn = false; while (c < 0.6) { c += yield; const t = Math.min(1, c / 0.6); fish.position.lerpVectors(p0, p1, t); fish.position.y += Math.sin(t * Math.PI) * 0.4; fish.rotation.z += 0.3; fish.scale.multiplyScalar(0.985); }
    dropFish(); me.bend = 0;
    yield* turn(YAW); yield* once('OverhandThrow', [[0.275, castBobber]]); yield* sit(); yield* seated();
  }
  function* shrug() { me.phase = 'escaped'; me.bend = 0; ch.layer({ up: 'Idle_No_Loop', fade: 0.3 }); yield* wait(2.5); ch.layer({ up: 'Sitting_Idle_Loop', fade: 0.5 }); yield* seated(); }
  function* pulledIn() {                                  // the fish wins: off the edge he goes, and back up he climbs
    me.phase = 'pulled'; me.bend = 1; me.sitK = 0; me.backPush = 0;
    const a = ch.play('Hit_Knockback', { once: true, fade: 0.1 }); const fwd = dirOf(YAW).clone(); let e = 0, vy = 1.2, vz = 2.2;
    me.fall = { y: 0 };
    while (me.fall.y > me.bottomY - 2.2) { const dt = yield; e += dt; vy -= 9.8 * dt; me.fall.y += vy * dt; me.pos.addScaledVector(fwd, vz * dt * 0.5); me.spin = (me.spin || 0) + dt * 5; }
    me.bend = 0; me.bobState = 'gone'; me.canIn = false; root.visible = rod.visible = false; me.spin = 0; emit('bigSplash');
    yield* wait(2.2);
    // back up: climbing over the edge just right of his chair
    me.pos.copy(stand()).add(v1.set(0.25, 0, 0.35)); me.yaw = Math.PI; root.visible = true; me.fall = { y: -0.95 };
    const c = ch.play('ClimbUp_1m', { once: true, fade: 0 }); const d = c.getClip().duration * 1.6; c.timeScale = 1 / 1.6; e = 0;
    while (e < d) { e += yield; me.fall.y = THREE.MathUtils.lerp(-0.95, -0.42, smooth(Math.min(1, e / d))); }
    me.fall = null; ch.play('Idle_Loop', { fade: 0.2 }); me.pos.add(v1.set(0, 0, -0.3));
    emit('climbed'); yield* once('Idle_No_Loop'); rod.visible = true;
    { const s = stand().clone(); yield* goTo(s.x, s.z); } yield* turn(YAW);
    yield* once('OverhandThrow', [[0.275, castBobber]]); yield* sit(); me.phase = 'settling'; yield* beer(); yield* seated();
  }


  // ---- his body in the chair. Sitting, he rests on the cloth (SEAT_LIFT, faded in and out with the sit), his legs bend
  // (two-bone IK, knees forward) to stand his boots flat on the ground where the move put his feet, and points on his back
  // never pass through the backrest: he slides forward on the seat just enough (backPush, up to 12 cm).
  const legs = ['Left', 'Right'].map(s => ({ up: B(s + 'UpLeg'), knee: B(s + 'Leg'), foot: B(s + 'Foot'), toe: B(s + 'ToeBase') }));
  // how high his ankle stands above his sole with the boot flat, from his rest pose
  const ANKLE_H = (() => { model.updateMatrixWorld(true); const v = new THREE.Vector3(); let low = 9;
    model.traverse(o => { if (!o.isSkinnedMesh) return; const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, a = o.geometry.attributes.position, bones = o.skeleton.bones;
      for (let i = 0; i < a.count; i += 2) { let k = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j;
        if (/LeftFoot$|LeftToe/.test(bones[si.getComponent(i, k)].name)) low = Math.min(low, o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).y); } });
    return low < 9 ? legs[0].foot.getWorldPosition(v).y - low : 0.06; })();
  me.ANKLE_H = ANKLE_H;
  for (const L of legs) L.restQ = L.foot.getWorldQuaternion(new THREE.Quaternion());   // standing at rest his boots are flat (he faces +Z, no turn yet)
  const RQ = new THREE.Quaternion();
  const L1 = new THREE.Vector3(), L2 = new THREE.Vector3(), L3 = new THREE.Vector3(), LT = new THREE.Vector3(), LP = new THREE.Vector3(), LK = new THREE.Vector3(), LQ = new THREE.Quaternion();
  function aim(bone, from, to) {                           // turn a bone so that world direction `from` points along `to`
    q1.setFromUnitVectors(from.normalize(), to.normalize()); bone.parent.getWorldQuaternion(q2);
    bone.quaternion.premultiply(q2.clone().invert().multiply(q1).multiply(q2)); bone.updateMatrixWorld(true);
  }
  function legIK(L, shift, k) {                            // move the ankle by `shift` (world) and, by k, down to boot height
    const a = L.up.getWorldPosition(L1), b = L.knee.getWorldPosition(L2), c = L.foot.getWorldPosition(L3);
    // where his boot goes: his move puts the ankles behind his hips, legs straight, almost kneeling; sitting in a chair the
    // ankle stands FOOT_FWD in front of the hip joint at boot height (blended in by k as he sits)
    L.foot.getWorldQuaternion(LQ); LT.copy(c).add(shift);
    LK.copy(a).addScaledVector(dirOf(me.yaw, LP), FOOT_FWD); LK.y = ANKLE_H + 0.002; LT.lerp(LK, k);
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
    const d = THREE.MathUtils.clamp(a.distanceTo(LT), Math.abs(l1 - l2) * 1.01, (l1 + l2) * 0.999), dir = v1.copy(LT).sub(a).normalize();
    // knees bend forward, the way he faces (his move holds the legs straight, so it gives no bend of its own to keep)
    dirOf(me.yaw, LP); LP.addScaledVector(dir, -LP.dot(dir));
    if (LP.lengthSq() < 1e-10) return; LP.normalize();
    const A = Math.acos(THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    LK.copy(a).addScaledVector(dir, Math.cos(A) * l1).addScaledVector(LP, Math.sin(A) * l1);
    aim(L.up, v2.copy(b).sub(a), v3.copy(LK).sub(a));
    const b2 = L.knee.getWorldPosition(L2), c2 = L.foot.getWorldPosition(L3);
    aim(L.knee, v2.copy(c2).sub(b2), v3.copy(LT).sub(b2));
    L.foot.parent.getWorldQuaternion(q2); L.foot.quaternion.copy(q2.invert().multiply(LQ)); L.foot.updateMatrixWorld(true);   // the foot keeps its turn
    // then stands flat (by k): the boot takes the turn it has standing at rest, turned with him, so the sole rests on the ground
    RQ.setFromAxisAngle(Y, me.yaw).multiply(L.restQ); LQ.slerp(RQ, k);
    L.foot.parent.getWorldQuaternion(q2); L.foot.quaternion.copy(q2.invert().multiply(LQ)); L.foot.updateMatrixWorld(true);
  }
  // the chair's seat and backrest, read once from its shape (in the chair's frame it faces -Z, its back is +Z)
  const seatFit = (() => {
    chair.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(chair.matrixWorld).invert(), cv = [], v = new THREE.Vector3();
    chair.traverse(o => { if (o.isMesh) { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i += 2) cv.push(v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv).toArray()); } });
    const top = Math.max(...cv.filter(q => Math.abs(q[0]) < 0.12 && q[2] > -0.18 && q[2] < 0.04 && q[1] < 0.4).map(q => q[1]));
    const band = []; for (let y = top + 0.08; y < top + 0.45; y += 0.02) { const b = cv.filter(q => Math.abs(q[0]) < 0.15 && q[1] >= y && q[1] < y + 0.02 && q[2] > 0.05); if (b.length) band.push([y + 0.01, Math.min(...b.map(q => q[2]))]); }
    if (band.length < 3) return null;
    const n = band.length, my = band.reduce((s, q) => s + q[0], 0) / n, mz = band.reduce((s, q) => s + q[1], 0) / n;
    const k = band.reduce((s, q) => s + (q[0] - my) * (q[1] - mz), 0) / band.reduce((s, q) => s + (q[0] - my) ** 2, 0);
    return { top, lo: band[0][0] - 0.01, hi: band.at(-1)[0] + 0.01, backZ: (y) => mz + k * (y - my) };
  })();
  // points on his back: in his rest pose, the hindmost skin point in each band between hips and shoulders, left, middle, right
  const backPts = (() => {
    const out = [], v = new THREE.Vector3(); model.updateMatrixWorld(true);
    const hipY = B('Hips').getWorldPosition(new THREE.Vector3()).y, neckY = B('Neck').getWorldPosition(new THREE.Vector3()).y;
    model.traverse(o => { if (!o.isSkinnedMesh) return; const a = o.geometry.attributes.position, best = {};
      for (let i = 0; i < a.count; i += 2) { o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); if (v.y < hipY - 0.01 || v.y > neckY) continue;
        const key = Math.floor((v.y - hipY) / ((neckY - hipY) / 8)) + ':' + (v.x < -0.06 ? 'l' : v.x > 0.06 ? 'r' : 'm');
        if (!best[key] || v.z < best[key].z) best[key] = { i, z: v.z }; }
      for (const b of Object.values(best)) out.push({ mesh: o, i: b.i }); });
    me.backPtsN = out.length; return out;
  })();
  const chairInv = new THREE.Matrix4(), BP = new THREE.Vector3();
  function backGap() {                                     // how far his back goes through the backrest (metres, < 0 = clear)
    if (!seatFit) return -1; chairInv.copy(chair.matrixWorld).invert(); let worst = -1;
    for (const p of backPts) { p.mesh.getVertexPosition(p.i, BP); BP.applyMatrix4(p.mesh.matrixWorld).applyMatrix4(chairInv);
      if (Math.abs(BP.x) < 0.22 && BP.y > seatFit.lo && BP.y < seatFit.hi) worst = Math.max(worst, BP.z - seatFit.backZ(BP.y) + 0.01); }
    return worst;
  }
  me.backGap = backGap; me.seatFit = seatFit;              // for the checks

  // ---- posing what he holds, after the mixer, every frame
  function turnBone(b, axis, ang) {
    b.parent.getWorldQuaternion(q2); q1.setFromAxisAngle(axis, ang);
    const local = q2.clone().invert().multiply(q1).multiply(q2); b.quaternion.premultiply(local); b.updateMatrixWorld(true);
  }
  function placeRod() {
    const grip = hand.r.getWorldPosition(v1).lerp(hand.rm.getWorldPosition(v2), 0.55);
    const fore = v2.copy(grip).sub(hand.rf.getWorldPosition(v3)).normalize();
    const dir = v3.copy(fore).multiplyScalar(0.55).addScaledVector(dirOf(me.yaw, new THREE.Vector3()), 0.6).addScaledVector(up, 0.75 - me.bend * 0.25).normalize();
    rod.quaternion.setFromUnitVectors(Y, dir); rod.position.copy(grip).addScaledVector(dir, -0.3);
    const b = me.bend * 0.3 + 0.03 + Math.sin(me.t * 31) * me.jerk * 0.05;
    for (const l of rod.userData.links) l.rotation.x = -b;
  }
  function placeLine(dt) {
    const tip = rod.userData.tip.getWorldPosition(v1);
    let end;
    if (me.bobState === 'flying') {
      me.bobT += dt / 1.0; const k = Math.min(1, me.bobT); bob.visible = true;
      bob.position.lerpVectors(me.bobFrom, v2.set(me.bobFrom.x - 0.35, me.bottomY - 0.4, me.bobFrom.z + 0.2), k); bob.position.y += Math.sin(k * Math.PI) * 0.9;
      if (k >= 1) { me.bobState = 'down'; bob.visible = false; me.onCast?.(); }
      end = bob.position;
    } else if (me.fishOn && fish) {
      const y = THREE.MathUtils.lerp(me.bottomY - 0.3, tip.y - 0.42, me.fishK);          // up from below the screen to just under the tip
      end = v2.set(tip.x + Math.sin(me.t * 9) * 0.03, y, tip.z); fish.position.copy(end).add(v3.set(0, -0.12, 0));
      if (fish.userData.junk) fish.rotation.y = Math.sin(me.t * 2) * 0.6;
      else fish.rotation.set(0, Math.sin(me.t * 3) * 0.5, Math.PI / 2 + Math.sin(me.t * 14) * 0.35);
    } else if (me.bobState === 'down') {
      const sway = Math.sin(me.t * 0.9) * 0.03 + Math.sin(me.t * 23) * me.jerk * 0.05 + Math.sin(me.t * 3.7) * me.tension * 0.04;
      end = v2.set(tip.x + sway, me.bottomY - 0.3, tip.z);
    } else { line.visible = false; return; }
    line.visible = me.visible && rod.visible;
    const n = 24, slack = me.bobState === 'down' && !me.fishOn ? 0.05 * (1 - me.tension) : 0;
    for (let i = 0; i < n; i++) { const s = i / (n - 1); v3.lerpVectors(tip, end, s); v3.x += Math.sin(s * Math.PI) * slack; linePts.set([v3.x, v3.y, v3.z], i * 3); }
    for (const l of lineParts) { l.geometry.setPositions(linePts); l.computeLineDistances(); }
  }
  // the can in his left hand: against the palm, standing along the line of his knuckles (thumb side up), fingers curled
  // round it. Palm and finger directions come from his bones every frame, so it follows the hand through every move.
  const CAN_R = 0.042, cP = new THREE.Vector3(), cF = new THREE.Vector3(), cA = new THREE.Vector3(), cN = new THREE.Vector3(), cX = new THREE.Vector3(), cM = new THREE.Matrix4();
  // measured once, at rest (before any move plays): each finger bone's bending axis in its own frame, and its rest turn
  const grip = (() => {
    model.updateMatrixWorld(true);
    const V = () => new THREE.Vector3(), w = hand.l.getWorldPosition(V()), m = hand.lm.getWorldPosition(V());
    const f = m.clone().sub(w).normalize(), a = lf.Index[0].getWorldPosition(V()).sub(lf.Pinky[0].getWorldPosition(V())).normalize();
    const n = V().crossVectors(f, a).normalize(); if (n.dot(lf.Thumb[1].getWorldPosition(V()).sub(w.clone().lerp(m, 0.6))) < 0) n.negate();
    const axis = new Map(), rest = new Map();
    for (const bones of Object.values(lf)) bones.forEach((b, i) => {
      const d = bones[i + 1] ? bones[i + 1].getWorldPosition(V()).sub(b.getWorldPosition(V())) : b.getWorldPosition(V()).sub(bones[i - 1].getWorldPosition(V()));
      axis.set(b, V().crossVectors(d.normalize(), n).normalize().applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert()));
      rest.set(b, b.quaternion.clone());
    });
    return { axis, rest };
  })();
  const BEND = { Index: [0.95, 1.0, 0.65], Middle: [1.0, 1.05, 0.65], Ring: [1.0, 1.05, 0.65], Pinky: [1.05, 1.05, 0.6], Thumb: [0.25, 0.45, 0.35] };
  function curl() {                                        // the holding shape: straight fingers bent round the can, whatever the move
    for (const [f, bones] of Object.entries(lf)) bones.forEach((b, i) => b.quaternion.copy(grip.rest.get(b)).multiply(q1.setFromAxisAngle(grip.axis.get(b), BEND[f][i])));
    hand.l.updateMatrixWorld(true);
  }
  function palm() {                                        // centre, finger direction, across (to the thumb side), out of the palm
    const w = hand.l.getWorldPosition(v1), m = hand.lm.getWorldPosition(v2);
    cP.copy(w).lerp(m, 0.6); cF.copy(m).sub(w).normalize();
    cA.copy(lf.Index[0].getWorldPosition(v3)).sub(lf.Pinky[0].getWorldPosition(new THREE.Vector3())).normalize();
    cN.crossVectors(cF, cA).normalize();
    if (cN.dot(v3.copy(lf.Thumb[0].getWorldPosition(v3)).sub(cP)) < 0) cN.negate();   // the palm is on the thumb's side
    cA.addScaledVector(cN, -cA.dot(cN)).normalize();
  }
  function placeCan() {
    can.visible = me.visible && me.canIn && root.visible && !me.fall;
    if (!can.visible) return;
    curl(); palm();
    can.position.copy(cP).addScaledVector(cN, CAN_R + 0.008);
    cX.crossVectors(cA, cN); cM.makeBasis(cX, cA, cN); can.quaternion.setFromRotationMatrix(cM);
  }

  Object.defineProperty(me, 'walking', { get: () => me.phase === 'arriving' });
  Object.defineProperty(me, 'dozing', { get: () => me.doze > 0.3 });
  return Object.assign(me, {
    parts: { rod, bob, can, line, chair, cooler },
    headPos(out = new THREE.Vector3()) { return head.getWorldPosition(out); },
    show(now = false) { me.visible = root.visible = rod.visible = manShadow.visible = true; run(now ? settled() : arrive()); },
    setSpot(x) { me.spot = x; camp.position.x = x; if (me.phase === 'seated' || me.phase === 'fight') me.pos.x = x; },
    bite() { if (me.phase !== 'seated') return false; me.jerk = 1; run(fight()); return true; },
    giveMoney() { me.money = true; },
    // a moment of character, only from his chair while nothing else is going on
    act(kind) { if (me.phase !== 'seated') return false; run(moment(kind)); return true; },
    setResolution(w, h) { for (const l of lineParts) l.material.resolution.set(w, h); },
    reel(tension, progress) { me.tension = tension; me.bend = 0.25 + tension * 0.75; me.jerk = Math.max(0, me.jerk - 0.02) + (tension > 0.85 ? 0.3 : 0); me.lean = tension; },
    land(f, kg) { me.jerk = 0; me.tension = 0; me.lean = 0; const big = f.rarity === 'rare' || f.rarity === 'legendary'; run(landIt(f, big)); },
    escape() { me.jerk = 0; me.tension = 0; me.lean = 0; run(shrug()); },
    lose() { me.jerk = 0; me.tension = 0; me.lean = 0; run(pulledIn()); },
    // a box around him and his camp in world space, for knowing where the mouse may touch him
    bounds(out = new THREE.Box3()) { out.makeEmpty(); if (root.visible) out.expandByObject(model); out.expandByObject(chair); out.expandByObject(cooler); return out; },
    update(dt, t) {
      me.t = t; if (!me.visible) return;
      if (me.task) { const r = me.task.next(dt); if (r.done) me.task = null; }
      root.position.set(me.pos.x, me.fall ? me.fall.y : 0, me.pos.z); root.rotation.set(me.spin ? -me.spin * 0.3 : 0, me.yaw, 0);
      const lift = SEAT_LIFT * me.sitK, push = me.backPush * me.sitK, fwd = dirOf(YAW, v3);
      root.position.y += lift; root.position.addScaledVector(fwd, push);
      // a little old-man waddle and bounce in time with his steps, and a soft squash when he drops into his chair
      const a = ch.slots.all, clip = a?.getClip().name;
      if (a && (clip === 'Walk_Loop' || clip === 'Jog_Fwd_Loop') && a.getEffectiveWeight() > 0.5) {
        const ph = (a.time / a.getClip().duration) * Math.PI * 2, k = clip === 'Jog_Fwd_Loop' ? 1.4 : 1;
        root.rotation.z = Math.sin(ph) * 0.055 * k; root.position.y += Math.abs(Math.sin(ph)) * 0.022 * k;
      }
      me.squash = Math.max(0, (me.squash || 0) - dt * 3.2); const q = Math.sin(me.squash * Math.PI) * 0.5 + me.squash * 0.5;
      root.scale.set(S * (1 + 0.035 * q), S * (1 - 0.07 * q), S * (1 + 0.035 * q));
      root.updateMatrixWorld(true);
      ch.update(dt);
      if (lift > 0.002 || push > 0.002) { const sh = new THREE.Vector3(0, -lift, 0).addScaledVector(dirOf(YAW, v1), -push); for (const L of legs) legIK(L, sh, me.sitK); }
      if (me.doze > 0) turnBone(head, leftOf(me.yaw, v3).negate(), -me.doze * 0.42);
      if (me.twist) for (const b of spine) turnBone(b, up, me.twist * 0.07);
      if (me.lean) turnBone(spine[0], leftOf(me.yaw, v3).negate(), me.lean * 0.3);       // leaning back against the pull
      manShadow.visible = root.visible && !me.fall && me.phase !== 'seated' && me.phase !== 'fight';
      manShadow.position.set(me.pos.x, 0.004, me.pos.z);
      placeRod(); placeLine(dt); placeCan(); me.fly?.(dt); me.puff?.(dt);
      // his back against the backrest: slide forward on the seat as far as it needs (quick to push, slow to settle back)
      const want = me.sitK > 0.3 ? THREE.MathUtils.clamp(me.backPush + backGap(), 0, 0.12) : 0;
      me.backPush += (want - me.backPush) * Math.min(1, dt * (want > me.backPush ? 14 : 3));
    },
  });
}
