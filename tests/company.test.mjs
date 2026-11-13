// Era III, Milestone 6: running the brand. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import { tick } from '../js/sim/business.js';
import { hireStaff } from '../js/sim/staff.js';
import { unlockLine } from '../js/sim/inventory.js';
import { openBranch, withStore, companyUnits, storeKpis, storeIds, goodsOf } from '../js/sim/chain.js';
import { buildKitchen, canBuildKitchen, addLine, truckRun, makeOffer, acceptContract, hireRegional, balanceStores, chainGoals, brandReport, qualityIndex, setKitchen } from '../js/sim/company.js';
import { trafficBreakdown } from '../js/sim/store.js';
import { serialize, deserialize } from '../js/sim/save.js';
import { KITCHEN, DAY_LENGTH, WHOLESALE, CHAIN } from '../js/data.js';
import { chainGame, keepProducing } from './helpers.mjs';

const run = (g, seconds) => { for (let t = 0; t < seconds; t += 0.2) tick(g, 0.2); };
const balanced = (s) => assert.ok(Math.abs(s.cash - s.ledger.sum) < 0.005, `cash ${s.cash} != ledger ${s.ledger.sum}`);
const units = (s) => companyUnits(s) - (s.stats.unitsMade - s.stats.unitsSold);

function twoShops(seed, cash = 20000) {
  const g = chainGame(seed, cash);
  g.state.milestone.chainReady = true;
  const b = openBranch(g, 'campus').id;
  return { g, s: g.state, b };
}

test('kitchen: needs two shops, makes double batches automatically into the warehouse', () => {
  const g = chainGame(3, 20000);
  assert.equal(canBuildKitchen(g.state).ok, false, 'one shop is not enough');
  const { g: g2, s } = twoShops(5);
  const base = units(s);
  const cash = s.cash;
  assert.ok(buildKitchen(g2).ok);
  assert.equal(s.cash, cash - KITCHEN.cost);
  assert.equal(buildKitchen(g2).ok, false);
  run(g2, 150);
  assert.ok(s.kitchen.made > 0, 'the lines produced');
  assert.ok((s.ledger.lifetime.Ingredients || 0) < 0, 'it bought ingredients in bulk');
  assert.ok(Object.values(s.kitchen.warehouse).reduce((a, b) => a + b, 0) > 0 || s.transfers.some((t) => t.from === 'kitchen'));
  assert.equal(units(s), base, 'made units are all accounted for');
  assert.ok(addLine(g2).ok);
  assert.equal(s.kitchen.lines.length, 3);
  balanced(s);
});

test('distribution: trucks top shops up to par, or to yesterday\'s sales with forecasting', () => {
  const { g, s, b } = twoShops(7);
  buildKitchen(g);
  for (const k of s.skus) s.kitchen.warehouse[k.id] = 100;
  setKitchen(g, 'forecast', false);
  const base = units(s);
  const shipped = truckRun(g);
  assert.ok(shipped > 0);
  assert.ok(s.transfers.some((t) => t.from === 'kitchen' && t.to === b));
  assert.equal(units(s), base);
  run(g, CHAIN.transferTime + 1);
  assert.ok(Object.values(goodsOf(s, b)).some((n) => n > 0), 'stock arrived at the branch');
  assert.equal(truckRun(g), 0, 'nothing more needed today');
  assert.equal(units(s), base);
  balanced(s);
});

test('wholesale: deliveries pay, misses cost, and three misses cancel', () => {
  const { g, s } = twoShops(9);
  buildKitchen(g);
  const offer = makeOffer(g);
  assert.ok(offer && offer.status === 'offer');
  assert.ok(acceptContract(g, offer.id).ok);
  for (const k of s.skus) s.kitchen.warehouse[k.id] = 0;
  for (const k of s.skus) withStore(s, 'main', () => { s.goods[k.id] = 0; });
  s.kitchen.lines = []; // no production, so every delivery is missed
  const soul = s.soul;
  for (let d = 0; d < 3; d++) { s.time.t = DAY_LENGTH - 0.2; run(g, 12); }
  assert.equal(offer.status, 'cancelled');
  assert.ok(s.soul < soul);
  assert.ok((s.ledger.lifetime.Wholesale || 0) <= -WHOLESALE.missPenalty * 3 + 0.01);
  // a contract that is delivered pays and completes
  const o2 = makeOffer(g);
  acceptContract(g, o2.id);
  for (const k of s.skus) s.kitchen.warehouse[k.id] = 200;
  const before = s.stats.contractsDone || 0;
  for (let d = 0; d < o2.days; d++) { s.time.t = DAY_LENGTH - 0.2; run(g, 12); }
  assert.equal(o2.status, 'done');
  assert.equal(s.stats.contractsDone, before + 1);
  balanced(s);
});

test('regional manager: balances stock between shops and lifts traffic everywhere', () => {
  const { g, s, b } = twoShops(11);
  const t0 = trafficBreakdown(s).total;
  assert.ok(hireRegional(g).ok);
  assert.ok(trafficBreakdown(s).total > t0);
  const sku = s.skus[0].id;
  s.goods[sku] = 60; goodsOf(s, b)[sku] = 0;
  const base = units(s);
  assert.ok(balanceStores(g) >= 6);
  assert.equal(units(s), base);
  run(g, CHAIN.transferTime + 1);
  assert.ok(goodsOf(s, b)[sku] > 0 || withStore(s, b, () => s.store.furniture.some((f) => f.slots.some((x) => x.skuId === sku && x.stock > 0))));
  balanced(s);
});

test('brand report, quality index and the chain goals', () => {
  const { g, s } = twoShops(13);
  run(g, DAY_LENGTH + 5);
  const r = brandReport(s);
  assert.equal(r.shops, 2);
  assert.ok(r.channels.length >= 1);
  assert.ok(r.channels[0].retail > 0);
  assert.ok(qualityIndex(s) > 0 && qualityIndex(s) <= 100);
  const goals = chainGoals(s);
  assert.ok(goals.find((x) => x.id === 'shops').value === 2);
  assert.equal(s.milestone.finale, false);
});

test('finale: meeting every chain goal ends the story once, and play continues', () => {
  const { g, s } = twoShops(15, 30000);
  openBranch(g, 'oldtown');
  buildKitchen(g);
  let fired = 0;
  g.on('finale', () => { fired += 1; });
  s.stats.revenue = 70000; s.soul = 80; s.stats.contractsDone = 1;
  for (const id of storeIds(s)) withStore(s, id, () => { s.store.reputation = 4.4; s.store.ratings = Array(40).fill(5); });
  run(g, 1);
  assert.equal(fired, 1);
  assert.ok(s.milestone.finale);
  run(g, 5);
  assert.equal(fired, 1, 'only once');
  const copy = deserialize(serialize(s));
  assert.equal(copy.milestone.finale, true);
});

// The full chain: three shops supplied by the central kitchen and morning trucks, managers in the
// branches, a regional manager, and wholesale contracts. Two weeks, with conservation and books
// checked every day. This is where shop ratings should recover after Milestone 5's supply squeeze.
test('soak: a kitchen-supplied three-shop chain for two weeks', () => {
  const g = chainGame(43, 26000);
  const s = g.state;
  s.milestone.chainReady = true;
  unlockLine(g, 'bomb');
  const ids = [openBranch(g, 'campus').id, openBranch(g, 'oldtown').id];
  for (const id of ids) withStore(s, id, () => { hireStaff(g, s.store.candidates[0].id, 'manager'); hireStaff(g, s.store.candidates[0].id, 'cashier'); hireStaff(g, s.store.candidates[0].id, 'stocker'); });
  hireStaff(g, s.store.candidates[0].id, 'cashier'); hireStaff(g, s.store.candidates[0].id, 'stocker');
  buildKitchen(g); addLine(g);
  setKitchen(g, 'midday', true);
  hireRegional(g);
  const base = units(s);
  const start = s.time.day;
  const log = [];
  let day = start;
  while (s.time.day < start + 14) {
    keepProducing(g, 2);
    for (const c of s.contracts || []) if (c.status === 'offer' && s.contracts.filter((x) => x.status === 'active').length < 1) acceptContract(g, c.id);
    s.settings.autoFulfill = true;
    run(g, 2);
    balanced(s);
    if (s.time.day !== day) {
      day = s.time.day;
      assert.equal(units(s), base, 'a unit went missing');
      const kp = storeKpis(s), d = s.ledger.days[s.ledger.days.length - 1];
      log.push({ day: day - 1, ratings: kp.map((k) => k.rating.toFixed(1)).join(' '), visitors: kp.map((k) => (k.yesterday ? k.yesterday.visitors : 0)).join(' '), retail: Math.round(d.cats['Store sales'] || 0), wholesale: Math.round(d.cats.Wholesale || 0), profit: Math.round(d.profit), cash: Math.round(s.cash), soul: Math.round(s.soul), done: s.stats.contractsDone || 0 });
    }
  }
  if (process.env.BALANCE) console.table(log);
  const last = log.slice(-4);
  assert.ok(last.reduce((a, d) => a + d.profit, 0) > 0, 'the chain is profitable');
  const kp = storeKpis(s);
  // Ratings swing ±0.4 day to day; this bot never adds decor or better formulas. With the kitchen
  // the chain should hold a decent average (M5's squeeze without it sat around 2.5).
  const avg = kp.reduce((a, k) => a + k.rating, 0) / kp.length;
  assert.ok(avg >= 3.2 && kp.every((k) => k.rating >= 2.8), `ratings ${kp.map((k) => k.rating)}`);
  assert.ok((s.stats.contractsDone || 0) >= 1, 'a wholesale contract was completed');
});
