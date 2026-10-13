using System;
using System.IO;
using System.Linq;
using Bubbles.Data;
using Bubbles.Simulation;
using UnityEngine;
namespace Bubbles.Save
{
    public sealed class SaveService
    {
        readonly string path; readonly GameCatalog catalog;
        public SaveService(GameCatalog catalog, string directory = null)
        {
            this.catalog = catalog;
            path = Path.Combine(directory ?? Application.persistentDataPath, "home-business-v1.json");
        }
        public string PathOnDisk => path;
        public bool Exists => File.Exists(path) || File.Exists(path + ".bak");
        public bool Save(BusinessState state, out string message)
        {
            try
            {
                Validate(state);
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllText(path + ".tmp", JsonUtility.ToJson(state, true));
                // Never overwrite a valid rolling backup with a corrupt primary save.
                if (File.Exists(path))
                {
                    try { Validate(JsonUtility.FromJson<BusinessState>(File.ReadAllText(path))); File.Copy(path, path + ".bak", true); }
                    catch (Exception) { }
                }
                if (File.Exists(path)) File.Replace(path + ".tmp", path, null);
                else File.Move(path + ".tmp", path);
                message = "Business saved."; return true;
            }
            catch (Exception e) { message = "Could not save: " + e.Message; return false; }
        }
        public bool Load(out BusinessState state, out string message)
        {
            foreach (string candidate in new[] { path, path + ".bak" })
            {
                if (!File.Exists(candidate)) continue;
                try
                {
                    state = JsonUtility.FromJson<BusinessState>(File.ReadAllText(candidate)); Validate(state);
                    message = candidate == path ? "Business loaded." : "Recovered the previous save from backup."; return true;
                }
                catch (Exception e) { Debug.LogWarning("Save recovery: " + e.Message); }
            }
            state = null; message = "No compatible save could be loaded. Your current business is unchanged."; return false;
        }
        public void Validate(BusinessState state)
        {
            if (state == null || state.version != 1) throw new InvalidDataException("Unsupported save version.");
            if (state.ingredients == null || state.ingredients.Length != catalog.ingredients.Length || state.products == null || state.products.Length != catalog.products.Length)
                throw new InvalidDataException("Inventory does not match this catalog.");
            state.jobs ??= new(); state.orders ??= new(); state.ledger ??= new();
            bool Finite(double n) => !double.IsNaN(n) && !double.IsInfinity(n);
            if (state.cashCents < 0 || state.cashCents > 100000000000 || state.ingredients.Any(n => n < 0 || n > 240) || state.products.Any(n => n < 0 || n > 72)
                || state.ingredients.Sum() > 240 || state.products.Sum() > 72 || !Finite(state.elapsedSeconds) || state.elapsedSeconds < 0
                || !Finite(state.nextOrderAt) || state.nextOrderAt < 0 || state.brandSoul < 0 || state.brandSoul > 100 || state.fulfilledOrders < 0 || state.orderSequence < 0)
                throw new InvalidDataException("Invalid business values.");
            if (state.jobs.Count > 4 || state.jobs.Any(j => j == null || j.recipeIndex < 0 || j.recipeIndex >= catalog.recipes.Length || !Finite(j.remainingSeconds)
                || j.remainingSeconds <= 0 || j.remainingSeconds > catalog.recipes[j.recipeIndex].seconds)
                || state.products.Sum() + state.jobs.Sum(j => catalog.recipes[j.recipeIndex].yield) > 72)
                throw new InvalidDataException("Invalid production queue.");
            if (state.orders.Count > 5 || state.orders.Any(o => o == null || o.id < 1 || o.id > state.orderSequence || o.productIndex < 0 || o.productIndex >= catalog.products.Length
                || o.quantity < 2 || o.quantity > 4 || !Finite(o.deadline) || o.deadline < 0) || state.orders.Select(o => o.id).Distinct().Count() != state.orders.Count)
                throw new InvalidDataException("Invalid customer orders.");
            if (state.ledger.Any(t => t == null || !Finite(t.time) || t.time < 0 || t.time > state.elapsedSeconds || t.cents == 0 || Math.Abs(t.cents) > 100000000000
                || (t.category != "Sales" && t.category != "Supplies" && t.category != "Equipment")) || !new EconomyService(state).Reconciles)
                throw new InvalidDataException("Economy ledger does not reconcile.");
        }
    }
}
