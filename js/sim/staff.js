// StaffService (brief §12): hiring, dismissing, roles, shifts, training, wages and experience,
// and what the founder and each role do in the store.
//
//   Founder            production and online packing in the back room; covers the till when no
//                      cashier is on shift, and restocks when no associate or stocker is.
//   Cashier            works the till.
//   Sales Associate    restocks urgent displays, helps browsing shoppers, then restocks and tidies.
//   Stocker            keeps displays full, then tidies spills and mops.
//   Production Worker  runs the stations and packs online orders.
//
// Staff tasks recover if their target disappears: a restock whose display is sold or reassigned
// returns the carried units to back stock; a tidy-up whose mess is gone simply ends.

import { STORE, STORE_POINTS, STAFF_ROLES, FURNITURE, SHIFTS, DAY_LENGTH, STORE_ROWS, STORE_GRID } from '../data.js';
import { transact, forceExpense } from './economy.js';
import { addGoods, removeGoods, getSku } from './inventory.js';
import { tickActor, step, productionWork, taskStart, taskCollect, taskPack, sharedValid, sharedAction, releaseTask } from './workers.js';
import { walkTo, cellCenter, walkGrid, isWalkable } from './path.js';
import { getFurniture, slotPoint } from './store.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = (v) => Math.round(v * 100) / 100;

export function staffRecord(state, id) { return state.store ? state.store.staff.find((x) => x.id === id) : null; }
export const roleOf = (state, actor) => (actor.id === 'founder' ? 'founder' : (staffRecord(state, actor.id) || {}).role || 'associate');

export function onShift(state, rec) {
  const sh = SHIFTS[rec.shift || 'full'], d = state.time.t / DAY_LENGTH;
  return d >= sh.from && d < sh.to;
}
// Someone in this role is working right now (on shift, not off training).
const covered = (state, role) => state.store.staff.some((x) => x.role === role && onShift(state, x) && !x.training);

// ---- Hiring and HR -------------------------------------------------------------------------

export function hireStaff(game, candId, role) {
  const s = game.state, st = s.store;
  if (!st) return { ok: false, reason: 'You need a store first.' };
  const cand = st.candidates.find((c) => c.id === candId);
  if (!cand) return { ok: false, reason: 'That candidate has taken another job.' };
  if (st.staff.length >= STORE.maxStaff) return { ok: false, reason: `The shop has room for ${STORE.maxStaff} staff for now.` };
  if (!STAFF_ROLES[role || cand.role]) return { ok: false, reason: 'Unknown role.' };
  if (!transact(game, -STORE.hireFee, 'Staff wages', `Hiring ${cand.name}`)) return { ok: false, reason: 'Not enough cash for the hiring costs.' };
  st.candidates.splice(st.candidates.indexOf(cand), 1);
  const rec = { shift: 'full', xp: 0, trained: 0, ...cand, role: role || cand.role, hiredDay: s.time.day };
  st.staff.push(rec);
  const p = STORE_POINTS.backdoor;
  s.actors.push({ id: rec.id, x: p.x, z: p.z - 0.6, face: 0, task: null, anim: 'idle', carrying: null, path: null, pathKey: null, pathVer: -1, away: false });
  game.emit('staffHired', rec);
  return { ok: true, staff: rec };
}

export function fireStaff(game, id) {
  const s = game.state, st = s.store;
  const rec = staffRecord(s, id);
  if (!rec) return { ok: false, reason: 'No such employee.' };
  const actor = s.actors.find((a) => a.id === id);
  if (actor) releaseStoreTask(game, actor);
  st.staff.splice(st.staff.indexOf(rec), 1);
  s.actors = s.actors.filter((a) => a.id !== id);
  if (st.till === id) st.till = null;
  game.emit('staffLeft', rec);
  return { ok: true };
}

export function setStaffRole(game, id, role) {
  const s = game.state, rec = staffRecord(s, id);
  if (!rec || !STAFF_ROLES[role]) return { ok: false, reason: 'Unknown role.' };
  if (rec.role === role) return { ok: true };
  const actor = s.actors.find((a) => a.id === id);
  if (actor && !rec.training) releaseStoreTask(game, actor);
  rec.role = role;
  game.emit('staffRole', rec);
  return { ok: true };
}

export function setShift(game, id, shift) {
  const rec = staffRecord(game.state, id);
  if (!rec || !SHIFTS[shift]) return { ok: false, reason: 'Unknown shift.' };
  rec.shift = shift;
  game.emit('staffShift', rec);
  return { ok: true };
}

// Send someone to the office laptop for a short course. Costs money and their time on the floor;
// the skill gain is permanent.
export function trainStaff(game, id, skill) {
  const s = game.state, rec = staffRecord(s, id);
  if (!rec) return { ok: false, reason: 'No such employee.' };
  if (skill !== 'speed' && skill !== 'service') return { ok: false, reason: 'Unknown skill.' };
  if (rec.training) return { ok: false, reason: `${rec.name} is already training.` };
  if (!onShift(s, rec)) return { ok: false, reason: `${rec.name} is not on shift right now.` };
  if (rec[skill] >= STORE.statCap) return { ok: false, reason: `${rec.name} has mastered that.` };
  if (!transact(game, -STORE.trainCost, 'Staff training', `${rec.name}: ${skill}`)) return { ok: false, reason: 'Not enough cash.' };
  rec.training = skill;
  const actor = s.actors.find((a) => a.id === id);
  if (actor) {
    releaseStoreTask(game, actor);
    actor.task = { type: 'train', label: 'Training', i: 0, timer: -1, steps: [step('desk', STORE.trainTime, 'work', 'finishTraining')] };
  }
  game.emit('staffTraining', rec);
  return { ok: true };
}

export function wageToday(rec) { return Math.round(rec.wage * SHIFTS[rec.shift || 'full'].pay); }
export function wagesPerDay(state) {
  return state.store ? state.store.staff.reduce((a, x) => a + wageToday(x), 0) : 0;
}
// Closing time: pay everyone, and a day's work is a day's experience (every 3 days, a little better).
export function payWages(game) {
  for (const rec of game.state.store.staff) {
    forceExpense(game, wageToday(rec), 'Staff wages', rec.name);
    rec.xp = (rec.xp || 0) + 1;
    if (rec.xp % 3 === 0) {
      rec.speed = r2(Math.min(STORE.statCap, rec.speed + 0.02));
      rec.service = r2(Math.min(STORE.statCap, rec.service + 0.02));
    }
  }
}

// ---- Store tasks ----------------------------------------------------------------------------

function taskTill() {
  return { type: 'till', label: 'At the till', noBar: true, idleT: 0, steps: [step('register', 1e9, 'work')] };
}

// A display needs refilling when it drops below its own threshold, or when the player asked for
// it (rush). Rushed slots go first.
export function needsRestock(state, slot, cap) {
  if (!slot.skuId || slot.claimedBy || (state.goods[slot.skuId] || 0) <= 0 || slot.stock >= cap) return false;
  return slot.rush || slot.stock / cap < (slot.refill ?? STORE.restockBelow);
}

function restockTask(game, actor, rushOnly = false) {
  const s = game.state, st = s.store;
  let best = null, bestScore = Infinity;
  for (const fu of st.furniture) {
    const cap = FURNITURE[fu.type].slotCap;
    fu.slots.forEach((slot, k) => {
      if (!needsRestock(s, slot, cap) || (rushOnly && !slot.rush)) return;
      const score = slot.stock / cap - (slot.rush ? 10 : 0);
      if (score < bestScore) { bestScore = score; best = { fu, k, slot }; }
    });
  }
  if (!best) return null;
  const from = STORE_POINTS.shelf;
  const pt = slotPoint(s, best.fu, best.k, from.x, from.z);
  if (!pt) return null;
  best.slot.claimedBy = actor.id;
  const sku = getSku(s, best.slot.skuId);
  return {
    type: 'restock', fid: best.fu.id, slot: best.k, skuId: best.slot.skuId, ver: st.layoutVer,
    label: `Restocking ${sku ? sku.name : 'a display'}`,
    steps: [step('shelf', 1.0, 'reach', 'pickStock', 'products'), step(pt, 1.8, 'reach', 'fillSlot', null)],
  };
}

function helpTask(game, actor) {
  const st = game.state.store;
  let best = null, bd = Infinity;
  for (const c of st.customers) {
    if (c.helped || c.helperId || (c.state !== 'browse' && c.state !== 'walk') || !c.target) continue;
    const d = Math.hypot(c.x - actor.x, c.z - actor.z);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best || bd > 9) return null;
  best.helperId = actor.id;
  const t = best.target;
  const pt = { x: t.x + 0.55 * Math.cos(t.face), z: t.z - 0.55 * Math.sin(t.face), face: t.face };
  return { type: 'help', custId: best.id, label: `Helping ${best.name}`, steps: [step(pt, 2.2, 'wave', 'helpShopper', null)] };
}

function tidyTask(game, actor) {
  const st = game.state.store;
  let best = null, bd = Infinity;
  for (const m of st.messes) {
    if (m.claimedBy) continue;
    const d = Math.hypot(m.x - actor.x, m.z - actor.z);
    if (d < bd) { bd = d; best = m; }
  }
  if (best) {
    best.claimedBy = actor.id;
    return { type: 'tidy', messId: best.id, label: 'Tidying a spill', steps: [step({ x: best.x, z: best.z + 0.35, face: Math.PI }, 2.5, 'work', 'tidy', null)] };
  }
  // No spills: give the floor a mop if it needs one (one mop at a time).
  if (st.clean < 85 && !game.state.actors.some((a) => a.task && a.task.type === 'mop')) {
    const walk = walkGrid(st);
    for (let n = 0; n < 6; n++) {
      const i = game.randInt(1, STORE_GRID.cols - 2), j = game.randInt(STORE_ROWS.floor[0] + 1, STORE_ROWS.floor[1] - 1);
      if (!isWalkable(walk, i, j)) continue;
      const p = cellCenter(i, j);
      return { type: 'mop', label: 'Mopping the floor', steps: [step({ x: p.x, z: p.z, face: game.rand() * 6 }, 4, 'work', 'mop')] };
    }
  }
  return null;
}

function makerTask(game, actor) {
  const w = productionWork(game);
  if (w.urgent) return taskPack(game, actor, w.urgent);
  if (w.collectable) return taskCollect(actor, w.collectable);
  if (w.idle) return taskStart(game, actor, w.idle);
  if (w.queued[0]) return taskPack(game, actor, w.queued[0]);
  return null;
}

function chooseStore(game, actor) {
  const s = game.state, st = s.store;
  const role = roleOf(s, actor);
  if (role === 'cashier') return taskTill();
  if (role === 'associate') return restockTask(game, actor) || (st.messes.length >= 3 && tidyTask(game, actor)) || helpTask(game, actor) || tidyTask(game, actor);
  if (role === 'stocker') return restockTask(game, actor) || tidyTask(game, actor);
  if (role === 'maker') return makerTask(game, actor);
  // founder
  if (!covered(s, 'cashier') && st.queue.length) return taskTill();
  const shopCovered = covered(s, 'associate') || covered(s, 'stocker');
  if (!shopCovered) { const r = restockTask(game, actor, true); if (r) return r; }
  const w = productionWork(game);
  if (w.urgent) return taskPack(game, actor, w.urgent);
  if (w.collectable) return taskCollect(actor, w.collectable);
  if (w.idle) return taskStart(game, actor, w.idle);
  if (!shopCovered) { const r = restockTask(game, actor); if (r) return r; }
  if (w.queued[0]) return taskPack(game, actor, w.queued[0]);
  return null;
}

function validStore(state, task, actor) {
  const st = state.store;
  if (task.type === 'train') return !!staffRecord(state, actor.id);
  if (task.type === 'till') {
    const role = roleOf(state, actor);
    if (role === 'cashier') return true;
    return role === 'founder' && !covered(state, 'cashier') && task.idleT < 2.5;
  }
  if (task.type === 'restock') {
    const fu = getFurniture(state, task.fid);
    return !!fu && !!fu.slots[task.slot] && fu.slots[task.slot].skuId === task.skuId;
  }
  if (task.type === 'help') return st.customers.some((c) => c.id === task.custId && c.state !== 'leave' && c.state !== 'queue' && c.state !== 'paying');
  if (task.type === 'tidy') return st.messes.some((m) => m.id === task.messId);
  if (task.type === 'mop') return true;
  return sharedValid(state, task);
}

function actionStore(game, actor, task, name) {
  const s = game.state, st = s.store;
  const rec = staffRecord(s, actor.id);
  if (name === 'pickStock') {
    const fu = getFurniture(s, task.fid), slot = fu.slots[task.slot];
    const qty = Math.min(FURNITURE[fu.type].slotCap - slot.stock, s.goods[task.skuId] || 0);
    if (qty <= 0 || !removeGoods(s, task.skuId, qty)) { slot.claimedBy = null; slot.rush = false; actor.task = null; actor.carrying = null; return; }
    task.payload = { skuId: task.skuId, units: qty };
  } else if (name === 'fillSlot') {
    const fu = getFurniture(s, task.fid), slot = fu.slots[task.slot];
    const n = Math.min(task.payload.units, FURNITURE[fu.type].slotCap - slot.stock);
    slot.stock += n;
    if (task.payload.units > n) addGoods(s, task.skuId, task.payload.units - n);
    task.payload = null;
    slot.claimedBy = null; slot.rush = false;
    game.emit('displayRestocked', { fid: fu.id, slot: task.slot, units: n });
  } else if (name === 'helpShopper') {
    const c = st.customers.find((x) => x.id === task.custId);
    if (c) {
      c.helped = true; c.helperId = null;
      c.mood += 6 + ((rec ? rec.service : 1) - 1) * 12;
      st.stats.helped += 1;
      game.emit('shopperThought', { id: c.id, kind: 'helped' });
    }
  } else if (name === 'tidy') {
    const k = st.messes.findIndex((m) => m.id === task.messId);
    if (k >= 0) { st.messes.splice(k, 1); st.clean = clamp(st.clean + 1, 0, 100); game.emit('tidied', { x: actor.x, z: actor.z }); }
  } else if (name === 'mop') {
    st.clean = clamp(st.clean + 5 * (rec ? rec.speed : 1), 0, 100);
  } else if (name === 'finishTraining') {
    if (rec && rec.training) {
      const skill = rec.training;
      rec[skill] = r2(Math.min(STORE.statCap, rec[skill] + 0.12));
      rec.trained = (rec.trained || 0) + 1;
      rec.training = null;
      game.emit('staffTrained', { rec, skill });
    }
  } else sharedAction(game, actor, task, name);
}

// Abandon a task safely (store-era version of releaseTask).
export function releaseStoreTask(game, actor) {
  const s = game.state, task = actor.task;
  const done = () => { actor.task = null; actor.carrying = null; };
  if (!task) return releaseTask(game, actor);
  if (task.type === 'restock') {
    const fu = getFurniture(s, task.fid);
    if (fu && fu.slots[task.slot] && fu.slots[task.slot].claimedBy === actor.id) fu.slots[task.slot].claimedBy = null;
    if (task.payload) addGoods(s, task.payload.skuId, task.payload.units);
    return done();
  }
  if (task.type === 'help') {
    const c = s.store.customers.find((x) => x.id === task.custId);
    if (c && c.helperId === actor.id) c.helperId = null;
    return done();
  }
  if (task.type === 'tidy') {
    const m = s.store.messes.find((x) => x.id === task.messId);
    if (m && m.claimedBy === actor.id) m.claimedBy = null;
    return done();
  }
  if (task.type === 'train') {
    // Leaving mid-course (dismissed, or the day ended) refunds nothing but frees them up.
    const rec = staffRecord(s, actor.id);
    if (rec) rec.training = null;
    return done();
  }
  if (task.type === 'mop' || task.type === 'till') return done();
  releaseTask(game, actor);
}

function speedOf(state, actor) { const r = staffRecord(state, actor.id); return r ? r.speed : 1; }

const STORE_HOOKS = {
  choose: chooseStore,
  valid: validStore,
  action: actionStore,
  point: (state, p) => (typeof p === 'string' ? STORE_POINTS[p] : p),
  rest: () => 'rest',
  move: (game, actor, target, dt) => walkTo(game.state.store, actor, target.x, target.z, dt, STORE.staffSpeed * speedOf(game.state, actor)),
  speed: () => 1,
  onInvalid: releaseStoreTask,
};
const REST = { cashier: 'register', associate: 'floor', stocker: 'floor', maker: 'rest2' };

export function tickStoreStaff(game, dt) {
  const s = game.state, st = s.store;
  for (const actor of s.actors) {
    const rec = staffRecord(s, actor.id);
    // Off shift: head to the staff room and clock out (training runs to the end of the course).
    if (rec && !onShift(s, rec) && !rec.training) {
      if (actor.task) releaseStoreTask(game, actor);
      if (!actor.away) {
        const p = STORE_POINTS.staffroom;
        actor.anim = 'walk';
        if (walkTo(st, actor, p.x, p.z, dt, STORE.staffSpeed * rec.speed)) { actor.away = true; actor.anim = 'idle'; }
      }
      continue;
    }
    if (actor.away) actor.away = false;
    const task = actor.task;
    // Keep a restock heading for the display's current spot if it was moved.
    if (task && task.type === 'restock' && task.ver !== st.layoutVer && getFurniture(s, task.fid)) {
      const fu = getFurniture(s, task.fid);
      const pt = slotPoint(s, fu, task.slot, actor.x, actor.z);
      if (pt) { task.steps[1].point = pt; task.ver = st.layoutVer; }
    }
    if (task && task.type === 'till') task.idleT = st.queue.length ? 0 : task.idleT + dt;
    const hooks = rec ? { ...STORE_HOOKS, rest: () => REST[rec.role] || 'floor', speed: () => rec.speed } : STORE_HOOKS;
    tickActor(game, actor, dt, hooks);
  }
  // Who is standing at the till right now?
  const at = s.actors.find((a) => a.task && a.task.type === 'till' && a.task.timer >= 0);
  st.till = at ? at.id : null;
}
