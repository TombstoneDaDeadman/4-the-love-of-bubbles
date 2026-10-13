using Bubbles.Data;
namespace Bubbles.Simulation
{
    public sealed class ProductionService
    {
        readonly BusinessState state; readonly GameCatalog catalog; readonly InventoryService inventory;
        public ProductionService(BusinessState s, GameCatalog c, InventoryService i) { state = s; catalog = c; inventory = i; }
        public bool Queue(int index, out string message)
        {
            var r = catalog.recipes[index];
            if (state.jobs.Count >= 4) { message = "The four-batch queue is full."; return false; }
            if (!inventory.CanReserve(r)) { message = "Missing ingredients or packaging. Restock at the supply shelf."; return false; }
            if (inventory.ProductCount + inventory.ReservedOutput + r.yield > InventoryService.ProductCapacity) { message = "Finished-goods shelf is full. Ship some orders."; return false; }
            inventory.Reserve(r);
            state.jobs.Add(new ProductionJob { recipeIndex = index, remainingSeconds = r.seconds });
            message = "Queued " + catalog.products[r.productIndex].displayName + "."; return true;
        }
        public bool Cancel(int index, out string message)
        {
            var recipe = catalog.recipes[state.jobs[index].recipeIndex];
            int refund = 0; foreach (int n in recipe.ingredients) refund += n;
            if (inventory.IngredientCount + refund > InventoryService.IngredientCapacity) { message = "Make room on the supply shelf before refunding this batch."; return false; }
            inventory.Refund(recipe); state.jobs.RemoveAt(index);
            message = "Batch canceled; every ingredient and package was returned."; return true;
        }
        public void Tick(double seconds)
        {
            double work = seconds * (state.mixerUpgraded ? 1.5 : 1);
            while (state.jobs.Count > 0 && work > 0)
            {
                var job = state.jobs[0];
                if (work + 1e-9 < job.remainingSeconds) { job.remainingSeconds -= work; break; }
                work -= job.remainingSeconds;
                var recipe = catalog.recipes[job.recipeIndex];
                state.products[recipe.productIndex] += recipe.yield;
                state.jobs.RemoveAt(0);
            }
        }
    }
}
