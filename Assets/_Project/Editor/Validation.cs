using System;
using System.IO;
using System.Linq;
using Bubbles.Data;
using Bubbles.Save;
using Bubbles.Simulation;
using UnityEditor;
using UnityEngine;
namespace Bubbles.Editor
{
    public static class Validation
    {
        static int passed;
        static void Assert(bool value,string description)
        { if(!value)throw new Exception("FAILED: "+description);passed++;Debug.Log("PASS: "+description); }
        [MenuItem("Bubbles/Run simulation validation")]
        public static void RunAll()
        {
            passed=0;var catalog=AssetDatabase.LoadAssetAtPath<GameCatalog>("Assets/_Project/Data/SO_GameCatalog.asset");
            Assert(catalog!=null,"catalog assets exist");
            var sim=new BusinessSimulation(catalog);var s=sim.State;
            Assert(sim.Economy.Reconciles,"opening cash reconciles");
            var startingIngredients=(int[])s.ingredients.Clone();
            Assert(sim.Production.Queue(0,out _),"body butter queues");
            Assert(s.ingredients.SequenceEqual(new[]{6,10,11,12,12,30,16}),"correct ingredients and jars reserved");
            sim.Advance(44);Assert(s.products[0]==0 && s.jobs.Count==1,"batch cannot finish early");
            sim.Advance(1);Assert(s.products[0]==6 && s.jobs.Count==0,"batch yields exactly six at 45 seconds");
            Assert(s.orders.Count==1 && s.orders[0].productIndex==0,"first customer requests starter product");
            long cash=s.cashCents;
            Assert(sim.Orders.Fulfill(s.orders[0].id,out _) && s.products[0]==4 && s.cashCents==cash+2400,"shipment conserves stock and credits exact price");
            Assert(!sim.Orders.Fulfill(1,out _) && s.cashCents==cash+2400,"order cannot pay twice");
            var beforeCancel=(int[])s.ingredients.Clone();
            sim.Production.Queue(1,out _);sim.Advance(3);sim.Production.Cancel(0,out _);
            Assert(s.ingredients.SequenceEqual(beforeCancel) && s.jobs.Count==0,"cancel refunds all reserved ingredients");
            sim.Paused=true;double elapsed=s.elapsedSeconds;sim.Advance(10);
            Assert(s.elapsedSeconds==elapsed,"pause stops simulation");sim.Paused=false;sim.Speed=3;sim.Advance(2);
            Assert(s.elapsedSeconds==elapsed+6,"3x speed advances exact time");
            Assert(sim.Upgrade(out _) && s.mixerUpgraded,"upgrade installs once");cash=s.cashCents;
            Assert(!sim.Upgrade(out _) && s.cashCents==cash,"repeat upgrade cannot debit cash");
            sim.Production.Queue(2,out _);sim.Speed=1;sim.Advance(40.0/1.5);
            Assert(s.products[2]==6,"upgraded mixer is 50 percent faster");
            Assert(sim.Economy.Reconciles && sim.Economy.Revenue-sim.Economy.Expenses==s.cashCents-25000,"ledger and reports reconcile");
            Assert(!sim.Economy.Transact(-s.cashCents-1,"Supplies","test"),"insufficient funds rejected");
            var empty=new BusinessSimulation(catalog);Array.Clear(empty.State.ingredients,0,7);
            Assert(!empty.Production.Queue(0,out _) && empty.State.ingredients.All(q=>q==0),"missing ingredients cannot create negative inventory");
            var full=new BusinessSimulation(catalog);full.State.products[0]=70;
            Assert(!full.Production.Queue(0,out _) && full.State.jobs.Count==0,"finished shelf capacity enforced including reserved output");
            var buy=new BusinessSimulation(catalog);cash=buy.State.cashCents;int count=buy.State.ingredients[0];
            Assert(buy.Inventory.Buy(0,out _) && buy.State.cashCents==cash-1200 && buy.State.ingredients[0]==count+12,"supplier pack balances cash and stock");
            var queue=new BusinessSimulation(catalog);queue.State.ingredients=new[]{100,100,100,100,100,100,100};
            for(int i=0;i<4;i++)queue.Production.Queue(i%3,out _);
            Assert(!queue.Production.Queue(0,out _) && queue.State.jobs.Count==4,"four job queue limit");
            // Save in a disposable project verification folder, never in the player's profile.
            string dir=Path.Combine(Directory.GetCurrentDirectory(),"Verification","SaveTests",Guid.NewGuid().ToString("N"));
            var saves=new SaveService(catalog,dir);sim.Production.Queue(0,out _);sim.Advance(3);
            Assert(saves.Save(s,out _),"versioned save writes");string exact=JsonUtility.ToJson(s);
            Assert(saves.Load(out var loaded,out _) && JsonUtility.ToJson(loaded)==exact,"save restores inventory, jobs, orders, clock and ledger exactly");
            sim.Advance(2);Assert(saves.Save(s,out _),"rolling backup created");
            File.WriteAllText(saves.PathOnDisk,"corrupt");
            Assert(saves.Load(out loaded,out var recovery) && JsonUtility.ToJson(loaded)==exact && recovery.Contains("backup"),"corrupt primary recovers rolling backup");
            var unsupported=new BusinessState{version=99};Assert(!saves.Save(unsupported,out _),"unknown schema rejected safely");
            var expire=new BusinessSimulation(catalog);expire.Advance(321);
            Assert(expire.State.brandSoul<75 && expire.State.orders.Count<=5,"expired orders penalize reputation and demand remains bounded");
            sim.Paused=false;sim.Speed=1;Assert(!sim.OutgrownHome,"progression cannot unlock prematurely");
            s.fulfilledOrders=15;s.cashCents=80000;s.brandSoul=70;s.mixerUpgraded=true;
            Assert(sim.OutgrownHome,"all four progression requirements unlock milestone");
            Directory.CreateDirectory("Verification");File.WriteAllText("Verification/simulation-results.txt",passed+" assertions passed\nUnity "+Application.unityVersion);
            Debug.Log("BUBBLES_VALIDATION_OK "+passed+" assertions");
        }
    }
}
