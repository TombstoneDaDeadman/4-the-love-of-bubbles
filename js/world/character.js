// Procedural stylised characters with believable proportions (~7.3 heads tall) and a small
// reusable animation library: idle, walk, carry, work, reach, wave.

import * as THREE from 'three';
import { mat, sphere, capsule, cyl, box, at, PAL } from './kit.js';
import { FOUNDER_OPTIONS } from '../data.js';

const HEIGHT = 1.68;

function limb(len, r1, r2, material) {
  // pivot at the top, limb hangs down -y
  const pivot = new THREE.Group();
  const m = capsule((r1 + r2) / 2, len - (r1 + r2), material);
  m.position.y = -len / 2;
  pivot.add(m);
  return pivot;
}

function buildHair(style, color, headR) {
  const g = new THREE.Group();
  const hm = mat(color, { roughness: 0.85 });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.07, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hm);
  cap.castShadow = true;
  cap.rotation.x = -0.28;
  cap.position.y = 0.006;
  if (style !== 'afro') g.add(cap);
  if (style === 'bun') {
    g.add(at(sphere(headR * 0.5, hm, 14), 0, headR * 1.05, -headR * 0.45));
    g.add(at(sphere(headR * 0.2, mat(PAL.blush), 8), 0, headR * 0.78, -headR * 0.62));
  } else if (style === 'afro') {
    const a = sphere(headR * 1.5, hm, 20);
    a.scale.set(1, 0.95, 0.95);
    g.add(at(a, 0, headR * 0.35, -headR * 0.18));
  } else if (style === 'long') {
    const back = box(headR * 1.9, headR * 2.6, headR * 0.7, hm, headR * 0.3);
    g.add(at(back, 0, -headR * 0.8, -headR * 0.62));
    for (const s of [-1, 1]) g.add(at(box(headR * 0.4, headR * 2.2, headR * 0.7, hm, headR * 0.18), s * headR * 0.92, -headR * 0.75, -headR * 0.2));
  } else if (style === 'bob') {
    const back = box(headR * 2.25, headR * 1.5, headR * 1.5, hm, headR * 0.45);
    g.add(at(back, 0, -headR * 0.3, -headR * 0.42));
  } else if (style === 'braids') {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.62 + (i / 6) * 0.76) + Math.PI / 2 * 0; // around the back of the head
      const ang = Math.PI * 0.5 + (i - 3) * 0.42;
      const b = capsule(headR * 0.13, headR * 2.1, hm);
      b.position.set(Math.cos(ang) * headR * 0.95, -headR * 1.0, -Math.sin(ang) * headR * 0.95 + 0.0 * a);
      g.add(b);
      g.add(at(sphere(headR * 0.15, mat(PAL.gold, { metalness: 0.4, roughness: 0.4 }), 8), b.position.x, -headR * 2.2, b.position.z));
    }
  }
  return g;
}

export function createCharacter(opts = {}) {
  const o = {
    skin: '#b97a50', hairColor: '#1c1412', hairStyle: 'bun', top: '#e98fa5', pants: '#44506b', shoes: '#f4efe6',
    apron: null, detail: false, scale: 1, ...opts,
  };
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs and leans
  root.add(body);
  const skin = mat(o.skin, { roughness: 0.65 });
  const top = mat(o.top, { roughness: 0.85 });
  const pants = mat(o.pants, { roughness: 0.9 });
  const shoe = mat(o.shoes, { roughness: 0.7 });

  const hipY = 0.88, legLen = 0.43, headR = 0.108;

  // Legs
  const legs = {};
  for (const s of [-1, 1]) {
    const hip = limb(legLen, 0.078, 0.066, pants);
    hip.position.set(s * 0.085, hipY, 0);
    const knee = limb(legLen, 0.064, 0.05, pants);
    knee.position.y = -legLen + 0.02;
    const foot = box(0.085, 0.06, 0.2, shoe, 0.028);
    foot.position.set(0, -legLen + 0.015, 0.045);
    knee.add(foot);
    hip.add(knee);
    body.add(hip);
    legs[s] = { hip, knee };
  }

  // Torso
  const torso = new THREE.Group();
  torso.position.y = hipY;
  body.add(torso);
  const pelvis = sphere(0.155, pants, 16);
  pelvis.scale.set(1, 0.62, 0.78);
  torso.add(at(pelvis, 0, 0.02, 0));
  const chest = capsule(0.15, 0.24, top);
  chest.scale.set(1.12, 1, 0.72);
  torso.add(at(chest, 0, 0.3, 0));
  const waist = cyl(0.15, 0.158, 0.2, top, 18);
  waist.scale.set(1.05, 1, 0.72);
  torso.add(at(waist, 0, 0.12, 0));
  const shoulders = capsule(0.075, 0.27, top);
  shoulders.rotation.z = Math.PI / 2;
  torso.add(at(shoulders, 0, 0.47, 0));

  if (o.apron) {
    const am = mat(o.apron, { roughness: 0.9 });
    const bib = box(0.22, 0.24, 0.02, am, 0.008);
    torso.add(at(bib, 0, 0.36, 0.112));
    const skirt = box(0.3, 0.34, 0.02, am, 0.008);
    skirt.rotation.x = -0.05;
    torso.add(at(skirt, 0, 0.07, 0.125));
    const pocket = box(0.15, 0.085, 0.012, mat(PAL.blush, { roughness: 0.9 }), 0.004);
    torso.add(at(pocket, 0, 0.06, 0.14));
    const tie = box(0.35, 0.03, 0.245, am, 0.01);
    torso.add(at(tie, 0, 0.215, 0));
    for (const s of [-1, 1]) {
      const strap = box(0.022, 0.2, 0.012, am);
      strap.rotation.z = s * 0.2;
      torso.add(at(strap, s * 0.075, 0.5, 0.085));
    }
  }

  // Neck + head
  const neck = cyl(0.043, 0.048, 0.09, skin, 12);
  torso.add(at(neck, 0, 0.56, 0));
  const head = new THREE.Group();
  head.position.y = 0.6 + headR * 1.05;
  torso.add(head);
  const skull = sphere(headR, skin, 24);
  skull.scale.set(0.93, 1.1, 0.98);
  head.add(skull);
  const jaw = sphere(headR * 0.78, skin, 16);
  jaw.scale.set(0.9, 0.8, 0.9);
  head.add(at(jaw, 0, -headR * 0.42, headR * 0.1));
  for (const s of [-1, 1]) {
    head.add(at(sphere(headR * 0.2, skin, 8), s * headR * 0.92, -headR * 0.05, 0));
    const eyeWhite = sphere(headR * 0.15, mat('#ffffff', { roughness: 0.4 }), 10);
    eyeWhite.scale.set(1, 0.8, 0.5);
    head.add(at(eyeWhite, s * headR * 0.36, headR * 0.06, headR * 0.86));
    const eye = sphere(headR * 0.095, mat('#2a1c14', { roughness: 0.3 }), 10);
    eye.scale.set(1, 1, 0.5);
    head.add(at(eye, s * headR * 0.36, headR * 0.06, headR * 0.92));
    const brow = box(headR * 0.3, headR * 0.05, headR * 0.05, mat(o.hairColor), 0.002);
    brow.rotation.z = -s * 0.12;
    head.add(at(brow, s * headR * 0.36, headR * 0.3, headR * 0.9));
    if (o.detail) {
      head.add(at(sphere(headR * 0.075, mat(PAL.gold, { metalness: 0.6, roughness: 0.3 }), 8), s * headR * 0.95, -headR * 0.3, 0));
      const cheek = sphere(headR * 0.16, mat('#e8838f', { roughness: 0.9, transparent: true, opacity: 0.35 }), 8);
      cheek.scale.set(1, 0.7, 0.3);
      cheek.castShadow = false;
      head.add(at(cheek, s * headR * 0.52, -headR * 0.28, headR * 0.8));
    }
  }
  head.add(at(sphere(headR * 0.1, skin, 8), 0, -headR * 0.14, headR * 0.98));
  const smile = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.032, 6, 12, Math.PI * 0.8), mat('#8a3b3f', { roughness: 0.6 }));
  smile.rotation.z = Math.PI * 1.1;
  head.add(at(smile, 0, -headR * 0.36, headR * 0.86));
  head.add(buildHair(o.hairStyle, o.hairColor, headR));

  // Arms
  const arms = {};
  for (const s of [-1, 1]) {
    const shoulder = limb(0.28, 0.058, 0.05, top);
    shoulder.position.set(s * 0.225, 0.47, 0);
    const elbow = limb(0.26, 0.046, 0.04, skin);
    elbow.position.y = -0.26;
    elbow.add(at(sphere(0.046, skin, 10), 0, -0.26, 0));
    shoulder.add(elbow);
    torso.add(shoulder);
    arms[s] = { shoulder, elbow };
  }

  // Where carried items sit
  const hands = new THREE.Group();
  hands.position.set(0, 0.2, 0.33);
  torso.add(hands);

  root.scale.setScalar(o.scale * (HEIGHT / 1.72));
  root.traverse((n) => { if (n.isMesh && n.castShadow !== false) n.castShadow = true; });

  const pose = { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shL: 0, shR: 0, shLz: 0, shRz: 0, elL: 0, elR: 0, lean: 0, bob: 0, headX: 0, headY: 0 };
  const cur = { ...pose };
  let phase = Math.random() * 10, idleT = Math.random() * 10;

  function target(anim, dt) {
    idleT += dt;
    const t = { ...pose };
    t.shLz = 0.07; t.shRz = -0.07;
    if (anim === 'walk' || anim === 'carry') {
      phase += dt * 8.2;
      const sw = Math.sin(phase);
      t.hipL = sw * 0.62; t.hipR = -sw * 0.62;
      t.kneeL = Math.max(0, -Math.cos(phase)) * 0.95 + 0.06; t.kneeR = Math.max(0, Math.cos(phase)) * 0.95 + 0.06;
      t.bob = Math.abs(Math.cos(phase)) * 0.028;
      t.lean = 0.05;
      if (anim === 'carry') { t.shL = t.shR = -0.95; t.elL = t.elR = -0.75; t.shLz = 0.22; t.shRz = -0.22; }
      else { t.shL = -sw * 0.5; t.shR = sw * 0.5; t.elL = -0.25 - Math.max(0, -sw) * 0.3; t.elR = -0.25 - Math.max(0, sw) * 0.3; }
    } else if (anim === 'work') {
      phase += dt * 6.5;
      t.shL = -0.95 + Math.sin(phase) * 0.22; t.shR = -0.95 + Math.sin(phase + 1.7) * 0.22;
      t.elL = -0.8 + Math.cos(phase) * 0.25; t.elR = -0.8 + Math.cos(phase + 1.7) * 0.25;
      t.shLz = 0.16; t.shRz = -0.16;
      t.lean = 0.16; t.headX = 0.3; t.bob = Math.sin(phase * 0.5) * 0.006;
    } else if (anim === 'reach') {
      phase += dt * 4;
      t.shR = -1.9 + Math.sin(phase) * 0.15; t.elR = -0.35;
      t.shL = -0.8; t.elL = -0.9;
      t.headX = -0.15; t.lean = 0.04;
    } else if (anim === 'wave') {
      phase += dt * 9;
      t.shR = -0.2; t.shRz = -2.5 + Math.sin(phase) * 0.28; t.elR = -0.5;
      t.headY = 0.1;
    } else {
      t.shL = Math.sin(idleT * 1.3) * 0.04; t.shR = -Math.sin(idleT * 1.3) * 0.04;
      t.elL = t.elR = -0.12;
      t.bob = Math.sin(idleT * 1.9) * 0.004;
      t.headY = Math.sin(idleT * 0.45) * 0.3;
      t.headX = Math.sin(idleT * 0.31) * 0.05;
    }
    return t;
  }

  let carried = null, carriedKey = null;

  return {
    root, hands, head,
    update(dt, anim = 'idle') {
      const t = target(anim, dt);
      const k = 1 - Math.exp(-dt * 14);
      for (const key of Object.keys(cur)) cur[key] += (t[key] - cur[key]) * k;
      legs[-1].hip.rotation.x = cur.hipL; legs[1].hip.rotation.x = cur.hipR;
      legs[-1].knee.rotation.x = cur.kneeL; legs[1].knee.rotation.x = cur.kneeR;
      arms[-1].shoulder.rotation.set(cur.shL, 0, -cur.shLz); arms[1].shoulder.rotation.set(cur.shR, 0, -cur.shRz);
      arms[-1].elbow.rotation.x = cur.elL; arms[1].elbow.rotation.x = cur.elR;
      torso.rotation.x = cur.lean;
      body.position.y = cur.bob;
      head.rotation.set(cur.headX, cur.headY, 0);
    },
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
    pants: '#3f4a66', shoes: '#fbf6ee', apron: '#fbf3e4', detail: true,
  };
}

export const HELPER_LOOK = { skin: '#eabf9f', hairColor: '#6a3e1f', hairStyle: 'short', top: '#7fc7c0', pants: '#6b5a4a', shoes: '#e9e2d6', apron: '#cfe0d2' };
