# 4 The Love Of Bubbles

A warm, stylised 3D tycoon game about growing a handmade bath, body, skin and hair-care business,
from a kitchen stovetop to a store of your own. It runs entirely in the browser.

**Chapter One: The Home Business** is playable now.

## Play

Open `index.html` through any static web server (browsers block ES modules on `file://`):

```bash
npm start
```

Then visit http://localhost:5173. No install step and no build step. The only external
dependencies are three.js and two Google Fonts, loaded from a CDN, so you need to be online.

If the repository has GitHub Pages enabled (Settings → Pages → Deploy from branch → `main` / root),
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
| ` (backtick) | Developer diagnostics |

Click the stove, pantry, shelves, packing table or laptop in the room to open the matching panel.

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
  workers.js          founder + helper task logic (walk, prep, stock, pack)
  business.js         upgrades, marketing, goals, the master tick / game clock
  save.js             versioned save/load, autosave, rolling backup, migrations
js/world/             three.js presentation (reads state, never changes it)
  engine.js           renderer, lighting, management camera, picking
  kit.js              materials, procedural textures, product mesh families
  character.js        procedural characters and animation library
  home.js             the home workshop scene
js/ui/                HUD, panels, orders rail, tutorial, modals, diagnostics
js/audio.js           synthesised sound effects and music (no audio files)
tests/sim.test.mjs    economy, inventory, production, save and soak tests
```

## Tests

```bash
npm test
```

Covers the brief's testing priorities: money can only move through the ledger, production consumes
and produces exactly what the recipe says, inventory never goes negative, cancellation rules,
save/load round-trips, save migration and backup recovery, and a soak test where a bot plays the
whole home era to the first-store milestone. `npm run balance` prints the bot's day-by-day numbers.

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
- [ ] Milestone 3 and 4: the first store (walk-in customers, shelves, checkout, staff, build mode)
- [ ] Milestone 5 and 6: second store and chain management
