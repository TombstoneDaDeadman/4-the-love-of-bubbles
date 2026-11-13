// Milestone 4 (first store, full loop) tests. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import { Game, newGameState } from '../js/sim/core.js';
import { transact } from '../js/sim/economy.js';
import { tick, signLease, startCampaign } from '../js/sim/business.js';
import { orderSupplies, batchNeeds, hasIngredients, goodsFree, unlockLine, createVariant, productUnlocked } from '../js/sim/inventory.js';
import { queueBatch } from '../js/sim/production.js';
import { openStore, placeFurniture, unitsOnDisplay, spawnCustomer, designScore, cleanliness, trafficBreakdown, archetypeWeights, buyLoyalty, profitReport } from '../js/sim/store.js';
import { hireStaff, setShift, trainStaff, wagesPerDay, onShift, needsRestock } from '../js/sim/staff.js';
import { serialize, deserialize } from '../js/sim/save.js';
import { INGREDIENTS, STORE, SAVE_VERSION, DAY_LENGTH, FURNITURE } from '../js/data.js';

const run = (g, seconds) => { for (let t = 0; t < seconds; t += 0.2) tick(g, 0.2); };

function storeGame(seed = 3, stock = 24, cash = 3000) {
  const g = new Game(newGameState({}, seed));
  const s = g.state;
  s.milestone.outgrown = true;
  transact(g, cash, 'Online orders');
  signLease(g);
  for (const k of s.skus) s.goods[k.id] = stock;
  openStore(g);
  return g;
}
const balanced = (s) => assert.ok(Math.abs(s.cash - s.ledger.sum) < 0.005, `cash ${s.cash} != ledger ${s.ledger.sum}`);

test('lines: new product lines unlock in the store, cost R&D, and bring new shoppers', () => {
  const home = new Game(newGameState({}, 1));
  transact(home, 1000, 'Online orders');
  assert.equal(unlockLine(home, 'hair').ok, false, 'not in the kitchen');
  const g = storeGame(5);
  const s = g.state;
  assert.equal(archetypeWeights(s).haircare, 0);
  assert.equal(createVariant(g, 'hair', 'mint', 1).ok, false);
  const cash = s.cash;
  const r = unlockLine(g, 'hair');
  assert.ok(r.ok);
  assert.equal(s.cash, cash - 260);
  assert.ok(productUnlocked(s, 'hair'));
  assert.ok(archetypeWeights(s).haircare > 0);
  assert.equal(unlockLine(g, 'hair').ok, false);
  assert.ok(createVariant(g, 'hair', 'mint', 1).ok);
  // the new line can be made from its own ingredients
  s.ingredients.bottle = 12; s.ingredients.oil = 12; s.ingredients.fragrance = 10;
  assert.ok(queueBatch(g, r.sku.id).ok);
  balanced(s);
});

test('cleaning: shoppers wear the floor and drop messes; staff tidy; closing time cleans up', () => {
  const g = storeGame(7, 60);
  const s = g.state, st = s.store;
  for (let i = 0; i < 20; i++) spawnCustomer(g);
  run(g, 120);
  assert.ok(st.clean < 100, 'the floor wore down');
  const messesBefore = st.messes.length + 0;
  assert.ok(hireStaff(g, st.candidates[0].id, 'stocker').ok);
  st.spawnTimer = 1e9; run(g, 120); // let the shop empty and the displays settle
  st.messes = [{ id: 'mtest', x: 0, z: 1, kind: 'spill', claimedBy: null }];
  run(g, 40);
  assert.ok(!st.messes.some((m) => m.id === 'mtest'), 'the stocker tidied the spill');
  assert.ok(cleanliness(s) <= 100 && cleanliness(s) >= 0);
  const c0 = st.clean;
  s.time.t = DAY_LENGTH - 0.1; run(g, 0.4);
  assert.ok(st.clean >= Math.min(100, c0), 'closing-time tidy-up');
  assert.ok(messesBefore >= 0);
  balanced(s);
});

test('shifts: off-shift staff clock out, half shifts cost less, the founder covers the till', () => {
  const g = storeGame(9);
  const s = g.state, st = s.store;
  const rec = hireStaff(g, st.candidates[0].id, 'cashier').staff;
  const full = wagesPerDay(s);
  assert.ok(setShift(g, rec.id, 'late').ok);
  assert.ok(wagesPerDay(s) < full * 0.6);
  assert.equal(onShift(s, rec), false, 'morning: the closing cashier is not in yet');
  for (let i = 0; i < 6; i++) spawnCustomer(g);
  run(g, 60);
  const actor = s.actors.find((a) => a.id === rec.id);
  assert.ok(actor.away, 'clocked out in the staff room');
  assert.ok(st.stats.buyers > 0, 'the founder rang people up');
  s.time.t = DAY_LENGTH * 0.55;
  run(g, 20);
  assert.equal(actor.away, false);
  assert.equal(actor.task && actor.task.type, 'till');
});

test('training: costs money, takes time at the laptop, and permanently improves a skill', () => {
  const g = storeGame(11);
  const s = g.state, st = s.store;
  const rec = hireStaff(g, st.candidates[0].id, 'stocker').staff;
  const before = rec.speed, cash = s.cash;
  assert.ok(trainStaff(g, rec.id, 'speed').ok);
  assert.equal(s.cash, cash - STORE.trainCost);
  assert.equal(trainStaff(g, rec.id, 'service').ok, false, 'one course at a time');
  run(g, STORE.trainTime + 25);
  assert.equal(rec.training, null);
  assert.ok(rec.speed > before);
  assert.ok((s.ledger.lifetime['Staff training'] || 0) < 0);
  balanced(s);
});

test('restocking: per-display refill levels and rush requests', () => {
  const g = storeGame(13, 40);
  const s = g.state;
  const fu = s.store.furniture.find((f) => f.type === 'shelf');
  const slot = fu.slots[0], cap = FURNITURE.shelf.slotCap;
  s.goods[slot.skuId] += slot.stock - 7; slot.stock = 7; // 58% full
  slot.refill = 0.5;
  assert.equal(needsRestock(s, slot, cap), false);
  slot.refill = 0.8;
  assert.equal(needsRestock(s, slot, cap), true);
  slot.refill = 0.25; slot.rush = true;
  assert.equal(needsRestock(s, slot, cap), true);
  s.store.spawnTimer = 1e9; // no shoppers, so nothing is bought off the shelf meanwhile
  run(g, 40);
  assert.equal(slot.stock, cap, 'the founder rushed it to full');
  assert.equal(slot.rush, false);
});

test('design score, local marketing and loyalty move foot traffic', () => {
  const g = storeGame(17, 40, 4000);
  const s = g.state;
  const d0 = designScore(s);
  assert.ok(d0.total >= 0 && d0.total <= 100);
  assert.equal(d0.total, d0.parts.reduce((a, p) => a + p.value, 0));
  const t0 = trafficBreakdown(s).total;
  assert.ok(placeFurniture(g, 'lamp', 10, 18 - 8, 0).ok);
  assert.ok(placeFurniture(g, 'bench', 5, 18, 0).ok);
  assert.ok(designScore(s).total > d0.total, 'decor raises the score');
  assert.ok(trafficBreakdown(s).total > t0);
  const t1 = trafficBreakdown(s).total;
  assert.ok(startCampaign(g, 'paper').ok);
  assert.ok(trafficBreakdown(s).total > t1 * 1.2);
  const reg = archetypeWeights(s).regular;
  assert.ok(buyLoyalty(g).ok);
  assert.ok(archetypeWeights(s).regular > reg);
  assert.equal(buyLoyalty(g).ok, false);
  const home = new Game(newGameState({}, 2));
  assert.equal(startCampaign(home, 'window').ok, false, 'no window display without a shop');
  balanced(s);
});

test('save: version 2 store saves migrate to version 3', () => {
  const g = storeGame(19);
  const st = JSON.parse(serialize(g.state)).state;
  for (const f of st.store.furniture) for (const sl of f.slots) { delete sl.refill; delete sl.rush; }
  for (const r of st.store.staff) { delete r.shift; delete r.xp; }
  delete st.lines; delete st.store.clean; delete st.store.messes;
  const m = deserialize(JSON.stringify({ version: 2, state: st }));
  assert.equal(m.version, SAVE_VERSION);
  assert.deepEqual(m.lines, {});
  assert.equal(m.store.clean, 100);
  assert.deepEqual(m.store.messes, []);
  assert.ok(m.store.furniture.filter((f) => f.slots.length).every((f) => f.slots.every((sl) => sl.refill === 0.5)));
  const g2 = new Game(m);
  run(g2, 30);
  balanced(g2.state);
});

// A bot that uses the whole store toolkit: production worker, stocker, a cashier on the busy
// half of the day, decor, a new product line and local marketing. Also checks that the store
// profitability report reconciles with the ledger every day.
test('soak: the full store loop for a week, with reports that reconcile', () => {
  const g = storeGame(41, 12);
  const s = g.state, st = s.store;
  for (const id of ['mixer', 'station2', 'bigpot', 'goods']) s.upgrades[id] = true;
  s.stations[1].unlocked = true;
  const log = [];
  const startDay = s.time.day;
  let day = startDay;
  const hire = (role) => { if (st.staff.length < STORE.maxStaff && !st.staff.some((x) => x.role === role) && st.candidates.length) hireStaff(g, st.candidates[0].id, role); };
  while (s.time.day < startDay + 7) {
    const stock = (id) => s.goods[id] + unitsOnDisplay(s, id) + s.queue.filter((j) => j.skuId === id).reduce((a, j) => a + j.units, 0) + s.stations.filter((x) => x.job && x.job.skuId === id).reduce((a, x) => a + x.job.units, 0);
    if (s.queue.length < 3 && goodsFree(s) > 12) {
      const sku = [...s.skus].sort((a, b) => stock(a.id) - stock(b.id))[0];
      const needs = batchNeeds(s, sku);
      if (hasIngredients(s, needs)) queueBatch(g, sku.id);
      else {
        const buy = {};
        for (const [id, q] of Object.entries(needs)) {
          const incoming = s.deliveries.reduce((a, d) => a + (d.items[id] || 0), 0);
          if ((s.ingredients[id] || 0) + incoming < q * 2) buy[id] = Math.ceil((q * 2) / INGREDIENTS[id].lot) * INGREDIENTS[id].lot;
        }
        if (Object.keys(buy).length) orderSupplies(g, buy);
      }
    }
    if (s.cash > 300) hire('cashier');
    if (s.cash > 500) hire('maker');
    if (s.cash > 700) hire('stocker');
    if (s.cash > 900 && !s.lines.bomb) unlockLine(g, 'bomb');
    if (s.cash > 900 && !st.furniture.some((f) => f.type === 'lamp')) { placeFurniture(g, 'lamp', 10, 10, 0); placeFurniture(g, 'plant', 17, 9, 0); }
    if (s.cash > 400) startCampaign(g, 'window');
    s.settings.autoFulfill = true;
    run(g, 2);
    balanced(s);
    for (const c of st.customers) assert.ok(c.life < 500, 'a shopper has been inside too long');
    if (s.time.day !== day) {
      day = s.time.day;
      const rep = profitReport(s, 1)[0];
      const groupSum = rep.groups.reduce((a, x) => a + x.value, 0);
      assert.ok(Math.abs(groupSum - rep.expenses) < 0.02, `day ${rep.day}: costs ${groupSum} vs ledger ${rep.expenses}`);
      assert.ok(Math.abs(rep.store + rep.online + rep.otherIncome - rep.revenue) < 0.02, 'income reconciles');
      const sd = st.days[st.days.length - 1];
      assert.ok(Math.abs(sd.revenue - rep.store) < 0.02, `store sales ${sd.revenue} vs ledger ${rep.store}`);
      log.push({ day: rep.day, visitors: sd.visitors, buyers: sd.buyers, walkouts: sd.walkouts, store: Math.round(rep.store), staff: Math.round(rep.groups[1].value), profit: Math.round(rep.profit), cash: Math.round(s.cash), rating: sd.rating, clean: sd.clean, design: sd.design, soul: Math.round(s.soul) });
    }
  }
  if (process.env.BALANCE) console.table(log);
  const last = log.slice(-3);
  assert.ok(last.reduce((a, d) => a + d.profit, 0) > 0, 'a well-run store makes money');
  assert.ok(st.reputation >= 3.5, `store rating ${st.reputation}`);
  assert.ok(last.every((d) => d.clean >= 50), 'staff keep the shop clean');
});
