# 4 The Love Of Bubbles

A warm, stylised 3D tycoon game about growing a handmade bath, body, skin and hair-care business,
from a kitchen stovetop to a store of your own. It runs entirely in the browser.

All three chapters are playable: **The Home Business**, **The First Store** and **The Retail Chain**.

## Play

Open `index.html` through any static web server (browsers block ES modules on `file://`):

```bash
npm start
```

Then visit http://localhost:5173. No install step and no build step. The only external
dependencies are three.js and two Google Fonts, loaded from a CDN, so you need to be online.

If the repository has GitHub Pages enabled (Settings → Pages → Deploy from branch → `web` / root),
the game is playable at `https://<user>.github.io/<repo>/`.

## How it plays

You are the founder. Everything is hands-on:

1. **Supplies**: order ingredients and packaging. Deliveries take a moment to arrive.
2. **Production**: queue a batch. You carry the ingredients to the stove, it cooks, you shelve the result.
3. **Orders**: customers order online, locally, and later in bulk. Press Fulfill and each order is
   packed by hand and shipped before its timer runs out.
4. **Reinvest**: a stand mixer, more shelving, a label printer, a second workstation, a bigger pot,
   a weekend helper. Every upgrade appears in the room.
5. **Recipe Book**: develop new scents and richer formulas (Classic, Botanical, Luxe), set prices,
   and decide what to list. Quality drives reviews.
6. **Marketing**: reels, flyers and ads raise demand. The panel explains exactly where demand comes from.
7. **Outgrow the kitchen**: hit every goal and the boxes pile up until you can lease the first store.

### Chapter Two: the store on Main Street

Signing the lease moves the whole business into a corner shop. The stove, pantry and recipes go
to the workroom in the back; the front is a shop floor you lay out yourself.

1. **Shoppers walk in** with something in mind (Loyal Regulars, Value Shoppers, Natural-Ingredient
   Shoppers, Skincare Enthusiasts), a budget and limited patience. They browse displays, pick
   things up, queue at the till, pay and leave. Empty displays, high prices and long lines send
   them home unhappy.
2. **Displays**: click a shelf or table to choose what it shows. Display stock is separate from
   back stock; someone has to carry units out of the workroom to refill it.
3. **Staff**: hire a Cashier (works the till) and Sales Associates (restock displays, help
   shoppers). Until then the founder leaves the workroom to ring up every sale. Wages, rent and
   utilities are paid at closing time.
4. **Build mode**: place, move, rotate and sell shelves, display tables and plants. Aisles, the
   till line and both doorways are kept clear, and nothing can be placed where shoppers could not
   reach it.
5. **Store rating** comes from how each shopper felt on the way out, and drives foot traffic.
   Online orders keep coming at a gentler pace and are packed in the workroom.
6. **Running it well**: set how full each display should stay (or ask for a restock right now),
   keep the floor clean (shoppers wear it down and spill things), schedule staff on all-day,
   opening or closing shifts, and send them for training. Stockers keep shelves full and the
   floor tidy; a Production Worker runs the stove so you don't have to.
7. **Growing the shop**: develop hair oil, bath bombs and gift sets, which bring in Hair-Care,
   Trend and Gift Shoppers. A store design score (variety, full displays, decor, cleanliness,
   room to browse, a welcome display) drives foot traffic. Local marketing (window displays, the
   Main Street Gazette, workshop nights, loyalty cards) brings people through the door.
8. **Reports** show each day's store profit and loss and the shop's best sellers, built straight
   from the transaction ledger.

### Chapter Three: the chain

Once Main Street is established (revenue, store rating, a team, a few days of trading), the brand
can grow.

1. **Choose a location**: Riverside Market Hall, Old Town Lane, the University Quarter or the
   Harbour Promenade. Each has its own rent, foot traffic, shopper mix, spending power and colours.
2. **Run several shops**: each has its own floor, staff, back stock, shoppers and rating. Switch
   between them from the shop name in the top bar; every shop keeps trading while you're away.
   A **Store Manager** runs a branch on their own and orders stock from Main Street.
3. **Move stock** between shops by courier, and compare shops in the Chain panel (KPIs and
   profit by shop, straight from the ledger).
4. **Central kitchen**: automated production lines and a warehouse across town. Delivery trucks
   top up every shop each morning (optionally again at midday), by a par level or by a forecast
   from yesterday's sales.
5. **Wholesale contracts** with spas, salons and hotels: daily deliveries for a few days, with
   penalties for missing them. A **Regional Manager** balances stock between shops and keeps
   every shop running a little better.
6. **The brand**: revenue by channel, a quality index, Brand Soul, and the big goals. Meet them
   all for the ending; the shops are yours to keep running afterwards.

Two long-term meters matter: **Reputation** (recent customer reviews) and **Brand Soul** (does the
business still feel handmade, generous and reliable?).

### Controls

| Input | Action |
| --- | --- |
| Drag | Rotate the camera (360°) |
| Scroll / pinch | Zoom |
| W A S D, arrows, Shift-drag | Move the camera |
| Q / E | Rotate |
| Space | Pause |
| 1 / 2 / 3 | Game speed |
| Esc | Menu / close panel |
| ? | How to play (the guide) |
| ` (backtick) | Developer diagnostics |

**How to play** is on the title screen, in the pause menu and behind the **?** button: one tab per
chapter (later chapters stay closed until you reach them), with "Show me" buttons that open the
right panel. Each chapter also has short coach tips; **Replay the tips** in the menu starts them over.

Click the stove, pantry, shelves, packing table or laptop in the room to open the matching panel.
In the store, click a display to choose its products, or the till for the shop-floor overview.
In build mode, <kbd>R</kbd> rotates and <kbd>Esc</kbd> or right-click cancels a placement.

The menu has a **Detailed graphics** switch (soft contact shadows and sharper rendering). The game
turns it off by itself if the frame rate stays low. Music is off by default and can be turned on
in the same menu.

## Project layout

```
index.html            page shell + import map
css/style.css         interface styling
js/data.js            static definitions (ingredients, products, upgrades, goals...)
js/sim/               the simulation. No DOM, no rendering, fully unit-tested
  core.js             Game container, seeded RNG, event bus, new-game state
  economy.js          the only place cash changes; audited ledger
  inventory.js        ingredients, finished goods, supplies, recipe maths
  production.js       batch queue and workstation jobs
  orders.js           demand, customer orders, reviews, reputation, Brand Soul
  workers.js          shared task runner + home-era founder/helper tasks
  store.js            Era II: store layout, build mode, displays, shoppers, checkout, store rating
  staff.js            Era II: hiring, roles, wages, store-era founder/cashier/associate tasks
  path.js             store grid, placement validation, A* pathfinding
  people.js           generated shopper/staff looks and staff records
  chain.js            Era III: several stores (live-slot swapping), locations, transfers, KPIs
  company.js          Era III: central kitchen, distribution, wholesale, regional manager, goals
  business.js         upgrades, marketing, goals, the master tick / game clock
  save.js             versioned save/load, autosave, rolling backup, migrations
js/world/             three.js presentation (reads state, never changes it)
  engine.js           renderer, lighting, management camera, picking
  kit.js              materials, procedural textures, product mesh families
  character.js        procedural characters and animation library
  home.js             the home workshop scene
  store.js            the Main Street store scene (pooled shoppers, merged meshes)
js/ui/                HUD, panels, orders rail, tutorial, modals, diagnostics
  storePanels.js      Era II panels: Build, Shop Floor, Display, Staff
  chainPanels.js      Era III panels: Chain, location picker, Kitchen, Company
  guide.js            the How to play guide (chapter tabs, topic cards, spoiler-free)
  icons.js            hand-drawn SVG icon set and product silhouettes
js/audio.js           synthesised sound effects and music (no audio files)
tests/sim.test.mjs    economy, inventory, production, save and soak tests
tests/store.test.mjs  store, build validation, pathfinding, recovery, staff, save and soak tests
tests/store4.test.mjs product lines, cleaning, shifts, training, restock rules, design, marketing,
                      save migration, and a full-loop soak whose reports must reconcile with the ledger
tests/chain.test.mjs  several stores: swapping, branches, managers, transfers, per-store P&L, soak
tests/company.test.mjs kitchen, distribution, wholesale, regional manager, finale, two-week chain soak
```

## Tests

```bash
npm test
```

Covers the brief's testing priorities: money can only move through the ledger, production consumes
and produces exactly what the recipe says, inventory never goes negative, cancellation rules,
save/load round-trips, save migration and backup recovery, and a soak test where a bot plays the
whole home era to the first-store milestone. The store tests add: every finished unit is accounted
for (back stock, displays, baskets, staff arms, orders), shoppers never get stuck even while
displays are moved and sold under them, staff recover when a restock target disappears, build
placement is validated, and a bot runs the store for a week. `npm run balance` prints both bots'
day-by-day numbers.

**Production cancellation rule:** ingredients are taken when a batch is queued. Cancelling a queued
batch refunds them in full. Cancelling a batch already on a workstation wastes them.

## Relationship to the design brief

The game follows *4 The Love Of Bubbles: Game Development Brief v1.0*: home business → first store →
retail chain, a physical 3D management view with a rotating three-quarter camera, recipe and product
focus, Brand Soul, a central transaction ledger, versioned saves, and developer diagnostics.

One deliberate change: the brief specifies Unity, URP and Blender. This version is a browser game,
so it is built with three.js and procedural models instead. The architecture mirrors the brief's
services (TimeService, EconomyService, InventoryService and so on) as modules under `js/sim/`.

### Roadmap

- [x] Milestone 0: foundation (clock, ledger, data, saves, diagnostics)
- [x] Milestone 1: home business vertical slice
- [x] Milestone 2: home business polish (founder, sound, tutorial, recipe book, marketing, balance)
- [x] Milestone 3: first store prototype (store map, shoppers and pathfinding, displays, browsing and
      buying, checkout queue, basic staff, store rating, simple build mode)
- [x] Milestone 4: first store full loop (restock rules, cleaning, schedules and training, more
      archetypes, store design score, local marketing, more products, profitability reports)
- [x] Milestone 5: expansion (location choice, second store, managers, per-store KPIs, switching,
      transfers)
- [x] Milestone 6: chain management (central kitchen, distribution, wholesale, regional managers,
      brand-wide reports, late-game goals and ending)
