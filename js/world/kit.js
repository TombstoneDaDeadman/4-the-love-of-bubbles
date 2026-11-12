// Small modelling kit: cached materials, primitive helpers, procedural textures and the
// product mesh families (jar / tub / soap bar / boxes) used everywhere in the world.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts }));
  }
  return matCache.get(key);
}

export const PAL = {
  wood: '#c99866', woodDark: '#8d5f3c', woodLight: '#e3bf92', cream: '#fbf3e4', white: '#ffffff',
  wall: '#f3e6d6', wallAccent: '#cfe0d2', sage: '#8fb9a0', blush: '#e98fa5', teal: '#6fb8b4',
  metal: '#c9ccd1', dark: '#3d3531', cardboard: '#c9a06c', cardboardDark: '#a98150', kraft: '#d6b78c',
  gold: '#e2a93b', leaf: '#5fa46b', leafDark: '#3f7d52', terracotta: '#c8744f',
};

function shadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  return mesh;
}
export function box(w, h, d, material, r = 0) {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
  return shadow(new THREE.Mesh(geo, material));
}
export function cyl(rt, rb, h, material, seg = 24) {
  return shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material));
}
export function sphere(r, material, seg = 20) {
  return shadow(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7))), material));
}
export function capsule(r, len, material) {
  return shadow(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), material));
}
export function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
export function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

// ---- Procedural textures ----------------------------------------------------

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function prng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

export function woodFloorTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const rnd = prng(7);
    const rows = 8, ph = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * 300;
      while (x < w) {
        const len = 260 + rnd() * 240;
        const tone = 0.9 + rnd() * 0.2;
        g.fillStyle = `rgb(${Math.round(214 * tone)},${Math.round(170 * tone)},${Math.round(122 * tone)})`;
        g.fillRect(x, r * ph, len, ph);
        g.globalAlpha = 0.07;
        for (let i = 0; i < 9; i++) {
          g.fillStyle = rnd() > 0.5 ? '#7a5230' : '#fff2d8';
          g.fillRect(x, r * ph + rnd() * ph, len, 1 + rnd() * 2);
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(90,58,30,0.35)';
        g.fillRect(x + len - 2, r * ph, 2, ph);
        x += len;
      }
      g.fillStyle = 'rgba(90,58,30,0.4)';
      g.fillRect(0, r * ph, w, 2);
    }
  }, [2, 2]);
}

export function tileTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e9e2d6'; g.fillRect(0, 0, w, h);
    const rnd = prng(3);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const t = 0.96 + rnd() * 0.06;
      g.fillStyle = `rgb(${250 * t},${246 * t},${238 * t})`;
      g.fillRect(x * 64 + 2 + (y % 2 ? 0 : 0), y * 64 + 2, 60, 60);
    }
  }, [6, 1.2]);
}

export function rugTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const rings = [['#f4e3d0', 256], ['#e7a3b3', 244], ['#f8efe2', 214], ['#9cc3ab', 190], ['#f8efe2', 160], ['#eebfc9', 138], ['#fbf5ea', 96]];
    for (const [col, r] of rings) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.setLineDash([6, 10]);
    for (const r of [228, 176, 118]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  });
}

export function signTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#fdf8ef'; g.fillRect(0, 0, w, h);
    // bubbles
    const rnd = prng(11);
    for (let i = 0; i < 16; i++) {
      const x = rnd() * w, y = rnd() * h, r = 14 + rnd() * 38;
      g.strokeStyle = `rgba(${i % 2 ? '233,143,165' : '111,184,180'},0.45)`; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, r * 0.65, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#d96f8c'; g.font = 'italic 700 250px Georgia, serif';
    g.fillText('4', 190, 250);
    g.fillStyle = '#4a3728'; g.font = '600 78px Georgia, serif';
    g.fillText('the love of', 610, 170);
    g.fillStyle = '#3f9d98'; g.font = 'italic 700 150px Georgia, serif';
    g.fillText('Bubbles', 610, 300);
    g.fillStyle = '#9a8572'; g.font = '500 34px Georgia, serif';
    g.fillText('H A N D M A D E   B A T H   &   B O D Y', 512, 440);
  });
}

export function screenTexture() {
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#fdf8ef'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e98fa5'; g.fillRect(0, 0, w, 26);
    g.fillStyle = '#6fb8b4';
    [[16, 40, 90, 46], [16, 96, 90, 46]].forEach(([x, y, a, b]) => g.fillRect(x, y, a, b));
    g.fillStyle = '#e8dccb';
    for (let i = 0; i < 6; i++) g.fillRect(122, 42 + i * 18, 110 - (i % 3) * 22, 9);
  });
}

// ---- Product mesh families --------------------------------------------------

const G = {
  jar: new THREE.CylinderGeometry(0.05, 0.05, 0.08, 18),
  jarLid: new THREE.CylinderGeometry(0.053, 0.053, 0.022, 18),
  jarLabel: new THREE.CylinderGeometry(0.0515, 0.0515, 0.04, 18, 1, true),
  tub: new THREE.CylinderGeometry(0.06, 0.052, 0.06, 18),
  tubLid: new THREE.CylinderGeometry(0.064, 0.064, 0.016, 18),
  bar: new RoundedBoxGeometry(0.115, 0.042, 0.075, 2, 0.012),
  barBand: new THREE.BoxGeometry(0.05, 0.046, 0.079),
};

// A single sellable unit, sitting on y = 0.
export function productMesh(container, color, accent) {
  const g = new THREE.Group();
  if (container === 'jar') {
    g.add(at(shadow(new THREE.Mesh(G.jar, mat(color, { roughness: 0.3 }))), 0, 0.04, 0));
    g.add(at(shadow(new THREE.Mesh(G.jarLabel, mat(PAL.cream, { roughness: 0.9 }))), 0, 0.04, 0));
    g.add(at(shadow(new THREE.Mesh(G.jarLid, mat(accent, { roughness: 0.45, metalness: 0.25 }))), 0, 0.09, 0));
  } else if (container === 'tub') {
    g.add(at(shadow(new THREE.Mesh(G.tub, mat(color, { roughness: 0.35 }))), 0, 0.03, 0));
    g.add(at(shadow(new THREE.Mesh(G.tubLid, mat(PAL.kraft, { roughness: 0.85 }))), 0, 0.067, 0));
    g.add(at(shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 14), mat(accent))), 0, 0.077, 0));
  } else {
    g.add(at(shadow(new THREE.Mesh(G.bar, mat(color, { roughness: 0.6 }))), 0, 0.021, 0));
    g.add(at(shadow(new THREE.Mesh(G.barBand, mat(PAL.kraft, { roughness: 0.9 }))), 0, 0.021, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.002, 0.03), mat(accent)), 0, 0.045, 0));
  }
  g.scale.setScalar(1.35);
  return g;
}

export function cardboardBox(w = 0.4, h = 0.3, d = 0.3, taped = true) {
  const g = new THREE.Group();
  g.add(at(box(w, h, d, mat(PAL.cardboard, { roughness: 0.95 })), 0, h / 2, 0));
  if (taped) {
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, 0.004, d + 0.004), mat('#efe4cf', { roughness: 0.6 })), 0, h + 0.001, 0));
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.34, h * 0.4), mat(PAL.blush, { roughness: 0.9 }));
    lbl.position.set(w * 0.2, h * 0.55, d / 2 + 0.002);
    g.add(lbl);
  }
  return g;
}

export function crate(w = 0.36, h = 0.2, d = 0.26) {
  const g = new THREE.Group();
  const m = mat(PAL.woodLight, { roughness: 0.9 });
  g.add(at(box(w, 0.02, d, m), 0, 0.01, 0));
  for (const s of [-1, 1]) {
    g.add(at(box(w, h, 0.02, m), 0, h / 2, (s * d) / 2));
    g.add(at(box(0.02, h, d, m), (s * w) / 2, h / 2, 0));
  }
  return g;
}

export function plant(scale = 1) {
  const g = new THREE.Group();
  g.add(at(cyl(0.16, 0.12, 0.26, mat(PAL.terracotta, { roughness: 0.9 })), 0, 0.13, 0));
  g.add(at(cyl(0.145, 0.145, 0.02, mat('#4a3a2c')), 0, 0.255, 0));
  const rnd = prng(5);
  for (let i = 0; i < 9; i++) {
    const leaf = sphere(0.11, mat(i % 2 ? PAL.leaf : PAL.leafDark, { roughness: 0.7 }), 10);
    const a = (i / 9) * Math.PI * 2, r = 0.08 + rnd() * 0.1, y = 0.42 + rnd() * 0.42;
    leaf.scale.set(0.55, 1.5, 0.3);
    leaf.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    leaf.rotation.set((rnd() - 0.5) * 0.9, a, (rnd() - 0.5) * 0.9);
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

export function setShadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}
