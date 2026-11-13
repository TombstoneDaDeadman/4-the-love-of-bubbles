// Upgrades, marketing, progression goals, and the master simulation tick (TimeService).

import { UPGRADES, CAMPAIGNS, HOME_GOALS, DAY_LENGTH, DAY_START_MIN, DAY_END_MIN, DAILY_UTILITIES, STORE, CHAIN } from '../data.js';
import { transact, forceExpense, closeDay } from './economy.js';
import { tickDeliveries, goodsTotal, goodsCap } from './inventory.js';
import { tickStations } from './production.js';
import { tickOrders } from './orders.js';
import { tickWorkers } from './workers.js';
import { newActor } from './core.js';
import { tickStore, closeStoreDay, refreshCandidates, storeRent } from './store.js';
import { tickStoreStaff, payWages } from './staff.js';
import { storeIds, currentId, swapTo, tickTransfers, tickExpansion, managerReorder } from './chain.js';

// ---- Upgrades -------------------------------------------------------------

export function buyUpgrade(game, id) {
  const s = game.state, u = UPGRADES[id];
  if (!u) return { ok: false, reason: 'Unknown upgrade.' };
  if (s.upgrades[id]) return { ok: false, reason: 'Already owned.' };
  if (id === 'helper' && s.era === 'store') return { ok: false, reason: 'Hire staff from the Staff panel instead.' };
  if (!transact(game, -u.cost, id === 'helper' ? 'Staff wages' : 'Equipment', u.name)) return { ok: false, reason: 'Not enough cash.' };
  s.upgrades[id] = true;
  if (id === 'station2') s.stations[1].unlocked = true;
  if (id === 'helper' && !s.actors.some((a) => a.id === 'helper')) s.actors.push(newActor('helper', 'door'));
  game.emit('upgrade', u);
  return { ok: true };
}
export function upgradeCount(state) { return Object.keys(state.upgrades).length; }

// ---- Marketing ------------------------------------------------------------

export function startCampaign(game, id) {
  const s = game.state, c = CAMPAIGNS[id];
  if (!c) return { ok: false, reason: 'Unknown campaign.' };
  if ((s.marketing.cooldowns[id] || 0) > 0) return { ok: false, reason: 'Still running or cooling down.' };
  if (c.channel === 'store' && s.era !== 'store') return { ok: false, reason: 'You need a shop for that.' };
  if (c.cost > 0 && !transact(game, -c.cost, 'Marketing', c.name)) return { ok: false, reason: 'Not enough cash.' };
  if (c.soul) s.soul = Math.min(100, s.soul + c.soul);
  s.marketing.active.push({ id, remaining: c.duration });
  s.marketing.cooldowns[id] = c.cooldown;
  game.emit('campaign', c);
  return { ok: true };
}
function tickMarketing(state, dt) {
  const m = state.marketing;
  for (let i = m.active.length - 1; i >= 0; i--) {
    m.active[i].remaining -= dt;
    if (m.active[i].remaining <= 0) m.active.splice(i, 1);
  }
  for (const id of Object.keys(m.cooldowns)) m.cooldowns[id] = Math.max(0, m.cooldowns[id] - dt);
}

// ---- Progression ----------------------------------------------------------

export function homeGoals(state) {
  const g = HOME_GOALS;
  return [
    { id: 'revenue', label: 'Earn lifetime revenue', value: state.stats.revenue, target: g.revenue, money: true },
    { id: 'orders', label: 'Fulfill customer orders', value: state.stats.ordersFulfilled, target: g.orders },
    { id: 'reputation', label: 'Reach a star rating', value: state.reputation, target: g.reputation, from: 3.5, decimals: 1, hint: 'Better formulas and on-time orders earn better reviews.' },
    { id: 'upgrades', label: 'Upgrade the workshop', value: upgradeCount(state), target: g.upgrades },
  ].map((x) => ({ ...x, done: x.value >= x.target, pct: Math.max(0, Math.min(1, ((x.value - (x.from || 0)) / (x.target - (x.from || 0))))) }));
}
export function homeProgress(state) {
  const goals = homeGoals(state);
  return goals.reduce((a, g) => a + g.pct, 0) / goals.length;
}
// 0..1: how cramped the room looks. Grows with business progress and how full the shelves are.
export function clutterLevel(state) {
  return Math.min(1, homeProgress(state) * 0.75 + (goodsTotal(state) / goodsCap(state)) * 0.25 + state.orders.length * 0.015);
}
function tickProgression(game) {
  const s = game.state;
  if (s.era === 'home' && !s.milestone.outgrown && homeGoals(s).every((g) => g.done)) {
    s.milestone.outgrown = true;
    game.emit('outgrown', {});
  }
}
export function signLease(game) {
  const s = game.state;
  if (!s.milestone.outgrown) return { ok: false, reason: 'The business is not ready yet.' };
  if (s.milestone.leaseSigned) return { ok: false, reason: 'Lease already signed.' };
  if (!transact(game, -HOME_GOALS.leaseDeposit, 'Rent / lease', 'Deposit on the first storefront')) {
    return { ok: false, reason: `You need $${HOME_GOALS.leaseDeposit} for the deposit.` };
  }
  s.milestone.leaseSigned = true;
  game.emit('leaseSigned', {});
  return { ok: true };
}

// ---- Time -----------------------------------------------------------------

export function clockMinutes(state) {
  return DAY_START_MIN + (state.time.t / DAY_LENGTH) * (DAY_END_MIN - DAY_START_MIN);
}
export function clockLabel(state) {
  const m = Math.floor(clockMinutes(state) / 5) * 5;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function endDay(game) {
  const s = game.state;
  let store = null;
  if (s.era === 'store') {
    const viewing = currentId(s);
    for (const id of storeIds(s)) {
      swapTo(s, id);
      forceExpense(game, storeRent(s), 'Rent / lease', s.store.name || 'Main Street');
      forceExpense(game, STORE.utilities + (id === 'main' && s.upgrades.station2 ? 4 : 0), 'Utilities', 'Power, water, internet');
      payWages(game);
      const sum = closeStoreDay(s);
      if (id === 'main') store = sum;
      refreshCandidates(game);
    }
    swapTo(s, viewing);
  } else {
    forceExpense(game, DAILY_UTILITIES + (s.upgrades.station2 ? 4 : 0), 'Utilities', 'Power, water, internet');
    if (s.upgrades.helper) forceExpense(game, UPGRADES.helper.wage, 'Staff wages', 'Weekend helper');
  }
  const summary = closeDay(game);
  if (store) summary.store = store;
  s.time.day += 1;
  s.time.t = 0;
  game.emit('dayEnd', summary);
}

const STEP = 0.2;
// Advance the whole simulation by dtReal seconds of wall-clock time.
export function tick(game, dtReal) {
  const s = game.state;
  if (s.time.paused || dtReal <= 0) return;
  let remaining = Math.min(dtReal, 0.5) * s.time.speed;
  while (remaining > 1e-6) {
    const dt = Math.min(STEP, remaining);
    remaining -= dt;
    s.time.t += dt;
    s.time.total += dt;
    tickDeliveries(game, dt);
    tickStations(game, dt);
    tickMarketing(s, dt);
    if (s.era === 'store') {
      // Company systems and Main Street run with Main Street in the live slots; then every other
      // store gets its turn, and whichever store the player is looking at goes back in.
      const viewing = currentId(s);
      swapTo(s, 'main');
      tickOrders(game, dt);
      tickTransfers(game, dt);
      tickStore(game, dt); tickStoreStaff(game, dt);
      for (const id of storeIds(s)) {
        if (id === 'main') continue;
        swapTo(s, id);
        tickStore(game, dt); tickStoreStaff(game, dt);
        const st = s.store;
        st.mgrT = (st.mgrT || 0) - dt;
        if (st.mgrT <= 0) { st.mgrT = CHAIN.managerEvery; if (st.staff.some((x) => x.role === 'manager')) managerReorder(game); }
      }
      swapTo(s, viewing);
      tickExpansion(game);
    } else {
      tickOrders(game, dt);
      tickWorkers(game, dt);
    }
    tickProgression(game);
    if (s.time.t >= DAY_LENGTH) endDay(game);
  }
}
