// Static game data. Nothing in this file is mutated at runtime.
// (Mirrors the brief's "ScriptableObject" layer: definitions here, live state in sim/state.js.)

export const SAVE_VERSION = 3;

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
  wrap:      { id: 'wrap',      name: 'Soap Wraps & Boxes',   category: 'Packaging', cost: 0.35, lot: 16, lead: 8,  supplier: 'Clearline Packaging',    color: '#d9b98a', icon: '🎁', note: 'Kraft wraps and boxes for soap bars and bath bombs.' },
  // Era II product lines (unlocked in the Recipe Book once the store is open)
  bottle:    { id: 'bottle',    name: 'Amber Pump Bottles',   category: 'Packaging', cost: 0.9,  lot: 12, lead: 12, supplier: 'Clearline Packaging',    color: '#c98a4a', icon: '🧴', note: 'Pump bottles for hair oil.', line: 'hair' },
  fizz:      { id: 'fizz',      name: 'Baking Soda & Citric', category: 'Base',      cost: 0.55, lot: 8,  lead: 8,  supplier: 'Sweetwater Pantry',      color: '#eef3f6', icon: '🫧', note: 'The fizz in every bath bomb.', line: 'bomb' },
  giftbox:   { id: 'giftbox',   name: 'Gift Boxes & Ribbon',  category: 'Packaging', cost: 1.4,  lot: 8,  lead: 14, supplier: 'Petal & Pine Paper',     color: '#f1b7c5', icon: '🎀', note: 'Keepsake boxes for gift sets.', line: 'gift' },
};
export const INGREDIENT_ORDER = ['shea', 'oil', 'soapbase', 'sugar', 'fragrance', 'premium', 'jar', 'wrap', 'bottle', 'fizz', 'giftbox'];
export const HOME_INGREDIENT_ORDER = INGREDIENT_ORDER.slice(0, 8);

// Product families. `base` is the per-batch recipe before the formula tier adds its modifiers.
export const PRODUCTS = {
  butter: { id: 'butter', name: 'Body Butter',   container: 'jar', batch: 6, time: 45, basePrice: 12, base: { shea: 4, oil: 2, jar: 6 },     icon: '🧴', blurb: 'Whipped, rich, deeply moisturizing.' },
  soap:   { id: 'soap',   name: 'Handmade Soap', container: 'bar', batch: 8, time: 60, basePrice: 7,  base: { soapbase: 5, wrap: 8 },        icon: '🧼', blurb: 'Cold-process bars, cut and wrapped by hand.' },
  scrub:  { id: 'scrub',  name: 'Body Scrub',    container: 'tub', batch: 6, time: 40, basePrice: 10, base: { sugar: 4, oil: 2, jar: 6 },    icon: '✨', blurb: 'Sugar-and-salt polish for glowing skin.' },
  // Era II product lines (brief §5: hair care, gift sets, bath bombs)
  hair:   { id: 'hair',   name: 'Hair Oil',      container: 'bottle', batch: 6, time: 40, basePrice: 14, base: { oil: 3, bottle: 6 },                    icon: '💧', blurb: 'Light, glossy oil for curls, coils and ends.', line: true },
  bomb:   { id: 'bomb',   name: 'Bath Bomb',     container: 'bomb',   batch: 8, time: 35, basePrice: 6,  base: { fizz: 4, wrap: 8 },                     icon: '🫧', blurb: 'Fizzing, scented, impossible to resist.', line: true },
  gift:   { id: 'gift',   name: 'Gift Set',      container: 'gift',   batch: 4, time: 50, basePrice: 34, base: { shea: 2, soapbase: 2, sugar: 2, giftbox: 4 }, icon: '🎁', blurb: 'Butter, soap and scrub in a ribboned keepsake box.', line: true },
};
export const PRODUCT_ORDER = ['butter', 'soap', 'scrub', 'hair', 'bomb', 'gift'];
// New product lines: R&D cost to unlock in the store era, and the recipe you start with.
export const PRODUCT_LINES = {
  hair: { id: 'hair', cost: 260, starter: 'coconut', desc: 'A hair-care line brings in Hair-Care Shoppers.' },
  bomb: { id: 'bomb', cost: 200, starter: 'rose', desc: 'Bath bombs are cheap, cheerful and catch Trend Shoppers.' },
  gift: { id: 'gift', cost: 320, starter: 'vanilla', desc: 'Gift sets are what Gift Shoppers come in for.' },
};
export const LINE_ORDER = ['hair', 'bomb', 'gift'];

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

export const START_INGREDIENTS = { shea: 8, oil: 8, soapbase: 10, sugar: 8, fragrance: 6, premium: 0, jar: 24, wrap: 16, bottle: 0, fizz: 0, giftbox: 0 };

export const VARIANT_COST = 60;
export const MAX_SKUS_HOME = 9;
export const MAX_SKUS_STORE = 15;

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
  social: { id: 'social', name: 'Post a Behind-the-Scenes Reel', cost: 0,   boost: 0.2,  duration: 70,  cooldown: 150, icon: '📱', desc: 'Free, quick, and personal. A short bump in orders.', channel: 'online' },
  flyers: { id: 'flyers', name: 'Farmers-Market Flyers',         cost: 45,  boost: 0.4,  duration: 240, cooldown: 240, icon: '📰', desc: 'Local word of mouth for a full day.', channel: 'online' },
  ads:    { id: 'ads',    name: 'Online Ad Campaign',            cost: 130, boost: 0.75, duration: 480, cooldown: 480, icon: '🎯', desc: 'Two days of targeted reach. Make sure you can keep up!', channel: 'online' },
  // Era II local marketing: these bring people through the door
  window:   { id: 'window',   name: 'Refresh the Window Display',   cost: 0,   boost: 0.15, duration: 240, cooldown: 480, icon: '🪟', desc: 'Free. Passers-by stop and look for the rest of the day.', channel: 'store' },
  paper:    { id: 'paper',    name: 'Ad in the Main Street Gazette', cost: 70,  boost: 0.35, duration: 240, cooldown: 360, icon: '🗞️', desc: 'A full day of extra shoppers from around town.', channel: 'store' },
  workshop: { id: 'workshop', name: 'Bath-Bomb Workshop Night',     cost: 160, boost: 0.6,  duration: 150, cooldown: 720, icon: '🎉', desc: 'A busy, joyful evening in the shop. Brand Soul +2.', channel: 'store', soul: 2 },
};
export const CAMPAIGN_ORDER = ['social', 'flyers', 'ads'];
export const STORE_CAMPAIGN_ORDER = ['window', 'paper', 'workshop'];
export const LOYALTY = { cost: 180, desc: 'Stamp cards for regulars: more Loyal Regulars, and they wait longer.' };

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

// ============================================================================
// Era II: the first retail store (Milestone 3)
// ============================================================================

// The store is laid out on a 0.5 m grid. Columns run along x, rows along z.
//   rows 0-5   back room (production, pantry, back stock, packing)
//   row  6     half-height partition wall, doorway in the middle
//   rows 7-21  sales floor (where displays can be built)
//   row  22    shop front: big windows and the entrance
//   rows 23-26 the sidewalk outside
export const STORE_GRID = { cell: 0.5, x0: -7, z0: -5.5, cols: 28, rows: 27 };
export const STORE_ROWS = { backRoom: [0, 5], partition: 6, floor: [7, 21], front: 22, street: [23, 26] };
export const STORE_DOORS = { partition: [13, 14], entrance: [12, 15] };

// Where actors stand to use each fixed fixture in the store (metres).
export const STORE_POINTS = {
  station0: { x: -5.0, z: -4.55, face: Math.PI },
  station1: { x: -3.3, z: -4.55, face: Math.PI },
  pantry:   { x: -6.1, z: -3.6, face: -Math.PI / 2 },
  shelf:    { x: 4.6, z: -4.55, face: Math.PI },   // back-stock shelving
  packing:  { x: -0.25, z: -4.25, face: Math.PI },
  register: { x: 4.25, z: 0.75, face: 0 },          // behind the till
  rest:     { x: -1.6, z: -3.6, face: 0.6 },
  rest2:    { x: 2.2, z: -3.4, face: -0.4 },
  floor:    { x: -0.6, z: 0.5, face: 0.3 },        // where an idle associate waits
  backdoor: { x: 0, z: -2.25, face: 0 },
  staffroom: { x: 4.9, z: -2.9, face: Math.PI / 2 },  // where off-shift staff hang their aprons
  desk:     { x: 5.75, z: -3.3, face: Math.PI / 2 },     // training at the laptop
  inside:   { x: 0, z: 4.6, face: Math.PI },         // just inside the entrance
  outside:  { x: 0, z: 6.6, face: Math.PI },
  streetL:  { x: -6.9, z: 7.3, face: Math.PI / 2 },
  streetR:  { x: 6.9, z: 7.3, face: -Math.PI / 2 },
};

// Fixed fixtures occupy cells [i0, i1] x [j0, j1] (inclusive). Not movable in Milestone 3.
export const STORE_FIXED = [
  { id: 'stations', cells: [1, 8, 0, 0] },
  { id: 'pantry',   cells: [0, 0, 2, 5] },
  { id: 'backstock', cells: [17, 25, 0, 0] },
  { id: 'packing',  cells: [12, 14, 0, 1] },
  { id: 'desk',     cells: [26, 27, 3, 5] },
  { id: 'counter',  cells: [19, 23, 13, 13] },
];
// Walkable cells that must stay clear of furniture: the entrance, the back-room doorway,
// the cashier's spot and the checkout queue lane.
export const STORE_RESERVED = [
  [11, 16, 17, 21],  // entrance approach
  [12, 15, 7, 8],    // back-room doorway approach
  [19, 23, 12, 12],  // behind the till
  [20, 22, 14, 21],  // checkout queue lane
];
// Customers line up here, first place first.
export const QUEUE_CELLS = [[21, 14], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20], [21, 21]];

// Build-mode catalogue. Footprints are in cells at rotation 0 (front faces +z).
export const FURNITURE = {
  shelf: { id: 'shelf', name: 'Wooden Wall Shelf', cost: 160, w: 4, d: 2, slots: 2, slotCap: 12, visibility: 1.0, appeal: 1, icon: '🗄️', desc: 'Three tiers, two products. The workhorse of the shop floor.' },
  table: { id: 'table', name: 'Round Display Table', cost: 120, w: 3, d: 3, slots: 1, slotCap: 10, visibility: 1.6, appeal: 3, icon: '🪵', desc: 'One product, beautifully presented. Shoppers notice it first and buy on impulse.' },
  plant: { id: 'plant', name: 'Potted Fig', cost: 35, w: 2, d: 2, slots: 0, slotCap: 0, visibility: 0, appeal: 2, icon: '🪴', desc: 'Greenery makes the shop feel calm and handmade.' },
  tester: { id: 'tester', name: 'Tester Bar', cost: 220, w: 4, d: 2, slots: 0, slotCap: 0, visibility: 0, appeal: 2, access: true, icon: '🧪', desc: 'Shoppers try before they buy: happier, and more likely to pick something up.' },
  bench: { id: 'bench', name: 'Cushioned Bench', cost: 90, w: 3, d: 2, slots: 0, slotCap: 0, visibility: 0, appeal: 2, icon: '🛋️', desc: 'Somewhere to rest. Everyone in the shop is a little more patient.' },
  lamp: { id: 'lamp', name: 'Brass Floor Lamp', cost: 70, w: 1, d: 1, slots: 0, slotCap: 0, visibility: 0, appeal: 2, icon: '💡', desc: 'Warm light that makes the shop glow.' },
};
export const FURNITURE_ORDER = ['shelf', 'table', 'tester', 'plant', 'bench', 'lamp'];
export const SELL_BACK = 0.5;

// The layout the store opens with.
export const STARTER_LAYOUT = [
  { type: 'shelf', i: 0, j: 9, rot: 1 },
  { type: 'shelf', i: 0, j: 14, rot: 1 },
  { type: 'shelf', i: 4, j: 7, rot: 0 },
  { type: 'shelf', i: 26, j: 7, rot: 3 },
  { type: 'table', i: 8, j: 12, rot: 0 },
  { type: 'plant', i: 0, j: 19, rot: 0 },
  { type: 'plant', i: 25, j: 19, rot: 0 },
];

export const STORE = {
  maxCustomers: 22,          // shoppers inside at once (performance cap for the prototype)
  spawnInterval: 5.2,        // sim-seconds between arrivals at a 1.0 traffic multiplier
  openUntil: 0.94,           // fraction of the day after which nobody new walks in
  rent: 55,                  // per day
  utilities: 14,             // per day
  goodsCap: 120,             // back-stock storage
  refillLevels: [0.25, 0.5, 0.8], // display refill thresholds the player can choose
  messChance: 0.05,          // per display a shopper browses
  maxMesses: 12,
  wearPerVisit: 0.45,        // cleanliness lost per shopper
  trainCost: 90,
  trainTime: 40,
  statCap: 1.45,
  ingredientCap: 200,
  onlineShare: 0.55,         // online orders keep coming, at this share of the home-era rate
  restockBelow: 0.5,         // staff restock a display once it falls under half full
  walkSpeed: 1.6,            // customers, metres per sim-second
  staffSpeed: 1.9,
  maxStaff: 4,
  hireFee: 40,
};

// Brief §5 customer archetypes. Milestone 3 uses four; the rest arrive with Milestone 4.
//   products: how much each product family appeals; tier: preferred formula tier (0-2)
//   sens: price sensitivity (higher = put off sooner by high prices)
export const ARCHETYPES = {
  regular:  { id: 'regular',  name: 'Loyal Regular',              weight: 0.3,  budget: [20, 36], patience: [70, 100], wants: [1, 2], products: { butter: 1, soap: 1.2, scrub: 1 }, tier: 0, sens: 0.6, note: 'Comes back for the staples when they are in stock.' },
  value:    { id: 'value',    name: 'Value Shopper',              weight: 0.3,  budget: [10, 22], patience: [45, 70],  wants: [1, 2], products: { butter: 0.7, soap: 1.4, scrub: 1 }, tier: 0, sens: 1.6, note: 'Hunts for fair prices and affordable staples.' },
  natural:  { id: 'natural',  name: 'Natural-Ingredient Shopper', weight: 0.25, budget: [24, 46], patience: [55, 85],  wants: [1, 3], products: { butter: 1.1, soap: 1, scrub: 1 },   tier: 1, sens: 0.8, note: 'Wants botanical, quality formulas.' },
  skincare: { id: 'skincare', name: 'Skincare Enthusiast',        weight: 0.15, budget: [30, 64], patience: [60, 90],  wants: [1, 3], products: { butter: 1.4, soap: 0.6, scrub: 1.2, hair: 0.5, gift: 0.3 }, tier: 2, sens: 0.5, note: 'Pays for premium formulas with great reviews.' },
  // Milestone 4: these three only come in once the shop sells what they are after
  gift:     { id: 'gift',     name: 'Gift Shopper',               weight: 0.14, budget: [30, 75], patience: [55, 85],  wants: [1, 2], products: { gift: 3, butter: 0.7, bomb: 0.7, soap: 0.4 }, tier: 1, sens: 0.5, requires: 'gift', tables: true, note: 'Looks for beautifully presented gifts and sets.' },
  haircare: { id: 'haircare', name: 'Hair-Care Shopper',          weight: 0.14, budget: [16, 40], patience: [50, 80],  wants: [1, 2], products: { hair: 3, butter: 0.6, soap: 0.3 }, tier: 1, sens: 0.8, requires: 'hair', note: 'Here for the hair-care line.' },
  trend:    { id: 'trend',    name: 'Trend Shopper',              weight: 0.1,  budget: [12, 32], patience: [35, 60],  wants: [1, 2], products: { bomb: 3, scrub: 1, soap: 0.6 }, tier: 0, sens: 0.9, requires: 'bomb', trend: true, note: 'Follows what is popular and what is being talked about.' },
};
export const ARCHETYPE_ORDER = ['regular', 'value', 'natural', 'skincare', 'gift', 'haircare', 'trend'];

// Basic staff (Milestone 3). Schedules and training arrive with Milestone 4.
export const STAFF_ROLES = {
  cashier:   { id: 'cashier',   name: 'Cashier',         wage: 42, icon: '🧾', desc: 'Works the till so shoppers never wait for you to come out of the back room.' },
  associate: { id: 'associate', name: 'Sales Associate', wage: 38, icon: '🛍️', desc: 'Helps shoppers find what they want, restocks and tidies up.' },
  stocker:   { id: 'stocker',   name: 'Stocker',         wage: 34, icon: '📦', desc: 'Keeps every display full and the floor clean. Never stops moving.' },
  maker:     { id: 'maker',     name: 'Production Worker', wage: 44, icon: '🍯', desc: 'Runs the stove and packs online orders, so you are free for the shop.' },
};
export const STAFF_ROLE_ORDER = ['cashier', 'associate', 'stocker', 'maker'];
// Shifts: early is opening to 2 PM, late is 2 PM to close. Half shifts cost a bit over half.
export const SHIFTS = {
  full:  { id: 'full',  name: 'All day',  from: 0, to: 1, pay: 1 },
  early: { id: 'early', name: 'Opening',  from: 0, to: 0.5, pay: 0.55 },
  late:  { id: 'late',  name: 'Closing',  from: 0.5, to: 1, pay: 0.55 },
};
export const SHIFT_ORDER = ['full', 'early', 'late'];

export const STAFF_NAMES = ['Aaliyah', 'Bree', 'Camille', 'Dante', 'Esme', 'Felix', 'Gia', 'Hector', 'Ines', 'Jamal', 'Kenji', 'Lena', 'Marisol', 'Nico', 'Omar', 'Paloma', 'Rhea', 'Simone', 'Tobi', 'Valentina', 'Wes', 'Yara', 'Zuri'];

// Character looks for shoppers and staff (indices into these lists are saved, not colours).
export const PEOPLE = {
  skin: ['#f6d7c0', '#eabf9f', '#d49b73', '#b97a50', '#8c5a3a', '#5e3b26'],
  hair: ['#1c1412', '#3b2416', '#6a3e1f', '#a8672e', '#d9b36a', '#8a8f98', '#2b2b33'],
  styles: ['bun', 'afro', 'long', 'bob', 'braids', 'short'],
  tops: ['#e98fa5', '#7fc7c0', '#b39ddb', '#f2b866', '#8fb7e8', '#f4f0e8', '#c9e4a8', '#e8a87c', '#9fb4c7', '#d6a2c8'],
  pants: ['#44506b', '#6b5a4a', '#2f3640', '#8a7a6a', '#5a6b7d', '#3d4a3d'],
};

export const STORE_REVIEW_TEXT = {
  5: ['The shop smells like heaven. I left with a full bag!', 'Gorgeous little store and the staff were so kind.', 'Found exactly what I wanted. Will be back every month.', 'Everything is handmade and you can tell.'],
  4: ['Lovely shop, great products.', 'Nice selection and a quick checkout.', 'Really pretty displays. Bought a gift.'],
  3: ['Nice store, but they were out of what I came for.', 'Good products, a bit of a wait at the till.', 'Pretty, but a little pricey.'],
  2: ['Waited ages to pay.', 'Half the shelves were empty.', 'Too expensive for me.'],
  1: ['Gave up in the checkout line.', 'Nothing I wanted was in stock.'],
};
