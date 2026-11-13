# Handoff: 4 The Love Of Bubbles (browser game)

Written 2026-11-13 for whoever continues this in a new thread. Updated the same day after Milestone 3. Read this first, then `README.md`,
then the design brief PDF (`4_The_Love_Of_Bubbles_Game_Development_Brief.pdf`, in the owner's
Downloads folder; it is not in the repo, so ask for it to be attached).

## Where things stand

- **Built:** Era I, the Home Business (brief milestones 0, 1 and 2), plus a visual polish pass.
  **Milestones 3 and 4 (the first store)** are built on branch `claude/tender-shannon-tt8lzl`
  (based on `web`, not yet merged into `web`, so the live link still ends at the lease).
- **Not built:** Era III, the Retail Chain (milestones 5 and 6).
- **Live:** https://tombstonedadeadman.github.io/4-the-love-of-bubbles/ (GitHub Pages).
- **Repo:** `TombstoneDaDeadman/4-the-love-of-bubbles`, public.
  - `web` branch = this browser game. Pages deploys from `web` / root. **Pushing to `web` updates
    the live gift link within a minute or two**, so only push when the owner says to.
  - `main` branch = a separate, older Unity project. Do not touch or overwrite it.
- **Local folder:** `F:\4-the-love-of-bubbles`, on branch `web`, last pushed commit `bbb035b`.
  This file is new and uncommitted.

## What the owner wants

- A **browser game**, very polished, including the characters. It is a **gift** based on a real
  handmade bath and body business, so warmth and brand identity matter.
- The brief says Unity/URP/Blender. The owner asked for a browser game instead, so this is
  three.js with procedural models. Keep everything else in the brief authoritative: the three-era
  progression, the physical 3D management view with a rotating three-quarter camera, the
  recipe/product focus, Brand Soul, the ledger, versioned saves, diagnostics.
- The owner found the background music annoying. It is now **off by default**. Do not turn it
  back on or make audio more prominent without asking.
- Build one era (ideally one milestone) at a time, as the brief instructs.

## Running, testing, verifying

```bash
npm start          # static server on http://localhost:5173 (tools/serve.mjs)
npm test           # 12 simulation tests (node --test)
npm run balance    # same tests, prints the test bot's day-by-day economy table
```

- No build step and no installed dependencies. three.js 0.160.0 and addons load from jsDelivr
  through the import map in `index.html`; fonts load from Google Fonts. Stay on 0.160.0 unless
  there is a reason: the post-processing code was written against it.
- `.claude/launch.json` has a `game` config for the in-app browser preview.
- In the page, `window.__ftlob` is the app object. Useful for verification:
  - `__ftlob.advance(seconds)` fast-forwards the simulation (ignores game speed).
  - `__ftlob.game.state` is the whole live state; `__ftlob.ui`, `__ftlob.world`, `__ftlob.engine`.
  - The backtick key opens the developer diagnostics panel (add cash, add stock, spawn order,
    end day, jump to near the milestone).
- When the browser pane is hidden the page is throttled to about one frame per second. Screenshots
  can be stale and the measured frame rate is meaningless. Wait a couple of seconds before
  screenshots and drive time with `__ftlob.advance()` instead of waiting.
- **Never verified:** real frame rate with detailed graphics on, phone/tablet layouts, a full
  playthrough at normal speed by a human, browsers other than the in-app one.

## Architecture

```
js/data.js            static definitions only (never mutated)
js/sim/               rules. No DOM, no three.js. Everything here is unit-testable in Node.
  core.js             Game (state + seeded RNG + event bus), newGameState()
  economy.js          transact(): the ONLY place cash changes; ledger audit (cash == ledger.sum)
  inventory.js        ingredients, goods, supply orders, recipe maths, pricing, variants
  production.js       batch queue + workstation jobs, cancellation rules
  orders.js           demand model, order spawning/fulfilment/expiry, reviews, reputation, soul
  workers.js          founder/helper task state machines (walk -> work -> action)
  business.js         upgrades, marketing, home goals, signLease(), tick() master clock
  save.js             versioned save/load, backup slot, MIGRATIONS table
js/world/             three.js presentation. Reads state, never writes it.
  engine.js           renderer, env map, GTAO composer, quality switch, camera rig, picking
  kit.js              material cache, primitives, canvas textures, sprites, product meshes
  character.js        procedural characters + animation library
  home.js             HomeWorld: the kitchen scene and its per-frame sync with state
js/ui/                DOM interface
  ui.js               GameUI: HUD, nav, panel drawer, orders rail, goal bar, coach, modals, labels
  panels.js           pure functions returning panel HTML from state
  icons.js            SVG icon set + product silhouettes
js/main.js            bootstrap, title screen, founder creator, main loop, saves, prefs
js/audio.js           synthesised sfx and optional music
tests/sim.test.mjs    economy, inventory, production, save, soak-bot tests
```

Patterns to keep following:

- **Sim modules are plain functions taking a `Game`.** They emit events (`game.emit('orderShipped', ...)`);
  the UI and world subscribe. New rules go in `js/sim/` with tests, not in UI code.
- **All money goes through `transact()`** (or `forceExpense()` for end-of-day bills). The tests
  assert `cash === ledger.sum` after every bot step.
- **State must stay JSON-serialisable** (it is saved with `JSON.stringify`). Actors and their
  in-progress tasks live in state. If you change the state shape, bump `SAVE_VERSION` in
  `data.js` and add a step to `MIGRATIONS` in `save.js`; `withDefaults()` fills missing keys from
  a fresh state. Existing players (including the gift recipient) have saves in localStorage.
- **Panels render HTML strings and only replace the DOM when the string changes.** Anything that
  changes every frame (progress bars, countdowns) is a `data-live="kind:id"` placeholder filled by
  `GameUI._live()`. This is what stops clicks being lost and animations replaying. Order cards
  are keyed by id for the same reason.
- **Clicks use delegation** via `data-act` / `data-id` handled in `GameUI._act()`.
- **`.title` is a card-title class.** The title screen uses `.titlescreen`. Do not reuse generic
  class names for full-screen layers (this caused a real bug).
- **Transparent effects go in `world.fx3d`** (a child of `engine.fxRoot`), which is hidden during
  the ambient-occlusion pass. Anything transparent added elsewhere gets dark AO halos.
- **Walls drop** (scale to a low stub) when between camera and room; wall-mounted decor is listed
  in each wall group's `userData.decor` and hidden with it.
- `three` object `.add()` returns the parent. `parent.add(x).rotation...` rotates the parent
  (this also caused a real bug).
- The session's shell mangles large Bash heredocs containing quotes. Use the file Write/Edit
  tools for anything non-trivial.
- Git on F: needed `safe.directory` (already added globally for this folder).

## Current game numbers (Era I)

Defined in `js/data.js` and `js/sim/orders.js`; tune with `npm run balance`.

- Day = 240 sim-seconds at 1x (8:00 to 20:00). Start cash $150.
- Products: Body Butter (batch 6, 45s, $12), Handmade Soap (8, 60s, $7), Body Scrub (6, 40s, $10).
  Formula tiers Classic / Botanical / Luxe (quality 62 / 77 / 92) drive reviews.
- Seven upgrades, three marketing campaigns, up to nine recipes.
- Lease goals: $4,500 lifetime revenue, 60 orders, 4.2 stars, 4 upgrades, then a $2,000 deposit.
  The test bot gets there around day 10 (roughly 40 minutes at 1x).

## Milestone 3: what exists now

- Signing the lease -> "Open the store" (`showChapterEnd`) -> `openStore()` in `js/sim/store.js`
  sets `state.era = 'store'`, creates `state.store`, lays out a starter floor, moves kitchen stock
  onto displays, turns the weekend helper into a sales associate ("Robin"). `main.js` rebuilds with
  `StoreWorld` and plays a sidewalk-facing opening shot. Saves from before v2 that already signed
  the lease get a "Your store is ready" prompt instead (save migration 1 -> 2).
- **Grid** (`js/sim/path.js`, data in `STORE_*` in `data.js`): 0.5 m cells, 28 x 27. Rows 0-5 back
  room, 6 partition, 7-21 shop floor, 22 shop front, 23-26 sidewalk. A* with no corner cutting,
  string-pulled paths, cached walk grid per `store.layoutVer`. `walkTo()` moves any entity.
- **Build mode**: shelves (2 products), display tables (1, eye-catching), plants (appeal).
  `checkPlacement()` rejects off-floor, overlap, reserved aisles (entrance, back doorway, behind
  the till, the queue lane) and anything that would leave the till, back room or any display
  unreachable. Selling refunds 50% and returns display stock to back stock; the last display
  cannot be sold.
- **Shoppers**: 4 of the brief's 7 archetypes (`ARCHETYPES`), budget, patience, wants. States:
  arrive -> decide -> walk -> browse -> (decide ...) -> queue -> paying -> leave. Mood becomes a
  1-5 rating (`store.reputation`), some write reviews (`source: 'store'`). Every state has a time
  limit and unreachable targets are skipped, so nobody gets stuck (tested while moving/selling
  displays under them). `STORE.maxCustomers` = 22 at once.
- **Staff** (`js/sim/staff.js`): Cashier, Sales Associate. Candidates refresh daily; hiring fee,
  daily wages via `forceExpense`. Founder covers the till when there is no cashier and restocks
  when there is no associate. `workers.js` now has a shared task runner (`tickActor`) with
  per-era hooks; restock tasks return carried units if their display vanishes.
- **Economy**: rent $55 + utilities $14 per day; online orders continue at 55% of the home rate.
  `npm run balance` prints a week of the store bot: production-bound, roughly $400-500/day profit
  with 4 kitchen upgrades and 2 staff, store rating 3.5-4.0.
- **Rendering**: characters fuse static parts per joint (`compactChildren` in `kit.js`), shoppers
  are pooled by look, furniture and stocked slots are merged per material (`compactStatic`).
  About 280 draw calls empty, ~640 with a dozen shoppers (headless software GL measurement; real
  GPU frame rate still unverified).
- Browser checks were done in headless Chromium with three.js served from an npm copy (jsDelivr
  was blocked in that environment): opening shot, store, staff, display inspector, build ghost and
  placement, shop-floor panel, store save/continue, and the home era after the change.

## Milestone 4: what was added

- **Save v3** (migration 2 -> 3): `state.lines`, slot `refill`/`rush`, staff `shift`/`xp`/`trained`,
  store `clean`/`messes`/`loyalty`, SKU `storeSold`/`storeRevenue`.
- **Products** (`PRODUCTS.hair/bomb/gift`, `PRODUCT_LINES`, three new ingredients flagged with
  `line`): unlocked with `unlockLine()` in the store era only; `productUnlocked()` gates recipes,
  supplies and shopper wants. Kitchen code uses `HOME_INGREDIENT_ORDER` (the original 8).
- **Archetypes**: Gift, Hair-Care and Trend Shoppers (`requires` a line; Trend scales with
  marketing and likes popular items; Gift prefers tables). `archetypeWeights()`.
- **Restocking**: per-slot refill level (25/50/80%) and `rushSlot()`; `needsRestock()` in staff.js.
- **Cleaning**: each visit wears `store.clean`; browsing can drop messes; associates and stockers
  tidy and mop; closing time restores some; `cleanliness()` = clean minus messes. Dirty shops cost
  mood, design score and (below 50 at closing) Brand Soul.
- **Staff**: roles Cashier, Sales Associate, Stocker, Production Worker; shifts full / opening /
  closing (`SHIFTS`, off-shift staff walk to the staff room and are hidden); `trainStaff()` (cost,
  time at the desk, +0.12 to a stat); +0.02 to both stats every 3 days worked.
- **Store design score** (`designScore()`): six explained parts, 0-100; drives foot traffic and
  shoppers' starting mood. New decor: tester bar (shoppers try products first), bench (patience),
  floor lamp.
- **Local marketing**: campaigns now have a `channel` (`online` / `store`); three store campaigns
  and loyalty cards.
- **Reports**: `profitReport()` builds store P&L purely from ledger day categories; the full-loop
  soak test asserts cost groups == ledger expenses and store sales == the store's own tally.
- Balance (`npm run balance`, full-loop bot): ~$400-700/day profit, rating 3.5-3.9, cleanliness
  76-87. Brand Soul drifts down slowly if you only sell Classic formulas; that is intended.

## Design decisions to confirm with the owner

- Online orders keep coming in the store era at 55% of the home rate (brief lists both online and
  store revenue; nothing says online stops).
- Marketing campaigns also lift foot traffic at half strength (local marketing proper is M4).
- Display restocking is automatic below a per-display level the player sets, plus a manual
  "Restock now". There is no fully manual (player-carries-stock) mode.
- The brief's section 11 overlays (traffic heat map, low stock, staff coverage, satisfaction,
  cleanliness, profitability) are not built; they are not on the Milestone 4 list.
- The checkout counter, back-room fixtures and walls are fixed in M3; build mode covers shelves,
  tables and plants only.

## What to build next

Follow the brief's milestone lists (sections 5, 6, 8 and 15). Suggested shape, not yet started:

### Next: Era III, Milestone 5 (location choice, second store, store managers, separate inventory
and KPIs, store switching, inventory transfers). `state.store` will need to become `state.stores[]`
with a save migration; most store functions already take `state.store` in one place.

### Era II: First Retail Store, Milestone 4 (done; original notes kept for context)

Brief list: restocking, cleaning, staff schedules and training, expanded customer archetypes
(gift, hair-care, trend shoppers: these need gift sets / hair care products), store design score,
marketing, additional products, store profitability reports, and the section 11 overlays.

The original Era II notes, kept for context:

1. **Era switch.** `signLease()` already sets `milestone.leaseSigned`. Add `state.era = 'store'`
   and a transition (the brief wants the first store to feel like a major visual reward).
   `main.js` currently always builds `HomeWorld`; choose the world class from `state.era`.
2. **`js/world/store.js`** (a `StoreWorld` with the same interface as `HomeWorld`: `update`,
   `dispose`, `anchors`, `setHover`, `burst`, `cheer`) and reuse `kit.js` and `character.js`.
   Customers need variety: `createCharacter` already takes skin, hair, colours and two builds.
3. **`js/sim/store.js`**: a grid-based floor, shelves with slots assigned to recipes, shelf stock
   separate from back stock, customer spawn by foot traffic, archetypes (brief section 5 table),
   browse -> pick -> queue -> checkout -> leave, patience and abandonment, satisfaction feeding
   the existing `addReview()` and Brand Soul. Movement in Era I is straight lines between fixed
   `POINTS`; a store with placeable furniture needs grid pathfinding (A* is enough for 30 to 50
   customers) and a recovery path so nobody gets permanently stuck (a brief testing priority).
4. **Staff**: roles, wages through `forceExpense`, hiring, training. The Staff nav item exists
   and is locked (`NAV` in `ui.js`, `staffPanel` in `panels.js`).
5. **Build mode**: place, rotate, move and sell furniture on the grid with validation.
6. Restocking, cleanliness, store design score, local marketing, more products (the brief lists
   hair care, gift sets, bath bombs), profitability reports, and the overlays in brief section 11.
7. Production continues in the store's back room; `production.js` and `workers.js` can be reused.

### Era III: Retail Chain (milestones 5 and 6)

Location choice, second store with its own inventory and KPIs, store managers, store switching,
inventory transfers, central production, distribution scheduling, wholesale contracts, regional
managers, brand-wide reports, and an ending milestone. State will need to become per-store
(`state.stores[]`); plan the save migration when Era II's state is designed so it is not redone.

### Smaller known gaps in Era I

- Not tested on phones; the layout has media queries but they are unverified.
- No offline mode (three.js and fonts come from CDNs). Vendoring them would fix that.
- Toasts and some panel content still use emoji; nav, HUD and product swatches use SVG icons.
- The helper and founder can overlap when standing idle.
- The "Developer" ledger category from the diagnostics panel counts toward today's profit.
