// Static game data. Nothing in this file is mutated at runtime.
// (Mirrors the brief's "ScriptableObject" layer: definitions here, live state in sim/state.js.)

export const SAVE_VERSION = 1;

// One business day (08:00 -> 20:00) lasts DAY_LENGTH sim-seconds at 1x speed.
export const DAY_LENGTH = 240;
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 20 * 60;

export const START_CASH = 150;

export const INGREDIENTS = {
  shea:      { id: 'shea',      name: 'Shea Butter',          category: 'Base',      cost: 2.4,  lot: 6,  lead: 14, supplier: 'Golden Karité Co-op',   color: '#f1dfae', icon: '🧈', note: 'High-value core ingredient for body butter.' },
  oil:       { id: 'oil',       name: 'Carrier Oil',          category: 'Base',      cost: 1.2,  lot: 6,  lead: 10, supplier: 'Sunpress Oils',          color: '#e8c35a', icon: '🫒', note: 'Used in body butter and scrubs.' },
  soapbase:  { id: 'soapbase',  name: 'Soap Base & Oils',     category: 'Base',      cost: 1.5,  lot: 6,  lead: 12, supplier: 'Lather & Lye Supply',    color: '#f4efe6', icon: '🧼', note: 'Everything needed for a loaf of handmade soap.' },
  sugar:     { id: 'sugar',     name: 'Sugar & Salt Base',    category: 'Base',      cost: 0.8,  lot: 6,  lead: 8,  supplier: 'Sweetwater Pantry',      color: '#fbf6ee', icon: '🧂', note: 'Exfoliating base for body scrubs.' },
  fragrance: { id: 'fragrance', name: 'Botanical Blend',      category: 'Modifier',  cost: 1.6,  lot: 4,  lead: 12, supplier: 'Meadow & Petal',         color: '#b9a2e6', icon: '🌿', note: 'Scent and botanicals. Used in every product.' },
  premium:   { id: 'premium',   name: 'Luxe Essential Oils',  category: 'Modifier',  cost: 3.6,  lot: 3,  lead: 18, supplier: 'Maison Verte Apothecary', color: '#e7a6b8', icon: '🌸', note: 'Premium oils for Luxe-tier formulas.' },
  jar:       { id: 'jar',       name: 'Glass Jars',           category: 'Packaging', cost: 0.7,  lot: 12, lead: 10, supplier: 'Clearline Packaging',    color: '#cfe6ea', icon: '🫙', note: 'Jars for body butter and scrubs.' },
  wrap:      { id: 'wrap',      name: 'Soap Wraps & Boxes',   category: 'Packaging', cost: 0.35, lot: 16, lead: 8,  supplier: 'Clearline Packaging',    color: '#d9b98a', icon: '🎁', note: 'Kraft wraps and boxes for soap bars.' },
};
export const INGREDIENT_ORDER = ['shea', 'oil', 'soapbase', 'sugar', 'fragrance', 'premium', 'jar', 'wrap'];

// Product families. `base` is the per-batch recipe before the formula tier adds its modifiers.
export const PRODUCTS = {
  butter: { id: 'butter', name: 'Body Butter',   container: 'jar', batch: 6, time: 45, basePrice: 12, base: { shea: 4, oil: 2, jar: 6 },     icon: '🧴', blurb: 'Whipped, rich, deeply moisturizing.' },
  soap:   { id: 'soap',   name: 'Handmade Soap', container: 'bar', batch: 8, time: 60, basePrice: 7,  base: { soapbase: 5, wrap: 8 },        icon: '🧼', blurb: 'Cold-process bars, cut and wrapped by hand.' },
  scrub:  { id: 'scrub',  name: 'Body Scrub',    container: 'tub', batch: 6, time: 40, basePrice: 10, base: { sugar: 4, oil: 2, jar: 6 },    icon: '✨', blurb: 'Sugar-and-salt polish for glowing skin.' },
};
export const PRODUCT_ORDER = ['butter', 'soap', 'scrub'];

// Formula tiers: how generous the recipe is with botanicals. Quality drives reviews and Brand Soul.
export const TIERS = [
  { id: 0, name: 'Classic',   quality: 62, add: { fragrance: 1 },             priceMult: 1.0,  desc: 'A light touch of botanicals. Affordable staple.' },
  { id: 1, name: 'Botanical', quality: 77, add: { fragrance: 2 },             priceMult: 1.22, desc: 'Double botanicals. Noticeably nicer.' },
  { id: 2, name: 'Luxe',      quality: 92, add: { fragrance: 2, premium: 1 }, priceMult: 1.55, desc: 'Premium essential oils. The showpiece formula.' },
];

export const SCENTS = {
  vanilla:  { id: 'vanilla',  name: 'Vanilla Bean',   color: '#f2e2b6', accent: '#c9a25a' },
  lavender: { id: 'lavender', name: 'Lavender',       color: '#b9a2e6', accent: '#7c62c4' },
  citrus:   { id: 'citrus',   name: 'Citrus Grove',   color: '#f8b84a', accent: '#e07f1f' },
  rose:     { id: 'rose',     name: 'Rose Petal',     color: '#f09ab0', accent: '#c9506f' },
  mint:     { id: 'mint',     name: 'Garden Mint',    color: '#95dbb9', accent: '#3d9d74' },
  coconut:  { id: 'coconut',  name: 'Coconut Milk',   color: '#f7f1e4', accent: '#b89f7a' },
  honey:    { id: 'honey',    name: 'Oatmeal Honey',  color: '#e6bb68', accent: '#b07d24' },
  ocean:    { id: 'ocean',    name: 'Ocean Breeze',   color: '#8fd0e6', accent: '#3a8fb0' },
};
export const SCENT_ORDER = ['vanilla', 'lavender', 'citrus', 'rose', 'mint', 'coconut', 'honey', 'ocean'];

// The three recipes every new business starts with.
export const STARTER_SKUS = [
  { productId: 'butter', scentId: 'vanilla',  tier: 0 },
  { productId: 'soap',   scentId: 'lavender', tier: 0 },
  { productId: 'scrub',  scentId: 'citrus',   tier: 0 },
];

export const START_INGREDIENTS = { shea: 8, oil: 8, soapbase: 10, sugar: 8, fragrance: 6, premium: 0, jar: 24, wrap: 16 };

export const VARIANT_COST = 60;
export const MAX_SKUS_HOME = 9;

export const BASE_INGREDIENT_CAP = 130;
export const BASE_GOODS_CAP = 40;

export const UPGRADES = {
  mixer:    { id: 'mixer',    name: 'Stand Mixer',              cost: 180, icon: '🌀', desc: 'Whips and blends for you. Every batch finishes 30% faster.',                 effect: 'Production time −30%' },
  pantry:   { id: 'pantry',   name: 'Pantry Shelving',          cost: 140, icon: '🗄️', desc: 'A proper rack for ingredients and packaging.',                               effect: 'Ingredient storage +100' },
  goods:    { id: 'goods',    name: 'Stock Shelving',           cost: 160, icon: '📦', desc: 'A taller shelf for finished products.',                                       effect: 'Finished-goods storage +50' },
  packing:  { id: 'packing',  name: 'Label Printer & Tape Gun', cost: 220, icon: '🏷️', desc: 'Print labels instead of hand-writing every one.',                             effect: 'Packing time −45%' },
  station2: { id: 'station2', name: 'Second Workstation',       cost: 320, icon: '🔥', desc: 'A hot plate and curing rack beside the stove. Run two batches at once.',      effect: '+1 production station' },
  bigpot:   { id: 'bigpot',   name: 'Large Double Boiler',      cost: 380, icon: '🍯', desc: 'Bigger pot, bigger batches. Uses proportionally more ingredients.',           effect: 'Batch size +50%' },
  helper:   { id: 'helper',   name: 'Weekend Helper',           cost: 250, icon: '🙋', desc: 'A friend joins to pack and stock. Can auto-fulfill orders. Paid $30 per day.', effect: 'Helper packs orders · $30/day', wage: 30 },
};
export const UPGRADE_ORDER = ['mixer', 'pantry', 'goods', 'packing', 'station2', 'bigpot', 'helper'];

export const CAMPAIGNS = {
  social: { id: 'social', name: 'Post a Behind-the-Scenes Reel', cost: 0,   boost: 0.2,  duration: 70,  cooldown: 150, icon: '📱', desc: 'Free, quick, and personal. A short bump in orders.' },
  flyers: { id: 'flyers', name: 'Farmers-Market Flyers',         cost: 45,  boost: 0.4,  duration: 240, cooldown: 240, icon: '📰', desc: 'Local word of mouth for a full day.' },
  ads:    { id: 'ads',    name: 'Online Ad Campaign',            cost: 130, boost: 0.75, duration: 480, cooldown: 480, icon: '🎯', desc: 'Two days of targeted reach. Make sure you can keep up!' },
};
export const CAMPAIGN_ORDER = ['social', 'flyers', 'ads'];

export const DAILY_UTILITIES = 8;

// Requirements for outgrowing the home workshop and leasing the first store.
export const HOME_GOALS = {
  revenue: 4500,
  orders: 60,
  reputation: 4.2,
  upgrades: 4,
  leaseDeposit: 2000,
};

// Where actors stand to use each fixture (room coordinates, metres; see world/home.js).
export const POINTS = {
  station0: { x: -2.3, z: -2.05, face: Math.PI },
  station1: { x: -0.35, z: -2.05, face: Math.PI },
  pantry:   { x: -3.0, z: 0.35, face: -Math.PI / 2 },
  shelf:    { x: 3.0, z: -0.9, face: Math.PI / 2 },
  packing:  { x: 1.9, z: 1.05, face: 0 },
  laptop:   { x: 2.35, z: -2.05, face: Math.PI },
  door:     { x: -3.1, z: 2.2, face: -Math.PI / 2 },
  rest:     { x: 0.2, z: 0.3, face: 0 },
  rest2:    { x: 0.75, z: 0.95, face: 0.4 },
};

export const CUSTOMER_NAMES = [
  'Amara J.', 'Bianca R.', 'Carmen L.', 'Danielle W.', 'Elena M.', 'Farah K.', 'Grace T.', 'Hannah B.', 'Imani S.', 'Jasmine C.',
  'Keisha D.', 'Layla H.', 'Monique P.', 'Naomi F.', 'Olivia G.', 'Priya N.', 'Quinn A.', 'Renee V.', 'Sofia Z.', 'Tanya E.',
  'Uma O.', 'Valerie I.', 'Whitney Y.', 'Ximena Q.', 'Yolanda U.', 'Zoe X.', 'Marcus T.', 'Devon R.', 'Andre L.', 'Jordan P.',
  'Malik S.', 'Theo W.', 'Sam K.', 'Chris B.', 'Alex M.', 'Tasha G.', 'Nia C.', 'Ebony H.', 'Rosa D.', 'Mei L.',
];

export const BIG_ORDER_NAMES = ['Willow Day Spa', 'The Corner Boutique', 'Bloom Hair Studio', 'Harbor Inn B&B', 'Sage Yoga Collective', 'Petal & Pine Gifts'];

export const REVIEW_TEXT = {
  5: ['Obsessed. My skin has never felt this soft!', 'You can tell this is made with love. Ordering again!', 'Smells incredible and arrived so fast.', 'This is my new favorite small business.', 'Gifted one, kept one. Both perfect.'],
  4: ['Really lovely product, will order again.', 'Great quality and nicely packaged.', 'Smells wonderful. Shipping was quick.', 'So glad I found this shop.'],
  3: ['Nice, but a little pricey for what it is.', 'Good product. Took a while to arrive.', 'Decent. I expected a bit more scent.'],
  2: ['It arrived late and I was disappointed.', 'Not worth the price for me.', 'Okay product, slow service.'],
  1: ['My order never showed up.', 'Waited and waited. Had to cancel.', 'Really let down. I wanted to love this shop.'],
};

export const FOUNDER_OPTIONS = {
  skin: ['#f6d7c0', '#eabf9f', '#d49b73', '#b97a50', '#8c5a3a', '#5e3b26'],
  hairColor: ['#1c1412', '#3b2416', '#6a3e1f', '#a8672e', '#d9b36a', '#8a8f98', '#b23a48'],
  hairStyle: ['bun', 'afro', 'long', 'bob', 'braids', 'short'],
  outfit: ['#e98fa5', '#7fc7c0', '#b39ddb', '#f2b866', '#8fb7e8', '#f4f0e8'],
};
