// Era III panels: the chain overview (stores, KPIs, switching, stock transfers) and the location
// picker. Same contract as panels.js: pure functions of state returning HTML strings.

import { LOCATIONS, LOCATION_ORDER, CHAIN, ARCHETYPES, KITCHEN, REGIONAL, WHOLESALE, PRODUCTS, TIERS } from '../data.js';
import { canBuildKitchen, kitchenBatch, kitchenTime, brandReport, chainGoals, parFor, qualityIndex } from '../sim/company.js';
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

// ---- Milestone 6: central kitchen and distribution ------------------------------------------------

export function kitchenPanel(s) {
  const K = s.kitchen;
  if (!K) {
    const chk = canBuildKitchen(s);
    return `<div class="card"><div class="row"><span class="swatch" style="background:#f6e4c4">🏭</span><div class="grow"><div class="title">A central kitchen</div>
      <div class="muted">Two stoves in a back room cannot keep a chain stocked. A kitchen across town runs ${KITCHEN.startLines} automated production lines with their own crew, buys ingredients by the pallet (${Math.round((1 - KITCHEN.bulkDiscount) * 100)}% cheaper), makes double batches, and fills a warehouse. Delivery trucks take stock to every shop each morning.</div></div></div>
      <div class="kv"><span>Cost</span><b>${money(KITCHEN.cost)}</b></div><div class="kv"><span>Crew</span><b>${money(KITCHEN.crewWage)} per line per day</b></div>
      <button class="btn teal block" data-act="kitchen" ${chk.ok ? '' : 'disabled'}>${chk.ok ? `Build the central kitchen · ${money(KITCHEN.cost)}` : esc(chk.reason)}</button></div>
      <div class="tiny" style="padding:0 4px">Main Street's workroom keeps working too: what it makes stays in Main Street's back stock.</div>`;
  }
  const wh = K.warehouse;
  const listed = s.skus.filter((k) => !k.paused);
  let out = `<div class="sect">Production lines <span>${K.lines.length} / ${KITCHEN.maxLines}</span></div><div class="card" style="gap:8px">`;
  for (const l of K.lines) {
    const sku = l.job && s.skus.find((k) => k.id === l.job.skuId);
    out += `<div class="row">${sku ? skuSwatch(sku, 'sm') : '<span class="swatch sm ink" style="background:#efe5d6">·</span>'}<div class="grow"><div class="title" style="font-size:13px">Line ${l.id + 1}${sku ? ` · ${esc(sku.name)} ×${l.job.units}` : ''}</div>
      ${sku ? `<div class="bar"><i data-live="kline:${l.id}"></i></div>` : `<div class="tiny">${K.deliveries.length ? 'Waiting for an ingredient delivery' : 'Warehouse is full of everything'}</div>`}</div></div>`;
  }
  out += `${K.lines.length < KITCHEN.maxLines ? `<button class="btn sm ghost" data-act="kline" ${s.cash < KITCHEN.lineCost ? 'disabled' : ''}>Add a line · ${money(KITCHEN.lineCost)}</button>` : ''}
    <div class="tiny">${K.made} units made so far. Lines cook whatever the warehouse is shortest of, and order their own ingredients.</div></div>`;
  out += `<div class="sect">Warehouse</div><div class="card">
    <div class="tiny">Keep this many of each recipe</div><div class="pick">${[15, 30, 50].map((v) => `<button class="${K.target === v ? 'on' : ''}" data-act="kset" data-id="target" data-v="${v}">${v}</button>`).join('')}</div>
    ${listed.map((k) => `<div class="row">${skuSwatch(k, 'sm')}<span class="grow tiny">${esc(k.name)}</span><div class="bar ${wh[k.id] >= K.target ? 'green' : wh[k.id] > K.target / 3 ? 'gold' : 'red'}" style="width:90px"><i style="width:${Math.min(100, ((wh[k.id] || 0) / K.target) * 100)}%"></i></div><b style="font-size:12.5px;min-width:30px;text-align:right">${wh[k.id] || 0}</b></div>`).join('')}</div>`;
  out += `<div class="sect">Deliveries <span>${money(KITCHEN.truckFee)} per shop per run</span></div><div class="card">
    <div class="row"><div class="grow"><div class="title" style="font-size:13.5px">Forecast from yesterday's sales</div><div class="tiny">Each shop gets about what it sold yesterday, plus a margin. Off: everyone gets the same par level.</div></div><span class="toggle ${K.forecast ? 'on' : ''}" data-act="kset" data-id="forecast" data-v="${K.forecast ? 0 : 1}"><i></i></span></div>
    ${K.forecast ? '' : `<div class="tiny">Par level per recipe</div><div class="pick">${[8, 14, 22].map((v) => `<button class="${K.par === v ? 'on' : ''}" data-act="kset" data-id="par" data-v="${v}">${v}</button>`).join('')}</div>`}
    <div class="row"><div class="grow"><div class="title" style="font-size:13.5px">Second run at midday</div><div class="tiny">Busy shops sell out by lunch. A second truck costs a second fee.</div></div><span class="toggle ${K.midday ? 'on' : ''}" data-act="kset" data-id="midday" data-v="${K.midday ? 0 : 1}"><i></i></span></div></div>`;
  return out;
}

// ---- Milestone 6: the company -------------------------------------------------------------------------

export function companyPanel(s) {
  let out = '';
  const goals = chainGoals(s);
  out += `<div class="sect">${s.milestone.finale ? 'A beloved brand ✨' : 'The big goals'}</div><div class="card">${goals.map((g) => `<div class="kv"><span>${g.done ? '✅' : '⬜'} ${g.label}</span><b>${g.money ? money(Math.min(g.value, g.target)) : g.decimals ? g.value.toFixed(1) : Math.min(g.value, g.target)} / ${g.money ? money(g.target) : g.target}</b></div>`).join('')}</div>`;

  const contracts = s.contracts || [];
  out += `<div class="sect">Wholesale <span>${contracts.filter((c) => c.status === 'active').length} / ${WHOLESALE.maxActive} active</span></div>`;
  if (!contracts.length) out += `<div class="empty">Salons, spas and hotels send offers every couple of days once you have two shops.</div>`;
  for (const c of contracts) {
    const P = PRODUCTS[c.productId];
    const tag = { offer: '<span class="chip gold">Offer</span>', active: '<span class="chip teal">Active</span>', done: '<span class="chip ok">✓ Completed</span>', cancelled: '<span class="chip bad">Cancelled</span>' }[c.status];
    out += `<div class="card"><div class="row"><span class="swatch" style="background:#eef5f1">${{ spa: '🧖', salon: '💇', hotel: '🏨', boutique: '🎀', studio: '🧘' }[c.kind] || '🏢'}</span><div class="grow"><div class="title">${esc(c.client)}</div>
      <div class="muted">${c.qty} ${P.name}${c.minTier ? ` (${TIERS[c.minTier].name} or better)` : ''} every morning for ${c.days} days at ${money(c.price, true)} each</div></div>${tag}</div>
      ${c.status === 'active' ? `<div class="tiny">${c.daysLeft} days to go · ${c.delivered} delivered${c.misses ? ` · <b class="neg">${c.misses} missed</b> (${WHOLESALE.maxMisses} and they walk away)` : ''}</div>` : ''}
      ${c.status === 'offer' ? `<div class="row"><span class="tiny grow">Worth ${money(c.qty * c.price * c.days)} in total. Missed deliveries cost ${money(WHOLESALE.missPenalty)} and a little Brand Soul.</span><button class="btn sm ghost" data-act="wdecline" data-id="${c.id}">No thanks</button><button class="btn sm teal" data-act="waccept" data-id="${c.id}">Accept</button></div>` : ''}</div>`;
  }
  out += `<div class="tiny" style="padding:0 4px">Contracts are filled from the kitchen warehouse first, then Main Street's back stock.</div>`;

  out += `<div class="sect">Regional management</div>`;
  if (s.regional) {
    out += `<div class="card owned"><div class="row"><span class="swatch" style="background:#d6ecea">🧭</span><div class="grow"><div class="title">${esc(s.regional.name)}, ${REGIONAL.name}</div><div class="muted">Moves surplus stock between shops each morning, keeps the window displays fresh, and every shop runs a little better for it.</div></div><b class="neg" style="font-size:13px">${money(REGIONAL.wage)}/day</b></div>
      <div class="row"><span class="grow"></span><button class="btn sm ghost" data-act="rfire">Let go</button></div></div>`;
  } else {
    out += `<div class="card"><div class="row"><span class="swatch" style="background:#f6e4c4">🧭</span><div class="grow"><div class="title">Hire a ${REGIONAL.name}</div><div class="muted">Balances stock between shops each morning, keeps the free window display running, and lifts traffic (+${Math.round(REGIONAL.traffic * 100)}%) and shopper mood in every shop.</div></div></div>
      <button class="btn block" data-act="rhire" ${s.cash < REGIONAL.wage ? 'disabled' : ''}>Hire · ${money(REGIONAL.wage)}/day</button></div>`;
  }

  const r = brandReport(s);
  out += `<div class="sect">The brand <span>last ${r.channels.length} days</span></div><div class="card">
    <div class="kpis"><div><small>Shops</small><b>${r.shops}</b></div><div><small>People</small><b>${r.staff}</b></div><div><small>Brand Soul</small><b>${r.soul}</b></div>
    <div><small>Quality index</small><b>${r.quality}</b></div><div><small>Units in stock</small><b>${r.stockUnits}</b></div><div><small>Days of cover</small><b>${r.coverDays ?? '–'}</b></div></div>`;
  if (r.channels.length) {
    const max = Math.max(1, ...r.channels.map((d) => d.retail + d.online + d.wholesale));
    out += `<div class="pl-chart" style="margin-top:8px">${r.channels.map((d) => `<div class="pl-col" title="Day ${d.day}: shops ${money(d.retail)}, online ${money(d.online)}, wholesale ${money(d.wholesale)}"><div class="stack" style="height:${((d.retail + d.online + d.wholesale) / max) * 72}px"><i class="ch-w" style="flex:${d.wholesale}"></i><i class="ch-o" style="flex:${d.online}"></i><i class="ch-r" style="flex:${d.retail}"></i></div><b class="${d.profit >= 0 ? 'pos' : 'neg'}">${money(d.profit)}</b><span>D${d.day}</span></div>`).join('')}</div>
      <div class="tiny"><span class="key ch-r"></span> shops <span class="key ch-o"></span> online <span class="key ch-w"></span> wholesale · profit under each day</div>`;
  }
  out += `<div class="tiny">The quality index is the average formula quality of everything you have sold. Brand Soul and quality are what keep a big company feeling handmade.</div></div>`;
  return out;
}
