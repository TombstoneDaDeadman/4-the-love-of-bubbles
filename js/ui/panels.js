// Panel renderers. Each returns an HTML string built from state. Anything that changes every
// frame (progress bars, countdowns) is left as a data-live placeholder and filled in by ui.js,
// so the HTML only changes when the underlying state does.

import { INGREDIENTS, INGREDIENT_ORDER, PRODUCTS, PRODUCT_ORDER, TIERS, SCENTS, SCENT_ORDER, UPGRADES, UPGRADE_ORDER, CAMPAIGNS, CAMPAIGN_ORDER, STORE_CAMPAIGN_ORDER, VARIANT_COST, HOME_GOALS, PRODUCT_LINES, LINE_ORDER, LOYALTY, ARCHETYPES } from '../data.js';
import { batchNeeds, batchUnits, batchTime, unitCost, refPrice, skuQuality, skuRating, priceAppeal, ingredientTotal, ingredientCap, incomingTotal, goodsTotal, goodsCap, supplyCost, ingredientFree, maxSkus, productUnlocked, ingredientInUse } from '../sim/inventory.js';
import { profitReport } from '../sim/store.js';
import { MAX_QUEUE } from '../sim/production.js';
import { demandBreakdown, canFulfill, stockFor } from '../sim/orders.js';
import { todayProfit } from '../sim/economy.js';
import { ICONS, productIcon } from './icons.js';

export const money = (v, dec = false) => {
  const n = Math.abs(v);
  const s = dec || (n % 1 !== 0 && n < 100) ? n.toFixed(2) : Math.round(n).toLocaleString('en-US');
  return `${v < 0 ? '−' : ''}$${s}`;
};
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const starStr = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function skuSwatch(sku, cls = '') {
  const sc = SCENTS[sku.scentId];
  return `<span class="swatch ${cls}" style="background:${sc.color}">${productIcon(PRODUCTS[sku.productId].container)}</span>`;
}
const tierChip = (tier) => `<span class="chip ${tier === 2 ? 'gold' : tier === 1 ? 'teal' : ''}">${TIERS[tier].name}</span>`;

// ---- Production -------------------------------------------------------------

export function productionPanel(s) {
  let out = '';
  const stations = s.stations.filter((st) => st.unlocked);
  out += `<div class="sect">Workstations <span>${stations.length} of 2</span></div>`;
  for (const st of stations) {
    const sku = st.job && s.skus.find((k) => k.id === st.job.skuId);
    const name = st.id === 0 ? 'Stovetop' : 'Hot plate & curing rack';
    if (!st.job) {
      out += `<div class="card"><div class="row"><span class="swatch ink" style="background:#efe5d6">${ICONS.production}</span><div class="grow"><div class="title">${name}</div><div class="muted">Idle. Queue a batch below.</div></div></div></div>`;
    } else {
      const label = st.phase === 'prep' ? 'Getting ingredients ready…' : st.phase === 'running' ? 'Cooking' : st.blocked ? 'Done, but the stock shelf is full!' : 'Done! Waiting to be shelved.';
      out += `<div class="card"><div class="row">${skuSwatch(sku)}<div class="grow"><div class="title">${esc(sku.name)}</div><div class="muted">${name} · ${st.job.units} units · ${label}</div></div>
        ${st.phase !== 'done' ? `<button class="icon-btn" data-act="cancel" data-id="${st.job.id}" title="Cancel (ingredients are lost)">✕</button>` : ''}</div>
        <div class="bar ${st.phase === 'done' ? 'green' : ''}"><i data-live="station:${st.id}"></i></div></div>`;
    }
  }
  if (!s.stations[1].unlocked) out += `<div class="tiny" style="padding:0 4px">Buy the Second Workstation in Upgrades to run two batches at once.</div>`;

  out += `<div class="sect">Queue <span>${s.queue.length} / ${MAX_QUEUE}</span></div>`;
  if (!s.queue.length) out += `<div class="empty">Nothing queued.</div>`;
  else {
    out += `<div class="card" style="gap:7px">`;
    s.queue.forEach((job, i) => {
      const sku = s.skus.find((k) => k.id === job.skuId);
      out += `<div class="row">${skuSwatch(sku, 'sm')}<div class="grow title" style="font-size:13.5px">${i + 1}. ${esc(sku.name)} <span class="muted">×${job.units}</span></div>
        <button class="icon-btn" data-act="cancel" data-id="${job.id}" title="Cancel and refund ingredients">✕</button></div>`;
    });
    out += `</div>`;
  }

  out += `<div class="sect">Make a batch <span>stock shelf ${goodsTotal(s)} / ${goodsCap(s)}</span></div>`;
  for (const sku of s.skus) {
    const needs = batchNeeds(s, sku);
    const short = Object.entries(needs).some(([id, q]) => s.ingredients[id] < q);
    const full = s.queue.length >= MAX_QUEUE;
    out += `<div class="card"><div class="row">${skuSwatch(sku)}<div class="grow"><div class="title">${esc(sku.name)}</div>
      <div class="chips">${tierChip(sku.tier)}<span class="chip">${batchUnits(s, sku)} units</span><span class="chip">⏱ ${Math.round(batchTime(s, sku))}s</span><span class="chip ${s.goods[sku.id] ? 'ok' : 'bad'}">${s.goods[sku.id]} in stock</span></div></div></div>
      <div class="needs">${Object.entries(needs).map(([id, q]) => `<div class="need ${s.ingredients[id] < q ? 'short' : ''}"><span>${INGREDIENTS[id].icon} ${INGREDIENTS[id].name}</span><b>${s.ingredients[id]}/${q}</b></div>`).join('')}</div>
      <div class="row"><span class="tiny grow">Costs ${money(unitCost(s, sku), true)} per unit to make</span>
      ${short ? `<button class="btn sm ghost" data-act="buyfor" data-id="${sku.id}">Buy missing</button>` : ''}
      <button class="btn sm teal" data-act="queue" data-id="${sku.id}" ${short || full ? 'disabled' : ''}>${full ? 'Queue full' : short ? 'Need supplies' : 'Make batch'}</button></div></div>`;
  }
  return out;
}

// ---- Supplies ---------------------------------------------------------------

export function suppliesPanel(s, ui) {
  const used = ingredientTotal(s), inc = incomingTotal(s), cap = ingredientCap(s);
  const cart = ui.cart;
  const cartUnits = Object.values(cart).reduce((a, b) => a + b, 0);
  const cost = supplyCost(cart);
  let out = `<div class="card"><div class="kv"><span>Pantry space</span><b>${used}${inc ? ` + ${inc} arriving` : ''} / ${cap}</b></div>
    <div class="bar ${used + inc + cartUnits > cap ? 'red' : 'gold'}"><i style="width:${Math.min(100, ((used + inc + cartUnits) / cap) * 100)}%"></i></div></div>`;
  if (s.deliveries.length) {
    out += `<div class="sect">On the way</div><div class="card" style="gap:6px">`;
    for (const d of s.deliveries) {
      out += `<div class="row"><span>🚚</span><div class="grow tiny">${Object.entries(d.items).map(([id, q]) => `${q} ${INGREDIENTS[id].name}`).join(', ')}</div><div class="bar" style="width:60px"><i data-live="delivery:${d.id}"></i></div></div>`;
    }
    out += `</div>`;
  }
  out += `<div class="sect">Order supplies <span>sold in lots</span></div><div class="card" style="gap:11px">`;
  for (const id of INGREDIENT_ORDER) {
    const ing = INGREDIENTS[id];
    if (id === 'premium' && !s.skus.some((k) => k.tier === 2) && !s.ingredients.premium) continue;
    if (!ingredientInUse(s, id)) continue;
    const incoming = s.deliveries.reduce((a, d) => a + (d.items[id] || 0), 0);
    out += `<div class="row" title="${esc(ing.note)} Supplier: ${esc(ing.supplier)}.">
      <span class="swatch sm" style="background:${ing.color};width:30px;height:30px;font-size:15px">${ing.icon}</span>
      <div class="grow"><div class="title" style="font-size:13.5px">${ing.name}</div><div class="tiny">Have <b style="color:var(--ink)">${s.ingredients[id] || 0}</b>${incoming ? ` · +${incoming} coming` : ''} · ${money(ing.cost * ing.lot, true)} per ${ing.lot}</div></div>
      <div class="stepper"><button class="icon-btn" data-act="cart" data-id="${id}" data-d="-1" ${cart[id] ? '' : 'disabled'}>−</button><b>${cart[id] || 0}</b><button class="icon-btn" data-act="cart" data-id="${id}" data-d="1">+</button></div></div>`;
  }
  out += `</div>`;
  const tooBig = cartUnits > ingredientFree(s);
  out += `<div class="card"><div class="kv total"><span>Order total · ${cartUnits} units</span><b>${money(cost, true)}</b></div>
    ${tooBig ? `<div class="chip bad">Not enough pantry space for this order</div>` : ''}
    <div class="row"><button class="btn sm ghost" data-act="cartclear" ${cartUnits ? '' : 'disabled'}>Clear</button><button class="btn sm ghost grow" data-act="cartauto" title="Add what is needed for one batch of every listed recipe">Fill for 1 batch each</button>
    <button class="btn sm teal" data-act="buy" ${!cartUnits || tooBig || cost > s.cash ? 'disabled' : ''}>${cost > s.cash ? 'Too pricey' : 'Place order'}</button></div></div>`;
  return out;
}

// ---- Recipes / products -------------------------------------------------------

function appealChip(sku) {
  const a = priceAppeal(sku);
  if (a >= 1.15) return `<span class="chip ok">Bargain: sells fast</span>`;
  if (a >= 0.9) return `<span class="chip ok">Fair price</span>`;
  if (a >= 0.55) return `<span class="chip gold">Pricey: fewer orders</span>`;
  return `<span class="chip bad">Overpriced</span>`;
}

export function recipesPanel(s, ui) {
  let out = `<div class="sect">Your recipe book <span>${s.skus.length} / ${maxSkus(s)}</span></div>`;
  for (const sku of s.skus) {
    const cost = unitCost(s, sku), margin = sku.price - cost, rating = skuRating(sku);
    out += `<div class="card ${sku.paused ? 'dim' : ''}"><div class="row">${skuSwatch(sku)}<div class="grow"><div class="title">${esc(sku.name)}</div>
      <div class="chips">${tierChip(sku.tier)}<span class="chip">${s.goods[sku.id]} in stock</span><span class="chip">${sku.sold} sold</span>${rating ? `<span class="chip gold">★ ${rating.toFixed(1)}</span>` : ''}</div></div></div>
      <div class="kv"><span class="muted">Quality</span><div class="bar pink" style="width:150px;align-self:center"><i style="width:${skuQuality(sku)}%"></i></div></div>
      <div class="row"><div class="grow"><div class="tiny">Price</div><div class="stepper"><button class="icon-btn" data-act="price" data-id="${sku.id}" data-d="-1">−</button><b>${money(sku.price)}</b><button class="icon-btn" data-act="price" data-id="${sku.id}" data-d="1">+</button></div></div>
      <div style="text-align:right"><div class="tiny">Profit per unit</div><b class="${margin > 0 ? 'pos' : 'neg'}">${money(margin, true)}</b><div class="tiny">costs ${money(cost, true)}</div></div></div>
      <div class="row">${appealChip(sku)}<span class="grow"></span><span class="toggle ${sku.paused ? '' : 'on'}" data-act="pause" data-id="${sku.id}" title="Stop or resume taking orders for this recipe"><i></i>${sku.paused ? 'Not listed' : 'Listed'}</span></div></div>`;
  }
  const v = ui.variant;
  const exists = s.skus.some((k) => k.productId === v.productId && k.scentId === v.scentId && k.tier === v.tier);
  const full = s.skus.length >= maxSkus(s);
  if (s.era === 'store') {
    out += `<div class="sect">New product lines</div>`;
    for (const id of LINE_ORDER) {
      const P = PRODUCTS[id], L = PRODUCT_LINES[id], have = productUnlocked(s, id);
      const fans = Object.values(ARCHETYPES).find((a) => a.requires === id);
      out += `<div class="card ${have ? 'owned' : ''}"><div class="row"><span class="swatch" style="background:${SCENTS[L.starter].color}">${productIcon(P.container)}</span><div class="grow"><div class="title">${P.name}</div><div class="muted">${P.blurb} ${L.desc}</div></div></div>
        <div class="row"><div class="chips grow"><span class="chip">${P.batch} per batch</span><span class="chip">from ${money(P.basePrice)}</span>${fans ? `<span class="chip pink">${fans.name}s</span>` : ''}</div>
        ${have ? `<span class="chip ok">✓ Developed</span>` : `<button class="btn sm" data-act="line" data-id="${id}" ${s.cash < L.cost || full ? 'disabled' : ''}>${money(L.cost)}</button>`}</div></div>`;
    }
  }
  const tier = TIERS[v.tier];
  out += `<div class="sect">Develop a new recipe <span>${money(VARIANT_COST)} R&amp;D</span></div><div class="card">
    <div class="tiny">Product</div><div class="pick">${PRODUCT_ORDER.filter((id) => productUnlocked(s, id)).map((id) => `<button class="${v.productId === id ? 'on' : ''}" data-act="vprod" data-id="${id}">${productIcon(PRODUCTS[id].container)} ${PRODUCTS[id].name}</button>`).join('')}</div>
    <div class="tiny">Scent</div><div class="pick">${SCENT_ORDER.map((id) => `<button class="${v.scentId === id ? 'on' : ''}" data-act="vscent" data-id="${id}"><span class="dotc" style="background:${SCENTS[id].color}"></span>${SCENTS[id].name}</button>`).join('')}</div>
    <div class="tiny">Formula</div><div class="pick">${TIERS.map((t) => `<button class="${v.tier === t.id ? 'on' : ''}" data-act="vtier" data-id="${t.id}">${t.name}</button>`).join('')}</div>
    <div class="muted">${tier.desc} Quality ${tier.quality}/100. Suggested price ${money(Math.round(PRODUCTS[v.productId].basePrice * tier.priceMult))}.</div>
    <button class="btn teal block" data-act="variant" ${exists || full || s.cash < VARIANT_COST ? 'disabled' : ''}>${full ? 'Recipe book is full' : exists ? 'You already make this' : s.cash < VARIANT_COST ? `Need ${money(VARIANT_COST)}` : `Create recipe · ${money(VARIANT_COST)}`}</button></div>`;
  return out;
}

// ---- Upgrades -----------------------------------------------------------------

export function upgradesPanel(s) {
  let out = `<div class="muted" style="padding:0 4px">Reinvest your profits. Every upgrade shows up in the workshop.</div>`;
  for (const id of UPGRADE_ORDER) {
    if (id === 'helper' && s.era === 'store') continue; // staff are hired in the Staff panel now
    const u = UPGRADES[id], owned = !!s.upgrades[id];
    out += `<div class="card ${owned ? 'owned' : ''}"><div class="row"><span class="swatch" style="background:${owned ? '#c6e3cf' : '#f6e4c4'}">${u.icon}</span><div class="grow"><div class="title">${u.name}</div><div class="muted">${u.desc}</div></div></div>
      <div class="row"><span class="chip teal grow" style="justify-content:center">${u.effect}</span>
      ${owned ? `<span class="chip ok">✓ Owned</span>` : `<button class="btn sm" data-act="upgrade" data-id="${id}" ${s.cash < u.cost ? 'disabled' : ''}>${money(u.cost)}</button>`}</div></div>`;
  }
  return out;
}

// ---- Marketing ----------------------------------------------------------------

export function marketingPanel(s) {
  const d = demandBreakdown(s);
  const f = (v) => `×${v.toFixed(2)}`;
  let out = `<div class="card"><div class="row"><div class="grow"><div class="title">${s.era === 'store' ? 'Online order demand' : 'Order demand'}</div><div class="muted">${s.era === 'store' ? 'Most local customers now visit the shop; online orders keep coming. Campaigns also bring walk-in shoppers.' : 'How often new orders arrive, and why.'}</div></div><span class="chip ${d.total >= 1.3 ? 'ok' : 'gold'}" style="font-size:15px">${f(d.total)}</span></div>
    <div class="kv"><span>⭐ Reputation</span><b>${f(d.rep)}</b></div><div class="kv"><span>💗 Brand Soul</span><b>${f(d.soul)}</b></div>
    <div class="kv"><span>📈 Word of mouth</span><b>${f(d.growth)}</b></div><div class="kv"><span>📣 Campaigns</span><b>${f(d.marketing)}</b></div>
    <div class="kv"><span>🏷️ Pricing</span><b class="${d.price < 0.9 ? 'neg' : ''}">${f(d.price)}</b></div><div class="kv"><span>🧴 Product range</span><b>${f(d.range)}</b></div>${d.channel < 1 ? `<div class="kv"><span>🏪 Shop takes local trade</span><b>${f(d.channel)}</b></div>` : ''}</div>
    <div class="sect">Campaigns</div>`;
  for (const id of CAMPAIGN_ORDER) out += campaignCard(s, id, 'orders');
  if (s.era === 'store') {
    out += `<div class="sect">In the shop</div>`;
    for (const id of STORE_CAMPAIGN_ORDER) out += campaignCard(s, id, 'shoppers');
    const st = s.store;
    out += `<div class="card ${st.loyalty ? 'owned' : ''}"><div class="row"><span class="swatch" style="background:#fbe4ea">💳</span><div class="grow"><div class="title">Loyalty Cards</div><div class="muted">${LOYALTY.desc}</div></div></div>
      <div class="row"><span class="chip pink grow" style="justify-content:center">Permanent</span>${st.loyalty ? `<span class="chip ok">✓ Running</span>` : `<button class="btn sm" data-act="loyalty" ${s.cash < LOYALTY.cost ? 'disabled' : ''}>${money(LOYALTY.cost)}</button>`}</div></div>`;
  }
  if (s.missedDemand > 0) out += `<div class="tiny" style="padding:0 4px">${s.missedDemand} would-be customers left because the order list was full.</div>`;
  return out;
}

function campaignCard(s, id, what) {
  const c = CAMPAIGNS[id];
  const active = s.marketing.active.some((a) => a.id === id);
  const cd = (s.marketing.cooldowns[id] || 0) > 0;
  return `<div class="card"><div class="row"><span class="swatch" style="background:#fbe4ea">${c.icon}</span><div class="grow"><div class="title">${c.name}</div><div class="muted">${c.desc}</div></div></div>
      ${active || cd ? `<div class="bar ${active ? 'pink' : ''}"><i data-live="campaign:${id}"></i></div>` : ''}
      <div class="row"><span class="chip pink">+${Math.round(c.boost * 100)}% ${what}</span><span class="grow tiny">${active ? 'Running now' : cd ? 'Cooling down' : ''}</span>
      <button class="btn sm" data-act="campaign" data-id="${id}" ${active || cd || s.cash < c.cost ? 'disabled' : ''}>${c.cost ? money(c.cost) : 'Free'}</button></div></div>`;
}

// Store profitability: straight from the ledger's daily category totals, so it always reconciles.
function storeProfitability(s) {
  const rows = profitReport(s, 7);
  let out = '';
  if (rows.length) {
    const max = Math.max(1, ...rows.map((d) => Math.max(d.revenue, d.expenses)));
    out += `<div class="sect">Store profitability <span>last ${rows.length} days</span></div><div class="card"><div class="pl-chart">${rows.map((d) => `<div class="pl-col" title="Day ${d.day}: in ${money(d.revenue)}, out ${money(d.expenses)}"><div class="pl-bars"><i class="in" style="height:${(d.revenue / max) * 70}px"></i><i class="out" style="height:${(d.expenses / max) * 70}px"></i></div><b class="${d.profit >= 0 ? 'pos' : 'neg'}">${money(d.profit)}</b><span>D${d.day}</span></div>`).join('')}</div>
      <div class="tiny"><span class="key in"></span> money in <span class="key out"></span> money out</div></div>`;
    const last = rows[rows.length - 1];
    const margin = last.revenue > 0 ? Math.round((last.profit / last.revenue) * 100) : 0;
    out += `<div class="sect">Yesterday · Day ${last.day}</div><div class="card">
      <div class="kv"><span>Store sales</span><b class="pos">${money(last.store, true)}</b></div><div class="kv"><span>Online orders</span><b class="pos">${money(last.online, true)}</b></div>
      ${last.otherIncome > 0.005 ? `<div class="kv"><span>Other income</span><b class="pos">${money(last.otherIncome, true)}</b></div>` : ''}
      ${last.groups.filter((g) => g.value > 0.005).map((g) => `<div class="kv"><span>${g.label}</span><b class="neg">${money(-g.value, true)}</b></div>`).join('')}
      <div class="kv total"><span>Net profit${last.revenue > 0 ? ` · ${margin}% margin` : ''}</span><b class="${last.profit >= 0 ? 'pos' : 'neg'}">${money(last.profit, true)}</b></div>
      ${last.visitors ? `<div class="tiny">${last.visitors} visitors, ${last.buyers} bought: ${money(last.store / Math.max(1, last.visitors), true)} per visitor.</div>` : ''}</div>`;
  }
  const sold = s.skus.filter((k) => k.storeSold > 0).sort((a, b) => b.storeRevenue - a.storeRevenue);
  if (sold.length) {
    out += `<div class="sect">Best sellers in the shop</div><div class="card">${sold.slice(0, 8).map((k) => {
      const cost = unitCost(s, k), margin = k.price - cost;
      return `<div class="row">${skuSwatch(k, 'sm')}<div class="grow"><div class="title" style="font-size:13px">${esc(k.name)}</div><div class="tiny">${k.storeSold} sold · ${money(margin, true)} profit each</div></div><b class="pos" style="font-size:13px">${money(k.storeRevenue)}</b></div>`;
    }).join('')}</div>`;
  }
  return out;
}

// ---- Reports ------------------------------------------------------------------

export function reportsPanel(s) {
  const L = s.ledger, t = L.today;
  const profit = todayProfit(s);
  const margin = t.revenue > 0 ? Math.round((profit / t.revenue) * 100) : 0;
  let out = '';
  if (s.store) {
    const st = s.store, td = st.today;
    out += `<div class="sect">Shop floor today</div><div class="card"><div class="kv"><span>Store sales</span><b class="pos">${money(td.revenue, true)}</b></div><div class="kv"><span>Visitors · bought · left</span><b>${td.visitors} · ${td.buyers} · ${td.walkouts}</b></div><div class="kv"><span>Units sold in store</span><b>${td.items}</b></div><div class="kv"><span>Store rating</span><b>★ ${st.reputation.toFixed(1)}</b></div></div>`;
    out += storeProfitability(s);
  }
  out += `<div class="sect">Today · Day ${s.time.day}</div><div class="card">
    <div class="kv"><span>Revenue</span><b class="pos">${money(t.revenue, true)}</b></div><div class="kv"><span>Expenses</span><b class="neg">${money(-t.expenses, true)}</b></div>
    <div class="kv total"><span>Net profit${t.revenue > 0 ? ` · ${margin}% margin` : ''}</span><b class="${profit >= 0 ? 'pos' : 'neg'}">${money(profit, true)}</b></div></div>`;
  const days = L.days.slice(-8);
  if (days.length) {
    const max = Math.max(1, ...days.map((d) => Math.abs(d.profit)));
    out += `<div class="sect">Daily profit</div><div class="card"><div class="chart">${days.map((d) => `<div class="col" title="Day ${d.day}: revenue ${money(d.revenue)}, expenses ${money(d.expenses)}"><span>${money(d.profit)}</span><i class="${d.profit < 0 ? 'neg' : ''}" style="height:${Math.max(4, (Math.abs(d.profit) / max) * 60)}px"></i>D${d.day}</div>`).join('')}</div></div>`;
  }
  const cats = Object.entries(L.lifetime).filter(([c]) => c !== 'Opening balance');
  const inc = cats.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const exp = cats.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const totInc = inc.reduce((a, [, v]) => a + v, 0), totExp = exp.reduce((a, [, v]) => a - v, 0);
  out += `<div class="sect">All time</div><div class="card">`;
  for (const [c, v] of inc) out += `<div class="kv"><span>${c}</span><b class="pos">${money(v)}</b></div><div class="bar green"><i style="width:${(v / Math.max(1, totInc)) * 100}%"></i></div>`;
  for (const [c, v] of exp) out += `<div class="kv"><span>${c}</span><b class="neg">${money(v)}</b></div><div class="bar red"><i style="width:${(-v / Math.max(1, totExp)) * 100}%"></i></div>`;
  if (!cats.length) out += `<div class="empty">No transactions yet.</div>`;
  out += `<div class="kv total"><span>Lifetime profit</span><b class="${totInc - totExp >= 0 ? 'pos' : 'neg'}">${money(totInc - totExp)}</b></div></div>`;
  const st = s.stats, tot = st.ordersFulfilled + st.ordersExpired;
  out += `<div class="sect">Service</div><div class="card"><div class="kv"><span>Orders fulfilled</span><b>${st.ordersFulfilled}</b></div><div class="kv"><span>Shipped on time</span><b>${st.ordersFulfilled ? Math.round((st.onTime / st.ordersFulfilled) * 100) : 100}%</b></div>
    <div class="kv"><span>Orders missed</span><b class="${st.ordersExpired ? 'neg' : ''}">${st.ordersExpired}${tot ? ` (${Math.round((st.ordersExpired / tot) * 100)}%)` : ''}</b></div><div class="kv"><span>Units made / sold</span><b>${st.unitsMade} / ${st.unitsSold}</b></div></div>`;
  out += `<div class="sect">Latest reviews <span>★ ${s.reputation.toFixed(1)}</span></div>`;
  const revs = s.reviews.slice(-6).reverse();
  if (!revs.length) out += `<div class="empty">No reviews yet. Ship an order!</div>`;
  for (const r of revs) out += `<div class="review"><div class="row"><span class="st">${starStr(r.stars)}</span><span class="tiny grow">${esc(r.customer)} · Day ${r.day}</span></div><div class="muted" style="color:var(--ink)">“${esc(r.text)}”</div>${r.product ? `<div class="tiny">${esc(r.product)}</div>` : ''}</div>`;
  out += `<div class="sect">Recent transactions</div><div class="card" style="gap:5px">${L.entries.slice(-10).reverse().map((e) => `<div class="kv"><span class="tiny">D${e.day} · ${esc(e.cat)}${e.note ? ` · ${esc(e.note)}` : ''}</span><b class="${e.amount >= 0 ? 'pos' : 'neg'}">${money(e.amount, true)}</b></div>`).join('')}</div>`;
  return out;
}

export function staffPanel() {
  return `<div class="empty" style="padding:30px 16px"><div class="lockico">${ICONS.lock}</div><div class="title" style="margin:8px 0 4px">Staff opens with your first store</div>Sales associates, cashiers and stockers join the team once you have a shop floor for them. For now, the Weekend Helper in Upgrades can lend a hand.</div>`;
}

// ---- Orders rail ----------------------------------------------------------------

// Returns one entry per order so the rail can update cards in place (keyed by id).
export function orderCards(s) {
  const orders = [...s.orders].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || a.deadline - b.deadline);
  return orders.map((o) => {
    const ready = canFulfill(s, o);
    const cls = o.status !== 'open' ? 'busy' : ready ? 'ready' : '';
    const icon = o.channel === 'Big orders' ? '🏢' : o.channel === 'Local orders' ? '🧺' : '💻';
    return { id: o.id, cls, html: `<div class="row"><span title="${o.channel}">${icon}</span><span class="who">${esc(o.customer)}</span><span class="total">${money(o.total)}</span></div>
      ${o.lines.map((l) => { const sku = s.skus.find((k) => k.id === l.skuId); const have = stockFor(s, l.skuId); return `<div class="line">${skuSwatch(sku, 'sm')}<span class="nm">${l.qty} × ${esc(sku.name)}</span>${o.status === 'open' ? `<span class="have ${have >= l.qty ? '' : 'no'}">${Math.min(have, l.qty)}/${l.qty}</span>` : ''}</div>`; }).join('')}
      ${o.status === 'open' ? `<div class="timebar"><i data-live="order:${o.id}"></i></div><div class="row"><span class="tiny grow" data-live="ordertime:${o.id}"></span><button class="btn sm ${ready ? 'teal' : ''}" data-act="fulfill" data-id="${o.id}" ${ready ? '' : 'disabled'}>${ready ? 'Fulfill' : 'Need stock'}</button></div>`
      : `<div class="row"><span class="chip teal">${o.status === 'packing' ? '📦 Being packed…' : '⏳ Waiting to be packed'}</span></div>`}` };
  });
}

export { HOME_GOALS };
