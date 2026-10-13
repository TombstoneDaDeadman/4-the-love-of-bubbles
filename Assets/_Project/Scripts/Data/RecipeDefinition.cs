using UnityEngine;
namespace Bubbles.Data
{
    [CreateAssetMenu(menuName = "Bubbles/Recipe")]
    public sealed class RecipeDefinition : ScriptableObject
    {
        public string id;
        public int productIndex, yield;
        public float seconds;
        public int[] ingredients;
    }
}
