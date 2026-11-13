// In-game interface: HUD, navigation, panel drawer, orders rail, goal tracker, tutorial coach,
// toasts, world-anchored labels, modals and the developer diagnostics panel.

import { INGREDIENTS, PRODUCTS, SCENTS, CAMPAIGNS, UPGRADES, HOME_GOALS, DAY_LENGTH } from '../data.js';
import { productionPanel, suppliesPanel, recipesPanel, upgradesPanel, marketingPanel, reportsPanel, staffPanel, orderCards, money, esc, starStr, skuSwatch } from './panels.js';
import { queueBatch, cancelJob, stationProgress } from '../sim/production.js';
import { orderSupplies, batchNeeds, setPrice, setSkuPaused, createVariant, getSku, ingredientFree, unlockLine } from '../sim/inventory.js';
import { fulfillOrder, spawnOrder } from '../sim/orders.js';
import { buyUpgrade, startCampaign, homeGoals, homeProgress, signLease, clockLabel } from '../sim/business.js';
import { todayProfit, transact } from '../sim/economy.js';
import { sfx, audioSettings, setMusic, setSfx } from '../audio.js';
import { ICONS, productIcon } from './icons.js';
import { buildPanel, storePanel, displayPanel, storeStaffPanel } from './storePanels.js';
import { FURNITURE, STORE_GRID, STORE, STAFF_ROLES } from '../data.js';
import { placeFurniture, moveFurniture, rotateFurniture, sellFurniture, assignSlot, spawnCustomer, getFurniture, setRefill, rushSlot, buyLoyalty } from '../sim/store.js';
import { hireStaff, fireStaff, setStaffRole, staffRecord, setShift, trainStaff } from '../sim/staff.js';
import { checkPlacement, footprint } from '../sim/path.js';
import { storesPanel, locationCards } from './chainPanels.js';
import { currentId, withStore, storeName, transferStock, expansionGoals, storeIds } from '../sim/chain.js';
import { roleAllowed } from '../sim/staff.js';
import { LOCATION_ORDER, LOCATIONS, CHAIN } from '../data.js';

const NAV = [
  { id: 'production', label: 'Production', ico: ICONS.production, title: 'Production', sub: 'Queue batches and watch your stations' },
  { id: 'supplies', label: 'Supplies', ico: ICONS.supplies, title: 'Supplies', sub: 'Ingredients and packaging' },
  { id: 'recipes', label: 'Recipes', ico: ICONS.recipes, title: 'Recipe Book', sub: 'Products, formulas and prices' },
  { id: 'upgrades', label: 'Upgrades', ico: ICONS.upgrades, title: 'Workshop Upgrades', sub: 'Tools, storage and help' },
  { id: 'marketing', label: 'Marketing', ico: ICONS.marketing, title: 'Marketing', sub: 'Demand and campaigns' },
  { id: 'reports', label: 'Reports', ico: ICONS.reports, title: 'Reports', sub: 'Money, service and reviews' },
  { id: 'staff', label: 'Staff', ico: ICONS.staff, title: 'Staff', sub: 'Unlocks with your first store', locked: true },
];
const PANELS = { production: productionPanel, supplies: suppliesPanel, recipes: recipesPanel, upgrades: upgradesPanel, marketing: marketingPanel, reports: reportsPanel, staff: staffPanel, build: buildPanel, store: storePanel, display: displayPanel };

// Era II: the shop floor comes first; Build and Staff unlock.
const STORE_NAV = [
  { id: 'stores', label: 'Chain', ico: ICONS.chain, title: 'Your Shops', sub: 'Every location at a glance' },
  { id: 'store', label: 'Shop', ico: ICONS.store, title: 'Shop Floor', sub: 'Shoppers, displays and store rating' },
  { id: 'build', label: 'Build', ico: ICONS.build, title: 'Build Mode', sub: 'Place, move, rotate and sell fixtures' },
  { id: 'staff', label: 'Staff', ico: ICONS.staff, title: 'Staff', sub: 'Hire your team and set roles' },
  ...NAV.filter((n) => n.id !== 'staff').map((n) => (n.id === 'upgrades' ? { ...n, label: 'Equipment', title: 'Workroom Equipment', sub: 'Tools and storage for the back room' } : n)),
];
const HIDDEN_PANELS = { display: { id: 'display', title: 'Display', sub: 'Choose what this display shows' } };
const STORE_PANELS = { ...PANELS, staff: storeStaffPanel, stores: storesPanel };


const STORE_TUTORIAL = [
  { text: (n) => `Welcome to Main Street, ${n}! Shoppers walk in, browse your displays and pay at the till. With no cashier yet, you'll pop out of the workroom to ring them up. Open <b>Staff</b> to hire some help.`, nav: 'staff' },
  { text: () => `Lovely. Now <b>click a shelf or table</b> on the shop floor to choose which products it shows. Staff refill displays from your back stock.`, nav: 'store' },
  { text: () => `Open <b>Build</b> to add displays and plants, or move things around. A full, pretty shop brings in more shoppers.`, nav: 'build' },
  { text: () => `Keep the workroom cooking: empty displays send shoppers home disappointed. Your store rating and today's visitors sit in the bar below. Enjoy the shop!`, nav: null, last: true },
];

const FIXTURES = {
  station0: { name: 'Stovetop', hint: 'Click to open Production', panel: 'production' },
  station1: { name: 'Hot plate & curing rack', hint: 'Click to open Production', panel: 'production' },
  pantry: { name: 'Ingredient pantry', hint: 'Click to order supplies', panel: 'supplies' },
  shelf: { name: 'Finished-goods shelf', hint: 'Click to open the Recipe Book', panel: 'recipes' },
  packing: { name: 'Packing table', hint: 'Orders are packed and shipped here', panel: null },
  laptop: { name: 'Laptop', hint: 'Click for reports and reviews', panel: 'reports' },
};
const STORE_FIXTURES = {
  ...FIXTURES,
  shelf: { name: 'Back stock', hint: 'Finished goods waiting for the shop floor', panel: 'production' },
  packing: { name: 'Packing table', hint: 'Online orders are packed here', panel: null },
  counter: { name: 'The till', hint: 'Click for the shop floor overview', panel: 'store' },
};

const TUTORIAL = [
  { text: (n) => `Welcome to your kitchen workshop, ${n}! Let's make your very first batch. <b>Click the stove</b> in the room, or open <b>Production</b> on the left.`, nav: 'production' },
  { text: () => `Pick any recipe and press <b>Make batch</b>. The ingredients come straight out of your pantry.`, nav: null },
  { text: (n) => `${n} is on it! Batches take a little while to cook. You can speed up time with the <b>2×</b> and <b>3×</b> buttons at the top.`, nav: null },
  { text: () => `Fresh stock is on the shelf. Customer orders appear on the right. Press <b>Fulfill</b> on one you have the stock for, before its timer runs out.`, nav: null },
  { text: () => `Your first sale! 🎉 Ingredients will run low soon. <b>Click the pantry</b> (or open <b>Supplies</b>) and place an order.`, nav: 'supplies' },
  { text: () => `Perfect. Keep making, packing and restocking. When you can afford it, buy the <b>Stand Mixer</b> in <b>Upgrades</b> to finish every batch faster.`, nav: 'upgrades' },
  { text: () => `You're running a real business now. Better formulas in the <b>Recipe Book</b> earn better reviews, and the bar below tracks your road to a first store. Have fun!`, nav: null, last: true },
];

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

export class GameUI {
  constructor(app) {
    this.app = app;
    this.game = app.game;
    this.root = document.getElementById('ui');
    this.labelsRoot = document.getElementById('labels');
    this.panelId = null;
    this.panelHtml = '';
    this.cart = {};
    this.variant = { productId: 'butter', scentId: 'lavender', tier: 1 };
    this.goalOpen = false;
    this.labels = new Map();
    this.orderEls = new Map();
    this.cashShown = this.game.state.cash;
    this.acc = 1;
    this.hover = null;
    this.devOpen = false;
    this.unsub = [];
    this.isStore = this.game.state.era === 'store';
    this.navList = this.isStore ? STORE_NAV : NAV;
    this.panels = this.isStore ? STORE_PANELS : PANELS;
    this.fixtures = this.isStore ? STORE_FIXTURES : FIXTURES;
    this.bm = { placing: null, moving: null, rot: 0, i: 0, j: 0, ok: false, selected: null, reason: '' };
    this.inspectId = null;
    this.transfer = { from: 'main', to: null, items: {} };
    this.isBranch = this.isStore && currentId(this.game.state) !== 'main';
    this._build();
    this._bindGame();
    this._onKey = (e) => this._key(e);
    window.addEventListener('keydown', this._onKey);
    this.refresh(true);
  }

  // ---- DOM ------------------------------------------------------------------
  _build() {
    const r = this.root;
    this.hud = el(`<div class="hud">
      <div class="brand"><div class="brand-mark">4</div><div class="brand-name"><small>the love of</small><b>Bubbles</b></div></div>
      ${this.isStore ? `<button class="storepill" data-act="nav" data-id="stores" title="Your shops"><span class="ico">${ICONS.store}</span><span data-h="storename"></span></button>` : ''}
      <div class="stat cash" data-h="cashbox" title="Cash on hand"><div class="ico">${ICONS.cash}</div><div><div class="lbl">Cash</div><div class="val" data-h="cash"></div></div></div>
      <div class="stat profit" title="Today's revenue minus today's expenses"><div class="ico" style="background:var(--green-soft)">${ICONS.profit}</div><div><div class="lbl">Today's profit</div><div class="val" data-h="profit"></div></div></div>
      <div class="stat" title="Reputation: the average of your recent customer reviews"><div class="ico">${ICONS.star}</div><div><div class="lbl">Reputation</div><div class="val"><span data-h="rep"></span> <span class="stars">★★★★★<i data-h="repstars">★★★★★</i></span></div></div></div>
      <div class="stat soul" title="Brand Soul: does the business still feel handmade, generous and reliable?"><div class="ico" style="background:var(--blush-soft)">${ICONS.heart}</div><div><div class="lbl">Brand Soul</div><div class="val" style="display:flex;align-items:center;gap:7px"><span data-h="soul"></span><span class="meter"><i data-h="soulbar"></i></span></div></div></div>
      <div class="stat orders-stat" title="Customers waiting on an order"><div class="ico" style="background:var(--teal-soft)">${ICONS.bag}</div><div><div class="lbl">Customers</div><div class="val" data-h="cust"></div></div></div>
      <div class="spacer"></div>
      <div class="clock"><div class="dayring" data-h="ring"></div><div><div class="day" data-h="day"></div><div class="time" data-h="time"></div></div></div>
      <div class="speed" data-h="speed">
        <button data-act="speed" data-id="0" class="pause" title="Pause (Space)">${ICONS.pause}</button><button data-act="speed" data-id="1" title="Normal speed (1)">1×</button><button data-act="speed" data-id="2" title="Fast (2)">2×</button><button data-act="speed" data-id="3" title="Faster (3)">3×</button>
      </div>
      <button class="icon-btn" data-act="menu" title="Menu (Esc)" style="width:38px;height:38px;font-size:17px">${ICONS.menu}</button>
    </div>`);
    this.h = {};
    this.hud.querySelectorAll('[data-h]').forEach((n) => { this.h[n.dataset.h] = n; });

    this.nav = el(`<nav class="nav">${this.navList.map((n) => `<button data-act="nav" data-id="${n.id}" class="${n.locked ? 'locked' : ''}" title="${n.title}"><span class="ico">${n.ico}</span>${n.label}</button>`).join('')}</nav>`);
    this.panel = el(`<aside class="panel" hidden><div class="panel-head"><div style="flex:1"><h2></h2><div class="sub"></div></div><button class="icon-btn" data-act="closepanel" title="Close">${ICONS.close}</button></div><div class="panel-body"></div></aside>`);
    this.orders = el(`<aside class="orders"><div class="orders-head"><h2>${this.isStore ? 'Online orders' : 'Orders'}</h2><span class="chip" data-h="ordcount"></span></div><div class="orders-auto" hidden style="padding:8px 14px 0"><span class="toggle" data-act="auto"><i></i>${this.isStore ? 'Auto-fulfill when in stock' : 'Helper auto-fulfills'}</span></div><div class="orders-list"></div></aside>`);
    this.ordersList = this.orders.querySelector('.orders-list');
    this.ordCount = this.orders.querySelector('[data-h=ordcount]');
    this.autoWrap = this.orders.querySelector('.orders-auto');
    this.goal = el(`<div class="goal" data-act="goal"></div>`);
    this.coach = el(`<div class="coach" hidden></div>`);
    this.hint = el(`<div class="hint">Drag to rotate · Scroll to zoom · WASD to move the camera</div>`);
    this.toasts = el(`<div class="toasts"></div>`);
    this.modalWrap = el(`<div></div>`);
    this.dev = el(`<div class="dev" hidden></div>`);
    r.append(this.hud, this.nav, this.panel, this.orders, this.goal, this.coach, this.hint, this.toasts, this.modalWrap, this.dev);
    this.tip = el(`<div class="tip" hidden></div>`);
    this.labelsRoot.append(this.tip);

    this._onClick = (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || t.disabled) return;
      this._act(t.dataset.act, t.dataset.id, t);
    };
    r.addEventListener('click', this._onClick);
    setTimeout(() => { this.hint.style.opacity = 0; }, 14000);

    const eng = this.app.engine;
    eng.onHover = (id, e) => {
      if (this.bm.placing && e) { this._ghostAt(e); id = null; }
      this.hover = id; this.app.world.setHover(id);
    };
    eng.onClick = (id, e) => {
      if (this.bm.placing) { this._ghostAt(e); this._confirmPlace(); return; }
      if (this.panelId === 'build') {
        const fid = id && id.startsWith('f:') ? id.slice(2) : null;
        this.bm.selected = fid; this.app.world.setSelected(fid);
        sfx(fid ? 'pop' : 'click'); this.refresh(true);
        return;
      }
      if (!id) return;
      sfx('pop');
      if (id.startsWith('f:')) {
        const fu = getFurniture(this.game.state, id.slice(2));
        if (fu && fu.slots.length) this.inspect(fu.id); else { this.openPanel('build'); this.bm.selected = id.slice(2); this.app.world.setSelected(this.bm.selected); }
        return;
      }
      const f = this.fixtures[id];
      if (f && f.panel) this.openPanel(f.panel);
      else if (id === 'packing') this.flashOrders();
    };
    eng.onRightClick = () => { if (this.bm.placing) this._cancelPlace(); };
  }

  // ---- Build mode ---------------------------------------------------------------
  _ghostAt(e) {
    const gp = this.app.engine.groundPoint(e.clientX, e.clientY);
    if (!gp) return;
    const bm = this.bm, F = FURNITURE[bm.placing];
    const w = bm.rot % 2 ? F.d : F.w, d = bm.rot % 2 ? F.w : F.d;
    bm.i = Math.round((gp.x - STORE_GRID.x0) / STORE_GRID.cell - w / 2);
    bm.j = Math.round((gp.z - STORE_GRID.z0) / STORE_GRID.cell - d / 2);
    bm.cx = e.clientX; bm.cy = e.clientY;
    this._ghostCheck();
  }
  _ghostCheck() {
    const bm = this.bm, s = this.game.state;
    const chk = checkPlacement(s.store, bm.placing, bm.i, bm.j, bm.rot, bm.moving);
    bm.ok = chk.ok && (bm.moving || s.cash >= FURNITURE[bm.placing].cost);
    bm.reason = chk.ok ? (bm.ok ? '' : 'Not enough cash.') : chk.reason;
    this.app.world.setGhost({ type: bm.placing, i: bm.i, j: bm.j, rot: bm.rot, ok: bm.ok });
  }
  _confirmPlace() {
    const bm = this.bm, g = this.game;
    const r = bm.moving ? moveFurniture(g, bm.moving, bm.i, bm.j, bm.rot) : placeFurniture(g, bm.placing, bm.i, bm.j, bm.rot);
    if (!r.ok) { sfx('error'); this.toast('⚠️', r.reason, '', 'bad'); return; }
    sfx(bm.moving ? 'pop' : 'upgrade');
    const id = bm.moving || r.furniture.id;
    this._cancelPlace(true);
    bm.selected = id; this.app.world.setSelected(id);
    this.refresh(true);
  }
  _cancelPlace(quiet) {
    const bm = this.bm;
    bm.placing = null; bm.moving = null;
    this.app.world.setGhost(null); this.app.world.setMoving(null);
    if (!quiet) sfx('click');
    this.refresh(true);
  }
  inspect(fid) {
    this.inspectId = fid;
    this.openPanel('display');
    const t = this.game.state.store && this.game.state.store.tutorial;
    if (t && !t.done && t.step === 1) this._storeTutAdvance(2);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
    this.root.removeEventListener('click', this._onClick);
    this.root.innerHTML = '';
    this.labelsRoot.innerHTML = '';
    this.app.engine.onHover = null; this.app.engine.onClick = null;
    this.dead = true;
  }

  // ---- Actions ----------------------------------------------------------------
  _act(act, id, node) {
    const g = this.game, s = g.state;
    const result = (r, okSound = 'click') => { if (r && r.ok === false) { this.toast('⚠️', r.reason, '', 'bad'); sfx('error'); } else sfx(okSound); this.refresh(true); return r; };
    switch (act) {
      case 'nav': {
        sfx('open');
        this.panelId === id ? this.closePanel() : this.openPanel(id);
        break;
      }
      case 'closepanel': sfx('click'); this.closePanel(); break;
      case 'speed': this.setSpeed(Number(id)); break;
      case 'menu': sfx('open'); this.showMenu(); break;
      case 'goal': {
        if (this.isStore && !s.milestone.chainReady && !this.isBranch) { this.goalOpen = !this.goalOpen; sfx('click'); this.refresh(true); break; }
        if (this.isStore) { sfx('open'); this.openPanel('store'); break; }
        if (s.milestone.leaseSigned) { this.showMoveIn(); break; }
        if (s.milestone.outgrown && !s.milestone.leaseSigned) { this.showLease(); break; }
        this.goalOpen = !this.goalOpen; sfx('click'); this.refresh(true); break;
      }
      case 'queue': result(queueBatch(g, id), 'queue'); break;
      case 'cancel': result(cancelJob(g, id)); break;
      case 'buyfor': {
        const sku = getSku(s, id), needs = batchNeeds(s, sku);
        for (const [ing, q] of Object.entries(needs)) {
          const incoming = s.deliveries.reduce((a, d) => a + (d.items[ing] || 0), 0);
          const short = q - s.ingredients[ing] - incoming - (this.cart[ing] || 0);
          if (short > 0) this.cart[ing] = (this.cart[ing] || 0) + Math.ceil(short / INGREDIENTS[ing].lot) * INGREDIENTS[ing].lot;
        }
        sfx('click'); this.openPanel('supplies');
        break;
      }
      case 'cart': {
        const lot = INGREDIENTS[id].lot;
        this.cart[id] = Math.max(0, (this.cart[id] || 0) + Number(node.dataset.d) * lot);
        if (!this.cart[id]) delete this.cart[id];
        sfx('click'); this.refresh(true); break;
      }
      case 'cartclear': this.cart = {}; sfx('click'); this.refresh(true); break;
      case 'cartauto': {
        const want = {};
        for (const sku of s.skus.filter((k) => !k.paused)) {
          for (const [ing, q] of Object.entries(batchNeeds(s, sku))) want[ing] = (want[ing] || 0) + q;
        }
        this.cart = {};
        for (const [ing, q] of Object.entries(want)) {
          const incoming = s.deliveries.reduce((a, d) => a + (d.items[ing] || 0), 0);
          const short = q - s.ingredients[ing] - incoming, lot = INGREDIENTS[ing].lot;
          if (short > 0) this.cart[ing] = Math.ceil(short / lot) * lot;
        }
        if (!Object.keys(this.cart).length) this.toast('👍', 'You already have enough for one batch of everything');
        sfx('click'); this.refresh(true); break;
      }
      case 'buy': { const r = result(orderSupplies(g, this.cart), 'coin'); if (r.ok) this.cart = {}; this.refresh(true); break; }
      case 'price': { const sku = getSku(s, id); setPrice(g, id, sku.price + Number(node.dataset.d)); sfx('click'); this.refresh(true); break; }
      case 'pause': {
        const sku = getSku(s, id);
        if (!setSkuPaused(g, id, !sku.paused)) { this.toast('⚠️', 'Keep at least one recipe listed.', '', 'bad'); sfx('error'); } else sfx('click');
        this.refresh(true); break;
      }
      case 'vprod': this.variant.productId = id; sfx('click'); this.refresh(true); break;
      case 'vscent': this.variant.scentId = id; sfx('click'); this.refresh(true); break;
      case 'vtier': this.variant.tier = Number(id); sfx('click'); this.refresh(true); break;
      case 'variant': result(createVariant(g, this.variant.productId, this.variant.scentId, this.variant.tier), 'upgrade'); break;
      case 'upgrade': result(buyUpgrade(g, id), 'upgrade'); break;
      case 'campaign': result(startCampaign(g, id), 'star'); break;
      case 'fulfill': result(this.isStore ? withStore(s, 'main', () => fulfillOrder(g, id)) : fulfillOrder(g, id), 'pop'); break;
      case 'auto': s.settings.autoFulfill = !s.settings.autoFulfill; sfx('click'); this.refresh(true); break;
      case 'skiptut': this._tut().done = true; sfx('click'); this.refresh(true); break;
      case 'nexttut': if (this.isStore) this._storeTutAdvance(s.store.tutorial.step + 1); else this._tutAdvance(s.tutorial.step + 1); break;
      case 'b-place': this.bm.placing = id; this.bm.moving = null; this.bm.rot = 0; this.bm.selected = null; this.app.world.setSelected(null); sfx('click'); this.refresh(true); break;
      case 'b-rot': this.bm.rot = (this.bm.rot + 1) % 4; sfx('click'); this._ghostCheck(); this.refresh(true); break;
      case 'b-cancel': this._cancelPlace(); break;
      case 'b-move': { const fu = getFurniture(s, id); if (!fu) break; Object.assign(this.bm, { placing: fu.type, moving: fu.id, rot: fu.rot, i: fu.i, j: fu.j }); this.app.world.setMoving(fu.id); this._ghostCheck(); sfx('click'); this.refresh(true); break; }
      case 'b-rotsel': result(rotateFurniture(g, id)); this.app.world.setSelected(id); break;
      case 'b-sell': { const r = result(sellFurniture(g, id), 'coin'); if (r.ok) { this.bm.selected = null; this.app.world.setSelected(null); } break; }
      case 'b-edit': this.openPanel('build'); this.bm.selected = id; this.app.world.setSelected(id); break;
      case 'inspect': sfx('click'); this.inspect(id); break;
      case 'slot': result(assignSlot(g, id, Number(node.dataset.k), node.dataset.sku || null)); break;
      case 's-hire': result(hireStaff(g, id, node.dataset.role), 'upgrade'); break;
      case 's-shift': result(setShift(g, id, node.dataset.shift)); break;
      case 'goto': sfx('open'); this.app.switchStore(id); break;
      case 'pickloc': sfx('open'); this.showLocations(); break;
      case 'tfrom': this.transfer.from = id; this.transfer.items = {}; sfx('click'); this.refresh(true); break;
      case 'tto': this.transfer.to = id; sfx('click'); this.refresh(true); break;
      case 'titem': { const it = this.transfer.items; it[id] = Math.max(0, (it[id] || 0) + Number(node.dataset.d)); if (!it[id]) delete it[id]; sfx('click'); this.refresh(true); break; }
      case 'tsend': { const t = this.transfer; const r = result(transferStock(g, t.from, t.to, t.items), 'delivery'); if (r.ok) t.items = {}; this.refresh(true); break; }
      case 's-train': result(trainStaff(g, id, node.dataset.skill), 'upgrade'); break;
      case 'refill': result(setRefill(g, id, Number(node.dataset.k), Number(node.dataset.lv))); break;
      case 'rush': result(rushSlot(g, id, Number(node.dataset.k)), 'queue'); break;
      case 'line': result(unlockLine(g, id), 'upgrade'); break;
      case 'loyalty': result(buyLoyalty(g), 'upgrade'); break;
      case 's-role': result(setStaffRole(g, id, node.dataset.role)); break;
      case 's-fire': {
        const rec = staffRecord(s, id);
        if (rec && node.dataset.sure !== '1') { node.dataset.sure = '1'; node.textContent = 'Sure?'; sfx('click'); break; }
        result(fireStaff(g, id)); break;
      }
      default: if (this.modalActs && this.modalActs[act]) this.modalActs[act](id, node);
    }
  }

  _key(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (this.modalOpen && e.key !== 'Escape') return;
    if (e.key === ' ') { e.preventDefault(); this.setSpeed(this.game.state.time.paused ? this.game.state.time.speed : 0); }
    else if (e.key === '1' || e.key === '2' || e.key === '3') this.setSpeed(Number(e.key));
    else if ((e.key === 'r' || e.key === 'R') && this.bm.placing) { this.bm.rot = (this.bm.rot + 1) % 4; sfx('click'); this._ghostCheck(); this.refresh(true); }
    else if (e.key === 'Escape') { if (this.modalOpen) this.closeModal(); else if (this.bm.placing) this._cancelPlace(); else if (this.panelId) this.closePanel(); else this.showMenu(); }
    else if (e.key === '`' || e.key === '~') { this.devOpen = !this.devOpen; this.dev.hidden = !this.devOpen; this.refresh(true); }
  }

  setSpeed(v) {
    const t = this.game.state.time;
    if (v === 0) t.paused = true; else { t.paused = false; t.speed = v; }
    sfx('click');
    this.refresh(true);
  }

  openPanel(id) {
    if (this.panelId === 'build' && id !== 'build') this._leaveBuild();
    this.panelId = id;
    this.panelHtml = '';
    const n = this.navList.find((x) => x.id === id) || HIDDEN_PANELS[id];
    if (id === 'build') this.app.world.setBuildMode(true);
    const stt = this.isStore && this.game.state.store.tutorial;
    if (stt && !stt.done && ((stt.step === 1 && id === 'display') || (stt.step === 2 && id === 'build'))) this._storeTutAdvance(stt.step + 1);
    this.panel.hidden = false;
    this.panel.style.animation = 'none'; void this.panel.offsetWidth; this.panel.style.animation = '';
    this.panel.classList.add('fresh');
    clearTimeout(this._freshT);
    this._freshT = setTimeout(() => this.panel.classList.remove('fresh'), 600);
    const fu = id === 'display' && getFurniture(this.game.state, this.inspectId);
    this.panel.querySelector('h2').textContent = fu ? FURNITURE[fu.type].name : n.title;
    this.panel.querySelector('.sub').textContent = n.sub;
    this.panel.querySelector('.panel-body').scrollTop = 0;
    const tut = this.game.state.tutorial;
    if (!tut.done && ((tut.step === 0 && id === 'production'))) this._tutAdvance(1);
    this.refresh(true);
  }
  closePanel() { if (this.panelId === 'build') this._leaveBuild(); this.panelId = null; this.panel.hidden = true; this.refresh(true); }
  _leaveBuild() {
    Object.assign(this.bm, { placing: null, moving: null, selected: null });
    this.app.world.setMoving(null);
    this.app.world.setBuildMode(false);
  }
  flashOrders() { this.orders.animate([{ boxShadow: '0 0 0 5px rgba(79,169,164,.6)' }, { boxShadow: '0 0 0 0 rgba(79,169,164,0)' }], { duration: 700 }); }

  // ---- Game events --------------------------------------------------------------
  _bindGame() {
    const g = this.game, w = this.app.world;
    const on = (evt, fn) => g.on(evt, (d) => { if (!this.dead) fn(d); });
    on('batchQueued', () => this._tutAt(1, 2));
    // First lesson: make sure there is an order the fresh stock can actually fill.
    on('goodsStocked', ({ skuId }) => {
      const st = g.state;
      if (st.tutorial.done || st.tutorial.step !== 2 || st.orders.some((o) => o.lines.every((l) => l.skuId === skuId))) return;
      const o = spawnOrder(g), sku = getSku(st, skuId);
      if (o && sku) { o.lines = [{ skuId, qty: 2, price: sku.price }]; o.total = 2 * sku.price; }
    });
    on('batchStarted', () => sfx('queue'));
    on('batchDone', ({ station, job }) => { sfx('done'); const sku = getSku(g.state, job.skuId); this.toast('✅', `${sku.name} is ready`, `${job.units} units to shelve`, 'good'); this.float(`station${station}`, '✓ Ready!', 'star'); w.burst('spark', `station${station}`, 12); });
    on('goodsStocked', ({ units }) => { sfx('pop'); this.float('shelf', `+${units} in stock`, 'star'); w.burst('bubble', 'shelf', 8); this._tutAt(2, 3); });
    on('orderNew', (o) => { sfx('order'); if (o.channel === 'Big orders') this.toast('🏢', `Big order from ${o.customer}!`, `${money(o.total)} · generous deadline`, 'gold'); });
    on('orderQueued', () => this._tutAt(3, 3));
    on('orderShipped', ({ order, late }) => { sfx('coin'); w.shipParcel(); w.burst('coin', 'packing', 6); w.cheer(order.claimedBy || 'founder'); this.float('packing', `+${money(order.total)}`, 'money'); this.bump(); if (late) this.toast('🐢', `Shipped late to ${order.customer}`, 'Late orders earn weaker reviews', 'bad'); this._tutAt(3, 4); });
    on('orderExpired', (o) => { sfx('sad'); this.toast('💔', `${o.customer} gave up waiting`, `Lost a ${money(o.total)} order`, 'bad'); });
    on('supplyOrdered', () => this._tutAt(4, 5));
    on('delivery', (d) => { sfx('delivery'); w.deliverBox(); this.float('door', '📦 Delivery!', 'star'); this.toast('📦', 'Supplies delivered', Object.entries(d.items).map(([id, q]) => `${q} ${INGREDIENTS[id].name}`).join(', ')); });
    on('review', (r) => {
      // a busy shop writes a lot of reviews: only surface a few of them
      if (r.source === 'store') { const now = performance.now(); if (now - (this._lastRevToast || 0) < 20000) return; this._lastRevToast = now; }
      if (r.stars >= 5) { sfx('star'); this.toast('⭐', `5-star review from ${r.customer}`, `“${r.text}”`, 'gold'); } else if (r.stars <= 2) this.toast('😕', `${r.stars}-star review from ${r.customer}`, `“${r.text}”`, 'bad'); });
    on('upgrade', (u) => { this.toast(u.icon, `${u.name} installed!`, u.effect, 'good'); this._tutAt(5, 6); if (u.id === 'helper') this.toast('🙋', 'Your helper has arrived', 'Turn on auto-fulfill in the Orders list', 'good'); });
    on('skuCreated', (sku) => this.toast('📖', `New recipe: ${sku.name}`, 'Queue a batch to start selling it', 'good'));
    on('campaign', (c) => this.toast(c.icon, `${c.name} is live`, `+${Math.round(c.boost * 100)}% orders`, 'good'));
    on('batchCancelled', ({ refunded }) => this.toast('↩️', refunded ? 'Batch cancelled' : 'Batch thrown out', refunded ? 'Ingredients returned to the pantry' : 'Those ingredients are gone'));
    on('dayEnd', (sum) => { sfx('day'); this.dayCard(sum); this.app.save(true); });
    on('outgrown', () => { sfx('fanfare'); this.showOutgrown(); });
    on('leaseSigned', () => this.app.save(true));
    // ---- the store ----
    const THOUGHT = { stockout: ['😕', 'Sold out!', 'bad'], price: ['💸', 'Too pricey', 'bad'], happy: ['😊', 'Love this!', 'star'], wait: ['⏳', 'Long line…', 'bad'], gaveup: ['💔', 'Gave up', 'bad'], helped: ['💬', 'Thanks!', 'star'], dirty: ['🧹', 'Bit messy…', 'bad'], tester: ['🧪', 'Ooh, smells lovely', 'star'] };
    on('shopperThought', ({ id, kind }) => { const t = THOUGHT[kind]; if (t) this.float(`c:${id}`, `${t[0]} ${t[1]}`, t[2] === 'bad' ? 'thought bad' : 'thought'); });
    on('storeSale', ({ total }) => { sfx('coin'); w.burst('coin', 'counter', 5); this.float('counter', `+${money(total)}`, 'money'); this.bump(); });
    on('staffHired', (rec) => { this.toast('🙋', `${rec.name} joined the team`, `${STAFF_ROLES[rec.role].name} · ${money(rec.wage)}/day`, 'good'); const t = g.state.store.tutorial; if (!t.done && t.step === 0) this._storeTutAdvance(1); });
    on('furniturePlaced', () => w.burst('spark', 'door', 0));
    on('chainReady', () => { sfx('fanfare'); this.showChainReady(); });
    on('branchOpened', () => this.app.save(true));
    on('transferArrived', (t) => { if (!t.auto) { sfx('delivery'); this.toast('🚚', `Stock arrived at ${storeName(g.state, t.to)}`, `${Object.values(t.items).reduce((a, b) => a + b, 0)} units`, 'good'); } });
    on('lineUnlocked', ({ id }) => this.toast('🌟', `New product line: ${PRODUCTS[id].name}!`, 'Your first recipe is in the Recipe Book. Give it a display.', 'gold'));
    on('staffTrained', ({ rec, skill }) => { sfx('star'); this.toast('🎓', `${rec.name} finished training`, `${skill === 'speed' ? 'Speed' : 'Service'} is now ${Math.round(rec[skill] * 100)}`, 'good'); });
    on('loyalty', () => this.toast('💳', 'Loyalty cards are out', 'Regulars will be back more often', 'good'));
    on('displayRestocked', ({ fid }) => { sfx('pop'); w.burst('bubble', `f:${fid}`, 5); });
    on('cash', ({ amount }) => { if (amount < 0) this.bump(); });
  }

  _tut() { return this.isStore ? this.game.state.store.tutorial : this.game.state.tutorial; }
  _storeTutAdvance(next) {
    const t = this.game.state.store.tutorial;
    if (next >= STORE_TUTORIAL.length) t.done = true; else t.step = next;
    this.coachHtml = '';
    this.refresh(true);
  }
  _tutAt(step, next) { const t = this.game.state.tutorial; if (!t.done && t.step === step) this._tutAdvance(next); }
  _tutAdvance(next) {
    const t = this.game.state.tutorial;
    if (next >= TUTORIAL.length) t.done = true; else t.step = next;
    this.coachHtml = '';
    this.refresh(true);
  }

  // ---- Feedback -------------------------------------------------------------------
  toast(ico, title, sub = '', kind = '') {
    const n = el(`<div class="toast ${kind}"><span class="ico">${ico}</span><div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`);
    this.toasts.append(n);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild.remove();
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 320); }, 3800);
  }
  dayCard(sum) {
    const n = el(`<div class="daycard"><h3>Day ${sum.day} wrapped up 🌙</h3>
      <div class="kv"><span>Revenue</span><b class="pos">${money(sum.revenue, true)}</b></div><div class="kv"><span>Expenses</span><b class="neg">${money(-sum.expenses, true)}</b></div>
      <div class="kv total"><span>Net profit</span><b class="${sum.profit >= 0 ? 'pos' : 'neg'}">${money(sum.profit, true)}</b></div>
      ${sum.store ? `<div class="kv"><span>Shoppers</span><b>${sum.store.buyers} bought · ${sum.store.walkouts} left</b></div><div class="kv"><span>Store rating</span><b>★ ${sum.store.rating.toFixed(1)}</b></div>` : ''}<div class="tiny">Progress saved.</div></div>`);
    this.toasts.prepend(n);
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 420); }, 7000);
  }
  float(anchor, text, kind = 'money') {
    const a = this.app.world.anchors[anchor];
    if (!a) return;
    const p = this.app.engine.project(a);
    const n = el(`<div class="float ${kind}" style="transform:translate(${p.x}px,${p.y}px) translate(-50%,-100%)">${esc(text)}</div>`);
    this.labelsRoot.append(n);
    setTimeout(() => n.remove(), 1650);
  }
  bump() { const b = this.h.cashbox; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

  // ---- Modals ---------------------------------------------------------------------
  modal(html, acts = {}, { confetti = false, pause = true } = {}) {
    this.closeModal();
    const t = this.game.state.time;
    this._wasPaused = t.paused;
    if (pause) t.paused = true;
    this._modalPaused = pause;
    this.modalActs = acts;
    this.modalOpen = true;
    this.app.engine.enabled = false;
    const scrim = el(`<div class="scrim"><div class="modal">${html}</div></div>`);
    if (confetti) {
      const c = el(`<div class="confetti"></div>`);
      const cols = ['#e98fa5', '#4fa9a4', '#e2a93b', '#b9a2e6', '#8fb9a0', '#f8b84a'];
      for (let i = 0; i < 70; i++) c.append(el(`<i style="left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-duration:${2.2 + Math.random() * 2.5}s;animation-delay:${Math.random() * 1.2}s"></i>`));
      scrim.prepend(c);
    }
    this.modalWrap.append(scrim);
  }
  closeModal() {
    if (!this.modalOpen) return;
    this.modalWrap.innerHTML = '';
    this.modalOpen = false; this.modalActs = null;
    this.app.engine.enabled = true;
    if (this._modalPaused) this.game.state.time.paused = this._wasPaused;
    this.refresh(true);
  }

  showMenu() {
    const tg = (on) => `class="toggle ${on ? 'on' : ''}"`;
    const render = () => this.modal(`<h2>Paused</h2>
      <div class="card"><div class="row"><span class="grow title">Music</span><span ${tg(audioSettings.music)} data-act="m-music"><i></i></span></div>
      <div class="row"><span class="grow title">Sound effects</span><span ${tg(audioSettings.sfx)} data-act="m-sfx"><i></i></span></div>
      <div class="row"><div class="grow"><div class="title">Detailed graphics</div><div class="tiny">Soft contact shadows and sharper rendering. Turn off on slower computers.</div></div><span ${tg(this.app.engine.quality === 'high')} data-act="m-gfx"><i></i></span></div></div>
      <div class="keys"><kbd>Drag</kbd><span>Rotate the camera</span><kbd>Scroll</kbd><span>Zoom in and out</span><kbd>W A S D</kbd><span>Move the camera · <kbd>Q</kbd> <kbd>E</kbd> rotate</span><kbd>Space</kbd><span>Pause · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> game speed</span></div>
      <div class="actions" style="justify-content:stretch;flex-direction:column">
        <button class="btn teal block" data-act="m-resume">Resume</button>
        <button class="btn ghost block" data-act="m-save">Save game</button>
        <button class="btn ghost block" data-act="m-help">How to play</button>
        <button class="btn ghost block" data-act="m-title">Save &amp; return to title</button>
      </div>`, {
      'm-resume': () => { sfx('click'); this.closeModal(); },
      'm-save': () => { this.app.save(); sfx('done'); this.closeModal(); this.toast('💾', 'Game saved', '', 'good'); },
      'm-music': () => { setMusic(!audioSettings.music); this.app.savePrefs(); const p = this._wasPaused; render(); this._wasPaused = p; },
      'm-sfx': () => { setSfx(!audioSettings.sfx); this.app.savePrefs(); const p = this._wasPaused; render(); this._wasPaused = p; },
      'm-gfx': () => { this.app.setQuality(this.app.engine.quality === 'high' ? 'low' : 'high', true); const p = this._wasPaused; render(); this._wasPaused = p; },
      'm-help': () => { const p = this._wasPaused; this.showHelp(); this._wasPaused = p; },
      'm-title': () => { this.app.save(); this.closeModal(); this.app.quitToTitle(); },
    });
    render();
  }

  showHelp() {
    this.modal(`<h2>How the business works</h2>
      <ul><li><b>Supplies</b>: buy ingredients and packaging. Deliveries take a moment to arrive.</li>
      <li><b>Production</b>: queue batches. You carry ingredients to the stove, it cooks, then you shelve the finished units.</li>
      <li><b>Orders</b>: press Fulfill when you have the stock. Each order is packed by hand and shipped before its timer runs out.</li>
      <li><b>Reputation</b> comes from reviews. Higher-quality formulas, fair prices and on-time shipping earn more stars and more orders.</li>
      <li><b>Brand Soul</b> is the handmade heart of the company. Quality and reliability raise it. Missed orders and price gouging wear it down.</li>
      <li><b>Upgrades</b> make you faster and give you room. When you hit every goal on the bar at the bottom, you can lease your first store.</li></ul>
      <div class="actions"><button class="btn teal" data-act="m-ok">Got it</button></div>`, { 'm-ok': () => { sfx('click'); this.closeModal(); } });
  }

  showOutgrown() {
    const n = esc(this.game.state.founder.name);
    this.modal(`<div class="big-ico">🎉</div><h2>You've <em>outgrown</em> the kitchen!</h2>
      <p>Boxes on every surface, orders coming in faster than the stove can keep up, and customers who truly love what you make. ${n}, this little kitchen business is ready for a real home.</p>
      <p>A storefront on Main Street is available. The deposit is <b>${money(HOME_GOALS.leaseDeposit)}</b>.</p>
      <div class="actions"><button class="btn ghost" data-act="m-later">Keep working for now</button><button class="btn lg" data-act="m-lease">See the lease</button></div>`, {
      'm-later': () => { sfx('click'); this.closeModal(); },
      'm-lease': () => { sfx('click'); this.closeModal(); this.showLease(); },
    }, { confetti: true });
  }

  showLease() {
    const s = this.game.state, can = s.cash >= HOME_GOALS.leaseDeposit;
    this.modal(`<div class="big-ico">🏪</div><h2>Lease the first <em>4 The Love Of Bubbles</em> store</h2>
      <p>A bright corner unit with big front windows, room for shelves of product, and a workroom in the back.</p>
      <div class="card"><div class="kv"><span>Deposit</span><b>${money(HOME_GOALS.leaseDeposit)}</b></div><div class="kv"><span>Your cash</span><b class="${can ? 'pos' : 'neg'}">${money(s.cash, true)}</b></div></div>
      ${can ? '' : `<p>You need ${money(HOME_GOALS.leaseDeposit - s.cash, true)} more. Keep fulfilling orders and come back to the goal bar when you're ready.</p>`}
      <div class="actions"><button class="btn ghost" data-act="m-later">Not yet</button><button class="btn lg" data-act="m-sign" ${can ? '' : 'disabled'}>Sign the lease</button></div>`, {
      'm-later': () => { sfx('click'); this.closeModal(); },
      'm-sign': () => { const r = signLease(this.game); if (r.ok) { sfx('fanfare'); this.closeModal(); this.showChapterEnd(); } else { sfx('error'); } },
    });
  }

  showChapterEnd() {
    const s = this.game.state;
    this.modal(`<div class="big-ico">🗝️</div><h2>The keys are <em>yours</em>.</h2>
      <p>From one stove and a shelf of jars to a signed lease on Main Street. Chapter One, the home business, is complete.</p>
      <div class="card"><div class="kv"><span>Days in business</span><b>${s.time.day}</b></div><div class="kv"><span>Orders shipped</span><b>${s.stats.ordersFulfilled}</b></div><div class="kv"><span>Lifetime revenue</span><b class="pos">${money(s.stats.revenue)}</b></div><div class="kv"><span>Reputation</span><b>★ ${s.reputation.toFixed(1)}</b></div><div class="kv"><span>Brand Soul</span><b>${Math.round(s.soul)}</b></div></div>
      <p>Chapter Two begins on Main Street: walk-in shoppers, displays to fill and arrange, and a team to hire. The stove, the pantry and every recipe come with you to the workroom in the back.</p>
      <div class="actions"><button class="btn ghost" data-act="m-ok">Finish the day first</button><button class="btn lg teal" data-act="m-open">Open the store</button></div>`, {
      'm-ok': () => { sfx('click'); this.closeModal(); },
      'm-open': () => { sfx('fanfare'); this.closeModal(); this.app.openStore(); },
    }, { confetti: true });
  }

  showChainReady() {
    this.modal(`<div class="big-ico">🌱</div><h2>Main Street is <em>thriving</em></h2>
      <p>Regulars know the staff by name, the shelves sell out by closing, and people are asking when you'll open somewhere closer to them. Chapter Three begins: the brand can grow into a chain.</p>
      <p>Choose where your second shop goes. Every neighbourhood has its own rent, its own crowd, and its own idea of a perfect gift.</p>
      <div class="actions"><button class="btn ghost" data-act="m-ok">Later</button><button class="btn lg teal" data-act="m-pick">Choose a location</button></div>`, {
      'm-ok': () => { sfx('click'); this.closeModal(); },
      'm-pick': () => { sfx('click'); this.closeModal(); this.showLocations(); },
    }, { confetti: true });
  }

  showLocations() {
    const acts = { 'm-ok': () => { sfx('click'); this.closeModal(); } };
    for (const id of LOCATION_ORDER) acts[`m-open-${id}`] = () => { sfx('fanfare'); this.closeModal(); this.app.openBranch(id); };
    this.modal(`<h2>Where should the next shop go?</h2>
      <p class="muted">Each new shop has its own floor, staff and back stock. Main Street's workroom makes the products for all of them, so plan your production. A Store Manager keeps a branch stocked from Main Street on their own.</p>
      <div class="locs">${locationCards(this.game.state)}</div>
      <div class="actions"><button class="btn ghost" data-act="m-ok">Not yet</button></div>`, acts);
  }

  // For players who signed the lease before the store existed (or chose to wait).
  showMoveIn() {
    this.modal(`<div class="big-ico">🏪</div><h2>Your store is <em>ready</em></h2>
      <p>The paint is dry, the shelves are up and the sign is on the door. Whenever you're ready, the whole business moves to Main Street.</p>
      <div class="actions"><button class="btn ghost" data-act="m-ok">Not yet</button><button class="btn lg teal" data-act="m-open">Open the store</button></div>`, {
      'm-ok': () => { sfx('click'); this.closeModal(); },
      'm-open': () => { sfx('fanfare'); this.closeModal(); this.app.openStore(); },
    });
  }

  // ---- Refresh (5x per second, or forced after an action) ---------------------------
  refresh(force = false) {
    if (this.dead) return;
    const s = this.game.state, h = this.h;
    const profit = todayProfit(s);
    h.profit.textContent = money(profit);
    h.profit.className = `val ${profit > 0 ? 'pos' : profit < 0 ? 'neg' : ''}`;
    h.rep.textContent = s.reputation.toFixed(1);
    h.repstars.style.width = `${(s.reputation / 5) * 100}%`;
    h.soul.textContent = Math.round(s.soul);
    h.soulbar.style.width = `${s.soul}%`;
    const open = s.orders.filter((o) => o.status === 'open').length;
    h.cust.textContent = this.isStore ? `${s.store.customers.length}${s.orders.length ? ` · ${s.orders.length} online` : ''}` : s.orders.length;
    h.day.textContent = `Day ${s.time.day}`;
    if (h.storename) h.storename.textContent = `${s.store.name || 'Main Street'}${storeIds(s).length > 1 ? ' ▾' : ''}`;
    h.time.textContent = clockLabel(s);
    h.ring.style.setProperty('--p', ((s.time.t / DAY_LENGTH) * 100).toFixed(1));
    const sp = s.time.paused ? 0 : s.time.speed;
    h.speed.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.id) === sp));

    this.hint.style.visibility = this.panelId ? 'hidden' : '';

    // nav
    const tut = this._tut(), TUT = this.isStore ? STORE_TUTORIAL : TUTORIAL;
    const tutNav = !tut.done && TUT[tut.step] ? TUT[tut.step].nav : null;
    this.nav.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.id === this.panelId);
      b.classList.toggle('pulse', b.dataset.id === tutNav && this.panelId !== tutNav);
    });

    // panel
    if (this.panelId) {
      const html = this.panels[this.panelId](s, this);
      if (html !== this.panelHtml) {
        const body = this.panel.querySelector('.panel-body');
        const st = body.scrollTop;
        body.innerHTML = html;
        body.scrollTop = st;
        this.panelHtml = html;
      }
    }

    // orders rail (keyed, so cards do not re-animate or lose clicks)
    const cards = this.isStore ? withStore(s, 'main', () => orderCards(s)) : orderCards(s);
    const seen = new Set();
    let prev = null;
    for (const c of cards) {
      seen.add(c.id);
      let node = this.orderEls.get(c.id);
      if (!node) { node = el(`<div class="order new"></div>`); node._html = ''; this.orderEls.set(c.id, node); }
      if (node._html !== c.html) { node.innerHTML = c.html; node._html = c.html; }
      const cls = `order ${c.cls}${node.classList.contains('new') ? ' new' : ''}${node.classList.contains('urgent') ? ' urgent' : ''}`;
      if (node.className !== cls) node.className = cls;
      const want = prev ? prev.nextSibling : this.ordersList.firstChild;
      if (node !== want) this.ordersList.insertBefore(node, want);
      prev = node;
    }
    for (const [id, node] of this.orderEls) if (!seen.has(id)) { node.remove(); this.orderEls.delete(id); }
    let empty = this.ordersList.querySelector('.empty');
    if (!cards.length && !empty) this.ordersList.append(el(`<div class="empty">No orders right now.<br>They arrive through the day.</div>`));
    if (cards.length && empty) empty.remove();
    this.ordCount.textContent = open ? `${open} waiting` : 'all clear';
    this.ordCount.className = `chip ${open ? 'pink' : 'ok'}`;
    this.autoWrap.hidden = !s.upgrades.helper;
    this.autoWrap.querySelector('.toggle').classList.toggle('on', s.settings.autoFulfill);

    // goal bar
    const goals = homeGoals(s), pct = Math.round(homeProgress(s) * 100);
    let gh;
    if (this.isStore && !s.milestone.chainReady && !this.isBranch) {
      const goals = expansionGoals(s), pct = Math.round((goals.reduce((a, x) => a + x.pct, 0) / goals.length) * 100);
      gh = `<div class="head">${ICONS.chain} Road to a second shop <span class="pct">${pct}%  ${this.goalOpen ? '▾' : '▴'}</span></div><div class="bar"><i style="width:${pct}%"></i></div>`;
      if (this.goalOpen) gh += `<div class="list">${goals.map((x) => `<div class="g ${x.done ? 'done' : ''}"><span>${x.done ? '✅' : '⬜'}</span><span>${x.label}</span><b>${x.money ? money(Math.min(x.value, x.target)) : x.decimals ? x.value.toFixed(1) : Math.min(x.value, x.target)} / ${x.money ? money(x.target) : x.target}</b>${x.hint && !x.done ? `<small>${x.hint}</small>` : ''}</div>`).join('')}</div>`;
    } else if (this.isStore) {
      const st = s.store, t = st.today;
      gh = `<div class="head" style="white-space:nowrap">${ICONS.store} ${esc(st.name || 'Main Street')} <span class="stars-sm">★ ${st.reputation.toFixed(1)}</span> <span class="pct">${st.customers.length} inside · ${t.visitors} today${t.buyers + t.walkouts ? ` · ${Math.round((t.buyers / (t.buyers + t.walkouts)) * 100)}% bought` : ''}</span></div>`;
    } else if (s.milestone.leaseSigned) gh = `<div class="head">🗝️ Lease signed · <span class="pct">Open the store →</span></div>`;
    else if (s.milestone.outgrown) gh = `<div class="head">${ICONS.store} You've outgrown the kitchen! <span class="pct">Sign the lease →</span></div>`;
    else {
      gh = `<div class="head">${ICONS.store} Road to your first store <span class="pct">${pct}%  ${this.goalOpen ? '▾' : '▴'}</span></div><div class="bar"><i style="width:${pct}%"></i></div>`;
      if (this.goalOpen) {
        gh += `<div class="list">${goals.map((g) => `<div class="g ${g.done ? 'done' : ''}"><span>${g.done ? '✅' : '⬜'}</span><span>${g.label}</span><b>${g.money ? money(Math.min(g.value, g.target)) : g.decimals ? g.value.toFixed(1) : Math.min(g.value, g.target)} / ${g.money ? money(g.target) : g.target}</b>${g.hint && !g.done ? `<small>${g.hint}</small>` : ''}</div>`).join('')}
          <div class="g"><span>💰</span><span>Then: lease deposit</span><b>${money(HOME_GOALS.leaseDeposit)}</b></div></div>`;
      }
    }
    if (gh !== this.goalHtml) { this.goal.innerHTML = gh; this.goalHtml = gh; }
    this.goal.classList.toggle('ready', !this.isStore && s.milestone.outgrown && (!s.milestone.leaseSigned || s.era === 'home'));

    // tutorial coach
    const showCoach = !tut.done && !!TUT[tut.step];
    this.coach.hidden = !showCoach;
    this.coach.classList.toggle('shifted', !!this.panelId);
    if (showCoach) {
      const step = TUT[tut.step];
      const ch = `<div class="av">🫧</div><div><div class="step">${this.isStore ? 'Your first store' : 'Getting started'} · ${tut.step + 1} of ${TUT.length}</div><p>${step.text(esc(s.founder.name))}</p>${step.last ? `<a class="skip" data-act="nexttut">Got it, thanks!</a>` : `<a class="skip" data-act="skiptut">Skip the tutorial</a>`}</div>`;
      if (ch !== this.coachHtml) { this.coach.innerHTML = ch; this.coachHtml = ch; this.coach.style.animation = 'none'; void this.coach.offsetWidth; this.coach.style.animation = ''; }
    }

    if (this.devOpen) this._dev();
    this._live();
  }

  // Fill the fast-changing bits without touching the surrounding HTML.
  _live() {
    const s = this.game.state;
    this.root.querySelectorAll('[data-live]').forEach((n) => {
      const [kind, id] = n.dataset.live.split(':');
      if (kind === 'station') n.style.width = `${stationProgress(s.stations[Number(id)]) * 100}%`;
      else if (kind === 'transfer') { const t = (s.transfers || []).find((x) => x.id === id); if (t) n.style.width = `${(1 - t.eta / t.lead) * 100}%`; }
      else if (kind === 'delivery') { const d = s.deliveries.find((x) => x.id === id); if (d) n.style.width = `${(1 - d.eta / d.lead) * 100}%`; }
      else if (kind === 'campaign') {
        const a = s.marketing.active.find((x) => x.id === id), c = CAMPAIGNS[id];
        n.style.width = a ? `${(a.remaining / c.duration) * 100}%` : `${(1 - (s.marketing.cooldowns[id] || 0) / c.cooldown) * 100}%`;
      } else if (kind === 'order' || kind === 'ordertime') {
        const o = s.orders.find((x) => x.id === id);
        if (!o) return;
        const left = Math.max(0, o.deadline - s.time.total);
        if (kind === 'order') {
          n.style.width = `${(left / o.window) * 100}%`;
          const card = n.closest('.order');
          if (card) card.classList.toggle('urgent', left < 30);
        } else n.textContent = left < 30 ? `⏰ ${Math.ceil(left)}s left!` : `${Math.ceil(left)}s left`;
      }
    });
  }

  _dev() {
    const s = this.game.state;
    const html = `<b>Developer diagnostics</b> (\` to close)
      <pre>era ${s.era} · day ${s.time.day} t ${s.time.t.toFixed(0)} · speed ${s.time.paused ? 'paused' : s.time.speed}
cash ${s.cash} · ledger ${s.ledger.sum} · ${Math.abs(s.cash - s.ledger.sum) < 0.005 ? 'OK' : 'MISMATCH'}
rep ${s.reputation} · soul ${s.soul.toFixed(1)} · next order ${s.orderTimer.toFixed(1)}
queue ${s.queue.length} · stations ${s.stations.map((x) => x.phase).join('/')}
actors ${s.actors.map((a) => `${a.id}:${a.task ? a.task.type + a.task.i : 'idle'}`).join(' ')}
${s.store ? `store: ${s.store.customers.length} shoppers (${s.store.customers.map((c) => c.state[0]).join('')}) · line ${s.store.queue.length} · till ${s.store.till || '-'} · ★${s.store.reputation} · layout v${s.store.layoutVer}
` : ''}goals ${Math.round(homeProgress(s) * 100)}% · fps ${this.app.fps ? this.app.fps.toFixed(0) : '-'}</pre>
      <div class="btns"><button data-act="d-cash">+$500</button><button data-act="d-stock">+stock</button><button data-act="d-ing">+ingredients</button><button data-act="d-order">spawn order</button><button data-act="d-day">end day</button>${s.era === 'store' ? '<button data-act="d-shopper">+5 shoppers</button><button data-act="d-fill">fill displays</button>' : '<button data-act="d-goal">near milestone</button><button data-act="d-store">jump to store</button>'}</div>`;
    if (html !== this.devHtml) { this.dev.innerHTML = html; this.devHtml = html; }
    this.modalActs = this.modalActs || {};
    if (!this._devActs) {
      this._devActs = {
        'd-cash': () => transact(this.game, 500, 'Developer', 'debug'),
        'd-stock': () => { for (const k of s.skus) this.game.state.goods[k.id] += 6; },
        'd-ing': () => { for (const id of Object.keys(this.game.state.ingredients)) this.game.state.ingredients[id] += Math.min(10, Math.max(0, Math.floor(ingredientFree(this.game.state) / 8))); },
        'd-order': () => spawnOrder(this.game),
        'd-shopper': () => { for (let i = 0; i < 5; i++) if (this.game.state.store.customers.length < STORE.maxCustomers) spawnCustomer(this.game); },
        'd-fill': () => { for (const fu of this.game.state.store.furniture) for (const sl of fu.slots) if (sl.skuId) sl.stock = FURNITURE[fu.type].slotCap; },
        'd-store': () => { const st = this.game.state; st.milestone.outgrown = true; st.milestone.leaseSigned = true; for (const k of st.skus) st.goods[k.id] += 12; this.app.openStore(); },
        'd-day': () => { this.game.state.time.t = DAY_LENGTH - 0.5; },
        'd-goal': () => { const st = this.game.state; st.stats.revenue = HOME_GOALS.revenue - 20; st.stats.ordersFulfilled = HOME_GOALS.orders - 1; for (const id of ['mixer', 'pantry', 'goods', 'packing']) if (!st.upgrades[id]) { transact(this.game, UPGRADES[id].cost, 'Developer', 'debug'); buyUpgrade(this.game, id); } for (let i = 0; i < 25; i++) st.reviews.push({ stars: 5, customer: 'Test', product: '', text: 'debug', day: st.time.day }); st.reviews.splice(0, Math.max(0, st.reviews.length - 30)); st.reputation = 4.6; },
      };
    }
    Object.assign(this.modalActs, this._devActs);
  }

  // ---- Per frame ---------------------------------------------------------------------
  update(dt) {
    if (this.dead) return;
    const s = this.game.state;
    this.acc += dt;
    if (this.acc >= 0.2) { this.acc = 0; this.refresh(); }

    // cash counts toward its real value
    const diff = s.cash - this.cashShown;
    this.cashShown = Math.abs(diff) < 0.5 ? s.cash : this.cashShown + diff * Math.min(1, dt * 9);
    const cashText = money(Math.round(this.cashShown));
    if (cashText !== this._cashText) { this.h.cash.textContent = cashText; this._cashText = cashText; this.h.cash.classList.toggle('neg', s.cash < 0); }

    // world-anchored labels
    const want = new Map();
    const eng = this.app.engine, anchors = this.app.world.anchors;
    s.stations.forEach((st) => {
      if (!st.unlocked || !st.job) return;
      const sku = getSku(s, st.job.skuId);
      const sw = `<span class="sw" style="background:${SCENTS[sku.scentId].color}">${productIcon(PRODUCTS[sku.productId].container)}</span>`;
      if (st.phase === 'running') want.set(`st${st.id}`, { a: `station${st.id}`, cls: 'pill', html: `${sw}<span class="pbar"><i style="width:${stationProgress(st) * 100}%"></i></span>`, k: 'run' + st.job.id, live: (n) => { n.querySelector('.pbar i').style.width = `${stationProgress(st) * 100}%`; } });
      else if (st.phase === 'done') want.set(`st${st.id}`, st.blocked ? { a: `station${st.id}`, cls: 'pill warn', html: '⚠ Stock shelf is full', k: 'blk' } : { a: `station${st.id}`, cls: 'pill ready', html: `✓ ${st.job.units} ready`, k: 'done' + st.job.id });
      else want.set(`st${st.id}`, { a: `station${st.id}`, cls: 'pill', html: `${sw} Prepping…`, k: 'prep' + st.job.id });
    });
    for (const a of s.actors) {
      if (!a.task) continue;
      const rec = this.isStore && a.id !== 'founder' ? staffRecord(s, a.id) : null;
      const nm = a.id === 'founder' ? esc(s.founder.name) : rec ? esc(rec.name) : 'Helper';
      const working = a.task.timer >= 0 && !a.task.noBar;
      want.set(`ac${a.id}`, { a: a.id, cls: 'pill name', html: `${nm} · ${esc(a.task.label)}<span class="pbar" ${working ? '' : 'hidden'}><i></i></span>`, k: a.task.label + working, live: (n) => { const i = n.querySelector('.pbar i'); if (i) i.style.width = `${(a.task.progress || 0) * 100}%`; } });
    }
    for (const [key, w] of want) {
      let L = this.labels.get(key);
      if (!L) { L = { n: el(`<div class="wl"></div>`), k: null }; this.labelsRoot.append(L.n); this.labels.set(key, L); }
      if (L.k !== w.k) { L.n.innerHTML = `<div class="${w.cls}">${w.html}</div>`; L.k = w.k; }
      if (w.live) w.live(L.n);
      const p = anchors[w.a] ? eng.project(anchors[w.a]) : null;
      if (p && p.visible) { L.n.style.display = ''; L.n.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-100%)`; } else L.n.style.display = 'none';
    }
    for (const [key, L] of this.labels) if (!want.has(key)) { L.n.remove(); this.labels.delete(key); }

    // hover tooltip
    let f = this.hover && this.fixtures[this.hover];
    if (this.hover && this.hover.startsWith('f:')) {
      const fu = getFurniture(s, this.hover.slice(2));
      if (fu) {
        const names = fu.slots.map((sl) => { const k = sl.skuId && getSku(s, sl.skuId); return k ? `${k.name} (${sl.stock})` : 'empty'; });
        f = { name: FURNITURE[fu.type].name, hint: this.panelId === 'build' ? 'Click to move, rotate or sell' : fu.slots.length ? esc(names.join(' · ')) : 'Decor' };
      }
    }
    if (this.bm.placing && this.bm.cx !== undefined && !this.modalOpen) {
      const F = FURNITURE[this.bm.placing];
      const html = `${F.name}<small>${this.bm.ok ? (this.bm.moving ? 'Click to set it down' : `Click to place · ${money(F.cost)}`) : esc(this.bm.reason)}</small>`;
      if (this._tipKey !== html) { this.tip.innerHTML = html; this._tipKey = html; }
      this.tip.hidden = false;
      this.tip.classList.toggle('bad', !this.bm.ok);
      this.tip.style.transform = `translate(${this.bm.cx}px,${this.bm.cy - 28}px) translate(-50%,-100%)`;
    } else if (f && anchors[this.hover] && !this.modalOpen) {
      this.tip.classList.remove('bad');
      const p = eng.project(anchors[this.hover]);
      const key = this.hover;
      if (this._tipKey !== key) { this.tip.innerHTML = `${f.name}<small>${f.hint}</small>`; this._tipKey = key; }
      this.tip.hidden = false;
      const busy = (key === 'station0' && s.stations[0].job) || (key === 'station1' && s.stations[1].job);
      this.tip.style.transform = `translate(${p.x.toFixed(1)}px,${(p.y - (busy ? 36 : 0)).toFixed(1)}px) translate(-50%,-100%)`;
    } else { this.tip.hidden = true; this._tipKey = null; this.tip.classList.remove('bad'); }
  }
}

export { starStr, skuSwatch };
