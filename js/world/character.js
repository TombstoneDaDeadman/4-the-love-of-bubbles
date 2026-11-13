// Procedural stylised characters with believable proportions (~7.3 heads tall), built from
// lathe-turned body shapes, with a small reusable animation library:
// idle, walk, carry, work, reach, wave, plus blinking and a short "cheer" emote.

import * as THREE from 'three';
import { mat, sphere, cyl, box, at, PAL, compactChildren } from './kit.js';
import { FOUNDER_OPTIONS } from '../data.js';

const HEIGHT = 1.68;

const shade = (hex, f) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
};

function lathe(points, material, seg = 20) {
  if (points[0][1] > points[points.length - 1][1]) points = [...points].reverse(); // bottom-up gives outward normals
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg), material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// A tapered limb hanging down from its pivot (y = 0) with rounded ends.
function limb(len, r1, r2, material) {
  const pivot = new THREE.Group();
  const mid = (r1 + r2) / 2;
  pivot.add(lathe([[0, r1 * 0.75], [r1 * 0.72, r1 * 0.45], [r1, 0], [mid * 1.04, -len * 0.45], [r2, -len], [r2 * 0.7, -len - r2 * 0.5], [0, -len - r2 * 0.75]], material, 14));
  return pivot;
}

function buildHair(style, color, R) {
  const g = new THREE.Group();
  const hm = mat(color, { roughness: 0.55, envMapIntensity: 0.7 });
  const cap = () => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(R * 1.08, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), hm);
    c.castShadow = true; c.rotation.x = -0.3; c.position.y = 0.008;
    c.scale.set(0.97, 1.08, 1.02);
    g.add(c);
    // lower back of the head
    const nape = sphere(R * 0.98, hm, 16);
    nape.scale.set(0.96, 0.9, 0.8);
    g.add(at(nape, 0, -R * 0.12, -R * 0.3));
  };
  const blob = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const b = sphere(R * r, hm, 14); b.scale.set(sx, sy, sz); g.add(at(b, R * x, R * y, R * z)); return b; };
  if (style === 'bun') {
    cap();
    blob(0.52, 0, 1.08, -0.42);
    blob(0.3, 0, 0.72, -0.2, 1.6, 0.6, 1);
    g.add(at(sphere(R * 0.16, mat(PAL.blush, { roughness: 0.5 }), 8), 0, R * 0.8, -R * 0.74));
    for (const s of [-1, 1]) blob(0.2, s * 0.86, 0.05, 0.42, 0.6, 1.6, 0.8); // face-framing strands
  } else if (style === 'afro') {
    blob(1.5, 0, 0.42, -0.16, 1, 0.96, 0.96);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; blob(0.62, Math.cos(a) * 1.15, 0.45 + Math.sin(i * 2.1) * 0.5, -0.16 + Math.sin(a) * 1.05); }
  } else if (style === 'long') {
    cap();
    blob(1.0, 0, -0.75, -0.62, 1, 1.5, 0.5);
    blob(0.85, 0, -1.7, -0.6, 1.05, 1.1, 0.42);
    for (const s of [-1, 1]) { blob(0.4, s * 0.88, -0.5, -0.05, 0.6, 2.2, 0.9); blob(0.36, s * 0.8, -1.5, 0.02, 0.6, 1.6, 0.8); }
  } else if (style === 'bob') {
    cap();
    blob(1.18, 0, -0.28, -0.3, 1, 0.9, 0.86);
    for (const s of [-1, 1]) blob(0.5, s * 0.82, -0.55, 0.12, 0.62, 1.5, 0.95);
  } else if (style === 'braids') {
    cap();
    const bead = mat(PAL.gold, { metalness: 0.5, roughness: 0.35 });
    for (let i = 0; i < 9; i++) {
      const ang = Math.PI * 0.5 + (i - 4) * 0.36;
      const x = Math.cos(ang) * 0.98, z = -Math.sin(ang) * 0.98;
      for (let k = 0; k < 6; k++) blob(0.15, x * (1 - k * 0.01), -0.15 - k * 0.36, z - k * 0.015, 1, 1.35, 1);
      g.add(at(sphere(R * 0.15, bead, 8), R * x, -R * 2.3, R * (z - 0.09)));
    }
  } else {
    cap();
    blob(0.5, 0, 0.98, 0.25, 1.5, 0.5, 1.2); // a little volume on top
  }
  return g;
}

export function createCharacter(opts = {}) {
  const o = {
    skin: '#b97a50', hairColor: '#1c1412', hairStyle: 'bun', top: '#e98fa5', pants: '#44506b', shoes: '#f4efe6',
    apron: null, detail: false, build: 'a', scale: 1, ...opts,
  };
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs and leans
  root.add(body);
  const skin = mat(o.skin, { roughness: 0.62, envMapIntensity: 0.35 });
  const top = mat(o.top, { roughness: 0.82 });
  const topDark = mat(shade(o.top, 0.86), { roughness: 0.82 });
  const pants = mat(o.pants, { roughness: 0.88 });
  const shoe = mat(o.shoes, { roughness: 0.55 });
  const sole = mat(shade(o.shoes, 0.6), { roughness: 0.8 });
  const B = o.build === 'b';

  const hipY = 0.88, legLen = 0.42, R = 0.114;

  // Legs
  const legs = {};
  for (const s of [-1, 1]) {
    const hip = limb(legLen, 0.09, 0.068, pants);
    hip.position.set(s * 0.086, hipY, 0);
    const knee = limb(legLen - 0.03, 0.066, 0.05, pants);
    knee.position.y = -legLen;
    const foot = new THREE.Group();
    foot.add(at(box(0.088, 0.058, 0.2, shoe, 0.028), 0, 0.012, 0.05));
    foot.add(at(box(0.092, 0.02, 0.208, sole, 0.008), 0, -0.022, 0.05));
    const toe = sphere(0.045, shoe, 10); toe.scale.set(0.98, 0.7, 1.1);
    foot.add(at(toe, 0, 0.012, 0.125));
    foot.position.y = -(legLen - 0.03) - 0.03;
    knee.add(foot);
    hip.add(knee);
    body.add(hip);
    legs[s] = { hip, knee };
  }

  // Torso (lathe-turned so waist, chest and shoulders flow into each other)
  const torso = new THREE.Group();
  torso.position.y = hipY;
  body.add(torso);
  const hips = lathe([[0, -0.085], [0.09, -0.075], [0.148, -0.02], [B ? 0.15 : 0.158, 0.06], [0.14, 0.15]], pants);
  hips.scale.z = 0.7;
  torso.add(hips);
  const chest = lathe(B
    ? [[0.146, 0.06], [0.148, 0.2], [0.158, 0.36], [0.172, 0.47], [0.16, 0.53], [0.1, 0.575], [0.05, 0.59], [0, 0.595]]
    : [[0.152, 0.05], [0.136, 0.17], [0.124, 0.25], [0.142, 0.37], [0.156, 0.46], [0.146, 0.525], [0.095, 0.572], [0.05, 0.588], [0, 0.592]], top);
  chest.scale.z = 0.68;
  torso.add(chest);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(B ? 0.146 : 0.152, 0.012, 8, 24), topDark);
  hem.rotation.x = Math.PI / 2; hem.scale.y = 0.7; hem.castShadow = true;
  torso.add(at(hem, 0, 0.058, 0));
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.016, 8, 20), topDark);
  collar.rotation.x = Math.PI / 2; collar.castShadow = true;
  torso.add(at(collar, 0, 0.578, 0.004));

  if (o.apron) {
    const am = mat(o.apron, { roughness: 0.9 });
    const trim = mat(PAL.blush, { roughness: 0.85 });
    const bib = box(0.2, 0.22, 0.016, am, 0.006);
    bib.rotation.x = -0.06;
    torso.add(at(bib, 0, 0.385, 0.108));
    torso.add(at(box(0.204, 0.018, 0.018, trim, 0.004), 0, 0.492, 0.103));
    const skirt = box(0.3, 0.36, 0.016, am, 0.03);
    skirt.rotation.x = -0.03;
    torso.add(at(skirt, 0, 0.1, 0.118));
    torso.add(at(box(0.15, 0.085, 0.012, trim, 0.004), 0, 0.09, 0.13));
    torso.add(at(box(0.15, 0.008, 0.014, am), 0, 0.125, 0.132));
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.011, 6, 24), am);
    tie.rotation.x = Math.PI / 2; tie.scale.y = 0.72; tie.castShadow = true;
    torso.add(at(tie, 0, 0.27, 0));
    const bow = sphere(0.03, am, 8); bow.scale.set(1.8, 0.8, 0.6);
    torso.add(at(bow, 0, 0.27, -0.1));
    for (const s of [-1, 1]) {
      const strap = box(0.02, 0.15, 0.012, am);
      strap.rotation.z = s * 0.22;
      torso.add(at(strap, s * 0.07, 0.525, 0.084));
    }
  }

  // Neck + head
  torso.add(at(cyl(0.04, 0.047, 0.1, skin, 12), 0, 0.615, 0));
  const head = new THREE.Group();
  head.position.y = 0.655 + R;
  torso.add(head);
  const skull = sphere(R, skin, 28);
  skull.scale.set(0.93, 1.08, 0.97);
  head.add(skull);
  const jaw = sphere(R * 0.8, skin, 18);
  jaw.scale.set(0.9, 0.82, 0.9);
  head.add(at(jaw, 0, -R * 0.42, R * 0.1));
  const eyes = [];
  const irisCol = o.detail ? '#5a3a22' : '#3a2a20';
  for (const s of [-1, 1]) {
    head.add(at(sphere(R * 0.2, skin, 8), s * R * 0.93, -R * 0.05, 0)); // ear
    const eye = new THREE.Group();
    const white = sphere(R * 0.17, mat('#ffffff', { roughness: 0.35 }), 12); white.scale.set(1, 0.92, 0.45);
    const iris = sphere(R * 0.115, mat(irisCol, { roughness: 0.3 }), 12); iris.scale.set(1, 1, 0.45);
    const pupil = sphere(R * 0.062, mat('#140d0a', { roughness: 0.2 }), 8); pupil.scale.set(1, 1, 0.4);
    const glint = sphere(R * 0.032, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 6);
    eye.add(white, at(iris, 0, 0, R * 0.05), at(pupil, 0, 0, R * 0.085), at(glint, R * 0.04, R * 0.045, R * 0.11));
    eye.position.set(s * R * 0.37, R * 0.05, R * 0.84);
    eye.traverse((n) => { n.castShadow = false; });
    head.add(eye); eyes.push(eye);
    const brow = box(R * 0.32, R * 0.055, R * 0.05, mat(shade(o.hairColor, 0.9)), 0.002);
    brow.rotation.z = -s * 0.14;
    head.add(at(brow, s * R * 0.38, R * 0.31, R * 0.89));
    if (o.detail) {
      const lash = box(R * 0.34, R * 0.035, R * 0.04, mat('#1a120e'), 0.002);
      lash.rotation.z = -s * 0.1;
      head.add(at(lash, s * R * 0.39, R * 0.185, R * 0.91));
      head.add(at(sphere(R * 0.075, mat(PAL.gold, { metalness: 0.7, roughness: 0.25 }), 8), s * R * 0.96, -R * 0.32, 0));
      const cheek = sphere(R * 0.17, mat('#e8838f', { roughness: 0.9, transparent: true, opacity: 0.32 }), 8);
      cheek.scale.set(1, 0.7, 0.3); cheek.castShadow = false;
      head.add(at(cheek, s * R * 0.54, -R * 0.26, R * 0.8));
    }
  }
  const nose = sphere(R * 0.1, skin, 8); nose.scale.set(1, 0.9, 1.1);
  head.add(at(nose, 0, -R * 0.14, R * 0.98));
  const smile = new THREE.Mesh(new THREE.TorusGeometry(R * 0.21, R * 0.034, 6, 14, Math.PI * 0.78), mat(o.detail ? '#a8444e' : '#8a3b3f', { roughness: 0.5 }));
  smile.rotation.z = Math.PI * 1.11;
  head.add(at(smile, 0, -R * 0.37, R * 0.87));
  const hair = buildHair(o.hairStyle, o.hairColor, R);
  head.add(hair);

  // Arms: sleeve, forearm, hand with a thumb
  const arms = {};
  for (const s of [-1, 1]) {
    const shoulder = limb(0.27, 0.06, 0.05, top);
    shoulder.position.set(s * (B ? 0.215 : 0.2), 0.5, 0);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 16), topDark);
    cuff.rotation.x = Math.PI / 2; cuff.castShadow = true;
    shoulder.add(at(cuff, 0, -0.265, 0));
    const elbow = limb(0.25, 0.044, 0.036, skin);
    elbow.position.y = -0.27;
    const hand = sphere(0.046, skin, 12); hand.scale.set(0.8, 1.15, 1);
    elbow.add(at(hand, 0, -0.29, 0.005));
    elbow.add(at(sphere(0.018, skin, 8), -s * 0.03, -0.275, 0.03));
    shoulder.add(elbow);
    torso.add(shoulder);
    arms[s] = { shoulder, elbow };
  }

  // Where carried items sit
  const hands = new THREE.Group();
  hands.position.set(0, 0.2, 0.33);
  torso.add(hands);

  root.scale.setScalar(o.scale * (HEIGHT / 1.74));
  root.traverse((n) => { if (n.isMesh && n.castShadow !== false) n.castShadow = true; });
  // Fewer draw calls: fuse the static pieces under each joint (a store holds 20+ people).
  if (o.compact !== false) compactChildren(root);

  const pose = { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shL: 0, shR: 0, shLz: 0, shRz: 0, elL: 0, elR: 0, lean: 0, bob: 0, headX: 0, headY: 0, twist: 0 };
  const cur = { ...pose };
  let phase = Math.random() * 10, idleT = Math.random() * 10;
  let blinkIn = 1.5 + Math.random() * 3, blinkT = 0, cheerT = 0;

  function target(anim, dt) {
    idleT += dt;
    const t = { ...pose };
    t.shLz = 0.07; t.shRz = -0.07;
    if (anim === 'walk' || anim === 'carry') {
      phase += dt * 8.2;
      const sw = Math.sin(phase);
      t.hipL = sw * 0.6; t.hipR = -sw * 0.6;
      t.kneeL = Math.max(0, -Math.cos(phase)) * 0.95 + 0.06; t.kneeR = Math.max(0, Math.cos(phase)) * 0.95 + 0.06;
      t.bob = Math.abs(Math.cos(phase)) * 0.03;
      t.lean = 0.05; t.twist = sw * 0.09;
      if (anim === 'carry') { t.shL = t.shR = -0.95; t.elL = t.elR = -0.75; t.shLz = 0.22; t.shRz = -0.22; t.twist = 0; }
      else { t.shL = -sw * 0.5; t.shR = sw * 0.5; t.elL = -0.25 - Math.max(0, -sw) * 0.3; t.elR = -0.25 - Math.max(0, sw) * 0.3; }
    } else if (anim === 'work') {
      phase += dt * 6.5;
      t.shL = -0.95 + Math.sin(phase) * 0.22; t.shR = -0.95 + Math.sin(phase + 1.7) * 0.22;
      t.elL = -0.8 + Math.cos(phase) * 0.25; t.elR = -0.8 + Math.cos(phase + 1.7) * 0.25;
      t.shLz = 0.16; t.shRz = -0.16;
      t.lean = 0.16; t.headX = 0.3; t.bob = Math.sin(phase * 0.5) * 0.006;
      t.headY = Math.sin(phase * 0.25) * 0.12;
    } else if (anim === 'reach') {
      phase += dt * 4;
      t.shR = -1.9 + Math.sin(phase) * 0.15; t.elR = -0.35;
      t.shL = -0.8; t.elL = -0.9;
      t.headX = -0.15; t.lean = 0.04;
    } else if (anim === 'wave') {
      phase += dt * 9;
      t.shR = -0.2; t.shRz = -2.5 + Math.sin(phase) * 0.28; t.elR = -0.5;
      t.headY = 0.1; t.headX = -0.05;
      t.bob = Math.sin(idleT * 1.9) * 0.004;
    } else {
      t.shL = Math.sin(idleT * 1.3) * 0.04; t.shR = -Math.sin(idleT * 1.3) * 0.04;
      t.elL = t.elR = -0.12;
      t.bob = Math.sin(idleT * 1.9) * 0.004;
      t.headY = Math.sin(idleT * 0.45) * 0.3;
      t.headX = Math.sin(idleT * 0.31) * 0.05;
      t.twist = Math.sin(idleT * 0.45) * 0.05;
    }
    if (cheerT > 0) {
      const k = Math.sin((1 - cheerT / 0.9) * Math.PI);
      t.shL = t.shR = -2.75; t.shLz = 0.35; t.shRz = -0.35; t.elL = t.elR = -0.25;
      t.bob += k * 0.11; t.headX = -0.2; t.lean = -0.04;
    }
    return t;
  }

  let carried = null, carriedKey = null;

  return {
    root, hands, head,
    update(dt, anim = 'idle') {
      if (cheerT > 0) cheerT = Math.max(0, cheerT - dt);
      const t = target(anim, dt);
      const k = 1 - Math.exp(-dt * 14);
      for (const key of Object.keys(cur)) cur[key] += (t[key] - cur[key]) * k;
      legs[-1].hip.rotation.x = cur.hipL; legs[1].hip.rotation.x = cur.hipR;
      legs[-1].knee.rotation.x = cur.kneeL; legs[1].knee.rotation.x = cur.kneeR;
      arms[-1].shoulder.rotation.set(cur.shL, 0, -cur.shLz); arms[1].shoulder.rotation.set(cur.shR, 0, -cur.shRz);
      arms[-1].elbow.rotation.x = cur.elL; arms[1].elbow.rotation.x = cur.elR;
      torso.rotation.set(cur.lean, cur.twist, 0);
      body.position.y = cur.bob;
      head.rotation.set(cur.headX, cur.headY - cur.twist * 0.6, 0);
      hair.rotation.x = -cur.bob * 1.2;
      // blink
      blinkIn -= dt;
      if (blinkIn <= 0) { blinkIn = 2.2 + Math.random() * 3.5; blinkT = 0.13; }
      if (blinkT > 0) blinkT -= dt;
      const lid = blinkT > 0 ? 0.12 : 1;
      for (const e of eyes) e.scale.y += (lid - e.scale.y) * Math.min(1, dt * 40);
    },
    cheer() { cheerT = 0.9; },
    setCarry(key, factory) {
      if (key === carriedKey) return;
      if (carried) hands.remove(carried);
      carried = null; carriedKey = key;
      if (key && factory) { carried = factory(); hands.add(carried); }
    },
  };
}

export function founderLook(founder) {
  const F = FOUNDER_OPTIONS;
  return {
    skin: F.skin[founder.skin] || F.skin[3],
    hairColor: F.hairColor[founder.hairColor] || F.hairColor[0],
    hairStyle: founder.hairStyle || 'bun',
    top: F.outfit[founder.outfit] || F.outfit[0],
    pants: '#3f4a66', shoes: '#fbf6ee', apron: '#fbf3e4', detail: true, build: 'a',
  };
}

export const HELPER_LOOK = { skin: '#eabf9f', hairColor: '#6a3e1f', hairStyle: 'short', top: '#7fc7c0', pants: '#6b5a4a', shoes: '#e9e2d6', apron: '#cfe0d2', build: 'b' };
