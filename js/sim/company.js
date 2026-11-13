// CompanyService (brief §6, Milestone 6): the brand-level systems of a retail chain.
//
//  * Central kitchen: an off-site production facility with automated lines. Lines pick the recipe
//    the warehouse is shortest of, buy ingredients in bulk, and make double batches.
//  * Distribution: delivery trucks leave the warehouse each morning (and optionally at midday),
//    topping every shop's back stock up to a par level, or to a forecast from yesterday's sales.
//  * Wholesale contracts: salons, spas and hotels order a fixed amount every morning for a few
//    days. Miss a delivery and you pay a penalty; miss three and the contract is cancelled.
//  * Regional manager: keeps stock balanced between shops, keeps the free window display running,
//    and lifts every shop a little.
//  * Brand-wide reports and the chain's final goals (the ending).

import { KITCHEN, REGIONAL, WHOLESALE, WHOLESALE_CLIENTS, CHAIN_GOALS, INGREDIENTS, PRODUCTS, DAY_LENGTH, CHAIN, TIERS } from '../data.js';
import { transact, forceExpense } from './economy.js';
import { batchNeeds, getSku, productUnlocked, skuQuality } from './inventory.js';
import { storeIds, withStore, goodsOf, inTransit, storeData, currentId, branchCount, storeKpis } from './chain.js';
import { startCampaign } from './business.js';

const r2 = (v) => Math.round(v * 100) / 100;
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// ---- Central kitchen -------------------------------------------------------------------------------

export function newKitchen() {
  return {
    lines: Array.from({ length: KITCHEN.startLines }, (_, i) => ({ id: i, job: null })),
    warehouse: {},
    ingredients: {},
    deliveries: [],
    target: KITCHEN.target,
    par: KITCHEN.par,
    forecast: true,
    midday: false,
    made: 0,
    lastMorning: 0, lastMidday: 0,
  };
}

export function canBuildKitchen(state) {
  if (state.kitchen) return { ok: false, reason: 'You already have a central kitchen.' };
  if (branchCount(state) < 1) return { ok: false, reason: 'A central kitchen makes sense once you have two shops.' };
  if (state.cash < KITCHEN.cost) return { ok: false, reason: 'Not enough cash.' };
  return { ok: true };
}
export function buildKitchen(game) {
  const s = game.state, chk = canBuildKitchen(s);
  if (!chk.ok) return chk;
  if (!transact(game, -KITCHEN.cost, 'Central kitchen', 'Central kitchen and warehouse')) return { ok: false, reason: 'Not enough cash.' };
  s.kitchen = newKitchen();
  for (const k of s.skus) s.kitchen.warehouse[k.id] = 0;
  game.emit('kitchenBuilt', {});
  return { ok: true };
}
export function addLine(game) {
  const s = game.state, K = s.kitchen;
  if (!K) return { ok: false, reason: 'Build the kitchen first.' };
  if (K.lines.length >= KITCHEN.maxLines) return { ok: false, reason: 'The kitchen is full.' };
  if (!transact(game, -KITCHEN.lineCost, 'Central kitchen', 'New production line')) return { ok: false, reason: 'Not enough cash.' };
  K.lines.push({ id: K.lines.length, job: null });
  return { ok: true };
}
export function setKitchen(game, key, value) {
  const K = game.state.kitchen;
  if (!K) return { ok: false, reason: 'No kitchen.' };
  if (key === 'target' && [15, 30, 50].includes(value)) K.target = value;
  else if (key === 'par' && [8, 14, 22].includes(value)) K.par = value;
  else if (key === 'forecast' || key === 'midday') K[key] = !!value;
  else return { ok: false, reason: 'Unknown setting.' };
  return { ok: true };
}

export const kitchenBatch = (state, sku) => Math.round(PRODUCTS[sku.productId].batch * KITCHEN.batchMult * (state.upgrades.bigpot ? 1.25 : 1));
export const kitchenTime = (sku) => Math.round(PRODUCTS[sku.productId].time * KITCHEN.timeMult);
function kitchenNeeds(state, sku) {
  const base = batchNeeds({ upgrades: {} }, sku), m = kitchenBatch(state, sku) / PRODUCTS[sku.productId].batch, out = {};
  for (const [id, q] of Object.entries(base)) out[id] = Math.ceil(q * m);
  return out;
}
const pendingIng = (K, id) => K.deliveries.reduce((a, d) => a + (d.items[id] || 0), 0);

function tickKitchen(game, dt) {
  const s = game.state, K = s.kitchen;
  for (let i = K.deliveries.length - 1; i >= 0; i--) {
    const d = K.deliveries[i];
    d.eta -= dt;
    if (d.eta > 0) continue;
    K.deliveries.splice(i, 1);
    for (const [id, q] of Object.entries(d.items)) K.ingredients[id] = (K.ingredients[id] || 0) + q;
  }
  for (const line of K.lines) {
    if (line.job) {
      line.job.remaining -= dt;
      if (line.job.remaining > 0) continue;
      const { skuId, units } = line.job;
      K.warehouse[skuId] = (K.warehouse[skuId] || 0) + units;
      s.stats.unitsMade += units; s.stats.batches += 1; K.made += units;
      const sku = getSku(s, skuId); if (sku) sku.made += units;
      line.job = null;
      game.emit('kitchenBatch', { skuId, units });
    }
    // what is the warehouse shortest of (not already cooking)?
    const cooking = new Set(K.lines.filter((l) => l.job).map((l) => l.job.skuId));
    const want = s.skus.filter((k) => !k.paused && productUnlocked(s, k.productId) && !cooking.has(k.id))
      .map((k) => ({ k, gap: K.target - (K.warehouse[k.id] || 0) })).filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap);
    for (const { k } of want) {
      const needs = kitchenNeeds(s, k);
      const short = Object.entries(needs).filter(([id, q]) => (K.ingredients[id] || 0) < q);
      if (!short.length) {
        for (const [id, q] of Object.entries(needs)) K.ingredients[id] -= q;
        line.job = { skuId: k.id, units: kitchenBatch(s, k), remaining: kitchenTime(k), time: kitchenTime(k) };
        break;
      }
      // bulk-buy what is missing (two batches' worth), unless it is already on its way
      const buy = {};
      for (const [id, q] of short) if ((K.ingredients[id] || 0) + pendingIng(K, id) < q) buy[id] = q * 2;
      if (Object.keys(buy).length) {
        const cost = r2(Object.entries(buy).reduce((a, [id, q]) => a + INGREDIENTS[id].cost * q, 0) * KITCHEN.bulkDiscount);
        if (transact(game, -cost, 'Ingredients', 'Central kitchen bulk order')) {
          K.deliveries.push({ items: buy, eta: Math.max(...Object.keys(buy).map((id) => INGREDIENTS[id].lead)) });
        }
      }
      break; // one recipe at a time per line
    }
  }
}

// ---- Distribution --------------------------------------------------------------------------------

// How much of each displayed recipe a shop should hold in back stock.
export function parFor(state, storeId, skuId) {
  const K = state.kitchen;
  if (!K) return 0;
  if (!K.forecast) return K.par;
  const d = storeData(state, storeId).store.days;
  const last = d[d.length - 1];
  const sold = last && last.skuSold ? last.skuSold[skuId] || 0 : 0;
  return Math.max(Math.round(K.par * 0.6), Math.ceil(sold * KITCHEN.forecastFactor));
}

export function truckRun(game, label = 'Morning delivery') {
  const s = game.state, K = s.kitchen;
  if (!K) return 0;
  let shipped = 0;
  for (const id of storeIds(s)) {
    const d = storeData(s, id);
    const shown = new Set();
    for (const fu of d.store.furniture) for (const sl of fu.slots) if (sl.skuId) shown.add(sl.skuId);
    const items = {};
    for (const sku of shown) {
      const have = (d.goods[sku] || 0) + inTransit(s, id, sku);
      const n = Math.min(K.warehouse[sku] || 0, parFor(s, id, sku) - have);
      if (n > 0) items[sku] = n;
    }
    if (!Object.keys(items).length) continue;
    withStore(s, id, () => forceExpense(game, KITCHEN.truckFee, 'Distribution', `${label}: ${d.store.name}`));
    for (const [sku, q] of Object.entries(items)) K.warehouse[sku] -= q;
    s.transfers.push({ id: game.nextId('t'), from: 'kitchen', to: id, items, eta: CHAIN.transferTime, lead: CHAIN.transferTime, auto: true, truck: true });
    shipped += sum(items);
  }
  if (shipped) game.emit('trucksOut', { units: shipped, label });
  return shipped;
}

// ---- Wholesale -------------------------------------------------------------------------------------

export function makeOffer(game) {
  const s = game.state;
  // Clients only ask for things you actually make, at a quality you actually make.
  const made = (p) => s.skus.some((k) => k.productId === p && !k.paused);
  const clients = WHOLESALE_CLIENTS.filter((c) => c.products.some(made) && !(s.contracts || []).some((x) => x.client === c.name));
  if (!clients.length) return null;
  const c = game.pick(clients);
  const productId = game.pick(c.products.filter(made));
  const best = Math.max(...s.skus.filter((k) => k.productId === productId).map((k) => k.tier));
  const minTier = best >= 1 && game.rand() < 0.4 ? 1 : 0;
  const ref = PRODUCTS[productId].basePrice * TIERS[minTier].priceMult;
  const offer = {
    id: game.nextId('w'), client: c.name, kind: c.kind, productId, minTier,
    qty: game.randInt(6, 14), days: game.randInt(3, 6),
    price: r2(ref * WHOLESALE.priceFactor), status: 'offer', delivered: 0, misses: 0, expires: s.time.day + 2,
  };
  s.contracts = s.contracts || [];
  s.contracts.push(offer);
  game.emit('wholesaleOffer', offer);
  return offer;
}
export function acceptContract(game, id) {
  const s = game.state, c = (s.contracts || []).find((x) => x.id === id);
  if (!c || c.status !== 'offer') return { ok: false, reason: 'That offer is gone.' };
  if (s.contracts.filter((x) => x.status === 'active').length >= WHOLESALE.maxActive) return { ok: false, reason: 'You already have as many contracts as you can handle.' };
  c.status = 'active'; c.daysLeft = c.days;
  return { ok: true };
}
export function declineContract(game, id) {
  const s = game.state, i = (s.contracts || []).findIndex((x) => x.id === id && x.status === 'offer');
  if (i < 0) return { ok: false, reason: 'That offer is gone.' };
  s.contracts.splice(i, 1);
  return { ok: true };
}

// Units for a contract come from the warehouse first, then Main Street's back stock.
function takeFor(state, c, qty) {
  const pools = [];
  if (state.kitchen) pools.push(state.kitchen.warehouse);
  pools.push(goodsOf(state, 'main'));
  const skus = state.skus.filter((k) => k.productId === c.productId && k.tier >= c.minTier);
  const avail = skus.reduce((a, k) => a + pools.reduce((b, p) => b + (p[k.id] || 0), 0), 0);
  if (avail < qty) return null;
  let left = qty;
  const used = [];
  for (const p of pools) for (const k of skus) {
    const n = Math.min(left, p[k.id] || 0);
    if (n > 0) { p[k.id] -= n; left -= n; used.push({ sku: k, n }); }
  }
  return used;
}

function deliverContracts(game) {
  const s = game.state;
  for (const c of [...(s.contracts || [])]) {
    if (c.status === 'offer' && s.time.day > c.expires) { s.contracts.splice(s.contracts.indexOf(c), 1); continue; }
    if (c.status !== 'active') continue;
    const used = takeFor(s, c, c.qty);
    if (used) {
      transact(game, c.qty * c.price, 'Wholesale', c.client);
      for (const { sku, n } of used) { sku.sold += n; s.stats.unitsSold += n; }
      c.delivered += c.qty;
      game.emit('wholesaleDelivered', c);
    } else {
      c.misses += 1;
      forceExpense(game, WHOLESALE.missPenalty, 'Wholesale', `Missed delivery: ${c.client}`);
      s.soul = Math.max(0, s.soul - 1);
      game.emit('wholesaleMissed', c);
      if (c.misses >= WHOLESALE.maxMisses) { c.status = 'cancelled'; s.soul = Math.max(0, s.soul - 3); game.emit('wholesaleCancelled', c); continue; }
    }
    c.daysLeft -= 1;
    if (c.daysLeft <= 0) {
      c.status = 'done';
      s.stats.contractsDone = (s.stats.contractsDone || 0) + 1;
      s.soul = Math.min(100, s.soul + 2);
      game.emit('wholesaleDone', c);
    }
  }
  // finished contracts are kept briefly for the record
  s.contracts = (s.contracts || []).filter((c) => c.status === 'offer' || c.status === 'active' || s.time.day - (c.endDay || (c.endDay = s.time.day)) < 3);
}

// ---- Regional manager -------------------------------------------------------------------------------

export function hireRegional(game) {
  const s = game.state;
  if (s.regional) return { ok: false, reason: 'You already have a regional manager.' };
  if (branchCount(s) < 1) return { ok: false, reason: 'Regional managers look after several shops.' };
  if (!transact(game, -REGIONAL.wage, 'Regional management', 'First day')) return { ok: false, reason: 'Not enough cash.' };
  s.regional = { name: game.pick(['Ruth', 'Desmond', 'Ama', 'Lorenzo', 'Mireille', 'Kofi']), since: s.time.day };
  game.emit('regionalHired', s.regional);
  return { ok: true };
}
export function dismissRegional(game) {
  if (!game.state.regional) return { ok: false, reason: 'No regional manager.' };
  game.state.regional = null;
  return { ok: true };
}

// Move surplus back stock from the fullest shop to whichever shop is shortest of it.
export function balanceStores(game) {
  const s = game.state, ids = storeIds(s);
  if (ids.length < 2) return 0;
  let moved = 0;
  for (const k of s.skus) {
    const levels = ids.map((id) => ({ id, n: (goodsOf(s, id)[k.id] || 0) + inTransit(s, id, k.id) })).sort((a, b) => b.n - a.n);
    const hi = levels[0], lo = levels[levels.length - 1];
    const n = Math.floor((hi.n - lo.n) / 2);
    if (n >= 6 && (goodsOf(s, hi.id)[k.id] || 0) >= n) {
      goodsOf(s, hi.id)[k.id] -= n;
      s.transfers.push({ id: game.nextId('t'), from: hi.id, to: lo.id, items: { [k.id]: n }, eta: CHAIN.transferTime, lead: CHAIN.transferTime, auto: true });
      moved += n;
    }
  }
  return moved;
}

// ---- The company clock --------------------------------------------------------------------------------

export function tickCompany(game, dt) {
  const s = game.state;
  if (s.kitchen) tickKitchen(game, dt);
  const d = s.time.t / DAY_LENGTH;
  s.company = s.company || { lastMorning: 0, lastMidday: 0, lastOffer: 0 };
  const C = s.company;
  if (d >= (s.kitchen ? KITCHEN.morning : 0.03) && C.lastMorning !== s.time.day) {
    C.lastMorning = s.time.day;
    deliverContracts(game); // promises to clients come first, then the shops' trucks
    if (s.kitchen) truckRun(game, 'Morning delivery');
    if (s.regional) {
      balanceStores(game);
      if (!(s.marketing.cooldowns.window > 0)) startCampaign(game, 'window');
    }
    if (branchCount(s) >= 1 && s.time.day - (C.lastOffer || 0) >= WHOLESALE.offerEvery) { C.lastOffer = s.time.day; makeOffer(game); }
  }
  if (s.kitchen && s.kitchen.midday && d >= KITCHEN.midday && C.lastMidday !== s.time.day) {
    C.lastMidday = s.time.day;
    truckRun(game, 'Midday delivery');
  }
}

export function payCompany(game) {
  const s = game.state;
  if (s.kitchen) forceExpense(game, s.kitchen.lines.length * KITCHEN.crewWage, 'Central kitchen', 'Kitchen crew');
  if (s.regional) forceExpense(game, REGIONAL.wage, 'Regional management', s.regional.name);
}

// ---- Brand-wide numbers ----------------------------------------------------------------------------------

// Average formula quality of everything the brand has sold (the company's identity metric,
// alongside Brand Soul).
export function qualityIndex(state) {
  let u = 0, q = 0;
  for (const k of state.skus) { u += k.sold; q += k.sold * skuQuality(k); }
  return u ? Math.round(q / u) : 0;
}

export function brandReport(state, n = 7) {
  const days = state.ledger.days.slice(-n);
  const by = (cats, names) => names.reduce((a, c) => a + Math.max(0, cats[c] || 0), 0);
  const channels = days.map((d) => ({
    day: d.day,
    retail: r2(by(d.cats, ['Store sales'])),
    online: r2(by(d.cats, ['Online orders', 'Local orders', 'Big orders'])),
    wholesale: r2(by(d.cats, ['Wholesale'])),
    profit: d.profit,
    soul: d.soul,
  }));
  const units = storeIds(state).reduce((a, id) => a + sum(storeData(state, id).goods), 0) + (state.kitchen ? sum(state.kitchen.warehouse) : 0);
  const soldPerDay = days.length ? days.reduce((a, d) => a + (d.unitsSold || 0), 0) / days.length : 0;
  return {
    channels,
    shops: storeIds(state).length,
    staff: storeIds(state).reduce((a, id) => a + storeData(state, id).store.staff.length, 0) + (state.regional ? 1 : 0),
    quality: qualityIndex(state),
    soul: Math.round(state.soul),
    stockUnits: units,
    coverDays: soldPerDay ? r2(units / soldPerDay) : null,
  };
}

// ---- The chain's final goals (the ending) -----------------------------------------------------------------

export function chainGoals(state) {
  const g = CHAIN_GOALS;
  const ratings = storeIds(state).map((id) => storeData(state, id).store.reputation);
  const minRating = ratings.length ? Math.min(...ratings) : 0;
  return [
    { id: 'shops', label: 'Run a chain of shops', value: storeIds(state).length, target: g.shops },
    { id: 'kitchen', label: 'Open a central kitchen', value: state.kitchen ? 1 : 0, target: 1 },
    { id: 'revenue', label: 'Earn lifetime revenue', value: state.stats.revenue, target: g.revenue, money: true },
    { id: 'rating', label: 'Every shop rated', value: minRating, target: g.rating, from: 3, decimals: 1, hint: 'Your lowest-rated shop counts.' },
    { id: 'soul', label: 'Keep the Brand Soul', value: Math.round(state.soul), target: g.soul, from: 40, hint: 'Quality formulas, clean shops, no missed promises.' },
    { id: 'contracts', label: 'Complete a wholesale contract', value: state.stats.contractsDone || 0, target: g.contracts },
  ].map((x) => ({ ...x, done: x.value >= x.target, pct: Math.max(0, Math.min(1, (x.value - (x.from || 0)) / (x.target - (x.from || 0)))) }));
}
export function tickFinale(game) {
  const s = game.state;
  if (s.milestone.chainReady && !s.milestone.finale && storeIds(s).length >= CHAIN_GOALS.shops && chainGoals(s).every((x) => x.done)) {
    s.milestone.finale = true;
    s.milestone.finaleDay = s.time.day;
    game.emit('finale', {});
  }
}

export { currentId, storeKpis };
