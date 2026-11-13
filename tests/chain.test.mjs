// Era III, Milestone 5: several stores. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import { Game, newGameState } from '../js/sim/core.js';
import { transact } from '../js/sim/economy.js';
import { tick, signLease } from '../js/sim/business.js';
import { orderSupplies, batchNeeds, hasIngredients, goodsFree } from '../js/sim/inventory.js';
import { queueBatch } from '../js/sim/production.js';
import { openStore } from '../js/sim/store.js';
import { hireStaff, roleAllowed } from '../js/sim/staff.js';
import { openBranch, canOpenBranch, swapTo, withStore, storeIds, transferStock, companyUnits, storeKpis, storeProfit, expansionGoals, goodsOf, currentId } from '../js/sim/chain.js';
import { serialize, deserialize } from '../js/sim/save.js';
import { INGREDIENTS, LOCATIONS, CHAIN, SAVE_VERSION, DAY_LENGTH } from '../js/data.js';

const run = (g, seconds) => { for (let t = 0; t < seconds; t += 0.2) tick(g, 0.2); };
const balanced = (s) => assert.ok(Math.abs(s.cash - s.ledger.sum) < 0.005, `cash ${s.cash} != ledger ${s.ledger.sum}`);
const units = (s) => companyUnits(s) - (s.stats.unitsMade - s.stats.unitsSold);

export function chainGame(seed = 3, cash = 12000) {
  const g = new Game(newGameState({}, seed));
  const s = g.state;
  s.milestone.outgrown = true;
  transact(g, cash, 'Online orders');
  signLease(g);
  for (const k of s.skus) s.goods[k.id] = 40;
  openStore(g);
  for (const k of s.skus) s.goods[k.id] += 30; // a stocked back room
  for (const id of ['mixer', 'station2', 'bigpot', 'goods']) s.upgrades[id] = true;
  s.stations[1].unlocked = true;
  return g;
}

// Keep Main Street's workroom busy, buying ingredients as needed (shared by the soak bots).
export function keepProducing(g, depth = 3) {
  const s = g.state;
  if (s.queue.length >= depth || goodsFree(s) <= 12 || currentId(s) !== 'main') return;
  const sku = [...s.skus].sort((a, b) => (s.goods[a.id] || 0) - (s.goods[b.id] || 0))[0];
  const needs = batchNeeds(s, sku);
  if (hasIngredients(s, needs)) { queueBatch(g, sku.id); return; }
  const buy = {};
  for (const [id, q] of Object.entries(needs)) if ((s.ingredients[id] || 0) + s.deliveries.reduce((a, d) => a + (d.items[id] || 0), 0) < q * 3) buy[id] = Math.ceil((q * 3) / INGREDIENTS[id].lot) * INGREDIENTS[id].lot;
  if (Object.keys(buy).length) orderSupplies(g, buy);
}

test('chain: expansion goals gate the second store', () => {
  const g = chainGame(5);
  const s = g.state;
  assert.equal(canOpenBranch(s, 'campus').ok, false);
  assert.ok(expansionGoals(s).some((x) => !x.done));
  s.stats.revenue = 20000; s.store.reputation = 4.2; s.time.day += 6;
  for (let i = 0; i < 3; i++) hireStaff(g, s.store.candidates[0].id, 'associate');
  run(g, 1);
  assert.ok(s.milestone.chainReady);
  assert.equal(roleAllowed(s, 'manager').ok, true);
});

test('chain: a branch opens at a location with its own floor, stock and staff', () => {
  const g = chainGame(7);
  const s = g.state;
  s.milestone.chainReady = true;
  const base = units(s);
  const cash = s.cash;
  const r = openBranch(g, 'campus');
  assert.ok(r.ok, r.reason);
  assert.equal(s.cash, cash - LOCATIONS.campus.deposit);
  assert.deepEqual(storeIds(s), ['main', r.id]);
  assert.equal(currentId(s), 'main');
  assert.equal(openBranch(g, 'campus').ok, false, 'one shop per location');
  withStore(s, r.id, () => {
    assert.equal(s.store.location, 'campus');
    assert.equal(s.actors.length, 0, 'no founder in the branch');
    assert.equal(s.store.candidates[0].role, 'manager');
    assert.equal(roleAllowed(s, 'maker').ok, false, 'no workroom here');
  });
  assert.equal(units(s), base);
  balanced(s);
});

test('chain: swapping stores in and out keeps every store intact and saves as plain JSON', () => {
  const g = chainGame(9);
  const s = g.state;
  s.milestone.chainReady = true;
  const b = openBranch(g, 'oldtown').id;
  const mainFurniture = s.store.furniture.length;
  swapTo(s, b);
  assert.equal(s.store.id, b);
  assert.equal(s.parked.main.store.furniture.length, mainFurniture);
  const copy = deserialize(serialize(s));
  assert.deepEqual(copy, JSON.parse(JSON.stringify(s)));
  swapTo(s, 'main');
  assert.equal(s.store.id, 'main');
  assert.ok(s.parked[b]);
});

test('chain: a manager runs a branch alone, ordering stock from Main Street', () => {
  const g = chainGame(11);
  const s = g.state;
  s.milestone.chainReady = true;
  const b = openBranch(g, 'riverside').id;
  const base = units(s);
  withStore(s, b, () => { assert.ok(hireStaff(g, s.store.candidates[0].id, 'manager').ok); });
  swapTo(s, b); // the player watches the branch while the whole chain runs
  run(g, 240);
  const k = storeKpis(s).find((x) => x.id === b);
  assert.ok(k.hasManager);
  assert.ok(withStore(s, b, () => s.store.stats.buyers) > 5, 'shoppers bought things at the branch');
  assert.ok((s.ledger.lifetime.Distribution || 0) < 0, 'the manager ordered a courier run');
  assert.ok(withStore(s, 'main', () => s.store.stats.visitors) > 10, 'Main Street kept trading in the background');
  assert.equal(units(s), base);
  balanced(s);
});

test('chain: manual transfers take time, cost a courier fee and never lose stock', () => {
  const g = chainGame(13);
  const s = g.state;
  s.milestone.chainReady = true;
  const b = openBranch(g, 'harbour').id;
  run(g, CHAIN.transferTime + 1); // the opening shipment arrives first
  const base = units(s);
  const sku = s.skus[0].id;
  const have = s.goods[sku];
  const atBranch = () => goodsOf(s, b)[sku] + withStore(s, b, () => s.store.furniture.reduce((a, f) => a + f.slots.filter((x) => x.skuId === sku).reduce((c, x) => c + x.stock, 0), 0));
  const before = atBranch();
  assert.equal(transferStock(g, 'main', b, { [sku]: have + 1 }).ok, false);
  assert.ok(transferStock(g, 'main', b, { [sku]: 5 }).ok);
  assert.equal(s.goods[sku], have - 5);
  assert.equal(atBranch(), before, 'still on the road');
  assert.equal(units(s), base);
  run(g, CHAIN.transferTime + 1);
  assert.equal(atBranch(), before + 5);
  assert.equal(units(s), base);
  balanced(s);
});

test('chain: per-store P&L adds up to the company ledger every day', () => {
  const g = chainGame(17);
  const s = g.state;
  s.milestone.chainReady = true;
  const b = openBranch(g, 'campus').id;
  withStore(s, b, () => { hireStaff(g, s.store.candidates[0].id, 'manager'); hireStaff(g, s.store.candidates[0].id, 'cashier'); });
  s.time.t = DAY_LENGTH - 60;
  run(g, 70);
  run(g, DAY_LENGTH);
  for (const d of storeProfit(s, 2)) {
    const sum = Object.values(d.cols).reduce((a, c) => a + c.profit, 0);
    assert.ok(Math.abs(sum - d.profit) < 0.02, `day ${d.day}: stores ${sum} vs company ${d.profit}`);
    assert.ok(d.cols[b], 'the branch has its own column');
  }
  const last = storeProfit(s, 1)[0];
  assert.ok(last.cols[b].expenses >= LOCATIONS.campus.rent, 'the branch pays its own rent');
});

test('save: version 3 saves migrate to the chain format', () => {
  const g = chainGame(19);
  const st = JSON.parse(serialize(g.state)).state;
  delete st.current; delete st.parked; delete st.storeOrder; delete st.transfers; delete st.store.id; delete st.store.location;
  const m = deserialize(JSON.stringify({ version: 3, state: st }));
  assert.equal(m.version, SAVE_VERSION);
  assert.equal(m.current, 'main');
  assert.deepEqual(m.storeOrder, ['main']);
  assert.equal(m.store.location, 'main');
  const g2 = new Game(m);
  run(g2, 20);
  balanced(g2.state);
});

// A bot runs a three-store chain for a week: production at Main Street, managers and cashiers in
// the branches, and the managers' automatic stock orders.
test('soak: a three-store chain for a week, with no lost units and balanced books', () => {
  const g = chainGame(41, 16000);
  const s = g.state;
  s.milestone.chainReady = true;
  const ids = [openBranch(g, 'campus').id, openBranch(g, 'oldtown').id];
  for (const id of ids) withStore(s, id, () => { hireStaff(g, s.store.candidates[0].id, 'manager'); hireStaff(g, s.store.candidates[0].id, 'cashier'); });
  hireStaff(g, s.store.candidates[0].id, 'cashier'); hireStaff(g, s.store.candidates[0].id, 'maker');
  const base = units(s);
  const start = s.time.day;
  const log = [];
  let day = start;
  while (s.time.day < start + 7) {
    keepProducing(g);
    s.settings.autoFulfill = true;
    run(g, 2);
    balanced(s);
    if (s.time.day !== day) {
      day = s.time.day;
      assert.equal(units(s), base, 'a unit went missing between stores');
      const kp = storeKpis(s);
      const pr = storeProfit(s, 1)[0];
      log.push({ day: day - 1, ...Object.fromEntries(kp.map((k) => [k.name.split(' ')[0], `${k.yesterday ? k.yesterday.visitors : 0}v $${Math.round(pr.cols[k.id] ? pr.cols[k.id].profit : 0)} ★${k.rating}`])), company: Math.round(pr.profit), cash: Math.round(s.cash) });
    }
  }
  if (process.env.BALANCE) console.table(log);
  assert.equal(units(s), base);
  const kp = storeKpis(s);
  // Two stoves cannot keep three shops stocked; ratings sag until the central kitchen (M6).
  assert.ok(kp.every((k) => k.rating >= 2), `ratings ${kp.map((k) => k.rating)}`);
  assert.ok(log.slice(-3).reduce((a, d) => a + d.company, 0) > 0, 'the chain makes money');
});
