// Small modelling kit: cached materials, primitive helpers, procedural textures and the
// product mesh families (jar / tub / soap bar / boxes) used everywhere in the world.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, envMapIntensity: 0.5, ...opts }));
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

// Printed product label: cream stock, a coloured band and the brand's "4" mark, repeated
// around the jar. One material per accent colour.
const labelCache = new Map();
export function labelMaterial(accent) {
  if (!labelCache.has(accent)) {
    const tex = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#fdf8ef'; g.fillRect(0, 0, w, h);
      g.fillStyle = accent; g.fillRect(0, 0, w, 9); g.fillRect(0, h - 9, w, 9);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 2; i++) {
        const cx = 64 + i * 128;
        g.fillStyle = accent; g.beginPath(); g.arc(cx, 32, 17, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fffaf2'; g.font = 'italic 700 26px Georgia, serif'; g.fillText('4', cx - 1, 33);
        g.fillStyle = '#b9a58f'; g.fillRect(cx + 26, 25, 30, 3); g.fillRect(cx + 26, 33, 22, 3); g.fillRect(cx - 56, 25, 30, 3); g.fillRect(cx - 48, 33, 22, 3);
      }
    });
    labelCache.set(accent, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, envMapIntensity: 0.4 }));
  }
  return labelCache.get(accent);
}

// Soft painted plaster with a faint botanical sprig pattern.
export function wallTexture(base = '#f6ead9', dot = 'rgba(214,190,160,0.35)') {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const rnd = prng(21);
    g.globalAlpha = 0.05;
    for (let i = 0; i < 900; i++) { g.fillStyle = rnd() > 0.5 ? '#ffffff' : '#b39a7c'; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 1 + rnd() * 2); }
    g.globalAlpha = 1;
    g.fillStyle = dot;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const px = x * 64 + (y % 2 ? 32 : 0) + 16, py = y * 64 + 16;
      g.beginPath(); g.arc(px, py, 3.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(px + 7, py - 5, 5, 2.2, -0.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(px - 7, py - 5, 5, 2.2, 0.6, 0, Math.PI * 2); g.fill();
    }
  }, [5, 2]);
}

// What you see out of the window: sky, soft hills, a couple of trees.
export function outsideTexture() {
  return canvasTex(512, 320, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#a9dcf5'); sky.addColorStop(0.6, '#e3f4fb'); sky.addColorStop(1, '#fdf6e4');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    [[90, 70, 34], [130, 62, 44], [175, 74, 30], [360, 100, 30], [400, 92, 40], [440, 104, 26]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#b9dcae'; g.beginPath(); g.ellipse(140, 330, 300, 130, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9fcf98'; g.beginPath(); g.ellipse(430, 340, 260, 120, 0, 0, Math.PI * 2); g.fill();
    for (const [x, y, r] of [[70, 215, 46], [455, 205, 54], [300, 240, 30]]) {
      g.fillStyle = '#8a6a4a'; g.fillRect(x - 5, y, 10, 70);
      g.fillStyle = '#6fb27a'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#86c48d'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.6, 0, Math.PI * 2); g.fill();
    }
  });
}

// Ground: warm centre fading out to nothing so the diorama has no hard horizon.
export function groundTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(226,206,180,1)'); r.addColorStop(0.5, 'rgba(238,221,200,1)'); r.addColorStop(1, 'rgba(247,231,218,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

// ---- Sprite textures (soft, cheap particles) ----------------------------------
const spriteTex = (draw) => canvasTex(128, 128, draw);
let spriteSet = null;
export function sprites() {
  if (spriteSet) return spriteSet;
  spriteSet = {
    soft: spriteTex((g) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    }),
    bubble: spriteTex((g) => {
      const r = g.createRadialGradient(64, 64, 30, 64, 64, 60);
      r.addColorStop(0, 'rgba(255,255,255,0.03)'); r.addColorStop(0.78, 'rgba(255,240,246,0.22)'); r.addColorStop(0.93, 'rgba(255,255,255,0.85)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(160,225,220,0.55)'; g.beginPath(); g.arc(64, 64, 55, 0.3, 1.9); g.stroke();
      g.strokeStyle = 'rgba(245,160,185,0.55)'; g.beginPath(); g.arc(64, 64, 55, 3.4, 5.0); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.arc(64, 64, 42, Math.PI * 1.12, Math.PI * 1.4); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(88, 90, 5, 0, Math.PI * 2); g.fill();
    }),
    spark: spriteTex((g) => {
      g.translate(64, 64); g.fillStyle = '#ffffff';
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 9 : 60; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
      const r = g.createRadialGradient(0, 0, 0, 0, 0, 40);
      r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(-64, -64, 128, 128);
    }),
    coin: spriteTex((g) => {
      g.fillStyle = '#c98a1a'; g.beginPath(); g.arc(64, 66, 52, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f5c443'; g.beginPath(); g.arc(64, 60, 52, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fbdc7a'; g.beginPath(); g.arc(64, 60, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c98a1a'; g.font = '700 56px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 64, 63);
    }),
  };
  return spriteSet;
}
export function sprite(tex, size = 0.2, opts = {}) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, ...opts }));
  s.scale.set(size, size, size);
  return s;
}

// ---- Product mesh families --------------------------------------------------

const G = {
  jar: new THREE.CylinderGeometry(0.05, 0.05, 0.08, 18),
  jarLid: new THREE.CylinderGeometry(0.053, 0.053, 0.022, 18),
  jarLabel: new THREE.CylinderGeometry(0.0515, 0.0515, 0.04, 18, 1, true),
  tub: new THREE.CylinderGeometry(0.06, 0.052, 0.06, 18),
  tubLid: new THREE.CylinderGeometry(0.064, 0.064, 0.016, 18),
  tubLabel: new THREE.CylinderGeometry(0.0612, 0.0548, 0.036, 18, 1, true),
  bar: new RoundedBoxGeometry(0.115, 0.042, 0.075, 2, 0.012),
  barBand: new THREE.BoxGeometry(0.05, 0.046, 0.079),
  bottle: new THREE.CylinderGeometry(0.032, 0.036, 0.11, 16),
  bottleLabel: new THREE.CylinderGeometry(0.0365, 0.0365, 0.05, 16, 1, true),
  neck: new THREE.CylinderGeometry(0.014, 0.018, 0.026, 10),
  pump: new THREE.BoxGeometry(0.045, 0.014, 0.016),
  bomb: new THREE.SphereGeometry(0.045, 16, 12),
  bombBand: new THREE.TorusGeometry(0.044, 0.007, 6, 20),
  bombCup: new THREE.CylinderGeometry(0.032, 0.026, 0.024, 14),
  gift: new RoundedBoxGeometry(0.13, 0.08, 0.1, 2, 0.008),
  ribbonA: new THREE.BoxGeometry(0.022, 0.083, 0.103),
  ribbonB: new THREE.BoxGeometry(0.133, 0.083, 0.022),
  bow: new THREE.TorusGeometry(0.014, 0.005, 6, 12),
};

// A single sellable unit, sitting on y = 0.
export function productMesh(container, color, accent) {
  const g = new THREE.Group();
  if (container === 'jar') {
    g.add(at(shadow(new THREE.Mesh(G.jar, mat(color, { roughness: 0.3 }))), 0, 0.04, 0));
    g.add(at(shadow(new THREE.Mesh(G.jarLabel, labelMaterial(accent))), 0, 0.04, 0));
    g.add(at(shadow(new THREE.Mesh(G.jarLid, mat(accent, { roughness: 0.45, metalness: 0.25 }))), 0, 0.09, 0));
  } else if (container === 'bottle') {
    // amber pump bottle (hair oil)
    g.add(at(shadow(new THREE.Mesh(G.bottle, mat('#b8742f', { roughness: 0.2, metalness: 0.05 }))), 0, 0.055, 0));
    g.add(at(shadow(new THREE.Mesh(G.bottleLabel, labelMaterial(accent))), 0, 0.05, 0));
    g.add(at(shadow(new THREE.Mesh(G.neck, mat('#f4efe6', { roughness: 0.4 }))), 0, 0.122, 0));
    g.add(at(shadow(new THREE.Mesh(G.pump, mat('#f4efe6', { roughness: 0.4 }))), 0.012, 0.142, 0));
  } else if (container === 'bomb') {
    // bath bomb: a fizzy sphere with a contrasting band, sitting in a kraft cup
    g.add(at(shadow(new THREE.Mesh(G.bomb, mat(color, { roughness: 0.95 }))), 0, 0.045, 0));
    g.add(at(new THREE.Mesh(G.bombBand, mat(accent, { roughness: 0.9 })), 0, 0.045, 0));
    g.add(at(shadow(new THREE.Mesh(G.bombCup, mat(PAL.kraft, { roughness: 1 }))), 0, 0.012, 0));
  } else if (container === 'gift') {
    // ribboned keepsake box
    g.add(at(shadow(new THREE.Mesh(G.gift, mat(color, { roughness: 0.7 }))), 0, 0.04, 0));
    g.add(at(new THREE.Mesh(G.ribbonA, mat(accent, { roughness: 0.5 })), 0, 0.04, 0));
    g.add(at(new THREE.Mesh(G.ribbonB, mat(accent, { roughness: 0.5 })), 0, 0.04, 0));
    for (const s of [-1, 1]) { const b = new THREE.Mesh(G.bow, mat(accent, { roughness: 0.5 })); b.rotation.z = s * 0.6; b.castShadow = true; g.add(at(b, s * 0.018, 0.088, 0)); }
  } else if (container === 'tub') {
    g.add(at(shadow(new THREE.Mesh(G.tub, mat(color, { roughness: 0.35 }))), 0, 0.03, 0));
    g.add(at(new THREE.Mesh(G.tubLabel, labelMaterial(accent)), 0, 0.03, 0));
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

// ---- Draw-call reduction ---------------------------------------------------------

function normalised(geo, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  g.applyMatrix4(matrix);
  return g;
}

function mergeInto(target, entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = `${e.mesh.material.uuid}|${e.mesh.castShadow}|${e.mesh.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const list of groups.values()) {
    if (list.length < 2 && !list[0].moved) continue;
    const merged = mergeGeometries(list.map((e) => normalised(e.mesh.geometry, e.matrix)), false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, list[0].mesh.material);
    m.castShadow = list[0].mesh.castShadow; m.receiveShadow = list[0].mesh.receiveShadow;
    m.userData.merged = true;
    for (const e of list) e.mesh.parent.remove(e.mesh);
    target.add(m);
  }
}

// Bake every mesh under a static group into one mesh per material. For furniture and stocked
// display slots, which never animate internally.
export function compactStatic(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const entries = [];
  group.traverse((o) => {
    if (o.isMesh && !o.isSprite && !o.userData.keep && o.material && !Array.isArray(o.material)) {
      entries.push({ mesh: o, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), moved: true });
    }
  });
  if (entries.length > 1) mergeInto(group, entries);
  // drop empty sub-groups
  const empty = [];
  group.traverse((o) => { if (o !== group && !o.isMesh && o.children.length === 0 && o.type === 'Group') empty.push(o); });
  for (const o of empty) o.parent.remove(o);
  return group;
}

// Merge the leaf meshes directly under each node (by material), keeping the node hierarchy so
// animated joints still move. Used for characters.
export function compactChildren(root) {
  const nodes = [];
  root.traverse((o) => { if (!o.isMesh) nodes.push(o); });
  for (const n of nodes) {
    const leaves = n.children.filter((c) => c.isMesh && c.children.length === 0 && !c.userData.keep && !Array.isArray(c.material));
    if (leaves.length < 2) continue;
    for (const l of leaves) l.updateMatrix();
    mergeInto(n, leaves.map((l) => ({ mesh: l, matrix: l.matrix.clone() })));
  }
  return root;
}

// Free GPU memory held by merged geometry under an object.
export function disposeMerged(obj) {
  obj.traverse((o) => { if (o.isMesh && o.userData.merged) o.geometry.dispose(); });
}
