using System;
using System.Collections.Generic;
namespace Bubbles.Simulation
{
    [Serializable] public sealed class BusinessState
    {
        public int version = 1;
        public long cashCents = 25000;
        public double elapsedSeconds, nextOrderAt = 20;
        public int[] ingredients = { 12, 12, 12, 12, 12, 36, 16 };
        public int[] products = { 0, 0, 0 };
        public int brandSoul = 75, fulfilledOrders, orderSequence;
        public bool mixerUpgraded;
        public List<ProductionJob> jobs = new();
        public List<CustomerOrder> orders = new();
        public List<EconomyTransaction> ledger = new();
    }
    [Serializable] public sealed class ProductionJob
    {
        public int recipeIndex;
        public double remainingSeconds;
    }
    [Serializable] public sealed class CustomerOrder
    {
        public int id, productIndex, quantity;
        public double deadline;
    }
    [Serializable] public sealed class EconomyTransaction
    {
        public double time;
        public long cents;
        public string category, description;
    }
}
