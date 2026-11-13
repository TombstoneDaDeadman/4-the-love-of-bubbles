// Founder, helper and staff: they physically walk between fixtures to start batches, stock
// shelves and pack orders. Labour is a real bottleneck in the home era.
//
// The task runner (tickActor) is shared by both eras. Each era supplies hooks: how to choose a
// task, whether a task is still valid, what each action does, and how to walk (straight lines in
// the kitchen, grid pathfinding in the store).

import { POINTS } from '../data.js';
import { addGoods, goodsFree } from './inventory.js';
import { shipOrder } from './orders.js';

const WALK_SPEED = 1.75; // metres per sim-second

export function packTime(state, order) {
  const units = order.lines.reduce((a, l) => a + l.qty, 0);
  return (4.5 + units * 0.45) * (state.upgrades.packing ? 0.55 : 1);
}

export function step(point, work, anim, action = null, carry = undefined) {
  return { point, work, anim, action, carry };
}

// ---- Shared production / packing tasks (both eras) --------------------------------

export function taskStart(game, actor, st) {
  const s = game.state;
  const job = s.queue.shift();
  st.job = job; st.phase = 'prep'; st.claimedBy = actor.id; st.remaining = job.time;
  return {
    type: 'start', stationId: st.id, jobId: job.id, label: 'Starting a batch',
    steps: [step('pantry', 1.2, 'reach', null, 'crate'), step(`station${st.id}`, 3, 'work', 'startJob', null)],
  };
}
export function taskCollect(actor, st) {
  st.claimedBy = actor.id;
  return {
    type: 'collect', stationId: st.id, jobId: st.job.id, label: 'Stocking finished goods',
    steps: [step(`station${st.id}`, 1.5, 'work', 'takeBatch', 'tray'), step('shelf', 1.2, 'reach', 'stockGoods', null)],
  };
}
export function taskPack(game, actor, order) {
  order.status = 'packing'; order.claimedBy = actor.id;
  return {
    type: 'pack', orderId: order.id, label: `Packing ${order.customer}'s order`,
    steps: [step('shelf', 1.0, 'reach', null, 'products'), step('packing', packTime(game.state, order), 'work', 'shipOrder', null)],
  };
}

// Work the founder (and the home helper) can pick up. Returns the candidate tasks in the order
// the home era prioritises them, so the store era can slot its own work in between.
export function productionWork(game) {
  const s = game.state;
  const queued = s.orders.filter((o) => o.status === 'queued').sort((a, b) => a.deadline - b.deadline);
  const done = s.stations.filter((st) => st.unlocked && st.phase === 'done' && !st.claimedBy);
  const collectable = done.find((st) => {
    st.blocked = goodsFree(s) < st.job.units;
    return !st.blocked;
  });
  const idle = s.stations.find((st) => st.unlocked && st.phase === 'idle' && !st.claimedBy);
  return { queued, collectable, idle: idle && s.queue.length ? idle : null, urgent: queued[0] && queued[0].deadline - s.time.total < 40 ? queued[0] : null };
}

export function sharedValid(state, task) {
  if (task.type === 'start') {
    const st = state.stations[task.stationId];
    return st.job && st.job.id === task.jobId;
  }
  if (task.type === 'collect') {
    if (task.payload) return true; // already carrying the batch
    const st = state.stations[task.stationId];
    return st.job && st.job.id === task.jobId;
  }
  if (task.type === 'pack') return state.orders.some((o) => o.id === task.orderId);
  return true;
}

export function sharedAction(game, actor, task, action) {
  const s = game.state;
  if (action === 'startJob') {
    const st = s.stations[task.stationId];
    st.phase = 'running'; st.remaining = st.job.time; st.claimedBy = null;
    game.emit('batchStarted', { station: st.id, job: st.job });
  } else if (action === 'takeBatch') {
    const st = s.stations[task.stationId];
    task.payload = { skuId: st.job.skuId, units: st.job.units };
    st.job = null; st.phase = 'idle'; st.remaining = 0; st.claimedBy = null; st.blocked = false;
  } else if (action === 'stockGoods') {
    addGoods(s, task.payload.skuId, task.payload.units);
    s.stats.unitsMade += task.payload.units;
    s.stats.batches += 1;
    const sku = s.skus.find((k) => k.id === task.payload.skuId);
    if (sku) sku.made += task.payload.units;
    const stocked = { ...task.payload };
    task.payload = null;
    game.emit('goodsStocked', stocked);
  } else if (action === 'shipOrder') {
    const order = s.orders.find((o) => o.id === task.orderId);
    if (order) shipOrder(game, order);
  } else return false;
  return true;
}

// Put the world back the way it was if an actor abandons a task half-way (the actor was
// dismissed, the era changed, or the target vanished). Nothing is ever lost or duplicated.
export function releaseTask(game, actor) {
  const s = game.state, task = actor.task;
  actor.task = null; actor.carrying = null; actor.path = null;
  if (!task) return;
  if (task.type === 'start') {
    const st = s.stations[task.stationId];
    if (st && st.job && st.job.id === task.jobId && st.phase === 'prep') {
      s.queue.unshift(st.job);
      st.job = null; st.phase = 'idle'; st.remaining = 0; st.claimedBy = null;
    }
  } else if (task.type === 'collect') {
    if (task.payload) {
      addGoods(s, task.payload.skuId, task.payload.units);
      s.stats.unitsMade += task.payload.units; s.stats.batches += 1;
      const sku = s.skus.find((k) => k.id === task.payload.skuId);
      if (sku) sku.made += task.payload.units;
    } else {
      const st = s.stations[task.stationId];
      if (st && st.claimedBy === actor.id) st.claimedBy = null;
    }
  } else if (task.type === 'pack') {
    const o = s.orders.find((x) => x.id === task.orderId);
    if (o && o.status === 'packing') { o.status = 'queued'; o.claimedBy = null; }
  }
  return task;
}

// ---- The task runner -----------------------------------------------------------------

// hooks: { choose(game, actor), valid(state, task, actor), action(game, actor, task, name),
//          point(state, step|name), rest(actor), move(game, actor, target, dt) -> arrived,
//          speed(actor), onInvalid(game, actor) }
export function tickActor(game, actor, dt, hooks) {
  const s = game.state;
  if (actor.task && !hooks.valid(s, actor.task, actor)) hooks.onInvalid(game, actor);
  if (!actor.task) {
    const t = hooks.choose(game, actor);
    if (t) { t.i = 0; t.timer = -1; actor.task = t; }
  }
  const task = actor.task;
  const target = task ? hooks.point(s, task.steps[task.i].point) : hooks.point(s, hooks.rest(actor));
  if (!hooks.move(game, actor, target, dt)) {
    actor.anim = actor.carrying ? 'carry' : 'walk';
    return;
  }
  actor.face = target.face;
  if (!task) { actor.anim = 'idle'; return; }
  const st = task.steps[task.i];
  if (task.timer < 0) task.timer = st.work;
  actor.anim = st.anim;
  task.timer -= dt * hooks.speed(actor);
  task.progress = 1 - Math.max(0, task.timer) / st.work;
  if (task.timer <= 0) {
    if (st.action) hooks.action(game, actor, task, st.action);
    if (actor.task !== task) return; // the action ended or replaced the task
    if (st.carry !== undefined) actor.carrying = st.carry;
    task.i += 1; task.timer = -1; task.progress = 0;
    if (task.i >= task.steps.length) { actor.task = null; actor.carrying = null; }
  }
}

// ---- Home era ----------------------------------------------------------------------

function chooseHome(game, actor) {
  const w = productionWork(game);
  if (actor.id === 'helper') {
    if (w.queued[0]) return taskPack(game, actor, w.queued[0]);
    if (w.collectable) return taskCollect(actor, w.collectable);
    return null;
  }
  if (w.urgent) return taskPack(game, actor, w.urgent);
  if (w.collectable) return taskCollect(actor, w.collectable);
  if (w.idle) return taskStart(game, actor, w.idle);
  if (w.queued[0]) return taskPack(game, actor, w.queued[0]);
  return null;
}

function moveStraight(game, actor, target, dt) {
  const dx = target.x - actor.x, dz = target.z - actor.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= 0.03) return true;
  const mv = Math.min(dist, WALK_SPEED * dt);
  actor.x += (dx / dist) * mv; actor.z += (dz / dist) * mv;
  actor.face = Math.atan2(dx, dz);
  return false;
}

const HOME_HOOKS = {
  choose: chooseHome,
  valid: (state, task) => sharedValid(state, task),
  action: (game, actor, task, name) => sharedAction(game, actor, task, name),
  point: (state, p) => (typeof p === 'string' ? POINTS[p] : p),
  rest: (actor) => (actor.id === 'helper' ? 'rest2' : 'rest'),
  move: moveStraight,
  speed: () => 1,
  onInvalid: (game, actor) => { actor.task = null; actor.carrying = null; },
};

export function tickWorkers(game, dt) {
  for (const actor of game.state.actors) tickActor(game, actor, dt, HOME_HOOKS);
}
