// StoreService + BuildService + CustomerService (brief §12) for Era II, the first retail store.
//
//  * The shop floor is a grid. Displays (shelves, tables) and decor are placed, moved, rotated and
//    sold in build mode; every change is validated so aisles, the till and the back room stay
//    reachable.
//  * Each display slot shows one recipe. Shelf stock is separate from back stock (state.goods):
//    staff carry units out of the back room to fill displays.
//  * Walk-in shoppers arrive with an archetype, a budget, patience and a few things they want.
//    They browse displays, pick items up, queue at the till, pay and leave, and their visit
//    becomes a rating that drives store reputation (and sometimes a written review).
//
// Shoppers can never get stuck: every state has a time limit, unreachable targets are skipped,
// and a shopper who cannot find a way out is walked to the door.

import { STORE, STORE_POINTS, STARTER_LAYOUT, FURNITURE, ARCHETYPES, ARCHETYPE_ORDER, QUEUE_CELLS, CUSTOMER_NAMES, STORE_REVIEW_TEXT, PRODUCT_ORDER, DAY_LENGTH, SELL_BACK, STORE_GRID, STORE_ROWS, LOYALTY, LOCATIONS } from '../data.js';
import { transact } from './economy.js';
import { getSku, refPrice, skuQuality, skuRating, addGoods, productUnlocked } from './inventory.js';
import { addReview, marketingBoost } from './orders.js';
import { releaseTask } from './workers.js';
import { checkPlacement, accessCells, cellCenter, cellOf, walkGrid, isWalkable, walkTo, FRONT, furnitureCenter } from './path.js';
import { makeStaff, randomLook } from './people.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = (v) => Math.round(v * 100) / 100;

export function newStoreState() {
  return {
    id: 'main', name: 'Main Street', location: 'main',
    layoutVer: 0,
    furniture: [],
    customers: [],
    queue: [],
    till: null,
    spawnTimer: 2,
    staff: [],
    candidates: [],
    ratings: [],
    reputation: 3.8,
    stats: { visitors: 0, buyers: 0, walkouts: 0, stockouts: 0, items: 0, revenue: 0, missed: 0, helped: 0 },
    today: { visitors: 0, buyers: 0, walkouts: 0, stockouts: 0, items: 0, revenue: 0, missed: 0, reasons: {} },
    days: [],
    tutorial: { step: 0, done: false },
    clean: 100,          // floor condition, 0-100 (messes count against it on top)
    messes: [],          // spills and dropped bits waiting to be tidied
    loyalty: false,      // loyalty card programme
  };
}

// ---- Opening the store (the era switch) ------------------------------------------

export function openStore(game) {
  const s = game.state;
  if (s.era === 'store') return { ok: false, reason: 'The store is already open.' };
  if (!s.milestone.leaseSigned) return { ok: false, reason: 'Sign the lease first.' };
  for (const a of s.actors) releaseTask(game, a);
  s.era = 'store';
  const st = s.store = newStoreState();
  s.milestone.storeOpened = true;
  s.milestone.storeDay = s.time.day;
  for (const p of STARTER_LAYOUT) st.furniture.push(newFurniture(game, p.type, p.i, p.j, p.rot));
  st.layoutVer = 1;
  for (const fu of st.furniture) fu.slots.forEach((_, k) => autoAssign(s, fu, k));
  // Move the kitchen's finished stock straight onto the new displays.
  for (const fu of st.furniture) for (const slot of fu.slots) {
    if (!slot.skuId) continue;
    const n = Math.min(s.goods[slot.skuId] || 0, FURNITURE[fu.type].slotCap);
    s.goods[slot.skuId] -= n; slot.stock += n;
  }
  // The founder moves into the back room; the weekend helper becomes the first sales associate.
  const founder = s.actors.find((a) => a.id === 'founder');
  const actors = [placeActor(founder, 'rest')];
  if (s.actors.some((a) => a.id === 'helper') || s.upgrades.helper) {
    st.staff.push(makeStaff(game, 'associate', { id: 'helper', name: 'Robin', look: 'helper', wage: 34, speed: 1, service: 1.05 }));
    actors.push(placeActor({ id: 'helper' }, 'floor'));
  }
  s.actors = actors;
  for (const o of s.orders) if (o.status === 'packing') { o.status = 'queued'; o.claimedBy = null; }
  refreshCandidates(game);
  game.emit('storeOpened', {});
  return { ok: true };
}

function placeActor(a, point) {
  const p = STORE_POINTS[point];
  return Object.assign(a, { x: p.x, z: p.z, face: p.face, task: null, anim: 'idle', carrying: null, path: null, pathKey: null, pathVer: -1 });
}

export function refreshCandidates(game) {
  const st = game.state.store;
  const roles = ['cashier', 'associate', 'stocker', 'maker'];
  st.candidates = [roles[game.randInt(0, 1)], roles[game.randInt(1, 3)], game.pick(roles)].map((role) => makeStaff(game, role));
}

// ---- Displays and build mode ------------------------------------------------------------

function newFurniture(game, type, i, j, rot) {
  const F = FURNITURE[type];
  return { id: game.nextId('f'), type, i, j, rot, slots: Array.from({ length: F.slots }, () => ({ skuId: null, stock: 0, claimedBy: null, refill: 0.5, rush: false })) };
}

export const isDisplay = (fu) => FURNITURE[fu.type].slots > 0;
export function getFurniture(state, id) { return state.store ? state.store.furniture.find((f) => f.id === id) : null; }

const locOf = (state) => LOCATIONS[(state.store && state.store.location) || 'main'] || LOCATIONS.main;
export const storeRent = (state) => locOf(state).rent;

// Give an empty slot the listed recipe that is on the fewest displays.
export function autoAssignSlot(state, fu, k) { return autoAssign(state, fu, k); }
function autoAssign(state, fu, k) {
  const count = {};
  for (const f of state.store.furniture) for (const sl of f.slots) if (sl.skuId) count[sl.skuId] = (count[sl.skuId] || 0) + 1;
  const pool = state.skus.filter((x) => !x.paused);
  if (!pool.length) return;
  pool.sort((a, b) => (count[a.id] || 0) - (count[b.id] || 0));
  fu.slots[k].skuId = pool[0].id;
}

export function placeFurniture(game, type, i, j, rot) {
  const s = game.state, st = s.store;
  if (!st) return { ok: false, reason: 'You need a store first.' };
  const chk = checkPlacement(st, type, i, j, rot);
  if (!chk.ok) return chk;
  const F = FURNITURE[type];
  if (!transact(game, -F.cost, 'Store fixtures', F.name)) return { ok: false, reason: 'Not enough cash.' };
  const fu = newFurniture(game, type, i, j, rot);
  st.furniture.push(fu);
  st.layoutVer += 1;
  fu.slots.forEach((_, k) => autoAssign(s, fu, k));
  game.emit('furniturePlaced', fu);
  return { ok: true, furniture: fu };
}

export function moveFurniture(game, id, i, j, rot) {
  const st = game.state.store, fu = getFurniture(game.state, id);
  if (!fu) return { ok: false, reason: 'That item is gone.' };
  const chk = checkPlacement(st, fu.type, i, j, rot, id);
  if (!chk.ok) return chk;
  fu.i = i; fu.j = j; fu.rot = rot;
  st.layoutVer += 1;
  game.emit('furnitureMoved', fu);
  return { ok: true };
}

export function rotateFurniture(game, id) {
  const fu = getFurniture(game.state, id);
  if (!fu) return { ok: false, reason: 'That item is gone.' };
  return moveFurniture(game, id, fu.i, fu.j, (fu.rot + 1) % 4);
}

export function sellFurniture(game, id) {
  const s = game.state, st = s.store, fu = getFurniture(s, id);
  if (!fu) return { ok: false, reason: 'That item is gone.' };
  if (isDisplay(fu) && st.furniture.filter(isDisplay).length <= 1) return { ok: false, reason: 'Keep at least one display for your products.' };
  for (const slot of fu.slots) if (slot.skuId && slot.stock) addGoods(s, slot.skuId, slot.stock);
  st.furniture.splice(st.furniture.indexOf(fu), 1);
  st.layoutVer += 1;
  const F = FURNITURE[fu.type];
  transact(game, F.cost * SELL_BACK, 'Store fixtures', `Sold a ${F.name}`);
  game.emit('furnitureSold', fu);
  return { ok: true };
}

// Choose which recipe a display slot shows. Whatever was on it goes back to back stock.
export function assignSlot(game, fid, k, skuId) {
  const s = game.state, fu = getFurniture(s, fid);
  if (!fu || !fu.slots[k]) return { ok: false, reason: 'No such display.' };
  if (skuId && !getSku(s, skuId)) return { ok: false, reason: 'Unknown recipe.' };
  const slot = fu.slots[k];
  if (slot.skuId === skuId) return { ok: true };
  if (slot.skuId && slot.stock) addGoods(s, slot.skuId, slot.stock);
  slot.skuId = skuId || null; slot.stock = 0;
  game.emit('slotAssigned', { fu, k });
  return { ok: true };
}

export function unitsOnDisplay(state, skuId = null) {
  if (!state.store) return 0;
  let n = 0;
  for (const fu of state.store.furniture) for (const sl of fu.slots) if (!skuId || sl.skuId === skuId) n += sl.stock;
  return n;
}
export function displaySlots(state, skuId) {
  if (!state.store) return 0;
  return state.store.furniture.reduce((a, fu) => a + fu.slots.filter((sl) => sl.skuId === skuId).length, 0);
}

// Where to stand to use a display (optionally one slot of it), nearest to (fromX, fromZ).
export function slotPoint(state, fu, k = -1, fromX = 0, fromZ = 0, jitter = 0) {
  const walk = walkGrid(state.store);
  let cells = accessCells(fu, k).filter(([i, j]) => isWalkable(walk, i, j));
  if (!cells.length) cells = accessCells(fu).filter(([i, j]) => isWalkable(walk, i, j));
  if (!cells.length) return null;
  let best = cells[0], bd = Infinity;
  for (const c of cells) { const p = cellCenter(...c); const d = Math.hypot(p.x - fromX, p.z - fromZ); if (d < bd) { bd = d; best = c; } }
  const p = cellCenter(...best);
  const ctr = furnitureCenter(fu);
  let face;
  if (fu.type === 'table') face = Math.atan2(ctr.x - p.x, ctr.z - p.z);
  else { const [fx, fz] = FRONT[fu.rot]; face = Math.atan2(-fx, -fz); }
  return { x: r2(p.x + jitter * Math.cos(face)), z: r2(p.z - jitter * Math.sin(face)), face };
}

// ---- Foot traffic -------------------------------------------------------------------------

export function storeAppeal(state) {
  if (!state.store) return 0;
  return state.store.furniture.reduce((a, fu) => a + FURNITURE[fu.type].appeal, 0);
}

// Arrivals per day follow a gentle lunchtime and after-work rhythm.
export function hourCurve(t) {
  const d = t / DAY_LENGTH;
  return 0.75 + 0.4 * Math.exp(-(((d - 0.35) / 0.11) ** 2)) + 0.5 * Math.exp(-(((d - 0.76) / 0.12) ** 2));
}

// ---- Cleanliness and store design (Milestone 4) --------------------------------------------

export function cleanliness(state) {
  const st = state.store;
  if (!st) return 100;
  return clamp(Math.round(st.clean - st.messes.length * 4), 0, 100);
}

// Store design score (0-100): what a shopper sees when they walk in. Each part is explained in
// the Build panel so the player can see why it is high or low.
export function designScore(state) {
  const st = state.store, s = state;
  const displays = st.furniture.filter(isDisplay);
  const families = new Set(), unlocked = PRODUCT_ORDER.filter((id) => productUnlocked(s, id));
  let slots = 0, stocked = 0;
  for (const fu of displays) for (const sl of fu.slots) {
    if (!sl.skuId) continue;
    slots += 1;
    if (sl.stock > 0) stocked += 1;
    const k = getSku(s, sl.skuId);
    if (k) families.add(k.productId);
  }
  const decor = st.furniture.reduce((a, fu) => a + (isDisplay(fu) ? 0 : FURNITURE[fu.type].appeal), 0);
  // floor space used by furniture, as a share of the buildable floor
  let used = 0;
  for (const fu of st.furniture) { const F = FURNITURE[fu.type]; used += F.w * F.d; }
  const floorCells = STORE_GRID.cols * (STORE_ROWS.floor[1] - STORE_ROWS.floor[0] + 1);
  const occupancy = used / floorCells;
  const entrance = STORE_POINTS.inside;
  const welcome = displays.some((fu) => fu.type === 'table' && fu.slots.some((sl) => sl.stock > 0) && Math.hypot(furnitureCenter(fu).x - entrance.x, furnitureCenter(fu).z - entrance.z) < 4.5);
  const parts = [
    { id: 'variety', label: 'Product variety', value: Math.round(20 * (unlocked.length ? families.size / unlocked.length : 0)), max: 20, tip: 'Show every product line you make.' },
    { id: 'stocked', label: 'Full displays', value: Math.round(20 * (slots ? stocked / slots : 0)), max: 20, tip: 'Empty spots look neglected.' },
    { id: 'decor', label: 'Decor and comfort', value: Math.round(20 * Math.min(1, decor / 12)), max: 20, tip: 'Plants, lamps, benches and a tester bar.' },
    { id: 'clean', label: 'Cleanliness', value: Math.round(20 * (cleanliness(s) / 100)), max: 20, tip: 'Staff tidy up between other jobs.' },
    { id: 'space', label: 'Room to browse', value: Math.round(15 * clamp((0.6 - occupancy) / 0.25, 0, 1)), max: 15, tip: 'A crammed floor feels stressful.' },
    { id: 'welcome', label: 'Welcome display', value: welcome ? 5 : 0, max: 5, tip: 'A stocked display table near the door.' },
  ];
  return { total: parts.reduce((a, p) => a + p.value, 0), parts };
}

export function trafficBreakdown(state) {
  const st = state.store;
  const rep = 0.55 + ((st.reputation * 0.6 + state.reputation * 0.4) / 5) * 0.75;
  const soul = 0.85 + (state.soul / 100) * 0.3;
  const appeal = 0.8 + (designScore(state).total / 100) * 0.55;
  const daysOpen = state.time.day - (st.openedDay || state.milestone.storeDay || state.time.day);
  const growth = 1 + Math.min(0.5, daysOpen * 0.05);
  const marketing = 1 + marketingBoost(state, 'store') + marketingBoost(state, 'online') * 0.25;
  const hour = hourCurve(state.time.t);
  const place = locOf(state).traffic;
  return { rep, soul, appeal, growth, marketing, hour, place, total: rep * soul * appeal * growth * marketing * hour * place };
}

export function spawnCustomer(game) {
  const s = game.state, st = s.store;
  const weights = archetypeWeights(s);
  let r = game.rand() * ARCHETYPE_ORDER.reduce((a, id) => a + weights[id], 0), arch = ARCHETYPE_ORDER[0];
  for (const id of ARCHETYPE_ORDER) { r -= weights[id]; if (r <= 0 && weights[id] > 0) { arch = id; break; } }
  const A = ARCHETYPES[arch];
  const pool = PRODUCT_ORDER.filter((id) => productUnlocked(s, id) && (A.products[id] || 0) > 0), wants = [];
  const nWants = game.randInt(A.wants[0], A.wants[1]);
  while (wants.length < nWants && pool.length) {
    let w = game.rand() * pool.reduce((a, id) => a + A.products[id], 0);
    let k = 0;
    for (; k < pool.length - 1; k++) { w -= A.products[pool[k]]; if (w <= 0) break; }
    wants.push(pool.splice(k, 1)[0]);
  }
  const benches = Math.min(2, st.furniture.filter((f) => f.type === 'bench').length);
  const patience = game.randInt(A.patience[0], A.patience[1]) * (1 + benches * 0.08) * (arch === 'regular' && st.loyalty ? 1.2 : 1);
  const mood = 52 + designScore(s).total * 0.2 - (100 - cleanliness(s)) * 0.15;
  const fromLeft = game.rand() < 0.5;
  const p = STORE_POINTS[fromLeft ? 'streetL' : 'streetR'];
  const c = {
    id: game.nextId('c'), name: game.pick(CUSTOMER_NAMES), arch, look: randomLook(game),
    x: p.x, z: r2(p.z + (game.rand() - 0.5) * 0.8), face: p.face, path: null, pathKey: null, pathVer: -1,
    state: 'arrive', stateT: 0, life: 0, anim: 'walk',
    wants, wantsN: wants.length, budget: Math.round(game.randInt(A.budget[0], A.budget[1]) * locOf(s).budget), patience: Math.round(patience),
    mood: Math.round(mood), tested: false,
    visited: [], missed: [], basket: [], helped: false, helperId: null, wait: 0, timer: 0, target: null,
    exit: game.rand() < 0.5 ? 'streetL' : 'streetR', leg: 0, paid: false, reason: null,
  };
  st.customers.push(c);
  st.stats.visitors += 1; st.today.visitors += 1;
  game.emit('shopperArrived', c);
  return c;
}

// Who walks in: the newer archetypes only come once the shop sells what they want; Trend
// Shoppers follow marketing; loyalty cards bring regulars back more often.
export function archetypeWeights(state) {
  const st = state.store, out = {};
  const buzz = marketingBoost(state, 'store') + marketingBoost(state, 'online') * 0.5;
  for (const id of ARCHETYPE_ORDER) {
    const A = ARCHETYPES[id];
    let w = A.weight;
    if (A.requires && !productUnlocked(state, A.requires)) w = 0;
    if (A.trend) w *= 1 + buzz * 2;
    if (id === 'regular' && st && st.loyalty) w *= 1.6;
    if (st) w *= locOf(state).mix[id] ?? 1;
    out[id] = w;
  }
  return out;
}

export function buyLoyalty(game) {
  const st = game.state.store;
  if (!st) return { ok: false, reason: 'You need a shop for that.' };
  if (st.loyalty) return { ok: false, reason: 'Already running.' };
  if (!transact(game, -LOYALTY.cost, 'Marketing', 'Loyalty cards')) return { ok: false, reason: 'Not enough cash.' };
  st.loyalty = true;
  game.emit('loyalty', {});
  return { ok: true };
}

// ---- Shopper behaviour ------------------------------------------------------------------

function setState(c, state) { c.state = state; c.stateT = 0; }
function thought(game, c, kind) { game.emit('shopperThought', { id: c.id, kind }); }
const basketUnits = (c) => c.basket.reduce((a, l) => a + l.qty, 0);
export const basketTotal = (c) => r2(c.basket.reduce((a, l) => a + l.qty * l.price, 0));

function decide(game, c) {
  const s = game.state, st = s.store;
  const maxVisits = Math.min(4, c.wantsN + 2);
  // Some shoppers stop at the tester bar first.
  if (!c.tested && c.wants.length && c.visited.length < maxVisits && game.rand() < 0.4) {
    const tester = st.furniture.find((f) => f.type === 'tester' && !c.visited.includes(f.id));
    const pt = tester && slotPoint(s, tester, -1, c.x, c.z, (game.rand() - 0.5) * 0.3);
    if (pt) { c.target = { fid: tester.id, slot: -1, ...pt, ver: st.layoutVer }; setState(c, 'walk'); return; }
    c.tested = true;
  }
  if (c.wants.length && c.visited.length < maxVisits) {
    const opts = st.furniture.filter((f) => isDisplay(f) && !c.visited.includes(f.id));
    if (opts.length) {
      const ws = opts.map((f) => {
        const shows = f.slots.some((sl) => { const k = sl.skuId && getSku(s, sl.skuId); return k && c.wants.includes(k.productId); });
        const ctr = furnitureCenter(f);
        const tableLover = ARCHETYPES[c.arch].tables && f.type === 'table' ? 1.8 : 1;
        return FURNITURE[f.type].visibility * tableLover * (1 + (shows ? 2 : 0)) / (1 + Math.hypot(ctr.x - c.x, ctr.z - c.z) * 0.12);
      });
      let r = game.rand() * ws.reduce((a, b) => a + b, 0), pick = opts[opts.length - 1];
      for (let k = 0; k < opts.length; k++) { r -= ws[k]; if (r <= 0) { pick = opts[k]; break; } }
      const slot = pick.slots.findIndex((sl) => { const k = sl.skuId && getSku(s, sl.skuId); return k && c.wants.includes(k.productId); });
      const pt = slotPoint(s, pick, slot, c.x, c.z, (game.rand() - 0.5) * 0.3);
      if (!pt) { c.visited.push(pick.id); return; } // unreachable right now: try another next tick
      c.target = { fid: pick.id, slot, ...pt, ver: st.layoutVer };
      setState(c, 'walk');
      return;
    }
  }
  // Done browsing. Anything still on the list was not found at all.
  for (const w of c.wants) if (!c.missed.includes(w)) { c.missed.push(w); c.mood -= 7; }
  if (c.basket.length) setState(c, 'toQueue');
  else startLeave(game, c, c.missed.length ? 'stockout' : 'nothing');
}

function take(game, c, slot, sku, qty) {
  qty = Math.min(qty, slot.stock, Math.floor(c.budget / sku.price));
  if (qty <= 0) return false;
  slot.stock -= qty;
  const line = c.basket.find((l) => l.skuId === sku.id);
  if (line) line.qty += qty; else c.basket.push({ skuId: sku.id, qty, price: sku.price });
  c.budget = r2(c.budget - qty * sku.price);
  return true;
}

// Look over a display and decide what (if anything) to pick up.
function evaluate(game, c) {
  const s = game.state, st = s.store;
  const fu = getFurniture(s, c.target && c.target.fid);
  if (!fu) return;
  c.visited.push(fu.id);
  if (fu.type === 'tester') { c.tested = true; c.tried = true; c.mood += 6; thought(game, c, 'tester'); return; }
  const A = ARCHETYPES[c.arch], F = FURNITURE[fu.type];
  // Busy displays get messy: a spilled scrub, a dropped petal, a knocked-over tester.
  if (st.messes.length < STORE.maxMesses && game.rand() < STORE.messChance) {
    st.messes.push({ id: game.nextId('m'), x: r2(c.x + (game.rand() - 0.5) * 0.5), z: r2(c.z + (game.rand() - 0.5) * 0.5), kind: game.pick(['spill', 'petals', 'scrub']), claimedBy: null });
  }
  if (st.messes.some((m) => Math.hypot(m.x - c.x, m.z - c.z) < 1.6)) { c.mood -= 3; if (!c.saidDirty) { c.saidDirty = true; thought(game, c, 'dirty'); } }
  let bought = false, pricey = false;
  for (const slot of fu.slots) {
    const sku = slot.skuId && getSku(s, slot.skuId);
    if (!sku) continue;
    const ratio = sku.price / refPrice(sku);
    const priceFit = 1 - A.sens * Math.max(0, ratio - 1) * 1.1 + Math.max(0, 1 - ratio) * 0.4;
    const rating = skuRating(sku) || 4;
    const tierFit = 1 - 0.16 * Math.abs(sku.tier - A.tier) + (A.tier === 2 ? (rating - 4) * 0.08 : 0) + (skuQuality(sku) - 70) / 300;
    const trendy = A.trend ? Math.min(0.25, sku.sold * 0.004) : 0;
    const score = priceFit * tierFit * (c.helped ? 1.15 : 1) * (c.tried ? 1.1 : 1) + trendy + (game.rand() - 0.5) * 0.2;
    if (c.wants.includes(sku.productId)) {
      if (slot.stock <= 0) {
        if (!c.missed.includes(sku.productId)) { c.missed.push(sku.productId); c.mood -= 12; st.stats.stockouts += 1; st.today.stockouts += 1; thought(game, c, 'stockout'); }
        continue;
      }
      if (sku.price > c.budget) { c.mood -= 5; pricey = true; continue; }
      if (score >= 0.62) {
        const qty = (c.arch === 'regular' || c.arch === 'value') && game.rand() < 0.22 ? 2 : 1;
        if (take(game, c, slot, sku, qty)) {
          c.wants.splice(c.wants.indexOf(sku.productId), 1);
          const mi = c.missed.indexOf(sku.productId);
          if (mi >= 0) { c.missed.splice(mi, 1); c.mood += 8; } // found it after all
          c.mood += 7; bought = true;
        }
      } else if (ratio > 1.12) { c.mood -= 4; pricey = true; }
    } else if (slot.stock > 0 && sku.price <= c.budget * 0.7 && score > 0.85 && game.rand() < 0.06 * F.visibility * (c.helped ? 1.5 : 1)) {
      if (take(game, c, slot, sku, 1)) { c.mood += 4; bought = true; c.impulse = true; }
    }
  }
  if (pricey) thought(game, c, 'price');
  else if (bought && game.rand() < 0.35) thought(game, c, 'happy');
}

function joinQueue(game, c) {
  const st = game.state.store;
  if (st.queue.length >= QUEUE_CELLS.length) { c.mood -= 15; abandon(game, c, 'line'); return; }
  st.queue.push(c.id);
  c.wait = 0;
  setState(c, 'queue');
}

// Put a basket back. Items go back onto a display showing them if there is room, else to back stock.
function returnBasket(game, c) {
  const s = game.state;
  for (const l of c.basket) {
    let left = l.qty;
    for (const fu of s.store.furniture) for (const slot of fu.slots) {
      if (left <= 0 || slot.skuId !== l.skuId) continue;
      const room = FURNITURE[fu.type].slotCap - slot.stock;
      const n = Math.min(room, left);
      if (n > 0) { slot.stock += n; left -= n; }
    }
    if (left > 0) addGoods(s, l.skuId, left);
  }
  c.basket = [];
}

function abandon(game, c, reason) {
  returnBasket(game, c);
  thought(game, c, 'gaveup');
  startLeave(game, c, reason);
}

function startLeave(game, c, reason) {
  const st = game.state.store;
  const qi = st.queue.indexOf(c.id);
  if (qi >= 0) st.queue.splice(qi, 1);
  if (!c.paid && reason) c.reason = reason;
  c.leg = 0;
  setState(c, 'leave');
}

export function tillSpeed(state) {
  const st = state.store;
  if (!st.till) return 0;
  const rec = st.staff.find((x) => x.id === st.till);
  return rec ? rec.speed : 1;
}
function tillService(state) {
  const rec = state.store.staff.find((x) => x.id === state.store.till);
  return rec ? rec.service : 1;
}

function pay(game, c) {
  const s = game.state, st = s.store;
  const total = basketTotal(c);
  if (total > 0) transact(game, total, 'Store sales', c.name);
  let units = 0, q = 0;
  for (const l of c.basket) {
    const sku = getSku(s, l.skuId);
    units += l.qty;
    if (sku) { sku.sold += l.qty; sku.storeSold = (sku.storeSold || 0) + l.qty; sku.storeRevenue = r2((sku.storeRevenue || 0) + l.qty * l.price); q += skuQuality(sku) * l.qty; }
  }
  s.stats.unitsSold += units;
  st.stats.items += units; st.today.items += units;
  st.stats.buyers += 1; st.today.buyers += 1;
  st.stats.revenue = r2(st.stats.revenue + total); st.today.revenue = r2(st.today.revenue + total);
  q /= Math.max(1, units);
  if (c.wait > 18) c.mood -= Math.min(30, (c.wait - 18) * 0.6);
  c.mood += 3 + (tillService(s) - 1) * 20;
  s.soul = clamp(s.soul + ((q - 70) / 30) * 0.12 + 0.04, 0, 100);
  c.paid = true;
  c.sold = c.basket; // keep the receipt for the review
  c.basket = [];
  game.emit('storeSale', { id: c.id, name: c.name, total, units });
}

// A shopper's visit becomes a rating; some write a review.
function finish(game, c) {
  const s = game.state, st = s.store;
  st.clean = clamp(st.clean - STORE.wearPerVisit, 0, 100);
  const m = clamp(c.mood, 0, 100);
  const stars = m >= 82 ? 5 : m >= 66 ? 4 : m >= 50 ? 3 : m >= 34 ? 2 : 1;
  st.ratings.push(stars);
  if (st.ratings.length > 40) st.ratings.shift();
  st.reputation = r2((3.8 * 6 + st.ratings.reduce((a, b) => a + b, 0)) / (6 + st.ratings.length));
  if (!c.paid) {
    st.stats.walkouts += 1; st.today.walkouts += 1;
    const why = c.reason || 'nothing';
    st.today.reasons[why] = (st.today.reasons[why] || 0) + 1;
    if (why === 'stockout' || why === 'line') s.soul = clamp(s.soul - 0.1, 0, 100);
  }
  if (game.rand() < (stars === 5 || stars <= 2 ? 0.4 : 0.22)) {
    addReview(game, stars, { customer: c.name, lines: c.sold || [] }, STORE_REVIEW_TEXT, 'store');
  }
  game.emit('shopperLeft', { id: c.id, stars, paid: c.paid });
}

const LIMITS = { walk: 30, browse: 20, queue: 200, paying: 60, leave: 70, arrive: 45 };

function tickCustomer(game, c, dt) {
  const s = game.state, st = s.store;
  c.stateT += dt; c.life += dt;
  const speed = STORE.walkSpeed;
  // Recovery: nobody stays in one state (or in the shop) forever.
  if (c.state !== 'leave' && c.state !== 'paying' && (c.life > 480 || c.stateT > (LIMITS[c.state] || 60))) {
    if (c.state === 'walk') { if (c.target) c.visited.push(c.target.fid); setState(c, 'decide'); }
    else if (c.state === 'queue') { c.mood -= 10; abandon(game, c, 'line'); }
    else startLeave(game, c, c.basket.length ? 'line' : 'nothing');
    if (c.state === 'leave' && c.basket.length) returnBasket(game, c);
    return;
  }
  switch (c.state) {
    case 'arrive': {
      c.anim = 'walk';
      if (walkTo(st, c, STORE_POINTS.inside.x, STORE_POINTS.inside.z, dt, speed)) setState(c, 'decide');
      break;
    }
    case 'decide': c.anim = 'idle'; decide(game, c); break;
    case 'walk': {
      const fu = getFurniture(s, c.target && c.target.fid);
      if (!fu) { setState(c, 'decide'); break; } // the display was sold: re-plan
      if (c.target.ver !== st.layoutVer) {
        const pt = slotPoint(s, fu, c.target.slot, c.x, c.z);
        if (!pt) { c.visited.push(fu.id); setState(c, 'decide'); break; }
        Object.assign(c.target, pt, { ver: st.layoutVer });
      }
      c.anim = 'walk';
      if (walkTo(st, c, c.target.x, c.target.z, dt, speed)) { setState(c, 'browse'); c.face = c.target.face; c.timer = 2.4 + game.rand() * 2.2; }
      else if (c.blocked > 2) { c.visited.push(fu.id); setState(c, 'decide'); }
      break;
    }
    case 'browse': {
      if (!getFurniture(s, c.target.fid)) { setState(c, 'decide'); break; }
      c.anim = c.timer > 1.2 ? 'reach' : 'idle';
      c.face = c.target.face;
      c.timer -= dt * (c.helped ? 1.5 : 1);
      if (c.timer <= 0) { evaluate(game, c); setState(c, 'decide'); }
      break;
    }
    case 'toQueue': joinQueue(game, c); break;
    case 'queue': {
      const k = st.queue.indexOf(c.id);
      if (k < 0) { st.queue.push(c.id); break; }
      const cell = cellCenter(...QUEUE_CELLS[Math.min(k, QUEUE_CELLS.length - 1)]);
      const there = walkTo(st, c, cell.x, cell.z, dt, speed);
      c.anim = there ? 'idle' : 'walk';
      if (there) c.face = Math.PI; // face the till
      c.wait += dt;
      if (c.wait > c.patience) { c.mood -= 18; thought(game, c, 'gaveup'); abandon(game, c, 'line'); break; }
      if (c.wait > c.patience * 0.6 && !c.warned) { c.warned = true; thought(game, c, 'wait'); }
      if (k === 0 && there && st.till) { setState(c, 'paying'); c.timer = 2.4 + basketUnits(c) * 0.6; }
      break;
    }
    case 'paying': {
      c.anim = 'idle';
      const sp = tillSpeed(s);
      if (!sp) { setState(c, 'queue'); break; } // the cashier stepped away
      c.timer -= dt * sp;
      if (c.timer <= 0) { pay(game, c); startLeave(game, c, null); }
      break;
    }
    case 'leave': {
      c.anim = 'walk';
      const p = c.leg === 0 ? STORE_POINTS.outside : STORE_POINTS[c.exit];
      const arrived = walkTo(st, c, p.x, p.z, dt, speed);
      if (arrived) { if (c.leg === 0) c.leg = 1; else c.gone = true; }
      else if (c.blocked > 2 || c.stateT > LIMITS.leave) { c.x = STORE_POINTS.outside.x; c.z = STORE_POINTS.outside.z; c.path = null; c.leg = 1; c.stateT = 0; }
      break;
    }
    default: setState(c, 'decide');
  }
}

// ---- Master store tick ---------------------------------------------------------------------

export function tickStore(game, dt) {
  const s = game.state, st = s.store;
  if (s.era !== 'store' || !st) return;
  st.spawnTimer -= dt * trafficBreakdown(s).total;
  if (st.spawnTimer <= 0) {
    st.spawnTimer = STORE.spawnInterval * (0.6 + game.rand() * 0.8);
    if (s.time.t / DAY_LENGTH < STORE.openUntil) {
      if (st.customers.length >= STORE.maxCustomers) { st.stats.missed += 1; st.today.missed += 1; }
      else spawnCustomer(game);
    }
  }
  for (const c of st.customers) tickCustomer(game, c, dt);
  for (let i = st.customers.length - 1; i >= 0; i--) {
    const c = st.customers[i];
    if (!c.gone) continue;
    finish(game, c);
    st.customers.splice(i, 1);
  }
  st.queue = st.queue.filter((id) => st.customers.some((c) => c.id === id && (c.state === 'queue' || c.state === 'paying')));
}

export function closeStoreDay(state) {
  const st = state.store;
  if (!st) return null;
  const t = st.today;
  const clean = cleanliness(state);
  const summary = { day: state.time.day, visitors: t.visitors, buyers: t.buyers, walkouts: t.walkouts, items: t.items, revenue: t.revenue, stockouts: t.stockouts, missed: t.missed, rating: st.reputation, clean, design: designScore(state).total, reasons: { ...t.reasons } };
  // A grubby shop wears at the brand; closing-time tidy-up is quicker with a team.
  if (clean < 50) state.soul = clamp(state.soul - 1.5, 0, 100);
  st.clean = clamp(st.clean + (st.staff.length ? 30 : 15), 0, 100);
  st.days.push(summary);
  if (st.days.length > 30) st.days.shift();
  st.today = { visitors: 0, buyers: 0, walkouts: 0, stockouts: 0, items: 0, revenue: 0, missed: 0, reasons: {} };
  return summary;
}

export { cellOf };

// ---- Store profitability report (brief: "store profit reports reconcile with the ledger") ----
// Built only from the ledger's closed-day category totals, so every number traces back to a
// recorded transaction. Cost groups always add up to the day's expenses.
export const COST_GROUPS = [
  { id: 'stock', label: 'Ingredients & packaging', cats: ['Ingredients', 'Packaging'] },
  { id: 'staff', label: 'Staff', cats: ['Staff wages', 'Staff training'] },
  { id: 'premises', label: 'Rent & utilities', cats: ['Rent / lease', 'Utilities'] },
  { id: 'marketing', label: 'Marketing', cats: ['Marketing'] },
  { id: 'fixtures', label: 'Fixtures & equipment', cats: ['Store fixtures', 'Equipment'] },
  { id: 'rnd', label: 'Research & development', cats: ['Research & development'] },
];
export function profitReport(state, n = 7) {
  const storeDays = state.store ? state.store.days : [];
  return state.ledger.days.slice(-n).map((d) => {
    const cats = d.cats || {};
    const cost = (names) => r2(-names.reduce((a, c) => a + Math.min(0, cats[c] || 0), 0));
    const groups = COST_GROUPS.map((g) => ({ ...g, value: cost(g.cats) }));
    const known = new Set(COST_GROUPS.flatMap((g) => g.cats));
    const other = r2(-Object.entries(cats).reduce((a, [c, v]) => a + (known.has(c) || v >= 0 ? 0 : v), 0));
    groups.push({ id: 'other', label: 'Other', cats: [], value: other });
    // money back from selling fixtures is income, not a negative cost
    const store = r2(cats['Store sales'] || 0);
    const online = r2((cats['Online orders'] || 0) + (cats['Local orders'] || 0) + (cats['Big orders'] || 0));
    const sd = storeDays.find((x) => x.day === d.day);
    return { day: d.day, revenue: d.revenue, expenses: d.expenses, profit: d.profit, store, online, otherIncome: r2(d.revenue - store - online), groups, visitors: sd ? sd.visitors : 0, buyers: sd ? sd.buyers : 0, rating: sd ? sd.rating : null, clean: sd ? sd.clean : null, design: sd ? sd.design : null };
  });
}

// ---- Restock controls (Milestone 4) ---------------------------------------------------------
export function setRefill(game, fid, k, level) {
  const fu = getFurniture(game.state, fid);
  if (!fu || !fu.slots[k] || !STORE.refillLevels.includes(level)) return { ok: false, reason: 'No such display.' };
  fu.slots[k].refill = level;
  return { ok: true };
}
export function rushSlot(game, fid, k) {
  const s = game.state, fu = getFurniture(s, fid);
  if (!fu || !fu.slots[k]) return { ok: false, reason: 'No such display.' };
  const slot = fu.slots[k];
  if (!slot.skuId) return { ok: false, reason: 'Choose a product for it first.' };
  if (slot.stock >= FURNITURE[fu.type].slotCap) return { ok: false, reason: 'It is already full.' };
  if (!(s.goods[slot.skuId] > 0)) return { ok: false, reason: 'None in back stock. Make a batch first.' };
  slot.rush = true;
  return { ok: true };
}
