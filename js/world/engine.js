// Renderer, lights and the management camera: an elevated three-quarter perspective view
// with 360° rotation, smooth zoom and bounded panning.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f7e7da');
    this.scene.fog = new THREE.Fog('#f7e7da', 30, 70);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 90);
    // Soft studio reflections so glass, metal and glazed surfaces read as materials.
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    // Transparent effects (steam, bubbles, sparkles) live here so ambient occlusion can skip them.
    this.fxRoot = new THREE.Group();
    this.scene.add(this.fxRoot);

    this.hemi = new THREE.HemisphereLight('#fff3e2', '#dcb999', 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 2.1);
    this.sun.position.set(-5, 9, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 30;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 5;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight('#ffd7c2', 0.3);
    this.fill.position.set(6, 5, -4);
    this.scene.add(this.fill);

    // Camera rig (cur eases toward goal)
    this.goal = { x: 0, z: 0.1, yaw: 0.62, pitch: 0.72, dist: 15.5 };
    this.cur = { ...this.goal };
    this.bounds = { x: 3.5, z: 2.8, minDist: 6, maxDist: 21 };
    this.interactables = [];
    this.raycaster = new THREE.Raycaster();
    this.onHover = null; this.onClick = null;
    this.enabled = true;
    this.keys = new Set();
    this.quality = 'high';
    this._buildComposer();
    this._bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Post-processing: ground-truth ambient occlusion for contact shadows, then tone mapping.
  _buildComposer() {
    try {
      const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      const composer = new EffectComposer(this.renderer, target);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const ao = new GTAOPass(this.scene, this.camera, 4, 4);
      ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.3, thickness: 1.2, scale: 1.25, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      ao.blendIntensity = 1.0;
      const aoRender = ao.render.bind(ao);
      ao.render = (...args) => { this.fxRoot.visible = false; try { aoRender(...args); } finally { this.fxRoot.visible = true; } };
      composer.addPass(ao);
      composer.addPass(new OutputPass());
      this.composer = composer; this.ao = ao;
    } catch (e) {
      this.composer = null; this.quality = 'low';
    }
  }

  setQuality(q) {
    this.quality = this.composer ? q : 'low';
    this.resize();
  }

  setSky(color) { this.scene.background.copy(color); this.scene.fog.color.copy(color); }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.25);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    // keep the room framed on narrow screens
    this.camera.fov = w / h < 1 ? 50 : 34;
    this.camera.updateProjectionMatrix();
  }

  _bindInput() {
    const c = this.canvas;
    let down = null, dragging = false;
    const pinch = new Map();
    let pinchDist = 0;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      c.setPointerCapture(e.pointerId);
      pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.size === 2) { const [a, b] = [...pinch.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, button: e.button, shift: e.shiftKey };
      dragging = false;
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (pinch.has(e.pointerId)) pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.size === 2) {
        const [a, b] = [...pinch.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist) this.zoom((pinchDist - d) * 0.03);
        pinchDist = d; dragging = true;
        return;
      }
      if (down) {
        const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
        if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { dragging = true; c.style.cursor = 'grabbing'; }
        if (dragging) {
          if (down.button === 1 || down.shift) this.pan(-dx * 0.012, -dy * 0.012);
          else { this.goal.yaw -= dx * 0.0055; this.goal.pitch = clamp(this.goal.pitch + dy * 0.0035, 0.5, 1.05); }
        }
        down.lx = e.clientX; down.ly = e.clientY;
      } else if (this.onHover) {
        const id = this.pick(e.clientX, e.clientY);
        c.style.cursor = id ? 'pointer' : 'grab';
        this.onHover(id, e);
      }
    });
    const up = (e) => {
      pinch.delete(e.pointerId);
      if (pinch.size < 2) pinchDist = 0;
      if (down && !dragging && down.button === 0 && this.onClick) this.onClick(this.pick(e.clientX, e.clientY), e);
      down = null; dragging = false; c.style.cursor = 'grab';
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { if (this.onHover) this.onHover(null); });
    c.addEventListener('wheel', (e) => { if (this.enabled) { e.preventDefault(); this.zoom(e.deltaY * 0.012); } }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // Reserve screen space (CSS px) covered by UI on the left and right; the view eases over.
  setInsets(left, right) { this.shiftGoal = (left - right) / 2; }

  zoom(d) { this.goal.dist = clamp(this.goal.dist + d, this.bounds.minDist, this.bounds.maxDist); }
  pan(dx, dy) {
    const s = this.goal.dist / 12, yaw = this.goal.yaw;
    this.goal.x = clamp(this.goal.x + (Math.cos(yaw) * dx + Math.sin(yaw) * dy) * s, -this.bounds.x, this.bounds.x);
    this.goal.z = clamp(this.goal.z + (-Math.sin(yaw) * dx + Math.cos(yaw) * dy) * s, -this.bounds.z, this.bounds.z);
  }
  focus(x, z, dist) { this.goal.x = x; this.goal.z = z; if (dist) this.goal.dist = dist; }

  addInteractable(mesh, id) { mesh.userData.interact = id; this.interactables.push(mesh); }

  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const hit = this.raycaster.intersectObjects(this.interactables, false)[0];
    return hit ? hit.object.userData.interact : null;
  }

  // world position -> CSS pixels
  project(v3) {
    const p = v3.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height, visible: p.z < 1 };
  }

  update(dt) {
    const k = this.keys, g = this.goal;
    if (this.enabled && k.size) {
      const sp = dt * 6;
      if (k.has('w') || k.has('arrowup')) this.pan(0, -sp);
      if (k.has('s') || k.has('arrowdown')) this.pan(0, sp);
      if (k.has('a') || k.has('arrowleft')) this.pan(-sp, 0);
      if (k.has('d') || k.has('arrowright')) this.pan(sp, 0);
      if (k.has('q')) g.yaw += dt * 1.6;
      if (k.has('e')) g.yaw -= dt * 1.6;
      if (k.has('=') || k.has('+')) this.zoom(-dt * 10);
      if (k.has('-')) this.zoom(dt * 10);
    }
    const e = 1 - Math.exp(-dt * 7);
    for (const key of Object.keys(this.cur)) this.cur[key] += (g[key] - this.cur[key]) * e;
    const c = this.cur;
    const cp = Math.cos(c.pitch), sp2 = Math.sin(c.pitch);
    this.camera.position.set(c.x + Math.sin(c.yaw) * cp * c.dist, 0.9 + sp2 * c.dist, c.z + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(c.x, 0.9, c.z);
    this.shift = (this.shift || 0) + ((this.shiftGoal || 0) - (this.shift || 0)) * e;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (Math.abs(this.shift) > 0.5) this.camera.setViewOffset(w, h, -this.shift, 0, w, h); else if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();
  }

  render() {
    if (this.quality === 'high' && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
