// SaveService: versioned save/load with autosave slot and one rolling backup.
// Storage is injected (localStorage in the browser, a plain object in tests).

import { SAVE_VERSION } from '../data.js';
import { newGameState } from './core.js';
import { newStoreState } from './store.js';

export const SAVE_KEY = 'ftlob.save';
export const BACKUP_KEY = 'ftlob.save.backup';

export function serialize(state) {
  return JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state });
}

// Step-by-step migrations: MIGRATIONS[n] upgrades a version-n state to version n+1.
const MIGRATIONS = {
  0: (st) => { st.settings = st.settings || { autoFulfill: false }; st.missedDemand = st.missedDemand || 0; return st; },
  // v2 (Era II): the store did not exist yet. Players who already signed the lease stay in the
  // kitchen until they choose to move in, so they still get the opening moment.
  1: (st) => { st.store = null; st.era = 'home'; st.milestone = { storeOpened: false, storeDay: 0, ...(st.milestone || {}) }; return st; },
  // v3 (Milestone 4): product lines, display refill levels, staff shifts and experience, cleanliness.
  2: (st) => {
    st.lines = st.lines || {};
    for (const k of st.skus || []) { k.storeSold = k.storeSold || 0; k.storeRevenue = k.storeRevenue || 0; }
    if (st.store) {
      for (const f of st.store.furniture) for (const sl of f.slots) { if (sl.refill === undefined) sl.refill = 0.5; sl.rush = !!sl.rush; }
      for (const r of st.store.staff) { r.shift = r.shift || 'full'; r.xp = r.xp || 0; r.trained = r.trained || 0; }
    }
    return st;
  },
};

// Fill in any keys a save is missing (older or partially corrupt optional data) from a fresh state.
function withDefaults(st) {
  const fresh = newGameState(st.founder, st.seed || 1);
  for (const k of Object.keys(fresh)) {
    if (st[k] === undefined || st[k] === null) st[k] = fresh[k];
    else if (fresh[k] && typeof fresh[k] === 'object' && !Array.isArray(fresh[k])) {
      for (const k2 of Object.keys(fresh[k])) if (st[k][k2] === undefined) st[k][k2] = fresh[k][k2];
    }
  }
  for (const sku of st.skus) if (st.goods[sku.id] === undefined) st.goods[sku.id] = 0;
  if (st.store) {
    const fs = newStoreState();
    for (const k of Object.keys(fs)) if (st.store[k] === undefined || st.store[k] === null) st.store[k] = fs[k];
    if (st.era !== 'store') st.era = 'store';
  }
  return st;
}

export function deserialize(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.state) throw new Error('Not a save file');
  let version = Number.isInteger(data.version) ? data.version : 0;
  if (version > SAVE_VERSION) throw new Error('Save is from a newer version of the game');
  let st = data.state;
  while (version < SAVE_VERSION) {
    if (MIGRATIONS[version]) st = MIGRATIONS[version](st);
    version += 1;
  }
  st.version = SAVE_VERSION;
  return withDefaults(st);
}

export function saveGame(storage, state) {
  try {
    const prev = storage.getItem(SAVE_KEY);
    if (prev) storage.setItem(BACKUP_KEY, prev);
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(storage) {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const text = storage.getItem(key);
      if (text) return deserialize(text);
    } catch (e) { /* fall through to the backup */ }
  }
  return null;
}

export function hasSave(storage) {
  try { return !!(storage.getItem(SAVE_KEY) || storage.getItem(BACKUP_KEY)); } catch (e) { return false; }
}

export function clearSave(storage) {
  try { storage.removeItem(SAVE_KEY); storage.removeItem(BACKUP_KEY); } catch (e) { /* ignore */ }
}
