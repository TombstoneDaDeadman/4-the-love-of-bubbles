// Founder and helper: they physically walk between fixtures to start batches, stock shelves
// and pack orders. Labour is a real bottleneck in the home era.

import { POINTS } from '../data.js';
import { addGoods, goodsFree } from './inventory.js';
import { shipOrder } from './orders.js';

const WALK_SPEED = 1.75; // metres per sim-second

export function packTime(state, order) {
  const units = order.lines.reduce((a, l) => a + l.qty, 0);
  return (4.5 + units * 0.45) * (state.upgrades.packing ? 0.55 : 1);
}

function step(point, work, anim, action = null, carry = undefined) {
  return { point, work, anim, action, carry };
}

function taskStart(game, actor, st) {
  const s = game.state;
  const job = s.queue.shift();
  st.job = job; st.phase = 'prep'; st.claimedBy = actor.id; st.remaining = job.time;
  return {
    type: 'start', stationId: st.id, jobId: job.id, label: 'Starting a batch',
    steps: [step('pantry', 1.2, 'reach', null, 'crate'), step(`station${st.id}`, 3, 'work', 'startJob', null)],
  };
}
function taskCollect(actor, st) {
  st.claimedBy = actor.id;
  return {
    type: 'collect', stationId: st.id, jobId: st.job.id, label: 'Stocking finished goods',
    steps: [step(`station${st.id}`, 1.5, 'work', 'takeBatch', 'tray'), step('shelf', 1.2, 'reach', 'stockGoods', null)],
  };
}
function taskPack(game, actor, order) {
  order.status = 'packing'; order.claimedBy = actor.id;
  return {
    type: 'pack', orderId: order.id, label: `Packing ${order.customer}'s order`,
    steps: [step('shelf', 1.0, 'reach', null, 'products'), step('packing', packTime(game.state, order), 'work', 'shipOrder', null)],
  };
}

function chooseTask(game, actor) {
  const s = game.state;
  const queued = s.orders.filter((o) => o.status === 'queued').sort((a, b) => a.deadline - b.deadline);
  const done = s.stations.filter((st) => st.unlocked && st.phase === 'done' && !st.claimedBy);
  const collectable = done.find((st) => {
    st.blocked = goodsFree(s) < st.job.units;
    return !st.blocked;
  });
  if (actor.id === 'helper') {
    if (queued[0]) return taskPack(game, actor, queued[0]);
    if (collectable) return taskCollect(actor, collectable);
    return null;
  }
  if (queued[0] && queued[0].deadline - s.time.total < 40) return taskPack(game, actor, queued[0]);
  if (collectable) return taskCollect(actor, collectable);
  const idle = s.stations.find((st) => st.unlocked && st.phase === 'idle' && !st.claimedBy);
  if (idle && s.queue.length) return taskStart(game, actor, idle);
  if (queued[0]) return taskPack(game, actor, queued[0]);
  return null;
}

function taskStillValid(state, task) {
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

function runAction(game, actor, task, action) {
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
    game.emit('goodsStocked', { ...task.payload });
  } else if (action === 'shipOrder') {
    const order = s.orders.find((o) => o.id === task.orderId);
    if (order) shipOrder(game, order);
  }
}

function tickActor(game, actor, dt) {
  const s = game.state;
  if (actor.task && !taskStillValid(s, actor.task)) { actor.task = null; actor.carrying = null; }
  if (!actor.task) {
    const t = chooseTask(game, actor);
    if (t) { t.i = 0; t.timer = -1; actor.task = t; }
  }
  const task = actor.task;
  // Idle: drift back to a resting spot.
  const target = task ? POINTS[task.steps[task.i].point] : POINTS[actor.id === 'helper' ? 'rest2' : 'rest'];
  const dx = target.x - actor.x, dz = target.z - actor.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.03) {
    const mv = Math.min(dist, WALK_SPEED * dt);
    actor.x += (dx / dist) * mv; actor.z += (dz / dist) * mv;
    actor.face = Math.atan2(dx, dz);
    actor.anim = actor.carrying ? 'carry' : 'walk';
    return;
  }
  actor.face = target.face;
  if (!task) { actor.anim = 'idle'; return; }
  const st = task.steps[task.i];
  if (task.timer < 0) task.timer = st.work;
  actor.anim = st.anim;
  task.timer -= dt;
  task.progress = 1 - Math.max(0, task.timer) / st.work;
  if (task.timer <= 0) {
    if (st.action) runAction(game, actor, task, st.action);
    if (st.carry !== undefined) actor.carrying = st.carry;
    task.i += 1; task.timer = -1; task.progress = 0;
    if (task.i >= task.steps.length) { actor.task = null; actor.carrying = null; }
  }
}

export function tickWorkers(game, dt) {
  for (const actor of game.state.actors) tickActor(game, actor, dt);
}
