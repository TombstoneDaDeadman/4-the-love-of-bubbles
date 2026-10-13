using System;
using System.Linq;
namespace Bubbles.Simulation
{
    public sealed class EconomyService
    {
        readonly BusinessState state;
        public EconomyService(BusinessState state) { this.state = state; }
        public bool Transact(long cents, string category, string description)
        {
            if (cents == 0 || cents < -state.cashCents) return false;
            state.cashCents = checked(state.cashCents + cents);
            state.ledger.Add(new EconomyTransaction { time = state.elapsedSeconds, cents = cents,
                category = category, description = description });
            return true;
        }
        public long Revenue => state.ledger.Where(t => t.category == "Sales").Sum(t => t.cents);
        public long Expenses => -state.ledger.Where(t => t.cents < 0).Sum(t => t.cents);
        public long NetProfit => Revenue - Expenses;
        public long DailyProfit => state.ledger.Where(t => (int)(t.time / 300) == (int)(state.elapsedSeconds / 300)).Sum(t => t.cents);
        public bool Reconciles => 25000 + state.ledger.Sum(t => t.cents) == state.cashCents;
        public static string Money(long cents) => "$" + (cents / 100.0).ToString("N2", System.Globalization.CultureInfo.InvariantCulture);
    }
}
