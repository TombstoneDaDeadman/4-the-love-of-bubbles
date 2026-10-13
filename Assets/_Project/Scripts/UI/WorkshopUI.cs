using System;
using System.Linq;
using Bubbles.Core;
using Bubbles.Simulation;
using UnityEngine;
using UnityEngine.UIElements;
namespace Bubbles.UI
{
    public sealed class WorkshopUI : MonoBehaviour
    {
        GameBootstrap game; VisualElement root, header, left, right, footer, menu;
        Label stats, notice; string selected = "Production"; float refresh; bool diagnostics, confirmNew;
        public bool MenuVisible { get; private set; } = true;
        public void Initialize(GameBootstrap bootstrap)
        {
            game = bootstrap; root = GetComponent<UIDocument>().rootVisualElement;
            root.styleSheets.Add(Resources.Load<StyleSheet>("Workshop")); root.pickingMode = PickingMode.Ignore;
            header = Box(root, "header"); Text(header, "4 THE LOVE OF BUBBLES", "brand"); stats = Text(header, "", "stats");
            left = Box(root, "left panel"); right = Box(root, "right panel");
            footer = Box(root, "footer"); notice = Text(footer, "", "notice");
            Text(footer, "Q / E or right-drag: rotate   •   Wheel: zoom   •   Space: pause   •   Home: reset view", "hint");
            menu = Box(root, "menu"); root.schedule.Execute(Refresh).Every(500); ShowMenu();
        }
        static VisualElement Box(VisualElement parent, string classes)
        {
            var v = new VisualElement(); foreach (string c in classes.Split(' ')) v.AddToClassList(c); parent.Add(v); return v;
        }
        static Label Text(VisualElement parent, string text, string style = "body")
        {
            var l = new Label(text); l.AddToClassList(style); parent.Add(l); return l;
        }
        static Button Action(VisualElement parent, string text, System.Action click, bool enabled = true)
        {
            var b = new Button(click) { text = text }; b.SetEnabled(enabled); parent.Add(b); return b;
        }
        public bool IsOverPanel(Vector2 position)
        {
            if (MenuVisible) return true;
            var point = RuntimePanelUtils.ScreenToPanel(root.panel, new Vector2(position.x, Screen.height - position.y));
            return left.worldBound.Contains(point) || right.worldBound.Contains(point) || header.worldBound.Contains(point) || footer.worldBound.Contains(point);
        }
        public void SelectPanel(string panel) { selected = panel; Refresh(); }
        public void ToggleDiagnostics() { diagnostics = !diagnostics; selected = "Reports"; Refresh(); }
        public void ShowMenu()
        {
            MenuVisible = true; menu.style.display = DisplayStyle.Flex;
            left.style.display = right.style.display = footer.style.display = DisplayStyle.None;
            menu.Clear(); var card = Box(menu, "menu-card"); Text(card, "FROM YOUR HOME,\nWITH LOVE.", "hero");
            Text(card, "4 The Love Of Bubbles", "subtitle");
            Text(card, "Build a handmade bath & body business, one thoughtful batch at a time.\n\nHome Workshop • First playable prototype", "body");
            if (game.Simulation.State.elapsedSeconds > 0) Action(card, "Return to workshop", game.Resume);
            Action(card, "Continue saved business", game.LoadBusiness, game.Saves.Exists);
            Action(card, confirmNew ? "Confirm new business" : "Start a new business", () =>
            {
                if (game.Saves.Exists && !confirmNew) { confirmNew = true; ShowMenu(); return; }
                confirmNew = false; game.NewBusiness();
            });
            if (confirmNew) Text(card, "Your next save will replace the current business. A previous save is kept as backup.", "muted");
            Text(card, "Workshop furniture: Kenney (CC0)\nPrototype founder and product shapes are placeholders.", "muted");
            Text(card, game.LastMessage, "hint");
        }
        public void ShowGame()
        {
            MenuVisible = false; menu.style.display = DisplayStyle.None;
            left.style.display = right.style.display = footer.style.display = DisplayStyle.Flex; Refresh();
        }
        public void Refresh()
        {
            if (stats == null) return;
            var sim = game.Simulation; var s = sim.State;
            int minute = (int)(s.elapsedSeconds % 300 / 300 * 480) + 540;
            stats.text = $"CASH  {EconomyService.Money(s.cashCents)}     TODAY  {EconomyService.Money(sim.Economy.DailyProfit)}     BRAND SOUL  {s.brandSoul}/100     DAY {(int)(s.elapsedSeconds / 300) + 1}  {minute / 60:00}:{minute % 60:00}";
            if (MenuVisible) return;
            notice.text = game.LastMessage;
            left.Clear(); Text(left, "HOME WORKSHOP", "eyebrow"); Text(left, "Made with care", "title");
            var row = Box(left, "row");
            Action(row, sim.Paused ? "Resume" : "Pause", () => { sim.Paused = !sim.Paused; Refresh(); });
            Action(row, sim.Speed + "x speed", () => { sim.Speed = sim.Speed == 1 ? 3 : 1; Refresh(); });
            foreach (string panel in new[] { "Production", "Supplies", "Orders", "Upgrade", "Reports" })
            {
                string p = panel; var b = Action(left, p == "Orders" ? $"Orders ({s.orders.Count})" : p, () => SelectPanel(p));
                if (p == selected) b.AddToClassList("selected");
            }
            Text(left, "YOUR NEXT STEP", "eyebrow");
            string tip = s.fulfilledOrders == 0 ? "Make Body Butter, then ship your first order." : !s.mixerUpgraded ? "Keep orders moving. Save $150 to upgrade the mixer." : "Grow beyond home: 15 orders, $800 cash and Brand Soul 70+.";
            Text(left, tip, "body");
            Text(left, $"Orders shipped: {s.fulfilledOrders}/15\nMixer: {(s.mixerUpgraded ? "upgraded" : "starter")}\nSavings: {EconomyService.Money(s.cashCents)} / $800", "muted");
            if (sim.OutgrownHome) Text(left, "YOU'VE OUTGROWN HOME!\nYour first retail store is the next chapter.", "success");
            var saves = Box(left, "row"); Action(saves, "Save", game.SaveBusiness); Action(saves, "Menu", game.ShowMenu);
            var previousScroll = right.Q<ScrollView>();
            var offset = previousScroll?.scrollOffset ?? Vector2.zero;
            right.Clear(); Text(right, selected.ToUpperInvariant(), "eyebrow");
            var scroll = new ScrollView(); scroll.style.flexGrow = 1; right.Add(scroll);
            switch (selected)
            {
                case "Production": DrawProduction(scroll); break;
                case "Supplies": DrawSupplies(scroll); break;
                case "Orders": DrawOrders(scroll); break;
                case "Upgrade":
                    Text(scroll, "Precision mixer", "title"); Text(scroll, "The same handmade recipes, with a smoother workflow.\n\n50% faster production • $150 one-time cost", "body");
                    Action(scroll, s.mixerUpgraded ? "Already installed" : "Upgrade mixer · $150", () => { sim.Upgrade(out var m); game.Notify(m); }, !s.mixerUpgraded && s.cashCents >= 15000); break;
                case "Reports": DrawReports(scroll); break;
            }
            scroll.schedule.Execute(() => scroll.scrollOffset = offset);
        }
        void DrawProduction(VisualElement parent)
        {
            var sim = game.Simulation; var s = sim.State;
            Text(parent, "Make a little magic", "title"); Text(parent, "One mixing station · four queued batches\nIngredients and packaging reserved when queued.", "muted");
            for (int i = 0; i < game.catalog.recipes.Length; i++)
            {
                int index = i; var r = game.catalog.recipes[i]; var p = game.catalog.products[r.productIndex];
                var card = Box(parent, "card"); Text(card, p.displayName, "subtitle");
                Text(card, $"{p.fragrance}\n{r.yield} units · {r.seconds / (s.mixerUpgraded ? 1.5f : 1):0}s · {EconomyService.Money(p.priceCents)} / unit\nReady to sell: {s.products[r.productIndex]}", "body");
                Text(card, string.Join(" · ", r.ingredients.Select((n, k) => n > 0 ? n + " " + game.catalog.ingredients[k].displayName : null).Where(t => t != null)), "muted");
                bool allowed = sim.Inventory.CanReserve(r) && s.jobs.Count < 4 && sim.Inventory.ProductCount + sim.Inventory.ReservedOutput + r.yield <= 72;
                Action(card, "Queue batch", () => { sim.Production.Queue(index, out var m); game.Notify(m); }, allowed);
                if (!allowed) Text(card, s.jobs.Count >= 4 ? "Queue full" : sim.Inventory.ProductCount + sim.Inventory.ReservedOutput + r.yield > 72 ? "Ship orders to free shelf space" : "Restock supplies to make this batch", "hint");
            }
            Text(parent, "BATCH QUEUE", "eyebrow");
            if (s.jobs.Count == 0) Text(parent, "Your station is ready for a batch.", "muted");
            for (int i = 0; i < s.jobs.Count; i++)
            {
                int index = i; var job = s.jobs[i]; var r = game.catalog.recipes[job.recipeIndex]; var card = Box(parent, "card");
                Text(card, (i == 0 ? "Mixing: " : "Waiting: ") + game.catalog.products[r.productIndex].displayName, "body");
                if (i == 0) card.Add(new ProgressBar { lowValue = 0, highValue = 100, value = (float)(100 * (1 - job.remainingSeconds / r.seconds)), title = $"{job.remainingSeconds / (s.mixerUpgraded ? 1.5 : 1):0}s left" });
                Action(card, "Cancel & refund supplies", () => { sim.Production.Cancel(index, out var m); game.Notify(m); });
            }
        }
        void DrawSupplies(VisualElement parent)
        {
            var sim = game.Simulation; Text(parent, "The ingredient shelf", "title");
            Text(parent, $"Supplies {sim.Inventory.IngredientCount}/240\nFinished goods {sim.Inventory.ProductCount}/72 (+{sim.Inventory.ReservedOutput} reserved)", "muted");
            for (int i = 0; i < game.catalog.ingredients.Length; i++)
            {
                int index = i; var d = game.catalog.ingredients[i]; var card = Box(parent, "card"); Text(card, $"{d.displayName} · {sim.State.ingredients[i]} in stock", "subtitle");
                Action(card, $"Buy {d.packSize} · {EconomyService.Money(d.packCostCents)}", () => { sim.Inventory.Buy(index, out var m); game.Notify(m); }, sim.State.cashCents >= d.packCostCents && sim.Inventory.IngredientCount + d.packSize <= 240);
            }
        }
        void DrawOrders(VisualElement parent)
        {
            var sim = game.Simulation; Text(parent, "Packed with love", "title"); Text(parent, "Local & online orders. Shipping earns the listed revenue. No walk-in customers in this chapter.", "muted");
            if (sim.State.orders.Count == 0) Text(parent, "No open orders. The next one will arrive soon; keep a few products ready.", "body");
            foreach (var o in sim.State.orders)
            {
                int id = o.id; var p = game.catalog.products[o.productIndex]; var card = Box(parent, "card");
                Text(card, "Order #" + o.id, "subtitle"); Text(card, $"{o.quantity} × {p.displayName}\n{EconomyService.Money((long)o.quantity * p.priceCents)} · {Math.Max(0, o.deadline - sim.State.elapsedSeconds):0}s to ship", "body");
                Action(card, "Pack & ship", () => { sim.Orders.Fulfill(id, out var m); game.Notify(m); }, sim.State.products[o.productIndex] >= o.quantity);
                if (sim.State.products[o.productIndex] < o.quantity) Text(card, "Need " + (o.quantity - sim.State.products[o.productIndex]) + " more units", "hint");
            }
        }
        void DrawReports(VisualElement parent)
        {
            var sim = game.Simulation; Text(parent, "A business with heart", "title");
            Text(parent, $"Gross revenue  {EconomyService.Money(sim.Economy.Revenue)}\nCash expenses  {EconomyService.Money(sim.Economy.Expenses)}\nCash profit  {EconomyService.Money(sim.Economy.NetProfit)}\nOrders fulfilled  {sim.State.fulfilledOrders}\nBrand Soul  {sim.State.brandSoul}/100", "body");
            Text(parent, "Cash profit includes equipment and supply purchases. Opening supplies are gifted. A missed deadline costs 1 Brand Soul; a shipped order restores 1.", "muted");
            Text(parent, "RECENT TRANSACTIONS", "eyebrow");
            foreach (var t in sim.State.ledger.TakeLast(12).Reverse()) Text(parent, $"{t.description}\n{EconomyService.Money(t.cents)} · {t.category}", "ledger");
            Action(parent, diagnostics ? "Hide diagnostics" : "Show diagnostics (F3)", ToggleDiagnostics);
            if (diagnostics) Text(parent, $"Save schema: v{sim.State.version}\nSimulation: {sim.State.elapsedSeconds:0.00}s\nLedger reconciles: {sim.Economy.Reconciles}\nQueue: {sim.State.jobs.Count}/4\nOpen orders: {sim.State.orders.Count}/5\nAutosave: every 60 real seconds\n{game.Saves.PathOnDisk}", "muted");
        }
    }
}
