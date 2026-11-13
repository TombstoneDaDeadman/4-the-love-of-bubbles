// InventoryService + RecipeService: ingredient and finished-goods quantities, supply orders,
// recipe maths. Quantities can never go negative: every removal is checked first.

import { INGREDIENTS, PRODUCTS, TIERS, BASE_INGREDIENT_CAP, BASE_GOODS_CAP, VARIANT_COST, MAX_SKUS_HOME, SCENTS, STORE } from '../data.js';
import { transact, canAfford } from './economy.js';
import { makeSku } from './core.js';

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

// The store's back room has more room than the kitchen; the home upgrades still add to it.
export function ingredientCap(state) { return (state.era === 'store' ? STORE.ingredientCap : BASE_INGREDIENT_CAP) + (state.upgrades.pantry ? 100 : 0); }
export function goodsCap(state) { return (state.era === 'store' ? STORE.goodsCap : BASE_GOODS_CAP) + (state.upgrades.goods ? 50 : 0); }
export function ingredientTotal(state) { return sum(state.ingredients); }
export function incomingTotal(state) { return state.deliveries.reduce((a, d) => a + sum(d.items), 0); }
export function goodsTotal(state) { return sum(state.goods); }
export function ingredientFree(state) { return ingredientCap(state) - ingredientTotal(state) - incomingTotal(state); }
export function goodsFree(state) { return goodsCap(state) - goodsTotal(state); }

export function hasIngredients(state, needs) {
  return Object.entries(needs).every(([id, q]) => (state.ingredients[id] || 0) >= q);
}
export function missingIngredients(state, needs) {
  const out = {};
  for (const [id, q] of Object.entries(needs)) {
    const short = q - (state.ingredients[id] || 0);
    if (short > 0) out[id] = short;
  }
  return out;
}
export function removeIngredients(state, needs) {
  if (!hasIngredients(state, needs)) return false;
  for (const [id, q] of Object.entries(needs)) state.ingredients[id] -= q;
  return true;
}
export function addIngredients(state, items) {
  for (const [id, q] of Object.entries(items)) state.ingredients[id] = (state.ingredients[id] || 0) + q;
}
export function addGoods(state, skuId, qty) { state.goods[skuId] = (state.goods[skuId] || 0) + qty; }
export function removeGoods(state, skuId, qty) {
  if ((state.goods[skuId] || 0) < qty) return false;
  state.goods[skuId] -= qty;
  return true;
}

// ---- Supplies -------------------------------------------------------------

export function supplyCost(items) {
  let c = 0;
  for (const [id, q] of Object.entries(items)) c += INGREDIENTS[id].cost * q;
  return Math.round(c * 100) / 100;
}

// Buy ingredients. They arrive after the slowest item's supplier lead time.
export function orderSupplies(game, items) {
  const s = game.state;
  const clean = {};
  for (const [id, q] of Object.entries(items)) if (q > 0 && INGREDIENTS[id]) clean[id] = Math.floor(q);
  const units = sum(clean);
  if (units <= 0) return { ok: false, reason: 'Nothing selected.' };
  if (units > ingredientFree(s)) return { ok: false, reason: 'Not enough pantry space for this delivery.' };
  const cost = supplyCost(clean);
  if (!canAfford(game, cost)) return { ok: false, reason: 'Not enough cash.' };
  const hasPackaging = Object.keys(clean).some((id) => INGREDIENTS[id].category === 'Packaging');
  const onlyPackaging = Object.keys(clean).every((id) => INGREDIENTS[id].category === 'Packaging');
  transact(game, -cost, onlyPackaging ? 'Packaging' : 'Ingredients', `${units} units${hasPackaging && !onlyPackaging ? ' incl. packaging' : ''}`);
  const lead = Math.max(...Object.keys(clean).map((id) => INGREDIENTS[id].lead));
  const delivery = { id: game.nextId('d'), items: clean, eta: lead, lead };
  s.deliveries.push(delivery);
  game.emit('supplyOrdered', delivery);
  return { ok: true, cost, delivery };
}

export function tickDeliveries(game, dt) {
  const s = game.state;
  for (let i = s.deliveries.length - 1; i >= 0; i--) {
    const d = s.deliveries[i];
    d.eta -= dt;
    if (d.eta <= 0) {
      s.deliveries.splice(i, 1);
      addIngredients(s, d.items);
      game.emit('delivery', d);
    }
  }
}

// ---- Recipes --------------------------------------------------------------

export function getSku(state, id) { return state.skus.find((k) => k.id === id); }
export function batchMult(state) { return state.upgrades.bigpot ? 1.5 : 1; }
export function batchUnits(state, sku) { return Math.round(PRODUCTS[sku.productId].batch * batchMult(state)); }
export function batchTime(state, sku) {
  return Math.round(PRODUCTS[sku.productId].time * (state.upgrades.mixer ? 0.7 : 1) * 10) / 10;
}
export function batchNeeds(state, sku) {
  const m = batchMult(state);
  const needs = {};
  const add = (src) => { for (const [id, q] of Object.entries(src)) needs[id] = (needs[id] || 0) + q; };
  add(PRODUCTS[sku.productId].base);
  add(TIERS[sku.tier].add);
  for (const id of Object.keys(needs)) needs[id] = Math.ceil(needs[id] * m);
  return needs;
}
export function unitCost(state, sku) {
  return Math.round((supplyCost(batchNeeds(state, sku)) / batchUnits(state, sku)) * 100) / 100;
}
export function refPrice(sku) { return PRODUCTS[sku.productId].basePrice * TIERS[sku.tier].priceMult; }
export function skuQuality(sku) { return TIERS[sku.tier].quality; }
export function skuRating(sku) { return sku.ratingCount ? sku.ratingSum / sku.ratingCount : 0; }

// How attractive the current price is: 1 at the reference price, falls quickly above it.
export function priceAppeal(sku) {
  const r = sku.price / refPrice(sku);
  return Math.max(0.08, Math.min(1.5, 1 - 1.5 * (r - 1)));
}

export function setPrice(game, skuId, price) {
  const sku = getSku(game.state, skuId);
  if (!sku) return false;
  const ref = refPrice(sku);
  sku.price = Math.max(1, Math.min(Math.round(ref * 2.5), Math.round(price)));
  game.emit('skuChanged', sku);
  return true;
}

// Pause or resume taking orders for a recipe. At least one recipe always stays listed.
export function setSkuPaused(game, skuId, paused) {
  const s = game.state, sku = getSku(s, skuId);
  if (!sku) return false;
  if (paused && s.skus.filter((k) => !k.paused).length <= 1) return false;
  sku.paused = !!paused;
  game.emit('skuChanged', sku);
  return true;
}

// Recipe book: duplicate a formula into a new scent / tier. Costs a small R&D fee.
export function createVariant(game, productId, scentId, tier) {
  const s = game.state;
  if (!PRODUCTS[productId] || !SCENTS[scentId] || !TIERS[tier]) return { ok: false, reason: 'Unknown recipe.' };
  if (s.skus.length >= MAX_SKUS_HOME) return { ok: false, reason: 'The recipe book is full for now.' };
  if (s.skus.some((k) => k.productId === productId && k.scentId === scentId && k.tier === tier)) {
    return { ok: false, reason: 'You already make that exact recipe.' };
  }
  if (!transact(game, -VARIANT_COST, 'Research & development', 'New recipe variant')) return { ok: false, reason: 'Not enough cash.' };
  const sku = makeSku(game.nextId('sku'), productId, scentId, tier);
  s.skus.push(sku);
  s.goods[sku.id] = 0;
  game.emit('skuCreated', sku);
  return { ok: true, sku };
}
