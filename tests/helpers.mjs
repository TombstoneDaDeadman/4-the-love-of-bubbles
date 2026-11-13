// Shared setup for the chain and company tests (not a test file itself).
import { Game, newGameState } from '../js/sim/core.js';
import { transact } from '../js/sim/economy.js';
import { signLease } from '../js/sim/business.js';
import { orderSupplies, batchNeeds, hasIngredients, goodsFree } from '../js/sim/inventory.js';
import { queueBatch } from '../js/sim/production.js';
import { openStore } from '../js/sim/store.js';
import { currentId } from '../js/sim/chain.js';
import { INGREDIENTS } from '../js/data.js';

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

