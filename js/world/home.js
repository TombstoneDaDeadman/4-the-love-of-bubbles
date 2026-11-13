// The home workshop: a compact kitchen-production room that visibly fills up as the
// business grows. Everything here is presentation; it reads sim state and never changes it.

import * as THREE from 'three';
import { mat, PAL, box, cyl, sphere, at, group, productMesh, cardboardBox, crate, plant, woodFloorTexture, tileTexture, rugTexture, signTexture, screenTexture, wallTexture, outsideTexture, groundTexture, sprites, sprite } from './kit.js';
import { createCharacter, founderLook, HELPER_LOOK } from './character.js';
import { INGREDIENTS, INGREDIENT_ORDER, PRODUCTS, SCENTS, POINTS, DAY_LENGTH } from '../data.js';
import { clutterLevel } from '../sim/business.js';
import { stationProgress } from '../sim/production.js';

const W = 8, D = 6.5, H = 2.7, T = 0.14;
const HX = W / 2, HZ = D / 2;

function wallGroup() {
  const g = new THREE.Group();
  g.userData.decor = [];
  g.userData.s = 1;
  return g;
}

export class HomeWorld {
  constructor(engine, game) {
    this.engine = engine;
    this.game = game;
    this.root = new THREE.Group();
    engine.scene.add(this.root);
    this.fx = [];
    this.chars = {};
    this.anchors = {}; // world positions for HTML overlays
    this.hoverId = null;
    this.t = 0;
    this._sig = {};
    this.fx3d = new THREE.Group();
    engine.fxRoot.add(this.fx3d);
    this.particles = [];
    this._buildShell();
    this._buildKitchen();
    this._buildPantry();
    this._buildGoodsShelf();
    this._buildPacking();
    this._buildDesk();
    this._buildDecor();
    this._buildClutter();
    this._buildBubbles();
    this._buildHover();
    this.rebuildCharacters();
  }

  // ---- Room shell -----------------------------------------------------------
  _buildShell() {
    const r = this.root;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(24, 64), new THREE.MeshStandardMaterial({ map: groundTexture(), transparent: true, roughness: 1, envMapIntensity: 0.2 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.16; ground.receiveShadow = true;
    r.add(ground);
    const slab = box(W + T * 2 + 0.1, 0.16, D + T * 2 + 0.1, mat('#e6d5bf'), 0.03);
    r.add(at(slab, 0, -0.08, 0));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: woodFloorTexture(), roughness: 0.5, envMapIntensity: 0.55 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floor.receiveShadow = true;
    r.add(floor);
    this._buildGarden();

    const base = mat(PAL.white, { roughness: 0.8 }), cap = mat('#e3d2bd');
    const panel = mat('#b9d4c0', { roughness: 0.85 }), rail = mat('#fffaf0', { roughness: 0.6 });
    const WH = 0.98; // wainscot height
    // `inward` is the direction (+1 / -1) of the room from the wall along its thin axis.
    const mk = (len, alongX, inward) => {
      const g = wallGroup();
      const tex = wallTexture(); tex.repeat.set(len * 0.62, 1.7);
      const wm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, envMapIntensity: 0.3 });
      const w = alongX ? box(len, H, T, wm) : box(T, H, len, wm);
      g.add(at(w, 0, H / 2, 0));
      const c = alongX ? box(len, 0.04, T + 0.02, cap) : box(T + 0.02, 0.04, len, cap);
      g.add(at(c, 0, H + 0.02, 0));
      // painted wainscot with a chair rail and slim battens
      const inLen = alongX ? W : D, off = inward * (T / 2 + 0.011);
      const add = (m, y, along) => g.add(alongX ? at(m, along, y, off) : at(m, off, y, along));
      add(alongX ? box(inLen, WH, 0.022, panel) : box(0.022, WH, inLen, panel), WH / 2, 0);
      add(alongX ? box(inLen, 0.05, 0.05, rail) : box(0.05, 0.05, inLen, rail), WH + 0.02, 0);
      const n = Math.round(inLen / 0.8);
      for (let i = 1; i < n; i++) {
        const p = -inLen / 2 + (i * inLen) / n;
        const b = alongX ? box(0.035, WH - 0.14, 0.03, panel) : box(0.03, WH - 0.14, 0.035, panel);
        add(b, WH / 2 + 0.03, p);
        b.castShadow = false;
      }
      return g;
    };
    this.walls = {
      back: at(mk(W + T * 2, true, 1), 0, 0, -HZ - T / 2),
      front: at(mk(W + T * 2, true, -1), 0, 0, HZ + T / 2),
      left: at(mk(D, false, 1), -HX - T / 2, 0, 0),
      right: at(mk(D, false, -1), HX + T / 2, 0, 0),
    };
    this.wallNormals = { back: [0, -1], front: [0, 1], left: [-1, 0], right: [1, 0] };
    for (const g of Object.values(this.walls)) r.add(g);
    // baseboards (stay with the floor so the footprint reads when walls are down)
    const bb = (len, alongX, x, z) => r.add(at(alongX ? box(len, 0.1, 0.03, base) : box(0.03, 0.1, len, base), x, 0.05, z));
    bb(W, true, 0, -HZ + 0.015); bb(W, true, 0, HZ - 0.015); bb(D, false, -HX + 0.015, 0); bb(D, false, HX - 0.015, 0);

    // Window on the back wall
    const win = new THREE.Group();
    const frame = mat(PAL.white, { roughness: 0.6 });
    const view = outsideTexture();
    const glass = new THREE.MeshStandardMaterial({ map: view, emissive: '#ffffff', emissiveMap: view, emissiveIntensity: 0.8, roughness: 0.15, envMapIntensity: 0.9 });
    this.glass = glass;
    win.add(at(box(1.9, 1.15, 0.02, glass), 0, 0, 0));
    win.add(at(box(2.02, 0.07, 0.07, frame), 0, 0.6, 0.02)); win.add(at(box(2.02, 0.07, 0.07, frame), 0, -0.6, 0.02));
    win.add(at(box(0.07, 1.25, 0.07, frame), -0.98, 0, 0.02)); win.add(at(box(0.07, 1.25, 0.07, frame), 0.98, 0, 0.02));
    win.add(at(box(0.045, 1.2, 0.05, frame), 0, 0, 0.02)); win.add(at(box(1.95, 0.045, 0.05, frame), 0, 0.12, 0.02));
    win.add(at(box(2.1, 0.05, 0.2, mat(PAL.woodLight)), 0, -0.66, 0.1));
    const herb = plant(0.42); win.add(at(herb, 0.6, -0.63, 0.12));
    const herb2 = plant(0.34); win.add(at(herb2, -0.65, -0.63, 0.12));
    // soft curtains
    for (const s of [-1, 1]) win.add(at(box(0.28, 1.4, 0.05, mat('#f7dfe4', { roughness: 1 }), 0.02), s * 1.12, 0.02, 0.07));
    const rod = at(cyl(0.015, 0.015, 2.7, mat(PAL.woodDark), 8), 0, 0.74, 0.08);
    rod.rotation.z = Math.PI / 2;
    win.add(rod);
    win.position.set(-1.45, 1.78, T / 2 + 0.012);
    this.walls.back.add(win); this.walls.back.userData.decor.push(win);

    // Brand sign above the desk
    const sign = new THREE.Group();
    sign.add(at(box(1.5, 0.78, 0.04, mat(PAL.woodLight)), 0, 0, 0));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.8 }));
    face.position.z = 0.022; sign.add(face);
    sign.position.set(2.35, 1.85, T / 2 + 0.02);
    this.walls.back.add(sign); this.walls.back.userData.decor.push(sign);

    // Door on the left wall
    const door = new THREE.Group();
    door.add(at(box(0.05, 2.08, 0.95, mat('#8fb9a0', { roughness: 0.7 }), 0.01), 0, 1.04, 0));
    door.add(at(box(0.07, 2.16, 0.07, frame), 0, 1.08, -0.51)); door.add(at(box(0.07, 2.16, 0.07, frame), 0, 1.08, 0.51));
    door.add(at(box(0.07, 0.07, 1.09, frame), 0, 2.15, 0));
    door.add(at(sphere(0.035, mat(PAL.gold, { metalness: 0.7, roughness: 0.3 }), 10), 0.05, 1.0, -0.36));
    door.add(at(box(0.012, 0.5, 0.5, glass), 0.03, 1.55, 0));
    door.position.set(T / 2 + 0.02, 0, 2.2);
    this.walls.left.add(door); this.walls.left.userData.decor.push(door);
    r.add(at(box(0.7, 0.012, 0.95, mat('#b8a48c', { roughness: 1 }), 0.005), -HX + 0.5, 0.008, 2.2)); // door mat
    this.anchors.door = new THREE.Vector3(-HX + 0.4, 1.3, 2.2);

    // Framed prints on the right wall
    const art = new THREE.Group();
    const cols = ['#f3c4cf', '#cfe0d2', '#f6dfb0'];
    cols.forEach((c, i) => {
      art.add(at(box(0.03, 0.5, 0.4, mat(PAL.woodLight)), 0, 0, (i - 1) * 0.55));
      art.add(at(box(0.034, 0.4, 0.3, mat(c)), -0.002, 0, (i - 1) * 0.55));
    });
    art.position.set(-T / 2 - 0.02, 1.9, 2.1);
    this.walls.right.add(art); this.walls.right.userData.decor.push(art);

    // Pendant lamp
    const lamp = new THREE.Group();
    lamp.add(at(cyl(0.008, 0.008, 0.5, mat(PAL.dark), 6), 0, 0.25, 0));
    lamp.add(at(cyl(0.1, 0.3, 0.24, mat('#f6dfb0', { roughness: 0.6, side: THREE.DoubleSide }), 24), 0, -0.1, 0));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff3c9', emissive: '#ffd98a', emissiveIntensity: 2 }));
    lamp.add(at(bulb, 0, -0.16, 0));
    lamp.position.set(0.2, 2.85, 0.2);
    lamp.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    r.add(lamp);
    this.lampLight = new THREE.PointLight('#ffd9a0', 6, 9, 1.6);
    this.lampLight.position.set(0.2, 2.5, 0.2);
    r.add(this.lampLight);

    // Glows, the sun patch on the floor and drifting dust: all transparent, all in the fx layer.
    const S = sprites();
    this.lampGlow = sprite(S.soft, 1.5, { color: '#ffd28a', opacity: 0.35, blending: THREE.AdditiveBlending });
    this.lampGlow.position.set(0.2, 2.68, 0.2);
    this.fx3d.add(this.lampGlow);
    this.windowGlow = sprite(S.soft, 3.6, { color: '#fff1d0', opacity: 0.22, blending: THREE.AdditiveBlending });
    this.windowGlow.position.set(-1.45, 1.8, -HZ + 0.25);
    this.fx3d.add(this.windowGlow);
    const patchTex = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const g = c.getContext('2d');
      g.filter = 'blur(9px)'; g.fillStyle = '#fff';
      for (const [x, y] of [[26, 26], [134, 26], [26, 134], [134, 134]]) g.fillRect(x, y, 96, 96);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.sunPatch = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.9), new THREE.MeshBasicMaterial({ map: patchTex, color: '#ffe9b8', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.sunPatch.rotation.x = -Math.PI / 2;
    this.sunPatch.position.set(-1.2, 0.02, -1.25);
    this.fx3d.add(this.sunPatch);
    this.motes = [];
    for (let i = 0; i < 22; i++) {
      const m = sprite(S.soft, 0.035 + (i % 3) * 0.012, { color: '#fff4d6', opacity: 0.5, blending: THREE.AdditiveBlending });
      m.userData = { x: -2.6 + ((i * 0.37) % 2.6), y: 0.3 + ((i * 0.53) % 1.9), z: -2.4 + ((i * 0.71) % 2.2), ph: i * 1.7 };
      this.fx3d.add(m); this.motes.push(m);
    }
  }

  // A little garden around the house so the room does not float in empty space.
  _buildGarden() {
    const r = this.root, y0 = -0.16;
    const bush = (x, z, s, flowers) => {
      const g = new THREE.Group();
      const cols = ['#6fae78', '#5c9c69', '#82bd87'];
      for (let i = 0; i < 5; i++) {
        const b = sphere(0.32 + (i % 3) * 0.08, mat(cols[i % 3], { roughness: 0.95 }), 12);
        b.position.set(Math.cos(i * 2.4) * 0.3, 0.22 + (i % 2) * 0.12, Math.sin(i * 2.4) * 0.3);
        b.scale.y = 0.82;
        g.add(b);
      }
      if (flowers) for (let i = 0; i < 7; i++) {
        const f = sphere(0.055, mat(flowers[i % flowers.length], { roughness: 0.6 }), 8);
        const a = i * 0.9;
        f.position.set(Math.cos(a) * 0.38, 0.42 + Math.sin(i * 1.7) * 0.14, Math.sin(a) * 0.38);
        g.add(f);
      }
      g.position.set(x, y0, z); g.scale.setScalar(s);
      r.add(g);
    };
    bush(-5.1, -2.6, 1.2, ['#f09ab0', '#fff3f6']); bush(-5.3, 0.4, 0.9); bush(-3.2, -4.3, 1.1); bush(1.6, -4.4, 1.3, ['#f8c65a', '#fff7dc']);
    bush(5.2, -1.8, 1.1, ['#b9a2e6', '#f2ecff']); bush(5.3, 2.2, 0.9); bush(3.0, 4.4, 1.2, ['#f09ab0', '#fff3f6']); bush(-2.2, 4.5, 1.0); bush(-0.2, -4.6, 0.8);
    // stepping stones to the front door, a mailbox, and today's parcels waiting for pickup
    for (let i = 0; i < 5; i++) {
      const st = cyl(0.34 - (i % 2) * 0.05, 0.36 - (i % 2) * 0.05, 0.05, mat(i % 2 ? '#d9cdbd' : '#cfc2b0', { roughness: 1 }), 14);
      st.scale.z = 0.75; st.rotation.y = i * 0.7;
      r.add(at(st, -4.9 - i * 0.72, y0 + 0.02, 2.2 + Math.sin(i * 1.3) * 0.22));
    }
    const post = group(at(box(0.08, 1.0, 0.08, mat(PAL.white, { roughness: 0.7 })), 0, 0.5, 0), at(box(0.26, 0.2, 0.42, mat(PAL.blush, { roughness: 0.5 }), 0.06), 0, 1.08, 0), at(box(0.02, 0.16, 0.1, mat('#d9685f')), 0.14, 1.16, 0.1));
    r.add(at(post, -5.0, y0, 3.25));
    // small tree
    const tree = group(at(cyl(0.09, 0.13, 1.3, mat('#9a7352', { roughness: 1 }), 10), 0, 0.65, 0));
    [[0, 1.7, 0, 0.75], [0.45, 1.45, 0.1, 0.5], [-0.4, 1.5, -0.15, 0.55], [0.05, 2.15, 0.1, 0.5]].forEach(([x, y, z, s], i) => tree.add(at(sphere(s, mat(i % 2 ? '#7fbf88' : '#69ad75', { roughness: 0.95 }), 14), x, y, z)));
    r.add(at(tree, 5.6, y0, -4.2));
  }

  _hit(w, h, d, x, y, z, id) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z);
    this.root.add(m);
    this.engine.addInteractable(m, id);
    return m;
  }

  // ---- Kitchen counter + production stations ---------------------------------
  _buildKitchen() {
    const r = this.root;
    const x0 = -3.85, x1 = 0.75, len = x1 - x0, cx = (x0 + x1) / 2, cz = -HZ + 0.34;
    const cab = mat('#f6efe2', { roughness: 0.7 });
    r.add(at(box(len, 0.84, 0.62, cab, 0.015), cx, 0.44, cz));
    r.add(at(box(len + 0.04, 0.05, 0.68, mat(PAL.wood, { roughness: 0.55 }), 0.012), cx, 0.885, cz + 0.01));
    r.add(at(box(len, 0.08, 0.56, mat('#d9cbb6')), cx, 0.04, cz - 0.02));
    const n = 6;
    for (let i = 0; i < n; i++) {
      const dx = x0 + (i + 0.5) * (len / n);
      r.add(at(box(len / n - 0.05, 0.62, 0.02, mat('#fffaf0', { roughness: 0.6 }), 0.012), dx, 0.46, cz + 0.315));
      const handle = at(cyl(0.012, 0.012, 0.12, mat(PAL.gold, { metalness: 0.6, roughness: 0.35 }), 8), dx, 0.7, cz + 0.335);
      handle.rotation.z = Math.PI / 2;
      r.add(handle);
    }
    // backsplash
    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.5), new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.35 }));
    tiles.position.set(cx, 1.16, -HZ + 0.006);
    this.walls.back.userData.decor.push(tiles); r.add(tiles); this.backsplash = tiles;
    // sink
    r.add(at(box(0.5, 0.03, 0.4, mat(PAL.metal, { metalness: 0.7, roughness: 0.3 }), 0.01), -1.32, 0.905, cz));
    r.add(at(box(0.42, 0.02, 0.32, mat('#9aa0a8', { metalness: 0.6, roughness: 0.4 })), -1.32, 0.915, cz));
    const tap = group(at(cyl(0.015, 0.015, 0.22, mat(PAL.metal, { metalness: 0.8, roughness: 0.25 }), 8), 0, 0.11, 0), at(cyl(0.013, 0.013, 0.14, mat(PAL.metal, { metalness: 0.8, roughness: 0.25 }), 8), 0, 0.21, 0.06));
    tap.children[1].rotation.x = Math.PI / 2;
    r.add(at(tap, -1.32, 0.91, cz - 0.2));

    this.stations = [this._buildStation(0, -2.3, cz), this._buildStation(1, -0.35, cz)];
    this._hit(1.2, 1.5, 0.9, -2.3, 0.85, cz + 0.1, 'station0');
    this._hit(1.0, 1.5, 0.9, -0.35, 0.85, cz + 0.1, 'station1');

    // Stand mixer (upgrade)
    const mixer = new THREE.Group();
    const pink = mat(PAL.blush, { roughness: 0.35 });
    mixer.add(at(box(0.2, 0.04, 0.3, pink, 0.015), 0, 0.02, 0));
    mixer.add(at(box(0.09, 0.3, 0.09, pink, 0.03), 0, 0.17, -0.1));
    const headGrp = new THREE.Group();
    headGrp.add(at(box(0.13, 0.11, 0.3, pink, 0.045), 0, 0, 0.08));
    const whisk = at(cyl(0.035, 0.012, 0.12, mat(PAL.metal, { metalness: 0.8, roughness: 0.3 }), 8), 0, -0.1, 0.16);
    headGrp.add(whisk);
    headGrp.position.set(0, 0.34, -0.1);
    mixer.add(headGrp);
    mixer.add(at(cyl(0.11, 0.07, 0.13, mat(PAL.metal, { metalness: 0.75, roughness: 0.25 }), 20), 0, 0.105, 0.07));
    mixer.position.set(-3.3, 0.91, cz);
    mixer.rotation.y = 0.4;
    r.add(mixer);
    this.mixer = mixer; this.mixerWhisk = whisk; this.mixerHead = headGrp;

    // utensil crock + cutting board, always there
    const crock = group(at(cyl(0.07, 0.06, 0.16, mat('#f2d9c9', { roughness: 0.5 }), 14), 0, 0.08, 0));
    for (let i = 0; i < 4; i++) { const u = cyl(0.008, 0.008, 0.3, mat(i % 2 ? PAL.woodDark : PAL.woodLight), 6); u.rotation.z = (i - 1.5) * 0.16; u.rotation.x = (i % 2 - 0.5) * 0.2; crock.add(at(u, (i - 1.5) * 0.02, 0.2, 0)); }
    r.add(at(crock, 0.45, 0.91, cz - 0.12));
  }

  _buildStation(id, x, cz) {
    const g = new THREE.Group();
    const steel = mat(PAL.metal, { metalness: 0.75, roughness: 0.28 });
    g.add(at(box(0.62, 0.025, 0.5, mat('#2f2b2a', { roughness: 0.35 }), 0.008), 0, 0.012, 0));
    g.add(at(cyl(0.16, 0.16, 0.006, mat('#514844'), 24), 0, 0.028, 0));
    const pot = new THREE.Group();
    pot.add(at(cyl(0.2, 0.19, 0.22, steel, 28), 0, 0.11, 0));
    for (const s of [-1, 1]) pot.add(at(box(0.07, 0.02, 0.05, mat(PAL.dark), 0.008), s * 0.23, 0.18, 0));
    const content = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.02, 28), new THREE.MeshStandardMaterial({ color: '#f2e2b6', roughness: 0.35 }));
    content.position.y = 0.2; pot.add(content);
    const spoon = cyl(0.012, 0.012, 0.42, mat(PAL.woodLight), 8);
    spoon.position.set(0.08, 0.3, 0); spoon.rotation.z = -0.5; pot.add(spoon);
    pot.position.y = 0.03;
    g.add(pot);
    if (id === 1) {
      // soap loaf mould + curing rack beside the hot plate
      const mould = group(at(box(0.36, 0.1, 0.14, mat(PAL.woodLight), 0.01), 0, 0.05, 0), at(box(0.32, 0.03, 0.1, mat('#d8c7f0', { roughness: 0.5 })), 0, 0.1, 0));
      g.add(at(mould, 0.52, 0, 0.05));
    }
    const steam = [];
    for (let i = 0; i < 9; i++) {
      const p = sprite(sprites().soft, 0.2, { color: '#ffffff', opacity: 0 });
      p.userData.o = i / 9;
      p.userData.base = new THREE.Vector3(x, 0.91, cz);
      this.fx3d.add(p); steam.push(p);
    }
    g.position.set(x, 0.91, cz);
    this.root.add(g);
    this.anchors[`station${id}`] = new THREE.Vector3(x, 1.75, cz);
    return { g, pot, content, spoon, steam };
  }

  // ---- Ingredient pantry -------------------------------------------------------
  _shelfUnit(w, h, d, shelves) {
    const g = new THREE.Group();
    const wood = mat(PAL.woodLight, { roughness: 0.75 });
    for (const s of [-1, 1]) g.add(at(box(0.04, h, d, wood), (s * w) / 2, h / 2, 0));
    g.add(at(box(w, h, 0.02, mat('#f1e3cd')), 0, h / 2, -d / 2 + 0.01));
    const ys = [];
    for (let i = 0; i < shelves; i++) {
      const y = 0.12 + (i * (h - 0.16)) / (shelves - 0.3);
      g.add(at(box(w, 0.035, d, wood), 0, y, 0));
      ys.push(y + 0.018);
    }
    g.add(at(box(w + 0.04, 0.04, d + 0.02, wood), 0, h, 0));
    g.userData.ys = ys;
    return g;
  }

  _ingredientMesh(id) {
    const c = INGREDIENTS[id].color;
    switch (id) {
      case 'shea': return group(at(cyl(0.085, 0.075, 0.13, mat('#fffaf0', { roughness: 0.5 }), 14), 0, 0.065, 0), at(cyl(0.088, 0.088, 0.02, mat(c), 14), 0, 0.138, 0));
      case 'oil': return group(at(cyl(0.05, 0.055, 0.17, mat('#d9a62e', { roughness: 0.2, transparent: true, opacity: 0.88 }), 12), 0, 0.085, 0), at(cyl(0.02, 0.03, 0.05, mat('#d9a62e', { roughness: 0.2 }), 10), 0, 0.195, 0), at(cyl(0.022, 0.022, 0.025, mat(PAL.dark), 10), 0, 0.23, 0));
      case 'soapbase': return group(at(box(0.17, 0.09, 0.13, mat(c, { roughness: 0.5 }), 0.015), 0, 0.045, 0), at(box(0.172, 0.03, 0.132, mat(PAL.teal)), 0, 0.045, 0));
      case 'sugar': return group(at(box(0.16, 0.19, 0.11, mat('#f4ead8', { roughness: 1 }), 0.04), 0, 0.095, 0), at(box(0.1, 0.07, 0.112, mat(PAL.blush)), 0, 0.1, 0));
      case 'fragrance': return group(at(cyl(0.032, 0.032, 0.09, mat('#7c62c4', { roughness: 0.2 }), 10), 0, 0.045, 0), at(cyl(0.014, 0.014, 0.04, mat(PAL.dark), 8), 0, 0.11, 0));
      case 'premium': return group(at(cyl(0.03, 0.036, 0.1, mat('#d9607f', { roughness: 0.15 }), 10), 0, 0.05, 0), at(sphere(0.022, mat(PAL.gold, { metalness: 0.7, roughness: 0.3 }), 8), 0, 0.12, 0));
      case 'jar': return group(at(cyl(0.05, 0.05, 0.08, mat('#dff0f2', { roughness: 0.1, transparent: true, opacity: 0.6 }), 12), 0, 0.04, 0), at(cyl(0.052, 0.052, 0.018, mat(PAL.gold, { metalness: 0.5, roughness: 0.4 }), 12), 0, 0.088, 0));
      default: return group(at(box(0.2, 0.05, 0.14, mat(PAL.kraft, { roughness: 1 })), 0, 0.025, 0), at(box(0.2, 0.052, 0.03, mat(PAL.blush)), 0, 0.025, 0));
    }
  }

  _buildPantry() {
    const r = this.root;
    this.pantrySlots = {};
    const perSlot = { shea: 3, oil: 3, soapbase: 3, sugar: 3, fragrance: 2, premium: 1, jar: 6, wrap: 8 };
    this.pantryPerSlot = perSlot;
    const units = [{ z: 0.35, on: true }, { z: -1.45, on: false }];
    this.pantryUnits = [];
    units.forEach((u, ui) => {
      const unit = this._shelfUnit(1.6, 1.85, 0.42, 4);
      unit.rotation.y = Math.PI / 2;
      unit.position.set(-HX + 0.24, 0, u.z);
      r.add(unit);
      this.pantryUnits.push(unit);
      const ys = unit.userData.ys;
      // two ingredients per shelf, 5 slots each
      INGREDIENT_ORDER.forEach((id, i) => {
        const shelf = 3 - Math.floor(i / 2), side = i % 2;
        for (let k = 0; k < 5; k++) {
          const m = this._ingredientMesh(id);
          const lx = -0.7 + side * 0.78 + (k % 3) * 0.2 + (k >= 3 ? 0.1 : 0);
          m.position.set(lx, ys[shelf], k >= 3 ? -0.08 : 0.08);
          m.rotation.y = (k * 1.3) % 1;
          m.visible = false;
          unit.add(m);
          (this.pantrySlots[id] = this.pantrySlots[id] || []).push({ m, unit: ui });
        }
      });
    });
    // interleave so unit 0 fills before unit 1
    for (const id of Object.keys(this.pantrySlots)) this.pantrySlots[id].sort((a, b) => a.unit - b.unit);
    this._hit(0.7, 2, 1.7, -HX + 0.35, 1, 0.35, 'pantry');
    this.anchors.pantry = new THREE.Vector3(-HX + 0.3, 2.15, 0.35);
  }

  // ---- Finished goods shelf ------------------------------------------------------
  _buildGoodsShelf() {
    const r = this.root;
    this.goodsUnits = [];
    this.goodsSlots = [];
    [{ z: -0.9 }, { z: 0.85 }].forEach((u, ui) => {
      const unit = this._shelfUnit(1.6, 1.85, 0.42, 4);
      unit.rotation.y = -Math.PI / 2;
      unit.position.set(HX - 0.24, 0, u.z);
      r.add(unit);
      this.goodsUnits.push(unit);
      const ys = unit.userData.ys;
      for (let s = 3; s >= 0; s--) for (let row = 0; row < 2; row++) for (let k = 0; k < 8; k++) {
        const holder = new THREE.Group();
        holder.position.set(-0.66 + k * 0.19, ys[s], row === 0 ? 0.09 : -0.08);
        unit.add(holder);
        this.goodsSlots.push({ holder, unit: ui, key: null });
      }
    });
    this.goodsSlots.sort((a, b) => a.unit - b.unit);
    this._hit(0.7, 2, 1.7, HX - 0.35, 1, -0.9, 'shelf');
    this.anchors.shelf = new THREE.Vector3(HX - 0.3, 2.15, -0.9);
  }

  // ---- Packing + shipping table ----------------------------------------------------
  _buildPacking() {
    const r = this.root;
    const g = new THREE.Group();
    const wood = mat(PAL.wood, { roughness: 0.6 });
    g.add(at(box(1.55, 0.05, 0.78, wood, 0.012), 0, 0.82, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.06, 0.8, 0.06, mat(PAL.white, { roughness: 0.6 })), sx * 0.7, 0.4, sz * 0.32));
    g.add(at(box(1.4, 0.03, 0.62, mat(PAL.white, { roughness: 0.6 })), 0, 0.25, 0));
    // flat-packed boxes underneath, tape, tissue
    for (let i = 0; i < 5; i++) g.add(at(box(0.5, 0.012, 0.4, mat(i % 2 ? PAL.cardboard : PAL.cardboardDark, { roughness: 1 })), -0.35, 0.275 + i * 0.013, 0));
    const tape = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 8, 18), mat('#efe4cf', { roughness: 0.5 }));
    tape.rotation.x = Math.PI / 2; tape.castShadow = true;
    g.add(at(tape, -0.55, 0.87, 0.22));
    g.add(at(box(0.3, 0.02, 0.22, mat('#f7dfe4', { roughness: 1 })), 0.5, 0.855, 0.2));
    g.add(at(box(0.3, 0.02, 0.22, mat('#cfe0d2', { roughness: 1 })), 0.53, 0.875, 0.18));
    // the box being packed
    const open = cardboardBox(0.34, 0.2, 0.26, false);
    open.position.set(0, 0.845, -0.05); open.visible = false;
    g.add(open); this.packBox = open;
    // label printer (upgrade)
    const printer = group(at(box(0.22, 0.13, 0.18, mat('#f4f0e8', { roughness: 0.4 }), 0.03), 0, 0.065, 0), at(box(0.14, 0.004, 0.1, mat(PAL.white)), 0, 0.11, 0.1), at(box(0.06, 0.02, 0.01, mat(PAL.teal)), 0.05, 0.1, 0.092));
    printer.position.set(0.52, 0.845, -0.2); printer.visible = false;
    g.add(printer); this.printer = printer;
    g.position.set(1.9, 0, 1.75);
    r.add(g);
    this.packing = g;
    this._hit(1.6, 1.3, 0.9, 1.9, 0.65, 1.75, 'packing');
    this.anchors.packing = new THREE.Vector3(1.9, 1.5, 1.75);
    // outgoing parcels pile near the door-side of the table
    this.parcels = [];
  }

  // ---- Laptop desk --------------------------------------------------------------
  _buildDesk() {
    const r = this.root, g = new THREE.Group();
    g.add(at(box(1.25, 0.045, 0.6, mat(PAL.woodLight, { roughness: 0.6 }), 0.01), 0, 0.75, 0));
    for (const sx of [-1, 1]) g.add(at(box(0.04, 0.74, 0.54, mat(PAL.white, { roughness: 0.6 })), sx * 0.58, 0.37, 0));
    const laptop = new THREE.Group();
    laptop.add(at(box(0.36, 0.016, 0.25, mat('#d7d9dd', { metalness: 0.6, roughness: 0.35 }), 0.006), 0, 0.008, 0));
    const lid = new THREE.Group();
    lid.add(at(box(0.36, 0.24, 0.012, mat('#d7d9dd', { metalness: 0.6, roughness: 0.35 }), 0.006), 0, 0.12, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), new THREE.MeshStandardMaterial({ map: screenTexture(), emissive: '#ffffff', emissiveMap: screenTexture(), emissiveIntensity: 0.55, roughness: 0.3 }));
    scr.position.set(0, 0.12, 0.008); lid.add(scr);
    lid.position.set(0, 0.012, -0.12); lid.rotation.x = -0.28;
    laptop.add(lid);
    g.add(at(laptop, -0.05, 0.775, 0.02));
    g.add(at(cyl(0.045, 0.038, 0.09, mat(PAL.blush, { roughness: 0.4 }), 14), 0.42, 0.82, 0.12));
    g.add(at(box(0.2, 0.03, 0.27, mat(PAL.teal, { roughness: 0.8 }), 0.006), -0.42, 0.79, 0.05));
    g.add(at(box(0.19, 0.025, 0.26, mat('#f6dfb0', { roughness: 0.8 }), 0.006), -0.41, 0.817, 0.06));
    // stool
    const stool = group(at(cyl(0.17, 0.17, 0.05, mat(PAL.blush, { roughness: 0.9 }), 20), 0, 0.5, 0));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = cyl(0.016, 0.016, 0.5, mat(PAL.woodDark), 8); leg.rotation.z = Math.cos(a) * 0.14; leg.rotation.x = -Math.sin(a) * 0.14; stool.add(at(leg, Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12)); }
    g.add(at(stool, 0.75, 0, 0.55));
    g.position.set(2.35, 0, -HZ + 0.33);
    r.add(g);
    this._hit(1.3, 1.3, 0.8, 2.35, 0.65, -HZ + 0.4, 'laptop');
    this.anchors.laptop = new THREE.Vector3(2.35, 1.45, -HZ + 0.4);
  }

  _buildDecor() {
    const r = this.root;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0.1, 0.01, 0.35); rug.receiveShadow = true;
    r.add(rug);
    r.add(at(plant(1.25), 3.5, 0, 2.75));
    r.add(at(plant(0.8), -3.6, 0, 3.0)); // by the door
    // wall shelf with keepsakes on the back wall, right of the window
    const sh = new THREE.Group();
    sh.add(at(box(1.0, 0.035, 0.2, mat(PAL.woodLight)), 0, 0, 0));
    ['#f09ab0', '#95dbb9', '#f8b84a', '#b9a2e6'].forEach((c, i) => sh.add(at(productMesh(i % 2 ? 'jar' : 'tub', c, PAL.gold), -0.36 + i * 0.24, 0.018, 0)));
    sh.position.set(0.15, 1.72, 0.2);
    this.walls.back.add(sh); this.walls.back.userData.decor.push(sh);
  }

  // ---- Clutter: the room gets crowded as the business outgrows it -----------------
  _buildClutter() {
    const spots = [
      [-1.9, 2.85, 0.1, 1], [-1.3, 2.9, -0.2, 2], [3.45, 1.9, 0.3, 1], [-0.5, 2.85, 0.15, 2], [-3.5, 1.25, 0.2, 1],
      [0.3, 2.9, -0.1, 3], [3.5, 2.05, -0.3, 2], [-2.6, 2.9, 0.4, 2], [1.35, -2.75, 0.2, 2], [2.95, 2.9, 0, 2],
      [-1.6, 2.2, 0.5, 2], [-0.6, 2.25, -0.3, 3], [3.3, -2.6, 0.2, 3], [0.9, 2.75, 0.6, 2], [-2.4, 2.2, 0.1, 3],
      [-1.0, 1.75, 0.3, 2], [0.1, 2.2, -0.5, 2], [0.7, 2.3, 0.4, 3],
    ];
    this.clutter = spots.map(([x, z, rot, stack], i) => {
      const g = new THREE.Group();
      let y = 0;
      for (let k = 0; k < stack; k++) {
        const w = 0.42 - k * 0.05 + ((i * 7 + k) % 3) * 0.04, h = 0.26 + ((i + k) % 3) * 0.05;
        const b = cardboardBox(w, h, w * 0.78, (i + k) % 3 !== 0);
        b.position.y = y; b.rotation.y = ((i * 3 + k * 5) % 7) * 0.09 - 0.3;
        g.add(b); y += h;
      }
      g.position.set(x, 0, z); g.rotation.y = rot;
      g.scale.setScalar(0.001); g.visible = false;
      this.root.add(g);
      return { g, threshold: 0.1 + (i / spots.length) * 0.85, s: 0 };
    });
  }

  _buildBubbles() {
    this.bubbles = [];
    for (let i = 0; i < 16; i++) {
      const b = sprite(sprites().bubble, 0.1 + (i % 4) * 0.035, { opacity: 0.9 });
      b.userData = { x: -3 + ((i * 2.7) % 6), z: -2.4 + ((i * 1.9) % 4.6), y: (i * 0.37) % 2.4, sp: 0.1 + (i % 5) * 0.035, ph: i, size: 0.1 + (i % 4) * 0.035 };
      this.fx3d.add(b); this.bubbles.push(b);
    }
  }

  _buildHover() {
    const ring = new THREE.Group();
    const band = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.58, 48), new THREE.MeshBasicMaterial({ color: '#e9809b', transparent: true, opacity: 0.9, depthWrite: false }));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 40), new THREE.MeshBasicMaterial({ map: sprites().soft, color: '#f7a8bb', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.add(glow, band);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false;
    this.fx3d.add(ring); this.hoverRing = ring;
  }

  // Short-lived sprite particles: 'spark' (a batch is ready), 'coin' (a sale), 'bubble' (stocking).
  burst(kind, anchor, count = 10) {
    const a = typeof anchor === 'string' ? this.anchors[anchor] : anchor;
    if (!a) return;
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
  setHover(id) {
    this.hoverId = id;
    const p = id && POINTS[id];
    this.hoverRing.visible = !!p;
    if (p) this.hoverRing.position.set(p.x, 0.03, p.z);
  }

  // ---- Characters -------------------------------------------------------------------
  rebuildCharacters() {
    for (const c of Object.values(this.chars)) this.root.remove(c.root);
    this.chars = {};
  }
  _char(actor) {
    if (!this.chars[actor.id]) {
      const look = actor.id === 'founder' ? founderLook(this.game.state.founder) : HELPER_LOOK;
      const c = createCharacter(look);
      c.root.position.set(actor.x, 0, actor.z);
      c.root.rotation.y = actor.face;
      this.root.add(c.root);
      this.chars[actor.id] = c;
    }
    return this.chars[actor.id];
  }
  _carryFactory(actor) {
    const s = this.game.state, task = actor.task;
    if (actor.carrying === 'crate') {
      return () => { const g = crate(); g.add(at(this._ingredientMesh('shea'), -0.08, 0.02, 0)); g.add(at(this._ingredientMesh('oil'), 0.09, 0.02, 0.02)); g.position.y = -0.1; return g; };
    }
    let sku = null;
    if (task && task.payload) sku = s.skus.find((k) => k.id === task.payload.skuId);
    if (task && task.type === 'pack') { const o = s.orders.find((x) => x.id === task.orderId); if (o) sku = s.skus.find((k) => k.id === o.lines[0].skuId); }
    return () => {
      const g = new THREE.Group();
      g.add(at(box(0.36, 0.02, 0.26, mat(PAL.woodLight)), 0, 0, 0));
      if (sku) {
        const sc = SCENTS[sku.scentId], cont = PRODUCTS[sku.productId].container;
        for (let i = 0; i < 6; i++) g.add(at(productMesh(cont, sc.color, sc.accent), -0.11 + (i % 3) * 0.11, 0.012, -0.06 + Math.floor(i / 3) * 0.12));
      }
      g.position.y = -0.08;
      return g;
    };
  }

  // ---- Effects -----------------------------------------------------------------------
  tween(dur, fn, done) { this.fx.push({ t: 0, dur, fn, done }); }
  shipParcel() {
    const b = cardboardBox(0.34, 0.2, 0.26, true);
    this.root.add(b);
    const from = new THREE.Vector3(1.9, 0.85, 1.7), to = new THREE.Vector3(-HX + 0.5, 0.1, 2.2);
    this.tween(1.5, (k) => {
      const e = k * k * (3 - 2 * k);
      b.position.lerpVectors(from, to, e);
      b.position.y += Math.sin(k * Math.PI) * 1.1;
      b.rotation.y = k * 4;
      b.scale.setScalar(k > 0.85 ? Math.max(0.01, (1 - k) / 0.15) : 1);
    }, () => this.root.remove(b));
  }
  deliverBox() {
    const b = cardboardBox(0.5, 0.36, 0.4, true);
    this.root.add(b);
    const from = new THREE.Vector3(-HX + 0.5, 0, 2.2), to = new THREE.Vector3(-HX + 0.7, 0.2, 0.5);
    this.tween(1.6, (k) => {
      const e = k * k * (3 - 2 * k);
      b.position.lerpVectors(from, to, e);
      b.position.y += Math.sin(k * Math.PI) * 0.7;
      b.scale.setScalar(k < 0.15 ? k / 0.15 : k > 0.85 ? Math.max(0.01, (1 - k) / 0.15) : 1);
    }, () => this.root.remove(b));
  }
  cheer(actorId) { const c = this.chars[actorId]; if (c) c.cheer(); }
  pulse(obj) {
    this.tween(0.45, (k) => { const s = 1 + Math.sin(k * Math.PI) * 0.14; obj.scale.set(s, s, s); }, () => obj.scale.set(1, 1, 1));
  }

  // ---- Per-frame sync -------------------------------------------------------------------
  update(dt) {
    const s = this.game.state;
    this.t += dt;
    const simDt = s.time.paused ? 0 : dt * s.time.speed;

    // tweens
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.fn(k);
      if (k >= 1) { this.fx.splice(i, 1); if (f.done) f.done(); }
    }

    // walls drop when they are between the camera and the room
    const cam = this.engine.camera.position;
    for (const [name, g] of Object.entries(this.walls)) {
      const [nx, nz] = this.wallNormals[name];
      const outside = (cam.x - g.position.x) * nx + (cam.z - g.position.z) * nz > 0.2;
      const target = outside ? 0.045 : 1;
      g.userData.s += (target - g.userData.s) * (1 - Math.exp(-dt * 9));
      g.scale.y = g.userData.s;
      const show = g.userData.s > 0.75;
      for (const d of g.userData.decor) d.visible = show;
    }

    // lighting through the day
    const day = s.time.t / DAY_LENGTH;
    const warm = Math.pow(Math.abs(day - 0.45) * 1.9, 2); // 0 at midday, ~1 at the ends
    const sun = this.engine.sun;
    sun.color.setRGB(1, 0.95 - warm * 0.2, 0.86 - warm * 0.42);
    sun.intensity = 2.7 - warm * 1.1;
    sun.position.set(-6 + day * 9, 9 - warm * 3.5, 6.5);
    this.engine.hemi.intensity = 0.56 - warm * 0.17;
    this.lampLight.intensity = 2.5 + warm * 13;
    this.glass.emissive.setRGB(0.8 + warm * 0.2, 0.86 - warm * 0.26, 0.9 - warm * 0.5);
    this._sky = this._sky || new THREE.Color();
    this.engine.setSky(this._sky.setRGB(0.955 + warm * 0.01, 0.89 - warm * 0.07, 0.83 - warm * 0.11, THREE.SRGBColorSpace));
    this.lampGlow.material.opacity = 0.18 + warm * 0.5;
    this.windowGlow.material.opacity = 0.26 - warm * 0.12;
    this.windowGlow.visible = this.walls.back.userData.s > 0.75;
    this.sunPatch.material.opacity = Math.max(0, 0.24 - warm * 0.2);
    this.sunPatch.position.x = -0.6 - day * 1.5;
    this.sunPatch.material.color.setRGB(1, 0.92 - warm * 0.2, 0.74 - warm * 0.3);
    for (const m of this.motes) {
      const u = m.userData;
      m.position.set(u.x + Math.sin(this.t * 0.25 + u.ph) * 0.3, u.y + Math.sin(this.t * 0.4 + u.ph * 2) * 0.2, u.z + Math.cos(this.t * 0.2 + u.ph) * 0.3);
      m.material.opacity = (0.25 + 0.25 * Math.sin(this.t * 0.9 + u.ph * 3)) * (1 - warm * 0.6);
    }

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

    // stations
    let anyRunning = false;
    s.stations.forEach((st, i) => {
      const v = this.stations[i];
      v.g.visible = st.unlocked;
      if (!st.unlocked) return;
      const big = s.upgrades.bigpot ? 1.25 : 1;
      v.pot.scale.set(big, big, big);
      const sku = st.job && s.skus.find((k) => k.id === st.job.skuId);
      v.content.visible = !!sku && st.phase !== 'prep';
      if (sku) v.content.material.color.set(SCENTS[sku.scentId].color);
      const running = st.phase === 'running';
      anyRunning = anyRunning || running;
      v.spoon.visible = !!st.job;
      if (running) { v.spoon.position.x = Math.cos(this.t * 3) * 0.08 * big; v.spoon.position.z = Math.sin(this.t * 3) * 0.08 * big; }
      for (const p of v.steam) {
        if (running || st.phase === 'done') {
          const life = (this.t * (running ? 0.45 : 0.2) + p.userData.o) % 1;
          const b = p.userData.base;
          p.position.set(b.x + Math.sin(p.userData.o * 20 + life * 3) * 0.09, b.y + 0.3 + life * 0.95, b.z + Math.cos(p.userData.o * 13 + life * 2) * 0.09);
          p.scale.setScalar((0.16 + life * 0.42) * big);
          p.material.opacity = Math.sin(life * Math.PI) * (running ? 0.42 : 0.16);
          p.visible = true;
        } else p.visible = false;
      }
    });
    this.mixer.visible = !!s.upgrades.mixer;
    if (anyRunning && simDt > 0) { this.mixerWhisk.rotation.y += dt * 22; this.mixerHead.rotation.z = Math.sin(this.t * 30) * 0.012; }
    this.printer.visible = !!s.upgrades.packing;

    // pantry: show containers in proportion to stock
    this.pantryUnits[1].visible = !!s.upgrades.pantry;
    const psig = INGREDIENT_ORDER.map((id) => s.ingredients[id]).join(',') + s.upgrades.pantry;
    if (psig !== this._sig.pantry) {
      this._sig.pantry = psig;
      for (const id of INGREDIENT_ORDER) {
        const slots = this.pantrySlots[id];
        const usable = s.upgrades.pantry ? slots.length : slots.length / 2;
        const n = Math.min(usable, Math.ceil(s.ingredients[id] / this.pantryPerSlot[id]));
        slots.forEach((sl, k) => { sl.m.visible = k < n; });
      }
    }

    // goods shelf: one mesh per unit in stock (up to what the shelves can show)
    this.goodsUnits[1].visible = !!s.upgrades.goods;
    const gsig = s.skus.map((k) => s.goods[k.id]).join(',') + s.upgrades.goods;
    if (gsig !== this._sig.goods) {
      this._sig.goods = gsig;
      const list = [];
      for (const sku of s.skus) for (let i = 0; i < (s.goods[sku.id] || 0); i++) list.push(sku);
      const usable = s.upgrades.goods ? this.goodsSlots.length : this.goodsSlots.length / 2;
      this.goodsSlots.forEach((slot, i) => {
        const sku = i < usable ? list[i] : null;
        const key = sku ? sku.id : null;
        if (key === slot.key) return;
        slot.key = key;
        slot.holder.clear();
        if (sku) {
          const sc = SCENTS[sku.scentId];
          slot.holder.add(productMesh(PRODUCTS[sku.productId].container, sc.color, sc.accent));
        }
      });
    }

    // packing box grows while someone packs
    const packer = s.actors.find((a) => a.task && a.task.type === 'pack' && a.task.i === 1 && a.task.timer >= 0);
    this.packBox.visible = !!packer;
    if (packer) this.packBox.scale.setScalar(0.5 + 0.5 * (packer.task.progress || 0));

    // clutter
    const cl = clutterLevel(s);
    for (const c of this.clutter) {
      const target = cl >= c.threshold ? 1 : 0;
      c.s += (target - c.s) * (1 - Math.exp(-dt * 4));
      c.g.visible = c.s > 0.02;
      if (c.g.visible) c.g.scale.setScalar(Math.max(0.001, c.s));
    }

    // characters
    for (const actor of s.actors) {
      const c = this._char(actor);
      const p = c.root.position;
      const k = 1 - Math.exp(-dt * 16);
      p.x += (actor.x - p.x) * k; p.z += (actor.z - p.z) * k;
      let dy = actor.face - c.root.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      c.root.rotation.y += dy * (1 - Math.exp(-dt * 10));
      c.update(this.forceAnim ? dt : simDt, this.forceAnim || (s.time.paused ? 'idle' : actor.anim));
      const carryKey = actor.carrying ? `${actor.carrying}:${actor.task ? actor.task.jobId || actor.task.orderId : ''}` : null;
      c.setCarry(carryKey, actor.carrying ? this._carryFactory(actor) : null);
      (this.anchors[actor.id] = this.anchors[actor.id] || new THREE.Vector3()).set(p.x, 1.95, p.z);
    }
    for (const id of Object.keys(this.chars)) {
      if (!s.actors.some((a) => a.id === id)) { this.root.remove(this.chars[id].root); delete this.chars[id]; }
    }

    // ambient bubbles
    for (const b of this.bubbles) {
      const u = b.userData;
      u.y += dt * u.sp * (anyRunning ? 1.6 : 1);
      if (u.y > 2.6) u.y = 0.3;
      b.position.set(u.x + Math.sin(this.t * 0.6 + u.ph) * 0.25, u.y, u.z + Math.cos(this.t * 0.5 + u.ph * 2) * 0.25);
      const fade = Math.min(1, (u.y - 0.3) * 2, (2.6 - u.y) * 2);
      b.scale.setScalar(Math.max(0.001, fade) * u.size * (1 + Math.sin(this.t * 2 + u.ph) * 0.06));
    }

    if (this.hoverRing.visible) {
      const sc = 1 + Math.sin(this.t * 5) * 0.06;
      this.hoverRing.scale.set(sc, sc, sc);
    }
  }

  dispose() {
    this.engine.scene.remove(this.root);
    this.engine.fxRoot.remove(this.fx3d);
    this.engine.interactables.length = 0;
  }
}

export { stationProgress };
