using UnityEngine;
namespace Bubbles.Core
{
    public sealed class WorkshopVisuals : MonoBehaviour
    {
        GameBootstrap game; Transform mixer; float refresh;
        void Start() { game = FindAnyObjectByType<GameBootstrap>(); mixer = GameObject.Find("Mixer Paddle").transform; }
        void Update()
        {
            var sim = game.Simulation;
            if (!sim.Paused && sim.State.jobs.Count > 0) mixer.Rotate(0, Time.deltaTime * 220 * sim.Speed, 0);
            refresh += Time.unscaledDeltaTime; if (refresh < .5f) return; refresh = 0;
            for (int p = 0; p < 3; p++)
                for (int i = 0; i < 12; i++)
                {
                    var item = transform.Find("Product " + p + "-" + i);
                    if (item != null) item.gameObject.SetActive(i < sim.State.products[p]);
                }
            var upgrade = transform.Find("Upgraded Mixer"); if (upgrade != null) upgrade.gameObject.SetActive(sim.State.mixerUpgraded);
        }
    }
}
