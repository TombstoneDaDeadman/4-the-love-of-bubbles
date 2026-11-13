// GameBootstrap: starts the engine, shows the title screen, creates or loads a game and runs
// the main loop. Systems live in sim/ (rules), world/ (3D presentation) and ui/ (interface).

import { Engine } from './world/engine.js';
import { HomeWorld } from './world/home.js';
import { StoreWorld } from './world/store.js';
import { openStore } from './sim/store.js';
import { Game, newGameState } from './sim/core.js';
import { tick } from './sim/business.js';
import { saveGame, loadGame, hasSave, clearSave } from './sim/save.js';
import { GameUI } from './ui/ui.js';
import { FOUNDER_OPTIONS } from './data.js';
import { unlockAudio, sfx, audioSettings, setMusic, setSfx } from './audio.js';

const PREFS_KEY = 'ftlob.prefs';
const storage = (() => { try { localStorage.setItem('ftlob.t', '1'); localStorage.removeItem('ftlob.t'); return localStorage; } catch (e) { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; } })();

const uiRoot = document.getElementById('ui');
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const app = {
  engine: null, world: null, game: null, ui: null, fps: 60,
  mode: 'title', // title | creator | play
  save(quiet) { if (app.mode === 'play' && app.game) saveGame(storage, app.game.state); },
  savePrefs() { try { storage.setItem(PREFS_KEY, JSON.stringify({ music: audioSettings.music, sfx: audioSettings.sfx, gfx: app.engine.quality })); } catch (e) { /* ignore */ } },
  setQuality(q, save) { app.engine.setQuality(q); app.autoQuality = false; if (save) app.savePrefs(); },
  quitToTitle() { showTitle(); },
  // Era switch: the whole business moves to Main Street.
  openStore() {
    const r = openStore(app.game);
    if (!r.ok) { if (app.ui) app.ui.toast('⚠️', r.reason, '', 'bad'); return; }
    startGame(app.game.state, { intro: true });
  },
  // Diagnostics: fast-forward the simulation by a number of sim-seconds (ignores game speed).
  advance(seconds) { const t = app.game.state.time, sp = t.speed, p = t.paused; t.speed = 1; t.paused = false; for (let i = 0; i < seconds * 5; i++) tick(app.game, 0.2); t.speed = sp; t.paused = p; },
};
window.__ftlob = app; // handy for diagnostics in the console

function loadPrefs() {
  try {
    const p = JSON.parse(storage.getItem(PREFS_KEY) || '{}');
    audioSettings.music = p.music === true;
    if (p.sfx === false) setSfx(false);
    if (p.gfx === 'low' || p.gfx === 'high') { app.engine.setQuality(p.gfx); app.autoQuality = false; }
  } catch (e) { /* ignore */ }
}

function fadeIn() {
  const f = document.getElementById('fade');
  if (!f) return;
  f.classList.remove('run'); void f.offsetWidth; f.classList.add('run');
}

function setWorld(state) {
  fadeIn();
  if (app.ui) { app.ui.destroy(); app.ui = null; }
  if (app.world) app.world.dispose();
  uiRoot.innerHTML = '';
  app.game = new Game(state);
  app.world = state.era === 'store' ? new StoreWorld(app.engine, app.game) : new HomeWorld(app.engine, app.game);
}

// ---- Title ------------------------------------------------------------------

function showTitle() {
  app.mode = 'title';
  const preview = newGameState({ name: 'Founder' }, 2024);
  preview.time.paused = true;
  preview.goods.sku1 = 6; preview.goods.sku2 = 8; preview.goods.sku3 = 6;
  setWorld(preview);
  Object.assign(app.engine.goal, { x: 0, z: 0.1, dist: 15.5, pitch: 0.72 });
  app.engine.enabled = false;
  const canContinue = hasSave(storage);
  const bubbles = Array.from({ length: 16 }, (_, i) => { const sz = 30 + ((i * 37) % 90); return `<span class="bub" style="left:${(i * 6.4 + 2) % 100}%;width:${sz}px;height:${sz}px;animation-duration:${9 + (i % 7) * 2.3}s;animation-delay:-${(i * 1.7) % 12}s"></span>`; }).join('');
  const t = el(`<div class="titlescreen">${bubbles}<div class="inner">
      <div class="logo"><span class="four">4</span><span class="l1">the love of</span><span class="l2">Bubbles</span></div>
      <div class="tag">A handmade bath &amp; body tycoon</div>
      <div class="menu">
        ${canContinue ? `<button class="btn lg teal" data-t="continue">Continue</button>` : ''}
        <button class="btn lg ${canContinue ? 'ghost' : ''}" data-t="new">New business</button>
      </div>
      <div class="foot">From a kitchen stovetop to a store of your own.</div>
    </div></div>`);
  uiRoot.append(t);
  t.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    unlockAudio(); sfx('pop');
    if (b.dataset.t === 'continue') {
      const st = loadGame(storage);
      if (st) return startGame(st);
      b.textContent = 'Save could not be read'; b.disabled = true;
      return;
    }
    if (canContinue && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Start over? Click again'; return; }
    showCreator();
  });
}

// ---- Founder creator ---------------------------------------------------------

function showCreator() {
  app.mode = 'creator';
  const founder = { name: '', skin: 3, hairStyle: 'bun', hairColor: 1, outfit: 0 };
  const state = newGameState({ ...founder, name: 'Founder' });
  state.time.paused = true;
  state.goods.sku1 = 6; state.goods.sku2 = 8; state.goods.sku3 = 6;
  setWorld(state);
  const eng = app.engine;
  eng.enabled = false;
  const narrow = window.innerWidth < 900;
  Object.assign(eng.goal, { x: narrow ? 0.2 : 1.5, z: 0.5, dist: narrow ? 9 : 7.2, pitch: 0.52, yaw: 0.45 });
  const actor = state.actors[0];
  actor.face = 0.45;
  app.world.forceAnim = 'wave';
  const F = FOUNDER_OPTIONS;
  const sw = (key, list) => `<div class="swatches">${list.map((c, i) => `<button data-k="${key}" data-v="${i}" style="background:${c}" class="${founder[key] === i ? 'on' : ''}" aria-label="${key} ${i + 1}"></button>`).join('')}</div>`;
  const styleNames = { bun: 'Top bun', afro: 'Afro', long: 'Long', bob: 'Bob', braids: 'Braids', short: 'Short' };
  const render = () => `
    <h2>Meet the founder</h2>
    <p class="muted" style="margin-top:-8px">Every jar starts with someone who cares. Who is running this kitchen?</p>
    <div><label for="fname">Your name</label><input id="fname" type="text" maxlength="14" placeholder="Type your name" value="${founder.name.replace(/"/g, '&quot;')}" autocomplete="off"></div>
    <div><label>Skin tone</label>${sw('skin', F.skin)}</div>
    <div><label>Hair</label><div class="pick">${F.hairStyle.map((h) => `<button data-k="hairStyle" data-v="${h}" class="${founder.hairStyle === h ? 'on' : ''}">${styleNames[h]}</button>`).join('')}</div></div>
    <div><label>Hair colour</label>${sw('hairColor', F.hairColor)}</div>
    <div><label>Favourite top</label>${sw('outfit', F.outfit)}</div>
    <div class="row" style="margin-top:4px"><button class="btn ghost" data-c="back">Back</button><button class="btn lg grow" data-c="go">Open for business</button></div>`;
  const panel = el(`<div class="creator">${render()}</div>`);
  uiRoot.append(panel);
  const apply = () => { Object.assign(state.founder, founder, { name: founder.name.trim() || 'Founder' }); app.world.rebuildCharacters(); };
  panel.addEventListener('input', (e) => { if (e.target.id === 'fname') founder.name = e.target.value; });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'fname') panel.querySelector('[data-c=go]').click(); });
  panel.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]'), c = e.target.closest('[data-c]');
    if (k) {
      const v = k.dataset.v;
      founder[k.dataset.k] = k.dataset.k === 'hairStyle' ? v : Number(v);
      sfx('click'); apply();
      const name = panel.querySelector('#fname').value;
      panel.innerHTML = render();
      panel.querySelector('#fname').value = name;
    } else if (c && c.dataset.c === 'back') { sfx('click'); showTitle(); }
    else if (c && c.dataset.c === 'go') {
      sfx('upgrade');
      clearSave(storage);
      startGame(newGameState({ ...founder, name: founder.name.trim() || 'Founder' }));
    }
  });
  setTimeout(() => { const i = panel.querySelector('#fname'); if (i && !narrow) i.focus(); }, 400);
}

// ---- Play ---------------------------------------------------------------------

const STORE_VIEW = () => ({ x: 0.2, z: 0.6, dist: window.innerWidth < 900 ? 29 : 23, pitch: 0.78, yaw: 0.55 });

function startGame(state, { intro = false } = {}) {
  state.time.paused = false;
  setWorld(state);
  app.mode = 'play';
  const eng = app.engine;
  eng.enabled = true;
  if (state.era === 'store') Object.assign(eng.goal, STORE_VIEW());
  else Object.assign(eng.goal, { x: 0, z: 0.1, dist: window.innerWidth < 900 ? 19 : 15.5, pitch: 0.72, yaw: 0.62 });
  app.ui = new GameUI(app);
  saveGame(storage, state);
  if (intro) {
    // Opening shot: stand on the sidewalk facing the new shop front, then rise over the roof.
    Object.assign(eng.goal, { x: 0, z: 4.6, dist: 12, pitch: 0.2, yaw: 0 });
    Object.assign(eng.cur, eng.goal);
    app.world.facadeShot = true;
    state.time.paused = true;
    setTimeout(() => {
      if (app.world.facadeShot === undefined) return;
      app.world.facadeShot = false;
      Object.assign(eng.goal, STORE_VIEW());
      state.time.paused = false;
      if (app.ui) { app.ui.toast('🏪', 'Open for business on Main Street!', 'Your first walk-in shoppers are on their way.', 'gold'); app.ui.refresh(true); }
    }, 3400);
  } else if (state.era === 'home' && state.milestone.leaseSigned) {
    app.ui.showMoveIn();
  } else if (state.time.day === 1 && state.time.t < 1 && !state.tutorial.done) {
    app.ui.toast('🫧', `Welcome, ${state.founder.name}!`, 'Your kitchen workshop is open.', 'gold');
  }
}

// ---- Main loop ------------------------------------------------------------------

function boot() {
  const canvas = document.getElementById('scene');
  try {
    app.engine = new Engine(canvas);
  } catch (e) {
    document.getElementById('boot').innerHTML = '<p style="max-width:420px;text-align:center;padding:20px">This game needs WebGL, which your browser could not start. Try a recent version of Chrome, Edge, Firefox or Safari.</p>';
    return;
  }
  loadPrefs();
  showTitle();

  let last = performance.now(), autosave = 0, spin = 0, slow = 0;
  app.autoQuality = app.autoQuality !== false;
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    app.fps += (1 / Math.max(dt, 0.001) - app.fps) * 0.05;
    // If the detailed renderer cannot hold a playable frame rate, quietly drop to the simple one.
    // Frames slower than 10 fps are ignored: that is a background tab, not a slow computer.
    if (app.autoQuality && app.engine.quality === 'high' && dt < 0.1) {
      slow = dt > 1 / 26 ? slow + dt : Math.max(0, slow - dt * 2);
      if (slow > 4) { app.setQuality('low', true); if (app.ui) app.ui.toast('\u2699\uFE0F', 'Switched to simpler graphics', 'For a smoother frame rate. Change it in the menu.'); }
    }
    if (app.mode === 'play') {
      tick(app.game, dt);
      autosave += dt;
      if (autosave > 30) { autosave = 0; app.save(true); }
    } else if (app.mode === 'title') {
      spin += dt;
      app.engine.goal.yaw = 0.62 + Math.sin(spin * 0.12) * 0.5;
    }
    // keep the room centred in the space the panels leave free
    const ui = app.ui, wide = window.innerWidth > 900;
    app.engine.setInsets(app.mode === 'play' && wide ? (ui && ui.panelId ? 480 : 96) : 0, app.mode === 'play' && wide ? 320 : 0);
    app.engine.update(dt);
    app.world.update(dt);
    if (app.ui) app.ui.update(dt);
    app.engine.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  requestAnimationFrame(() => { const b = document.getElementById('boot'); if (b) { b.classList.add('gone'); setTimeout(() => b.remove(), 900); } });

  window.addEventListener('beforeunload', () => app.save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) app.save(true); });
  window.addEventListener('pointerdown', unlockAudio, { once: true });
}

boot();
