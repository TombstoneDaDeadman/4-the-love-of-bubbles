using UnityEngine;
using UnityEngine.InputSystem;
namespace Bubbles.Core
{
    public sealed class ManagementCamera : MonoBehaviour
    {
        public Vector3 target = new(0, 0.55f, 0);
        float yaw = -42, distance = 12, actualDistance = 12;
        GameBootstrap game;
        GameObject[] walls;
        void Start() { game = FindAnyObjectByType<GameBootstrap>(); walls = GameObject.FindGameObjectsWithTag("Finish"); Position(); }
        void Update()
        {
            if (game.View.MenuVisible) return;
            var keys = Keyboard.current;
            if (keys != null)
            {
                if (keys.qKey.isPressed) yaw -= Time.unscaledDeltaTime * 65;
                if (keys.eKey.isPressed) yaw += Time.unscaledDeltaTime * 65;
                if (keys.spaceKey.wasPressedThisFrame) { game.Simulation.Paused = !game.Simulation.Paused; game.View.Refresh(); }
                if (keys.escapeKey.wasPressedThisFrame) game.ShowMenu();
                if (keys.f3Key.wasPressedThisFrame) game.View.ToggleDiagnostics();
                if (keys.homeKey.wasPressedThisFrame) { yaw = -42; distance = 12; target = new(0, .55f, 0); }
            }
            var mouse = Mouse.current;
            if (mouse != null && !game.View.IsOverPanel(mouse.position.ReadValue()))
            {
                distance = Mathf.Clamp(distance - mouse.scroll.ReadValue().y * .006f, 7, 17);
                if (mouse.rightButton.isPressed) yaw += mouse.delta.ReadValue().x * .2f;
                if (mouse.leftButton.wasPressedThisFrame)
                {
                    var ray = GetComponent<Camera>().ScreenPointToRay(mouse.position.ReadValue());
                    if (Physics.Raycast(ray, out var hit, 100))
                    {
                        var station = hit.collider.GetComponentInParent<WorkshopStation>();
                        if (station != null) game.View.SelectPanel(station.panel);
                    }
                }
            }
            actualDistance = Mathf.Lerp(actualDistance, distance, 1 - Mathf.Exp(-Time.unscaledDeltaTime * 8)); Position();
            foreach (var wall in walls)
                wall.GetComponent<Renderer>().enabled = Vector3.Dot(transform.position - target, wall.transform.position - target) < 0;
        }
        void Position()
        {
            transform.position = target + Quaternion.Euler(40, yaw, 0) * new Vector3(0, 0, -actualDistance);
            transform.LookAt(target);
        }
    }
}
