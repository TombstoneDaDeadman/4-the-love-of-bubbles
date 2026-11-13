// StaffService (brief §12), Milestone 3 "basic staff": hiring, dismissing, roles, daily wages,
// and what the founder and each role do in the store.
//
//   Founder     production and online packing in the back room; covers the till when there is
//               no cashier, and restocks displays when there is no sales associate.
//   Cashier     works the till.
//   Associate   restocks displays from back stock, then helps browsing shoppers.
//
// Staff tasks recover if their target disappears: a restock whose display is sold or reassigned
// returns the carried units to back stock.

import { STORE, STORE_POINTS, STAFF_ROLES, FURNITURE } from '../data.js';
import { transact, forceExpense } from './economy.js';
import { addGoods, removeGoods, getSku } from './inventory.js';
import { tickActor, step, productionWork, taskStart, taskCollect, taskPack, sharedValid, sharedAction, releaseTask } from './workers.js';
import { walkTo } from './path.js';
import { getFurniture, slotPoint } from './store.js';

export function staffRecord(state, id) { return state.store ? state.store.staff.find((x) => x.id === id) : null; }
export const roleOf = (state, actor) => (actor.id === 'founder' ? 'founder' : (staffRecord(state, actor.id) || {}).role || 'associate');
const hasRole = (state, role) => state.store.staff.some((x) => x.role === role);

// ---- Hiring -------------------------------------------------------------------------------

export function hireStaff(game, candId, role) {
  const s = game.state, st = s.store;
  if (!st) return { ok: false, reason: 'You need a store first.' };
  const cand = st.candidates.find((c) => c.id === candId);
  if (!cand) return { ok: false, reason: 'That candidate has taken another job.' };
  if (st.staff.length >= STORE.maxStaff) return { ok: false, reason: `The shop has room for ${STORE.maxStaff} staff for now.` };
  if (!STAFF_ROLES[role || cand.role]) return { ok: false, reason: 'Unknown role.' };
  if (!transact(game, -STORE.hireFee, 'Staff wages', `Hiring ${cand.name}`)) return { ok: false, reason: 'Not enough cash for the hiring costs.' };
  st.candidates.splice(st.candidates.indexOf(cand), 1);
  const rec = { ...cand, role: role || cand.role, hiredDay: s.time.day };
  st.staff.push(rec);
  const p = STORE_POINTS.backdoor;
  s.actors.push({ id: rec.id, x: p.x, z: p.z - 0.6, face: 0, task: null, anim: 'idle', carrying: null, path: null, pathKey: null, pathVer: -1 });
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
  if (actor) releaseStoreTask(game, actor);
  rec.role = role;
  game.emit('staffRole', rec);
  return { ok: true };
}

export function wagesPerDay(state) {
  return state.store ? state.store.staff.reduce((a, x) => a + x.wage, 0) : 0;
}
export function payWages(game) {
  for (const rec of game.state.store.staff) forceExpense(game, rec.wage, 'Staff wages', rec.name);
}

// ---- Store tasks ----------------------------------------------------------------------------

function taskTill() {
  return { type: 'till', label: 'At the till', noBar: true, idleT: 0, steps: [step('register', 1e9, 'work')] };
}

function restockTask(game, actor) {
  const s = game.state, st = s.store;
  let best = null, bestFill = Infinity;
  for (const fu of st.furniture) {
    const cap = FURNITURE[fu.type].slotCap;
    fu.slots.forEach((slot, k) => {
      if (!slot.skuId || slot.claimedBy || (s.goods[slot.skuId] || 0) <= 0) return;
      const fill = slot.stock / cap;
      if (fill < STORE.restockBelow && fill < bestFill) { bestFill = fill; best = { fu, k, slot }; }
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

function chooseStore(game, actor) {
  const s = game.state, st = s.store;
  const role = roleOf(s, actor);
  if (role === 'cashier') return taskTill();
  if (role === 'associate') return restockTask(game, actor) || helpTask(game, actor);
  // founder
  if (!hasRole(s, 'cashier') && st.queue.length) return taskTill();
  const w = productionWork(game);
  if (w.urgent) return taskPack(game, actor, w.urgent);
  if (w.collectable) return taskCollect(actor, w.collectable);
  if (w.idle) return taskStart(game, actor, w.idle);
  if (!hasRole(s, 'associate')) { const r = restockTask(game, actor); if (r) return r; }
  if (w.queued[0]) return taskPack(game, actor, w.queued[0]);
  return null;
}

function validStore(state, task, actor) {
  const st = state.store;
  if (task.type === 'till') {
    const role = roleOf(state, actor);
    if (role === 'cashier') return true;
    return role === 'founder' && !hasRole(state, 'cashier') && task.idleT < 2.5;
  }
  if (task.type === 'restock') {
    const fu = getFurniture(state, task.fid);
    return !!fu && !!fu.slots[task.slot] && fu.slots[task.slot].skuId === task.skuId;
  }
  if (task.type === 'help') return st.customers.some((c) => c.id === task.custId && c.state !== 'leave' && c.state !== 'queue' && c.state !== 'paying');
  return sharedValid(state, task);
}

function actionStore(game, actor, task, name) {
  const s = game.state;
  if (name === 'pickStock') {
    const fu = getFurniture(s, task.fid), slot = fu.slots[task.slot];
    const qty = Math.min(FURNITURE[fu.type].slotCap - slot.stock, s.goods[task.skuId] || 0);
    if (qty <= 0 || !removeGoods(s, task.skuId, qty)) { slot.claimedBy = null; actor.task = null; actor.carrying = null; return; }
    task.payload = { skuId: task.skuId, units: qty };
  } else if (name === 'fillSlot') {
    const fu = getFurniture(s, task.fid), slot = fu.slots[task.slot];
    const n = Math.min(task.payload.units, FURNITURE[fu.type].slotCap - slot.stock);
    slot.stock += n;
    if (task.payload.units > n) addGoods(s, task.skuId, task.payload.units - n);
    task.payload = null;
    slot.claimedBy = null;
    game.emit('displayRestocked', { fid: fu.id, slot: task.slot, units: n });
  } else if (name === 'helpShopper') {
    const c = s.store.customers.find((x) => x.id === task.custId);
    const rec = staffRecord(s, actor.id);
    if (c) {
      c.helped = true; c.helperId = null;
      c.mood += 6 + ((rec ? rec.service : 1) - 1) * 12;
      s.store.stats.helped += 1;
      game.emit('shopperThought', { id: c.id, kind: 'helped' });
    }
  } else sharedAction(game, actor, task, name);
}

// Abandon a task safely (store-era version of releaseTask).
export function releaseStoreTask(game, actor) {
  const s = game.state, task = actor.task;
  if (task && task.type === 'restock') {
    const fu = getFurniture(s, task.fid);
    if (fu && fu.slots[task.slot] && fu.slots[task.slot].claimedBy === actor.id) fu.slots[task.slot].claimedBy = null;
    if (task.payload) addGoods(s, task.payload.skuId, task.payload.units);
    actor.task = null; actor.carrying = null;
    return;
  }
  if (task && task.type === 'help') {
    const c = s.store.customers.find((x) => x.id === task.custId);
    if (c && c.helperId === actor.id) c.helperId = null;
    actor.task = null; actor.carrying = null;
    return;
  }
  releaseTask(game, actor);
}

const STORE_HOOKS = {
  choose: chooseStore,
  valid: validStore,
  action: actionStore,
  point: (state, p) => (typeof p === 'string' ? STORE_POINTS[p] : p),
  rest: (actor) => (actor.id === 'founder' ? 'rest' : null),
  move: (game, actor, target, dt) => walkTo(game.state.store, actor, target.x, target.z, dt, STORE.staffSpeed * speedOf(game.state, actor)),
  speed: (actor) => 1,
  onInvalid: releaseStoreTask,
};
function speedOf(state, actor) { const r = staffRecord(state, actor.id); return r ? r.speed : 1; }

export function tickStoreStaff(game, dt) {
  const s = game.state, st = s.store;
  for (const actor of s.actors) {
    const task = actor.task;
    // Keep a restock heading for the display's current spot if it was moved.
    if (task && task.type === 'restock' && task.ver !== st.layoutVer && getFurniture(s, task.fid)) {
      const fu = getFurniture(s, task.fid);
      const pt = slotPoint(s, fu, task.slot, actor.x, actor.z);
      if (pt) { task.steps[1].point = pt; task.ver = st.layoutVer; }
    }
    if (task && task.type === 'till') task.idleT = st.queue.length ? 0 : task.idleT + dt;
    const role = roleOf(s, actor);
    const hooks = role === 'founder' ? STORE_HOOKS : { ...STORE_HOOKS, rest: () => (role === 'cashier' ? 'register' : 'floor'), speed: () => speedOf(s, actor) };
    tickActor(game, actor, dt, hooks);
  }
  // Who is standing at the till right now?
  const at = s.actors.find((a) => a.task && a.task.type === 'till' && a.task.timer >= 0);
  st.till = at ? at.id : null;
}
