// The "How to play" guide: one tab per chapter plus controls. Each topic is a short card; topics
// tied to a panel get a "Show me" button in game. Chapters the player has not reached yet stay
// closed with a one-line teaser, so the guide never spoils what comes next.
//
// Used from the title screen (no game running) and from inside the game.

import { ICONS } from './icons.js';

export const GUIDE = [
  {
    id: 'home', title: 'Chapter One', sub: 'The home business', icon: '🏡',
    intro: 'You make every jar by hand in your own kitchen. Buy ingredients, cook batches, pack orders, and save up until the business outgrows the house.',
    topics: [
      { icon: ICONS.supplies, title: 'Buy supplies', panel: 'supplies', body: 'Ingredients and packaging come in lots from different suppliers and take a little while to arrive. Press <b>Fill for 1 batch each</b> if you are not sure what to buy. The pantry has limited room.' },
      { icon: ICONS.production, title: 'Make a batch', panel: 'production', body: 'Pick a recipe and press <b>Make batch</b>. The ingredients leave the pantry straight away. You carry them to the stove, it cooks, and you shelve the finished units. Cancel a queued batch to get everything back; cancelling one already cooking wastes it.' },
      { icon: ICONS.bag, title: 'Fill orders', body: 'Orders appear on the right with a timer. When you have the stock, press <b>Fulfill</b>; you pack it by hand and ship it. Late or missed orders mean weaker reviews.' },
      { icon: ICONS.recipes, title: 'Recipes, quality and prices', panel: 'recipes', body: 'Develop new scents and richer formulas (Classic, Botanical, Luxe) in the Recipe Book. Better formulas cost more to make and earn better reviews. Set prices with care: too high and fewer people order.' },
      { icon: ICONS.upgrades, title: 'Upgrades', panel: 'upgrades', body: 'Reinvest in a stand mixer, shelving, a label printer, a second workstation, a bigger pot and a weekend helper. Every upgrade appears in the room.' },
      { icon: ICONS.marketing, title: 'Marketing', panel: 'marketing', body: 'Campaigns bring more orders for a while. The Marketing panel also explains exactly where your demand comes from.' },
      { icon: ICONS.star, title: 'Reputation and Brand Soul', body: '<b>Reputation</b> is the average of your recent reviews. <b>Brand Soul</b> is the handmade heart of the business: quality formulas and reliable service raise it; missed orders and gouging wear it down. Both bring more customers.' },
      { icon: ICONS.store, title: 'Outgrow the kitchen', body: 'The bar at the bottom tracks your road to a first store: revenue, orders, rating and upgrades. Hit them all, then sign the lease.' },
    ],
  },
  {
    id: 'store', title: 'Chapter Two', sub: 'The first store', icon: '🏪', teaser: 'Opens when you sign the lease on a shop of your own.',
    intro: 'Customers now walk in. They browse your displays, queue at the till and decide how they feel about the place on the way out.',
    topics: [
      { icon: ICONS.store, title: 'Shoppers', panel: 'store', body: 'Every shopper has a type (regulars, bargain hunters, gift buyers and more), a budget, some patience and a short list. Empty displays, high prices and long lines send them home unhappy. Their mood becomes your <b>store rating</b>, which brings more people in.' },
      { icon: ICONS.supplies, title: 'Displays and back stock', body: '<b>Click a shelf or table</b> to choose what it shows. What you make goes to back stock in the workroom; someone has to carry it out to the displays.' },
      { icon: ICONS.bag, title: 'Restocking', body: 'Staff refill a display when it drops below the level you set on it (a quarter, half or nearly full). Press <b>Restock now</b> to send someone straight away.' },
      { icon: ICONS.staff, title: 'Staff and roles', panel: 'staff', body: '<b>Cashier</b> works the till. <b>Sales Associate</b> helps shoppers, restocks and tidies. <b>Stocker</b> keeps displays full and the floor clean. <b>Production Worker</b> runs the stove so you don\'t have to. With nobody on the till, you leave the workroom to serve.' },
      { icon: ICONS.profit, title: 'Shifts and training', panel: 'staff', body: 'Put people on all-day, opening or closing shifts (half shifts cost a bit over half). Training at the office laptop costs money and a little time, and makes them permanently faster or friendlier. Everyone improves with experience too.' },
      { icon: ICONS.heart, title: 'Keep it clean', body: 'Busy floors wear down and shoppers spill things. A grubby shop lowers moods, your design score and, at closing, Brand Soul. Associates and stockers tidy between jobs.' },
      { icon: ICONS.build, title: 'Build mode', panel: 'build', body: 'Place, move, rotate (<kbd>R</kbd>) and sell shelves, tables, a tester bar, benches, lamps and plants. Aisles, the till line and doorways stay clear, and the game will not let you block anything.' },
      { icon: ICONS.star, title: 'Store design', panel: 'build', body: 'Your design score (variety, full displays, decor, cleanliness, room to browse, a welcome display by the door) draws people in and puts them in a good mood.' },
      { icon: ICONS.recipes, title: 'New product lines', panel: 'recipes', body: 'Hair oil, bath bombs and gift sets each bring new shoppers: Hair-Care, Trend and Gift Shoppers.' },
      { icon: ICONS.marketing, title: 'Local marketing', panel: 'marketing', body: 'Refresh the window display, advertise in the Gazette, host a workshop night, or start loyalty cards for your regulars.' },
      { icon: ICONS.reports, title: 'Reports', panel: 'reports', body: 'Each day\'s profit and loss, where the money went, and your best sellers. Every number comes straight from the ledger.' },
    ],
  },
  {
    id: 'chain', title: 'Chapter Three', sub: 'The retail chain', icon: '🌱', teaser: 'Opens once your first store is truly established.',
    intro: 'The brand grows into a chain. Instead of doing everything yourself, you choose places, people and systems, and keep the whole thing feeling handmade.',
    topics: [
      { icon: ICONS.chain, title: 'Choose a location', panel: 'stores', body: 'Each neighbourhood has its own rent, foot traffic, spending power and crowd. Old Town Lane loves gifts; the University Quarter loves bargains and trends.' },
      { icon: ICONS.store, title: 'Switch between shops', panel: 'stores', body: 'Click the shop name in the top bar, or <b>Go there</b> in the Chain panel. Every shop keeps trading while you are somewhere else.' },
      { icon: ICONS.staff, title: 'Store managers', panel: 'staff', body: 'A <b>Store Manager</b> runs a branch for you: covers the till, restocks, tidies, and orders stock from Main Street on their own. Hire one first in every new shop, plus a cashier.' },
      { icon: ICONS.supplies, title: 'Send stock', panel: 'stores', body: 'Products are made in Main Street\'s workroom. Send stock to any shop by courier from the Chain panel; it takes a little while on the road.' },
      { icon: ICONS.kitchen, title: 'The central kitchen', panel: 'kitchen', body: 'Two stoves cannot feed a chain. A central kitchen runs production lines on its own, buys ingredients in bulk and fills a warehouse.' },
      { icon: ICONS.profit, title: 'Deliveries and forecasting', panel: 'kitchen', body: 'Trucks leave the warehouse every morning (and at midday, if you like) to top up every shop, either to a fixed level or to a forecast from yesterday\'s sales.' },
      { icon: ICONS.company, title: 'Wholesale contracts', panel: 'company', body: 'Spas, salons and hotels offer contracts: a set amount every morning for a few days. Completing one lifts Brand Soul; missing deliveries costs money and goodwill.' },
      { icon: ICONS.heart, title: 'Regional manager and the brand', panel: 'company', body: 'A regional manager balances stock between shops and keeps every shop a little better. The Company panel shows revenue by channel, your quality index, Brand Soul, and the big goals that finish the story.' },
    ],
  },
  {
    id: 'controls', title: 'Controls', sub: 'Camera and keys', icon: '🎮',
    intro: 'Click things in the world to open what they belong to. Hover for a hint.',
    keys: [
      ['Drag', 'Rotate the camera'], ['Scroll / pinch', 'Zoom in and out'], ['W A S D / arrows', 'Move the camera'], ['Shift + drag', 'Pan the camera'],
      ['Q / E', 'Rotate the camera'], ['Space', 'Pause'], ['1 / 2 / 3', 'Game speed'], ['R', 'Rotate a fixture in build mode'],
      ['Esc / right-click', 'Cancel placing, close a panel, open the menu'], ['?', 'Open this guide'],
    ],
  },
];

// Which chapters are open for this state (or, with no game, only the first).
export function openChapters(state) {
  const open = { home: true, controls: true, store: false, chain: false };
  if (state) {
    open.store = state.era === 'store' || !!(state.milestone && state.milestone.leaseSigned);
    open.chain = !!(state.milestone && state.milestone.chainReady);
  }
  return open;
}
export function currentChapter(state) {
  if (!state) return 'home';
  if (state.milestone && state.milestone.chainReady) return 'chain';
  if (state.era === 'store') return 'store';
  return 'home';
}

// The guide's HTML. `canShow(panelId)` says whether a "Show me" button can be offered.
export function guideHtml(chapterId, state, canShow = () => false) {
  const open = openChapters(state);
  const ch = GUIDE.find((c) => c.id === chapterId) || GUIDE[0];
  const tabs = GUIDE.map((c) => `<button class="${c.id === ch.id ? 'on' : ''} ${open[c.id] ? '' : 'locked'}" data-guide="${c.id}"><span>${c.icon}</span><b>${c.title}</b><small>${c.sub}</small></button>`).join('');
  let body;
  if (!open[ch.id]) {
    body = `<div class="guide-locked"><div class="lockico">${ICONS.lock}</div><h3>${ch.title}: ${ch.sub}</h3><p>${ch.teaser}</p></div>`;
  } else if (ch.keys) {
    body = `<p class="muted">${ch.intro}</p><div class="keys">${ch.keys.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('')}</div>`;
  } else {
    body = `<p class="guide-intro">${ch.intro}</p><div class="guide-topics">${ch.topics.map((t, i) => `<div class="guide-topic"><span class="gi">${t.icon}</span><div><b>${i + 1}. ${t.title}</b><p>${t.body}</p>${t.panel && canShow(t.panel) ? `<button class="btn sm ghost" data-showme="${t.panel}">Show me</button>` : ''}</div></div>`).join('')}</div>`;
  }
  return `<div class="guide"><h2>How to play</h2><div class="guide-tabs">${tabs}</div><div class="guide-body">${body}</div></div>`;
}
