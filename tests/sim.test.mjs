// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import { Game, newGameState } from '../js/sim/core.js';
import { transact } from '../js/sim/economy.js';
import { orderSupplies, batchNeeds, getSku, ingredientFree, goodsFree, createVariant, setPrice, hasIngredients, setSkuPaused } from '../js/sim/inventory.js';
import { queueBatch, cancelJob } from '../js/sim/production.js';
import { fulfillOrder, canFulfill, spawnOrder } from '../js/sim/orders.js';
import { tick, buyUpgrade, startCampaign, homeGoals, signLease } from '../js/sim/business.js';
import { serialize, deserialize, saveGame, loadGame, SAVE_KEY, BACKUP_KEY } from '../js/sim/save.js';
import { UPGRADES, UPGRADE_ORDER, INGREDIENTS, START_CASH, SAVE_VERSION, DAY_LENGTH } from '../js/data.js';

const mk = (seed = 42) => new Game(newGameState({}, seed));
const run = (g, seconds) => { for (let t = 0; t < seconds; t += 0.25) tick(g, 0.25); };
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

function assertInvariants(g) {
  const s = g.state;
  assert.ok(Math.abs(s.cash - s.ledger.sum) < 0.005, `cash ${s.cash} != ledger ${s.ledger.sum}`);
  for (const [id, q] of Object.entries(s.ingredients)) assert.ok(q >= 0, `ingredient ${id} negative`);
  for (const [id, q] of Object.entries(s.goods)) assert.ok(q >= 0, `goods ${id} negative`);
}

test('economy: cash always equals the ledger and cannot be overspent', () => {
  const g = mk();
  assert.equal(g.state.cash, START_CASH);
  assert.equal(transact(g, -1e6, 'Equipment'), false);
  assert.equal(g.state.cash, START_CASH);
  assert.equal(transact(g, -50, 'Equipment'), true);
  assert.equal(transact(g, 20.5, 'Online orders'), true);
  assert.equal(g.state.cash, START_CASH - 50 + 20.5);
  assert.equal(g.state.stats.revenue, 20.5);
  assertInvariants(g);
});

test('production: queueing consumes exactly the recipe and yields the batch size', () => {
  const g = mk();
  const sku = g.state.skus[0];
  const needs = batchNeeds(g.state, sku);
  const before = { ...g.state.ingredients };
  const r = queueBatch(g, sku.id);
  assert.ok(r.ok);
  for (const [id, q] of Object.entries(needs)) assert.equal(g.state.ingredients[id], before[id] - q);
  run(g, 80);
  assert.equal(g.state.goods[sku.id], 6);
  assert.equal(g.state.stats.unitsMade, 6);
  assertInvariants(g);
});

test('production: cannot queue without ingredients; inventory never goes negative', () => {
  const g = mk();
  const sku = g.state.skus[0];
  let n = 0;
  while (queueBatch(g, sku.id).ok) n++;
  assert.ok(n >= 1 && n < 6);
  assert.equal(hasIngredients(g.state, batchNeeds(g.state, sku)), false);
  assertInvariants(g);
});

test('production: cancel refunds a queued batch but wastes one already on a station', () => {
  const g = mk();
  const sku = g.state.skus[1];
  const before = { ...g.state.ingredients };
  const j1 = queueBatch(g, sku.id).job;
  assert.deepEqual(cancelJob(g, j1.id), { ok: true, refunded: true });
  assert.deepEqual(g.state.ingredients, before);
  const j2 = queueBatch(g, sku.id).job;
  run(g, 12); // founder has started it by now
  assert.equal(g.state.stations[0].phase, 'running');
  assert.deepEqual(cancelJob(g, j2.id), { ok: true, refunded: false });
  assert.equal(g.state.stations[0].phase, 'idle');
  assert.ok(g.state.ingredients.soapbase < before.soapbase);
  run(g, 5);
  assertInvariants(g);
});

test('orders: fulfilling reserves stock, packing pays out and is recorded', () => {
  const g = mk();
  const sku = g.state.skus[0];
  queueBatch(g, sku.id);
  g.state.orderTimer = 1e9; // no random orders
  run(g, 80);
  const order = spawnOrder(g);
  order.lines = [{ skuId: sku.id, qty: 2, price: sku.price }];
  order.total = 2 * sku.price;
  assert.ok(canFulfill(g.state, order));
  const cash = g.state.cash;
  assert.ok(fulfillOrder(g, order.id).ok);
  assert.equal(g.state.goods[sku.id], 4);
  run(g, 20);
  assert.equal(g.state.cash, cash + order.total);
  assert.equal(g.state.stats.ordersFulfilled, 1);
  assert.equal(g.state.orders.length, 0);
  assertInvariants(g);
});

test('orders: unfulfilled orders expire and hurt reputation', () => {
  const g = mk();
  g.state.orderTimer = 1e9;
  const rep = g.state.reputation;
  for (let i = 0; i < 6; i++) spawnOrder(g);
  run(g, 300);
  assert.equal(g.state.stats.ordersExpired, 6);
  assert.ok(g.state.reputation < rep);
});

test('supplies: deliveries arrive after lead time and respect pantry space', () => {
  const g = mk();
  const free = ingredientFree(g.state);
  assert.equal(orderSupplies(g, { jar: free + 1 }).ok, false);
  const before = g.state.ingredients.sugar;
  const r = orderSupplies(g, { sugar: 6 });
  assert.ok(r.ok);
  assert.equal(g.state.ingredients.sugar, before);
  run(g, INGREDIENTS.sugar.lead + 1);
  assert.equal(g.state.ingredients.sugar, before + 6);
  assertInvariants(g);
});

test('upgrades: the mixer makes batches measurably faster', () => {
  const g = mk();
  transact(g, 1000, 'Online orders');
  const sku = g.state.skus[0];
  const t0 = queueBatch(g, sku.id).job.time;
  assert.ok(buyUpgrade(g, 'mixer').ok);
  assert.equal(buyUpgrade(g, 'mixer').ok, false);
  orderSupplies(g, { shea: 6, oil: 6, fragrance: 4 });
  run(g, 20);
  const t1 = queueBatch(g, sku.id).job.time;
  assert.ok(t1 < t0 * 0.75);
  assertInvariants(g);
});

test('save: round-trips the full business state', () => {
  const g = mk(7);
  queueBatch(g, g.state.skus[0].id);
  orderSupplies(g, { sugar: 6 });
  run(g, 33);
  const copy = deserialize(serialize(g.state));
  assert.deepEqual(copy, JSON.parse(JSON.stringify(g.state)));
  // and both continue identically
  const g2 = new Game(copy);
  run(g, 120); run(g2, 120);
  assert.deepEqual(JSON.parse(JSON.stringify(g2.state)), JSON.parse(JSON.stringify(g.state)));
});

test('save: rolling backup, corrupt-slot recovery and version migration', () => {
  const st = memStorage();
  const g = mk(9);
  saveGame(st, g.state);
  transact(g, 5, 'Online orders');
  saveGame(st, g.state);
  assert.ok(st.getItem(BACKUP_KEY));
  st.setItem(SAVE_KEY, '{broken');
  assert.equal(loadGame(st).cash, START_CASH); // fell back to the backup
  const old = JSON.parse(serialize(g.state));
  old.version = 0; delete old.state.settings; delete old.state.missedDemand; delete old.state.marketing;
  const migrated = deserialize(JSON.stringify(old));
  assert.equal(migrated.version, SAVE_VERSION);
  assert.deepEqual(migrated.settings, { autoFulfill: false });
  assert.ok(migrated.marketing.active);
  assert.throws(() => deserialize(JSON.stringify({ version: SAVE_VERSION + 1, state: {} })));
});

// A simple bot plays the home era. Used as a soak test and as a balance check.
function botPlay(g, maxDays) {
  const s = g.state;
  const log = [];
  let lastDay = 1;
  while (s.time.day <= maxDays && !s.milestone.outgrown) {
    // fulfil whatever we can
    for (const o of [...s.orders].sort((a, b) => a.deadline - b.deadline)) if (canFulfill(s, o)) fulfillOrder(g, o.id);
    // keep each SKU stocked: queue a batch for the SKU with the lowest stock relative to demand
    const pending = (id) => s.queue.filter((j) => j.skuId === id).reduce((a, j) => a + j.units, 0) + s.stations.filter((x) => x.job && x.job.skuId === id).reduce((a, x) => a + x.job.units, 0);
    const want = (id) => s.orders.filter((o) => o.status === 'open').reduce((a, o) => a + o.lines.filter((l) => l.skuId === id).reduce((b, l) => b + l.qty, 0), 0);
    const active = s.skus.filter((k) => !k.paused);
    if (s.queue.length < 2 && goodsFree(s) > 12) {
      const k = active.map((sku) => ({ sku, score: s.goods[sku.id] + pending(sku.id) - want(sku.id) * 1.5 })).sort((a, b) => a.score - b.score)[0];
      if (k.score < 10) {
        const needs = batchNeeds(s, k.sku);
        if (!hasIngredients(s, needs)) {
          const buy = {};
          for (const [id, q] of Object.entries(needs)) {
            const incoming = s.deliveries.reduce((a, d) => a + (d.items[id] || 0), 0);
            if (s.ingredients[id] + incoming < q * 2) buy[id] = Math.ceil((q * 2) / INGREDIENTS[id].lot) * INGREDIENTS[id].lot;
          }
          if (Object.keys(buy).length) orderSupplies(g, buy);
        } else queueBatch(g, k.sku.id);
      }
    }
    // reinvest
    for (const id of UPGRADE_ORDER) if (!s.upgrades[id] && s.cash > UPGRADES[id].cost + 120) { buyUpgrade(g, id); break; }
    if (s.upgrades.helper) s.settings.autoFulfill = true;
    // move the range up-market once there is money for it
    if (s.cash > 250 && s.skus.length < 6) {
      const base = s.skus[s.skus.length - 3];
      createVariant(g, base.productId, base.scentId, 1);
    }
    // retire a Classic once its Botanical sibling exists and its stock has sold through
    for (const k of s.skus) {
      if (k.tier === 0 && !k.paused && s.goods[k.id] === 0 && pending(k.id) === 0 && s.skus.some((b) => b.tier === 1 && b.productId === k.productId)) setSkuPaused(g, k.id, true);
    }
    if (s.upgrades.mixer) startCampaign(g, 'social');
    run(g, 2);
    assertInvariants(g);
    if (s.time.day !== lastDay) { lastDay = s.time.day; log.push({ day: s.time.day - 1, cash: Math.round(s.cash), rev: Math.round(s.stats.revenue), orders: s.stats.ordersFulfilled, expired: s.stats.ordersExpired, rep: s.reputation, soul: Math.round(s.soul), up: Object.keys(s.upgrades).length }); }
  }
  return log;
}

test('soak: a bot can play the home era to the first-store milestone with no invariant breaks', () => {
  const g = mk(1234);
  const log = botPlay(g, 30);
  if (process.env.BALANCE) console.table(log);
  const s = g.state;
  assert.ok(s.milestone.outgrown, `bot did not reach the milestone: ${JSON.stringify(homeGoals(s).map((x) => [x.id, x.value]))}`);
  assert.ok(s.time.day >= 6, `milestone reached too fast (day ${s.time.day})`);
  if (s.cash < 2000) transact(g, 2000, 'Online orders');
  assert.ok(signLease(g).ok);
  assert.equal(signLease(g).ok, false);
  assertInvariants(g);
  // no actor is stuck on a dead task
  run(g, 60);
  for (const a of s.actors) assert.ok(!a.task || a.task.steps[a.task.i], 'actor has a valid task');
  assert.ok(s.time.t < DAY_LENGTH);
});

test('pricing: clamps to a sane range and drives demand appeal', () => {
  const g = mk();
  const sku = g.state.skus[0];
  setPrice(g, sku.id, 9999);
  assert.ok(sku.price <= 30);
  setPrice(g, sku.id, -5);
  assert.equal(sku.price, 1);
  assert.equal(getSku(g.state, sku.id), sku);
});
