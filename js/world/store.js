// The first 4 The Love Of Bubbles store: a bright corner shop on Main Street with big front
// windows, a shop floor the player lays out, a till, and a back workroom where production and
// online packing carry on. Presentation only: reads sim state, never changes it.

import * as THREE from 'three';
import { mat, PAL, box, cyl, sphere, at, group, productMesh, cardboardBox, crate, plant, woodFloorTexture, signTexture, screenTexture, wallTexture, groundTexture, sprites, sprite, compactStatic, disposeMerged } from './kit.js';
import { createCharacter, founderLook, HELPER_LOOK } from './character.js';
import { HomeWorld } from './home.js';
import { INGREDIENTS, INGREDIENT_ORDER, PRODUCTS, SCENTS, STORE_POINTS, STORE_GRID, STORE_ROWS, FURNITURE, DAY_LENGTH, PEOPLE, STORE_FIXED, STORE_RESERVED } from '../data.js';
import { footprint, furnitureCenter } from '../sim/path.js';
import { goodsCap, ingredientCap } from '../sim/inventory.js';

const W = 14, D = 11, H = 3.1, T = 0.14;
const HX = W / 2, HZ = D / 2;
const PZ = -2.25; // partition wall
const { cell: CELL, x0: X0, z0: Z0 } = STORE_GRID;
const ingredientMesh = (id) => HomeWorld.prototype._ingredientMesh.call(null, id);
const shelfUnit = (...a) => HomeWorld.prototype._shelfUnit.call(null, ...a);

const SLOT_LAYOUT = {
  // shelf: 3 tiers x 4 across per slot (slot 0 on the shopper's left = local -x)
  shelf: (slot, k) => ({ x: (slot === 0 ? -0.82 : 0.13) + (k % 4) * 0.23, y: [0.27, 0.71, 1.15][Math.floor(k / 4)], z: 0.02 }),
  // table: six round the top, four on the riser
  table: (slot, k) => (k < 6 ? { x: Math.cos((k / 6) * Math.PI * 2 + 0.3) * 0.47, y: 0.79, z: Math.sin((k / 6) * Math.PI * 2 + 0.3) * 0.47 } : { x: Math.cos(((k - 6) / 4) * Math.PI * 2) * 0.17, y: 0.99, z: Math.sin(((k - 6) / 4) * Math.PI * 2) * 0.17 }),
};

function wallGroup() { const g = new THREE.Group(); g.userData.decor = []; g.userData.s = 1; return g; }
export function lookFor(look, extra = {}) {
  if (look === 'helper') return { ...HELPER_LOOK, ...extra };
  return {
    skin: PEOPLE.skin[look.skin] || PEOPLE.skin[0], hairColor: PEOPLE.hair[look.hair] || PEOPLE.hair[0], hairStyle: PEOPLE.styles[look.style] || 'short',
    top: PEOPLE.tops[look.top] || PEOPLE.tops[0], pants: PEOPLE.pants[look.pants] || PEOPLE.pants[0], shoes: '#f4efe6', build: look.build || 'a', ...extra,
  };
}
const lookKey = (look) => (look === 'helper' ? 'helper' : `${look.skin}.${look.hair}.${look.style}.${look.top}.${look.pants}.${look.build}`);
const ROLE_APRON = { cashier: '#a9d6d3', associate: '#cfe0d2' };

export class StoreWorld {
  constructor(engine, game) {
    this.engine = engine;
    this.game = game;
    this.root = new THREE.Group();
    engine.scene.add(this.root);
    this.fx3d = new THREE.Group();
    engine.fxRoot.add(this.fx3d);
    engine.configure({ bounds: { x: 6.5, z: 5.5, minDist: 7, maxDist: 30 }, shadow: 11 });
    this.fx = [];
    this.particles = [];
    this.chars = {};
    this.shoppers = new Map();
    this.pool = new Map();
    this.anchors = {};
    this.views = new Map();
    this.hits = [];
    this.t = 0;
    this._sig = {};
    this.build = { on: false, ghost: null, selected: null };
    this._buildShell();
    this._buildStreet();
    this._buildBackRoom();
    this._buildCounter();
    this._buildLights();
    this._buildBuildMode();
    this._buildHover();
    this._buildBubbles();
    this._buildMesses();
  }

  // Spills and wear (Milestone 4 cleanliness): decals for each mess, plus a faint grime layer.
  _buildMesses() {
    const tex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const blob = (g, col, n, seed) => { let x = seed; const r = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; g.fillStyle = col; for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(64 + (r() - 0.5) * 60, 64 + (r() - 0.5) * 60, 8 + r() * 22, 6 + r() * 16, r() * 3, 0, Math.PI * 2); g.fill(); } };
    this.messTex = {
      spill: tex((g) => blob(g, 'rgba(232,190,120,0.75)', 7, 3)),
      scrub: tex((g) => { blob(g, 'rgba(250,244,230,0.85)', 5, 7); g.fillStyle = 'rgba(200,170,130,0.9)'; for (let i = 0; i < 60; i++) g.fillRect(30 + ((i * 37) % 70), 30 + ((i * 53) % 70), 2, 2); }),
      petals: tex((g) => { for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? 'rgba(240,154,176,0.95)' : 'rgba(185,162,230,0.95)'; g.beginPath(); g.ellipse(25 + ((i * 41) % 80), 25 + ((i * 29) % 80), 9, 5, i, 0, Math.PI * 2); g.fill(); } }),
    };
    this.messViews = new Map();
    // scuffs and dust, scattered irregularly so the floor reads as worn rather than patterned
    const grime = tex((g) => { let x = 11; const r = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(110,85,60,${0.04 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * 128, r() * 128, 2 + r() * 9, 1 + r() * 4, r() * 3, 0, Math.PI * 2); g.fill(); } });
    grime.wrapS = grime.wrapT = THREE.RepeatWrapping; grime.repeat.set(3.3, 1.9);
    this.grime = new THREE.Mesh(new THREE.PlaneGeometry(W, HZ - PZ), new THREE.MeshBasicMaterial({ map: grime, transparent: true, opacity: 0, depthWrite: false }));
    this.grime.rotation.x = -Math.PI / 2; this.grime.position.set(0, 0.006, (HZ + PZ) / 2);
    this.fx3d.add(this.grime);
  }
  _syncMesses() {
    const st = this.game.state.store, seen = new Set();
    for (const m of st.messes) {
      seen.add(m.id);
      if (this.messViews.has(m.id)) continue;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: this.messTex[m.kind] || this.messTex.spill, transparent: true, depthWrite: false }));
      d.rotation.x = -Math.PI / 2; d.rotation.z = (m.x * 7 + m.z * 3) % 6;
      d.position.set(m.x, 0.012, m.z);
      this.fx3d.add(d); this.messViews.set(m.id, d);
    }
    for (const [id, d] of this.messViews) if (!seen.has(id)) { this.fx3d.remove(d); d.material.dispose(); d.geometry.dispose(); this.messViews.delete(id); this.burst('bubble', new THREE.Vector3(d.position.x, 0.9, d.position.z), 5); }
    this.grime.material.opacity = Math.max(0, (85 - st.clean) / 85) * 0.7;
  }

  _hit(w, h, d, x, y, z, id) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z);
    this.root.add(m);
    this.engine.addInteractable(m, id);
    return m;
  }

  // ---- Shell: floors, walls, the shop front -----------------------------------------
  _buildShell() {
    const r = this.root;
    const slab = box(W + T * 2 + 0.1, 0.16, D + T * 2 + 0.1, mat('#e6d5bf'), 0.03);
    r.add(at(slab, 0, -0.08, 0));
    const tex = woodFloorTexture(); tex.repeat.set(3.2, 1.9);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, HZ - PZ), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, envMapIntensity: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, (HZ + PZ) / 2); floor.receiveShadow = true;
    r.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, PZ + HZ), new THREE.MeshStandardMaterial({ color: '#e9e1d4', roughness: 0.75 }));
    back.rotation.x = -Math.PI / 2; back.position.set(0, 0.002, (PZ - HZ) / 2); back.receiveShadow = true;
    r.add(back);
    // entrance mat and a soft rug under the feature table
    r.add(at(box(2.0, 0.012, 0.9, mat('#c7a98a', { roughness: 1 }), 0.01), 0, 0.008, 5.0));

    const panel = mat('#bfd8c6', { roughness: 0.85 }), rail = mat('#fffaf0', { roughness: 0.6 }), cap = mat('#e3d2bd');
    const WH = 1.0;
    const mk = (len, alongX, inward) => {
      const g = wallGroup();
      const t = wallTexture('#f7ecdf'); t.repeat.set(len * 0.5, 2);
      const wm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, envMapIntensity: 0.3 });
      g.add(at(alongX ? box(len, H, T, wm) : box(T, H, len, wm), 0, H / 2, 0));
      g.add(at(alongX ? box(len, 0.05, T + 0.02, cap) : box(T + 0.02, 0.05, len, cap), 0, H + 0.025, 0));
      const inLen = alongX ? W : D, off = inward * (T / 2 + 0.011);
      const add = (m, y, along) => g.add(alongX ? at(m, along, y, off) : at(m, off, y, along));
      add(alongX ? box(inLen, WH, 0.022, panel) : box(0.022, WH, inLen, panel), WH / 2, 0);
      add(alongX ? box(inLen, 0.05, 0.05, rail) : box(0.05, 0.05, inLen, rail), WH + 0.02, 0);
      return g;
    };
    this.walls = {
      back: at(mk(W + T * 2, true, 1), 0, 0, -HZ - T / 2),
      left: at(mk(D, false, 1), -HX - T / 2, 0, 0),
      right: at(mk(D, false, -1), HX + T / 2, 0, 0),
      front: this._buildFront(),
    };
    this.wallNormals = { back: [0, -1], front: [0, 1], left: [-1, 0], right: [1, 0] };
    for (const g of Object.values(this.walls)) r.add(g);

    // Brand sign and framed botanical prints on the left wall of the shop floor
    const sign = new THREE.Group();
    sign.add(at(box(0.05, 1.0, 1.95, mat(PAL.woodLight)), 0, 0, 0));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.92), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.8 }));
    face.rotation.y = Math.PI / 2; face.position.x = 0.03; sign.add(face);
    sign.position.set(T / 2 + 0.03, 2.25, 1.2);
    this.walls.left.add(sign); this.walls.left.userData.decor.push(sign);
    const prints = new THREE.Group();
    ['#f3c4cf', '#cfe0d2', '#f6dfb0'].forEach((c, i) => {
      prints.add(at(box(0.5, 0.62, 0.03, mat(PAL.woodLight)), (i - 1) * 0.7, 0, 0));
      prints.add(at(box(0.4, 0.5, 0.034, mat(c)), (i - 1) * 0.7, 0, 0.003));
      prints.add(at(sphere(0.08, mat(i === 1 ? PAL.leaf : PAL.blush), 10), (i - 1) * 0.7, 0.02, 0.03));
    });
    prints.position.set(-3.6, 2.0, T / 2 + 0.02);
    this.walls.back.add(prints); this.walls.back.userData.decor.push(prints);

    // The half-height partition between the shop floor and the workroom, with a doorway.
    const part = new THREE.Group();
    const pm = mat('#f4eadc', { roughness: 0.9 }), top = mat(PAL.wood, { roughness: 0.55 });
    for (const [x0, x1] of [[-HX, -0.55], [0.55, HX]]) {
      const len = x1 - x0, cx = (x0 + x1) / 2;
      part.add(at(box(len, 1.15, 0.12, pm), cx, 0.575, PZ));
      part.add(at(box(len + 0.02, 0.05, 0.2, top), cx, 1.175, PZ));
      part.add(at(box(len, 0.7, 0.02, panel), cx, 0.35, PZ + 0.07));
    }
    for (const s of [-1, 1]) part.add(at(box(0.12, 2.35, 0.16, top), s * 0.6, 1.175, PZ));
    part.add(at(box(1.32, 0.16, 0.18, top), 0, 2.35, PZ));
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12), new THREE.MeshStandardMaterial({ map: this._textTex('W O R K R O O M', '#fbf3e4', '#8d5f3c'), roughness: 0.8 }));
    plaque.position.set(0, 2.35, PZ + 0.095); part.add(plaque);
    // trailing plants along the partition top
    for (const x of [-5.6, -3.1, 2.4, 4.9]) { const p = plant(0.55); part.add(at(p, x, 1.2, PZ)); }
    r.add(compactStatic(part));
    this.anchors.door = new THREE.Vector3(0, 1.9, 4.9);
  }

  _textTex(text, bg, fg) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 64);
    g.fillStyle = fg; g.font = '600 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  _buildFront() {
    const g = wallGroup();
    const z = HZ + T / 2;
    const frame = mat('#4f7f6a', { roughness: 0.5 }), sill = mat('#f4eadc', { roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({ color: '#dff0f2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, envMapIntensity: 1.2, depthWrite: false });
    this.frontGlass = glass;
    for (const [x0, x1] of [[-HX - T, -1.05], [1.05, HX + T]]) {
      const len = x1 - x0, cx = (x0 + x1) / 2;
      g.add(at(box(len, 0.5, T, sill), cx, 0.25, 0));
      g.add(at(box(len, 0.06, T + 0.04, frame), cx, 0.53, 0));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.1, 1.95), glass);
      pane.position.set(cx, 1.53, 0); pane.renderOrder = 2;
      g.userData.decor.push(pane); this.fx3d.add(at(pane, cx, 1.53, z));
      for (let k = 0; k <= 3; k++) g.add(at(box(0.07, 2.0, T, frame), x0 + 0.04 + (k * (len - 0.08)) / 3, 1.53, 0));
    }
    g.add(at(box(W + T * 2, 0.62, T, mat('#f7ecdf', { roughness: 0.9 })), 0, H - 0.31 + 0.05, 0));
    g.add(at(box(W + T * 2, 0.08, T + 0.04, frame), 0, 2.52, 0));
    for (const s of [-1, 1]) g.add(at(box(0.1, 2.5, T + 0.06, frame), s * 1.05, 1.25, 0));
    // outdoor sign over the door, and a striped awning across the windows
    const deco = new THREE.Group();
    const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.62 * 1.4), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.7 }));
    signBoard.position.set(0, 2.78, T / 2 + 0.05);
    deco.add(at(box(3.55, 0.95, 0.06, frame), 0, 2.78, T / 2 - 0.01), signBoard);
    const stripe = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 32;
      const x = c.getContext('2d');
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fbf3e4' : '#e98fa5'; x.fillRect(i * 32, 0, 32, 32); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(10, 1); return t;
    })();
    for (const s of [-1, 1]) {
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.9), new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.9, side: THREE.DoubleSide }));
      aw.rotation.x = -0.95; aw.position.set(s * 4.05, 2.32, T / 2 + 0.36); aw.castShadow = true;
      deco.add(aw);
      // window display: a little pyramid of product in each window
      for (let k = 0; k < 6; k++) {
        const sc = SCENTS[['rose', 'lavender', 'mint', 'citrus', 'vanilla', 'ocean'][k]];
        const p = productMesh(k % 3 === 1 ? 'bar' : k % 3 === 2 ? 'tub' : 'jar', sc.color, sc.accent);
        deco.add(at(p, s * (3.2 + (k % 3) * 0.35) - s * 0.2, 0.56 + (k >= 3 ? 0.14 : 0), -T / 2 - 0.25 - (k >= 3 ? 0.18 : 0)));
      }
    }
    g.add(deco); g.userData.decor.push(deco);
    g.position.set(0, 0, z);
    return g;
  }

  // Sidewalk, street, trees and lamps so the shop sits on a real Main Street.
  _buildStreet() {
    const r = this.root, y0 = -0.14;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ map: groundTexture(), transparent: true, roughness: 1, envMapIntensity: 0.2 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.16; ground.receiveShadow = true;
    r.add(ground);
    const walk = new THREE.Group();
    walk.add(at(box(26, 0.1, 2.6, mat('#e4dcd0', { roughness: 0.95 })), 0, y0 + 0.05, HZ + 1.45));
    for (let i = -12; i <= 12; i++) walk.add(at(box(0.02, 0.102, 2.6, mat('#d2c8b9')), i, y0 + 0.05, HZ + 1.45));
    walk.add(at(box(26, 0.16, 0.18, mat('#cfc6b8')), 0, y0 + 0.06, HZ + 2.8));
    walk.add(at(box(26, 0.04, 4.2, mat('#8d8a88', { roughness: 0.95 })), 0, y0 - 0.0, HZ + 4.95));
    for (let i = -6; i <= 6; i++) walk.add(at(box(1.2, 0.045, 0.14, mat('#f1e7d2')), i * 2, y0 + 0.003, HZ + 4.95));
    r.add(compactStatic(walk));
    const tree = (x, z, s) => {
      const t = group(at(cyl(0.09, 0.13, 1.5, mat('#9a7352', { roughness: 1 }), 10), 0, 0.75, 0), at(cyl(0.5, 0.5, 0.06, mat('#7a6a58'), 18), 0, 0.03, 0));
      [[0, 1.95, 0, 0.8], [0.45, 1.65, 0.1, 0.55], [-0.4, 1.7, -0.15, 0.6], [0.05, 2.45, 0.1, 0.5]].forEach(([a, b, c, rr], i) => t.add(at(sphere(rr, mat(i % 2 ? '#7fbf88' : '#69ad75', { roughness: 0.95 }), 14), a, b, c)));
      t.scale.setScalar(s);
      r.add(at(compactStatic(t), x, y0 + 0.1, z));
    };
    tree(-5.5, HZ + 2.2, 1); tree(5.6, HZ + 2.2, 0.95);
    this.streetLamps = [];
    for (const x of [-9.5, 9.5]) {
      const l = group(at(cyl(0.05, 0.07, 3.2, mat('#3f4a48', { metalness: 0.5, roughness: 0.4 }), 10), 0, 1.6, 0));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd98a', emissiveIntensity: 0.2 }));
      l.add(at(bulb, 0, 3.25, 0));
      r.add(at(l, x, y0 + 0.1, HZ + 2.4));
      this.streetLamps.push(bulb);
    }
    const bench = group(at(box(1.4, 0.06, 0.42, mat(PAL.wood)), 0, 0.45, 0), at(box(1.4, 0.36, 0.05, mat(PAL.wood)), 0, 0.68, -0.2));
    for (const s of [-1, 1]) bench.add(at(box(0.06, 0.45, 0.4, mat('#3f4a48')), s * 0.6, 0.22, 0));
    r.add(at(compactStatic(bench), -3.2, y0 + 0.1, HZ + 2.35));
    for (const x of [-2.2, 2.2]) r.add(at(plant(1.05), x, y0 + 0.1, HZ + 0.55));
    // neighbouring shopfronts so the street does not end at our walls
    for (const s of [-1, 1]) {
      const n = new THREE.Group();
      n.add(at(box(4.2, 3.4, 0.4, mat(s < 0 ? '#e7d3c0' : '#d5e2df', { roughness: 0.9 })), 0, 1.7, 0));
      n.add(at(box(3.0, 1.6, 0.05, mat('#bcd5da', { roughness: 0.2 })), 0, 1.4, 0.21));
      n.add(at(box(3.6, 0.35, 0.3, mat(s < 0 ? '#b07d58' : '#6f9c8e')), 0, 2.75, 0.3));
      r.add(at(compactStatic(n), s * 10.2, 0, HZ - 0.3));
    }
  }

  // ---- Back room: production, pantry, back stock, packing, the office laptop ------------
  _buildBackRoom() {
    const r = this.root;
    // production counter with two stations
    const cz = -HZ + 0.32;
    const counter = new THREE.Group();
    counter.add(at(box(4.0, 0.84, 0.62, mat('#f6efe2', { roughness: 0.7 }), 0.015), 0, 0.44, 0));
    counter.add(at(box(4.04, 0.05, 0.68, mat(PAL.wood, { roughness: 0.55 }), 0.012), 0, 0.885, 0.01));
    for (let i = 0; i < 5; i++) counter.add(at(box(0.74, 0.62, 0.02, mat('#fffaf0', { roughness: 0.6 }), 0.012), -1.6 + i * 0.8, 0.46, 0.315));
    r.add(at(compactStatic(counter), -4.5, 0, cz));
    this.stations = [this._station(0, -5.0, cz), this._station(1, -3.3, cz)];
    this._hit(1.3, 1.6, 0.9, -5.0, 0.8, cz + 0.1, 'station0');
    this._hit(1.3, 1.6, 0.9, -3.3, 0.8, cz + 0.1, 'station1');
    // stand mixer (upgrade)
    const pink = mat(PAL.blush, { roughness: 0.35 });
    this.mixer = group(at(box(0.2, 0.04, 0.3, pink, 0.015), 0, 0.02, 0), at(box(0.09, 0.3, 0.09, pink, 0.03), 0, 0.17, -0.1), at(box(0.13, 0.11, 0.3, pink, 0.045), 0, 0.34, -0.02), at(cyl(0.11, 0.07, 0.13, mat(PAL.metal, { metalness: 0.75, roughness: 0.25 }), 20), 0, 0.105, 0.07));
    this.mixer.position.set(-6.1, 0.91, cz); this.mixer.rotation.y = 0.4;
    r.add(this.mixer);

    // pantry along the left wall
    const pantry = shelfUnit(1.9, 1.85, 0.42, 4);
    pantry.rotation.y = Math.PI / 2; pantry.position.set(-HX + 0.24, 0, -3.5);
    r.add(pantry);
    this.pantry = pantry;
    this.pantryHolder = new THREE.Group(); pantry.add(this.pantryHolder);
    this._hit(0.7, 2, 1.9, -HX + 0.35, 1, -3.5, 'pantry');
    this.anchors.pantry = new THREE.Vector3(-HX + 0.3, 2.15, -3.5);

    // back stock shelving along the back wall
    this.stockUnits = [2.55, 4.95].map((x) => {
      const u = shelfUnit(2.2, 1.85, 0.42, 4);
      u.position.set(x, 0, -HZ + 0.24);
      r.add(u);
      const holder = new THREE.Group(); u.add(holder);
      return { u, holder };
    });
    this._hit(4.6, 2, 0.7, 3.75, 1, -HZ + 0.35, 'shelf');
    this.anchors.shelf = new THREE.Vector3(3.75, 2.2, -HZ + 0.35);

    // packing table
    const pk = new THREE.Group();
    const wood = mat(PAL.wood, { roughness: 0.6 });
    pk.add(at(box(1.45, 0.05, 0.75, wood, 0.012), 0, 0.82, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pk.add(at(box(0.06, 0.8, 0.06, mat(PAL.white, { roughness: 0.6 })), sx * 0.65, 0.4, sz * 0.3));
    for (let i = 0; i < 5; i++) pk.add(at(box(0.5, 0.012, 0.4, mat(i % 2 ? PAL.cardboard : PAL.cardboardDark, { roughness: 1 })), -0.3, 0.275 + i * 0.013, 0));
    pk.add(at(box(0.3, 0.02, 0.22, mat('#f7dfe4', { roughness: 1 })), 0.45, 0.855, 0.15));
    const pkStatic = compactStatic(pk);
    pkStatic.position.set(-0.25, 0, -HZ + 0.42);
    r.add(pkStatic);
    this.packBox = cardboardBox(0.34, 0.2, 0.26, false);
    this.packBox.position.set(-0.25, 0.845, -HZ + 0.5); this.packBox.visible = false;
    r.add(this.packBox);
    this.parcelPile = [];
    for (let i = 0; i < 4; i++) { const b = cardboardBox(0.36, 0.24, 0.28, true); b.position.set(-1.35 + (i % 2) * 0.1, (i >= 2 ? 0.24 : 0), -HZ + 0.4 + (i % 2) * 0.32); b.rotation.y = i * 0.3; b.visible = false; r.add(b); this.parcelPile.push(b); }
    this._hit(1.5, 1.3, 0.9, -0.25, 0.65, -HZ + 0.45, 'packing');
    this.anchors.packing = new THREE.Vector3(-0.25, 1.55, -HZ + 0.45);

    // office corner: desk + laptop
    const desk = new THREE.Group();
    desk.add(at(box(0.6, 0.045, 1.2, mat(PAL.woodLight, { roughness: 0.6 }), 0.01), 0, 0.75, 0));
    for (const s of [-1, 1]) desk.add(at(box(0.54, 0.74, 0.04, mat(PAL.white, { roughness: 0.6 })), 0, 0.37, s * 0.56));
    desk.add(at(cyl(0.045, 0.038, 0.09, mat(PAL.blush, { roughness: 0.4 }), 14), 0.1, 0.82, 0.42));
    const dk = compactStatic(desk);
    const lap = new THREE.Group();
    lap.add(at(box(0.25, 0.016, 0.36, mat('#d7d9dd', { metalness: 0.6, roughness: 0.35 }), 0.006), 0, 0.008, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), new THREE.MeshStandardMaterial({ map: screenTexture(), emissive: '#ffffff', emissiveMap: screenTexture(), emissiveIntensity: 0.55, roughness: 0.3 }));
    scr.rotation.y = -Math.PI / 2; scr.position.set(0.1, 0.13, 0);
    lap.add(scr, at(box(0.012, 0.24, 0.36, mat('#d7d9dd', { metalness: 0.6 }), 0.004), 0.115, 0.13, 0));
    dk.add(at(lap, -0.05, 0.775, -0.05));
    dk.position.set(HX - 0.42, 0, -3.25);
    r.add(dk);
    this._hit(0.8, 1.3, 1.3, HX - 0.4, 0.65, -3.25, 'laptop');
    this.anchors.laptop = new THREE.Vector3(HX - 0.4, 1.45, -3.25);
    // a stack of supply boxes for atmosphere
    for (const [x, z, s] of [[-6.4, -2.75, 1], [6.3, -4.6, 2]]) { let y = 0; for (let k = 0; k < s; k++) { const b = cardboardBox(0.5, 0.32, 0.4, true); b.position.set(x, y, z); b.rotation.y = k * 0.25; r.add(b); y += 0.32; } }
  }

  _station(id, x, cz) {
    const g = new THREE.Group();
    const steel = mat(PAL.metal, { metalness: 0.75, roughness: 0.28 });
    g.add(at(box(0.62, 0.025, 0.5, mat('#2f2b2a', { roughness: 0.35 }), 0.008), 0, 0.012, 0));
    const pot = new THREE.Group();
    pot.add(at(cyl(0.2, 0.19, 0.22, steel, 28), 0, 0.11, 0));
    for (const s of [-1, 1]) pot.add(at(box(0.07, 0.02, 0.05, mat(PAL.dark), 0.008), s * 0.23, 0.18, 0));
    const content = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.02, 28), new THREE.MeshStandardMaterial({ color: '#f2e2b6', roughness: 0.35 }));
    content.position.y = 0.2; pot.add(content);
    const spoon = cyl(0.012, 0.012, 0.42, mat(PAL.woodLight), 8);
    spoon.position.set(0.08, 0.3, 0); spoon.rotation.z = -0.5; pot.add(spoon);
    pot.position.y = 0.03; g.add(pot);
    const steam = [];
    for (let i = 0; i < 7; i++) {
      const p = sprite(sprites().soft, 0.2, { color: '#ffffff', opacity: 0 });
      p.userData.o = i / 7; p.userData.base = new THREE.Vector3(x, 0.91, cz);
      this.fx3d.add(p); steam.push(p);
    }
    g.position.set(x, 0.91, cz);
    this.root.add(g);
    this.anchors[`station${id}`] = new THREE.Vector3(x, 1.75, cz);
    return { g, pot, content, spoon, steam };
  }

  // ---- The till ---------------------------------------------------------------------
  _buildCounter() {
    const [i0, i1, j0] = STORE_FIXED.find((f) => f.id === 'counter').cells;
    const cx = X0 + ((i0 + i1 + 1) / 2) * CELL, cz = Z0 + (j0 + 0.5) * CELL;
    const g = new THREE.Group();
    const len = (i1 - i0 + 1) * CELL - 0.08;
    g.add(at(box(len, 0.92, 0.5, mat('#f4eadc', { roughness: 0.8 }), 0.02), 0, 0.46, 0));
    g.add(at(box(len + 0.06, 0.05, 0.62, mat(PAL.wood, { roughness: 0.5 }), 0.012), 0, 0.945, 0));
    for (let k = 0; k < 6; k++) g.add(at(box(0.05, 0.8, 0.02, mat('#bfd8c6')), -len / 2 + 0.25 + k * (len - 0.5) / 5, 0.44, 0.26));
    g.add(at(box(0.4, 0.06, 0.32, mat('#3d3531', { roughness: 0.4 }), 0.01), 0.5, 1.0, -0.05));
    g.add(at(box(0.3, 0.2, 0.04, mat('#3d3531', { roughness: 0.4 }), 0.01), 0.5, 1.12, -0.15));
    g.add(at(box(0.27, 0.15, 0.01, mat('#bfe3e0', { emissive: '#7fc7c0', emissiveIntensity: 0.4 })), 0.5, 1.13, -0.128));
    g.add(at(box(0.08, 0.02, 0.13, mat(PAL.dark)), 0.15, 0.98, 0.05));
    // paper bags and a sample tray
    for (let k = 0; k < 3; k++) g.add(at(box(0.28, 0.02, 0.18, mat(PAL.kraft, { roughness: 1 })), -0.7, 0.98 + k * 0.022, -0.05));
    g.add(at(cyl(0.16, 0.16, 0.02, mat(PAL.woodLight), 20), -0.25, 0.98, 0.08));
    ['#f09ab0', '#95dbb9', '#f8b84a'].forEach((c, k) => g.add(at(productMesh('jar', c, PAL.gold), -0.32 + k * 0.08, 0.99, 0.08 + (k % 2) * 0.05)));
    const counter = compactStatic(g);
    counter.position.set(cx, 0, cz);
    this.root.add(counter);
    this._hit(len, 1.3, 0.8, cx, 0.65, cz, 'counter');
    this.anchors.counter = new THREE.Vector3(cx, 1.9, cz);
  }

  _buildLights() {
    const r = this.root;
    this.pendants = [];
    for (const [x, z] of [[-3.8, 0.4], [-0.6, 2.4], [2.6, -0.4], [4.4, 3.2], [-4.2, 3.4]]) {
      const lamp = new THREE.Group();
      lamp.add(at(cyl(0.006, 0.006, 0.7, mat(PAL.dark), 6), 0, 0.35, 0));
      lamp.add(at(cyl(0.08, 0.26, 0.2, mat('#f6dfb0', { roughness: 0.6, side: THREE.DoubleSide }), 20), 0, -0.08, 0));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff3c9', emissive: '#ffd98a', emissiveIntensity: 2 }));
      lamp.add(at(bulb, 0, -0.14, 0));
      lamp.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      lamp.position.set(x, H - 0.25, z);
      r.add(lamp);
      const glow = sprite(sprites().soft, 1.3, { color: '#ffd28a', opacity: 0.3, blending: THREE.AdditiveBlending });
      glow.position.set(x, H - 0.45, z); this.fx3d.add(glow);
      this.pendants.push(glow);
    }
    this.shopLight = new THREE.PointLight('#ffd9a8', 9, 16, 1.4);
    this.shopLight.position.set(0, 2.8, 1.5);
    this.backLight = new THREE.PointLight('#fff0dc', 4, 10, 1.6);
    this.backLight.position.set(-1, 2.6, -4);
    r.add(this.shopLight, this.backLight);
  }

  // ---- Displays (player furniture) ------------------------------------------------------
  _model(type) {
    const g = new THREE.Group();
    if (type === 'shelf') {
      const wood = mat(PAL.woodLight, { roughness: 0.7 }), back = mat('#cfe0d2', { roughness: 0.9 }), dark = mat(PAL.wood, { roughness: 0.6 });
      for (const s of [-1, 1]) g.add(at(box(0.05, 1.62, 0.48, wood, 0.01), s * 0.95, 0.81, -0.05));
      g.add(at(box(1.9, 1.5, 0.03, back), 0, 0.85, -0.28));
      for (const y of [0.25, 0.69, 1.13]) { g.add(at(box(1.88, 0.035, 0.46, wood), 0, y, -0.05)); g.add(at(box(1.88, 0.05, 0.02, dark), 0, y + 0.02, 0.18)); }
      g.add(at(box(1.98, 0.06, 0.5, dark, 0.01), 0, 1.62, -0.05));
      g.add(at(box(1.9, 0.12, 0.44, mat('#efe3d0')), 0, 0.06, -0.05));
      g.add(at(box(1.2, 0.2, 0.04, mat(PAL.cream)), 0, 1.78, -0.2));
      g.add(at(box(1.24, 0.24, 0.03, dark), 0, 1.78, -0.22));
    } else if (type === 'table') {
      const top = mat(PAL.wood, { roughness: 0.5 }), cream = mat(PAL.cream, { roughness: 0.7 });
      g.add(at(cyl(0.68, 0.68, 0.05, top, 40), 0, 0.75, 0));
      g.add(at(cyl(0.7, 0.7, 0.02, mat(PAL.woodDark)), 0, 0.72, 0));
      g.add(at(cyl(0.08, 0.12, 0.72, mat(PAL.woodDark), 16), 0, 0.36, 0));
      g.add(at(cyl(0.38, 0.42, 0.04, mat(PAL.woodDark), 24), 0, 0.02, 0));
      g.add(at(cyl(0.3, 0.32, 0.2, cream, 28), 0, 0.875, 0));
      const runner = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.012, 6, 40), mat(PAL.blush));
      runner.rotation.x = Math.PI / 2; g.add(at(runner, 0, 0.778, 0));
      g.add(at(sphere(0.09, mat(PAL.leaf), 10), 0.05, 1.04, 0.0), at(sphere(0.07, mat('#f09ab0'), 8), -0.06, 1.06, 0.05));
    } else if (type === 'tester') {
      // tester bar: a counter with open sample jars, a mirror and a little sink
      const top = mat(PAL.cream, { roughness: 0.5 }), wood = mat(PAL.woodLight, { roughness: 0.7 });
      g.add(at(box(1.9, 0.86, 0.6, wood, 0.02), 0, 0.43, -0.1));
      g.add(at(box(1.96, 0.05, 0.66, top, 0.012), 0, 0.885, -0.1));
      g.add(at(box(1.2, 0.8, 0.04, mat('#dfeef0', { roughness: 0.05, metalness: 0.4 })), 0, 1.35, -0.38));
      g.add(at(box(1.28, 0.88, 0.03, mat(PAL.woodDark)), 0, 1.35, -0.4));
      g.add(at(cyl(0.12, 0.1, 0.06, mat(PAL.metal, { metalness: 0.7, roughness: 0.3 }), 18), 0.7, 0.92, -0.12));
      ['#f09ab0', '#95dbb9', '#f8b84a', '#b9a2e6', '#8fd0e6'].forEach((c, k) => {
        g.add(at(cyl(0.05, 0.05, 0.05, mat('#ffffff', { roughness: 0.2 }), 14), -0.75 + k * 0.28, 0.935, 0.05));
        g.add(at(cyl(0.045, 0.045, 0.012, mat(c, { roughness: 0.6 }), 14), -0.75 + k * 0.28, 0.96, 0.05));
      });
      g.add(at(box(0.5, 0.12, 0.03, mat(PAL.blush)), 0, 1.86, -0.38));
    } else if (type === 'bench') {
      const cush = mat('#e7a3b3', { roughness: 0.95 }), wood = mat(PAL.wood, { roughness: 0.6 });
      g.add(at(box(1.3, 0.12, 0.5, wood, 0.02), 0, 0.4, 0));
      g.add(at(box(1.24, 0.1, 0.46, cush, 0.04), 0, 0.5, 0));
      g.add(at(box(1.3, 0.45, 0.08, wood, 0.02), 0, 0.72, -0.22));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.06, 0.36, 0.06, mat(PAL.woodDark)), sx * 0.58, 0.18, sz * 0.18));
      g.add(at(box(0.3, 0.26, 0.12, mat('#cfe0d2', { roughness: 0.95 }), 0.05), -0.4, 0.66, -0.1));
    } else if (type === 'lamp') {
      const brass = mat(PAL.gold, { metalness: 0.75, roughness: 0.3 });
      g.add(at(cyl(0.16, 0.18, 0.03, brass, 20), 0, 0.015, 0));
      g.add(at(cyl(0.015, 0.015, 1.5, brass, 8), 0, 0.77, 0));
      g.add(at(cyl(0.12, 0.22, 0.26, mat('#fbf0d9', { roughness: 0.6, emissive: '#ffdca0', emissiveIntensity: 0.6, side: THREE.DoubleSide }), 20), 0, 1.6, 0));
    } else if (type === 'plant') {
      const p = plant(1.6);
      g.add(p);
      g.add(at(cyl(0.34, 0.34, 0.03, mat('#e2d4c0'), 20), 0, 0.015, 0));
    }
    return g;
  }

  _syncFurniture() {
    const st = this.game.state.store;
    const sig = st.furniture.map((f) => `${f.id}:${f.type}:${f.i}:${f.j}:${f.rot}`).join('|');
    if (sig !== this._sig.layout) {
      this._sig.layout = sig;
      const keep = new Set(st.furniture.map((f) => f.id));
      for (const [id, v] of this.views) if (!keep.has(id)) { this.root.remove(v.g); disposeMerged(v.g); this.views.delete(id); }
      for (const h of this.hits) { this.root.remove(h); const k = this.engine.interactables.indexOf(h); if (k >= 0) this.engine.interactables.splice(k, 1); }
      this.hits = [];
      for (const fu of st.furniture) {
        let v = this.views.get(fu.id);
        if (!v) {
          const g = new THREE.Group();
          g.add(compactStatic(this._model(fu.type)));
          const slots = fu.slots.map(() => { const h = new THREE.Group(); g.add(h); return { h, sig: null, tag: null }; });
          if (fu.type === 'shelf') slots.forEach((s, k) => { const tag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.012), mat('#ffffff', { roughness: 0.6 })); tag.position.set(k === 0 ? -0.47 : 0.47, 1.78, -0.18); tag.userData.keep = true; g.add(tag); s.tag = tag; });
          this.root.add(g);
          v = { g, slots, born: this.t };
          this.views.set(fu.id, v);
          if (this._ready) this.pop(g);
        }
        const c = furnitureCenter(fu);
        v.g.position.set(c.x, 0, c.z);
        v.g.rotation.y = fu.rot * Math.PI / 2;
        const fp = footprint(fu.type, fu.i, fu.j, fu.rot);
        const hw = (fp.i1 - fp.i0 + 1) * CELL, hd = (fp.j1 - fp.j0 + 1) * CELL;
        const hit = this._hit(Math.max(0.6, hw * 0.92), fu.type === 'plant' || fu.type === 'lamp' ? 1.7 : 1.8, Math.max(0.6, hd * 0.92), c.x, 0.9, c.z, `f:${fu.id}`);
        this.hits.push(hit);
        this.anchors[`f:${fu.id}`] = (this.anchors[`f:${fu.id}`] || new THREE.Vector3()).set(c.x, fu.type === 'shelf' ? 2.25 : 1.6, c.z);
      }
      this._ready = true;
    }
    // stock on each slot (rebuilt only when it changes)
    const s = this.game.state;
    for (const fu of st.furniture) {
      const v = this.views.get(fu.id);
      if (!v) continue;
      fu.slots.forEach((slot, k) => {
        const sv = v.slots[k];
        const sig = `${slot.skuId}:${slot.stock}`;
        if (sv.sig === sig) return;
        sv.sig = sig;
        disposeMerged(sv.h);
        sv.h.clear();
        const sku = slot.skuId && s.skus.find((x) => x.id === slot.skuId);
        if (sv.tag) sv.tag.material = mat(sku ? SCENTS[sku.scentId].color : '#efe5d6', { roughness: 0.6 });
        if (!sku || !slot.stock) return;
        const sc = SCENTS[sku.scentId], cont = PRODUCTS[sku.productId].container;
        for (let u = 0; u < Math.min(slot.stock, FURNITURE[fu.type].slotCap); u++) {
          const p = SLOT_LAYOUT[fu.type](k, u);
          const m = productMesh(cont, sc.color, sc.accent);
          m.position.set(p.x, p.y, p.z);
          m.rotation.y = fu.type === 'table' ? -Math.atan2(p.z, p.x) + Math.PI / 2 : 0;
          sv.h.add(m);
        }
        compactStatic(sv.h);
      });
    }
  }

  // ---- Build mode helpers -------------------------------------------------------------------
  _buildBuildMode() {
    // grid overlay: buildable cells light, reserved aisles hatched
    const [r0, r1] = STORE_ROWS.floor;
    const cols = STORE_GRID.cols, rows = r1 - r0 + 1, px = 24;
    const c = document.createElement('canvas'); c.width = cols * px; c.height = rows * px;
    const g = c.getContext('2d');
    const reserved = (i, j) => STORE_RESERVED.some((rr) => i >= rr[0] && i <= rr[1] && j >= rr[2] && j <= rr[3]) || STORE_FIXED.some((f) => i >= f.cells[0] && i <= f.cells[1] && j >= f.cells[2] && j <= f.cells[3]);
    for (let j = r0; j <= r1; j++) for (let i = 0; i < cols; i++) {
      const x = i * px, y = (j - r0) * px;
      if (reserved(i, j)) { g.fillStyle = 'rgba(233,128,155,0.28)'; g.fillRect(x, y, px, px); }
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.5; g.strokeRect(x + 1, y + 1, px - 2, px - 2);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(cols * CELL, rows * CELL), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(X0 + (cols * CELL) / 2, 0.015, Z0 + (r0 + rows / 2) * CELL);
    plane.visible = false;
    this.fx3d.add(plane);
    this.gridPlane = plane;
    this.ghostMat = { ok: new THREE.MeshBasicMaterial({ color: '#6fd3a0', transparent: true, opacity: 0.55, depthWrite: false }), bad: new THREE.MeshBasicMaterial({ color: '#ef7d8f', transparent: true, opacity: 0.55, depthWrite: false }) };
    this.ghosts = {};
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; pad.visible = false;
    this.fx3d.add(pad); this.ghostPad = pad;
    const sel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#e9809b', transparent: true, opacity: 0.35, depthWrite: false }));
    sel.rotation.x = -Math.PI / 2; sel.position.y = 0.025; sel.visible = false;
    this.fx3d.add(sel); this.selPad = sel;
  }
  setBuildMode(on) { this.build.on = on; this.gridPlane.visible = on; if (!on) { this.setGhost(null); this.setSelected(null); } }
  // ghost: { type, i, j, rot, ok } or null
  setGhost(gh) {
    for (const [type, gg] of Object.entries(this.ghosts)) gg.visible = !!gh && gh.type === type;
    this.ghostPad.visible = !!gh;
    if (!gh) return;
    if (!this.ghosts[gh.type]) {
      const m = this._model(gh.type);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      this.ghosts[gh.type] = m;
      this.fx3d.add(m);
    }
    const gg = this.ghosts[gh.type];
    const matl = gh.ok ? this.ghostMat.ok : this.ghostMat.bad;
    gg.traverse((o) => { if (o.isMesh) o.material = matl; });
    const fp = footprint(gh.type, gh.i, gh.j, gh.rot);
    const cx = X0 + ((fp.i0 + fp.i1 + 1) / 2) * CELL, cz = Z0 + ((fp.j0 + fp.j1 + 1) / 2) * CELL;
    gg.position.set(cx, 0.01, cz); gg.rotation.y = gh.rot * Math.PI / 2; gg.visible = true;
    this.ghostPad.scale.set((fp.i1 - fp.i0 + 1) * CELL, (fp.j1 - fp.j0 + 1) * CELL, 1);
    this.ghostPad.position.set(cx, 0.02, cz);
    this.ghostPad.material.color.set(gh.ok ? '#bff0d6' : '#f7b3bf');
  }
  setSelected(fid) {
    this.build.selected = fid;
    const fu = fid && this.game.state.store.furniture.find((f) => f.id === fid);
    this.selPad.visible = !!fu;
    if (!fu) return;
    const fp = footprint(fu.type, fu.i, fu.j, fu.rot);
    this.selPad.scale.set((fp.i1 - fp.i0 + 1) * CELL + 0.2, (fp.j1 - fp.j0 + 1) * CELL + 0.2, 1);
    const c = furnitureCenter(fu);
    this.selPad.position.set(c.x, 0.025, c.z);
    const v = this.views.get(fid);
    if (v) v.g.visible = !this.movingId || this.movingId !== fid;
  }
  setMoving(fid) {
    this.movingId = fid;
    for (const [id, v] of this.views) v.g.visible = id !== fid;
  }

  _buildHover() {
    const ring = new THREE.Group();
    const band = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.58, 48), new THREE.MeshBasicMaterial({ color: '#e9809b', transparent: true, opacity: 0.9, depthWrite: false }));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 40), new THREE.MeshBasicMaterial({ map: sprites().soft, color: '#f7a8bb', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.add(glow, band);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false;
    this.fx3d.add(ring); this.hoverRing = ring;
  }
  setHover(id) {
    this.hoverId = id;
    let p = null, size = 1;
    if (id && id.startsWith('f:')) {
      const fu = this.game.state.store.furniture.find((f) => `f:${f.id}` === id);
      if (fu) { const c = furnitureCenter(fu); p = c; size = fu.type === 'shelf' ? 1.9 : fu.type === 'table' ? 1.5 : 1; }
    } else if (id === 'counter') { p = { x: STORE_POINTS.register.x - 0.5, z: 1.25 }; size = 2; }
    else if (id && STORE_POINTS[id]) p = STORE_POINTS[id];
    this.hoverRing.visible = !!p && !this.build.on;
    if (p) { this.hoverRing.position.set(p.x, 0.03, p.z); this.hoverRing.userData.size = size; }
  }

  _buildBubbles() {
    this.bubbles = [];
    for (let i = 0; i < 18; i++) {
      const b = sprite(sprites().bubble, 0.12, { opacity: 0.9 });
      b.userData = { x: -6 + ((i * 2.7) % 12), z: -1.6 + ((i * 1.9) % 6.8), y: (i * 0.37) % 2.6, sp: 0.1 + (i % 5) * 0.035, ph: i, size: 0.1 + (i % 4) * 0.035 };
      this.fx3d.add(b); this.bubbles.push(b);
    }
  }

  // ---- Effects (same interface as the home) --------------------------------------------------
  burst(kind, anchor, count = 10) {
    const a = typeof anchor === 'string' ? this.anchors[anchor] : anchor;
    if (!a || this.particles.length > 120) return;
    const S = sprites();
    const tint = { spark: ['#ffe9a8', '#ffd0dc', '#ffffff'], coin: ['#ffffff'], bubble: ['#ffffff'] }[kind];
    for (let i = 0; i < count; i++) {
      const p = sprite(S[kind], 0.12, { color: tint[i % tint.length], blending: kind === 'spark' ? THREE.AdditiveBlending : THREE.NormalBlending });
      const ang = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 0.9;
      p.position.set(a.x, a.y - 0.45, a.z);
      p.userData = { vx: Math.cos(ang) * sp, vy: 1.4 + Math.random() * 1.3, vz: Math.sin(ang) * sp, life: 0, max: 0.8 + Math.random() * 0.5, size: kind === 'coin' ? 0.17 : 0.09 + Math.random() * 0.12, grav: kind === 'bubble' ? -0.4 : 3.2, rot: (Math.random() - 0.5) * 6 };
      this.fx3d.add(p); this.particles.push(p);
    }
  }
  tween(dur, fn, done) { this.fx.push({ t: 0, dur, fn, done }); }
  pop(obj) { this.tween(0.5, (k) => { const s = k < 1 ? 0.6 + Math.sin(k * Math.PI * 0.5) * 0.4 + Math.sin(k * Math.PI) * 0.12 : 1; obj.scale.set(s, s, s); }, () => obj.scale.set(1, 1, 1)); }
  shipParcel() {
    const b = cardboardBox(0.34, 0.2, 0.26, true);
    this.root.add(b);
    const from = new THREE.Vector3(-0.25, 0.85, -HZ + 0.5), to = new THREE.Vector3(-1.3, 0.05, -HZ + 0.55);
    this.tween(1.1, (k) => { const e = k * k * (3 - 2 * k); b.position.lerpVectors(from, to, e); b.position.y += Math.sin(k * Math.PI) * 0.6; b.rotation.y = k * 3; b.scale.setScalar(k > 0.8 ? Math.max(0.01, (1 - k) / 0.2) : 1); }, () => this.root.remove(b));
    this._parcels = Math.min(4, (this._parcels || 0) + 1);
  }
  deliverBox() {
    const b = cardboardBox(0.5, 0.36, 0.4, true);
    this.root.add(b);
    const from = new THREE.Vector3(-5.4, 3.2, -3.4), to = new THREE.Vector3(-5.9, 0.0, -2.9);
    this.tween(1.3, (k) => { const e = k * k * (3 - 2 * k); b.position.lerpVectors(from, to, e); b.scale.setScalar(k < 0.15 ? k / 0.15 : k > 0.85 ? Math.max(0.01, (1 - k) / 0.15) : 1); }, () => this.root.remove(b));
  }
  cheer(id) { const c = this.chars[id]; if (c) c.cheer(); }
  rebuildCharacters() { for (const c of Object.values(this.chars)) this.root.remove(c.root); this.chars = {}; }

  // ---- Characters -------------------------------------------------------------------------------
  _staffChar(actor) {
    const s = this.game.state;
    const rec = s.store.staff.find((x) => x.id === actor.id);
    const key = actor.id === 'founder' ? 'founder' : `${actor.id}:${rec ? rec.role : ''}`;
    let c = this.chars[actor.id];
    if (c && c.key !== key) { this.root.remove(c.root); c = null; }
    if (!c) {
      const look = actor.id === 'founder' ? founderLook(s.founder) : lookFor(rec ? rec.look : 'helper', { apron: ROLE_APRON[rec ? rec.role : 'associate'] });
      c = createCharacter(look);
      c.key = key;
      c.root.position.set(actor.x, 0, actor.z); c.root.rotation.y = actor.face;
      this.root.add(c.root);
      this.chars[actor.id] = c;
    }
    return c;
  }
  _acquire(look) {
    const key = lookKey(look);
    const list = this.pool.get(key);
    const c = list && list.length ? list.pop() : createCharacter(lookFor(look));
    c.poolKey = key;
    c.setCarry(null);
    this.root.add(c.root);
    return c;
  }
  _release(c) {
    this.root.remove(c.root);
    if (!this.pool.has(c.poolKey)) this.pool.set(c.poolKey, []);
    const list = this.pool.get(c.poolKey);
    if (list.length < 3) list.push(c);
  }
  _carry(kind, sku) {
    if (kind === 'basket') return () => {
      const g = new THREE.Group();
      g.add(at(box(0.3, 0.14, 0.2, mat('#c79a62', { roughness: 1 }), 0.02), 0, 0.07, 0));
      g.add(at(box(0.26, 0.02, 0.16, mat('#f4e3cf')), 0, 0.14, 0));
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 16, Math.PI), mat(PAL.woodDark)); h.position.y = 0.14; g.add(h);
      if (sku) { const sc = SCENTS[sku.scentId]; g.add(at(productMesh(PRODUCTS[sku.productId].container, sc.color, sc.accent), 0.04, 0.12, 0)); }
      g.position.set(0.18, -0.35, -0.2); g.scale.setScalar(0.9);
      return g;
    };
    if (kind === 'bag') return () => {
      const g = group(at(box(0.24, 0.3, 0.12, mat(PAL.kraft, { roughness: 1 }), 0.01), 0, 0.15, 0), at(box(0.245, 0.06, 0.125, mat(PAL.blush)), 0, 0.2, 0));
      g.position.set(0.22, -0.48, -0.25);
      return g;
    };
    if (kind === 'mop') return () => {
      const g = new THREE.Group();
      const h = cyl(0.012, 0.012, 1.3, mat(PAL.woodLight), 6); h.rotation.x = 0.5; g.add(at(h, 0, -0.1, 0.25));
      g.add(at(box(0.3, 0.05, 0.12, mat('#9fd0cc', { roughness: 1 }), 0.02), 0, -0.68, 0.55));
      return g;
    };
    if (kind === 'crate') return () => { const g = crate(); g.add(at(ingredientMesh('shea'), -0.08, 0.02, 0)); g.add(at(ingredientMesh('oil'), 0.09, 0.02, 0.02)); g.position.y = -0.1; return g; };
    return () => {
      const g = new THREE.Group();
      g.add(at(box(0.36, 0.02, 0.26, mat(PAL.woodLight)), 0, 0, 0));
      if (sku) { const sc = SCENTS[sku.scentId], cont = PRODUCTS[sku.productId].container; for (let i = 0; i < 6; i++) g.add(at(productMesh(cont, sc.color, sc.accent), -0.11 + (i % 3) * 0.11, 0.012, -0.06 + Math.floor(i / 3) * 0.12)); }
      g.position.y = -0.08;
      return g;
    };
  }
  _staffCarry(actor) {
    const s = this.game.state, task = actor.task;
    if (!actor.carrying) return [null, null];
    let sku = null;
    if (task && task.payload) sku = s.skus.find((k) => k.id === task.payload.skuId);
    else if (task && task.skuId) sku = s.skus.find((k) => k.id === task.skuId);
    else if (task && task.type === 'pack') { const o = s.orders.find((x) => x.id === task.orderId); if (o) sku = s.skus.find((k) => k.id === o.lines[0].skuId); }
    else if (task && task.type === 'collect') { const st = s.stations[task.stationId]; if (st && st.job) sku = s.skus.find((k) => k.id === st.job.skuId); }
    return [`${actor.carrying}:${sku ? sku.id : ''}:${task ? task.jobId || task.orderId || task.fid || '' : ''}`, this._carry(actor.carrying, sku)];
  }

  _moveChar(c, ent, dt, simDt, anim) {
    const p = c.root.position, k = 1 - Math.exp(-dt * 16);
    if (Math.hypot(ent.x - p.x, ent.z - p.z) > 3) p.set(ent.x, 0, ent.z); else { p.x += (ent.x - p.x) * k; p.z += (ent.z - p.z) * k; }
    let dy = ent.face - c.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    c.root.rotation.y += dy * (1 - Math.exp(-dt * 10));
    c.update(simDt, anim);
  }

  // ---- Per-frame sync ---------------------------------------------------------------------------
  update(dt) {
    const s = this.game.state, st = s.store;
    this.t += dt;
    const simDt = s.time.paused ? 0 : dt * s.time.speed;

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.fn(k);
      if (k >= 1) { this.fx.splice(i, 1); if (f.done) f.done(); }
    }

    // walls drop between the camera and the shop (except during the street-side opening shot)
    const cam = this.engine.camera.position;
    for (const [name, g] of Object.entries(this.walls)) {
      const [nx, nz] = this.wallNormals[name];
      const outside = (cam.x - g.position.x) * nx + (cam.z - g.position.z) * nz > 0.2;
      const target = outside && !(this.facadeShot && name === 'front') ? 0.06 : 1;
      g.userData.s += (target - g.userData.s) * (1 - Math.exp(-dt * 9));
      g.scale.y = g.userData.s;
      const show = g.userData.s > 0.75;
      for (const d of g.userData.decor) d.visible = show;
    }

    // daylight
    const day = s.time.t / DAY_LENGTH;
    const warm = Math.pow(Math.abs(day - 0.45) * 1.9, 2);
    const sun = this.engine.sun;
    sun.color.setRGB(1, 0.95 - warm * 0.2, 0.86 - warm * 0.42);
    sun.intensity = 2.6 - warm * 1.1;
    sun.position.set(-7 + day * 12, 11 - warm * 4, 8);
    this.engine.hemi.intensity = 0.56 - warm * 0.17;
    this.shopLight.intensity = 6 + warm * 12;
    this.backLight.intensity = 3 + warm * 4;
    for (const p of this.pendants) p.material.opacity = 0.16 + warm * 0.4;
    for (const b of this.streetLamps) b.material.emissiveIntensity = 0.2 + warm * 2.5;
    this._sky = this._sky || new THREE.Color();
    this.engine.setSky(this._sky.setRGB(0.955 + warm * 0.01, 0.89 - warm * 0.07, 0.83 - warm * 0.11, THREE.SRGBColorSpace));

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i], u = p.userData;
      u.life += dt;
      const k = u.life / u.max;
      if (k >= 1) { this.fx3d.remove(p); p.material.dispose(); this.particles.splice(i, 1); continue; }
      u.vy -= u.grav * dt;
      p.position.x += u.vx * dt; p.position.y += u.vy * dt; p.position.z += u.vz * dt;
      p.material.rotation += u.rot * dt;
      p.material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
      p.scale.setScalar(u.size * (k < 0.15 ? k / 0.15 : 1));
    }

    // production stations
    let anyRunning = false;
    s.stations.forEach((stn, i) => {
      const v = this.stations[i];
      v.g.visible = stn.unlocked;
      if (!stn.unlocked) { for (const p of v.steam) p.visible = false; return; }
      const big = s.upgrades.bigpot ? 1.25 : 1;
      v.pot.scale.setScalar(big);
      const sku = stn.job && s.skus.find((k) => k.id === stn.job.skuId);
      v.content.visible = !!sku && stn.phase !== 'prep';
      if (sku) v.content.material.color.set(SCENTS[sku.scentId].color);
      const running = stn.phase === 'running';
      anyRunning = anyRunning || running;
      v.spoon.visible = !!stn.job;
      if (running) { v.spoon.position.x = Math.cos(this.t * 3) * 0.08 * big; v.spoon.position.z = Math.sin(this.t * 3) * 0.08 * big; }
      for (const p of v.steam) {
        if (running || stn.phase === 'done') {
          const life = (this.t * (running ? 0.45 : 0.2) + p.userData.o) % 1, b = p.userData.base;
          p.position.set(b.x + Math.sin(p.userData.o * 20 + life * 3) * 0.09, b.y + 0.3 + life * 0.95, b.z + Math.cos(p.userData.o * 13 + life * 2) * 0.09);
          p.scale.setScalar((0.16 + life * 0.42) * big);
          p.material.opacity = Math.sin(life * Math.PI) * (running ? 0.42 : 0.16);
          p.visible = true;
        } else p.visible = false;
      }
    });
    this.mixer.visible = !!s.upgrades.mixer;

    // pantry and back stock
    const psig = INGREDIENT_ORDER.map((id) => s.ingredients[id] || 0).join(',');
    if (psig !== this._sig.pantry) {
      this._sig.pantry = psig;
      disposeMerged(this.pantryHolder); this.pantryHolder.clear();
      const ys = this.pantry.userData.ys, cap = ingredientCap(s);
      INGREDIENT_ORDER.forEach((id, i) => {
        const n = Math.min(4, Math.ceil(((s.ingredients[id] || 0) / Math.max(1, cap)) * 40));
        const shelf = 3 - Math.floor(i / 3), side = i % 3;
        for (let k = 0; k < n; k++) {
          const m = ingredientMesh(id);
          m.position.set(-0.8 + side * 0.6 + (k % 2) * 0.2 + (k >= 2 ? 0.1 : 0), ys[shelf], k >= 2 ? -0.08 : 0.08);
          this.pantryHolder.add(m);
        }
      });
      compactStatic(this.pantryHolder);
    }
    const gsig = s.skus.map((k) => s.goods[k.id]).join(',') + s.upgrades.goods;
    if (gsig !== this._sig.goods) {
      this._sig.goods = gsig;
      const list = [];
      for (const sku of s.skus) for (let i = 0; i < (s.goods[sku.id] || 0); i++) list.push(sku);
      const per = 4 * 2 * 9;
      this.stockUnits.forEach((u, ui) => {
        disposeMerged(u.holder); u.holder.clear();
        const ys = u.u.userData.ys;
        for (let n = 0; n < per; n++) {
          const sku = list[ui * per + n];
          if (!sku) break;
          const shelf = 3 - Math.floor(n / 18), row = Math.floor((n % 18) / 9), k = n % 9;
          const sc = SCENTS[sku.scentId];
          const m = productMesh(PRODUCTS[sku.productId].container, sc.color, sc.accent);
          m.position.set(-0.9 + k * 0.225, ys[shelf], row === 0 ? 0.09 : -0.08);
          u.holder.add(m);
        }
        compactStatic(u.holder);
      });
      this.stockUnits[1].u.visible = !!s.upgrades.goods || list.length > per;
    }
    const packer = s.actors.find((a) => a.task && a.task.type === 'pack' && a.task.i === 1 && a.task.timer >= 0);
    this.packBox.visible = !!packer;
    if (packer) this.packBox.scale.setScalar(0.5 + 0.5 * (packer.task.progress || 0));
    const queued = s.orders.filter((o) => o.status !== 'open').length;
    this.parcelPile.forEach((b, i) => { b.visible = i < Math.min(4, queued); });

    this._syncFurniture();
    this._syncMesses();

    // staff + founder
    for (const actor of s.actors) {
      const c = this._staffChar(actor);
      c.root.visible = !actor.away;
      this._moveChar(c, actor, dt, this.forceAnim ? dt : simDt, this.forceAnim || (s.time.paused ? 'idle' : actor.anim));
      const mopping = actor.task && actor.task.type === 'mop' && actor.task.timer >= 0;
      const [key, fac] = mopping ? ['mop', this._carry('mop')] : this._staffCarry(actor);
      c.setCarry(key, fac);
      (this.anchors[actor.id] = this.anchors[actor.id] || new THREE.Vector3()).set(c.root.position.x, 1.95, c.root.position.z);
    }
    for (const id of Object.keys(this.chars)) if (!s.actors.some((a) => a.id === id)) { this.root.remove(this.chars[id].root); delete this.chars[id]; delete this.anchors[id]; }

    // shoppers (pooled characters)
    const seen = new Set();
    for (const cu of st.customers) {
      seen.add(cu.id);
      let c = this.shoppers.get(cu.id);
      if (!c) { c = this._acquire(cu.look); c.root.position.set(cu.x, 0, cu.z); c.root.rotation.y = cu.face; this.shoppers.set(cu.id, c); }
      this._moveChar(c, cu, dt, simDt, s.time.paused ? 'idle' : cu.anim);
      const firstSku = cu.basket[0] && s.skus.find((k) => k.id === cu.basket[0].skuId);
      const kind = cu.paid ? 'bag' : cu.basket.length ? 'basket' : null;
      c.setCarry(kind ? `${kind}:${firstSku ? firstSku.id : ''}` : null, kind ? this._carry(kind, firstSku) : null);
      (this.anchors[`c:${cu.id}`] = this.anchors[`c:${cu.id}`] || new THREE.Vector3()).set(c.root.position.x, 2.0, c.root.position.z);
    }
    for (const [id, c] of this.shoppers) if (!seen.has(id)) { this._release(c); this.shoppers.delete(id); delete this.anchors[`c:${id}`]; }

    // ambient bubbles
    for (const b of this.bubbles) {
      const u = b.userData;
      u.y += dt * u.sp * (anyRunning ? 1.4 : 1);
      if (u.y > 2.8) u.y = 0.3;
      b.position.set(u.x + Math.sin(this.t * 0.6 + u.ph) * 0.25, u.y, u.z + Math.cos(this.t * 0.5 + u.ph * 2) * 0.25);
      const fade = Math.min(1, (u.y - 0.3) * 2, (2.8 - u.y) * 2);
      b.scale.setScalar(Math.max(0.001, fade) * u.size);
    }
    if (this.hoverRing.visible) { const sc = (this.hoverRing.userData.size || 1) * (1 + Math.sin(this.t * 5) * 0.06); this.hoverRing.scale.set(sc, sc, sc); }
  }

  dispose() {
    this.engine.scene.remove(this.root);
    this.engine.fxRoot.remove(this.fx3d);
    this.engine.interactables.length = 0;
    this.engine.configure({ bounds: { x: 3.5, z: 2.8, minDist: 6, maxDist: 21 }, shadow: 7 });
  }
}
