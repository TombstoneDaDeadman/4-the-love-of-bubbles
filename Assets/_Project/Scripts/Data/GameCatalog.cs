using UnityEngine;
namespace Bubbles.Data
{
    [CreateAssetMenu(menuName = "Bubbles/Catalog")]
    public sealed class GameCatalog : ScriptableObject
    {
        public IngredientDefinition[] ingredients;
        public ProductDefinition[] products;
        public RecipeDefinition[] recipes;
    }
}
