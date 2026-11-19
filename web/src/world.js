// The lakeside: land, lake, sky, trees, reeds, lily pads, the jetty, and the light of the hour.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { fbm, noise2, rng } from './noise.js';

export const LAKE = { cx: 0, cz: -46, rx: 62, rz: 44 };
export const DECK_Y = 0.55;                      // top of the jetty's planks
export const JETTY = { x: 0, z0: 1.6, z1: -9.4, w: 1.7 };
export const SPOT = { chair: new THREE.Vector3(0, DECK_Y, -8.0), bobber: new THREE.Vector3(-0.9, 0, -14.2) };
// the footpath he walks in on, from the trees down to the foot of the jetty
export const PATH = [[17, 19], [12.5, 13.5], [8.5, 9.2], [5, 5.6], [2.4, 3.2], [0.6, 2.1], [0, 1.4]];

function lakeD(x, z) { return Math.hypot((x - LAKE.cx) / LAKE.rx, (z - LAKE.cz) / LAKE.rz); }
function pathDist(x, z) {
  let best = 1e9;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
export function heightAt(x, z) {
  const s = lakeD(x, z) - 1;
  let h;
  if (s < 0) h = Math.max(-2.6, 0.32 + s * 9);
  else {
    const hills = fbm(x * 0.018 + 3, z * 0.018 - 7, 4);
    h = 0.32 + s * 2.2 + Math.pow(Math.min(1, s / 0.9), 1.6) * (hills * 22 - 4);
  }
  h += (fbm(x * 0.21, z * 0.21, 2) - 0.5) * 0.35;
  const p = pathDist(x, z);                          // the path is trodden a little lower and smoother
  if (p < 1.6 && s > -0.04) h -= (1 - p / 1.6) * 0.12;
  return h;
}

const col = (h) => new THREE.Color(h);
function landColour(x, z, h, out) {
  const p = pathDist(x, z), n = noise2(x * 0.35, z * 0.35), n2 = fbm(x * 0.06, z * 0.06, 3);
  const grassA = col('#7fae45'), grassB = col('#5d9136'), grassDark = col('#3f6f2d'), sand = col('#c9b07a'), mud = col('#6b5a3e'), dirt = col('#a8835a');
  if (h < -0.25) out.copy(mud).lerp(col('#3d4a33'), Math.min(1, -h / 2));
  else if (h < 0.55) out.copy(sand).lerp(grassA, Math.max(0, (h - 0.2) / 0.35)).lerp(mud, Math.max(0, 0.25 - h) * 1.5);
  else out.copy(grassA).lerp(grassB, n * 0.8).lerp(grassDark, Math.min(1, Math.max(0, (h - 3) / 9)) * 0.8 + n2 * 0.15);
  if (p < 1.25 && h > -0.1) out.lerp(dirt, Math.min(1, (1.25 - p) / 0.6) * 0.92);
  return out;
}

function sky() {
  const u = { top: { value: col('#5a7fc4') }, hor: { value: col('#ffc888') }, sunDir: { value: new THREE.Vector3(0, 0.1, -1) },
    sunCol: { value: col('#fff1c4') }, stars: { value: 0 }, sunSize: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: u, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float stars, sunSize; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main(){
        vec3 d = normalize(vDir); float y = max(d.y, 0.0);
        vec3 c = mix(hor, top, pow(y, 0.55));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 900.0 / sunSize) * 3.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
        if (stars > 0.0) { vec2 g = floor(d.xz / (d.y + 0.35) * 260.0); float r = h21(g); c += vec3(step(0.9975, r) * stars * y * (0.6 + 0.4 * sin(r * 300.0))); }
        if (d.y < 0.0) c = mix(hor, hor * 0.8, min(-d.y * 4.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), m);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return { mesh, u };
}

const WATER_SHADER = {
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    time: { value: 0 }, deep: { value: col('#1f5a5e') }, shallow: { value: col('#5e8f6a') }, sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
    sunCol: { value: col('#ffe2a8') }, camPos: { value: new THREE.Vector3() }, fogCol: { value: col('#ffc888') },
    ripples: { value: [new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0)] },
    lakeC: { value: new THREE.Vector2(LAKE.cx, LAKE.cz) }, lakeR: { value: new THREE.Vector2(LAKE.rx, LAKE.rz) }, reflectAmt: { value: 0.85 },
  },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
    void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, reflectAmt; uniform vec3 deep, shallow, sunDir, sunCol, camPos, fogCol;
    uniform vec4 ripples[4]; uniform vec2 lakeC, lakeR; varying vec4 vUv; varying vec3 vWorld;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 p = vWorld.xz;
      vec2 w = vec2(n(p*0.55 + vec2(time*0.06, time*0.035)), n(p*0.55 + vec2(-time*0.045, time*0.05) + 7.0)) - 0.5;
      w += 0.5 * (vec2(n(p*1.9 - time*0.09), n(p*1.9 + 13.0 + time*0.08)) - 0.5);
      float ring = 0.0; vec2 push = vec2(0.0);
      for (int i = 0; i < 4; i++) {
        vec4 r = ripples[i]; float age = time - r.z; if (age < 0.0 || age > 5.0) continue;
        vec2 dv = p - r.xy; float d = length(dv); float front = age * 1.1;
        float k = sin((d - front) * 9.0) * exp(-abs(d - front) * 2.6) * exp(-age * 0.75) * r.w;
        ring += max(k, 0.0); push += normalize(dv + 1e-4) * k;
      }
      float calm = mix(0.35, 1.0, smoothstep(6.0, 40.0, length(vWorld.xz - camPos.xz)));
      vec2 dist = w * 0.014 * calm + push * 0.025;
      vec4 uv = vUv; uv.xy += dist * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      vec3 V = normalize(camPos - vWorld);
      float fres = mix(0.35, 1.0, pow(1.0 - max(V.y, 0.0), 2.5));
      float dd = length((p - lakeC) / lakeR);
      vec3 base = mix(deep, shallow, smoothstep(0.72, 1.0, dd));
      vec3 c = mix(base, refl, fres * reflectAmt);
      vec3 N = normalize(vec3(-dist.x * 9.0, 1.0, -dist.y * 9.0));
      vec3 H = normalize(V + normalize(sunDir));
      c += sunCol * pow(max(dot(N, H), 0.0), 220.0) * 2.2;
      c += vec3(0.9, 0.95, 1.0) * ring * 0.18;
      c = mix(c, fogCol, smoothstep(70.0, 330.0, length(vWorld - camPos)) * 0.85);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

function terrain() {
  const size = 380, seg = 260;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2); g.translate(0, 0, -46);
  const pos = g.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = heightAt(x, z); pos.setY(i, y);
    landColour(x, z, y, c); colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  m.receiveShadow = true; return m;
}

function mountains() {
  const grp = new THREE.Group(), r = rng(7);
  const mats = [col('#7d8fb3'), col('#93a3c2'), col('#a9b6cf')].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.2 + ring, R = 230 + ring * 70 + r() * 30;
    const hgt = 30 + r() * 45 + ring * 18, geo = new THREE.ConeGeometry(30 + r() * 30 + ring * 10, hgt, 6 + Math.floor(r() * 3), 1);
    const m = new THREE.Mesh(geo, mats[ring]); m.position.set(Math.cos(a) * R, hgt / 2 - 6, LAKE.cz + Math.sin(a) * R); m.rotation.y = r() * 3;
    m.scale.z = 0.6 + r() * 0.5; grp.add(m);
  }
  return grp;
}

// trees, reeds, lily pads, grass tufts and stones as instanced shapes (stand-ins until the Lux3D ones arrive)
function scatter(scene) {
  const r = rng(42), dummy = new THREE.Object3D(), keep = [];
  const clear = (x, z) => Math.abs(x) < 2.6 && z < 3.5 && z > -11 || Math.hypot(x - 4.6, z - 4.8) < 6 || pathDist(x, z) < 1.8;
  // pines
  const pineTier = new THREE.ConeGeometry(1, 1.4, 12, 2); pineTier.translate(0, 0.7, 0);
  const pineMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 1 });
  const birchTrunkMat = new THREE.MeshStandardMaterial({ color: '#eae4d6', roughness: 0.9 });
  const blob = new THREE.IcosahedronGeometry(1, 3), birchMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
  const N = 520, pines = new THREE.InstancedMesh(pineTier, pineMat, N * 3), trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
  const bt = new THREE.InstancedMesh(trunkGeo, birchTrunkMat, 160), bc = new THREE.InstancedMesh(blob, birchMat, 160 * 3);
  let pi = 0, ti = 0, bi = 0, ci = 0, tries = 0;
  while ((ti < N || bi < 160) && tries++ < 20000) {
    const a = r() * Math.PI * 2, d = 1.06 + Math.pow(r(), 1.3) * 2.6;
    const x = LAKE.cx + Math.cos(a) * LAKE.rx * d, z = LAKE.cz + Math.sin(a) * LAKE.rz * d;
    if (clear(x, z) || z > 40) continue;
    const y = heightAt(x, z); if (y < 0.5) continue;
    const birch = r() < 0.22 && bi < 160 && d < 1.9;
    if (birch) {
      const s = 0.8 + r() * 0.6, th = 4.2 * s;
      dummy.position.set(x, y - 0.1, z); dummy.rotation.set(0, r() * 6, (r() - 0.5) * 0.08); dummy.scale.set(s * 0.9, th, s * 0.9); dummy.updateMatrix(); bt.setMatrixAt(bi++, dummy.matrix);
      for (let k = 0; k < 3; k++) { dummy.position.set(x + (r() - 0.5) * 1.2 * s, y + th * (0.75 + k * 0.12), z + (r() - 0.5) * 1.2 * s);
        dummy.rotation.set(r(), r(), r()); const b = (1.1 + r() * 0.5) * s; dummy.scale.set(b, b * 0.85, b); dummy.updateMatrix(); bc.setMatrixAt(ci++, dummy.matrix); }
    } else if (ti < N) {
      const s = 0.9 + r() * 1.1, hgt = 5.5 * s;
      dummy.position.set(x, y - 0.1, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(s, 1.6 * s, s); dummy.updateMatrix(); trunks.setMatrixAt(ti++, dummy.matrix);
      for (let k = 0; k < 3; k++) { const w = (1.6 - k * 0.42) * s; dummy.position.set(x, y + 1.2 * s + k * 1.25 * s, z); dummy.rotation.set(0, r() * 6, 0);
        dummy.scale.set(w, hgt * 0.36, w); dummy.updateMatrix(); pines.setMatrixAt(pi++, dummy.matrix); }
    }
  }
  pines.count = pi; trunks.count = ti; bt.count = bi; bc.count = ci;
  for (const m of [pines, trunks, bt, bc]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  for (let i = 0; i < pi; i++) pines.setColorAt(i, new THREE.Color().setHSL(0.33 + r() * 0.05, 0.42 + r() * 0.12, 0.30 + r() * 0.08));
  for (let i = 0; i < ci; i++) bc.setColorAt(i, new THREE.Color().setHSL(0.21 + r() * 0.06, 0.5 + r() * 0.1, 0.46 + r() * 0.1));

  // reeds and cattails along the shore, thickest at the sides of the jetty and to the left
  const blade = new THREE.ConeGeometry(0.035, 1, 3); blade.translate(0, 0.5, 0);
  const head = new THREE.CapsuleGeometry(0.035, 0.16, 2, 6); const stalk = new THREE.CylinderGeometry(0.012, 0.016, 1, 3); stalk.translate(0, 0.5, 0);
  const reeds = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: '#6f9a3c', roughness: 0.9 }), 2600);
  const heads = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: '#6a4026', roughness: 0.8 }), 320);
  const stalks = new THREE.InstancedMesh(stalk, new THREE.MeshStandardMaterial({ color: '#7f9a46', roughness: 0.9 }), 320);
  let ri = 0, hi = 0;
  for (let c = 0; c < 70; c++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.4 + (c < 18 ? 0 : (r() - 0.5) * 2), cx = LAKE.cx + Math.cos(a) * LAKE.rx * (0.95 + r() * 0.06), cz = LAKE.cz - Math.sin(a) * LAKE.rz * (0.95 + r() * 0.06);
    if (Math.abs(cx) < 1.6 && cz > -10) continue;
    const near = Math.hypot(cx, cz) < 22, count = near ? 26 : 22;
    for (let k = 0; k < count && ri < 2600; k++) {
      const x = cx + (r() - 0.5) * 2.4, z = cz + (r() - 0.5) * 1.6; if (Math.abs(x) < 1.3 && z > -10 && z < 2.5) continue;
      if (Math.hypot(x - 4.6, z - 4.8) < 5.5 || (x > 0.8 && x < 6 && z > -4 && z < 3)) continue; const y = Math.max(heightAt(x, z), -0.4), hgt = 0.55 + r() * 0.85;
      dummy.position.set(x, y, z); dummy.rotation.set((r() - 0.5) * 0.35, r() * 6, (r() - 0.5) * 0.35); dummy.scale.set(1, hgt, 1); dummy.updateMatrix(); reeds.setMatrixAt(ri++, dummy.matrix);
      if (r() < 0.16 && hi < 320) { const sh = hgt * 1.25; dummy.scale.set(1, sh, 1); dummy.updateMatrix(); stalks.setMatrixAt(hi, dummy.matrix);
        dummy.position.y = y + sh * 0.92; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); heads.setMatrixAt(hi++, dummy.matrix); }
    }
  }
  reeds.count = ri; heads.count = hi; stalks.count = hi;
  for (let i = 0; i < ri; i++) reeds.setColorAt(i, new THREE.Color().setHSL(0.2 + r() * 0.06, 0.45, 0.32 + r() * 0.12));
  for (const m of [reeds, heads, stalks]) { m.castShadow = true; scene.add(m); }

  // lily pads, in clusters on the still water near the shore, a few with a pink flower
  const pad = new THREE.CircleGeometry(0.34, 18, 0.35, Math.PI * 2 - 0.5); pad.rotateX(-Math.PI / 2);
  const pads = new THREE.InstancedMesh(pad, new THREE.MeshStandardMaterial({ color: '#4f8a3a', roughness: 0.6, side: THREE.DoubleSide }), 300);
  const fl = new THREE.ConeGeometry(0.11, 0.14, 7, 1, true); fl.rotateX(Math.PI);
  const flowers = new THREE.InstancedMesh(fl, new THREE.MeshStandardMaterial({ color: '#f3a9c4', roughness: 0.6, side: THREE.DoubleSide, emissive: '#5a2030', emissiveIntensity: 0.15 }), 40);
  let li = 0, fi = 0;
  for (const [cx, cz, n] of [[-5.5, -6, 40], [-9, -9.5, 30], [4.2, -10.5, 22], [-3.2, -15.5, 16], [7.5, -6.5, 18], [-14, -4.8, 26], [12, -9, 20]]) {
    for (let k = 0; k < n && li < 300; k++) {
      const x = cx + (r() - 0.5) * 4.2, z = cz + (r() - 0.5) * 3; if (heightAt(x, z) > -0.08) continue; if (Math.abs(x) < 1.2 && z > -10) continue;
      const s = 0.6 + r() * 0.8; dummy.position.set(x, 0.012 + r() * 0.004, z); dummy.rotation.set(0, r() * 6.28, 0); dummy.scale.set(s, 1, s); dummy.updateMatrix(); pads.setMatrixAt(li++, dummy.matrix);
      if (r() < 0.14 && fi < 40) { dummy.position.y = 0.07; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); flowers.setMatrixAt(fi++, dummy.matrix); }
    }
  }
  pads.count = li; flowers.count = fi;
  for (let i = 0; i < li; i++) pads.setColorAt(i, new THREE.Color().setHSL(0.26 + r() * 0.05, 0.5, 0.38 + r() * 0.1));
  pads.receiveShadow = true; scene.add(pads, flowers);

  // grass tufts and pebbles near the path and the shore where the camera looks
  const tuft = new THREE.ConeGeometry(0.06, 0.45, 3); tuft.translate(0, 0.22, 0);
  const tufts = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: '#7eaa45', roughness: 1 }), 3500);
  const pebble = new THREE.DodecahedronGeometry(0.12, 0);
  const pebbles = new THREE.InstancedMesh(pebble, new THREE.MeshStandardMaterial({ color: '#9a9488', roughness: 0.9, flatShading: true }), 160);
  let gi = 0, si = 0;
  for (let k = 0; k < 9000 && gi < 3500; k++) {
    const x = (r() - 0.5) * 50, z = -12 + r() * 40, y = heightAt(x, z);
    if (y < 0.45 || pathDist(x, z) < 0.9 || (Math.abs(x) < 1.1 && z < 2)) continue;
    dummy.position.set(x, y - 0.02, z); dummy.rotation.set((r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5); const s = 0.6 + r() * 1.1; dummy.scale.set(s, s * (0.8 + r()), s); dummy.updateMatrix();
    tufts.setMatrixAt(gi, dummy.matrix); tufts.setColorAt(gi++, new THREE.Color().setHSL(0.22 + r() * 0.06, 0.45, 0.33 + r() * 0.14));
  }
  for (let k = 0; k < 800 && si < 160; k++) {
    const x = (r() - 0.5) * 30, z = -6 + r() * 26, p = pathDist(x, z), y = heightAt(x, z);
    if (!(p > 0.9 && p < 1.6) && !(y > 0.05 && y < 0.5)) continue;
    const s = 0.5 + r() * 1.3; dummy.position.set(x, y + 0.02, z); dummy.rotation.set(r() * 3, r() * 3, r() * 3); dummy.scale.set(s, s * 0.6, s); dummy.updateMatrix(); pebbles.setMatrixAt(si++, dummy.matrix);
  }
  tufts.count = gi; pebbles.count = si; tufts.receiveShadow = true; pebbles.castShadow = true; scene.add(tufts, pebbles);
  // a few big rocks on the shore
  const rockMat = new THREE.MeshStandardMaterial({ color: '#8d877b', roughness: 0.95, flatShading: true });
  for (const [x, z, s] of [[-6.5, -1.8, 0.9], [-7.4, -1.2, 0.5], [6.8, -2.4, 0.7], [-11, -3.6, 1.3], [10.5, -3.8, 1.0]]) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat); m.position.set(x, heightAt(x, z) + s * 0.25, z); m.scale.y = 0.62; m.rotation.y = x;
    m.castShadow = m.receiveShadow = true; scene.add(m);
  }
}

function jetty() {
  const g = new THREE.Group(), r = rng(3);
  const plankMat = new THREE.MeshStandardMaterial({ color: '#8a6a49', roughness: 0.9 });
  const postMat = new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.95 });
  const len = JETTY.z0 - JETTY.z1, n = Math.round(len / 0.32);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(JETTY.w * (0.97 + r() * 0.06), 0.07, 0.29), plankMat.clone());
    p.material.color.offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.08);
    p.position.set((r() - 0.5) * 0.05, DECK_Y - 0.035 + (r() - 0.5) * 0.01, JETTY.z0 - 0.16 - i * (len / n)); p.rotation.y = (r() - 0.5) * 0.02;
    p.castShadow = p.receiveShadow = true; g.add(p);
  }
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, len), postMat); beam.position.set(side * (JETTY.w / 2 - 0.12), DECK_Y - 0.15, (JETTY.z0 + JETTY.z1) / 2); g.add(beam);
    for (let z = JETTY.z0 - 0.4; z > JETTY.z1 - 0.2; z -= 2.6) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 2.6, 8), postMat); post.position.set(side * (JETTY.w / 2), DECK_Y - 1.0, z); post.castShadow = true; g.add(post);
    }
    const tall = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 1.1, 8), postMat); tall.position.set(side * (JETTY.w / 2), DECK_Y + 0.25, JETTY.z1 + 0.15); tall.castShadow = true; g.add(tall);
  }
  return g;
}

// the light of every hour: [hour, sky top, horizon, sun colour, sun strength, ambient strength, elevation (deg), stars]
const HOURS = [
  [0, '#0a1330', '#1b2a4c', '#9db4ff', 0.28, 0.28, 40, 1],
  [5.2, '#14214a', '#3c3f66', '#ffb38a', 0.3, 0.3, -4, 0.7],
  [6.2, '#3d5592', '#f2a07a', '#ffc39a', 1.0, 0.55, 4, 0],
  [8, '#6aa1dc', '#f2dcb8', '#fff0d8', 2.2, 0.8, 22, 0],
  [12.5, '#4f97e2', '#cfe5f4', '#ffffff', 2.8, 0.95, 58, 0],
  [16.5, '#6496d6', '#f5dfb6', '#fff0d0', 2.4, 0.85, 30, 0],
  [18.3, '#6f86c4', '#ffc27e', '#ffd49a', 1.9, 0.7, 10, 0],
  [19.3, '#384a86', '#f58f5c', '#ffa070', 0.9, 0.48, 1, 0],
  [20.2, '#16234d', '#3a3a64', '#a7b8ff', 0.35, 0.32, 30, 0.6],
  [24, '#0a1330', '#1b2a4c', '#9db4ff', 0.28, 0.28, 40, 1],
];
function lightAt(hour) {
  let i = 0; while (i < HOURS.length - 2 && HOURS[i + 1][0] <= hour) i++;
  const a = HOURS[i], b = HOURS[i + 1], t = Math.min(1, Math.max(0, (hour - a[0]) / (b[0] - a[0])));
  const c = (k) => new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t), n = (k) => a[k] + (b[k] - a[k]) * t;
  return { top: c(1), hor: c(2), sun: c(3), sunI: n(4), amb: n(5), elev: n(6), stars: n(7), night: hour < 5.6 || hour > 19.9 };
}

export function buildWorld(scene, renderer) {
  const S = sky(); scene.add(S.mesh);
  scene.fog = new THREE.Fog('#ffc888', 90, 420);
  const land = terrain(); scene.add(land);
  scene.add(mountains());
  scatter(scene);
  scene.add(jetty());

  const waterGeo = new THREE.PlaneGeometry(LAKE.rx * 2.2, LAKE.rz * 2.3);
  const px = Math.min(devicePixelRatio, 1.5);
  const water = new Reflector(waterGeo, { clipBias: 0.002, textureWidth: innerWidth * px * 0.6, textureHeight: innerHeight * px * 0.6, color: 0xffffff, shader: WATER_SHADER });
  water.position.set(LAKE.cx, 0, LAKE.cz); water.rotation.x = -Math.PI / 2; scene.add(water);   // the mirror faces +Z in its own space
  const W = water.material.uniforms;

  const hemi = new THREE.HemisphereLight('#cfe3ff', '#7a8a4a', 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d0', 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 120 });
  sun.target.position.set(0, 0, -6); scene.add(sun, sun.target);

  let rippleI = 0;
  const api = {
    sunDir: new THREE.Vector3(),
    setHour(hour) {
      const L = lightAt(hour), el = THREE.MathUtils.degToRad(Math.max(L.elev, 2));
      const az = L.night ? -0.9 : THREE.MathUtils.degToRad(-25 + (hour - 12) * 9);      // the sun crosses the far side of the lake
      api.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
      S.u.top.value.copy(L.top); S.u.hor.value.copy(L.hor); S.u.sunDir.value.copy(api.sunDir); S.u.sunCol.value.copy(L.sun); S.u.stars.value = L.stars; S.u.sunSize.value = L.night ? 0.35 : 1;
      scene.fog.color.copy(L.hor).lerp(L.top, 0.25);
      sun.color.copy(L.sun); sun.intensity = L.sunI; sun.position.copy(api.sunDir).multiplyScalar(60).add(sun.target.position);
      hemi.intensity = L.amb * 1.45; hemi.color.copy(L.top).lerp(new THREE.Color('#ffffff'), 0.45); hemi.groundColor.set(L.night ? '#1a2233' : '#7a8a4a');
      W.sunDir.value.copy(api.sunDir); W.sunCol.value.copy(L.sun).multiplyScalar(L.night ? 0.5 : 1); W.fogCol.value.copy(scene.fog.color);
      W.deep.value.set(L.night ? '#0b2230' : '#1f5a5e'); W.shallow.value.set(L.night ? '#16303a' : '#5e8f6a');
      api.night = L.night; return L;
    },
    ripple(x, z, strength = 1, at) { W.ripples.value[rippleI++ % 4].set(x, z, at ?? W.time.value, strength); },
    update(t, camera) { W.time.value = t; W.camPos.value.copy(camera.position); },
    resize() { const p = Math.min(devicePixelRatio, 1.5); water.getRenderTarget().setSize(innerWidth * p * 0.6, innerHeight * p * 0.6); },
    get time() { return W.time.value; },
  };
  return api;
}
