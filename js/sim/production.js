// ProductionService: the batch queue and workstation jobs.
//
// Documented rules (see tests):
//  * Ingredients are taken from inventory the moment a batch is queued.
//  * Cancelling a batch that is still waiting in the queue refunds 100% of its ingredients.
//  * Cancelling a batch that is already on a workstation wastes its ingredients.

import { getSku, batchNeeds, batchUnits, batchTime, removeIngredients, addIngredients, missingIngredients } from './inventory.js';
import { INGREDIENTS } from '../data.js';

export const MAX_QUEUE = 6;

export function queueBatch(game, skuId) {
  const s = game.state;
  const sku = getSku(s, skuId);
  if (!sku) return { ok: false, reason: 'Unknown recipe.' };
  if (s.queue.length >= MAX_QUEUE) return { ok: false, reason: 'The production queue is full.' };
  const needs = batchNeeds(s, sku);
  if (!removeIngredients(s, needs)) {
    const miss = missingIngredients(s, needs);
    const list = Object.entries(miss).map(([id, q]) => `${q} ${INGREDIENTS[id].name}`).join(', ');
    return { ok: false, reason: `Missing ${list}.`, missing: miss };
  }
  const job = { id: game.nextId('job'), skuId, units: batchUnits(s, sku), needs, time: batchTime(s, sku) };
  s.queue.push(job);
  game.emit('batchQueued', job);
  return { ok: true, job };
}

export function cancelJob(game, jobId) {
  const s = game.state;
  const qi = s.queue.findIndex((j) => j.id === jobId);
  if (qi >= 0) {
    const [job] = s.queue.splice(qi, 1);
    addIngredients(s, job.needs);
    game.emit('batchCancelled', { job, refunded: true });
    return { ok: true, refunded: true };
  }
  const st = s.stations.find((x) => x.job && x.job.id === jobId);
  if (st && st.phase !== 'done') {
    const job = st.job;
    st.job = null; st.phase = 'idle'; st.remaining = 0; st.claimedBy = null; st.blocked = false;
    game.emit('batchCancelled', { job, refunded: false });
    return { ok: true, refunded: false };
  }
  return { ok: false, reason: 'That batch can no longer be cancelled.' };
}

export function tickStations(game, dt) {
  for (const st of game.state.stations) {
    if (st.phase !== 'running') continue;
    st.remaining -= dt;
    if (st.remaining <= 0) {
      st.remaining = 0;
      st.phase = 'done';
      game.emit('batchDone', { station: st.id, job: st.job });
    }
  }
}

export function stationProgress(st) {
  if (!st.job) return 0;
  if (st.phase === 'done') return 1;
  if (st.phase !== 'running') return 0;
  return 1 - st.remaining / st.job.time;
}
