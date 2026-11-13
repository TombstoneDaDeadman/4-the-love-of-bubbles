// Era II panels: build mode, the shop floor overview, a display inspector and staff.
// Same contract as panels.js: pure functions of state returning HTML strings.

import { FURNITURE, FURNITURE_ORDER, STAFF_ROLES, STAFF_ROLE_ORDER, STORE, ARCHETYPES, SELL_BACK, SHIFTS, SHIFT_ORDER } from '../data.js';
import { trafficBreakdown, unitsOnDisplay, isDisplay, designScore, cleanliness } from '../sim/store.js';
import { wagesPerDay, wageToday, onShift } from '../sim/staff.js';
import { money, esc, starStr, skuSwatch } from './panels.js';
import { ICONS } from './icons.js';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const statBar = (label, v) => `<div class="kv"><span class="tiny">${label}</span><div class="bar ${v >= 1 ? 'green' : v >= 0.9 ? 'gold' : 'red'}" style="width:110px;align-self:center"><i style="width:${Math.min(100, ((v - 0.6) / 0.7) * 100)}%"></i></div></div>`;

function displayName(fu, state) {
  const F = FURNITURE[fu.type];
  const same = state.store.furniture.filter((f) => f.type === fu.type);
  return `${F.name} ${same.length > 1 ? same.indexOf(fu) + 1 : ''}`.trim();
}

function slotRow(s, fu, k, compact = false) {
  const slot = fu.slots[k], cap = FURNITURE[fu.type].slotCap;
  const sku = slot.skuId && s.skus.find((x) => x.id === slot.skuId);
  if (!sku) return `<div class="row"><span class="swatch sm ink" style="background:#efe5d6">–</span><span class="grow muted">Empty slot</span></div>`;
  const low = slot.stock < cap * STORE.restockBelow;
  return `<div class="row">${skuSwatch(sku, 'sm')}<div class="grow"><div class="title" style="font-size:13px">${esc(sku.name)}</div>
    <div class="bar ${slot.stock === 0 ? 'red' : low ? 'gold' : 'green'}"><i style="width:${(slot.stock / cap) * 100}%"></i></div></div>
    <b style="font-size:13px;min-width:44px;text-align:right">${slot.stock}/${cap}</b>${compact ? '' : `<span class="chip ${s.goods[sku.id] ? '' : 'bad'}" title="In back stock">${s.goods[sku.id]} back</span>`}</div>`;
}

// ---- Build ---------------------------------------------------------------------------------

export function buildPanel(s, ui) {
  const bm = ui.bm;
  let out = '';
  if (bm.placing) {
    const F = FURNITURE[bm.placing];
    out += `<div class="card build-live"><div class="row"><span class="swatch" style="background:#d9f0e3">${F.icon}</span><div class="grow"><div class="title">${bm.moving ? 'Moving' : 'Placing'} ${F.name}</div>
      <div class="muted">Click the floor to ${bm.moving ? 'set it down' : `place it for ${money(F.cost)}`}. <kbd>R</kbd> rotates, <kbd>Esc</kbd> or right-click cancels.</div></div></div>
      <div class="row"><button class="btn sm ghost" data-act="b-rot">Rotate ⟳</button><span class="grow"></span><button class="btn sm ghost" data-act="b-cancel">Cancel</button></div></div>`;
  } else if (bm.selected && s.store.furniture.some((f) => f.id === bm.selected)) {
    const fu = s.store.furniture.find((f) => f.id === bm.selected), F = FURNITURE[fu.type];
    out += `<div class="card build-live"><div class="row"><span class="swatch" style="background:#fbe4ea">${F.icon}</span><div class="grow"><div class="title">${esc(displayName(fu, s))}</div><div class="muted">${F.desc}</div></div></div>
      ${fu.slots.map((_, k) => slotRow(s, fu, k, true)).join('')}
      <div class="row wrap"><button class="btn sm teal" data-act="b-move" data-id="${fu.id}">Move</button><button class="btn sm ghost" data-act="b-rotsel" data-id="${fu.id}">Rotate ⟳</button>
      ${fu.slots.length ? `<button class="btn sm ghost" data-act="inspect" data-id="${fu.id}">Products</button>` : ''}<span class="grow"></span>
      <button class="btn sm ghost" data-act="b-sell" data-id="${fu.id}" title="Stock on it goes to back stock">Sell +${money(F.cost * SELL_BACK)}</button></div></div>`;
  } else {
    out += `<div class="muted" style="padding:0 4px">Pick an item to place, or click anything on the shop floor to move, rotate or sell it. Aisles, the till line and the doorways stay clear (shaded pink).</div>`;
  }
  out += designCard(s);
  out += `<div class="sect">Catalogue</div>`;
  for (const id of FURNITURE_ORDER) {
    const F = FURNITURE[id];
    const chips = F.slots ? `<span class="chip">${F.slots} product${F.slots > 1 ? 's' : ''} · ${F.slotCap} each</span>${F.visibility > 1 ? '<span class="chip pink">Eye-catching</span>' : ''}` : `<span class="chip ok">+${F.appeal} appeal</span>`;
    out += `<div class="card ${bm.placing === id && !bm.moving ? 'owned' : ''}"><div class="row"><span class="swatch" style="background:#f6e4c4">${F.icon}</span><div class="grow"><div class="title">${F.name}</div><div class="muted">${F.desc}</div></div></div>
      <div class="row"><div class="chips grow">${chips}</div><button class="btn sm" data-act="b-place" data-id="${id}" ${s.cash < F.cost ? 'disabled' : ''}>${money(F.cost)}</button></div></div>`;
  }
  return out;
}

function designCard(s) {
  const d = designScore(s);
  return `<div class="sect">Store design <span>${d.total} / 100</span></div><div class="card">
    <div class="bar ${d.total >= 70 ? 'green' : d.total >= 45 ? 'gold' : 'red'}"><i style="width:${d.total}%"></i></div>
    ${d.parts.map((p) => `<div class="kv" title="${esc(p.tip)}"><span class="tiny">${p.label}</span><b style="font-size:12.5px">${p.value} / ${p.max}</b></div>`).join('')}
    <div class="tiny">A better-designed shop draws more people in and puts them in a good mood.</div></div>`;
}

function cleanCard(s) {
  const st = s.store, c = cleanliness(s);
  return `<div class="kv"><span>Cleanliness</span><div class="bar ${c >= 70 ? 'green' : c >= 45 ? 'gold' : 'red'}" style="width:110px;align-self:center"><i style="width:${c}%"></i></div></div>
    ${st.messes.length ? `<div class="tiny">${st.messes.length} spill${st.messes.length > 1 ? 's' : ''} on the floor. Associates and stockers tidy between jobs.</div>` : ''}`;
}

// ---- Shop floor overview ---------------------------------------------------------------------

export function storePanel(s) {
  const st = s.store, t = st.today;
  const tr = trafficBreakdown(s);
  let out = `<div class="card"><div class="row"><div class="grow"><div class="title">Store rating</div><div class="muted">From how shoppers felt on their way out.</div></div>
    <span class="chip gold" style="font-size:15px">★ ${st.reputation.toFixed(1)}</span></div>
    <div class="kv"><span>Shoppers inside now</span><b>${st.customers.length}${st.queue.length ? ` · ${st.queue.length} in line` : ''}</b></div>
    <div class="kv"><span>Visitors today</span><b>${t.visitors}</b></div>
    <div class="kv"><span>Bought something</span><b>${t.buyers}${t.visitors ? ` (${pct(t.buyers, t.buyers + t.walkouts)}%)` : ''}</b></div>
    <div class="kv"><span>Left empty-handed</span><b class="${t.walkouts ? 'neg' : ''}">${t.walkouts}</b></div>
    <div class="kv"><span>Store sales today</span><b class="pos">${money(t.revenue, true)}</b></div>
    ${cleanCard(s)}
    <div class="kv"><span>Store design</span><b>${designScore(s).total} / 100</b></div>
    <div class="kv"><span>Till</span><b>${st.till ? (st.till === 'founder' ? `${esc(s.founder.name)} is serving` : 'Staffed') : st.staff.some((x) => x.role === 'cashier') ? 'Cashier on the way' : `${esc(s.founder.name)} comes out when someone is waiting`}</b></div></div>`;
  const reasons = Object.entries(t.reasons || {});
  if (reasons.length || t.stockouts) {
    const label = { stockout: 'Couldn’t find what they wanted', line: 'Gave up in the checkout line', nothing: 'Nothing caught their eye' };
    out += `<div class="sect">${reasons.length ? 'Why shoppers left today' : 'Missed sales today'}</div><div class="card">${reasons.map(([k, v]) => `<div class="kv"><span>${label[k] || k}</span><b class="neg">${v}</b></div>`).join('')}
      ${t.stockouts ? `<div class="tiny">${t.stockouts} times a shopper found an empty spot on a display. Keep the back room cooking and the shelves stocked.</div>` : ''}</div>`;
  }
  out += `<div class="sect">Foot traffic <span>×${tr.total.toFixed(2)} now</span></div><div class="card">
    ${statBar('⭐ Ratings & reviews', tr.rep)}${statBar('💗 Brand Soul', tr.soul)}${statBar('🪴 Store design', tr.appeal)}${statBar('📈 Word of mouth', tr.growth)}${statBar('📣 Campaigns', tr.marketing)}
    <div class="tiny">Busiest around lunch and after work. ${st.today.missed ? `${st.today.missed} people turned away at the door: the shop was full.` : ''}</div></div>`;
  const displays = st.furniture.filter(isDisplay);
  out += `<div class="sect">Displays <span>${unitsOnDisplay(s)} units out</span></div>`;
  for (const fu of displays) {
    out += `<div class="card clickable" data-act="inspect" data-id="${fu.id}"><div class="row"><span class="title grow">${esc(displayName(fu, s))}</span><span class="tiny">Change ›</span></div>${fu.slots.map((_, k) => slotRow(s, fu, k)).join('')}</div>`;
  }
  if (st.customers.length) {
    const by = {};
    for (const c of st.customers) by[c.arch] = (by[c.arch] || 0) + 1;
    out += `<div class="sect">Who’s shopping</div><div class="card">${Object.entries(by).map(([k, v]) => `<div class="kv"><span title="${esc(ARCHETYPES[k].note)}">${ARCHETYPES[k].name}</span><b>${v}</b></div>`).join('')}</div>`;
  }
  const revs = s.reviews.filter((r) => r.source === 'store').slice(-4).reverse();
  if (revs.length) {
    out += `<div class="sect">In-store reviews</div>`;
    for (const r of revs) out += `<div class="review"><div class="row"><span class="st">${starStr(r.stars)}</span><span class="tiny grow">${esc(r.customer)} · Day ${r.day}</span></div><div class="muted" style="color:var(--ink)">“${esc(r.text)}”</div></div>`;
  }
  return out;
}

// ---- One display ---------------------------------------------------------------------------------

export function displayPanel(s, ui) {
  const fu = s.store.furniture.find((f) => f.id === ui.inspectId);
  if (!fu) return `<div class="empty">That display is gone.</div>`;
  const F = FURNITURE[fu.type];
  let out = `<div class="muted" style="padding:0 4px">${F.desc} Staff refill each slot from back stock when it drops below the level you set.</div>`;
  fu.slots.forEach((slot, k) => {
    out += `<div class="sect">${fu.slots.length > 1 ? (k === 0 ? 'Left side' : 'Right side') : 'Featured product'}</div><div class="card">${slotRow(s, fu, k)}
      <div class="tiny">Show on this ${fu.type}:</div><div class="pick">${s.skus.map((sku) => `<button class="${slot.skuId === sku.id ? 'on' : ''}" data-act="slot" data-id="${fu.id}" data-k="${k}" data-sku="${sku.id}">${skuSwatch(sku, 'sm')} ${esc(sku.name)} <span class="tiny">${s.goods[sku.id]}</span></button>`).join('')}
      <button class="${slot.skuId ? '' : 'on'}" data-act="slot" data-id="${fu.id}" data-k="${k}" data-sku="">Nothing</button></div>
      ${slot.skuId ? `<div class="tiny">Refill when it drops below:</div><div class="pick">${STORE.refillLevels.map((lv) => `<button class="${(slot.refill ?? 0.5) === lv ? 'on' : ''}" data-act="refill" data-id="${fu.id}" data-k="${k}" data-lv="${lv}">${lv === 0.25 ? 'A quarter' : lv === 0.5 ? 'Half' : 'Nearly full'}</button>`).join('')}</div>
      <div class="row"><span class="tiny grow">${slot.rush ? 'Restock requested: the next free pair of hands brings it out.' : 'Higher refill levels look fuller but keep staff busier.'}</span><button class="btn sm ${slot.rush ? 'ghost' : 'teal'}" data-act="rush" data-id="${fu.id}" data-k="${k}" ${slot.rush ? 'disabled' : ''}>Restock now</button></div>` : ''}</div>`;
  });
  out += `<div class="row" style="padding:0 4px"><button class="btn sm ghost" data-act="b-edit" data-id="${fu.id}">Move or sell in Build mode</button></div>`;
  return out;
}

// ---- Staff ----------------------------------------------------------------------------------------

const stat = (label, v) => `<span class="chip ${v >= 1.1 ? 'ok' : v < 0.95 ? 'gold' : ''}">${label} ${Math.round(v * 100)}</span>`;

export function storeStaffPanel(s) {
  const st = s.store;
  let out = `<div class="card"><div class="kv"><span>Team</span><b>${st.staff.length} / ${STORE.maxStaff}</b></div><div class="kv"><span>Wages</span><b class="neg">${money(wagesPerDay(s))} / day</b></div>
    <div class="tiny">Wages are paid at closing time with rent (${money(STORE.rent)}) and utilities. Opening and closing shifts cost a little over half a day. When nobody is on the till, ${esc(s.founder.name)} leaves the workroom to ring up sales.</div></div>`;
  out += `<div class="sect">Your team</div>`;
  if (!st.staff.length) out += `<div class="empty">Just you for now.</div>`;
  for (const rec of st.staff) {
    const R = STAFF_ROLES[rec.role];
    const actor = s.actors.find((a) => a.id === rec.id);
    const status = rec.training ? `Training ${rec.training}` : !onShift(s, rec) ? `Off until ${SHIFTS[rec.shift].from ? '2 PM' : 'tomorrow'}` : actor && actor.task ? actor.task.label : 'Ready';
    const canTrain = !rec.training && onShift(s, rec) && s.cash >= STORE.trainCost;
    out += `<div class="card"><div class="row"><span class="swatch" style="background:#d6ecea">${R.icon}</span><div class="grow"><div class="title">${esc(rec.name)}</div><div class="muted">${R.name} · ${esc(status)}</div></div><b class="neg" style="font-size:13px">${money(wageToday(rec))}/day</b></div>
      <div class="chips">${stat('Speed', rec.speed)}${stat('Service', rec.service)}<span class="chip" title="Every three days worked, a little better at everything">${rec.xp || 0} day${rec.xp === 1 ? '' : 's'} experience</span></div>
      <div class="tiny">Role</div><div class="pick">${STAFF_ROLE_ORDER.map((r) => `<button class="${rec.role === r ? 'on' : ''}" data-act="s-role" data-id="${rec.id}" data-role="${r}">${STAFF_ROLES[r].icon} ${STAFF_ROLES[r].name}</button>`).join('')}</div>
      <div class="tiny">Shift</div><div class="pick">${SHIFT_ORDER.map((sh) => `<button class="${(rec.shift || 'full') === sh ? 'on' : ''}" data-act="s-shift" data-id="${rec.id}" data-shift="${sh}">${SHIFTS[sh].name}</button>`).join('')}</div>
      <div class="row wrap"><button class="btn sm ghost" data-act="s-train" data-id="${rec.id}" data-skill="speed" ${canTrain && rec.speed < STORE.statCap ? '' : 'disabled'}>Train speed · ${money(STORE.trainCost)}</button><button class="btn sm ghost" data-act="s-train" data-id="${rec.id}" data-skill="service" ${canTrain && rec.service < STORE.statCap ? '' : 'disabled'}>Train service · ${money(STORE.trainCost)}</button><span class="grow"></span><button class="btn sm ghost" data-act="s-fire" data-id="${rec.id}">Let go</button></div></div>`;
  }
  out += `<div class="sect">Looking for work <span>new faces each morning</span></div>`;
  for (const c of st.candidates) {
    out += `<div class="card"><div class="row"><span class="swatch" style="background:#f6e4c4">${ICONS.staff}</span><div class="grow"><div class="title">${esc(c.name)}</div><div class="muted">Would like ${STAFF_ROLES[c.role].name.toLowerCase()} work</div></div><b style="font-size:13px">${money(c.wage)}/day</b></div>
      <div class="chips">${stat('Speed', c.speed)}${stat('Service', c.service)}</div>
      <div class="row wrap">${STAFF_ROLE_ORDER.map((r) => `<button class="btn sm ${r === c.role ? 'teal' : 'ghost'}" data-act="s-hire" data-id="${c.id}" data-role="${r}" ${st.staff.length >= STORE.maxStaff || s.cash < STORE.hireFee ? 'disabled' : ''}>Hire as ${STAFF_ROLES[r].name}</button>`).join('')}</div></div>`;
  }
  out += `<div class="tiny" style="padding:0 4px">Hiring costs ${money(STORE.hireFee)} up front.</div><div class="sect">Roles</div>`;
  for (const r of STAFF_ROLE_ORDER) out += `<div class="card"><div class="row"><span class="swatch" style="background:#eef5f1">${STAFF_ROLES[r].icon}</span><div class="grow"><div class="title">${STAFF_ROLES[r].name}</div><div class="muted">${STAFF_ROLES[r].desc}</div></div></div></div>`;
  out += `<div class="tiny" style="padding:0 4px">Training takes them off the floor for a little while at the office laptop, and the improvement is permanent.</div>`;
  return out;
}
