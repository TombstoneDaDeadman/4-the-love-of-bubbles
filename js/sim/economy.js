// EconomyService: the ONLY place cash changes. Every movement is recorded in the ledger,
// so cash can always be audited against ledger.sum.

const REVENUE_CATS = new Set(['Online orders', 'Local orders', 'Big orders', 'Store sales']);
const MAX_ENTRIES = 400;

export function canAfford(game, amount) {
  return game.state.cash + 1e-9 >= amount;
}

// amount > 0 is income, amount < 0 is spending. Returns false (and changes nothing) if unaffordable.
export function transact(game, amount, cat, note = '') {
  const s = game.state;
  amount = Math.round(amount * 100) / 100;
  if (!Number.isFinite(amount) || amount === 0) return false;
  if (amount < 0 && !canAfford(game, -amount)) return false;
  s.cash = Math.round((s.cash + amount) * 100) / 100;
  const L = s.ledger;
  L.sum = Math.round((L.sum + amount) * 100) / 100;
  L.entries.push({ day: s.time.day, t: Math.round(s.time.t), amount, cat, note });
  if (L.entries.length > MAX_ENTRIES) L.entries.splice(0, L.entries.length - MAX_ENTRIES);
  L.lifetime[cat] = Math.round(((L.lifetime[cat] || 0) + amount) * 100) / 100;
  L.today.cats[cat] = Math.round(((L.today.cats[cat] || 0) + amount) * 100) / 100;
  if (amount > 0) {
    L.today.revenue = Math.round((L.today.revenue + amount) * 100) / 100;
    if (REVENUE_CATS.has(cat)) s.stats.revenue = Math.round((s.stats.revenue + amount) * 100) / 100;
  } else {
    L.today.expenses = Math.round((L.today.expenses - amount) * 100) / 100;
  }
  game.emit('cash', { amount, cat, note });
  return true;
}

// Daily bills are always paid, even into debt, so the day can close. Debt blocks purchases.
export function forceExpense(game, amount, cat, note = '') {
  const s = game.state;
  if (amount <= 0) return;
  const before = s.cash;
  s.cash = Math.max(s.cash, amount); // temporarily lift so transact's guard passes
  const lift = s.cash - before;
  transact(game, -amount, cat, note);
  s.cash = Math.round((s.cash - lift) * 100) / 100;
}

export function closeDay(game) {
  const s = game.state, L = s.ledger;
  const summary = {
    day: s.time.day,
    revenue: L.today.revenue,
    expenses: L.today.expenses,
    profit: Math.round((L.today.revenue - L.today.expenses) * 100) / 100,
    cats: { ...L.today.cats },
    cash: s.cash,
  };
  L.days.push(summary);
  if (L.days.length > 60) L.days.shift();
  L.today = { revenue: 0, expenses: 0, cats: {} };
  return summary;
}

export function todayProfit(state) {
  return Math.round((state.ledger.today.revenue - state.ledger.today.expenses) * 100) / 100;
}
