using Bubbles.Data;
namespace Bubbles.Simulation
{
    public sealed class BusinessSimulation
    {
        public readonly BusinessState State;
        public readonly EconomyService Economy;
        public readonly InventoryService Inventory;
        public readonly ProductionService Production;
        public readonly OrderService Orders;
        public int Speed { get; set; } = 1;
        public bool Paused { get; set; }
        public bool OutgrownHome => State.fulfilledOrders >= 15 && State.mixerUpgraded && State.cashCents >= 80000 && State.brandSoul >= 70;
        public BusinessSimulation(GameCatalog catalog, BusinessState state = null)
        {
            State = state ?? new BusinessState(); Economy = new EconomyService(State);
            Inventory = new InventoryService(State, catalog, Economy);
            Production = new ProductionService(State, catalog, Inventory);
            Orders = new OrderService(State, catalog, Economy);
        }
        public void Advance(double realSeconds)
        {
            if (Paused || realSeconds <= 0) return;
            // Small ticks keep order deadlines consistent across slow frames and fast-forward.
            double remaining = realSeconds * Speed;
            while (remaining > 0)
            {
                double dt = System.Math.Min(remaining, 0.25);
                State.elapsedSeconds += dt; Production.Tick(dt); Orders.Tick(); remaining -= dt;
            }
        }
        public bool Upgrade(out string message)
        {
            if (State.mixerUpgraded) { message = "The mixer is already upgraded."; return false; }
            if (!Economy.Transact(-15000, "Equipment", "Precision mixer")) { message = "Save $150 for the precision mixer."; return false; }
            State.mixerUpgraded = true; message = "Mixer upgraded. Every batch now runs 50% faster."; return true;
        }
    }
}
