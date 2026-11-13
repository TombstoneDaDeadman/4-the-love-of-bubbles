// Era II (first store) simulation tests. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import { Game, newGameState } from '../js/sim/core.js';
import { transact } from '../js/sim/economy.js';
import { tick, signLease } from '../js/sim/business.js';
import { orderSupplies, batchNeeds, hasIngredients, goodsFree } from '../js/sim/inventory.js';
import { queueBatch } from '../js/sim/production.js';
import { openStore, placeFurniture, moveFurniture, sellFurniture, assignSlot, unitsOnDisplay, spawnCustomer } from '../js/sim/store.js';
import { hireStaff, fireStaff } from '../js/sim/staff.js';
import { checkPlacement, findPath, walkGrid, cellOf, isWalkable } from '../js/sim/path.js';
import { serialize, deserialize } from '../js/sim/save.js';
import { INGREDIENTS, STORE, STORE_POINTS, SAVE_VERSION, DAY_LENGTH } from '../js/data.js';

const run = (g, seconds) => { for (let t = 0; t < seconds; t += 0.2) tick(g, 0.2); };

// Every finished unit is somewhere: back stock, a display, a basket, a stocker's arms or an
// order waiting to be packed. Units only enter when made and only leave when sold.
function unitsHeld(s) {
  let n = Object.values(s.goods).reduce((a, b) => a + b, 0) + unitsOnDisplay(s);
  for (const c of s.store ? s.store.customers : []) n += c.basket.reduce((a, l) => a + l.qty, 0);
  // (a cooked batch on its way to the shelf is not counted as made until it is shelved)
  for (const a of s.actors) if (a.task && a.task.payload && a.task.type !== 'collect') n += a.task.payload.units;
  for (const o of s.orders) if (o.status !== 'open') n += o.lines.reduce((a, l) => a + l.qty, 0);
  return n;
}
const ledger = (s) => unitsHeld(s) - (s.stats.unitsMade - s.stats.unitsSold);

function storeGame(seed = 3, stock = 24) {
  const g = new Game(newGameState({}, seed));
  const s = g.state;
  s.milestone.outgrown = true;
  transact(g, 2600, 'Online orders');
  assert.ok(signLease(g).ok);
  for (const k of s.skus) s.goods[k.id] = stock;
  assert.ok(openStore(g).ok);
  return g;
}

function check(g, base) {
  const s = g.state;
  assert.ok(Math.abs(s.cash - s.ledger.sum) < 0.005, `cash ${s.cash} != ledger ${s.ledger.sum}`);
  for (const [id, q] of Object.entries(s.goods)) assert.ok(q >= 0, `goods ${id} negative`);
  for (const fu of s.store.furniture) for (const sl of fu.slots) assert.ok(sl.stock >= 0 && sl.stock <= 12, 'display stock out of range');
  assert.equal(ledger(s), base, 'a finished unit was created or destroyed');
}

test('store: opening moves the business in and keeps every unit', () => {
  const g = new Game(newGameState({}, 11));
  const s = g.state;
  for (const k of s.skus) s.goods[k.id] = 20;
  assert.equal(openStore(g).ok, false, 'needs a signed lease');
  s.milestone.outgrown = true;
  transact(g, 2000, 'Online orders');
  signLease(g);
  const before = unitsHeld(s);
  assert.ok(openStore(g).ok);
  assert.equal(s.era, 'store');
  assert.equal(unitsHeld(s), before);
  assert.ok(unitsOnDisplay(s) > 0, 'stock went onto the displays');
  assert.equal(s.actors.length, 1);
  assert.equal(openStore(g).ok, false);
});

test('store: shoppers browse, queue, pay at the till and leave a rating', () => {
  const g = storeGame(5);
  const s = g.state, base = ledger(s);
  run(g, 200);
  const st = s.store;
  assert.ok(st.stats.visitors > 15, `visitors ${st.stats.visitors}`);
  assert.ok(st.stats.buyers > 5, 'the founder covers the till when there is no cashier');
  assert.ok(s.ledger.lifetime['Store sales'] > 0);
  assert.ok(st.ratings.length > 0);
  assert.ok(st.reputation > 1 && st.reputation <= 5);
  check(g, base);
});

test('build: placement is validated and costs or refunds money through the ledger', () => {
  const g = storeGame(7);
  const s = g.state, st = s.store;
  assert.equal(checkPlacement(st, 'table', 12, 18, 0).ok, false, 'entrance stays clear');
  assert.equal(checkPlacement(st, 'shelf', 0, 9, 1).ok, false, 'overlap');
  assert.equal(checkPlacement(st, 'plant', 0, 0, 0).ok, false, 'not in the back room');
  assert.equal(checkPlacement(st, 'shelf', 2, 9, 1).ok, false, 'would block the shelf behind it');
  const cash = s.cash;
  const r = placeFurniture(g, 'table', 14, 12, 0);
  assert.ok(r.ok, r.reason);
  assert.equal(s.cash, cash - 120);
  assert.ok(r.furniture.slots[0].skuId, 'new displays get a product');
  assert.ok(moveFurniture(g, r.furniture.id, 15, 10, 1).ok);
  assert.equal(moveFurniture(g, r.furniture.id, 0, 9, 0).ok, false);
  assert.ok(sellFurniture(g, r.furniture.id).ok);
  assert.equal(s.cash, cash - 60);
  // the last display cannot be sold
  const displays = st.furniture.filter((f) => f.slots.length);
  for (const f of displays.slice(1)) assert.ok(sellFurniture(g, f.id).ok);
  assert.equal(sellFurniture(g, displays[0].id).ok, false);
});

test('path: A* finds routes around displays and never through them', () => {
  const g = storeGame(2);
  const st = g.state.store, walk = walkGrid(st);
  const a = STORE_POINTS.inside, b = STORE_POINTS.shelf;
  const p = findPath(walk, a.x, a.z, b.x, b.z);
  assert.ok(p && p.length >= 2);
  let x = a.x, z = a.z;
  for (const [px, pz] of p) {
    for (let k = 0; k <= 20; k++) { const [i, j] = cellOf(x + ((px - x) * k) / 20, z + ((pz - z) * k) / 20); assert.ok(isWalkable(walk, i, j), 'path crosses a blocked cell'); }
    x = px; z = pz;
  }
});

test('recovery: shoppers never get stuck when displays move or vanish', () => {
  const g = storeGame(13, 40);
  const s = g.state, st = s.store, base = ledger(s);
  for (let i = 0; i < 18; i++) spawnCustomer(g);
  const spots = [[14, 12, 0], [15, 9, 1], [9, 16, 2], [6, 12, 3]];
  for (let round = 0; round < 40; round++) {
    run(g, 3);
    const movable = st.furniture.filter((f) => f.type !== 'plant');
    const fu = movable[round % movable.length];
    if (round % 7 === 3) sellFurniture(g, fu.id);
    else { const [i, j, r] = spots[round % spots.length]; moveFurniture(g, fu.id, i, j, r); }
    if (round % 5 === 0) placeFurniture(g, 'table', ...spots[(round + 1) % spots.length]);
    check(g, base);
  }
  st.spawnTimer = 1e9;
  run(g, 600);
  assert.equal(st.customers.length, 0, `still inside: ${st.customers.map((c) => `${c.state}/${c.stateT.toFixed(0)}`).join(' ')}`);
  assert.equal(st.queue.length, 0);
  check(g, base);
});

test('staff: hiring, roles, wages, and safe recovery when a restock target is sold', () => {
  const g = storeGame(17, 30);
  const s = g.state, st = s.store, base = ledger(s);
  const cash = s.cash;
  const cand = st.candidates[0];
  assert.ok(hireStaff(g, cand.id, 'associate').ok);
  assert.equal(s.cash, cash - STORE.hireFee);
  assert.equal(hireStaff(g, cand.id, 'cashier').ok, false, 'already hired');
  // empty a display so the associate restocks it, then sell it mid-task
  const fu = st.furniture.find((f) => f.slots.length);
  s.goods[fu.slots[0].skuId] += fu.slots[0].stock; fu.slots[0].stock = 0;
  const actor = s.actors.find((a) => a.id !== 'founder');
  let sold = false;
  for (let k = 0; k < 400 && !sold; k++) {
    tick(g, 0.2);
    if (actor.task && actor.task.type === 'restock' && actor.task.payload) { sold = sellFurniture(g, actor.task.fid).ok; }
  }
  assert.ok(sold, 'associate carried stock toward a display');
  run(g, 5);
  assert.ok(!actor.task || actor.task.type !== 'restock' || getFid(st, actor.task.fid));
  check(g, base);
  // wages are paid at day end
  s.time.t = DAY_LENGTH - 0.1;
  const wagesBefore = s.ledger.lifetime['Staff wages'] || 0;
  run(g, 1);
  assert.ok((s.ledger.lifetime['Staff wages'] || 0) < wagesBefore);
  assert.ok((s.ledger.lifetime['Rent / lease'] || 0) < -2000);
  const rec = st.staff[0];
  assert.ok(fireStaff(g, rec.id).ok);
  assert.ok(!s.actors.some((a) => a.id === rec.id));
  check(g, base);
});
const getFid = (st, id) => st.furniture.find((f) => f.id === id);

test('displays: reassigning a slot returns its stock to back stock', () => {
  const g = storeGame(19);
  const s = g.state, base = ledger(s);
  const fu = s.store.furniture.find((f) => f.slots.length);
  const sl = fu.slots[0], old = sl.skuId, n = sl.stock, other = s.skus.find((k) => k.id !== old).id;
  const g0 = s.goods[old];
  assert.ok(assignSlot(g, fu.id, 0, other).ok);
  assert.equal(s.goods[old], g0 + n);
  assert.equal(sl.stock, 0);
  check(g, base);
});

test('save: store state round-trips and old saves migrate', () => {
  const g = storeGame(23);
  hireStaff(g, g.state.store.candidates[0].id, 'cashier');
  run(g, 90);
  const copy = deserialize(serialize(g.state));
  assert.deepEqual(copy, JSON.parse(JSON.stringify(g.state)));
  const g2 = new Game(copy);
  run(g, 60); run(g2, 60);
  assert.deepEqual(JSON.parse(JSON.stringify(g2.state)), JSON.parse(JSON.stringify(g.state)));
  // a version-1 save from someone who signed the lease before the store existed
  const old = new Game(newGameState({}, 4)).state;
  old.version = 1; old.milestone = { outgrown: true, leaseSigned: true }; delete old.store;
  const m = deserialize(JSON.stringify({ version: 1, state: old }));
  assert.equal(m.version, SAVE_VERSION);
  assert.equal(m.era, 'home');
  assert.equal(m.store, null);
  assert.equal(m.milestone.leaseSigned, true);
  assert.ok(openStore(new Game(m)).ok);
});

// A bot runs the store for a week: keeps production going, buys supplies, hires a cashier and an
// associate. Soak test for invariants and a balance check for the first store.
test('soak: a bot runs the first store for a week with no invariant breaks', () => {
  const g = storeGame(31, 12);
  const s = g.state, st = s.store, base = ledger(s);
  // arrive the way a player does: with the workshop upgrades that unlocked the lease
  for (const id of ['mixer', 'station2', 'bigpot', 'goods']) s.upgrades[id] = true;
  s.stations[1].unlocked = true;
  const log = [];
  let day = s.time.day;
  while (s.time.day < day + 7) {
    const stock = (id) => s.goods[id] + unitsOnDisplay(s, id) + s.queue.filter((j) => j.skuId === id).reduce((a, j) => a + j.units, 0) + s.stations.filter((x) => x.job && x.job.skuId === id).reduce((a, x) => a + x.job.units, 0);
    if (s.queue.length < 2 && goodsFree(s) > 12) {
      const sku = [...s.skus].sort((a, b) => stock(a.id) - stock(b.id))[0];
      const needs = batchNeeds(s, sku);
      if (hasIngredients(s, needs)) queueBatch(g, sku.id);
      else {
        const buy = {};
        for (const [id, q] of Object.entries(needs)) {
          const incoming = s.deliveries.reduce((a, d) => a + (d.items[id] || 0), 0);
          if (s.ingredients[id] + incoming < q * 2) buy[id] = Math.ceil((q * 2) / INGREDIENTS[id].lot) * INGREDIENTS[id].lot;
        }
        if (Object.keys(buy).length) orderSupplies(g, buy);
      }
    }
    if (!st.staff.some((x) => x.role === 'cashier') && s.cash > 300) hireStaff(g, st.candidates[0].id, 'cashier');
    if (st.staff.length === 1 && s.cash > 500) hireStaff(g, st.candidates[0].id, 'associate');
    s.settings.autoFulfill = true;
    run(g, 2);
    check(g, base);
    for (const c of st.customers) assert.ok(c.life < 500, 'a shopper has been inside too long');
    if (s.time.day !== day && log.length < s.time.day - day) {
      const d = st.days[st.days.length - 1], L = s.ledger.days[s.ledger.days.length - 1];
      log.push({ day: d.day, visitors: d.visitors, buyers: d.buyers, walkouts: d.walkouts, stockouts: d.stockouts, storeRev: Math.round(d.revenue), profit: Math.round(L.profit), cash: Math.round(s.cash), rating: d.rating, soul: Math.round(s.soul) });
    }
  }
  if (process.env.BALANCE) console.table(log);
  const last = log.slice(-3);
  assert.ok(last.every((d) => d.visitors > 25), 'steady foot traffic');
  assert.ok(last.reduce((a, d) => a + d.profit, 0) > 0, 'a working store makes money');
  assert.ok(st.reputation >= 3, `store rating ${st.reputation}`);
});
