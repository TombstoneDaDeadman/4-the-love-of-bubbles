using System;
using System.Collections;
using System.IO;
using System.Linq;
using Bubbles.Core;
using UnityEditor;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.UIElements;
namespace Bubbles.Editor
{
    // Application-level input QA. Queue real Input System mouse states over separate frames;
    // this exercises the runtime input module and Button callbacks, not just business services.
    public static class RuntimeUIProbe
    {
        static GameBootstrap game; static VisualElement root; static int passed; static bool running;
        [MenuItem("Bubbles/Play-test UI with Unity input (Play mode)")]
        static void Run()
        {
            if(!EditorApplication.isPlaying)throw new Exception("Enter Play mode first.");
            if(running)return;
            running=true;passed=0;
            game=UnityEngine.Object.FindAnyObjectByType<GameBootstrap>();root=game.GetComponent<UIDocument>().rootVisualElement;
            game.StartCoroutine(Start());
        }
        static void Check(bool condition,string description)
        {if(!condition)throw new Exception("UI TEST FAILED: "+description);passed++;Debug.Log("UI PASS: "+description);}
        static IEnumerator Start()
        {
            yield return null; yield return null;
            yield return Click("Start a new business");
            if(game.View.MenuVisible)yield return Click("Confirm new business");
            Check(!game.View.MenuVisible,"new-business button reaches gameplay");
            yield return Click("Queue batch");
            Check(game.Simulation.State.jobs.Count==1 && game.Simulation.State.ingredients[0]==6,"production button reserves exact supplies");
            game.Simulation.Advance(46);game.View.Refresh();yield return null;
            Check(game.Simulation.State.products[0]==6,"batch completes and reaches inventory");
            yield return Click("Orders",prefix:true);
            yield return Click("Pack & ship");
            Check(game.Simulation.State.fulfilledOrders==1 && game.Simulation.State.cashCents==27400,"shipping button credits payment once");
            yield return Click("Supplies");
            yield return Click("Buy 12",prefix:true);
            Check(game.Simulation.State.ingredients[0]==18 && game.Simulation.State.cashCents==26200,"supplier button balances stock and cash");
            yield return Click("Upgrade");
            yield return Click("Upgrade mixer",prefix:true);
            Check(game.Simulation.State.mixerUpgraded && game.Simulation.State.cashCents==11200,"upgrade button installs faster mixer");
            yield return Click("Production");
            yield return Click("Pause");
            Check(game.Simulation.Paused,"pause button stops the business clock");
            Check(game.Simulation.Economy.Reconciles,"UI actions preserve ledger consistency");
            yield return new WaitForSecondsRealtime(.7f); game.View.Refresh();yield return new WaitForEndOfFrame();
            Directory.CreateDirectory("Verification");
            File.WriteAllText("Verification/ui-results.txt",passed+" UI assertions passed\n");
            ScreenCapture.CaptureScreenshot("Verification/UI-playtest.png");
            Debug.Log("BUBBLES_UI_VALIDATION_OK "+passed+" assertions");
            running=false;
        }
        static IEnumerator Click(string text,bool prefix=false)
        {
            yield return null;
            var button=root.Query<Button>().ToList().FirstOrDefault(b=>b.enabledInHierarchy && (prefix?b.text.StartsWith(text):b.text==text));
            if(button==null)throw new Exception("UI button not available: "+text);
            var point=button.worldBound.center;
            Vector2 screen=new(point.x*Screen.width/root.layout.width,Screen.height-point.y*Screen.height/root.layout.height);
            // Use the existing mouse device so the active runtime UI module receives the events.
            var mouse=Mouse.current ?? InputSystem.AddDevice<Mouse>();
            InputSystem.QueueStateEvent(mouse,new MouseState{position=screen});yield return null;
            InputSystem.QueueStateEvent(mouse,new MouseState{position=screen}.WithButton(UnityEngine.InputSystem.LowLevel.MouseButton.Left,true));yield return null;
            InputSystem.QueueStateEvent(mouse,new MouseState{position=screen});yield return null;yield return null;
        }
    }
}
