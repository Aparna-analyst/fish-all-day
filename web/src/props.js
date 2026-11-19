// His things on the jetty, drawn in code until the Lux3D models are made: a low folding camp chair and a cooler.
import * as THREE from 'three';

export const ROD_LEN = 2.1;
const mat = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

// a low camp chair, seat 0.23 m up, facing -Z (the sitter looks the way -Z points)
export function makeChair() {
  const g = new THREE.Group(), cloth = mat('#3f7a4a', 0.9), frame = mat('#2c2a27', 0.5, 0.5);
  const W = 0.54, D = 0.44, H = 0.23;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), cloth); seat.position.y = H; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, 0.03), cloth); back.position.set(0, H + 0.25, D / 2 + 0.03); back.rotation.x = -0.22; g.add(back);
  const tube = (a, b, r = 0.012) => {
    const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), frame);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m); return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.01);
    tube(V(x, 0, -D / 2), V(x, H, D / 2)); tube(V(x, 0, D / 2), V(x, H, -D / 2));            // the crossed legs
    tube(V(x, H, -D / 2), V(x, H + 0.15, -D / 2 + 0.02)); tube(V(x, H, D / 2), V(x, H + 0.55, D / 2 + 0.14));
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, D * 0.9), cloth); arm.position.set(x, H + 0.16, 0.02); g.add(arm);
  }
  const cup = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 14), frame); cup.rotation.x = Math.PI / 2; cup.position.set(W / 2 + 0.06, H + 0.16, -0.12); g.add(cup);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeCooler() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.5), mat('#4f9fd8', 0.6)); body.position.y = 0.15; g.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.52), mat('#f4f1ea', 0.6)); lid.position.y = 0.33; g.add(lid);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), mat('#f4f1ea', 0.6)); handle.position.set(0, 0.36, 0); handle.rotation.y = Math.PI / 2; g.add(handle);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// the rod, in a cork handle, a reel underneath and a blank in five links that can bend toward the line (butt at 0, along +Y)
export function makeRod() {
  const g = new THREE.Group();
  const blank = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.45, metalness: 0.2 });
  const cork = new THREE.MeshStandardMaterial({ color: '#c79a62', roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c9c3b8', roughness: 0.35, metalness: 0.8 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.42, 10), cork); handle.position.y = 0.21; g.add(handle);
  const reel = new THREE.Group(); reel.position.set(0, 0.36, -0.05);
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.035, 16), metal); spool.rotation.z = Math.PI / 2; reel.add(spool);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.05), metal); foot.position.z = 0.025; reel.add(foot);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8), cork); knob.rotation.z = Math.PI / 2; knob.position.set(0.03, 0.025, 0); reel.add(knob);
  g.add(reel); g.userData.reel = reel;
  // the blank in five links that can bend toward the line
  let parent = g, y0 = 0.42; const n = 5, segLen = (ROD_LEN - 0.42) / n; g.userData.links = [];
  for (let i = 0; i < n; i++) {
    const link = new THREE.Group(); link.position.y = i === 0 ? y0 : segLen; parent.add(link);
    const r0 = 0.014 * (1 - i / n) + 0.003, r1 = 0.014 * (1 - (i + 1) / n) + 0.003;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segLen, 7), blank); m.position.y = segLen / 2; link.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012 * (1 - i / n) + 0.006, 0.0025, 5, 10), metal); ring.position.set(0, segLen * 0.9, -0.018); link.add(ring);
    g.userData.links.push(link); parent = link;
  }
  const tip = new THREE.Object3D(); tip.position.y = segLen; parent.add(tip); g.userData.tip = tip;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makeBobber() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff5a36', roughness: 0.5 }));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#fbf6ee', roughness: 0.5 }));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), new THREE.MeshStandardMaterial({ color: '#ff5a36' })); stick.position.y = 0.1;
  g.add(top, bot, stick); return g;
}

export function makeCan() {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#2f8a5b'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#f2d16b'; x.fillRect(0, 22, 128, 18); x.fillStyle = '#fff8ec'; x.fillRect(0, 27, 128, 3);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.15, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.4 }));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.012, 16), new THREE.MeshStandardMaterial({ color: '#cfd3d6', roughness: 0.3, metalness: 0.9 })); lid.position.y = 0.081;
  g.add(body, lid); g.scale.setScalar(1.25); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
