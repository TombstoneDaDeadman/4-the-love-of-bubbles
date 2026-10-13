using System.Linq;
using Bubbles.Data;
namespace Bubbles.Simulation
{
    public sealed class InventoryService
    {
        public const int IngredientCapacity = 240, ProductCapacity = 72;
        readonly BusinessState state; readonly GameCatalog catalog; readonly EconomyService economy;
        public InventoryService(BusinessState s, GameCatalog c, EconomyService e) { state = s; catalog = c; economy = e; }
        public int IngredientCount => state.ingredients.Sum();
        public int ProductCount => state.products.Sum();
        public int ReservedOutput => state.jobs.Sum(j => catalog.recipes[j.recipeIndex].yield);
        public bool Buy(int index, out string message)
        {
            var item = catalog.ingredients[index];
            if (IngredientCount + item.packSize > IngredientCapacity) { message = "Ingredient storage is full. Make a batch first."; return false; }
            if (!economy.Transact(-item.packCostCents, "Supplies", item.displayName + " restock")) { message = "Not enough cash for this pack."; return false; }
            state.ingredients[index] += item.packSize;
            message = "Restocked " + item.displayName + "."; return true;
        }
        public bool CanReserve(RecipeDefinition recipe) => recipe.ingredients.Where((n, i) => n > state.ingredients[i]).Count() == 0;
        public void Reserve(RecipeDefinition recipe) { for (int i = 0; i < state.ingredients.Length; i++) state.ingredients[i] -= recipe.ingredients[i]; }
        public void Refund(RecipeDefinition recipe) { for (int i = 0; i < state.ingredients.Length; i++) state.ingredients[i] += recipe.ingredients[i]; }
    }
}
