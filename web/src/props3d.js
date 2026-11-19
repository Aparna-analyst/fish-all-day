// His things as Lux3D made them from the approved pictures: the striped chair, the blue cooler, the green can and a toy
// fish tinted per kind. Slimmed and sized by tools/slim_props.py. If a file will not load, the drawn props stand in.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadProps(base = './assets/props/') {
  const loader = new GLTFLoader();
  const get = (n) => loader.loadAsync(base + n + '.glb').then(g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g.scene;
  }).catch(() => null);
  const [chair, cooler, can, fish] = await Promise.all(['chair', 'cooler', 'can', 'fish'].map(get));
  const wrap = (m, f) => { const g = new THREE.Group(); const c = m.clone(); f?.(c); g.add(c); return g; };
  return {
    chair: chair && (() => wrap(chair, c => { c.rotation.y = Math.PI; })),        // made facing +Z; the drawn one faced -Z
    cooler: cooler && (() => wrap(cooler)),
    can: can && (() => wrap(can)),
    // a fish of the given colour: shares the shapes and the picture, owns only its tinted material
    fish: fish && ((colour) => { const g = wrap(fish, c => { c.scale.setScalar(1.2); c.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(colour); } }); });
      g.userData.shared = true; return g; }),
  };
}
