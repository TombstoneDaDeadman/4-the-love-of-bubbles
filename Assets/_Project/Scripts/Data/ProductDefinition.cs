using UnityEngine;
namespace Bubbles.Data
{
    [CreateAssetMenu(menuName = "Bubbles/Product")]
    public sealed class ProductDefinition : ScriptableObject
    {
        public string id, displayName, fragrance;
        public int priceCents;
        public Color color;
    }
}
