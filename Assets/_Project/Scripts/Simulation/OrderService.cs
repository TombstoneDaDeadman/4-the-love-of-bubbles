using Bubbles.Data;
using UnityEngine;
namespace Bubbles.Simulation
{
    public sealed class OrderService
    {
        readonly BusinessState state; readonly GameCatalog catalog; readonly EconomyService economy;
        public OrderService(BusinessState s, GameCatalog c, EconomyService e) { state = s; catalog = c; economy = e; }
        public void Tick()
        {
            for (int i = state.orders.Count - 1; i >= 0; i--)
                if (state.orders[i].deadline <= state.elapsedSeconds) { state.orders.RemoveAt(i); state.brandSoul = Mathf.Max(0, state.brandSoul - 1); }
            if (state.elapsedSeconds < state.nextOrderAt) return;
            if (state.orders.Count < 5)
            {
                int n = state.orderSequence++;
                state.orders.Add(new CustomerOrder { id = n + 1, productIndex = n % 3,
                    quantity = 2 + (n / 3) % 3, deadline = state.elapsedSeconds + 300 });
            }
            state.nextOrderAt = state.elapsedSeconds + (state.fulfilledOrders >= 6 ? 30 : 40);
        }
        public bool Fulfill(int id, out string message)
        {
            var order = state.orders.Find(o => o.id == id);
            if (order == null) { message = "That order is no longer available."; return false; }
            if (order.deadline <= state.elapsedSeconds) { message = "That order has expired."; return false; }
            if (state.products[order.productIndex] < order.quantity) { message = "Make more " + catalog.products[order.productIndex].displayName + " first."; return false; }
            economy.Transact((long)order.quantity * catalog.products[order.productIndex].priceCents, "Sales", "Order #" + id);
            state.products[order.productIndex] -= order.quantity;
            state.orders.Remove(order); state.fulfilledOrders++; state.brandSoul = Mathf.Min(100, state.brandSoul + 1);
            message = "Order #" + id + " shipped. Thank you for supporting handmade!"; return true;
        }
    }
}
