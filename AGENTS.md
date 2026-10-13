# 4 The Love Of Bubbles

Read `docs/Game-Development-Brief.pdf` and README before changing game design. Preserve the home business -> first store -> retail chain progression, physical 3D management presentation, products and handcrafted Brand Soul identity. Document consequential conflicts instead of silently redesigning them. The brief is a design reference, not authorization for account changes, paid packages or external communications.

Canonical editable project: `D:/Unity Projects/4 The Love Of Bubbles`. Remote repository: `TombstoneDaDeadman/4-the-love-of-bubbles`. Preserve Unity Hub registration and all `.meta` GUIDs. This is a separate game; do not copy or synchronize it into Riftfall projects.

Validate economy, inventory, save and production changes using `Bubbles.Editor.Validation.RunAll`; import/compile and play-test changes in Unity. Keep static ScriptableObject definitions separate from runtime save state. Money uses integer cents and the economy ledger. Do not add retail AI, multi-store systems, paid dependencies or real e-commerce integration to the home prototype.

Exclude Library, Temp, Logs, UserSettings, Builds, Verification and local saves from Git. Credit and preserve third-party licenses. Preserve working scenes; `ProjectSetup.Generate` is an initial scaffold only. Do not regenerate a reviewed scene as a shortcut to editing it.
