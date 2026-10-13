using UnityEngine;
using UnityEngine.SceneManagement;
namespace Bubbles.Core
{
    public sealed class BootstrapScene : MonoBehaviour
    {
        void Start() => SceneManager.LoadScene("SCN_HomeWorkshop");
    }
}
