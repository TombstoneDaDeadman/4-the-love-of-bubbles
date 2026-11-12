// Game container: owns the live state, a seeded RNG, and an event bus.
// All simulation modules are plain functions that take a Game. No DOM, no rendering.

import { SAVE_VERSION, START_CASH, START_INGREDIENTS, STARTER_SKUS, POINTS, PRODUCTS, SCENTS, TIERS } from '../data.js';

export class Game {
  constructor(state) {
    this.state = state;
    this.listeners = new Map();
  }
  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt).push(fn);
    return this;
  }
  emit(evt, data) {
    const ls = this.listeners.get(evt);
    if (ls) for (const fn of ls) fn(data);
    const all = this.listeners.get('*');
    if (all) for (const fn of all) fn(evt, data);
  }
  // mulberry32, seed stored in state so saves and tests are deterministic
  rand() {
    const s = this.state;
    s.seed = (s.seed + 0x6d2b79f5) | 0;
    let t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  randInt(a, b) { return a + Math.floor(this.rand() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }
  nextId(prefix) {
    const s = this.state;
    s.nextId += 1;
    return `${prefix}${s.nextId}`;
  }
}

export function skuDisplayName(productId, scentId, tier) {
  const p = PRODUCTS[productId], sc = SCENTS[scentId], t = TIERS[tier];
  const tierWord = tier === 0 ? '' : `${t.name} `;
  return `${tierWord}${sc.name} ${p.name}`;
}

export function makeSku(id, productId, scentId, tier) {
  return {
    id, productId, scentId, tier,
    name: skuDisplayName(productId, scentId, tier),
    price: Math.round(PRODUCTS[productId].basePrice * TIERS[tier].priceMult),
    paused: false, sold: 0, made: 0, ratingSum: 0, ratingCount: 0,
  };
}

export function newActor(id, point) {
  const p = POINTS[point];
  return { id, x: p.x, z: p.z, face: p.face, task: null, anim: 'idle', carrying: null };
}

export function newGameState(founder = {}, seed = (Date.now() & 0x7fffffff)) {
  const state = {
    version: SAVE_VERSION,
    era: 'home',
    seed,
    nextId: 0,
    founder: { name: 'Founder', skin: 3, hairStyle: 'bun', hairColor: 1, outfit: 0, ...founder },
    time: { day: 1, t: 0, total: 0, speed: 1, paused: false },
    cash: 0,
    ledger: { sum: 0, entries: [], lifetime: {}, today: { revenue: 0, expenses: 0, cats: {} }, days: [] },
    ingredients: { ...START_INGREDIENTS },
    deliveries: [],
    goods: {},
    skus: [],
    stations: [
      { id: 0, unlocked: true, phase: 'idle', job: null, remaining: 0, claimedBy: null, blocked: false },
      { id: 1, unlocked: false, phase: 'idle', job: null, remaining: 0, claimedBy: null, blocked: false },
    ],
    queue: [],
    orders: [],
    orderTimer: 30,
    missedDemand: 0,
    stats: { ordersFulfilled: 0, ordersExpired: 0, onTime: 0, revenue: 0, unitsMade: 0, unitsSold: 0, batches: 0 },
    reviews: [],
    reputation: 3.6,
    soul: 82,
    upgrades: {},
    marketing: { active: [], cooldowns: {} },
    settings: { autoFulfill: false },
    actors: [newActor('founder', 'rest')],
    milestone: { outgrown: false, leaseSigned: false },
    tutorial: { step: 0, done: false },
  };
  STARTER_SKUS.forEach((s, i) => {
    const sku = makeSku(`sku${i + 1}`, s.productId, s.scentId, s.tier);
    state.skus.push(sku);
    state.goods[sku.id] = 0;
  });
  state.nextId = 10;
  // Opening balance goes through the ledger like every other money movement.
  state.cash = START_CASH;
  state.ledger.sum = START_CASH;
  state.ledger.entries.push({ day: 1, t: 0, amount: START_CASH, cat: 'Opening balance', note: 'Savings to start the business' });
  return state;
}
