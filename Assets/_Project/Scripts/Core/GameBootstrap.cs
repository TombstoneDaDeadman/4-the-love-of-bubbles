using Bubbles.Data;
using Bubbles.Save;
using Bubbles.Simulation;
using Bubbles.UI;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
namespace Bubbles.Core
{
    public sealed class GameBootstrap : MonoBehaviour
    {
        public GameCatalog catalog;
        public BusinessSimulation Simulation { get; private set; }
        public SaveService Saves { get; private set; }
        public WorkshopUI View { get; private set; }
        float autosave;
        bool running;
        public string LastMessage { get; private set; } = "Welcome to your home workshop.";
        void Start()
        {
            Application.targetFrameRate = 60;
            if (EventSystem.current == null)
            {
                var events = new GameObject("Workshop UI Input");
                events.AddComponent<EventSystem>();
                events.AddComponent<InputSystemUIInputModule>().AssignDefaultActions();
            }
            Simulation = new BusinessSimulation(catalog) { Paused = true };
            Saves = new SaveService(catalog);
            View = GetComponent<WorkshopUI>(); View.Initialize(this);
        }
        public void NewBusiness()
        {
            Simulation = new BusinessSimulation(catalog); running = true; autosave = 0;
            Notify("Start by making a batch of Body Butter. Orders will arrive soon."); View.ShowGame();
        }
        public void LoadBusiness()
        {
            if (Saves.Load(out var state, out var message))
            {
                Simulation = new BusinessSimulation(catalog, state); running = true; autosave = 0; View.ShowGame();
            }
            Notify(message);
        }
        public void SaveBusiness() { Saves.Save(Simulation.State, out var message); Notify(message); }
        public void Notify(string message) { LastMessage = message; if (View != null) { if (View.MenuVisible) View.ShowMenu(); else View.Refresh(); } }
        public void ShowMenu() { Simulation.Paused = true; View.ShowMenu(); }
        public void Resume() { running = true; Simulation.Paused = false; View.ShowGame(); }
        void Update()
        {
            if (!running) return;
            Simulation.Advance(Time.unscaledDeltaTime);
            autosave += Time.unscaledDeltaTime;
            if (autosave >= 60) { autosave = 0; SaveBusiness(); }
        }
        void OnApplicationQuit() { if (running) Saves.Save(Simulation.State, out _); }
        void OnApplicationPause(bool paused) { if (paused && running) Saves.Save(Simulation.State, out _); }
    }
}
