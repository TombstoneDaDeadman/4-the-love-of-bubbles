using UnityEngine;
namespace Bubbles.Data
{
    [CreateAssetMenu(menuName = "Bubbles/Ingredient")]
    public sealed class IngredientDefinition : ScriptableObject
    {
        public string id, displayName;
        public int packSize, packCostCents;
    }
}
