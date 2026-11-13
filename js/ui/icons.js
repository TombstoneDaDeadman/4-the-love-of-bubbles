// A small hand-drawn icon set (24px grid, rounded strokes) so the interface looks the same on
// every device instead of depending on the system's emoji font.

const svg = (body, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const T = 'fill="var(--ic-tint, rgba(255,255,255,.55))"';

export const ICONS = {
  production: svg(`<path ${T} d="M5 10.500h14V16a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M3 10.500h18"/><path d="M9.200 7.200c0-1.300 1.200-1.500 1.200-3M13.800 7.200c0-1.300 1.200-1.500 1.200-3"/>`),
  supplies: svg(`<path ${T} d="M4 8.200l8-4 8 4v7.800l-8 4-8-4z"/><path d="M4 8.200l8 4 8-4M12 12.200V20M8 6.200l8 4"/>`),
  recipes: svg(`<path ${T} d="M5 5.500A2.500 2.500 0 0 1 7.500 3H19v14H7.500A2.500 2.500 0 0 0 5 19.500z"/><path d="M5 19.500A2.500 2.500 0 0 0 7.500 21H19v-4M9.500 8h5.500M9.500 11.500h3.500"/>`),
  upgrades: svg(`<path ${T} d="M14.700 6.300a4 4 0 0 0-5.200 5.200L4 17l3 3 5.500-5.500a4 4 0 0 0 5.200-5.200l-2.600 2.600-2.300-.7-.7-2.300z"/>`),
  marketing: svg(`<path ${T} d="M4 10v4h3l8 4.500V5.500L7 10z"/><path d="M18.500 9.500a3.500 3.500 0 0 1 0 5M7.500 14l.9 4.500h2.300l-.9-3.800"/>`),
  reports: svg(`<path d="M4 4v16h16"/><rect ${T} x="7.500" y="12" width="3" height="5" rx="1"/><rect ${T} x="12.200" y="8" width="3" height="9" rx="1"/><rect ${T} x="17" y="10.500" width="3" height="6.500" rx="1"/>`),
  staff: svg(`<circle ${T} cx="9" cy="8.200" r="3.200"/><path ${T} d="M3 20a6 6 0 0 1 12 0z"/><circle cx="17.200" cy="9.500" r="2.400"/><path d="M16.500 14.300A4.800 4.800 0 0 1 21 19"/>`),
  cash: svg(`<circle ${T} cx="12" cy="12" r="8.500"/><path d="M12 7v10M14.600 9.600c-.6-1.300-5-1.500-5 .9 0 2.300 5.200 1 5.200 3.400 0 2.300-4.600 2.200-5.400.6"/>`),
  profit: svg(`<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>`),
  star: svg(`<path ${T} d="M12 3.600l2.600 5.300 5.800.8-4.200 4.100 1 5.800L12 16.900l-5.200 2.700 1-5.800-4.200-4.100 5.800-.8z"/>`),
  heart: svg(`<path ${T} d="M12 20s-7.500-4.500-7.500-9.800A4.200 4.200 0 0 1 12 7.800a4.200 4.200 0 0 1 7.500 2.400C19.500 15.500 12 20 12 20z"/>`),
  bag: svg(`<path ${T} d="M5 8h14l-1 12H6z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>`),
  menu: svg(`<path d="M5 7h14M5 12h14M5 17h14"/>`),
  pause: svg(`<path d="M9 6v12M15 6v12"/>`),
  close: svg(`<path d="M6 6l12 12M18 6L6 18"/>`),
  lock: svg(`<rect ${T} x="5.500" y="11" width="13" height="9" rx="2.500"/><path d="M8.500 11V8a3.500 3.500 0 0 1 7 0v3"/>`),
  build: svg(`<path ${T} d="M4 20V9.500l8-5.500 8 5.500V20z"/><path d="M4 13.500h16M9 20v-6.500M15 20v-6.500M12 4v4"/>`),
  chain: svg(`<path ${T} d="M2.500 12l3-3.500 3 3.500v7h-6zM9 10l3-4 3 4v9H9zM15.500 12l3-3.500 3 3.500v7h-6z"/><path d="M11 19v-3h2v3"/>`),
  kitchen: svg(`<path ${T} d="M3 20V10l5 3V10l5 3V10l5 3V5h3v15z"/><path d="M7 17h2M12 17h2M17 17h1"/>`),
  company: svg(`<circle ${T} cx="12" cy="12" r="8.500"/><path d="M12 3.500v17M3.500 12h17M6 6.500c3.500 2.500 8.500 2.500 12 0M6 17.500c3.500-2.500 8.500-2.500 12 0"/>`),
  store: svg(`<path ${T} d="M4 10l1.500-5h13L20 10v10H4z"/><path d="M4 10h16M10 20v-5h4v5"/>`),
};

// Product silhouettes for swatches: jar (body butter), bar (soap), tub (scrub).
const P = 'fill="#fffdf8" fill-opacity=".94" stroke="rgba(74,55,40,.5)" stroke-width="1.300" stroke-linejoin="round"';
const PRODUCT_SVG = {
  bottle: `<rect ${P} x="7.500" y="9" width="9" height="11.500" rx="2.500"/><rect ${P} x="10.300" y="5.500" width="3.400" height="3.600" rx="1"/><path ${P} d="M11 5.500V3.500h5"/><path d="M9.500 14h5" stroke="rgba(74,55,40,.35)" stroke-width="1.200" stroke-linecap="round"/>`,
  bomb: `<circle ${P} cx="12" cy="11.500" r="6.800"/><path d="M5.400 11.200c3.500 1.600 9.700 1.600 13.200 0" fill="none" stroke="rgba(74,55,40,.4)" stroke-width="1.300"/><path ${P} d="M7.500 17.200h9l-1 3.300h-7z"/>`,
  gift: `<rect ${P} x="4" y="9.500" width="16" height="10.500" rx="1.500"/><rect ${P} x="3.300" y="7" width="17.400" height="3.500" rx="1"/><path d="M12 7v13" stroke="rgba(233,128,155,.9)" stroke-width="2.200"/><path ${P} d="M12 7c-2.500-3.500-6-2-4.500 0zM12 7c2.500-3.500 6-2 4.500 0z"/>`,
  jar: `<rect ${P} x="6.500" y="8.800" width="11" height="11.200" rx="2.800"/><rect ${P} x="7.500" y="4.800" width="9" height="4" rx="1.300"/><path d="M9 13.500h6M9 16h4" stroke="rgba(74,55,40,.35)" stroke-width="1.200" stroke-linecap="round"/>`,
  bar: `<rect ${P} x="3.500" y="9" width="17" height="9.500" rx="3.300"/><rect x="9" y="9" width="6" height="9.500" fill="rgba(214,183,140,.9)" stroke="rgba(74,55,40,.4)" stroke-width="1"/><circle ${P} cx="17.500" cy="6" r="1.800"/><circle ${P} cx="13.800" cy="4.600" r="1.200"/>`,
  tub: `<path ${P} d="M6.200 10.500h11.600l-1 9.300H7.200z"/><rect ${P} x="5" y="6.800" width="14" height="3.800" rx="1.400"/><path d="M9.500 14.500h5" stroke="rgba(74,55,40,.35)" stroke-width="1.200" stroke-linecap="round"/>`,
};
export function productIcon(container) {
  return `<svg class="pic" viewBox="0 0 24 24" aria-hidden="true">${PRODUCT_SVG[container] || PRODUCT_SVG.jar}</svg>`;
}
