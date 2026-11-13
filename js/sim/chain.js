// ChainService (brief §6, Milestone 5): several stores, each with its own shop floor, staff, back
// stock, shoppers and KPIs.
//
// How multiple stores live in one save: the store you are looking at (or the simulation is
// currently ticking) occupies the "live slots" state.store, state.goods and state.actors, exactly
// as in Era II, so every store rule keeps working unchanged. Every other store waits in
// state.parked[id]. swapTo() moves stores in and out of the live slots; the data always exists
// exactly once, so saves stay plain JSON.
//
// Company-wide things stay global: ingredients, recipes, production stations and the queue (which
// physically live in the Main Street workroom), online orders, reviews, Brand Soul and cash.

import { STORE, LOCATIONS, LOCATION_ORDER, STARTER_LAYOUT, CHAIN, EXPANSION_GOALS, FURNITURE } from '../data.js';
import { transact } from './economy.js';
import { newStoreState, refreshCandidates, autoAssignSlot, designScore, cleanliness, getFurniture } from './store.js';
import { addGoods } from './inventory.js';
import { makeStaff } from './people.js';

const r2 = (v) => Math.round(v * 100) / 100;

export const currentId = (state) => state.current || 'main';
export function storeIds(state) {
  return state.storeOrder && state.storeOrder.length ? state.storeOrder : state.store ? ['main'] : [];
}
export const isMainStore = (state) => currentId(state) === 'main';
export const branchCount = (state) => Math.max(0, storeIds(state).length - 1);

export function swapTo(state, id) {
  const cur = currentId(state);
  if (cur === id) return;
  const p = state.parked = state.parked || {};
  if (!p[id]) throw new Error(`No store ${id}`);
  p[cur] = { store: state.store, goods: state.goods, actors: state.actors };
  const n = p[id];
  delete p[id];
  state.store = n.store; state.goods = n.goods; state.actors = n.actors;
  state.current = id;
}

// Run fn with store `id` in the live slots, then put back whatever was there.
export function withStore(state, id, fn) {
  const back = currentId(state);
  swapTo(state, id);
  try { return fn(); } finally { swapTo(state, back); }
}
export function forEachStore(state, fn) {
  return storeIds(state).map((id) => withStore(state, id, () => fn(id)));
}

// Peek at a store's data without swapping (read-only use).
export function storeData(state, id) {
  if (id === currentId(state)) return { store: state.store, goods: state.goods, actors: state.actors };
  return state.parked && state.parked[id];
}
export const goodsOf = (state, id) => { if (id === 'kitchen') return state.kitchen ? state.kitchen.warehouse : null; const d = storeData(state, id); return d ? d.goods : null; };
export const locationOf = (store) => LOCATIONS[(store && store.location) || 'main'] || LOCATIONS.main;

// ---- Expansion goals -------------------------------------------------------------------------

export function expansionGoals(state) {
  const g = EXPANSION_GOALS, st = state.store;
  const days = st ? state.time.day - (state.milestone.storeDay || state.time.day) : 0;
  const main = storeData(state, 'main');
  const ms = main ? main.store : st;
  return [
    { id: 'revenue', label: 'Earn lifetime revenue', value: state.stats.revenue, target: g.revenue, money: true },
    { id: 'rating', label: 'Reach a store rating', value: ms ? ms.reputation : 0, target: g.rating, from: 3, decimals: 1, hint: 'Full displays, a clean floor and short lines.' },
    { id: 'staff', label: 'Build a team', value: ms ? ms.staff.length : 0, target: g.staff },
    { id: 'days', label: 'Run the shop for a few days', value: days, target: g.days },
  ].map((x) => ({ ...x, done: x.value >= x.target, pct: Math.max(0, Math.min(1, (x.value - (x.from || 0)) / (x.target - (x.from || 0)))) }));
}
export function tickExpansion(game) {
  const s = game.state;
  if (s.era === 'store' && !s.milestone.chainReady && expansionGoals(s).every((x) => x.done)) {
    s.milestone.chainReady = true;
    game.emit('chainReady', {});
  }
}

// ---- Opening a branch -----------------------------------------------------------------------

export function canOpenBranch(state, locId) {
  const L = LOCATIONS[locId];
  if (!L || locId === 'main') return { ok: false, reason: 'Unknown location.' };
  if (state.era !== 'store') return { ok: false, reason: 'Open your first store first.' };
  if (!state.milestone.chainReady) return { ok: false, reason: 'Main Street needs to be established first.' };
  if (branchCount(state) >= CHAIN.maxBranches) return { ok: false, reason: 'That is as many shops as the brand can look after for now.' };
  if (storeIds(state).some((id) => storeData(state, id).store.location === locId)) return { ok: false, reason: 'You already have a shop there.' };
  if (state.cash < L.deposit) return { ok: false, reason: `You need ${L.deposit} for the deposit.` };
  return { ok: true };
}

export function openBranch(game, locId) {
  const s = game.state, L = LOCATIONS[locId];
  const chk = canOpenBranch(s, locId);
  if (!chk.ok) return chk;
  if (!s.storeOrder || !s.storeOrder.length) s.storeOrder = ['main'];
  s.current = currentId(s);
  const id = game.nextId('store');
  const st = newStoreState();
  Object.assign(st, { id, name: L.name, location: locId });
  st.tutorial.done = true; // the player already knows how a shop works
  const goods = {};
  for (const k of s.skus) goods[k.id] = 0;
  s.parked = s.parked || {};
  s.parked[id] = { store: st, goods, actors: [] };
  s.storeOrder.push(id);
  withStore(s, id, () => {
    transact(game, -L.deposit, 'Rent / lease', `Deposit: ${L.name}`); // booked to the new shop
    for (const p of STARTER_LAYOUT) st.furniture.push({ id: game.nextId('f'), type: p.type, i: p.i, j: p.j, rot: p.rot, slots: Array.from({ length: FURNITURE[p.type].slots }, () => ({ skuId: null, stock: 0, claimedBy: null, refill: 0.5, rush: false })) });
    st.layoutVer = 1;
    for (const fu of st.furniture) fu.slots.forEach((_, k) => autoAssignSlot(s, fu, k));
    st.openedDay = s.time.day;
    refreshCandidates(game);
    // someone to run it: there is always a manager among the first applicants
    st.candidates[0] = makeStaff(game, 'manager');
  });
  // Opening stock: Main Street's back room sends what it can spare (included in the deposit).
  const main = goodsOf(s, 'main'), shown = new Set();
  for (const fu of st.furniture) for (const sl of fu.slots) if (sl.skuId) shown.add(sl.skuId);
  const opening = {};
  for (const sku of shown) { const n = Math.min(12, Math.floor((main[sku] || 0) / 2)); if (n > 0) opening[sku] = n; }
  if (Object.keys(opening).length) {
    for (const [sku, q] of Object.entries(opening)) main[sku] -= q;
    s.transfers = s.transfers || [];
      s.transfers.push({ id: game.nextId('t'), from: 'main', to: id, items: opening, eta: CHAIN.transferTime, lead: CHAIN.transferTime, auto: true, opening: true });
  }
  game.emit('branchOpened', { id, location: locId });
  return { ok: true, id };
}

// ---- Moving stock between stores ---------------------------------------------------------------

export function transferStock(game, fromId, toId, items, { auto = false } = {}) {
  const s = game.state;
  if (fromId === toId) return { ok: false, reason: 'Pick two different stores.' };
  const from = goodsOf(s, fromId), to = goodsOf(s, toId);
  if (!from || !to) return { ok: false, reason: 'Unknown store.' };
  const clean = {};
  for (const [sku, q] of Object.entries(items)) { const n = Math.floor(q); if (n > 0) clean[sku] = n; }
  const units = Object.values(clean).reduce((a, b) => a + b, 0);
  if (!units) return { ok: false, reason: 'Nothing to send.' };
  for (const [sku, q] of Object.entries(clean)) if ((from[sku] || 0) < q) return { ok: false, reason: 'Not enough in back stock there.' };
  if (!transact(game, -CHAIN.transferFee, 'Distribution', `Courier ${storeName(s, fromId)} → ${storeName(s, toId)}`)) return { ok: false, reason: 'Not enough cash for the courier.' };
  for (const [sku, q] of Object.entries(clean)) from[sku] -= q;
  const t = { id: game.nextId('t'), from: fromId, to: toId, items: clean, eta: CHAIN.transferTime, lead: CHAIN.transferTime, auto };
  s.transfers = s.transfers || [];
  s.transfers.push(t);
  game.emit('transferSent', t);
  return { ok: true, transfer: t };
}

export function tickTransfers(game, dt) {
  const s = game.state;
  if (!s.transfers || !s.transfers.length) return;
  for (let i = s.transfers.length - 1; i >= 0; i--) {
    const t = s.transfers[i];
    t.eta -= dt;
    if (t.eta > 0) continue;
    s.transfers.splice(i, 1);
    const to = goodsOf(s, t.to);
    for (const [sku, q] of Object.entries(t.items)) to[sku] = (to[sku] || 0) + q;
    game.emit('transferArrived', t);
  }
}
export const inTransit = (state, toId, sku) => (state.transfers || []).filter((t) => t.to === toId).reduce((a, t) => a + (t.items[sku] || 0), 0);

// A store manager in a branch keeps back stock topped up from Main Street (in the live slots).
export function managerReorder(game) {
  const s = game.state, st = s.store, id = currentId(s);
  if (id === 'main') return;
  const main = goodsOf(s, 'main');
  const want = {};
  const shown = new Set();
  for (const fu of st.furniture) for (const sl of fu.slots) if (sl.skuId) shown.add(sl.skuId);
  for (const sku of shown) {
    const have = (s.goods[sku] || 0) + inTransit(s, id, sku);
    if (have < CHAIN.par && (main[sku] || 0) > CHAIN.par) want[sku] = Math.min(12, main[sku] - CHAIN.par, CHAIN.par * 2 - have);
  }
  if (Object.keys(want).length) transferStock(game, 'main', id, want, { auto: true });
  // and puts something on any empty display
  for (const fu of st.furniture) fu.slots.forEach((sl, k) => { if (!sl.skuId) autoAssignSlot(s, fu, k); });
}

export function storeName(state, id) {
  if (id === 'kitchen') return 'Central kitchen';
  const d = storeData(state, id);
  return d && d.store ? d.store.name || 'Main Street' : 'Main Street';
}

// ---- KPIs ------------------------------------------------------------------------------------------

export function storeKpis(state) {
  return forEachStore(state, (id) => {
    const st = state.store, L = locationOf(st);
    const t = st.today, last = st.days[st.days.length - 1] || null;
    const ledgerDay = state.ledger.days[state.ledger.days.length - 1];
    const byStore = ledgerDay && ledgerDay.byStore && ledgerDay.byStore[id];
    return {
      id, name: st.name || 'Main Street', location: L.id, isMain: id === 'main',
      shoppers: st.customers.length, staff: st.staff.length,
      visitorsToday: t.visitors, salesToday: t.revenue, conversion: t.buyers + t.walkouts ? t.buyers / (t.buyers + t.walkouts) : null,
      rating: st.reputation, clean: cleanliness(state), design: designScore(state).total,
      backStock: Object.values(state.goods).reduce((a, b) => a + b, 0),
      onDisplay: st.furniture.reduce((a, f) => a + f.slots.reduce((b, sl) => b + sl.stock, 0), 0),
      stockoutsToday: t.stockouts,
      yesterday: last ? { visitors: last.visitors, revenue: last.revenue, rating: last.rating } : null,
      profitYesterday: byStore ? r2(byStore.revenue - byStore.expenses) : null,
      rent: L.rent,
      hasManager: st.staff.some((x) => x.role === 'manager'),
    };
  });
}

// Total units the company holds anywhere (for tests and the brand report).
export function companyUnits(state) {
  let n = 0;
  forEachStore(state, () => {
    n += Object.values(state.goods).reduce((a, b) => a + b, 0);
    for (const fu of state.store.furniture) for (const sl of fu.slots) n += sl.stock;
    for (const c of state.store.customers) n += c.basket.reduce((a, l) => a + l.qty, 0);
    for (const a of state.actors) if (a.task && a.task.payload && a.task.type !== 'collect') n += a.task.payload.units;
  });
  for (const t of state.transfers || []) n += Object.values(t.items).reduce((a, b) => a + b, 0);
  if (state.kitchen) n += Object.values(state.kitchen.warehouse).reduce((a, b) => a + b, 0);
  for (const o of state.orders) if (o.status !== 'open') n += o.lines.reduce((a, l) => a + l.qty, 0);
  return n;
}

// Per-store profit and loss by day, from the ledger's own per-store attribution. Company-wide items
// (ingredients, online orders, R&D, distribution...) sit in their own 'company' column, so the
// columns always add up to the day's company profit.
export function storeProfit(state, n = 7) {
  return state.ledger.days.slice(-n).map((d) => {
    const cols = {};
    for (const [id, b] of Object.entries(d.byStore || {})) cols[id] = { revenue: b.revenue, expenses: b.expenses, profit: r2(b.revenue - b.expenses) };
    return { day: d.day, profit: d.profit, cols };
  });
}

export { LOCATION_ORDER, addGoods, getFurniture, STORE };
