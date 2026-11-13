// Era III panels: the chain overview (stores, KPIs, switching, stock transfers) and the location
// picker. Same contract as panels.js: pure functions of state returning HTML strings.

import { LOCATIONS, LOCATION_ORDER, CHAIN, ARCHETYPES } from '../data.js';
import { storeKpis, storeIds, storeName, goodsOf, currentId, expansionGoals, canOpenBranch, branchCount, storeProfit } from '../sim/chain.js';
import { money, esc, skuSwatch } from './panels.js';

const pct = (v) => (v === null || v === undefined ? '–' : `${Math.round(v * 100)}%`);

export function storesPanel(s, ui) {
  let out = '';
  if (!s.milestone.chainReady) {
    const goals = expansionGoals(s);
    out += `<div class="card"><div class="title">Road to a second shop</div><div class="muted">Get Main Street properly established and the brand can grow.</div>
      ${goals.map((g) => `<div class="kv"><span>${g.done ? '✅' : '⬜'} ${g.label}</span><b>${g.money ? money(Math.min(g.value, g.target)) : g.decimals ? g.value.toFixed(1) : Math.min(g.value, g.target)} / ${g.money ? money(g.target) : g.target}</b></div>`).join('')}</div>`;
    return out;
  }
  const kpis = storeKpis(s);
  const cur = currentId(s);
  out += `<div class="sect">Your shops <span>${kpis.length}</span></div>`;
  for (const k of kpis) {
    const L = LOCATIONS[k.location];
    out += `<div class="card ${k.id === cur ? 'build-live' : ''}"><div class="row"><span class="swatch" style="background:${L.theme ? L.theme.panel : '#bfd8c6'}">🏪</span><div class="grow"><div class="title">${esc(k.name)}</div><div class="muted">${k.isMain ? 'The flagship, with the workroom' : esc(L.blurb.split('.')[0])}</div></div>
      ${k.id === cur ? '<span class="chip teal">You are here</span>' : `<button class="btn sm teal" data-act="goto" data-id="${k.id}">Go there</button>`}</div>
      <div class="kpis">
        <div><small>Shoppers now</small><b>${k.shoppers}</b></div><div><small>Visitors today</small><b>${k.visitorsToday}</b></div><div><small>Sales today</small><b>${money(k.salesToday)}</b></div>
        <div><small>Bought</small><b>${pct(k.conversion)}</b></div><div><small>Rating</small><b>★ ${k.rating.toFixed(1)}</b></div><div><small>Clean</small><b>${k.clean}%</b></div>
        <div><small>Design</small><b>${k.design}</b></div><div><small>Back stock</small><b class="${k.backStock < 10 ? 'neg' : ''}">${k.backStock}</b></div><div><small>Yesterday</small><b class="${(k.profitYesterday || 0) >= 0 ? 'pos' : 'neg'}">${k.profitYesterday === null ? '–' : money(k.profitYesterday)}</b></div>
      </div>
      <div class="tiny">${k.staff} staff${k.isMain ? '' : k.hasManager ? ' · a manager keeps it stocked from Main Street' : ' · <b>no manager</b>: send stock yourself'} · rent ${money(k.rent)}/day${k.stockoutsToday ? ` · ${k.stockoutsToday} empty-shelf moments today` : ''}</div></div>`;
  }
  const can = branchCount(s) < CHAIN.maxBranches;
  out += `<button class="btn block ${can ? '' : 'ghost'}" data-act="pickloc" ${can ? '' : 'disabled'}>${can ? 'Open a new shop…' : 'The chain is as big as it can be for now'}</button>`;

  // stock transfers
  if (kpis.length > 1) {
    const t = ui.transfer;
    if (!storeIds(s).includes(t.from)) t.from = 'main';
    if (!storeIds(s).includes(t.to) || t.to === t.from) t.to = storeIds(s).find((id) => id !== t.from);
    const from = goodsOf(s, t.from) || {};
    const units = Object.values(t.items).reduce((a, b) => a + b, 0);
    out += `<div class="sect">Send stock <span>${money(CHAIN.transferFee)} per courier run</span></div><div class="card">
      <div class="tiny">From</div><div class="pick">${storeIds(s).map((id) => `<button class="${t.from === id ? 'on' : ''}" data-act="tfrom" data-id="${id}">${esc(storeName(s, id))}</button>`).join('')}</div>
      <div class="tiny">To</div><div class="pick">${storeIds(s).filter((id) => id !== t.from).map((id) => `<button class="${t.to === id ? 'on' : ''}" data-act="tto" data-id="${id}">${esc(storeName(s, id))}</button>`).join('')}</div>
      ${s.skus.map((k) => `<div class="row">${skuSwatch(k, 'sm')}<div class="grow"><div class="title" style="font-size:13px">${esc(k.name)}</div><div class="tiny">${from[k.id] || 0} in back stock at ${esc(storeName(s, t.from))}</div></div>
        <div class="stepper"><button class="icon-btn" data-act="titem" data-id="${k.id}" data-d="-6" ${t.items[k.id] ? '' : 'disabled'}>−</button><b>${t.items[k.id] || 0}</b><button class="icon-btn" data-act="titem" data-id="${k.id}" data-d="6" ${(t.items[k.id] || 0) + 1 > (from[k.id] || 0) ? 'disabled' : ''}>+</button></div></div>`).join('')}
      <button class="btn teal block" data-act="tsend" ${units ? '' : 'disabled'}>${units ? `Send ${units} units` : 'Choose what to send'}</button></div>`;
  }
  const moving = s.transfers || [];
  if (moving.length) {
    out += `<div class="sect">On the road</div><div class="card" style="gap:6px">${moving.map((t) => `<div class="row"><span>🚚</span><div class="grow tiny">${esc(storeName(s, t.from))} → ${esc(storeName(s, t.to))} · ${Object.values(t.items).reduce((a, b) => a + b, 0)} units${t.auto ? (t.opening ? ' (opening stock)' : ' (manager)') : ''}</div><div class="bar" style="width:60px"><i data-live="transfer:${t.id}"></i></div></div>`).join('')}</div>`;
  }

  // per-store profit, straight from the ledger
  const rows = storeProfit(s, 5);
  if (rows.length && rows.some((r) => Object.keys(r.cols).length > 1)) {
    const ids = [...storeIds(s), 'company'];
    out += `<div class="sect">Profit by shop <span>from the ledger</span></div><div class="card"><table class="pl"><tr><th></th>${ids.map((id) => `<th>${id === 'company' ? 'Company' : esc(storeName(s, id).split(' ')[0])}</th>`).join('')}<th>Total</th></tr>
      ${rows.map((r) => `<tr><td>D${r.day}</td>${ids.map((id) => { const c = r.cols[id]; return `<td class="${c && c.profit < 0 ? 'neg' : 'pos'}">${c ? money(c.profit) : '–'}</td>`; }).join('')}<td class="${r.profit < 0 ? 'neg' : 'pos'}"><b>${money(r.profit)}</b></td></tr>`).join('')}</table>
      <div class="tiny">"Company" is shared spending and income: ingredients, online orders, recipes, couriers.</div></div>`;
  }
  return out;
}

// Location picker (a modal body)
export function locationCards(s) {
  return LOCATION_ORDER.map((id) => {
    const L = LOCATIONS[id];
    const chk = canOpenBranch(s, id);
    const owned = storeIds(s).some((sid) => { const n = storeName(s, sid); return n === L.name; });
    const fans = Object.entries(L.mix).filter(([, v]) => v >= 1.5).sort((a, b) => b[1] - a[1]).map(([k]) => ARCHETYPES[k].name);
    const busy = L.traffic >= 1.15 ? 'Very busy' : L.traffic >= 1 ? 'Busy' : 'Quieter';
    return `<div class="loc" style="--loc:${L.theme.awning}"><div class="loc-head"><b>${esc(L.name)}</b><span>${money(L.deposit)} deposit</span></div>
      <p>${esc(L.blurb)}</p>
      <div class="chips"><span class="chip">${busy}</span><span class="chip">Rent ${money(L.rent)}/day</span><span class="chip">${L.budget > 1.05 ? 'Big spenders' : L.budget < 0.95 ? 'Tight budgets' : 'Average spend'}</span>${fans.map((f) => `<span class="chip pink">${f}s</span>`).join('')}</div>
      <button class="btn ${owned ? 'ghost' : 'teal'} block" data-act="m-open-${id}" ${chk.ok ? '' : 'disabled'} title="${esc(chk.reason || '')}">${owned ? 'You have a shop here' : chk.ok ? 'Open here' : esc(chk.reason)}</button></div>`;
  }).join('');
}
