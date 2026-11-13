// OrderService (home-era customer orders) + ReputationService (reviews, reputation, Brand Soul).

import { CUSTOMER_NAMES, BIG_ORDER_NAMES, REVIEW_TEXT, CAMPAIGNS, STORE } from '../data.js';
import { transact } from './economy.js';
import { getSku, removeGoods, priceAppeal, refPrice, skuQuality } from './inventory.js';

const BASE_INTERVAL = 29;
export const MAX_OPEN_ORDERS = 7;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Demand ---------------------------------------------------------------

export function marketingBoost(state) {
  return state.marketing.active.reduce((a, c) => a + CAMPAIGNS[c.id].boost, 0);
}

export function demandBreakdown(state) {
  const rep = 0.55 + (state.reputation / 5) * 0.75;
  const soul = 0.85 + (state.soul / 100) * 0.3;
  const growth = 1 + Math.min(0.9, (state.time.day - 1) * 0.06 + state.stats.ordersFulfilled * 0.006);
  const marketing = 1 + marketingBoost(state);
  const listed = state.skus.filter((k) => !k.paused);
  const appeals = listed.map(priceAppeal);
  const price = appeals.length ? appeals.reduce((a, b) => a + b, 0) / appeals.length : 1;
  const range = 1 + Math.min(0.3, (listed.length - 3) * 0.05);
  // Once the store is open most local customers walk in instead; online orders keep coming.
  const channel = state.era === 'store' ? STORE.onlineShare : 1;
  return { rep, soul, growth, marketing, price, range, channel, total: rep * soul * growth * marketing * price * range * channel };
}

// ---- Orders ---------------------------------------------------------------

function pickSku(game, exclude) {
  const s = game.state;
  const pool = s.skus.filter((k) => !k.paused && !exclude.includes(k.id));
  if (!pool.length) return null;
  const weights = pool.map((k) => priceAppeal(k) * (1 + Math.min(1, k.sold * 0.01)) * (1 + k.tier * 0.15));
  let r = game.rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

export function orderTotal(state, order) {
  return order.lines.reduce((a, l) => a + l.qty * l.price, 0);
}

export function spawnOrder(game) {
  const s = game.state;
  const big = s.reputation >= 4.0 && s.time.day >= 3 && game.rand() < 0.1;
  const lines = [];
  const used = [];
  const firstOrders = s.stats.ordersFulfilled < 4; // keep the opening orders simple
  const nLines = big ? game.randInt(1, 2) : firstOrders ? 1 : (() => { const r = game.rand(); return r < 0.55 ? 1 : r < 0.9 ? 2 : 3; })();
  const maxQty = s.stats.ordersFulfilled > 25 ? 3 : 2;
  for (let i = 0; i < Math.min(nLines, s.skus.length); i++) {
    const sku = pickSku(game, used);
    if (!sku) break;
    used.push(sku.id);
    // Prices are locked in when the order is placed.
    lines.push({ skuId: sku.id, qty: big ? game.randInt(4, 7) : game.randInt(1, maxQty), price: sku.price });
  }
  const local = !big && game.rand() < 0.3;
  let window = big ? game.randInt(210, 270) : local ? game.randInt(85, 120) : game.randInt(110, 165);
  if (s.time.day === 1) window = Math.round(window * 1.6); // first-day customers are patient
  const order = {
    id: game.nextId('o'),
    customer: big ? game.pick(BIG_ORDER_NAMES) : game.pick(CUSTOMER_NAMES),
    channel: big ? 'Big orders' : local ? 'Local orders' : 'Online orders',
    lines,
    created: s.time.total,
    deadline: s.time.total + window,
    window,
    status: 'open',
    claimedBy: null,
  };
  if (!lines.length) return null;
  order.total = orderTotal(s, order);
  s.orders.push(order);
  game.emit('orderNew', order);
  return order;
}

export function canFulfill(state, order) {
  return order.status === 'open' && order.lines.every((l) => (state.goods[l.skuId] || 0) >= l.qty);
}

// Player (or the helper's auto-fulfill) commits stock to an order; it then waits to be packed.
export function fulfillOrder(game, orderId) {
  const s = game.state;
  const order = s.orders.find((o) => o.id === orderId);
  if (!order || order.status !== 'open') return { ok: false, reason: 'Order is not open.' };
  if (!canFulfill(s, order)) return { ok: false, reason: 'Not enough finished stock for this order.' };
  for (const l of order.lines) removeGoods(s, l.skuId, l.qty);
  order.status = 'queued';
  game.emit('orderQueued', order);
  return { ok: true };
}

export function shipOrder(game, order) {
  const s = game.state;
  const idx = s.orders.indexOf(order);
  if (idx < 0) return;
  s.orders.splice(idx, 1);
  const late = s.time.total > order.deadline;
  transact(game, order.total, order.channel, `${order.customer}`);
  s.stats.ordersFulfilled += 1;
  if (!late) s.stats.onTime += 1;
  let units = 0, q = 0, pr = 0;
  for (const l of order.lines) {
    const sku = getSku(s, l.skuId);
    units += l.qty;
    if (sku) {
      sku.sold += l.qty;
      q += skuQuality(sku) * l.qty;
      pr += (l.price / refPrice(sku)) * l.qty;
    }
  }
  s.stats.unitsSold += units;
  q /= units; pr /= units;
  // Brand Soul: quality formulas and reliable service build it; lateness and gouging erode it.
  let soulDelta = ((q - 70) / 30) * 0.5 + (late ? -0.8 : 0.25);
  if (pr > 1.3) soulDelta -= 0.3;
  s.soul = clamp(s.soul + soulDelta, 0, 100);
  if (game.rand() < 0.75) {
    const raw = 3.3 + ((q - 60) / 32) * 1.3 + (late ? -1.4 : 0.55) - Math.max(0, pr - 1) * 2.2 + Math.max(0, 1 - pr) * 0.5 + (game.rand() - 0.5) * 0.9;
    addReview(game, clamp(Math.round(raw), 1, 5), order);
  }
  game.emit('orderShipped', { order, late });
}

function expireOrders(game) {
  const s = game.state;
  for (let i = s.orders.length - 1; i >= 0; i--) {
    const o = s.orders[i];
    if (o.status === 'open' && s.time.total > o.deadline) {
      s.orders.splice(i, 1);
      s.stats.ordersExpired += 1;
      s.soul = clamp(s.soul - 1, 0, 100);
      if (game.rand() < 0.6) addReview(game, game.rand() < 0.4 ? 1 : 2, o);
      game.emit('orderExpired', o);
    }
  }
}

export function tickOrders(game, dt) {
  const s = game.state;
  s.orderTimer -= dt * demandBreakdown(s).total;
  if (s.orderTimer <= 0) {
    s.orderTimer = BASE_INTERVAL * (0.65 + game.rand() * 0.7);
    if (s.orders.filter((o) => o.status === 'open').length >= MAX_OPEN_ORDERS) s.missedDemand += 1;
    else spawnOrder(game);
  }
  expireOrders(game);
  if (s.settings.autoFulfill && (s.upgrades.helper || s.era === 'store')) {
    const open = s.orders.filter((o) => o.status === 'open').sort((a, b) => a.deadline - b.deadline);
    for (const o of open) if (canFulfill(s, o)) fulfillOrder(game, o.id);
  }
}

// ---- Reputation -----------------------------------------------------------

export function addReview(game, stars, order, texts = REVIEW_TEXT, source = 'online') {
  const s = game.state;
  const sku = order && order.lines[0] ? getSku(s, order.lines[0].skuId) : null;
  const review = {
    stars,
    customer: order ? order.customer : 'A customer',
    product: sku ? sku.name : '',
    text: game.pick(texts[stars]),
    day: s.time.day,
    source,
  };
  if (order && stars >= 3) {
    for (const l of order.lines) {
      const k = getSku(s, l.skuId);
      if (k) { k.ratingSum += stars; k.ratingCount += 1; }
    }
  }
  s.reviews.push(review);
  if (s.reviews.length > 30) s.reviews.shift();
  // Rolling average with a small prior so the first few reviews do not swing wildly.
  const sum = s.reviews.reduce((a, r) => a + r.stars, 0);
  s.reputation = Math.round(((3.6 * 8 + sum) / (8 + s.reviews.length)) * 100) / 100;
  game.emit('review', review);
  return review;
}
